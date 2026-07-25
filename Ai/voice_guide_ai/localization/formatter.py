"""
Formatter — applies dynamic placeholder substitution to translated strings.

Rules
-----
* Placeholders use {name} syntax.
* Unknown placeholders are left as-is (never removed).
* Placeholder keys are never translated.
* Thread-safe (stateless).
"""

from __future__ import annotations

import re
from typing import Any

from config.logger import get_logger

_log = get_logger("localization.formatter")

_PLACEHOLDER_RE = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}")


class Formatter:
    """
    Substitutes {placeholder} tokens in translated strings.

    All methods are stateless and thread-safe.
    """

    def format(self, text: str, context: dict[str, Any]) -> str:
        """
        Replace all {key} tokens in *text* with values from *context*.

        Unknown placeholders are preserved unchanged.
        """
        if not text or not context or "{" not in text:
            return text

        def _replace(match: re.Match) -> str:
            key = match.group(1)
            value = context.get(key)
            if value is None:
                return match.group(0)   # preserve unknown placeholder
            return str(value)

        return _PLACEHOLDER_RE.sub(_replace, text)

    def extract_placeholders(self, text: str) -> list[str]:
        """Return all placeholder names found in *text*."""
        return _PLACEHOLDER_RE.findall(text)

    def has_placeholders(self, text: str) -> bool:
        """Return True if *text* contains at least one placeholder."""
        return bool(_PLACEHOLDER_RE.search(text))

    def validate_context(
        self,
        text: str,
        context: dict[str, Any],
    ) -> list[str]:
        """
        Return list of placeholder names present in *text* but missing from *context*.
        """
        required = self.extract_placeholders(text)
        return [p for p in required if p not in context]
