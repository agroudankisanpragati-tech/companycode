# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: inference_service.py
# Purpose: Orchestration layer between any backend caller and predict.py.
#
# RESPONSIBILITIES:
#   1. Accept an image path (single or batch).
#   2. Delegate to predict.py — never runs inference directly.
#   3. Wrap the result in a ServiceResponse for a uniform caller contract.
#   4. Handle all exceptions — callers never receive a raw exception.
#   5. Log every request and result for observability.
#
# DESIGN:
#   • InferenceService is a class so it can be injected as a dependency
#     (FastAPI Depends, Celery task, Express child-process, unit tests).
#   • ServiceResponse is the single output contract — status + data + error.
#   • No preprocessing, no model loading, no MongoDB — those belong to
#     predict.py / model_manager.py / knowledge_service.py respectively.
#   • Caller-agnostic: works identically from FastAPI, Express subprocess,
#     Celery worker, or a plain Python script.
#
# Usage (FastAPI example):
#   from inference_service import InferenceService
#   service = InferenceService()
#   response = service.predict_single("/uploads/leaf.jpg")
#   if response.success:
#       print(response.data)          # PredictionResult dict
#
# Usage (batch):
#   responses = service.predict_batch(["/img1.jpg", "/img2.jpg"])
#
# Dependencies: predict.py, config.py, logger.py (all local)
# =============================================================================

from __future__ import annotations

import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from config import get_config
from logger import get_logger
from predict import PredictionResult, predict, predict_batch

log = get_logger(__name__)


# =============================================================================
# SECTION 1 — SERVICE RESPONSE CONTRACT
# =============================================================================

@dataclass
class ServiceResponse:
    """
    Uniform response envelope returned by every InferenceService method.

    Callers check `success` first, then read `data` or `error`.
    This contract is stable regardless of what predict.py returns internally.

    Fields:
        success      — True if prediction completed without a service-level error.
                       Note: a prediction with status="error" still sets
                       success=True at the service level (the service ran fine;
                       the image itself was the problem). Use data["status"]
                       to distinguish image-level failures.
        data         — For single: PredictionResult as a plain dict.
                       For batch:  list of PredictionResult dicts.
                       None on service-level failure.
        error        — Human-readable error string on service-level failure.
                       None on success.
        request_ms   — Total wall-clock time for the service call in milliseconds.
        image_count  — Number of images processed (1 for single, N for batch).
    """
    success:     bool
    data:        Optional[Any]       # dict | list[dict]
    error:       Optional[str]
    request_ms:  float               = 0.0
    image_count: int                 = 0


def _service_error(reason: str, request_ms: float = 0.0) -> ServiceResponse:
    """
    Builds a ServiceResponse representing a service-level failure.

    A service-level failure means InferenceService itself could not complete
    the call (e.g. invalid argument type, unexpected exception in predict.py).
    This is distinct from a prediction-level failure (bad image, missing
    weights) which is reported inside data["status"] = "error".

    Args:
        reason:     Human-readable description of what went wrong.
        request_ms: Elapsed time before the failure occurred.

    Returns:
        ServiceResponse with success=False.
    """
    log.error("InferenceService error: %s", reason)
    return ServiceResponse(
        success=False,
        data=None,
        error=reason,
        request_ms=round(request_ms, 2),
        image_count=0,
    )


# =============================================================================
# SECTION 2 — INFERENCE SERVICE
# =============================================================================

