# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: ai_pipeline.py
# Purpose: Modular, stage-based prediction workflow.
#
# WORKFLOW:
#   Image
#     ↓  ValidationStage     — path + format + size checks
#     ↓  PreprocessingStage  — load + validate pixel data
#     ↓  PredictionStage     — YOLO inference via InferenceService
#     ↓  KnowledgeStage      — MongoDB lookup via KnowledgeService
#     ↓  FormatterStage      — build final JSON-ready response
#     ↓
#   ControllerResponse
#
# DESIGN:
#   • Every stage implements PipelineStage (Single Responsibility).
#   • AIPipeline composes stages via dependency injection — any stage
#     can be replaced, mocked, or extended without touching others.
#   • PipelineContext is the shared state object passed through all stages.
#     Stages read from it and write their output back to it.
#   • A stage sets context.failed = True + context.error to abort the
#     pipeline early. Subsequent stages are skipped automatically.
#   • Supports future analysis types (soil, weed, nutrient, fruit,
#     crop recommendation, pest) by swapping PredictionStage and
#     KnowledgeStage without changing the pipeline runner or formatter.
#
# Usage:
#   from ai_pipeline import AIPipeline
#   pipeline = AIPipeline()
#   response = pipeline.run(image_path="/uploads/leaf.jpg")
#   print(response.to_dict())
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

    Each stage reads from the context and writes its output back.
    If a stage sets `failed = True`, the pipeline runner skips all
    subsequent stages and returns an error response immediately.

    Fields:
        image_path      — Absolute path to the input image.
        analysis_type   — Analysis type (e.g. "disease_pest").
        language        — Desired language for knowledge content.
        weights_path    — Optional model weights path override.
        device          — Optional device override.
        t_start         — perf_counter timestamp at pipeline entry.
        failed          — True if any stage has aborted the pipeline.
        error           — Human-readable reason for failure (if failed).
        prediction_dict — Raw PredictionResult dict from InferenceService.
        knowledge_dict  — Raw KnowledgeResult dict from KnowledgeService.
        prediction      — Typed PredictionPayload (built by FormatterStage).
        knowledge       — Typed KnowledgePayload (built by FormatterStage).
    """
    image_path:      str
    analysis_type:   str                    = "disease_pest"
    language:        str                    = "en"
    weights_path:    Optional[str]          = None
    device:          Optional[str]          = None
    t_start:         float                  = field(default_factory=time.perf_counter)
    failed:          bool                   = False
    error:           Optional[str]          = None
    prediction_dict: dict                   = field(default_factory=dict)
    knowledge_dict:  dict                   = field(default_factory=dict)
    prediction:      Optional[PredictionPayload] = None
    knowledge:       Optional[KnowledgePayload]  = None

    def abort(self, reason: str) -> None:
        """
        Marks the pipeline as failed and records the reason.

        Calling this inside a stage causes the pipeline runner to skip
        all remaining stages and return an error response.

        Args:
            reason: Human-readable description of what went wrong.
        """
        self.failed = True
        self.error = reason
        log.warning("Pipeline aborted [%s]: %s", self.analysis_type, reason)

    @property
    def elapsed_ms(self) -> float:
        """Returns wall-clock time since pipeline entry in milliseconds."""
        return (time.perf_counter() - self.t_start) * 1000.0


# =============================================================================
# SECTION 2 — STAGE INTERFACE
# =============================================================================

class PipelineStage(ABC):
    """
    Abstract base class for all pipeline stages.

    Every stage receives the shared PipelineContext, performs its work,
    and writes results back to the context. If the stage encounters an
    unrecoverable error, it calls context.abort(reason) to stop the pipeline.

    Implementing a new stage:
        class MySoilStage(PipelineStage):
            @property
            def name(self) -> str:
                return "SoilAnalysisStage"

            def process(self, context: PipelineContext) -> None:
                # read from context, write results back
                context.prediction_dict = run_soil_model(context.image_path)
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable name of this stage (used in logs)."""

    @abstractmethod
    def process(self, context: PipelineContext) -> None:
        """
        Executes this stage's logic.

        Args:
            context: Shared pipeline context. Read inputs from it and
                     write outputs back. Call context.abort() on failure.
        """


# =============================================================================
# SECTION 3 — CONCRETE STAGES
# =============================================================================

class ValidationStage(PipelineStage):
    """
    Stage 1 — Validates the image path before any I/O or model work.

    Checks:
      1. image_path is a non-empty string.
      2. File exists on disk.
      3. Path points to a regular file.
      4. File extension is in SUPPORTED_IMAGE_EXTENSIONS.
      5. File is non-empty (size > 0 bytes).

    Aborts the pipeline on any failure.
    """

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
    """
    Stage 2 — Loads the image and validates pixel data integrity.

    Uses load_image() and validate_array() from preprocessing.py to
    perform a fast corruption check before passing the path to the model.

    This stage does NOT produce a preprocessed tensor — YOLO handles its
    own internal preprocessing. This stage only confirms the image is
    readable and has a valid shape/dtype.

    Aborts the pipeline if the image cannot be loaded or is corrupt.
    """

    @property
    def name(self) -> str:
        return "PreprocessingStage"

    def process(self, context: PipelineContext) -> None:
        path = Path(context.image_path)

        array = load_image(path)
        if array is None:
            context.abort(f"Cannot load image — file may be corrupted: {path.name}")
            return

        if not validate_array(array, path):
            context.abort(f"Invalid image array — unexpected shape or dtype: {path.name}")
            return

        log.debug(
            "PreprocessingStage: OK — %s  shape=%s",
            path.name, array.shape,
        )


class PredictionStage(PipelineStage):
    """
    Stage 3 — Runs YOLO inference via InferenceService.

    Delegates all model loading, preprocessing, and inference to
    InferenceService.predict_single(). Writes the raw PredictionResult
    dict to context.prediction_dict.

    Aborts the pipeline if the inference service returns a failure or
    if the prediction status is not "success".

    Dependency injection:
        Pass a custom InferenceService at construction time to override
        the default (useful for testing or multi-model setups).

    Args:
        inference_service: InferenceService instance. Defaults to a new
                           instance using config defaults.
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

        context.prediction_dict = response.data or {}

        log.debug(
            "PredictionStage: status=%s  class=%s  conf=%.2f%%",
            context.prediction_dict.get("status"),
            context.prediction_dict.get("class_name", "(none)"),
            context.prediction_dict.get("confidence", 0.0),
        )


