"""
Avatar Runtime — Theme Manager.

Loads theme configuration and applies light, dark, high-contrast,
and transparent themes to the avatar widget.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from config.logger import get_logger
from config.paths import PATHS

_log = get_logger("avatar.theme_manager")

_DEFAULT_THEME = "transparent"

ThemeCallback = Callable[[str, dict], None]
# (theme_id, css_vars)


@dataclass
class ThemeConfig:
    """Runtime representation of a single theme."""

    id:                 str
    label:              str
    background_color:   str
    background_opacity: float
    border_color:       str
    border_radius:      int
    border_width:       int
    shadow:             str
    avatar_tint:        Optional[str]
    overlay_color:      str
    overlay_opacity:    float
    badge_background:   str
    badge_text_color:   str
    css_vars:           dict[str, str] = field(default_factory=dict)


class ThemeManager:
    """
    Manages avatar visual themes.

    Responsibilities
    ----------------
    * Load themes.json config
    * Track current and previous theme
    * Apply theme and emit CSS variable maps
    * Log every theme change
    """

    def __init__(self) -> None:
        self._themes: dict[str, ThemeConfig] = {}
        self._current: str = _DEFAULT_THEME
        self._previous: str = _DEFAULT_THEME
        self._default: str = _DEFAULT_THEME
        self._callbacks: list[ThemeCallback] = []
        self._loaded = False

    # ── Initialisation ────────────────────────────────────────────────────────

    def load(self) -> None:
        """Load themes.json from avatar/config/."""
        config_path = PATHS.root / "avatar" / "config" / "themes.json"
        if not config_path.exists():
            _log.warning("themes.json not found — using defaults.")
            return

        try:
            with open(config_path, encoding="utf-8-sig") as fh:
                raw: dict[str, Any] = json.load(fh)

            self._default = raw.get("default", _DEFAULT_THEME)
            self._current = self._default

            for theme_id, data in raw.get("themes", {}).items():
                self._themes[theme_id] = ThemeConfig(
                    id=data["id"],
                    label=data.get("label", theme_id),
                    background_color=data.get("background_color", "transparent"),
                    background_opacity=data.get("background_opacity", 0.0),
                    border_color=data.get("border_color", "transparent"),
                    border_radius=data.get("border_radius", 0),
                    border_width=data.get("border_width", 0),
                    shadow=data.get("shadow", "none"),
                    avatar_tint=data.get("avatar_tint"),
                    overlay_color=data.get("overlay_color", "transparent"),
                    overlay_opacity=data.get("overlay_opacity", 0.0),
                    badge_background=data.get("badge_background", "#4CAF50"),
                    badge_text_color=data.get("badge_text_color", "#FFFFFF"),
                    css_vars=data.get("css_vars", {}),
                )

            self._loaded = True
            _log.info("Loaded %d themes.", len(self._themes))

        except Exception as exc:
            _log.error("Failed to load themes.json: %s", exc)

    # ── Theme control ─────────────────────────────────────────────────────────

    def set_theme(self, theme_id: str) -> bool:
        """
        Apply *theme_id*.

        Returns True on success, False if theme not found (uses default).
        """
        if not self._loaded:
            self.load()

        if theme_id not in self._themes:
            _log.warning(
                "Theme '%s' not found — using default '%s'.", theme_id, self._default
            )
            theme_id = self._default

        self._previous = self._current
        self._current  = theme_id
        cfg = self._themes.get(theme_id)

        _log.info("Theme changed: %s → %s", self._previous, theme_id)

        if cfg:
            for cb in self._callbacks:
                try:
                    cb(theme_id, cfg.css_vars)
                except Exception as exc:
                    _log.warning("Theme callback error: %s", exc)

        return self._current == theme_id

    def reset(self) -> None:
        """Reset to the default theme."""
        self.set_theme(self._default)

    # ── Queries ───────────────────────────────────────────────────────────────

    @property
    def current(self) -> str:
        return self._current

    @property
    def previous(self) -> str:
        return self._previous

    def get_config(self, theme_id: Optional[str] = None) -> Optional[ThemeConfig]:
        return self._themes.get(theme_id or self._current)

    def get_current_config(self) -> Optional[ThemeConfig]:
        return self._themes.get(self._current)

    def get_css_vars(self, theme_id: Optional[str] = None) -> dict[str, str]:
        """Return the CSS variable map for *theme_id* (or current theme)."""
        cfg = self.get_config(theme_id)
        return cfg.css_vars if cfg else {}

    def all_ids(self) -> list[str]:
        return list(self._themes.keys())

    def is_transparent(self) -> bool:
        return self._current == "transparent"

    def is_dark(self) -> bool:
        return self._current == "dark"

    # ── Callbacks ─────────────────────────────────────────────────────────────

    def on_theme_change(self, callback: ThemeCallback) -> None:
        """Register a callback invoked when the theme changes."""
        self._callbacks.append(callback)
