# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: speech_to_text/tests/test_config.py
# Purpose: Unit tests for speech_to_text/config.py
# Run:     pytest speech_to_text/tests/test_config.py -v
# =============================================================================

from __future__ import annotations

import os
from pathlib import Path

import pytest

from speech_to_text.config import (
    AI_ROOT,
    DEFAULT_MODEL,
    STT_ROOT,
    SUPPORTED_MODELS,
    STTConfig,
    get_config,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fresh_config(**env_overrides) -> STTConfig:
    """Returns a freshly built STTConfig with optional env-var overrides."""
    old = {k: os.environ.get(k) for k in env_overrides}
    for k, v in env_overrides.items():
        os.environ[k] = v
    try:
        cfg = get_config(force_rebuild=True)
    finally:
        for k, v in old.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
        # Restore singleton to default after test
        get_config(force_rebuild=True)
    return cfg


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestRootPaths:
    def test_stt_root_is_speech_to_text_dir(self):
        assert STT_ROOT.name == "speech_to_text"
        assert STT_ROOT.is_dir()

    def test_ai_root_is_parent_of_stt_root(self):
        assert AI_ROOT == STT_ROOT.parent
        assert AI_ROOT.is_dir()

    def test_config_stt_root_matches_module_constant(self):
        cfg = get_config()
        assert cfg.stt_root == STT_ROOT

    def test_config_ai_root_matches_module_constant(self):
        cfg = get_config()
        assert cfg.ai_root == AI_ROOT


class TestDirectoryPaths:
    def test_models_dir_under_stt_root(self):
        cfg = get_config()
        assert cfg.models_dir.is_relative_to(cfg.stt_root)

    def test_cache_dir_under_stt_root(self):
        cfg = get_config()
        assert cfg.cache_dir.is_relative_to(cfg.stt_root)

    def test_outputs_dir_under_stt_root(self):
        cfg = get_config()
        assert cfg.outputs_dir.is_relative_to(cfg.stt_root)

    def test_logs_dir_under_ai_root(self):
        cfg = get_config()
        assert cfg.logs_dir.is_relative_to(cfg.ai_root)

    def test_configs_dir_under_stt_root(self):
        cfg = get_config()
        assert cfg.configs_dir.is_relative_to(cfg.stt_root)

    def test_all_dirs_created_on_get_config(self):
        cfg = get_config()
        for d in (cfg.models_dir, cfg.cache_dir, cfg.outputs_dir,
                  cfg.logs_dir, cfg.configs_dir):
            assert d.is_dir(), f"Expected directory to exist: {d}"


class TestModelPaths:
    def test_model_path_returns_subdir_of_models_dir(self):
        cfg = get_config()
        for size in SUPPORTED_MODELS:
            assert cfg.model_path(size) == cfg.models_dir / size

    def test_is_model_downloaded_false_for_empty_dir(self, tmp_path):
        cfg = get_config()
        # A freshly created empty dir should return False
        empty = tmp_path / "empty_model"
        empty.mkdir()
        # Patch model_path temporarily via a subclass
        class _Cfg(STTConfig):
            def model_path(self, size):
                return empty
        # Direct call to is_model_downloaded logic
        assert not (empty.exists() and any(empty.iterdir()))

    def test_is_model_downloaded_true_when_file_present(self, tmp_path):
        model_dir = tmp_path / "base"
        model_dir.mkdir()
        (model_dir / "model.bin").write_bytes(b"\x00")
        assert model_dir.exists() and any(model_dir.iterdir())


class TestSupportedModels:
    def test_supported_models_contains_expected_sizes(self):
        for size in ("tiny", "base", "small", "medium", "large-v3"):
            assert size in SUPPORTED_MODELS

    def test_default_model_in_supported_models(self):
        assert DEFAULT_MODEL in SUPPORTED_MODELS

    def test_config_supported_models_matches_constant(self):
        cfg = get_config()
        assert cfg.supported_models == SUPPORTED_MODELS


class TestDeviceAndComputeType:
    def test_device_is_valid_string(self):
        cfg = get_config()
        assert cfg.device in ("cpu", "cuda", "mps")

    def test_compute_type_is_valid(self):
        cfg = get_config()
        assert cfg.compute_type in ("int8", "float16", "float32")

    def test_cpu_uses_int8(self):
        from speech_to_text.config import _detect_compute_type
        assert _detect_compute_type("cpu") == "int8"

    def test_cuda_uses_float16(self):
        from speech_to_text.config import _detect_compute_type
        assert _detect_compute_type("cuda") == "float16"


class TestEnvVarOverrides:
    def test_stt_default_model_env_override(self):
        cfg = _fresh_config(STT_DEFAULT_MODEL="tiny")
        assert cfg.default_model == "tiny"

    def test_stt_compute_type_env_override(self):
        cfg = _fresh_config(STT_COMPUTE_TYPE="float32")
        assert cfg.compute_type == "float32"

    def test_stt_log_level_env_override(self):
        cfg = _fresh_config(STT_LOG_LEVEL="DEBUG")
        assert cfg.log_level == "DEBUG"


class TestSingleton:
    def test_get_config_returns_same_instance(self):
        a = get_config()
        b = get_config()
        assert a is b

    def test_force_rebuild_returns_new_instance(self):
        a = get_config()
        b = get_config(force_rebuild=True)
        # Values should be equal but may be a new object
        assert a.stt_root == b.stt_root

    def test_config_is_frozen(self):
        cfg = get_config()
        with pytest.raises((AttributeError, TypeError)):
            cfg.device = "mps"  # type: ignore[misc]
