import type {CharacterPose} from '../shots/G1/DesmontandoRig';
import {DATACRITICA_WORDS, DATACRITICA_TOTAL_FRAMES} from '../shots/G1/dataCriticaWords';

export type TemplateModelId =
  | 'doc_mapa_radar'
  | 'ilustrado_flat_2d'
  | 'editorial_kinetic_2d'
  | 'fluxo_corporativo'
  | 'sala_experimento'
  | 'estudio_apresentador';
export type DesignCategory = '2d' | '3d';
export type AspectRatioId = '16:9' | '9:16';
export type PlatformId = 'youtube_shorts' | 'reels' | 'youtube';

export function is2DTemplateModel(modelId: TemplateModelId): boolean {
  return (
    modelId === 'doc_mapa_radar' ||
    modelId === 'ilustrado_flat_2d' ||
    modelId === 'editorial_kinetic_2d'
  );
}

export interface DurationPreset {
  id: string;
  platform: PlatformId;
  aspectRatio: AspectRatioId;
  seconds: number;
  label: string;
  subtitle: string;
  recommendedScenes: string;
}

export const DURATION_PRESETS: DurationPreset[] = [
  {
    id: 'yt_shorts_60',
    platform: 'youtube_shorts',
    aspectRatio: '9:16',
    seconds: 60,
    label: '60 segundos',
    subtitle: 'Short ágil • Curiosidade rápida com retenção máxima',
    recommendedScenes: '5 a 6 cenas',
  },
  {
    id: 'yt_shorts_90',
    platform: 'youtube_shorts',
    aspectRatio: '9:16',
    seconds: 90,
    label: '1 min 30s',
    subtitle: 'Padrão Mitos & Curiosidades (@engenhocaexplicadas)',
    recommendedScenes: '7 a 8 cenas',
  },
  {
    id: 'yt_shorts_150',
    platform: 'youtube_shorts',
    aspectRatio: '9:16',
    seconds: 150,
    label: '2 min 30s',
    subtitle: 'Engenharia & Funcionamento (@DesmontandoOMundo)',
    recommendedScenes: '10 a 11 cenas',
  },
  {
    id: 'reels_30',
    platform: 'reels',
    aspectRatio: '9:16',
    seconds: 30,
    label: '30 segundos',
    subtitle: 'Direto ao ponto • Impacto rápido',
    recommendedScenes: '3 a 4 cenas',
  },
  {
    id: 'reels_60',
    platform: 'reels',
    aspectRatio: '9:16',
    seconds: 60,
    label: '60 segundos',
    subtitle: 'Padrão viral Reels (@desmontandoomundo)',
    recommendedScenes: '5 a 6 cenas',
  },
  {
    id: 'reels_90',
    platform: 'reels',
    aspectRatio: '9:16',
    seconds: 90,
    label: '1 min 30s',
    subtitle: 'Reels completo • Passo a passo detalhado',
    recommendedScenes: '7 a 8 cenas',
  },
  {
    id: 'yt_90',
    platform: 'youtube',
    aspectRatio: '16:9',
    seconds: 90,
    label: '1 min 30s',
    subtitle: 'Vídeo objetivo • Reunião, TV ou YouTube',
    recommendedScenes: '6 a 8 cenas',
  },
  {
    id: 'yt_180',
    platform: 'youtube',
    aspectRatio: '16:9',
    seconds: 180,
    label: '3 minutos',
    subtitle: 'Explicação completa • YouTube & Treinamento',
    recommendedScenes: '9 a 12 cenas',
  },
  {
    id: 'yt_300',
    platform: 'youtube',
    aspectRatio: '16:9',
    seconds: 300,
    label: '5 minutos',
    subtitle: 'Aula aprofundada • Todos os detalhes',
    recommendedScenes: '13 a 16 cenas',
  },
];

export interface YoutubeChannelRef {
  id: string;
  handle: string;
  title: string;
  url: string;
  shortsCount: number;
  topViews: number;
  addedAt: string;
  designStyleLabel?: string;
  defaultModelId?: TemplateModelId;
}

export interface YoutubeViralVideo {
  id: string;
  title: string;
  viewCount: number;
  url: string;
  thumbnail: string;
  channelId: string;
  channelTitle: string;
  channelHandle: string;
}

export interface DailyThemeSuggestion {
  id: string;
  hookTitle: string;
  formatStyle: string;
  whyItWorks?: string;
  inspiredByTitle: string;
  inspiredByChannel: string;
  inspiredByViews: number;
  recommendedSeconds: number;
  suggestedModelId: TemplateModelId;
  readyPrompt: string;
}

