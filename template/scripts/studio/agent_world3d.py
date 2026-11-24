"""
Agente 2B — Cenografo 3D.
Cria um mundo 3D tematico exclusivo em template/src/factory/worlds/<pascal>World.ts,
registra em worlds/index.ts e valida com `tsc --noEmit` (com loop de auto-correcao).
"""
import json
import re
import subprocess
import sys
from pathlib import Path

STUDIO_DIR = Path(__file__).resolve().parent
SCRIPTS_DIR = STUDIO_DIR.parent
TEMPLATE_DIR = SCRIPTS_DIR.parent
WORLDS_DIR = TEMPLATE_DIR / "src" / "factory" / "worlds"
PROJECTS_DIR = TEMPLATE_DIR / "src" / "factory" / "projects"

sys.path.insert(0, str(SCRIPTS_DIR))
sys.path.insert(0, str(STUDIO_DIR))

from new_project import slug_to_camel, slug_to_pascal
from omni_client import OmniClient, extract_code_block


def register_world_in_index(world_id: str, file_stem: str, fn_name: str):
    index_path = WORLDS_DIR / "index.ts"
    content = index_path.read_text(encoding="utf-8")
    imp_line = f"import {{{fn_name}}} from './{file_stem}';"
    if imp_line not in content:
        content = content.replace(
            "export type WorldBuilderFn",
            f"{imp_line}\n\nexport type WorldBuilderFn",
        )
    entry = f"  {world_id}: {fn_name},"
    if f"{world_id}:" not in content:
        content = content.replace(
            "// WORLD_REGISTRY_END",
            f"{entry}\n// WORLD_REGISTRY_END",
        )
    index_path.write_text(content, encoding="utf-8")


def run_tsc() -> tuple[bool, str]:
    res = subprocess.run(
        ["node", str(TEMPLATE_DIR / "node_modules" / "typescript" / "bin" / "tsc"), "--noEmit"],
        cwd=str(TEMPLATE_DIR),
        capture_output=True,
        text=True,
    )
    return res.returncode == 0, (res.stdout + "\n" + res.stderr).strip()


