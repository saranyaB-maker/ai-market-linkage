from datetime import datetime
from bson import ObjectId
from db import get_db

def find_bulk_matches(requirement_data: dict, limit: int = 10) -> list:
    """
    Core AI Bulk Matching Engine.
    Evaluates real MongoDB product and seller records against buyer requirements.
    Calculates weighted match score with full transparent explanation.
    """
    db = get_db()
    
    target_category = requirement_data.get("category")
    req_qty = int(requirement_data.get("quantity", 1))
    max_budget_per_unit = float(requirement_data.get("target_unit_price") or requirement_data.get("max_budget_per_unit") or 0)
    max_lead_days = int(requirement_data.get("max_lead_time_days") or 999)
    query_text = (requirement_data.get("title", "") + " " + requirement_data.get("description", "")).lower()
    
    # 1. Fetch eligible active products from active sellers
    # Find all non-suspended sellers first
    active_sellers = {str(u["_id"]): u for u in db.users.find({"role": "seller", "status": {"$ne": "suspended"}})}
    seller_ids = list(active_sellers.keys())
    
    # Base product filter: published, not archived, belonging to active sellers
    product_query = {
        "seller_id": {"$in": seller_ids},
        "is_published": True,
        "is_archived": False
    }
    
    candidate_products = list(db.products.find(product_query))
    if not candidate_products:
        return []
        
    # Pre-fetch seller profiles and verifications
    seller_profiles = {p["user_id"]: p for p in db.seller_profiles.find({"user_id": {"$in": seller_ids}})}
    seller_verifications = {v["user_id"]: v for v in db.seller_verifications.find({"user_id": {"$in": seller_ids}})}
    
    ranked_results = []
    
    for prod in candidate_products:
        seller_id = prod.get("seller_id")
        seller_user = active_sellers.get(seller_id, {})
        s_profile = seller_profiles.get(seller_id, {})
        s_verification = seller_verifications.get(seller_id, {})
        
        score_breakdown = {}
        positive_reasons = []
        constraints = []
        
        # Factor A: Category Match (Max 25 pts)
        prod_cat = prod.get("category", "")
        if target_category and prod_cat.lower() == target_category.lower():
            cat_score = 25.0
            positive_reasons.append(f"Direct category match: {prod_cat}")
        elif not target_category:
            cat_score = 15.0 # Neutral
        else:
            cat_score = 5.0 # Cross category
        score_breakdown["category_match"] = {"score": cat_score, "max": 25}
        
        # Factor B: Semantic & Keyword Match (Max 20 pts)
        prod_text = f"{prod.get('title', '')} {prod.get('description', '')} {prod.get('materials', '')}".lower()
        matching_keywords = []
        query_words = [w for w in query_text.split() if len(w) > 3]
        for w in query_words:
            if w in prod_text:
                matching_keywords.append(w)
                
        if matching_keywords:
            kw_ratio = min(1.0, len(matching_keywords) / max(1, min(len(query_words), 5)))
            kw_score = round(kw_ratio * 20.0, 1)
            positive_reasons.append(f"Keywords matched: {', '.join(matching_keywords[:3])}")
        else:
            kw_score = 5.0
        score_breakdown["keyword_match"] = {"score": kw_score, "max": 20}
        
        # Factor C: Price & Budget Alignment (Max 20 pts)
        unit_price = float(prod.get("price_per_unit", 0))
        if max_budget_per_unit > 0:
            if unit_price <= max_budget_per_unit:
                # Under budget is rewarded
                savings = (max_budget_per_unit - unit_price) / max_budget_per_unit
                price_score = min(20.0, 16.0 + (savings * 4.0))
                positive_reasons.append(f"Within budget: ₹{unit_price:,.2f} <= ₹{max_budget_per_unit:,.2f}")
            else:
                over_ratio = (unit_price - max_budget_per_unit) / max_budget_per_unit
                if over_ratio < 0.25: # Within 25% over budget
                    price_score = max(5.0, 15.0 - (over_ratio * 40.0))
                    constraints.append(f"Unit price (₹{unit_price}) is slightly above target budget (₹{max_budget_per_unit})")
                else:
                    price_score = 2.0
                    constraints.append(f"Unit price (₹{unit_price}) exceeds budget significantly")
        else:
            price_score = 15.0 # No budget limit specified
        score_breakdown["price_alignment"] = {"score": round(price_score, 1), "max": 20}
        
        # Factor D: Quantity & Production Capacity (Max 15 pts)
        stock_qty = int(prod.get("stock_quantity", 0))
        monthly_cap = int(prod.get("monthly_capacity") or s_profile.get("annual_production_capacity", 0) / 12 or 100)
        moq = int(prod.get("moq", 1))
        
        if req_qty < moq:
            constraints.append(f"Requested quantity ({req_qty}) is below seller's MOQ ({moq})")
            qty_score = 6.0
        elif stock_qty >= req_qty:
            qty_score = 15.0
            positive_reasons.append(f"Ready stock available immediately ({stock_qty} in inventory)")
        elif (stock_qty + monthly_cap) >= req_qty:
            qty_score = 12.0
            positive_reasons.append(f"Sufficient capacity ({monthly_cap}/month) to fulfill requested {req_qty} units")
        else:
            shortfall = req_qty - (stock_qty + monthly_cap)
            qty_score = 5.0
            constraints.append(f"Single-producer capacity shortfall of {shortfall} units. Eligible for Collective Order Pooling.")
        score_breakdown["capacity_and_stock"] = {"score": qty_score, "max": 15}
        
        # Factor E: Production Lead Time (Max 10 pts)
        prod_lead_days = int(prod.get("lead_time_days", 14))
        if prod_lead_days <= max_lead_days:
            lead_score = 10.0
            positive_reasons.append(f"Lead time {prod_lead_days} days meets deadline")
        else:
            excess = prod_lead_days - max_lead_days
            lead_score = max(2.0, 10.0 - (excess * 0.5))
            constraints.append(f"Estimated lead time ({prod_lead_days} days) exceeds requested timeline ({max_lead_days} days)")
        score_breakdown["lead_time"] = {"score": round(lead_score, 1), "max": 10}
        
        # Factor F: Seller Verification Badge & Trust (Max 10 pts)
        v_status = s_verification.get("verification_status", "unverified")
        if v_status in ["verified_producer", "verified_group"]:
            trust_score = 10.0
            positive_reasons.append(f"Verified genuine craft producer ({v_status.replace('_', ' ').title()})")
        elif v_status == "verified_reseller":
            trust_score = 6.0
            positive_reasons.append("Verified artisan reseller partner")
        else:
            trust_score = 3.0
            constraints.append("Producer documentation pending administrative verification")
        score_breakdown["trust_and_verification"] = {"score": trust_score, "max": 10}
        
        # Total match score
        total_score = sum(item["score"] for item in score_breakdown.values())
        match_score_pct = min(100.0, max(10.0, round(total_score, 1)))
        
        match_entry = {
            "product_id": str(prod["_id"]),
            "product_title": prod.get("title"),
            "category": prod.get("category"),
            "price_per_unit": unit_price,
            "currency": "INR",
            "stock_quantity": stock_qty,
            "monthly_capacity": monthly_cap,
            "moq": moq,
            "lead_time_days": prod_lead_days,
            "images": prod.get("images", []),
            "seller": {
                "seller_id": seller_id,
                "name": seller_user.get("full_name") or s_profile.get("organization_name", "Artisan Producer"),
                "seller_type": s_profile.get("seller_type", "individual_producer"),
                "state": s_profile.get("state", "Tamil Nadu"),
                "district": s_profile.get("district", ""),
                "verification_status": v_status,
                "producer_badge": v_status in ["verified_producer", "verified_group"]
            },
            "match_score": match_score_pct,
            "score_breakdown": score_breakdown,
            "positive_reasons": positive_reasons,
            "constraints": constraints,
            "can_fulfill_independently": (stock_qty + monthly_cap) >= req_qty and req_qty >= moq
        }
        ranked_results.append(match_entry)
        
    # Sort descending by match score
    ranked_results.sort(key=lambda x: x["match_score"], reverse=True)
    return ranked_results[:limit]
