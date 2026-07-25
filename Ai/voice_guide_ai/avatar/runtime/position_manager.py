"""
Avatar Runtime — Position Manager.

Loads position configuration and resolves the correct pixel offsets
for the current viewport size and position ID.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Optional

from config.logger import get_logger
from config.paths import PATHS

_log = get_logger("avatar.position_manager")

_DEFAULT_POSITION = "bottom_right"


@dataclass
class ResolvedPosition:
    """Computed position for a specific viewport."""

    id:        str
    label:     str
    anchor:    str
    offset_x:  int
    offset_y:  int
    z_index:   int
    safe_area: bool
    draggable: bool = False


class PositionManager:
    """
    Manages avatar screen positioning.

    Responsibilities
    ----------------
    * Load positions.json config
    * Resolve responsive offsets for mobile / tablet / desktop
    * Support all 9 position types including dynamic and floating
    * Log every position change
    """

    def __init__(self) -> None:
        self._positions: dict[str, Any] = {}
        self._current: str = _DEFAULT_POSITION
        self._previous: str = _DEFAULT_POSITION
        self._default: str = _DEFAULT_POSITION
        self._loaded = False

    # ── Initialisation ────────────────────────────────────────────────────────

    def load(self) -> None:
        """Load positions.json from avatar/config/."""
        config_path = PATHS.root / "avatar" / "config" / "positions.json"
        if not config_path.exists():
            _log.warning("positions.json not found — using defaults.")
            return

        try:
            with open(config_path, encoding="utf-8-sig") as fh:
                raw: dict[str, Any] = json.load(fh)

            self._default  = raw.get("default", _DEFAULT_POSITION)
            self._current  = self._default
            self._positions = raw.get("positions", {})
            self._loaded = True
            _log.info("Loaded %d positions.", len(self._positions))

        except Exception as exc:
            _log.error("Failed to load positions.json: %s", exc)

    # ── Position control ──────────────────────────────────────────────────────

    def set_position(self, position_id: str) -> bool:
        """
        Set the active position.

        Returns True on success, False if position_id is unknown
        (falls back to default).
        """
        if not self._loaded:
            self.load()

        if position_id not in self._positions:
            _log.warning(
                "Position '%s' not found — using default '%s'.",
                position_id, self._default,
            )
            position_id = self._default

        self._previous = self._current
        self._current  = position_id
        _log.info("Position changed: %s → %s", self._previous, self._current)
        return self._current == position_id

    def reset(self) -> None:
        """Reset to the default position."""
        self.set_position(self._default)

    # ── Resolution ────────────────────────────────────────────────────────────

    def resolve(
        self,
        position_id: Optional[str] = None,
        viewport: str = "desktop",
    ) -> ResolvedPosition:
        """
        Resolve the final pixel offsets for *position_id* and *viewport*.

        Parameters
        ----------
        position_id : position to resolve (defaults to current)
        viewport    : ``"mobile"``, ``"tablet"``, or ``"desktop"``

        Returns
        -------
        ResolvedPosition with computed offsets
        """
        if not self._loaded:
            self.load()

        pid = position_id or self._current
        data = self._positions.get(pid) or self._positions.get(self._default, {})

        responsive = data.get("responsive", {}).get(viewport, {})

        # For dynamic position, resolve preferred
        if data.get("anchor") == "dynamic":
            preferred = responsive.get("preferred", self._default)
            return self.resolve(preferred, viewport)

        offset_x = responsive.get("offset_x", data.get("offset_x", 16))
        offset_y = responsive.get("offset_y", data.get("offset_y", 16))

        return ResolvedPosition(
            id=pid,
            label=data.get("label", pid),
            anchor=data.get("anchor", "bottom_right"),
            offset_x=offset_x,
            offset_y=offset_y,
            z_index=data.get("z_index", 1000),
            safe_area=data.get("safe_area", True),
            draggable=data.get("draggable", False),
        )

    def resolve_css(
        self,
        position_id: Optional[str] = None,
        viewport: str = "desktop",
    ) -> dict[str, str]:
        """
        Return a CSS property dict for the resolved position.

        Example: ``{"bottom": "16px", "right": "16px", "z-index": "1000"}``
        """
        pos = self.resolve(position_id, viewport)
        anchor = pos.anchor
        css: dict[str, str] = {"z-index": str(pos.z_index), "position": "fixed"}

        if anchor in ("bottom_right", "bottom_left", "bottom"):
            css["bottom"] = f"{pos.offset_y}px"
        elif anchor in ("top_right", "top_left", "top"):
            css["top"] = f"{pos.offset_y}px"
        elif anchor in ("center_left", "center_right"):
            css["top"] = "50%"
            css["transform"] = "translateY(-50%)"

        if anchor in ("bottom_right", "top_right", "center_right"):
            css["right"] = f"{pos.offset_x}px"
        elif anchor in ("bottom_left", "top_left", "center_left"):
            css["left"] = f"{pos.offset_x}px"

        return css

    # ── Queries ───────────────────────────────────────────────────────────────

    @property
    def current(self) -> str:
        return self._current

    @property
    def previous(self) -> str:
        return self._previous

    def all_ids(self) -> list[str]:
        return list(self._positions.keys())

    def is_safe_area(self, position_id: Optional[str] = None) -> bool:
        pid = position_id or self._current
        data = self._positions.get(pid, {})
        return bool(data.get("safe_area", True))

    def is_draggable(self, position_id: Optional[str] = None) -> bool:
        pid = position_id or self._current
        data = self._positions.get(pid, {})
        return bool(data.get("draggable", False))
