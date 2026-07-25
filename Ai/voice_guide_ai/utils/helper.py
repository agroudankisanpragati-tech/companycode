"""
Voice Guide AI — Helper Utilities.

Stateless utility functions used across the module:
  * Timestamps and date formatting
  * Unique ID generation
  * String slugification
  * Safe nested dict access
  * Duration formatting
"""

from __future__ import annotations

import hashlib
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Optional


class Helper:
    """
    Collection of stateless utility helpers.

    All methods are static — no instance state required.
    """

    # ── Time ──────────────────────────────────────────────────────────────────

    @staticmethod
    def current_timestamp() -> str:
        """Return the current UTC time as an ISO-8601 string."""
        return datetime.now(tz=timezone.utc).isoformat()

    @staticmethod
    def current_time() -> str:
        """Return the current local time as ``HH:MM:SS``."""
        return datetime.now().strftime("%H:%M:%S")

    @staticmethod
    def current_date() -> str:
        """Return the current local date as ``YYYY-MM-DD``."""
        return datetime.now().strftime("%Y-%m-%d")

    @staticmethod
    def current_datetime() -> str:
        """Return the current local datetime as ``YYYY-MM-DD HH:MM:SS``."""
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    @staticmethod
    def format_duration(seconds: float) -> str:
        """
        Format *seconds* as a human-readable duration string.

        Examples: ``"1h 23m 45s"``, ``"45s"``, ``"0s"``
        """
        seconds = max(0.0, seconds)
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = int(seconds % 60)
        parts: list[str] = []
        if h:
            parts.append(f"{h}h")
        if m:
            parts.append(f"{m}m")
        parts.append(f"{s}s")
        return " ".join(parts)

    # ── ID generation ─────────────────────────────────────────────────────────

    @staticmethod
    def generate_id() -> str:
        """Return a new random UUID4 string (no hyphens)."""
        return uuid.uuid4().hex

    @staticmethod
    def generate_short_id(length: int = 8) -> str:
        """Return a short random hex ID of *length* characters."""
        return uuid.uuid4().hex[:length]

    @staticmethod
    def generate_deterministic_id(seed: str) -> str:
        """
        Return a deterministic ID derived from *seed* using SHA-256.

        Useful for stable IDs based on content (e.g. dialogue text).
        """
        return hashlib.sha256(seed.encode("utf-8")).hexdigest()[:16]

    # ── String utilities ──────────────────────────────────────────────────────

    @staticmethod
    def slugify(text: str) -> str:
        """
        Convert *text* to a URL/filename-safe slug.

        Example: ``"Hello World!"`` → ``"hello-world"``
        """
        text = text.lower().strip()
        text = re.sub(r"[^\w\s-]", "", text)
        text = re.sub(r"[\s_]+", "-", text)
        text = re.sub(r"-+", "-", text)
        return text.strip("-")

    @staticmethod
    def truncate(text: str, max_length: int = 100, suffix: str = "…") -> str:
        """Truncate *text* to *max_length* characters, appending *suffix*."""
        if len(text) <= max_length:
            return text
        return text[: max_length - len(suffix)] + suffix

    @staticmethod
    def safe_str(value: Any, default: str = "") -> str:
        """Return str(*value*) or *default* if value is None."""
        if value is None:
            return default
        return str(value)

    # ── Dict utilities ────────────────────────────────────────────────────────

    @staticmethod
    def deep_get(data: dict[str, Any], *keys: str, default: Any = None) -> Any:
        """
        Safely retrieve a nested value from *data* using *keys*.

        Example::

            deep_get(config, "voice", "speed", default=1.0)
        """
        current: Any = data
        for key in keys:
            if not isinstance(current, dict):
                return default
            current = current.get(key, default)
            if current is default:
                return default
        return current

    @staticmethod
    def flatten_dict(
        data: dict[str, Any],
        parent_key: str = "",
        separator: str = ".",
    ) -> dict[str, Any]:
        """
        Flatten a nested dict into a single-level dict with dotted keys.

        Example::

            {"a": {"b": 1}} → {"a.b": 1}
        """
        items: list[tuple[str, Any]] = []
        for k, v in data.items():
            new_key = f"{parent_key}{separator}{k}" if parent_key else k
            if isinstance(v, dict):
                items.extend(
                    Helper.flatten_dict(v, new_key, separator).items()
                )
            else:
                items.append((new_key, v))
        return dict(items)

    @staticmethod
    def merge_dicts(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
        """
        Deep-merge *override* into *base*.

        Values in *override* take precedence.  Nested dicts are merged
        recursively; all other types are replaced.
        """
        result = base.copy()
        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = Helper.merge_dicts(result[key], value)
            else:
                result[key] = value
        return result

    # ── Misc ──────────────────────────────────────────────────────────────────

    @staticmethod
    def is_empty(value: Any) -> bool:
        """Return True if *value* is None, empty string, empty list, or empty dict."""
        if value is None:
            return True
        if isinstance(value, (str, list, dict)):
            return len(value) == 0
        return False

    @staticmethod
    def coerce_bool(value: Any) -> bool:
        """
        Coerce common truthy string representations to bool.

        ``"true"``, ``"1"``, ``"yes"``, ``"on"`` → True; everything else → False.
        """
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.strip().lower() in ("true", "1", "yes", "on")
        return bool(value)

    @staticmethod
    def chunk_list(items: list[Any], size: int) -> list[list[Any]]:
        """Split *items* into chunks of *size*."""
        if size <= 0:
            raise ValueError("Chunk size must be positive.")
        return [items[i: i + size] for i in range(0, len(items), size)]
