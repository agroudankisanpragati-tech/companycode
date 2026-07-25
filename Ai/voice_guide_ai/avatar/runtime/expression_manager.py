"""
Avatar Runtime — Expression Manager.

Loads expression configuration, tracks the active expression,
applies transitions, and always falls back to neutral on failure.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from config.logger import get_logger
from config.paths import PATHS
from avatar.runtime.asset_manager import AssetManager

_log = get_logger("avatar.expression_manager")

_FALLBACK = "neutral"


@dataclass
class ExpressionConfig:
    """Runtime representation of a single expression."""

    id:                str
    label:             str
    asset_webp:        str
    asset_png:         str
    transition_in_ms:  int
    transition_out_ms: int
    loop:              bool
    priority:          int
    fallback:          Optional[str]
    tags:              list[str] = field(default_factory=list)


class ExpressionManager:
    """
    Manages avatar expressions.

    Responsibilities
    ----------------
    * Load expressions.json config
    * Track current and previous expression
    * Apply expression with transition timing
    * Resolve fallback chain on missing assets
    * Log every expression change
    """

    def __init__(self, asset_manager: Optional[AssetManager] = None) -> None:
        self._asset_manager = asset_manager or AssetManager()
        self._expressions: dict[str, ExpressionConfig] = {}
        self._current: str = _FALLBACK
        self._previous: str = _FALLBACK
        self._default: str = _FALLBACK
        self._loaded = False

    # ── Initialisation ────────────────────────────────────────────────────────

    def load(self) -> None:
        """Load expressions.json from avatar/config/."""
        config_path = PATHS.root / "avatar" / "config" / "expressions.json"
        if not config_path.exists():
            _log.warning("expressions.json not found at %s — using empty config.", config_path)
            return

        try:
            with open(config_path, encoding="utf-8-sig") as fh:
                raw: dict[str, Any] = json.load(fh)

            self._default = raw.get("default", _FALLBACK)
            self._current = self._default

            for expr_id, data in raw.get("expressions", {}).items():
                self._expressions[expr_id] = ExpressionConfig(
                    id=data["id"],
                    label=data.get("label", expr_id),
                    asset_webp=data.get("asset_webp", ""),
                    asset_png=data.get("asset_png", ""),
                    transition_in_ms=data.get("transition_in_ms", 200),
                    transition_out_ms=data.get("transition_out_ms", 200),
                    loop=data.get("loop", False),
                    priority=data.get("priority", 0),
                    fallback=data.get("fallback"),
                    tags=data.get("tags", []),
                )

            self._loaded = True
            _log.info("Loaded %d expressions.", len(self._expressions))

        except Exception as exc:
            _log.error("Failed to load expressions.json: %s", exc)

    # ── Expression control ────────────────────────────────────────────────────

    def set_expression(self, expression_id: str) -> bool:
        """
        Set the active expression.

        Returns True on success, False if fallback was used.
        """
        if not self._loaded:
            self.load()

        resolved = self._resolve(expression_id)
        if resolved is None:
            _log.error("No fallback available for expression '%s'.", expression_id)
            return False

        if resolved != expression_id:
            _log.warning(
                "Expression '%s' not found — using fallback '%s'.", expression_id, resolved
            )

        self._previous = self._current
        self._current  = resolved
        cfg = self._expressions.get(resolved)

        _log.info(
            "Expression: %s → %s (in=%dms out=%dms)",
            self._previous, resolved,
            cfg.transition_in_ms if cfg else 200,
            cfg.transition_out_ms if cfg else 200,
        )
        return resolved == expression_id

    def reset(self) -> None:
        """Reset to the default expression."""
        self.set_expression(self._default)

    # ── Queries ───────────────────────────────────────────────────────────────

    @property
    def current(self) -> str:
        return self._current

    @property
    def previous(self) -> str:
        return self._previous

    def get_config(self, expression_id: str) -> Optional[ExpressionConfig]:
        return self._expressions.get(expression_id)

    def get_current_config(self) -> Optional[ExpressionConfig]:
        return self._expressions.get(self._current)

    def get_current_bytes(self, fmt: str = "webp") -> Optional[bytes]:
        """Return the asset bytes for the current expression."""
        return self._asset_manager.get_expression_bytes(self._current, fmt)

    def all_ids(self) -> list[str]:
        return list(self._expressions.keys())

    def is_loaded(self) -> bool:
        return self._loaded

    def transition_in_ms(self, expression_id: str) -> int:
        cfg = self._expressions.get(expression_id)
        return cfg.transition_in_ms if cfg else 200

    def transition_out_ms(self, expression_id: str) -> int:
        cfg = self._expressions.get(expression_id)
        return cfg.transition_out_ms if cfg else 200

    # ── Internal ──────────────────────────────────────────────────────────────

    def _resolve(self, expression_id: str) -> Optional[str]:
        """Walk the fallback chain until a known expression is found."""
        visited: set[str] = set()
        current = expression_id

        while current and current not in visited:
            if current in self._expressions:
                return current
            visited.add(current)
            cfg = self._expressions.get(current)
            current = cfg.fallback if cfg else _FALLBACK

        # Last resort
        if _FALLBACK in self._expressions:
            return _FALLBACK
        return None
