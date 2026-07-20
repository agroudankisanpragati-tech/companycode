# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: knowledge_base/weather.py
# Purpose: Weather module handler. Converts UNIX timestamps to human-readable
#          dates. Asks follow-up when no location provided.
# =============================================================================

from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import Any

from knowledge_base._base import _lang, _text, build_response
from knowledge_base.routing_logger import log_routing
from knowledge_base.session_store import Slot, get_session_store

_MODULE_ID = "weather"
_log = logging.getLogger("akp.kb.weather")

# Day names
_DAYS_HI = ["सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार", "रविवार"]
_DAYS_EN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
_MONTHS_HI = [
    "जनवरी", "फरवरी", "मार्च", "अप्रैल", "मई", "जून",
    "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर",
]
_MONTHS_EN = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


def _ts_to_label(ts: Any, lang: str, today_ts: int) -> str:
    """
    Converts a UNIX timestamp (or date_epoch) to a human-readable label.
    Returns 'Today', 'Tomorrow', 'Day after tomorrow', or 'Monday 22 July'.
    """
    try:
        ts_int = int(ts)
        dt = datetime.fromtimestamp(ts_int, tz=timezone.utc)
        today = datetime.fromtimestamp(today_ts, tz=timezone.utc).date()
        diff = (dt.date() - today).days

        if lang == "hi":
            if diff == 0:
                return "आज"
            elif diff == 1:
                return "कल"
            elif diff == 2:
                return "परसों"
            else:
                day_name = _DAYS_HI[dt.weekday()]
                month_name = _MONTHS_HI[dt.month - 1]
                return f"{day_name} {dt.day} {month_name}"
        else:
            if diff == 0:
                return "Today"
            elif diff == 1:
                return "Tomorrow"
            elif diff == 2:
                return "Day after tomorrow"
            else:
                day_name = _DAYS_EN[dt.weekday()]
                month_name = _MONTHS_EN[dt.month - 1]
                return f"{day_name} {dt.day} {month_name}"
    except Exception:
        return str(ts)


