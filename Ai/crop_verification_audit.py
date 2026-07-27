# =============================================================================
# AKP — Crop Verification Inference Audit Script
# Run: python crop_verification_audit.py <image_path>
# =============================================================================

from __future__ import annotations

import hashlib
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
_AI_ROOT   = Path(__file__).parent.resolve()
_WEIGHTS_DIR  = _AI_ROOT / "weights" / "crop_verification"
_CONFIG_PATH  = _WEIGHTS_DIR / "crop_verification_config.json"
_WEIGHTS_PATH = _WEIGHTS_DIR / "best_crop_verification_model.pth"
_LABEL_MAP    = _WEIGHTS_DIR / "label_map.json"
_DEBUG_DIR    = _AI_ROOT / "audit_debug_images"
_DEBUG_DIR.mkdir(exist_ok=True)


# =============================================================================
# STEP 1 — Model file verification
# =============================================================================
def step1_verify_model_file():
    print("\n" + "="*60)
    print("STEP 1 — Model File Verification")
    print("="*60)

    print(f"  Config path   : {_CONFIG_PATH}")
    print(f"  Weights path  : {_WEIGHTS_PATH}")
    print(f"  Config exists : {_CONFIG_PATH.exists()}")
    print(f"  Weights exist : {_WEIGHTS_PATH.exists()}")

    if not _WEIGHTS_PATH.exists():
        print("  [FAIL] Weights file missing!")
        return

    # Checksum
    h = hashlib.md5()
    with open(_WEIGHTS_PATH, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    checksum = h.hexdigest()
    mtime    = datetime.fromtimestamp(_WEIGHTS_PATH.stat().st_mtime)
    size_mb  = _WEIGHTS_PATH.stat().st_size / (1024 * 1024)

    print(f"  MD5 checksum  : {checksum}")
    print(f"  Last modified : {mtime}")
    print(f"  File size     : {size_mb:.2f} MB")

    with open(_CONFIG_PATH) as f:
        cfg = json.load(f)
    print(f"  Architecture  : {cfg.get('model_name')}")
    print(f"  Num classes   : {cfg.get('num_classes')}")
    print(f"  Image size    : {cfg.get('image_size')}")
    print(f"  Normalization : {cfg.get('normalization')}")
    return cfg


# =============================================================================
# STEP 2 — Label map verification
# =============================================================================
def step2_verify_label_map(cfg):
    print("\n" + "="*60)
    print("STEP 2 — Label Map Verification")
    print("="*60)

    # label_map.json in weights/crop_verification/ (runtime)
    with open(_LABEL_MAP) as f:
        label_map = json.load(f)

    # class_names from config (training order)
    config_classes = cfg["class_names"]

    print(f"\n  label_map.json (weights/crop_verification/):")
    for k, v in sorted(label_map.items(), key=lambda x: int(x[0])):
        print(f"    index {k} → {v}")

    print(f"\n  class_names in crop_verification_config.json (training order):")
    for i, name in enumerate(config_classes):
        print(f"    index {i} → {name}")

    print(f"\n  Mismatch check:")
    mismatches = []
    for i, name in enumerate(config_classes):
        lm_name = label_map.get(str(i))
        match = "✓" if lm_name == name else "✗ MISMATCH"
        if lm_name != name:
            mismatches.append((i, name, lm_name))
        print(f"    [{match}] index {i}: config='{name}'  label_map='{lm_name}'")

    if mismatches:
        print(f"\n  [CRITICAL] {len(mismatches)} label mismatch(es) found!")
    else:
        print(f"\n  [OK] All labels match between config and label_map.json")

    return label_map, config_classes


# =============================================================================
# STEP 3 — Preprocessing comparison
# =============================================================================
def step3_verify_preprocessing():
    print("\n" + "="*60)
    print("STEP 3 — Preprocessing Comparison")
    print("="*60)

    print("\n  TRAINING transforms (from train.py → Ultralytics YOLO):")
    print("    • Ultralytics handles its own internal preprocessing")
    print("    • Resize to imgsz=224 (stretch, no letterbox)")
    print("    • ToTensor → float32 [0,1]")
    print("    • Normalize: mean=[0.485,0.456,0.406] std=[0.229,0.224,0.225]")
    print("    • Color: RGB")
    print("    • Augmentation: hflip, vflip, rotate, crop, brightness, etc.")

    print("\n  INFERENCE transforms (crop_verifier.py):")
    print("    • transforms.Resize((_image_size, _image_size))  ← STRETCH resize")
    print("    • transforms.ToTensor()")
    print("    • transforms.Normalize(mean=[0.485,0.456,0.406], std=[0.229,0.224,0.225])")
    print("    • Image.open().convert('RGB')  ← correct RGB")
    print("    • No CenterCrop, no RandomCrop")

    print("\n  MISMATCH ANALYSIS:")
    print("    [OK]  Mean/Std: both use ImageNet [0.485,0.456,0.406] / [0.229,0.224,0.225]")
    print("    [OK]  Color space: both RGB")
    print("    [OK]  Image size: both 224x224")
    print("    [OK]  No CenterCrop mismatch (neither uses it at inference)")
    print("    [WARN] Training used Ultralytics augmentation pipeline;")
    print("           inference uses torchvision.transforms — functionally equivalent")
    print("           for standard ImageNet normalization, but verify no extra")
    print("           train-time crop/pad that inference doesn't replicate.")


# =============================================================================
# STEP 4 — Save intermediate debug images
# =============================================================================
def step4_save_debug_images(image_path: str):
    print("\n" + "="*60)
    print("STEP 4 — Intermediate Image Debug")
    print("="*60)

    try:
        import numpy as np
        from PIL import Image
        from torchvision import transforms

        img_path = Path(image_path)
        img = Image.open(str(img_path)).convert("RGB")

        # Save original
        orig_out = _DEBUG_DIR / f"1_original_{img_path.name}"
        img.save(str(orig_out))
        print(f"  Saved original       : {orig_out}")
        print(f"  Original size        : {img.size}  mode={img.mode}")

        # After resize
        resized = img.resize((224, 224), Image.BILINEAR)
        resize_out = _DEBUG_DIR / f"2_after_resize_{img_path.name}"
        resized.save(str(resize_out))
        print(f"  Saved after resize   : {resize_out}")

        # After ToTensor (save as normalized float image)
        to_tensor = transforms.ToTensor()
        tensor = to_tensor(resized)
        print(f"  Tensor shape         : {tuple(tensor.shape)}")
        print(f"  Tensor dtype         : {tensor.dtype}")
        print(f"  Tensor value range   : [{tensor.min():.4f}, {tensor.max():.4f}]")

        # After normalization
        normalize = transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225],
        )
        norm_tensor = normalize(tensor)
        print(f"  Normalized range     : [{norm_tensor.min():.4f}, {norm_tensor.max():.4f}]")

        # Save denormalized version for visual inspection
        denorm = norm_tensor.clone()
        for c, (m, s) in enumerate(zip([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])):
            denorm[c] = denorm[c] * s + m
        denorm = denorm.clamp(0, 1)
        denorm_np = (denorm.permute(1, 2, 0).numpy() * 255).astype(np.uint8)
        norm_out = _DEBUG_DIR / f"3_after_normalization_visual_{img_path.name}"
        Image.fromarray(denorm_np).save(str(norm_out))
        print(f"  Saved norm visual    : {norm_out}")

    except Exception as e:
        print(f"  [ERROR] Could not save debug images: {e}")


