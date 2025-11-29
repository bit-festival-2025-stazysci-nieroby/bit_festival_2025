from firebase_admin import auth
from django.http import JsonResponse

def get_uid_from_request(request):
    header = request.headers.get("Authorization")
    if not header:
        return None, JsonResponse({"error":"No token"}, status=401)
    try:
        token = header.split(" ")[1]
        decoded = auth.verify_id_token(token)
        return decoded['uid'], None
    except Exception as e:
        return None, JsonResponse({"error": str(e)}, status=401)
