import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / '.env')


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv('DATABASE_URL', f'sqlite:///{(ROOT / "shop.db").as_posix()}')
    supabase_url: str = os.getenv('SUPABASE_URL', '').rstrip('/')
    supabase_anon_key: str = os.getenv('SUPABASE_ANON_KEY', '')
    cors_origins: tuple[str, ...] = tuple(
        value.strip() for value in os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',') if value.strip()
    )