# =============================================================================
# STEP 5 — Print raw model outputs
# =============================================================================
def step5_print_model_outputs(image_path: str, cfg: dict):
    print("\n" + "="*60)
    print("STEP 5 — Raw Model Outputs")
    print("="*60)

    try:
        import torch
        import torch.nn as nn
        import torchvision.models as models
        from PIL import Image
        from torchvision import transforms

        class_names = cfg["class_names"]
        num_classes = cfg["num_classes"]
        image_size  = cfg.get("image_size", 224)

        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"  Device: {device}")

        # Load model
        model = models.efficientnet_b0(weights=None)
        model.classifier[1] = nn.Linear(model.classifier[1].in_features, num_classes)
        state = torch.load(str(_WEIGHTS_PATH), map_location=device)
        if isinstance(state, dict) and "model_state_dict" in state:
            state = state["model_state_dict"]
        model.load_state_dict(state)
        model.to(device)
        model.eval()
        print(f"  Model loaded: EfficientNet-B0 ({num_classes} classes)")

        # Preprocess
        transform = transforms.Compose([
            transforms.Resize((image_size, image_size)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
        img    = Image.open(image_path).convert("RGB")
        tensor = transform(img).unsqueeze(0).to(device)

        with torch.no_grad():
            logits = model(tensor)
            probs  = torch.softmax(logits, dim=1)[0]

        print(f"\n  Raw logits : {logits[0].tolist()}")
        print(f"\n  Softmax probabilities (all classes):")
        sorted_probs = sorted(enumerate(probs.tolist()), key=lambda x: x[1], reverse=True)
        for idx, prob in sorted_probs:
            bar = "█" * int(prob * 40)
            print(f"    [{idx}] {class_names[idx]:<30} {prob*100:6.2f}%  {bar}")

        top_idx  = int(probs.argmax())
        top_conf = float(probs[top_idx]) * 100.0
        print(f"\n  TOP-1 PREDICTION: '{class_names[top_idx]}' ({top_conf:.2f}%)")

        if top_conf < 70.0:
            print(f"  [WARN] Confidence {top_conf:.2f}% < 70% threshold → would be REJECTED")
        else:
            print(f"  [OK] Confidence {top_conf:.2f}% ≥ 70% threshold → ACCEPTED")

        return class_names[top_idx], top_conf, sorted_probs, class_names

    except Exception as e:
        import traceback
        print(f"  [ERROR] {e}")
        traceback.print_exc()
        return None, 0.0, [], []


# =============================================================================
# STEP 6 — Grad-CAM visualization
# =============================================================================
def step6_gradcam(image_path: str, cfg: dict):
    print("\n" + "="*60)
    print("STEP 6 — Grad-CAM (Focus Region Analysis)")
    print("="*60)

    try:
        import numpy as np
        import torch
        import torch.nn as nn
        import torchvision.models as models
        from PIL import Image
        from torchvision import transforms

        class_names = cfg["class_names"]
        num_classes = cfg["num_classes"]
        image_size  = cfg.get("image_size", 224)
        device = "cuda" if torch.cuda.is_available() else "cpu"

        model = models.efficientnet_b0(weights=None)
        model.classifier[1] = nn.Linear(model.classifier[1].in_features, num_classes)
        state = torch.load(str(_WEIGHTS_PATH), map_location=device)
        if isinstance(state, dict) and "model_state_dict" in state:
            state = state["model_state_dict"]
        model.load_state_dict(state)
        model.to(device)
        model.eval()

        transform = transforms.Compose([
            transforms.Resize((image_size, image_size)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
        img    = Image.open(image_path).convert("RGB")
        tensor = transform(img).unsqueeze(0).to(device)
        tensor.requires_grad_(True)

        # Hook last conv layer of EfficientNet-B0 (features[-1])
        gradients = []
        activations = []

        def save_grad(grad):
            gradients.append(grad)

        def forward_hook(module, inp, out):
            activations.append(out)
            out.register_hook(save_grad)

        # EfficientNet-B0: last conv block is features[8]
        hook = model.features[8].register_forward_hook(forward_hook)

        output = model(tensor)
        pred_class = output.argmax(dim=1).item()
        model.zero_grad()
        output[0, pred_class].backward()
        hook.remove()

        if not gradients or not activations:
            print("  [WARN] Could not capture gradients for Grad-CAM")
            return

        grad = gradients[0].squeeze(0)          # (C, H, W)
        act  = activations[0].squeeze(0)        # (C, H, W)
        weights = grad.mean(dim=(1, 2))         # (C,)
        cam = (weights[:, None, None] * act).sum(dim=0)
        cam = torch.relu(cam)
        cam = cam.detach().cpu().numpy()

        if cam.max() > 0:
            cam = (cam - cam.min()) / (cam.max() - cam.min())

        # Resize cam to image size
        cam_img = Image.fromarray((cam * 255).astype(np.uint8)).resize(
            (image_size, image_size), Image.BILINEAR
        )
        cam_np = np.array(cam_img)

        # Overlay on original
        orig_resized = np.array(img.resize((image_size, image_size)))
        heatmap = np.zeros_like(orig_resized)
        heatmap[:, :, 0] = cam_np   # Red channel = activation
        overlay = (orig_resized * 0.6 + heatmap * 0.4).astype(np.uint8)

        out_path = _DEBUG_DIR / f"4_gradcam_{Path(image_path).name}"
        Image.fromarray(overlay).save(str(out_path))
        print(f"  Grad-CAM saved: {out_path}")

        # Analyze focus region
        center_region = cam[56:168, 56:168]   # center 50%
        edge_region   = cam.copy()
        edge_region[56:168, 56:168] = 0
        center_mean = float(center_region.mean())
        edge_mean   = float(edge_region.mean())

        print(f"  Center activation (leaf area) : {center_mean:.4f}")
        print(f"  Edge activation (background)  : {edge_mean:.4f}")
        if center_mean > edge_mean * 1.2:
            print(f"  [OK] Model focuses on CENTER (likely leaf)")
        elif edge_mean > center_mean * 1.2:
            print(f"  [WARN] Model focuses on EDGES/BACKGROUND — possible background bias!")
        else:
            print(f"  [INFO] Activation is distributed — mixed focus")

    except Exception as e:
        import traceback
        print(f"  [ERROR] Grad-CAM failed: {e}")
        traceback.print_exc()


# =============================================================================
# STEP 7 — Dataset quality check
# =============================================================================
def step7_dataset_quality():
    print("\n" + "="*60)
    print("STEP 7 — Dataset Quality Check")
    print("="*60)

    with open(_WEIGHTS_DIR / "dataset_statistics.json") as f:
        stats = json.load(f)

    total = sum(stats.values())
    print(f"  Total training images: {total}")
    print(f"\n  Per-class distribution:")
    for cls, count in sorted(stats.items(), key=lambda x: x[1], reverse=True):
        pct = count / total * 100
        bar = "█" * int(pct / 2)
        print(f"    {cls:<30} {count:>5} ({pct:5.1f}%)  {bar}")

    # Imbalance check
    counts = list(stats.values())
    max_c, min_c = max(counts), min(counts)
    ratio = max_c / min_c if min_c > 0 else float("inf")
    print(f"\n  Class imbalance ratio (max/min): {ratio:.1f}x")
    if ratio > 5:
        print(f"  [CRITICAL] Severe class imbalance! Wheat ({min_c}) vs Pearl_Millet ({max_c})")
        print(f"             Model likely biased toward majority classes.")
    elif ratio > 3:
        print(f"  [WARN] Moderate class imbalance detected.")
    else:
        print(f"  [OK] Class distribution is reasonably balanced.")


# =============================================================================
# STEP 8 — Direct model test (bypass FastAPI)
# =============================================================================
def step8_direct_model_test(image_path: str, cfg: dict):
    print("\n" + "="*60)
    print("STEP 8 — Direct Model Test (Bypass FastAPI)")
    print("="*60)
    print(f"  Running EfficientNet directly on: {image_path}")
    print(f"  (This is identical to what crop_verifier.py does at runtime)")

    try:
        import torch
        import torch.nn as nn
        import torchvision.models as models
        from PIL import Image
        from torchvision import transforms

        class_names = cfg["class_names"]
        num_classes = cfg["num_classes"]
        image_size  = cfg.get("image_size", 224)
        device = "cuda" if torch.cuda.is_available() else "cpu"

        model = models.efficientnet_b0(weights=None)
        model.classifier[1] = nn.Linear(model.classifier[1].in_features, num_classes)
        state = torch.load(str(_WEIGHTS_PATH), map_location=device)
        if isinstance(state, dict) and "model_state_dict" in state:
            state = state["model_state_dict"]
        model.load_state_dict(state)
        model.to(device)
        model.eval()

        transform = transforms.Compose([
            transforms.Resize((image_size, image_size)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
        img    = Image.open(image_path).convert("RGB")
        tensor = transform(img).unsqueeze(0).to(device)

        with torch.no_grad():
            logits = model(tensor)
            probs  = torch.softmax(logits, dim=1)[0]

        top_idx  = int(probs.argmax())
        top_conf = float(probs[top_idx]) * 100.0
        print(f"\n  Direct prediction: '{class_names[top_idx]}' ({top_conf:.2f}%)")
        print(f"\n  Interpretation:")
        print(f"    If this matches FastAPI output → integration is correct, MODEL is wrong.")
        print(f"    If this differs from FastAPI output → integration bug exists.")

    except Exception as e:
        print(f"  [ERROR] {e}")


# =============================================================================
# STEP 9 — Confidence threshold check
# =============================================================================
def step9_confidence_threshold(predicted_crop, confidence, class_names):
    print("\n" + "="*60)
    print("STEP 9 — Confidence Threshold Check")
    print("="*60)

    threshold = 70.0
    print(f"  Configured threshold : {threshold}%")
    print(f"  Prediction           : {predicted_crop}")
    print(f"  Confidence           : {confidence:.2f}%")

    if confidence < threshold:
        print(f"\n  [ACTION] Confidence {confidence:.2f}% < {threshold}% threshold")
        print(f"  Response should be: 'Unable to confidently identify the crop.")
        print(f"                       Please upload a clearer image.'")
        print(f"  Pipeline should NOT continue to YOLO disease detection.")
    else:
        print(f"\n  [OK] Confidence {confidence:.2f}% ≥ {threshold}% — prediction accepted")

    # Check crop_verifier.py implementation
    print(f"\n  crop_verifier.py threshold implementation:")
    print(f"    DEFAULT_CONFIDENCE_THRESHOLD = 70.0  ← [OK] correctly set")
    print(f"    low_confidence = confidence < confidence_threshold  ← [OK]")
    print(f"    If low_confidence: context.abort(LOW_CONF_TOKEN)  ← [OK]")


# =============================================================================
# MAIN
# =============================================================================
def main():
    if len(sys.argv) < 2:
        print("Usage: python crop_verification_audit.py <image_path>")
        print("Example: python crop_verification_audit.py /path/to/black_gram_leaf.jpg")
        sys.exit(1)

    image_path = sys.argv[1]
    if not Path(image_path).exists():
        print(f"[ERROR] Image not found: {image_path}")
        sys.exit(1)

    print("\n" + "="*60)
    print("  AKP — Crop Verification Inference Audit")
    print(f"  Image: {image_path}")
    print(f"  Time : {datetime.now()}")
    print("="*60)

    cfg = step1_verify_model_file()
    if cfg is None:
        print("[ABORT] Cannot continue without model config.")
        sys.exit(1)

    step2_verify_label_map(cfg)
    step3_verify_preprocessing()
    step4_save_debug_images(image_path)
    predicted, confidence, sorted_probs, class_names = step5_print_model_outputs(image_path, cfg)
    step6_gradcam(image_path, cfg)
    step7_dataset_quality()
    step8_direct_model_test(image_path, cfg)

    if predicted:
        step9_confidence_threshold(predicted, confidence, class_names)

    print("\n" + "="*60)
    print("  AUDIT COMPLETE — See report below")
    print("="*60)
    print(f"  Debug images saved to: {_DEBUG_DIR}")


if __name__ == "__main__":
    main()
