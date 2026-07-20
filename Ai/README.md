# AKP AI Module — Agroudan Kisan Pragati

Crop disease and pest detection AI for the AKP agriculture platform.
Python 3.11 · YOLOv8 Classification · CPU now · GPU-ready (Google Colab)

---

## Folder Structure

```
Ai/
├── crop_dataset/          # Raw image dataset — NEVER modify this structure
│   ├── Black_gram/
│   │   ├── healthy/
│   │   ├── diseases/
│   │   └── pests/
│   ├── green_gram/        (same structure)
│   ├── corn_maize/        (same structure)
│   └── Tomato/
│       ├── healthy/
│       ├── disease/       ← Tomato uses "disease" not "diseases"
│       └── pests/
│
├── training/              # Training pipeline scripts (future)
├── inference/             # Inference / prediction scripts (future)
├── models/                # Model architecture definitions (future)
├── weights/               # All saved model weight files
│   ├── checkpoints/       # .pt files saved during training (best, last)
│   ├── pretrained/        # Downloaded base weights (yolov8s-cls.pt, etc.)
│   └── exported/          # Final exported models (.onnx, .tflite, etc.)
├── configs/               # Per-crop YAML training configs (future)
├── utils/                 # Shared utility functions (future)
├── logs/                  # All log files — auto-created, never commit
│   ├── training/          # One log file per training session
│   └── inference/         # Inference request logs
├── outputs/               # All generated artifacts
│   ├── predictions/       # Saved prediction result images
│   ├── reports/           # JSON evaluation reports per crop
│   └── visualizations/    # Confusion matrices, training curves
└── knowledge_base/        # Agronomic text data for RAG / LLM features (future)
```

---

## Core Files

| File | Purpose |
|---|---|
| `constants.py` | Single source of truth — all crop names, disease lists, pest lists, hyperparameter defaults. **Never imports from other project files.** |
| `config.py` | Detects hardware (CPU/GPU/MPS), resolves all absolute paths from `AI_ROOT`, builds the `AKPConfig` singleton. Import `get_config()` everywhere. |
| `logger.py` | Provides `get_logger(__name__)` — colored console output + rotating file logs. Every module calls this. |
| `requirements.txt` | All Python dependencies with pinned versions. CPU by default; GPU (CUDA 11.8 / 12.1) and Google Colab instructions are commented inside. |

---

## Setup

```bash
# 1. Create virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

# 2. Install dependencies (CPU)
pip install -r requirements.txt

# 3. Verify configuration
python config.py
```

---

## Adding a New Crop

1. Add the crop folder to `crop_dataset/` with `healthy/`, `diseases/`, `pests/` subfolders
2. Add the folder name to `SUPPORTED_CROPS` in `constants.py`
3. Add its display name to `CROP_DISPLAY_NAMES`
4. Add its diseases to `CROP_DISEASE_MAP`
5. Add its pests to `CROP_PEST_MAP`
6. If the diseases folder has a non-standard name, add it to `CROP_DISEASE_FOLDER_OVERRIDE`

The rest of the system picks it up automatically — no other files need changes.

---

## Google Colab GPU Training

Run these cells at the top of your Colab notebook:

```python
# Cell 1 — Install dependencies
!pip install ultralytics==8.2.103
!pip install torch==2.3.1+cu121 torchvision==0.18.1+cu121 \
    --extra-index-url https://download.pytorch.org/whl/cu121
!pip install opencv-python-headless Pillow numpy pandas scikit-learn \
    matplotlib seaborn onnx onnxruntime PyYAML python-dotenv tqdm \
    rich click tensorboard albumentations pymongo psutil

# Cell 2 — Mount Drive and set path
from google.colab import drive
drive.mount('/content/drive')
import sys
sys.path.insert(0, '/content/drive/MyDrive/Ai')  # adjust to your path

# Cell 3 — Verify GPU
import torch
print(torch.cuda.is_available())   # True

# Cell 4 — Run training
!cd /content/drive/MyDrive/Ai && python train.py
```

---

## Hardware

| Mode | How to activate |
|---|---|
| CPU (default) | Nothing — works out of the box |
| NVIDIA GPU (CUDA 11.8) | Uncomment `cu118` lines in `requirements.txt`, reinstall torch |
| NVIDIA GPU (CUDA 12.1) | Uncomment `cu121` lines in `requirements.txt`, reinstall torch |
| Apple Silicon (MPS) | Install standard torch — `config.py` detects MPS automatically |
| Google Colab GPU | See **Google Colab GPU Training** section above |

---

## Environment Variables

Override any default without touching code:

```
AKP_EPOCHS=100
AKP_BATCH_SIZE=32
AKP_LR=0.0005
AKP_IMAGE_SIZE=320
AKP_WORKERS=4
AKP_MODEL_WEIGHTS=yolov8m-cls.pt   # yolov8n/s/m/l/x-cls.pt
AKP_LOG_LEVEL=DEBUG
AKP_DEBUG=false
AKP_AUGMENT=true
AKP_PRETRAINED=true
AKP_RESUME=false
```

Create a `.env` file in the `Ai/` folder — it is loaded automatically by `config.py`.

---

## Supported Crops

| Folder | Display Name |
|---|---|
| `Black_gram` | Black Gram (Urad Dal) |
| `green_gram` | Green Gram (Moong Dal) |
| `corn_maize` | Corn / Maize |
| `Tomato` | Tomato |

---

## Python Version

Requires **Python 3.11**. Run `python --version` to confirm before setup.
