import os
import logging
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
import mongomock
from bson import json_util
import json

logger = logging.getLogger("market_linkage")
_client = None
_db = None
_is_mock = False

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
MOCK_STATE_FILE = os.path.join(BASE_DIR, "mock_db_state.json")

COLLECTION_NAMES = [
    "users", "seller_profiles", "buyer_profiles", "seller_verifications",
    "verification_evidence", "products", "product_images", "image_hashes",
    "duplicate_flags", "buyer_requirements", "quotations", "orders",
    "supplier_suborders", "conversations", "messages", "notifications",
    "reviews", "disputes", "audit_logs"
]

def save_mock_state():
    global _db, _is_mock
    if not _is_mock or _db is None:
        return
    try:
        state = {}
        for col_name in COLLECTION_NAMES:
            docs = list(_db[col_name].find({}))
            state[col_name] = docs
        with open(MOCK_STATE_FILE, "w", encoding="utf-8") as f:
            f.write(json_util.dumps(state, indent=2))
        logger.info(f"Persisted mock database state to {MOCK_STATE_FILE}")
    except Exception as e:
        logger.warning(f"Failed to persist mock DB state: {e}")

def load_mock_state():
    global _db, _is_mock
    if not _is_mock or _db is None:
        return
    if not os.path.exists(MOCK_STATE_FILE):
        return
    try:
        with open(MOCK_STATE_FILE, "r", encoding="utf-8") as f:
            content = f.read()
            if not content.strip():
                return
            state = json_util.loads(content)
            for col_name, docs in state.items():
                if docs:
                    _db[col_name].delete_many({})
                    _db[col_name].insert_many(docs)
        logger.info(f"Loaded existing mock database state from {MOCK_STATE_FILE}")
    except Exception as e:
        logger.warning(f"Failed to load mock DB state: {e}")

def init_db(app=None, force_mock=False):
    global _client, _db, _is_mock
    
    if force_mock:
        logger.info("Initializing in-memory Mock MongoDB client...")
        _client = mongomock.MongoClient()
        _db = _client["ai_market_linkage"]
        _is_mock = True
        load_mock_state()
        create_indexes(_db)
        return _db

    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/ai_market_linkage")
    db_name = os.getenv("DB_NAME", "ai_market_linkage")
    
    try:
        # Fast 2-second timeout to check live MongoDB server
        _client = MongoClient(mongo_uri, serverSelectionTimeoutMS=2000)
        _client.admin.command("ping")
        _db = _client[db_name]
        _is_mock = False
        logger.info(f"Successfully connected to MongoDB server at {mongo_uri} (Database: {db_name})")
    except (ConnectionFailure, ServerSelectionTimeoutError, Exception) as e:
        logger.warning(f"Could not connect to live MongoDB server ({e}). Falling back to resilient in-memory mock client.")
        _client = mongomock.MongoClient()
        _db = _client[db_name]
        _is_mock = True
        load_mock_state()
        
    create_indexes(_db)
    return _db

def get_db():
    global _db
    if _db is None:
        return init_db()
    return _db

def is_mock_db():
    global _is_mock
    return _is_mock

def create_indexes(db):
    try:
        # Users
        db.users.create_index([("email", ASCENDING)], unique=True)
        db.users.create_index([("role", ASCENDING)])
        db.users.create_index([("status", ASCENDING)])
        
        # Seller Profiles
        db.seller_profiles.create_index([("user_id", ASCENDING)], unique=True)
        db.seller_profiles.create_index([("seller_type", ASCENDING)])
        db.seller_profiles.create_index([("craft_category", ASCENDING)])
        
        # Buyer Profiles
        db.buyer_profiles.create_index([("user_id", ASCENDING)], unique=True)
        
        # Seller Verifications
        db.seller_verifications.create_index([("user_id", ASCENDING)], unique=True)
        db.seller_verifications.create_index([("verification_status", ASCENDING)])
        
        # Products
        db.products.create_index([("seller_id", ASCENDING)])
        db.products.create_index([("category", ASCENDING)])
        db.products.create_index([("is_published", ASCENDING), ("is_archived", ASCENDING)])
        db.products.create_index([("price_per_unit", ASCENDING)])
        db.products.create_index([("title", "text"), ("description", "text"), ("materials", "text")])
        
        # Image Hashes
        db.image_hashes.create_index([("phash", ASCENDING)])
        db.image_hashes.create_index([("product_id", ASCENDING)])
        db.image_hashes.create_index([("seller_id", ASCENDING)])
        
        # Duplicate Flags
        db.duplicate_flags.create_index([("status", ASCENDING)])
        db.duplicate_flags.create_index([("new_product_id", ASCENDING)])
        db.duplicate_flags.create_index([("existing_product_id", ASCENDING)])
        
        # Buyer Requirements
        db.buyer_requirements.create_index([("buyer_id", ASCENDING)])
        db.buyer_requirements.create_index([("category", ASCENDING)])
        db.buyer_requirements.create_index([("status", ASCENDING)])
        
        # Quotations
        db.quotations.create_index([("requirement_id", ASCENDING)])
        db.quotations.create_index([("seller_id", ASCENDING)])
        db.quotations.create_index([("buyer_id", ASCENDING)])
        db.quotations.create_index([("status", ASCENDING)])
        
        # Orders
        db.orders.create_index([("order_number", ASCENDING)], unique=True)
        db.orders.create_index([("buyer_id", ASCENDING)])
        db.orders.create_index([("seller_id", ASCENDING)])
        db.orders.create_index([("status", ASCENDING)])
        
        # Messaging & Notifications
        db.conversations.create_index([("participants", ASCENDING)])
        db.messages.create_index([("conversation_id", ASCENDING), ("created_at", ASCENDING)])
        db.notifications.create_index([("user_id", ASCENDING), ("read", ASCENDING)])
        
        # Reviews & Disputes
        db.reviews.create_index([("order_id", ASCENDING)], unique=True)
        db.reviews.create_index([("seller_id", ASCENDING)])
        db.disputes.create_index([("order_id", ASCENDING)])
        
        # Audit Logs
        db.audit_logs.create_index([("user_id", ASCENDING), ("timestamp", DESCENDING)])
        db.audit_logs.create_index([("action", ASCENDING)])
        
        logger.info("MongoDB indexes verified successfully.")
    except Exception as e:
        logger.warning(f"Note on index creation: {e}")

def log_audit(user_id, action, resource_type, resource_id, details=None, ip_address=None):
    from datetime import datetime, timezone
    try:
        db = get_db()
        entry = {
            "user_id": str(user_id) if user_id else "system",
            "action": action,
            "resource_type": resource_type,
            "resource_id": str(resource_id) if resource_id else None,
            "details": details or {},
            "ip_address": ip_address,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        db.audit_logs.insert_one(entry)
    except Exception as err:
        logger.error(f"Audit log error: {err}")
