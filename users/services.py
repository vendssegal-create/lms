import base64
import json
import re
import requests
from dataclasses import dataclass
from datetime import datetime, timezone
from django.conf import settings
from django.db import transaction
from django.contrib.auth.models import Group
from users.models import User, StudentProfile, TeacherProfile

class HemisOAuthError(Exception):
    pass

@dataclass
class HemisAuthResult:
    user: User
    profile: dict
    access_token: str

class HemisOAuthService:
    PLACEHOLDER_HOSTS = ("university_name.uz", "hemis.example.uz", "your-university-domain.uz")
    
    # Map HEMIS role codes to Django Role identifiers
    ACCESS_GROUPS = {
        "teacher": User.Role.TEACHER,
        "academic_board": User.Role.ACADEMIC_BOARD,
        "direction": User.Role.DIRECTION,
        "registrator_office": User.Role.REGISTRATOR,
    }

    def __init__(self):
        self.client_id = settings.HEMIS_OAUTH_CLIENT_ID
        self.client_secret = settings.HEMIS_OAUTH_CLIENT_SECRET
        self.redirect_uri = settings.HEMIS_OAUTH_REDIRECT_URI
        self.authorize_url = settings.HEMIS_OAUTH_AUTHORIZE_URL
        self.token_url = settings.HEMIS_OAUTH_TOKEN_URL
        self.userinfo_url = settings.HEMIS_OAUTH_USERINFO_URL
        self.timeout = settings.HEMIS_TIMEOUT

    def is_configured(self) -> bool:
        return not self.missing_oauth_settings()

    def missing_oauth_settings(self) -> list[str]:
        checks = {
            "HEMIS_OAUTH_CLIENT_ID": self.client_id,
            "HEMIS_OAUTH_CLIENT_SECRET": self.client_secret,
            "HEMIS_OAUTH_REDIRECT_URI": self.redirect_uri,
            "HEMIS_OAUTH_AUTHORIZE_URL": self.authorize_url,
            "HEMIS_OAUTH_TOKEN_URL": self.token_url,
            "HEMIS_OAUTH_USERINFO_URL": self.userinfo_url,
        }
        missing = []
        for name, value in checks.items():
            if not value:
                missing.append(name)
                continue
            if name.endswith("_URL") and any(host in value for host in self.PLACEHOLDER_HOSTS):
                missing.append(name)
        return missing

    def get_authorization_url(self, state: str) -> str:
        from urllib.parse import urlencode
        query = urlencode({
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "state": state,
        })
        return f"{self.authorize_url}?{query}"

    @transaction.atomic
    def authenticate(self, auth_code: str) -> HemisAuthResult:
        token_response = self.exchange_code_for_token(auth_code)
        access_token = token_response.get("access_token")
        if not access_token:
            raise HemisOAuthError("HEMIS access token olinmadi.")

        profile = self.fetch_user_profile(access_token)
        if not isinstance(profile, dict):
            raise HemisOAuthError("HEMIS user ma'lumoti noto'g'ri formatda qaytdi.")

        user = self.upsert_teacher_user(profile)
        return HemisAuthResult(user=user, profile=profile, access_token=access_token)

    def exchange_code_for_token(self, auth_code: str) -> dict:
        payload = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "code": auth_code,
            "redirect_uri": self.redirect_uri,
            "grant_type": "authorization_code",
        }
        try:
            return self._request_token(payload)
        except HemisOAuthError as exc:
            if "invalid_client" not in str(exc):
                raise
            return self._request_token(payload, use_basic_auth=True)

    def _request_token(self, payload: dict, use_basic_auth: bool = False) -> dict:
        headers = {"Accept": "application/json"}
        data = payload.copy()
        if use_basic_auth:
            credentials = f"{self.client_id}:{self.client_secret}".encode("utf-8")
            headers["Authorization"] = f"Basic {base64.b64encode(credentials).decode('ascii')}"
            data.pop("client_secret", None)

        try:
            response = requests.post(self.token_url, data=data, headers=headers, timeout=self.timeout)
        except requests.RequestException as exc:
            raise HemisOAuthError(f"HEMIS token so'roviga ulanib bo'lmadi: {exc}") from exc
        return self._parse_json_response(response, "access token")

    def fetch_user_profile(self, access_token: str) -> dict:
        headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}
        try:
            response = requests.get(self.userinfo_url, headers=headers, timeout=self.timeout)
        except requests.RequestException as exc:
            raise HemisOAuthError(f"HEMIS user ma'lumotiga ulanib bo'lmadi: {exc}") from exc
        return self._parse_json_response(response, "user profile")

    def upsert_teacher_user(self, profile: dict) -> User:
        role_id = self.determine_role(profile)
        if role_id == User.Role.STUDENT:
            raise HemisOAuthError("HEMIS student akkaunti bu LMS kirish oqimi uchun ruxsat etilmagan.")

        user_login = self._clean_value(profile.get("login") or profile.get("username"))
        hemis_id = self._clean_value(profile.get("id") or profile.get("employee_id"))
        hemis_uuid = self._clean_value(profile.get("uuid"))
        email = self._clean_value(profile.get("email")) or ""
        
        username = user_login or f"teacher_{hemis_id}"
        user, _ = User.objects.get_or_create(username=username)
        
        full_name = self._clean_value(profile.get("name") or profile.get("full_name")) or username
        first_name, last_name = self._split_name(full_name)
        
        user.first_name = first_name or full_name
        user.last_name = last_name
        user.email = email
        user.role = role_id
        user.is_active = True
        # Note: .save() will automatically set is_staff now
        user.save()

        teacher_profile, _ = TeacherProfile.objects.get_or_create(user=user)
        teacher_profile.full_name = full_name
        teacher_profile.university = self._clean_value(profile.get("university")) or "HEMIS"
        teacher_profile.department = self._clean_value(profile.get("department")) or ""
        teacher_profile.hemis_id = str(hemis_id) if hemis_id else ""
        teacher_profile.hemis_uuid = hemis_uuid
        teacher_profile.hemis_position = self._clean_value(profile.get("position")) or ""
        teacher_profile.avatar_full_url = self._clean_value(profile.get("picture_full")) or self._clean_value(profile.get("picture")) or ""
        teacher_profile.auth_provider = "hemis"
        teacher_profile.profile_payload = profile
        teacher_profile.phone = self._clean_value(profile.get("phone")) or ""
        teacher_profile.save()
        
        self.sync_groups(user, profile, role_id)
        
        return user

    def determine_role(self, profile: dict) -> str:
        roles = profile.get("roles", [])
        if not isinstance(roles, list):
            roles = []
            
        role_codes = {self._clean_value(r.get("code")) for r in roles if isinstance(r, dict) and r.get("code")}
        role_names = " ".join(self._clean_value(r.get("name") or "").lower() for r in roles if isinstance(r, dict) and r.get("name"))
        
        text = " ".join(
            value.lower()
            for value in [
                self._clean_value(profile.get("type")),
                self._clean_value(profile.get("role")),
                self._clean_value(profile.get("position")),
                self._clean_value(profile.get("department")),
                " ".join(filter(None, role_codes)),
                role_names,
            ]
            if value
        )
        
        if "student" in text or "talaba" in text:
            return User.Role.STUDENT
        if role_codes.intersection({"academic_board", "direction", "registrator_office"}):
            # Try to pick specific admin role
            for key in ["academic_board", "direction", "registrator_office"]:
                if key in role_codes:
                    return self.ACCESS_GROUPS[key]
            return User.Role.ACADEMIC_BOARD
        if any(kw in text for kw in ["academic_board", "rahbariyat", "registrator", "o'quv bo'limi"]):
            return User.Role.ACADEMIC_BOARD
        if "teacher" in role_codes or "o'qituvchi" in text:
            return User.Role.TEACHER
        if "admin" in text or "administrator" in text:
            return User.Role.SUPER_ADMIN
        return User.Role.TEACHER

    def sync_groups(self, user: User, profile: dict, role_id: str) -> None:
        desired_groups = set()
        
        # Add primary role as group
        desired_groups.add(role_id.replace('_', ' ').title())
            
        roles_list = profile.get("roles", [])
        if isinstance(roles_list, list):
            for r in roles_list:
                if isinstance(r, dict):
                    code = r.get("code")
                    django_role = self.ACCESS_GROUPS.get(code)
                    if django_role:
                        # Convert identifier to a more human group name
                        group_name = django_role.replace('_', ' ').title()
                        desired_groups.add(group_name)

        user.groups.clear()
        for group_name in desired_groups:
            group, _ = Group.objects.get_or_create(name=group_name)
            user.groups.add(group)

    def _split_name(self, full_name: str) -> tuple[str, str]:
        parts = [part for part in full_name.split() if part]
        if not parts:
            return "", ""
        if len(parts) == 1:
            return parts[0], ""
        return parts[0], " ".join(parts[1:])

    def _clean_value(self, value):
        if value is None:
            return None
        value = str(value).strip()
        return value or None

    def _parse_json_response(self, response: requests.Response, label: str) -> dict:
        try:
            data = response.json()
        except json.JSONDecodeError as exc:
            raise HemisOAuthError(f"HEMIS {label} javobi JSON emas.") from exc

        if response.status_code >= 400:
            raise HemisOAuthError(f"HEMIS {label} so'rovi xato qaytardi: {json.dumps(data, ensure_ascii=False)}")
        return data

