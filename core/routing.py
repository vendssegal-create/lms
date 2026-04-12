from django.urls import re_path

from messaging.consumers import DirectThreadConsumer


websocket_urlpatterns = [
    re_path(r"^ws/messages/thread/(?P<thread_id>\\d+)/$", DirectThreadConsumer.as_asgi()),
]

