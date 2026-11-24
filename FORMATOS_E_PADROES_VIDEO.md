# Padrões de Vídeo, Formatos (YouTube & Reels), Pastas e Otimização — Stech Soluções

Documento de referência permanente do projeto para produção de vídeos explicativos 3D da **Stech Soluções** (Remotion + Three.js + FFmpeg + QA com `raea`).

---

## 1. Formatos Oficiais de Publicação

| Parâmetro | YouTube / Comercial (16:9) | Instagram Reels / TikTok / Shorts (9:16) |
|---|---|---|
| **Composição Remotion** | `StechAutomacao` (`variant="16:9"`) | `StechAutomacaoVertical` (`variant="9:16"`) |
| **Resolução & FPS** | `1920 × 1080` @ `30 FPS` (`aspect = 1.778`) | `1080 × 1920` @ `30 FPS` (`aspect = 0.5625`) |
| **Codec de Vídeo** | `H.264 (libx264)`, `yuv420p`, `-crf 17`, `-movflags +faststart` | `H.264 (libx264)`, `yuv420p`, `-crf 17`, `-movflags +faststart` |
| **Áudio Broadcast** | `AAC 192 kbps`, `44.1 kHz` Stereo, `-14 LUFS`, `TP ≤ -1.5 dBTP` | `AAC 192 kbps`, `44.1 kHz` Stereo, `-14 LUFS`, `TP ≤ -1.5 dBTP` |
| **Preset CLI (`render_stech.py`)** | `--preset youtube` | `--preset reels` |
| **Pasta de Saída** | `template/renders/<projeto>/youtube-16x9/` | `template/renders/<projeto>/reels-9x16/` |

---

## 2. Regras de Câmera 3D & Safe Zones (Por que o 9:16 NÃO pode copiar a câmera do 16:9)

No `THREE.PerspectiveCamera`, o campo `fov` é **vertical**. A largura horizontal visível a uma distância $d$ do alvo é:

$$\text{larguraVisível} = 2 \cdot d \cdot \tan\left(\frac{\text{fov}}{2}\right) \cdot \text{aspect}$$

* Em **16:9** (`aspect = 1.778`), com `fov = 40°` e `d = 6.0 m`, o quadro enxerga **`7,76 m`** de largura.
* Em **9:16** (`aspect = 0.5625`), com `fov = 48°` e `d = 6.0 m`, o quadro enxerga apenas **`3,00 m`** — menos da metade!

### Regras obrigatórias para **Instagram Reels (9:16)**:
1. **Nunca cortar personagens nem telas nas bordas:** calcular `camZ` e `fov` (`47°–58°`) para que toda estação ativa (ex.: Manual `4,1 m`, Recebimento `3,7 m`, Cozinha KDS `2,6 m`, Atendimento `6,0 m`, Gestão `2,6 m`, Panorama Stech `8,9 m`) caiba com margem lateral mínima de `0,35 m`.
2. **Usar leve ângulo 3/4 quando houver vizinhos próximos:** deslocar `camX` levemente na direção oposta ao elemento indesejado (ex.: `camX = 3.25 → lookX = 1.85` no Recebimento) para manter 100% do módulo principal dentro do quadro e 100% do módulo vizinho fora.
3. **Respeitar as Safe Zones da interface do Instagram Reels (`1080 × 1920`):**
   * **Topo (`0 – 150 px`):** reservado para barra de status e título *Reels*. Posicionar `YellowLabel3D` em `cy = 235`, `StechLogoBadge` em `cy = 232` e `StatusPillBadge` em `cy = 330 – 356`.
   * **Rodapé (`1540 – 1920 px`, últimos `380 px`):** coberto pelo avatar, `@usuario`, legenda e áudio do Instagram. Posicionar legendas dinâmicas (`StechWordSubtitles`) em `top = H - 430` (`y = 1490`), acima da área coberta.
   * **Lateral Direita (`x = 940 – 1080 px` na metade inferior):** reservada aos ícones Curtir/Comentar/Compartilhar. Manter legendas curtas (palavra por palavra) centralizadas em `x = 540`.
