# Roteiro & Blueprint Oficial de Produção — Stech Soluções (Automação Empresarial)

---

## 1. Ficha Técnica & Pipeline de Engenharia Audiovisual

* **Composições Remotion:**
  * Horizontal (YouTube / Apresentações Comerciais): `StechAutomacao` (`1920 x 1080` @ `30 FPS`)
  * Vertical (Reels / TikTok / Shorts — câmera e layout independentes): `StechAutomacaoVertical` (`1080 x 1920` @ `30 FPS`)
* **Duração Total:** `77,13 segundos` (`2.314 frames`)
* **Stack & Versões Utilizadas:**
  * **React** (`19.2.8`) + **TypeScript** (`5.9.3`)
  * **Remotion** (`4.0.507`) — Nota: há versões mais recentes no npm (`4.0.545`); manter `remotion` e todos os pacotes `@remotion/*` sempre alinhados ao atualizar.
  * **Three.js** (`0.186.1`) + `RoundedBoxGeometry` (`PCFSoftShadowMap` `1024x1024`, `ACESFilmicToneMapping`, exposição `1.22`) acelerado por GPU via ANGLE (`--gl=angle --concurrency=8`).
  * **Edge-TTS (`pt-BR-AntonioNeural`, `rate="+18%"`):** `235` palavras sincronizadas frame a frame via `WordBoundary` (`stechWords.ts`).
  * **Python + NumPy + FFmpeg (2-Pass Loudnorm + Master Único):**
    1. **Masterização de Áudio em 2 Passes (`build_stech_audio.py`):** `highpass=f=75,acompressor=threshold=-18dB:ratio=2.2:attack=10:release=120` + medição Pass 1 (`loudnorm` JSON) + aplicação linear Pass 2 (`I=-14 LUFS`, `TP=-1.5 dBTP`, `LRA=9`).
    2. **SFX Procedurais:** `make_whoosh`, `make_pop`, `make_kds_beep`, `make_punch_boom` e `make_success_chime` mixados exatamente nos frames dos eventos (`STECH_CUES`).
    3. **Codificação Única Sem Dupla Perda H.264 (`render_stech.py`):** Remotion gera master intermediário intra-frame `ProRes` (`--codec=prores --prores-profile=standard --gl=angle --muted --concurrency=8`), FFmpeg do sistema aplica `unsharp=5:5:0.38:5:5:0.0,vibrance=intensity=0.12,vignette=PI/12` e envia stream `rawvideo` (`-f matroska -pix_fmt yuv420p -`) para o `ffmpeg.exe` embarcado do Remotion fazer uma **única codificação definitiva `libx264`** (`-crf 17 -preset medium -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart`).
    4. **Controle de Qualidade Automático (`ffprobe`):** Valida resolução, `30/1 FPS`, `h264 (yuv420p)`, áudio `aac 44100 Hz`, duração e integridade do arquivo.
* **Desempenho & Entregáveis Finais Renderizados (Pastas Organizadas):**
  * Guia de padrões, safe zones, câmera e fluxo rápido: `FORMATOS_E_PADROES_VIDEO.md`
  * Otimizações ativas: limpeza de `public/assets` (`151,23 MB → 13,22 MB`), cache automático `.remotion-bundle/`, `--gl=angle --concurrency=8`, sombras `1024×1024` e modo `--fast` para rascunhos.
  * Auditoria visual rápida (12 cenas 9:16 com guias de Safe Zone): `30,3s` em `template/renders/stech-automacao/qa/painel_stech_atos_9x16.jpg`.
  * **Horizontal YouTube 16:9:** `template/renders/stech-automacao/youtube-16x9/stech_automacao_16x9_v1.mp4` (`1920×1080`, `30 FPS`, `77,13s`, `53,01 MB`, render em `4m 57s`).
  * **Vertical Instagram Reels 9:16 (v2 — revisado sem cortes + Safe Zones):** `template/renders/stech-automacao/reels-9x16/stech_automacao_reels_9x16_v2.mp4` (`1080×1920`, `30 FPS`, `77,13s`, `31,23 MB`, render completo + FFmpeg + QA em `248,9s` / `4m 08s`).