class InferenceService:
    """
    Orchestrates single-image and batch inference requests.

    This class is the single entry point for all inference calls from
    any backend layer (FastAPI, Express subprocess, Celery, CLI).

    It delegates all actual inference work to predict.py and wraps
    results in a ServiceResponse for a consistent caller contract.

    Dependency injection:
        Pass a custom weights_path or device at construction time to
        override the defaults from config.py. This makes the service
        fully testable without touching the filesystem.

    Args:
        weights_path: Path to the .pt weights file. Defaults to
                      cfg.paths.checkpoints_dir / "best.pt".
        device:       Device override: "cpu" | "cuda" | "mps".
                      Defaults to cfg.hardware.device.

    Usage:
        service = InferenceService()
        response = service.predict_single("/path/to/leaf.jpg")

        # With explicit weights and device:
        service = InferenceService(
            weights_path=Path("/weights/green_gram_best.pt"),
            device="cpu",
        )
    """

    def __init__(
        self,
        weights_path: Optional[Path] = None,
        device: Optional[str] = None,
    ) -> None:
        cfg = get_config()
        self._weights_path: Optional[Path] = weights_path
        self._device: str = device or cfg.hardware.device
        log.info(
            "InferenceService initialised — device=%s  weights=%s",
            self._device,
            self._weights_path or "(default best.pt)",
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def predict_single(
        self,
        image_path: str | Path,
    ) -> ServiceResponse:
        """
        Runs inference on a single image and returns a ServiceResponse.

        Pipeline:
          1. Validate that image_path is a non-empty string or Path.
          2. Delegate to predict.predict() from predict.py.
          3. Wrap the PredictionResult in a ServiceResponse.
          4. On any unexpected exception, return a service-level error.

        The underlying predict() never raises — it returns a
        PredictionResult with status="error" on image-level failures.
        This method adds one more safety net for service-level failures.

        Args:
            image_path: Path to the image file (str or Path).

        Returns:
            ServiceResponse:
              • success=True, data=PredictionResult dict on normal completion
                (even if the prediction itself failed — check data["status"]).
              • success=False, error=reason on service-level failure.

        Usage:
            response = service.predict_single("/uploads/leaf.jpg")
            if response.success and response.data["status"] == "success":
                crop = response.data["crop"]
                class_name = response.data["class_name"]
        """
        t_start = time.perf_counter()

        if not image_path:
            return _service_error("image_path must not be empty")

        try:
            result: PredictionResult = predict(
                image_path=image_path,
                weights_path=self._weights_path,
                device=self._device,
            )
            elapsed = (time.perf_counter() - t_start) * 1000.0

            log.info(
                "predict_single: %s → status=%s  class=%s  conf=%.2f%%  %.1f ms",
                Path(str(image_path)).name,
                result.status,
                result.class_name or "(none)",
                result.confidence,
                elapsed,
            )

            return ServiceResponse(
                success=True,
                data=result.to_dict(),
                error=None,
                request_ms=round(elapsed, 2),
                image_count=1,
            )

        except Exception as exc:
            elapsed = (time.perf_counter() - t_start) * 1000.0
            return _service_error(
                f"Unexpected error during single prediction: {exc}",
                request_ms=elapsed,
            )

    def predict_batch(
        self,
        image_paths: list[str | Path],
    ) -> ServiceResponse:
        """
        Runs inference on a list of images and returns a ServiceResponse
        whose data field is a list of PredictionResult dicts.

        Each image is processed independently. A failure on one image
        does not affect the others — failed images appear in the list
        with status="error" in their dict.

        Args:
            image_paths: List of image paths (str or Path). May be empty.

        Returns:
            ServiceResponse:
              • success=True, data=list[dict] — one dict per input image,
                same order as input. Each dict has a "status" key.
              • success=False, error=reason — only on service-level failure
                (e.g. image_paths is not a list).

        Usage:
            response = service.predict_batch(["/img1.jpg", "/img2.jpg"])
            if response.success:
                for result_dict in response.data:
                    print(result_dict["class_name"], result_dict["confidence"])
        """
        t_start = time.perf_counter()

        if not isinstance(image_paths, list):
            return _service_error(
                f"image_paths must be a list, got {type(image_paths).__name__}"
            )

        if not image_paths:
            log.warning("predict_batch called with empty list")
            return ServiceResponse(
                success=True,
                data=[],
                error=None,
                request_ms=0.0,
                image_count=0,
            )

        try:
            results: list[PredictionResult] = predict_batch(
                image_paths=image_paths,
                weights_path=self._weights_path,
                device=self._device,
            )
            elapsed = (time.perf_counter() - t_start) * 1000.0

            success_count = sum(1 for r in results if r.status == "success")
            log.info(
                "predict_batch: %d images — %d succeeded  %.1f ms",
                len(image_paths),
                success_count,
                elapsed,
            )

            return ServiceResponse(
                success=True,
                data=[r.to_dict() for r in results],
                error=None,
                request_ms=round(elapsed, 2),
                image_count=len(results),
            )

        except Exception as exc:
            elapsed = (time.perf_counter() - t_start) * 1000.0
            return _service_error(
                f"Unexpected error during batch prediction: {exc}",
                request_ms=elapsed,
            )

    # ------------------------------------------------------------------
    # Diagnostics
    # ------------------------------------------------------------------

    def health_check(self) -> dict:
        """
        Returns a lightweight health status dict for monitoring endpoints.

        Does NOT load the model — only checks config and path availability.

        Returns:
            dict with keys: status, device, weights_path, weights_exists.

        Usage:
            # In a FastAPI /health endpoint:
            return service.health_check()
        """
        cfg = get_config()
        resolved = self._weights_path or (cfg.paths.checkpoints_dir / "best.pt")
        return {
            "status":         "ok",
            "device":         self._device,
            "weights_path":   str(resolved),
            "weights_exists": resolved.exists(),
        }


# =============================================================================
# SECTION 3 — MODULE-LEVEL DEFAULT INSTANCE
# =============================================================================

# A ready-to-use singleton for callers that don't need custom configuration.
# Import this directly for the simplest integration:
#
#   from inference_service import default_service
#   response = default_service.predict_single("/path/to/image.jpg")
#
default_service: InferenceService = InferenceService()


# =============================================================================
# SECTION 4 — MAIN (CLI self-test)
# =============================================================================

if __name__ == "__main__":
    import sys

    cfg = get_config()

    print(f"\n{'='*60}")
    print("  AKP InferenceService — Self-Test")
    print(f"{'='*60}")

    service = InferenceService()
    health = service.health_check()
    print(f"\n  Health check:")
    for k, v in health.items():
        print(f"    {k:<20}: {v}")

    # Find a sample image from the dataset
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
        print("  python inference_service.py /path/to/image.jpg")
        print(f"{'='*60}\n")
        sys.exit(0)

    print(f"\n  Test image: {test_image.name}")
    response = service.predict_single(test_image)

    print(f"\n  ServiceResponse:")
    print(f"    success     : {response.success}")
    print(f"    request_ms  : {response.request_ms}")
    print(f"    image_count : {response.image_count}")
    print(f"    error       : {response.error}")

    if response.success and response.data:
        d = response.data
        print(f"\n  Prediction:")
        print(f"    status      : {d['status']}")
        print(f"    crop        : {d['crop'] or '(not resolved)'}")
        print(f"    category    : {d['category'] or '(not resolved)'}")
        print(f"    class_name  : {d['class_name']}")
        print(f"    confidence  : {d['confidence']:.2f}%")
        print(f"    inference_ms: {d['inference_ms']:.1f} ms")

    print(f"\n{'='*60}\n")
