import re
import time
from functools import wraps
from datetime import datetime, timezone, timedelta
from flask import request, jsonify, g
import jwt
from werkzeug.security import generate_password_hash, check_password_hash
from bson import ObjectId
from config import Config
from db import get_db

# Simple in-memory rate limiting tracker: {ip_or_email: [(timestamp), ...]}
_rate_limits = {}

def check_rate_limit(key: str, max_attempts: int = 15, window_seconds: int = 60) -> bool:
    now = time.time()
    attempts = _rate_limits.get(key, [])
    # Filter attempts within window
    attempts = [t for t in attempts if now - t < window_seconds]
    if len(attempts) >= max_attempts:
        _rate_limits[key] = attempts
        return False
    attempts.append(now)
    _rate_limits[key] = attempts
    return True

def hash_password(password: str) -> str:
    return generate_password_hash(password, method="scrypt")

def verify_password(stored_hash: str, password: str) -> bool:
    return check_password_hash(stored_hash, password)

def create_jwt_token(user_id: str, role: str, email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,
        "email": email,
        "iat": now,
        "exp": now + Config.JWT_EXPIRATION
    }
    return jwt.encode(payload, Config.JWT_SECRET_KEY, algorithm="HS256")

def decode_jwt_token(token: str) -> dict:
    return jwt.decode(token, Config.JWT_SECRET_KEY, algorithms=["HS256"])

def validate_email(email: str) -> bool:
    pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    return bool(re.match(pattern, email.strip()))

def validate_indian_phone(phone: str) -> bool:
    clean = re.sub(r"[\s\-\+]", "", phone.strip())
    # Allow 10 digits starting with 6-9, or +91 followed by 10 digits
    if clean.startswith("91") and len(clean) == 12:
        clean = clean[2:]
    return bool(re.match(r"^[6-9]\d{9}$", clean))

def jwt_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"error": "Authorization token is missing or malformed"}), 401
        
        token = auth_header.split(" ")[1]
        try:
            payload = decode_jwt_token(token)
            db = get_db()
            user = db.users.find_one({"_id": ObjectId(payload["sub"])})
            if not user:
                return jsonify({"error": "User account no longer exists"}), 401
            if user.get("status") == "suspended":
                return jsonify({"error": "Your account has been suspended by administration"}), 403
            
            g.current_user = user
            g.user_id = str(user["_id"])
            g.role = user["role"]
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Session token has expired. Please log in again."}), 401
        except Exception:
            return jsonify({"error": "Invalid authorization token"}), 401
            
        return f(*args, **kwargs)
    return decorated

def roles_required(*allowed_roles):
    flat_roles = set()
    for r in allowed_roles:
        if isinstance(r, (list, tuple, set)):
            flat_roles.update(r)
        else:
            flat_roles.add(r)

    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if not hasattr(g, "role") or g.role not in flat_roles:
                return jsonify({
                    "error": "Forbidden: You do not have permission to access this resource",
                    "required_roles": list(flat_roles),
                    "your_role": getattr(g, "role", None)
                }), 403
            return f(*args, **kwargs)
        return decorated
    return decorator
