"""
Agente 3 — Auditor Visual & Tipografico (Vision QA).
Envia o contact sheet 3x2 (*_qa_sheet.png) para o modelo Vision no OmniRoute
para detectar letreiros cortados, textos sobrepostos ou enquadramento ruim.
"""
import base64
import json
import sys
from pathlib import Path

STUDIO_DIR = Path(__file__).resolve().parent
SCRIPTS_DIR = STUDIO_DIR.parent
TEMPLATE_DIR = SCRIPTS_DIR.parent
PROJECTS_DIR = TEMPLATE_DIR / "src" / "factory" / "projects"

sys.path.insert(0, str(STUDIO_DIR))
from omni_client import OmniClient, extract_json_block


def run_qa_vision_agent(client: OmniClient, slug: str, sheet_path: Path) -> tuple[bool, str]:
    b64_img = base64.b64encode(sheet_path.read_bytes()).decode("ascii")
    prompt = """
Você é o Auditor Visual de uma produtora de vídeos 3D em português do Brasil.
Analise este contact sheet 3x2 (6 quadros do vídeo) verificando rigorosamente:
1. Algum letreiro 3D, placa de parede, botão ou tela teve palavra cortada ou vazando?
2. Algum card ou HUD (topo esquerdo/direito) está cobrindo texto importante ou rosto de personagem?
3. As legendas na parte inferior estão legíveis e sem corte?

Responda APENAS um JSON válido:
{
  "verdict": "PASS" ou "FAIL",
  "issues": ["lista curta e objetiva dos problemas encontrados, ou vazia se PASS"],
  "fix_hint": "instrução técnica curta para corrigir, ou vazia se PASS"
}
"""
    raw, model_used = client.chat(
        "qa_vision",
        [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64_img}"}},
                ],
            }
        ],
        max_tokens=2000,
        temperature=0.1,
    )

    try:
        res = extract_json_block(raw)
        verdict = str(res.get("verdict", "PASS")).upper() == "PASS"
        issues = res.get("issues", [])
        fix_hint = res.get("fix_hint", "")
    except Exception:
        verdict = "FAIL" not in raw.upper()
        issues = [raw]
        fix_hint = raw

    report_lines = [
        f"# QA Visual — {slug}",
        f"- **Modelo Auditor:** `{model_used}`",
        f"- **Veredito:** `{'PASS' if verdict else 'FAIL'}`",
        f"- **Contact Sheet:** `{sheet_path.name}`",
        "",
        "## Achados",
    ]
    if issues:
        report_lines.extend(f"- {it}" for it in issues)
    else:
        report_lines.append("- Nenhum corte de letreiro, sobreposição de HUD ou erro de legenda encontrado.")
    if fix_hint:
        report_lines.extend(["", "## Sugestão de Correção", fix_hint])

    report_path = PROJECTS_DIR / slug / "qa_report.md"
    report_path.write_text("\n".join(report_lines) + "\n", encoding="utf-8")
    print(f"[VisionQA] Veredito={'PASS' if verdict else 'FAIL'} -> {report_path}")
    return verdict, fix_hint or "; ".join(str(x) for x in issues)
