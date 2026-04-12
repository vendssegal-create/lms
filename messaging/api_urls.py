from django.urls import path

from . import api_views


urlpatterns = [
    path("threads/", api_views.threads_list, name="api_threads_list"),
    path("contacts/", api_views.contacts_list, name="api_messages_contacts_list"),
    path("users/search/", api_views.users_search, name="api_messages_users_search"),
    path("threads/start/", api_views.threads_start, name="api_threads_start"),
    path("threads/<int:thread_id>/", api_views.thread_detail, name="api_thread_detail"),
    path("threads/<int:thread_id>/send/", api_views.thread_send, name="api_thread_send"),
    path("threads/<int:thread_id>/read/", api_views.thread_mark_read, name="api_thread_mark_read"),
    path("messages/<int:message_id>/delete/", api_views.message_delete, name="api_message_delete"),
    path("messages/<int:message_id>/react/", api_views.message_react, name="api_message_react"),
    path("threads/<int:thread_id>/search/", api_views.thread_search, name="api_thread_search"),
]
