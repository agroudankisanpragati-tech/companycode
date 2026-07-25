"""
Voice Guide AI — Cache Manager (utils layer).

Thread-safe in-memory cache with:
  * TTL (time-to-live) per entry
  * LRU eviction when capacity is reached
  * Typed get/set/delete/clear
  * Hit/miss statistics
  * Namespace support (dialogue, translation, audio, config)

Used by DialogueSelector, LanguageManager, and AudioManager to avoid
repeated disk reads during a session.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from typing import Any, Optional

from config.logger import get_logger

_log = get_logger("utils.cache_manager")

_DEFAULT_TTL_S = 300        # 5 minutes
_DEFAULT_CAPACITY = 512     # max entries per namespace


@dataclass
class _CacheEntry:
    value: Any
    expires_at: float       # monotonic time
    last_accessed: float = field(default_factory=time.monotonic)
    hits: int = 0

    def is_expired(self) -> bool:
        return time.monotonic() > self.expires_at

    def touch(self) -> None:
        self.last_accessed = time.monotonic()
        self.hits += 1


class CacheManager:
    """
    Thread-safe TTL + LRU in-memory cache.

    Parameters
    ----------
    ttl_seconds : default time-to-live for entries (seconds)
    capacity    : maximum number of entries before LRU eviction
    """

    def __init__(
        self,
        ttl_seconds: float = _DEFAULT_TTL_S,
        capacity: int = _DEFAULT_CAPACITY,
    ) -> None:
        self._ttl = ttl_seconds
        self._capacity = capacity
        self._store: dict[str, _CacheEntry] = {}
        self._lock = threading.Lock()
        self._hits = 0
        self._misses = 0

    # ── Core operations ───────────────────────────────────────────────────────

    def get(self, key: str, default: Any = None) -> Any:
        """
        Return the cached value for *key*, or *default* if missing/expired.
        """
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                self._misses += 1
                return default
            if entry.is_expired():
                del self._store[key]
                self._misses += 1
                return default
            entry.touch()
            self._hits += 1
            return entry.value

    def set(
        self,
        key: str,
        value: Any,
        ttl_seconds: Optional[float] = None,
    ) -> None:
        """
        Store *value* under *key* with optional TTL override.
        """
        ttl = ttl_seconds if ttl_seconds is not None else self._ttl
        expires_at = time.monotonic() + ttl

        with self._lock:
            self._store[key] = _CacheEntry(value=value, expires_at=expires_at)
            self._evict_if_needed()

    def delete(self, key: str) -> bool:
        """Remove *key* from the cache. Returns True if it existed."""
        with self._lock:
            existed = key in self._store
            self._store.pop(key, None)
            return existed

    def has(self, key: str) -> bool:
        """Return True if *key* exists and has not expired."""
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return False
            if entry.is_expired():
                del self._store[key]
                return False
            return True

    def clear(self) -> None:
        """Remove all entries."""
        with self._lock:
            self._store.clear()
        _log.debug("Cache cleared.")

    def clear_expired(self) -> int:
        """Remove all expired entries. Returns count removed."""
        with self._lock:
            expired_keys = [k for k, e in self._store.items() if e.is_expired()]
            for k in expired_keys:
                del self._store[k]
        if expired_keys:
            _log.debug("Evicted %d expired cache entries.", len(expired_keys))
        return len(expired_keys)

    # ── Namespace helpers ─────────────────────────────────────────────────────

    def get_dialogue(self, page: str, dialogue_type: str) -> Optional[dict]:
        """Get a cached dialogue JSON."""
        return self.get(f"dialogue:{page}:{dialogue_type}")

    def set_dialogue(self, page: str, dialogue_type: str, data: dict) -> None:
        """Cache a dialogue JSON."""
        self.set(f"dialogue:{page}:{dialogue_type}", data)

    def get_translation(self, language: str, page: str) -> Optional[dict]:
        """Get a cached translation dict."""
        return self.get(f"translation:{language}:{page}")

    def set_translation(self, language: str, page: str, data: dict) -> None:
        """Cache a translation dict."""
        self.set(f"translation:{language}:{page}", data)

    def get_audio_meta(self, language: str, module: str, dialogue_id: str) -> Optional[dict]:
        """Get cached audio metadata."""
        return self.get(f"audio:{language}:{module}:{dialogue_id}")

    def set_audio_meta(
        self, language: str, module: str, dialogue_id: str, meta: dict
    ) -> None:
        """Cache audio metadata."""
        self.set(f"audio:{language}:{module}:{dialogue_id}", meta)

    def invalidate_language(self, language: str) -> int:
        """Remove all cached entries for *language*. Returns count removed."""
        prefix = f"translation:{language}:"
        with self._lock:
            keys = [k for k in self._store if k.startswith(prefix)]
            for k in keys:
                del self._store[k]
        _log.debug("Invalidated %d cache entries for language=%s", len(keys), language)
        return len(keys)

    def invalidate_page(self, page: str) -> int:
        """Remove all cached entries for *page*. Returns count removed."""
        with self._lock:
            keys = [
                k for k in self._store
                if f":{page}:" in k or k.endswith(f":{page}")
            ]
            for k in keys:
                del self._store[k]
        _log.debug("Invalidated %d cache entries for page=%s", len(keys), page)
        return len(keys)

    # ── Statistics ────────────────────────────────────────────────────────────

    def stats(self) -> dict[str, Any]:
        """Return cache statistics."""
        with self._lock:
            total = self._hits + self._misses
            hit_rate = (self._hits / total * 100) if total > 0 else 0.0
            return {
                "size": len(self._store),
                "capacity": self._capacity,
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate_pct": round(hit_rate, 1),
                "ttl_seconds": self._ttl,
            }

    # ── Internal ──────────────────────────────────────────────────────────────

    def _evict_if_needed(self) -> None:
        """Evict LRU entries when capacity is exceeded. Must hold lock."""
        if len(self._store) <= self._capacity:
            return
        # Sort by last_accessed ascending (oldest first)
        sorted_keys = sorted(
            self._store.keys(),
            key=lambda k: self._store[k].last_accessed,
        )
        evict_count = len(self._store) - self._capacity
        for key in sorted_keys[:evict_count]:
            del self._store[key]
        _log.debug("LRU eviction: removed %d entries.", evict_count)
