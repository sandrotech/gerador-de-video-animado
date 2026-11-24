"""
Masteriza o audio original com FFmpeg (compressao de presenca + loudnorm -14 LUFS)
e mixa efeitos sonoros sutis (whoosh de camera, pops nos badges e chime no gancho)
usando apenas NumPy + wave + FFmpeg.
Saida: template/public/assets/restaurante-contrast/master_audio_sfx.wav
"""
import math
import subprocess
import wave
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
ASSET_DIR = ROOT / "public" / "assets" / "restaurante-contrast"
SRC_WAV = ASSET_DIR / "master_audio.wav"
NORM_WAV = ASSET_DIR / "master_audio_norm.wav"
OUT_WAV = ASSET_DIR / "master_audio_sfx.wav"

FPS = 30.0


def synth_pop(sr: int, pitch: float = 540.0, dur: float = 0.09, amp: float = 0.14) -> np.ndarray:
    t = np.linspace(0, dur, int(sr * dur), endpoint=False)
    freq = pitch * (1.0 + 1.15 * (t / dur))
    phase = 2.0 * np.pi * np.cumsum(freq) / sr
    env = np.sin(np.pi * (t / dur)) * np.exp(-t * 22.0)
    return (np.sin(phase) * env * amp).astype(np.float32)


def synth_punch_boom(sr: int, dur: float = 0.22, amp: float = 0.16) -> np.ndarray:
    """Impacto suave sub-grave + estalo para o gancho 'SO UM LOTA!'."""
    t = np.linspace(0, dur, int(sr * dur), endpoint=False)
    freq = 140.0 * np.exp(-t * 14.0) + 48.0
    phase = 2.0 * np.pi * np.cumsum(freq) / sr
    env = np.exp(-t * 12.0)
    return (np.sin(phase) * env * amp).astype(np.float32)


def synth_whoosh(sr: int, dur: float = 0.34, amp: float = 0.08) -> np.ndarray:
    """Whoosh suave filtrado via media movel simples em NumPy."""
    n = int(sr * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    rng = np.random.default_rng(42)
    noise = rng.standard_normal(n).astype(np.float32)
    # Suavizacao passa-baixa + passa-alta simples
    kernel = np.ones(28, dtype=np.float32) / 28.0
    lp = np.convolve(noise, kernel, mode="same")
    env = np.sin(np.pi * (t / dur)) ** 1.8
    return (lp * env * amp).astype(np.float32)


def add_sfx(stereo: np.ndarray, sr: int, frame: int, sfx: np.ndarray) -> None:
    idx = int((frame / FPS) * sr)
    if idx < 0 or idx >= len(stereo):
        return
    end = min(len(stereo), idx + len(sfx))
    seg = sfx[: end - idx]
    stereo[idx:end, 0] += seg
    stereo[idx:end, 1] += seg


def main() -> None:
    if not SRC_WAV.exists():
        raise FileNotFoundError(f"Audio base nao encontrado: {SRC_WAV}")

    # 1. Masterizacao de voz/trilha com FFmpeg (presenca + normalizacao -14 LUFS)
    cmd = [
        "ffmpeg",
        "-y",
        "-v",
        "error",
        "-i",
        str(SRC_WAV),
        "-af",
        "highpass=f=75,acompressor=threshold=-18dB:ratio=2.2:attack=10:release=120,loudnorm=I=-14:TP=-1.5:LRA=9",
        "-ar",
        "44100",
        "-ac",
        "2",
        "-c:a",
        "pcm_s16le",
        str(NORM_WAV),
    ]
    subprocess.run(cmd, check=True)

    # 2. Leitura do WAV normalizado para mixagem de SFX nos quadros exatos
    with wave.open(str(NORM_WAV), "rb") as wf:
        sr = wf.getframerate()
        n_channels = wf.getnchannels()
        raw = wf.readframes(wf.getnframes())

    arr = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    stereo = arr.reshape(-1, n_channels)
    if n_channels == 1:
        stereo = np.repeat(stereo, 2, axis=1)

    # SFX nos primeiros 5 segundos (gancho + badges + movimento de camera)
    add_sfx(stereo, sr, 2, synth_whoosh(sr, dur=0.32, amp=0.07))
    add_sfx(stereo, sr, 6, synth_pop(sr, pitch=520.0, amp=0.11))
    add_sfx(stereo, sr, 38, synth_punch_boom(sr, dur=0.24, amp=0.14))
    add_sfx(stereo, sr, 55, synth_pop(sr, pitch=620.0, amp=0.12))
    add_sfx(stereo, sr, 82, synth_pop(sr, pitch=580.0, amp=0.12))

    # SFX nos atos seguintes
    for wf in [300, 450, 770, 930, 1020, 1440, 1920, 2535]:
        add_sfx(stereo, sr, wf, synth_whoosh(sr, dur=0.30, amp=0.06))
    for pf in [470, 760, 910, 1030, 1300, 1450, 1700, 1930, 2240, 2545, 2820]:
        add_sfx(stereo, sr, pf, synth_pop(sr, pitch=560.0, amp=0.10))

    # Limiter suave anti-clipping
    stereo = np.clip(stereo, -0.96, 0.96)
    pcm = (stereo * 32767.0).astype(np.int16)

    with wave.open(str(OUT_WAV), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(pcm.tobytes())

    NORM_WAV.unlink(missing_ok=True)
    print(f"Audio master + SFX salvo em: {OUT_WAV}")


if __name__ == "__main__":
    main()
