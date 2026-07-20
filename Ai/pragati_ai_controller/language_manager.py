# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: pragati_ai_controller/language_manager.py
# Purpose: Manages language detection, normalisation, and selection for
#          the Pragati AI Controller. Supports Hindi, English, and future
#          regional languages. Thread-safe singleton.
# =============================================================================

from __future__ import annotations

import logging
import re
import sys
import threading
from logging.handlers import RotatingFileHandler
from typing import Optional

from pragati_ai_controller.config import PragatiAIConfig, get_config

# ---------------------------------------------------------------------------
# LOGGER
# ---------------------------------------------------------------------------

def _build_logger(cfg: PragatiAIConfig) -> logging.Logger:
    logger = logging.getLogger("akp.controller.language")
    if logger.handlers:
        return logger
    logger.setLevel(getattr(logging, cfg.log_level.upper(), logging.INFO))
    fmt = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    ch = logging.StreamHandler(sys.stdout)
    ch.setFormatter(fmt)
    logger.addHandler(ch)
    fh = RotatingFileHandler(
        filename=cfg.logs_dir / "language_manager.log",
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    fh.setFormatter(fmt)
    logger.addHandler(fh)
    logger.propagate = False
    return logger


# ---------------------------------------------------------------------------
# UNICODE RANGES
# ---------------------------------------------------------------------------
_DEVANAGARI_RE = re.compile(r"[\u0900-\u097F\u0A00-\u0A7F]")   # Devanagari + Gurmukhi
_LATIN_RE      = re.compile(r"[A-Za-z]")


# ---------------------------------------------------------------------------
# LANGUAGE MANAGER
# ---------------------------------------------------------------------------

class LanguageManager:
    """
    Detects, normalises, and manages language state for a session.

    Responsibilities:
        - Detect script (Devanagari / Latin / mixed) from raw text.
        - Map script hint → BCP-47 language code.
        - Accept explicit language overrides from the caller.
        - Maintain per-session preferred language.
        - Validate language codes against the supported list.

    Thread-safe via an internal RLock.

    Usage:
        lm = LanguageManager()
        lang = lm.detect("मेरी फसल में बीमारी है")   # → "hi"
        lang = lm.detect("crop disease treatment")    # → "en"
        lm.set_preferred("hi")
        lang = lm.get_preferred()                     # → "hi"
    """

    def __init__(self, cfg: Optional[PragatiAIConfig] = None) -> None:
        self._cfg  = cfg or get_config()
        self._log  = _build_logger(self._cfg)
        self._lock = threading.RLock()
        self._preferred_language: str = self._cfg.default_language

    # ------------------------------------------------------------------
    # DETECTION
    # ------------------------------------------------------------------

    def detect(self, text: str) -> str:
        """
        Detects the language of the given text based on Unicode script analysis.

        Args:
            text: Raw input text.

        Returns:
            BCP-47 language code string (e.g. "hi", "en").
        """
        if not text or not text.strip():
            return self._preferred_language

        script = self._detect_script(text)
        lang   = self._cfg.script_language_map.get(script, self._cfg.default_language)
        self._log.debug("detect | script=%-12s lang=%s text='%s'", script, lang, text[:40])
        return lang

    def detect_script(self, text: str) -> str:
        """
        Returns the dominant script hint: 'devanagari', 'latin', or 'mixed'.

        Args:
            text: Raw input text.

        Returns:
            Script hint string.
        """
        return self._detect_script(text)

    def resolve(
        self,
        text:              str,
        explicit_language: Optional[str] = None,
        stt_language:      Optional[str] = None,
    ) -> str:
        """
        Resolves the effective language for a request using priority order:
            1. Explicit caller override (highest priority)
            2. STT-detected language
            3. Script-based detection from text
            4. Session preferred language (fallback)

        Args:
            text:              Input text to analyse.
            explicit_language: Caller-supplied language code override.
            stt_language:      Language code from Speech-to-Text engine.

        Returns:
            Resolved BCP-47 language code.
        """
        if explicit_language and self.is_supported(explicit_language):
            return explicit_language

        if stt_language and self.is_supported(stt_language):
            return stt_language

        detected = self.detect(text)
        if self.is_supported(detected):
            return detected

        return self._preferred_language

    # ------------------------------------------------------------------
    # PREFERENCE MANAGEMENT
    # ------------------------------------------------------------------

    def set_preferred(self, language: str) -> None:
        """
        Sets the session-preferred language.

        Args:
            language: BCP-47 language code.

        Raises:
            ValueError: If the language code is not supported.
        """
        if not self.is_supported(language):
            raise ValueError(
                f"Unsupported language '{language}'. "
                f"Supported: {self._cfg.supported_languages}"
            )
        with self._lock:
            self._preferred_language = language
            self._log.info("Preferred language set to '%s'", language)

    def get_preferred(self) -> str:
        """Returns the current session-preferred language code."""
        with self._lock:
            return self._preferred_language

    # ------------------------------------------------------------------
    # VALIDATION
    # ------------------------------------------------------------------

    def is_supported(self, language: str) -> bool:
        """Returns True if the language code is in the supported list."""
        return language in self._cfg.supported_languages

    def get_supported_languages(self) -> tuple[str, ...]:
        """Returns the tuple of all supported language codes."""
        return self._cfg.supported_languages

    def normalise_code(self, language: str) -> str:
        """
        Normalises common language aliases to canonical BCP-47 codes.

        Examples:
            "hindi"   → "hi"
            "english" → "en"
            "hin"     → "hi"

        Args:
            language: Raw language string from caller.

        Returns:
            Canonical BCP-47 code, or the input unchanged if unknown.
        """
        _aliases: dict[str, str] = {
            "hindi":   "hi",
            "hin":     "hi",
            "english": "en",
            "eng":     "en",
            "rajasthani": "raj",
            "marwari": "mr",
            "mewari":  "mew",
        }
        return _aliases.get(language.lower().strip(), language.lower().strip())

    # ------------------------------------------------------------------
    # INTERNAL
    # ------------------------------------------------------------------

    @staticmethod
    def _detect_script(text: str) -> str:
        deva_count  = len(_DEVANAGARI_RE.findall(text))
        latin_count = len(_LATIN_RE.findall(text))

        if deva_count == 0 and latin_count == 0:
            return "latin"   # numbers / symbols only → default to latin
        if deva_count > 0 and latin_count == 0:
            return "devanagari"
        if latin_count > 0 and deva_count == 0:
            return "latin"
        # Both scripts present
        ratio = deva_count / (deva_count + latin_count)
        if ratio >= 0.6:
            return "devanagari"
        if ratio <= 0.4:
            return "latin"
        return "mixed"


# ---------------------------------------------------------------------------
# MODULE-LEVEL SINGLETON
# ---------------------------------------------------------------------------

_lm_instance: Optional[LanguageManager] = None
_lm_lock = threading.Lock()


def get_language_manager(force_rebuild: bool = False) -> LanguageManager:
    """
    Returns the singleton LanguageManager.

    Args:
        force_rebuild: Create a fresh instance (useful in tests).

    Returns:
        LanguageManager
    """
    global _lm_instance
    with _lm_lock:
        if _lm_instance is None or force_rebuild:
            _lm_instance = LanguageManager()
    return _lm_instance
