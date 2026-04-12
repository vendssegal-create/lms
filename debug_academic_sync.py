import os, django, sys
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from hemis.services import RetakeHemisSyncService

service = RetakeHemisSyncService()
info = service.client.get_student_info(student_id=14222)

subjects = info.get("subjects")
print(f"subjects type: {type(subjects)}")
print(f"subjects first 3: {repr(subjects)[:400]}")
