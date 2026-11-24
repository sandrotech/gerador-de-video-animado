"""
Agente 2C — Thumbnail YouTube (1280x720) & Copy (Titulo, Descricao, Hashtags).
"""
import json
import subprocess
import sys
from pathlib import Path

STUDIO_DIR = Path(__file__).resolve().parent
SCRIPTS_DIR = STUDIO_DIR.parent
TEMPLATE_DIR = SCRIPTS_DIR.parent
PROJECTS_DIR = TEMPLATE_DIR / "src" / "factory" / "projects"
RENDERS_DIR = TEMPLATE_DIR / "renders"

sys.path.insert(0, str(STUDIO_DIR))
from omni_client import OmniClient


def run_thumbnail_agent(client: OmniClient, slug: str):
    cfg = json.loads((PROJECTS_DIR / slug / "config.json").read_text(encoding="utf-8"))
    out_dir = RENDERS_DIR / slug
    out_dir.mkdir(parents=True, exist_ok=True)
    thumb_raw = out_dir / "_thumb_raw.png"
    thumb_final = out_dir / "thumbnail.png"

    # 1. Copy para YouTube / Shorts
    copy_prompt = f"""
Crie metadados otimizados para YouTube e Shorts em português do Brasil para o vídeo:
Título base: "{cfg['title']}"
Resumo dos atos: {' | '.join(a['narration'] for a in cfg['acts'])}

Formate em Markdown curto com:
- 3 opções de título chamativo (máx. 60 caracteres cada)
- Descrição envolvente (3 parágrafos curtos)
- 8 hashtags relevantes
"""
    copy_md, model_copy = client.chat("copy_writer", [{"role": "user", "content": copy_prompt}], max_tokens=900, temperature=0.6)
    (PROJECTS_DIR / slug / "youtube_copy.md").write_text(f"<!-- Modelo: {model_copy} -->\n\n{copy_md}\n", encoding="utf-8")
    print(f"[Copy] Salvo em {PROJECTS_DIR / slug / 'youtube_copy.md'}")

    # 2. Thumbnail 1280x720 via OmniRoute Image + ajuste exato 1280x720 no FFmpeg
    img_prompt = (
        f"YouTube thumbnail 16:9, stylized Pixar-like 3D cartoon explainer scene about '{cfg['title']}', "
        f"expressive 3D character reacting with curiosity, vibrant cinematic lighting, high contrast, "
        f"clean composition with negative space on the left, no text, no watermark."
    )
    try:
        raw_bytes, _ = client.generate_image_b64(img_prompt, size="1280x720")
        thumb_raw.write_bytes(raw_bytes)
        subprocess.run(
            [
                "ffmpeg", "-v", "error", "-y", "-i", str(thumb_raw),
                "-vf", "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720",
                "-frames:v", "1", "-update", "1", str(thumb_final),
            ],
            check=True,
        )
        thumb_raw.unlink(missing_ok=True)
        print(f"[Thumbnail] Salva em {thumb_final} (1280x720)")
    except Exception as e:
        print(f"[Thumbnail] Aviso ao gerar imagem via API ({e}) — sera possivel extrair do render se necessario.")
