import os
import re
import json
import logging
from typing import Dict, Any, Optional
from services.translation_service import (
    translate_tamil_to_english,
    translate_english_to_tamil,
    get_bilingual_category,
    get_bilingual_unit
)

logger = logging.getLogger(__name__)

# Standard marketplace craft categories
MARKETPLACE_CATEGORIES = [
    "Household Goods, Water Jugs & Pitchers",
    "Pottery & Ceramics",
    "Pottery & Terracotta",
    "Handloom & Textiles",
    "Bags & Natural Fiber Crafts",
    "Jute & Natural Fiber Crafts",
    "Woodwork & Carving",
    "Metal & Bell Metal Crafts",
    "Jewellery & Beadwork",
    "Bamboo & Cane Crafts",
    "Stone & Marble Carving",
    "Handmade Paper & Leather",
    "Painting & Folk Art",
    "Other Traditional Crafts"
]

# Tamil to English Craft Vocabulary & Category Mapping
TAMIL_CRAFT_DICTIONARY = {
    # Water jugs / pitchers / domestic pottery
    "தண்ணீர் குடம்": {
        "english_title": "Handcrafted Terracotta Water Jug",
        "category": "Household Goods, Water Jugs & Pitchers",
        "materials": "Natural Terracotta Clay",
        "production_method": "Handmade Potter's Wheel & Kiln Fired",
        "suggested_price": 380,
        "price_min": 250,
        "price_max": 550,
        "default_description": "Natural earthenware water pitcher handcrafted by rural potters. Naturally cools drinking water through microporous evaporative cooling.",
        "dimensions": "Height: 11 inches, Diameter: 8 inches, Volume: 3 Litres"
    },
    "தண்ணீர் பானை": {
        "english_title": "Traditional Clay Water Pot (Paanai)",
        "category": "Household Goods, Water Jugs & Pitchers",
        "materials": "Riverbed Terracotta Clay",
        "production_method": "Traditional Potter's Wheel",
        "suggested_price": 420,
        "price_min": 300,
        "price_max": 600,
        "default_description": "Traditional unglazed terracotta cooling pot with lid, handmade using indigenous clay shaping methods.",
        "dimensions": "Height: 12 inches, Volume: 5 Litres"
    },
    "குடம்": {
        "english_title": "Handmade Terracotta Pitcher",
        "category": "Household Goods, Water Jugs & Pitchers",
        "materials": "Natural Clay",
        "production_method": "Handcrafted Wheel Thrown",
        "suggested_price": 350,
        "price_min": 220,
        "price_max": 500,
        "default_description": "Earthy handmade pitcher suitable for water storage and traditional utility.",
        "dimensions": "Height: 10 inches, Diameter: 7 inches"
    },
    "மண் குடம்": {
        "english_title": "Clay Water Pitcher",
        "category": "Household Goods, Water Jugs & Pitchers",
        "materials": "Terracotta Clay",
        "production_method": "Wheel-thrown & Kiln Baked",
        "suggested_price": 360,
        "price_min": 240,
        "price_max": 520,
        "default_description": "Eco-friendly clay water pitcher crafted with porous terracotta for natural mineral retention.",
        "dimensions": "Height: 10 inches, Volume: 3 Litres"
    },
    "ஜாடி": {
        "english_title": "Ceramic Storage Jar / Pitcher",
        "category": "Household Goods, Water Jugs & Pitchers",
        "materials": "Glazed Terracotta",
        "production_method": "Handcrafted & Glazed",
        "suggested_price": 450,
        "price_min": 300,
        "price_max": 750,
        "default_description": "Traditional pickle or water storage jar handcrafted with lead-free natural earthen finish.",
        "dimensions": "Height: 9 inches"
    },
    
    # Pottery & Terracotta
    "மண்பாண்டம்": {
        "english_title": "Handcrafted Terracotta Earthenware",
        "category": "Pottery & Terracotta",
        "materials": "Riverbed Clay",
        "production_method": "Potter's Wheel & Open Fire Kiln",
        "suggested_price": 300,
        "price_min": 180,
        "price_max": 600,
        "default_description": "Pure non-toxic earthen cookware and serving vessel handmade by rural master potters.",
        "dimensions": "Standard Craft Dimensions"
    },
    "மண் பானை": {
        "english_title": "Traditional Clay Pot (Paanai)",
        "category": "Pottery & Terracotta",
        "materials": "Riverbed Terracotta Clay",
        "production_method": "Handmade Potter's Wheel",
        "suggested_price": 260,
        "price_min": 160,
        "price_max": 450,
        "default_description": "Natural unglazed clay cooking and cooling pot crafted by rural potters.",
        "dimensions": "Height: 8 inches, Diameter: 8 inches"
    },
    "மண் சட்டி": {
        "english_title": "Traditional Clay Cooking Pot (Man Chatti)",
        "category": "Pottery & Terracotta",
        "materials": "Natural Terracotta Clay",
        "production_method": "Hand-hammered & Wheel-thrown",
        "suggested_price": 280,
        "price_min": 180,
        "price_max": 450,
        "default_description": "Pre-seasoned organic clay cooking pot designed for authentic, slow-cooked curries.",
        "dimensions": "Diameter: 9 inches, Depth: 4 inches"
    },
    "அகல் விளக்கு": {
        "english_title": "Handmade Terracotta Diya Set",
        "category": "Pottery & Terracotta",
        "materials": "Fine Clay",
        "production_method": "Hand Molded & Kiln Fired",
        "suggested_price": 180,
        "price_min": 100,
        "price_max": 350,
        "default_description": "Traditional earthen oil lamps handcrafted for festivities and rituals.",
        "dimensions": "Pack of 12 Diyas"
    },

    # Handlooms & Textiles
    "பட்டு சேலை": {
        "english_title": "Authentic Handloom Pure Silk Saree",
        "category": "Handloom & Textiles",
        "materials": "100% Mulberry Silk & Pure Zari",
        "production_method": "Traditional Handloom Pitloom",
        "suggested_price": 6500,
        "price_min": 4000,
        "price_max": 14000,
        "default_description": "Handwoven pure mulberry silk saree featuring intricate traditional pallu motifs and temple border weaving.",
        "dimensions": "Length: 6.2 meters (with blouse piece)"
    },
    "பட்டு புடவை": {
        "english_title": "Traditional Handloom Silk Saree",
        "category": "Handloom & Textiles",
        "materials": "Pure Silk with Metallic Zari",
        "production_method": "Handloom Weaving",
        "suggested_price": 6800,
        "price_min": 4500,
        "price_max": 15000,
        "default_description": "Exquisite hand-woven silk saree directly from master weaver collectives in Tamil Nadu.",
        "dimensions": "Length: 6.2 meters"
    },
    "பருத்தி சேலை": {
        "english_title": "Handloom Organic Cotton Saree",
        "category": "Handloom & Textiles",
        "materials": "Pure Organic Cotton Yarn",
        "production_method": "Pitloom Hand-weaving",
        "suggested_price": 1400,
        "price_min": 900,
        "price_max": 2400,
        "default_description": "Breathable 80s count handloom cotton saree dyed with azo-free skin-friendly natural pigments.",
        "dimensions": "Length: 5.5 meters"
    },
    "வேஷ்டி": {
        "english_title": "Handloom Pure Cotton Dhoti (Veshti)",
        "category": "Handloom & Textiles",
        "materials": "Fine Count Cotton",
        "production_method": "Shuttle Handloom",
        "suggested_price": 750,
        "price_min": 450,
        "price_max": 1200,
        "default_description": "Traditional double-layer handloom cotton veshti with subtle border accents.",
        "dimensions": "Length: 4 meters (8 Muzham)"
    },

    # Bags & Natural Fiber Crafts
    "சணல் பை": {
        "english_title": "Eco-Friendly Handcrafted Jute Tote Bag",
        "category": "Bags & Natural Fiber Crafts",
        "materials": "100% Golden Jute & Cotton Webbing Handle",
        "production_method": "Hand-cut & Stitched by Rural SHG",
        "suggested_price": 320,
        "price_min": 180,
        "price_max": 500,
        "default_description": "Durable eco-friendly jute market tote bag with reinforced handles, made by women artisan SHGs.",
        "dimensions": "15 x 14 x 5 inches"
    },
    "கைப்பை": {
        "english_title": "Handmade Artisan Bag",
        "category": "Bags & Natural Fiber Crafts",
        "materials": "Natural Fiber & Cloth",
        "production_method": "Handmade Hand-stitched",
        "suggested_price": 350,
        "price_min": 200,
        "price_max": 650,
        "default_description": "Handmade utility handbag with sustainable rural artisan detailing.",
        "dimensions": "14 x 12 inches"
    },
    "கோரை பாய்": {
        "english_title": "Handwoven Korai Grass Sleeping Mat",
        "category": "Bags & Natural Fiber Crafts",
        "materials": "River Grass (Korai) & Cotton Twine",
        "production_method": "Traditional Reed Mat Loom",
        "suggested_price": 650,
        "price_min": 400,
        "price_max": 1200,
        "default_description": "Natural thermal-cooling korai grass mat carefully hand-plaited for healthy sleep and meditation.",
        "dimensions": "6 x 3 feet"
    },

    # Woodwork & Carving
    "மர பொம்மை": {
        "english_title": "Handcrafted Wooden Toy Set",
        "category": "Woodwork & Carving",
        "materials": "Natural Softwood & Non-toxic Vegetable Dyes",
        "production_method": "Hand Turned & Lacquered",
        "suggested_price": 480,
        "price_min": 250,
        "price_max": 850,
        "default_description": "Safe, eco-friendly wooden toys carved from natural wood and finished with organic vegetable lacquer.",
        "dimensions": "Set of 4 figurines (4 to 6 inches)"
    },
    "மர சிற்பம்": {
        "english_title": "Hand-Carved Wooden Figurine Sculpture",
        "category": "Woodwork & Carving",
        "materials": "Teak Wood / Country Rosewood",
        "production_method": "Hand Chiseled by Master Carver",
        "suggested_price": 1800,
        "price_min": 1100,
        "price_max": 3500,
        "default_description": "Intricately detailed wooden sculpture carved by hand using traditional iron chisels.",
        "dimensions": "Height: 12 inches, Width: 5 inches"
    },

    # Metal & Bell Metal Crafts
    "பித்தளை விளக்கு": {
        "english_title": "Traditional Cast Brass Kuthu Vilakku (Oil Lamp)",
        "category": "Metal & Bell Metal Crafts",
        "materials": "Solid High-grade Brass",
        "production_method": "Lost Wax Casting & Hand Polished",
        "suggested_price": 2400,
        "price_min": 1400,
        "price_max": 5000,
        "default_description": "Traditional 5-wick solid brass ceremonial temple lamp handcrafted with intricate hamsa top finial.",
        "dimensions": "Height: 18 inches, Weight: 2.1 kg"
    },
    "வெண்கல பாத்திரம்": {
        "english_title": "Handmade Bronze Urli Vessel",
        "category": "Metal & Bell Metal Crafts",
        "materials": "Handcrafted Bronze / Bell Metal",
        "production_method": "Traditional Hand-forged Metalwork",
        "suggested_price": 2800,
        "price_min": 1800,
        "price_max": 6500,
        "default_description": "Authentic hand-forged bronze bell-metal vessel suitable for floating floral displays or Ayurvedic cooking.",
        "dimensions": "Diameter: 12 inches, Weight: 2.5 kg"
    },

    # Jewellery & Beadwork
    "பாசி மாலை": {
        "english_title": "Handmade Artisan Beaded Necklace",
        "category": "Jewellery & Beadwork",
        "materials": "Terracotta & Natural Beads",
        "production_method": "Hand Threaded & Kiln Painted",
        "suggested_price": 450,
        "price_min": 250,
        "price_max": 800,
        "default_description": "Vibrant handmade bead jewelry created with terracotta and natural cotton tassels.",
        "dimensions": "Adjustable cord length"
    },

    # Bamboo & Cane Crafts
    "மூங்கில் கூடை": {
        "english_title": "Handwoven Bamboo Utility Basket",
        "category": "Bamboo & Cane Crafts",
        "materials": "Split Natural Bamboo Reeds",
        "production_method": "Hand Woven Weave",
        "suggested_price": 340,
        "price_min": 200,
        "price_max": 550,
        "default_description": "Strong, multipurpose bamboo storage basket woven by hand with natural reed ribs.",
        "dimensions": "Diameter: 14 inches, Depth: 8 inches"
    }
}