> **Nota sobre Licenciamento Comercial:**
> O projeto-base público *anything2explainer* utiliza licença *PolyForm Noncommercial 1.0.0* (exige autorização prévia do autor para uso comercial ou reescrita própria dos scripts/templates). Além disso, o Remotion possui licença gratuita apenas para indivíduos e equipes de até 3 pessoas. Antes de distribuir campanhas comerciais em escala, valide ambos os licenciamentos.

---

## 2. Fala Completa (Texto Integral para Copiar)

> O problema do seu restaurante talvez não seja falta de clientes, mas na maneira como você administra cada pedido. Enquanto um depende de papel e memória, o outro conecta pedidos, cozinha e caixa. É por isso que a Stech desenvolve sistemas sob medida para melhorar o funcionamento da sua empresa.
>
> No modelo manual, o garçom anota no papel, leva até o balcão, e qualquer detalhe esquecido vira pedido trocado. Com a automação, o pedido é lançado no celular ou no terminal e entra organizado em uma fila central, sem papel acumulado.
>
> Na cozinha, comanda de papel se perde, mancha e atrasa o preparo. No sistema da Stech, cada pedido aparece na hora na tela da cozinha, com ordem de chegada, observações e tempo de preparo em destaque.
>
> Quando o cliente pergunta se o prato está pronto, ninguém precisa correr atrás da cozinha. A equipe acompanha o status em tempo real e entrega na hora certa, com salão e balcão falando a mesma língua.
>
> E na hora de fechar o dia, nada de somar papel por papel no caderno. O painel de gestão reúne pedidos, controle de estoque e relatórios completos de vendas para você decidir com clareza.
>
> Do pedido na mesa ao controle do caixa, tudo funciona integrado e sem retrabalho. Quer organizar os processos da sua empresa e trabalhar com mais eficiência? Fale com a Stech. Criamos sistemas sob medida para o seu negócio.

---

## 3. Decupagem Completa: Abertura (0–16s) + 6 Atos Operacionais

### Abertura / Ato 1 — Dor → Contraste → Conexão → Stech Soluções (`f0 – f486` | `0.0s – 16.2s`)
* **0s–4.4s (`f0–f131`) — O Problema:**
  * *Fala:* `"O problema do seu restaurante talvez não seja falta de clientes..."`
  * *Texto na tela:* `O PROBLEMA PODE ESTAR NA OPERAÇÃO!`
  * *Visual 3D:* Abertura ampla 16:9 sem cortes nas bordas (`pos [-0.15, 2.75, 10.15]`, `fov 42`). À esquerda: cliente esperando com expressão triste (`mouthFrown`), balcão cinza com pilha de comandas de papel espalhadas e badge `X` vermelho, atendente e chef preocupados (`standing_worried`). À direita: cliente satisfeito, garçom com tablet e sistema integrado já visível.
* **4.4s–6.3s (`f131–f188`) — O Contraste:**
  * *Fala:* `"...mas na maneira como você administra cada pedido."`
  * *Texto na tela:* `NO IMPROVISO × COM AUTOMAÇÃO`
  * *Câmera:* Move suavemente (`pos [0.25, 2.65, 9.65] → [2.1, 2.45, 7.65]`) destacando os dois modelos em paralelo.
* **6.3s–11.8s (`f188–f356`) — A Transformação:**
  * *Fala:* `"Enquanto um depende de papel e memória, o outro conecta pedidos, cozinha e caixa."`
  * *Texto na tela:* `TUDO CONECTADO. MENOS RETRABALHO.`
  * *Efeitos 3D (`f180+`):* Ativação dos **3 Dutos Luminosos (`CatmullRomCurve3`)** com esferas amarelas e verdes trafegando do Terminal de Recebimento (`x=3.25`) → Tela KDS Cozinha (`x=5.05`) → Painel de Gestão (`x=8.05`).
