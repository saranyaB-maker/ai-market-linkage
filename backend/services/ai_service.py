import os
import re
import json
import base64
import logging
import requests
from config import Config

logger = logging.getLogger("market_linkage")

CRAFT_CATEGORIES = [
    {
        "slug": "pottery-terracotta",
        "name": "Pottery & Terracotta",
        "synonyms": ["terracotta", "clay craft"],
        "keywords": ["terracotta", "clay", "pottery", "earthen", "diya", "earthen pot", "sculpture", "terracotta vase", "matka", "kulhad", "surahi"]
    },
    {
        "slug": "pottery-ceramics",
        "name": "Pottery & Ceramics",
        "synonyms": ["pottery", "ceramics", "ceramic", "clayware", "earthenware"],
        "keywords": ["ceramic", "porcelain", "stoneware", "glaze", "crockery", "plate", "cup"]
    },
    {
        "slug": "household-goods-jugs",
        "name": "Household Goods, Water Jugs & Pitchers",
        "synonyms": ["household goods", "water jugs", "water jugs and pitchers", "pitchers", "jugs"],
        "keywords": ["jug", "pitcher", "water jug", "flask", "jar", "container", "water pot", "household good", "kitchenware", "tableware", "cooler"]
    },
    {
        "slug": "handloom-textiles",
        "name": "Handloom & Textiles",
        "synonyms": ["textiles", "handloom", "fabrics", "weaving"],
        "keywords": ["cotton", "silk", "saree", "shawl", "weaving", "fabric", "dupatta", "khadi", "handloom", "towel", "stole", "kurta", "linen", "textile"]
    },
    {
        "slug": "jute-natural-fibers",
        "name": "Jute & Natural Fiber Crafts",
        "synonyms": ["jute", "natural fiber", "jute craft"],
        "keywords": ["jute", "coir", "banana fiber", "jute craft", "jute bag"]
    },
    {
        "slug": "bags-natural-fibers",
        "name": "Bags & Natural Fiber Crafts",
        "synonyms": ["bags", "cloth bags", "fiber bags"],
        "keywords": ["bag", "cloth bag", "tote", "handbag", "pouch", "basket", "rope", "hemp", "palm leaf"]
    },
    {
        "slug": "woodwork-carving",
        "name": "Woodwork & Carving",
        "synonyms": ["woodcraft", "wood carving"],
        "keywords": ["wood", "carving", "teak", "rosewood", "toy", "figurine", "furniture", "panel", "box", "wooden", "woodcraft"]
    },
    {
        "slug": "metal-bell-metal",
        "name": "Metal & Bell Metal Crafts",
        "synonyms": ["metalcraft", "brass", "bell metal"],
        "keywords": ["metal", "brass", "bronze", "copper", "bell metal", "lamp", "dhokra", "statue", "vessel", "utensil", "metalcraft"]
    },
    {
        "slug": "jewellery-beadwork",
        "name": "Jewellery & Beadwork",
        "synonyms": ["jewellery", "jewelry", "beadwork"],
        "keywords": ["jewellery", "jewelry", "beads", "necklace", "bangles", "earrings", "pendant", "terracotta jewellery", "silver jewellery", "ornament"]
    },
    {
        "slug": "bamboo-cane",
        "name": "Bamboo & Cane Crafts",
        "synonyms": ["bamboo", "cane"],
        "keywords": ["bamboo", "cane", "rattan", "furniture", "basket", "lamp shade", "tray", "partition", "mat"]
    },
    {
        "slug": "stone-marble-crafts",
        "name": "Stone & Marble Carving",
        "synonyms": ["stone carving", "marble craft"],
        "keywords": ["stone", "marble", "granite", "soapstone", "statue", "inlay", "coaster", "mortar"]
    },
    {
        "slug": "handmade-paper-leather",
        "name": "Handmade Paper & Leather",
        "synonyms": ["handmade paper", "leather craft"],
        "keywords": ["leather", "journal", "diary", "handmade paper", "jooti", "sandal", "folder", "card"]
    },
    {
        "slug": "painting-folk-art",
        "name": "Painting & Folk Art",
        "synonyms": ["folk art", "traditional painting"],
        "keywords": ["painting", "madhubani", "warli", "pattachitra", "kalamkari", "folk art", "scroll", "canvas"]
    },
    {
        "slug": "other-crafts",
        "name": "Other Traditional Crafts",
        "synonyms": ["handicrafts", "other crafts"],
        "keywords": ["handicraft", "craft", "artisan", "traditional"]
    }
]

