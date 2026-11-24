import asyncio
import hashlib
import json
import math
import os
import re
import ssl
import time
import uuid
import wave
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import aiohttp
from aiohttp import web
import edge_tts
import numpy as np
import yt_dlp

ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DIR = ROOT / "public"
PROJECTS_DIR = PUBLIC_DIR / "studio_projects"
VOICE_SAMPLES_DIR = PROJECTS_DIR / "_voice_samples"
RENDERS_DIR = ROOT / "renders"
DATA_DIR = ROOT / "data"
RADAR_FILE = DATA_DIR / "youtube_radar.json"
DESIGN_PREFS_FILE = DATA_DIR / "design_preferences.json"
COMETA_HUB_URL = os.environ.get("COMETA_HUB_URL", "http://127.0.0.1:8800").rstrip("/")

PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
VOICE_SAMPLES_DIR.mkdir(parents=True, exist_ok=True)
RENDERS_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

FPS = 30
SAMPLE_RATE = 44100


def load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        key = k.strip()
        val = v.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val


load_env_file(ROOT / ".env")
load_env_file(ROOT.parent / ".env")

VOICE_PROFILES: Dict[str, Dict[str, Any]] = {
    "antonio_dinamico": {
        "edgeVoice": "pt-BR-AntonioNeural",
        "defaultRatePct": 16,
        "pitchHz": 0,
    },
    "francisca_calma": {
        "edgeVoice": "pt-BR-FranciscaNeural",
        "defaultRatePct": 4,
        "pitchHz": 0,
    },
    "antonio_corporativo": {
        "edgeVoice": "pt-BR-AntonioNeural",
        "defaultRatePct": 6,
        "pitchHz": -2,
    },
    "thalita_vibrante": {
        "edgeVoice": "pt-BR-ThalitaMultilingualNeural",
        "defaultRatePct": 10,
        "pitchHz": 0,
    },
    "francisca_didatica": {
        "edgeVoice": "pt-BR-FranciscaNeural",
        "defaultRatePct": -2,
        "pitchHz": 2,
    },
}

VALID_MODELS = {
    "doc_mapa_radar",
    "ilustrado_flat_2d",
    "editorial_kinetic_2d",
    "fluxo_corporativo",
    "sala_experimento",
    "estudio_apresentador",
}
MODELS_2D = {"doc_mapa_radar", "ilustrado_flat_2d", "editorial_kinetic_2d"}
MODEL_LABELS_PT: Dict[str, str] = {
    "doc_mapa_radar": "Geo-Documentário & Radar 2D (@FronteiraDoc)",
    "ilustrado_flat_2d": "Ilustração Flat & História 2D (@HistoriandoCuriosidades)",
    "editorial_kinetic_2d": "Blueprint & Cards Numerados 2D (@curiosicasabr)",
    "sala_experimento": "Bancada & Maquete 3D (@DesmontandoOMundo)",
    "fluxo_corporativo": "Fluxo entre Setores 3D (@DesmontandoOMundo)",
    "estudio_apresentador": "Estúdio Apresentador & Telão 3D (@engenhocaexplicadas)",
}
VALID_PLATFORMS = {"youtube_shorts", "reels", "youtube"}
VALID_VISUAL_KINDS = {
    "box",
    "truss",
    "beam",
    "cylinder",
    "sphere",
    "cone",
    "ring",
    "arch",
    "wave_layer",
    "arrow",
}
VALID_VISUAL_ANIMS = {"none", "bob", "sway", "spin", "pulse", "flow", "shake"}
VALID_CAMERA_ANGLES = {"front", "iso_left", "iso_right", "closeup", "top_tilt"}
VALID_ENVIRONMENTS = {"ground", "underground", "water", "space", "sky", "clean"}

VALID_POSES = {
    "sitting_hot",
    "sitting_cool",
    "sitting_desk",
    "standing_neutral",
    "standing_wave",
    "standing_phone",
    "standing_worried",
}

VALID_CORP_EFFECTS = {
    "none",
    "paper_loss",
    "barcode_scan",
    "photo_flash",
    "price_markdown",
    "erp_sync",
    "status_done",
    "printer_labels",
    "checkout_scan",
    "panorama_all",
}

VALID_ROOM_EFFECTS = {
    "ice_fan_hot",
    "ice_melted_clock",
    "molecules_waves",
    "copper_cycle",
    "metal_shield",
    "speedometer_control",
    "finished_appliance",
}

VALID_PRESENTER_EFFECTS = {
    "presenter_intro",
    "presenter_alert",
    "presenter_steps",
    "presenter_chart",
    "presenter_conclusion",
}

VALID_DOC_RADAR_EFFECTS = {
    "radar_target_zone",
    "corridor_map_zone",
    "trajectory_track",
    "severity_scale",
    "globe_finale",
}

VALID_FLAT_EFFECTS = {
    "flat_horizon_globe",
    "flat_myth_vs_fact",
    "flat_layers_cross_section",
    "flat_puzzle_pieces",
    "flat_window_conclusion",
}

VALID_EDITORIAL_EFFECTS = {
    "blueprint_question",
    "gears_mechanism",
    "area_ring_scale",
    "step_comparison_cards",
    "confetti_reveal",
}

ALL_VALID_EFFECTS = (
    VALID_CORP_EFFECTS
    | VALID_ROOM_EFFECTS
    | VALID_PRESENTER_EFFECTS
    | VALID_DOC_RADAR_EFFECTS
    | VALID_FLAT_EFFECTS
    | VALID_EDITORIAL_EFFECTS
)

VALID_STATION_TYPES = {
    "supermarket_aisle",
    "office_single",
    "office_dual_erp",
    "warehouse_dock",
}

RENDER_JOBS: Dict[str, Dict[str, Any]] = {}
RADAR_LOCK = asyncio.Lock()

CHANNEL_DESIGN_PRESETS: Dict[str, Tuple[str, str]] = {
    "@desmontandoomundo": ("3D Maquete & Engenharia", "sala_experimento"),
    "@engenhocaexplicadas": ("2D/3D Cards Numerados & Mitos", "editorial_kinetic_2d"),
    "@curiosicasabr": ("2D Blueprint Clean & Confete", "editorial_kinetic_2d"),
    "@fronteiradoc": ("2D Geo-Doc Escuro & Radar", "doc_mapa_radar"),
    "@historiandocuriosidades": ("2D Ilustrado Flat & História", "ilustrado_flat_2d"),
    "@historiandototalmente": ("2D Ilustrado Flat & História", "ilustrado_flat_2d"),
}

DEFAULT_SEED_CHANNELS: List[Dict[str, Any]] = [
    {
        "id": "UCoy58MTz5TS66V5VGk0pTew",
        "handle": "@DesmontandoOMundo",
        "title": "Desmontando o Mundo",
        "url": "https://www.youtube.com/@DesmontandoOMundo",
        "shortsCount": 0,
        "topViews": 0,
        "addedAt": "04/11/2026",
        "designStyleLabel": "3D Maquete & Engenharia",
        "defaultModelId": "sala_experimento",
    },
    {
        "id": "UCPiZ3sGBYMw0o_GuIkNWhcw",
        "handle": "@engenhocaexplicadas",
        "title": "Engenhoca Explicada",
        "url": "https://www.youtube.com/@engenhocaexplicadas",
        "shortsCount": 0,
        "topViews": 0,
        "addedAt": "04/11/2026",
        "designStyleLabel": "2D/3D Cards Numerados & Mitos",
        "defaultModelId": "editorial_kinetic_2d",
    },
    {
        "id": "UC_ED5htSniY46TjYyWUKAHA",
        "handle": "@curiosicasabr",
        "title": "CURIOSICASA",
        "url": "https://www.youtube.com/@curiosicasabr",
        "shortsCount": 0,
        "topViews": 0,
        "addedAt": "04/11/2026",
        "designStyleLabel": "2D Blueprint Clean & Confete",
        "defaultModelId": "editorial_kinetic_2d",
    },
    {
        "id": "UCOVrNAZC9I0YeY63EwPE6oQ",
        "handle": "@FronteiraDoc",
        "title": "FRONTEIRA",
        "url": "https://www.youtube.com/@FronteiraDoc",
        "shortsCount": 0,
        "topViews": 0,
        "addedAt": "04/11/2026",
        "designStyleLabel": "2D Geo-Doc Escuro & Radar",
        "defaultModelId": "doc_mapa_radar",
    },
    {
        "id": "UCFAD1EULZQHhvta4fd_msLA",
        "handle": "@HistoriandoCuriosidades",
        "title": "HistoriandoTotalmente",
        "url": "https://www.youtube.com/@HistoriandoCuriosidades",
        "shortsCount": 0,
        "topViews": 0,
        "addedAt": "04/11/2026",
        "designStyleLabel": "2D Ilustrado Flat & História",
        "defaultModelId": "ilustrado_flat_2d",
    },
]

DEFAULT_REFERENCE_SHORTS: List[Dict[str, Any]] = [
    {
        "id": "bnzE8-O2USc",
        "title": "A Terra plana NÃO é possível — e a prova está na sua janela. Sabia disso?",
        "viewCount": 389000,
        "url": "https://www.youtube.com/shorts/bnzE8-O2USc",
        "thumbnail": "https://i.ytimg.com/vi/bnzE8-O2USc/hqdefault.jpg",
        "channelId": "UCFAD1EULZQHhvta4fd_msLA",
        "channelTitle": "HistoriandoTotalmente",
        "channelHandle": "@HistoriandoCuriosidades",
    },
    {
        "id": "910WubkL-vw",
        "title": "Como um telhado funciona? A engenharia por trás das telhas",
        "viewCount": 185000,
        "url": "https://www.youtube.com/shorts/910WubkL-vw",
        "thumbnail": "https://i.ytimg.com/vi/910WubkL-vw/hqdefault.jpg",
        "channelId": "UCoy58MTz5TS66V5VGk0pTew",
        "channelTitle": "Desmontando o Mundo",
        "channelHandle": "@DesmontandoOMundo",
    },
    {
        "id": "z2gzYHlCUxA",
        "title": "O TORNADO MAIS LARGO JÁ REGISTRADO 🌪️ #brasil #curiosidades",
        "viewCount": 107000,
        "url": "https://www.youtube.com/shorts/z2gzYHlCUxA",
        "thumbnail": "https://i.ytimg.com/vi/z2gzYHlCUxA/hqdefault.jpg",
        "channelId": "UCOVrNAZC9I0YeY63EwPE6oQ",
        "channelTitle": "FRONTEIRA",
        "channelHandle": "@FronteiraDoc",
    },
    {
        "id": "ldfcbFVGg-w",
        "title": "5 curiosidades do Brasil que quase ninguém conhece",
        "viewCount": 32000,
        "url": "https://www.youtube.com/shorts/ldfcbFVGg-w",
        "thumbnail": "https://i.ytimg.com/vi/ldfcbFVGg-w/hqdefault.jpg",
        "channelId": "UCPiZ3sGBYMw0o_GuIkNWhcw",
        "channelTitle": "Engenhoca Explicada",
        "channelHandle": "@engenhocaexplicadas",
    },
    {
        "id": "qHwx3FIMvBE",
        "title": "Como uma roda gigante levanta barcos 24 metros?",
        "viewCount": 2430,
        "url": "https://www.youtube.com/shorts/qHwx3FIMvBE",
        "thumbnail": "https://i.ytimg.com/vi/qHwx3FIMvBE/hqdefault.jpg",
        "channelId": "UC_ED5htSniY46TjYyWUKAHA",
        "channelTitle": "CURIOSICASA",
        "channelHandle": "@curiosicasabr",
    },
]


def slugify(value: str) -> str:
    clean = value.lower().strip()
    clean = re.sub(r"[àáâãä]", "a", clean)
    clean = re.sub(r"[èéêë]", "e", clean)
    clean = re.sub(r"[ìíîï]", "i", clean)
    clean = re.sub(r"[òóôõö]", "o", clean)
    clean = re.sub(r"[ùúûü]", "u", clean)
    clean = re.sub(r"[ç]", "c", clean)
    clean = re.sub(r"[^a-z0-9]+", "-", clean).strip("-")
    return clean[:48] or f"video-{int(time.time())}"


