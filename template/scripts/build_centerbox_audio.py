"""
Gerador de Audio Oficial para o Video 3D:
Portal de Antecipacao de Titulos — Grupo Centerbox (YouTube 16:9).

Usa exatamente o locutor do video de Data Critica: `pt-BR-AntonioNeural` (edge-tts),
com pausas naturais entre frases e atos, trilha corporate suave com ducking,
SFX limpos e masterizacao 2-pass loudnorm (-14 LUFS, TP=-2.0 dBTP).
Gera:
  - template/public/assets/centerbox-antecipacao/master_audio_sfx.wav
  - template/src/shots/G1/centerboxWords.ts
"""
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
ASSET_DIR = TEMPLATE_DIR / "public" / "assets" / "centerbox-antecipacao"
ASSET_DIR.mkdir(parents=True, exist_ok=True)
WORDS_TS = TEMPLATE_DIR / "src" / "shots" / "G1" / "centerboxWords.ts"

FPS = 30
SR = 44100
VOICE = "pt-BR-AntonioNeural"
RATE = "+4%"

SEGMENTS = [
    (
        "ato1",
        "Hoje, mais de trinta e dois milhões de reais em antecipações passavam por uma empresa intermediária. "
        "Nessa operação, a intermediária ficava com zero vírgula setenta e cinco por cento, e o Grupo Centerbox recebia dois vírgula setenta e cinco por cento.",
        1.4,
    ),
    (
        "ato2",
        "Para mudar isso, o setor de TI do Grupo Centerbox desenvolveu o Portal de Antecipação de Títulos próprio. "
        "Graças ao sistema criado pela TI, o grupo elimina a intermediária e passa a ganhar os três por cento livres, "
        "gerando uma grande economia.",
        1.4,
    ),
    (
        "ato3",
        "Na prática, é simples: o fornecedor acessa o portal, escolhe os títulos que tem a receber — "
        "como vinte e três mil, quinhentos e oitenta e um reais e vinte e oito centavos — "
        "confere na hora o valor líquido de vinte e um mil, oitocentos e quarenta e quatro reais e oitenta e sete centavos, e assina eletronicamente.",
        1.4,
    ),
    (
        "ato4",
        "Na mesma tela, o financeiro analisa títulos, débito, limite e histórico do fornecedor. "
        "Pode aprovar, negociar ou reprovar, "
        "enquanto o núcleo único do portal reconfere o saldo e registra tudo em trilha de auditoria.",
        1.4,
    ),
    (
        "ato5",
        "Do pedido à liquidação, tudo organizado, transparente e cem por cento rentável. "
        "Portal de Antecipação de Títulos, Grupo Centerbox.",
        0.0,
    ),
]


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


async def synth_phrase(phrase: str, out_mp3: Path, out_wav: Path):
    communicate = edge_tts.Communicate(phrase, voice=VOICE, rate=RATE, boundary="WordBoundary")
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


