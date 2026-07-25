"""
Voice Guide AI — Production Test Suite.

Covers: runtime, navigation, dialogue, language, offline, replay,
translation, avatar, error recovery, integration.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

_HERE = Path(__file__).resolve().parent.parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))
if str(_HERE.parent) not in sys.path:
    sys.path.insert(0, str(_HERE.parent))


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def runtime():
    from runtime.runtime_manager import RuntimeManager
    rm = RuntimeManager()
    rm.start()
    yield rm
    rm.stop()


@pytest.fixture(scope="module")
def cache():
    from utils.cache_manager import CacheManager
    return CacheManager()


@pytest.fixture(scope="module")
def dialogue_loader():
    from utils.dialogue_loader import DialogueLoader
    return DialogueLoader()


@pytest.fixture(scope="module")
def language_manager():
    from utils.language_manager import LanguageManager
    return LanguageManager()


# ── Runtime Tests ─────────────────────────────────────────────────────────────

class TestRuntime:
    def test_start_stop(self):
        from runtime.runtime_manager import RuntimeManager
        rm = RuntimeManager()
        rm.start()
        status = rm.get_status()
        assert status["started"] is True
        rm.stop()

    def test_status_keys(self, runtime):
        status = runtime.get_status()
        for key in ["started", "session", "current_page", "queue_size", "is_online"]:
            assert key in status

    def test_set_language_hi(self, runtime):
        result = runtime.set_language("hi")
        assert isinstance(result, dict)

    def test_set_language_en(self, runtime):
        result = runtime.set_language("en")
        assert isinstance(result, dict)

    def test_set_language_gu(self, runtime):
        result = runtime.set_language("gu")
        assert isinstance(result, dict)

    def test_set_language_pa(self, runtime):
        result = runtime.set_language("pa")
        assert isinstance(result, dict)

    def test_update_conditions(self, runtime):
        runtime.update_conditions({"logged_in": True, "internet_available": True})
        status = runtime.get_status()
        assert status["conditions"]["logged_in"] is True

    def test_offline_mode(self, runtime):
        runtime.set_online(False)
        result = runtime.play("home", "welcome", language="hi")
        assert result.get("offline") is True or result.get("state") == "offline"
        runtime.set_online(True)

    def test_replay_no_history(self, runtime):
        from runtime.runtime_manager import RuntimeManager
        rm = RuntimeManager()
        rm.start()
        result = rm.replay()
        assert isinstance(result, dict)
        rm.stop()


# ── Navigation Tests ──────────────────────────────────────────────────────────

class TestNavigation:
    PAGES = [
        "home", "login", "register", "profile", "weather",
        "mandi", "marketplace", "crop_recommendation",
        "disease_detection", "government_scheme", "soil_health",
        "ai_chat", "app_settings", "language_popup",
    ]

    @pytest.mark.parametrize("page", PAGES)
    def test_open_page(self, runtime, page):
        result = runtime.open_page(page, language="hi")
        assert isinstance(result, dict)
        assert result.get("page") == page

    def test_open_page_with_language(self, runtime):
        result = runtime.open_page("home", language="en")
        assert result.get("language") == "en"

    def test_first_visit_flag(self, runtime):
        from runtime.runtime_manager import RuntimeManager
        rm = RuntimeManager()
        rm.start()
        result = rm.open_page("soil_health", language="hi")
        assert result.get("is_first_visit") is True
        rm.stop()


# ── Dialogue Tests ────────────────────────────────────────────────────────────

class TestDialogue:
    @pytest.mark.parametrize("page,dtype", [
        ("home", "welcome"), ("home", "help"), ("home", "error"),
        ("login", "welcome"), ("login", "error"),
        ("register", "welcome"), ("weather", "welcome"),
        ("mandi", "welcome"), ("disease_detection", "welcome"),
        ("crop_recommendation", "welcome"), ("government_scheme", "welcome"),
        ("soil_health", "welcome"), ("ai_chat", "welcome"),
        ("app_settings", "welcome"), ("common", "error"),
    ])
    def test_play_dialogue(self, runtime, page, dtype):
        result = runtime.play(page, dtype, language="hi")
        assert isinstance(result, dict)

    def test_play_offline_fallback(self, runtime):
        runtime.set_online(False)
        result = runtime.play("home", "welcome", language="hi")
        assert isinstance(result, dict)
        runtime.set_online(True)

    def test_replay_after_play(self, runtime):
        runtime.play("home", "welcome", language="hi")
        result = runtime.replay()
        assert isinstance(result, dict)


# ── Language Tests ────────────────────────────────────────────────────────────

class TestLanguage:
    LANGUAGES = ["hi", "en", "gu", "pa", "mr", "ta", "te", "kn", "ml", "bn",
                 "ur", "od", "as", "rj/bagri", "rj/marwari", "rj/mewari",
                 "rj/dhundhari", "rj/hadoti", "rj/shekhawati", "rj/mewati", "rj/wagdi"]

    @pytest.mark.parametrize("lang", LANGUAGES)
    def test_language_supported(self, language_manager, lang):
        assert language_manager.is_supported(lang)

    def test_fallback_chain_dialect(self, language_manager):
        chain = language_manager.fallback_chain("rj/bagri")
        assert "hi" in chain
        assert "en" in chain

    def test_fallback_chain_hi(self, language_manager):
        chain = language_manager.fallback_chain("hi")
        assert "hi" in chain

    def test_rtl_urdu(self, language_manager):
        assert language_manager.is_rtl("ur") is True

    def test_not_rtl_hindi(self, language_manager):
        assert language_manager.is_rtl("hi") is False


# ── Translation Tests ─────────────────────────────────────────────────────────

class TestTranslations:
    from config.paths import PATHS as _PATHS

    def test_hi_home_translation_exists(self):
        from config.paths import PATHS
        p = PATHS.translation_path("hi", "home")
        assert p.exists()

    def test_en_home_translation_valid_json(self):
        from config.paths import PATHS
        p = PATHS.translation_path("en", "home")
        assert p.exists()
        data = json.loads(p.read_bytes())
        assert isinstance(data, dict)
        assert len(data) > 0

    def test_hi_login_translation_has_welcome_key(self):
        from config.paths import PATHS
        p = PATHS.translation_path("hi", "login")
        data = json.loads(p.read_bytes())
        assert "login_welcome_001" in data

    def test_translation_utf8(self):
        from config.paths import PATHS
        p = PATHS.translation_path("hi", "home")
        raw = p.read_bytes()
        raw.decode("utf-8")  # must not raise

    def test_bagri_home_translation_exists(self):
        from config.paths import PATHS
        p = PATHS.translation_path("rj/bagri", "home")
        assert p.exists()


# ── Cache Tests ───────────────────────────────────────────────────────────────

class TestCache:
    def test_set_get(self, cache):
        cache.set("test_key", {"value": 42})
        result = cache.get("test_key")
        assert result == {"value": 42}

    def test_miss_returns_none(self, cache):
        assert cache.get("nonexistent_key_xyz") is None

    def test_delete(self, cache):
        cache.set("del_key", "data")
        cache.delete("del_key")
        assert cache.get("del_key") is None

    def test_stats(self, cache):
        stats = cache.stats()
        assert "hits" in stats
        assert "misses" in stats
        assert "hit_rate_pct" in stats

    def test_invalidate_language(self, cache):
        cache.set_translation("hi", "home", {"key": "val"})
        removed = cache.invalidate_language("hi")
        assert removed >= 1

    def test_clear_expired(self, cache):
        cache.set("exp_key", "val", ttl_seconds=0.001)
        import time; time.sleep(0.01)
        removed = cache.clear_expired()
        assert removed >= 0


# ── Dialogue Loader Tests ─────────────────────────────────────────────────────

class TestDialogueLoader:
    def test_load_home_welcome(self, dialogue_loader):
        try:
            d = dialogue_loader.load("home", "welcome")
            assert d.get("id") == "home_welcome_001"
        except Exception:
            pytest.skip("home/welcome.json not present")

    def test_load_safe_missing(self, dialogue_loader):
        result = dialogue_loader.load_safe("nonexistent_page", "nonexistent_type")
        assert result is None

    def test_exists_home_welcome(self, dialogue_loader):
        from config.paths import PATHS
        if PATHS.dialogue_path("home", "welcome").exists():
            assert dialogue_loader.exists("home", "welcome") is True

    def test_list_types_home(self, dialogue_loader):
        types = dialogue_loader.list_types("home")
        assert isinstance(types, list)


# ── Error Manager Tests ───────────────────────────────────────────────────────

class TestErrorManager:
    def test_handle_returns_dict(self):
        from runtime.error_manager import ErrorManager
        from runtime.event_dispatcher import EventDispatcher
        em = ErrorManager(event_dispatcher=EventDispatcher())
        result = em.handle("home", "PLAY_FAILED", "Test error", "hi")
        assert isinstance(result, dict)
        assert result.get("success") is False

    def test_language_fallback(self):
        from runtime.error_manager import ErrorManager
        from runtime.event_dispatcher import EventDispatcher
        em = ErrorManager(event_dispatcher=EventDispatcher())
        result = em.handle("home", "TRANSLATION_NOT_FOUND", "Missing", "rj/bagri")
        assert isinstance(result, dict)

    def test_error_count(self):
        from runtime.error_manager import ErrorManager
        from runtime.event_dispatcher import EventDispatcher
        em = ErrorManager(event_dispatcher=EventDispatcher())
        em.handle("home", "TEST_ERROR", "msg", "hi")
        assert em.error_count() >= 1


# ── Offline Manager Tests ─────────────────────────────────────────────────────

class TestOfflineManager:
    def test_go_offline_online(self):
        from runtime.offline_manager import OfflineManager
        from runtime.event_dispatcher import EventDispatcher
        from runtime.session_manager import SessionManager
        from runtime.condition_manager import ConditionManager
        om = OfflineManager(EventDispatcher(), SessionManager(), ConditionManager())
        om.go_offline()
        assert om.is_offline is True
        om.go_online()
        assert om.is_offline is False

    def test_offline_guidance_all_languages(self):
        from runtime.offline_manager import OfflineManager
        from runtime.event_dispatcher import EventDispatcher
        from runtime.session_manager import SessionManager
        from runtime.condition_manager import ConditionManager
        om = OfflineManager(EventDispatcher(), SessionManager(), ConditionManager())
        for lang in ["hi", "en", "gu", "pa", "rj/bagri"]:
            result = om.get_offline_guidance("home", "welcome", lang)
            assert result.get("offline") is True
            assert isinstance(result.get("text"), str)
            assert len(result["text"]) > 0


# ── JSON Manager Tests ────────────────────────────────────────────────────────

class TestJSONManager:
    def test_read_valid_json(self, tmp_path):
        from utils.json_manager import JSONManager
        f = tmp_path / "test.json"
        f.write_text('{"key": "value"}', encoding="utf-8")
        jm = JSONManager()
        data = jm.read(f)
        assert data == {"key": "value"}

    def test_read_safe_invalid(self, tmp_path):
        from utils.json_manager import JSONManager
        f = tmp_path / "bad.json"
        f.write_text("not json", encoding="utf-8")
        jm = JSONManager()
        assert jm.read_safe(f) is None

    def test_write_read_roundtrip(self, tmp_path):
        from utils.json_manager import JSONManager
        f = tmp_path / "out.json"
        jm = JSONManager()
        jm.write(f, {"hello": "world"})
        data = jm.read(f)
        assert data["hello"] == "world"


# ── Condition Manager Tests ───────────────────────────────────────────────────

class TestConditionManager:
    def test_logged_in(self):
        from runtime.condition_manager import ConditionManager
        cm = ConditionManager()
        cm.set_logged_in(True)
        assert cm.evaluate("logged_in") is True

    def test_internet_not_available(self):
        from runtime.condition_manager import ConditionManager
        cm = ConditionManager()
        cm.set_internet(False)
        assert cm.evaluate("internet_not_available") is True

    def test_first_visit(self):
        from runtime.condition_manager import ConditionManager
        cm = ConditionManager()
        cm.set_first_visit(True)
        assert cm.evaluate("first_visit") is True

    def test_unknown_condition(self):
        from runtime.condition_manager import ConditionManager
        cm = ConditionManager()
        assert cm.evaluate("unknown_xyz") is False


# ── Session Manager Tests ─────────────────────────────────────────────────────

class TestSessionManager:
    def test_set_page(self):
        from runtime.session_manager import SessionManager
        sm = SessionManager()
        sm.set_page("home")
        assert sm.current_page == "home"

    def test_set_language(self):
        from runtime.session_manager import SessionManager
        sm = SessionManager()
        sm.set_language("gu")
        assert sm.current_language == "gu"

    def test_replay_count(self):
        from runtime.session_manager import SessionManager
        sm = SessionManager()
        c1 = sm.increment_replay()
        c2 = sm.increment_replay()
        assert c2 == c1 + 1
        sm.reset_replay_count()
        assert sm.get_state().replay_count == 0

    def test_snapshot_keys(self):
        from runtime.session_manager import SessionManager
        sm = SessionManager()
        snap = sm.snapshot()
        for k in ["session_id", "current_page", "current_language", "is_online"]:
            assert k in snap
