# Fullstack Senior Prompt: Moodle-darajasidagi Kurs Resurslari Tizimi

## Loyiha konteksti

Django 5 + React/TypeScript (Vite, Tailwind) asosidagi LMS tizimi.

**Hozirgi holat:**
- `SectionResource` modeli: `file`, `link`, `video`, `text`, `certificate` (5 ta tip)
- Model: `file`, `url`, `content`, `original_filename`, `order` maydonlari
- Backend: `lms/api_views.py` (2856 qator monolitik)
- Frontend: `SectionAccordion.tsx`, `EmbeddedResourceViewer.tsx`, `CourseManagePage.tsx`, `CourseDetailPage.tsx`
- Tracking: `SectionCompletion` modeli mavjud (section darajasida)
- Types: `design/src/types.ts` → `CourseDetailResource` interface

**Maqsad:** Moodle platformasidek chuqur, keng qamrovli resurs tizimini joriy qilish.

---

## 1-BOSQICH — Backend: Model kengaytirish

### 1.1 `lms/models.py` — `SectionResourceType` va `SectionResource` ni kengaytirish

```python
class SectionResourceType(models.TextChoices):
    FILE      = "file",        _("Fayl")
    LINK      = "link",        _("Havola")
    VIDEO     = "video",       _("Video")
    TEXT      = "text",        _("Matn sahifasi")
    AUDIO     = "audio",       _("Audio")
    EMBED     = "embed",       _("Embed / iframe")
    H5P       = "h5p",         _("H5P interaktiv")
    SCORM     = "scorm",       _("SCORM paketi")
    FOLDER    = "folder",      _("Papka")
    BOOK      = "book",        _("Kitob (ko'p sahifa)")
    GLOSSARY  = "glossary",    _("Glossariy")
    CERTIFICATE = "certificate", _("Sertifikat")
```

