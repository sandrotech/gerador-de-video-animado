"""
Motor padrao de Audio, Cadencia e Entonacao da Mini Produtora Stech Solucoes.

Carrega por padrao o perfil calibrado `ref_DfVKHAJD3Gx_perfil.json`
(banco-de-referencias/audio/vozes/ref_DfVKHAJD3Gx_perfil.json):
- Velocidade conversacional: ~162-169 WPM (Edge-TTS `pt-BR-AntonioNeural`, rate `+15%`)
- Entonacao dinamica em 4 degraus (`pitch` por papel narrativo):
    * `hook`          -> +6Hz (abertura imediata energica)
    * `body_steps`    -> +0Hz (tom conversacional natural)
    * `climax_result` -> +8Hz (pico emocional na prova/beneficio)
    * `cta_close`     -> -8Hz (queda grave firme de autoridade)
- Pausas calibradas por papel:
    * micro / lista   -> ~0.18s
    * frase padrao    -> ~0.36s
    * virada / pos-hook / pre-cta -> ~0.55s
- Trilha instrumental com ducking automatico (~-19 dB abaixo da voz) +
  2-pass loudnorm (-14 LUFS, TP=-1.6 dBTP) + alimiter (-1.8 dB) -> ZERO clipping.
"""
import asyncio
import json
import math
import re
import subprocess
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional

import edge_tts
import numpy as np

TEMPLATE_DIR = Path(__file__).resolve().parent.parent
WORKSPACE_ROOT = TEMPLATE_DIR.parent
VOZES_DIR = WORKSPACE_ROOT / "banco-de-referencias" / "audio" / "vozes"
TRILHAS_DIR = WORKSPACE_ROOT / "banco-de-referencias" / "audio" / "trilhas"
DEFAULT_PROFILE_ID = "ref_DfVKHAJD3Gx"

FPS = 30
SR = 44100


@dataclass
class SegmentSpec:
    seg_id: str
    text: str
    role: str = "body_steps"  # hook | body_steps | climax_result | cta_close
    pause_after: Optional[float] = None  # None -> usa pausa padrao do perfil conforme `role`


def load_voice_profile(profile_id: str = DEFAULT_PROFILE_ID) -> dict:
    p = VOZES_DIR / f"{profile_id}_perfil.json"
    if not p.exists():
        return {
            "id": "fallback",
            "pacing": {
                "recommended_edge_tts_voice": "pt-BR-AntonioNeural",
                "recommended_edge_tts_rate": "+15%",
            },
            "pauses_sec": {
                "p25_intra_clause": 0.18,
                "median_between_clauses": 0.36,
                "p75_emphasis": 0.55,
            },
            "intonation_pitch_f0_hz": {
                "sections": [
                    {"role": "hook", "tts_pitch_hint": "+6Hz"},
                    {"role": "body_steps", "tts_pitch_hint": "+0Hz"},
                    {"role": "climax_result", "tts_pitch_hint": "+8Hz"},
                    {"role": "cta_close", "tts_pitch_hint": "-8Hz"},
                ]
            },
        }
    return json.loads(p.read_text(encoding="utf-8"))


def get_role_pitch(profile: dict, role: str) -> str:
    sections = profile.get("intonation_pitch_f0_hz", {}).get("sections", [])
    for s in sections:
        if s.get("role") == role:
            return str(s.get("tts_pitch_hint", "+0Hz"))
    return "+0Hz"


def get_default_pause(profile: dict, role: str) -> float:
    ps = profile.get("pauses_sec", {})
    if role == "hook":
        return float(ps.get("p75_emphasis", 0.68))  # pausa longa de gancho (0.65-0.75s)
    if role == "micro":
        return float(ps.get("p25_intra_clause", 0.22))  # micro-respiro entre sub-frases
    if role == "climax_result":
        return float(ps.get("p75_emphasis", 0.56))  # respiro antes do fechamento
    if role == "cta_close":
        return 0.0
    return float(ps.get("median_between_clauses", 0.48))


