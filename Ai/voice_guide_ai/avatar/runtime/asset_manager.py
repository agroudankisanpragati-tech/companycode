"""
Avatar Runtime — Asset Manager.

Resolves asset paths, loads files from disk, serves bytes through
the cache, and falls back to the neutral avatar on any failure.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from config.logger import get_logger, log_performance
from config.paths import PATHS
from avatar.runtime.avatar_cache import AvatarCache

_log = get_logger("avatar.asset_manager")

_FALLBACK_EXPRESSION = "neutral"
_PREFERRED_FORMAT    = "webp"
_FALLBACK_FORMAT     = "png"


@dataclass
class AssetInfo:
    """Resolved asset metadata."""

    key:       str
    path:      Path
    exists:    bool
    format:    str
    size_bytes: int = 0


class AssetManager:
    """
    Manages all avatar asset resolution and loading.

    Responsibilities
    ----------------
    * Resolve expression / animation / icon asset paths
    * Load assets from disk into the cache
    * Serve cached bytes
    * Fall back to neutral expression on any missing asset
    * Log every load operation
    """

    def __init__(self, cache: Optional[AvatarCache] = None) -> None:
        self._cache = cache or AvatarCache()
        self._root  = PATHS.root
        self._asset_index: dict = {}
        self._avatar_config: dict = {}
        self._loaded = False

    # ── Initialisation ────────────────────────────────────────────────────────

    def load_index(self) -> None:
        """Load asset_index.json and avatar.json config into memory."""
        index_path  = self._root / "avatar" / "metadata" / "assets.json"
        config_path = self._root / "avatar" / "config" / "avatar.json"

        for path, attr in [(index_path, "_asset_index"), (config_path, "_avatar_config")]:
            if path.exists():
                try:
                    with open(path, encoding="utf-8-sig") as fh:
                        setattr(self, attr, json.load(fh))
                    _log.debug("Loaded %s", path.name)
                except Exception as exc:
                    _log.warning("Could not load %s: %s", path, exc)

        self._loaded = True

    def preload_defaults(self) -> int:
        """Preload expressions listed in avatar.json preload_expressions."""
        if not self._loaded:
            self.load_index()

        preload_list: list[str] = self._avatar_config.get("preload_expressions", [
            "neutral", "smile", "listening", "thinking"
        ])

        loaded = 0
        for expr_id in preload_list:
            data = self.get_expression_bytes(expr_id)
            if data is not None:
                loaded += 1

        _log.info("Preloaded %d default expressions.", loaded)
        return loaded

    # ── Expression assets ─────────────────────────────────────────────────────

    @log_performance("asset_get_expression")
    def get_expression_bytes(
        self,
        expression_id: str,
        fmt: str = _PREFERRED_FORMAT,
    ) -> Optional[bytes]:
        """
        Return bytes for *expression_id* in *fmt* format.

        Falls back to neutral expression if the requested asset is missing.
        """
        key = self._expression_key(expression_id, fmt)

        cached = self._cache.get(key)
        if cached is not None:
            return cached

        path = self._resolve_expression_path(expression_id, fmt)
        if path is None or not path.exists():
            _log.warning("Expression asset missing: %s/%s — falling back to neutral", expression_id, fmt)
            if expression_id != _FALLBACK_EXPRESSION:
                return self.get_expression_bytes(_FALLBACK_EXPRESSION, fmt)
            return None

        return self._load_and_cache(key, path)

    def get_expression_path(
        self,
        expression_id: str,
        fmt: str = _PREFERRED_FORMAT,
    ) -> Optional[Path]:
        """Return the resolved Path for an expression asset (may not exist)."""
        return self._resolve_expression_path(expression_id, fmt)

    # ── Animation assets ──────────────────────────────────────────────────────

    @log_performance("asset_get_animation_frame")
    def get_animation_frame_bytes(
        self,
        animation_id: str,
        frame_filename: str,
        fmt: str = _PREFERRED_FORMAT,
    ) -> Optional[bytes]:
        """Return bytes for a single animation frame."""
        key = f"anim:{animation_id}:{frame_filename}"

        cached = self._cache.get(key)
        if cached is not None:
            return cached

        path = self._resolve_animation_frame_path(animation_id, frame_filename)
        if path is None or not path.exists():
            _log.warning("Animation frame missing: %s/%s", animation_id, frame_filename)
            return self.get_expression_bytes(_FALLBACK_EXPRESSION, fmt)

        return self._load_and_cache(key, path)

    def get_animation_dir(self, animation_id: str) -> Optional[Path]:
        """Return the directory containing frames for *animation_id*."""
        index = self._asset_index.get("animations", {})
        rel = index.get(animation_id)
        if rel:
            return self._root / rel
        return self._root / "avatar" / "animations" / animation_id

    # ── Icon assets ───────────────────────────────────────────────────────────

    def get_icon_bytes(self, platform: str, filename: str) -> Optional[bytes]:
        """Return bytes for an icon asset."""
        key = f"icon:{platform}:{filename}"
        cached = self._cache.get(key)
        if cached is not None:
            return cached

        path = self._root / "avatar" / "icons" / platform / filename
        if not path.exists():
            _log.warning("Icon not found: %s/%s", platform, filename)
            return None

        return self._load_and_cache(key, path)

    # ── Asset info ────────────────────────────────────────────────────────────

    def asset_info(self, expression_id: str, fmt: str = _PREFERRED_FORMAT) -> AssetInfo:
        """Return AssetInfo for an expression asset."""
        path = self._resolve_expression_path(expression_id, fmt)
        if path is None:
            return AssetInfo(
                key=self._expression_key(expression_id, fmt),
                path=Path(),
                exists=False,
                format=fmt,
            )
        return AssetInfo(
            key=self._expression_key(expression_id, fmt),
            path=path,
            exists=path.exists(),
            format=fmt,
            size_bytes=path.stat().st_size if path.exists() else 0,
        )

    def cache_stats(self) -> dict:
        return self._cache.stats()

    # ── Internal ──────────────────────────────────────────────────────────────

    def _expression_key(self, expression_id: str, fmt: str) -> str:
        return f"expr:{expression_id}:{fmt}"

    def _resolve_expression_path(self, expression_id: str, fmt: str) -> Optional[Path]:
        index = self._asset_index.get("expressions", {})
        entry = index.get(expression_id, {})
        rel = entry.get(fmt) or entry.get(_FALLBACK_FORMAT)
        if rel:
            return self._root / rel
        # Fallback: construct conventional path
        return self._root / "avatar" / "expressions" / expression_id / f"{expression_id}.{fmt}"

    def _resolve_animation_frame_path(
        self, animation_id: str, frame_filename: str
    ) -> Optional[Path]:
        anim_dir = self.get_animation_dir(animation_id)
        if anim_dir:
            return anim_dir / frame_filename
        return None

    def _load_and_cache(self, key: str, path: Path) -> Optional[bytes]:
        try:
            data = path.read_bytes()
            self._cache.put(key, data, str(path))
            _log.debug("Loaded asset: %s (%.1f KB)", path.name, len(data) / 1024)
            return data
        except OSError as exc:
            _log.error("Failed to load asset %s: %s", path, exc)
            return None
