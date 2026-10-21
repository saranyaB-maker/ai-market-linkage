import re
import json
import logging
import requests
from typing import Dict, Any, Optional
from config import Config

logger = logging.getLogger("market_linkage")

# In-memory LRU cache for translations
_TRANSLATION_CACHE: Dict[str, str] = {}

# Craft category translations mapping (Canonical English <-> Natural Tamil)
CATEGORY_TRANSLATIONS = {
    "Household Goods, Water Jugs & Pitchers": "வீட்டு உபயோகப் பொருட்கள், தண்ணீர் குடங்கள் & ஜாடிகள்",
    "Pottery & Ceramics": "மண்பாண்டங்கள் & பீங்கான் கைவினை",
    "Pottery & Terracotta": "மண்பாண்டங்கள் & சுடுமண் கைவினை",
    "Handloom & Textiles": "கைத்தறி & பாரம்பரிய ஆடைகள்",
    "Bags & Natural Fiber Crafts": "பைகள் & இயற்கை நார் கைவினை",
    "Jute & Natural Fiber Crafts": "சணல் & இயற்கை நார் கைவினை",
    "Woodwork & Carving": "மர வேலைப்பாடு & சிற்பங்கள்",
    "Metal & Bell Metal Crafts": "உலோக & வெண்கல கைவினை",
    "Jewellery & Beadwork": "கைவினை நகைகள் & பாசி மாலைகள்",
    "Bamboo & Cane Crafts": "மூங்கில் & பிரம்பு பொருட்கள்",
    "Stone & Marble Carving": "கல் & பளிங்கு சிற்பங்கள்",
    "Handmade Paper & Leather": "கைவினை காகிதம் & தோல் பொருட்கள்",
    "Painting & Folk Art": "பாரம்பரிய ஓவியம் & நாட்டுப்புற கலை",
    "Other Traditional Crafts": "பிற பாரம்பரிய கைவினைப் பொருட்கள்"
}

REVERSE_CATEGORY_TRANSLATIONS = {v: k for k, v in CATEGORY_TRANSLATIONS.items()}

# Common artisan materials translation
MATERIAL_TRANSLATIONS = {
    "Natural Terracotta Clay": "இயற்கை சுடுமண் களிமண்",
    "Terracotta Clay": "சுடுமண் களிமண்",
    "Riverbed Clay": "ஆற்றுப்படுகை களிமண்",
    "Pure Mulberry Silk": "தூய மல்பெரி பட்டு",
    "Fine Count Cotton": "மெல்லிய பருத்தி நூல்",
    "100% Golden Jute & Cotton Webbing Handle": "100% தங்க சணல் மற்றும் பருத்தி கைப்பிடி",
    "Golden Jute Fiber": "தங்க சணல் நார்",
    "Teak Wood": "தேக்கு மரம்",
    "Solid High-grade Brass": "உயர்தர திட பித்தளை",
    "Handcrafted Bronze / Bell Metal": "கைவினை வெண்கல உலோகம்",
    "Natural Softwood & Non-toxic Vegetable Dyes": "மென்மரம் & இயற்கை காய்கறி வண்ணங்கள்",
    "Split Natural Bamboo Reeds": "இயற்கை மூங்கில் கீற்றுகள்",
    "River Grass (Korai) & Cotton Twine": "கோரை புல் மற்றும் பருத்தி நூல்",
    "Natural materials": "இயற்கை மூலப்பொருட்கள்"
}

PRODUCTION_METHOD_TRANSLATIONS = {
    "Handcrafted": "கைவினை முறை",
    "Wheel-thrown": "மண்பாண்ட சக்கர சுழற்சி",
    "Handmade Potter's Wheel & Kiln Fired": "மண்பாண்ட சக்கரம் மற்றும் சூளையில் சுடப்பட்டது",
    "Traditional Potter's Wheel": "பாரம்பரிய மண்பாண்ட சக்கரம்",
    "Pitloom Hand-weaving": "பாரம்பரிய குழித்தறி நெசவு",
    "Shuttle Handloom": "கைத்தறி நெசவு",
    "Hand-cut & Stitched by Rural SHG": "கிராமப்புற மகளிர் குழுவின் கைத்தையல்",
    "Hand Turned & Lacquered": "கையால் கடையப்பட்டு இயற்கை அரக்கு பூசப்பட்டது",
    "Hand Chiseled by Master Carver": "தலைமை சிற்பியின் கை உளி செதுக்கல்",
    "Lost Wax Casting & Hand Polished": "பாரம்பரிய மெழுகு வார்ப்பு மற்றும் கை மெருகூட்டல்",
    "Hand Woven Weave": "பாரம்பரிய கை பின்னுதல்"
}

