import asyncio
import json
import math
import subprocess
import wave
from pathlib import Path
import edge_tts
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
ASSET_DIR = ROOT / "public" / "assets" / "restaurante-contrast"
ASSET_DIR.mkdir(parents=True, exist_ok=True)
WORDS_TS = ROOT / "src" / "shots" / "G1" / "restauranteWords.ts"

FPS = 30

SCRIPT_SEGMENTS = [
    # Ato 1: Gancho & Contraste Inicial
    "Esses dois restaurantes servem o mesmo prato pelo mesmo preço na mesma rua! "
    "Só que o Restaurante da Dona Maria vive cheio, e o do Seu Zé passa a noite com mesa vazia! "
    "E a diferença começa antes mesmo do cliente sentar. ",
    # Ato 2: O Mapa / Google
    "O Seu Zé continua do jeito que abriu anos atrás. Já a Dona Maria estudou tudo e começou do zero. "
    "Primeiro, o mapa: olha o cliente procurando onde jantar! "
    "O Restaurante do Seu Zé aparece com horário errado, sem foto e sem telefone... está aberto? Ninguém sabe! "
    "A Dona Maria atualizou o perfil no Google: horário certo, foto dos pratos e botão de Rota. Um toque e o cliente já está a caminho! ",
    # Ato 3: Cardapio
    "Mas o cliente quer ver o cardápio antes: no do Seu Zé é um PDF pesado que demora para abrir e precisa de zoom. "
    "No da Dona Maria, o link abre na hora no celular com foto e preço de cada prato! ",
    # Ato 4: Avaliacoes
    "Agora as avaliações: o do Seu Zé tem nota baixa e nenhuma resposta, parece abandonado. "
    "A Dona Maria responde cada comentário, até o ruim, e o cliente confia! ",
    # Ato 5: Delivery, WhatsApp & Trafego Local
    "Só que tem dia que a gente prefere pedir em casa: o Seu Zé depende só do aplicativo e deixa parte do lucro em taxa. "
    "A Dona Maria tem pedido próprio pelo WhatsApp, com cupom para pedir de novo! "
    "Mas restaurante bom que ninguém vê fica vazio: ela posta o prato saindo na hora e anuncia para quem mora perto na hora do jantar. "
    "Enquanto o Seu Zé só espera o movimento aparecer... ",
    # Ato 6: 1 Ano Depois & CTA
    "Um ano depois, o Restaurante da Dona Maria tem fila na porta! "
    "E o Seu Zé colocou uma placa: Passa-se o Ponto. "
    "Mesmo prato, mesmo preço... só um foi encontrado. Quer que o seu seja o próximo? Chama a gente!",
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

    wav_raw = ASSET_DIR / "narration_tts_raw.wav"
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(mp3_path),
            "-af",
            "highpass=f=75,acompressor=threshold=-18dB:ratio=2.2:attack=10:release=120,loudnorm=I=-14:TP=-1.5:LRA=9",
            "-ar",
            "44100",
            "-ac",
            "2",
            "-c:a",
            "pcm_s16le",
            str(wav_raw),
        ],
        check=True,
    )
    return wav_raw, words_meta