# Tamil Material Translations
TAMIL_MATERIALS_MAP = {
    "களிமண்": "Natural Terracotta Clay",
    "சுடுமண்": "Kiln-Fired Terracotta",
    "மண்": "Natural Earthen Clay",
    "பட்டு": "100% Pure Silk",
    "பருத்தி": "Pure Organic Cotton",
    "சணல்": "Golden Jute Fiber",
    "மரம்": "Natural Handcrafted Wood",
    "தேக்கு": "Teak Wood",
    "பித்தளை": "Solid Brass",
    "வெண்கலம்": "Bronze / Bell Metal",
    "மூங்கில்": "Organic Split Bamboo",
    "பிரம்பு": "Natural Cane",
    "கோரை புல்": "Korai River Grass",
    "கல்": "Natural Carved Stone",
    "தோல்": "Natural Artisan Leather",
    "கண்ணாடி": "Glass & Beadwork"
}

# Tamil Number Words parsing
TAMIL_NUMBER_WORDS = {
    "ஒன்று": 1, "ஒன்னு": 1, "ஒரு": 1,
    "இரண்டு": 2, "ரெண்டு": 2, "இரு": 2,
    "மூன்று": 3, "மூணு": 3,
    "நான்கு": 4, "நாலு": 4,
    "ஐந்து": 5, "அஞ்சு": 5,
    "ஆறு": 6,
    "ஏழு": 7,
    "எட்டு": 8,
    "ஒன்பது": 9,
    "பத்து": 10,
    "இருபது": 20,
    "முப்பது": 30,
    "நாற்பது": 40,
    "ஐம்பது": 50,
    "அறுபது": 60,
    "எழுபது": 70,
    "எண்பது": 80,
    "தொண்ணூறு": 90,
    "நூறு": 100,
    "இருநூறு": 200,
    "முந்நூறு": 300,
    "நானூறு": 400,
    "ஐந்நூறு": 500, "ஐநூறு": 500,
    "அறுநூறு": 600,
    "எழுநூறு": 700,
    "எண்ணூறு": 800,
    "தொள்ளாயிரம்": 900,
    "ஆயிரம்": 1000,
    "இரண்டாயிரம்": 2000,
    "ஐந்தாயிரம்": 5000,
    "பத்தாயிரம்": 10000
}

