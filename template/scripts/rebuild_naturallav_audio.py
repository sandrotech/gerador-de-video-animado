import asyncio
import subprocess
import wave
from pathlib import Path
import edge_tts
import numpy as np

CLAUDE_BASE = Path(r"D:\Aplicações testes\editor videos\ClaudeAnimationBase")
TTS_DIR = CLAUDE_BASE / "assets" / "tts_parts"
TTS_DIR.mkdir(parents=True, exist_ok=True)

VIDEO_IN = CLAUDE_BASE / "out" / "natural_lav_tutorial.mp4"
BACKUP_VIDEO = CLAUDE_BASE / "out" / "natural_lav_tutorial_audio_antigo.mp4"
NARRATION_MP3 = CLAUDE_BASE / "assets" / "narration.mp3"
NARRATION_WAV = CLAUDE_BASE / "assets" / "narration.wav"

SR = 44100
DURATION_SEC = 24.0

# 6 segmentos sincronizados com os 6 shots de natural_lav_tutorial.js (0..24s)
SEGMENTS = [
    {
        "start": 0.10,
        "max_dur": 3.68,
        "text": "Bem-vindo à Natural Lav! Embaixo ficam as lavadoras, e em cima as secadoras.",
        "rate": "+8%",
    },
    {
        "start": 4.08,
        "max_dur": 3.72,
        "text": "Passo um: coloque a roupa na lavadora. Sabão e amaciante já estão inclusos!",
        "rate": "+8%",
    },
    {
        "start": 8.08,
        "max_dur": 5.15,
        "text": "Passo dois: na maquininha, escolha o número da máquina, cartão ou Pix, e aproxime para pagar.",
        "rate": "+6%",
    },
    {
        "start": 13.58,
        "max_dur": 3.22,
        "text": "Passo três: aperte iniciar no painel azul da máquina.",
        "rate": "+4%",
    },
    {
        "start": 17.08,
        "max_dur": 3.28,
        "text": "Passo quatro: passe a roupa para a secadora de cima e inicie.",
        "rate": "+6%",
    },
    {
        "start": 20.68,
        "max_dur": 3.05,
        "text": "Pronto! Roupas limpas, secas e cheirosas na Natural Lav!",
        "rate": "+6%",
    },
]


def trim_silence(arr: np.ndarray, thresh=0.008, pad_ms=35) -> np.ndarray:
    peak = np.abs(arr).max(axis=1)
    idx = np.where(peak > thresh)[0]
    if len(idx) == 0:
        return arr
    pad = int(SR * pad_ms / 1000.0)
    i0 = max(0, idx[0] - pad)
    i1 = min(len(arr), idx[-1] + pad)
    return arr[i0:i1]


