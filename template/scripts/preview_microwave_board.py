import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(r"d:\Aplicações testes\editor videos\anything2explainer\template")
RENDERS = ROOT / "renders"
VIDEO_PATH = RENDERS / "micro-ondas_desmontando_v1.mp4"


def grab_frame(sec: float, size=(380, 675)) -> Image.Image:
    tmp = RENDERS / "_tmp_mw_frame.png"
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-ss",
            f"{sec:.2f}",
            "-i",
            str(VIDEO_PATH),
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
    acts = [
        (3.8, "Ato 1A: Boneco Oficial + Maçarico"),
        (9.5, "Ato 1B: Queimado Fora / Gelo no Meio"),
        (19.0, "Ato 2: Moléculas H2O + Magnetron"),
        (29.5, "Ato 3: 2,45 Bilhões/s (Atrito = Calor)"),
        (41.5, "Ato 4: Caixa Metálica (Espelho de Ondas)"),
        (51.0, "Ato 5: Prato Giratório + Motorzinho"),
        (61.5, "Ato 6: Tela Furadinha (Onda 12cm vs Luz)"),
        (81.5, "Ato 8: Micro-ondas Pronto + Sininho!"),
    ]

    col_w, row_h = 380, 675
    cols = 4
    board_w = cols * (col_w + 24) + 24
    board_h = 2 * (row_h + 64) + 24
    board = Image.new("RGB", (board_w, board_h), (15, 23, 42))
    draw = ImageDraw.Draw(board)

    try:
        font = ImageFont.truetype("arialbd.ttf", 21)
    except Exception:
        font = ImageFont.load_default()

    for idx, (sec, title) in enumerate(acts):
        r = idx // cols
        c = idx % cols
        x0 = 24 + c * (col_w + 24)
        y0 = 20 + r * (row_h + 64)
        draw.text((x0 + 6, y0), title, fill=(250, 204, 21), font=font)
        im = grab_frame(sec, (col_w, row_h))
        board.paste(im, (x0, y0 + 34))

    out = RENDERS / "painel_micro_ondas_8_atos.jpg"
    board.save(out, quality=93)
    print("Mural salvo em:", out)


if __name__ == "__main__":
    main()

