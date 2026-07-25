"""
Voice Guide AI — Runtime Condition Manager.

Evaluates named runtime conditions against the live session context.

Supported conditions
--------------------
first_visit, logged_in, logged_out, internet_available,
internet_not_available, farmer_profile_complete,
farmer_profile_incomplete, location_available,
permission_granted, permission_denied
"""

from __future__ import annotations

import threading
from typing import Any

from config.logger import get_logger

_log = get_logger("runtime.condition_manager")

# All named runtime conditions
RUNTIME_CONDITIONS = frozenset({
    "first_visit",
    "logged_in",
    "logged_out",
    "internet_available",
    "internet_not_available",
    "farmer_profile_complete",
    "farmer_profile_incomplete",
    "location_available",
    "permission_granted",
    "permission_denied",
})


class ConditionManager:
    """
    Evaluates named runtime conditions against a mutable context.

    The context is a flat dict of boolean/string flags set by the
    application layer (e.g. login state, connectivity, permissions).
    Thread-safe.
    """

    def __init__(self) -> None:
        self._context: dict[str, Any] = {
            "logged_in": False,
            "internet_available": True,
            "farmer_profile_complete": False,
            "location_available": False,
            "permission_granted": False,
        }
        self._lock = threading.Lock()

    # ── Context mutation ──────────────────────────────────────────────────────

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            self._context[key] = value
        _log.debug("Condition context: %s = %r", key, value)

    def update(self, data: dict[str, Any]) -> None:
        with self._lock:
            self._context.update(data)

    def get_context(self) -> dict[str, Any]:
        with self._lock:
            return dict(self._context)

    # ── Evaluation ────────────────────────────────────────────────────────────

    def evaluate(self, condition: str, page: str | None = None) -> bool:
        """
        Evaluate a named runtime condition.

        Parameters
        ----------
        condition : one of RUNTIME_CONDITIONS
        page      : current page (used for first_visit check)

        Returns
        -------
        bool — True if the condition is satisfied
        """
        with self._lock:
            ctx = dict(self._context)

        result = self._check(condition, ctx, page)
        _log.debug("Condition '%s' → %s (page=%s)", condition, result, page)
        return result

    def evaluate_all(self, conditions: list[str], page: str | None = None) -> dict[str, bool]:
        """Evaluate multiple conditions and return a mapping of condition → result."""
        return {c: self.evaluate(c, page) for c in conditions}

    def all_pass(self, conditions: list[str], page: str | None = None) -> bool:
        """Return True only if every condition in *conditions* passes."""
        return all(self.evaluate(c, page) for c in conditions)

    def any_pass(self, conditions: list[str], page: str | None = None) -> bool:
        """Return True if at least one condition in *conditions* passes."""
        return any(self.evaluate(c, page) for c in conditions)

    # ── Named condition logic ─────────────────────────────────────────────────

    def _check(self, condition: str, ctx: dict[str, Any], page: str | None) -> bool:
        if condition == "first_visit":
            return bool(ctx.get("first_visit", False))

        if condition == "logged_in":
            return bool(ctx.get("logged_in", False))

        if condition == "logged_out":
            return not bool(ctx.get("logged_in", False))

        if condition == "internet_available":
            return bool(ctx.get("internet_available", True))

        if condition == "internet_not_available":
            return not bool(ctx.get("internet_available", True))

        if condition == "farmer_profile_complete":
            return bool(ctx.get("farmer_profile_complete", False))

        if condition == "farmer_profile_incomplete":
            return not bool(ctx.get("farmer_profile_complete", False))

        if condition == "location_available":
            return bool(ctx.get("location_available", False))

        if condition == "permission_granted":
            return bool(ctx.get("permission_granted", False))

        if condition == "permission_denied":
            return not bool(ctx.get("permission_granted", False))

        _log.warning("Unknown condition: '%s'", condition)
        return False

    # ── Convenience setters ───────────────────────────────────────────────────

    def set_logged_in(self, value: bool) -> None:
        self.set("logged_in", value)

    def set_internet(self, available: bool) -> None:
        self.set("internet_available", available)

    def set_profile_complete(self, complete: bool) -> None:
        self.set("farmer_profile_complete", complete)

    def set_location_available(self, available: bool) -> None:
        self.set("location_available", available)

    def set_permission_granted(self, granted: bool) -> None:
        self.set("permission_granted", granted)

    def set_first_visit(self, is_first: bool) -> None:
        self.set("first_visit", is_first)
