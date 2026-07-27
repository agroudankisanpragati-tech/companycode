# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: crop_verifier.py
# Purpose: EfficientNet-B0 crop verification — SECONDARY validation layer.
#          Runs before YOLO disease detection to warn on crop mismatches.
#
# DESIGN:
#   • Single Responsibility — only loads the EfficientNet model and runs
#     crop classification. No disease logic, no knowledge base access.
#   • Thread-safe singleton — model is loaded once and cached.
#   • Graceful degradation — if weights are missing, returns success=False
#     so the pipeline can skip verification rather than crash.
#   • Confidence threshold — low-confidence predictions are rejected with
#     a clear "upload clearer image" message rather than a wrong crop guess.
#   • AUTHORITY: Farmer-selected crop is PRIMARY. This verifier is SECONDARY.
#     A mismatch produces a warning only — never blocks disease detection.
#
# Dependencies: torch, torchvision, Pillow
# =============================================================================

from __future__ import annotations

import json
import re
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from logger import get_logger

log = get_logger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_WEIGHTS_DIR  = Path(__file__).parent / "weights" / "crop_verification"
_CONFIG_PATH  = _WEIGHTS_DIR / "crop_verification_config.json"
_WEIGHTS_PATH = _WEIGHTS_DIR / "best_crop_verification_model.pth"

# Predictions below this threshold trigger a "please upload clearer image" error
DEFAULT_CONFIDENCE_THRESHOLD: float = 70.0


# ---------------------------------------------------------------------------
# Result contract
# ---------------------------------------------------------------------------

@dataclass
class CropVerificationResult:
    """
    Result returned by verify().

    Fields:
        predicted_crop — Crop name predicted by EfficientNet (e.g. "wheat").
                         Empty string on failure.
        confidence     — Top-1 confidence as a percentage (0.0 – 100.0).
        success        — True if inference completed without error.
        low_confidence — True if confidence < threshold (image unclear).
        error          — Human-readable error string on failure; None on success.
    """
    predicted_crop: str
    confidence:     float
    success:        bool
    low_confidence: bool        = False
    error:          Optional[str] = None


# ---------------------------------------------------------------------------
# Thread-safe model singleton
# ---------------------------------------------------------------------------

_model       = None
_class_names: list[str] = []
_image_size:  int        = 224
_load_lock   = threading.Lock()


def _load_model():
    """Loads EfficientNet-B0 from disk once and caches it. Thread-safe."""
    global _model, _class_names, _image_size

    if _model is not None:
        return _model

    with _load_lock:
        # Double-checked locking — another thread may have loaded while waiting
        if _model is not None:
            return _model

        try:
            import torch
            import torch.nn as nn
            import torchvision.models as models
        except ImportError:
            raise ImportError(
                "torch and torchvision are required for crop verification. "
                "Install with: pip install torch torchvision"
            )

        if not _CONFIG_PATH.exists():
            raise FileNotFoundError(
                f"Crop verification config not found: {_CONFIG_PATH}"
            )
        if not _WEIGHTS_PATH.exists():
            raise FileNotFoundError(
                f"Crop verification weights not found: {_WEIGHTS_PATH}"
            )

        with open(_CONFIG_PATH, "r", encoding="utf-8") as f:
            cfg = json.load(f)

        _class_names = cfg["class_names"]
        _image_size  = cfg.get("image_size", 224)
        num_classes  = cfg["num_classes"]

        device = "cuda" if torch.cuda.is_available() else "cpu"

        model = models.efficientnet_b0(weights=None)
        model.classifier[1] = nn.Linear(
            model.classifier[1].in_features, num_classes
        )

        state = torch.load(_WEIGHTS_PATH, map_location=device)
        # Support both raw state_dict and checkpoint wrappers
        if isinstance(state, dict) and "model_state_dict" in state:
            state = state["model_state_dict"]
        model.load_state_dict(state)
        model.to(device)
        model.eval()

        _model = model
        log.info(
            "CropVerifier loaded: %d classes %s on %s",
            num_classes, _class_names, device,
        )
        return _model


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def verify(
    image_path: str | Path,
    confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
) -> CropVerificationResult:
    """
    Runs EfficientNet-B0 on the image and returns the predicted crop.

    This is a SECONDARY advisory layer. The farmer-selected crop is PRIMARY.
    The result is used only to warn on mismatch — never to override the
    farmer's selection or block disease detection.

    Args:
        image_path:           Path to the image file.
        confidence_threshold: Minimum confidence (%) to accept a prediction.
                              Below this, low_confidence=True is returned.

    Returns:
        CropVerificationResult — always returned, never raises.
    """
    try:
        import torch
        from PIL import Image
        from torchvision import transforms
    except ImportError as exc:
        return CropVerificationResult(
            predicted_crop="", confidence=0.0, success=False, error=str(exc)
        )

    try:
        model = _load_model()
    except Exception as exc:
        log.error("CropVerifier model load failed: %s", exc)
        return CropVerificationResult(
            predicted_crop="", confidence=0.0, success=False, error=str(exc)
        )

    try:
        transform = transforms.Compose([
            transforms.Resize((_image_size, _image_size)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225],
            ),
        ])

        img    = Image.open(str(image_path)).convert("RGB")
        tensor = transform(img).unsqueeze(0)
        device = next(model.parameters()).device
        tensor = tensor.to(device)

        with torch.no_grad():
            logits     = model(tensor)
            probs      = torch.softmax(logits, dim=1)[0]
            top_idx    = int(probs.argmax())
            confidence = float(probs[top_idx]) * 100.0

        predicted_crop = _class_names[top_idx]
        low_conf       = confidence < confidence_threshold

        log.info(
            "CropVerifier: predicted='%s' conf=%.2f%% threshold=%.1f%% low_conf=%s",
            predicted_crop, confidence, confidence_threshold, low_conf,
        )

        return CropVerificationResult(
            predicted_crop=predicted_crop,
            confidence=confidence,
            success=True,
            low_confidence=low_conf,
        )

    except Exception as exc:
        log.error("CropVerifier inference error: %s", exc)
        return CropVerificationResult(
            predicted_crop="", confidence=0.0, success=False, error=str(exc)
        )


def crops_match(predicted: str, farmer_selected: str) -> bool:
    """
    Case-insensitive, separator-insensitive crop name comparison.

    Examples that match:
        "wheat" == "Wheat" == "WHEAT"
        "green_gram" == "Green Gram" == "green-gram"
        "corn_maize" == "Corn Maize" == "CornMaize"
    """
    def _norm(s: str) -> str:
        return re.sub(r"[\s\-_]+", "", s.lower().strip())

    return _norm(predicted) == _norm(farmer_selected)