export interface YoutubeShortsMeta {
  title: string;
  description: string;
  hashtags: string[];
}

export type CorporateVisualEffect =
  | 'none'
  | 'paper_loss'
  | 'barcode_scan'
  | 'photo_flash'
  | 'price_markdown'
  | 'erp_sync'
  | 'status_done'
  | 'printer_labels'
  | 'checkout_scan'
  | 'panorama_all';

export type RoomExperimentEffect =
  | 'ice_fan_hot'
  | 'ice_melted_clock'
  | 'molecules_waves'
  | 'copper_cycle'
  | 'metal_shield'
  | 'speedometer_control'
  | 'finished_appliance';

export type PresenterStageEffect =
  | 'presenter_intro'
  | 'presenter_alert'
  | 'presenter_steps'
  | 'presenter_chart'
  | 'presenter_conclusion';

export type DocRadarEffect =
  | 'radar_target_zone'
  | 'corridor_map_zone'
  | 'trajectory_track'
  | 'severity_scale'
  | 'globe_finale';

export type FlatIllustratedEffect =
  | 'flat_horizon_globe'
  | 'flat_myth_vs_fact'
  | 'flat_layers_cross_section'
  | 'flat_puzzle_pieces'
  | 'flat_window_conclusion';

export type EditorialKineticEffect =
  | 'blueprint_question'
  | 'gears_mechanism'
  | 'area_ring_scale'
  | 'step_comparison_cards'
  | 'confetti_reveal';

export type SceneVisualEffect =
  | CorporateVisualEffect
  | RoomExperimentEffect
  | PresenterStageEffect
  | DocRadarEffect
  | FlatIllustratedEffect
  | EditorialKineticEffect;

export type SectorStationType =
  | 'supermarket_aisle'
  | 'office_single'
  | 'office_dual_erp'
  | 'warehouse_dock';

export interface VoiceOption {
  id: string;
  label: string;
  subtitle: string;
  edgeVoice: string;
  defaultRatePct: number;
  pitchHz: number;
  gender: 'M' | 'F';
  sampleText: string;
}

export const VOICE_CATALOG: VoiceOption[] = [
  {
    id: 'antonio_dinamico',
    label: 'Antônio Dinâmico (@desmontandoomundo)',
    subtitle: 'Masculina ágil, didática e energética • Ideal para Shorts, Reels e engenharia',
    edgeVoice: 'pt-BR-AntonioNeural',
    defaultRatePct: 18,
    pitchHz: 0,
    gender: 'M',
    sampleText: 'Olá! Veja na prática como funciona todo o fluxo de forma rápida e sem desperdício!',
  },
  {
    id: 'antonio_corporativo',
    label: 'Antônio Documentário (@FronteiraDoc / TV)',
    subtitle: 'Masculina grave, firme e cinematográfica • Ideal para Documentário 2D, Mapas e História',
    edgeVoice: 'pt-BR-AntonioNeural',
    defaultRatePct: 6,
    pitchHz: -2,
    gender: 'M',
    sampleText: 'Em poucos minutos, o fenômeno cruzou toda a região com intensidade recorde já registrada.',
  },
  {
    id: 'francisca_calma',
    label: 'Francisca Editorial (@HistoriandoCuriosidades)',
    subtitle: 'Feminina acolhedora e envolvente • Ideal para Ilustração Flat 2D, Ciência e Tutoriais',
    edgeVoice: 'pt-BR-FranciscaNeural',
    defaultRatePct: 4,
    pitchHz: 0,
    gender: 'F',
    sampleText: 'Olhando da janela parece simples, mas cada detalhe conta uma história surpreendente.',
  },
  {
    id: 'thalita_vibrante',
    label: 'Thalita Vibrante & Moderna (@curiosicasabr)',
    subtitle: 'Feminina expressiva e natural • Excelente para curiosidades ágeis e listas numeradas',
    edgeVoice: 'pt-BR-ThalitaMultilingualNeural',
    defaultRatePct: 12,
    pitchHz: 0,
    gender: 'F',
    sampleText: 'Parece mágica, mas meia volta inteira gasta quase a mesma energia de ferver oito chaleiras!',
  },
  {
    id: 'francisca_didatica',
    label: 'Francisca Pausada (Treinamento Detalhado)',
    subtitle: 'Feminina serena e bem articulada • Ótima para regras fiscais, sistemas e aulas longas',
    edgeVoice: 'pt-BR-FranciscaNeural',
    defaultRatePct: -3,
    pitchHz: 2,
    gender: 'F',
    sampleText: 'Confira atentamente a quantidade e o valor aprovado antes de confirmar a baixa no sistema.',
  },
];

