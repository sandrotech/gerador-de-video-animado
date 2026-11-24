"""
Extrai o audio limpo de qualquer video colocado em banco-de-referencias/videos/
para reutilizar como voz base (audio/vozes/) ou trilha de fundo (audio/trilhas/).

Uso:
  python template/scripts/extract_ref_audio.py banco-de-referencias/videos/meu_video.mp4 --dest vozes
  python template/scripts/extract_ref_audio.py banco-de-referencias/videos/musica_ref.mp4 --dest trilhas
"""
import argparse
import subprocess
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
AUDIO_ROOT = WORKSPACE_ROOT / "banco-de-referencias" / "audio"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input_video", help="Caminho do video ou audio de referencia")
    parser.add_argument("--dest", choices=["vozes", "trilhas"], default="trilhas")
    parser.add_argument("--name", default=None, help="Nome de saida sem extensao")
    args = parser.parse_args()

    src = Path(args.input_video)
    if not src.exists():
        raise FileNotFoundError(f"Arquivo nao encontrado: {src}")

    out_dir = AUDIO_ROOT / args.dest
    out_dir.mkdir(parents=True, exist_ok=True)
    out_wav = out_dir / f"{args.name or src.stem}.wav"

    af = (
        "highpass=f=80,acompressor=threshold=-18dB:ratio=2.2:attack=10:release=120"
        if args.dest == "vozes"
        else "highpass=f=35"
    )
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(src),
            "-vn",
            "-af",
            af,
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
    print(f"[OK] Audio extraido para: {out_wav}")


if __name__ == "__main__":
    main()
