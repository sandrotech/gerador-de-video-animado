import asyncio
import json
import math
import re
import subprocess
import wave
from pathlib import Path
import edge_tts
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
ASSET_DIR = ROOT / "public" / "assets" / "stech-automacao"
ASSET_DIR.mkdir(parents=True, exist_ok=True)
WORDS_TS = ROOT / "src" / "shots" / "G1" / "stechWords.ts"

FPS = 30

SCRIPT_SEGMENTS = [
    # Ato 1 (0s-12s): Dor -> Contraste -> Transformacao -> Stech Solucoes
    "O problema do seu restaurante talvez não seja falta de clientes, mas na maneira como você administra cada pedido. "
    "Enquanto um depende de papel e memória, o outro conecta pedidos, cozinha e caixa. "
    "É por isso que a Stech desenvolve sistemas sob medida para melhorar o funcionamento da sua empresa. ",
    # Ato 2: Recebimento (Manual vs Entrada Centralizada)
    "No modelo manual, o garçom anota no papel, leva até o balcão, e qualquer detalhe esquecido vira pedido trocado. "
    "Com a automação, o pedido é lançado no celular ou no terminal e entra organizado em uma fila central, sem papel acumulado. ",
    # Ato 3: Cozinha (Comanda perdida vs Tela KDS)
    "Na cozinha, comanda de papel se perde, mancha e atrasa o preparo. "
    "No sistema da Stech, cada pedido aparece na hora na tela da cozinha, com ordem de chegada, observações e tempo de preparo em destaque. ",
    # Ato 4: Atendimento & Comunicacao entre equipes
    "Quando o cliente pergunta se o prato está pronto, ninguém precisa correr atrás da cozinha. "
    "A equipe acompanha o status em tempo real e entrega na hora certa, com salão e balcão falando a mesma língua. ",
    # Ato 5: Gestao, Relatorios e Indicadores
    "E na hora de fechar o dia, nada de somar papel por papel no caderno. "
    "O painel de gestão reúne pedidos, controle de estoque e relatórios completos de vendas para você decidir com clareza. ",
    # Ato 6: Resultado & CTA Stech Solucoes
    "Do pedido na mesa ao controle do caixa, tudo funciona integrado e sem retrabalho. "
    "Quer organizar os processos da sua empresa e trabalhar com mais eficiência? "
    "Fale com a Stech. Criamos sistemas sob medida para o seu negócio.",
]

FULL_TEXT = "".join(SCRIPT_SEGMENTS)


async def generate_tts():
    mp3_path = ASSET_DIR / "narration_tts_raw.mp3"
    communicate = edge_tts.Communicate(
        FULL_TEXT, voice="pt-BR-AntonioNeural", rate="+18%", boundary="WordBoundary"
    )
    words_meta = []

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
                        "start": round(offset_sec, 3),
                        "end": round(offset_sec + dur_sec, 3),
                    }
                )

    wav_pre = ASSET_DIR / "narration_pre.wav"
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(mp3_path),
            "-af",
            "highpass=f=75,acompressor=threshold=-18dB:ratio=2.2:attack=10:release=120",
            "-ar",
            "44100",
            "-ac",
            "2",
            "-c:a",
            "pcm_s16le",
            str(wav_pre),
        ],
        check=True,
    )

    # Masterizacao loudnorm em DOIS PASSES (Broadcast -14 LUFS)
    pass1 = subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(wav_pre),
            "-af",
            "loudnorm=I=-14:TP=-1.5:LRA=9:print_format=json",
            "-f",
            "null",
            "-",
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    m = re.search(r"\{[\s\S]*?\}", pass1.stderr)
    if not m:
        raise RuntimeError(f"Falha ao ler JSON do loudnorm pass 1: {pass1.stderr}")
    stats = json.loads(m.group(0))
    print(f"Loudnorm Pass 1 -> input_i={stats['input_i']}, input_tp={stats['input_tp']}, offset={stats['target_offset']}")

    wav_norm = ASSET_DIR / "narration_norm_2pass.wav"
    af_pass2 = (
        f"loudnorm=I=-14:TP=-1.5:LRA=9:linear=true:"
        f"measured_I={stats['input_i']}:measured_TP={stats['input_tp']}:"
        f"measured_LRA={stats['input_lra']}:measured_thresh={stats['input_thresh']}:"
        f"offset={stats['target_offset']}"
    )
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(wav_pre),
            "-af",
            af_pass2,
            "-ar",
            "44100",
            "-ac",
            "2",
            "-c:a",
            "pcm_s16le",
            str(wav_norm),
        ],
        check=True,
    )
    wav_pre.unlink(missing_ok=True)
    return wav_norm, words_meta