export interface TemplateModelMeta {
  id: TemplateModelId;
  category: DesignCategory;
  inspiredChannel: string;
  name: string;
  badge: string;
  description: string;
  highlights: string[];
}

export const TEMPLATE_MODELS: TemplateModelMeta[] = [
  {
    id: 'doc_mapa_radar',
    category: '2d',
    inspiredChannel: '@FronteiraDoc',
    name: 'Geo-Documentário & Radar 2D',
    badge: '2D Escuro • Mapas, Fenômenos & Recordes',
    description:
      'Design 2D cinematográfico escuro (@FronteiraDoc): grade cartográfica tática, mapas/globo com radar vermelho pulsante, números gigantes de impacto, escala de intensidade (EF/Nível) e legenda com palavra dourada.',
    highlights: ['Sem 3D • 100% 2D Tático', 'Mapa + Radar + Escala', 'Legenda Âmbar @FronteiraDoc'],
  },
  {
    id: 'ilustrado_flat_2d',
    category: '2d',
    inspiredChannel: '@HistoriandoCuriosidades',
    name: 'Ilustração Flat & História 2D',
    badge: '2D Editorial • História, Ciência & Provas',
    description:
      'Design 2D flat ilustrado (@HistoriandoCuriosidades): bolinhas de progresso no topo (etapa X de Y), mascote 2D expressivo com contorno preto, corte de camadas com régua, quebra-cabeça visual e pílula de legenda.',
    highlights: ['Sem 3D • Ilustração Flat 2D', 'Bolinhas de Etapa + Mascote', 'Camadas, Mitos ✕/✓ & Pôr do Sol'],
  },
  {
    id: 'editorial_kinetic_2d',
    category: '2d',
    inspiredChannel: '@curiosicasabr • @engenhocaexplicadas',
    name: 'Blueprint & Cards Numerados 2D',
    badge: '2D Clean • Mitos, Listas & Engrenagens',
    description:
      'Design 2D minimalista (@curiosicasabr + @engenhocaexplicadas): selo numérico amarelo inclinado, pílula branca flutuante com ponto semântico colorido, modo raio-X monocromático na pergunta e chuva de confetes no final.',
    highlights: ['Sem 3D • Motion Clean 2D', 'Pílula Branca + Número 1..N', 'Raio-X → Cores + Confetes'],
  },
  {
    id: 'sala_experimento',
    category: '3d',
    inspiredChannel: '@DesmontandoOMundo',
    name: 'Bancada & Maquete 3D',
    badge: '3D Sob Medida • Engenharia & Física',
    description:
      'Estúdio 3D (@DesmontandoOMundo) com bancada de engenharia onde a IA constrói a maquete 3D real do seu tema cena a cena (estruturas, forças, camadas e máquinas).',
    highlights: ['Maquete 3D Sob Medida', 'Estruturas, Cabos & Forças', 'Boneco + Bancada @DesmontandoOMundo'],
  },
  {
    id: 'fluxo_corporativo',
    category: '3d',
    inspiredChannel: '@DesmontandoOMundo',
    name: 'Fluxo entre Setores 3D',
    badge: '3D Maquete • Processos & Sistemas',
    description:
      'Maquete 3D dinâmica com 2 a 4 ambientes conectados lado a lado (lojas, escritórios, sistemas, logística), bonecos articulados, telas de computador e dutos luminosos.',
    highlights: ['2 a 4 Ambientes Dinâmicos', 'Telas 3D & Envio de Dados', 'Panorama Geral Integrado'],
  },
  {
    id: 'estudio_apresentador',
    category: '3d',
    inspiredChannel: '@engenhocaexplicadas',
    name: 'Estúdio Apresentador & Telão 3D',
    badge: '3D Coringa • Aulas & Apresentações',
    description:
      'Palco moderno 3D com o boneco apresentando ao lado de um grande telão interativo 3D, gráficos em barras animadas e cartões de destaque por etapa.',
    highlights: ['Serve p/ Qualquer Assunto', 'Telão 3D c/ Progresso', 'Gráficos & Selos 3D'],
  },
];

export interface StudioSectorSpec {
  id: string;
  title: string;
  stationType: SectorStationType;
  shirtColor: string;
  shortsColor: string;
  wallAccentColor: string;
  monitorHeader: string;
}

