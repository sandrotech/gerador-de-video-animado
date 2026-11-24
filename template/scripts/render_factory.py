"""
Pipeline Completo em 1 Comando — Fabrica de Videos 3D.

Uso:
  python template/scripts/render_factory.py --project como-funciona-o-pix --format youtube --qa-sheet
  python template/scripts/render_factory.py --project como-funciona-o-pix --format both --qa-sheet

Etapas:
  1. Gera audio + timing.json via build_factory_audio.py (pt-BR-AntonioNeural)
  2. Valida TypeScript (tsc --noEmit)
  3. Renderiza via render_stech.py (ProRes + libx264/AAC + ffprobe + raea)
  4. Opcionalmente extrai contact sheet de 6 quadros para revisao visual
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

TEMPLATE_DIR = Path(__file__).resolve().parent.parent
WORKSPACE_ROOT = TEMPLATE_DIR.parent
PROJECTS_DIR = TEMPLATE_DIR / "src" / "factory" / "projects"
SCRIPTS_DIR = TEMPLATE_DIR / "scripts"


def run_step(cmd: list[str], cwd: Path = WORKSPACE_ROOT):
    print(f"\n>>> {' '.join(cmd)}")
    res = subprocess.run(cmd, cwd=str(cwd))
    if res.returncode != 0:
        raise RuntimeError(f"Comando falhou (exit {res.returncode}): {' '.join(cmd)}")


def extract_qa_sheet(mp4_path: Path, total_frames: int):
    sheet_path = mp4_path.with_name(mp4_path.stem + "_qa_sheet.png")
    fracs = [0.03, 0.28, 0.50, 0.70, 0.83, 0.95]
    frames = [max(1, min(total_frames - 2, int(total_frames * f))) for f in fracs]
    expr = "+".join(f"eq(n\\,{f})" for f in frames)
    vf = f"select='{expr}',scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2,tile=3x2"
    run_step(["ffmpeg", "-v", "error", "-y", "-i", str(mp4_path), "-vf", vf, "-frames:v", "1", "-update", "1", str(sheet_path)])
    print(f"[QA SHEET] Salvo em: {sheet_path}")


def main():
    parser = argparse.ArgumentParser(description="Render pipeline unificado da Fabrica de Videos 3D")
    parser.add_argument("--project", required=True, help="Slug do projeto em template/src/factory/projects/<slug>")
    parser.add_argument("--format", choices=["youtube", "reels", "both"], default="youtube")
    parser.add_argument("--skip-audio", action="store_true", help="Nao regenerar audio/timing.json")
    parser.add_argument("--fast", action="store_true", help="Modo rascunho rapido H.264 sem ProRes")
    parser.add_argument("--qa-sheet", action="store_true", help="Extrai contact sheet 3x2 para revisao visual")
    parser.add_argument("--version", default="v1", help="Sufixo de versao do arquivo de saida (padrao: v1)")
    args = parser.parse_args()

    slug = args.project
    proj_dir = PROJECTS_DIR / slug
    cfg_path = proj_dir / "config.json"
    if not cfg_path.exists():
        raise FileNotFoundError(f"Projeto nao encontrado: {cfg_path}")

    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    comp_base = cfg["compositionId"]

    if not args.skip_audio:
        run_step([sys.executable, str(SCRIPTS_DIR / "build_factory_audio.py"), "--project", slug])

    timing = json.loads((proj_dir / "timing.json").read_text(encoding="utf-8"))
    total_frames = int(timing["total_frames"])

    # Typecheck antes de renderizar
    run_step(["node", str(TEMPLATE_DIR / "node_modules" / "typescript" / "bin" / "tsc"), "--noEmit"], cwd=TEMPLATE_DIR)

    audio_wav = TEMPLATE_DIR / "public" / "assets" / slug / "master_audio_sfx.wav"
    targets = []
    if args.format in ("youtube", "both"):
        targets.append(("youtube-16x9", comp_base, 1920, 1080, f"{slug}_16x9_{args.version}.mp4"))
    if args.format in ("reels", "both"):
        targets.append(("reels-9x16", f"{comp_base}Reels", 1080, 1920, f"{slug}_9x16_{args.version}.mp4"))

    for subfolder, comp_id, w, h, out_name in targets:
        cmd = [
            sys.executable,
            str(SCRIPTS_DIR / "render_stech.py"),
            "--project",
            slug,
            "--comp",
            comp_id,
            "--out",
            out_name,
            "--width",
            str(w),
            "--height",
            str(h),
            "--audio",
            str(audio_wav),
            "--raea-check",
        ]
        if args.fast:
            cmd.append("--fast")
        run_step(cmd)

        mp4_out = TEMPLATE_DIR / "renders" / slug / subfolder / out_name
        if args.qa_sheet and mp4_out.exists():
            extract_qa_sheet(mp4_out, total_frames)

    print("\n[FABRICA CONCLUIDA] Todos os renders solicitados foram finalizados.")


if __name__ == "__main__":
    main()