class KnowledgeStage(PipelineStage):
    """
    Stage 4 — Queries MongoDB for agronomic knowledge via KnowledgeService.

    Only runs if the prediction status is "success". Writes the raw
    KnowledgeResult dict to context.knowledge_dict.

    If the prediction failed or the category is "healthy", the knowledge
    lookup is skipped and context.knowledge_dict remains empty — this is
    not treated as a pipeline failure.

    The AI module remains completely independent from agronomic content.
    This stage is the ONLY bridge between prediction and knowledge.

    Dependency injection:
        Pass a custom KnowledgeService at construction time to override
        the default (useful for testing or multi-database setups).

    Args:
        knowledge_service: KnowledgeService instance. Defaults to a new
                           instance using env var defaults.
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
    """
    Stage 5 — Builds typed PredictionPayload and KnowledgePayload from
    the raw dicts written by PredictionStage and KnowledgeStage.

    This stage never aborts the pipeline — it always produces a valid
    (possibly empty) payload pair. Missing fields default to empty strings.
    """

    @property
    def name(self) -> str:
        return "FormatterStage"

    def process(self, context: PipelineContext) -> None:
        context.prediction = _build_prediction_payload(context.prediction_dict)
        context.knowledge = (
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

    The pipeline is fully configurable via dependency injection — any stage
    can be replaced without changing the runner or the response contract.

    Default stage order:
      1. ValidationStage
      2. PreprocessingStage
      3. PredictionStage
      4. KnowledgeStage
      5. FormatterStage

    To replace a stage (e.g. for a future soil analysis module):
        from ai_pipeline import AIPipeline, ValidationStage, FormatterStage
        from my_soil_module import SoilPredictionStage, SoilKnowledgeStage

        pipeline = AIPipeline(stages=[
            ValidationStage(),
            PreprocessingStage(),
            SoilPredictionStage(),
            SoilKnowledgeStage(),
            FormatterStage(),
        ])

    Args:
        stages: Ordered list of PipelineStage instances. If None, the
                default disease/pest pipeline is used.

    Usage:
        pipeline = AIPipeline()
        response = pipeline.run(image_path="/uploads/leaf.jpg")
        print(response.to_dict())
    """

    def __init__(
        self,
        stages: Optional[list[PipelineStage]] = None,
    ) -> None:
        if stages is not None:
            self._stages = stages
        else:
            # Default disease/pest pipeline — shared service instances
            _inference = InferenceService()
            _knowledge = KnowledgeService()
            self._stages: list[PipelineStage] = [
                ValidationStage(),
                PreprocessingStage(),
                PredictionStage(inference_service=_inference),
                KnowledgeStage(knowledge_service=_knowledge),
                FormatterStage(),
            ]

        stage_names = [s.name for s in self._stages]
        log.info("AIPipeline initialised — stages: %s", " → ".join(stage_names))

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def run(
        self,
        image_path: str,
        analysis_type: str = "disease_pest",
        language: str = "en",
        weights_path: Optional[str] = None,
        device: Optional[str] = None,
    ) -> ControllerResponse:
        """
        Runs the full pipeline on a single image and returns a unified response.

        Executes each stage in order. If any stage calls context.abort(),
        the remaining stages are skipped and an error response is returned.

        Args:
            image_path:    Absolute path to the image file.
            analysis_type: Analysis type. Default "disease_pest".
            language:      Desired language for knowledge content.
            weights_path:  Optional model weights path override.
            device:        Optional device override.

        Returns:
            ControllerResponse — always returned, never raises.

        Usage:
            response = pipeline.run("/uploads/leaf.jpg")
            if response.success:
                print(response.to_dict())
        """
        context = PipelineContext(
            image_path=image_path,
            analysis_type=analysis_type,
            language=language,
            weights_path=weights_path,
            device=device,
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
        image_paths: list[str],
        analysis_type: str = "disease_pest",
        language: str = "en",
        weights_path: Optional[str] = None,
        device: Optional[str] = None,
    ) -> list[ControllerResponse]:
        """
        Runs the full pipeline on a list of images.

        Each image is processed independently. A failure on one image
        does not affect the others. Results are returned in the same
        order as the input list.

        Args:
            image_paths:   List of absolute image paths.
            analysis_type: Analysis type for all images.
            language:      Desired language for knowledge content.
            weights_path:  Optional model weights path override.
            device:        Optional device override.

        Returns:
            List of ControllerResponse, one per input image, same order.

        Usage:
            responses = pipeline.run_batch(["/img1.jpg", "/img2.jpg"])
        """
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
        log.info(
            "AIPipeline batch complete: %d/%d succeeded",
            success_count, len(responses),
        )
        return responses

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _build_response(self, context: PipelineContext) -> ControllerResponse:
        """
        Converts the final PipelineContext into a ControllerResponse.

        Called after all stages have run (or after an abort). Handles
        both success and failure paths.

        Args:
            context: The completed (or aborted) pipeline context.

        Returns:
            ControllerResponse ready for JSON serialisation.
        """
        if context.failed:
            return _error_response(
                context.error or "Unknown pipeline error",
                context.analysis_type,
                context.elapsed_ms,
            )

        return ControllerResponse(
            success=True,
            prediction=context.prediction or _empty_prediction(),
            knowledge=context.knowledge or _empty_knowledge(),
            processing_time_ms=round(context.elapsed_ms, 2),
            model_version=PROJECT_VERSION,
            analysis_type=context.analysis_type,
            error=None,
        )


# =============================================================================
# SECTION 5 — MODULE-LEVEL DEFAULT INSTANCE
# =============================================================================

# Ready-to-use singleton for callers that don't need custom configuration.
#
#   from ai_pipeline import default_pipeline
#   response = default_pipeline.run("/path/to/image.jpg")
#
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

    cfg = get_config()
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

    print(f"\n  Test image : {test_image.name}")
    print(f"  Stages     : {' → '.join(s.name for s in pipeline._stages)}")
    print(f"\n  Running pipeline ...")

    response = pipeline.run(str(test_image))

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