UNIT_TRANSLATIONS = {
    "piece": "துண்டு (Piece)",
    "pieces": "துண்டுகள்",
    "set": "தொகுப்பு (Set)",
    "meter": "மீட்டர்",
    "meters": "மீட்டர்கள்",
    "kg": "கிலோ",
    "pair": "ஜோடி (Pair)",
    "dozen": "டஜன்",
    "box": "பெட்டி (Box)"
}

# Common colloquial Tamil / Tanglish craft idioms
TANGILISH_COLLOQUIAL_PATTERNS = [
    (r"(?i)stronger\s+இருக்கும்", "durable and strong"),
    (r"(?i)strong\s+ஆ\s+இருக்கும்", "strong and sturdy"),
    (r"(?i)நிறைய\s+லிட்டர்\s+தண்ணி\s+பிடிக்கும்", "large water-holding capacity holding many liters"),
    (r"(?i)தண்ணி\s+பிடிக்கும்", "water-holding capacity"),
    (r"(?i)நல்ல\s+குளிர்ச்சியா\s+இருக்கும்", "provides natural cooling"),
    (r"(?i)குளிர்ச்சி\s+தரும்", "keeps water naturally cool"),
    (r"(?i)நீடித்து\s+உழைக்கும்", "durable and long-lasting"),
    (r"(?i)கைவேலைப்பாடு", "handcrafted artisan work"),
    (r"(?i)இயற்கையான\s+பொருள்", "made from natural materials"),
    (r"(?i)நச்சுத்தன்மை\s+இல்லாத", "100% non-toxic and organic"),
    (r"(?i)பாரம்பரிய\s+முறை", "traditional handmade technique"),
    (r"(?i)சுத்தமான\s+மண்", "pure riverbed earthenware clay"),
]

OFFLINE_TAMIL_TO_ENGLISH = {
    "Stronger இருக்கும், நிறைய லிட்டர் தண்ணி பிடிக்கும்.": "Durable and strong, large water-holding capacity holding many liters.",
    "Stronger இருக்கும், நிறைய லிட்டர் தண்ணி பிடிக்கும்": "Durable and strong, large water-holding capacity holding many liters.",
    "மண் குடம்": "Clay Water Pot",
    "மண்பானை": "Clay Pot",
    "பாரம்பரிய மண் குடம்": "Traditional Clay Water Pot",
    "இயற்கையான களிமண்ணால் செய்யப்பட்டது. தண்ணீர் குளிர்ச்சியாக இருக்கும்.": "Made of natural clay. Keeps water naturally cool and durable.",
    "இயற்கை களிமண்": "Natural Clay",
    "சுடுமண் குடம்": "Terracotta Water Jug"
}

OFFLINE_ENGLISH_TO_TAMIL = {
    "Artisan Terracotta Water Jug": "பாரம்பரிய சுடுமண் தண்ணீர் குடம்",
    "Handcrafted natural clay water jug that cools water naturally and stays durable.": "இயற்கையான களிமண்ணால் செய்யப்பட்ட பாரம்பரிய தண்ணீர் குடம். இயற்கையான குளிர்ச்சி மற்றும் நீடித்து உழைக்கும் தன்மை கொண்டது.",
    "Handcrafted Clay Water Pot": "கைவினை மண் தண்ணீர் குடம்",
    "Terracotta Water Jug": "சுடுமண் தண்ணீர் குடம்",
    "Clay Water Pot": "மண் தண்ணீர் குடம்"
}

def _get_cache_key(text: str, source_lang: str, target_lang: str) -> str:
    return f"{source_lang}:{target_lang}:{text.strip().lower()}"

