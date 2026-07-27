"""
Voice Guide AI — Dialogue Condition Evaluator.

Evaluates the ``conditions`` block of a dialogue JSON against a
runtime context dict.

Supported operators: eq, neq, gt, lt, gte, lte, in, not_in
Logical grouping:    AND (default), OR

Condition JSON shape
--------------------
Single condition::

    {"field": "user.role", "op": "eq", "value": "farmer"}

Grouped conditions::

    {
        "logic": "OR",
        "rules": [
            {"field": "page", "op": "eq", "value": "home"},
            {"field": "language", "op": "in", "value": ["hi", "en"]}
        ]
    }

A dialogue with ``"conditions": {}`` or ``"conditions": null`` is
always considered to pass.
"""

from __future__ import annotations

from typing import Any

from config.constants import CONDITION_OPERATORS
from config.exceptions import DialogueConditionError
from config.logger import get_logger

_log = get_logger("dialogue_condition")


class DialogueCondition:
    """
    Evaluates dialogue conditions against a runtime context.

    The evaluator is stateless — pass the context on each call.
    """

    # ── Public API ────────────────────────────────────────────────────────────

    def check(
        self,
        dialogue: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> bool:
        """
        Return True if the dialogue's conditions are satisfied.

        Parameters
        ----------
        dialogue : parsed dialogue JSON dict
        context  : runtime key-value pairs (e.g. user role, language, page)

        Raises
        ------
        DialogueConditionError — malformed condition definition
        """
        ctx = context or {}

        # Status check — always required
        status = dialogue.get("status", "active")
        if status != "active":
            _log.debug(
                "Dialogue '%s' skipped: status=%s", dialogue.get("id"), status
            )
            return False

        conditions = dialogue.get("conditions")
        if not conditions:
            return True

        # Legacy camelCase flat-dict conditions from dialogue JSON
        # e.g. {"firstVisit": true, "loggedIn": true, "internetRequired": false}
        # Evaluate these against the runtime context instead of blindly passing.
        if isinstance(conditions, dict) and not any(
            k in conditions for k in ("field", "op", "logic", "rules")
        ):
            return self._evaluate_legacy(conditions, ctx, dialogue.get("id", ""))

        try:
            return self._evaluate(conditions, ctx)
        except DialogueConditionError:
            raise
        except Exception as exc:
            raise DialogueConditionError(
                str(conditions), f"Unexpected error: {exc}"
            ) from exc

    def evaluate_rule(
        self,
        rule: dict[str, Any],
        context: dict[str, Any],
    ) -> bool:
        """
        Evaluate a single condition rule against *context*.

        Parameters
        ----------
        rule    : ``{"field": "...", "op": "...", "value": ...}``
        context : runtime key-value pairs

        Raises
        ------
        DialogueConditionError — unknown operator or malformed rule
        """
        field = rule.get("field")
        op    = rule.get("op")
        value = rule.get("value")

        if not field or not op:
            raise DialogueConditionError(
                str(rule), "Rule must have 'field' and 'op' keys."
            )

        if op not in CONDITION_OPERATORS:
            raise DialogueConditionError(
                op, f"Unknown operator '{op}'. Supported: {CONDITION_OPERATORS}"
            )

        actual = self._resolve_field(field, context)
        return self._apply_operator(op, actual, value)

    def _evaluate_legacy(
        self,
        conditions: dict[str, Any],
        ctx: dict[str, Any],
        dialogue_id: str,
    ) -> bool:
        """
        Evaluate camelCase flat-dict conditions from dialogue JSON.

        Supported keys
        --------------
        firstVisit        → ctx["first_visit"]
        loggedIn          → ctx["logged_in"]
        internetRequired  → ctx["internet_available"] (only blocks when True + offline)
        """
        # firstVisit: if True, only play on first visit; if False, only on return
        first_visit_required = conditions.get("firstVisit")
        if first_visit_required is True:
            if not bool(ctx.get("first_visit", False)):
                _log.debug(
                    "Dialogue '%s' requires first_visit but ctx.first_visit=False",
                    dialogue_id,
                )
                return False
        elif first_visit_required is False:
            if bool(ctx.get("first_visit", False)):
                _log.debug(
                    "Dialogue '%s' requires return_visit but ctx.first_visit=True",
                    dialogue_id,
                )
                return False

        # loggedIn: if True, require logged_in; if False, require logged_out
        logged_in_required = conditions.get("loggedIn")
        if logged_in_required is True:
            if not bool(ctx.get("logged_in", False)):
                _log.debug(
                    "Dialogue '%s' requires logged_in but ctx.logged_in=False",
                    dialogue_id,
                )
                return False
        elif logged_in_required is False:
            # False means "works for both" — do not block
            pass

        # internetRequired: only block if explicitly True and we are offline
        if conditions.get("internetRequired") is True:
            if not bool(ctx.get("internet_available", True)):
                _log.debug(
                    "Dialogue '%s' requires internet but ctx.internet_available=False",
                    dialogue_id,
                )
                return False

        return True

    # ── Internal ──────────────────────────────────────────────────────────────

    def _evaluate(
        self,
        conditions: dict[str, Any] | list[dict[str, Any]],
        context: dict[str, Any],
    ) -> bool:
        """Recursively evaluate conditions (single rule, AND group, or OR group)."""

        # List of rules → implicit AND
        if isinstance(conditions, list):
            return all(self._evaluate(rule, context) for rule in conditions)

        if not isinstance(conditions, dict):
            raise DialogueConditionError(
                str(conditions), "Condition must be a dict or list."
            )

        # Grouped logic block
        if "logic" in conditions or "rules" in conditions:
            logic = conditions.get("logic", "AND").upper()
            rules = conditions.get("rules", [])

            if not isinstance(rules, list):
                raise DialogueConditionError(
                    str(conditions), "'rules' must be a list."
                )

            if logic == "OR":
                return any(self._evaluate(rule, context) for rule in rules)
            # Default: AND
            return all(self._evaluate(rule, context) for rule in rules)

        # Single rule
        return self.evaluate_rule(conditions, context)

    @staticmethod
    def _resolve_field(field: str, context: dict[str, Any]) -> Any:
        """
        Resolve a (possibly dotted) field path from *context*.

        Example: ``"user.role"`` → ``context["user"]["role"]``
        """
        parts = field.split(".")
        current: Any = context
        for part in parts:
            if not isinstance(current, dict):
                return None
            current = current.get(part)
        return current

    @staticmethod
    def _apply_operator(op: str, actual: Any, expected: Any) -> bool:
        """Apply *op* to compare *actual* against *expected*."""
        try:
            if op == "eq":
                return actual == expected
            if op == "neq":
                return actual != expected
            if op == "gt":
                return actual is not None and actual > expected
            if op == "lt":
                return actual is not None and actual < expected
            if op == "gte":
                return actual is not None and actual >= expected
            if op == "lte":
                return actual is not None and actual <= expected
            if op == "in":
                return actual in (expected or [])
            if op == "not_in":
                return actual not in (expected or [])
        except TypeError as exc:
            _log.warning(
                "Type error comparing actual=%r op=%s expected=%r: %s",
                actual, op, expected, exc,
            )
            return False
        return False
