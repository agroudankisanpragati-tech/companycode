"""
Pluralization — rule-based plural form selection.

Supports the plural categories used by the supported languages.
Rules follow CLDR plural categories: zero, one, two, few, many, other.
"""

from __future__ import annotations

from typing import Callable

from config.logger import get_logger

_log = get_logger("localization.pluralization")

# Type alias: count → plural category string
_PluralRule = Callable[[int], str]


def _rule_one_other(n: int) -> str:
    return "one" if n == 1 else "other"


def _rule_zero_one_other(n: int) -> str:
    if n == 0:
        return "zero"
    if n == 1:
        return "one"
    return "other"


def _rule_other(n: int) -> str:
    return "other"


# CLDR-based rules per language
_RULES: dict[str, _PluralRule] = {
    "hi": _rule_one_other,
    "en": _rule_one_other,
    "gu": _rule_one_other,
    "pa": _rule_one_other,
    "mr": _rule_one_other,
    "ta": _rule_other,
    "te": _rule_one_other,
    "kn": _rule_one_other,
    "ml": _rule_one_other,
    "bn": _rule_one_other,
    "ur": _rule_one_other,
    "od": _rule_one_other,
    "as": _rule_one_other,
}

# All Rajasthani dialects inherit Hindi rules
for _d in (
    "rj/bagri", "rj/marwari", "rj/mewari", "rj/dhundhari",
    "rj/hadoti", "rj/shekhawati", "rj/mewati", "rj/wagdi",
):
    _RULES[_d] = _rule_one_other


class Pluralization:
    """
    Selects the correct plural form for a count in a given language.

    Plural form dicts use CLDR category keys:
      {"one": "...", "other": "..."}
    """

    def category(self, language: str, count: int) -> str:
        """Return the CLDR plural category for *count* in *language*."""
        rule = _RULES.get(language, _rule_other)
        return rule(count)

    def select(
        self,
        language: str,
        count: int,
        forms: dict[str, str],
    ) -> str:
        """
        Select the correct plural form string from *forms*.

        Falls back to "other" if the exact category is absent.
        Returns empty string if *forms* is empty.
        """
        if not forms:
            return ""
        cat = self.category(language, count)
        return forms.get(cat) or forms.get("other") or next(iter(forms.values()))