ALLOWED_CATEGORY_NAMES = [cat["name"] for cat in CRAFT_CATEGORIES]

def match_allowed_category(category_candidate: str) -> str:
    """
    Validates a category string against the allowed artisan categories list.
    Returns the exact matching category name if valid, or empty string if invalid.
    Never silently substitutes an unrelated category.
    """
    if not category_candidate:
        return ""
    cand_lower = category_candidate.strip().lower()
    
    # 1. Exact match (case insensitive)
    for cat in CRAFT_CATEGORIES:
        if cat["name"].lower() == cand_lower or cat["slug"].lower() == cand_lower:
            return cat["name"]
            
    # 2. Match against defined synonyms
    for cat in CRAFT_CATEGORIES:
        for syn in cat.get("synonyms", []):
            if syn.lower() == cand_lower or syn.lower() in cand_lower:
                return cat["name"]
                
    # 3. Substring match only if unambiguous
    matches = [cat["name"] for cat in CRAFT_CATEGORIES if cat["name"].lower() in cand_lower or cand_lower in cat["name"].lower()]
    if len(matches) == 1:
        return matches[0]
        
    return ""

def generate_catalog_suggestion(image_path: str, filename: str = "", user_notes: str = "") -> dict:
    """
    Analyzes an uploaded product image using a vision-capable AI model.
    Sends the actual image bytes to the vision API.
    
    If no AI API key is configured or recognition is uncertain, returns an honest
    unconfigured/uncertain response and asks the artisan to choose a category manually.
    Never returns fake hardcoded textile suggestions or pretends real AI occurred.
    """
    api_key = Config.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY", "")
    
    if api_key and image_path and os.path.exists(image_path):
        try:
            result = _call_gemini_vision(image_path, api_key, user_notes)
            if result.get("recognized"):
                return result
            else:
                logger.info("Vision AI could not confidently identify product from image.")
        except Exception as e:
            logger.warning(f"AI Vision call failed or error occurred: {e}")

    # Deterministic text-based fallback when no image file is provided
    combined_text = f"{filename} {user_notes}".lower()
    if not image_path and combined_text.strip():
        for cat in CRAFT_CATEGORIES:
            for kw in cat["keywords"]:
                if kw in combined_text:
                    title_clean = filename or f"Handcrafted {cat['name']}"
                    return {
                        "success": True,
                        "recognized": True,
                        "ai_powered": False,
                        "source": "deterministic_rule_based_fallback",
                        "category": cat["name"],
                        "category_slug": cat["slug"],
                        "title": title_clean,
                        "estimated_material": kw.capitalize(),
                        "material_needs_confirmation": True,
                        "description": f"Authentic handcrafted {cat['name']} item, carefully shaped using traditional craft techniques.",
                        "suggested_tags": [kw, "handcrafted", "artisan"],
                        "production_method": "Handcrafted",
                        "suggested_min_price_inr": 250,
                        "suggested_max_price_inr": 650,
                        "visual_attributes": [f"Material: {kw.capitalize()}"],
                        "disclaimer": "Generated from product title and notes using deterministic keyword matching."
                    }

    # Honest unconfigured / uncertain result: DO NOT FAKE OR DEFAULT TO TEXTILES!
    return {
        "success": False,
        "recognized": False,
        "ai_powered": False,
        "ai_configured": bool(api_key),
        "message": "Vision AI service is not configured or could not confidently identify this product. Please choose a category and enter details manually.",
        "category": "",
        "category_slug": "",
        "title": "",
        "estimated_material": "",
        "material_needs_confirmation": True,
        "description": "",
        "suggested_tags": [],
        "production_method": "Handcrafted",
        "suggested_min_price_inr": None,
        "suggested_max_price_inr": None,
        "visual_attributes": [],
        "disclaimer": "AI recognition not configured or uncertain. Please select your craft category and enter authentic product details manually."
    }

