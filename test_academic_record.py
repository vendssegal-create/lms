import os
import django
import json
import sys

# Setup Django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from hemis.services import RetakeHemisSyncService

service = RetakeHemisSyncService()
try:
    payload = service.client._request(
        "GET", 
        "/v1/data/academic-record-list", 
        token=service.client.backend_token, 
        params={"_student": 14222, "limit": 200}
    )
    # Check if data or data.items exists
    data = payload.get('data', {})
    if isinstance(data, dict):
        items = data.get('items', [])
    else:
        items = data if isinstance(data, list) else []
        
    print(f"Items found: {len(items)}")
    print(json.dumps(payload, indent=2, ensure_ascii=False))
except Exception as e:
    print(f"Error: {e}")
