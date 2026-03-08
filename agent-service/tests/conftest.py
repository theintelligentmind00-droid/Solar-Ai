"""Shared pytest fixtures for Solar AI OS agent service tests."""

import pytest


# Point all modules at a temp DB before any imports touch the real DB path
@pytest.fixture(autouse=True)
def use_temp_db(tmp_path, monkeypatch):
    """Redirect DB_PATH to a fresh temp file for every test."""
    db_file = str(tmp_path / "test_solar.db")
    monkeypatch.setenv("SOLAR_DB_PATH", db_file)
    # Patch the module-level constant used by all db/memory/skills modules
    import db.schema as schema_mod
    import memory.memory as mem_mod
    import skills.permissions as perm_mod
    monkeypatch.setattr(schema_mod, "DB_PATH", db_file)
    monkeypatch.setattr(mem_mod, "DB_PATH", db_file)
    monkeypatch.setattr(perm_mod, "DB_PATH", db_file)
    return db_file
