from django.core.management.base import BaseCommand
from firebase_admin import firestore
import random

db = firestore.client()

class Command(BaseCommand):
    help = "Insert sample activity data into Firestore with likes and comments"

    def handle(self, *args, **kwargs):

        sample_items = [
            {
                "participants": ["userA", "userB"],
                "type": "walk",
                "timestamp": firestore.SERVER_TIMESTAMP,
                "location": {"lat": 52.2297, "lng": 21.0122},
                "tags": ["outdoor", "fitness"],
                "user_comment": "Morning walk in Warsaw",
            },
            {
                "participants": ["userC"],
                "type": "coffee",
                "timestamp": firestore.SERVER_TIMESTAMP,
                "location": {"lat": 52.4064, "lng": 16.9252},
                "tags": ["cafe"],
                "user_comment": "Coffee in Poznań",
            },
        ]

        fake_users = ["alice", "bob", "charlie", "david", "eve"]

        for item in sample_items:
            # create activity
            activity_doc = db.collection("activities").document()
            activity_doc.set(item)
            activity_id = activity_doc.id

            # ----- ADD LIKES -----
            number_of_likes = random.randint(0, 3)
            like_users = random.sample(fake_users, number_of_likes)

            for user in like_users:
                like_ref = activity_doc.collection("likes").document(user)
                like_ref.set({
                    "user_id": user,
                    "timestamp": firestore.SERVER_TIMESTAMP
                })

            # ----- ADD COMMENTS -----
            number_of_comments = random.randint(0, 3)
            comment_users = random.sample(fake_users, number_of_comments)

            for user in comment_users:
                comment_ref = activity_doc.collection("comments").document()
                comment_ref.set({
                    "user_id": user,
                    "text": f"This is a test comment from {user}",
                    "timestamp": firestore.SERVER_TIMESTAMP
                })

            self.stdout.write(self.style.SUCCESS(
                f"Inserted activity {activity_id} with {number_of_likes} likes and {number_of_comments} comments"
            ))

        self.stdout.write(self.style.SUCCESS("All sample data added!"))
