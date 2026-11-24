"""
Orquestrador Principal da Miniprodutora Multi-Agente (OmniRoute + Fabrica 3D).

Uso:
  python template/scripts/studio_orchestrator.py --topic "Por que o gelo flutua?" --format youtube
  python template/scripts/studio_orchestrator.py --topic "Como o Wi-Fi funciona?" --format both --pause-script
  python template/scripts/studio_orchestrator.py --batch temas.txt --format youtube
"""
import argparse
import concurrent.futures
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
STUDIO_DIR = SCRIPTS_DIR / "studio"
TEMPLATE_DIR = SCRIPTS_DIR.parent

sys.path.insert(0, str(SCRIPTS_DIR))
sys.path.insert(0, str(STUDIO_DIR))

from agent_audio import run_audio_agent
from agent_director import run_director, slugify
from agent_qa_vision import run_qa_vision_agent
from agent_thumbnail import run_thumbnail_agent
from agent_world3d import run_world3d_agent
from omni_client import OmniClient


def prepare_project(
    client: OmniClient,
    topic: str,
    preset: str,
    world_mode: str,
    pause_script: bool,
) -> tuple[str, str]:
    slug = slugify(topic)
    proj_dir, briefing = run_director(client, topic, slug=slug, preset=preset, world_mode=world_mode)

    if pause_script:
        print(f"\n[PAUSA] Revise o roteiro em: {proj_dir / 'config.json'}")
        input("Pressione ENTER para disparar Audio + Cenario 3D + Thumbnail em paralelo...")

    print(f"\n[ETAPA 2] Executando Agentes 2A (Audio), 2B (Mundo 3D) e 2C (Thumbnail/Copy) em PARALELO para '{slug}'...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        f_audio = pool.submit(run_audio_agent, client, slug)
        f_world = pool.submit(run_world3d_agent, client, slug, briefing)
        f_thumb = pool.submit(run_thumbnail_agent, client, slug)
        for fut in (f_audio, f_world, f_thumb):
            fut.result()

    return slug, briefing


def render_and_audit(
    client: OmniClient,
    slug: str,
    briefing: str,
    fmt: str,
    fast: bool,
    auto_fix_vision: bool,
):
    cmd = [
        sys.executable,
        str(SCRIPTS_DIR / "render_factory.py"),
        "--project",
        slug,
        "--format",
        fmt,
        "--skip-audio",
        "--qa-sheet",
    ]
    if fast:
        cmd.append("--fast")
    res = subprocess.run(cmd)
    if res.returncode != 0:
        raise RuntimeError(f"render_factory.py falhou para '{slug}'")

    subfolder = "reels-9x16" if fmt == "reels" else "youtube-16x9"
    suffix = "9x16" if fmt == "reels" else "16x9"
    sheet = TEMPLATE_DIR / "renders" / slug / subfolder / f"{slug}_{suffix}_v1_qa_sheet.png"
    if sheet.exists():
        passed, fix_hint = run_qa_vision_agent(client, slug, sheet)
        if not passed and auto_fix_vision and fix_hint:
            print(f"[AutoFix] Auditor Visual reprovou '{slug}'. Tentando correcao 3D: {fix_hint}")
            run_world3d_agent(client, slug, briefing, feedback_fix=fix_hint)
            cmd_v2 = [*cmd, "--version", "v2"]
            subprocess.run(cmd_v2, check=True)
            sheet_v2 = TEMPLATE_DIR / "renders" / slug / subfolder / f"{slug}_{suffix}_v2_qa_sheet.png"
            if sheet_v2.exists():
                run_qa_vision_agent(client, slug, sheet_v2)


def main():
    parser = argparse.ArgumentParser(description="Orquestrador Multi-Agente da Miniprodutora 3D (OmniRoute)")
    parser.add_argument("--topic", help="Tema de curiosidade ou processo para 1 video")
    parser.add_argument("--batch", help="Arquivo .txt com 1 tema por linha para producao em lote")
    parser.add_argument("--preset", choices=["curiosity", "corporate"], default="curiosity")
    parser.add_argument("--world", default="custom", help="'custom' (gera mundo 3D inedito) ou 'office'|'pix_network'|'science_lab'")
    parser.add_argument("--format", choices=["youtube", "reels", "both"], default="youtube")
    parser.add_argument("--fast", action="store_true", help="Render rapido sem ProRes")
    parser.add_argument("--pause-script", action="store_true", help="Pausa apos o Diretor gerar o roteiro")
    parser.add_argument("--no-autofix", action="store_true", help="Desativa re-render automatico caso o Vision QA reprove")
    args = parser.parse_args()

    if not args.topic and not args.batch:
        parser.error("Informe --topic '...' ou --batch temas.txt")

    topics = [args.topic] if args.topic else [
        ln.strip() for ln in Path(args.batch).read_text(encoding="utf-8").splitlines() if ln.strip() and not ln.strip().startswith("#")
    ]

    client = OmniClient()
    prepared: list[tuple[str, str]] = []
    for t in topics:
        prepared.append(prepare_project(client, t, args.preset, args.world, args.pause_script))

    # Etapa 3: Fila sequencial de render (1 por vez para nao saturar CPU/GPU)
    for slug, briefing in prepared:
        print(f"\n[ETAPA 3] Render + QA Visual de '{slug}' ({args.format})...")
        render_and_audit(client, slug, briefing, args.format, args.fast, not args.no_autofix)

    print("\n[MINIPRODUTORA CONCLUIDA] Todos os videos foram produzidos e auditados!")


if __name__ == "__main__":
    main()