export type VisualPartKind =
  | 'box'
  | 'truss'
  | 'beam'
  | 'cylinder'
  | 'sphere'
  | 'cone'
  | 'ring'
  | 'arch'
  | 'wave_layer'
  | 'arrow';

export type VisualPartAnim =
  | 'none'
  | 'bob'
  | 'sway'
  | 'spin'
  | 'pulse'
  | 'flow'
  | 'shake';

export interface CustomVisualPart {
  kind: VisualPartKind;
  x?: number;
  y?: number;
  z?: number;
  w?: number;
  h?: number;
  r?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  thickness?: number;
  dir?: 'up' | 'down' | 'left' | 'right';
  flip?: boolean;
  color: string;
  label?: string;
  anim?: VisualPartAnim;
  opacity?: number;
}

export interface CustomSceneVisualSpec {
  themeTag?: string;
  environment?: 'ground' | 'underground' | 'water' | 'space' | 'sky' | 'clean';
  groundColor?: string;
  cameraAngle?: 'front' | 'iso_left' | 'iso_right' | 'closeup' | 'top_tilt';
  parts: CustomVisualPart[];
}

export interface StudioSceneSpec {
  id: string;
  stepBanner: string;
  narration: string;
  sectorIndex: number; // 0..N-1 ou -1 para Panorama Completo
  pose: CharacterPose;
  visualEffect: SceneVisualEffect;
  headline: string;
  leftBadge: string;
  leftBadgeColor: string;
  rightBadge: string;
  rightBadgeColor: string;
  screenLine1: string;
  screenLine2: string;
  sendDataToSector: number | null;
  customVisual?: CustomSceneVisualSpec;
  fromFrame: number;
  toFrame: number;
}

export interface StudioWordTiming {
  text: string;
  from: number;
  to: number;
}

export interface CandidateModelOption {
  modelId: TemplateModelId;
  rank: 1 | 2 | 3;
  reason: string;
}

export interface StudioProjectSpec {
  id: string;
  name: string;
  promptIdea: string;
  modelId: TemplateModelId;
  suggestedModelId?: TemplateModelId;
  candidateModels?: CandidateModelOption[];
  knowledgeSavedModelId?: TemplateModelId | null;
  platform?: PlatformId;
  targetSeconds?: number;
  aiModelUsed?: string;
  ytShortsMeta?: YoutubeShortsMeta;
  aspectRatio: AspectRatioId;
  voiceId: string;
  voiceRatePct: number;
  sfxEnabled: boolean;
  subtitlesEnabled: boolean;
  sectors: StudioSectorSpec[];
  scenes: StudioSceneSpec[];
  words: StudioWordTiming[];
  audioUrl: string | null;
  totalFrames: number;
}

