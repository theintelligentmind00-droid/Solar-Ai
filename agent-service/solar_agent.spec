# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for Solar AI OS agent service
# Build with: pyinstaller solar_agent.spec --distpath ../ui/src-tauri/binaries

import sys
from pathlib import Path

block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=[str(Path('.').resolve())],
    binaries=[],
    datas=[
        ('db', 'db'),
        ('memory', 'memory'),
        ('middleware', 'middleware'),
        ('routes', 'routes'),
        ('skills', 'skills'),
    ],
    hiddenimports=[
        # uvicorn
        'uvicorn',
        'uvicorn.main',
        'uvicorn.config',
        'uvicorn.server',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'uvicorn.lifespan.off',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.http.h11_impl',
        'uvicorn.protocols.http.httptools_impl',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.protocols.websockets.wsproto_impl',
        'uvicorn.protocols.websockets.websockets_impl',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.loops.asyncio',
        'uvicorn.loops.uvloop',
        'uvicorn.logging',
        'uvicorn.middleware',
        'uvicorn.middleware.asgi2',
        'uvicorn.middleware.message_logger',
        'uvicorn.middleware.proxy_headers',
        'uvicorn.middleware.wsgi',
        # fastapi / starlette
        'fastapi',
        'fastapi.middleware',
        'fastapi.middleware.cors',
        'starlette',
        'starlette.middleware',
        'starlette.middleware.cors',
        'starlette.routing',
        'starlette.responses',
        'starlette.requests',
        'starlette.background',
        'starlette.datastructures',
        # aiosqlite / sqlite
        'aiosqlite',
        'sqlite3',
        # anthropic
        'anthropic',
        'anthropic._client',
        'anthropic.types',
        # dotenv
        'dotenv',
        'dotenv.main',
        # google api (gmail integration)
        'google',
        'google.auth',
        'google.auth.transport',
        'google.auth.transport.requests',
        'google.oauth2',
        'google.oauth2.credentials',
        'google_auth_oauthlib',
        'google_auth_oauthlib.flow',
        'googleapiclient',
        'googleapiclient.discovery',
        'googleapiclient.errors',
        # apscheduler
        'apscheduler',
        'apscheduler.schedulers',
        'apscheduler.schedulers.asyncio',
        'apscheduler.schedulers.base',
        'apscheduler.executors',
        'apscheduler.executors.asyncio',
        'apscheduler.executors.base',
        'apscheduler.jobstores',
        'apscheduler.jobstores.base',
        'apscheduler.jobstores.memory',
        'apscheduler.triggers',
        'apscheduler.triggers.cron',
        'apscheduler.triggers.interval',
        'apscheduler.triggers.date',
        'apscheduler.events',
        'apscheduler.job',
        'apscheduler.util',
        # keyring
        'keyring',
        'keyring.backends',
        'keyring.backends.Windows',
        # httpx
        'httpx',
        'httpx._client',
        # h11
        'h11',
        # encoding
        'anyio',
        'anyio._backends._asyncio',
        'sniffio',
        'click',
        # pydantic
        'pydantic',
        'pydantic.v1',
        # httpcore (required by httpx)
        'httpcore',
        'httpcore._async',
        'httpcore._sync',
        # certificates
        'certifi',
        # google auth extras
        'google.auth.exceptions',
        'google.auth.credentials',
        'googleapiclient.http',
        'googleapiclient._auth',
        # keyring fallback backend
        'keyring.backends.fail',
        # timezone
        'tzlocal',
        'tzdata',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'pytest',
        'ruff',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='solar-agent',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
