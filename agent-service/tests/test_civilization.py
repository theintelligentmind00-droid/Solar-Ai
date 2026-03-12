"""Tests for the /civilization API endpoint."""

import pytest
from fastapi.testclient import TestClient

import db.schema as schema_mod
import routes.civilization as civ_mod
from db.schema import init_db


@pytest.fixture
async def client(use_temp_db):
    """Return a test client with a fresh DB."""
    civ_mod.DB_PATH = use_temp_db
    await init_db(db_path=use_temp_db)

    from main import app
    with TestClient(app) as c:
        yield c

    civ_mod.DB_PATH = schema_mod.DB_PATH


def _create_planet(client: TestClient, name: str = "Test Planet") -> str:
    """Helper: create a planet and return its id."""
    resp = client.post("/planets", json={"name": name})
    assert resp.status_code == 201
    return resp.json()["id"]


def test_civilization_for_new_planet(client):
    """A fresh planet should return dormant / outpost defaults."""
    planet_id = _create_planet(client)
    resp = client.get(f"/civilization/{planet_id}")
    assert resp.status_code == 200

    data = resp.json()
    assert data["planet_id"] == planet_id
    assert data["activity_level"] == "dormant"
    assert data["civ_stage"] == "outpost"
    assert data["msg_count_7d"] == 0
    assert data["msg_count_24h"] == 0
    assert data["task_counts"] == {"todo": 0, "doing": 0, "done": 0}
    assert data["overdue_count"] == 0
    assert data["memory_count"] == 0
    assert data["milestones"] == []
    assert data["settlements"] == []
    assert 0 <= data["health_score"] <= 1
    assert 0 <= data["activity_score"] <= 1


def test_civilization_nonexistent_planet(client):
    """Querying a non-existent planet should still return data (all zeros)."""
    resp = client.get("/civilization/does-not-exist")
    assert resp.status_code == 200
    data = resp.json()
    assert data["planet_id"] == "does-not-exist"
    assert data["activity_level"] == "dormant"
    assert data["msg_count_7d"] == 0


def test_civilization_health_score_defaults_to_half(client):
    """With no tasks, health_score should default to 0.5."""
    planet_id = _create_planet(client)
    resp = client.get(f"/civilization/{planet_id}")
    data = resp.json()
    assert data["health_score"] == 0.5


def test_civilization_prosperity_steady_at_default(client):
    """With default 0.5 health, prosperity should be 'steady'."""
    planet_id = _create_planet(client)
    resp = client.get(f"/civilization/{planet_id}")
    data = resp.json()
    assert data["prosperity"] == "steady"


def test_parse_created_at_handles_none():
    """_parse_created_at should return 0 for None."""
    from routes.civilization import _parse_created_at
    assert _parse_created_at(None) == 0


def test_parse_created_at_handles_invalid_string():
    """_parse_created_at should return 0 for garbage input."""
    from routes.civilization import _parse_created_at
    assert _parse_created_at("not-a-date") == 0


def test_parse_created_at_handles_iso_format():
    """_parse_created_at should return a non-negative integer for valid ISO."""
    from routes.civilization import _parse_created_at
    result = _parse_created_at("2025-01-01T00:00:00Z")
    assert isinstance(result, int)
    assert result >= 0