def make_whoosh(sr: int, dur=0.28, vol=0.14) -> np.ndarray:
    n = int(sr * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    rng = np.random.default_rng(101)
    noise = rng.normal(0, 1, n)
    smooth = np.convolve(noise, np.ones(46) / 46, mode="same")
    env = np.sin(np.pi * t / dur) ** 1.6
    sig = smooth * env * vol
    return np.column_stack([sig, sig])


def make_pop(sr: int, f0=210.0, f1=560.0, dur=0.09, vol=0.18) -> np.ndarray:
    n = int(sr * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    freq = np.linspace(f0, f1, n)
    phase = 2 * np.pi * np.cumsum(freq) / sr
    env = np.exp(-t * 28.0) * np.sin(np.pi * t / dur)
    sig = np.sin(phase) * env * vol
    return np.column_stack([sig, sig])


def make_punch_boom(sr: int, dur=0.22, vol=0.16) -> np.ndarray:
    n = int(sr * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    freq = 140.0 * np.exp(-t * 14.0) + 48.0
    phase = 2 * np.pi * np.cumsum(freq) / sr
    env = np.exp(-t * 12.0)
    sig = np.sin(phase) * env * vol
    return np.column_stack([sig, sig])


def make_success_chime(sr: int, dur=1.1, vol=0.20) -> np.ndarray:
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
    wav_raw, words_meta = asyncio.run(generate_tts())

    with wave.open(str(wav_raw), "rb") as wf:
        sr = wf.getframerate()
        raw_bytes = wf.readframes(wf.getnframes())

    samples = np.frombuffer(raw_bytes, dtype=np.int16).astype(np.float32) / 32768.0
    samples = samples.reshape(-1, 2)

    # 1.0s extra no final
    pad = np.zeros((int(sr * 1.0), 2), dtype=np.float32)
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

    f_prato = find_word_frame("prato", 1, 35)
    f_preco = find_word_frame("preço", f_prato + 1, 60)
    f_maria_cheio = find_word_frame("maria", f_preco + 1, 110)
    f_ze_vazio = find_word_frame("zé", f_maria_cheio + 1, 160)
    f_mapa_search = find_word_frame("mapa", f_ze_vazio + 1, 450)
    f_ze_sem_foto = find_word_frame("errado", f_mapa_search + 1, 580)
    f_maria_rota = find_word_frame("atualizou", f_ze_sem_foto + 1, 720)
    f_cardapio_pdf = find_word_frame("cardápio", f_maria_rota + 1, 900)
    f_cardapio_mobile = find_word_frame("celular", f_cardapio_pdf + 1, 1080)
    f_avaliacoes = find_word_frame("avaliações", f_cardapio_mobile + 1, 1220)
    f_maria_responde = find_word_frame("responde", f_avaliacoes + 1, 1380)
    f_delivery_taxas = find_word_frame("aplicativo", f_maria_responde + 1, 1550)
    f_whatsapp_cupom = find_word_frame("whatsapp", f_delivery_taxas + 1, 1720)
    f_trafego_anuncio = find_word_frame("anuncia", f_whatsapp_cupom + 1, 1900)
    f_fila_maria = find_word_frame("fila", f_trafego_anuncio + 1, 2100)
    f_passa_ponto = find_word_frame("placa", f_fila_maria + 1, 2220)
    f_cta_final = find_word_frame("próximo", f_passa_ponto + 1, 2320)

    cues = {
        "f_hook": 0,
        "f_prato": f_prato,
        "f_preco": f_preco,
        "f_maria_cheio": f_maria_cheio,
        "f_ze_vazio": f_ze_vazio,
        "f_mapa_search": f_mapa_search,
        "f_ze_sem_foto": f_ze_sem_foto,
        "f_maria_rota": f_maria_rota,
        "f_cardapio_pdf": f_cardapio_pdf,
        "f_cardapio_mobile": f_cardapio_mobile,
        "f_avaliacoes": f_avaliacoes,
        "f_maria_responde": f_maria_responde,
        "f_delivery_taxas": f_delivery_taxas,
        "f_whatsapp_cupom": f_whatsapp_cupom,
        "f_trafego_anuncio": f_trafego_anuncio,
        "f_fila_maria": f_fila_maria,
        "f_passa_ponto": f_passa_ponto,
        "f_cta_final": f_cta_final,
        "total_frames": total_frames,
    }

    # Mixar SFX exatos nos frames das palavras-chave!
    add_sfx(samples, make_whoosh(sr, vol=0.12), 2, sr)
    add_sfx(samples, make_pop(sr, 210, 560, vol=0.16), max(4, f_prato - 2), sr)
    add_sfx(samples, make_pop(sr, 240, 610, vol=0.16), max(8, f_preco - 2), sr)
    add_sfx(samples, make_punch_boom(sr, vol=0.18), max(30, f_maria_cheio - 4), sr)

    for wf in [f_mapa_search, f_maria_rota, f_cardapio_pdf, f_avaliacoes, f_delivery_taxas, f_fila_maria]:
        add_sfx(samples, make_whoosh(sr, vol=0.11), max(1, wf - 8), sr)
    for pf in [f_ze_sem_foto, f_cardapio_mobile, f_maria_responde, f_whatsapp_cupom, f_trafego_anuncio, f_passa_ponto]:
        add_sfx(samples, make_pop(sr, 220, 580, vol=0.15), pf, sr)
    add_sfx(samples, make_success_chime(sr, vol=0.20), f_cta_final, sr)

    samples = np.clip(samples, -0.96, 0.96)
    pcm = (samples * 32767.0).astype(np.int16)

    out_wav = ASSET_DIR / "master_audio_sfx.wav"
    with wave.open(str(out_wav), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(pcm.tobytes())

    ts_lines = [
        "// Gerado automaticamente por build_restaurante_tts_audio.py (Edge-TTS + WordBoundary)",
        f"export const RESTAURANTE_TOTAL_FRAMES = {total_frames};",
        f"export const RESTAURANTE_CUES = {json.dumps(cues, indent=2)} as const;",
        f"export const RESTAURANTE_WORDS: Array<{{text: string; from: number; to: number}}> = {json.dumps(words_out, ensure_ascii=False)};",
    ]
    WORDS_TS.write_text("\n".join(ts_lines), encoding="utf-8")

    print(f"OK! Total frames: {total_frames} ({total_sec:.2f}s), {len(words_out)} words")
    print("CUES:", json.dumps(cues, indent=2))


if __name__ == "__main__":
    main()