async def _synth_segment(
    idx: int,
    text: str,
    voice: str,
    rate: str,
    pitch: str,
    tmp_dir: Path,
):
    mp3_path = tmp_dir / f"seg_{idx:02d}.mp3"
    wav_path = tmp_dir / f"seg_{idx:02d}.wav"
    comm = edge_tts.Communicate(
        text,
        voice=voice,
        rate=rate,
        pitch=pitch,
        boundary="WordBoundary",
    )
    words = []
    with open(mp3_path, "wb") as f:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                words.append(
                    {
                        "text": chunk["text"],
                        "start": chunk["offset"] / 10_000_000.0,
                        "end": (chunk["offset"] + chunk["duration"]) / 10_000_000.0,
                    }
                )

    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(mp3_path),
            "-af",
            # EQ de podcast quente: tira brilho metalico sintetico (5.5kHz -3dB) e encorpa grave natural (200Hz +2.5dB)
            "highpass=f=75,equalizer=f=200:t=q:w=1.2:g=2.5,equalizer=f=5500:t=q:w=1.4:g=-3.0,acompressor=threshold=-18dB:ratio=2.2:attack=10:release=110",
            "-ar",
            str(SR),
            "-ac",
            "2",
            "-c:a",
            "pcm_s16le",
            str(wav_path),
        ],
        check=True,
    )
    with wave.open(str(wav_path), "rb") as wf:
        raw = wf.readframes(wf.getnframes())
    arr = np.frombuffer(raw, dtype=np.int16).astype(np.float32).reshape(-1, 2) / 32768.0

    # Trim preciso de silencio das pontas (respeitando pausas naturais calibradas pelo perfil)
    if words:
        s_trim = max(0.0, words[0]["start"] - 0.025)
        e_trim = min(len(arr) / SR, words[-1]["end"] + 0.055)
        i0 = int(s_trim * SR)
        i1 = int(e_trim * SR)
        arr = arr[i0:i1]
        for w in words:
            w["start"] = max(0.0, w["start"] - s_trim)
            w["end"] = max(w["start"] + 0.04, w["end"] - s_trim)

    mp3_path.unlink(missing_ok=True)
    wav_path.unlink(missing_ok=True)
    return arr, words


def load_or_make_bed(total_samples: int, tmp_dir: Path) -> np.ndarray:
    """Usa trilha em banco-de-referencias/audio/trilhas/ ou gera pad corporate suave."""
    if TRILHAS_DIR.exists():
        candidates = sorted(
            [p for p in TRILHAS_DIR.iterdir() if p.suffix.lower() in {".mp3", ".wav", ".m4a", ".ogg"}]
        )
        if candidates:
            track = candidates[0]
            print(f"[TRILHA] Usando trilha do banco de referencias: {track.name}")
            tmp_bed = tmp_dir / "_tmp_bed.wav"
            dur_s = total_samples / SR + 0.5
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-v",
                    "error",
                    "-stream_loop",
                    "-1",
                    "-i",
                    str(track),
                    "-t",
                    f"{dur_s:.3f}",
                    "-ar",
                    str(SR),
                    "-ac",
                    "2",
                    "-c:a",
                    "pcm_s16le",
                    str(tmp_bed),
                ],
                check=True,
            )
            with wave.open(str(tmp_bed), "rb") as wf:
                raw = wf.readframes(wf.getnframes())
            tmp_bed.unlink(missing_ok=True)
            arr = np.frombuffer(raw, dtype=np.int16).astype(np.float32).reshape(-1, 2) / 32768.0
            if len(arr) >= total_samples:
                return arr[:total_samples]
            pad = np.zeros((total_samples - len(arr), 2), dtype=np.float32)
            return np.vstack([arr, pad])

    print("[TRILHA] Gerando trilha instrumental corporate/tech suave...")
    t = np.arange(total_samples, dtype=np.float32) / SR
    chords = [
        [130.81, 196.00, 246.94, 329.63],  # Cmaj7
        [110.00, 164.81, 220.00, 261.63],  # Am7
        [174.61, 220.00, 261.63, 329.63],  # Fmaj7
        [196.00, 246.94, 293.66, 329.63],  # G6
    ]
    bar_sec = 2.0
    sig_l = np.zeros(total_samples, dtype=np.float32)
    sig_r = np.zeros(total_samples, dtype=np.float32)
    n_bars = int(math.ceil((total_samples / SR) / bar_sec))

    for b in range(n_bars):
        i0 = int(b * bar_sec * SR)
        i1 = min(total_samples, int((b + 1) * bar_sec * SR))
        if i1 <= i0:
            continue
        tb = t[i0:i1] - b * bar_sec
        dur_b = (i1 - i0) / SR
        env = np.minimum(1.0, tb / 0.14) * np.minimum(1.0, np.maximum(0.0, (dur_b - tb) / 0.14))
        notes = chords[b % len(chords)]
        pad_l = np.zeros(i1 - i0, dtype=np.float32)
        pad_r = np.zeros(i1 - i0, dtype=np.float32)
        for ni, freq in enumerate(notes):
            det = 0.25 if ni % 2 == 0 else -0.25
            pad_l += np.sin(2 * np.pi * (freq + det) * tb) * (0.24 / len(notes))
            pad_r += np.sin(2 * np.pi * (freq - det) * tb) * (0.24 / len(notes))
        beat_phase = tb % 0.5
        pulse = np.exp(-beat_phase * 14.0) * np.sin(2 * np.pi * (notes[0] * 2.0) * tb) * 0.05
        sig_l[i0:i1] = (pad_l + pulse) * env
        sig_r[i0:i1] = (pad_r + pulse) * env

    fi = min(int(0.4 * SR), total_samples)
    fo = min(int(1.0 * SR), total_samples)
    sig_l[:fi] *= np.linspace(0, 1, fi, dtype=np.float32)
    sig_r[:fi] *= np.linspace(0, 1, fi, dtype=np.float32)
    sig_l[-fo:] *= np.linspace(1, 0, fo, dtype=np.float32)
    sig_r[-fo:] *= np.linspace(1, 0, fo, dtype=np.float32)
    return np.column_stack([sig_l, sig_r])


