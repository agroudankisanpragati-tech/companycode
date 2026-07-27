# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: ai_controller.py
# Purpose: Production integration layer between the backend and the AI engine.
#
# RESPONSIBILITIES:
#   1. Receive prediction requests from the backend (single or batch).
#   2. Validate all inputs before touching the AI pipeline.
#   3. Delegate inference to InferenceService.
#   4. Delegate knowledge lookup to KnowledgeService.
#   5. Merge prediction + knowledge into one unified response.
#   6. Handle all exceptions gracefully — callers never receive raw errors.
#   7. Return a stable, versioned JSON contract.
#
# DESIGN:
#   • AIController is a class — fully injectable (tests, FastAPI Depends,
#     Express child-process, Celery worker).
#   • ControllerRequest / ControllerResponse are dataclasses — typed,
#     IDE-friendly, no dict typos.
#   • The controller is the ONLY place where inference + knowledge are
#     combined. InferenceService and KnowledgeService remain independent.
#   • Supports future analysis types (soil, weed, nutrient, fruit, pest,
#     crop recommendation) via the `analysis_type` field — no code changes
#     needed in downstream services.
#
# Usage (single image):
#   from ai_controller import AIController
#   controller = AIController()
#   response = controller.predict(image_path="/uploads/leaf.jpg")
#   print(response.to_dict())
#
# Usage (batch):
#   response = controller.predict_batch(image_paths=["/img1.jpg", "/img2.jpg"])
#
# Dependencies: inference_service.py, knowledge_service.py, config.py, logger.py
# =============================================================================

from __future__ import annotations

import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from config import get_config
from constants import PROJECT_VERSION, SUPPORTED_IMAGE_EXTENSIONS
from inference_service import InferenceService
from knowledge_service import KnowledgeService
from logger import get_logger

log = get_logger(__name__)


# =============================================================================
# SECTION 1 — REQUEST / RESPONSE CONTRACTS
# =============================================================================

@dataclass
class ControllerRequest:
    """
    Validated input contract for a single prediction request.

    Fields:
        image_path    — Absolute or relative path to the image file.
        analysis_type — Type of analysis to perform. Currently "disease_pest"
                        is supported. Reserved values for future modules:
                        "soil", "weed", "nutrient", "fruit", "crop_recommendation",
                        "pest". Defaults to "disease_pest".
        language      — Desired language for knowledge content. Default "en".
        weights_path  — Optional override for model weights path.
        device        — Optional device override: "cpu" | "cuda" | "mps".
    """
    image_path:    str
    analysis_type: str           = "disease_pest"
    language:      str           = "en"
    weights_path:  Optional[str] = None
    device:        Optional[str] = None


@dataclass
class PredictionPayload:
    """
    The prediction section of the unified response.

    Mirrors the output of PredictionResult from predict.py but exposes
    only the fields relevant to the API consumer.

    Fields:
        crop        — Crop name resolved from the model (e.g. "green_gram").
        category    — "diseases" | "pests" | "healthy" | "".
        class_name  — Top-1 predicted class label.
        confidence  — Top-1 confidence as a percentage (0.0 – 100.0).
        top5        — Top-5 predictions as a list of dicts.
    """
    crop:       str
    category:   str
    class_name: str
    confidence: float
    top5:       list[dict] = field(default_factory=list)


@dataclass
class KnowledgePayload:
    """
    The knowledge section of the unified response.

    All content comes exclusively from MongoDB via KnowledgeService.
    The AI model never generates or stores any of these fields.

    Fields:
        description          — Full disease/pest description.
        symptoms             — Combined symptom description.
        causes               — Cause of the disease or pest infestation.
        organic_solution     — Organic / natural treatment steps.
        chemical_solution    — Chemical treatment with product names.
        prevention           — Prevention methods.
        recommended_products — Recommended commercial products.
        severity             — "low" | "medium" | "high" | "critical" | "".
        scientific_name      — Scientific name of the pathogen or pest.
        affected_part        — Plant part(s) affected.
        images               — List of image URLs from Admin Panel.
        found                — True if a knowledge record was found.
    """
    description:          str       = ""
    symptoms:             str       = ""
    causes:               str       = ""
    organic_solution:     str       = ""
    chemical_solution:    str       = ""
    prevention:           str       = ""
    recommended_products: str       = ""
    severity:             str       = ""
    scientific_name:      str       = ""
    affected_part:        str       = ""
    images:               list[str] = field(default_factory=list)
    found:                bool      = False


