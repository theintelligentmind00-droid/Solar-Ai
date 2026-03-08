"""Tests for the permission / skill system."""


import aiosqlite

from db.schema import init_db
from skills.permissions import check_permission, log_action, set_permission


async def test_permissions_disabled_by_default(use_temp_db):
    await init_db(db_path=use_temp_db)
    assert await check_permission("gmail", db_path=use_temp_db) is False
    assert await check_permission("calendar", db_path=use_temp_db) is False
    assert await check_permission("files", db_path=use_temp_db) is False


async def test_enable_permission(use_temp_db):
    await init_db(db_path=use_temp_db)
    await set_permission("gmail", enabled=True, db_path=use_temp_db)
    assert await check_permission("gmail", db_path=use_temp_db) is True


async def test_disable_permission(use_temp_db):
    await init_db(db_path=use_temp_db)
    await set_permission("gmail", enabled=True, db_path=use_temp_db)
    await set_permission("gmail", enabled=False, db_path=use_temp_db)
    assert await check_permission("gmail", db_path=use_temp_db) is False


async def test_log_action_writes_to_db(use_temp_db):
    await init_db(db_path=use_temp_db)
    await log_action("gmail", "Read 5 emails from inbox", success=True, db_path=use_temp_db)

    async with aiosqlite.connect(use_temp_db) as db:
        async with db.execute("SELECT skill, summary, success FROM logs") as cursor:
            rows = await cursor.fetchall()

    assert len(rows) == 1
    assert rows[0] == ("gmail", "Read 5 emails from inbox", 1)
