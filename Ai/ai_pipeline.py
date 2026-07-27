# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: ai_pipeline.py
# Purpose: Modular, stage-based prediction workflow.
#
# PIPELINE:
#   Image
#     ↓  ValidationStage    — path + format + size checks
#     ↓  PreprocessingStage — load + validate pixel data
#     ↓  PredictionStage    — YOLO inference (farmer crop — MANDATORY)
#     ↓  KnowledgeStage     — MongoDB lookup (farmer crop only)
#     ↓  FormatterStage     — build final JSON-ready response
#     ↓
#   ControllerResponse
#
# AUTHORITY MODEL:
#   Farmer-selected crop is the ONLY source of truth.
#   Crop Verification AI (EfficientNet) is NOT used in this pipeline.
#   YOLO and KnowledgeBase both receive the farmer-selected crop.
#
# DESIGN:
#   • Every stage implements PipelineStage (Single Responsibility).
#   • AIPipeline composes stages via dependency injection.
#   • PipelineContext is the shared state object passed through all stages.
#   • A stage sets context.failed = True + context.error to abort early.
#
# Dependencies: ai_controller.py, inference_service.py, knowledge_service.py,
#               preprocessing.py, config.py, logger.py
# =============================================================================

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from ai_controller import (
    ControllerResponse,
    KnowledgePayload,
    PredictionPayload,
    _build_knowledge_payload,
    _build_prediction_payload,
    _empty_knowledge,
    _empty_prediction,
    _error_response,
)
from config import get_config
from constants import PROJECT_VERSION, SUPPORTED_IMAGE_EXTENSIONS
from inference_service import InferenceService
from knowledge_service import KnowledgeService
from logger import get_logger
from preprocessing import load_image, validate_array

log = get_logger(__name__)


# =============================================================================
# SECTION 1 — PIPELINE CONTEXT
# =============================================================================

@dataclass
class PipelineContext:
    """
    Shared state object passed through every pipeline stage.

    Fields:
        image_path      — Absolute path to the input image.
        analysis_type   — Analysis type (e.g. "disease_pest").
        language        — Desired language for knowledge content.
        weights_path    — Optional model weights path override.
        device          — Optional device override.
        farmer_crop     — Crop selected by the farmer (MANDATORY, only source of truth).
                          Used by YOLO and KnowledgeBase.
        t_start         — perf_counter timestamp at pipeline entry.
        failed          — True if any stage has aborted the pipeline.
        error           — Abort reason string (if failed).
        prediction_dict — Raw PredictionResult dict from InferenceService.
        knowledge_dict  — Raw KnowledgeResult dict from KnowledgeService.
        prediction      — Typed PredictionPayload (built by FormatterStage).
        knowledge       — Typed KnowledgePayload (built by FormatterStage).
    """
    image_path:      str
    analysis_type:   str                         = "disease_pest"
    language:        str                         = "en"
    weights_path:    Optional[str]               = None
    device:          Optional[str]               = None
    farmer_crop:     Optional[str]               = None
    t_start:         float                       = field(default_factory=time.perf_counter)
    failed:          bool                        = False
    error:           Optional[str]               = None
    prediction_dict: dict                        = field(default_factory=dict)
    knowledge_dict:  dict                        = field(default_factory=dict)
    prediction:      Optional[PredictionPayload] = None
    knowledge:       Optional[KnowledgePayload]  = None

    def abort(self, reason: str) -> None:
        self.failed = True
        self.error  = reason
        log.warning("Pipeline aborted [%s]: %s", self.analysis_type, reason)

    @property
    def elapsed_ms(self) -> float:
        return (time.perf_counter() - self.t_start) * 1000.0


# =============================================================================
# SECTION 2 — STAGE INTERFACE
# =============================================================================

class PipelineStage(ABC):
    """Abstract base class for all pipeline stages."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable name of this stage (used in logs)."""

    @abstractmethod
    def process(self, context: PipelineContext) -> None:
        """
        Executes this stage's logic.
        Read inputs from context, write outputs back.
        Call context.abort(reason) on unrecoverable failure.
        """


# =============================================================================
# SECTION 3 — CONCRETE STAGES
# =============================================================================

class ValidationStage(PipelineStage):
    """Stage 1 — Validates image path before any I/O or model work."""

    @property
    def name(self) -> str:
        return "ValidationStage"

    def process(self, context: PipelineContext) -> None:
        path_str = context.image_path

        if not path_str or not path_str.strip():
            context.abort("image_path must not be empty")
            return

        path = Path(path_str)

        if not path.exists():
            context.abort(f"Image file not found: {path_str}")
            return
        if not path.is_file():
            context.abort(f"Path is not a file: {path_str}")
            return
        if path.suffix.lower() not in SUPPORTED_IMAGE_EXTENSIONS:
            context.abort(
                f"Unsupported image format '{path.suffix}'. "
                f"Supported: {', '.join(SUPPORTED_IMAGE_EXTENSIONS)}"
            )
            return
        if path.stat().st_size == 0:
            context.abort(f"Image file is empty: {path_str}")
            return

        log.debug("ValidationStage: OK — %s", path.name)