@dataclass
class ControllerResponse:
    """
    Unified response returned by every AIController method.

    This is the stable JSON contract consumed by the backend.
    The structure is versioned via `model_version` so the backend
    can handle future schema changes gracefully.

    Fields:
        success            — True if the pipeline completed without a
                             controller-level error. Check prediction.class_name
                             for prediction-level results.
        prediction         — PredictionPayload (crop, category, class, confidence).
        knowledge          — KnowledgePayload (all agronomic content from MongoDB).
        processing_time_ms — Total wall-clock time for the full pipeline in ms.
        model_version      — Project version string from constants.py.
        analysis_type      — The analysis type that was performed.
        error                 — None on success; human-readable reason on failure.
        crop_mismatch_warning — Advisory warning when AI predicts a different crop
                                than the farmer selected. Pipeline always continues;
                                frontend shows this as a non-blocking advisory.
    """
    success:               bool
    prediction:            PredictionPayload
    knowledge:             KnowledgePayload
    processing_time_ms:    float
    model_version:         str
    analysis_type:         str
    error:                 Optional[str] = None

    def to_dict(self) -> dict:
        """
        Serialises the response to a plain dict for JSON encoding.

        Returns the exact structure documented in the API contract:
        {
          "success": true,
          "prediction": { "crop": "", "category": "", "class": "",
                          "confidence": 0.0, "top5": [] },
          "knowledge":  { "description": "", "symptoms": [], ... },
          "processing_time_ms": 0,
          "model_version": "",
          "analysis_type": "",
          "error": null
        }
        """
        return {
            "success": self.success,
            "prediction": {
                "crop":       self.prediction.crop,
                "category":   self.prediction.category,
                "class":      self.prediction.class_name,
                "confidence": self.prediction.confidence,
                "top5":       self.prediction.top5,
            },
            "knowledge": {
                "description":          self.knowledge.description,
                "symptoms":             self.knowledge.symptoms,
                "causes":               self.knowledge.causes,
                "organic_solution":     self.knowledge.organic_solution,
                "chemical_solution":    self.knowledge.chemical_solution,
                "prevention":           self.knowledge.prevention,
                "recommended_products": self.knowledge.recommended_products,
                "severity":             self.knowledge.severity,
                "scientific_name":      self.knowledge.scientific_name,
                "affected_part":        self.knowledge.affected_part,
                "images":               self.knowledge.images,
                "found":                self.knowledge.found,
            },
            "processing_time_ms":    round(self.processing_time_ms, 2),
            "model_version":          self.model_version,
            "analysis_type":          self.analysis_type,
            "error":                  self.error,
        }


# =============================================================================
# SECTION 2 — INTERNAL HELPERS
# =============================================================================

def _empty_prediction() -> PredictionPayload:
    """Returns a zero-value PredictionPayload for error responses."""
    return PredictionPayload(crop="", category="", class_name="", confidence=0.0)


def _empty_knowledge() -> KnowledgePayload:
    """Returns a zero-value KnowledgePayload for error responses."""
    return KnowledgePayload()


def _error_response(
    reason: str,
    analysis_type: str,
    elapsed_ms: float = 0.0,
) -> ControllerResponse:
    """
    Builds a ControllerResponse representing a controller-level failure.

    Args:
        reason:        Human-readable description of what went wrong.
        analysis_type: The analysis type that was attempted.
        elapsed_ms:    Time elapsed before the failure.

    Returns:
        ControllerResponse with success=False.
    """
    log.error("AIController error [%s]: %s", analysis_type, reason)
    return ControllerResponse(
        success=False,
        prediction=_empty_prediction(),
        knowledge=_empty_knowledge(),
        processing_time_ms=round(elapsed_ms, 2),
        model_version=PROJECT_VERSION,
        analysis_type=analysis_type,
        error=reason,
    )


