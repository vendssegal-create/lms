import json
import requests
from django.conf import settings
from typing import Any, Tuple, List, Dict

class HemisRestApiError(Exception):
    pass

class HemisRestClient:
    def __init__(self, 
                 base_url: str = None, 
                 backend_token: str = None, 
                 timeout: int = None, 
                 language: str = None, 
                 session: requests.Session = None):
        self.base_url = (base_url or settings.HEMIS_REST_BASE_URL).rstrip("/")
        self.backend_token = (backend_token or settings.HEMIS_BACKEND_API_TOKEN).strip()
        self.timeout = timeout or settings.HEMIS_TIMEOUT
        self.language = (language or settings.HEMIS_API_LANG).strip()
        self.session = session or requests.Session()

    def search_students(self, search: str, **filters: Any) -> List[Dict[str, Any]]:
        items, _ = self.list_students(search=search, **filters)
        return items

    def list_students(self, page: int = 1, limit: int = 200, **filters: Any) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        params = {"page": page, "limit": limit}
        params.update({key: value for key, value in filters.items() if value not in (None, "")})
        payload = self._request("GET", "/v1/data/student-list", token=self.backend_token, params=params)
        return self._extract_items(payload.get("data")), self._extract_pagination(payload.get("data"))

    def list_teachers(self, page: int = 1, limit: int = 200, **filters: Any) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        params = {"type": "teacher", "page": page, "limit": limit}
        params.update({key: value for key, value in filters.items() if value not in (None, "")})
        payload = self._request("GET", "/v1/data/employee-list", token=self.backend_token, params=params)
        return self._extract_items(payload.get("data")), self._extract_pagination(payload.get("data"))

    def list_curriculums(self, page: int = 1, limit: int = 200, **filters: Any) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        params = {"page": page, "limit": limit}
        params.update({key: value for key, value in filters.items() if value not in (None, "")})
        payload = self._request("GET", "/v1/data/curriculum-list", token=self.backend_token, params=params)
        return self._extract_items(payload.get("data")), self._extract_pagination(payload.get("data"))

    def list_rooms(self, page: int = 1, limit: int = 200, **filters: Any) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        params = {"page": page, "limit": limit}
        params.update({key: value for key, value in filters.items() if value not in (None, "")})
        payload = self._request("GET", "/v1/data/auditorium-list", token=self.backend_token, params=params)
        return self._extract_items(payload.get("data")), self._extract_pagination(payload.get("data"))

    def get_student_info(self, student_id: int = None, student_id_number: str = None) -> Dict[str, Any]:
        params = {}
        if student_id is not None:
            params["student_id"] = student_id
        if student_id_number:
            params["student_id_number"] = student_id_number
        payload = self._request("GET", "/v1/data/student-info", token=self.backend_token, params=params)
        data = payload.get("data")
        return data if isinstance(data, dict) else {}

    def get_curriculum_subjects(self, curriculum_id: int, semester_code: str = None) -> List[Dict[str, Any]]:
        params = {"_curriculum": curriculum_id, "limit": 200}
        if semester_code:
            params["_semester"] = semester_code
        return self._fetch_all("/v1/data/curriculum-subject-list", token=self.backend_token, params=params)

    def get_student_subjects(self, student_id: int, education_year: int = None, semester_code: str = None) -> List[Dict[str, Any]]:
        params = {"_student": student_id, "limit": 200}
        if education_year is not None:
            params["_education_year"] = education_year
        if semester_code:
            params["_semester"] = semester_code
        return self._fetch_all("/v1/data/student-subject-list", token=self.backend_token, params=params)

    def get_student_performance(self, student_id: int) -> List[Dict[str, Any]]:
        params = {"_student": student_id, "limit": 200}
        return self._fetch_all("/v1/data/student-performance-list", token=self.backend_token, params=params)

    def get_student_academic_records(self, student_id: int) -> List[Dict[str, Any]]:
        params = {"_student": student_id, "limit": 200}
        return self._fetch_all("/v1/data/academic-record-list", token=self.backend_token, params=params)

    def get_student_debts_by_pinfl(self, pinfl: str, student_token: str = None) -> Dict[str, Any]:
        token = student_token or self.backend_token
        params = {"pinfl": pinfl, "limit": 200, "page": 1}
        
        all_debts = []
        first_payload = self._request("GET", "/v1/data/student-subject-debts", token=token, params=params)
        
        if not isinstance(first_payload, dict):
            return {}
            
        data = first_payload.get("data", {})
        if isinstance(data, dict):
            all_debts.extend(data.get("debts", []) or [])
            pagination = self._extract_pagination(data)
            page_count = int(pagination.get("pageCount") or 1)
            
            # Loop for remaining pages if any
            for page in range(2, min(page_count + 1, 21)): 
                params["page"] = page
                next_payload = self._request("GET", "/v1/data/student-subject-debts", token=token, params=params)
                next_data = next_payload.get("data", {})
                if isinstance(next_data, dict):
                    all_debts.extend(next_data.get("debts", []) or [])
            
            # Repackage the payload with all debts
            if "debts" in data:
                data["debts"] = all_debts
                
        return first_payload

    def _fetch_all(self, path: str, token: str, params: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        all_items = []
        page = 1
        request_params = (params or {}).copy()
        
        while page <= 20: # Safety cap
            request_params["page"] = page
            payload = self._request("GET", path, token=token, params=request_params)
            data = payload.get("data")
            all_items.extend(self._extract_items(data))
            
            pagination = self._extract_pagination(data)
            page_count = int(pagination.get("pageCount") or 1)
            if page >= page_count:
                break
            page += 1
            
        return all_items

    def _request(self, method: str, path: str, token: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        if not token:
            raise HemisRestApiError(f"{path} uchun token talab qilinadi.")

        request_params = {key: value for key, value in (params or {}).items() if value not in (None, "")}
        if self.language and "l" not in request_params:
            request_params["l"] = self.language

        headers = {"Accept": "application/json", "Authorization": f"Bearer {token}"}
        try:
            response = self.session.request(
                method=method, 
                url=f"{self.base_url}{path}", 
                headers=headers, 
                params=request_params, 
                timeout=self.timeout
            )
        except requests.RequestException as exc:
            raise HemisRestApiError(f"{path} uchun HEMIS so'roviga ulanib bo'lmadi: {exc}") from exc

        try:
            payload = response.json()
        except json.JSONDecodeError as exc:
            raise HemisRestApiError(f"{path} uchun HEMIS javobi JSON formatida emas.") from exc

        if response.status_code >= 400:
            raise HemisRestApiError(f"HEMIS error for {path}: {json.dumps(payload, ensure_ascii=False)}")
        
        if isinstance(payload, dict) and payload.get("success") is False:
            raise HemisRestApiError(f"{path} uchun HEMIS muvaffaqiyatsiz javob qaytardi.")
        
        return payload

    def _extract_items(self, data: Any) -> List[Dict[str, Any]]:
        if isinstance(data, list):
            items = []
            for chunk in data:
                if isinstance(chunk, dict) and isinstance(chunk.get("items"), list):
                    items.extend(chunk["items"])
                elif isinstance(chunk, dict):
                    items.append(chunk)
            return items
        if isinstance(data, dict) and isinstance(data.get("items"), list):
            return data["items"]
        return []

    def _extract_pagination(self, data: Any) -> Dict[str, Any]:
        if isinstance(data, list):
            for chunk in data:
                if isinstance(chunk, dict):
                    pagination = chunk.get("pagination")
                    if isinstance(pagination, list) and pagination:
                        return pagination[0]
                    if isinstance(pagination, dict):
                        return pagination
        if isinstance(data, dict):
            pagination = data.get("pagination")
            if isinstance(pagination, list) and pagination:
                return pagination[0]
            if isinstance(pagination, dict):
                return pagination
        return {}
