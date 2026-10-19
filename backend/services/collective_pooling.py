from datetime import datetime, timezone
from bson import ObjectId
from db import get_db

def plan_collective_pool(requirement_id: str, requested_qty: int, max_budget_per_unit: float = None) -> dict:
    """
    Finds compatible artisans/producer groups who can collectively fulfill a large bulk order.
    Calculates fair capacity allocations and identifies timeline risks.
    """
    db = get_db()
    req = db.buyer_requirements.find_one({"_id": ObjectId(requirement_id)})
    if not req:
        return {"success": False, "error": "Buyer requirement not found"}
        
    category = req.get("category")
    
    # Active sellers with products in this category
    eligible_products = list(db.products.find({
        "category": category,
        "is_published": True,
        "is_archived": False
    }))
    
    # Group by seller and calculate confirmed capacity
    seller_capacities = []
    for prod in eligible_products:
        seller_id = prod.get("seller_id")
        user = db.users.find_one({"_id": ObjectId(seller_id), "status": {"$ne": "suspended"}})
        if not user:
            continue
            
        profile = db.seller_profiles.find_one({"user_id": seller_id}) or {}
        verification = db.seller_verifications.find_one({"user_id": seller_id}) or {}
        v_status = verification.get("verification_status", "unverified")
        
        # Only include verified producers or groups for collective pooling reliability
        if v_status not in ["verified_producer", "verified_group"]:
            continue
            
        stock = int(prod.get("stock_quantity", 0))
        monthly_cap = int(prod.get("monthly_capacity") or 100)
        lead_days = int(prod.get("lead_time_days", 14))
        unit_price = float(prod.get("price_per_unit", 0))
        
        # If budget is specified, skip if price is significantly higher (> 15% above budget)
        if max_budget_per_unit and unit_price > (max_budget_per_unit * 1.15):
            continue
            
        total_available = stock + monthly_cap
        if total_available > 0:
            seller_capacities.append({
                "seller_id": seller_id,
                "product_id": str(prod["_id"]),
                "product_title": prod.get("title"),
                "seller_name": user.get("full_name") or profile.get("organization_name", "Artisan Group"),
                "seller_type": profile.get("seller_type", "individual_producer"),
                "verification_status": v_status,
                "ready_stock": stock,
                "monthly_capacity": monthly_cap,
                "effective_capacity": total_available,
                "lead_time_days": lead_days,
                "unit_price": unit_price,
                "location": f"{profile.get('district', '')}, {profile.get('state', 'Tamil Nadu')}"
            })
            
    # Sort sellers by highest capacity and lowest lead time
    seller_capacities.sort(key=lambda s: (-s["effective_capacity"], s["lead_time_days"]))
    
    # Calculate allocation
    remaining_qty = requested_qty
    allocated_suppliers = []
    
    for supplier in seller_capacities:
        if remaining_qty <= 0:
            break
        alloc_qty = min(remaining_qty, supplier["effective_capacity"])
        if alloc_qty > 0:
            allocated_suppliers.append({
                **supplier,
                "allocated_quantity": alloc_qty,
                "subtotal_inr": round(alloc_qty * supplier["unit_price"], 2),
                "participation_confirmed": False # Requires explicit supplier confirmation
            })
            remaining_qty -= alloc_qty
            
    total_allocated = sum(s["allocated_quantity"] for s in allocated_suppliers)
    can_fulfill_collectively = total_allocated >= requested_qty
    
    # Timeline risk analysis: Check difference between suppliers' lead times
    lead_times = [s["lead_time_days"] for s in allocated_suppliers]
    max_lead_time = max(lead_times) if lead_times else 0
    min_lead_time = min(lead_times) if lead_times else 0
    timeline_variance_risk = (max_lead_time - min_lead_time) > 10
    
    risks = []
    if timeline_variance_risk:
        risks.append(f"Staggered dispatch notice: Suppliers have differing lead times ({min_lead_time} to {max_lead_time} days). Consider batch shipments.")
    if not can_fulfill_collectively:
        risks.append(f"Capacity shortfall: Available collective capacity ({total_allocated}) is less than requested quantity ({requested_qty}).")
        
    avg_unit_price = (
        sum(s["subtotal_inr"] for s in allocated_suppliers) / total_allocated
    ) if total_allocated > 0 else 0
    
    return {
        "success": True,
        "requirement_id": str(requirement_id),
        "requested_quantity": requested_qty,
        "total_allocated_quantity": total_allocated,
        "can_fulfill_collectively": can_fulfill_collectively,
        "suppliers_count": len(allocated_suppliers),
        "allocated_suppliers": allocated_suppliers,
        "average_unit_price_inr": round(avg_unit_price, 2),
        "total_collective_value_inr": round(sum(s["subtotal_inr"] for s in allocated_suppliers), 2),
        "overall_lead_time_days": max_lead_time,
        "risks_and_notes": risks,
        "safeguard_notice": "Order fulfillment will only be booked once each assigned artisan group explicitly reviews and confirms their contribution and specifications."
    }