def _validate_image_path(image_path: str) -> tuple[bool, str]:
    """
    Validates the image path before passing it to the pipeline.

    Checks:
      1. Non-empty string.
      2. File exists on disk.
      3. Extension is in SUPPORTED_IMAGE_EXTENSIONS.
      4. File is non-empty.

    Args:
        image_path: Raw path string from the request.

    Returns:
        (is_valid, reason) — True + "" if valid, False + reason if not.
    """
    if not image_path or not image_path.strip():
        return False, "image_path must not be empty"

    path = Path(image_path)

    if not path.exists():
        return False, f"Image file not found: {image_path}"
    if not path.is_file():
        return False, f"Path is not a file: {image_path}"
    if path.suffix.lower() not in SUPPORTED_IMAGE_EXTENSIONS:
        return False, (
            f"Unsupported image format '{path.suffix}'. "
            f"Supported: {', '.join(SUPPORTED_IMAGE_EXTENSIONS)}"
        )
    if path.stat().st_size == 0:
        return False, f"Image file is empty: {image_path}"

    return True, ""


def _build_knowledge_payload(knowledge_dict: dict) -> KnowledgePayload:
    """
    Maps a KnowledgeResult.to_dict() output to a KnowledgePayload.

    Args:
        knowledge_dict: Dict from KnowledgeResult.to_dict().

    Returns:
        KnowledgePayload with all fields populated.
    """
    return KnowledgePayload(
        description=knowledge_dict.get("description", ""),
        symptoms=knowledge_dict.get("symptoms", ""),
        causes=knowledge_dict.get("causes", ""),
        organic_solution=knowledge_dict.get("organic_solution", ""),
        chemical_solution=knowledge_dict.get("chemical_solution", ""),
        prevention=knowledge_dict.get("prevention", ""),
        recommended_products=knowledge_dict.get("recommended_products", ""),
        severity=knowledge_dict.get("severity", ""),
        scientific_name=knowledge_dict.get("scientific_name", ""),
        affected_part=knowledge_dict.get("affected_part", ""),
        images=knowledge_dict.get("images", []),
        found=knowledge_dict.get("found", False),
    )


def _build_prediction_payload(prediction_dict: dict) -> PredictionPayload:
    """
    Maps a PredictionResult.to_dict() output to a PredictionPayload.

    Args:
        prediction_dict: Dict from PredictionResult.to_dict().

    Returns:
        PredictionPayload with all fields populated.
    """
    return PredictionPayload(
        crop=prediction_dict.get("crop", ""),
        category=prediction_dict.get("category", ""),
        class_name=prediction_dict.get("class_name", ""),
        confidence=prediction_dict.get("confidence", 0.0),
        top5=prediction_dict.get("top5", []),
    )


# =============================================================================
# SECTION 3 — AI CONTROLLER
# =============================================================================

