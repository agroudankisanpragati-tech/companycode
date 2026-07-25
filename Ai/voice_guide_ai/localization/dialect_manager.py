"""
Dialect Manager — handles Rajasthani regional dialect resolution.

Responsibilities
---------------
* Identify dialect codes (rj/*)
* Resolve dialect → translation with Hindi fallback
* Provide dialect metadata
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from config.logger import get_logger
from localization.fallback_manager import FallbackManager
from localization.translation_loader import TranslationLoader

_log = get_logger("localization.dialect_manager")

_DIALECT_META: dict[str, dict[str, str]] = {
    "rj/bagri":      {"name": "Bagri",      "native": "बागड़ी",    "region": "Hanumangarh, Ganganagar"},
    "rj/marwari":    {"name": "Marwari",    "native": "मारवाड़ी",  "region": "Jodhpur, Barmer, Jaisalmer"},
    "rj/mewari":     {"name": "Mewari",     "native": "मेवाड़ी",   "region": "Udaipur, Chittorgarh"},
    "rj/dhundhari":  {"name": "Dhundhari",  "native": "ढूंढाड़ी",  "region": "Jaipur, Dausa"},
    "rj/hadoti":     {"name": "Hadoti",     "native": "हाड़ौती",   "region": "Kota, Bundi, Baran"},
    "rj/shekhawati": {"name": "Shekhawati", "native": "शेखावाटी", "region": "Sikar, Jhunjhunu, Churu"},
    "rj/mewati":     {"name": "Mewati",     "native": "मेवाती",    "region": "Alwar, Bharatpur"},
    "rj/wagdi":      {"name": "Wagdi",      "native": "वागड़ी",    "region": "Dungarpur, Banswara"},
}

_ALL_DIALECTS: frozenset[str] = frozenset(_DIALECT_META.keys())


@dataclass
class DialectInfo:
    code: str
    name: str
    native: str
    region: str
    parent: str = "hi"


class DialectManager:
    """
    Manages Rajasthani dialect resolution and metadata.

    Parameters
    ----------
    loader   : TranslationLoader for checking file availability
    fallback : FallbackManager for chain resolution
    """

    def __init__(
        self,
        loader: TranslationLoader,
        fallback: FallbackManager,
    ) -> None:
        self._loader = loader
        self._fallback = fallback

    # ── Identification ─────────────────────────────────────────────────────────

    def is_dialect(self, language: str) -> bool:
        return language in _ALL_DIALECTS

    def all_dialects(self) -> list[str]:
        return sorted(_ALL_DIALECTS)

    def get_info(self, dialect: str) -> Optional[DialectInfo]:
        meta = _DIALECT_META.get(dialect)
        if not meta:
            return None
        return DialectInfo(
            code=dialect,
            name=meta["name"],
            native=meta["native"],
            region=meta["region"],
        )

    # ── Resolution ─────────────────────────────────────────────────────────────

    def resolve_translation(
        self,
        dialect: str,
        module: str,
        dialogue_id: str,
    ) -> tuple[str, str]:
        """
        Resolve a single translation entry for a dialect.

        Returns (resolved_language, text). Falls back to Hindi if the
        dialect file does not contain the key.
        """
        if self.is_dialect(dialect):
            data = self._loader.load(dialect, module)
            if dialogue_id in data:
                return dialect, data[dialogue_id]
            _log.debug(
                "Dialect '%s' missing key '%s.%s', falling back to hi.",
                dialect, module, dialogue_id,
            )

        # Fallback to Hindi
        hi_data = self._loader.load("hi", module)
        if dialogue_id in hi_data:
            return "hi", hi_data[dialogue_id]

        # Ultimate fallback to English
        en_data = self._loader.load("en", module)
        return "en", en_data.get(dialogue_id, "")

    def resolve_module(self, dialect: str, module: str) -> tuple[str, dict[str, str]]:
        """
        Return the best available translation dict for *dialect* / *module*.

        Returns (resolved_language, data_dict).
        """
        if self.is_dialect(dialect):
            data = self._loader.load(dialect, module)
            if data:
                return dialect, data

        hi_data = self._loader.load("hi", module)
        if hi_data:
            return "hi", hi_data

        en_data = self._loader.load("en", module)
        return "en", en_data
