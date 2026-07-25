"""
Fallback Manager — resolves ordered fallback chains for any language.

Resolution order
----------------
  dialect  →  parent (hi)  →  default (hi)  →  ultimate (en)

Never raises. Always returns a non-empty chain.
"""

from __future__ import annotations

from config.constants import DEFAULT_LANGUAGE, FALLBACK_LANGUAGE
from config.logger import get_logger

_log = get_logger("localization.fallback_manager")

# Static fallback chains — mirrors localization/config/fallback.json
_CHAINS: dict[str, list[str]] = {
    "hi":            ["hi", "en"],
    "en":            ["en", "hi"],
    "gu":            ["gu", "hi", "en"],
    "pa":            ["pa", "hi", "en"],
    "mr":            ["mr", "hi", "en"],
    "ta":            ["ta", "en", "hi"],
    "te":            ["te", "en", "hi"],
    "kn":            ["kn", "en", "hi"],
    "ml":            ["ml", "en", "hi"],
    "bn":            ["bn", "hi", "en"],
    "ur":            ["ur", "hi", "en"],
    "od":            ["od", "hi", "en"],
    "as":            ["as", "bn", "hi", "en"],
    "rj/bagri":      ["rj/bagri",      "hi", "en"],
    "rj/marwari":    ["rj/marwari",    "hi", "en"],
    "rj/mewari":     ["rj/mewari",     "hi", "en"],
    "rj/dhundhari":  ["rj/dhundhari",  "hi", "en"],
    "rj/hadoti":     ["rj/hadoti",     "hi", "en"],
    "rj/shekhawati": ["rj/shekhawati", "hi", "en"],
    "rj/mewati":     ["rj/mewati",     "hi", "en"],
    "rj/wagdi":      ["rj/wagdi",      "hi", "en"],
}


class FallbackManager:
    """
    Provides ordered fallback chains for language resolution.

    All methods are pure (no I/O) and thread-safe.
    """

    def chain(self, language: str) -> list[str]:
        """
        Return the ordered fallback chain for *language*.

        If *language* is unknown, returns [DEFAULT_LANGUAGE, FALLBACK_LANGUAGE].
        """
        result = _CHAINS.get(language)
        if result:
            return list(result)
        _log.warning("Unknown language '%s', using default chain.", language)
        chain: list[str] = []
        if language not in chain:
            chain.append(language)
        if DEFAULT_LANGUAGE not in chain:
            chain.append(DEFAULT_LANGUAGE)
        if FALLBACK_LANGUAGE not in chain:
            chain.append(FALLBACK_LANGUAGE)
        return chain

    def primary(self, language: str) -> str:
        """Return the first (most specific) language in the chain."""
        return self.chain(language)[0]

    def ultimate(self, language: str) -> str:
        """Return the last (most general) fallback in the chain."""
        return self.chain(language)[-1]

    def is_dialect(self, language: str) -> bool:
        """Return True if *language* is a Rajasthani dialect."""
        return language.startswith("rj/")

    def dialect_parent(self, language: str) -> str:
        """Return the parent language for a dialect (always 'hi')."""
        return DEFAULT_LANGUAGE if self.is_dialect(language) else language

    def resolve(
        self,
        language: str,
        available: set[str],
    ) -> str:
        """
        Walk the fallback chain and return the first language present in *available*.

        Falls back to DEFAULT_LANGUAGE then FALLBACK_LANGUAGE if nothing matches.
        """
        for candidate in self.chain(language):
            if candidate in available:
                if candidate != language:
                    _log.debug("Fallback: %s → %s", language, candidate)
                return candidate
        _log.warning(
            "No fallback found for '%s' in available set; using '%s'.",
            language, FALLBACK_LANGUAGE,
        )
        return FALLBACK_LANGUAGE
