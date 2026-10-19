from flask import Blueprint, request, jsonify, g
from bson import ObjectId
from db import get_db
from routes.auth_helpers import jwt_required

notifications_bp = Blueprint("notifications", __name__, url_prefix="/api/notifications")

@notifications_bp.route("", methods=["GET"])
@jwt_required
def get_user_notifications():
    db = get_db()
    user_id = g.user_id
    limit = min(50, request.args.get("limit", 20, type=int))
    
    notes = list(db.notifications.find({"user_id": user_id}).sort("created_at", -1).limit(limit))
    unread_count = db.notifications.count_documents({"user_id": user_id, "read": False})
    
    results = []
    for n in notes:
        results.append({
            "id": str(n["_id"]),
            "title": n.get("title"),
            "message": n.get("message"),
            "type": n.get("type", "system"),
            "link": n.get("link", "#"),
            "read": n.get("read", False),
            "created_at": n.get("created_at")
        })
        
    return jsonify({
        "notifications": results,
        "unread_count": unread_count
    }), 200

@notifications_bp.route("/<notification_id>/read", methods=["POST"])
@jwt_required
def mark_read(notification_id):
    db = get_db()
    try:
        db.notifications.update_one(
            {"_id": ObjectId(notification_id), "user_id": g.user_id},
            {"$set": {"read": True}}
        )
    except Exception:
        return jsonify({"error": "Invalid notification ID"}), 400
    return jsonify({"message": "Marked as read"}), 200

@notifications_bp.route("/mark-all-read", methods=["POST"])
@jwt_required
def mark_all_read():
    db = get_db()
    db.notifications.update_many(
        {"user_id": g.user_id, "read": False},
        {"$set": {"read": True}}
    )
    return jsonify({"message": "All notifications marked as read"}), 200
