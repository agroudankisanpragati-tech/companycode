# =============================================================================
# AKP — Agroudan Kisan Pragati
# Package: pragati_ai_controller
# =============================================================================

from __future__ import annotations

__version__: str = "1.0.0"
__author__:  str = "AKP Engineering"

from pragati_ai_controller.config import (
    CONTROLLER_VERSION,
    INPUT_TYPE_IMAGE,
    INPUT_TYPE_TEXT,
    INPUT_TYPE_VOICE,
    PragatiAIConfig,
    get_config,
)
from pragati_ai_controller.controller import (
    PragatiAIController,
    detect_input_type,
    get_controller,
    process,
)
from pragati_ai_controller.ai_manager import AIManager, get_ai_manager
from pragati_ai_controller.conversation_manager import ConversationManager, get_conversation_manager
from pragati_ai_controller.language_manager import LanguageManager, get_language_manager
from pragati_ai_controller.memory_manager import MemoryManager, get_memory_manager
from pragati_ai_controller.context_manager import ContextManager, get_context_manager
from pragati_ai_controller.response_generator import ResponseGenerator, get_response_generator
from pragati_ai_controller.pipeline import (
    TextPipeline, VoicePipeline, ImagePipeline,
    get_text_pipeline, get_voice_pipeline, get_image_pipeline,
)
from pragati_ai_controller.startup_validator import run_startup_validation

__all__ = [
    # config
    "CONTROLLER_VERSION", "INPUT_TYPE_TEXT", "INPUT_TYPE_VOICE", "INPUT_TYPE_IMAGE",
    "PragatiAIConfig", "get_config",
    # controller
    "PragatiAIController", "detect_input_type", "get_controller", "process",
    # managers
    "AIManager", "get_ai_manager",
    "ConversationManager", "get_conversation_manager",
    "LanguageManager", "get_language_manager",
    "MemoryManager", "get_memory_manager",
    "ContextManager", "get_context_manager",
    "ResponseGenerator", "get_response_generator",
    # pipelines
    "TextPipeline", "VoicePipeline", "ImagePipeline",
    "get_text_pipeline", "get_voice_pipeline", "get_image_pipeline",
    # startup
    "run_startup_validation",
]
