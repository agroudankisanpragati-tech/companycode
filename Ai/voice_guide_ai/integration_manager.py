"""
Voice Guide AI — Production Integration Manager.

Connects Voice Guide AI runtime to:
  * Backend Node.js API (via HTTP)
  * Frontend React hooks (via WebSocket events)
  * AI modules (intent engine, knowledge base)

Thread-safe. Never raises to callers — always returns safe results.
"""

from __future__ import annotations

import threading
from typing import Any, Optional

from config.logger import get_logger
from config.settings import SETTINGS

_log = get_logger("integration_manager")


class BackendIntegration:
    """
    HTTP client for the Node.js backend API.

    All methods return safe dicts — never raise.
    """

    def __init__(self, base_url: str = "http://localhost:5000") -> None:
        self._base_url = base_url.rstrip("/")
        self._session: Optional[Any] = None
        self._lock = threading.Lock()

    def _get_session(self) -> Any:
        """Lazy-init httpx client."""
        with self._lock:
            if self._session is None:
                try:
                    import httpx
                    self._session = httpx.Client(
                        base_url=self._base_url,
                        timeout=10.0,
                        headers={"Content-Type": "application/json"},
                    )
                except ImportError:
                    _log.warning("httpx not installed — backend integration disabled.")
                    self._session = None
        return self._session

    def get_user_profile(self, user_id: str) -> dict[str, Any]:
        """Fetch farmer profile from backend."""
        try:
            client = self._get_session()
            if client is None:
                return {}
            resp = client.get(f"/api/users/{user_id}")
            if resp.status_code == 200:
                return resp.json()
        except Exception as exc:
            _log.warning("get_user_profile failed: %s", exc)
        return {}

    def get_weather(self, location: str, language: str = "hi") -> dict[str, Any]:
        """Fetch weather data from backend."""
        try:
            client = self._get_session()
            if client is None:
                return {}
            resp = client.get(f"/api/weather", params={"location": location, "lang": language})
            if resp.status_code == 200:
                return resp.json()
        except Exception as exc:
            _log.warning("get_weather failed: %s", exc)
        return {}

    def get_mandi_prices(self, crop: str, market: str, language: str = "hi") -> dict[str, Any]:
        """Fetch mandi price data from backend."""
        try:
            client = self._get_session()
            if client is None:
                return {}
            resp = client.get(
                "/api/mandi",
                params={"crop": crop, "market": market, "lang": language},
            )
            if resp.status_code == 200:
                return resp.json()
        except Exception as exc:
            _log.warning("get_mandi_prices failed: %s", exc)
        return {}

    def get_government_schemes(self, language: str = "hi") -> dict[str, Any]:
        """Fetch government schemes from backend."""
        try:
            client = self._get_session()
            if client is None:
                return {}
            resp = client.get("/api/schemes", params={"lang": language})
            if resp.status_code == 200:
                return resp.json()
        except Exception as exc:
            _log.warning("get_government_schemes failed: %s", exc)
        return {}

    def health_check(self) -> bool:
        """Return True if backend is reachable."""
        try:
            client = self._get_session()
            if client is None:
                return False
            resp = client.get("/health", timeout=3.0)
            return resp.status_code == 200
        except Exception:
            return False

    def close(self) -> None:
        with self._lock:
            if self._session is not None:
                try:
                    self._session.close()
                except Exception:
                    pass
                self._session = None


class IntegrationManager:
    """
    Central integration facade for Voice Guide AI.

    Provides safe access to backend, AI modules, and context enrichment.
    Thread-safe singleton pattern.
    """

    _instance: Optional["IntegrationManager"] = None
    _lock = threading.Lock()

    def __init__(self) -> None:
        import os
        backend_url = os.getenv("BACKEND_API_URL", "http://localhost:5000")
        self._backend = BackendIntegration(base_url=backend_url)
        self._context_cache: dict[str, Any] = {}
        self._cache_lock = threading.Lock()

    @classmethod
    def get_instance(cls) -> "IntegrationManager":
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
        return cls._instance

    def enrich_context(
        self,
        page: str,
        language: str,
        user_id: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Build enriched context for dialogue condition evaluation.

        Merges backend data with local runtime state.
        Never raises — returns minimal context on any failure.
        """
        ctx: dict[str, Any] = {
            "page": page,
            "language": language,
            "user_id": user_id,
        }

        if user_id:
            cache_key = f"profile:{user_id}"
            with self._cache_lock:
                cached = self._context_cache.get(cache_key)
            if cached:
                ctx.update(cached)
            else:
                profile = self._backend.get_user_profile(user_id)
                if profile:
                    enriched = {
                        "logged_in": True,
                        "farmer_profile_complete": bool(profile.get("profileComplete")),
                        "farmer_id": profile.get("_id", ""),
                        "location": profile.get("location", ""),
                        "crop_type": profile.get("cropType", ""),
                    }
                    with self._cache_lock:
                        self._context_cache[cache_key] = enriched
                    ctx.update(enriched)

        return ctx

    def invalidate_user_cache(self, user_id: str) -> None:
        with self._cache_lock:
            self._context_cache.pop(f"profile:{user_id}", None)

    def backend_health(self) -> bool:
        return self._backend.health_check()

    @property
    def backend(self) -> BackendIntegration:
        return self._backend

    def shutdown(self) -> None:
        self._backend.close()
        _log.info("IntegrationManager shutdown.")