export function adaptScenesForModel(
  scenes: StudioSceneSpec[],
  sectorsCount: number,
  modelId: TemplateModelId
): StudioSceneSpec[] {
  return scenes.map((sc, idx) => {
    const isLast = idx === scenes.length - 1;
    if (modelId === 'doc_mapa_radar') {
      const docCycle: SceneVisualEffect[] = [
        'radar_target_zone',
        'corridor_map_zone',
        'trajectory_track',
        'severity_scale',
      ];
      return {
        ...sc,
        sectorIndex: 0,
        pose: 'standing_neutral' as CharacterPose,
        visualEffect: (isLast ? 'globe_finale' : docCycle[idx % docCycle.length]) as SceneVisualEffect,
        sendDataToSector: null,
      };
    }
    if (modelId === 'ilustrado_flat_2d') {
      const flatCycle: SceneVisualEffect[] = [
        'flat_horizon_globe',
        'flat_myth_vs_fact',
        'flat_layers_cross_section',
        'flat_puzzle_pieces',
      ];
      return {
        ...sc,
        sectorIndex: 0,
        pose: 'standing_neutral' as CharacterPose,
        visualEffect: (
          isLast ? 'flat_window_conclusion' : flatCycle[idx % flatCycle.length]
        ) as SceneVisualEffect,
        sendDataToSector: null,
      };
    }
    if (modelId === 'editorial_kinetic_2d') {
      const editCycle: SceneVisualEffect[] = [
        'gears_mechanism',
        'area_ring_scale',
        'step_comparison_cards',
      ];
      return {
        ...sc,
        sectorIndex: 0,
        pose: 'standing_neutral' as CharacterPose,
        visualEffect: (
          isLast
            ? 'confetti_reveal'
            : idx === 0
              ? 'blueprint_question'
              : editCycle[(idx - 1) % editCycle.length]
        ) as SceneVisualEffect,
        sendDataToSector: null,
      };
    }
    if (modelId === 'estudio_apresentador') {
      return {
        ...sc,
        sectorIndex: 0,
        pose: (isLast ? 'standing_wave' : 'standing_neutral') as CharacterPose,
        visualEffect: (
          isLast
            ? 'presenter_conclusion'
            : idx === 0
              ? 'presenter_intro'
              : idx % 2 === 1
                ? 'presenter_chart'
                : 'presenter_steps'
        ) as SceneVisualEffect,
        sendDataToSector: null,
      };
    }
    if (modelId === 'sala_experimento') {
      const roomCycle: SceneVisualEffect[] = [
        'ice_fan_hot',
        'molecules_waves',
        'copper_cycle',
        'speedometer_control',
        'metal_shield',
      ];
      return {
        ...sc,
        sectorIndex: 0,
        pose: (isLast ? 'standing_wave' : idx === 0 ? 'standing_worried' : 'standing_neutral') as CharacterPose,
        visualEffect: (
          isLast ? 'finished_appliance' : roomCycle[idx % roomCycle.length]
        ) as SceneVisualEffect,
        sendDataToSector: null,
      };
    }
    const secCount = Math.max(1, sectorsCount);
    const secIdx = isLast ? -1 : idx % secCount;
    const nextSecIdx = !isLast && idx + 1 < scenes.length - 1 ? (idx + 1) % secCount : null;
    return {
      ...sc,
      sectorIndex: secIdx,
      pose: (isLast ? 'standing_wave' : 'sitting_desk') as CharacterPose,
      visualEffect: (isLast ? 'panorama_all' : 'erp_sync') as SceneVisualEffect,
      sendDataToSector: nextSecIdx !== null && nextSecIdx !== secIdx ? nextSecIdx : null,
    };
  });
}

export function buildProjectForModel(
  project: StudioProjectSpec,
  modelId: TemplateModelId
): StudioProjectSpec {
  if (project.modelId === modelId) {
    return project;
  }
  return {
    ...project,
    modelId,
    scenes: adaptScenesForModel(project.scenes, project.sectors.length, modelId),
  };
}

export function getCanvasSize(aspectRatio: AspectRatioId): {width: number; height: number} {
  return aspectRatio === '16:9' ? {width: 1920, height: 1080} : {width: 1080, height: 1920};
}

/** Recalcula tempos estimados por cena (30fps) antes de sintetizar o áudio neural exato */
export function estimateSceneTimings(scenes: StudioSceneSpec[], fps = 30): {
  scenes: StudioSceneSpec[];
  words: StudioWordTiming[];
  totalFrames: number;
} {
  let cursor = 1;
  const allWords: StudioWordTiming[] = [];
  const timedScenes = scenes.map((sc) => {
    const rawWords = sc.narration
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    // Média natural PT-BR dinâmica: ~2.9 palavras/segundo (~10.3 frames/palavra) + pausa respiratória de 24 frames
    const wordDur = 10;
    const start = cursor;
    rawWords.forEach((w, idx) => {
      const wf = start + 6 + idx * wordDur;
      allWords.push({
        text: w,
        from: wf,
        to: wf + wordDur - 2,
      });
    });
    const durFrames = Math.max(90, rawWords.length * wordDur + 30);
    const end = start + durFrames - 1;
    cursor = end + 1;
    return {
      ...sc,
      fromFrame: start,
      toFrame: end,
    };
  });

  return {
    scenes: timedScenes,
    words: allWords,
    totalFrames: Math.max(150, cursor + 24),
  };
}