class PreprocessingStage(PipelineStage):
    """Stage 2 — Loads image and validates pixel data integrity."""

    @property
    def name(self) -> str:
        return "PreprocessingStage"

    def process(self, context: PipelineContext) -> None:
        path  = Path(context.image_path)
        array = load_image(path)

        if array is None:
            context.abort(f"Cannot load image — file may be corrupted: {path.name}")
            return
        if not validate_array(array, path):
            context.abort(f"Invalid image array — unexpected shape or dtype: {path.name}")
            return

        log.debug("PreprocessingStage: OK — %s  shape=%s", path.name, array.shape)


class PredictionStage(PipelineStage):
    """
    Stage 3 — Runs YOLO inference via InferenceService.

    Uses context.farmer_crop (MANDATORY, only source of truth) for the
    crop field in prediction_dict. Disease detection always uses the
    farmer-selected crop. No Crop Verification AI is involved.

    Args:
        inference_service: InferenceService instance (injectable for testing).
    """

    def __init__(self, inference_service: Optional[InferenceService] = None) -> None:
        self._inference = inference_service or InferenceService()

    @property
    def name(self) -> str:
        return "PredictionStage"

    def process(self, context: PipelineContext) -> None:
        response = self._inference.predict_single(context.image_path)

        if not response.success:
            context.abort(f"Inference service error: {response.error}")
            return

        prediction_dict: dict = response.data or {}

        # Farmer crop is the ONLY source of truth — always inject it
        if context.farmer_crop:
            prediction_dict = {**prediction_dict, "crop": context.farmer_crop}
            log.debug(
                "PredictionStage: crop set to farmer selection='%s'",
                context.farmer_crop,
            )

        context.prediction_dict = prediction_dict

        log.debug(
            "PredictionStage: status=%s  crop=%s  class=%s  conf=%.2f%%",
            prediction_dict.get("status"),
            prediction_dict.get("crop", "(none)"),
            prediction_dict.get("class_name", "(none)"),
            prediction_dict.get("confidence", 0.0),
        )


class KnowledgeStage(PipelineStage):
    """
    Stage 4 — Queries MongoDB for agronomic knowledge via KnowledgeService.

    Uses prediction_dict which already has the farmer crop injected by
    PredictionStage. Knowledge lookup therefore always uses farmer crop.

    Args:
        knowledge_service: KnowledgeService instance (injectable for testing).
    """

    def __init__(self, knowledge_service: Optional[KnowledgeService] = None) -> None:
        self._knowledge = knowledge_service or KnowledgeService()

    @property
    def name(self) -> str:
        return "KnowledgeStage"

    def process(self, context: PipelineContext) -> None:
        pred = context.prediction_dict

        if pred.get("status") != "success":
            log.info(
                "KnowledgeStage: skipped — prediction status is '%s'",
                pred.get("status", "unknown"),
            )
            return

        result = self._knowledge.lookup_from_prediction(
            prediction=pred,
            language=context.language,
        )
        context.knowledge_dict = result.to_dict()

        log.debug(
            "KnowledgeStage: found=%s  severity=%s",
            result.found,
            result.severity or "(none)",
        )


class FormatterStage(PipelineStage):
    """Stage 5 — Builds typed PredictionPayload and KnowledgePayload."""

    @property
    def name(self) -> str:
        return "FormatterStage"

    def process(self, context: PipelineContext) -> None:
        context.prediction = _build_prediction_payload(context.prediction_dict)
        context.knowledge  = (
            _build_knowledge_payload(context.knowledge_dict)
            if context.knowledge_dict
            else _empty_knowledge()
        )
        log.debug(
            "FormatterStage: crop=%s  knowledge_found=%s",
            context.prediction.crop or "(none)",
            context.knowledge.found,
        )


# =============================================================================
# SECTION 4 — PIPELINE RUNNER
# =============================================================================

