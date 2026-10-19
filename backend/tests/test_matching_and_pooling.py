from services.matching_engine import find_bulk_matches
from services.collective_pooling import plan_collective_pool
from services.ai_service import parse_natural_language_buyer_query

def test_nlp_search_parsing():
    query = "Find 500 handmade jute gift bags under ₹150 each, deliverable to Chennai within 20 days"
    parsed = parse_natural_language_buyer_query(query)
    
    filters = parsed["extracted_filters"]
    assert filters["quantity"] == 500
    assert filters["max_unit_budget_inr"] == 150.0
    assert filters["max_lead_time_days"] == 20
    assert filters["destination"] == "Chennai"
    assert filters["material"] == "jute"
    assert filters["category"] == "Jute & Natural Fiber Crafts"

def test_bulk_matching_engine(client, db):
    requirement = {
        "title": "Need 500 jute bags for conference",
        "category": "Jute & Natural Fiber Crafts",
        "description": "High quality natural jute tote bags with double handles",
        "quantity": 500,
        "target_unit_price": 150.00,
        "max_lead_time_days": 20
    }
    matches = find_bulk_matches(requirement, limit=5)
    assert len(matches) > 0
    
    top_match = matches[0]
    assert "match_score" in top_match
    assert top_match["match_score"] > 60
    assert "score_breakdown" in top_match
    assert "category_match" in top_match["score_breakdown"]
    assert "price_alignment" in top_match["score_breakdown"]
    assert len(top_match["positive_reasons"]) > 0

def test_collective_order_pooling(client, db):
    # Find seeded requirement
    req = db.buyer_requirements.find_one({"category": "Jute & Natural Fiber Crafts"})
    assert req is not None
    
    # Request large quantity (1,200 bags) that exceeds single producer's immediate ready stock
    plan = plan_collective_pool(str(req["_id"]), requested_qty=1200, max_budget_per_unit=150.0)
    assert plan["success"] is True
    assert "allocated_suppliers" in plan
    assert plan["total_allocated_quantity"] > 0
    assert "average_unit_price_inr" in plan
    assert "overall_lead_time_days" in plan
