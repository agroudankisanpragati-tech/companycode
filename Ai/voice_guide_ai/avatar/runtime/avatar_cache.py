"""
Avatar Runtime — Asset Cache.

Load-once, reuse-everywhere cache for avatar assets.
Uses an LRU strategy with a configurable max-entry cap.
All assets are stored as raw bytes to remain format-agnostic.
"""

from __future__ import annotations

import time
from collections import OrderedDict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from config.logger import get_logger

_log = get_logger("avatar.cache")

_DEFAULT_MAX_ENTRIES: int = 256
_DEFAULT_MAX_BYTES:   int = 64 * 1024 * 1024   # 64 MB


@dataclass
class CacheEntry:
    """A single cached asset."""

    key:        str
    data:       bytes
    path:       str
    size_bytes: int
    loaded_at:  float = field(default_factory=time.monotonic)
    hits:       int = 0

    def touch(self) -> None:
        self.hits += 1


class AvatarCache:
    """
    LRU asset cache for avatar images and animation frames.

    Keys are relative asset paths (e.g. ``"avatar/expressions/neutral/neutral.webp"``).
    """

    def __init__(
        self,
        max_entries: int = _DEFAULT_MAX_ENTRIES,
        max_bytes: int = _DEFAULT_MAX_BYTES,
    ) -> None:
        self._max_entries = max_entries
        self._max_bytes   = max_bytes
        self._store: OrderedDict[str, CacheEntry] = OrderedDict()
        self._total_bytes: int = 0
        self._hits:   int = 0
        self._misses: int = 0

    def get(self, key: str) -> Optional[bytes]:
        """Return cached bytes for *key*, or None on miss."""
        entry = self._store.get(key)
        if entry is None:
            self._misses += 1
            return None
        self._store.move_to_end(key)
        entry.touch()
        self._hits += 1
        return entry.data

    def put(self, key: str, data: bytes, path: str = "") -> None:
        """Store *data* under *key*, evicting LRU entries if needed."""
        if key in self._store:
            old = self._store.pop(key)
            self._total_bytes -= old.size_bytes
        entry = CacheEntry(key=key, data=data, path=path, size_bytes=len(data))
        self._store[key] = entry
        self._total_bytes += len(data)
        self._evict_if_needed()
        _log.debug("Cached: %s (%.1f KB)", key, len(data) / 1024)

    def has(self, key: str) -> bool:
        return key in self._store

    def remove(self, key: str) -> bool:
        entry = self._store.pop(key, None)
        if entry:
            self._total_bytes -= entry.size_bytes
            return True
        return False

    def clear(self) -> None:
        self._store.clear()
        self._total_bytes = 0
        _log.info("Avatar cache cleared.")

    def preload(self, base_dir: Path, keys: list[str]) -> int:
        """Load a list of asset files into cache. Returns count loaded."""
        loaded = 0
        for key in keys:
            if self.has(key):
                continue
            asset_path = base_dir / key
            if not asset_path.exists():
                _log.debug("Preload skip (not found): %s", asset_path)
                continue
            try:
                data = asset_path.read_bytes()
                self.put(key, data, str(asset_path))
                loaded += 1
            except OSError as exc:
                _log.warning("Preload failed for %s: %s", key, exc)
        _log.info("Preloaded %d assets.", loaded)
        return loaded

    def stats(self) -> dict:
        return {
            "entries":     len(self._store),
            "total_kb":    round(self._total_bytes / 1024, 1),
            "max_entries": self._max_entries,
            "max_mb":      round(self._max_bytes / (1024 * 1024), 1),
            "hits":        self._hits,
            "misses":      self._misses,
            "hit_rate":    round(
                self._hits / max(1, self._hits + self._misses) * 100, 1
            ),
        }

    def _evict_if_needed(self) -> None:
        while (
            len(self._store) > self._max_entries
            or self._total_bytes > self._max_bytes
        ):
            key, entry = self._store.popitem(last=False)
            self._total_bytes -= entry.size_bytes
            _log.debug("Evicted from cache: %s", key)