/** Projeto inicial pré-carregado no Estúdio: exatamente o nosso Sistema de Data Crítica! */
export const DEFAULT_DATA_CRITICA_PROJECT: StudioProjectSpec = {
  id: 'sistema-data-critica',
  name: 'Sistema de Data Crítica (Loja → Compras → Cadastro/RPInfo)',
  promptIdea:
    'Responsável da loja encontra produto próximo do vencimento, bipa no celular com quantidade, validade e foto. Compras analisa e aprova rebaixa de preço. Cadastro lança valor e etiquetas no RPInfo e dá baixa no Data Crítica, voltando para a loja colar a nova etiqueta.',
  modelId: 'fluxo_corporativo',
  aspectRatio: '16:9',
  voiceId: 'antonio_dinamico',
  voiceRatePct: 18,
  sfxEnabled: true,
  subtitlesEnabled: true,
  sectors: [
    {
      id: 'sec-loja',
      title: '1. LOJA • SUPERMERCADO',
      stationType: 'supermarket_aisle',
      shirtColor: '#F0CA4D',
      shortsColor: '#334155',
      wallAccentColor: '#DC2626',
      monitorHeader: 'DATA CRÍTICA APP',
    },
    {
      id: 'sec-compras',
      title: '2. SETOR DE COMPRAS',
      stationType: 'office_single',
      shirtColor: '#2563EB',
      shortsColor: '#1E293B',
      wallAccentColor: '#1D4ED8',
      monitorHeader: 'PAINEL DE COMPRAS',
    },
    {
      id: 'sec-cadastro',
      title: '3. CADASTRO & RPINFO',
      stationType: 'office_dual_erp',
      shirtColor: '#10B981',
      shortsColor: '#1E293B',
      wallAccentColor: '#047857',
      monitorHeader: 'SISTEMA OFICIAL RPINFO',
    },
  ],
  scenes: [
    {
      id: 'act-1',
      stepBanner: 'ETAPA 1/4 • PROBLEMA NA PRATELEIRA',
      narration:
        'Quando um produto na prateleira do supermercado fica próximo do vencimento, anotar no papel ou avisar no grito demora demais e gera perda! Para resolver isso rápido, veja como funciona o Sistema de Data Crítica.',
      sectorIndex: 0,
      pose: 'standing_worried',
      visualEffect: 'paper_loss',
      headline: 'SISTEMA DE DATA CRÍTICA',
      leftBadge: 'PAPEL = DEMORA!',
      leftBadgeColor: '#F59E0B',
      rightBadge: 'GERA PERDA NA LOJA!',
      rightBadgeColor: '#EF4444',
      screenLine1: 'LOTE CRÍTICO',
      screenLine2: 'VENCE EM 5 DIAS',
      sendDataToSector: null,
      fromFrame: 1,
      toFrame: 356,
    },
    {
      id: 'act-2',
      stepBanner: 'ETAPA 1/4 • LOJA: BIPAGEM NO CELULAR',
      narration:
        'Tudo começa lá na seção da loja: o responsável encontra um produto próximo de vencer, abre o sistema no celular e bipa o código de barras. Na mesma hora, o aplicativo já puxa o nome e o preço atual do item.',
      sectorIndex: 0,
      pose: 'standing_phone',
      visualEffect: 'barcode_scan',
      headline: 'BIPA O CÓDIGO DE BARRAS!',
      leftBadge: 'RESPONSÁVEL DA LOJA',
      leftBadgeColor: '#FACC15',
      rightBadge: 'PUXA NOME + R$ 12,90',
      rightBadgeColor: '#38BDF8',
      screenLine1: 'SUCO INTEGRAL 1L',
      screenLine2: 'ATUAL: R$ 12,90',
      sendDataToSector: null,
      fromFrame: 357,
      toFrame: 720,
    },
    {
      id: 'act-3',
      stepBanner: 'ETAPA 1/4 • LOJA: QTD, VALIDADE E FOTO',
      narration:
        'Ele só informa a quantidade na prateleira, coloca a data de vencimento, tira uma foto real do produto e envia! Instantaneamente, esse lançamento cai na tela do setor administrativo de Compras.',
      sectorIndex: 0,
      pose: 'standing_phone',
      visualEffect: 'photo_flash',
      headline: 'LANÇAMENTO NO CELULAR',
      leftBadge: 'QTD: 24 UN • 5 DIAS',
      leftBadgeColor: '#3B82F6',
      rightBadge: 'FOTO REAL ANEXADA',
      rightBadgeColor: '#10B981',
      screenLine1: 'QTD: 24 UNIDADES',
      screenLine2: 'FOTO REAL OK ✓',
      sendDataToSector: 1,
      fromFrame: 721,
      toFrame: 1045,
    },
    {
      id: 'act-4',
      stepBanner: 'ETAPA 2/4 • COMPRAS: ANÁLISE & REBAIXA',
      narration:
        'Lá no setor de Compras, o comprador analisa a foto, a quantidade e os dias para vencer. Ele define a rebaixa de preço — por exemplo, de doze e noventa para seis e noventa e nove — e lança de volta no sistema com o valor aprovado.',
      sectorIndex: 1,
      pose: 'sitting_desk',
      visualEffect: 'price_markdown',
      headline: 'SETOR DE COMPRAS',
      leftBadge: 'DE R$ 12,90 → R$ 6,99',
      leftBadgeColor: '#FACC15',
      rightBadge: 'VALOR APROVADO ✓',
      rightBadgeColor: '#22C55E',
      screenLine1: 'DE: R$ 12,90',
      screenLine2: 'POR: R$ 6,99 ✓',
      sendDataToSector: 2,
      fromFrame: 1046,
      toFrame: 1565,
    },
    {
      id: 'act-5',
      stepBanner: 'ETAPA 3/4 • CADASTRO & SISTEMA RPINFO',
      narration:
        'O Cadastro recebe a quantidade do produto em data crítica junto com o preço de rebaixa, e lança no sistema oficial da RPInfo o valor da rebaixa e a quantidade exata de etiquetas.',
      sectorIndex: 2,
      pose: 'sitting_desk',
      visualEffect: 'erp_sync',
      headline: 'SETOR DE CADASTRO',
      leftBadge: 'RECEBE QTD + R$ 6,99',
      leftBadgeColor: '#38BDF8',
      rightBadge: 'RPINFO: 24 ETIQUETAS',
      rightBadgeColor: '#FACC15',
      screenLine1: 'REBAIXA: R$ 6,99',
      screenLine2: '24 ETIQUETAS ERP',
      sendDataToSector: null,
      fromFrame: 1566,
      toFrame: 1925,
    },
    {
      id: 'act-6',
      stepBanner: 'ETAPA 3/4 • BAIXA & RETORNO À LOJA',
      narration:
        'Assim que lança no sistema da RPInfo, o Cadastro também dá baixa no Sistema de Data Crítica. Na hora, o lançamento volta para o celular do responsável lá na loja do supermercado!',
      sectorIndex: 2,
      pose: 'sitting_desk',
      visualEffect: 'status_done',
      headline: 'BAIXA NO DATA CRÍTICA!',
      leftBadge: 'RPINFO SINCRONIZADO ✓',
      leftBadgeColor: '#22C55E',
      rightBadge: 'RETORNO AUTOMÁTICO',
      rightBadgeColor: '#FACC15',
      screenLine1: 'BAIXA CONCLUÍDA ✓',
      screenLine2: 'ENVIADO À LOJA',
      sendDataToSector: 0,
      fromFrame: 1926,
      toFrame: 2180,
    },
    {
      id: 'act-7',
      stepBanner: 'ETAPA 4/4 • LOJA: FILA & ETIQUETAGEM',
      narration:
        'O responsável da loja recebe o retorno, verifica se as etiquetas liberadas já estão disponíveis na fila da loja e cola a nova etiqueta em cada produto com o valor já rebaixado!',
      sectorIndex: 0,
      pose: 'standing_phone',
      visualEffect: 'printer_labels',
      headline: 'NOVA ETIQUETA EM CADA ITEM!',
      leftBadge: 'FILA IMPRESSORA OK ✓',
      leftBadgeColor: '#FACC15',
      rightBadge: 'PREÇO REBAIXADO: R$ 6,99',
      rightBadgeColor: '#22C55E',
      screenLine1: '24 ETIQUETAS',
      screenLine2: 'COLADAS NO LOTE ✓',
      sendDataToSector: null,
      fromFrame: 2181,
      toFrame: 2475,
    },
    {
      id: 'act-8',
      stepBanner: 'VISÃO GERAL • FLUXO COMPLETO INTEGRADO',
      narration:
        'Assim, o produto vende rápido no caixa com o preço certo e a loja evita desperdício! Pronto! Agora você sabe como funciona o Sistema de Data Crítica!',
      sectorIndex: -1,
      pose: 'standing_wave',
      visualEffect: 'panorama_all',
      headline: 'PRONTO! SISTEMA DE DATA CRÍTICA!',
      leftBadge: 'VENDA RÁPIDA NO CAIXA ✓',
      leftBadgeColor: '#22C55E',
      rightBadge: 'ZERO DESPERDÍCIO!',
      rightBadgeColor: '#FACC15',
      screenLine1: 'CAIXA PDV: R$ 6,99',
      screenLine2: 'FLUXO 100% INTEGRADO',
      sendDataToSector: null,
      fromFrame: 2476,
      toFrame: DATACRITICA_TOTAL_FRAMES,
    },
  ],
  words: DATACRITICA_WORDS,
  audioUrl: '/assets/data-critica/audio.wav',
  totalFrames: DATACRITICA_TOTAL_FRAMES,
};