async def main_async():
    tmp_dir = ASSET_DIR / "_tmp_cb"
    tmp_dir.mkdir(exist_ok=True)

    parts = [np.zeros((int(0.25 * SR), 2), dtype=np.float32)]
    cur_sec = 0.25
    seg_starts = {}
    words_out = []

    for idx, (seg_id, text, pause_after) in enumerate(SEGMENTS):
        print(f"[TTS {idx+1}/{len(SEGMENTS)}] Gerando '{seg_id}' com {VOICE} ({RATE})...")
        seg_starts[seg_id] = int(round(cur_sec * FPS))
        phrases = [s.strip() for s in re.split(r"(?<=[.,;])\s+(?=\S)", text) if s.strip()]

        for pi, ph in enumerate(phrases):
            mp3_p = tmp_dir / f"{seg_id}_{pi}.mp3"
            wav_p = tmp_dir / f"{seg_id}_{pi}.wav"
            tts_ph = re.sub(r"\bTI\b", "Tê í", ph)
            arr, boundaries = await synth_phrase(tts_ph, mp3_p, wav_p)

            # Trim de silencio inicial/final mantendo margem natural
            mono = np.max(np.abs(arr), axis=1)
            nz = np.where(mono > 0.008)[0]
            trim_start_sec = 0.0
            if len(nz):
                i_start = max(0, int(nz[0]) - int(0.03 * SR))
                i_end = min(len(arr), int(nz[-1]) + int(0.08 * SR))
                trim_start_sec = i_start / SR
                arr = arr[i_start:i_end]

            ph_dur = len(arr) / SR
            tokens = ph.split()

            # Mesclar boundaries de "Tê" + "í" quando o token exibido for "TI"
            merged_bounds = []
            bi = 0
            for tok in tokens:
                clean_tok = re.sub(r"[^a-zA-Z0-9]", "", tok)
                if clean_tok == "TI" and bi + 1 < len(boundaries):
                    merged_bounds.append((tok, boundaries[bi][1], boundaries[bi + 1][2]))
                    bi += 2
                elif bi < len(boundaries):
                    merged_bounds.append(boundaries[bi])
                    bi += 1

            # Mapear WordBoundary para os tokens com pontuacao preservada
            if len(merged_bounds) == len(tokens):
                for tok, (_, b_start, b_end) in zip(tokens, merged_bounds):
                    w_start = max(0.0, b_start - trim_start_sec)
                    w_end = max(w_start + 0.08, b_end - trim_start_sec)
                    f_from = max(0, int(round((cur_sec + w_start) * FPS)))
                    f_to = max(f_from + 2, int(round((cur_sec + w_end) * FPS)))
                    words_out.append({"text": tok, "from": f_from, "to": f_to})
            else:
                weights = [max(2, len(re.sub(r"[^a-zA-Z0-9áéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]", "", tok))) + 1.5 for tok in tokens]
                total_w = sum(weights)
                t_pos = cur_sec
                for tok, w in zip(tokens, weights):
                    d_tok = ph_dur * (w / total_w)
                    f_from = max(0, int(round(t_pos * FPS)))
                    f_to = max(f_from + 2, int(round((t_pos + d_tok) * FPS)))
                    words_out.append({"text": tok, "from": f_from, "to": f_to})
                    t_pos += d_tok

            parts.append(arr)
            cur_sec += ph_dur

            if pi < len(phrases) - 1:
                gap = 0.60 if ph.endswith(".") else 0.28
                parts.append(np.zeros((int(gap * SR), 2), dtype=np.float32))
                cur_sec += gap

            mp3_p.unlink(missing_ok=True)
            wav_p.unlink(missing_ok=True)

        if pause_after > 0:
            parts.append(np.zeros((int(pause_after * SR), 2), dtype=np.float32))
            cur_sec += pause_after

    # Respiro final de 2.0s no encerramento
    parts.append(np.zeros((int(2.0 * SR), 2), dtype=np.float32))
    cur_sec += 2.0

    voice = np.vstack(parts)
    total_samples = len(voice)
    total_sec = total_samples / SR
    total_frames = int(math.ceil(total_sec * FPS))

    bed = make_bed(total_samples)
    venv = np.convolve(np.abs(voice[:, 0]), np.ones(int(0.18 * SR), dtype=np.float32) / int(0.18 * SR), mode="same")
    spk = np.clip((venv - 0.01) / 0.03, 0.0, 1.0)
    mix = voice * 0.88 + bed * (0.18 - 0.10 * spk)[:, None]

    add_sfx(mix, make_whoosh(), 2)
    add_sfx(mix, make_beep(880.0, 1318.5), seg_starts["ato2"])
    add_sfx(mix, make_whoosh(), seg_starts["ato3"])
    add_sfx(mix, make_beep(1046.5, 1567.98), seg_starts["ato4"])
    add_sfx(mix, make_chime(), seg_starts["ato5"])

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
    out_wav = ASSET_DIR / "master_audio_sfx.wav"
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", str(raw_mix), "-af", af2, "-ar", str(SR), "-ac", "2", "-c:a", "pcm_s16le", str(out_wav)],
        check=True,
    )
    raw_mix.unlink(missing_ok=True)
    tmp_dir.rmdir()

    cues = {
        "f_ato1": 0,
        "f_ato2": seg_starts["ato2"],
        "f_ato3": seg_starts["ato3"],
        "f_ato4": seg_starts["ato4"],
        "f_ato5": seg_starts["ato5"],
        "total_frames": total_frames,
    }

    WORDS_TS.write_text(
        "\n".join(
            [
                f"// Gerado automaticamente por build_centerbox_audio.py (edge-tts {VOICE})",
                f"export const CENTERBOX_TOTAL_FRAMES = {total_frames};",
                f"export const CENTERBOX_CUES = {json.dumps(cues, indent=2)} as const;",
                f"export const CENTERBOX_WORDS: Array<{{text: string; from: number; to: number}}> = {json.dumps(words_out, ensure_ascii=False)};",
            ]
        ),
        encoding="utf-8",
    )
    print(f"OK! Audio Centerbox ({VOICE}) -> {total_frames} frames ({total_sec:.2f}s), {len(words_out)} palavras")
    print("CUES:", json.dumps(cues, indent=2))


if __name__ == "__main__":
    asyncio.run(main_async())
