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
    # Swagger/OpenAPI stay off unless explicitly enabled (local development only).
    enable_docs: bool = os.getenv('ENABLE_API_DOCS', '').lower() in ('1', 'true', 'yes')
    # Verified Supabase users are cached briefly; role changes apply after this many seconds.
    auth_cache_seconds: int = int(os.getenv('AUTH_CACHE_SECONDS', '60'))
    rate_limit_enabled: bool = os.getenv('RATE_LIMIT_ENABLED', 'true').lower() not in ('0', 'false', 'no')
    # Unpaid/unconfirmed orders a customer may hold at once; each one reserves stock.
    max_open_orders: int = int(os.getenv('MAX_OPEN_ORDERS', '5'))
    tconnect_base_url: str = os.getenv('TCONNECT_BASE_URL', '').rstrip('/')
    tconnect_partner_code: str = os.getenv('TCONNECT_PARTNER_CODE', '')
    tconnect_username: str = os.getenv('TCONNECT_USERNAME', '')
    tconnect_password: str = os.getenv('TCONNECT_PASSWORD', '')
    tconnect_client_id: str = os.getenv('TCONNECT_CLIENT_ID', '')
    tconnect_client_secret: str = os.getenv('TCONNECT_CLIENT_SECRET', '')
    tconnect_aes_key: str = os.getenv('TCONNECT_AES_KEY', '')
    tconnect_service_code: str = os.getenv('TCONNECT_SERVICE_CODE', '')
    tconnect_bincode: str = os.getenv('TCONNECT_BINCODE', '')
    tconnect_va: str = os.getenv('TCONNECT_VA', '')

    @property
    def tconnect_ready(self):
        return all((self.tconnect_base_url, self.tconnect_partner_code, self.tconnect_username, self.tconnect_password,
                    self.tconnect_client_id, self.tconnect_client_secret, self.tconnect_aes_key,
                    self.tconnect_service_code, self.tconnect_bincode, self.tconnect_va))
