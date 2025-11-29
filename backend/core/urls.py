from django.contrib import admin
from django.urls import path
from api.views import (
    sync_offline_activity,
    get_feed,
    test_firestore,
    like_activity,
    unlike_activity,
    comment_activity,
    delete_comment,
    list_comments
)

urlpatterns = [
    path('admin/', admin.site.urls),

    path('api/sync/', sync_offline_activity),
    path('api/feed/', get_feed),
    path("api/test-firestore/", test_firestore),

    path("api/activity/<str:activity_id>/like/", like_activity),
    path("api/activity/<str:activity_id>/unlike/", unlike_activity),

    path("api/activity/<str:activity_id>/comment/", comment_activity),
    path("api/activity/<str:activity_id>/comment/<str:comment_id>/", delete_comment),

    path("api/activity/<str:activity_id>/comments/", list_comments),
]