def _call_gemini_vision(image_path: str, api_key: str, user_notes: str) -> dict:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    
    with open(image_path, "rb") as f:
        img_bytes = f.read()
    b64_img = base64.b64encode(img_bytes).decode("utf-8")
    
    mime_type = "image/jpeg"
    ext = image_path.lower().rsplit(".", 1)[-1]
    if ext == "png":
        mime_type = "image/png"
    elif ext == "webp":
        mime_type = "image/webp"

    categories_list_str = "\n".join([f"- {cat['name']}" for cat in CRAFT_CATEGORIES])

    prompt = f"""You are an expert artisan craft and handmade goods catalog assistant.
Analyze this product photograph and provide a structured JSON response for an artisan marketplace listing.
Artisan context/notes: {user_notes or "None"}

ALLOWED PRODUCT CATEGORIES (Select strictly one from this list):
{categories_list_str}

CRITICAL RULES:
1. Examine the visual features carefully (shape, texture, material, handles, finish).
2. For example, a water jug, pitcher, clay vase, or earthen pot MUST be classified under "Household Goods, Water Jugs & Pitchers", "Pottery & Ceramics", or "Pottery & Terracotta" — NEVER classify pottery, clayware, jugs, or cookware as Handloom & Textiles.
3. A tote, handbag, or pouch made of jute/cotton MUST be classified under "Bags & Natural Fiber Crafts".
4. Handwoven fabrics, sarees, dupattas, shawls belong to "Handloom & Textiles".
5. Carved wood items belong to "Woodwork & Carving". Metal items belong to "Metal & Bell Metal Crafts".
6. If the image is not clear or does not show an artisan craft product, set "recognized": false, "confidence": "uncertain".
7. Never invent manufacturer certifications, exact dimensions, or authenticity claims as verified facts.
8. State materials only as visual estimates, and set "material_needs_confirmation": true.
9. Output ONLY valid JSON matching this schema:
{{
  "recognized": true,
  "confidence": "high | medium | uncertain",
  "title": "Descriptive Product Name (e.g. Traditional Terracotta Water Jug with Handle)",
  "category": "Exact name from allowed categories list",
  "estimated_material": "Likely material (e.g. Natural Terracotta Clay, 100% Cotton Handloom)",
  "material_needs_confirmation": true,
  "description": "2-3 sentences of authentic artisan description highlighting technique and finish",
  "suggested_tags": ["tag1", "tag2", "tag3"],
  "production_method": "Wheel-thrown / Handloom / Hand-carved / Handcrafted",
  "suggested_min_price_inr": 200,
  "suggested_max_price_inr": 450,
  "visual_attributes": ["Visible attribute 1", "Visible attribute 2"],
  "disclaimer": "AI suggested fields based on visual inspection. Please verify materials and dimensions."
}}
"""
    headers = {"Content-Type": "application/json"}
    body = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": b64_img
                        }
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "response_mime_type": "application/json"
        }
    }
    
    res = requests.post(url, headers=headers, json=body, timeout=14)
    if res.status_code == 200:
        data = res.json()
        candidates = data.get("candidates", [])
        if not candidates:
            return {"recognized": False}
        text_content = candidates[0].get("content", {}).get("parts", [])[0].get("text", "")
        parsed = json.loads(text_content)
        
        # Validate category against allowed categories
        raw_category = parsed.get("category", "")
        matched_cat = match_allowed_category(raw_category)
        
        if not matched_cat or parsed.get("confidence") == "uncertain" or not parsed.get("recognized", True):
            # Recognition is uncertain or category is invalid
            return {
                "success": False,
                "recognized": False,
                "ai_powered": True,
                "message": "Could not confidently identify this product from the photo. Please select the category and fill details manually.",
                "category": "",
                "title": parsed.get("title", ""),
                "description": "",
                "estimated_material": "",
                "material_needs_confirmation": True,
                "suggested_tags": parsed.get("suggested_tags", []),
                "production_method": "Handcrafted",
                "disclaimer": "Could not confidently identify this product. Please choose a category manually."
            }
            
        parsed["category"] = matched_cat
        parsed["success"] = True
        parsed["recognized"] = True
        parsed["ai_powered"] = True
        parsed["source"] = "gemini_1.5_flash_vision"
        return parsed
    else:
        raise Exception(f"Gemini API returned status {res.status_code}: {res.text}")

