"""
Gera o painel de auditoria visual dos 8 atos do vídeo Sistema de Data Crítica (1920x1080 16:9)
usando pipe em memória com ffmpeg + Pillow (sem arquivos temporários).
Saída: template/renders/painel_data_critica_8_atos.jpg
"""
import io
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

FPS = 30.0
BASE_DIR = Path(__file__).resolve().parent.parent
VIDEO_PATH = BASE_DIR / "renders" / "sistema_data_critica_v1.mp4"
OUT_PATH = BASE_DIR / "renders" / "painel_data_critica_8_atos.jpg"

# 8 frames-chave cobrindo cada um dos 8 atos sincronizados com DATACRITICA_CUES
ACTS = [
    (205, "ATO 1 (f205) • Problema: Papel Demora & Gera Perda"),
    (565, "ATO 2 (f565) • Loja: Bipa Código no Celular & Puxa Preço"),
    (850, "ATO 3 (f850) • Loja: Qtd + Validade + Foto Real (Flash)"),
    (1418, "ATO 4 (f1418) • Compras: Analisa & Aprova Rebaixa R$ 6,99"),
    (1845, "ATO 5 (f1845) • Cadastro: Lança Valor + Etiquetas no RPInfo"),
    (1985, "ATO 6 (f1985) • Cadastro: Dá Baixa no Sistema Data Crítica"),
    (2395, "ATO 7 (f2395) • Loja: Fila de Etiquetas & Cola no Produto"),
    (2680, "ATO 8 (f2680) • Panorama 16:9: 3 Setores Integrados"),
]


def grab_frame_in_memory(video_path: Path, frame_idx: int) -> Image.Image:
    sec = max(0.0, (frame_idx - 1) / FPS)
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        f"{sec:.3f}",
        "-i",
        str(video_path),
        "-frames:v",
        "1",
        "-f",
        "image2pipe",
        "-vcodec",
        "png",
        "-",
    ]
    res = subprocess.run(cmd, capture_output=True, check=True)
    return Image.open(io.BytesIO(res.stdout)).convert("RGB")


def main() -> None:
    if not VIDEO_PATH.exists():
        raise FileNotFoundError(f"Vídeo não encontrado: {VIDEO_PATH}")

    cols, rows = 2, 4
    thumb_w, thumb_h = 920, 518
    pad = 24
    header_h = 46

    board_w = cols * thumb_w + (cols + 1) * pad
    board_h = rows * (thumb_h + header_h) + (rows + 1) * pad

    board = Image.new("RGB", (board_w, board_h), (15, 23, 42))
    draw = ImageDraw.Draw(board)

    try:
        font = ImageFont.truetype("arialbd.ttf", 24)
    except OSError:
        font = ImageFont.load_default()

    for idx, (frame_n, title) in enumerate(ACTS):
        r = idx // cols
        c = idx % cols
        x = pad + c * (thumb_w + pad)
        y = pad + r * (thumb_h + header_h + pad)

        draw.rectangle([x, y, x + thumb_w, y + header_h], fill=(30, 41, 59))
        draw.text((x + 14, y + 10), title, fill=(255, 225, 53), font=font)

        img = grab_frame_in_memory(VIDEO_PATH, frame_n)
        img_resized = img.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        board.paste(img_resized, (x, y + header_h))

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    board.save(OUT_PATH, quality=92)
    print(f"Painel salvo com sucesso em: {OUT_PATH} ({board_w}x{board_h})")


if __name__ == "__main__":
    main()

