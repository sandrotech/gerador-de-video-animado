#!/usr/bin/env python3
"""Procedural SFX synthesizer & mixer for @desmontandoomundo style videos.

Mixes subtle studio sound effects (camera whooshes, label pops, water drops,
air pump/hiss, and completion chime) into public/assets/ar-condicionado/audio.wav
at the exact frame timestamps used in ThreeDiorama.tsx and ReelStage.tsx.
"""
import shutil
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy.signal import butter, lfilter

ASSETS = Path(__file__).resolve().parent.parent / "public" / "assets" / "ar-condicionado"
FPS = 30.0


def synth_pop(sr: int, pitch: float = 520.0, dur: float = 0.085, amp: float = 0.14) -> np.ndarray:
    """Crisp cartoon pop/bloop (rising pitch sine with fast exponential decay)."""
    t = np.linspace(0, dur, int(sr * dur), endpoint=False)
    freq = pitch * (1.0 + 1.15 * (t / dur))
    phase = 2 * np.pi * np.cumsum(freq) / sr
    env = np.sin(np.pi * (t / dur)) * np.exp(-t * 24.0)
    return (np.sin(phase) * env * amp).astype(np.float32)


def synth_whoosh(sr: int, dur: float = 0.34, amp: float = 0.085) -> np.ndarray:
    """Soft filtered noise whoosh for smooth 3D camera transitions."""
    n = int(sr * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    rng = np.random.default_rng(42)
    noise = rng.standard_normal(n)
    b, a = butter(2, [220 / (sr / 2), 1400 / (sr / 2)], btype="band")
    filtered = lfilter(b, a, noise)
    env = np.sin(np.pi * (t / dur)) ** 1.8
    return (filtered * env * amp).astype(np.float32)


def synth_drip(sr: int, dur: float = 0.09, amp: float = 0.12) -> np.ndarray:
    """Water droplet plink for the drain scene."""
    t = np.linspace(0, dur, int(sr * dur), endpoint=False)
    freq = 950.0 + 1400.0 * (t / dur) ** 1.5
    phase = 2 * np.pi * np.cumsum(freq) / sr
    env = np.exp(-t * 32.0)
    return (np.sin(phase) * env * amp).astype(np.float32)


def synth_chime(sr: int, dur: float = 0.65, amp: float = 0.14) -> np.ndarray:
    """Warm major triad completion chime for 'Pronto! Agora você sabe...'."""
    t = np.linspace(0, dur, int(sr * dur), endpoint=False)
    freqs = [523.25, 659.25, 783.99, 1046.5]  # C5, E5, G5, C6
    out = np.zeros_like(t)
    for i, f in enumerate(freqs):
        delay = int(i * 0.045 * sr)
        sub_t = t[: len(t) - delay]
        tone = np.sin(2 * np.pi * f * sub_t) * np.exp(-sub_t * 5.5)
        out[delay:] += tone * (0.45 / len(freqs))
    return (out * (amp / 0.12)).astype(np.float32)


def add_at(track: np.ndarray, sr: int, frame: int, sfx: np.ndarray):
    idx = int((frame / FPS) * sr)
    if idx < 0 or idx >= len(track):
        return
    end = min(len(track), idx + len(sfx))
    seg = sfx[: end - idx]
    if track.ndim == 2:
        track[idx:end, 0] += seg
        track[idx:end, 1] += seg
    else:
        track[idx:end] += seg


def main():
    audio_path = ASSETS / "audio.wav"
    backup_path = ASSETS / "voice_raw.wav"
    if not backup_path.exists():
        shutil.copyfile(audio_path, backup_path)

    data, sr = sf.read(backup_path, dtype="float32")
    mixed = data.copy()

    # 1. Camera transition whooshes (from CAM_KEYS in ThreeDiorama.tsx)
    whoosh_frames = [170, 365, 550, 825, 918, 1250, 1512, 1795, 1852, 1900, 1982]
    for wf in whoosh_frames:
        add_at(mixed, sr, wf, synth_whoosh(sr, dur=0.32, amp=0.075))

    # 2. Label & Pill Pop-ins (from ReelStage.tsx)
    pop_frames = [
        (10, 480.0),
        (175, 540.0),
        (288, 600.0),
        (372, 520.0),
        (405, 580.0),
        (495, 640.0),
        (558, 520.0),
        (625, 620.0),
        (670, 560.0),
        (760, 500.0),
        (835, 540.0),
        (930, 500.0),
        (1045, 620.0),
        (1108, 540.0),
        (1185, 660.0),
        (1260, 520.0),
        (1365, 620.0),
        (1455, 540.0),
        (1545, 520.0),
        (1605, 640.0),
        (1665, 580.0),
        (1808, 540.0),
        (1858, 620.0),
        (1905, 560.0),
        (1918, 640.0),
        (1990, 620.0),
        (2105, 580.0),
        (2145, 680.0),
    ]
    for pf, pitch in pop_frames:
        add_at(mixed, sr, pf, synth_pop(sr, pitch=pitch, amp=0.12))

    # 3. Water drips in Scene 7A/7B (Drain scene)
    for df in [1815, 1832, 1862, 1878, 1892]:
        add_at(mixed, sr, df, synth_drip(sr, amp=0.11))

    # 4. Completion chime on "Pronto! Agora você sabe como montar um ar-condicionado!"
    add_at(mixed, sr, 2076, synth_chime(sr, amp=0.15))

    # Soft clip protection
    peak = np.max(np.abs(mixed))
    if peak > 0.98:
        mixed = mixed * (0.98 / peak)

    sf.write(audio_path, mixed, sr)
    print(f"Mixed procedural SFX into {audio_path} ({len(mixed)/sr:.1f}s @ {sr}Hz)")


if __name__ == "__main__":
    main()