* **11.8s–16.2s (`f356–f486`) — Apresentação da Stech Soluções:**
  * *Fala:* `"É por isso que a Stech desenvolve sistemas sob medida para melhorar o funcionamento da sua empresa."`
  * *Texto na tela:* `STECH SOLUÇÕES` + pílula `Sistemas sob medida para negócios que querem evoluir.`
  * *Câmera:* Aproxima do lado automatizado com a placa corporativa `STECH SOLUÇÕES` (`pos [4.6, 2.35, 6.8]`).

### Ato 2 — Recebimento: Manual vs. Entrada Centralizada (`f487 – f881` | `16.2s – 29.4s`)
* *Fala:* `"No modelo manual, o garçom anota no papel, leva até o balcão, e qualquer detalhe esquecido vira pedido trocado. Com a automação, o pedido é lançado no celular ou no terminal e entra organizado em uma fila central, sem papel acumulado."`
* *Cues:* `f_recebimento: 501`, `f_fila_central: 689`
* *Câmera 16:9:* Close no balcão manual (`pos [-3.5, 2.08, 4.75]`) → Travelling suave para o módulo de Recebimento Stech (`pos [2.55, 2.08, 4.6]`).
* *Visual 3D & Tela:* Garçom lançando no celular ao lado do totem `RECEBIMENTO • STECH (PEDIDO #104 • MESA 03 ✓ ENVIADO P/ COZINHA)`.
* *Texto na tela:* `ANOTAÇÃO NO PAPEL = RETRABALHO` → `ENTRADA CENTRALIZADA SEM ERROS` + `PEDIDO NO CELULAR OU TERMINAL ✓`.

### Ato 3 — Cozinha: Papel Perdido vs. Tela KDS (`f884 – f1238` | `29.5s – 41.3s`)
* *Fala:* `"Na cozinha, comanda de papel se perde, mancha e atrasa o preparo. No sistema da Stech, cada pedido aparece na hora na tela da cozinha, com ordem de chegada, observações e tempo de preparo em destaque."`
* *Cues:* `f_cozinha: 896`, `f_tela_kds: 1018`
* *Câmera 16:9:* Close na cozinha manual desorganizada (`pos [-4.1, 2.1, 4.8]`) → Foco na Tela KDS da Stech (`pos [5.05, 2.22, 4.65]`, `look [5.2, 1.58, -1.4]`).
* *Visual 3D:* Monitor 3D `KDS COZINHA • STECH` elevado e livre (`#104 MESA 03 • 2x Prato Executivo • Obs: Sem cebola • PREPARO: 04:10` e `#103 DELIVERY • PRONTO ✓`) + banner `✓ STATUS: PRONTO!`.
* *Texto na tela:* `COMANDA DE PAPEL SE PERDE` → `COZINHA SINCRONIZADA EM TEMPO REAL` + `ORDEM, OBSERVAÇÕES E PREPARO NA TELA ✓`.

### Ato 4 — Atendimento & Comunicação entre Equipes (`f1240 – f1564` | `41.3s – 52.1s`)
* *Fala:* `"Quando o cliente pergunta se o prato está pronto, ninguém precisa correr atrás da cozinha. A equipe acompanha o status em tempo real e entrega na hora certa, com salão e balcão falando a mesma língua."`
* *Cues:* `f_atendimento: 1258`, `f_tempo_real: 1396`
* *Câmera 16:9:* Plano médio conectando Cozinha ↔ Salão (`pos [3.4, 2.25, 5.75] → [3.2, 2.22, 5.55]`).
* *Efeitos:* Duto luminoso de retorno 3D + Seta Curva Tracejada Amarela (`ResponsiveCurvedArrow`) apontando do monitor `KDS COZINHA` direto para o celular do garçom no salão.
* *Texto na tela:* `COMUNICAÇÃO FLUIDA ENTRE EQUIPES` + `SALÃO, COZINHA E BALCÃO INTEGRADOS ✓`.

