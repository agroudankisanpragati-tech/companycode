"""
Avatar Runtime — Avatar Loader.

Responsible for the one-time initialisation of all avatar subsystems:
loading configs, preloading default assets, and validating structure.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

from config.logger import get_logger, log_performance
from config.paths import PATHS
from avatar.runtime.asset_manager import AssetManager
from avatar.runtime.animation_manager import AnimationManager
from avatar.runtime.expression_manager import ExpressionManager
from avatar.runtime.lip_sync_manager import LipSyncManager
from avatar.runtime.position_manager import PositionManager
from avatar.runtime.theme_manager import ThemeManager

_log = get_logger("avatar.loader")


@dataclass
class LoadResult:
    """Result of the avatar load operation."""

    success:          bool
    avatar_id:        str
    expressions_ok:   bool
    animations_ok:    bool
    lip_sync_ok:      bool
    positions_ok:     bool
    themes_ok:        bool
    assets_preloaded: int
    errors:           list[str]

    def to_dict(self) -> dict[str, Any]:
        return {
            "success":          self.success,
            "avatar_id":        self.avatar_id,
            "expressions_ok":   self.expressions_ok,
            "animations_ok":    self.animations_ok,
            "lip_sync_ok":      self.lip_sync_ok,
            "positions_ok":     self.positions_ok,
            "themes_ok":        self.themes_ok,
            "assets_preloaded": self.assets_preloaded,
            "errors":           self.errors,
        }


class AvatarLoader:
    """
    Orchestrates the one-time loading of all avatar subsystems.

    Designed for lazy initialisation — call ``load()`` once.
    Subsequent calls return the cached result immediately.
    """

    def __init__(
        self,
        asset_manager:      Optional[AssetManager]      = None,
        expression_manager: Optional[ExpressionManager] = None,
        animation_manager:  Optional[AnimationManager]  = None,
        lip_sync_manager:   Optional[LipSyncManager]    = None,
        position_manager:   Optional[PositionManager]   = None,
        theme_manager:      Optional[ThemeManager]      = None,
    ) -> None:
        self._asset_mgr  = asset_manager      or AssetManager()
        self._expr_mgr   = expression_manager or ExpressionManager(self._asset_mgr)
        self._anim_mgr   = animation_manager  or AnimationManager(self._asset_mgr)
        self._lip_mgr    = lip_sync_manager   or LipSyncManager()
        self._pos_mgr    = position_manager   or PositionManager()
        self._theme_mgr  = theme_manager      or ThemeManager()
        self._result: Optional[LoadResult] = None

    # ── Public API ────────────────────────────────────────────────────────────

    @log_performance("avatar_load")
    def load(self) -> LoadResult:
        """
        Load all avatar subsystems.

        Safe to call multiple times — returns cached result after first load.
        Never raises; all errors are captured in LoadResult.errors.
        """
        if self._result is not None:
            return self._result

        errors: list[str] = []
        avatar_id = self._read_avatar_id()

        expr_ok  = self._safe_load(self._expr_mgr.load,  "expressions",  errors)
        anim_ok  = self._safe_load(self._anim_mgr.load,  "animations",   errors)
        lip_ok   = self._safe_load(self._lip_mgr.load,   "lip_sync",     errors)
        pos_ok   = self._safe_load(self._pos_mgr.load,   "positions",    errors)
        theme_ok = self._safe_load(self._theme_mgr.load, "themes",       errors)

        self._asset_mgr.load_index()
        preloaded = 0
        try:
            preloaded = self._asset_mgr.preload_defaults()
        except Exception as exc:
            errors.append(f"asset_preload: {exc}")
            _log.warning("Asset preload failed: %s", exc)

        self._result = LoadResult(
            success=len(errors) == 0,
            avatar_id=avatar_id,
            expressions_ok=expr_ok,
            animations_ok=anim_ok,
            lip_sync_ok=lip_ok,
            positions_ok=pos_ok,
            themes_ok=theme_ok,
            assets_preloaded=preloaded,
            errors=errors,
        )

        _log.info(
            "Avatar loaded: id=%s success=%s preloaded=%d errors=%d",
            avatar_id, self._result.success, preloaded, len(errors),
        )
        return self._result

    def is_loaded(self) -> bool:
        return self._result is not None

    def reload(self) -> LoadResult:
        """Force a full reload, discarding the cached result."""
        self._result = None
        return self.load()

    # ── Accessors ─────────────────────────────────────────────────────────────

    @property
    def asset_manager(self) -> AssetManager:
        return self._asset_mgr

    @property
    def expression_manager(self) -> ExpressionManager:
        return self._expr_mgr

    @property
    def animation_manager(self) -> AnimationManager:
        return self._anim_mgr

    @property
    def lip_sync_manager(self) -> LipSyncManager:
        return self._lip_mgr

    @property
    def position_manager(self) -> PositionManager:
        return self._pos_mgr

    @property
    def theme_manager(self) -> ThemeManager:
        return self._theme_mgr

    # ── Internal ──────────────────────────────────────────────────────────────

    def _read_avatar_id(self) -> str:
        config_path = PATHS.root / "avatar" / "config" / "avatar.json"
        try:
            if config_path.exists():
                with open(config_path, encoding="utf-8-sig") as fh:
                    data = json.load(fh)
                return data.get("avatar_id", "kisan_saathi_v1")
        except Exception:
            pass
        return "kisan_saathi_v1"

    @staticmethod
    def _safe_load(fn, label: str, errors: list[str]) -> bool:
        try:
            fn()
            return True
        except Exception as exc:
            errors.append(f"{label}: {exc}")
            _log.error("Load failed for %s: %s", label, exc)
            return False
