# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: fastapi_server.py
# Purpose: FastAPI inference service. Loads best.pt once at startup.
#          Supports crop-aware filtered prediction — only classes belonging
#          to the selected crop are considered, eliminating cross-crop confusion.
#
# Run: python fastapi_server.py
# =============================================================================

from __future__ import annotations

import json
import os
import shutil
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import get_config
from logger import get_logger

log = get_logger(__name__)

# =============================================================================
# SECTION 1 — CROP INDEX (built dynamically from dataset_index.json)
# =============================================================================

# crop_name (lowercase) → set of class_ids that belong to it
_crop_class_ids: dict[str, set[int]] = {}
# crop_name (lowercase) → canonical display name (original case)
_crop_display_names: dict[str, str] = {}
# class_id → (crop_name, category, class_name)
_class_id_meta: dict[int, tuple[str, str, str]] = {}


def _build_crop_index() -> None:
    """
    Reads dataset_index.json and builds:
      - _crop_class_ids: crop → set of class_ids
      - _crop_display_names: normalized crop → original crop name
      - _class_id_meta: class_id → (crop, category, class_name)
    Zero hardcoded crop names — everything comes from the index file.
    """
    cfg = get_config()
    index_path = cfg.paths.outputs_dir / "dataset_index.json"

    if not index_path.exists():
        log.warning("dataset_index.json not found at %s — crop filtering disabled", index_path)
        return

    with open(index_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    for record in data.get("images", []):
        crop = record.get("crop_name", "")
        category = record.get("category", "")
        class_name = record.get("class_name", "")
        class_id = record.get("class_id", -1)

        if not crop or class_id < 0:
            continue

        key = crop.lower()
        _crop_display_names[key] = crop
        _crop_class_ids.setdefault(key, set()).add(class_id)
        if class_id not in _class_id_meta:
            _class_id_meta[class_id] = (crop, category, class_name)

    log.info(
        "Crop index built: %d crops, %d unique classes",
        len(_crop_display_names),
        len(_class_id_meta),
    )
    for crop_key, ids in _crop_class_ids.items():
        log.info("  %s → %d classes", _crop_display_names[crop_key], len(ids))


def _resolve_crop_key(crop_hint: str) -> Optional[str]:
    """
    Case-insensitive, separator-insensitive lookup of crop_hint against the index.
    Strips spaces, hyphens, underscores before comparing so that
    'blackgram', 'black-gram', 'Black Gram', 'Black_gram', 'Green_gram' all resolve correctly.
    Also checks CROP_ALIASES from constants.py for additional variant matching.
    Returns the normalized key (lowercase) or None if not found.
    """
    import re
    from constants import CROP_ALIASES

    def strip_sep(s: str) -> str:
        return re.sub(r'[\s\-_]+', '', s.lower().strip())

    hint_stripped = strip_sep(crop_hint)
    log.info("[CropResolve] raw='%s'  stripped='%s'", crop_hint, hint_stripped)

    # Exact stripped match against index keys
    for key in _crop_class_ids:
        if strip_sep(key) == hint_stripped:
            log.info("[CropResolve] exact match: '%s' -> '%s'", crop_hint, key)
            return key

    # Check CROP_ALIASES — maps canonical crop folder name to known aliases
    for crop_folder, aliases in CROP_ALIASES.items():
        if hint_stripped in aliases:
            # Find the matching index key for this crop folder
            for key in _crop_class_ids:
                if strip_sep(key) == strip_sep(crop_folder):
                    log.info("[CropResolve] alias match: '%s' -> '%s' (via %s)", crop_hint, key, crop_folder)
                    return key

    # Partial match (only if one fully contains the other)
    for key in _crop_class_ids:
        ks = strip_sep(key)
        if ks and hint_stripped and (ks == hint_stripped or
           (ks in hint_stripped and len(ks) / len(hint_stripped) > 0.6) or
           (hint_stripped in ks and len(hint_stripped) / len(ks) > 0.6)):
            log.info("[CropResolve] partial match: '%s' -> '%s'", crop_hint, key)
            return key

    log.warning("[CropResolve] NO MATCH for '%s' (stripped='%s'). Available: %s",
                crop_hint, hint_stripped, list(_crop_class_ids.keys()))
    return None


# =============================================================================
# SECTION 2 — LIFESPAN
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    cfg = get_config()

    # Build crop index from dataset_index.json
    _build_crop_index()

    # Warm up model
    weights = cfg.paths.checkpoints_dir / "best.pt"
    if weights.exists():
        from model_manager import get_model
        get_model(weights_path=weights, device=cfg.hardware.device)
        log.info("Model warmed up: %s on %s", weights.name, cfg.hardware.device)
    else:
        log.warning("best.pt not found at %s", weights)

    yield
    log.info("FastAPI server shutting down")


# =============================================================================
# SECTION 3 — APP
# =============================================================================

app = FastAPI(
    title="AKP YOLO Inference Service",
    version="1.1.0",
    description="Crop-aware YOLOv8 disease/pest detection",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# =============================================================================
# SECTION 4 — ENDPOINTS
# =============================================================================

@app.get("/health")
def health():
    cfg = get_config()
    weights = cfg.paths.checkpoints_dir / "best.pt"
    return {
        "status": "ok",
        "model_loaded": weights.exists(),
        "device": cfg.hardware.device,
        "supported_crops": [_crop_display_names[k] for k in sorted(_crop_display_names)],
        "total_classes": len(_class_id_meta),
        "version": "1.1.0",
    }


@app.get("/crops")
def get_crops():
    """
    Returns all crops and their classes, read dynamically from dataset_index.json.
    Frontend uses this to populate the mandatory crop dropdown.
    """
    crops = []
    for key in sorted(_crop_display_names):
        display = _crop_display_names[key]
        class_ids = _crop_class_ids[key]
        classes = [
            {
                "class_id": cid,
                "class_name": _class_id_meta[cid][2],
                "category": _class_id_meta[cid][1],
            }
            for cid in sorted(class_ids)
            if cid in _class_id_meta
        ]
        crops.append({
            "crop_key": key,
            "crop_name": display,
            "class_count": len(class_ids),
            "classes": classes,
        })
    return {"crops": crops, "total_crops": len(crops)}


@app.post("/predict")
async def predict_endpoint(
    image: UploadFile = File(...),
    crop_hint: Optional[str] = Form(None),
):
    """
    Crop-aware prediction endpoint.

    - If crop_hint is provided and matches a known crop, YOLO output is
      filtered to only that crop's class IDs. Cross-crop confusion eliminated.
    - If crop_hint is not in the index, returns 422 so backend falls back to local knowledge base.
    - Returns top-5 filtered predictions for the selected crop only.
    """
    # Accept image by content-type OR by file extension (handles multipart quirks)
    filename = image.filename or "upload.jpg"
    ext = Path(filename).suffix.lower()
    valid_exts = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".tif"}
    content_type_ok = image.content_type and image.content_type.startswith("image/")
    ext_ok = ext in valid_exts

    if not content_type_ok and not ext_ok:
        log.warning("Rejected upload: content_type=%s filename=%s", image.content_type, filename)
        raise HTTPException(
            status_code=400,
            detail=f"Only image files are accepted (got content_type={image.content_type!r}, ext={ext!r})"
        )

    # Resolve crop
    crop_key: Optional[str] = None
    allowed_class_ids: Optional[set[int]] = None

    if crop_hint:
        crop_key = _resolve_crop_key(crop_hint)
        if crop_key is None:
            raise HTTPException(
                status_code=422,
                detail=f"Crop '{crop_hint}' not found in YOLO training data. Use general knowledge base fallback.",
            )
        allowed_class_ids = _crop_class_ids[crop_key]
        log.info("Crop-filtered predict: %s → %d allowed classes", crop_hint, len(allowed_class_ids))

    suffix = ext if ext in valid_exts else ".jpg"
    tmp_path: Optional[str] = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(image.file, tmp)
            tmp_path = tmp.name

        result = _run_crop_filtered_predict(tmp_path, allowed_class_ids)

        if result["status"] == "error":
            raise HTTPException(status_code=500, detail=result.get("error", "Inference failed"))

        return JSONResponse(content=result)

    except HTTPException:
        raise
    except Exception as exc:
        log.error("Predict endpoint error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


# =============================================================================
# SECTION 5 — CROP-FILTERED INFERENCE
# =============================================================================

def _run_crop_filtered_predict(
    image_path: str,
    allowed_class_ids: Optional[set[int]],
) -> dict:
    """
    Runs YOLO inference and filters results to only the allowed class IDs.

    When allowed_class_ids is provided (crop-aware mode):
      - Raw YOLO top-5 is computed across all 84 classes
      - Only entries whose class_id is in allowed_class_ids are kept
      - Confidences are re-normalized within the crop's class subset
      - Top-1 is the highest-confidence class within the selected crop

    When allowed_class_ids is None (no crop hint):
      - Returns raw YOLO top-5 without filtering
    """
    cfg = get_config()
    weights = cfg.paths.checkpoints_dir / "best.pt"

    try:
        from model_manager import get_model
        handle = get_model(weights_path=weights, device=cfg.hardware.device)
    except Exception as exc:
        return {"status": "error", "error": f"Model load failed: {exc}"}

    try:
        import time
        t0 = time.perf_counter()

        results = handle.model.predict(
            source=image_path,
            verbose=False,
            device=handle.device,
        )
        inference_ms = (time.perf_counter() - t0) * 1000.0

        if not results or results[0].probs is None:
            return {"status": "error", "error": "No classification output from model"}

        probs = results[0].probs
        all_indices = probs.top5 if hasattr(probs.top5, "__iter__") else list(probs.top5)
        all_confs = probs.top5conf if hasattr(probs.top5conf, "tolist") else probs.top5conf

        if hasattr(all_indices, "tolist"):
            all_indices = all_indices.tolist()
        if hasattr(all_confs, "tolist"):
            all_confs = all_confs.tolist()

        # Get ALL class probabilities for crop-filtered re-ranking
        if allowed_class_ids is not None:
            all_probs_tensor = probs.data  # shape: (num_classes,)
            if hasattr(all_probs_tensor, "tolist"):
                all_probs_list = all_probs_tensor.tolist()
            else:
                all_probs_list = list(all_probs_tensor)

            # Filter to only this crop's classes
            crop_entries = [
                (cid, all_probs_list[cid])
                for cid in allowed_class_ids
                if cid < len(all_probs_list)
            ]

            if not crop_entries:
                return {"status": "error", "error": "No valid classes found for selected crop"}

            # Sort by confidence descending
            crop_entries.sort(key=lambda x: x[1], reverse=True)

            # Re-normalize within crop subset
            total_conf = sum(c for _, c in crop_entries) or 1.0
            top5_filtered = crop_entries[:5]

            top5_entries = []
            for rank, (cid, raw_conf) in enumerate(top5_filtered, start=1):
                meta = _class_id_meta.get(cid, ("", "", f"class_{cid}"))
                crop_name, category, class_name = meta
                normalized_conf = round((raw_conf / total_conf) * 100.0, 4)
                top5_entries.append({
                    "rank": rank,
                    "class_id": cid,
                    "class_name": class_name,
                    "confidence": normalized_conf,
                    "crop": crop_name,
                    "category": category,
                })

        else:
            # No crop filter — use raw top-5
            top5_entries = []
            for rank, (idx, conf) in enumerate(zip(all_indices, all_confs), start=1):
                meta = _class_id_meta.get(idx, ("", "", f"class_{idx}"))
                crop_name, category, class_name = meta
                top5_entries.append({
                    "rank": rank,
                    "class_id": idx,
                    "class_name": class_name,
                    "confidence": round(float(conf) * 100.0, 4),
                    "crop": crop_name,
                    "category": category,
                })

        if not top5_entries:
            return {"status": "error", "error": "Empty prediction after filtering"}

        top1 = top5_entries[0]
        return {
            "success": True,
            "status": "success",
            "engine": "yolo",
            "crop": top1["crop"],
            "category": top1["category"],
            "class_name": top1["class_name"],
            "confidence": top1["confidence"],
            "top5": top5_entries,
            "inference_ms": round(inference_ms, 2),
            "crop_filtered": allowed_class_ids is not None,
        }

    except Exception as exc:
        log.error("Inference error: %s", exc)
        return {"status": "error", "error": str(exc)}


# =============================================================================
# SECTION 6 — MAIN
# =============================================================================

if __name__ == "__main__":
    port = int(os.getenv("YOLO_PORT", "8000"))
    host = os.getenv("YOLO_HOST", "0.0.0.0")
    log.info("Starting AKP YOLO FastAPI server on %s:%d", host, port)
    uvicorn.run("fastapi_server:app", host=host, port=port, reload=False, log_level="info")
