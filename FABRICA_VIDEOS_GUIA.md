# Fábrica de Vídeos 3D — Guia Rápido

Este projeto agora conta com um **motor 3D parametrizado** (`template/src/factory/`) que gera vídeos explicativos e de **curiosidades** com bonecos 3D articulados, expressões faciais, caminhada, câmera cinematográfica e narração **`pt-BR-AntonioNeural`** (mesma voz de *Data Crítica*) em **YouTube (16:9)** e **Reels/Shorts (9:16)** — sem precisar escrever código TypeScript para cada novo vídeo.

---

## Como criar e renderizar um vídeo novo em 2 comandos

### 1. Criar a pasta do projeto
Para um vídeo de **curiosidade** (ambiente laboratório + engrenagens 3D):
```powershell
python template\scripts\new_project.py como-funciona-o-wifi --preset curiosity --title "Como o Wi-Fi atravessa paredes?"
```

Para um vídeo **corporativo/processo** (ambiente escritório moderno):
```powershell
python template\scripts\new_project.py novo-processo --preset corporate --title "Novo Processo" --brand "Grupo Centerbox"
```

Isso cria `template/src/factory/projects/<slug>/config.json` e registra automaticamente as composições `<Slug>` (16:9) e `<Slug>Reels` (9:16).

### 2. Editar o roteiro e os textos em `config.json`
Abra `template/src/factory/projects/<slug>/config.json` e ajuste:
- `world`: escolhe o cenário 3D temático completo:
  - `"pix_network"` — Cidade noturna 3D, prédios de bancos, smartphones gigantes, autoestrada de fibra óptica e núcleo holográfico (ótimo para tecnologia/finanças/redes).
  - `"science_lab"` — Laboratório científico escuro com quadro-negro, bancadas com frascos luminosos, átomo 3D em órbita e jalecos (ótimo para curiosidades de física/química/biologia).
  - `"office"` — Escritório corporativo moderno (estilo Centerbox) com piso de madeira, janelas e estantes.
- `hook`: gancho visual de alto impacto nos primeiros 3 segundos (`eyebrow`, `headline`, `stopwatchTargetSec`, `badgeText`) para prender a atenção logo no frame 0!
- `environment`: `"office"`, `"lab"` ou `"studio"` (usado quando `world: "office"`)
- `brand`: paleta de cores e logo opcional (`logoAsset`)
- `voice.pronunciation`: mapa de pronúncia pt-BR (já inclui `TI → Tê í`, `PIX → Pícs`, `API → Á Pê Í`, `IA → Í Á`, `Wi-Fi → Uái Fái`, etc., mantendo a grafia original nas legendas!)
- `leftBoard`, `compareWall`, `step1Screen`, `coreHub` (`"pillar"` ou `"gears"`), `rightScreen`
- `characters`: cores de roupa, cabelo, papel (`left_desk`, `walker`, `core_desk`, `right_desk`) e humor por ato (`worried`, `neutral`, `happy`, `joy`)
- `acts`: narração, pausa após o ato, efeito sonoro (`whoosh`, `beep`, `chime`), preset de câmera (`drone_to_left`, `focus_core`, `walker_to_step1`, `focus_right`, `orbit_core`, `wide_finale`) e `overlayCard` opcional (contador animado, destaque ou checklist).

### 3. Gerar áudio, validar e renderizar tudo em 1 comando
**YouTube 16:9 (`1920x1080`):**
```powershell
python template\scripts\render_factory.py --project como-funciona-o-pix --format youtube --qa-sheet
```

**Reels/Shorts 9:16 (`1080x1920`):**
```powershell
python template\scripts\render_factory.py --project como-funciona-o-pix --format reels --qa-sheet
```

**Ambos os formatos de uma vez:**
```powershell
python template\scripts\render_factory.py --project como-funciona-o-pix --format both --qa-sheet
```

> Use `--fast` para gerar rascunho rápido (sem ProRes) e `--skip-audio` se alterou apenas o visual/câmera.

---

## Onde ficam os arquivos gerados
- **Configuração & Timings:** `template/src/factory/projects/<slug>/config.json` e `timing.json`
- **Áudio master:** `template/public/assets/<slug>/master_audio_sfx.wav`
- **Vídeos finais + Contact Sheet QA:** `template/renders/<slug>/youtube-16x9/` e `template/renders/<slug>/reels-9x16/`

---

## Modo Automático por Agentes (OmniRoute)

Para criar um vídeo completo do zero (roteiro, mundo 3D exclusivo, áudio `pt-BR-AntonioNeural`, thumbnail `1280x720`, copy YouTube e auditoria visual) consumindo os modelos do seu OmniRoute:

```powershell
python template\scripts\studio_orchestrator.py --topic "Por que o gelo flutua?" --format youtube
```

Opções úteis:
- `--format both`: gera YouTube 16:9 + Reels 9:16 + `thumbnail.png`
- `--pause-script`: pausa após o Diretor gerar `config.json` para revisão antes do paralelo
- `--batch temas.txt`: processa vários temas em lote (agentes em paralelo + fila de render 1 por vez)
- `--fast`: render rápido H.264 para prévia

## Rollback / Cópia de Segurança
Um snapshot completo (`template/src`, `template/scripts`, `.gitignore`, `FABRICA_VIDEOS_GUIA.md`) foi salvo em `backups/pre-miniprodutora/`. Para restaurar a qualquer momento:
```powershell
python template\scripts\rollback_studio.py --confirm
```