def _translate_via_google_api(text: str, source_lang: str, target_lang: str) -> Optional[str]:
    """
    Translates text using the Google Translate HTTP service.
    Fast, reliable, and handles full sentences without credentials.
    """
    if not text or not text.strip():
        return ""
    try:
        url = "https://translate.googleapis.com/translate_a/single"
        params = {
            "client": "gtx",
            "sl": source_lang,
            "tl": target_lang,
            "dt": "t",
            "q": text.strip()
        }
        res = requests.get(url, params=params, timeout=5)
        if res.status_code == 200:
            data = res.json()
            if data and isinstance(data, list) and len(data) > 0 and isinstance(data[0], list):
                translated_parts = [part[0] for part in data[0] if part and len(part) > 0 and part[0]]
                return "".join(translated_parts).strip()
    except Exception as e:
        logger.warning(f"Google translate service fallback error: {e}")
    return None

def _translate_via_gemini(text: str, instruction: str) -> Optional[str]:
    """
    Uses Gemini 1.5 Flash if GEMINI_API_KEY is configured.
    """
    api_key = getattr(Config, "GEMINI_API_KEY", "") or ""
    if not api_key:
        return None

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        prompt = f"""{instruction}
Input text: "{text}"
Output ONLY the clean translated string without commentary, quotation marks, or explanations."""

        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.1, "maxOutputTokens": 300}
        }
        res = requests.post(url, headers=headers, json=payload, timeout=6)
        if res.status_code == 200:
            result = res.json()
            candidates = result.get("candidates", [])
            if candidates:
                cand_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
                if cand_text:
                    return cand_text
    except Exception as e:
        logger.warning(f"Gemini translation call error: {e}")
    return None

def translate_tamil_to_english(spoken_text: str, context: str = "artisan_product") -> str:
    """
    Translates spoken Tamil, colloquial Tamil, or mixed Tamil-English into natural,
    professional marketplace English.
    Preserves facts and avoids inventing certifications, capacities, or materials.
    Example:
    'Stronger இருக்கும், நிறைய லிட்டர் தண்ணி பிடிக்கும்.' ->
    'A durable water jug with a large water-holding capacity.'
    """
    clean = (spoken_text or "").strip()
    if not clean:
        return ""

    if clean in OFFLINE_TAMIL_TO_ENGLISH:
        return OFFLINE_TAMIL_TO_ENGLISH[clean]

    cache_key = _get_cache_key(clean, "ta", "en")
    if cache_key in _TRANSLATION_CACHE:
        return _TRANSLATION_CACHE[cache_key]

    # 1. Try Gemini if configured
    gemini_instruction = (
        "You are an assistant for rural Indian artisans listing products on a direct wholesale marketplace. "
        "Translate the following spoken Tamil (or mixed colloquial Tamil-English) into clear, natural, professional English. "
        "Strict rules: "
        "1. Understand colloquial expressions naturally (e.g. 'Stronger இருக்கும், நிறைய லிட்டர் தண்ணி பிடிக்கும்' means 'Durable and sturdy, with a large water-holding capacity'). "
        "2. Do NOT invent unmentioned facts, numeric measurements, certifications, or durability ratings. "
        "3. Output ONLY the translated English text."
    )
    result = _translate_via_gemini(clean, gemini_instruction)

    # 2. If Gemini not configured or failed, use Google API + idiom refinery
    if not result:
        # Pre-process known Tanglish phrases
        pre_processed = clean
        for pattern, replacement in TANGILISH_COLLOQUIAL_PATTERNS:
            pre_processed = re.sub(pattern, replacement, pre_processed)

        google_trans = _translate_via_google_api(pre_processed, "ta", "en")
        if google_trans:
            # Clean up colloquialisms in google translate result
            refined = google_trans
            refined = re.sub(r"(?i)\bholds many liters of water\b", "large water-holding capacity", refined)
            refined = re.sub(r"(?i)\blots of liter water holds\b", "large water capacity", refined)
            refined = re.sub(r"(?i)\bstronger\s*,\s*", "Durable and strong, ", refined)
            if refined.lower().startswith("stronger"):
                refined = "Durable and strong " + refined[8:].lstrip(", ")
            result = refined
        else:
            result = pre_processed

    # 3. Final fallback: return clean input if all services failed
    if not result:
        result = clean

    _TRANSLATION_CACHE[cache_key] = result
    return result