async def synth_segment(idx: int, seg: dict) -> np.ndarray:
    mp3_path = TTS_DIR / f"seg_{idx}.mp3"
    wav_path = TTS_DIR / f"seg_{idx}.wav"

    # Voz feminina brasileira calma, acolhedora e simpática: pt-BR-FranciscaNeural
    comm = edge_tts.Communicate(
        seg["text"],
        voice="pt-BR-FranciscaNeural",
        rate=seg["rate"],
        pitch="+1Hz",
    )
    await comm.save(str(mp3_path))

    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(mp3_path),
            "-ar",
            str(SR),
            "-ac",
            "2",
            str(wav_path),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    with wave.open(str(wav_path), "rb") as wf:
        raw = wf.readframes(wf.getnframes())
    arr = np.frombuffer(raw, dtype=np.int16).astype(np.float32).reshape(-1, 2) / 32768.0
    arr = trim_silence(arr)

    # Salva o wav aparado para caso precise de ajuste fino de atempo
    with wave.open(str(wav_path), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes((arr * 32767.0).astype(np.int16).tobytes())

    dur = len(arr) / SR
    if dur > seg["max_dur"]:
        tempo = min(1.25, (dur / seg["max_dur"]) * 1.03)
        wav_fit = TTS_DIR / f"seg_{idx}_fit.wav"
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(wav_path),
                "-af",
                f"atempo={tempo:.3f}",
                "-ar",
                str(SR),
                "-ac",
                "2",
                str(wav_fit),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        with wave.open(str(wav_fit), "rb") as wf:
            arr = (
                np.frombuffer(wf.readframes(wf.getnframes()), dtype=np.int16)
                .astype(np.float32)
                .reshape(-1, 2)
                / 32768.0
            )
        arr = trim_silence(arr)
        wav_fit.unlink(missing_ok=True)
        dur = len(arr) / SR

    print(f"Segmento {idx} ({seg['start']:.2f}s..{seg['start']+dur:.2f}s / limite {seg['start']+seg['max_dur']:.2f}s): {seg['text']}")
    return arr


def make_whoosh(dur=0.25, vol=0.11) -> np.ndarray:
    n = int(SR * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    rng = np.random.default_rng(7)
    noise = rng.normal(0, 1, n)
    smooth = np.convolve(noise, np.ones(48) / 48, mode="same")
    env = np.sin(np.pi * t / dur) ** 1.7
    sig = smooth * env * vol
    return np.column_stack([sig, sig])


def make_pop(f0=210.0, f1=520.0, dur=0.085, vol=0.16) -> np.ndarray:
    n = int(SR * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    freq = np.linspace(f0, f1, n)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    env = np.exp(-t * 28.0) * np.sin(np.pi * t / dur)
    sig = np.sin(phase) * env * vol
    return np.column_stack([sig, sig])


def make_pos_beep(dur=0.16, vol=0.15) -> np.ndarray:
    """Bip suave de aprovação de pagamento por aproximação / Pix na maquininha"""
    n = int(SR * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    env = np.exp(-t * 10.0) * np.sin(np.pi * t / dur)
    sig = (np.sin(2 * np.pi * 1567.98 * t) + 0.4 * np.sin(2 * np.pi * 2349.32 * t)) * env * vol
    return np.column_stack([sig, sig])


def make_warm_chime(dur=1.1, vol=0.18) -> np.ndarray:
    """Acorde cristalino acolhedor no final (roupas limpas e cheirosas)"""
    n = int(SR * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    env = np.exp(-t * 3.5)
    sig = (
        0.5 * np.sin(2 * np.pi * 523.25 * t)
        + 0.4 * np.sin(2 * np.pi * 659.25 * t)
        + 0.35 * np.sin(2 * np.pi * 783.99 * t)
        + 0.25 * np.sin(2 * np.pi * 1046.50 * t)
    ) * env * vol
    return np.column_stack([sig, sig])


def add_at(buf: np.ndarray, clip: np.ndarray, sec: float):
    idx = int(round(sec * SR))
    end = min(len(buf), idx + len(clip))
    if 0 <= idx < len(buf) and end > idx:
        buf[idx:end] += clip[: end - idx]


async def main():
    total_samples = int(SR * DURATION_SEC)
    master = np.zeros((total_samples, 2), dtype=np.float32)

    # 1. Sintetiza e posiciona os 6 segmentos de voz feminina calma e simpática
    for idx, seg in enumerate(SEGMENTS):
        voice_arr = await synth_segment(idx, seg)
        add_at(master, voice_arr * 1.05, seg["start"])

    # 2. Adiciona os nossos efeitos sonoros procedurais suaves sincronizados às ações do vídeo:
    whoosh = make_whoosh()
    pop = make_pop()
    beep = make_pos_beep()
    chime = make_warm_chime()

    # Transições brush-wipe entre os 6 shots (4.0s, 8.0s, 13.5s, 17.0s, 20.6s)
    for wt in [3.92, 7.92, 13.42, 16.92, 20.52]:
        add_at(master, whoosh, wt)

    # Pop suave nos banners e badges de cada passo
    for pt in [0.10, 1.85, 4.10, 6.10, 8.10, 9.60, 13.60, 17.10, 20.70]:
        add_at(master, pop, pt)

    # Bip de pagamento aprovado na maquininha (12.1s) e toque no botão azul Iniciar (15.1s)
    add_at(master, beep, 12.15)
    add_at(master, make_pos_beep(dur=0.11, vol=0.12), 15.10)

    # Chime acolhedor final quando as roupas ficam prontas e cheirosas (20.75s)
    add_at(master, chime, 20.75)

    # Limitador suave para evitar qualquer clipagem
    master = np.tanh(master * 1.05) * 0.94

    with wave.open(str(NARRATION_WAV), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes((master * 32767.0).astype(np.int16).tobytes())

    # Salva também em assets/narration.mp3
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(NARRATION_WAV),
            "-c:a",
            "libmp3lame",
            "-b:a",
            "192k",
            str(NARRATION_MP3),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    # Faz backup do vídeo antigo se ainda não existir e substitui a faixa de áudio de natural_lav_tutorial.mp4
    if not BACKUP_VIDEO.exists():
        BACKUP_VIDEO.write_bytes(VIDEO_IN.read_bytes())

    tmp_out = CLAUDE_BASE / "out" / "_natural_lav_tutorial_new.mp4"
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(VIDEO_IN),
            "-i",
            str(NARRATION_WAV),
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
            str(tmp_out),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    tmp_out.replace(VIDEO_IN)
    print("Vídeo atualizado com sucesso em:", VIDEO_IN)


if __name__ == "__main__":
    asyncio.run(main())
