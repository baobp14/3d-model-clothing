"""TConnect Payment Open API: dynamic QR creation and payment status lookup.

Docs: https://docs.tconnect.vn/docs/intro/ — every request body (except Get Services)
is AES-256-CBC encrypted with a random IV prepended, hex-encoded in a `data` field.
"""
import binascii
import json
import os
import threading
import time

import httpx
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

from .errors import fail

# The TConnect WAF rejects default HTTP client user agents with 403.
USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'


def encrypt(plain, key):
    iv = os.urandom(16)
    padder = padding.PKCS7(128).padder()
    data = padder.update(plain.encode()) + padder.finalize()
    encryptor = Cipher(algorithms.AES(key), modes.CBC(iv)).encryptor()
    return binascii.hexlify(iv + encryptor.update(data) + encryptor.finalize()).decode()


def decrypt(encrypted, key):
    raw = binascii.unhexlify(encrypted)
    if len(raw) < 32 or len(raw) % 16:
        raise ValueError('invalid ciphertext')
    decryptor = Cipher(algorithms.AES(key), modes.CBC(raw[:16])).decryptor()
    padded = decryptor.update(raw[16:]) + decryptor.finalize()
    unpadder = padding.PKCS7(128).unpadder()
    return (unpadder.update(padded) + unpadder.finalize()).decode()


class TConnect:
    def __init__(self, settings, http=None):
        self.settings = settings
        self.key = bytes.fromhex(settings.tconnect_aes_key) if settings.tconnect_aes_key else b''
        self.http = http or httpx.Client(timeout=15, follow_redirects=False)
        self._token = None
        self._expires = 0.0
        self._lock = threading.Lock()

    def close(self):
        self.http.close()

    def _post(self, path, payload, token=True, service=False, missing=None):
        headers = {'Partner-Code': self.settings.tconnect_partner_code, 'Content-Type': 'application/json',
                   'User-Agent': USER_AGENT}
        if token:
            headers['Authorization'] = f'Bearer {self.token()}'
        if service:
            headers['x-service-code'] = self.settings.tconnect_service_code
        try:
            response = self.http.post(self.settings.tconnect_base_url + path, headers=headers,
                                      json={'data': encrypt(json.dumps(payload), self.key)})
        except httpx.HTTPError:
            fail('NB_PAYMENT_GATEWAY_UNAVAILABLE', 503)
        if response.status_code == 401 and token:
            # Token revoked early: force one fresh login on the next call.
            self._expires = 0
        if response.status_code == 404 and missing is not None:
            return missing
        if response.status_code != 200:
            fail('NB_PAYMENT_GATEWAY_UNAVAILABLE', 503)
        try:
            body = response.json()
        except ValueError:
            fail('NB_PAYMENT_GATEWAY_UNAVAILABLE', 503)
        # Some responses wrap an encrypted `data`; others are plain JSON.
        if isinstance(body, dict) and isinstance(body.get('data'), str) and set(body) <= {'data', 'code', 'message'}:
            try:
                body = json.loads(decrypt(body['data'], self.key))
            except (ValueError, binascii.Error):
                pass
        return body

    def token(self):
        with self._lock:
            if self._token and time.monotonic() < self._expires:
                return self._token
            s = self.settings
            body = self._post('/openapi/v1/auth/login', {'username': s.tconnect_username, 'password': s.tconnect_password,
                                                         'client_id': s.tconnect_client_id, 'client_secret': s.tconnect_client_secret}, token=False)
            if not isinstance(body, dict) or not body.get('access_token'):
                fail('NB_PAYMENT_GATEWAY_UNAVAILABLE', 503)
            self._token = body['access_token']
            # Renew a minute early so a request never carries an expiring token.
            self._expires = time.monotonic() + max(30, int(body.get('expires_in') or 300) - 60)
            return self._token

    def create_qr(self, reference, amount, request_id):
        body = self._post('/openapi/v1/transaction/qr/generate', {
            'req_id': request_id, 'order_id': reference, 'va': self.settings.tconnect_va,
            'bincode': self.settings.tconnect_bincode, 'amount': amount}, service=True)
        if not isinstance(body, dict) or not body.get('qr_content') or not body.get('image_png_base64'):
            fail('NB_PAYMENT_GATEWAY_UNAVAILABLE', 503)
        return body['qr_content'], body['image_png_base64']

    def paid_amount(self, reference):
        """Sum of SUCCESS transactions for the reference, plus the first bank reference."""
        body = self._post('/openapi/v1/transaction/qr/order/status', {'order_id': reference, 'acc_no': self.settings.tconnect_va}, missing={})
        data = body.get('tx_data') if isinstance(body, dict) else None
        if not isinstance(data, dict):
            return 0, ''
        successful = [row for row in data.get('transactions') or [] if isinstance(row, dict) and row.get('status') == 'SUCCESS']
        total = sum(int(row.get('amount') or 0) for row in successful)
        return total, str(successful[0].get('trn_ref_no') or '') if successful else ''