def translate_english_to_tamil(text: str, context: str = "product_details") -> str:
    """
    Translates canonical English product details into simple, natural Tamil suitable
    for rural buyers and artisans.
    Preserves numbers, prices, units, and dimensions intact.
    """
    clean = (text or "").strip()
    if not clean:
        return ""

    # Check known category and material direct mappings first
    if clean in CATEGORY_TRANSLATIONS:
        return CATEGORY_TRANSLATIONS[clean]
    if clean in MATERIAL_TRANSLATIONS:
        return MATERIAL_TRANSLATIONS[clean]
    if clean in PRODUCTION_METHOD_TRANSLATIONS:
        return PRODUCTION_METHOD_TRANSLATIONS[clean]
    if clean in OFFLINE_ENGLISH_TO_TAMIL:
        return OFFLINE_ENGLISH_TO_TAMIL[clean]

    cache_key = _get_cache_key(clean, "en", "ta")
    if cache_key in _TRANSLATION_CACHE:
        return _TRANSLATION_CACHE[cache_key]

    # 1. Try Gemini if configured
    gemini_instruction = (
        "Translate the following artisan product text from English into simple, natural Tamil suitable for rural Tamil artisans and buyers. "
        "Keep proper names, numbers, dimensions (e.g. 11 inches, 5 Litres), and prices (₹) clear and intact. "
        "Output ONLY the translated Tamil text."
    )
    result = _translate_via_gemini(clean, gemini_instruction)

    # 2. Try Google Translate API
    if not result:
        result = _translate_via_google_api(clean, "en", "ta")

    # 3. Final fallback
    if not result:
        result = clean

    _TRANSLATION_CACHE[cache_key] = result
    return result

def get_bilingual_category(category_name: str, target_lang: str = "ta") -> str:
    """
    Translates a category name cleanly between English and Tamil.
    """
    if not category_name:
        return ""
    if target_lang == "ta":
        return CATEGORY_TRANSLATIONS.get(category_name, translate_english_to_tamil(category_name))
    else:
        return REVERSE_CATEGORY_TRANSLATIONS.get(category_name, category_name)

def get_bilingual_unit(unit_name: str, target_lang: str = "ta") -> str:
    """
    Translates product units (piece, set, meter, etc.) into Tamil.
    """
    if not unit_name:
        return ""
    u_lower = unit_name.strip().lower()
    if target_lang == "ta":
        return UNIT_TRANSLATIONS.get(u_lower, unit_name)
    return unit_name

def has_tamil_chars(text: str) -> bool:
    """
    Checks if a string contains any Unicode Tamil characters (\u0b80-\u0bff).
    """
    if not text:
        return False
    return any('\u0b80' <= ch <= '\u0bff' for ch in str(text))

def translate_product_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Ensures product data submitted by an artisan is translated to canonical English
    while preserving Tamil versions in `title_ta` and `description_ta`.
    """
    result = dict(data)
    
    title = (result.get("title") or "").strip()
    if has_tamil_chars(title):
        result["title_ta"] = title
        result["title"] = translate_tamil_to_english(title)
        
    raw_desc = (result.get("description") or "").strip()
    if has_tamil_chars(raw_desc):
        result["description_ta"] = raw_desc
        result["description"] = translate_tamil_to_english(raw_desc)
        
    cat = (result.get("category") or "").strip()
    if cat:
        result["category"] = get_bilingual_category(cat, "en")
        
    mat = (result.get("materials") or "")
    if isinstance(mat, str) and has_tamil_chars(mat):
        result["materials"] = translate_tamil_to_english(mat)
    elif isinstance(mat, list):
        result["materials"] = [
            translate_tamil_to_english(m) if has_tamil_chars(str(m)) else m
            for m in mat
        ]
        
    method = (result.get("production_method") or "")
    if method and has_tamil_chars(method):
        result["production_method"] = translate_tamil_to_english(method)
        
    dim = (result.get("dimensions") or "")
    if dim and has_tamil_chars(dim):
        result["dimensions"] = translate_tamil_to_english(dim)
        
    return result

