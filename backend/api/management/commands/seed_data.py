from django.core.management.base import BaseCommand
from firebase_admin import firestore
import random

db = firestore.client()


class Command(BaseCommand):
    help = "Insert sample activities based on existing Firebase users"

    def handle(self, *args, **kwargs):

        # ============================================================
        # 1️⃣ USERS — Pobierz istniejących użytkowników z Firestore
        # ============================================================

        users_ref = db.collection("users").stream()
        users = []

        for doc in users_ref:
            data = doc.to_dict()
            if "uid" in data and "displayName" in data:
                users.append({
                    "uid": data["uid"],
                    "display_name": data.get("displayName", "Unknown"),
                    "city": (
                        data.get("location")
                        if isinstance(data.get("location"), str)
                        else None
                    )
                })

        if not users:
            self.stdout.write(self.style.ERROR("Brak użytkowników w Firestore!"))
            return

        self.stdout.write(self.style.SUCCESS(f"Załadowano {len(users)} użytkowników!"))

        # Lista tagów do losowania
        example_tags = ["fitness", "outdoor", "coffee", "friends", "study", "gym", "run"]

        # ============================================================
        # 2️⃣ ACTIVITIES — Generate sample activities
        # ============================================================

        sample_activity_templates = [
            {"type": "workout", "description": "Morning workout 💪"},
            {"type": "coffee", "description": "Coffee break ☕"},
            {"type": "walk", "description": "Evening walk 🌆"},
            {"type": "study", "description": "Studying for exams 📚"},
            {"type": "hangout", "description": "Group hangout 🎉"},
            {"type": "run", "description": "Running together 🏃‍♂️"},
            {"type": "gym", "description": "Gym session 🏋️"},
            {"type": "work", "description": "Work & chill 💻"},
        ]

        city_locations = {
            "Gliwice": {"lat": 50.2945, "lng": 18.6714},
            "Warsaw": {"lat": 52.22, "lng": 21.01},
            "Poznań": {"lat": 52.4064, "lng": 16.9252},
            "Kraków": {"lat": 50.0647, "lng": 19.9450},
            "Wrocław": {"lat": 51.11, "lng": 17.02},
            "Gdańsk": {"lat": 54.3520, "lng": 18.6466},
        }

        # Jeśli jakiś użytkownik nie ma miasta → ustaw domyślne
        DEFAULT_CITY = "Gliwice"

        for _ in range(15):

            # Pick participants (at least 1)
            selected_users = random.sample(users, random.randint(1, 3))
            participants = [u["uid"] for u in selected_users]

            template = random.choice(sample_activity_templates)
            tags = random.sample(example_tags, random.randint(1, 3))

            # City = city of first participant OR fallback
            user_city = selected_users[0].get("city")
            if user_city is None or user_city == "Unknown Location":
                user_city = DEFAULT_CITY

            location = city_locations.get(user_city.split(",")[0], city_locations[DEFAULT_CITY])

            activity_ref = db.collection("activities").document()
            activity_ref.set({
                "type": template["type"],
                "participants": participants,
                "tags": tags,
                "description": template["description"],
                "location": location,
                "time_start": firestore.SERVER_TIMESTAMP,
                "time_end": None,
            })

            # ---------- Likes ----------
            like_users = random.sample(users, random.randint(0, len(users)))
            for u in like_users:
                activity_ref.collection("likes").document(u["uid"]).set({
                    "user_id": u["uid"],
                    "user_display_name": u["display_name"],
                    "timestamp": firestore.SERVER_TIMESTAMP
                })

            # ---------- Comments ----------
            comment_users = random.sample(users, random.randint(0, 5))
            for u in comment_users:
                activity_ref.collection("comments").add({
                    "user_id": u["uid"],
                    "user_display_name": u["display_name"],
                    "text": f"{u['display_name']} says hello!",
                    "timestamp": firestore.SERVER_TIMESTAMP
                })

            self.stdout.write(self.style.SUCCESS(
                f"Activity {activity_ref.id}: {len(participants)} participants"
            ))

        self.stdout.write(self.style.SUCCESS("Sample activity generation complete!"))

