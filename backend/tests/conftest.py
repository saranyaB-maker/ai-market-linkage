import os
import pytest
from app import create_app
from config import TestingConfig
from db import init_db, get_db
from routes.auth_helpers import create_jwt_token, hash_password
from seed import seed_database

@pytest.fixture(scope="session")
def app():
    app = create_app(TestingConfig)
    with app.app_context():
        # Force mock database for clean automated test isolation
        init_db(app, force_mock=True)
        seed_database(force=True)
    return app

@pytest.fixture(scope="session")
def client(app):
    return app.test_client()

@pytest.fixture(scope="session")
def db(app):
    with app.app_context():
        return get_db()

@pytest.fixture
def admin_headers(db):
    admin = db.users.find_one({"email": "admin@marketlink.local"})
    token = create_jwt_token(str(admin["_id"]), admin["role"], admin["email"])
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

@pytest.fixture
def seller_headers(db):
    seller = db.users.find_one({"email": "seller@marketlink.local"})
    token = create_jwt_token(str(seller["_id"]), seller["role"], seller["email"])
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

@pytest.fixture
def buyer_headers(db):
    buyer = db.users.find_one({"email": "buyer@marketlink.local"})
    token = create_jwt_token(str(buyer["_id"]), buyer["role"], buyer["email"])
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
