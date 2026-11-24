"""
Gerador Unificado de Audio & Timestamps para a Fabrica de Videos 3D.

Uso:
  python template/scripts/build_factory_audio.py --project <slug>

Le:
  - template/src/factory/projects/<slug>/config.json
Gera:
  - template/public/assets/<slug>/master_audio_sfx.wav
  - template/src/factory/projects/<slug>/timing.json
"""
import argparse
import asyncio
import json
import math
import re
import subprocess
import wave
from pathlib import Path

import edge_tts
import numpy as np

TEMPLATE_DIR = Path(__file__).resolve().parent.parent
PROJECTS_DIR = TEMPLATE_DIR / "src" / "factory" / "projects"
ASSETS_ROOT = TEMPLATE_DIR / "public" / "assets"

FPS = 30
SR = 44100

DEFAULT_PRONUNCIATION = {
    "TI": "Tê í",
    "PIX": "Pícs",
    "API": "Á Pê Í",
    "IA": "Í Á",
    "ERP": "É Érre Pê",
    "TED": "Téde",
    "DOC": "Dóque",
    "NFC": "Éne Éfe Cê",
    "GPS": "Gê Pê Ésse",
    "Wi-Fi": "Uái Fái",
    "QR": "Quê Érre",
    "SPI": "Ésse Pê Í",
    "DICT": "Díct",
    "PDF": "Pê Dê Éfe",
}


