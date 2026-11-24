"""
Gera painel rapido de auditoria visual dos atos do video da Stech Solucoes
usando pre-bundle em cache (.remotion-bundle) + aceleracao GPU ANGLE (--gl=angle).

Suporta:
  --variant 16:9  -> template/renders/stech-automacao/qa/painel_stech_atos_16x9.jpg (8 quadros)
  --variant 9:16  -> template/renders/stech-automacao/qa/painel_stech_atos_9x16.jpg (12 quadros, com guias de safe zone do Reels)
"""
import argparse
import shutil
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

from render_stech import ensure_bundle, BASE_DIR, RENDERS_ROOT, REMOTION_CLI

ACTS_169 = [
    (40, "0-2.5s (f40) • O Problema: Papel vs Sistema"),
    (145, "2.5-5s (f145) • Contraste: Improviso x Automacao"),
    (260, "5-8s (f260) • Tudo Conectado + Dutos 3D"),
    (380, "8-12s (f380) • Stech Solucoes + Logo Oficial"),
    (740, "Ato 2 (f740) • Recebimento: Celular/Terminal"),
    (1080, "Ato 3 (f1080) • Cozinha KDS em Tempo Real"),
    (1420, "Ato 4 (f1420) • Atendimento: Cozinha -> Salao"),
    (2150, "Ato 6 (f2150) • Panorama Integrado + CTA"),
]

ACTS_916 = [
    (30, "f30 • Ato 1: Problema Manual"),
    (140, "f140 • Ato 1: Contraste Automacao"),
    (270, "f270 • Ato 1: Tudo Conectado"),
    (410, "f410 • Ato 1: Logo Stech"),
    (560, "f560 • Ato 2: Anotacao Papel"),
    (760, "f760 • Ato 2: Entrada Centralizada"),
    (940, "f940 • Ato 3: Comanda Perdida"),
    (1100, "f1100 • Ato 3: Tela KDS Cozinha"),
    (1380, "f1380 • Ato 4: Salao <-> Cozinha"),
    (1630, "f1630 • Ato 5: Caderno Manual"),
    (1800, "f1800 • Ato 5: Painel de Gestao"),
    (2150, "f2150 • Ato 6: CTA Panorama Stech"),
]


ACTS_V3 = [
    (0, "f0 • Frame 0: Gancho Imediato"),
    (120, "f120 • Dor: Papel e Espera"),
    (240, "f240 • Virada: Sistema Integrado"),
    (380, "f380 • Passo 1: Recebimento"),
    (540, "f540 • Passo 2: Cozinha KDS (Preparo)"),
    (645, "f645 • Passo 2b: Pronto -> Salao"),
    (760, "f760 • Passo 3: Gestao & Caixa"),
    (1140, "f1140 • Tela Final Stech + Contatos"),
]


def render_still(bundle_path: Path, comp_id: str, stills_dir: Path, frame_n: int) -> Path:
    out_file = stills_dir / f"f{frame_n:04d}.jpg"
    cmd = [
        "node",
        str(REMOTION_CLI),
        "still",
        str(bundle_path),
        comp_id,
        str(out_file),
        f"--frame={frame_n}",
        "--image-format=jpeg",
        "--jpeg-quality=88",
        "--gl=angle",
        "--log=error",
    ]
    subprocess.run(cmd, cwd=str(BASE_DIR), check=True)
    return out_file


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--variant", choices=["16:9", "9:16", "v3"], default="v3")
    parser.add_argument("--project", default="stech-automacao")
    parser.add_argument("--rebundle", action="store_true")
    parser.add_argument("--safe-guides", action="store_true", help="Desenha linhas da Safe Zone do Instagram Reels")
    args = parser.parse_args()

    t0 = time.time()
    bundle_path = ensure_bundle(force_rebundle=args.rebundle)

    qa_dir = RENDERS_ROOT / args.project / "qa"
    qa_dir.mkdir(parents=True, exist_ok=True)
    stills_dir = qa_dir / f"_tmp_stills_{args.variant.replace(':', 'x')}"
    stills_dir.mkdir(parents=True, exist_ok=True)

    is_vertical = args.variant in ("9:16", "v3")
    if args.variant == "v3":
        comp_id = "StechAutomacaoReelsV3"
        acts = ACTS_V3
        out_board = qa_dir / "painel_stech_v3_reels.jpg"
    elif args.variant == "9:16":
        comp_id = "StechAutomacaoVertical"
        acts = ACTS_916
        out_board = qa_dir / "painel_stech_atos_9x16.jpg"
    else:
        comp_id = "StechAutomacao"
        acts = ACTS_169
        out_board = qa_dir / "painel_stech_atos_16x9.jpg"

    print(f"Renderizando {len(acts)} stills ({comp_id}) em paralelo com ANGLE + pre-bundle...")
    with ThreadPoolExecutor(max_workers=4) as ex:
        futures = [
            (ex.submit(render_still, bundle_path, comp_id, stills_dir, fn), title)
            for fn, title in acts
        ]
        frame_files = [(fut.result(), title) for fut, title in futures]

    if is_vertical:
        cols, rows = (4, 2) if args.variant == "v3" else (6, 2)
        thumb_w, thumb_h = 360, 640
    else:
        cols, rows = 2, 4
        thumb_w, thumb_h = 920, 518

    pad = 18
    header_h = 38
    board_w = cols * thumb_w + (cols + 1) * pad
    board_h = rows * (thumb_h + header_h) + (rows + 1) * pad

    board = Image.new("RGB", (board_w, board_h), (15, 23, 42))
    draw = ImageDraw.Draw(board)

    try:
        font = ImageFont.truetype("arialbd.ttf", 16 if is_vertical else 22)
    except OSError:
        font = ImageFont.load_default()

    for idx, (img_path, title) in enumerate(frame_files):
        r = idx // cols
        c = idx % cols
        x = pad + c * (thumb_w + pad)
        y = pad + r * (thumb_h + header_h + pad)

        draw.rectangle([x, y, x + thumb_w, y + header_h], fill=(30, 41, 59))
        draw.text((x + 10, y + 10), title, fill=(255, 225, 53), font=font)

        img = Image.open(img_path).convert("RGB").resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        board.paste(img, (x, y + header_h))

        if is_vertical and args.safe_guides:
            # Guias de Safe Zone Instagram Reels (top 150px, bottom 380px, right 140px em 1080x1920)
            sy_top = y + header_h + int(thumb_h * (150 / 1920))
            sy_bot = y + header_h + int(thumb_h * (1 - 380 / 1920))
            sx_right = x + int(thumb_w * (1 - 140 / 1080))
            draw.line([(x, sy_top), (x + thumb_w, sy_top)], fill=(239, 68, 68), width=1)
            draw.line([(x, sy_bot), (x + thumb_w, sy_bot)], fill=(239, 68, 68), width=1)
            draw.line([(sx_right, sy_top), (sx_right, sy_bot)], fill=(239, 68, 68), width=1)

    board.save(out_board, quality=90)
    shutil.rmtree(stills_dir, ignore_errors=True)
    print(f"Painel {args.variant} salvo em: {out_board} ({board_w}x{board_h}) em {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
