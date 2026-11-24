import asyncio
import json
import math
import subprocess
import wave
from pathlib import Path
import edge_tts
import numpy as np

ROOT = Path(r"d:\Aplicações testes\editor videos\anything2explainer\template")
ASSET_DIR = ROOT / "public" / "assets" / "micro-ondas"
ASSET_DIR.mkdir(parents=True, exist_ok=True)
WORDS_TS = ROOT / "src" / "shots" / "G1" / "microwaveWords.ts"

FPS = 30

SCRIPT_SEGMENTS = [
    # Ato 1: Tentativa ingênua que falha (Maçarico/fogo queima por fora e deixa congelado no meio)
    "Se você tentar esquentar uma comida gelada só com fogo ou um maçarico, o calor vem de fora pra dentro. "
    "Em dois minutos, ela queima toda por fora, mas o meio continua congelado! ",
    # Ato 2: O segredo invisível (Moléculas de água + Magnetron)
    "Para esquentar tudo de uma vez, precisamos agitar a água que já está dentro da comida! "
    "E fazemos isso usando uma peça chamada magnetron, que dispara ondas de rádio invisíveis. ",
    # Ato 3: Como a onda esquenta sem fogo (Atrito de 2 bilhões de vezes por segundo)
    "Essas ondas mudam de lado dois bilhões de vezes por segundo! "
    "As moléculas de água giram feito loucas, batendo umas nas outras. "
    "É esse atrito, igual esfregar as mãos no frio, que gera calor instantâneo! ",
    # Ato 4: Caixa metálica espelhada
    "Mas se o magnetron ficar aberto na mesa, as ondas escapam pela sala! "
    "Por isso, colocamos uma caixa de metal ao redor, que funciona como um espelho e rebate as ondas para a comida. ",
    # Ato 5: Pontos frios e Prato Giratório
    "Só que as ondas rebatidas criam pontos quentes e pontos frios parados no ar. "
    "Para resolver, um motorzinho gira um prato de vidro, fazendo a comida passear pelas ondas para esquentar por igual! ",
    # Ato 6: Porta com tela furadinha (Gaiola de Faraday vs Luz visível)
    "E para enxergar lá dentro com segurança, a porta leva uma chapa de metal toda furadinha. "
    "A onda tem doze centímetros e bate na grade sem passar, mas a luz é minúscula e passa pelos furinhos! ",
    # Ato 7: Por que o prato não esquenta + Controle de Potência
    "Como o vidro e a louça quase não têm água, as ondas passam direto sem esquentar o prato! "
    "Já o botão de potência só liga e desliga o magnetron em pausas, pro calor espalhar devagar. ",
    # Ato 8: Fechamento na carenagem final + Sininho clássico
    "Agora é só fechar na carcaça branca com luz interna, painel digital e aquele sininho clássico no final. "
    "Pronto! Agora você sabe como montar um micro-ondas!",
]

FULL_TEXT = "".join(SCRIPT_SEGMENTS)


async def generate_tts():
    mp3_path = ASSET_DIR / "narration_raw.mp3"
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

    wav_raw = ASSET_DIR / "narration_raw.wav"
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(mp3_path),
            "-ar",
            "44100",
            "-ac",
            "2",
            str(wav_raw),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return wav_raw, words_meta