def parse_natural_language_buyer_query(query_text: str) -> dict:
    """
    Parses a natural-language buyer search query (e.g.
    'Find 500 handmade jute gift bags under ₹150 each, deliverable to Chennai within 20 days')
    into structured database search parameters.
    """
    query_text_clean = query_text.strip()
    
    # 1. Quantity extraction: looks for numbers preceding units or words like bags, pieces, units
    qty = None
    qty_match = re.search(r"(\d+)\s*(?:units|pieces|pcs|nos|bags|baskets|sarees|items)?", query_text_clean, re.IGNORECASE)
    # Match standalone 2-6 digit number if surrounded by spaces or start
    num_matches = re.findall(r"\b(\d{2,6})\b", query_text_clean)
    if num_matches:
        # Check if one of them is near 'under' or '₹' (which is price, not qty)
        for num in num_matches:
            val = int(num)
            # If not prefixed by ₹ or Rs
            if not re.search(rf"[₹RsRS\.]\s*{num}", query_text_clean) and not re.search(rf"under\s*{num}", query_text_clean, re.IGNORECASE):
                qty = val
                break
    
    # 2. Budget extraction (e.g. under ₹150, below 200, max 300, <= 150)
    max_budget = None
    budget_match = re.search(r"(?:under|below|max|budget of|less than|up to|₹|rs\.?)\s*₹?\s*(\d+(?:\.\d+)?)", query_text_clean, re.IGNORECASE)
    if budget_match:
        max_budget = float(budget_match.group(1))

    # 3. Lead time / Days extraction (e.g. within 20 days, in 15 days, 3 weeks)
    lead_time_days = None
    lead_match = re.search(r"within\s*(\d+)\s*days?", query_text_clean, re.IGNORECASE)
    if lead_match:
        lead_time_days = int(lead_match.group(1))
    else:
        week_match = re.search(r"within\s*(\d+)\s*weeks?", query_text_clean, re.IGNORECASE)
        if week_match:
            lead_time_days = int(week_match.group(1)) * 7

    # 4. Destination city extraction (e.g. to Chennai, deliverable to Bangalore, in Mumbai)
    destination = None
    dest_match = re.search(r"(?:to|in|deliverable to|ship to|destination:?)\s+([A-Z][a-zA-Z\s]+?)(?:\s+(?:within|under|before|in|\.|$))", query_text_clean)
    if dest_match:
        destination = dest_match.group(1).strip()
    else:
        # Check standard Indian trade cities
        indian_cities = ["Chennai", "Coimbatore", "Madurai", "Bangalore", "Bengaluru", "Hyderabad", "Mumbai", "Delhi", "Kolkata", "Ahmedabad", "Pune", "Jaipur", "Kochi", "Tirupur", "Salem"]
        for city in indian_cities:
            if re.search(rf"\b{city}\b", query_text_clean, re.IGNORECASE):
                destination = city
                break

    # 5. Category and material matching
    matched_category = None
    matched_material = None
    query_lower = query_text_clean.lower()
    
    materials_list = ["jute", "cotton", "silk", "clay", "terracotta", "bamboo", "cane", "brass", "bronze", "wood", "khadi", "palm leaf", "banana fiber", "stone", "marble", "leather"]
    for mat in materials_list:
        if mat in query_lower:
            matched_material = mat
            break

    for cat in CRAFT_CATEGORIES:
        for kw in cat["keywords"]:
            if kw in query_lower:
                matched_category = cat["name"]
                break
        if matched_category:
            break

    return {
        "original_query": query_text,
        "extracted_filters": {
            "category": matched_category,
            "material": matched_material,
            "quantity": qty,
            "max_unit_budget_inr": max_budget,
            "max_lead_time_days": lead_time_days,
            "destination": destination
        },
        "query_tokens": [w for w in re.split(r"\W+", query_lower) if len(w) > 2 and w not in ["find", "under", "each", "within", "days", "with", "from", "for", "the", "and"]],
        "ai_powered": False,
        "method": "structured_heuristic_nlp_extractor"
    }
