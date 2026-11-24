#!/usr/bin/env python3
"""Analyze audio characteristics and extract high-res visual reference crops from the 3 viral Reels."""
import subprocess
from pathlib import Path
import numpy as np
import soundfile as sf
from PIL import Image

RENDERS = Path(__file__).resolve().parent.parent / "renders"


def extract_crop(mp4: Path, t: float, box: tuple[int, int, int, int], out_name: str):
    """Extract a frame at time t and crop box (x1, y1, x2, y2)."""
    tmp_png = RENDERS / f"_frame_{out_name}.png"
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-ss", str(t), "-i", str(mp4), "-frames:v", "1", str(tmp_png)],
        check=True,
    )
    img = Image.open(tmp_png)
    cropped = img.crop(box)
    out_path = RENDERS / out_name
    cropped.save(out_path, quality=95)
    tmp_png.unlink(missing_ok=True)
    return out_path


def main():
    ref1 = RENDERS / "ref_instagram.mp4"
    ref2 = RENDERS / "ref_reel_2_DezX76zgi47.mp4"
    ref3 = RENDERS / "ref_reel_3_De4oWvEh06y.mp4"

    # Extract high-res full frames of key design elements to build a visual reference board
    board_imgs = []
    samples = [
        (ref1, 2.5, "1_abertura_personagem.png"),
        (ref1, 83.0, "2_valvula_expansao_detalhe.png"),
        (ref1, 114.0, "3_dreno_copo_suando.png"),
        (ref1, 128.0, "4_inverter_velocimetro.png"),
        (ref1, 138.0, "5_final_split_completo.png"),
        (ref2, 46.0, "6_telhado_inclinacao_30pct.png"),
        (ref2, 70.0, "7_telhado_3_toneladas_setas.png"),
        (ref3, 47.0, "8_predio_aperto_puxao_setas.png"),
    ]
    for mp4, t, name in samples:
        out = extract_crop(mp4, t, (0, 0, 1080, 1920), name)
        board_imgs.append(Image.open(out).resize((540, 960), Image.Resampling.LANCZOS))

    # Create 4x2 high-res reference board
    board = Image.new("RGB", (540 * 4, 960 * 2))
    for idx, im in enumerate(board_imgs):
        r, c = divmod(idx, 4)
        board.paste(im, (c * 540, r * 960))
    board_path = RENDERS / "desmontando_design_board.jpg"
    board.save(board_path, quality=92)
    print(f"Saved high-res design board to {board_path}")


if __name__ == "__main__":
    main()

