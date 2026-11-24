"""
Scaffold rapido de um novo projeto na Fabrica de Videos 3D.

Uso:
  python template/scripts/new_project.py meu-novo-tema --preset curiosity --title "Como funciona o Wi-Fi?"
  python template/scripts/new_project.py novo-sistema --preset corporate --title "Novo Fluxo de Compras"
"""
import argparse
import json
import re
from pathlib import Path

TEMPLATE_DIR = Path(__file__).resolve().parent.parent
PROJECTS_DIR = TEMPLATE_DIR / "src" / "factory" / "projects"
REGISTRY_PATH = TEMPLATE_DIR / "src" / "factory" / "registry.ts"


def slug_to_pascal(slug: str) -> str:
    parts = re.split(r"[-_]+", slug.strip())
    return "".join(p.capitalize() for p in parts if p)


def slug_to_camel(slug: str) -> str:
    pas = slug_to_pascal(slug)
    return pas[0].lower() + pas[1:] if pas else "project"


def rebuild_registry():
    slugs = sorted(
        p.name for p in PROJECTS_DIR.iterdir()
        if p.is_dir() and (p / "config.json").exists() and (p / "timing.json").exists()
    )
    imports = ["import type {ExplainerProjectConfig, ExplainerTiming} from './types';"]
    entries = []
    for slug in slugs:
        var = slug_to_camel(slug)
        imports.append(f"import {var}Config from './projects/{slug}/config.json';")
        imports.append(f"import {var}Timing from './projects/{slug}/timing.json';")
        entries.append(
            f"  {{\n    config: {var}Config as unknown as ExplainerProjectConfig,\n    timing: {var}Timing as unknown as ExplainerTiming,\n  }},"
        )

    code = "\n".join(imports) + "\n\nexport interface RegisteredFactoryProject {\n  config: ExplainerProjectConfig;\n  timing: ExplainerTiming;\n}\n\nexport const FACTORY_PROJECTS: RegisteredFactoryProject[] = [\n" + "\n".join(entries) + "\n];\n"
    REGISTRY_PATH.write_text(code, encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Cria um novo projeto parametrizado na Fabrica de Videos 3D")
    parser.add_argument("slug", help="Identificador em kebab-case (ex: como-funciona-o-wifi)")
    parser.add_argument("--preset", choices=["curiosity", "corporate"], default="curiosity")
    parser.add_argument("--world", choices=["office", "pix_network", "science_lab"], default=None)
    parser.add_argument("--title", default=None, help="Titulo exibido no cartao final")
    parser.add_argument("--brand", default=None, help="Nome do canal ou empresa")
    args = parser.parse_args()

    slug = re.sub(r"[^a-z0-9-]+", "-", args.slug.lower()).strip("-")
    proj_dir = PROJECTS_DIR / slug
    if proj_dir.exists():
        raise FileExistsError(f"Projeto ja existe: {proj_dir}")

    base_cfg_path = PROJECTS_DIR / "como-funciona-o-pix" / "config.json"
    cfg = json.loads(base_cfg_path.read_text(encoding="utf-8"))

    comp_id = slug_to_pascal(slug)
    cfg["slug"] = slug
    cfg["compositionId"] = comp_id
    cfg["title"] = args.title or comp_id

    if args.preset == "corporate":
        cfg["world"] = args.world or "office"
        cfg["environment"] = "office"
        cfg["tagline"] = "FLUXO ORGANIZADO • DO INÍCIO AO FIM"
        cfg["brand"]["name"] = args.brand or "SUA EMPRESA"
        cfg["brand"]["primary"] = "#0E8A3E"
        cfg["brand"]["primaryDark"] = "#143D2B"
        cfg["coreHub"]["visualStyle"] = "pillar"
    else:
        cfg["world"] = args.world or "science_lab"
        cfg["environment"] = "lab"
        cfg["tagline"] = "CURIOSIDADES • POR DENTRO DA TECNOLOGIA"
        cfg["brand"]["name"] = args.brand or "POR DENTRO DA TECH"
        cfg["coreHub"]["visualStyle"] = "gears"

    proj_dir.mkdir(parents=True, exist_ok=True)
    (proj_dir / "config.json").write_text(json.dumps(cfg, indent=2, ensure_ascii=False), encoding="utf-8")
    (proj_dir / "timing.json").write_text(
        json.dumps({"total_frames": 300, "act_starts": {"ato1": 0, "ato2": 60, "ato3": 120, "ato4": 180, "ato5": 240}, "words": []}, indent=2),
        encoding="utf-8",
    )

    rebuild_registry()
    print(f"OK! Projeto criado em: {proj_dir / 'config.json'}")
    print(f"Composicoes registradas: {comp_id} (16:9) e {comp_id}Reels (9:16)")
    print(f"Proximo passo: edite config.json e rode:")
    print(f"  python template\\scripts\\render_factory.py --project {slug} --format youtube --qa-sheet")


if __name__ == "__main__":
    main()