def make_whoosh(sr: int, dur=0.28, vol=0.12) -> np.ndarray:
    n = int(sr * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    rng = np.random.default_rng(101)
    noise = rng.normal(0, 1, n)
    smooth = np.convolve(noise, np.ones(46) / 46, mode="same")
    env = np.sin(np.pi * t / dur) ** 1.6
    sig = smooth * env * vol
    return np.column_stack([sig, sig])


def make_pop(sr: int, f0=220.0, f1=580.0, dur=0.085, vol=0.16) -> np.ndarray:
    n = int(sr * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    freq = np.linspace(f0, f1, n)
    phase = 2 * np.pi * np.cumsum(freq) / sr
    env = np.exp(-t * 28.0) * np.sin(np.pi * t / dur)
    sig = np.sin(phase) * env * vol
    return np.column_stack([sig, sig])


def make_kds_beep(sr: int, dur=0.11, vol=0.14) -> np.ndarray:
    """Bip digital suave de novo pedido entrando na tela KDS."""
    n = int(sr * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    env = np.sin(np.pi * t / dur) * np.exp(-t * 14.0)
    sig = (0.65 * np.sin(2 * np.pi * 1318.5 * t) + 0.35 * np.sin(2 * np.pi * 1975.5 * t)) * env * vol
    return np.column_stack([sig, sig])


def make_punch_boom(sr: int, dur=0.20, vol=0.15) -> np.ndarray:
    n = int(sr * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    freq = 140.0 * np.exp(-t * 14.0) + 48.0
    phase = 2 * np.pi * np.cumsum(freq) / sr
    env = np.exp(-t * 12.0)
    sig = np.sin(phase) * env * vol
    return np.column_stack([sig, sig])


def make_success_chime(sr: int, dur=1.1, vol=0.18) -> np.ndarray:
    n = int(sr * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    env = np.exp(-t * 3.8)
    sig = (
        0.5 * np.sin(2 * np.pi * 587.33 * t)
        + 0.42 * np.sin(2 * np.pi * 739.99 * t)
        + 0.38 * np.sin(2 * np.pi * 880.00 * t)
        + 0.30 * np.sin(2 * np.pi * 1174.66 * t)
    ) * env * vol
    return np.column_stack([sig, sig])


def add_sfx(buf: np.ndarray, sfx: np.ndarray, frame: int, sr: int):
    idx = int((frame / FPS) * sr)
    end = min(len(buf), idx + len(sfx))
    if 0 <= idx < len(buf) and end > idx:
        buf[idx:end] += sfx[: end - idx]


def main():
    wav_norm, words_meta = asyncio.run(generate_tts())

    with wave.open(str(wav_norm), "rb") as wf:
        sr = wf.getframerate()
        raw_bytes = wf.readframes(wf.getnframes())

    samples = np.frombuffer(raw_bytes, dtype=np.int16).astype(np.float32) / 32768.0
    samples = samples.reshape(-1, 2)

    pad = np.zeros((int(sr * 1.1), 2), dtype=np.float32)
    samples = np.vstack([samples, pad])

    total_sec = len(samples) / sr
    total_frames = int(math.ceil(total_sec * FPS))

    words_out = []
    for i, w in enumerate(words_meta):
        f_from = max(1, int(round(w["start"] * FPS)) + 1)
        if i + 1 < len(words_meta):
            next_from = max(f_from + 1, int(round(words_meta[i + 1]["start"] * FPS)))
            f_to = min(next_from, max(f_from + 1, int(round(w["end"] * FPS)) + 1))
        else:
            f_to = max(f_from + 2, int(round(w["end"] * FPS)) + 2)
        words_out.append({"text": w["text"], "from": f_from, "to": f_to})

    def find_word_frame(substr: str, after_frame=1, default_f=1) -> int:
        sub_l = substr.lower()
        for w in words_out:
            if w["from"] >= after_frame and sub_l in w["text"].lower():
                return w["from"]
        return default_f

    f_administra = find_word_frame("administra", 1, 90)
    f_conecta = find_word_frame("conecta", f_administra + 1, 180)
    f_stech_intro = find_word_frame("stech", f_conecta + 1, 250)
    f_recebimento = find_word_frame("manual", f_stech_intro + 1, 380)
    f_fila_central = find_word_frame("automação", f_recebimento + 1, 520)
    f_cozinha = find_word_frame("cozinha", f_fila_central + 1, 680)
    f_tela_kds = find_word_frame("sistema", f_cozinha + 1, 790)
    f_atendimento = find_word_frame("pergunta", f_tela_kds + 1, 960)
    f_tempo_real = find_word_frame("acompanha", f_atendimento + 1, 1080)
    f_gestao = find_word_frame("fechar", f_tempo_real + 1, 1240)
    f_painel_gestao = find_word_frame("painel", f_gestao + 1, 1360)
    f_resultado = find_word_frame("integrado", f_painel_gestao + 1, 1550)
    f_cta = find_word_frame("organizar", f_resultado + 1, 1650)

    cues = {
        "f_hook": 0,
        "f_administra": f_administra,
        "f_conecta": f_conecta,
        "f_stech_intro": f_stech_intro,
        "f_recebimento": f_recebimento,
        "f_fila_central": f_fila_central,
        "f_cozinha": f_cozinha,
        "f_tela_kds": f_tela_kds,
        "f_atendimento": f_atendimento,
        "f_tempo_real": f_tempo_real,
        "f_gestao": f_gestao,
        "f_painel_gestao": f_painel_gestao,
        "f_resultado": f_resultado,
        "f_cta": f_cta,
        "total_frames": total_frames,
    }

    # Mixar SFX exatos nos marcos visuais
    add_sfx(samples, make_whoosh(sr), 2, sr)
    add_sfx(samples, make_pop(sr, 210, 560), max(6, f_administra - 5), sr)
    add_sfx(samples, make_kds_beep(sr), f_conecta, sr)
    add_sfx(samples, make_punch_boom(sr), max(10, f_stech_intro - 4), sr)

    for wf in [f_recebimento, f_cozinha, f_atendimento, f_gestao, f_resultado]:
        add_sfx(samples, make_whoosh(sr, vol=0.10), max(1, wf - 8), sr)
    for pf in [f_fila_central, f_tela_kds, f_tempo_real, f_painel_gestao]:
        add_sfx(samples, make_kds_beep(sr), pf, sr)
    add_sfx(samples, make_success_chime(sr), f_cta, sr)

    # Soft headroom + limitacao transparente via FFmpeg (evita clipping flat-top detectado pelo raea check!)
    peak = float(np.max(np.abs(samples)))
    if peak > 0.85:
        samples = samples * (0.85 / peak)
    pcm = (samples * 32767.0).astype(np.int16)

    raw_mix = ASSET_DIR / "_mix_raw.wav"
    out_wav = ASSET_DIR / "master_audio_sfx.wav"
    with wave.open(str(raw_mix), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(pcm.tobytes())

    # Passagem final transparente de true-peak limiter (-1.5 dBTP) sem distorcao
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(raw_mix),
            "-af",
            "alimiter=limit=-1.5dB:attack=5:release=50:level=false",
            "-ar",
            "44100",
            "-ac",
            "2",
            "-c:a",
            "pcm_s16le",
            str(out_wav),
        ],
        check=True,
    )
    raw_mix.unlink(missing_ok=True)
    wav_norm.unlink(missing_ok=True)
    (ASSET_DIR / "narration_tts_raw.mp3").unlink(missing_ok=True)

    ts_lines = [
        "// Gerado automaticamente por build_stech_audio.py (Edge-TTS + 2-Pass Loudnorm + WordBoundary)",
        f"export const STECH_TOTAL_FRAMES = {total_frames};",
        f"export const STECH_CUES = {json.dumps(cues, indent=2)} as const;",
        f"export const STECH_WORDS: Array<{{text: string; from: number; to: number}}> = {json.dumps(words_out, ensure_ascii=False)};",
    ]
    WORDS_TS.write_text("\n".join(ts_lines), encoding="utf-8")

    print(f"OK! Stech Audio -> {total_frames} frames ({total_sec:.2f}s), {len(words_out)} words")
    print("STECH_CUES:", json.dumps(cues, indent=2))


if __name__ == "__main__":
    main()
