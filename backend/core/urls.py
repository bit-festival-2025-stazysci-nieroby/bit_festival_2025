from django.contrib import admin
from django.urls import path
from api.views import (
    sync_offline_activity,
    get_feed,
    test_firestore,

    # Likes
    like_activity,
    unlike_activity,

    # Comments
    comment_activity,
    delete_comment,
    list_comments,

    # Tags / Filters
    activities_by_tag,
    activities_by_tags_any,
    activities_by_tags_all,
    user_add_tag,
    user_add_tags,
    user_remove_tag,
)

urlpatterns = [
    # Admin
    path("admin/", admin.site.urls),

    # Activities
    path("api/sync/", sync_offline_activity),
    path("api/feed/", get_feed),
    path("api/test-firestore/", test_firestore),

    # Likes
    path("api/activity/<str:activity_id>/like/", like_activity),
    path("api/activity/<str:activity_id>/unlike/", unlike_activity),

    # Comments
    path("api/activity/<str:activity_id>/comment/", comment_activity), 
    path("api/activity/<str:activity_id>/comments/", list_comments),
    path("api/activity/<str:activity_id>/comment/<str:comment_id>/delete/", delete_comment),

    # Tag filtering
    path("api/activities/by-tag/", activities_by_tag),
    path("api/activities/by-tags-any/", activities_by_tags_any),
    path("api/activities/by-tags-all/", activities_by_tags_all),

    # User tag modification
    path("api/user/add-tag/", user_add_tag),
    path("api/user/add-tags/", user_add_tags),
    path("api/user/remove-tag/", user_remove_tag),
]