def extract_numeric_value(text: str) -> Optional[float]:
    """
    Extracts a numeric value from text that may contain digits (e.g., '350', 'Rs. 450', '25 pcs')
    or Tamil spoken number words (e.g. 'ஐநூறு', 'முந்நூற்று ஐம்பது', 'பத்து').
    """
    if not text:
        return None
        
    text_clean = text.strip()
    
    # 1. Direct digit matching (e.g. 500, 350.50, ₹1200)
    digit_match = re.search(r"(\d+(?:\.\d+)?)", text_clean)
    if digit_match:
        try:
            return float(digit_match.group(1))
        except ValueError:
            pass

    # 2. Tamil compound number words
    # Check for direct single word match
    for word, val in TAMIL_NUMBER_WORDS.items():
        if word in text_clean:
            # Check if there is an addition (e.g., இருநூற்று ஐம்பது -> 200 + 50 = 250)
            compound_val = 0
            if "இருநூற்று" in text_clean or "இருநூறு" in text_clean:
                compound_val += 200
            elif "முந்நூற்று" in text_clean or "முந்நூறு" in text_clean:
                compound_val += 300
            elif "நானூற்று" in text_clean or "நானூறு" in text_clean:
                compound_val += 400
            elif "ஐந்நூற்று" in text_clean or "ஐநூற்று" in text_clean or "ஐநூறு" in text_clean:
                compound_val += 500
            elif "ஆயிரத்து" in text_clean:
                compound_val += 1000
            elif "நூற்று" in text_clean:
                compound_val += 100
                
            remainder = 0
            for r_word, r_val in [("ஐம்பது", 50), ("இருபது", 20), ("முப்பது", 30), ("நாற்பது", 40), 
                                   ("பத்து", 10), ("ஐந்து", 5), ("அஞ்சு", 5), ("இரண்டு", 2), ("மூன்று", 3)]:
                if r_word in text_clean and r_val != compound_val:
                    remainder = r_val
                    break
                    
            if compound_val > 0:
                return float(compound_val + remainder)
                
            return float(val)

    return None

