"""
Translation Selector — resolves the best translation for a given request.

Resolution order
----------------
  1. Requested language + module
  2. Fallback chain (per FallbackManager)
  3. Empty string (never raises)

Dialect keys are resolved via DialectManager.
"""

from __future__ import annotations

from config.logger import get_logger
from localization.dialect_manager import DialectManager
from localization.fallback_manager import FallbackManager
from localization.translation_loader import TranslationLoader

_log = get_logger("localization.translation_selector")


class TranslationSelector:
    """
    Selects the best available translation for a (language, module, key) triple.

    Parameters
    ----------
    loader  : TranslationLoader
    fallback: FallbackManager
    dialect : DialectManager
    """

    def __init__(
        self,
        loader: TranslationLoader,
        fallback: FallbackManager,
        dialect: DialectManager,
    ) -> None:
        self._loader = loader
        self._fallback = fallback
        self._dialect = dialect

    # ── Public API ─────────────────────────────────────────────────────────────

    def select(
        self,
        language: str,
        module: str,
        dialogue_id: str,
    ) -> tuple[str, str]:
        """
        Return (resolved_language, text) for the given triple.

        Never raises. Returns ("", "") if nothing is found.
        """
        if self._dialect.is_dialect(language):
            return self._dialect.resolve_translation(language, module, dialogue_id)

        for candidate in self._fallback.chain(language):
            data = self._loader.load(candidate, module)
            if dialogue_id in data:
                if candidate != language:
                    _log.debug(
                        "Fallback: %s → %s for %s.%s",
                        language, candidate, module, dialogue_id,
                    )
                return candidate, data[dialogue_id]

        _log.warning(
            "No translation found: lang=%s module=%s id=%s",
            language, module, dialogue_id,
        )
        return "", ""

    def select_module(
        self,
        language: str,
        module: str,
    ) -> tuple[str, dict[str, str]]:
        """
        Return (resolved_language, full_module_dict).

        Never raises. Returns ("", {}) if nothing is found.
        """
        if self._dialect.is_dialect(language):
            return self._dialect.resolve_module(language, module)

        for candidate in self._fallback.chain(language):
            data = self._loader.load(candidate, module)
            if data:
                if candidate != language:
                    _log.debug(
                        "Module fallback: %s → %s for %s",
                        language, candidate, module,
                    )
                return candidate, data

        _log.warning("No module translation found: lang=%s module=%s", language, module)
        return "", {}

    def has_translation(self, language: str, module: str, dialogue_id: str) -> bool:
        """Return True if a translation exists anywhere in the fallback chain."""
        _, text = self.select(language, module, dialogue_id)
        return bool(text)
