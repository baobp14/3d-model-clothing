from pathlib import Path

from fastapi import Request
from sqlalchemy import create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from .config import ROOT


def make_engine(url):
    if url.startswith('postgres://'):
        url = url.replace('postgres://', 'postgresql+psycopg://', 1)
    elif url.startswith('postgresql://'):
        url = url.replace('postgresql://', 'postgresql+psycopg://', 1)
    options = {'pool_pre_ping': True, 'hide_parameters': True}
    if url.startswith('sqlite'):
        parsed = make_url(url)
        if parsed.database and parsed.database != ':memory:' and not Path(parsed.database).is_absolute():
            url = parsed.set(database=(ROOT / parsed.database).resolve().as_posix()).render_as_string(hide_password=False)
        options['connect_args'] = {'check_same_thread': False, 'timeout': 30}
        if ':memory:' in url:
            options['poolclass'] = StaticPool
    else:
        options['connect_args'] = {'connect_timeout': 10}
    engine = create_engine(url, **options)
    if engine.dialect.name == 'sqlite':
        @event.listens_for(engine, 'connect')
        def sqlite_connect(connection, _):
            from .search import normalize
            connection.create_function('nb_normalize', 1, lambda value: normalize(str(value or '')), deterministic=True)
            connection.isolation_level = None
            connection.execute('PRAGMA foreign_keys=ON')

        @event.listens_for(engine, 'begin')
        def sqlite_begin(connection):
            # SQLite has no SELECT FOR UPDATE. Serialize local transactions instead.
            connection.exec_driver_sql('BEGIN IMMEDIATE')
    return engine


def get_db(request: Request):
    with Session(request.app.state.engine) as session:
        yield session
