"""
localization — Translation & Localization Engine for Voice Guide AI.

Public exports
--------------
  TranslationManager      — central facade (primary entry point)
  LocalizationRuntime     — runtime bridge for all engines
  TranslationCache        — TTL + LRU cache
  TranslationLoader       — disk reader
  TranslationValidator    — file/key validation
  TranslationSelector     — fallback-aware lookup
  LanguageSwitcher        — instant language switching
  FallbackManager         — fallback chain resolution
  DialectManager          — Rajasthani dialect handling
  TranslationEventDispatcher — typed event bus
  TranslationMemory       — session language preferences
  Pluralization           — CLDR plural form selection
  Formatter               — {placeholder} substitution
  SwitchResult            — language switch result dataclass
  ValidationReport        — validation result dataclass
  ValidationIssue         — single validation issue dataclass
"""

from localization.dialect_manager import DialectManager, DialectInfo
from localization.fallback_manager import FallbackManager
from localization.formatter import Formatter
from localization.language_switcher import LanguageSwitcher, SwitchResult
from localization.localization_runtime import LocalizationRuntime
from localization.pluralization import Pluralization
from localization.translation_cache import TranslationCache
from localization.translation_events import (
    TranslationEventDispatcher,
    LanguageChangedEvent,
    TranslationLoadedEvent,
    TranslationFailedEvent,
    FallbackActivatedEvent,
    CacheLoadedEvent,
)
from localization.translation_loader import TranslationLoader
from localization.translation_manager import TranslationManager
from localization.translation_memory import TranslationMemory, LanguageSwitchRecord
from localization.translation_selector import TranslationSelector
from localization.translation_validator import (
    TranslationValidator,
    ValidationReport,
    ValidationIssue,
)

__all__ = [
    "TranslationManager",
    "LocalizationRuntime",
    "TranslationCache",
    "TranslationLoader",
    "TranslationValidator",
    "TranslationSelector",
    "LanguageSwitcher",
    "FallbackManager",
    "DialectManager",
    "DialectInfo",
    "TranslationEventDispatcher",
    "TranslationMemory",
    "LanguageSwitchRecord",
    "Pluralization",
    "Formatter",
    "SwitchResult",
    "ValidationReport",
    "ValidationIssue",
    "LanguageChangedEvent",
    "TranslationLoadedEvent",
    "TranslationFailedEvent",
    "FallbackActivatedEvent",
    "CacheLoadedEvent",
]
