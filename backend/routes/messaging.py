from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from bson import ObjectId
from db import get_db, log_audit
from routes.auth_helpers import jwt_required

messaging_bp = Blueprint("messaging", __name__, url_prefix="/api/messaging")

@messaging_bp.route("/conversations", methods=["GET"])
@jwt_required
def list_conversations():
    """
    Returns all conversations in which current user is a participant.
    """
    db = get_db()
    user_id = g.user_id
    
    query = {"participants": user_id} if g.role != "admin" else {}
    convs = list(db.conversations.find(query).sort("last_message_at", -1))
    
    results = []
    # Collect all participant IDs
    all_pids = set()
    for c in convs:
        for p in c.get("participants", []):
            all_pids.add(p)
            
    users_map = {str(u["_id"]): u for u in db.users.find({"_id": {"$in": [ObjectId(pid) for pid in all_pids if ObjectId.is_valid(pid)]}})}
    
    for c in convs:
        # Determine the other participant
        other_id = next((pid for pid in c.get("participants", []) if pid != user_id), None)
        other_user = users_map.get(other_id, {})
        
        # Check unread count
        unread_count = db.messages.count_documents({
            "conversation_id": str(c["_id"]),
            "recipient_id": user_id,
            "read": False
        })
        
        results.append({
            "id": str(c["_id"]),
            "subject": c.get("subject", "Craft Inquiry"),
            "product_id": c.get("product_id"),
            "order_id": c.get("order_id"),
            "quotation_id": c.get("quotation_id"),
            "other_participant": {
                "id": other_id,
                "name": other_user.get("full_name", "Artisan Partner"),
                "role": other_user.get("role", "seller")
            },
            "last_message": c.get("last_message", ""),
            "last_message_at": c.get("last_message_at"),
            "unread_count": unread_count
        })
        
    return jsonify({"conversations": results}), 200

@messaging_bp.route("/conversations", methods=["POST"])
@jwt_required
def create_or_get_conversation():
    data = request.get_json() or {}
    recipient_id = data.get("recipient_id")
    subject = (data.get("subject") or "Craft Order Inquiry").strip()
    product_id = data.get("product_id")
    quotation_id = data.get("quotation_id")
    order_id = data.get("order_id")
    initial_message = (data.get("initial_message") or "").strip()
    
    if not recipient_id:
        return jsonify({"error": "Recipient ID is required."}), 400
        
    db = get_db()
    user_id = g.user_id
    
    # Check if a conversation between these two already exists for this subject/context
    conv_query = {
        "participants": {"$all": [user_id, recipient_id]}
    }
    if product_id:
        conv_query["product_id"] = product_id
    if order_id:
        conv_query["order_id"] = order_id
        
    existing = db.conversations.find_one(conv_query)
    now_iso = datetime.now(timezone.utc).isoformat()
    
    if existing:
        conv_id = str(existing["_id"])
    else:
        new_conv = {
            "participants": [user_id, recipient_id],
            "subject": subject,
            "product_id": product_id,
            "quotation_id": quotation_id,
            "order_id": order_id,
            "last_message": initial_message or "Conversation started",
            "last_message_at": now_iso,
            "created_at": now_iso
        }
        res = db.conversations.insert_one(new_conv)
        conv_id = str(res.inserted_id)
        
    if initial_message:
        msg_doc = {
            "conversation_id": conv_id,
            "sender_id": user_id,
            "sender_name": g.current_user.get("full_name"),
            "recipient_id": recipient_id,
            "content": initial_message,
            "read": False,
            "created_at": now_iso
        }
        db.messages.insert_one(msg_doc)
        db.conversations.update_one(
            {"_id": ObjectId(conv_id)},
            {"$set": {"last_message": initial_message, "last_message_at": now_iso}}
        )
        
    return jsonify({"conversation_id": conv_id, "message": "Conversation ready"}), 201

@messaging_bp.route("/conversations/<conv_id>/messages", methods=["GET"])
@jwt_required
def get_messages(conv_id):
    db = get_db()
    try:
        conv = db.conversations.find_one({"_id": ObjectId(conv_id)})
    except Exception:
        return jsonify({"error": "Invalid conversation ID"}), 400
        
    if not conv:
        return jsonify({"error": "Conversation not found"}), 404
        
    # Check authorization
    if g.role != "admin" and g.user_id not in conv.get("participants", []):
        return jsonify({"error": "Access denied: You are not a participant in this conversation."}), 403
        
    # Mark messages sent to current user as read
    db.messages.update_many(
        {"conversation_id": conv_id, "recipient_id": g.user_id, "read": False},
        {"$set": {"read": True}}
    )
    
    msgs = list(db.messages.find({"conversation_id": conv_id}).sort("created_at", 1))
    results = []
    for m in msgs:
        results.append({
            "id": str(m["_id"]),
            "sender_id": m.get("sender_id"),
            "sender_name": m.get("sender_name"),
            "content": m.get("content"),
            "read": m.get("read", False),
            "created_at": m.get("created_at"),
            "is_me": m.get("sender_id") == g.user_id
        })
        
    return jsonify({"messages": results, "subject": conv.get("subject")}), 200

@messaging_bp.route("/conversations/<conv_id>/messages", methods=["POST"])
@jwt_required
def send_message_to_conversation(conv_id):
    data = request.get_json() or {}
    content = (data.get("content") or "").strip()
    
    if not content:
        return jsonify({"error": "Message content cannot be empty."}), 400
        
    db = get_db()
    try:
        conv = db.conversations.find_one({"_id": ObjectId(conv_id)})
    except Exception:
        return jsonify({"error": "Invalid conversation ID"}), 400
        
    if not conv:
        return jsonify({"error": "Conversation not found"}), 404
        
    if g.role != "admin" and g.user_id not in conv.get("participants", []):
        return jsonify({"error": "Access denied."}), 403
        
    # Determine recipient
    recipient_id = next((pid for pid in conv.get("participants", []) if pid != g.user_id), None)
    now_iso = datetime.now(timezone.utc).isoformat()
    
    msg_doc = {
        "conversation_id": conv_id,
        "sender_id": g.user_id,
        "sender_name": g.current_user.get("full_name"),
        "recipient_id": recipient_id,
        "content": content,
        "read": False,
        "created_at": now_iso
    }
    res = db.messages.insert_one(msg_doc)
    
    # Update conversation's last message
    db.conversations.update_one(
        {"_id": ObjectId(conv_id)},
        {"$set": {"last_message": content, "last_message_at": now_iso}}
    )
    
    # Notify recipient
    if recipient_id:
        db.notifications.insert_one({
            "user_id": recipient_id,
            "title": f"New Message from {g.current_user.get('full_name')}",
            "message": content[:80] + ("..." if len(content) > 80 else ""),
            "type": "message",
            "link": f"/messages?conversation={conv_id}",
            "read": False,
            "created_at": now_iso
        })
        
    return jsonify({
        "message": "Message sent successfully",
        "message_id": str(res.inserted_id),
        "created_at": now_iso
    }), 201
