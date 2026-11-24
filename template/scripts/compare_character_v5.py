from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(r"d:\Aplicações testes\editor videos\anything2explainer\template")
RENDERS = ROOT / "renders"
USER_UPLOADS = Path(r"C:\Users\alessandro.santos\.gemini\antigravity\brain\87d128df-d2b7-4c96-bfeb-10be21f64f88\.user_uploaded")

v4_crop_path = USER_UPLOADS / "media_1793362355382_064e3ad2.png"
orig_crop_path = USER_UPLOADS / "media_1793362362235_1137b032.png"
v5_full_path = RENDERS / "test_v5_frame195.png"

v4_img = Image.open(v4_crop_path).convert("RGB").resize((420, 540), Image.Resampling.LANCZOS)
orig_img = Image.open(orig_crop_path).convert("RGB").resize((420, 540), Image.Resampling.LANCZOS)

v5_full = Image.open(v5_full_path).convert("RGB")
# Recorta a região da poltrona + boneco + balde no frame 1080x1920
v5_crop = v5_full.crop((0, 560, 740, 1460)).resize((420, 540), Image.Resampling.LANCZOS)

board = Image.new("RGB", (420 * 3 + 60, 620), (18, 22, 31))
draw = ImageDraw.Draw(board)

try:
    font = ImageFont.truetype("arialbd.ttf", 22)
except Exception:
    font = ImageFont.load_default()

titles = [
    ("1. ANTES (v4 - Peças Soltas)", (248, 113, 113)),
    ("2. ORIGINAL (@desmontandoomundo)", (250, 204, 21)),
    ("3. AGORA (v5 - Rig Oficial 1:1)", (74, 222, 128)),
]

for idx, (img, (title, color)) in enumerate(zip([v4_img, orig_img, v5_crop], titles)):
    x = 15 + idx * 435
    draw.text((x + 12, 18), title, fill=color, font=font)
    board.paste(img, (x, 60))

out_path = RENDERS / "comparacao_boneco_v5_vs_original.jpg"
board.save(out_path, quality=95)
print("Comparativo salvo em:", out_path)

