"""
Agente 2A — Audio & Pronuncia pt-BR.
Analisa o roteiro no OmniRoute para detectar siglas/estrangeirismos,
preenche voice.pronunciation em config.json e executa build_factory_audio.py.
"""
import json
import subprocess
import sys
from pathlib import Path

STUDIO_DIR = Path(__file__).resolve().parent
SCRIPTS_DIR = STUDIO_DIR.parent
TEMPLATE_DIR = SCRIPTS_DIR.parent
PROJECTS_DIR = TEMPLATE_DIR / "src" / "factory" / "projects"

sys.path.insert(0, str(STUDIO_DIR))
from omni_client import OmniClient, extract_json_block


def run_audio_agent(client: OmniClient, slug: str):
    cfg_path = PROJECTS_DIR / slug / "config.json"
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    narrations = "\n".join(f"- {a['id']}: {a['narration']}" for a in cfg["acts"])

    prompt = f"""
Analise estas falas em português do Brasil que serão lidas pelo TTS `pt-BR-AntonioNeural`:
{narrations}

Identifique apenas siglas ou palavras estrangeiras que o TTS brasileiro costuma ler errado (ex.: "TI" -> "Tê í", "Wi-Fi" -> "Uái Fái", "DNA" -> "Dê Êne Á", "PIX" -> "Pícs").
Retorne APENAS um JSON no formato {{"pronunciation": {{"SIGLA": "escrita fonetica"}}}}. Se não houver nenhuma, retorne {{"pronunciation": {{}}}}.
"""
    try:
        raw, _ = client.chat("audio_pronunciation", [{"role": "user", "content": prompt}], max_tokens=400, temperature=0.1)
        parsed = extract_json_block(raw).get("pronunciation", {})
        if isinstance(parsed, dict) and parsed:
            cfg.setdefault("voice", {}).setdefault("pronunciation", {}).update(parsed)
            cfg_path.write_text(json.dumps(cfg, indent=2, ensure_ascii=False), encoding="utf-8")
            print(f"[AudioAgent] Pronuncias adicionadas: {parsed}")
    except Exception as e:
        print(f"[AudioAgent] Aviso ao revisar pronuncia (seguindo com dicionario padrao): {e}")

    res = subprocess.run([sys.executable, str(SCRIPTS_DIR / "build_factory_audio.py"), "--project", slug])
    if res.returncode != 0:
        raise RuntimeError(f"build_factory_audio.py falhou para '{slug}'")