export const PRESET_SALA_EXPERIMENTO_PROJECT: StudioProjectSpec = (() => {
  const rawScenes: StudioSceneSpec[] = [
    {
      id: 'exp-1',
      stepBanner: 'ATO 1 • O PROBLEMA DO CALOR',
      narration:
        'Em um dia muito quente, soprar vento em cima de um balde de gelo refresca no começo, mas logo o gelo derrete todo e o quarto volta a esquentar!',
      sectorIndex: 0,
      pose: 'sitting_hot',
      visualEffect: 'ice_fan_hot',
      headline: 'O GELO DERRETE RÁPIDO!',
      leftBadge: 'QUARTO: 32 °C',
      leftBadgeColor: '#EF4444',
      rightBadge: 'ÁGUA MORNA',
      rightBadgeColor: '#38BDF8',
      screenLine1: '32 °C',
      screenLine2: 'CALOR',
      sendDataToSector: null,
      fromFrame: 1,
      toFrame: 180,
    },
    {
      id: 'exp-2',
      stepBanner: 'ATO 2 • SERPENTINA E CICLO FECHADO',
      narration:
        'Por isso usamos uma serpentina de cobre com gás refrigerante circulando sem parar: ele absorve o calor do ar da sala e joga lá para fora!',
      sectorIndex: 0,
      pose: 'sitting_cool',
      visualEffect: 'copper_cycle',
      headline: 'CICLO FECHADO DE COBRE',
      leftBadge: 'ABSORVE O CALOR',
      leftBadgeColor: '#F97316',
      rightBadge: 'AR FRESQUINHO: 23 °C',
      rightBadgeColor: '#38BDF8',
      screenLine1: '23 °C',
      screenLine2: 'CICLO ATIVO',
      sendDataToSector: null,
      fromFrame: 181,
      toFrame: 360,
    },
    {
      id: 'exp-3',
      stepBanner: 'ATO 3 • CONTROLE INTELIGENTE INVERTER',
      narration:
        'Com o controle inteligente de velocidade, o motor desacelera quando atinge a temperatura ideal e economiza muita energia!',
      sectorIndex: 0,
      pose: 'sitting_cool',
      visualEffect: 'speedometer_control',
      headline: 'CONTROLE INTELIGENTE!',
      leftBadge: 'MOTOR SUAVE',
      leftBadgeColor: '#22C55E',
      rightBadge: 'ECONOMIA DE ENERGIA',
      rightBadgeColor: '#FACC15',
      screenLine1: '23 °C',
      screenLine2: 'ECO ON',
      sendDataToSector: null,
      fromFrame: 361,
      toFrame: 540,
    },
    {
      id: 'exp-4',
      stepBanner: 'ATO 4 • APARELHO MONTADO E PRONTO',
      narration:
        'Fechando tudo em uma carcaça compacta e silenciosa, o ambiente fica fresquinho o dia inteiro! Pronto! Agora você sabe como funciona!',
      sectorIndex: 0,
      pose: 'standing_wave',
      visualEffect: 'finished_appliance',
      headline: 'PRONTO! AGORA VOCÊ SABE!',
      leftBadge: 'CONFORTO TOTAL ✓',
      leftBadgeColor: '#22C55E',
      rightBadge: 'SILENCIOSO E EFICIENTE',
      rightBadgeColor: '#38BDF8',
      screenLine1: '23 °C',
      screenLine2: 'PRONTO!',
      sendDataToSector: null,
      fromFrame: 541,
      toFrame: 720,
    },
  ];
  const est = estimateSceneTimings(rawScenes);
  return {
    id: 'exemplo-sala-experimento',
    name: 'Sala & Experimento 3D (Modelo Ar-Condicionado / Máquina)',
    promptIdea:
      'Explicar na sala com poltrona e bancada como funciona o resfriamento com ciclo fechado de cobre e controle inteligente.',
    modelId: 'sala_experimento',
    aspectRatio: '9:16',
    voiceId: 'antonio_dinamico',
    voiceRatePct: 18,
    sfxEnabled: true,
    subtitlesEnabled: true,
    sectors: [
      {
        id: 'sala-principal',
        title: 'SALA DE EXPERIMENTOS 3D',
        stationType: 'office_single',
        shirtColor: '#F0CA4D',
        shortsColor: '#51627A',
        wallAccentColor: '#059674',
        monitorHeader: 'TERMOSTATO',
      },
    ],
    scenes: est.scenes,
    words: est.words,
    audioUrl: null,
    totalFrames: est.totalFrames,
  };
})();

