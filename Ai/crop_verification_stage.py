# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: crop_verification_stage.py
# Purpose: Pipeline stage that runs EfficientNet-B0 crop verification
#          BEFORE YOLO disease detection.
#
# PIPELINE POSITION:  Stage 3  (after PreprocessingStage, before PredictionStage)
#
# AUTHORITY MODEL:
#   PRIMARY   — Crop Verification AI (EfficientNet-B0)
#   SECONDARY — Farmer-selected crop (used only for mismatch validation)
#
# ABORT CONDITIONS:
#   1. Low confidence  → "Unable to verify crop. Please upload a clearer image."
#   2. Crop mismatch   → "Uploaded image belongs to X. Please upload Y leaf
#                         or change crop selection."
#
# PASS-THROUGH CONDITIONS (pipeline continues):
#   • Verifier model unavailable (graceful degradation — logs warning)
#   • No farmer_crop provided (nothing to compare against)
#   • Crop matches farmer selection
#
# DOWNSTREAM CONTRACT:
#   context.verified_crop is set to the EfficientNet prediction.
#   PredictionStage and KnowledgeStage MUST use context.verified_crop,
#   never context.farmer_crop.
# =============================================================================

from __future__ import annotations

from ai_pipeline import PipelineContext, PipelineStage
from crop_verifier import DEFAULT_CONFIDENCE_THRESHOLD, crops_match, verify
from logger import get_logger

log = get_logger(__name__)

# Abort token prefix — parsed by AIPipeline._build_response()
_MISMATCH_TOKEN    = "CROP_MISMATCH"
_LOW_CONF_TOKEN    = "CROP_LOW_CONFIDENCE"


class CropVerificationStage(PipelineStage):
    """
    Stage 3 — EfficientNet-B0 crop verification gate.

    Reads:
        context.image_path   — image to classify
        context.farmer_crop  — farmer's selection (secondary metadata)

    Writes:
        context.verified_crop — EfficientNet's prediction (primary authority)

    Aborts pipeline on:
        • Low confidence  (image unclear)
        • Crop mismatch   (wrong crop uploaded)

    Args:
        confidence_threshold: Minimum confidence % to accept a prediction.
                              Default: 70.0
    """

    def __init__(
        self,
        confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
    ) -> None:
        self._threshold = confidence_threshold

    @property
    def name(self) -> str:
        return "CropVerificationStage"

    def process(self, context: PipelineContext) -> None:
        farmer_crop: str = (context.farmer_crop or "").strip()

        result = verify(context.image_path, confidence_threshold=self._threshold)

        # ── Verifier unavailable — skip gracefully ──────────────────────────
        if not result.success:
            log.warning(
                "CropVerificationStage: verifier unavailable (%s) — skipping",
                result.error,
            )
            return

        # ── Store verified crop for all downstream stages ───────────────────
        context.verified_crop = result.predicted_crop

        log.info(
            "CropVerificationStage: predicted='%s' conf=%.2f%% "
            "threshold=%.1f%% farmer='%s'",
            result.predicted_crop,
            result.confidence,
            self._threshold,
            farmer_crop or "(none)",
        )

        # ── Requirement 6: low confidence → reject with clear message ───────
        if result.low_confidence:
            context.abort(
                f"{_LOW_CONF_TOKEN}|confidence={result.confidence:.1f}"
            )
            return

        # ── No farmer selection → nothing to compare, proceed ───────────────
        if not farmer_crop:
            return

        # ── Requirement 4 & 5: mismatch → stop entire pipeline ──────────────
        if not crops_match(result.predicted_crop, farmer_crop):
            context.abort(
                f"{_MISMATCH_TOKEN}"
                f"|predicted={result.predicted_crop}"
                f"|selected={farmer_crop}"
            )