def make_whoosh(sr: int, dur=0.26, vol=0.14) -> np.ndarray:
    n = int(sr * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    rng = np.random.default_rng(42)
    noise = rng.normal(0, 1, n)
    # Filtro passa-baixa móvel simples
    win = 45
    smooth = np.convolve(noise, np.ones(win) / win, mode="same")
    env = np.sin(np.pi * t / dur) ** 1.6
    sig = smooth * env * vol
    return np.column_stack([sig, sig])


def make_pop(sr: int, f0=190.0, f1=540.0, dur=0.09, vol=0.22) -> np.ndarray:
    n = int(sr * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    freq = np.linspace(f0, f1, n)
    phase = 2 * np.pi * np.cumsum(freq) / sr
    env = np.exp(-t * 28.0) * np.sin(np.pi * t / dur)
    sig = np.sin(phase) * env * vol
    return np.column_stack([sig, sig])


def make_ding(sr: int, dur=1.25, vol=0.26) -> np.ndarray:
    """Sininho clássico de micro-ondas (harmônicos metálicos em 2093 Hz + 4186 Hz)"""
    n = int(sr * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    env1 = np.exp(-t * 3.8)
    env2 = np.exp(-t * 8.5)
    sig = (np.sin(2 * np.pi * 2093.0 * t) * env1 + 0.45 * np.sin(2 * np.pi * 4186.0 * t) * env2) * vol
    return np.column_stack([sig, sig])


def make_hum(sr: int, dur=0.55, vol=0.09) -> np.ndarray:
    """Pulso suave de magnetron / ondas eletromagnéticas"""
    n = int(sr * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    env = np.sin(np.pi * t / dur)
    sig = (np.sin(2 * np.pi * 120.0 * t) + 0.5 * np.sin(2 * np.pi * 240.0 * t)) * env * vol
    return np.column_stack([sig, sig])


def add_sfx(buf: np.ndarray, sfx: np.ndarray, frame: int, sr: int):
    idx = int((frame / FPS) * sr)
    end = min(len(buf), idx + len(sfx))
    if idx >= 0 and idx < len(buf) and end > idx:
        buf[idx:end] += sfx[: end - idx]


def main():
    wav_raw, words_meta = asyncio.run(generate_tts())

    with wave.open(str(wav_raw), "rb") as wf:
        sr = wf.getframerate()
        n_frames = wf.getnframes()
        raw_bytes = wf.readframes(n_frames)

    samples = np.frombuffer(raw_bytes, dtype=np.int16).astype(np.float32) / 32768.0
    samples = samples.reshape(-1, 2)

    # Adiciona 1.0s de folga no final para o DING! e encerramento
    pad = np.zeros((int(sr * 1.0), 2), dtype=np.float32)
    samples = np.vstack([samples, pad])

    total_sec = len(samples) / sr
    total_frames = int(math.ceil(total_sec * FPS))

    # Converte words_meta para frames (from / to) e encontra marcos das cenas pelas palavras!
    words_out = []
    for i, w in enumerate(words_meta):
        f_from = max(1, int(round(w["start"] * FPS)) + 1)
        if i + 1 < len(words_meta):
            next_from = max(f_from + 1, int(round(words_meta[i + 1]["start"] * FPS)))
            f_to = min(next_from, max(f_from + 1, int(round(w["end"] * FPS)) + 1))
        else:
            f_to = max(f_from + 2, int(round(w["end"] * FPS)) + 2)
        words_out.append({"text": w["text"], "from": f_from, "to": f_to, "start": w["start"]})

    def find_word_frame(substr: str, after_frame=1) -> int:
        s_low = substr.lower()
        for w in words_out:
            if w["from"] >= after_frame and s_low in w["text"].lower():
                return w["from"]
        return after_frame + 90

    f_macarico = find_word_frame("maçarico", 1)
    f_queima = find_word_frame("queima", f_macarico)
    f_congelado = find_word_frame("congelado", f_queima)
    f_agua = find_word_frame("água", f_congelado)
    f_magnetron = find_word_frame("magnetron", f_agua)
    f_bilhoes = find_word_frame("bilhões", f_magnetron)
    f_atrito = find_word_frame("atrito", f_bilhoes)
    f_escapam = find_word_frame("escapam", f_atrito)
    f_caixa = find_word_frame("caixa", f_escapam)
    f_pontos = find_word_frame("pontos", f_caixa)
    f_prato = find_word_frame("giratório", f_pontos)
    f_porta = find_word_frame("porta", f_prato)
    f_doze = find_word_frame("doze", f_porta)
    f_vidro = find_word_frame("vidro", f_doze)
    f_potencia = find_word_frame("potência", f_vidro)
    f_carcaca = find_word_frame("carcaça", f_potencia)
    f_sininho = find_word_frame("sininho", f_carcaca)
    f_pronto = find_word_frame("Pronto", f_sininho)

    cues = {
        "f_macarico": f_macarico,
        "f_queima": f_queima,
        "f_congelado": f_congelado,
        "f_agua": f_agua,
        "f_magnetron": f_magnetron,
        "f_bilhoes": f_bilhoes,
        "f_atrito": f_atrito,
        "f_escapam": f_escapam,
        "f_caixa": f_caixa,
        "f_pontos": f_pontos,
        "f_prato": f_prato,
        "f_porta": f_porta,
        "f_doze": f_doze,
        "f_vidro": f_vidro,
        "f_potencia": f_potencia,
        "f_carcaca": f_carcaca,
        "f_sininho": f_sininho,
        "f_pronto": f_pronto,
        "total_frames": total_frames,
    }
    print("Marcos de cena (frames @ 30fps):", json.dumps(cues, indent=2))

    # Mixa SFX procedurais sincronizados com os marcos
    whoosh = make_whoosh(sr)
    pop = make_pop(sr)
    hum = make_hum(sr)
    ding = make_ding(sr)

    for pf in [15, f_macarico, f_congelado, f_magnetron, f_atrito, f_caixa, f_prato, f_porta, f_potencia, f_carcaca]:
        add_sfx(samples, pop, pf, sr)

    for wf in [f_agua - 8, f_magnetron - 6, f_escapam - 6, f_pontos - 6, f_porta - 8, f_vidro - 6, f_carcaca - 8]:
        add_sfx(samples, whoosh, wf, sr)

    for hf in [f_magnetron + 10, f_bilhoes, f_caixa + 15]:
        add_sfx(samples, hum, hf, sr)

    add_sfx(samples, ding, f_sininho, sr)
    add_sfx(samples, ding, f_pronto, sr)

    samples = np.clip(samples, -0.98, 0.98)
    out_wav = ASSET_DIR / "audio.wav"
    with wave.open(str(out_wav), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes((samples * 32767.0).astype(np.int16).tobytes())

    # Salva arquivo TypeScript com WORDS e CUES do Micro-ondas
    ts_lines = [
        "// Gerado automaticamente por build_microwave_audio.py",
        f"export const MICROWAVE_TOTAL_FRAMES = {total_frames};",
        f"export const MICROWAVE_CUES = {json.dumps(cues, indent=2)} as const;",
        "export const MICROWAVE_WORDS: Array<{text: string; from: number; to: number}> = [",
    ]
    for w in words_out:
        ts_lines.append(f"  {{text: {json.dumps(w['text'], ensure_ascii=False)}, from: {w['from']}, to: {w['to']}}},")
    ts_lines.append("];\n")

    WORDS_TS.write_text("\n".join(ts_lines), encoding="utf-8")
    print(f"Áudio mixado salvo em {out_wav} ({total_sec:.2f}s / {total_frames} frames)")
    print(f"Palavras e marcos salvos em {WORDS_TS}")


if __name__ == "__main__":
    main()
