"""In-process sliding-window limits. One API process only; use a shared store when scaling out."""
import threading
import time
from collections import deque

from .errors import fail


class RateLimiter:
    def __init__(self, enabled=True, clock=time.monotonic):
        self.enabled = enabled
        self.clock = clock
        self.hits = {}
        self.lock = threading.Lock()

    def hit(self, key, limit, window):
        if not self.enabled:
            return
        now = self.clock()
        with self.lock:
            bucket = self.hits.setdefault(key, deque())
            while bucket and bucket[0] <= now - window:
                bucket.popleft()
            if len(bucket) >= limit:
                fail('NB_RATE_LIMITED', 429)
            bucket.append(now)
            # Keep memory bounded: drop idle keys once the table grows.
            if len(self.hits) > 50000:
                for stale in [k for k, b in self.hits.items() if not b or b[-1] <= now - 3600]:
                    del self.hits[stale]


def client_ip(request):
    # Run uvicorn with --proxy-headers behind a trusted proxy so this is the visitor IP.
    return request.client.host if request.client else 'unknown'
