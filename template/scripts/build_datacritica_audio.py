import asyncio
import json
import math
import subprocess
import wave
from pathlib import Path
import edge_tts
import numpy as np

ROOT = Path(r"d:\Aplicações testes\editor videos\anything2explainer\template")
ASSET_DIR = ROOT / "public" / "assets" / "data-critica"
ASSET_DIR.mkdir(parents=True, exist_ok=True)
WORDS_TS = ROOT / "src" / "shots" / "G1" / "dataCriticaWords.ts"

FPS = 30

SCRIPT_SEGMENTS = [
    # Ato 1: O Problema na Prateleira (Tentativa antiga lenta -> risco de vencer na gôndola)
    "Quando um produto na prateleira do supermercado fica próximo do vencimento, anotar no papel ou avisar no grito demora demais e gera perda! "
    "Para resolver isso rápido, veja como funciona o Sistema de Data Crítica. ",
    # Ato 2: Etapa 1A - Responsável da Loja encontra o produto e bipa no celular
    "Tudo começa lá na seção da loja: o responsável encontra um produto próximo de vencer, abre o sistema no celular e bipa o código de barras! "
    "Na mesma hora, o aplicativo já puxa o nome e o preço atual do item. ",
    # Ato 3: Etapa 1B - Quantidade, Data de Vencimento, Foto e Envio para Compras
    "Ele só informa a quantidade na prateleira, coloca a data de vencimento, tira uma foto real do produto e envia! "
    "Instantaneamente, esse lançamento cai na tela do setor administrativo de Compras. ",
    # Ato 4: Etapa 2 - Setor Administrativo de Compras avalia e aprova a Rebaixa de Preço
    "Lá no setor de Compras, o comprador analisa a foto, a quantidade e os dias para vencer. "
    "Ele define a rebaixa de preço, por exemplo de doze e noventa para seis e noventa e nove, e lança de volta no sistema com o valor aprovado! ",
    # Ato 5: Etapa 3A - Setor Administrativo de Cadastro recebe e lança no RPInfo
    "Ao aprovar, o chamado avança direto para o setor administrativo de Cadastro! "
    "O Cadastro recebe a quantidade do produto em data crítica junto com o preço de rebaixa, e lança no sistema oficial da RPInfo o valor da rebaixa e a quantidade exata de etiquetas. ",
    # Ato 6: Etapa 3B - Baixa no Sistema de Data Crítica e Retorno para a Loja
    "Assim que lança no sistema da RPInfo, o Cadastro também dá baixa no Sistema de Data Crítica! "
    "Na hora, o lançamento volta para o celular do responsável lá na loja do supermercado. ",
    # Ato 7: Etapa 4 - Responsável da Loja verifica a etiqueta disponível e cola no produto rebaixado
    "O responsável da loja recebe o retorno, verifica se as etiquetas liberadas já estão disponíveis na fila da loja e cola a nova etiqueta em cada produto com o valor já rebaixado! ",
    # Ato 8: Fechamento Geral (Passa no caixa com desconto, zero quebra + Frase Clássica)
    "Assim o produto vende rápido no caixa com o preço certo e a loja evita desperdício! "
    "Pronto! Agora você sabe como funciona o Sistema de Data Crítica!",
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


def make_whoosh(sr: int, dur=0.28, vol=0.14) -> np.ndarray:
    n = int(sr * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    rng = np.random.default_rng(101)
    noise = rng.normal(0, 1, n)
    smooth = np.convolve(noise, np.ones(46) / 46, mode="same")
    env = np.sin(np.pi * t / dur) ** 1.6
    sig = smooth * env * vol
    return np.column_stack([sig, sig])


def make_pop(sr: int, f0=195.0, f1=540.0, dur=0.09, vol=0.20) -> np.ndarray:
    n = int(sr * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    freq = np.linspace(f0, f1, n)
    phase = 2 * np.pi * np.cumsum(freq) / sr
    env = np.exp(-t * 28.0) * np.sin(np.pi * t / dur)
    sig = np.sin(phase) * env * vol
    return np.column_stack([sig, sig])


def make_scanner_beep(sr: int, dur=0.12, vol=0.22) -> np.ndarray:
    """Bip clássico de leitor de código de barras (2650 Hz)"""
    n = int(sr * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    env = np.ones(n)
    fade = int(sr * 0.012)
    env[:fade] = np.linspace(0, 1, fade)
    env[-fade:] = np.linspace(1, 0, fade)
    sig = np.sin(2 * np.pi * 2650.0 * t) * env * vol
    return np.column_stack([sig, sig])


def make_shutter(sr: int, dur=0.11, vol=0.22) -> np.ndarray:
    """Clique de câmera fotográfica do celular"""
    n = int(sr * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    rng = np.random.default_rng(77)
    click1 = rng.normal(0, 1, n) * np.exp(-t * 75.0)
    click2 = np.roll(click1, int(sr * 0.038)) * 0.7
    sig = (click1 + click2) * vol
    return np.column_stack([sig, sig])


def make_success_chime(sr: int, dur=1.2, vol=0.24) -> np.ndarray:
    """Acorde brilhante de conclusão / aprovação"""
    n = int(sr * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    env = np.exp(-t * 3.6)
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

    # 1.0s extra no final para o encerramento respirar
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
        words_out.append({"text": w["text"], "from": f_from, "to": f_to, "start": w["start"]})

    def find_word_frame(substr: str, after_frame=1) -> int:
        s_low = substr.lower()
        for w in words_out:
            if w["from"] >= after_frame and s_low in w["text"].lower():
                return w["from"]
        return after_frame + 60

    f_perda = find_word_frame("perda", 1)
    f_secao = find_word_frame("seção", f_perda)
    f_celular = find_word_frame("celular", f_secao)
    f_bipa = find_word_frame("bipa", f_celular)
    f_quantidade = find_word_frame("quantidade", f_bipa)
    f_vencimento = find_word_frame("vencimento", f_quantidade)
    f_foto = find_word_frame("foto", f_vencimento)
    f_envia = find_word_frame("envia", f_foto)
    f_compras = find_word_frame("Compras", f_envia)
    f_rebaixa = find_word_frame("rebaixa", f_compras + 20)
    f_aprovado = find_word_frame("aprovado", f_rebaixa)
    f_cadastro = find_word_frame("Cadastro", f_aprovado)
    f_rpinfo = find_word_frame("RPInfo", f_cadastro + 20)
    f_etiquetas_cad = find_word_frame("etiquetas", f_rpinfo)
    f_baixa = find_word_frame("baixa", f_etiquetas_cad)
    f_volta = find_word_frame("volta", f_baixa)
    f_disponiveis = find_word_frame("disponíveis", f_volta)
    f_cola = find_word_frame("cola", f_disponiveis)
    f_caixa = find_word_frame("caixa", f_cola)
    f_pronto = find_word_frame("Pronto", f_caixa)

    cues = {
        "f_perda": f_perda,
        "f_secao": f_secao,
        "f_celular": f_celular,
        "f_bipa": f_bipa,
        "f_quantidade": f_quantidade,
        "f_vencimento": f_vencimento,
        "f_foto": f_foto,
        "f_envia": f_envia,
        "f_compras": f_compras,
        "f_rebaixa": f_rebaixa,
        "f_aprovado": f_aprovado,
        "f_cadastro": f_cadastro,
        "f_rpinfo": f_rpinfo,
        "f_etiquetas_cad": f_etiquetas_cad,
        "f_baixa": f_baixa,
        "f_volta": f_volta,
        "f_disponiveis": f_disponiveis,
        "f_cola": f_cola,
        "f_caixa": f_caixa,
        "f_pronto": f_pronto,
        "total_frames": total_frames,
    }
    print("Marcos Data Crítica (frames @ 30fps):", json.dumps(cues, indent=2))

    # Mixa efeitos sonoros sincronizados aos marcos reais da fala
    whoosh = make_whoosh(sr)
    pop = make_pop(sr)
    beep = make_scanner_beep(sr)
    shutter = make_shutter(sr)
    chime = make_success_chime(sr)

    # Bip do código de barras ao bipar no celular e ao passar no caixa no final
    add_sfx(samples, beep, f_bipa, sr)
    add_sfx(samples, beep, f_caixa, sr)

    # Clique de foto ao fotografar o produto
    add_sfx(samples, shutter, f_foto, sr)

    # Whoosh nas transições de câmera entre os setores (Loja -> Compras -> Cadastro -> Loja -> Geral)
    for wf in [f_secao - 8, f_envia + 4, f_aprovado + 8, f_volta - 4, f_caixa - 10]:
        add_sfx(samples, whoosh, wf, sr)

    # Pop nos badges de dados (quantidade, validade, rebaixa, RPInfo, baixa, etiquetas)
    for pf in [12, f_perda, f_celular, f_quantidade, f_vencimento, f_rebaixa, f_aprovado, f_rpinfo, f_baixa, f_disponiveis, f_cola]:
        add_sfx(samples, pop, pf, sr)

    # Chime de conclusão no "Pronto!"
    add_sfx(samples, chime, f_pronto, sr)

    samples = np.clip(samples, -0.98, 0.98)
    out_wav = ASSET_DIR / "audio.wav"
    with wave.open(str(out_wav), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes((samples * 32767.0).astype(np.int16).tobytes())

    ts_lines = [
        "// Gerado automaticamente por build_datacritica_audio.py",
        f"export const DATACRITICA_TOTAL_FRAMES = {total_frames};",
        f"export const DATACRITICA_CUES = {json.dumps(cues, indent=2)} as const;",
        "export const DATACRITICA_WORDS: Array<{text: string; from: number; to: number}> = [",
    ]
    for w in words_out:
        ts_lines.append(f"  {{text: {json.dumps(w['text'], ensure_ascii=False)}, from: {w['from']}, to: {w['to']}}},")
    ts_lines.append("];\n")

    WORDS_TS.write_text("\n".join(ts_lines), encoding="utf-8")
    print(f"Áudio Data Crítica salvo em {out_wav} ({total_sec:.2f}s / {total_frames} frames)")


if __name__ == "__main__":
    main()

