# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: crop_verification_stage.py
# Purpose: Pipeline stage that runs EfficientNet-B0 crop verification
#          BEFORE YOLO disease detection.
#
# PIPELINE POSITION:  Stage 3  (after PreprocessingStage, before PredictionStage)
#
# AUTHORITY MODEL:
#   PRIMARY   — Farmer-selected crop (source of truth)
#   SECONDARY — Crop Verification AI (EfficientNet-B0) — validation layer only
#
# ABORT CONDITIONS:
#   1. Low confidence  → "Unable to verify crop. Please upload a clearer image."
#
# PASS-THROUGH CONDITIONS (pipeline ALWAYS continues unless low confidence):
#   • Verifier model unavailable (graceful degradation — logs warning)
#   • No farmer_crop provided (nothing to compare against)
#   • Crop matches farmer selection
#   • Crop MISMATCH — pipeline continues with farmer_crop; mismatch is WARNED
#     not blocked. Disease detection always uses farmer_crop.
#
# DOWNSTREAM CONTRACT:
#   context.verified_crop is set to farmer_crop (primary source of truth).
#   context.crop_mismatch_warning is set when AI predicts a different crop.
#   PredictionStage and KnowledgeStage MUST use context.farmer_crop,
#   never context.verified_crop (AI prediction).
# =============================================================================

from __future__ import annotations

from ai_pipeline import PipelineContext, PipelineStage
from crop_verifier import DEFAULT_CONFIDENCE_THRESHOLD, crops_match, verify
from logger import get_logger

log = get_logger(__name__)

# Token prefixes — parsed by AIPipeline._build_response()
_MISMATCH_TOKEN    = "CROP_MISMATCH_WARNING"   # warning only — pipeline continues
_LOW_CONF_TOKEN    = "CROP_LOW_CONFIDENCE"      # abort — image too unclear


class CropVerificationStage(PipelineStage):
    """
    Stage 3 — EfficientNet-B0 crop verification (advisory layer).

    Reads:
        context.image_path   — image to classify
        context.farmer_crop  — farmer's selection (PRIMARY source of truth)

    Writes:
        context.verified_crop         — farmer_crop (primary authority)
        context.crop_mismatch_warning — set when AI predicts a different crop
                                        (pipeline still continues)

    Aborts pipeline on:
        • Low confidence only (image too unclear to process)

    Never aborts on crop mismatch — farmer selection is always respected.

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
            # Farmer crop is still the authority — set it as verified_crop
            if farmer_crop:
                context.verified_crop = farmer_crop
            return

        log.info(
            "CropVerificationStage: predicted='%s' conf=%.2f%% "
            "threshold=%.1f%% farmer='%s'",
            result.predicted_crop,
            result.confidence,
            self._threshold,
            farmer_crop or "(none)",
        )

        # ── Low confidence → abort (image too unclear) ──────────────────────
        if result.low_confidence:
            context.abort(
                f"{_LOW_CONF_TOKEN}|confidence={result.confidence:.1f}"
            )
            return

        # ── No farmer selection → use AI prediction as hint, proceed ────────
        if not farmer_crop:
            context.verified_crop = result.predicted_crop
            return

        # ── Farmer crop is PRIMARY — always use it for disease detection ─────
        context.verified_crop = farmer_crop

        # ── Mismatch → warn only, log for model improvement, NEVER abort ────
        if not crops_match(result.predicted_crop, farmer_crop):
            log.warning(
                "CropVerificationStage: MISMATCH — AI predicted '%s' but farmer "
                "selected '%s' — continuing with farmer selection (primary authority)",
                result.predicted_crop,
                farmer_crop,
            )
            context.crop_mismatch_warning = (
                f"{_MISMATCH_TOKEN}"
                f"|predicted={result.predicted_crop}"
                f"|selected={farmer_crop}"
            )
