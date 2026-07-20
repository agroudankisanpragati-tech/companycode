# =============================================================================
# Pragati AI — Voice Dataset Generator
# voice_generator.py
# Offline TTS using Piper (https://github.com/rhasspy/piper).
# Auto-detects piper.exe and voice model from project-relative paths.
# Uses pathlib for all file operations. Works on Windows 11.
# =============================================================================

import logging
import os
import subprocess
from pathlib import Path
from typing import Optional

logger = logging.getLogger("voice_generator")


def _find_piper_executable(piper_dir: Path) -> Path:
    """Locate piper.exe inside the given piper_dir."""
    candidate = piper_dir / "piper.exe"
    if candidate.is_file():
        return candidate
    raise FileNotFoundError(
        f"piper.exe not found in: {piper_dir}\n"
        "Expected: voice_models/piper/piper.exe"
    )


def _find_model_files(voices_dir: Path, model_relative: str) -> tuple[Path, Path]:
    """
    Resolve the .onnx model and its .onnx.json config from voices_dir.
    model_relative example: 'hindi/hi_IN-pratham-medium.onnx'
    Returns (onnx_path, json_path).
    """
    onnx_path = voices_dir / model_relative
    json_path = Path(str(onnx_path) + ".json")

    if not onnx_path.is_file():
        raise FileNotFoundError(
            f"Voice model not found: {onnx_path}\n"
            "Expected inside: voice_models/voices/"
        )
    if not json_path.is_file():
        raise FileNotFoundError(
            f"Voice model config not found: {json_path}\n"
            "The .onnx.json file must sit next to the .onnx file."
        )
    return onnx_path, json_path


class PiperTTSEngine:
    """
    Wraps the Piper TTS executable to synthesize speech offline.

    Piper is invoked as a subprocess:
        echo "sentence" | piper.exe --model model.onnx --config model.onnx.json --output_file out.wav

    ESPEAK_DATA_PATH is set automatically so Piper finds its phoneme data
    on Windows without any manual environment configuration.
    """

    def __init__(
        self,
        piper_dir: Path,
        voices_dir: Path,
        model_relative: str,
        sample_rate: int = 22050,
    ):
        self.piper_exe: Path = _find_piper_executable(piper_dir)
        self.model_path: Path
        self.model_config_path: Path
        self.model_path, self.model_config_path = _find_model_files(
            voices_dir, model_relative
        )
        self.sample_rate = sample_rate
        self.espeak_data: Path = piper_dir / "espeak-ng-data"

        logger.debug(f"PiperTTSEngine ready | exe={self.piper_exe.name} | model={self.model_path.name}")

    def synthesize(self, text: str, output_wav_path: Path) -> bool:
        """
        Synthesize text to a WAV file.
        Returns True on success, False on any failure.
        Never raises — batch processing must continue uninterrupted.
        """
        output_wav_path.parent.mkdir(parents=True, exist_ok=True)

        cmd: list[str] = [
            str(self.piper_exe),
            "--model", str(self.model_path),
            "--config", str(self.model_config_path),
            "--output_file", str(output_wav_path),
        ]

        env = os.environ.copy()
        if self.espeak_data.is_dir():
            env["ESPEAK_DATA_PATH"] = str(self.espeak_data)

        try:
            result = subprocess.run(
                cmd,
                input=text.encode("utf-8"),
                capture_output=True,
                timeout=60,
                env=env,
            )
            if result.returncode != 0:
                logger.debug(
                    f"Piper non-zero exit {result.returncode} for: "
                    f"{output_wav_path.name} | stderr: "
                    f"{result.stderr.decode('utf-8', errors='replace').strip()}"
                )
                return False
            if not output_wav_path.is_file():
                return False
            if output_wav_path.stat().st_size == 0:
                output_wav_path.unlink(missing_ok=True)
                return False
            return True
        except subprocess.TimeoutExpired:
            logger.debug(f"Piper timeout for: {output_wav_path.name}")
            return False
        except Exception as exc:
            logger.debug(f"Piper error for {output_wav_path.name}: {exc}")
            return False
