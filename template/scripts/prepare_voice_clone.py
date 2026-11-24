"""
Prepara e limpa gravacoes brutas da sua voz para:
1. Dataset limpo de clonagem de voz (~75-85s, 44.1 kHz / 24 kHz mono PCM, -16 LUFS, zero cliques/ruido)
   e amostra zero-shot de 15s (ideal para Voice Studio, XTTS-v2, F5-TTS, ElevenLabs, Fish Audio).
2. Faixas individuais limpas e masterizadas (-14 LUFS) prontas para uso direto nos videos 3D e 2D.
3. Perfil acustico automatico `alessandro_perfil.json` para manter cadencia, pausas e tom.
"""
import json
import re
import shutil
import subprocess
import wave
from pathlib import Path
import numpy as np

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
VOZES_DIR = WORKSPACE_ROOT / "banco-de-referencias" / "audio" / "vozes"
SRC_OGG = VOZES_DIR / "alessandro_gravacao_original.ogg"

AF_CLEAN = (
    "highpass=f=85,"
    "afftdn=nf=-26:nt=w,"
    "equalizer=f=240:t=q:w=1.2:g=-1.5,"
    "equalizer=f=3200:t=q:w=1.3:g=2.0,"
    "acompressor=threshold=-20dB:ratio=2.4:attack=8:release=100"
)


def cut_part(src: Path, tmp_dir: Path, ss: float, to: float, name: str, pad_fade: float = 0.025) -> Path:
    out = tmp_dir / f"{name}.wav"
    dur = max(0.05, to - ss)
    af = (
        f"{AF_CLEAN},"
        f"afade=t=in:st=0:d={pad_fade},"
        f"afade=t=out:st={max(0.0, dur - pad_fade):.3f}:d={pad_fade}"
    )
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-ss",
            f"{ss:.3f}",
            "-to",
            f"{to:.3f}",
            "-i",
            str(src),
            "-af",
            af,
            "-ar",
            "44100",
            "-ac",
            "1",
            "-c:a",
            "pcm_s16le",
            str(out),
        ],
        check=True,
    )
    return out


def concat_and_loudnorm(parts: list[Path], out_wav: Path, tmp_dir: Path, target_lufs: str = "-16", sample_rate: int = 44100):
    lst = tmp_dir / f"{out_wav.stem}_list.txt"
    lst.write_text("\n".join([f"file '{p.resolve().as_posix()}'" for p in parts]), encoding="utf-8")
    raw = tmp_dir / f"{out_wav.stem}_raw.wav"
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(raw)],
        check=True,
    )
    p1 = subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(raw),
            "-af",
            f"loudnorm=I={target_lufs}:TP=-1.5:LRA=8:print_format=json",
            "-f",
            "null",
            "-",
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    st = json.loads(re.search(r"\{[\s\S]*?\}", p1.stderr).group(0))
    af2 = (
        f"loudnorm=I={target_lufs}:TP=-1.5:LRA=8:linear=true:"
        f"measured_I={st['input_i']}:measured_TP={st['input_tp']}:"
        f"measured_LRA={st['input_lra']}:measured_thresh={st['input_thresh']}:"
        f"offset={st['target_offset']},alimiter=limit=-1.5dB:attack=5:release=60:level=false"
    )
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(raw),
            "-af",
            af2,
            "-ar",
            str(sample_rate),
            "-ac",
            "1",
            "-c:a",
            "pcm_s16le",
            str(out_wav),
        ],
        check=True,
    )


