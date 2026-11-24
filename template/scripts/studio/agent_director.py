"""
Agente 1 — Diretor & Roteirista.
Transforma um tema de curiosidade ou processo corporativo em:
  - config.json completo (gancho 0-3s, 5 atos em pt-BR, personagens, cards, cores)
  - briefing_3d.txt para o Agente Cenografo 3D construir um mundo exclusivo.
"""
import json
import re
import sys
from pathlib import Path

STUDIO_DIR = Path(__file__).resolve().parent
SCRIPTS_DIR = STUDIO_DIR.parent
TEMPLATE_DIR = SCRIPTS_DIR.parent
PROJECTS_DIR = TEMPLATE_DIR / "src" / "factory" / "projects"

sys.path.insert(0, str(SCRIPTS_DIR))
sys.path.insert(0, str(STUDIO_DIR))

from new_project import rebuild_registry, slug_to_pascal
from omni_client import OmniClient, extract_json_block


def slugify(text: str) -> str:
    rep = str.maketrans("áàâãéèêíìîóòôõúùûçÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ", "aaaaeeeiiioooouuucAAAAEEEIIIOOOOUUUC")
    s = text.translate(rep).lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:42].strip("-") or "novo-video"


def run_director(
    client: OmniClient,
    topic: str,
    slug: str | None = None,
    preset: str = "curiosity",
    world_mode: str = "custom",
) -> tuple[Path, str]:
    slug = slug or slugify(topic)
    comp_id = slug_to_pascal(slug)
    world_id = slug.replace("-", "_") if world_mode == "custom" else world_mode

    schema_prompt = f"""
Você é o Diretor Criativo e Roteirista de uma miniprodutora de vídeos 3D explicativos em português do Brasil (estilo "Desmontando o Mundo" / "Data Crítica").
Tema solicitado: "{topic}"
Preset: "{preset}"

Crie um roteiro envolvente em **5 atos** (~50 a 70 segundos totais), com **GANCHO VISUAL nos primeiros 3 segundos**, linguagem clara, natural e sem exageros.
REGRAS RÍGIDAS DE TIPOGRAFIA (para nunca cortar texto):
- `acts[i].title`: MÁXIMO 22 caracteres (ex.: "O MISTÉRIO DO GELO")
- `acts[i].badge`: MÁXIMO 36 caracteres (ex.: "POR QUE NÃO AFUNDA NO COPO?")
- `leftBoard.title`: MÁXIMO 24 chars | `leftBoard.headline`: MÁXIMO 16 chars | `leftBoard.subline`: MÁXIMO 34 chars
- `compareWall.header`: MÁXIMO 38 chars | linhas dos cards: MÁXIMO 22 chars
- `hook.eyebrow`: MÁXIMO 38 chars | `hook.headline`: MÁXIMO 26 chars | `hook.badgeText`: MÁXIMO 30 chars
- `acts[i].narration`: português do Brasil natural, números por extenso (ex.: "zero grau", "noventa por cento", "dois segundos") para a voz ler perfeitamente.
- IMPORTANTE: Nunca use aspas duplas (") dentro dos valores de texto do JSON (use apenas apóstrofo simples se precisar).

Retorne APENAS um JSON válido com esta estrutura exata:
{{
  "title": "Título curto e forte do vídeo",
  "tagline": "CURIOSIDADES • POR DENTRO DA CIÊNCIA",
  "environment": "lab",
  "brand": {{
    "name": "POR DENTRO DA CIÊNCIA",
    "primary": "#0E7490",
    "primaryDark": "#082F49",
    "accent": "#F97316",
    "secondary": "#2563EB",
    "danger": "#DC2626",
    "background": "#0B192C",
    "stripeColors": ["#0E7490", "#2563EB", "#F97316", "#22C55E"]
  }},
  "hook": {{
    "eyebrow": "FRASE CURTA DE CURIOSIDADE",
    "headline": "PERGUNTA OU FATO DE IMPACTO",
    "stopwatchTargetSec": 3.0,
    "badgeText": "SELO DO GANCHO",
    "durationFrames": 95
  }},
  "leftBoard": {{
    "title": "SENSO COMUM",
    "headline": "AFUNDA?",
    "subline": "Maioria dos sólidos afunda"
  }},
  "compareWall": {{
    "header": "COMPARAÇÃO VISUAL",
    "left": {{"eyebrow": "OUTROS SÓLIDOS", "line1": "Mais densos", "line2": "Afundam rápido", "footer": "Moléculas juntas"}},
    "right": {{"eyebrow": "GELO NA ÁGUA", "line1": "Menos denso", "line2": "Flutua no topo", "footer": "Rede de hexágonos"}}
  }},
  "step1Screen": {{
    "header": "Experimento 1",
    "subtitle": "Subtítulo curto do experimento",
    "leftMetric": {{"label": "Métrica A", "value": "1,00 g/cm³"}},
    "rightMetric": {{"label": "Métrica B", "value": "0,92 g/cm³", "accent": true}},
    "footerNote": "Explicação em 1 frase curta",
    "buttonText": "Testar agora",
    "confirmedHeader": "Resultado",
    "confirmedTitle": "Confirmado!",
    "confirmedSubtitle": "Detalhe curto do resultado",
    "switchAtActIndex": 2,
    "switchAtProgress": 0.72
  }},
  "coreHub": {{
    "titleLines": ["NÚCLEO", "DO", "FENÔMENO"],
    "badge": "COMO FUNCIONA",
    "items": ["Item 1 curto", "Item 2 curto", "Item 3 curto", "Item 4 curto"],
    "visualStyle": "gears"
  }},
  "rightScreen": {{
    "header": "Conclusão Prática",
    "rows": [
      {{"label": "Fato 1", "value": "Valor 1", "positive": true}},
      {{"label": "Fato 2", "value": "Valor 2", "positive": true}},
      {{"label": "Fato 3", "value": "Valor 3", "positive": true}},
      {{"label": "Fato 4", "value": "Valor 4", "positive": true}}
    ],
    "buttons": ["CONFIRMADO", "DETALHES", "RESUMO"],
    "approvedButtonLabel": "✓ EXPLICADO",
    "stampText": "ENTENDIDO",
    "approveAtActIndex": 3,
    "approveAtProgress": 0.5
  }},
  "acts": [
    {{
      "id": "ato1",
      "title": "ATO 1",
      "badge": "BADGE CURTO ATO 1",
      "badgeColor": "#DC2626",
      "narration": "Texto falado do ato 1 (2 frases curtas).",
      "pauseAfterSec": 1.1,
      "sfx": "whoosh",
      "cameraPreset": "drone_to_left",
      "overlayCard": {{
        "side": "right",
        "accentColor": "#DC2626",
        "eyebrow": "DADO DE IMPACTO",
        "headline": "VALOR CURTO",
        "subline": "Explicação curta"
      }}
    }},
    {{"id": "ato2", "title": "ATO 2", "badge": "BADGE ATO 2", "badgeColor": "#2563EB", "narration": "...", "pauseAfterSec": 1.1, "sfx": "beep", "cameraPreset": "focus_core"}},
    {{"id": "ato3", "title": "ATO 3", "badge": "BADGE ATO 3", "badgeColor": "#F97316", "narration": "...", "pauseAfterSec": 1.1, "sfx": "whoosh", "cameraPreset": "walker_to_step1"}},
    {{"id": "ato4", "title": "ATO 4", "badge": "BADGE ATO 4", "badgeColor": "#0E7490", "narration": "...", "pauseAfterSec": 1.1, "sfx": "beep", "cameraPreset": "focus_right", "overlayCard": {{"side": "left", "accentColor": "#0E7490", "eyebrow": "RESUMO RÁPIDO", "checklist": ["Passo 1", "Passo 2", "Passo 3", "Passo 4"]}}}},
    {{"id": "ato5", "title": "ATO 5", "badge": "BADGE ATO 5", "badgeColor": "#16A34A", "narration": "Pronto! Agora você sabe ...!", "pauseAfterSec": 0.0, "sfx": "chime", "cameraPreset": "wide_finale"}}
  ],
  "worldBriefing": "Descrição detalhada do cenário 3D temático exclusivo para este vídeo (elementos visuais, iluminação, objetos centrais animados e o que acontece nos primeiros 3 segundos de gancho)."
}}
"""
    data = None
    model_used = ""
    messages = [{"role": "user", "content": schema_prompt}]
    for attempt in range(1, 3):
        raw, model_used = client.chat("director", messages, max_tokens=4096, temperature=0.35)
        try:
            data = extract_json_block(raw)
            break
        except json.JSONDecodeError as e:
            print(f"[Diretor] JSON invalido na tentativa {attempt} ({e}), pedindo correcao...")
            messages = [
                {"role": "user", "content": f"O JSON abaixo teve erro de sintaxe ({e}). Corrija e retorne APENAS o JSON válido, sem texto fora do JSON:\n\n{raw}"}
            ]
    if data is None:
        raise RuntimeError("Diretor nao retornou JSON valido apos 2 tentativas.")
    world_briefing = data.pop("worldBriefing", f"Cenário 3D temático exclusivo para: {topic}")

    brand = data.get("brand") or {
        "name": "POR DENTRO DA CIÊNCIA",
        "primary": "#0E7490",
        "primaryDark": "#082F49",
        "accent": "#F97316",
        "secondary": "#2563EB",
        "danger": "#DC2626",
        "background": "#0B192C",
        "stripeColors": ["#0E7490", "#2563EB", "#F97316", "#22C55E"],
    }
    cfg = {
        "slug": slug,
        "compositionId": comp_id,
        "title": data.get("title", topic),
        "tagline": data.get("tagline", "CURIOSIDADES • POR DENTRO DA CIÊNCIA"),
        "world": world_id,
        "hook": data.get("hook"),
        "environment": data.get("environment", "lab"),
        "brand": brand,
        "voice": {"voice": "pt-BR-AntonioNeural", "rate": "+4%", "pronunciation": {}},
        "dataFlowStartAct": 1,
        "flyingPapersUntilAct": 1,
        "leftBoard": data.get("leftBoard") or {"title": "SENSO COMUM", "headline": "DÚVIDA", "subline": topic[:34]},
        "compareWall": data.get("compareWall") or {
            "header": "COMPARAÇÃO VISUAL",
            "left": {"eyebrow": "ANTES", "line1": "Padrão", "line2": "Comum", "footer": "Sem detalhe"},
            "right": {"eyebrow": "AGORA", "line1": "Explicado", "line2": "Na prática", "footer": "Por dentro"},
        },
        "step1Screen": data.get("step1Screen") or {
            "header": "Experimento 1",
            "subtitle": topic[:36],
            "leftMetric": {"label": "Métrica A", "value": "1,00"},
            "rightMetric": {"label": "Métrica B", "value": "0,92", "accent": True},
            "footerNote": "Comparação direta",
            "buttonText": "Testar agora",
            "confirmedHeader": "Resultado",
            "confirmedTitle": "Confirmado!",
            "confirmedSubtitle": "Visualizado em 3D",
            "switchAtActIndex": 2,
            "switchAtProgress": 0.72,
        },
        "coreHub": data.get("coreHub") or {"titleLines": ["NÚCLEO", "DO", "TEMA"], "badge": "POR DENTRO", "items": ["Passo 1", "Passo 2", "Passo 3", "Passo 4"], "visualStyle": "gears"},
        "rightScreen": data.get("rightScreen") or {
            "header": "Conclusão",
            "rows": [{"label": "Fato", "value": "Confirmado", "positive": True}],
            "buttons": ["CONFIRMADO", "DETALHES", "RESUMO"],
            "approvedButtonLabel": "✓ EXPLICADO",
            "stampText": "ENTENDIDO",
            "approveAtActIndex": 3,
            "approveAtProgress": 0.5,
        },
        "characters": [
            {"id": "curioso", "role": "left_desk", "shirtColor": "#94A3B8", "pantsColor": "#334155", "hairColor": "#1C1917", "skinColor": "#C68A5C", "hairStyle": "short", "moodsByAct": ["worried", "neutral", "happy", "happy", "joy"]},
            {"id": "especialista", "role": "core_desk", "shirtColor": brand.get("secondary", "#2563EB"), "pantsColor": "#0F172A", "hairColor": "#1E1B18", "skinColor": "#E8B486", "hairStyle": "quiff", "moodsByAct": ["neutral", "joy", "happy", "happy", "joy"]},
            {"id": "protagonista", "role": "walker", "shirtColor": brand.get("accent", "#F97316"), "pantsColor": "#1E293B", "hairColor": "#2A1B12", "skinColor": "#E8B486", "hairStyle": "quiff", "walkActIndex": 2, "moodsByAct": ["worried", "neutral", "happy", "happy", "joy"]},
            {"id": "observador", "role": "right_desk", "shirtColor": brand.get("primary", "#0E7490"), "pantsColor": "#0F172A", "hairColor": "#3B1F0E", "skinColor": "#F1C9A5", "hairStyle": "bob", "moodsByAct": ["neutral", "neutral", "happy", "happy", "joy"]},
        ],
        "acts": data["acts"],
    }

    proj_dir = PROJECTS_DIR / slug
    proj_dir.mkdir(parents=True, exist_ok=True)
    (proj_dir / "config.json").write_text(json.dumps(cfg, indent=2, ensure_ascii=False), encoding="utf-8")
    if not (proj_dir / "timing.json").exists():
        (proj_dir / "timing.json").write_text(
            json.dumps({"total_frames": 300, "act_starts": {a["id"]: i * 60 for i, a in enumerate(cfg["acts"])}, "words": []}, indent=2),
            encoding="utf-8",
        )
    (proj_dir / "briefing_3d.txt").write_text(f"Modelo Diretor: {model_used}\n\n{world_briefing}\n", encoding="utf-8")
    rebuild_registry()
    print(f"[Diretor] Projeto '{slug}' criado em {proj_dir} ({comp_id})")
    return proj_dir, world_briefing