def login_student_via_bstu(username: str, password: str) -> User:
    login_url = "https://student.bstu.uz/rest/v1/auth/login"
    login_data = {"login": username, "password": password}

    try:
        login_response = requests.post(login_url, json=login_data, timeout=15)
        if login_response.status_code != 200:
            raise HemisOAuthError("Login yoki parol noto'g'ri (Student API).")
        
        access_token = login_response.json().get("data", {}).get("token")
        if not access_token:
            raise HemisOAuthError("Javobda token topilmadi.")

        me_response = requests.get(
            "https://student.bstu.uz/rest/v1/account/me", 
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=15
        )
        if me_response.status_code != 200:
            raise HemisOAuthError(f"Talaba ma'lumotlarini olishda xatolik: {me_response.text}")
            
        me_data = me_response.json().get("data", {})
        
        with transaction.atomic():
            user, _ = User.objects.get_or_create(username=username)
            user.first_name = me_data.get("full_name", username)
            user.role = User.Role.STUDENT
            user.is_active = True
            user.save() # sets is_staff=False automatically

            group, _ = Group.objects.get_or_create(name="Student")
            user.groups.add(group)

            profile, _ = StudentProfile.objects.get_or_create(user=user)
            profile.full_name = me_data.get("full_name", "") or username
            profile.student_id_number = username
            profile.university = me_data.get("university", "") or "BSTU"
            
            # Map detailed fields
            profile.faculty_name = (me_data.get("faculty") or {}).get("name", "")
            profile.group_name = (me_data.get("group") or {}).get("name", "")
            profile.specialty_name = (me_data.get("specialty") or {}).get("name", "")
            profile.education_lang = (me_data.get("educationLang") or {}).get("name", "")
            profile.level = (me_data.get("level") or {}).get("name", "")
            profile.education_form = (me_data.get("educationForm") or {}).get("name", "")
            profile.education_type = (me_data.get("educationType") or {}).get("name", "")
            profile.payment_form = (me_data.get("paymentForm") or {}).get("name", "")
            profile.student_status = (me_data.get("studentStatus") or {}).get("name", "")
            profile.address = me_data.get("address", "") or ""
            profile.country = (me_data.get("country") or {}).get("name", "")
            profile.province = (me_data.get("province") or {}).get("name", "")
            profile.district = (me_data.get("district") or {}).get("name", "")
            profile.social_category = (me_data.get("socialCategory") or {}).get("name", "")
            profile.accommodation = (me_data.get("accommodation") or {}).get("name", "")
            profile.bstu_token = access_token
            
            # Handle birth date
            birth_date_raw = me_data.get("birth_date")
            if birth_date_raw and isinstance(birth_date_raw, (int, float)):
                profile.birth_date = datetime.fromtimestamp(birth_date_raw, tz=timezone.utc).date()
            
            profile.save()

        return user
    except requests.RequestException as exc:
        raise HemisOAuthError(f"Student API so'roviga ulanib bo'lmadi: {exc}")
