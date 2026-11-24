"""
Gera o painel de auditoria visual dos 8 atos da replicacao do video
Restaurante X vs Restaurante Y (1920x1080 16:9 Widescreen).
Renderiza os 8 frames com Remotion CLI e monta um grid 2x4 com titulos e metricas.
Saida: template/renders/painel_restaurante_8_atos.jpg
"""
import io
import os
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

BASE_DIR = Path(__file__).resolve().parent.parent
OUT_BOARD = BASE_DIR / "renders" / "painel_restaurante_8_atos.jpg"
STILLS_DIR = BASE_DIR / "renders" / "stills_restaurante"
STILLS_DIR.mkdir(parents=True, exist_ok=True)

ACTS = [
    (120, "ATO 1 (f120) • Gancho 16:9: Mesmo Prato R$ 49, X Lota vs Y Vazio"),
    (660, "ATO 2 (f660) • O Mapa: 'Onde Jantar?' — Y Sem Foto vs X Verificado"),
    (960, "ATO 3 (f960) • Rota: Seta Amarela + Botao de Rota (1 Toque)"),
    (1220, "ATO 4 (f1220) • Cardapio: PDF Lento e Zoom vs Link Mobile Fluido"),
    (1650, "ATO 5 (f1650) • Avaliacoes: X Responde Tudo vs Y Abandonado"),
    (2180, "ATO 6 (f2180) • Delivery: WhatsApp Proprio vs Taxas Abusivas"),
    (2680, "ATO 7 (f2680) • 1 Ano Depois: Fila Enorme no Restaurante X"),
    (2860, "ATO 8 (f2860) • Desfecho & CTA: Placa no Y + 'Chama a Gente!'"),
]

def render_still(frame_n: int) -> Path:
    out_file = STILLS_DIR / f"frame_{frame_n:04d}.jpg"
    remotion_cli = BASE_DIR / "node_modules" / "@remotion" / "cli" / "remotion-cli.js"
    cmd = [
        "node",
        str(remotion_cli),
        "still",
        "src/index.ts",
        "RestauranteContrast",
        str(out_file),
        f"--frame={frame_n}",
        "--image-format=jpeg",
        "--jpeg-quality=90",
        "--log=error",
    ]
    print(f"Renderizando frame {frame_n}...")
    subprocess.run(cmd, cwd=str(BASE_DIR), check=True)
    return out_file

def main():
    print("=== Gerando Painel de Storyboard dos 8 Atos (Restaurante X vs Y) ===")
    frame_files = []
    for frame_n, title in ACTS:
        img_path = render_still(frame_n)
        frame_files.append((img_path, title))

    cols, rows = 2, 4
    thumb_w, thumb_h = 920, 518
    pad = 24
    header_h = 46

    board_w = cols * thumb_w + (cols + 1) * pad
    board_h = rows * (thumb_h + header_h) + (rows + 1) * pad

    board = Image.new("RGB", (board_w, board_h), (15, 23, 42))
    draw = ImageDraw.Draw(board)

    try:
        font = ImageFont.truetype("arialbd.ttf", 22)
    except OSError:
        font = ImageFont.load_default()

    for idx, (img_path, title) in enumerate(frame_files):
        r = idx // cols
        c = idx % cols
        x = pad + c * (thumb_w + pad)
        y = pad + r * (thumb_h + header_h + pad)

        # Header da miniatura
        draw.rectangle([x, y, x + thumb_w, y + header_h], fill=(30, 41, 59))
        draw.text((x + 16, y + 12), title, fill=(255, 225, 53), font=font)

        # Imagem do frame
        img = Image.open(img_path).convert("RGB")
        img_resized = img.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        board.paste(img_resized, (x, y + header_h))

    OUT_BOARD.parent.mkdir(parents=True, exist_ok=True)
    board.save(OUT_BOARD, quality=92)
    print(f"\n✅ Painel salvo com sucesso em:\n{OUT_BOARD} ({board_w}x{board_h})")

if __name__ == "__main__":
    main()