4. **Holds antes de transições longas:** manter pelo menos `50–60 frames` parados em cada cena antes de um movimento lateral grande para evitar sensação de chicote e alertas de flash (WCAG 2.3.1).

---

## 3. Organização Automática de Pastas de Renderização

Toda renderização gerada por `render_stech.py` ou `preview_stech_board.py` vai automaticamente para sua pasta correta em `template/renders/`:

```text
template/renders/
  <projeto>/                 # ex.: stech-automacao/
    youtube-16x9/            # Vídeos finais 16:9 (1920x1080) prontos para YouTube / comercial
    reels-9x16/              # Vídeos finais 9:16 (1080x1920) prontos para Reels / Shorts / TikTok
    previews/                # Prévias curtas (--frames) e rascunhos rápidos (--fast)
    qa/                      # Painéis de auditoria visual (16x9 e 9x16 com guias de safe zone)
  _referencias/              # Vídeos de referência aprovados (ex.: sistema_data_critica_v1.mp4)
```

**Higiene obrigatória de disco e velocidade:**
* Manter em `template/public/assets/` **apenas** a pasta do projeto ativo (atualmente `stech-automacao/`, `13,22 MB`), pois o Remotion copia todo o diretório `public/` ao criar o bundle.
* Descartar imediatamente pré-renders, testes de 5s antigos, stills soltos e assets de projetos encerrados.

---

## 4. Fluxo Rápido de Edição & Renderização (Otimizado)

1. **Auditoria instantânea de 12 cenas (Reels 9:16) ou 8 cenas (YouTube 16:9) antes de renderizar vídeo:**
   ```powershell
   python template\scripts\preview_stech_board.py --variant 9:16 --safe-guides
   python template\scripts\preview_stech_board.py --variant 16:9
   ```
   Usa o cache `.remotion-bundle` + `--gl=angle` + 4 stills paralelos (gera o painel inteiro em segundos!).
2. **Prévia rápida de trecho (5s) ou rascunho em H.264 direto (`--fast`, pula ProRes + FFmpeg):**
   ```powershell
   python template\scripts\render_stech.py --preset reels --frames 0-149 --fast --out previa_5s_reels.mp4
   python template\scripts\render_stech.py --preset reels --fast --out rascunho_reels.mp4
   ```
3. **Exportação Master definitiva (ProRes → Filtros FFmpeg → Encode único `libx264 CRF 17` + `ffprobe` + `raea check`):**
   ```powershell
   python template\scripts\render_stech.py --preset youtube --out stech_automacao_16x9_v1.mp4 --raea-check
   python template\scripts\render_stech.py --preset reels --out stech_automacao_reels_9x16_v2.mp4 --raea-check
   ```

### Otimizações de velocidade já ativas no pipeline:
* **Limpeza de `public/assets/`:** reduzido de `151,23 MB` para `13,22 MB` (-91% de I/O no bundle).
* **Cache automático `.remotion-bundle/`:** só recompila o Webpack quando algum arquivo em `src/` ou `public/` for modificado.
* **Aceleração GPU `--gl=angle` + `--concurrency=8`:** reduz um vídeo completo de 2.314 frames de ~25 min para **~5 min**.
* **Shadow map `1024 × 1024`:** 4× menos texels de sombra por frame sem perda perceptível.
* **Modo `--fast`:** elimina o passo ProRes + FFmpeg durante iterações de roteiro e câmera.

---

## 4B. Padrões Permanentes da Mini Produtora (v3 — Evolução Comercial)

Regras incorporadas em toda nova produção 3D e 2D da **Stech Soluções**:

