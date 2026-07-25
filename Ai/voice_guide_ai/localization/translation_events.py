"""
Translation Events — typed event definitions and dispatcher for the
localization layer.

Events
------
  language_changed    : language switch completed
  translation_loaded  : a module was loaded from disk
  translation_failed  : a translation lookup returned empty
  fallback_activated  : fallback chain was used
  cache_loaded        : a module was served from cache
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from config.logger import get_logger

_log = get_logger("localization.translation_events")

# ── Event payloads ─────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class LanguageChangedEvent:
    old_language: str
    new_language: str
    timestamp: float = field(default_factory=time.time)


@dataclass(frozen=True)
class TranslationLoadedEvent:
    language: str
    module: str
    key_count: int
    from_cache: bool
    timestamp: float = field(default_factory=time.time)


@dataclass(frozen=True)
class TranslationFailedEvent:
    language: str
    module: str
    dialogue_id: str
    reason: str
    timestamp: float = field(default_factory=time.time)


@dataclass(frozen=True)
class FallbackActivatedEvent:
    requested_language: str
    resolved_language: str
    module: str
    dialogue_id: Optional[str]
    timestamp: float = field(default_factory=time.time)


@dataclass(frozen=True)
class CacheLoadedEvent:
    language: str
    module: str
    timestamp: float = field(default_factory=time.time)


# Union type for all events
TranslationEvent = (
    LanguageChangedEvent
    | TranslationLoadedEvent
    | TranslationFailedEvent
    | FallbackActivatedEvent
    | CacheLoadedEvent
)

_Handler = Callable[[TranslationEvent], None]


# ── Dispatcher ─────────────────────────────────────────────────────────────────

class TranslationEventDispatcher:
    """
    Thread-safe event bus for localization events.

    Handlers are called synchronously in registration order.
    Exceptions in handlers are caught and logged.
    """

    def __init__(self) -> None:
        self._handlers: dict[type, list[_Handler]] = {}
        self._lock = threading.Lock()

    def subscribe(self, event_type: type, handler: _Handler) -> None:
        with self._lock:
            self._handlers.setdefault(event_type, []).append(handler)

    def unsubscribe(self, event_type: type, handler: _Handler) -> None:
        with self._lock:
            handlers = self._handlers.get(event_type, [])
            if handler in handlers:
                handlers.remove(handler)

    def emit(self, event: TranslationEvent) -> None:
        event_type = type(event)
        with self._lock:
            handlers = list(self._handlers.get(event_type, []))
        for handler in handlers:
            try:
                handler(event)
            except Exception as exc:
                _log.error(
                    "Handler error for %s: %s", event_type.__name__, exc
                )

    # ── Convenience emitters ───────────────────────────────────────────────────

    def language_changed(self, old: str, new: str) -> None:
        self.emit(LanguageChangedEvent(old_language=old, new_language=new))

    def translation_loaded(
        self, language: str, module: str, key_count: int, from_cache: bool
    ) -> None:
        self.emit(TranslationLoadedEvent(
            language=language, module=module,
            key_count=key_count, from_cache=from_cache,
        ))

    def translation_failed(
        self, language: str, module: str, dialogue_id: str, reason: str
    ) -> None:
        self.emit(TranslationFailedEvent(
            language=language, module=module,
            dialogue_id=dialogue_id, reason=reason,
        ))

    def fallback_activated(
        self,
        requested: str,
        resolved: str,
        module: str,
        dialogue_id: Optional[str] = None,
    ) -> None:
        self.emit(FallbackActivatedEvent(
            requested_language=requested,
            resolved_language=resolved,
            module=module,
            dialogue_id=dialogue_id,
        ))

    def cache_loaded(self, language: str, module: str) -> None:
        self.emit(CacheLoadedEvent(language=language, module=module))
