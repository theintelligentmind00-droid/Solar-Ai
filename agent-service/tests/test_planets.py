"""Tests for the /planets API endpoints."""

import pytest
from fastapi.testclient import TestClient

import db.schema as schema_mod
import routes.planets as planets_mod
from db.schema import init_db


@pytest.fixture
async def client(use_temp_db):
    """Return a test client with a fresh DB."""
    # Patch DB_PATH inside the planets router module too
    planets_mod.DB_PATH = use_temp_db
    await init_db(db_path=use_temp_db)

    from main import app
    with TestClient(app) as c:
        yield c

    # Restore
    planets_mod.DB_PATH = schema_mod.DB_PATH


def test_list_planets_empty(client):
    response = client.get("/planets")
    assert response.status_code == 200
    assert response.json() == []


def test_create_planet(client):
    response = client.post("/planets", json={"name": "Research Project"})
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Research Project"
    assert "id" in data


def test_list_planets_after_create(client):
    client.post("/planets", json={"name": "My First Planet"})
    response = client.get("/planets")
    assert response.status_code == 200
    planets = response.json()
    assert len(planets) == 1
    assert planets[0]["name"] == "My First Planet"


def test_get_planet_by_id(client):
    created = client.post("/planets", json={"name": "Detail Test"}).json()
    response = client.get(f"/planets/{created['id']}")
    assert response.status_code == 200
    assert response.json()["name"] == "Detail Test"


def test_get_planet_not_found(client):
    response = client.get("/planets/does-not-exist")
    assert response.status_code == 404


def test_delete_planet(client):
    created = client.post("/planets", json={"name": "To Delete"}).json()
    response = client.delete(f"/planets/{created['id']}")
    assert response.status_code == 204
    # Confirm it's gone
    assert client.get(f"/planets/{created['id']}").status_code == 404


def test_delete_planet_not_found(client):
    response = client.delete("/planets/ghost-planet")
    assert response.status_code == 404