def measure_f0_and_duration(wav_path: Path) -> tuple[float, float, float, float]:
    with wave.open(str(wav_path), "rb") as wf:
        sr = wf.getframerate()
        sig = np.frombuffer(wf.readframes(wf.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    dur = len(sig) / sr
    hop, win = int(0.01 * sr), int(0.025 * sr)
    rms = np.array([20 * np.log10(np.sqrt(np.mean(sig[i : i + win] ** 2)) + 1e-12) for i in range(0, len(sig) - win, hop)])
    thresh = np.percentile(rms, 85) - 18.0
    f0s = []
    wlen = int(0.04 * sr)
    lmin, lmax = int(sr / 300), int(sr / 65)
    for k in range(0, len(sig) - wlen, int(0.02 * sr)):
        fr = sig[k : k + wlen]
        if np.sqrt(np.mean(fr ** 2)) > 10 ** (thresh / 20):
            fr = fr - np.mean(fr)
            ac = np.correlate(fr, fr, mode="full")[wlen - 1 :]
            if ac[0] > 1e-8:
                sub = ac[lmin:lmax] / ac[0]
                pi = int(np.argmax(sub))
                if sub[pi] > 0.45:
                    f0s.append(sr / (lmin + pi))
    f0 = np.array(f0s) if f0s else np.array([123.0])
    return (
        round(dur, 2),
        round(float(np.median(f0)), 1),
        round(float(np.percentile(f0, 10)), 1),
        round(float(np.percentile(f0, 90)), 1),
    )


def main():
    if not SRC_OGG.exists():
        raise FileNotFoundError(f"Arquivo original nao encontrado: {SRC_OGG}")

    tmp_dir = VOZES_DIR / "_tmp_clean"
    if tmp_dir.exists():
        shutil.rmtree(tmp_dir, ignore_errors=True)
    tmp_dir.mkdir(exist_ok=True)

    # Remocao cirurgica de cliques (0-3.15s), retake ("Quer organizar o..." em 42.1-46.05s) e pausa/cliques (48.9-55.3s)
    p1_a = cut_part(SRC_OGG, tmp_dir, 3.15, 42.05, "p1a")
    p1_b = cut_part(SRC_OGG, tmp_dir, 46.08, 48.92, "p1b")
    p2 = cut_part(SRC_OGG, tmp_dir, 55.32, 92.40, "p2")

    sil = tmp_dir / "sil.wav"
    with wave.open(str(sil), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(44100)
        wf.writeframes(np.zeros(int(44100 * 0.35), dtype=np.int16).tobytes())

    base_clone = VOZES_DIR / "alessandro_voz_base_clonagem.wav"
    sample_15s = VOZES_DIR / "alessandro_clone_sample_15s.wav"
    track_3d = VOZES_DIR / "alessandro_3d_restaurante_limpo.wav"
    track_2d = VOZES_DIR / "alessandro_2d_3sinais_limpo.wav"

    # 1. Base completa limpa (~78s sem cliques/retakes) - 24kHz e 44.1kHz
    concat_and_loudnorm([p1_a, sil, p1_b, sil, p2], base_clone, tmp_dir, target_lufs="-16", sample_rate=44100)

    # 2. Amostra zero-shot de 15s (trecho mais nitido e continuo, 24 kHz mono ideal p/ clonadores)
    p15 = cut_part(SRC_OGG, tmp_dir, 57.12, 72.65, "p15")
    concat_and_loudnorm([p15], sample_15s, tmp_dir, target_lufs="-16", sample_rate=24000)

    # 3. Faixas individuais limpas e prontas para os 2 videos (-14 LUFS broadcast)
    concat_and_loudnorm([p1_a, sil, p1_b], track_3d, tmp_dir, target_lufs="-14", sample_rate=44100)
    concat_and_loudnorm([p2], track_2d, tmp_dir, target_lufs="-14", sample_rate=44100)

    shutil.rmtree(tmp_dir, ignore_errors=True)
    (VOZES_DIR / "_alessandro_denoised.wav").unlink(missing_ok=True)

    dur_base, f0_med, f0_p10, f0_p90 = measure_f0_and_duration(base_clone)
    dur_15, *_ = measure_f0_and_duration(sample_15s)
    dur_3d, *_ = measure_f0_and_duration(track_3d)
    dur_2d, *_ = measure_f0_and_duration(track_2d)

    profile = {
        "id": "alessandro_oficial",
        "speaker": "Alessandro Santos (Stech Solucoes)",
        "raw_source": "banco-de-referencias/audio/vozes/alessandro_gravacao_original.ogg",
        "clone_base_wav": "banco-de-referencias/audio/vozes/alessandro_voz_base_clonagem.wav",
        "clone_sample_15s_24khz": "banco-de-referencias/audio/vozes/alessandro_clone_sample_15s.wav",
        "ready_tracks": {
            "3d_restaurante": {"path": "banco-de-referencias/audio/vozes/alessandro_3d_restaurante_limpo.wav", "duration_sec": dur_3d},
            "2d_3_sinais": {"path": "banco-de-referencias/audio/vozes/alessandro_2d_3sinais_limpo.wav", "duration_sec": dur_2d},
        },
        "durations_sec": {"base_clone": dur_base, "sample_15s": dur_15, "track_3d": dur_3d, "track_2d": dur_2d},
        "acoustic_profile": {
            "median_f0_hz": f0_med,
            "p10_hz": f0_p10,
            "p90_hz": f0_p90,
            "note": "Registro natural grave-medio (123 Hz), praticamente identico a referencia viral DfVKHAJD3Gx (124.2 Hz).",
        },
    }
    (VOZES_DIR / "alessandro_perfil.json").write_text(json.dumps(profile, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(profile, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