1. **Banco de Referências Central (`banco-de-referencias/`):**
   * `marca/brand.json` + `Logo_stech.png`: fonte única dos contatos oficiais (`@stechsistemas`, `(85) 99423-1753`, `alessandrosantos.dev`) e cores da Stech.
   * `audio/trilhas/` e `audio/vozes/`: suporte automático a trilhas instrumentais livres de direitos e gravações reais de voz (com extrator `template/scripts/extract_ref_audio.py`).
   * `telas-sistemas/`, `videos/` e `ideias/`: repositório aberto para prints reais de sistemas/dashboards e referências de qualquer novo nicho.
2. **Gancho imediato no Frame 0 (`0s`):** pergunta direta de dor já visível no primeiro frame e falada em `0,08s` (sem atraso de 3s).
3. **Legendas em blocos de 3–5 palavras:** substituem palavras soltas isoladas, com destaque de cor na palavra falada e posicionamento fixo dentro da Safe Zone.
4. **Demonstração viva e replicável (`<LiveProcessCard />`):** componente genérico de etapas que mostra o software mudando de status ao vivo no espaço superior livre do 9:16 — basta trocar os textos/passos para qualquer nicho (Clínica, Oficina, Estoque, CRM, WhatsApp).
5. **Áudio natural com cadência/entonação padrão (`ref_DfVKHAJD3Gx` via `template/scripts/cadence_audio.py`):**
   * Carrega automaticamente `banco-de-referencias/audio/vozes/ref_DfVKHAJD3Gx_perfil.json` tanto no fluxo 3D quanto no fluxo 2D (`raea`).
   * **Escrita 100% oral e informal:** usar micro-frases faladas (*"olha só"*, *"aí"*, *"tá"*, *"pra"*, *"na prática"*) em vez de texto corporativo formal.
   * **Velocidade & EQ quente:** `pt-BR-AntonioNeural` em **`rate="+3%"`** + EQ de podcast (`200Hz +2.5dB`, `5.5kHz -3dB`) para eliminar o timbre metálico.
   * **Entonação natural em 4 degraus (`pitch`):** Gancho (`-3Hz`) → Corpo conversacional (`-5Hz`) → Clímax/Prova (`-1Hz`) → CTA grave (`-9Hz`).
   * **Pausas bem marcadas:** `0,22s` (micro), `0,48s` (entre frases) e **`0,68s` / `0,56s`** (gancho e viradas), com trilha instrumental contínua (~`-19 dB` sob a voz) + `loudnorm` 2 passes + `alimiter` (`-14 LUFS`, `TP ≤ -1,6 dBTP`, **ZERO clipping**).
6. **Benefícios reais sem promessas absolutas:** evitar `"sem erros"` / `"perfeito"`, usando `"Pedidos centralizados em um só lugar"`, `"Mais controle sobre cada pedido"`, `"Salão e cozinha conectados"`, `"Da entrada do pedido ao caixa"`.
7. **Tela Final Comercial Padrão Stech (`3,5–4,2s`):** Logo oficial + `"SUA EMPRESA. SEUS PROCESSOS. NOSSA TECNOLOGIA."` + botão `"FALE COM A STECH →"` + Instagram, WhatsApp e site legíveis.

---

## 5. Análise Técnica Profunda: O que o projeto `raea` (`v0.1.8`) agrega ao nosso fluxo

O `raea` (*Render Anything Engine*, já instalado em `C:\Users\Alessandro\.raea\bin\raea.exe`, versão `0.1.8`) é uma engine nativa em Rust + Bevy 0.20 + wgpu (DirectX 12 / Vulkan / Metal) que executa composições React/TypeScript (API muito próxima do Remotion: `AbsoluteFill`, `Composition`, `interpolate`, `useCurrentFrame`) e também cenas Three.js / React Three Fiber (`<Three program>` e `<R3F>`).

### O que já agrega valor IMEDIATO hoje (sem migrar nada)
1. **Auditoria automatizada de qualidade (`raea check`):** Já integrada via `--raea-check` no `render_stech.py`. Na prática, em 3 segundos ela encontrou no nosso vídeo real:
   * Confirmação exata de loudness (`-14.0 LUFS`, `-1.5 dBTP`), ausência de frames congelados e de silêncio morto.
   * **Clipping de áudio (`flat-topped runs`)** causado pelo `np.clip` após somar SFX no áudio já normalizado (já corrigido em `build_stech_audio.py` com headroom + `alimiter`).
   * Alerta de **flash rápido (WCAG 2.3.1)** em transições de câmera sem hold e detecção de **blotching** em áreas escuras.