class AIController:
    """
    Production integration layer between the backend and the AI engine.

    Orchestrates the full prediction pipeline:
      Request → Validation → Inference → Knowledge Lookup → Unified Response

    This class is the single entry point for all AI prediction calls from
    the backend. It is completely independent from agronomic content —
    all disease/pest knowledge comes from MongoDB via KnowledgeService.

    Designed for extensibility: the `analysis_type` field in ControllerRequest
    allows future modules (soil, weed, nutrient, fruit, crop recommendation,
    pest) to be added without changing the response contract.

    Dependency injection:
        Pass custom InferenceService and KnowledgeService instances at
        construction time to override defaults. This makes the controller
        fully testable without touching the filesystem or MongoDB.

    Args:
        inference_service:  InferenceService instance. Defaults to a new
                            instance using config defaults.
        knowledge_service:  KnowledgeService instance. Defaults to a new
                            instance using env var defaults.

    Usage:
        controller = AIController()
        response = controller.predict(image_path="/uploads/leaf.jpg")
        print(response.to_dict())
    """

    def __init__(
        self,
        inference_service: Optional[InferenceService] = None,
        knowledge_service: Optional[KnowledgeService] = None,
    ) -> None:
        self._inference = inference_service or InferenceService()
        self._knowledge = knowledge_service or KnowledgeService()
        log.info("AIController initialised")

    # ------------------------------------------------------------------
    # Public API — Single Image
    # ------------------------------------------------------------------

    def predict(
        self,
        image_path: str,
        analysis_type: str = "disease_pest",
        language: str = "en",
        weights_path: Optional[str] = None,
        device: Optional[str] = None,
    ) -> ControllerResponse:
        """
        Runs the full AI pipeline on a single image and returns a unified response.

        Pipeline:
          1. Validate image_path.
          2. Run inference via InferenceService.
          3. If prediction succeeded, run knowledge lookup via KnowledgeService.
          4. Merge prediction + knowledge into ControllerResponse.
          5. On any failure, return a graceful error response.

        Args:
            image_path:    Absolute path to the image file.
            analysis_type: Analysis type. Currently "disease_pest". Reserved
                           for future: "soil", "weed", "nutrient", "fruit",
                           "crop_recommendation", "pest".
            language:      Desired language for knowledge content. Default "en".
            weights_path:  Optional model weights path override.
            device:        Optional device override: "cpu" | "cuda" | "mps".

        Returns:
            ControllerResponse — always returned, never raises.

        Usage:
            response = controller.predict("/uploads/leaf.jpg")
            if response.success:
                print(response.to_dict())
        """
        t_start = time.perf_counter()

        # Step 1 — Validate input
        valid, reason = _validate_image_path(image_path)
        if not valid:
            return _error_response(reason, analysis_type)

        request = ControllerRequest(
            image_path=image_path,
            analysis_type=analysis_type,
            language=language,
            weights_path=weights_path,
            device=device,
        )

        try:
            return self._run_pipeline(request, t_start)
        except Exception as exc:
            elapsed = (time.perf_counter() - t_start) * 1000.0
            return _error_response(
                f"Unexpected controller error: {exc}",
                analysis_type,
                elapsed,
            )

    def predict_from_request(self, request: ControllerRequest) -> ControllerResponse:
        """
        Runs the full AI pipeline from a pre-built ControllerRequest.

        Useful when the caller has already constructed a ControllerRequest
        (e.g. from a deserialized JSON body in a FastAPI endpoint).

        Args:
            request: ControllerRequest with all fields populated.

        Returns:
            ControllerResponse — always returned, never raises.

        Usage:
            req = ControllerRequest(image_path="/uploads/leaf.jpg", language="hi")
            response = controller.predict_from_request(req)
        """
        t_start = time.perf_counter()

        valid, reason = _validate_image_path(request.image_path)
        if not valid:
            return _error_response(reason, request.analysis_type)

        try:
            return self._run_pipeline(request, t_start)
        except Exception as exc:
            elapsed = (time.perf_counter() - t_start) * 1000.0
            return _error_response(
                f"Unexpected controller error: {exc}",
                request.analysis_type,
                elapsed,
            )

    # ------------------------------------------------------------------
    # Public API — Batch
    # ------------------------------------------------------------------

    def predict_batch(
        self,
        image_paths: list[str],
        analysis_type: str = "disease_pest",
        language: str = "en",
        weights_path: Optional[str] = None,
        device: Optional[str] = None,
    ) -> list[ControllerResponse]:
        """
        Runs the full AI pipeline on a list of images.

        Each image is processed independently. A failure on one image
        does not affect the others. Results are returned in the same
        order as the input list.

        Args:
            image_paths:   List of absolute image paths.
            analysis_type: Analysis type for all images in the batch.
            language:      Desired language for knowledge content.
            weights_path:  Optional model weights path override.
            device:        Optional device override.

        Returns:
            List of ControllerResponse, one per input image, same order.

        Usage:
            responses = controller.predict_batch(["/img1.jpg", "/img2.jpg"])
            for r in responses:
                print(r.to_dict())
        """
        if not isinstance(image_paths, list):
            log.error("predict_batch: image_paths must be a list")
            return []

        if not image_paths:
            log.warning("predict_batch called with empty list")
            return []

        log.info("AIController batch: %d images", len(image_paths))

        responses: list[ControllerResponse] = []
        for path in image_paths:
            response = self.predict(
                image_path=path,
                analysis_type=analysis_type,
                language=language,
                weights_path=weights_path,
                device=device,
            )
            responses.append(response)

        success_count = sum(1 for r in responses if r.success)
        log.info(
            "AIController batch complete: %d/%d succeeded",
            success_count, len(responses),
        )
        return responses

    # ------------------------------------------------------------------
    # Diagnostics
    # ------------------------------------------------------------------

    def health_check(self) -> dict:
        """
        Returns a combined health status for the inference and knowledge services.

        Does NOT load the model or query MongoDB data — only checks
        connectivity and path availability.

        Returns:
            dict with keys: status, inference, knowledge, model_version.

        Usage:
            # In a FastAPI /health endpoint:
            return controller.health_check()
        """
        inference_health = self._inference.health_check()
        knowledge_health = self._knowledge.health_check()

        overall = (
            "ok"
            if inference_health.get("status") == "ok"
            and knowledge_health.get("status") == "ok"
            else "degraded"
        )

        return {
            "status":        overall,
            "inference":     inference_health,
            "knowledge":     knowledge_health,
            "model_version": PROJECT_VERSION,
        }

    # ------------------------------------------------------------------
    # Internal pipeline
    # ------------------------------------------------------------------

    def _run_pipeline(
        self,
        request: ControllerRequest,
        t_start: float,
    ) -> ControllerResponse:
        """
        Executes the inference → knowledge → merge pipeline for one image.

        This is the internal implementation shared by predict() and
        predict_from_request(). It is not part of the public API.

        Args:
            request: Validated ControllerRequest.
            t_start: perf_counter timestamp from before validation.

        Returns:
            ControllerResponse with merged prediction and knowledge.
        """
        weights = Path(request.weights_path) if request.weights_path else None

        # Step 2 — Inference
        inference_response = self._inference.predict_single(
            image_path=request.image_path,
        )

        if not inference_response.success:
            elapsed = (time.perf_counter() - t_start) * 1000.0
            return _error_response(
                f"Inference failed: {inference_response.error}",
                request.analysis_type,
                elapsed,
            )

        prediction_dict: dict = inference_response.data or {}
        prediction_payload = _build_prediction_payload(prediction_dict)

        # Step 3 — Knowledge lookup (only if prediction succeeded)
        knowledge_payload = _empty_knowledge()
        if prediction_dict.get("status") == "success":
            knowledge_result = self._knowledge.lookup_from_prediction(
                prediction=prediction_dict,
                language=request.language,
            )
            knowledge_payload = _build_knowledge_payload(knowledge_result.to_dict())
        else:
            log.info(
                "Skipping knowledge lookup — prediction status: %s",
                prediction_dict.get("status", "unknown"),
            )

        elapsed = (time.perf_counter() - t_start) * 1000.0

        log.info(
            "Pipeline complete: class=%s  conf=%.2f%%  knowledge=%s  %.1f ms",
            prediction_payload.class_name or "(none)",
            prediction_payload.confidence,
            knowledge_payload.found,
            elapsed,
        )

        return ControllerResponse(
            success=True,
            prediction=prediction_payload,
            knowledge=knowledge_payload,
            processing_time_ms=round(elapsed, 2),
            model_version=PROJECT_VERSION,
            analysis_type=request.analysis_type,
            error=None,
        )