def process_voice_field_answer(field: str, spoken_text: str, language: str = "ta", current_product: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Processes an artisan's spoken response for a given field in the voice listing workflow.
    - Translates Tamil words into accurate English for the marketplace database.
    - Extracts numbers for price, stock, capacity.
    - Maps categories safely (never misclassifying a water jug as textile).
    - Returns structured information with bilingual displays.
    """
    if current_product is None:
        current_product = {}

    clean_text = (spoken_text or "").strip()
    is_ta = (language == "ta")

    if not clean_text:
        return {
            "is_valid": False,
            "field": field,
            "error_message": "எந்தக் குரல் பதிவும் வரவில்லை. மீண்டும் பேசுங்கள்." if is_ta else "No speech detected. Please tap and speak again.",
            "original_text": "",
            "parsed_value": None,
            "display_text": ""
        }

    # 1. Processing Title
    if field == "title":
        # Check dictionary for known artisan terms
        matched_dict_entry = None
        for key, entry in TAMIL_CRAFT_DICTIONARY.items():
            if key in clean_text or clean_text in key:
                matched_dict_entry = entry
                break
                
        if matched_dict_entry:
            eng_title = matched_dict_entry["english_title"]
            category = matched_dict_entry["category"]
            materials = matched_dict_entry["materials"]
            suggested_price = matched_dict_entry["suggested_price"]
            description = matched_dict_entry.get("default_description", "")
            return {
                "is_valid": True,
                "field": "title",
                "original_text": clean_text,
                "english_value": eng_title,
                "display_text": clean_text if is_ta else eng_title,
                "associated_category": category,
                "associated_materials": materials,
                "associated_description": description,
                "suggested_price": suggested_price,
                "confidence": "high",
                "message": f"அடையாளம் காணப்பட்டது: {clean_text} ({eng_title})" if is_ta else f"Identified: {eng_title}"
            }
        else:
            # Fallback title processing using natural Tamil translation
            eng_title = translate_tamil_to_english(clean_text) if is_ta else clean_text
            if not eng_title:
                eng_title = clean_text
            
            # Category inference if obvious
            lower_clean = clean_text.lower()
            inferred_cat = ""
            if any(w in lower_clean for w in ["குடம்", "தண்ணீர்", "பானை", "jug", "pitcher"]):
                inferred_cat = "Household Goods, Water Jugs & Pitchers"
            elif any(w in lower_clean for w in ["மண்பாண்டம்", "களிமண்", "சுடுமண்", "pottery", "clay"]):
                inferred_cat = "Pottery & Terracotta"
            elif any(w in lower_clean for w in ["பட்டு", "புடவை", "சேலை", "silk", "saree"]):
                inferred_cat = "Handloom & Textiles"
            elif any(w in lower_clean for w in ["சணல்", "பை", "jute", "bag"]):
                inferred_cat = "Bags & Natural Fiber Crafts"

            return {
                "is_valid": True,
                "field": "title",
                "original_text": clean_text,
                "english_value": eng_title,
                "display_text": clean_text if is_ta else eng_title,
                "associated_category": inferred_cat,
                "confidence": "high" if inferred_cat else "medium",
                "message": f"பொருளின் பெயர்: {clean_text} ({eng_title})" if is_ta else f"Title: {eng_title}"
            }

    # 2. Processing Category
    elif field == "category":
        lower_spoken = clean_text.lower()
        matched_category = ""
        
        # Check water jug keywords first to prevent textile misclassification
        water_jug_terms = ["குடம்", "தண்ணீர்", "பானை", "ஜாடி", "pitcher", "jug", "water", "pottery water"]
        if any(term in lower_spoken for term in water_jug_terms):
            matched_category = "Household Goods, Water Jugs & Pitchers"
        elif any(term in lower_spoken for term in ["மண்பாண்டம்", "களிமண்", "சுடுமண்", "terracotta", "clay pot", "clay"]):
            matched_category = "Pottery & Terracotta"
        elif any(term in lower_spoken for term in ["பட்டு", "புடவை", "சேலை", "வேஷ்டி", "துணி", "silk", "saree", "handloom", "textile"]):
            matched_category = "Handloom & Textiles"
        elif any(term in lower_spoken for term in ["சணல்", "பை", "கைப்பை", "jute", "bag", "tote"]):
            matched_category = "Bags & Natural Fiber Crafts"
        elif any(term in lower_spoken for term in ["மரம்", "சிற்பம்", "பொம்மை", "wood", "carving"]):
            matched_category = "Woodwork & Carving"
        elif any(term in lower_spoken for term in ["பித்தளை", "வெண்கலம்", "விளக்கு", "brass", "bronze", "metal"]):
            matched_category = "Metal & Bell Metal Crafts"
        elif any(term in lower_spoken for term in ["பாசி", "மாலை", "ஆபரணம்", "bead", "jewellery"]):
            matched_category = "Jewellery & Beadwork"
        elif any(term in lower_spoken for term in ["மூங்கில்", "கூடை", "bamboo", "cane"]):
            matched_category = "Bamboo & Cane Crafts"
        else:
            # Check exact category match
            for cat in MARKETPLACE_CATEGORIES:
                if cat.lower() in lower_spoken or lower_spoken in cat.lower():
                    matched_category = cat
                    break

        if not matched_category:
            matched_category = "Other Traditional Crafts"

        return {
            "is_valid": True,
            "field": "category",
            "original_text": clean_text,
            "english_value": matched_category,
            "display_text": matched_category,
            "message": f"பிரிவு: {matched_category}" if is_ta else f"Category selected: {matched_category}"
        }

    # 3. Processing Materials
    elif field == "materials":
        translated_materials = []
        for ta_mat, en_mat in TAMIL_MATERIALS_MAP.items():
            if ta_mat in clean_text:
                translated_materials.append(en_mat)

        if not translated_materials:
            # Fallback: check if water jug was identified
            prod_title = current_product.get("title", "").lower()
            if "jug" in prod_title or "pottery" in prod_title or "குடம்" in clean_text:
                translated_materials = ["Natural Terracotta Clay"]
            elif "silk" in prod_title or "பட்டு" in clean_text:
                translated_materials = ["Pure Mulberry Silk"]
            elif "jute" in prod_title or "சணல்" in clean_text:
                translated_materials = ["Natural Jute Fiber"]
            else:
                translated_materials = [clean_text]

        final_mat = ", ".join(translated_materials)
        return {
            "is_valid": True,
            "field": "materials",
            "original_text": clean_text,
            "english_value": final_mat,
            "display_text": clean_text if is_ta else final_mat,
            "message": f"பொருட்கள்: {final_mat}" if is_ta else f"Materials: {final_mat}"
        }

    # 4. Processing Price
    elif field in ("price_per_unit", "price"):
        val = extract_numeric_value(clean_text)
        if val is None or val <= 0:
            return {
                "is_valid": False,
                "field": "price_per_unit",
                "error_message": "விலையைக் கண்டறிய முடியவில்லை. தயவுசெய்து எண்ணாகக் கூறவும் (உதா: '350 ரூபாய்' அல்லது '500')." if is_ta else "Could not identify a valid price. Please speak the amount clearly (e.g. '350 rupees' or '500').",
                "original_text": clean_text
            }
        return {
            "is_valid": True,
            "field": "price_per_unit",
            "original_text": clean_text,
            "numeric_value": float(val),
            "parsed_number": float(val),
            "english_value": float(val),
            "display_text": f"₹{int(val)}",
            "message": f"விலை: ₹{int(val)}" if is_ta else f"Unit Price: ₹{int(val)}"
        }

    # 5. Processing Stock Quantity
    elif field in ("stock_quantity", "stock"):
        val = extract_numeric_value(clean_text)
        if val is None or val <= 0:
            return {
                "is_valid": False,
                "field": "stock_quantity",
                "error_message": "கையிருப்பு எண்ணிக்கையைக் கூறவும் (உதா: '10 பொருட்கள்' அல்லது '25')." if is_ta else "Could not parse quantity. Please speak the stock count (e.g. '10 items' or '25').",
                "original_text": clean_text
            }
        return {
            "is_valid": True,
            "field": "stock_quantity",
            "original_text": clean_text,
            "numeric_value": int(val),
            "parsed_number": float(val),
            "english_value": int(val),
            "display_text": f"{int(val)} பொருட்கள்" if is_ta else f"{int(val)} units",
            "message": f"கையிருப்பு: {int(val)}" if is_ta else f"Stock: {int(val)} units"
        }

    # 6. Processing Description / Features
    elif field in ("description", "features"):
        translated_meaning = translate_tamil_to_english(clean_text) if is_ta else clean_text
        title = current_product.get("title", "")
        materials = current_product.get("materials", "")
        
        # Formulate clean, natural English description preserving artisan meaning without inventing facts
        if translated_meaning:
            eng_desc = translated_meaning
            # If it's a short feature or phrase, make it a well-phrased product description
            if len(eng_desc.split()) <= 8 and title:
                eng_desc = f"{title}. {translated_meaning} Handcrafted with authentic {materials or 'traditional materials'}."
        else:
            eng_desc = clean_text

        return {
            "is_valid": True,
            "field": "description",
            "original_text": clean_text,
            "english_value": eng_desc,
            "translated_meaning": translated_meaning,
            "display_text": clean_text if is_ta else eng_desc,
            "message": f"விளக்கம்: {translated_meaning}" if is_ta else "Description saved."
        }

    # 7. Processing Minimum Wholesale Order Quantity (MOQ)
    elif field in ("moq", "min_order_qty"):
        val = extract_numeric_value(clean_text)
        if val is None or val <= 0:
            return {
                "is_valid": False,
                "field": "moq",
                "error_message": "குறைந்தபட்ச ஆர்டர் அளவைக் கூறவும் (உதா: '5' அல்லது '10')." if is_ta else "Please specify minimum wholesale order quantity.",
                "original_text": clean_text
            }
        return {
            "is_valid": True,
            "field": "moq",
            "original_text": clean_text,
            "numeric_value": int(val),
            "parsed_number": float(val),
            "english_value": int(val),
            "display_text": f"{int(val)} குறைந்தபட்ச ஆர்டர்" if is_ta else f"MOQ: {int(val)}",
            "message": f"MOQ: {int(val)}"
        }

    # 8. Processing Delivery Lead Time (Days)
    elif field in ("lead_time_days", "lead_time"):
        val = extract_numeric_value(clean_text)
        if val is None or val <= 0:
            return {
                "is_valid": False,
                "field": "lead_time_days",
                "error_message": "தயாரிப்பு கால அவகாசத்தைக் கூறவும் (உதா: '7 நாட்கள்' அல்லது '14')." if is_ta else "Please specify production lead time in days.",
                "original_text": clean_text
            }
        return {
            "is_valid": True,
            "field": "lead_time_days",
            "original_text": clean_text,
            "numeric_value": int(val),
            "parsed_number": float(val),
            "english_value": int(val),
            "display_text": f"{int(val)} நாட்கள்" if is_ta else f"{int(val)} days",
            "message": f"கால அவகாசம்: {int(val)} நாட்கள்" if is_ta else f"Lead time: {int(val)} days"
        }

    # 9. Processing Monthly Capacity
    elif field in ("monthly_capacity", "capacity"):
        val = extract_numeric_value(clean_text)
        if val is None or val <= 0:
            val = 50.0 # sensible default
        return {
            "is_valid": True,
            "field": "monthly_capacity",
            "original_text": clean_text,
            "numeric_value": int(val),
            "parsed_number": float(val),
            "english_value": int(val),
            "display_text": f"{int(val)} / மாதம்" if is_ta else f"{int(val)} units/month",
            "message": f"மாத உற்பத்தி: {int(val)}" if is_ta else f"Monthly capacity: {int(val)}"
        }

    # 10. Processing Dimensions
    elif field == "dimensions":
        dim_en = translate_tamil_to_english(clean_text) if is_ta else clean_text
        return {
            "is_valid": True,
            "field": "dimensions",
            "original_text": clean_text,
            "english_value": dim_en,
            "display_text": clean_text if is_ta else dim_en,
            "message": f"அளவு: {clean_text}" if is_ta else f"Dimensions: {dim_en}"
        }

    # 11. Processing Production Method
    elif field == "production_method":
        method_en = translate_tamil_to_english(clean_text) if is_ta else clean_text
        return {
            "is_valid": True,
            "field": "production_method",
            "original_text": clean_text,
            "english_value": method_en or "Handcrafted",
            "display_text": clean_text if is_ta else (method_en or "Handcrafted"),
            "message": f"உற்பத்தி முறை: {clean_text}" if is_ta else f"Method: {method_en}"
        }

    # Default fallback
    return {
        "is_valid": True,
        "field": field,
        "original_text": clean_text,
        "english_value": translate_tamil_to_english(clean_text) if is_ta else clean_text,
        "display_text": clean_text
    }

def get_fair_price_suggestion(category: str, materials: str, title: str = "") -> Dict[str, Any]:
    """
    Computes an indicative fair wholesale price recommendation based on craft sector benchmarks.
    Clearly notes that this is an estimate, not a guaranteed market price.
    """
    cat_lower = (category or "").lower()
    mat_lower = (materials or "").lower()
    title_lower = (title or "").lower()

    # Match specific items
    if "jug" in title_lower or "குடம்" in title_lower or "water" in cat_lower or "pitcher" in cat_lower:
        base_cost = 140
        labor_hours = 3.5
        hourly_rate = 60
        margin = 1.35
        suggested = round((base_cost + (labor_hours * hourly_rate)) * margin)
        return {
            "suggested_price": suggested,
            "price_range_min": 280,
            "price_range_max": 480,
            "explanation": "Calculated based on 3.5 hours of master potter shaping, kiln firing costs, and 35% fair margin.",
            "explanation_ta": "3.5 மணி நேர மண்பாண்ட சுழற்சி, சுடுமண் சூளை செலவு மற்றும் 35% நியாயமான லாப வரம்பின் அடிப்படையில் கணக்கிடப்பட்டது.",
            "is_estimate": True
        }
    elif "silk" in mat_lower or "silk" in title_lower or "பட்டு" in title_lower:
        base_cost = 2800
        labor_hours = 24
        hourly_rate = 120
        margin = 1.30
        suggested = round((base_cost + (labor_hours * hourly_rate)) * margin)
        return {
            "suggested_price": suggested,
            "price_range_min": 5200,
            "price_range_max": 9500,
            "explanation": "Calculated based on 3-day handloom pitloom weaving, pure mulberry silk yarn, and fair living wage.",
            "explanation_ta": "3 நாள் கைத்தறி நெசவு, தூய பட்டு நூல் மற்றும் நியாயமான கைவினைஞர் ஊதியத்தின் அடிப்படையில் கணக்கிடப்பட்டது.",
            "is_estimate": True
        }
    elif "jute" in mat_lower or "bag" in cat_lower or "பை" in title_lower:
        base_cost = 90
        labor_hours = 1.5
        hourly_rate = 70
        margin = 1.35
        suggested = round((base_cost + (labor_hours * hourly_rate)) * margin)
        return {
            "suggested_price": suggested,
            "price_range_min": 220,
            "price_range_max": 420,
            "explanation": "Calculated based on golden jute canvas cutting, stitching, and fair SHG artisan wages.",
            "explanation_ta": "சணல் துணி வெட்டுதல், தையல் மற்றும் மகளிர் குழுவின் நியாயமான ஊதியத்தின் அடிப்படையில் கணக்கிடப்பட்டது.",
            "is_estimate": True
        }
    elif "pottery" in cat_lower or "clay" in mat_lower:
        return {
            "suggested_price": 320,
            "price_range_min": 200,
            "price_range_max": 500,
            "explanation": "Standard indicative benchmark for handmade unglazed terracotta products.",
            "explanation_ta": "கைவினை சுடுமண் தயாரிப்புகளுக்கான வழிகாட்டி மதிப்பீடு.",
            "is_estimate": True
        }
    else:
        return {
            "suggested_price": 450,
            "price_range_min": 300,
            "price_range_max": 750,
            "explanation": "General handmade artisan craft benchmark. Please verify based on your actual material and labor expenses.",
            "explanation_ta": "பொதுவான கைவினைப் பொருள் வழிகாட்டி விலை. உங்கள் உண்மையான மூலப்பொருள் செலவுக்கு ஏற்ப மாற்றிக்கொள்ளலாம்.",
            "is_estimate": True
        }