`SectionResource` modelini quyidagicha yangilang (mavjud maydonlarni saqlang, yangilarini qo'shing):

```python
class SectionResource(models.Model):
    section         = models.ForeignKey(Section, on_delete=models.CASCADE, related_name='resources')
    title           = models.CharField(max_length=255)
    description     = models.TextField(blank=True, default="")          # NEW: qisqa tavsif
    resource_type   = models.CharField(max_length=16, choices=SectionResourceType.choices, default=SectionResourceType.FILE)
    order           = models.IntegerField(default=0)
    is_visible      = models.BooleanField(default=True)                  # NEW: yashirish imkoni

    # --- Fayl ---
    file            = models.FileField(upload_to='resources/', null=True, blank=True)
    original_filename = models.CharField(max_length=255, default="", blank=True)
    file_size       = models.PositiveBigIntegerField(null=True, blank=True)  # NEW: bayt
    mime_type       = models.CharField(max_length=128, blank=True, default="")  # NEW

    # --- URL / Havola ---
    url             = models.URLField(max_length=2000, null=True, blank=True)
    open_in_new_tab = models.BooleanField(default=True)                  # NEW

    # --- Matn / Book / Glossary ---
    content         = models.TextField(null=True, blank=True)            # HTML content (rich)

    # --- Video ---
    video_source    = models.CharField(max_length=16, default="url",
                        choices=[("url","URL"), ("youtube","YouTube"), ("vimeo","Vimeo"), ("file","Fayl")])  # NEW
    video_poster_url = models.URLField(max_length=2000, null=True, blank=True)  # NEW: thumbnail

    # --- Audio ---
    audio_transcript = models.TextField(blank=True, default="")         # NEW: transkripsiya

    # --- H5P ---
    h5p_embed_code  = models.TextField(blank=True, default="")          # NEW: H5P iframe embed kodi

    # --- SCORM ---
    scorm_version   = models.CharField(max_length=16, blank=True, default="")  # NEW: "1.2" yoki "2004"
    scorm_entry_url = models.CharField(max_length=500, blank=True, default="") # NEW: index fayli path

    # --- Embed ---
    embed_width     = models.CharField(max_length=16, default="100%")   # NEW
    embed_height    = models.CharField(max_length=16, default="500px")  # NEW

    # --- Tracking ---
    require_completion = models.BooleanField(default=False)             # NEW: Majburiy o'qish
    estimated_time_minutes = models.IntegerField(null=True, blank=True) # NEW: taxminiy vaqt

    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)               # NEW

    class Meta:
        ordering = ['order']
```

### 1.2 Yangi modellar

```python
class ResourceView(models.Model):
    """Har bir talabaning resursi ko'rganini tracking qilish."""
    resource    = models.ForeignKey(SectionResource, on_delete=models.CASCADE, related_name='views')
    student     = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    first_viewed_at = models.DateTimeField(auto_now_add=True)
    last_viewed_at  = models.DateTimeField(auto_now=True)
    view_count  = models.IntegerField(default=1)
    is_completed = models.BooleanField(default=False)  # Talaba "O'qidim" bosdi
    completed_at = models.DateTimeField(null=True, blank=True)
    time_spent_seconds = models.IntegerField(default=0)  # Sahifada qancha vaqt o'tkazgan

    class Meta:
        unique_together = ('resource', 'student')


class BookChapter(models.Model):
    """Book resource uchun ko'p sahifa."""
    resource    = models.ForeignKey(SectionResource, on_delete=models.CASCADE, related_name='chapters')
    title       = models.CharField(max_length=255)
    content     = models.TextField()               # HTML
    order       = models.IntegerField(default=0)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order']


class GlossaryEntry(models.Model):
    """Glossary resource uchun atama va ta'rif."""
    resource    = models.ForeignKey(SectionResource, on_delete=models.CASCADE, related_name='glossary_entries')
    term        = models.CharField(max_length=255)
    definition  = models.TextField()
    created_by  = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['term']


class FolderFile(models.Model):
    """Folder resource ichidagi fayllar."""
    resource        = models.ForeignKey(SectionResource, on_delete=models.CASCADE, related_name='folder_files')
    file            = models.FileField(upload_to='folder_files/')
    original_filename = models.CharField(max_length=255)
    file_size       = models.PositiveBigIntegerField(null=True, blank=True)
    mime_type       = models.CharField(max_length=128, blank=True, default="")
    order           = models.IntegerField(default=0)
    uploaded_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order']
```

### 1.3 Migration

```bash
python manage.py makemigrations lms --name "moodle_like_resources"
python manage.py migrate
```

---

## 2-BOSQICH — Backend: API Endpointlar

### 2.1 `lms/api_views.py` — `_serialize_resource()` ni kengaytiring

```python
def _serialize_resource(resource, user=None):
    data = {
        "id": resource.id,
        "title": resource.title,
        "description": resource.description,
        "resource_type": resource.resource_type,
        "resource_type_label": resource.get_resource_type_display(),
        "order": resource.order,
        "is_visible": resource.is_visible,
        "require_completion": resource.require_completion,
        "estimated_time_minutes": resource.estimated_time_minutes,

        # Fayl
        "file_url": resource.file.url if resource.file else None,
        "original_filename": resource.original_filename,
        "file_size": resource.file_size,
        "mime_type": resource.mime_type,

        # URL
        "url": resource.url,
        "open_in_new_tab": resource.open_in_new_tab,

        # Matn
        "content": resource.content,

        # Video
        "video_source": resource.video_source,
        "video_poster_url": resource.video_poster_url,

        # Audio
        "audio_transcript": resource.audio_transcript,

        # H5P
        "h5p_embed_code": resource.h5p_embed_code,

        # SCORM
        "scorm_version": resource.scorm_version,
        "scorm_entry_url": resource.scorm_entry_url,

        # Embed
        "embed_width": resource.embed_width,
        "embed_height": resource.embed_height,

        # Tracking (user bo'lsa)
        "view_data": None,
    }

    # Certificate uchun
    if resource.resource_type == "certificate":
        data["certificate_download_url"] = f"/api/lms/courses/{resource.section.course_id}/certificate/download/"
        data["certificate_check_url"] = f"/api/lms/courses/{resource.section.course_id}/certificate/check/"

    # Folder uchun
    if resource.resource_type == "folder":
        data["folder_files"] = [
            {
                "id": f.id,
                "original_filename": f.original_filename,
                "file_url": f.file.url if f.file else None,
                "file_size": f.file_size,
                "mime_type": f.mime_type,
            }
            for f in resource.folder_files.all()
        ]

    # Book uchun
    if resource.resource_type == "book":
        data["chapters"] = [
            {"id": ch.id, "title": ch.title, "order": ch.order}
            for ch in resource.chapters.all()
        ]

    # Glossary uchun
    if resource.resource_type == "glossary":
        data["glossary_entries"] = [
            {"id": e.id, "term": e.term, "definition": e.definition}
            for e in resource.glossary_entries.all().order_by("term")
        ]

    # Talaba tracking ma'lumoti
    if user and user.is_authenticated:
        try:
            rv = ResourceView.objects.get(resource=resource, student=user)
            data["view_data"] = {
                "view_count": rv.view_count,
                "is_completed": rv.is_completed,
                "completed_at": _iso(rv.completed_at),
                "time_spent_seconds": rv.time_spent_seconds,
            }
        except ResourceView.DoesNotExist:
            data["view_data"] = {"view_count": 0, "is_completed": False}

    return data
```

### 2.2 Yangi API endpointlar (`lms/api_views.py`)

```python
# ---- RESOURCE VIEW TRACKING ----

@require_POST
@login_required
def resource_mark_viewed(request, resource_id: int):
    """Talaba resursi ochdi — view count oshirish."""
    resource = get_object_or_404(SectionResource, id=resource_id)
    rv, created = ResourceView.objects.get_or_create(
        resource=resource, student=request.user
    )
    if not created:
        rv.view_count += 1
        rv.save(update_fields=["view_count", "last_viewed_at"])
    return JsonResponse({"success": True, "view_count": rv.view_count})


@require_POST
@login_required
def resource_mark_completed(request, resource_id: int):
    """Talaba 'O'qidim' bosdi."""
    resource = get_object_or_404(SectionResource, id=resource_id)
    payload = _json_body(request)
    time_spent = int(payload.get("time_spent_seconds", 0))

    rv, _ = ResourceView.objects.get_or_create(resource=resource, student=request.user)
    rv.is_completed = True
    rv.completed_at = timezone.now()
    rv.time_spent_seconds = rv.time_spent_seconds + time_spent
    rv.save(update_fields=["is_completed", "completed_at", "time_spent_seconds", "last_viewed_at"])

    return JsonResponse({"success": True, "completed_at": _iso(rv.completed_at)})


# ---- BOOK CHAPTERS ----

@require_GET
def resource_book_chapter(request, resource_id: int, chapter_id: int):
    """Kitob bobini qaytaradi."""
    resource = get_object_or_404(SectionResource, id=resource_id, resource_type="book")
    chapter = get_object_or_404(BookChapter, id=chapter_id, resource=resource)
    return JsonResponse({
        "id": chapter.id,
        "title": chapter.title,
        "content": chapter.content,
        "order": chapter.order,
    })


@require_POST
@login_required
def teacher_book_chapter_save(request, resource_id: int):
    """Bob yaratish yoki tahrirlash."""
    deny = _require_can_manage_courses(request)
    if deny: return deny

    resource = get_object_or_404(SectionResource, id=resource_id, resource_type="book")
    payload = _json_body(request)
    chapter_id = payload.get("id")
    title = (payload.get("title") or "").strip()
    content = payload.get("content", "")

    if not title:
        return JsonResponse({"error": "title shart."}, status=400)

    if chapter_id:
        chapter = get_object_or_404(BookChapter, id=chapter_id, resource=resource)
        chapter.title = title
        chapter.content = content
        chapter.save()
    else:
        next_order = (BookChapter.objects.filter(resource=resource).aggregate(m=models.Max("order")).get("m") or 0) + 1
        chapter = BookChapter.objects.create(resource=resource, title=title, content=content, order=next_order)

    return JsonResponse({"success": True, "chapter": {"id": chapter.id, "title": chapter.title, "order": chapter.order}})


@require_POST
@login_required
def teacher_book_chapter_delete(request, resource_id: int, chapter_id: int):
    deny = _require_can_manage_courses(request)
    if deny: return deny
    chapter = get_object_or_404(BookChapter, id=chapter_id, resource__id=resource_id)
    chapter.delete()
    return JsonResponse({"success": True})


# ---- GLOSSARY ----

@require_POST
@login_required
def teacher_glossary_entry_save(request, resource_id: int):
    deny = _require_can_manage_courses(request)
    if deny: return deny

    resource = get_object_or_404(SectionResource, id=resource_id, resource_type="glossary")
    payload = _json_body(request)
    entry_id = payload.get("id")
    term = (payload.get("term") or "").strip()
    definition = (payload.get("definition") or "").strip()

    if not term or not definition:
        return JsonResponse({"error": "term va definition shart."}, status=400)

    if entry_id:
        entry = get_object_or_404(GlossaryEntry, id=entry_id, resource=resource)
        entry.term = term
        entry.definition = definition
        entry.save()
    else:
        entry = GlossaryEntry.objects.create(resource=resource, term=term, definition=definition, created_by=request.user)

    return JsonResponse({"success": True, "entry": {"id": entry.id, "term": entry.term, "definition": entry.definition}})


# ---- FOLDER ----

@require_POST
@login_required
def teacher_folder_file_upload(request, resource_id: int):
    """Papkaga fayl qo'shish."""
    deny = _require_can_manage_courses(request)
    if deny: return deny

    resource = get_object_or_404(SectionResource, id=resource_id, resource_type="folder")
    uploaded_file = request.FILES.get("file")
    if not uploaded_file:
        return JsonResponse({"error": "file shart."}, status=400)

    next_order = (FolderFile.objects.filter(resource=resource).aggregate(m=models.Max("order")).get("m") or 0) + 1
    import mimetypes
    mime, _ = mimetypes.guess_type(uploaded_file.name)

    ff = FolderFile.objects.create(
        resource=resource,
        file=uploaded_file,
        original_filename=uploaded_file.name,
        file_size=uploaded_file.size,
        mime_type=mime or "",
        order=next_order,
    )
    return JsonResponse({"success": True, "file": {
        "id": ff.id,
        "original_filename": ff.original_filename,
        "file_url": ff.file.url,
        "file_size": ff.file_size,
    }})


@require_POST
@login_required
def teacher_folder_file_delete(request, resource_id: int, file_id: int):
    deny = _require_can_manage_courses(request)
    if deny: return deny
    ff = get_object_or_404(FolderFile, id=file_id, resource__id=resource_id)
    ff.file.delete(save=False)
    ff.delete()
    return JsonResponse({"success": True})


# ---- CERTIFICATE CHECK ----

@require_GET
@login_required
def course_certificate_check(request, course_id: int):
    course = get_object_or_404(Course, id=course_id)
    is_eligible, result = check_certificate_eligibility(request.user, course)
    existing = UserCertificate.objects.filter(user=request.user, course=course).first()
    return JsonResponse({
        "is_eligible": is_eligible,
        "message": result if not is_eligible else "Sertifikat tayyor!",
        "has_certificate": existing is not None,
        "download_url": f"/api/lms/courses/{course_id}/certificate/download/" if existing else None,
    })


# ---- RESOURCE CREATE — kengaytirilgan versiya ----

@require_POST
def teacher_resource_create(request, section_id: int):
    """
    Qo'llab-quvvatlangan resource_type lar:
    file | link | video | text | audio | embed | h5p | scorm | folder | book | glossary | certificate
    """
    deny = _require_can_manage_courses(request)
    if deny: return deny

    section = get_object_or_404(Section.objects.select_related("course"), id=section_id)
    if not _can_manage_course(request, section.course):
        return JsonResponse({"error": "Bu kurs sizga tegishli emas."}, status=403)

    ALLOWED_TYPES = ("file", "link", "video", "text", "audio", "embed", "h5p", "scorm", "folder", "book", "glossary", "certificate")

    is_multipart = request.content_type and "multipart" in request.content_type
    payload = {} if is_multipart else _json_body(request)
    resource_type = (request.POST.get("resource_type") if is_multipart else payload.get("resource_type", "")).strip()
    title = (request.POST.get("title") if is_multipart else payload.get("title", "")).strip()
    description = (request.POST.get("description", "") if is_multipart else payload.get("description", "")).strip()

    if not title:
        return JsonResponse({"error": "title shart."}, status=400)
    if resource_type not in ALLOWED_TYPES:
        return JsonResponse({"error": f"resource_type noto'g'ri. Mumkin: {', '.join(ALLOWED_TYPES)}"}, status=400)

    next_order = (SectionResource.objects.filter(section=section).aggregate(m=models.Max("order")).get("m") or 0) + 1
    resource = SectionResource(section=section, title=title, description=description, resource_type=resource_type, order=next_order)

    import mimetypes

    if resource_type == "file":
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return JsonResponse({"error": "file shart."}, status=400)
        resource.file = uploaded_file
        resource.original_filename = uploaded_file.name
        resource.file_size = uploaded_file.size
        mime, _ = mimetypes.guess_type(uploaded_file.name)
        resource.mime_type = mime or ""

    elif resource_type == "audio":
        uploaded_file = request.FILES.get("file")
        if uploaded_file:
            resource.file = uploaded_file
            resource.original_filename = uploaded_file.name
            resource.file_size = uploaded_file.size
            resource.mime_type = uploaded_file.content_type or "audio/mpeg"
        else:
            url = (payload.get("url") or "").strip()
            if not url:
                return JsonResponse({"error": "audio fayl yoki URL shart."}, status=400)
            resource.url = url

    elif resource_type in ("link", "embed"):
        url = (payload.get("url") or "").strip()
        if not url:
            return JsonResponse({"error": "url shart."}, status=400)
        resource.url = url
        resource.open_in_new_tab = bool(payload.get("open_in_new_tab", True))
        if resource_type == "embed":
            resource.embed_width = payload.get("embed_width", "100%")
            resource.embed_height = payload.get("embed_height", "500px")

    elif resource_type == "video":
        video_source = (payload.get("video_source") or "url").strip()
        resource.video_source = video_source
        if video_source == "file":
            uploaded_file = request.FILES.get("file")
            if not uploaded_file:
                return JsonResponse({"error": "video fayl shart."}, status=400)
            resource.file = uploaded_file
            resource.original_filename = uploaded_file.name
            resource.file_size = uploaded_file.size
            resource.mime_type = uploaded_file.content_type or "video/mp4"
        else:
            url = (payload.get("url") or "").strip()
            if not url:
                return JsonResponse({"error": "video URL shart."}, status=400)
            resource.url = url
        resource.video_poster_url = payload.get("video_poster_url") or None

    elif resource_type == "text":
        content = payload.get("content", "")
        if not content:
            return JsonResponse({"error": "content shart."}, status=400)
        resource.content = content

    elif resource_type == "h5p":
        embed_code = (payload.get("h5p_embed_code") or "").strip()
        if not embed_code:
            return JsonResponse({"error": "H5P embed kodi shart."}, status=400)
        resource.h5p_embed_code = embed_code

    elif resource_type == "scorm":
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return JsonResponse({"error": "SCORM zip fayl shart."}, status=400)
        resource.file = uploaded_file
        resource.original_filename = uploaded_file.name
        resource.file_size = uploaded_file.size
        resource.scorm_version = payload.get("scorm_version", "1.2")
        resource.scorm_entry_url = payload.get("scorm_entry_url", "index.html")

    elif resource_type == "certificate":
        resource.url = f"/api/lms/courses/{section.course_id}/certificate/download/"

    # book, folder, glossary — bo'sh yaratiladi, keyin alohida endpoint orqali to'ldiriladi

    resource.require_completion = bool(payload.get("require_completion", False))
    resource.estimated_time_minutes = payload.get("estimated_time_minutes") or None

    resource.save()
    return JsonResponse({"success": True, "resource": _serialize_resource(resource)})
```

### 2.3 `lms/api_urls.py` — Yangi URLlar qo'shish

```python
# Tracking
path("resources/<int:resource_id>/viewed/", api_views.resource_mark_viewed, name="api_resource_viewed"),
path("resources/<int:resource_id>/complete/", api_views.resource_mark_completed, name="api_resource_complete"),

# Book
path("resources/<int:resource_id>/chapters/<int:chapter_id>/", api_views.resource_book_chapter, name="api_book_chapter"),
path("teacher/resources/<int:resource_id>/chapters/save/", api_views.teacher_book_chapter_save, name="api_teacher_book_chapter_save"),
path("teacher/resources/<int:resource_id>/chapters/<int:chapter_id>/delete/", api_views.teacher_book_chapter_delete, name="api_teacher_book_chapter_delete"),

# Glossary
path("teacher/resources/<int:resource_id>/glossary/save/", api_views.teacher_glossary_entry_save, name="api_teacher_glossary_save"),

# Folder
path("teacher/resources/<int:resource_id>/folder/upload/", api_views.teacher_folder_file_upload, name="api_teacher_folder_upload"),
path("teacher/resources/<int:resource_id>/folder/<int:file_id>/delete/", api_views.teacher_folder_file_delete, name="api_teacher_folder_file_delete"),

# Certificate check
path("courses/<int:course_id>/certificate/check/", api_views.course_certificate_check, name="api_course_certificate_check"),
```

---

## 3-BOSQICH — Frontend: TypeScript turlari

### 3.1 `design/src/types.ts` — `CourseDetailResource` ni yangilang

```typescript
export interface ResourceViewData {
  view_count: number;
  is_completed: boolean;
  completed_at: string | null;
  time_spent_seconds: number;
}

export interface FolderFileItem {
  id: number;
  original_filename: string;
  file_url: string | null;
  file_size: number | null;
  mime_type: string;
}

export interface BookChapter {
  id: number;
  title: string;
  order: number;
  content?: string;   // faqat to'liq fetch qilganda
}

export interface GlossaryEntry {
  id: number;
  term: string;
  definition: string;
}

export type ResourceType =
  | 'file' | 'link' | 'video' | 'text' | 'audio'
  | 'embed' | 'h5p' | 'scorm' | 'folder' | 'book'
  | 'glossary' | 'certificate';

export interface CourseDetailResource {
  id: number;
  title: string;
  description: string;
  resource_type: ResourceType;
  resource_type_label: string;
  order: number;
  is_visible: boolean;
  require_completion: boolean;
  estimated_time_minutes: number | null;

  // Fayl
  file_url: string | null;
  original_filename: string;
  file_size: number | null;
  mime_type: string;

  // URL
  url: string | null;
  open_in_new_tab: boolean;

  // Matn
  content: string | null;

  // Video
  video_source: 'url' | 'youtube' | 'vimeo' | 'file';
  video_poster_url: string | null;

  // Audio
  audio_transcript: string;

  // H5P
  h5p_embed_code: string;

  // SCORM
  scorm_version: string;
  scorm_entry_url: string;

  // Embed
  embed_width: string;
  embed_height: string;

  // Folder
  folder_files?: FolderFileItem[];

  // Book
  chapters?: BookChapter[];

  // Glossary
  glossary_entries?: GlossaryEntry[];

  // Certificate
  certificate_download_url?: string;
  certificate_check_url?: string;

  // Tracking
  view_data: ResourceViewData | null;
}
```

---

## 4-BOSQICH — Frontend: Viewer komponentlar

### 4.1 `design/src/components/lms/EmbeddedResourceViewer.tsx` — to'liq qayta yozing

Asosiy mantiq: `resource.resource_type` ga qarab to'g'ri panel render qiling.

```
resource_type → Panel komponenti
─────────────────────────────────────────────────
file          → FilePreviewPanel
               (pdf → PdfPreview, office → OfficePreview,
                image → <img>, boshqa → download card)
link          → LinkPanel (preview card + open button)
video         → VideoPanel
               (youtube → YouTube embed,
                vimeo → Vimeo embed,
                file/url → HTML5 <video> player)
text          → TextPanel (HTML dangerously render + reading progress)
audio         → AudioPanel (HTML5 <audio> + transcript accordion)
embed         → EmbedPanel (iframe, width/height sozlamalar)
h5p           → H5PPanel (H5P iframe embed kodi)
scorm         → ScormPanel (SCORM fayl ochish)
folder        → FolderPanel (fayl ro'yxati, har biri yuklab olish)
book          → BookPanel (bob navigatsiya, prev/next, progress)
glossary      → GlossaryPanel (qidiruv bilan atamalar ro'yxati)
certificate   → CertificatePanel (check → eligible/locked, download)
```

**Har bir panel uchun umumiy xususiyatlar:**
1. Yuklanish holati (skeleton)
2. Xato holati (retry tugmasi)
3. "O'qidim / Ko'rdim" tugmasi (`require_completion = true` bo'lsa majburiy)
4. Vaqt o'lchagich (sekund) — `resource_mark_completed` ga yuborish

### 4.2 `VideoPanel` — YouTube/Vimeo/File uchun

```typescript
function VideoPanel({ resource }: { resource: CourseDetailResource }) {
  // YouTube ID ni URL dan ajratib olish
  function getYoutubeId(url: string): string | null {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match ? match[1] : null;
  }

  // Vimeo ID ni URL dan ajratib olish
  function getVimeoId(url: string): string | null {
    const match = url.match(/vimeo\.com\/(\d+)/);
    return match ? match[1] : null;
  }

  if (resource.video_source === 'youtube' && resource.url) {
    const videoId = getYoutubeId(resource.url);
    return (
      <div className="aspect-video w-full">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?rel=0`}
          className="h-full w-full border-none"
          allowFullScreen
          title={resource.title}
        />
      </div>
    );
  }

  if (resource.video_source === 'vimeo' && resource.url) {
    const videoId = getVimeoId(resource.url);
    return (
      <div className="aspect-video w-full">
        <iframe
          src={`https://player.vimeo.com/video/${videoId}`}
          className="h-full w-full border-none"
          allowFullScreen
          title={resource.title}
        />
      </div>
    );
  }

  // Fayl yoki oddiy URL — HTML5 player
  const videoUrl = resource.file_url || resource.url;
  return (
    <video
      controls
      className="w-full"
      poster={resource.video_poster_url || undefined}
      preload="metadata"
    >
      <source src={videoUrl || ''} />
      Brauzeringiz video formatini qo'llab-quvvatlamaydi.
    </video>
  );
}
```

### 4.3 `BookPanel` — Ko'p sahifali kitob uchun

```typescript
function BookPanel({ resource }: { resource: CourseDetailResource }) {
  const chapters = resource.chapters || [];
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [chapterContent, setChapterContent] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const chapter = chapters[currentChapterIndex];
    if (!chapter) return;
    setLoading(true);
    fetch(`/api/lms/resources/${resource.id}/chapters/${chapter.id}/`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => { setChapterContent(data.content || ''); setLoading(false); });
  }, [currentChapterIndex]);

  // Bob navigatsiya sidebar + content area + prev/next tugmalar
  return (
    <div className="flex h-full min-h-[500px]">
      {/* Sidebar — bob ro'yxati */}
      <nav className="w-56 flex-shrink-0 border-r border-border bg-slate-50 p-4 overflow-y-auto">
        <p className="label-micro mb-3 text-text-muted">Boblar</p>
        {chapters.map((ch, idx) => (
          <button
            key={ch.id}
            onClick={() => setCurrentChapterIndex(idx)}
            className={cn(
              "w-full text-left px-3 py-2 rounded-xl text-sm font-medium mb-1 transition-colors",
              idx === currentChapterIndex
                ? "bg-primary text-white"
                : "text-text-secondary hover:bg-slate-100"
            )}
          >
            {idx + 1}. {ch.title}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 sm:p-8">
        {loading ? (
          <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
        ) : (
          <div
            className="prose max-w-none"
            dangerouslySetInnerHTML={{ __html: chapterContent }}
          />
        )}

        {/* Prev / Next */}
        <div className="mt-8 flex justify-between">
          <button
            disabled={currentChapterIndex === 0}
            onClick={() => setCurrentChapterIndex(i => i - 1)}
            className="btn-outline disabled:opacity-40"
          >← Oldingi bob</button>
          <button
            disabled={currentChapterIndex >= chapters.length - 1}
            onClick={() => setCurrentChapterIndex(i => i + 1)}
            className="btn-primary disabled:opacity-40"
          >Keyingi bob →</button>
        </div>
      </div>
    </div>
  );
}
```

### 4.4 `CertificatePanel` — Talabaga sertifikat holati

```typescript
function CertificatePanel({ resource }: { resource: CourseDetailResource }) {
  const [state, setState] = useState<'loading' | 'eligible' | 'locked' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!resource.certificate_check_url) { setState('error'); return; }
    fetch(resource.certificate_check_url, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.has_certificate || data.is_eligible) {
          setState('eligible');
          setDownloadUrl(data.download_url || resource.certificate_download_url || null);
        } else {
          setState('locked');
          setMessage(data.message || 'Sertifikat olish shartlari bajarilmagan.');
        }
      })
      .catch(() => setState('error'));
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16 px-6 text-center">
      <div className={cn(
        "h-24 w-24 rounded-[32px] flex items-center justify-center shadow-premium",
        state === 'eligible' ? "bg-amber-400 text-white" : "bg-slate-100 text-slate-400"
      )}>
        <Award size={48} />
      </div>
      <h3 className="text-2xl font-black">{resource.title}</h3>

      {state === 'loading' && <Spinner />}

      {state === 'eligible' && downloadUrl && (
        <a href={downloadUrl} target="_blank" rel="noreferrer"
          className="btn-primary flex items-center gap-2 text-lg px-8 py-4">
          <Download size={20} /> Sertifikatni yuklab olish
        </a>
      )}

      {state === 'locked' && (
        <div className="max-w-md">
          <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-5 py-3 text-sm font-bold text-text-secondary mb-3">
            <Lock size={16} /> Qulflangan
          </div>
          <p className="text-sm text-text-secondary leading-7">{message}</p>
        </div>
      )}

      {state === 'error' && (
        <p className="text-sm text-red-500">Sertifikat holatini tekshirishda xato yuz berdi.</p>
      )}
    </div>
  );
}
```

---

## 5-BOSQICH — Frontend: O'qituvchi Paneli (CourseManagePage)

### 5.1 Resurs qo'shish modalini kengaytiring

O'qituvchi har bir resurs turi uchun alohida forma ko'rishi kerak:

```
Tanlangan tip → Forma maydoni
────────────────────────────────────────────
file          → Fayl yuklash (drag-drop)
link          → URL + "yangi tabda ochish" checkbox
video         → Source (YouTube/Vimeo/Fayl/URL) tanlash → mos input
text          → HTML rich-text editor (Tiptap yoki Quill)
audio         → Fayl yuklash yoki URL
embed         → URL + kenglik/balandlik
h5p           → Embed kodi textarea
scorm         → Zip fayl yuklash + version tanlash
folder        → Bo'sh yaratiladi, keyin fayllar alohida yuklanadi
book          → Bo'sh yaratiladi, keyin boblar qo'shiladi
glossary      → Bo'sh yaratiladi, keyin atamalar qo'shiladi
certificate   → Kurs sertifikat sozlamalaridan foydalanadi
```

Har bir forma uchun umumiy maydonlar:
- `title` (majburiy)
- `description` (ixtiyoriy, qisqa tavsif)
- `estimated_time_minutes` (ixtiyoriy)
- `require_completion` (checkbox)

### 5.2 Resurs ikonkalar va ranglar (SectionAccordion.tsx)

```typescript
const RESOURCE_CONFIG: Record<ResourceType, { icon: LucideIcon; color: string; bg: string; label: string }> = {
  file:        { icon: Paperclip,   color: 'text-blue-600',   bg: 'bg-blue-50',   label: 'Fayl' },
  link:        { icon: Link2,       color: 'text-indigo-600', bg: 'bg-indigo-50', label: 'Havola' },
  video:       { icon: PlayCircle,  color: 'text-purple-600', bg: 'bg-purple-50', label: 'Video' },
  text:        { icon: FileText,    color: 'text-slate-600',  bg: 'bg-slate-50',  label: 'Matn' },
  audio:       { icon: Music,       color: 'text-pink-600',   bg: 'bg-pink-50',   label: 'Audio' },
  embed:       { icon: Code2,       color: 'text-cyan-600',   bg: 'bg-cyan-50',   label: 'Embed' },
  h5p:         { icon: Layers,      color: 'text-orange-600', bg: 'bg-orange-50', label: 'H5P' },
  scorm:       { icon: Package,     color: 'text-amber-600',  bg: 'bg-amber-50',  label: 'SCORM' },
  folder:      { icon: FolderOpen,  color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Papka' },
  book:        { icon: BookOpen,    color: 'text-emerald-600',bg: 'bg-emerald-50',label: 'Kitob' },
  glossary:    { icon: BookMarked,  color: 'text-teal-600',   bg: 'bg-teal-50',   label: 'Glossariy' },
  certificate: { icon: Award,       color: 'text-amber-500',  bg: 'bg-amber-50',  label: 'Sertifikat' },
};
```

### 5.3 Resurs kartochkasida holat ko'rsatish

```typescript
// ResourceItem komponentida:
function ResourceItem({ resource, onOpen, onDelete, showDelete }) {
  const config = RESOURCE_CONFIG[resource.resource_type as ResourceType] ?? RESOURCE_CONFIG.file;
  const viewData = resource.view_data;
  const isCompleted = viewData?.is_completed;
  const estimatedTime = resource.estimated_time_minutes;

  return (
    <div className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-white p-3 hover:shadow-sm transition-all cursor-pointer"
         onClick={onOpen}>
      <div className={cn("h-10 w-10 rounded-2xl flex items-center justify-center flex-shrink-0", config.bg)}>
        <config.icon size={18} className={config.color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-primary truncate">{resource.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{config.label}</span>
          {estimatedTime && (
            <span className="text-[10px] text-text-muted">· {estimatedTime} daqiqa</span>
          )}
          {resource.require_completion && !isCompleted && (
            <span className="text-[10px] font-bold text-amber-600">· Majburiy</span>
          )}
        </div>
      </div>
      {/* Tugallanganlik badge */}
      {isCompleted ? (
        <CheckCircle2 size={18} className="text-success flex-shrink-0" />
      ) : resource.require_completion ? (
        <Circle size={18} className="text-amber-400 flex-shrink-0" />
      ) : null}
    </div>
  );
}
```

---

## 6-BOSQICH — Tracking: Avtomatik view yozish

`CourseDetailPage.tsx` da `openResourceViewer()` funksiyasida:

```typescript
const openResourceViewer = (resource: CourseDetailResource) => {
  // Certificate uchun alohida yo'l
  if (resource.resource_type === 'certificate') {
    setViewer({ open: true, resource });
    return;
  }

  // Boshqa har qanday type uchun — viewer oching
  setViewer({ open: true, resource });

  // View tracking — orqa fonda
  fetch(`/api/lms/resources/${resource.id}/viewed/`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-CSRFToken': getCsrfToken() },
  }).catch(() => {});
};
```

`EmbeddedResourceViewer.tsx` da yopish vaqtida vaqtni yuborish:

```typescript
// Viewer ochilganda timer boshlash:
const [openedAt] = useState(() => Date.now());

// onClose chaqirilganda:
function handleClose() {
  const timeSpent = Math.floor((Date.now() - openedAt) / 1000);
  if (resource && timeSpent > 3) {
    fetch(`/api/lms/resources/${resource.id}/complete/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
      body: JSON.stringify({ time_spent_seconds: timeSpent }),
    }).catch(() => {});
  }
  onClose();
}
```

---

## 7-BOSQICH — O'qituvchi uchun resurs statistikasi

### 7.1 Yangi endpoint

```python
@require_GET
@login_required
def teacher_resource_stats(request, resource_id: int):
    """O'qituvchi uchun: kim ko'rgan, kim tugallagan."""
    deny = _require_can_manage_courses(request)
    if deny: return deny

    resource = get_object_or_404(SectionResource.objects.select_related("section__course"), id=resource_id)
    if not _can_manage_course(request, resource.section.course):
        return JsonResponse({"error": "Ruxsat yo'q."}, status=403)

    views = ResourceView.objects.filter(resource=resource).select_related("student")
    total_enrolled = Enrollment.objects.filter(course=resource.section.course).count()
    completed_count = views.filter(is_completed=True).count()
    viewed_count = views.count()
    avg_time = views.aggregate(avg=models.Avg("time_spent_seconds"))["avg"] or 0

    return JsonResponse({
        "total_enrolled": total_enrolled,
        "viewed_count": viewed_count,
        "completed_count": completed_count,
        "completion_rate": round(completed_count / total_enrolled * 100, 1) if total_enrolled else 0,
        "avg_time_seconds": round(avg_time),
        "students": [
            {
                "name": rv.student.get_full_name() or rv.student.username,
                "view_count": rv.view_count,
                "is_completed": rv.is_completed,
                "time_spent_seconds": rv.time_spent_seconds,
            }
            for rv in views
        ]
    })
```

---

## 8-BOSQICH — Installatsiya va sozlamalar

### 8.1 Kerakli Python kutubxonalar

```bash
pip install xhtml2pdf qrcode pillow --break-system-packages
# SCORM uchun:
pip install zipfile36 --break-system-packages
```

### 8.2 `settings.py` — Media sozlamalar tekshiring

```python
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Fayl yuklash limiti
DATA_UPLOAD_MAX_MEMORY_SIZE = 500 * 1024 * 1024   # 500MB
FILE_UPLOAD_MAX_MEMORY_SIZE = 500 * 1024 * 1024    # 500MB
```

### 8.3 Frontend kutubxonalar (agar kerak bo'lsa)

```bash
cd design
# Rich text editor uchun (text/book resource):
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-image @tiptap/extension-link
```

---

## Tekshirish ro'yxati (QA Checklist)

- [ ] Har bir resource_type yaratiladi va saqlanadi
- [ ] `_serialize_resource` barcha yangi maydonlarni qaytaradi
- [ ] `CourseDetailResource` TypeScript interfeysi to'liq
- [ ] Viewer har bir tip uchun to'g'ri panel ko'rsatadi
- [ ] YouTube/Vimeo URLlardan ID ajratib olinadi va embed ishlaydi
- [ ] Book paneli bob navigatsiyasi ishlaydi
- [ ] Folder panelida fayllar yuklanadi va yuklab olinadi
- [ ] Certificate paneli eligibility check qiladi
- [ ] Glossary qidiruv filtri ishlaydi
- [ ] `ResourceView` tracking yoziladi (view + complete)
- [ ] O'qituvchi statistika endpointi to'g'ri qaytaradi
- [ ] SCORM zip fayl yuklanadi
- [ ] H5P embed kodi xavfsiz render qilinadi (sanitize HTML)
- [ ] Mobil ko'rinishda barcha panellar responsive
- [ ] Migration xatosiz ishlaydi: `python manage.py migrate`

---

## Muhim eslatmalar

1. **H5P xavfsizligi:** `h5p_embed_code` ni to'g'ridan-to'g'ri `dangerouslySetInnerHTML` bilan render qilmang. `DOMPurify` orqali sanitize qiling: `npm install dompurify @types/dompurify`

2. **SCORM:** Haqiqiy SCORM player murakkab (SCORM API shim kerak). Oddiy yechim — zip ichidagi `index.html` ni iframe orqali ko'rsatish. To'liq SCORM uchun `pipwerks-scorm-api-wrapper` kutubxonasini frontend ga qo'shing.

3. **Rich Text:** `text` va `book` resource uchun Tiptap editor tavsiya etiladi — React bilan yaxshi integratsiyalashadi va HTML chiqaradi.

4. **File size formatlar:** `file_size` baytda saqlanadi. Frontendda formatlab ko'rsating:
   ```typescript
   function formatBytes(bytes: number): string {
     if (bytes < 1024) return `${bytes} B`;
     if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
     return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
   }
   ```

5. **`require_completion` mantiq:** Agar bo'lim `unlock_mode = "sequential"` va resurs `require_completion = true` bo'lsa, keyingi bo'lim qulflanishi kerak (bu kelajak bosqich — hozircha faqat UI ko'rsating).
