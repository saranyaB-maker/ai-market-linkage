from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from bson import ObjectId
from db import get_db, log_audit
from routes.auth_helpers import jwt_required, roles_required

reviews_bp = Blueprint("reviews", __name__, url_prefix="/api/reviews")

@reviews_bp.route("", methods=["POST"])
@jwt_required
@roles_required("buyer")
def create_review():
    """
    Submits a review for an eligible completed order.
    Guards:
    1. Order must exist and have status 'completed'.
    2. Only the purchasing buyer can submit.
    3. Duplicate reviews for the same order are strictly prevented.
    """
    data = request.get_json() or {}
    order_id = data.get("order_id")
    rating = int(data.get("rating") or 5)
    comment = (data.get("comment") or "").strip()
    craftsmanship_rating = int(data.get("craftsmanship_rating") or rating)
    delivery_rating = int(data.get("delivery_rating") or rating)
    communication_rating = int(data.get("communication_rating") or rating)
    
    if not order_id:
        return jsonify({"error": "Order ID is required."}), 400
        
    if rating < 1 or rating > 5:
        return jsonify({"error": "Rating must be an integer between 1 and 5."}), 400
        
    db = get_db()
    try:
        order = db.orders.find_one({"_id": ObjectId(order_id)})
    except Exception:
        return jsonify({"error": "Invalid order ID"}), 400
        
    if not order:
        return jsonify({"error": "Order not found."}), 404
        
    if order.get("buyer_id") != g.user_id:
        return jsonify({"error": "You can only review orders that you have personally purchased."}), 403
        
    if order.get("status") != "completed":
        return jsonify({"error": f"Reviews can only be submitted for completed orders. Current order status: '{order.get('status')}'."}), 400
        
    # Prevent duplicate reviews
    existing = db.reviews.find_one({"order_id": str(order_id)})
    if existing:
        return jsonify({"error": "You have already submitted a review for this order."}), 409
        
    now_iso = datetime.now(timezone.utc).isoformat()
    review_doc = {
        "order_id": str(order_id),
        "buyer_id": g.user_id,
        "buyer_name": g.current_user.get("full_name"),
        "seller_id": order.get("seller_id"),
        "product_id": order.get("product_id"),
        "rating": rating,
        "comment": comment,
        "craftsmanship_rating": craftsmanship_rating,
        "delivery_rating": delivery_rating,
        "communication_rating": communication_rating,
        "created_at": now_iso
    }
    
    res = db.reviews.insert_one(review_doc)
    review_id = str(res.inserted_id)
    
    # Notify seller
    db.notifications.insert_one({
        "user_id": order.get("seller_id"),
        "title": f"New ★{rating} Review Received",
        "message": f"Buyer {g.current_user.get('full_name')} left a {rating}-star review for order {order.get('order_number')}.",
        "type": "review",
        "link": f"/seller/orders/{order_id}",
        "read": False,
        "created_at": now_iso
    })
    
    log_audit(g.user_id, "review_submitted", "reviews", review_id, {"rating": rating, "order_id": order_id})
    
    return jsonify({
        "message": "Review submitted successfully. Thank you for supporting rural artisan verification!",
        "review_id": review_id
    }), 201

@reviews_bp.route("/seller/<seller_id>", methods=["GET"])
def get_seller_reviews(seller_id):
    db = get_db()
    reviews = list(db.reviews.find({"seller_id": seller_id}).sort("created_at", -1))
    
    if not reviews:
        return jsonify({"reviews": [], "average_rating": 0, "total_reviews": 0}), 200
        
    avg = sum(r.get("rating", 5) for r in reviews) / len(reviews)
    results = []
    for r in reviews:
        results.append({
            "id": str(r["_id"]),
            "buyer_name": r.get("buyer_name", "Verified Buyer"),
            "rating": r.get("rating"),
            "comment": r.get("comment"),
            "craftsmanship_rating": r.get("craftsmanship_rating"),
            "delivery_rating": r.get("delivery_rating"),
            "communication_rating": r.get("communication_rating"),
            "created_at": r.get("created_at")
        })
        
    return jsonify({
        "reviews": results,
        "average_rating": round(avg, 1),
        "total_reviews": len(reviews)
    }), 200

@reviews_bp.route("/my-summary", methods=["GET"])
@jwt_required
def get_my_review_summary():
    db = get_db()
    reviews = list(db.reviews.find({"seller_id": g.user_id}).sort("created_at", -1))
    if not reviews:
        return jsonify({"reviews": [], "average_rating": 0.0, "total_reviews": 0}), 200
    avg = sum(r.get("rating", 5) for r in reviews) / len(reviews)
    return jsonify({
        "average_rating": round(avg, 1),
        "total_reviews": len(reviews)
    }), 200