def make_whoosh(dur=0.22, vol=0.07) -> np.ndarray:
    n = int(SR * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    rng = np.random.default_rng(42)
    noise = rng.normal(0, 1, n)
    smooth = np.convolve(noise, np.ones(60) / 60, mode="same")
    env = np.sin(np.pi * t / dur) ** 1.8
    sig = (smooth * env * vol).astype(np.float32)
    return np.column_stack([sig, sig])


def make_beep(f1=987.77, f2=1479.98, dur=0.10, vol=0.07) -> np.ndarray:
    n = int(SR * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    env = np.sin(np.pi * t / dur) * np.exp(-t * 16.0)
    sig = ((0.65 * np.sin(2 * np.pi * f1 * t) + 0.35 * np.sin(2 * np.pi * f2 * t)) * env * vol).astype(np.float32)
    return np.column_stack([sig, sig])


def make_chime(dur=0.95, vol=0.09) -> np.ndarray:
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


def make_bed(total_samples: int) -> np.ndarray:
    t = np.arange(total_samples, dtype=np.float32) / SR
    chords = [
        [130.81, 196.00, 246.94, 329.63],
        [110.00, 164.81, 220.00, 261.63],
        [174.61, 220.00, 261.63, 329.63],
        [196.00, 246.94, 293.66, 329.63],
    ]
    bar_sec = 2.0
    sig_l = np.zeros(total_samples, dtype=np.float32)
    sig_r = np.zeros(total_samples, dtype=np.float32)
    for b in range(int(math.ceil((total_samples / SR) / bar_sec))):
        i0 = int(b * bar_sec * SR)
        i1 = min(total_samples, int((b + 1) * bar_sec * SR))
        if i1 <= i0:
            continue
        tb = t[i0:i1] - b * bar_sec
        dur_b = (i1 - i0) / SR
        env = np.minimum(1.0, tb / 0.14) * np.minimum(1.0, np.maximum(0.0, (dur_b - tb) / 0.14))
        notes = chords[b % len(chords)]
        pl = np.zeros(i1 - i0, dtype=np.float32)
        pr = np.zeros(i1 - i0, dtype=np.float32)
        for ni, freq in enumerate(notes):
            det = 0.25 if ni % 2 == 0 else -0.25
            pl += np.sin(2 * np.pi * (freq + det) * tb) * (0.24 / len(notes))
            pr += np.sin(2 * np.pi * (freq - det) * tb) * (0.24 / len(notes))
        sig_l[i0:i1] = pl * env
        sig_r[i0:i1] = pr * env
    fi = min(int(0.4 * SR), total_samples)
    fo = min(int(1.0 * SR), total_samples)
    sig_l[:fi] *= np.linspace(0, 1, fi, dtype=np.float32)
    sig_r[:fi] *= np.linspace(0, 1, fi, dtype=np.float32)
    sig_l[-fo:] *= np.linspace(1, 0, fo, dtype=np.float32)
    sig_r[-fo:] *= np.linspace(1, 0, fo, dtype=np.float32)
    return np.column_stack([sig_l, sig_r])


def add_sfx(buf: np.ndarray, sfx: np.ndarray, frame: int):
    idx = int((frame / FPS) * SR)
    end = min(len(buf), idx + len(sfx))
    if 0 <= idx < len(buf) and end > idx:
        buf[idx:end] += sfx[: end - idx]


def apply_pronunciation(phrase: str, pron_map: dict[str, str]):
    tokens = phrase.split()
    tts_tokens = []
    token_word_counts = []
    for tok in tokens:
        m = re.match(r"^([^a-zA-Z0-9áéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ-]*)([a-zA-Z0-9áéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ-]+)(.*)$", tok)
        if m and m.group(2) in pron_map:
            rep = pron_map[m.group(2)]
            tts_tokens.append(f"{m.group(1)}{rep}{m.group(3)}")
            token_word_counts.append(len(rep.split()))
        else:
            tts_tokens.append(tok)
            token_word_counts.append(1)
    return " ".join(tts_tokens), tokens, token_word_counts


async def synth_phrase(phrase: str, voice: str, rate: str, out_mp3: Path, out_wav: Path):
    communicate = edge_tts.Communicate(phrase, voice=voice, rate=rate, boundary="WordBoundary")
    boundaries = []
    with open(out_mp3, "wb") as f:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                offset_sec = chunk["offset"] / 10_000_000.0
                dur_sec = chunk["duration"] / 10_000_000.0
                boundaries.append((chunk["text"], offset_sec, offset_sec + dur_sec))

    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(out_mp3),
            "-af",
            "volume=0.85,highpass=f=75,acompressor=threshold=-18dB:ratio=2.2:attack=10:release=110",
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
    with wave.open(str(out_wav), "rb") as wf:
        raw_bytes = wf.readframes(wf.getnframes())
    arr = np.frombuffer(raw_bytes, dtype=np.int16).astype(np.float32).reshape(-1, 2) / 32768.0
    return arr, boundaries


async def build_project_audio(slug: str):
    proj_dir = PROJECTS_DIR / slug
    cfg_path = proj_dir / "config.json"
    if not cfg_path.exists():
        raise FileNotFoundError(f"Projeto nao encontrado: {cfg_path}")

    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    voice_cfg = cfg.get("voice", {})
    voice = voice_cfg.get("voice", "pt-BR-AntonioNeural")
    rate = voice_cfg.get("rate", "+4%")
    pron_map = {**DEFAULT_PRONUNCIATION, **voice_cfg.get("pronunciation", {})}

    asset_dir = ASSETS_ROOT / slug
    asset_dir.mkdir(parents=True, exist_ok=True)
    tmp_dir = asset_dir / "_tmp_factory"
    tmp_dir.mkdir(exist_ok=True)

    parts = [np.zeros((int(0.25 * SR), 2), dtype=np.float32)]
    cur_sec = 0.25
    act_starts: dict[str, int] = {}
    words_out: list[dict] = []

    acts = cfg["acts"]
    for idx, act in enumerate(acts):
        act_id = act["id"]
        text = act["narration"].strip()
        pause_after = float(act.get("pauseAfterSec", 1.2))
        print(f"[TTS {idx+1}/{len(acts)}] '{slug}/{act_id}' com {voice} ({rate})...")
        act_starts[act_id] = 0 if idx == 0 else int(round(cur_sec * FPS))

        phrases = [s.strip() for s in re.split(r"(?<=[.,;?!])\s+(?=\S)", text) if s.strip()]
        for pi, ph in enumerate(phrases):
            mp3_p = tmp_dir / f"{act_id}_{pi}.mp3"
            wav_p = tmp_dir / f"{act_id}_{pi}.wav"
            tts_ph, orig_tokens, span_counts = apply_pronunciation(ph, pron_map)
            arr, boundaries = await synth_phrase(tts_ph, voice, rate, mp3_p, wav_p)

            mono = np.max(np.abs(arr), axis=1)
            nz = np.where(mono > 0.008)[0]
            trim_start_sec = 0.0
            if len(nz):
                i_start = max(0, int(nz[0]) - int(0.03 * SR))
                i_end = min(len(arr), int(nz[-1]) + int(0.08 * SR))
                trim_start_sec = i_start / SR
                arr = arr[i_start:i_end]

            ph_dur = len(arr) / SR

            # Mesclar boundaries conforme o numero de palavras da pronuncia
            merged = []
            bi = 0
            for tok, cnt in zip(orig_tokens, span_counts):
                if bi + cnt <= len(boundaries):
                    merged.append((tok, boundaries[bi][1], boundaries[bi + cnt - 1][2]))
                    bi += cnt
                else:
                    merged = []
                    break

            if len(merged) == len(orig_tokens) and bi == len(boundaries):
                for tok, b_start, b_end in merged:
                    w_start = max(0.0, b_start - trim_start_sec)
                    w_end = max(w_start + 0.08, b_end - trim_start_sec)
                    f_from = max(0, int(round((cur_sec + w_start) * FPS)))
                    f_to = max(f_from + 2, int(round((cur_sec + w_end) * FPS)))
                    words_out.append({"text": tok, "from": f_from, "to": f_to})
            else:
                weights = [max(2, len(re.sub(r"[^a-zA-Z0-9áéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]", "", tok))) + 1.5 for tok in orig_tokens]
                total_w = sum(weights)
                t_pos = cur_sec
                for tok, w in zip(orig_tokens, weights):
                    d_tok = ph_dur * (w / total_w)
                    f_from = max(0, int(round(t_pos * FPS)))
                    f_to = max(f_from + 2, int(round((t_pos + d_tok) * FPS)))
                    words_out.append({"text": tok, "from": f_from, "to": f_to})
                    t_pos += d_tok

            parts.append(arr)
            cur_sec += ph_dur

            if pi < len(phrases) - 1:
                gap = 0.58 if ph[-1] in ".?!" else 0.28
                parts.append(np.zeros((int(gap * SR), 2), dtype=np.float32))
                cur_sec += gap

            mp3_p.unlink(missing_ok=True)
            wav_p.unlink(missing_ok=True)

        if pause_after > 0:
            parts.append(np.zeros((int(pause_after * SR), 2), dtype=np.float32))
            cur_sec += pause_after

    # Respiro final de 2.0s
    parts.append(np.zeros((int(2.0 * SR), 2), dtype=np.float32))
    cur_sec += 2.0

    voice_buf = np.vstack(parts)
    total_samples = len(voice_buf)
    total_sec = total_samples / SR
    total_frames = int(math.ceil(total_sec * FPS))

    bed = make_bed(total_samples)
    venv = np.convolve(np.abs(voice_buf[:, 0]), np.ones(int(0.18 * SR), dtype=np.float32) / int(0.18 * SR), mode="same")
    spk = np.clip((venv - 0.01) / 0.03, 0.0, 1.0)
    mix = voice_buf * 0.88 + bed * (0.18 - 0.10 * spk)[:, None]

    for idx, act in enumerate(acts):
        sfx = act.get("sfx", "none")
        f_at = 2 if idx == 0 else act_starts[act["id"]]
        if sfx == "whoosh":
            add_sfx(mix, make_whoosh(), f_at)
        elif sfx == "beep":
            add_sfx(mix, make_beep(880.0 + idx * 80.0, 1318.5 + idx * 90.0), f_at)
        elif sfx == "chime":
            add_sfx(mix, make_chime(), f_at)

    pk = float(np.max(np.abs(mix)))
    if pk > 0.78:
        mix *= 0.78 / pk

    raw_mix = tmp_dir / "mix_raw.wav"
    with wave.open(str(raw_mix), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes((mix * 32767.0).astype(np.int16).tobytes())

    p1 = subprocess.run(
        ["ffmpeg", "-y", "-i", str(raw_mix), "-af", "loudnorm=I=-14:TP=-2.0:LRA=9:print_format=json", "-f", "null", "-"],
        capture_output=True,
        text=True,
        check=True,
    )
    st = json.loads(re.search(r"\{[\s\S]*?\}", p1.stderr).group(0))
    af2 = (
        f"loudnorm=I=-14:TP=-2.0:LRA=9:linear=true:"
        f"measured_I={st['input_i']}:measured_TP={st['input_tp']}:"
        f"measured_LRA={st['input_lra']}:measured_thresh={st['input_thresh']}:"
        f"offset={st['target_offset']},alimiter=limit=0.75:attack=4:release=80:level=false"
    )
    out_wav = asset_dir / "master_audio_sfx.wav"
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", str(raw_mix), "-af", af2, "-ar", str(SR), "-ac", "2", "-c:a", "pcm_s16le", str(out_wav)],
        check=True,
    )
    raw_mix.unlink(missing_ok=True)
    try:
        tmp_dir.rmdir()
    except OSError:
        pass

    timing = {
        "total_frames": total_frames,
        "act_starts": act_starts,
        "words": words_out,
    }
    timing_path = proj_dir / "timing.json"
    timing_path.write_text(json.dumps(timing, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"OK! Audio '{slug}' ({voice}) -> {total_frames} frames ({total_sec:.2f}s), {len(words_out)} palavras")
    print("ACT_STARTS:", json.dumps(act_starts, indent=2))


def main():
    parser = argparse.ArgumentParser(description="Gerador unificado de audio da Fabrica de Videos 3D")
    parser.add_argument("--project", required=True, help="Slug do projeto em template/src/factory/projects/<slug>")
    args = parser.parse_args()
    asyncio.run(build_project_audio(args.project))


if __name__ == "__main__":
    main()