def handle(request: dict[str, Any]) -> dict[str, Any]:
    lang       = _lang(request)
    text       = _text(request)
    intent     = request.get("intent", "weather")
    session_id = request.get("session_id", "")
    location   = request.get("location", {})

    store = get_session_store()

    _log.info(
        "WEATHER_HANDLER | session=%s | raw_text='%s' | lang=%s",
        session_id, text, lang,
    )

    # ── Extract location hint from request or session ─────────────────
    district = ""
    if isinstance(location, dict):
        district = location.get("district") or location.get("state") or ""
    if not district:
        stored_loc = store.get(session_id, Slot.LOCATION)
        if isinstance(stored_loc, dict):
            district = stored_loc.get("district") or stored_loc.get("state") or ""

    # ── Check if weather data is embedded in request extra ────────────
    extra_data = request.get("extra", {}) or {}
    weather_data = extra_data.get("weather_data") or {}

    today_ts = int(datetime.now(timezone.utc).timestamp())

    # ── If we have live weather data with daily forecast ─────────────
    if weather_data and weather_data.get("daily"):
        daily = weather_data["daily"]
        current = weather_data.get("current", {})
        loc_name = ""
        if isinstance(weather_data.get("location"), dict):
            loc_name = weather_data["location"].get("name", "") or district
        else:
            loc_name = district

        if lang == "hi":
            parts = [f"🌤️ {loc_name} मौसम पूर्वानुमान" if loc_name else "🌤️ मौसम पूर्वानुमान"]
            if current:
                temp = current.get("temp", "")
                humidity = current.get("humidity", "")
                cond = ""
                if isinstance(current.get("weather"), dict):
                    cond = current["weather"].get("text", "")
                parts.append(
                    f"🌡️ अभी: {temp}°C | 💧 नमी: {humidity}% | {cond}"
                )
            parts.append("\n📅 7 दिन का पूर्वानुमान:")
            for day in daily[:7]:
                label = _ts_to_label(day.get("dt", 0), lang, today_ts)
                t_min = day.get("temp", {}).get("min", "")
                t_max = day.get("temp", {}).get("max", "")
                pop = day.get("pop", 0)
                cond = ""
                if isinstance(day.get("weather"), dict):
                    cond = day["weather"].get("text", "")
                rain_pct = round(float(pop) * 100) if pop else 0
                parts.append(
                    f"  {label}: {t_min}°C–{t_max}°C | {cond}"
                    + (f" | 🌧️ बारिश: {rain_pct}%" if rain_pct > 10 else "")
                )
            msg = "\n".join(parts)
            suggestions = ["मौसम पेज खोलें", "अपना जिला बताएं", "7 दिन का पूर्वानुमान"]
        else:
            parts = [f"🌤️ Weather Forecast — {loc_name}" if loc_name else "🌤️ Weather Forecast"]
            if current:
                temp = current.get("temp", "")
                humidity = current.get("humidity", "")
                cond = ""
                if isinstance(current.get("weather"), dict):
                    cond = current["weather"].get("text", "")
                parts.append(f"🌡️ Now: {temp}°C | 💧 Humidity: {humidity}% | {cond}")
            parts.append("\n📅 7-Day Forecast:")
            for day in daily[:7]:
                label = _ts_to_label(day.get("dt", 0), lang, today_ts)
                t_min = day.get("temp", {}).get("min", "")
                t_max = day.get("temp", {}).get("max", "")
                pop = day.get("pop", 0)
                cond = ""
                if isinstance(day.get("weather"), dict):
                    cond = day["weather"].get("text", "")
                rain_pct = round(float(pop) * 100) if pop else 0
                parts.append(
                    f"  {label}: {t_min}°C–{t_max}°C | {cond}"
                    + (f" | 🌧️ Rain: {rain_pct}%" if rain_pct > 10 else "")
                )
            msg = "\n".join(parts)
            suggestions = ["Open weather page", "Provide your district", "7-day forecast"]

        log_routing(
            intent=intent, module=_MODULE_ID, kb_hit=True,
            weather_used=True, session_id=session_id,
            text_snippet=text[:60], extra=f"district={loc_name} live_data=True",
        )
        return build_response(_MODULE_ID, intent, lang, msg, suggestions=suggestions)

    # ── No live data — ask for location or redirect to weather page ───
    if not district:
        if lang == "hi":
            msg = (
                "🌤️ मौसम जानकारी\n"
                "किस जिले/शहर का मौसम जानना चाहते हैं?\n\n"
                "उदाहरण: जयपुर, जोधपुर, दिल्ली, मुंबई"
            )
            suggestions = ["मौसम पेज खोलें", "अपना जिला बताएं", "7 दिन का पूर्वानुमान"]
        else:
            msg = (
                "🌤️ Weather Information\n"
                "Which district/city weather would you like to know?\n\n"
                "Example: Jaipur, Jodhpur, Delhi, Mumbai"
            )
            suggestions = ["Open weather page", "Provide your district", "7-day forecast"]
    else:
        if lang == "hi":
            msg = (
                f"🌤️ {district} का मौसम पूर्वानुमान\n"
                "लाइव मौसम जानकारी के लिए वेदर पेज पर जाएं।\n"
                "📱 अपना स्थान शेयर करें बेहतर पूर्वानुमान के लिए।"
            )
            suggestions = ["मौसम पेज खोलें", "अपना जिला बताएं", "7 दिन का पूर्वानुमान"]
        else:
            msg = (
                f"🌤️ Weather forecast for {district}\n"
                "Visit the weather page for live forecast.\n"
                "📱 Share your location for better predictions."
            )
            suggestions = ["Open weather page", "Provide your district", "7-day forecast"]

    log_routing(
        intent=intent, module=_MODULE_ID, kb_hit=False,
        weather_used=True, session_id=session_id,
        text_snippet=text[:60], extra=f"district={district}",
    )
    return build_response(_MODULE_ID, intent, lang, msg, suggestions=suggestions)