2. **Utilitários nativos de mídia (`raea media`):** `probe`, `still`, `sheet`, `loudness`, `cuts`, `freezes` em um único binário.
3. **Exportação editável por camadas (CapCut / Premiere / DaVinci Resolve):** `raea export capcut` e `raea export xml` geram projetos abertos com legendas em trilha separada e overlays transparentes — excelente caso você queira fazer ajustes manuais finais no CapCut ou Premiere sem re-renderizar o 3D.
4. **Licenciamento Comercial favorável (`FSL-1.1-ALv2`):** Diferente do template público *anything2explainer* (*PolyForm Noncommercial 1.0.0*) e do Remotion (gratuito apenas até 3 pessoas), o `raea` permite uso comercial gratuito em vídeos de clientes e agências (só proíbe criar um concorrente direto do próprio `raea`), virando Apache-2.0 após 2 anos.
5. **Efeitos sonoros locais por IA (`raea sao`) e `raea scene lint`:** Substitui SFX simples de ondas senoidais por foley realista gerado localmente e detecta automaticamente objetos 3D flutuando ou colidindo (`scene lint`).

### Benchmark real medido nesta máquina (`AMD Ryzen 7 5700U` + `AMD Radeon Graphics`, Windows)
* **Motion graphics 2D (`hello.tsx`, 90 frames @ 1080p):** `26,2 ms/frame` (~38 FPS, mais rápido que tempo real após aquecimento; `31,9s` totais com inicialização fria).
* **Cena 3D PBR (`turntable.tsx`, 90 frames @ 1080×1080):** `251,8 ms/frame` (~4 FPS; `47,73s` totais incluindo ~25s de compilação fria de shaders DX12).

### Limitações atuais do `raea` no Windows (por que NÃO abandonar Remotion ainda)
1. **Render 3D completo mais lento no Windows hoje:** Como `raea` ainda renderiza em processo único (sem paralelismo interno multi-worker, item `S3` do roadmap `docs/rerender.md`) e sem render parcial por faixa (`--frames A-B`), 2.314 frames 3D em processo único levariam ~9–10 min, enquanto o Remotion otimizado com `--gl=angle --concurrency=8` já fecha em **~5 min**.
2. **Encoder no Windows ainda é CPU (`openh264` Constrained Baseline + Opus):** Aceleração por hardware Media Foundation (item `S5`) ainda não foi implementada no Windows (só VideoToolbox no macOS). Portanto, para entrega profissional YouTube/Reels no Windows, ainda exige re-encode via FFmpeg `libx264` + `AAC`.
3. **Sem suporte a troca de look/câmera por cena complexa nem Character SDK pronto:** O `Character SDK` chega em versões futuras (`0.1.8.md`) e nosso rig articulado (`DesmontandoRig.ts`) já funciona com estabilidade total no Three.js + Remotion.

### Estratégia recomendada (Melhor dos 2 mundos)
* **Curto prazo (agora):** Manter **Remotion + Three.js + FFmpeg** (já otimizado para ~5 min e 30s de painel QA) para vídeos 3D articulados, usando **`raea check`** e **`raea media`** como esteira obrigatória de QA de broadcast, e **`raea`** puro para vídeos **2D / motion graphics / UI de software da Stech** (onde ele roda a ~38 FPS e tem licença comercial livre!).
* **Médio prazo (quando `raea` entregar `S2`/`S3`/`S5` — cache incremental por cena, paralelismo e encoder Media Foundation no Windows):** Migrar os dioramas Three.js via `<Three program>` / `<R3F>` para renderizar tudo nativamente na GPU sem Chromium e exportar projetos editáveis direto para CapCut/Premiere.