# ---------------------------------------------------------------------------
# Efeitos Sonoros Procedurais (SFX Stereo 44.1kHz)
# ---------------------------------------------------------------------------
def make_whoosh(sr: int = SAMPLE_RATE, dur: float = 0.28, vol: float = 0.13) -> np.ndarray:
    n = int(sr * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    rng = np.random.default_rng(101)
    noise = rng.normal(0, 1, n)
    smooth = np.convolve(noise, np.ones(46) / 46, mode="same")
    env = np.sin(np.pi * t / dur) ** 1.6
    sig = smooth * env * vol
    return np.column_stack([sig, sig]).astype(np.float32)


def make_pop(sr: int = SAMPLE_RATE, f0: float = 195.0, f1: float = 540.0, dur: float = 0.09, vol: float = 0.18) -> np.ndarray:
    n = int(sr * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    freq = np.linspace(f0, f1, n)
    phase = 2 * np.pi * np.cumsum(freq) / sr
    env = np.exp(-t * 28.0) * np.sin(np.pi * t / dur)
    sig = np.sin(phase) * env * vol
    return np.column_stack([sig, sig]).astype(np.float32)


def make_scanner_beep(sr: int = SAMPLE_RATE, dur: float = 0.12, vol: float = 0.20) -> np.ndarray:
    n = int(sr * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    env = np.ones(n)
    fade = int(sr * 0.012)
    env[:fade] = np.linspace(0, 1, fade)
    env[-fade:] = np.linspace(1, 0, fade)
    sig = np.sin(2 * np.pi * 2650.0 * t) * env * vol
    return np.column_stack([sig, sig]).astype(np.float32)


def make_shutter(sr: int = SAMPLE_RATE, dur: float = 0.11, vol: float = 0.20) -> np.ndarray:
    n = int(sr * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    rng = np.random.default_rng(77)
    click1 = rng.normal(0, 1, n) * np.exp(-t * 75.0)
    click2 = np.roll(click1, int(sr * 0.038)) * 0.7
    sig = (click1 + click2) * vol
    return np.column_stack([sig, sig]).astype(np.float32)


def make_success_chime(sr: int = SAMPLE_RATE, dur: float = 1.15, vol: float = 0.22) -> np.ndarray:
    n = int(sr * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    env = np.exp(-t * 3.6)
    sig = (
        0.5 * np.sin(2 * np.pi * 587.33 * t)
        + 0.42 * np.sin(2 * np.pi * 739.99 * t)
        + 0.38 * np.sin(2 * np.pi * 880.00 * t)
        + 0.30 * np.sin(2 * np.pi * 1174.66 * t)
    ) * env * vol
    return np.column_stack([sig, sig]).astype(np.float32)


def add_sfx(buf: np.ndarray, sfx: np.ndarray, frame: int, sr: int = SAMPLE_RATE) -> None:
    idx = int((max(0, frame) / FPS) * sr)
    end = min(len(buf), idx + len(sfx))
    if 0 <= idx < len(buf) and end > idx:
        buf[idx:end] += sfx[: end - idx]


def estimate_scene_timings(scenes: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], int]:
    cursor = 1
    words_all: List[Dict[str, Any]] = []
    out_scenes: List[Dict[str, Any]] = []
    for sc in scenes:
        raw_words = [w for w in re.split(r"\s+", (sc.get("narration") or "").strip()) if w]
        word_dur = 10
        start = cursor
        for idx, w in enumerate(raw_words):
            wf = start + 6 + idx * word_dur
            words_all.append({"text": w, "from": wf, "to": wf + word_dur - 2})
        dur_frames = max(90, len(raw_words) * word_dur + 30)
        end = start + dur_frames - 1
        cursor = end + 1
        sc_copy = dict(sc)
        sc_copy["fromFrame"] = start
        sc_copy["toFrame"] = end
        out_scenes.append(sc_copy)
    return out_scenes, words_all, max(150, cursor + 24)


# ---------------------------------------------------------------------------
# Síntese Neural Edge-TTS + Calibragem Natural de Tempo
# ---------------------------------------------------------------------------
async def synth_single_scene(
    idx: int,
    text: str,
    edge_voice: str,
    rate_str: str,
    pitch_str: str,
    work_dir: Path,
) -> Tuple[np.ndarray, List[Dict[str, Any]]]:
    clean_text = text.strip() or "Próxima etapa."
    mp3_path = work_dir / f"_sc_{idx}_{uuid.uuid4().hex[:5]}.mp3"
    wav_path = work_dir / f"_sc_{idx}_{uuid.uuid4().hex[:5]}.wav"

    communicate = edge_tts.Communicate(
        clean_text,
        voice=edge_voice,
        rate=rate_str,
        pitch=pitch_str,
        boundary="WordBoundary",
    )
    words_meta: List[Dict[str, Any]] = []
    with open(mp3_path, "wb") as f:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                offset_sec = chunk["offset"] / 10_000_000.0
                dur_sec = chunk["duration"] / 10_000_000.0
                words_meta.append(
                    {
                        "text": chunk["text"],
                        "start": offset_sec,
                        "end": offset_sec + dur_sec,
                    }
                )

    proc = await asyncio.create_subprocess_exec(
        "ffmpeg",
        "-y",
        "-i",
        str(mp3_path),
        "-ar",
        str(SAMPLE_RATE),
        "-ac",
        "2",
        str(wav_path),
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.DEVNULL,
    )
    await proc.communicate()

    with wave.open(str(wav_path), "rb") as wf:
        raw_bytes = wf.readframes(wf.getnframes())
    samples = np.frombuffer(raw_bytes, dtype=np.int16).astype(np.float32) / 32768.0
    samples = samples.reshape(-1, 2)

    try:
        mp3_path.unlink(missing_ok=True)
        wav_path.unlink(missing_ok=True)
    except OSError:
        pass

    return samples, words_meta


async def _run_tts_pass(
    scenes: List[Dict[str, Any]],
    edge_voice: str,
    rate_pct: int,
    pitch_hz: int,
    proj_dir: Path,
) -> Tuple[np.ndarray, List[Dict[str, Any]], List[Dict[str, Any]], int]:
    rate_str = f"{rate_pct:+d}%"
    pitch_str = f"{pitch_hz:+d}Hz"
    sem = asyncio.Semaphore(5)

    async def _bounded_synth(idx: int, narration: str):
        async with sem:
            return await synth_single_scene(idx, narration, edge_voice, rate_str, pitch_str, proj_dir)

    scene_results = await asyncio.gather(
        *[_bounded_synth(i, sc.get("narration", "")) for i, sc in enumerate(scenes)]
    )

    lead_in_samples = int(SAMPLE_RATE * 0.14)
    inter_gap_samples = int(SAMPLE_RATE * 0.26)
    tail_pad_samples = int(SAMPLE_RATE * 0.80)

    chunks: List[np.ndarray] = [np.zeros((lead_in_samples, 2), dtype=np.float32)]
    cursor_samples = lead_in_samples
    words_out: List[Dict[str, Any]] = []
    updated_scenes: List[Dict[str, Any]] = []

    for i, (sc, (sc_samples, sc_words)) in enumerate(zip(scenes, scene_results)):
        sc_start_sec = cursor_samples / SAMPLE_RATE
        from_frame = max(1, int(round(sc_start_sec * FPS)) + 1 if i > 0 else 1)

        for j, w in enumerate(sc_words):
            abs_start = sc_start_sec + w["start"]
            abs_end = sc_start_sec + w["end"]
            f_from = max(from_frame, int(round(abs_start * FPS)) + 1)
            if j + 1 < len(sc_words):
                next_abs = sc_start_sec + sc_words[j + 1]["start"]
                next_f = max(f_from + 1, int(round(next_abs * FPS)))
                f_to = min(next_f, max(f_from + 1, int(round(abs_end * FPS)) + 1))
            else:
                f_to = max(f_from + 2, int(round(abs_end * FPS)) + 2)
            words_out.append({"text": w["text"], "from": f_from, "to": f_to})

        chunks.append(sc_samples)
        chunks.append(np.zeros((inter_gap_samples, 2), dtype=np.float32))
        cursor_samples += len(sc_samples) + inter_gap_samples

        sc_end_sec = cursor_samples / SAMPLE_RATE
        to_frame = max(from_frame + 40, int(round(sc_end_sec * FPS)))

        sc_copy = dict(sc)
        sc_copy["fromFrame"] = from_frame
        sc_copy["toFrame"] = to_frame
        updated_scenes.append(sc_copy)

    chunks.append(np.zeros((tail_pad_samples, 2), dtype=np.float32))
    full_audio = np.vstack(chunks)
    total_frames = int(math.ceil((len(full_audio) / SAMPLE_RATE) * FPS))
    if updated_scenes:
        updated_scenes[-1]["toFrame"] = total_frames

    return full_audio, updated_scenes, words_out, total_frames


async def synthesize_project_audio(
    project: Dict[str, Any],
    auto_fit_duration: bool = True,
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    proj = json.loads(json.dumps(project))
    proj_slug = slugify(proj.get("id") or proj.get("name") or "projeto-studio")
    proj["id"] = proj_slug

    proj_dir = PROJECTS_DIR / proj_slug
    proj_dir.mkdir(parents=True, exist_ok=True)

    voice_id = proj.get("voiceId") or "antonio_dinamico"
    profile = VOICE_PROFILES.get(voice_id, VOICE_PROFILES["antonio_dinamico"])
    edge_voice = profile["edgeVoice"]
    rate_pct = int(proj.get("voiceRatePct", profile["defaultRatePct"]))
    pitch_hz = int(profile.get("pitchHz", 0))

    scenes: List[Dict[str, Any]] = proj.get("scenes") or []
    if not scenes:
        raise ValueError("O projeto precisa ter ao menos 1 cena para gerar narração.")

    full_audio, updated_scenes, words_out, total_frames = await _run_tts_pass(
        scenes, edge_voice, rate_pct, pitch_hz, proj_dir
    )

    target_sec = float(proj.get("targetSeconds") or 0)
    actual_sec = total_frames / FPS
    calibration_note = ""
    needs_resize: Optional[str] = None

    if auto_fit_duration and target_sec >= 15:
        ratio = actual_sec / target_sec
        if ratio > 1.05 or ratio < 0.86:
            ideal_rate = int(round((100.0 + rate_pct) * ratio - 100.0))
            clamped_rate = max(-8, min(25, ideal_rate))
            if abs(clamped_rate - rate_pct) >= 4:
                rate_pct = clamped_rate
                proj["voiceRatePct"] = rate_pct
                full_audio, updated_scenes, words_out, total_frames = await _run_tts_pass(
                    scenes, edge_voice, rate_pct, pitch_hz, proj_dir
                )
                actual_sec = total_frames / FPS
                calibration_note = f"Velocidade calibrada automaticamente para {rate_pct:+d}% visando {int(target_sec)}s."

        diff_ratio = (actual_sec - target_sec) / target_sec
        if diff_ratio > 0.14:
            needs_resize = "shorter"
        elif diff_ratio < -0.18:
            needs_resize = "longer"

    if proj.get("sfxEnabled", True):
        whoosh = make_whoosh()
        pop = make_pop()
        beep = make_scanner_beep()
        shutter = make_shutter()
        chime = make_success_chime()

        for i, sc in enumerate(updated_scenes):
            f0 = sc["fromFrame"]
            f1 = sc["toFrame"]
            dur = max(30, f1 - f0)
            eff = sc.get("visualEffect", "none")

            if i > 0:
                add_sfx(full_audio, whoosh, max(1, f0 - 3))
            if sc.get("leftBadge"):
                add_sfx(full_audio, pop, f0 + 12)
            if sc.get("rightBadge"):
                add_sfx(full_audio, pop, f0 + 22)

            if eff in ("barcode_scan", "checkout_scan"):
                add_sfx(full_audio, beep, f0 + int(dur * 0.30))
            elif eff == "photo_flash":
                add_sfx(full_audio, shutter, f0 + int(dur * 0.38))

            if sc.get("sendDataToSector") is not None and sc.get("sectorIndex", 0) >= 0:
                add_sfx(full_audio, whoosh, f0 + int(dur * 0.58))

            if i == len(updated_scenes) - 1 or eff in (
                "panorama_all",
                "finished_appliance",
                "presenter_conclusion",
                "globe_finale",
                "flat_window_conclusion",
                "confetti_reveal",
            ):
                add_sfx(full_audio, chime, max(f0 + 18, f1 - 50))

    full_audio = np.clip(full_audio, -0.98, 0.98)

    for old_wav in proj_dir.glob("audio_*.wav"):
        try:
            old_wav.unlink(missing_ok=True)
        except OSError:
            pass

    ts_tag = int(time.time())
    wav_filename = f"audio_{ts_tag}.wav"
    out_wav = proj_dir / wav_filename
    with wave.open(str(out_wav), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes((full_audio * 32767.0).astype(np.int16).tobytes())

    proj["scenes"] = updated_scenes
    proj["words"] = words_out
    proj["totalFrames"] = total_frames
    proj["audioUrl"] = f"/studio_projects/{proj_slug}/{wav_filename}"

    (proj_dir / "project.json").write_text(
        json.dumps(proj, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    meta = {
        "actualSeconds": round(actual_sec, 1),
        "targetSeconds": int(target_sec) if target_sec else round(actual_sec, 1),
        "appliedRatePct": rate_pct,
        "calibrationNote": calibration_note,
        "needsResize": needs_resize,
    }
    return proj, meta


# ---------------------------------------------------------------------------
# Integração OmniRoute (Failover Automático ChatGPT <-> Claude + SSL Corp)
# ---------------------------------------------------------------------------
def get_omniroute_models() -> List[str]:
    candidates = [
        os.environ.get("FAST_MODEL", "").strip(),
        os.environ.get("DOC_FALLBACK_MODEL", "").strip(),
        os.environ.get("THINK_MODEL", "").strip(),
        os.environ.get("FALLBACK_MODEL", "").strip(),
        "cc/claude-sonnet-4-6",
        "gpt-4o-mini",
    ]
    ordered: List[str] = []
    for m in candidates:
        if m and m not in ordered:
            ordered.append(m)
    return ordered


def extract_json_object(raw_text: str) -> Dict[str, Any]:
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_text.strip(), flags=re.DOTALL).strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        cleaned = cleaned[start : end + 1]
    return json.loads(cleaned)


async def call_omniroute_json(system_prompt: str, user_prompt: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    base_url = (os.environ.get("OPENAI_BASE_URL") or "").strip().rstrip("/")
    api_key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if not base_url or not api_key:
        return None, None

    url = base_url if base_url.endswith("/chat/completions") else f"{base_url}/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "User-Agent": "DesmontandoStudio3D/2.5",
    }

    models = get_omniroute_models()
    timeout = aiohttp.ClientTimeout(total=68)
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE
    connector = aiohttp.TCPConnector(ssl=ssl_ctx)

    async with aiohttp.ClientSession(timeout=timeout, connector=connector) as session:
        for model_name in models:
            body: Dict[str, Any] = {
                "model": model_name,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            }
            if "gpt-5" in model_name.lower():
                body["reasoning_effort"] = (os.environ.get("FAST_REASONING_EFFORT") or "low").strip()
            try:
                t0 = time.perf_counter()
                async with session.post(url, headers=headers, json=body) as resp:
                    resp_text = await resp.text()
                    if resp.status != 200:
                        print(f"[OmniRoute Failover] Modelo '{model_name}' retornou HTTP {resp.status}. Tentando próximo...")
                        continue
                    data = json.loads(resp_text)
                    choices = data.get("choices") or []
                    if not choices:
                        continue
                    content = (choices[0].get("message") or {}).get("content") or ""
                    if not content.strip():
                        continue
                    parsed = extract_json_object(content)
                    if isinstance(parsed, dict):
                        elapsed = time.perf_counter() - t0
                        print(f"[OmniRoute OK] Resposta gerada pelo modelo '{model_name}' em {elapsed:.1f}s.")
                        return parsed, model_name
            except Exception as exc:
                print(f"[OmniRoute Failover] Erro em '{model_name}' ({type(exc).__name__}: {exc}). Tentando próximo...")
                continue

    return None, None


# ---------------------------------------------------------------------------
# Motor YouTube Shorts: Canais de Referência + Virais + Temas do Dia
# ---------------------------------------------------------------------------
def _apply_channel_design_preset(ch: Dict[str, Any]) -> Dict[str, Any]:
    handle_low = str(ch.get("handle") or "").lower().strip()
    title_low = str(ch.get("title") or "").lower().strip()
    preset = CHANNEL_DESIGN_PRESETS.get(handle_low) or CHANNEL_DESIGN_PRESETS.get(f"@{title_low}")
    if preset:
        ch["designStyleLabel"] = preset[0]
        ch["defaultModelId"] = preset[1]
    else:
        ch.setdefault("designStyleLabel", "2D/3D Curiosidades & Motion")
        ch.setdefault("defaultModelId", "editorial_kinetic_2d")
    return ch


def load_radar_store() -> Dict[str, Any]:
    if RADAR_FILE.exists():
        try:
            data = json.loads(RADAR_FILE.read_text(encoding="utf-8"))
            if isinstance(data, dict) and isinstance(data.get("channels"), list):
                data.setdefault("viralVideos", [])
                data.setdefault("dailyThemes", [])
                data.setdefault("generatedHistory", [])
                data.setdefault("lastUpdatedAt", "")

                changed = False
                channels_list: List[Dict[str, Any]] = data["channels"]
                for c in channels_list:
                    before_lbl = c.get("designStyleLabel")
                    _apply_channel_design_preset(c)
                    if c.get("designStyleLabel") != before_lbl:
                        changed = True

                # Migração automática v2: adiciona os 3 novos canais base (@curiosicasabr, @FronteiraDoc, @HistoriandoCuriosidades)
                if int(data.get("seedVersion") or 1) < 2:
                    existing_ids = {str(c.get("id") or "") for c in channels_list}
                    existing_handles = {str(c.get("handle") or "").lower() for c in channels_list}
                    for seed_ch in DEFAULT_SEED_CHANNELS:
                        if seed_ch["id"] not in existing_ids and seed_ch["handle"].lower() not in existing_handles:
                            channels_list.append(dict(seed_ch))
                    seen_vids = {str(v.get("id") or "") for v in data["viralVideos"]}
                    for seed_v in DEFAULT_REFERENCE_SHORTS:
                        if seed_v["id"] not in seen_vids:
                            data["viralVideos"].append(dict(seed_v))
                    data["seedVersion"] = 2
                    changed = True

                if changed:
                    save_radar_store(data)
                return data
        except Exception:
            pass

    seed_data = {
        "seedVersion": 2,
        "channels": json.loads(json.dumps(DEFAULT_SEED_CHANNELS)),
        "viralVideos": json.loads(json.dumps(DEFAULT_REFERENCE_SHORTS)),
        "dailyThemes": [],
        "generatedHistory": [],
        "lastUpdatedAt": "",
    }
    save_radar_store(seed_data)
    return seed_data


def save_radar_store(data: Dict[str, Any]) -> None:
    RADAR_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _extract_video_id_from_input(raw: str) -> Optional[str]:
    m = re.search(r"(?:youtube\.com/(?:shorts/|watch\?v=)|youtu\.be/)([A-Za-z0-9_-]{11})", raw)
    return m.group(1) if m else None


def _normalize_channel_base_url(raw: str) -> Tuple[str, str]:
    clean = raw.strip()
    clean = re.sub(r"\?.*$", "", clean).rstrip("/")
    clean = re.sub(r"/(shorts|videos|featured|streams|playlists)$", "", clean, flags=re.IGNORECASE)

    if clean.startswith("@"):
        return f"https://www.youtube.com/{clean}", clean

    m_handle = re.search(r"youtube\.com/(@[A-Za-z0-9_.-]+)", clean)
    if m_handle:
        handle = m_handle.group(1)
        return f"https://www.youtube.com/{handle}", handle

    m_chan = re.search(r"youtube\.com/channel/(UC[A-Za-z0-9_-]+)", clean)
    if m_chan:
        cid = m_chan.group(1)
        return f"https://www.youtube.com/channel/{cid}", cid

    if clean.startswith("UC") and len(clean) >= 20:
        return f"https://www.youtube.com/channel/{clean}", clean

    if not clean.startswith("http"):
        handle = "@" + clean.lstrip("@")
        return f"https://www.youtube.com/{handle}", handle

    return clean, clean.split("/")[-1]


def resolve_channel_from_input_sync(raw_input: str) -> Dict[str, Any]:
    text = (raw_input or "").strip()
    if not text:
        raise ValueError("Informe o link do canal, link de um Short ou @arroba do YouTube.")

    vid_id = _extract_video_id_from_input(text)
    if vid_id:
        opts = {
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
            "nocheckcertificate": True,
        }
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={vid_id}", download=False)
        uploader_id = str(info.get("uploader_id") or "")
        channel_id = str(info.get("channel_id") or uploader_id or vid_id)
        channel_title = str(info.get("channel") or info.get("uploader") or uploader_id or "Canal YouTube")
        uploader_url = str(info.get("uploader_url") or info.get("channel_url") or "")
        if uploader_id.startswith("@"):
            handle = uploader_id
            base_url = f"https://www.youtube.com/{handle}"
        elif uploader_url:
            base_url, handle = _normalize_channel_base_url(uploader_url)
        else:
            base_url = f"https://www.youtube.com/channel/{channel_id}"
            handle = uploader_id or channel_id
        return {
            "id": channel_id,
            "handle": handle if handle.startswith("@") else f"@{handle.lstrip('@')}",
            "title": channel_title,
            "url": base_url,
            "shortsCount": 0,
            "topViews": 0,
            "addedAt": datetime.now().strftime("%d/%m/%Y"),
        }

    base_url, inferred_handle = _normalize_channel_base_url(text)
    return {
        "id": inferred_handle,
        "handle": inferred_handle if inferred_handle.startswith("@") else f"@{inferred_handle}",
        "title": inferred_handle.lstrip("@"),
        "url": base_url,
        "shortsCount": 0,
        "topViews": 0,
        "addedAt": datetime.now().strftime("%d/%m/%Y"),
    }


def scrape_channel_shorts_sync(channel: Dict[str, Any], limit: int = 45) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    ch_copy = dict(channel)
    base_url, _ = _normalize_channel_base_url(ch_copy.get("url") or ch_copy.get("handle") or "")
    opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": True,
        "playlistend": limit,
        "nocheckcertificate": True,
    }

    info: Optional[Dict[str, Any]] = None
    with yt_dlp.YoutubeDL(opts) as ydl:
        try:
            info = ydl.extract_info(f"{base_url}/shorts", download=False)
        except Exception:
            try:
                info = ydl.extract_info(f"{base_url}/videos", download=False)
            except Exception as exc:
                raise RuntimeError(f"Não foi possível ler os vídeos de '{base_url}': {exc}") from exc

    if not info:
        return ch_copy, []

    real_cid = str(info.get("channel_id") or ch_copy.get("id") or "")
    real_title = str(info.get("channel") or info.get("uploader") or ch_copy.get("title") or "").strip()
    real_uploader_id = str(info.get("uploader_id") or ch_copy.get("handle") or "").strip()
    if real_title:
        ch_copy["title"] = real_title
    if real_cid:
        ch_copy["id"] = real_cid
    if real_uploader_id:
        ch_copy["handle"] = real_uploader_id if real_uploader_id.startswith("@") else f"@{real_uploader_id}"
        if real_uploader_id.startswith("@"):
            ch_copy["url"] = f"https://www.youtube.com/{real_uploader_id}"

    entries = info.get("entries") or []
    videos: List[Dict[str, Any]] = []
    seen_ids = set()

    for entry in entries:
        if not isinstance(entry, dict):
            continue
        vid_id = str(entry.get("id") or "").strip()
        title = str(entry.get("title") or "").strip()
        if not vid_id or len(vid_id) != 11 or not title or vid_id in seen_ids:
            continue
        seen_ids.add(vid_id)
        views = int(entry.get("view_count") or 0)
        videos.append(
            {
                "id": vid_id,
                "title": title,
                "viewCount": views,
                "url": f"https://www.youtube.com/shorts/{vid_id}",
                "thumbnail": f"https://i.ytimg.com/vi/{vid_id}/hqdefault.jpg",
                "channelId": ch_copy["id"],
                "channelTitle": ch_copy["title"],
                "channelHandle": ch_copy["handle"],
            }
        )

    # Garante presença dos Shorts sementes caso pertençam ao canal
    for seed in DEFAULT_REFERENCE_SHORTS:
        if seed["channelHandle"].lower() == ch_copy["handle"].lower() and seed["id"] not in seen_ids:
            videos.append(dict(seed))

    videos.sort(key=lambda v: v.get("viewCount") or 0, reverse=True)
    ch_copy["shortsCount"] = len(videos)
    ch_copy["topViews"] = videos[0]["viewCount"] if videos else 0
    _apply_channel_design_preset(ch_copy)

    return ch_copy, videos[:16]


async def refresh_all_radar_channels(store: Dict[str, Any]) -> Dict[str, Any]:
    channels = store.get("channels") or []
    if not channels:
        store["viralVideos"] = []
        store["lastUpdatedAt"] = datetime.now().strftime("%d/%m/%Y %H:%M")
        save_radar_store(store)
        return store

    async def _safe_scrape(ch: Dict[str, Any]) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        try:
            return await asyncio.to_thread(scrape_channel_shorts_sync, ch, 45)
        except Exception as exc:
            print(f"[YouTube Radar] Aviso ao atualizar {ch.get('handle')}: {exc}")
            existing = [
                v for v in (store.get("viralVideos") or [])
                if v.get("channelHandle", "").lower() == ch.get("handle", "").lower()
            ]
            return ch, existing

    results = await asyncio.gather(*[_safe_scrape(ch) for ch in channels])

    updated_channels: List[Dict[str, Any]] = []
    merged_videos: List[Dict[str, Any]] = []
    seen_vids = set()

    for ch_upd, vids in results:
        updated_channels.append(ch_upd)
        for v in vids:
            if v["id"] not in seen_vids:
                seen_vids.add(v["id"])
                merged_videos.append(v)

    merged_videos.sort(key=lambda x: x.get("viewCount") or 0, reverse=True)
    store["channels"] = updated_channels
    store["viralVideos"] = merged_videos
    store["lastUpdatedAt"] = datetime.now().strftime("%d/%m/%Y %H:%M")
    save_radar_store(store)
    return store


def _channels_signature(store: Dict[str, Any]) -> str:
    today_str = datetime.now().strftime("%d/%m/%Y")
    ch_ids = sorted(
        str(c.get("handle") or c.get("id") or "").lower()
        for c in (store.get("channels") or [])
    )
    return f"{today_str}|{'+'.join(ch_ids)}|{len(store.get('viralVideos') or [])}"


def _build_fallback_daily_themes(viral_videos: List[Dict[str, Any]], niche_hint: str) -> Tuple[List[Dict[str, Any]], str]:
    focus = f" focado em {niche_hint.strip()}" if niche_hint.strip() else ""
    ref1 = viral_videos[0] if viral_videos else DEFAULT_REFERENCE_SHORTS[0]
    ref2 = viral_videos[1] if len(viral_videos) > 1 else DEFAULT_REFERENCE_SHORTS[1]
    ref3 = viral_videos[2] if len(viral_videos) > 2 else DEFAULT_REFERENCE_SHORTS[2]
    templates = [
        (
            f"O terremoto esquecido que sacudiu o Brasil e ninguém acreditou{focus}",
            "2D Geo-Doc & Mapa",
            "Combina recorde geográfico real no Brasil com tensão imediata no 1º segundo, padrão campeão do @FronteiraDoc.",
            ref3,
            90,
            "doc_mapa_radar",
            "Abra no primeiro segundo com a data exata e magnitude no mapa tático escuro (@FronteiraDoc), mostre o epicentro no radar vermelho, a escala sísmica comparativa e por que o Brasil também sofre abalos intraplaca.",
        ),
        (
            f"Como sabemos o que tem no centro da Terra se ninguém nunca furou até lá?{focus}",
            "2D Ilustrado Flat",
            "Refuta uma dúvida universal usando provas visuais em camadas, mesma estrutura de alta retenção do @HistoriandoCuriosidades.",
            ref1,
            90,
            "ilustrado_flat_2d",
            "Use estética flat ilustrada (@HistoriandoCuriosidades) com bolinhas de etapas: mostre o recorde do poço mais profundo já cavado, como ondas sísmicas funcionam como raio-X das camadas terrestres e junte as peças no final.",
        ),
        (
            f"Como uma comporta gigante segura milhões de litros sem estourar?{focus}",
            "3D Maquete Engenharia",
            "Desmonta uma estrutura colossal passo a passo respondendo 'como não quebra?', fórmula mais vista do @DesmontandoOMundo.",
            ref2,
            90,
            "sala_experimento",
            "Explique de forma visual na maquete 3D como comportas e barragens desviam milhões de toneladas de pressão para as margens rochosas sem romper.",
        ),
    ]
    out: List[Dict[str, Any]] = []
    for i, (hook, style, why_txt, ref, sec, mod, prompt) in enumerate(templates):
        out.append(
            {
                "id": f"tema-{int(time.time())}-{i+1}",
                "hookTitle": hook[:78],
                "formatStyle": style,
                "whyItWorks": why_txt,
                "inspiredByTitle": ref.get("title", ""),
                "inspiredByChannel": ref.get("channelHandle", "@HistoriandoCuriosidades"),
                "inspiredByViews": int(ref.get("viewCount") or 0),
                "recommendedSeconds": sec,
                "suggestedModelId": mod,
                "readyPrompt": prompt,
            }
        )
    fallback_analysis = (
        "Padrão detectado nos canais: perguntas que desafiam o senso comum no 1º segundo, "
        "provas visuais em camadas/mapas e revelação mecânica rápida entre 60s e 90s."
    )
    return out, fallback_analysis


async def generate_daily_themes_via_ai(
    store: Dict[str, Any],
    niche_hint: str = "",
    inspire_video_id: str = "",
) -> Tuple[List[Dict[str, Any]], str]:
    viral_videos: List[Dict[str, Any]] = store.get("viralVideos") or []
    channels: List[Dict[str, Any]] = store.get("channels") or []
    history: List[str] = (store.get("generatedHistory") or [])[-36:]

    # Monta dossiê estruturado por canal para a IA do OmniRoute cruzar métricas e estilos
    balanced_refs: List[Dict[str, Any]] = []
    channel_dossiers: List[str] = []
    for ch in channels:
        ch_handle = (ch.get("handle") or "").strip()
        ch_low = ch_handle.lower()
        ch_style = ch.get("designStyleLabel") or "2D/3D Motion"
        ch_model = ch.get("defaultModelId") or "editorial_kinetic_2d"
        ch_vids = [v for v in viral_videos if (v.get("channelHandle") or "").lower() == ch_low]
        ch_vids.sort(key=lambda x: x.get("viewCount") or 0, reverse=True)
        top_slice = ch_vids[:5]
        balanced_refs.extend(top_slice)
        vids_summary = "; ".join(
            f"\"{v.get('title')}\" ({v.get('viewCount', 0):,} views)"
            for v in top_slice
        ) or "Sem vídeos lidos ainda"
        channel_dossiers.append(
            f"* Canal {ch_handle} ({ch.get('title')}) | Design padrão: {ch_style} [{ch_model}] | Top Shorts: {vids_summary}"
        )

    if not balanced_refs:
        balanced_refs = list(DEFAULT_REFERENCE_SHORTS)

    pinned_video = None
    if inspire_video_id:
        for v in viral_videos:
            if v.get("id") == inspire_video_id:
                pinned_video = v
                break

    today_str = datetime.now().strftime("%d/%m/%Y")
    sys_prompt = (
        "Você é o Estrategista-Chefe de YouTube Shorts conectado via OmniRoute.\n"
        "Sua missão é ANALISAR profundamente os canais de referência cadastrados pelo usuário (seus vídeos mais virais, contagens de views e estilos visuais 2D/3D) e entregar:\n"
        "1) Um diagnóstico direto ('channelAnalysis') resumindo em 2 frases curtas qual padrão de gancho e narrativa está gerando mais visualizações nesses canais.\n"
        "2) EXATAMENTE 3 SUGESTÕES CAMPEÃS DO DIA ('themes' com 3 itens) inéditas e prontas para gravar.\n"
        "Retorne APENAS um objeto JSON válido (sem blocos markdown) no formato exato:\n"
        "{\n"
        '  "channelAnalysis": "Resumo objetivo e inteligente (máx 260 caracteres) do padrão viral cruzado que você identificou nos canais analisados.",\n'
        '  "themes": [\n'
        "    {\n"
        '      "hookTitle": "Título magnético estilo YouTube Shorts (máx 72 caracteres)",\n'
        '      "formatStyle": "2D Geo-Doc & Mapa" | "2D Ilustrado Flat" | "2D Blueprint Clean" | "3D Maquete Engenharia",\n'
        '      "whyItWorks": "1 frase curta explicando por que esta sugestão vai performar bem com base nos virais analisados",\n'
        '      "inspiredByTitle": "Título exato de um dos vídeos virais de referência que inspirou a estrutura",\n'
        '      "inspiredByChannel": "@ArrobaDoCanalDeReferencia",\n'
        '      "inspiredByViews": 123000,\n'
        '      "recommendedSeconds": 60 | 90 | 150,\n'
        '      "suggestedModelId": "doc_mapa_radar" | "ilustrado_flat_2d" | "editorial_kinetic_2d" | "sala_experimento" | "estudio_apresentador" | "fluxo_corporativo",\n'
        '      "readyPrompt": "Prompt rico de 2 a 3 frases pronto para gerar o vídeo: descreva o gancho chocante do 1º segundo, os dados/provas/camadas visuais concretas e o fechamento."\n'
        "    }\n"
        "  ]\n"
        "}\n"
        "Regras obrigatórias para as EXATAS 3 sugestões:\n"
        "1. Retorne EXATAMENTE 3 itens em 'themes' — escolha apenas as 3 ideias mais fortes e variadas entre os canais analisados.\n"
        "2. Diversifique os designs visuais nas 3 sugestões (ex: 1 em 'doc_mapa_radar' [@FronteiraDoc], 1 em 'ilustrado_flat_2d' [@HistoriandoCuriosidades] ou 'editorial_kinetic_2d' [@curiosicasabr/@engenhocaexplicadas], e 1 em 'sala_experimento' 3D [@DesmontandoOMundo] ou outro 2D campeão).\n"
        "3. NÃO copie o mesmo assunto já gravado; extraia a FÓRMULA VIRAL dos campeões de audiência e aplique a temas inéditos. Nunca repita títulos do histórico."
    )

    user_parts = [
        f"Data de hoje: {today_str}",
        f"Total de canais ativos analisados: {len(channels)}",
        "Dossiê completo dos canais e seus vídeos mais virais:",
        "\n".join(channel_dossiers),
    ]
    if pinned_video:
        user_parts.append(
            f"\nATENÇÃO ESPECIAL: O usuário pediu 3 sugestões diretamente inspiradas na fórmula deste viral campeão: "
            f"\"{pinned_video.get('title')}\" ({pinned_video.get('channelHandle')}, {pinned_video.get('viewCount', 0):,} views)."
        )
    if niche_hint.strip():
        user_parts.append(f"\nFoco / Nicho desejado hoje pelo usuário: {niche_hint.strip()}")
    if history:
        user_parts.append(f"\nTítulos já sugeridos antes (PROIBIDO REPETIR): {json.dumps(history, ensure_ascii=False)}")

    raw_json, model_used = await call_omniroute_json(sys_prompt, "\n".join(user_parts))
    if raw_json and isinstance(raw_json.get("themes"), list) and len(raw_json["themes"]) > 0:
        clean_themes: List[Dict[str, Any]] = []
        for idx, t in enumerate(raw_json["themes"][:3]):
            rec_sec = int(t.get("recommendedSeconds") or 90)
            if rec_sec not in (60, 90, 150):
                rec_sec = 90 if rec_sec < 120 else 150
            sug_mod = t.get("suggestedModelId")
            if sug_mod not in VALID_MODELS:
                sug_mod = "sala_experimento" if "funciona" in str(t.get("hookTitle", "")).lower() else "ilustrado_flat_2d"

            hook = str(t.get("hookTitle") or f"Sugestão Viral #{idx + 1}").strip()
            clean_themes.append(
                {
                    "id": f"tema-{int(time.time())}-{idx + 1}",
                    "hookTitle": hook[:80],
                    "formatStyle": str(t.get("formatStyle") or "Formato Viral Shorts")[:34],
                    "whyItWorks": str(t.get("whyItWorks") or "Estrutura validada nos vídeos de maior retenção dos canais monitorados.").strip()[:180],
                    "inspiredByTitle": str(t.get("inspiredByTitle") or balanced_refs[0]["title"])[:90],
                    "inspiredByChannel": str(t.get("inspiredByChannel") or balanced_refs[0]["channelHandle"])[:36],
                    "inspiredByViews": int(t.get("inspiredByViews") or balanced_refs[0].get("viewCount") or 0),
                    "recommendedSeconds": rec_sec,
                    "suggestedModelId": sug_mod,
                    "readyPrompt": str(t.get("readyPrompt") or hook).strip(),
                }
            )

        analysis_txt = str(
            raw_json.get("channelAnalysis")
            or "A IA do OmniRoute cruzou os vídeos mais vistos dos seus canais e selecionou 3 pautas inéditas de alta retenção."
        ).strip()

        store["dailyThemes"] = clean_themes
        store["channelAnalysis"] = analysis_txt
        store["aiModelUsed"] = model_used or "omniroute"
        store["analyzedAt"] = datetime.now().strftime("%d/%m/%Y %H:%M")
        store["analyzedSignature"] = _channels_signature(store)
        new_hist = list(store.get("generatedHistory") or []) + [ct["hookTitle"] for ct in clean_themes]
        store["generatedHistory"] = new_hist[-60:]
        save_radar_store(store)
        return clean_themes, (model_used or "omniroute")

    fallback, fallback_analysis = _build_fallback_daily_themes(balanced_refs, niche_hint)
    store["dailyThemes"] = fallback
    store["channelAnalysis"] = fallback_analysis
    store["aiModelUsed"] = "motor-local"
    store["analyzedAt"] = datetime.now().strftime("%d/%m/%Y %H:%M")
    store["analyzedSignature"] = _channels_signature(store)
    save_radar_store(store)
    return fallback, "motor-local"


# ---------------------------------------------------------------------------
# Geração e Redimensionamento de Roteiro 3D (Shorts / Reels / YouTube)
# ---------------------------------------------------------------------------
def infer_suggested_model(prompt_low: str) -> str:
    if any(
        re.search(rf"\b{re.escape(w)}", prompt_low)
        for w in [
            "setor",
            "loja",
            "compras",
            "cadastro",
            "estoque",
            "sistema",
            "erp",
            "rpinfo",
            "fluxo",
            "aprovação",
            "aprovacao",
            "financeiro",
            "equipe",
            "departamento",
            "nota fiscal",
            "pedido",
        ]
    ):
        return "fluxo_corporativo"

    if any(
        re.search(rf"\b{re.escape(w)}", prompt_low)
        for w in [
            "tornado",
            "terremoto",
            "furacão",
            "furacao",
            "vulcão",
            "vulcao",
            "tsunami",
            "mapa",
            "fronteira",
            "território",
            "territorio",
            "recorde",
            "ilha",
            "oceano",
            "desastre",
            "raio",
            "tempestade",
            "radar",
            "montanha",
            "geografia",
        ]
    ):
        return "doc_mapa_radar"

    if any(
        re.search(rf"\b{re.escape(w)}", prompt_low)
        for w in [
            "história",
            "historia",
            "pompeia",
            "titanic",
            "roma",
            "egito",
            "antig",
            "século",
            "seculo",
            "planeta",
            "terra",
            "lua",
            "sol",
            "espaço",
            "espaco",
            "estrela",
            "camada",
            "arqueolog",
            "império",
            "imperio",
        ]
    ):
        return "ilustrado_flat_2d"

    if any(
        re.search(rf"\b{re.escape(w)}", prompt_low)
        for w in [
            "curiosidade",
            "curiosidades",
            "mito",
            "mitos",
            "engrenagem",
            "roda gigante",
            "grampeador",
            "extintor",
            "drone",
            "foguete",
            "barco",
            "comporta",
        ]
    ):
        return "editorial_kinetic_2d"

    if any(
        re.search(rf"\b{re.escape(w)}", prompt_low)
        for w in [
            "motor",
            "geladeira",
            "ar-condicionado",
            "micro-ondas",
            "telhado",
            "ponte",
            "piscina",
            "avião",
            "aviao",
            "betoneira",
            "calor",
            "frio",
            "energia",
            "física",
            "fisica",
            "máquina",
            "maquina",
            "engenharia",
            "funciona",
            "constrói",
            "constroi",
        ]
    ):
        return "sala_experimento"

    return "editorial_kinetic_2d"


# ---------------------------------------------------------------------------
# Memória de Preferências Visuais + Integração Cometa Knowledge Hub (8800)
# ---------------------------------------------------------------------------
def load_design_preferences() -> List[Dict[str, Any]]:
    if DESIGN_PREFS_FILE.exists():
        try:
            data = json.loads(DESIGN_PREFS_FILE.read_text(encoding="utf-8"))
            if isinstance(data, list):
                return data
            if isinstance(data, dict) and isinstance(data.get("entries"), list):
                return data["entries"]
        except Exception:
            pass
    return []


def save_design_preferences(entries: List[Dict[str, Any]]) -> None:
    DESIGN_PREFS_FILE.write_text(
        json.dumps({"entries": entries[-200:]}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


async def build_learned_preferences_context(prompt_idea: str) -> str:
    entries = load_design_preferences()
    lines: List[str] = []

    if entries:
        wins: Dict[str, int] = {}
        for e in entries:
            m = str(e.get("chosenModelId") or "")
            if m in VALID_MODELS:
                wins[m] = wins.get(m, 0) + 1
        ranking_str = ", ".join(
            f"{k} ({v}x escolhido)" for k, v in sorted(wins.items(), key=lambda kv: kv[1], reverse=True)
        )
        if ranking_str:
            lines.append(f"- Placar acumulado de escolhas reais do usuário: {ranking_str}")
        lines.append("- Últimas decisões aprovadas pelo usuário ao comparar os 3 modelos:")
        for e in reversed(entries[-10:]):
            chosen = e.get("chosenModelId")
            rejected = ", ".join(e.get("rejectedModelIds") or [])
            idea_short = str(e.get("promptIdea") or e.get("projectName") or "")[:95]
            plat = e.get("platform") or "youtube_shorts"
            note = f" | Nota: {e.get('userNote')}" if e.get("userNote") else ""
            lines.append(
                f"  * Para [{plat}] \"{idea_short}\" -> ESCOLHEU '{chosen}' (descartou: {rejected}){note}"
            )

    # Consulta semântica adicional no Cometa Knowledge Hub (PGVector 127.0.0.1:8800)
    try:
        timeout = aiohttp.ClientTimeout(total=2.5)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(
                f"{COMETA_HUB_URL}/api/search",
                json={
                    "query": f"preferencia design modelo visual escolhido {prompt_idea[:100]}",
                    "project_id": "anything2explainer",
                    "top_k": 3,
                },
            ) as resp:
                if resp.status == 200:
                    hub_data = await resp.json()
                    results = hub_data.get("results") if isinstance(hub_data, dict) else None
                    if isinstance(results, list):
                        for r in results[:2]:
                            txt = str(r.get("content") or r.get("snippet") or "").strip()
                            if "preferencia-design" in txt.lower() or "escolheu" in txt.lower():
                                lines.append(f"  * [Memória Semântica Knowledge Hub]: {txt[:200]}")
    except Exception:
        pass

    if not lines:
        return ""
    return (
        "\nBASE DE CONHECIMENTO DE PREFERÊNCIAS DO USUÁRIO (USE ISSO PARA CALIBRAR OS 3 MODELOS):\n"
        + "\n".join(lines)
        + "\n"
    )


async def record_choice_in_knowledge_base(
    project: Dict[str, Any],
    chosen_model_id: str,
    candidate_models: List[Dict[str, Any]],
    user_note: str = "",
) -> Tuple[Dict[str, Any], bool]:
    entries = load_design_preferences()
    all_cand_ids = [
        str(c.get("modelId") or "")
        for c in candidate_models
        if str(c.get("modelId") or "") in VALID_MODELS
    ]
    rejected_ids = [m for m in all_cand_ids if m != chosen_model_id]
    chosen_label = MODEL_LABELS_PT.get(chosen_model_id, chosen_model_id)
    proj_name = str(project.get("name") or "Vídeo Explicativo").strip()
    prompt_idea = str(project.get("promptIdea") or proj_name).strip()
    platform = str(project.get("platform") or "youtube_shorts")
    aspect_ratio = str(project.get("aspectRatio") or "9:16")

    omni_reason = ""
    for c in candidate_models:
        if c.get("modelId") == chosen_model_id:
            omni_reason = str(c.get("reason") or "").strip()
            break

    hub_saved = False
    try:
        timeout = aiohttp.ClientTimeout(total=6.0)
        learn_payload = {
            "project_id": "anything2explainer",
            "title": f"Preferência Visual Aprovada: {chosen_model_id} para '{proj_name[:52]}'",
            "problem": (
                f"Escolha entre 3 modelos gerados pela IA OmniRoute para o vídeo [{platform} {aspect_ratio}] "
                f"sobre: \"{prompt_idea[:240]}\". Candidatos avaliados: {', '.join(all_cand_ids or [chosen_model_id])}."
            ),
            "solution": (
                f"O usuário analisou os 3 modelos lado a lado e ESCOLHEU '{chosen_model_id}' ({chosen_label}) "
                f"como melhor opção visual, descartando [{', '.join(rejected_ids)}]. "
                f"Motivo IA: {omni_reason or 'Melhor aderência narrativa'}. "
                f"{('Observação do usuário: ' + user_note) if user_note else ''}"
            ).strip(),
            "tags": ["preferencia-design", "omniroute", chosen_model_id, platform],
        }
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(f"{COMETA_HUB_URL}/api/learn", json=learn_payload) as resp:
                if resp.status in (200, 201):
                    hub_saved = True
    except Exception as exc:
        print(f"[Knowledge Hub] Aviso ao gravar em {COMETA_HUB_URL}/api/learn: {exc}")

    entry = {
        "id": f"pref-{int(time.time())}",
        "createdAt": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "projectId": project.get("id") or "",
        "projectName": proj_name,
        "promptIdea": prompt_idea,
        "platform": platform,
        "aspectRatio": aspect_ratio,
        "chosenModelId": chosen_model_id,
        "chosenModelLabel": chosen_label,
        "rejectedModelIds": rejected_ids,
        "omnirouteReason": omni_reason,
        "userNote": user_note,
        "hubSaved": hub_saved,
    }

    # Atualiza caso o usuário tenha mudado o vencedor do MESMO projeto, evitando duplicatas sujas
    proj_id_str = str(project.get("id") or "")
    if proj_id_str:
        entries = [e for e in entries if str(e.get("projectId") or "") != proj_id_str]
    entries.append(entry)
    save_design_preferences(entries)
    return entry, hub_saved


def infer_top_3_models(prompt_low: str, primary: Optional[str] = None) -> List[Dict[str, Any]]:
    first = primary if primary in VALID_MODELS else infer_suggested_model(prompt_low)
    default_reasons = {
        "doc_mapa_radar": "Destaca dados de impacto, mapas e escala com estética documental escura (@FronteiraDoc).",
        "ilustrado_flat_2d": "Organiza provas e história em etapas visuais ilustradas de fácil absorção (@HistoriandoCuriosidades).",
        "editorial_kinetic_2d": "Apresenta o mecanismo em cards numerados limpos com contraste imediato (@curiosicasabr).",
        "sala_experimento": "Desmonta o funcionamento físico em maquete 3D palpável na bancada (@DesmontandoOMundo).",
        "fluxo_corporativo": "Conecta etapas entre diferentes ambientes e sistemas na maquete 3D.",
        "estudio_apresentador": "Combina apresentador 3D expressivo com telão dinâmico de tópicos e gráficos.",
    }
    complement_map: Dict[str, List[str]] = {
        "doc_mapa_radar": ["ilustrado_flat_2d", "editorial_kinetic_2d", "sala_experimento"],
        "ilustrado_flat_2d": ["editorial_kinetic_2d", "doc_mapa_radar", "estudio_apresentador"],
        "editorial_kinetic_2d": ["sala_experimento", "ilustrado_flat_2d", "doc_mapa_radar"],
        "sala_experimento": ["editorial_kinetic_2d", "ilustrado_flat_2d", "doc_mapa_radar"],
        "fluxo_corporativo": ["editorial_kinetic_2d", "estudio_apresentador", "sala_experimento"],
        "estudio_apresentador": ["ilustrado_flat_2d", "editorial_kinetic_2d", "sala_experimento"],
    }
    ordered = [first]
    for nxt in complement_map.get(first, ["editorial_kinetic_2d", "ilustrado_flat_2d", "sala_experimento"]):
        if nxt not in ordered and len(ordered) < 3:
            ordered.append(nxt)
    return [
        {
            "modelId": mid,
            "rank": idx + 1,
            "reason": default_reasons.get(mid, "Selecionado pela IA para comparação visual."),
        }
        for idx, mid in enumerate(ordered[:3])
    ]


def sanitize_candidate_models(
    raw_candidates: Any,
    prompt_idea: str,
    primary_suggested: str,
) -> List[Dict[str, Any]]:
    fallback_three = infer_top_3_models(prompt_idea.lower(), primary_suggested)
    out: List[Dict[str, Any]] = []
    seen: set = set()

    if isinstance(raw_candidates, list):
        for item in raw_candidates:
            if not isinstance(item, dict):
                continue
            mid = str(item.get("modelId") or "").strip()
            if mid not in VALID_MODELS or mid in seen:
                continue
            seen.add(mid)
            reason = str(item.get("reason") or "").strip()
            out.append(
                {
                    "modelId": mid,
                    "rank": len(out) + 1,
                    "reason": reason[:190] or f"Opção #{len(out) + 1} recomendada pelo OmniRoute ({MODEL_LABELS_PT.get(mid, mid)}).",
                }
            )
            if len(out) == 3:
                break

    for fb in fallback_three:
        if len(out) >= 3:
            break
        if fb["modelId"] not in seen:
            seen.add(fb["modelId"])
            out.append(
                {
                    "modelId": fb["modelId"],
                    "rank": len(out) + 1,
                    "reason": fb["reason"],
                }
            )

    return out[:3]


def compute_duration_targets(target_seconds: int, platform: str) -> Tuple[int, int]:
    sec = max(15, min(600, int(target_seconds or 60)))
    rate_wps = 2.60 if platform == "youtube_shorts" else 2.50
    target_words = max(38, int(round(sec * rate_wps)))
    if sec <= 35:
        target_scenes = 4
    elif sec <= 65:
        target_scenes = 6
    elif sec <= 100:
        target_scenes = 7
    elif sec <= 165:
        target_scenes = 10
    elif sec <= 210:
        target_scenes = 11
    else:
        target_scenes = min(15, max(12, int(round(sec / 20))))
    return target_words, target_scenes


def sanitize_yt_shorts_meta(raw_meta: Any, proj_name: str, prompt_idea: str) -> Dict[str, Any]:
    if isinstance(raw_meta, dict):
        title = str(raw_meta.get("title") or proj_name).strip()[:95]
        desc = str(raw_meta.get("description") or prompt_idea).strip()[:400]
        raw_tags = raw_meta.get("hashtags")
        tags: List[str] = []
        if isinstance(raw_tags, list):
            for tg in raw_tags[:8]:
                s = str(tg).strip()
                if s:
                    tags.append(s if s.startswith("#") else f"#{s}")
        if "#shorts" not in [t.lower() for t in tags]:
            tags.insert(0, "#shorts")
        return {"title": title, "description": desc, "hashtags": tags}

    return {
        "title": proj_name[:90],
        "description": f"{prompt_idea[:220].strip()} Assista até o final para entender cada detalhe!",
        "hashtags": ["#shorts", "#curiosidades", "#engenharia", "#comofunciona", "#animacao3d"],
    }


def sanitize_llm_project(
    raw_proj: Dict[str, Any],
    payload: Dict[str, Any],
    model_used: Optional[str],
) -> Dict[str, Any]:
    prompt_idea = str(payload.get("promptIdea") or payload.get("prompt") or "")
    suggested = raw_proj.get("suggestedModelId")
    if suggested not in VALID_MODELS:
        suggested = infer_suggested_model(prompt_idea.lower())

    chosen_model = payload.get("modelId")
    if chosen_model not in VALID_MODELS:
        chosen_model = suggested

    raw_platform = payload.get("platform")
    aspect_ratio = payload.get("aspectRatio") if payload.get("aspectRatio") in ("16:9", "9:16") else "9:16"
    if raw_platform in VALID_PLATFORMS:
        platform = raw_platform
    else:
        platform = "youtube_shorts" if aspect_ratio == "9:16" else "youtube"

    if platform in ("youtube_shorts", "reels"):
        aspect_ratio = "9:16"

    target_seconds = int(payload.get("targetSeconds") or 60)

    voice_id = payload.get("voiceId") or "antonio_dinamico"
    voice_rate = int(
        payload.get(
            "voiceRatePct",
            VOICE_PROFILES.get(voice_id, VOICE_PROFILES["antonio_dinamico"])["defaultRatePct"],
        )
    )

    sectors_in = raw_proj.get("sectors") or []
    sectors: List[Dict[str, Any]] = []
    default_colors = ["#F0CA4D", "#2563EB", "#10B981", "#F97316"]
    default_walls = ["#2563EB", "#0284C7", "#047857", "#C2410C"]
    for i, s in enumerate(sectors_in[:4]):
        st_type = s.get("stationType") if s.get("stationType") in VALID_STATION_TYPES else "office_single"
        sectors.append(
            {
                "id": f"sec-{i + 1}",
                "title": str(s.get("title") or f"{i + 1}. AMBIENTE {i + 1}")[:30].upper(),
                "stationType": st_type,
                "shirtColor": str(s.get("shirtColor") or default_colors[i % 4]),
                "shortsColor": str(s.get("shortsColor") or "#1E293B"),
                "wallAccentColor": str(s.get("wallAccentColor") or default_walls[i % 4]),
                "monitorHeader": str(s.get("monitorHeader") or f"ETAPA {i + 1}")[:26].upper(),
            }
        )

    if not sectors:
        sectors = [
            {
                "id": "sec-1",
                "title": "1. ESTÚDIO PRINCIPAL",
                "stationType": "office_single",
                "shirtColor": "#F0CA4D",
                "shortsColor": "#334155",
                "wallAccentColor": "#2563EB",
                "monitorHeader": "DESTAQUE",
            },
            {
                "id": "sec-2",
                "title": "2. ETAPA SEGUINTE",
                "stationType": "office_dual_erp",
                "shirtColor": "#10B981",
                "shortsColor": "#1E293B",
                "wallAccentColor": "#047857",
                "monitorHeader": "RESULTADO",
            },
        ]

    def _clamp_num(val: Any, lo: float, hi: float, default: float) -> float:
        try:
            return round(max(lo, min(hi, float(val))), 1)
        except Exception:
            return default

    def _clean_hex(val: Any, default: str = "#38BDF8") -> str:
        s = str(val or "").strip()
        return s if re.match(r"^#[0-9A-Fa-f]{6}$", s) else default

    def _parse_single_visual_part(rp: Any) -> Optional[Dict[str, Any]]:
        if isinstance(rp, (list, tuple)) and len(rp) >= 5:
            kind = str(rp[0] or "").strip().lower()
            if kind not in VALID_VISUAL_KINDS:
                return None
            if kind in ("truss", "beam", "arrow"):
                x1 = _clamp_num(rp[1], -98, 98, -35)
                y1 = _clamp_num(rp[2], -88, 88, -10)
                x2 = _clamp_num(rp[3], -98, 98, 35)
                y2 = _clamp_num(rp[4], -88, 88, 10)
                if kind == "arrow" or (len(rp) > 5 and isinstance(rp[5], str) and str(rp[5]).startswith("#")):
                    thick = 13.0 if kind == "truss" else 4.0
                    col = _clean_hex(rp[5] if len(rp) > 5 else "#38BDF8")
                    lbl = str(rp[6] if len(rp) > 6 else "").strip()[:18].upper()
                    anim_raw = str(rp[7] if len(rp) > 7 else ("flow" if kind == "arrow" else "none")).strip().lower()
                else:
                    thick = _clamp_num(rp[5], 2, 26, 12 if kind == "truss" else 4)
                    col = _clean_hex(rp[6] if len(rp) > 6 else "#38BDF8")
                    lbl = str(rp[7] if len(rp) > 7 else "").strip()[:18].upper()
                    anim_raw = str(rp[8] if len(rp) > 8 else "none").strip().lower()
                p_out: Dict[str, Any] = {
                    "kind": kind,
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2,
                    "color": col,
                    "anim": anim_raw if anim_raw in VALID_VISUAL_ANIMS else "none",
                }
                if kind in ("truss", "beam"):
                    p_out["thickness"] = thick
                if lbl:
                    p_out["label"] = lbl
                return p_out

            if kind in ("sphere", "ring"):
                x = _clamp_num(rp[1], -95, 95, 0)
                y = _clamp_num(rp[2], -88, 88, 0)
                r = _clamp_num(rp[3], 5, 78, 18)
                if kind == "ring" and len(rp) > 5 and not str(rp[4]).startswith("#"):
                    thick = _clamp_num(rp[4], 2, 16, 4)
                    col = _clean_hex(rp[5])
                    lbl = str(rp[6] if len(rp) > 6 else "").strip()[:18].upper()
                    anim_raw = str(rp[7] if len(rp) > 7 else "none").strip().lower()
                else:
                    thick = 4.0
                    col = _clean_hex(rp[4] if len(rp) > 4 else "#38BDF8")
                    lbl = str(rp[5] if len(rp) > 5 else "").strip()[:18].upper()
                    anim_raw = str(rp[6] if len(rp) > 6 else "none").strip().lower()
                p_out = {
                    "kind": kind,
                    "x": x,
                    "y": y,
                    "r": r,
                    "color": col,
                    "anim": anim_raw if anim_raw in VALID_VISUAL_ANIMS else "none",
                }
                if kind == "ring":
                    p_out["thickness"] = thick
                if lbl:
                    p_out["label"] = lbl
                return p_out

            if len(rp) < 6:
                return None
            x = _clamp_num(rp[1], -95, 95, 0)
            y = _clamp_num(rp[2], -88, 88, 0)
            w = _clamp_num(rp[3], 6, 192, 34)
            h = _clamp_num(rp[4], 6, 160, 24)
            col = _clean_hex(rp[5])
            lbl = str(rp[6] if len(rp) > 6 else "").strip()[:18].upper()
            anim_raw = str(rp[7] if len(rp) > 7 else "none").strip().lower()
            p_out = {
                "kind": kind,
                "x": x,
                "y": y,
                "w": w,
                "h": h,
                "color": col,
                "anim": anim_raw if anim_raw in VALID_VISUAL_ANIMS else "none",
            }
            if kind == "cone":
                extra = str(rp[8] if len(rp) > 8 else "up").strip().lower()
                p_out["dir"] = extra if extra in ("up", "down", "left", "right") else "up"
            elif kind == "arch":
                extra_a = rp[8] if len(rp) > 8 else False
                p_out["flip"] = bool(extra_a) if not isinstance(extra_a, str) else extra_a.lower() in ("true", "1", "flip", "hull")
            elif kind == "wave_layer":
                p_out["opacity"] = _clamp_num(rp[8], 0.2, 1.0, 0.82) if len(rp) > 8 else 0.82
            if lbl:
                p_out["label"] = lbl
            return p_out

        if not isinstance(rp, dict):
            return None
        kind = str(rp.get("kind") or "").strip().lower()
        if kind not in VALID_VISUAL_KINDS:
            return None
        color_raw = _clean_hex(rp.get("color"))
        anim = str(rp.get("anim") or "none").strip().lower()
        if anim not in VALID_VISUAL_ANIMS:
            anim = "none"
        p_out = {
            "kind": kind,
            "color": color_raw,
            "anim": anim,
        }
        if kind in ("truss", "beam", "arrow"):
            p_out["x1"] = _clamp_num(rp.get("x1"), -98, 98, -35)
            p_out["y1"] = _clamp_num(rp.get("y1"), -88, 88, -10)
            p_out["x2"] = _clamp_num(rp.get("x2"), -98, 98, 35)
            p_out["y2"] = _clamp_num(rp.get("y2"), -88, 88, 10)
            if kind in ("truss", "beam"):
                p_out["thickness"] = _clamp_num(rp.get("thickness"), 2, 26, 10)
        else:
            p_out["x"] = _clamp_num(rp.get("x"), -95, 95, 0)
            p_out["y"] = _clamp_num(rp.get("y"), -88, 88, 0)
            if "z" in rp:
                p_out["z"] = _clamp_num(rp.get("z"), -35, 35, 0)
            if kind in ("sphere", "ring"):
                p_out["r"] = _clamp_num(rp.get("r"), 5, 78, 18)
                if kind == "ring":
                    p_out["thickness"] = _clamp_num(rp.get("thickness"), 2, 16, 4)
            else:
                p_out["w"] = _clamp_num(rp.get("w"), 6, 192, 34)
                p_out["h"] = _clamp_num(rp.get("h"), 6, 160, 24)
            if kind == "cone":
                d_val = str(rp.get("dir") or "up").strip().lower()
                p_out["dir"] = d_val if d_val in ("up", "down", "left", "right") else "up"
            if kind == "arch":
                p_out["flip"] = bool(rp.get("flip", False))
        if "opacity" in rp:
            p_out["opacity"] = _clamp_num(rp.get("opacity"), 0.15, 1.0, 1.0)
        lbl = str(rp.get("label") or "").strip()[:18].upper()
        if lbl:
            p_out["label"] = lbl
        return p_out

    def _sanitize_custom_visual(
        raw_cv: Any,
        base_cv: Optional[Dict[str, Any]] = None,
        scene_idx: int = 0,
    ) -> Optional[Dict[str, Any]]:
        cam_cycle = ["iso_left", "closeup", "iso_right"]
        default_cam = cam_cycle[scene_idx % len(cam_cycle)]
        if not isinstance(raw_cv, dict):
            if base_cv:
                copied = dict(base_cv)
                copied["cameraAngle"] = default_cam
                copied["parts"] = [dict(p) for p in base_cv["parts"]]
                return copied
            return None

        raw_parts = raw_cv.get("parts") or raw_cv.get("focusParts") or []
        clean_focus: List[Dict[str, Any]] = []
        if isinstance(raw_parts, list):
            for rp in raw_parts[:14]:
                parsed_p = _parse_single_visual_part(rp)
                if parsed_p is not None:
                    clean_focus.append(parsed_p)

        replace_base = bool(raw_cv.get("replaceBase", False))
        if base_cv and not replace_base:
            focus_has_labels = sum(1 for fp in clean_focus if fp.get("label"))
            base_parts_merged: List[Dict[str, Any]] = []
            kept_base_labels = 0
            max_base_labels = max(0, 3 - focus_has_labels)
            for bp in base_cv["parts"]:
                bp_copy = dict(bp)
                if bp_copy.get("label"):
                    if kept_base_labels < max_base_labels:
                        kept_base_labels += 1
                    else:
                        bp_copy.pop("label", None)
                base_parts_merged.append(bp_copy)
            clean_parts = (base_parts_merged + clean_focus)[:14]
        else:
            clean_parts = clean_focus[:14]

        if not clean_parts:
            return None

        fallback_env = base_cv["environment"] if base_cv else "ground"
        env = str(raw_cv.get("environment") or fallback_env).strip().lower()
        if env not in VALID_ENVIRONMENTS:
            env = fallback_env
        cam = str(raw_cv.get("cameraAngle") or default_cam).strip().lower()
        if cam not in VALID_CAMERA_ANGLES:
            cam = default_cam
        fallback_tag = base_cv["themeTag"] if base_cv else "custom"
        return {
            "themeTag": str(raw_cv.get("themeTag") or fallback_tag)[:32],
            "environment": env,
            "cameraAngle": cam,
            "parts": clean_parts,
        }

    base_visual_clean = _sanitize_custom_visual(raw_proj.get("baseVisual"), None, 0)

    scenes_in = raw_proj.get("scenes") or []
    scenes: List[Dict[str, Any]] = []
    for i, sc in enumerate(scenes_in[:18]):
        sec_idx = int(sc.get("sectorIndex", i % len(sectors)))
        if sec_idx >= len(sectors):
            sec_idx = i % len(sectors)
        if sec_idx < -1:
            sec_idx = -1

        pose = sc.get("pose") if sc.get("pose") in VALID_POSES else ("standing_wave" if sec_idx < 0 else "standing_neutral")
        eff = sc.get("visualEffect") if sc.get("visualEffect") in ALL_VALID_EFFECTS else "presenter_steps"

        send_to = sc.get("sendDataToSector")
        if isinstance(send_to, int) and 0 <= send_to < len(sectors) and send_to != sec_idx:
            clean_send: Optional[int] = send_to
        else:
            clean_send = None

        clean_cv = _sanitize_custom_visual(sc.get("customVisual"), base_visual_clean, i)
        sc_dict: Dict[str, Any] = {
            "id": f"act-{i + 1}",
            "stepBanner": str(sc.get("stepBanner") or f"ETAPA {i + 1}/{len(scenes_in)}")[:38].upper(),
            "narration": str(sc.get("narration") or "").strip(),
            "sectorIndex": sec_idx,
            "pose": pose,
            "visualEffect": eff,
            "headline": str(sc.get("headline") or f"PONTO {i + 1}")[:32].upper(),
            "leftBadge": str(sc.get("leftBadge") or "")[:24].upper(),
            "leftBadgeColor": str(sc.get("leftBadgeColor") or "#FACC15"),
            "rightBadge": str(sc.get("rightBadge") or "")[:24].upper(),
            "rightBadgeColor": str(sc.get("rightBadgeColor") or "#22C55E"),
            "screenLine1": str(sc.get("screenLine1") or "")[:26].upper(),
            "screenLine2": str(sc.get("screenLine2") or "")[:26].upper(),
            "sendDataToSector": clean_send,
            "fromFrame": 1,
            "toFrame": 150,
        }
        if clean_cv is not None:
            sc_dict["customVisual"] = clean_cv
        scenes.append(sc_dict)

    proj_name = str(raw_proj.get("name") or "Vídeo Explicativo")[:68]
    proj_id = f"{slugify(proj_name)}-{int(time.time()) % 10000}"
    timed_scenes, words, total_frames = estimate_scene_timings(scenes)
    yt_meta = sanitize_yt_shorts_meta(raw_proj.get("ytShortsMeta"), proj_name, prompt_idea)
    candidates = sanitize_candidate_models(raw_proj.get("candidateModels"), prompt_idea, suggested)
    chosen_model = candidates[0]["modelId"] if payload.get("modelId") not in VALID_MODELS else chosen_model

    return {
        "id": proj_id,
        "name": proj_name,
        "promptIdea": prompt_idea,
        "modelId": chosen_model,
        "suggestedModelId": candidates[0]["modelId"],
        "candidateModels": candidates,
        "knowledgeSavedModelId": payload.get("knowledgeSavedModelId"),
        "platform": platform,
        "targetSeconds": target_seconds,
        "aiModelUsed": model_used or "motor-local",
        "ytShortsMeta": yt_meta,
        "aspectRatio": aspect_ratio,
        "voiceId": voice_id,
        "voiceRatePct": voice_rate,
        "sfxEnabled": bool(payload.get("sfxEnabled", True)),
        "subtitlesEnabled": bool(payload.get("subtitlesEnabled", True)),
        "sectors": sectors,
        "scenes": timed_scenes,
        "words": words,
        "audioUrl": None,
        "totalFrames": total_frames,
    }


def build_offline_fallback_project(payload: Dict[str, Any]) -> Dict[str, Any]:
    prompt_idea = (payload.get("promptIdea") or "").strip() or "Explicação passo a passo do tema escolhido."
    suggested = infer_suggested_model(prompt_idea.lower())
    aspect_ratio = payload.get("aspectRatio") if payload.get("aspectRatio") in ("16:9", "9:16") else "9:16"
    platform = payload.get("platform") if payload.get("platform") in VALID_PLATFORMS else ("youtube_shorts" if aspect_ratio == "9:16" else "youtube")
    target_seconds = int(payload.get("targetSeconds") or 60)

    clauses = [
        c.strip(" .,;|-")
        for c in re.split(
            r"(?:,\s*(?:ao fazer isso|em seguida|depois disso|depois|então|onde|no qual)|;\s*|\.\s+|\n+)",
            prompt_idea,
            flags=re.IGNORECASE,
        )
        if len(c.strip(" .,;|-")) > 8
    ]
    if not clauses:
        clauses = [prompt_idea]

    scenes: List[Dict[str, Any]] = []
    for idx, cl in enumerate(clauses[:10]):
        narr = cl[0].upper() + cl[1:]
        if not narr.endswith((".", "!", "?")):
            narr += "."
        words_top = " ".join(narr.split()[:4]).upper().strip(".,!?")
        scenes.append(
            {
                "stepBanner": f"ETAPA {idx + 1}/{len(clauses) + 1}",
                "narration": narr,
                "sectorIndex": idx % 2,
                "pose": "standing_neutral",
                "visualEffect": "presenter_steps" if suggested == "estudio_apresentador" else "copper_cycle",
                "headline": f"{words_top[:26]}!",
                "leftBadge": f"PASSO {idx + 1}",
                "leftBadgeColor": "#FACC15",
                "rightBadge": "NA PRÁTICA ✓",
                "rightBadgeColor": "#38BDF8",
                "screenLine1": words_top[:22],
                "screenLine2": f"ETAPA {idx + 1} OK ✓",
                "sendDataToSector": (idx + 1) % 2 if len(clauses) > 1 else None,
            }
        )

    scenes.append(
        {
            "stepBanner": "CONCLUSÃO • RESUMO GERAL",
            "narration": "Juntando cada etapa de forma clara e engenhosa, tudo funciona com máxima precisão! Pronto! Agora você já sabe como tudo funciona na prática!",
            "sectorIndex": -1 if suggested == "fluxo_corporativo" else 0,
            "pose": "standing_wave",
            "visualEffect": "panorama_all" if suggested == "fluxo_corporativo" else "presenter_conclusion",
            "headline": "PRONTO! AGORA VOCÊ SABE!",
            "leftBadge": "RESUMO COMPLETO ✓",
            "leftBadgeColor": "#22C55E",
            "rightBadge": "100% EXPLICADO!",
            "rightBadgeColor": "#FACC15",
            "screenLine1": "CONCLUÍDO",
            "screenLine2": "100% EXPLICADO ✓",
            "sendDataToSector": None,
        }
    )

    title_words = " ".join(prompt_idea.split()[:6]).title().rstrip(".,;:")
    raw = {
        "name": title_words or "Novo Short Explicativo 3D",
        "suggestedModelId": suggested,
        "sectors": [
            {
                "title": "1. BANCADA PRINCIPAL",
                "stationType": "office_single",
                "shirtColor": "#F0CA4D",
                "shortsColor": "#334155",
                "wallAccentColor": "#2563EB",
                "monitorHeader": "PAINEL 3D",
            },
            {
                "title": "2. RESULTADO PRÁTICO",
                "stationType": "office_dual_erp",
                "shirtColor": "#10B981",
                "shortsColor": "#1E293B",
                "wallAccentColor": "#047857",
                "monitorHeader": "CONCLUSÃO",
            },
        ],
        "scenes": scenes,
    }
    payload_copy = dict(payload)
    payload_copy["platform"] = platform
    payload_copy["targetSeconds"] = target_seconds
    return sanitize_llm_project(raw, payload_copy, "motor-local")


CUSTOM_VISUAL_SPEC_PROMPT = (
    "4. MAQUETE 2D/3D SOB MEDIDA OBRIGATÓRIA ('baseVisual' + 'customVisual' EM TUPLAS COMPACTAS): "
    "PROIBIDO usar objetos genéricos desconexos! Construa geometricamente o OBJETO REAL do tema (ex: guindaste, ponte estaiada, barragem, cratera subterrânea, navio, elevador, estrela/prisma, vulcão, avião, etc.) no espaço X=-95..+95, Y=-85(chão)..+85(topo, +Y aponta p/ CIMA):\n"
    "   - Em 'baseVisual' (nível raiz), desenhe de 5 a 7 peças estruturais fixas do objeto principal usando TUPLAS JSON compactas:\n"
    '     * Retângulo/Bloco: ["box", x, y, w, h, "#HEX", "LABEL_OPCIONAL", "none"|"pulse"|"bob"|"shake"]\n'
    '     * Treliça metálica (torre/lança/ponte): ["truss", x1, y1, x2, y2, thickness, "#HEX", "LABEL_OPC", "none"|"sway"]\n'
    '     * Cabo/Viga/Feixe: ["beam", x1, y1, x2, y2, thickness, "#HEX", "LABEL_OPC", "none"]\n'
    '     * Cilindro/Pilar/Pistão: ["cylinder", x, y, w, h, "#HEX", "LABEL_OPC", "none"|"pulse"]\n'
    '     * Esfera/Planeta/Caverna: ["sphere", x, y, r, "#HEX", "LABEL_OPC", "pulse"|"bob"]\n'
    '     * Cone/Cunha/Vulcão/Prisma: ["cone", x, y, w, h, "#HEX", "LABEL_OPC", "none", "up"|"down"|"left"|"right"]\n'
    '     * Anel/Polia/Órbita: ["ring", x, y, r, "#HEX", "LABEL_OPC", "spin"|"pulse"]\n'
    '     * Casco de navio ("flip") ou Domo ("arch"): ["arch", x, y, w, h, "#HEX", "LABEL_OPC", "bob", "flip"|"arch"]\n'
    '     * Água/Mar/Solo: ["wave_layer", x, y, w, h, "#HEX", "", "flow"]\n'
    '     * Seta animada de Força/Peso/Vento/Fluxo: ["arrow", x1, y1, x2, y2, "#HEX", "RÓTULO CURTO", "flow"]\n'
    '   - Em CADA cena dentro de "scenes", preencha "customVisual": {"cameraAngle": "iso_left"|"closeup"|"iso_right", "replaceBase": false, "parts": [ ...2 a 3 tuplas de setas/forças/peças em destaque daquela cena... ]} (use "replaceBase": true com 5 a 6 tuplas apenas se aquela cena mostrar um objeto diferente da estrutura base).\n'
)


async def generate_script_via_ai(payload: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    prompt_idea = (payload.get("promptIdea") or payload.get("prompt") or "").strip()
    target_seconds = int(payload.get("targetSeconds") or 60)
    aspect_ratio = payload.get("aspectRatio") or "9:16"
    platform = payload.get("platform") if payload.get("platform") in VALID_PLATFORMS else ("youtube_shorts" if aspect_ratio == "9:16" else "youtube")
    hint_model = payload.get("hintModelId") if payload.get("hintModelId") in VALID_MODELS else None

    target_words, target_scenes = compute_duration_targets(target_seconds, platform)
    learned_context = await build_learned_preferences_context(prompt_idea)

    shorts_rule = ""
    if platform == "youtube_shorts":
        shorts_rule = (
            "7. ESTILO YOUTUBE SHORTS VIRAL (@FronteiraDoc, @HistoriandoCuriosidades, @curiosicasabr, @DesmontandoOMundo): "
            "PROIBIDO começar com 'Olá', 'Oi pessoal' ou introduções lentas! A Cena 1 DEVE abrir no primeiro segundo com um fato contraintuitivo, data/número de impacto, pergunta magnética ou revelação visual imediata. "
            "Mantenha cortes dinâmicos, dados reais concretos e frases envolventes do início ao fim.\n"
        )

    hint_rule = ""
    if hint_model:
        hint_rule = f"DICA DE ORIGEM DO TEMA: Este tema veio inspirado no canal cujo design padrão é '{hint_model}' — inclua '{hint_model}' entre os 3 'candidateModels' se fizer sentido para o conteúdo.\n"

    sys_prompt = (
        "Você é um roteirista e diretor de Motion Design 2D & Engenharia de Maquetes 3D especialista em vídeos explicativos virais em português do Brasil, operando via OmniRoute "
        "(inspirado em @FronteiraDoc, @HistoriandoCuriosidades, @curiosicasabr, @engenhocaexplicadas e @DesmontandoOMundo). "
        "NUNCA mencione 'Data Crítica' ou 'supermercado' a menos que o usuário tenha pedido isso no prompt! Crie tudo 100% focado no tema exato pedido pelo usuário.\n"
        "IMPORTANTE: O usuário NÃO escolhe o modelo antes — VOCÊ (IA do OmniRoute) deve analisar o tema + o histórico da Base de Conhecimento do usuário e selecionar OS 3 MELHORES MODELOS VISUAIS DIFERENTES ('candidateModels' com exatos 3 itens distintos) para o usuário assistir lado a lado e escolher o campeão!\n"
        "Retorne APENAS um JSON válido (sem blocos markdown) seguindo exatamente esta estrutura:\n"
        "{\n"
        '  "name": "Título curto e magnético do vídeo",\n'
        '  "suggestedModelId": "doc_mapa_radar" | "ilustrado_flat_2d" | "editorial_kinetic_2d" | "sala_experimento" | "fluxo_corporativo" | "estudio_apresentador",\n'
        '  "candidateModels": [\n'
        '    {"modelId": "primeiro_modelo_ideal", "rank": 1, "reason": "1 frase direta explicando por que este é o modelo #1 para este vídeo"},\n'
        '    {"modelId": "segundo_modelo_diferente", "rank": 2, "reason": "1 frase direta explicando o diferencial visual desta 2ª opção"},\n'
        '    {"modelId": "terceiro_modelo_diferente", "rank": 3, "reason": "1 frase direta explicando o ângulo desta 3ª opção (ex: contraste 2D vs 3D)"}\n'
        "  ],\n"
        '  "ytShortsMeta": {\n'
        '    "title": "Título otimizado p/ YouTube Shorts (até 70 caracteres)",\n'
        '    "description": "Descrição curta de 2 linhas instigantes resumindo o vídeo para o YouTube",\n'
        '    "hashtags": ["#shorts", "#curiosidades", "#ciencia", "#historia"]\n'
        "  },\n"
        '  "baseVisual": {\n'
        '    "themeTag": "assunto_real",\n'
        '    "environment": "ground",\n'
        '    "parts": [\n'
        '      ["box", 0, -75, 110, 14, "#64748B", "BASE", "none"],\n'
        '      ["truss", -12, -68, -12, 52, 16, "#FACC15", "TORRE", "none"]\n'
        '    ]\n'
        '  },\n'
        '  "scenes": [\n'
        '    {\n'
        '      "stepBanner": "ATO 1/N • O GANCHO",\n'
        '      "narration": "Texto falado natural, claro e envolvente...",\n'
        '      "headline": "TÍTULO CURTO!",\n'
        '      "leftBadge": "DESTAQUE 1",\n'
        '      "rightBadge": "DESTAQUE 2",\n'
        '      "screenLine1": "DADO / SUBTÍTULO",\n'
        '      "screenLine2": "DETALHE EXTRA",\n'
        '      "customVisual": {\n'
        '        "cameraAngle": "iso_left",\n'
        '        "replaceBase": false,\n'
        '        "parts": [\n'
        '          ["arrow", 55, -20, 55, -58, "#EF4444", "CARGA ↓", "flow"]\n'
        '        ]\n'
        '      }\n'
        '    }\n'
        "  ]\n"
        "}\n"
        "Catálogo dos 6 Modelos Visuais disponíveis para compor o Top 3 em 'candidateModels' (escolha 3 DISTINTOS!):\n"
        "   - 'doc_mapa_radar' (2D Escuro @FronteiraDoc): fenômenos naturais, mapas, geografia, estruturas colossais, mistérios reais e recordes.\n"
        "   - 'ilustrado_flat_2d' (2D Flat @HistoriandoCuriosidades): história, astronomia, navegação, provas científicas e camadas.\n"
        "   - 'editorial_kinetic_2d' (2D Clean @curiosicasabr / @engenhocaexplicadas): 'Como X funciona?' em blueprint raio-X na Cena 1 + mecanismo colorido e confetes.\n"
        "   - 'sala_experimento' (Bancada & Maquete 3D @DesmontandoOMundo): estúdio 3D com bancada construindo a maquete 3D real de máquinas, estruturas, pontes, guindastes, barragens e física!\n"
        "   - 'fluxo_corporativo' (3D): APENAS quando o tema for fluxo entre departamentos/equipes/empresas.\n"
        "   - 'estudio_apresentador' (3D): apresentador com grande telão 3D + pedestal de maquete 3D.\n"
        "Regras obrigatórias:\n"
        "1. Em 'candidateModels', escolha EXATAMENTE 3 modelos DIFERENTES que realmente combinem com o tema (misturando opções 2D e 3D quando fizer sentido, e respeitando as preferências aprendidas do usuário quando houver!). 'suggestedModelId' deve ser igual ao modelId de rank 1.\n"
        f"2. CALIBRAGEM DE TEMPO: Vídeo de {target_seconds}s ({platform.upper()} {aspect_ratio}) -> gere {target_scenes} cenas com cerca de {max(18, int(round(target_words / max(1, target_scenes))))} palavras por cena (~{target_words} palavras no total) em português simples e natural.\n"
        "3. Preencha headlines curtos e impactantes, leftBadge, rightBadge, screenLine1 e screenLine2 ricos em dados concretos!\n"
        f"{CUSTOM_VISUAL_SPEC_PROMPT}"
        f"{learned_context}"
        f"{hint_rule}"
        f"{shorts_rule}"
    )

    user_prompt = (
        f"Tema / Prompt do usuário: {prompt_idea}\n"
        f"Plataforma: {platform.upper()} ({aspect_ratio})\n"
        f"Duração desejada: {target_seconds} segundos (~{target_words} palavras divididas em ~{target_scenes} cenas).\n"
        "Escolha os 3 melhores modelos visuais distintos em 'candidateModels', gere o roteiro completo e construa o 'customVisual' sob medida do objeto real em cada cena."
    )

    raw_json, model_used = await call_omniroute_json(sys_prompt, user_prompt)
    if raw_json is not None:
        return sanitize_llm_project(raw_json, payload, model_used), (model_used or "omniroute")

    return build_offline_fallback_project(payload), "motor-local"


def _preserve_missing_custom_visuals(
    new_scenes: List[Dict[str, Any]], old_scenes: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    if not old_scenes:
        return new_scenes
    out: List[Dict[str, Any]] = []
    for idx, sc in enumerate(new_scenes):
        sc_copy = dict(sc)
        if not sc_copy.get("customVisual") and idx < len(old_scenes):
            old_cv = old_scenes[idx].get("customVisual")
            if isinstance(old_cv, dict) and old_cv.get("parts"):
                sc_copy["customVisual"] = old_cv
        out.append(sc_copy)
    return out


async def resize_project_script_via_ai(project: Dict[str, Any], mode: str, target_seconds: int) -> Tuple[Dict[str, Any], str]:
    target_words, _ = compute_duration_targets(target_seconds, project.get("platform") or "youtube_shorts")
    if mode == "shorter":
        goal_desc = f"ENXUGAR e resumir as falas ('narration') das cenas atuais para que a soma total caia para cerca de {target_words} palavras (caber confortavelmente em {target_seconds} segundos), mantendo todas as informações essenciais."
    elif mode == "longer":
        goal_desc = f"EXPANDIR e enriquecer as falas ('narration') das cenas (podendo adicionar cenas se necessário) para que a soma total alcance cerca de {target_words} palavras ({target_seconds} segundos), mantendo didática ágil."
    else:
        goal_desc = f"AJUSTAR as falas ('narration') para totalizar cerca de {target_words} palavras ({target_seconds} segundos exatos)."

    old_scenes = project.get("scenes", [])
    compact_scenes = [{k: v for k, v in s.items() if k != "customVisual"} for s in old_scenes]

    sys_prompt = (
        "Você ajusta a duração de roteiros 2D/3D em português. Receberá o JSON de 'scenes' atual e devolverá APENAS um JSON válido no formato "
        '{"scenes": [...]} mantendo os mesmos campos de cada cena (stepBanner, narration, sectorIndex, pose, visualEffect, headline, leftBadge, leftBadgeColor, rightBadge, rightBadgeColor, screenLine1, screenLine2, sendDataToSector), '
        f"porém reescrevendo 'narration' para cumprir a meta: {goal_desc}"
    )
    user_prompt = json.dumps({"scenes": compact_scenes}, ensure_ascii=False)

    raw_json, model_used = await call_omniroute_json(sys_prompt, user_prompt)
    if raw_json and isinstance(raw_json.get("scenes"), list) and len(raw_json["scenes"]) > 0:
        merged = dict(project)
        merged["targetSeconds"] = target_seconds
        restored_scenes = _preserve_missing_custom_visuals(raw_json["scenes"], old_scenes)
        raw_full = {
            "name": project.get("name"),
            "suggestedModelId": project.get("suggestedModelId") or project.get("modelId"),
            "candidateModels": project.get("candidateModels"),
            "ytShortsMeta": project.get("ytShortsMeta"),
            "sectors": project.get("sectors"),
            "scenes": restored_scenes,
        }
        updated = sanitize_llm_project(raw_full, merged, model_used)
        updated["id"] = project.get("id") or updated["id"]
        updated["modelId"] = project.get("modelId") or updated["modelId"]
        updated["candidateModels"] = project.get("candidateModels") or updated.get("candidateModels")
        return updated, (model_used or "omniroute")

    return project, "unchanged"


async def refine_project_script_via_ai(
    project: Dict[str, Any], instruction: str, target_seconds: int
) -> Tuple[Dict[str, Any], str, str]:
    platform = project.get("platform") or "youtube_shorts"
    target_words, _ = compute_duration_targets(target_seconds, platform)
    old_scenes = project.get("scenes", [])

    compact_scenes_for_refine = [{k: v for k, v in s.items() if k != "customVisual"} for s in old_scenes]

    sys_prompt = (
        "Você é um roteirista e diretor criativo especialista em explicar qualquer assunto de forma SIMPLES, LEIGA, fluida e magnética em português do Brasil.\n"
        "Você receberá o roteiro atual ('name', 'ytShortsMeta' e 'scenes') e um PEDIDO DE AJUSTE em linguagem natural feito pelo criador.\n"
        "Regras obrigatórias:\n"
        "1. Aplique fielmente o pedido do usuário nas falas ('narration') mantendo uma leitura corrida fluida do início ao fim, sem jargões difíceis (a menos que o usuário peça).\n"
        "2. ATUALIZAÇÃO VISUAL AUTOMÁTICA: Sempre que mudar uma fala ('narration'), atualize automaticamente 'headline' (até 28 caracteres), 'leftBadge', 'rightBadge', 'screenLine1' e 'screenLine2'. Só inclua 'baseVisual'/'customVisual' se o pedido do usuário mudar o objeto físico mostrado nas cenas (caso contrário omita 'customVisual' para preservar a maquete atual com velocidade máxima!).\n"
        f"3. Mantenha a duração próxima de {target_seconds} segundos (~{target_words} palavras somadas em todas as cenas), exceto se o pedido do usuário pedir explicitamente para encurtar ou alongar.\n"
        f"{CUSTOM_VISUAL_SPEC_PROMPT}"
        "Retorne APENAS um JSON válido (sem markdown) exatamente neste formato:\n"
        "{\n"
        '  "name": "Título atualizado do vídeo",\n'
        '  "changeSummary": "1 frase curta e amigável dizendo o que você ajustou no roteiro e no visual",\n'
        '  "ytShortsMeta": {"title": "...", "description": "...", "hashtags": ["#shorts"]},\n'
        '  "scenes": [ ... ]\n'
        "}"
    )

    user_prompt = (
        f"PEDIDO DO USUÁRIO PARA AJUSTAR O ROTEIRO:\n\"{instruction}\"\n\n"
        f"ROTEIRO ATUAL (JSON):\n"
        + json.dumps(
            {
                "name": project.get("name"),
                "ytShortsMeta": project.get("ytShortsMeta"),
                "scenes": compact_scenes_for_refine,
            },
            ensure_ascii=False,
        )
    )

    raw_json, model_used = await call_omniroute_json(sys_prompt, user_prompt)
    if raw_json and isinstance(raw_json.get("scenes"), list) and len(raw_json["scenes"]) > 0:
        merged = dict(project)
        merged["targetSeconds"] = target_seconds
        restored_scenes = _preserve_missing_custom_visuals(raw_json["scenes"], old_scenes)
        raw_full = {
            "name": raw_json.get("name") or project.get("name"),
            "suggestedModelId": project.get("suggestedModelId") or project.get("modelId"),
            "candidateModels": project.get("candidateModels"),
            "ytShortsMeta": raw_json.get("ytShortsMeta") or project.get("ytShortsMeta"),
            "sectors": project.get("sectors"),
            "baseVisual": raw_json.get("baseVisual"),
            "scenes": restored_scenes,
        }
        updated = sanitize_llm_project(raw_full, merged, model_used)
        updated["id"] = project.get("id") or updated["id"]
        updated["modelId"] = project.get("modelId") or updated["modelId"]
        updated["candidateModels"] = project.get("candidateModels") or updated.get("candidateModels")
        summary = str(raw_json.get("changeSummary") or "Roteiro e elementos visuais atualizados conforme seu pedido!").strip()
        return updated, (model_used or "omniroute"), summary

    return project, "unchanged", "Não foi possível conectar à IA no momento; o roteiro atual foi mantido."


# ---------------------------------------------------------------------------
# Fila Assíncrona de Renderização MP4 (Remotion + ANGLE Three.js)
# ---------------------------------------------------------------------------
async def run_remotion_render_job(job_id: str, project: Dict[str, Any]) -> None:
    job = RENDER_JOBS[job_id]
    try:
        if not project.get("audioUrl"):
            job["phase"] = "Gerando narração neural calibrada e sincronizando legendas..."
            job["progressPct"] = 5
            project, _ = await synthesize_project_audio(project, auto_fit_duration=True)
            job["project"] = project

        proj_slug = slugify(project.get("id") or project.get("name") or "video")
        proj_dir = PROJECTS_DIR / proj_slug
        proj_dir.mkdir(parents=True, exist_ok=True)

        props_path = proj_dir / "render_props.json"
        props_path.write_text(
            json.dumps({"project": project}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        out_filename = f"{proj_slug}.mp4"
        out_mp4 = RENDERS_DIR / out_filename
        sidecar_json = RENDERS_DIR / f"{proj_slug}.project.json"
        sidecar_json.write_text(
            json.dumps(project, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        npx_bin = "npx.cmd" if os.name == "nt" else "npx"
        rel_props = f"public/studio_projects/{proj_slug}/render_props.json"
        rel_out = f"renders/{out_filename}"

        is_2d = project.get("modelId") in MODELS_2D
        mode_tag = "2D Motion" if is_2d else "3D"
        job["phase"] = f"Inicializando motor {mode_tag} Remotion..."
        job["progressPct"] = 10

        proc = await asyncio.create_subprocess_exec(
            npx_bin,
            "remotion",
            "render",
            "src/index.ts",
            "StudioDynamic",
            rel_out,
            f"--props={rel_props}",
            "--gl=angle",
            "--concurrency=4",
            "--timeout=90000",
            cwd=str(ROOT),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )

        log_tail: List[str] = []
        assert proc.stdout is not None
        while True:
            chunk = await proc.stdout.read(256)
            if not chunk:
                break
            text_chunk = chunk.decode("utf-8", errors="replace")
            for part in re.split(r"[\r\n]+", text_chunk):
                line = part.strip()
                if not line:
                    continue
                log_tail.append(line)
                if len(log_tail) > 30:
                    log_tail.pop(0)

                m_rend = re.search(r"Rendered\s+(\d+)\s*/\s*(\d+)", line, re.IGNORECASE)
                m_enc = re.search(r"Encoded\s+(\d+)\s*/\s*(\d+)", line, re.IGNORECASE)
                if m_rend:
                    cur_f = int(m_rend.group(1))
                    tot_f = max(1, int(m_rend.group(2)))
                    job["renderedFrames"] = cur_f
                    job["totalFrames"] = tot_f
                    job["progressPct"] = min(92, 12 + int((cur_f / tot_f) * 76))
                    job["phase"] = f"Renderizando quadros {mode_tag} ({cur_f}/{tot_f})..."
                elif m_enc:
                    cur_e = int(m_enc.group(1))
                    tot_e = max(1, int(m_enc.group(2)))
                    job["progressPct"] = min(99, 88 + int((cur_e / tot_e) * 11))
                    job["phase"] = f"Codificando MP4 H.264 ({cur_e}/{tot_e})..."

        rc = await proc.wait()
        if rc == 0 and out_mp4.exists():
            size_mb = round(out_mp4.stat().st_size / (1024 * 1024), 2)
            job["status"] = "done"
            job["progressPct"] = 100
            job["phase"] = f"Vídeo MP4 concluído ({size_mb} MB)!"
            job["outputUrl"] = f"/renders/{out_filename}"
            job["filename"] = out_filename
            job["sizeMb"] = size_mb
        else:
            job["status"] = "error"
            job["phase"] = "Falha durante a renderização Remotion."
            job["error"] = "\n".join(log_tail[-10:])
    except Exception as exc:
        job["status"] = "error"
        job["phase"] = "Erro interno ao renderizar."
        job["error"] = str(exc)


# ---------------------------------------------------------------------------
# Handlers HTTP (aiohttp)
# ---------------------------------------------------------------------------
@web.middleware
async def cors_middleware(request: web.Request, handler):
    if request.method == "OPTIONS":
        resp = web.Response(status=204)
    else:
        try:
            resp = await handler(request)
        except web.HTTPException as http_exc:
            resp = http_exc
        except Exception as exc:
            resp = web.json_response({"ok": False, "error": str(exc)}, status=500)
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return resp


async def handle_health(request: web.Request) -> web.Response:
    mp4_count = len(list(RENDERS_DIR.glob("*.mp4")))
    store = load_radar_store()
    return web.json_response(
        {
            "ok": True,
            "server": "Desmontando Studio 3D API",
            "rendersCount": mp4_count,
            "youtubeChannelsCount": len(store.get("channels") or []),
            "omnirouteConfigured": bool(os.environ.get("OPENAI_BASE_URL") and os.environ.get("OPENAI_API_KEY")),
            "modelsChain": get_omniroute_models(),
            "voices": list(VOICE_PROFILES.keys()),
        }
    )


async def handle_youtube_radar(request: web.Request) -> web.Response:
    async with RADAR_LOCK:
        store = load_radar_store()
        channels = store.get("channels") or []
        needs_initial_scrape = bool(channels) and any(int(c.get("shortsCount") or 0) == 0 for c in channels)
        if needs_initial_scrape:
            store = await refresh_all_radar_channels(store)
        current_themes = store.get("dailyThemes") or []
        needs_ai_analysis = (
            bool(channels)
            and (
                len(current_themes) != 3
                or not store.get("channelAnalysis")
                or store.get("analyzedSignature") != _channels_signature(store)
            )
        )
        if needs_ai_analysis:
            await generate_daily_themes_via_ai(store)
        return web.json_response({"ok": True, "radar": store})


async def handle_youtube_add_channel(request: web.Request) -> web.Response:
    body = await request.json()
    raw_input = str(body.get("input") or "").strip()
    if not raw_input:
        return web.json_response({"ok": False, "error": "Informe um link do YouTube ou @arroba."}, status=400)

    async with RADAR_LOCK:
        store = load_radar_store()
        resolved = await asyncio.to_thread(resolve_channel_from_input_sync, raw_input)
        scraped_ch, scraped_vids = await asyncio.to_thread(scrape_channel_shorts_sync, resolved, 45)

        channels: List[Dict[str, Any]] = store.get("channels") or []
        replaced = False
        for i, existing in enumerate(channels):
            if (
                existing.get("id") == scraped_ch["id"]
                or existing.get("handle", "").lower() == scraped_ch["handle"].lower()
            ):
                channels[i] = scraped_ch
                replaced = True
                break
        if not replaced:
            channels.append(scraped_ch)

        other_vids = [
            v
            for v in (store.get("viralVideos") or [])
            if v.get("channelId") != scraped_ch["id"]
            and v.get("channelHandle", "").lower() != scraped_ch["handle"].lower()
        ]
        merged = other_vids + scraped_vids
        merged.sort(key=lambda x: x.get("viewCount") or 0, reverse=True)

        store["channels"] = channels
        store["viralVideos"] = merged
        store["lastUpdatedAt"] = datetime.now().strftime("%d/%m/%Y %H:%M")
        save_radar_store(store)
        await generate_daily_themes_via_ai(store)
        return web.json_response({"ok": True, "addedChannel": scraped_ch, "radar": store})


async def handle_youtube_remove_channel(request: web.Request) -> web.Response:
    body = await request.json()
    channel_id = str(body.get("channelId") or "").strip()
    handle = str(body.get("handle") or "").strip().lower()

    async with RADAR_LOCK:
        store = load_radar_store()
        store["channels"] = [
            c
            for c in (store.get("channels") or [])
            for _ in [0]
            if c.get("id") != channel_id and (not handle or c.get("handle", "").lower() != handle)
        ]
        store["viralVideos"] = [
            v
            for v in (store.get("viralVideos") or [])
            if v.get("channelId") != channel_id and (not handle or v.get("channelHandle", "").lower() != handle)
        ]
        save_radar_store(store)
        if store["channels"]:
            await generate_daily_themes_via_ai(store)
        return web.json_response({"ok": True, "radar": store})


async def handle_youtube_refresh(request: web.Request) -> web.Response:
    async with RADAR_LOCK:
        store = load_radar_store()
        store = await refresh_all_radar_channels(store)
        if store.get("channels"):
            await generate_daily_themes_via_ai(store)
        return web.json_response({"ok": True, "radar": store})


async def handle_youtube_daily_themes(request: web.Request) -> web.Response:
    body = await request.json()
    niche_hint = str(body.get("nicheHint") or "").strip()
    inspire_video_id = str(body.get("inspireVideoId") or "").strip()

    async with RADAR_LOCK:
        store = load_radar_store()
        channels = store.get("channels") or []
        if channels and all(int(c.get("shortsCount") or 0) == 0 for c in channels):
            store = await refresh_all_radar_channels(store)
        themes, source = await generate_daily_themes_via_ai(store, niche_hint=niche_hint, inspire_video_id=inspire_video_id)
        return web.json_response({"ok": True, "source": source, "themes": themes, "radar": store})


async def handle_voice_preview(request: web.Request) -> web.Response:
    body = await request.json()
    voice_id = body.get("voiceId") or "antonio_dinamico"
    profile = VOICE_PROFILES.get(voice_id, VOICE_PROFILES["antonio_dinamico"])
    edge_voice = body.get("edgeVoice") or profile["edgeVoice"]
    rate_pct = int(body.get("ratePct", profile["defaultRatePct"]))
    pitch_hz = int(body.get("pitchHz", profile["pitchHz"]))
    sample_text = (
        body.get("text")
        or "Olá! Veja na prática como cada etapa do vídeo fica clara, dinâmica e bem explicada!"
    ).strip()

    key_hash = hashlib.sha1(
        f"{edge_voice}|{rate_pct}|{pitch_hz}|{sample_text}".encode("utf-8")
    ).hexdigest()[:14]
    mp3_file = VOICE_SAMPLES_DIR / f"preview_{key_hash}.mp3"

    if not mp3_file.exists():
        communicate = edge_tts.Communicate(
            sample_text,
            voice=edge_voice,
            rate=f"{rate_pct:+d}%",
            pitch=f"{pitch_hz:+d}Hz",
        )
        await communicate.save(str(mp3_file))

    return web.json_response(
        {
            "ok": True,
            "audioUrl": f"/studio_projects/_voice_samples/{mp3_file.name}",
        }
    )


async def handle_ai_generate(request: web.Request) -> web.Response:
    payload = await request.json()
    project, source = await generate_script_via_ai(payload)
    return web.json_response({"ok": True, "source": source, "project": project})


async def handle_ai_resize(request: web.Request) -> web.Response:
    body = await request.json()
    project = body.get("project")
    if not isinstance(project, dict):
        return web.json_response({"ok": False, "error": "Campo 'project' ausente."}, status=400)
    mode = body.get("mode") or "fit_target"
    target_sec = int(body.get("targetSeconds") or project.get("targetSeconds") or 60)
    updated, source = await resize_project_script_via_ai(project, mode, target_sec)
    return web.json_response({"ok": True, "source": source, "project": updated})


async def handle_ai_refine_script(request: web.Request) -> web.Response:
    body = await request.json()
    project = body.get("project")
    instruction = str(body.get("instruction") or "").strip()
    if not isinstance(project, dict) or not instruction:
        return web.json_response(
            {"ok": False, "error": "Informe o projeto e o que deseja mudar no roteiro."},
            status=400,
        )
    target_sec = int(body.get("targetSeconds") or project.get("targetSeconds") or 60)
    updated, source, summary = await refine_project_script_via_ai(project, instruction, target_sec)
    return web.json_response(
        {
            "ok": True,
            "source": source,
            "changeSummary": summary,
            "project": updated,
        }
    )


async def handle_project_tts(request: web.Request) -> web.Response:
    body = await request.json()
    project = body.get("project")
    if not isinstance(project, dict):
        return web.json_response({"ok": False, "error": "Campo 'project' ausente."}, status=400)

    auto_fit = bool(body.get("autoFitDuration", True))
    updated, meta = await synthesize_project_audio(project, auto_fit_duration=auto_fit)
    return web.json_response({"ok": True, "project": updated, "calibration": meta})


async def handle_project_save(request: web.Request) -> web.Response:
    body = await request.json()
    project = body.get("project")
    if not isinstance(project, dict):
        return web.json_response({"ok": False, "error": "Campo 'project' ausente."}, status=400)

    proj_slug = slugify(project.get("id") or project.get("name") or "projeto")
    project["id"] = proj_slug
    proj_dir = PROJECTS_DIR / proj_slug
    proj_dir.mkdir(parents=True, exist_ok=True)
    (proj_dir / "project.json").write_text(
        json.dumps(project, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return web.json_response({"ok": True, "project": project})


async def handle_projects_list(request: web.Request) -> web.Response:
    items: List[Dict[str, Any]] = []
    for p_json in sorted(PROJECTS_DIR.glob("*/project.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        if p_json.parent.name.startswith("_"):
            continue
        try:
            data = json.loads(p_json.read_text(encoding="utf-8"))
            items.append(data)
        except Exception:
            continue
    return web.json_response({"ok": True, "projects": items})


async def handle_knowledge_preferences(request: web.Request) -> web.Response:
    entries = load_design_preferences()
    return web.json_response(
        {
            "ok": True,
            "count": len(entries),
            "entries": list(reversed(entries[-20:])),
        }
    )


async def handle_knowledge_choose_model(request: web.Request) -> web.Response:
    body = await request.json()
    project = body.get("project")
    chosen_model_id = str(body.get("chosenModelId") or "").strip()
    user_note = str(body.get("userNote") or "").strip()

    if not isinstance(project, dict) or chosen_model_id not in VALID_MODELS:
        return web.json_response(
            {"ok": False, "error": "Informe 'project' válido e 'chosenModelId'."},
            status=400,
        )

    candidates = body.get("candidateModels")
    if not isinstance(candidates, list) or not candidates:
        candidates = project.get("candidateModels") or []

    entry, hub_saved = await record_choice_in_knowledge_base(
        project=project,
        chosen_model_id=chosen_model_id,
        candidate_models=candidates,
        user_note=user_note,
    )

    project["modelId"] = chosen_model_id
    project["knowledgeSavedModelId"] = chosen_model_id
    proj_slug = slugify(project.get("id") or project.get("name") or "projeto")
    project["id"] = proj_slug
    proj_dir = PROJECTS_DIR / proj_slug
    proj_dir.mkdir(parents=True, exist_ok=True)
    (proj_dir / "project.json").write_text(
        json.dumps(project, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    total_count = len(load_design_preferences())
    return web.json_response(
        {
            "ok": True,
            "hubSaved": hub_saved,
            "totalLearnedCount": total_count,
            "entry": entry,
            "project": project,
        }
    )


async def handle_render_start(request: web.Request) -> web.Response:
    body = await request.json()
    project = body.get("project")
    if not isinstance(project, dict):
        return web.json_response({"ok": False, "error": "Campo 'project' ausente."}, status=400)

    chosen_mid = str(project.get("modelId") or "")
    if chosen_mid in VALID_MODELS and project.get("knowledgeSavedModelId") != chosen_mid:
        try:
            await record_choice_in_knowledge_base(
                project=project,
                chosen_model_id=chosen_mid,
                candidate_models=project.get("candidateModels") or [],
                user_note="Exportado diretamente em MP4 pelo usuário.",
            )
            project["knowledgeSavedModelId"] = chosen_mid
        except Exception:
            pass

    job_id = uuid.uuid4().hex[:10]
    RENDER_JOBS[job_id] = {
        "jobId": job_id,
        "status": "running",
        "progressPct": 2,
        "phase": "Preparando projeto para exportação...",
        "renderedFrames": 0,
        "totalFrames": int(project.get("totalFrames") or 300),
        "outputUrl": None,
        "filename": None,
        "sizeMb": None,
        "error": None,
        "project": project,
    }
    asyncio.create_task(run_remotion_render_job(job_id, project))
    return web.json_response({"ok": True, "jobId": job_id, "job": RENDER_JOBS[job_id]})


async def handle_render_status(request: web.Request) -> web.Response:
    job_id = request.match_info.get("job_id", "")
    job = RENDER_JOBS.get(job_id)
    if not job:
        return web.json_response({"ok": False, "error": "Job não encontrado."}, status=404)
    return web.json_response({"ok": True, "job": job})


async def handle_gallery(request: web.Request) -> web.Response:
    videos: List[Dict[str, Any]] = []
    model_names = {
        "doc_mapa_radar": "Geo-Doc & Radar 2D",
        "ilustrado_flat_2d": "Ilustração Flat 2D",
        "editorial_kinetic_2d": "Blueprint & Cards 2D",
        "fluxo_corporativo": "Fluxo entre Setores 3D",
        "sala_experimento": "Bancada & Maquete 3D",
        "estudio_apresentador": "Estúdio Apresentador 3D",
    }
    for mp4 in sorted(RENDERS_DIR.glob("*.mp4"), key=lambda p: p.stat().st_mtime, reverse=True):
        stat = mp4.stat()
        stem = mp4.stem
        sidecar = RENDERS_DIR / f"{stem}.project.json"
        proj_data = None
        if sidecar.exists():
            try:
                proj_data = json.loads(sidecar.read_text(encoding="utf-8"))
            except Exception:
                proj_data = None

        aspect = "16:9"
        model_label = "Animação 3D"
        if proj_data:
            aspect = proj_data.get("aspectRatio", "16:9")
            model_label = model_names.get(proj_data.get("modelId", ""), "Animação 3D")
        elif "data_critica" in stem:
            aspect = "16:9"
            model_label = "Fluxo entre Setores 3D"
        elif "micro-ondas" in stem or "ar-condicionado" in stem or "reel" in stem:
            aspect = "9:16"
            model_label = "Sala & Bancada 3D"

        videos.append(
            {
                "filename": mp4.name,
                "title": (proj_data.get("name") if proj_data else stem.replace("_", " ").replace("-", " ").title()),
                "videoUrl": f"/renders/{mp4.name}",
                "sizeMb": round(stat.st_size / (1024 * 1024), 2),
                "updatedAt": datetime.fromtimestamp(stat.st_mtime).strftime("%d/%m/%Y %H:%M"),
                "aspectRatio": aspect,
                "modelLabel": model_label,
                "project": proj_data,
            }
        )
    return web.json_response({"ok": True, "videos": videos})


def create_app() -> web.Application:
    app = web.Application(middlewares=[cors_middleware], client_max_size=32 * 1024 * 1024)
    app.router.add_get("/api/health", handle_health)
    app.router.add_get("/api/youtube/radar", handle_youtube_radar)
    app.router.add_post("/api/youtube/channels/add", handle_youtube_add_channel)
    app.router.add_post("/api/youtube/channels/remove", handle_youtube_remove_channel)
    app.router.add_post("/api/youtube/refresh", handle_youtube_refresh)
    app.router.add_post("/api/youtube/daily-themes", handle_youtube_daily_themes)
    app.router.add_post("/api/voice/preview", handle_voice_preview)
    app.router.add_post("/api/ai/generate", handle_ai_generate)
    app.router.add_post("/api/ai/resize", handle_ai_resize)
    app.router.add_post("/api/ai/refine-script", handle_ai_refine_script)
    app.router.add_post("/api/project/tts", handle_project_tts)
    app.router.add_post("/api/project/save", handle_project_save)
    app.router.add_get("/api/projects", handle_projects_list)
    app.router.add_get("/api/knowledge/preferences", handle_knowledge_preferences)
    app.router.add_post("/api/knowledge/choose-model", handle_knowledge_choose_model)
    app.router.add_post("/api/render/start", handle_render_start)
    app.router.add_get("/api/render/status/{job_id}", handle_render_status)
    app.router.add_get("/api/gallery", handle_gallery)

    app.router.add_static("/renders/", path=str(RENDERS_DIR), show_index=False)
    app.router.add_static("/studio_projects/", path=str(PROJECTS_DIR), show_index=False)
    return app


if __name__ == "__main__":
    port = int(os.environ.get("STUDIO_API_PORT", "8787"))
    print(f"[Desmontando Studio 3D] API iniciada em http://127.0.0.1:{port}")
    web.run_app(create_app(), host="127.0.0.1", port=port, print=None)