class AIPipeline:
    """
    Modular prediction pipeline that composes and runs all stages in order.

    Default stage order:
      1. ValidationStage
      2. PreprocessingStage
      3. PredictionStage  ← YOLO (farmer crop — MANDATORY, only source of truth)
      4. KnowledgeStage   ← farmer crop via prediction_dict
      5. FormatterStage

    Crop Verification AI (EfficientNet) is NOT part of this pipeline.

    Args:
        stages: Ordered list of PipelineStage instances. If None, the
                default disease/pest pipeline is used.

    Usage:
        pipeline = AIPipeline()
        response = pipeline.run(image_path="/uploads/leaf.jpg", farmer_crop="Tomato")
        print(response.to_dict())
    """

    def __init__(
        self,
        stages: Optional[list[PipelineStage]] = None,
    ) -> None:
        if stages is not None:
            self._stages = stages
        else:
            _inference = InferenceService()
            _knowledge = KnowledgeService()
            self._stages: list[PipelineStage] = [
                ValidationStage(),
                PreprocessingStage(),
                PredictionStage(inference_service=_inference),
                KnowledgeStage(knowledge_service=_knowledge),
                FormatterStage(),
            ]

        log.info(
            "AIPipeline initialised — stages: %s",
            " → ".join(s.name for s in self._stages),
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def run(
        self,
        image_path:    str,
        analysis_type: str           = "disease_pest",
        language:      str           = "en",
        weights_path:  Optional[str] = None,
        device:        Optional[str] = None,
        farmer_crop:   Optional[str] = None,
    ) -> ControllerResponse:
        """
        Runs the full pipeline on a single image and returns a unified response.

        Args:
            image_path:    Absolute path to the image file.
            analysis_type: Analysis type. Default "disease_pest".
            language:      Desired language for knowledge content.
            weights_path:  Optional model weights path override.
            device:        Optional device override.
            farmer_crop:   Crop selected by the farmer (MANDATORY).
                           Used by YOLO and KnowledgeBase.
                           No Crop Verification AI is involved.

        Returns:
            ControllerResponse — always returned, never raises.
        """
        context = PipelineContext(
            image_path=image_path,
            analysis_type=analysis_type,
            language=language,
            weights_path=weights_path,
            device=device,
            farmer_crop=farmer_crop,
            t_start=time.perf_counter(),
        )

        try:
            for stage in self._stages:
                if context.failed:
                    break
                log.debug("Running stage: %s", stage.name)
                stage.process(context)
        except Exception as exc:
            context.abort(f"Unhandled exception in pipeline: {exc}")

        return self._build_response(context)

    def run_batch(
        self,
        image_paths:   list[str],
        analysis_type: str           = "disease_pest",
        language:      str           = "en",
        weights_path:  Optional[str] = None,
        device:        Optional[str] = None,
    ) -> list[ControllerResponse]:
        """Runs the full pipeline on a list of images."""
        if not isinstance(image_paths, list) or not image_paths:
            log.warning("run_batch: empty or invalid image_paths")
            return []

        log.info("AIPipeline batch: %d images", len(image_paths))
        responses = [
            self.run(
                image_path=p,
                analysis_type=analysis_type,
                language=language,
                weights_path=weights_path,
                device=device,
            )
            for p in image_paths
        ]
        success_count = sum(1 for r in responses if r.success)
        log.info("AIPipeline batch complete: %d/%d succeeded", success_count, len(responses))
        return responses

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _build_response(self, context: PipelineContext) -> ControllerResponse:
        """Converts the final PipelineContext into a ControllerResponse."""
        if context.failed:
            return _error_response(
                context.error or "Unknown pipeline error",
                context.analysis_type,
                context.elapsed_ms,
            )

        return ControllerResponse(
            success=True,
            prediction=context.prediction or _empty_prediction(),
            knowledge=context.knowledge  or _empty_knowledge(),
            processing_time_ms=round(context.elapsed_ms, 2),
            model_version=PROJECT_VERSION,
            analysis_type=context.analysis_type,
            error=None,
        )


# =============================================================================
# SECTION 5 — MODULE-LEVEL DEFAULT INSTANCE
# =============================================================================

default_pipeline: AIPipeline = AIPipeline()


# =============================================================================
# SECTION 6 — MAIN (CLI self-test)
# =============================================================================

if __name__ == "__main__":
    import json
    import sys

    print(f"\n{'='*60}")
    print("  AKP AIPipeline — Self-Test")
    print(f"{'='*60}")

    pipeline = AIPipeline()
    cfg      = get_config()

    test_image: Optional[Path] = None
    if len(sys.argv) > 1:
        test_image = Path(sys.argv[1])
    else:
        for img in cfg.paths.dataset_root.rglob("*"):
            if img.is_file() and img.suffix.lower() in (".jpg", ".jpeg", ".png"):
                test_image = img
                break

    if test_image is None:
        print("\n  No test image found. Pass an image path as argument:")
        print("  python ai_pipeline.py /path/to/image.jpg")
        print(f"{'='*60}\n")
        sys.exit(0)

    farmer = sys.argv[2] if len(sys.argv) > 2 else None
    print(f"\n  Test image   : {test_image.name}")
    print(f"  Farmer crop  : {farmer or '(none)'}")
    print(f"  Stages       : {' → '.join(s.name for s in pipeline._stages)}")
    print(f"\n  Running pipeline ...")

    response = pipeline.run(str(test_image), farmer_crop=farmer)

    print(f"\n  Result:")
    print(f"    success            : {response.success}")
    print(f"    error              : {response.error}")
    print(f"    processing_time_ms : {response.processing_time_ms}")

    if response.success:
        p = response.prediction
        k = response.knowledge
        print(f"\n  Prediction:")
        print(f"    crop       : {p.crop or '(not resolved)'}")
        print(f"    category   : {p.category or '(not resolved)'}")
        print(f"    class      : {p.class_name}")
        print(f"    confidence : {p.confidence:.2f}%")
        print(f"\n  Knowledge:")
        print(f"    found      : {k.found}")
        print(f"    severity   : {k.severity or '(none)'}")

    print(f"\n  Full JSON:")
    print(json.dumps(response.to_dict(), indent=2, ensure_ascii=False))
    print(f"{'='*60}\n")