### Ato 5 — Gestão, Relatórios & Estoque (`f1567 – f1906` | `52.2s – 63.5s`)
* *Fala:* `"E na hora de fechar o dia, nada de somar papel por papel no caderno. O painel de gestão reúne pedidos, controle de estoque e relatórios completos de vendas para você decidir com clareza."`
* *Cues:* `f_gestao: 1582`, `f_painel_gestao: 1692`
* *Câmera 16:9:* Contraste no balcão manual (`pos [-3.6, 2.05, 4.65]`) → Close no escritório de gestão (`pos [7.6, 2.02, 4.15]`).
* *Visual 3D:* Gerente sentado à esquerda da mesa (`sitting_desk`) e monitor widescreen à direita (`STECH • PAINEL DE GESTÃO`: gráfico ilustrativo `VENDAS & PEDIDOS` + `CAIXA & ESTOQUE`: Pedidos Conciliados, Estoque Atualizado, Relatório do Dia).
* *Texto na tela:* `CHEGA DE SOMAR PAPEL NO CADERNO` → `GESTÃO, RELATÓRIOS E INDICADORES` + `VENDAS, ESTOQUE E CAIXA EM UM SÓ PAINEL ✓`.

### Ato 6 — Resultado & CTA Oficial Stech (`f1906 – f2314` | `63.5s – 77.1s`)
* *Fala:* `"Do pedido na mesa ao controle do caixa, tudo funciona integrado e sem retrabalho. Quer organizar os processos da sua empresa e trabalhar com mais eficiência? Fale com a Stech. Criamos sistemas sob medida para o seu negócio."`
* *Cues:* `f_resultado: 1961`, `f_cta: 2027`
* *Câmera 16:9:* Pullback amplo (`pos [4.8, 2.95, 8.4] → [0.85, 3.45, 11.4]`) exibindo toda a maquete conectada com a marca `STECH SOLUÇÕES` visível na parede e os 3 dutos ativos.
* *Identidade Visual:* Exibição da logo oficial `Logo_stech.png` no card superior (`StechLogoBadge`) tanto na introdução da Stech (`f356–f486`) quanto no CTA final (`f2027–f2314`), além da placa 3D corporativa na parede do ambiente automatizado.
* *Texto na tela:* `DO PEDIDO AO CAIXA: TUDO INTEGRADO` → `FALE COM A STECH SOLUÇÕES` (`Logo_stech.png`) + `Sistemas sob medida para o seu negócio.`

---

## 4. Arquivos do Pipeline Stech Soluções

* `FORMATOS_E_PADROES_VIDEO.md` — Padrões YouTube/Reels, Safe Zones, organização de pastas, fluxo rápido e análise do `raea`
* `template/public/assets/stech-automacao/Logo_stech.png` — Logo oficial da Stech Soluções
* `template/public/assets/stech-automacao/master_audio_sfx.wav` — Áudio masterizado (`I=-14 LUFS`) com SFX sincronizados
* `template/scripts/build_stech_audio.py` — Geração Edge-TTS + `loudnorm` 2 passes + SFX + `alimiter` sem clipping + `stechWords.ts`
* `template/src/shots/G1/stechWords.ts` — `STECH_TOTAL_FRAMES`, `STECH_CUES`, `STECH_WORDS`
* `template/src/shots/G1/StechDiorama.tsx` — Cena 3D completa e câmeras independentes (`16:9` e `9:16` sem cortes)
* `template/src/shots/G1/StechStage.tsx` — Overlays limpos, `StechLogoBadge` oficial e legendas nas Safe Zones
* `template/src/shots/G1/DesmontandoRig.ts` — Rig 3D articulado oficial
* `template/scripts/preview_stech_board.py` — Painéis rápidos de auditoria (`qa/painel_stech_atos_16x9.jpg` e `qa/painel_stech_atos_9x16.jpg`)
* `template/scripts/render_stech.py` — Pre-bundle em cache + `--preset youtube|reels` + `--fast` / Master ProRes + FFmpeg `libx264` + `ffprobe` + `--raea-check`
* `template/src/Root.tsx` — Composições `StechAutomacao` (`1920x1080`) e `StechAutomacaoVertical` (`1080x1920`)
* `template/renders/stech-automacao/youtube-16x9/stech_automacao_16x9_v1.mp4` — Vídeo final Horizontal 16:9 (`1920x1080`)
* `template/renders/stech-automacao/reels-9x16/stech_automacao_reels_9x16_v2.mp4` — Vídeo final Instagram Reels 9:16 v2 (`1080x1920`)
