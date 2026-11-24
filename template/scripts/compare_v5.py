import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(r"d:\Aplicações testes\editor videos\anything2explainer\template")
RENDERS = ROOT / "renders"

ORIG_VIDEO = RENDERS / "ref_instagram.mp4"
V5_VIDEO = RENDERS / "ar-condicionado_desmontando_v5.mp4"


def grab_frame(video_path: Path, sec: float, size=(360, 640)) -> Image.Image:
    tmp = RENDERS / "_tmp_cmp_v5.png"
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-ss",
            f"{sec:.2f}",
            "-i",
            str(video_path),
            "-frames:v",
            "1",
            "-q:v",
            "2",
            str(tmp),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    im = Image.open(tmp).convert("RGB").resize(size, Image.Resampling.LANCZOS)
    tmp.unlink(missing_ok=True)
    return im


def main():
    pairs = [
        (6.2, 6.5, "1. Sala + Boneco + Balde"),
        (16.0, 15.0, "2. Fluido Rosa (-50°C)"),
        (24.0, 22.0, "3. Serpentina + Ciclo"),
        (36.0, 29.0, "4. Corte Casa Inteira"),
        (46.0, 38.5, "5. Compressor + Bomba"),
        (51.0, 46.0, "6. Condensador + Vento"),
        (59.0, 54.0, "7. Válvula de Expansão"),
        (72.0, 70.0, "8. Ar-Condicionado Final"),
    ]

    col_w, row_h = 360, 640
    cols = 4
    board_w = cols * (col_w * 2 + 24) + 24
    board_h = 2 * (row_h + 70) + 30
    board = Image.new("RGB", (board_w, board_h), (15, 23, 42))
    draw = ImageDraw.Draw(board)

    try:
        font = ImageFont.truetype("arialbd.ttf", 22)
    except Exception:
        font = ImageFont.load_default()

    for idx, (t_orig, t_v5, label) in enumerate(pairs):
        r = idx // cols
        c = idx % cols
        x0 = 24 + c * (col_w * 2 + 24)
        y0 = 20 + r * (row_h + 70)

        draw.text((x0 + 10, y0), f"{label} (Esq: Original | Dir: v5 Rig Oficial)", fill=(250, 204, 21), font=font)
        im_orig = grab_frame(ORIG_VIDEO, t_orig, (col_w, row_h))
        im_v5 = grab_frame(V5_VIDEO, t_v5, (col_w, row_h))
        board.paste(im_orig, (x0, y0 + 36))
        board.paste(im_v5, (x0 + col_w + 6, y0 + 36))

    out = RENDERS / "comparacao_original_vs_v5.jpg"
    board.save(out, quality=92)
    print("Painel salvo em:", out)


if __name__ == "__main__":
    main()