def run_world3d_agent(client: OmniClient, slug: str, briefing: str, feedback_fix: str | None = None):
    cfg = json.loads((PROJECTS_DIR / slug / "config.json").read_text(encoding="utf-8"))
    world_id = cfg.get("world", slug.replace("-", "_"))
    if world_id in ("office", "pix_network", "science_lab") and not feedback_fix:
        print(f"[World3D] Usando mundo pronto '{world_id}'.")
        return

    pascal = slug_to_pascal(slug)
    camel = slug_to_camel(slug)
    file_stem = f"{camel}World"
    fn_name = f"build{pascal}World"
    world_path = WORLDS_DIR / f"{file_stem}.ts"

    # Leitura curta do scienceLabWorld.ts como referencia de contratos e imports exatos
    ref_world = (WORLDS_DIR / "scienceLabWorld.ts").read_text(encoding="utf-8")

    if feedback_fix and world_path.exists():
        cur_code = world_path.read_text(encoding="utf-8")
        prompt = f"""
Corrija este arquivo TypeScript/Three.js (`{file_stem}.ts`) com base na auditoria visual ou erro abaixo:
PROBLEMA REPORTADO:
{feedback_fix}

Mantenha a assinatura exata `export function {fn_name}(scene: THREE.Scene, camera: THREE.PerspectiveCamera, config: ExplainerProjectConfig, timing: ExplainerTiming, isVertical: boolean): WorldController` e use `fitText` de `../props3d` em todas as placas/textos CanvasTexture para nunca cortar.
Retorne APENAS o código TypeScript completo dentro de ```ts ... ```.

CÓDIGO ATUAL:
```ts
{cur_code}
```
"""
    else:
        prompt = f"""
Crie um arquivo TypeScript + Three.js completo para um cenário 3D EXCLUSIVO do vídeo:
Título: "{cfg['title']}"
Briefing do Diretor: {briefing}
Atos: {json.dumps([{'id': a['id'], 'title': a['title'], 'narration': a['narration']} for a in cfg['acts']], ensure_ascii=False)}

ASSINATURAS EXATAS (NÃO INVENTE PARÂMETROS DIFERENTES):
- `export function {fn_name}(scene: THREE.Scene, camera: THREE.PerspectiveCamera, config: ExplainerProjectConfig, timing: ExplainerTiming, isVertical: boolean): WorldController`
- `WorldController`: `{{ update: (frame: number) => void; dispose: () => void }}`
- `createDesmontandoCharacter({{ shirtColor, shortsColor, hairColor, skinColor, slipperColor, hairStyle, longPants: true }})` (todos strings hex)
- `buildFaceKit(rig): FaceKit`
- `applyFace(rig, faceKit, mood: CharacterMood, frame: number, seed: number): void`
- `makeGearCluster(primaryHex: string, accentHex: string)` retorna `{{ group: THREE.Group, gearA: THREE.Group, gearB: THREE.Group }}` (adicione `gears.group` na cena e gire `gears.gearA.rotation.z` / `gears.gearB.rotation.z`)
- `fitText(ctx, text, x, y, maxWidth, maxFontPx, minFontPx)` (retorna void, já chama `ctx.fillText`)
- `roundRect(ctx, x, y, w, h, r)` (6 argumentos exatos!)
- `config.brand` tem: `primary`, `primaryDark`, `accent`, `secondary`, `danger`, `background` (NÃO existe `brand.colors`)

REGRAS OBRIGATÓRIAS:
1. Use SOMENTE imports reais existentes neste projeto:
   - `import * as THREE from 'three';`
   - `import {{RoundedBoxGeometry}} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';`
   - `import {{createDesmontandoCharacter}} from '../../shots/G1/DesmontandoRig';`
   - `import {{applyFace, blendPose, buildFaceKit, canvasTex, clamp01, FACTORY_FONT, fitText, lerp, makeGearCluster, roundRect, smooth, STAND_Y, walkCycle, type FaceKit}} from '../props3d';`
   - `import type {{CharacterConfig, CharacterMood, ExplainerProjectConfig, ExplainerTiming}} from '../types';`
   - `import type {{WorldController}} from './pixNetworkWorld';`
2. Crie um ambiente 3D visualmente rico e temático para este assunto (objetos 3D animados, iluminação, placas explicativas com `fitText` para nunca cortar texto, e câmera cinematográfica começando com um **close de gancho nos primeiros 3 segundos**!).
3. Mantenha o código enxuto e modular (até ~260 linhas, sem comentários extensos) para nunca truncar.
4. Retorne APENAS o código TypeScript completo dentro de ```ts ... ```.

REFERÊNCIA DE ESTRUTURA QUE COMPILA PERFEITAMENTE:
```ts
{ref_world}
```
"""

    messages = [{"role": "user", "content": prompt}]
    for attempt in range(1, 4):
        raw, model_used = client.chat("world_3d", messages, max_tokens=12000, temperature=0.35)
        code = extract_code_block(raw)
        world_path.write_text(code, encoding="utf-8")
        register_world_in_index(world_id, file_stem, fn_name)

        ok, err = run_tsc()
        if ok:
            print(f"[World3D] '{file_stem}.ts' compilado sem erros ({model_used}, tentativa {attempt}).")
            return
        print(f"[World3D] Erro tsc na tentativa {attempt}, pedindo correcao...")
        relevant = "\n".join(line for line in err.splitlines() if file_stem in line or "worlds/index" in line)[:1800] or err[:1800]
        messages = [
            {"role": "user", "content": f"O código gerado para `{file_stem}.ts` teve erros de TypeScript:\n{relevant}\n\nCorrija mantendo todos os imports exatos e retorne APENAS o código completo dentro de ```ts ... ```.\n\n```ts\n{code}\n```"}
        ]

    raise RuntimeError(f"World3D '{file_stem}.ts' falhou no tsc apos 3 tentativas.")