def make_whoosh(dur=0.20, vol=0.07) -> np.ndarray:
    n = int(SR * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    rng = np.random.default_rng(42)
    noise = rng.normal(0, 1, n)
    smooth = np.convolve(noise, np.ones(60) / 60, mode="same")
    env = np.sin(np.pi * t / dur) ** 1.8
    sig = (smooth * env * vol).astype(np.float32)
    return np.column_stack([sig, sig])


def make_ui_pop(f0=280.0, f1=640.0, dur=0.08, vol=0.08) -> np.ndarray:
    n = int(SR * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    freq = np.linspace(f0, f1, n)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    env = np.exp(-t * 30.0) * np.sin(np.pi * t / dur)
    sig = (np.sin(phase) * env * vol).astype(np.float32)
    return np.column_stack([sig, sig])


def make_kds_beep(f1=1046.5, f2=1567.98, dur=0.10, vol=0.08) -> np.ndarray:
    n = int(SR * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    env = np.sin(np.pi * t / dur) * np.exp(-t * 16.0)
    sig = ((0.65 * np.sin(2 * np.pi * f1 * t) + 0.35 * np.sin(2 * np.pi * f2 * t)) * env * vol).astype(np.float32)
    return np.column_stack([sig, sig])


def make_chime(dur=0.95, vol=0.10) -> np.ndarray:
    n = int(SR * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    env = np.exp(-t * 4.0) * np.minimum(1.0, t / 0.015)
    sig = (
        (
            0.45 * np.sin(2 * np.pi * 523.25 * t)
            + 0.35 * np.sin(2 * np.pi * 659.25 * t)
            + 0.30 * np.sin(2 * np.pi * 783.99 * t)
            + 0.25 * np.sin(2 * np.pi * 1046.5 * t)
        )
        * env
        * vol
    ).astype(np.float32)
    return np.column_stack([sig, sig])


def add_sfx(buf: np.ndarray, sfx: np.ndarray, frame: int):
    idx = int((frame / FPS) * SR)
    end = min(len(buf), idx + len(sfx))
    if 0 <= idx < len(buf) and end > idx:
        buf[idx:end] += sfx[: end - idx]


async def synthesize_with_profile(
    segments: list[SegmentSpec],
    out_wav: Path,
    profile_id: str = DEFAULT_PROFILE_ID,
    tail_sec: float = 3.2,
    sfx_callback: Optional[Callable[[np.ndarray, dict, list[dict]], None]] = None,
) -> dict:
    """
    Sintetiza, aplica pausas + curva de entonacao do perfil padrao (`ref_DfVKHAJD3Gx`),
    adiciona trilha com ducking (-19 dB sob a voz) e masteriza em 2-pass loudnorm (-14 LUFS).
    """
    profile = load_voice_profile(profile_id)
    pacing = profile.get("pacing", {})
    voice_name = pacing.get("recommended_edge_tts_voice", "pt-BR-AntonioNeural")
    rate = pacing.get("recommended_edge_tts_rate", "+15%")
    start_delay = float(pacing.get("start_delay_sec", 0.12))
    # Ataque agil dentro de 0.12-0.25s
    lead_sec = min(0.25, max(0.08, start_delay * 0.5))

    print(f"[CADENCIA PADRAO] Perfil '{profile.get('id', profile_id)}' | voice={voice_name} rate={rate}")

    out_wav.parent.mkdir(parents=True, exist_ok=True)
    tmp_dir = out_wav.parent / f"_tmp_{out_wav.stem}"
    tmp_dir.mkdir(exist_ok=True)

    parts = [np.zeros((int(lead_sec * SR), 2), dtype=np.float32)]
    words_meta = []
    seg_starts = {}
    cur_sec = lead_sec

    for idx, seg in enumerate(segments):
        pitch_role = "body_steps" if seg.role == "micro" else seg.role
        pitch = get_role_pitch(profile, pitch_role)
        pause = seg.pause_after if seg.pause_after is not None else get_default_pause(profile, seg.role)
        arr, seg_words = await _synth_segment(idx, seg.text, voice_name, rate, pitch, tmp_dir)
        seg_starts[seg.seg_id] = int(round(cur_sec * FPS))
        for w in seg_words:
            words_meta.append(
                {
                    "text": w["text"],
                    "start": round(cur_sec + w["start"], 3),
                    "end": round(cur_sec + w["end"], 3),
                }
            )
        parts.append(arr)
        cur_sec += len(arr) / SR
        if pause > 0:
            parts.append(np.zeros((int(pause * SR), 2), dtype=np.float32))
            cur_sec += pause

    speech_end_frame = int(round(cur_sec * FPS))
    if tail_sec > 0:
        parts.append(np.zeros((int(tail_sec * SR), 2), dtype=np.float32))
        cur_sec += tail_sec

    voice = np.vstack(parts)
    total_samples = len(voice)
    total_sec = total_samples / SR
    total_frames = int(math.ceil(total_sec * FPS))

    # Conversao de palavras para frames exatos
    ts_words = []
    for i, w in enumerate(words_meta):
        f_from = max(0, int(round(w["start"] * FPS)))
        if i + 1 < len(words_meta):
            next_from = max(f_from + 1, int(round(words_meta[i + 1]["start"] * FPS)))
            f_to = min(next_from, max(f_from + 1, int(round(w["end"] * FPS)) + 1))
        else:
            f_to = max(f_from + 2, int(round(w["end"] * FPS)) + 2)
        ts_words.append(
            {
                "text": w["text"],
                "from": f_from,
                "to": f_to,
                "start": w["start"],
                "end": w["end"],
            }
        )

    # Mixar trilha instrumental com ducking automatico (~-19 dB abaixo da voz, como ref_DfVKHAJD3Gx)
    bed = load_or_make_bed(total_samples, tmp_dir)
    voice_env = np.abs(voice[:, 0])
    win = int(0.18 * SR)
    smooth_env = np.convolve(voice_env, np.ones(win, dtype=np.float32) / win, mode="same")
    speaking = np.clip((smooth_env - 0.01) / 0.03, 0.0, 1.0)
    bed_gain = (0.26 - 0.14 * speaking)[:, None]  # -19 dB sob fala, sobe gentilmente nas pausas/CTA
    mix = voice * 0.88 + bed * bed_gain

    if sfx_callback is not None:
        sfx_callback(mix, seg_starts, ts_words)

    peak = float(np.max(np.abs(mix)))
    if peak > 0.80:
        mix = mix * (0.80 / peak)
    pcm = (mix * 32767.0).astype(np.int16)

    raw_wav = tmp_dir / "mix_raw.wav"
    with wave.open(str(raw_wav), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(pcm.tobytes())

    # 2-pass loudnorm (-14 LUFS, TP=-1.6 dBTP) + alimiter (-1.8 dB) -> ZERO clipping
    p1 = subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(raw_wav),
            "-af",
            "loudnorm=I=-14:TP=-1.6:LRA=9:print_format=json",
            "-f",
            "null",
            "-",
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    m = re.search(r"\{[\s\S]*?\}", p1.stderr)
    st = json.loads(m.group(0))
    af2 = (
        f"loudnorm=I=-14:TP=-1.6:LRA=9:linear=true:"
        f"measured_I={st['input_i']}:measured_TP={st['input_tp']}:"
        f"measured_LRA={st['input_lra']}:measured_thresh={st['input_thresh']}:"
        f"offset={st['target_offset']},alimiter=limit=-1.8dB:attack=5:release=60:level=false"
    )
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(raw_wav),
            "-af",
            af2,
            "-ar",
            str(SR),
            "-ac",
            "2",
            "-c:a",
            "pcm_s16le",
            str(out_wav),
        ],
        check=True,
    )

    raw_wav.unlink(missing_ok=True)
    tmp_dir.rmdir()

    return {
        "total_frames": total_frames,
        "total_sec": total_sec,
        "speech_end_frame": speech_end_frame,
        "seg_starts": seg_starts,
        "words": ts_words,
        "profile_id": profile.get("id", profile_id),
    }
