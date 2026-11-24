"""
Gerador Rapido Local com Pacote de Vozes Prontas (`kokoro-onnx` v1.0, pt-BR).
Vozes pt-BR incluidas no pacote oficial:
  - `pm_alex`  (masculino natural pt-BR)
  - `pm_santa` (masculino grave pt-BR)
  - `pf_dora`  (feminino natural pt-BR)
"""
import argparse
import json
import re
import subprocess
import urllib.request
from pathlib import Path
import soundfile as sf

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
PACK_DIR = WORKSPACE_ROOT / "banco-de-referencias" / "audio" / "vozes" / "kokoro-pack"
PACK_DIR.mkdir(parents=True, exist_ok=True)

MODEL_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx"
VOICES_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin"

MODEL_PATH = PACK_DIR / "kokoro-v1.0.onnx"
VOICES_PATH = PACK_DIR / "voices-v1.0.bin"
DEFAULT_OUT = WORKSPACE_ROOT / "template" / "renders" / "stech-automacao" / "previews" / "teste_kokoro_pm_alex_10s.wav"


def ensure_pack():
    for url, dst in [(MODEL_URL, MODEL_PATH), (VOICES_URL, VOICES_PATH)]:
        if not dst.exists() or dst.stat().st_size < 100_000:
            print(f"[DOWNLOAD] Baixando {dst.name}...")
            urllib.request.urlretrieve(url, str(dst))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--text",
        default="Olha só, sua empresa ainda tá na planilha? Na Stech, tudo conversa sozinho no painel. Chama a gente pra ver na prática.",
    )
    parser.add_argument("--voice", default="pm_alex", choices=["pm_alex", "pm_santa", "pf_dora"])
    parser.add_argument("--speed", type=float, default=1.02)
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    args = parser.parse_args()

    ensure_pack()

    from kokoro_onnx import Kokoro

    print(f"[1/2] Sintetizando com Kokoro-ONNX (voz='{args.voice}', lang='pt-br')...")
    kokoro = Kokoro(str(MODEL_PATH), str(VOICES_PATH))
    samples, sr = kokoro.create(args.text, voice=args.voice, speed=args.speed, lang="pt-br")

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    raw_wav = out_path.parent / f"_raw_{out_path.stem}.wav"
    sf.write(str(raw_wav), samples, sr)

    print("[2/2] Masterizando -14 LUFS...")
    p1 = subprocess.run(
        ["ffmpeg", "-y", "-i", str(raw_wav), "-af", "loudnorm=I=-14:TP=-1.6:LRA=9:print_format=json", "-f", "null", "-"],
        capture_output=True,
        text=True,
        check=True,
    )
    st = json.loads(re.search(r"\{[\s\S]*?\}", p1.stderr).group(0))
    af2 = (
        f"loudnorm=I=-14:TP=-1.6:LRA=9:linear=true:"
        f"measured_I={st['input_i']}:measured_TP={st['input_tp']}:"
        f"measured_LRA={st['input_lra']}:measured_thresh={st['input_thresh']}:"
        f"offset={st['target_offset']},alimiter=limit=-1.6dB:attack=5:release=60:level=false"
    )
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", str(raw_wav), "-af", af2, "-ar", "44100", "-ac", "2", "-c:a", "pcm_s16le", str(out_path)],
        check=True,
    )
    raw_wav.unlink(missing_ok=True)
    print(f"[OK] Audio Kokoro salvo em: {out_path}")


if __name__ == "__main__":
    main()