# =============================================================================
# SECTION 4 — MODULE-LEVEL DEFAULT INSTANCE
# =============================================================================

# Ready-to-use singleton for callers that don't need custom configuration.
#
#   from ai_controller import default_controller
#   response = default_controller.predict("/path/to/image.jpg")
#
default_controller: AIController = AIController()


# =============================================================================
# SECTION 5 — MAIN (CLI self-test)
# =============================================================================

if __name__ == "__main__":
    import json
    import sys

    print(f"\n{'='*60}")
    print("  AKP AIController — Self-Test")
    print(f"{'='*60}")

    controller = AIController()

    # Health check
    health = controller.health_check()
    print(f"\n  Health check:")
    print(f"    status        : {health['status']}")
    print(f"    inference     : {health['inference']['status']}")
    print(f"    knowledge     : {health['knowledge']['status']}")
    print(f"    model_version : {health['model_version']}")

    # Find a test image
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
        print("  python ai_controller.py /path/to/image.jpg")
        print(f"{'='*60}\n")
        sys.exit(0)

    print(f"\n  Test image: {test_image.name}")
    response = controller.predict(str(test_image))

    print(f"\n  ControllerResponse:")
    print(f"    success            : {response.success}")
    print(f"    error              : {response.error}")
    print(f"    processing_time_ms : {response.processing_time_ms}")
    print(f"    model_version      : {response.model_version}")

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
        print(f"    scientific : {k.scientific_name or '(none)'}")

    print(f"\n  Full JSON:")
    print(json.dumps(response.to_dict(), indent=2, ensure_ascii=False))
    print(f"{'='*60}\n")
