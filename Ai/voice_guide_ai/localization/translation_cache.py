"""
Translation Cache — thread-safe TTL + LRU in-memory store.

Namespace layout
----------------
  translation:{lang}:{module}   → dict[str, str]   (full module dict)
  entry:{lang}:{module}:{key}   → str               (single resolved string)

Eviction
--------
  * Expired entries are removed lazily on access and eagerly by clear_expired().
  * When max_size is reached the oldest-accessed entry is evicted (LRU).
"""

from __future__ import annotations

import threading
import time
from collections import OrderedDict
from dataclasses import dataclass, field
from typing import Any, Optional

from config.logger import get_logger

_log = get_logger("localization.translation_cache")

_DEFAULT_TTL: float = 1800.0   # 30 minutes
_DEFAULT_MAX: int   = 512


@dataclass
class _CacheEntry:
    value: Any
    expires_at: float
    last_accessed: float = field(default_factory=time.monotonic)

    def is_expired(self) -> bool:
        return time.monotonic() > self.expires_at

    def touch(self) -> None:
        self.last_accessed = time.monotonic()


class TranslationCache:
    """
    Thread-safe TTL + LRU cache for translation data.

    Parameters
    ----------
    ttl_seconds : time-to-live per entry in seconds
    max_size    : maximum number of entries before LRU eviction
    """

    def __init__(
        self,
        ttl_seconds: float = _DEFAULT_TTL,
        max_size: int = _DEFAULT_MAX,
    ) -> None:
        self._ttl = ttl_seconds
        self._max = max_size
        self._store: OrderedDict[str, _CacheEntry] = OrderedDict()
        self._lock = threading.Lock()
        self._hits = 0
        self._misses = 0

    # ── Public API ─────────────────────────────────────────────────────────────

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                self._misses += 1
                return None
            if entry.is_expired():
                del self._store[key]
                self._misses += 1
                return None
            entry.touch()
            self._store.move_to_end(key)
            self._hits += 1
            return entry.value

    def set(self, key: str, value: Any, ttl: Optional[float] = None) -> None:
        effective_ttl = ttl if ttl is not None else self._ttl
        expires_at = time.monotonic() + effective_ttl
        with self._lock:
            if key in self._store:
                self._store.move_to_end(key)
            self._store[key] = _CacheEntry(value=value, expires_at=expires_at)
            self._evict_if_needed()

    def delete(self, key: str) -> bool:
        with self._lock:
            if key in self._store:
                del self._store[key]
                return True
            return False

    def invalidate_prefix(self, prefix: str) -> int:
        """Remove all entries whose key starts with *prefix*. Returns count removed."""
        with self._lock:
            keys = [k for k in self._store if k.startswith(prefix)]
            for k in keys:
                del self._store[k]
            return len(keys)

    def clear_expired(self) -> int:
        """Remove all expired entries. Returns count removed."""
        now = time.monotonic()
        with self._lock:
            expired = [k for k, e in self._store.items() if now > e.expires_at]
            for k in expired:
                del self._store[k]
            return len(expired)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()
            self._hits = 0
            self._misses = 0

    def stats(self) -> dict[str, Any]:
        with self._lock:
            total = self._hits + self._misses
            return {
                "size": len(self._store),
                "max_size": self._max,
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate": round(self._hits / total, 4) if total else 0.0,
                "ttl_seconds": self._ttl,
            }

    # ── Namespace helpers ──────────────────────────────────────────────────────

    @staticmethod
    def module_key(language: str, module: str) -> str:
        return f"translation:{language}:{module}"

    @staticmethod
    def entry_key(language: str, module: str, dialogue_id: str) -> str:
        return f"entry:{language}:{module}:{dialogue_id}"

    def get_module(self, language: str, module: str) -> Optional[dict[str, str]]:
        return self.get(self.module_key(language, module))

    def set_module(self, language: str, module: str, data: dict[str, str]) -> None:
        self.set(self.module_key(language, module), data)

    def invalidate_language(self, language: str) -> int:
        removed = self.invalidate_prefix(f"translation:{language}:")
        removed += self.invalidate_prefix(f"entry:{language}:")
        _log.debug("Cache invalidated for language=%s (%d entries)", language, removed)
        return removed

    def invalidate_module(self, language: str, module: str) -> int:
        removed = self.delete(self.module_key(language, module))
        removed += self.invalidate_prefix(f"entry:{language}:{module}:")
        return int(removed)

    # ── Internal ───────────────────────────────────────────────────────────────

    def _evict_if_needed(self) -> None:
        """Evict LRU entry when over capacity. Must be called under lock."""
        while len(self._store) > self._max:
            self._store.popitem(last=False)
