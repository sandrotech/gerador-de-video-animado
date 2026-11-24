import React from 'react';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {BEZ_SCALE_IN, clamp01, FONT_HEAVY} from '../common';
import type {
  CustomSceneVisualSpec,
  CustomVisualPart,
  StudioProjectSpec,
  StudioSceneSpec,
  VisualPartAnim,
} from './StudioSchema';

const FONT_CLEAN = "'Plus Jakarta Sans', 'Inter', 'Segoe UI', sans-serif";
const FONT_MONO = "'JetBrains Mono', Consolas, monospace";

const popScale = (n: number, dur = 14) => (n < 0 ? 0 : BEZ_SCALE_IN(clamp01(n / dur)));

export type Custom2DArtStyle =
  | 'tactical_dark'
  | 'flat_editorial'
  | 'blueprint_xray'
  | 'clean_colorful';

// ============================================================================
// 1. SINTETIZADOR PROCEDURAL INTELIGENTE POR TEMA + CENA (FALLBACK & UPGRADE LIVE)
// ============================================================================
function buildCraneVisualForScene(
  sc: StudioSceneSpec,
  sceneIdx: number,
  totalScenes: number
): CustomSceneVisualSpec {
  const txt = `${sc.narration} ${sc.headline} ${sc.leftBadge} ${sc.rightBadge}`.toLowerCase();
  const isHook = sceneIdx === 0;
  const isLast = sceneIdx === totalScenes - 1;
  const focusBase = /base|estabilizador|apoio|roda|pressão|solo/.test(txt);
  const focusCounter = /contrapeso|traseir|bloco|concreto|opost/.test(txt);
  const focusAnchor = /ancora|chumbador|placa|terreno|deslizamento|lateral/.test(txt);
  const focusWind = /vento|rajada|vela|sensor|velocidade/.test(txt);
  const focusTorque = /torque|distribui|cálculo|alcance|momento/.test(txt);

  const parts: CustomVisualPart[] = [
    // Camada de solo firme
    {
      kind: 'wave_layer',
      x: 0,
      y: -86,
      w: 190,
      h: 20,
      color: '#475569',
      opacity: 0.85,
    },
    // Sapata / Base larga de concreto
    {
      kind: 'box',
      x: -8,
      y: -72,
      w: focusBase ? 116 : 92,
      h: 14,
      color: focusBase ? '#38BDF8' : '#94A3B8',
      label: focusBase ? 'BASE AMPLIADA' : 'FUNDAÇÃO',
      anim: focusBase ? 'pulse' : 'none',
    },
    // Estabilizadores hidráulicos laterais
    {
      kind: 'cylinder',
      x: focusBase ? -58 : -44,
      y: -73,
      w: 11,
      h: 16,
      color: '#F59E0B',
      anim: focusBase ? 'pulse' : 'none',
    },
    {
      kind: 'cylinder',
      x: focusBase ? 42 : 28,
      y: -73,
      w: 11,
      h: 16,
      color: '#F59E0B',
      anim: focusBase ? 'pulse' : 'none',
    },
    // Torre treliçada principal do guindaste
    {
      kind: 'truss',
      x1: -12,
      y1: -65,
      x2: -12,
      y2: 52,
      thickness: 16,
      color: '#FACC15',
      anim: isHook ? 'sway' : 'none',
    },
    // Cabine do operador
    {
      kind: 'box',
      x: -2,
      y: 38,
      w: 16,
      h: 14,
      color: '#38BDF8',
    },
    // Topo piramidal + cabos tirantes de aço
    {
      kind: 'truss',
      x1: -12,
      y1: 52,
      x2: -12,
      y2: 76,
      thickness: 10,
      color: '#FACC15',
    },
    {
      kind: 'beam',
      x1: -12,
      y1: 75,
      x2: -58,
      y2: 54,
      thickness: 2.6,
      color: '#CBD5E1',
    },
    {
      kind: 'beam',
      x1: -12,
      y1: 75,
      x2: 64,
      y2: 54,
      thickness: 2.6,
      color: '#CBD5E1',
    },
    // Lança horizontal + Contra-lança treliçada
    {
      kind: 'truss',
      x1: -68,
      y1: 52,
      x2: 82,
      y2: 52,
      thickness: 11,
      color: '#FACC15',
      anim: isHook || focusWind ? 'sway' : 'none',
    },
    // Blocos pesados de contrapeso traseiro
    {
      kind: 'box',
      x: -54,
      y: 41,
      w: 30,
      h: 20,
      color: focusCounter ? '#22C55E' : '#64748B',
      label: 'CONTRAPESO',
      anim: focusCounter ? 'pulse' : 'none',
    },
    // Cabo de içamento + Carga suspensa
    {
      kind: 'beam',
      x1: 64,
      y1: 48,
      x2: 64,
      y2: -8,
      thickness: 2.8,
      color: '#E2E8F0',
    },
    {
      kind: 'box',
      x: 64,
      y: -21,
      w: 28,
      h: 22,
      color: isHook ? '#EF4444' : '#F97316',
      label: isHook ? 'TONELADAS!' : 'CARGA',
      anim: 'bob',
    },
  ];

  if (focusAnchor) {
    // Chumbadores profundos cravados no terreno
    parts.push(
      {kind: 'cylinder', x: -34, y: -86, w: 6, h: 24, color: '#38BDF8', anim: 'pulse'},
      {kind: 'cylinder', x: -8, y: -86, w: 6, h: 24, color: '#38BDF8', label: 'CHUMBADORES', anim: 'pulse'},
      {kind: 'cylinder', x: 18, y: -86, w: 6, h: 24, color: '#38BDF8', anim: 'pulse'},
      {kind: 'arrow', x1: 48, y1: -58, x2: 12, y2: -58, color: '#F59E0B', label: 'TRAÇÃO', anim: 'flow'}
    );
  } else if (focusWind) {
    // Rajadas de vento laterais + sensor no topo
    parts.push(
      {kind: 'arrow', x1: -92, y1: 24, x2: -32, y2: 24, color: '#38BDF8', label: 'VENTO FORTE', anim: 'flow'},
      {kind: 'arrow', x1: -92, y1: 66, x2: -30, y2: 66, color: '#38BDF8', anim: 'flow'},
      {kind: 'ring', x: -12, y: 80, r: 9, thickness: 3, color: '#22C55E', label: 'SENSOR', anim: 'pulse'}
    );
  } else if (focusCounter || focusTorque || isLast) {
    // Vetores opostos de equilíbrio de momento/torque
    parts.push(
      {kind: 'arrow', x1: 64, y1: -36, x2: 64, y2: -64, color: '#EF4444', label: 'PESO ↓', anim: 'flow'},
      {kind: 'arrow', x1: -54, y1: 26, x2: -54, y2: -8, color: '#22C55E', label: 'MOMENTO OPOSTO', anim: 'flow'},
      {kind: 'ring', x: -12, y: 52, r: 12, thickness: 3.5, color: '#38BDF8', anim: 'pulse'}
    );
  } else if (focusBase) {
    parts.push(
      {kind: 'arrow', x1: -48, y1: -45, x2: -58, y2: -66, color: '#22C55E', label: 'APOIO', anim: 'flow'},
      {kind: 'arrow', x1: 32, y1: -45, x2: 42, y2: -66, color: '#22C55E', anim: 'flow'}
    );
  } else {
    parts.push({
      kind: 'arrow',
      x1: 64,
      y1: -36,
      x2: 64,
      y2: -66,
      color: '#EF4444',
      label: 'RISCO DE GIRO?',
      anim: 'flow',
    });
  }

  return {
    themeTag: 'crane_engineering',
    environment: 'ground',
    groundColor: '#475569',
    cameraAngle: focusCounter || focusTorque ? 'closeup' : sceneIdx % 2 === 0 ? 'iso_left' : 'iso_right',
    parts,
  };
}

function buildElevatorVisualForScene(sc: StudioSceneSpec, sceneIdx: number): CustomSceneVisualSpec {
  const txt = `${sc.narration} ${sc.headline}`.toLowerCase();
  const focusBrakes = /freio|cunha|trava|limitador|trilho/.test(txt);
  const cableBroken = sceneIdx === 0 || /romp|quebr|corta/.test(txt);

  const parts: CustomVisualPart[] = [
    // Trilhos guias verticais de aço
    {kind: 'beam', x1: -46, y1: -84, x2: -46, y2: 82, thickness: 6, color: '#64748B'},
    {kind: 'beam', x1: 46, y1: -84, x2: 46, y2: 82, thickness: 6, color: '#64748B'},
    // Polia superior
    {kind: 'ring', x: 0, y: 74, r: 14, thickness: 5, color: '#FACC15', anim: 'spin'},
    // Cabine do elevador
    {
      kind: 'box',
      x: 0,
      y: focusBrakes ? -10 : 4,
      w: 68,
      h: 58,
      color: '#38BDF8',
      label: 'CABINE',
      anim: cableBroken && !focusBrakes ? 'shake' : 'bob',
    },
    // Contrapeso lateral
    {
      kind: 'box',
      x: 68,
      y: -24,
      w: 18,
      h: 40,
      color: '#94A3B8',
      label: 'CONTRAPESO',
    },
  ];

  if (cableBroken) {
    parts.push(
      {kind: 'beam', x1: 0, y1: 74, x2: -6, y2: 52, thickness: 3, color: '#EF4444'},
      {kind: 'beam', x1: 0, y1: 34, x2: 5, y2: 46, thickness: 3, color: '#EF4444', label: 'CABO ROMPIDO!'}
    );
  } else {
    parts.push({kind: 'beam', x1: 0, y1: 74, x2: 0, y2: 33, thickness: 3.5, color: '#E2E8F0'});
  }

  if (focusBrakes || sceneIdx >= 2) {
    parts.push(
      {kind: 'cone', x: -40, y: -34, w: 18, h: 18, dir: 'left', color: '#22C55E', label: 'CUNHA TRAVA!', anim: 'pulse'},
      {kind: 'cone', x: 40, y: -34, w: 18, h: 18, dir: 'right', color: '#22C55E', anim: 'pulse'}
    );
  } else {
    parts.push({kind: 'arrow', x1: 0, y1: -30, x2: 0, y2: -68, color: '#EF4444', label: 'QUEDA LIVRE?', anim: 'flow'});
  }

  return {themeTag: 'elevator_safety', environment: 'clean', parts};
}

function buildDamVisualForScene(sc: StudioSceneSpec, sceneIdx: number): CustomSceneVisualSpec {
  return {
    themeTag: 'dam_pressure',
    environment: 'ground',
    cameraAngle: sceneIdx % 2 === 0 ? 'iso_left' : 'closeup',
    parts: [
      // Reservatório de água à esquerda
      {kind: 'wave_layer', x: -48, y: -18, w: 92, h: 112, color: '#0EA5E9', opacity: 0.78, label: 'RESERVATÓRIO'},
      // Estrutura triangular da barragem de concreto
      {kind: 'cone', x: 18, y: -14, w: 68, h: 126, dir: 'up', color: '#94A3B8', label: 'BARRAGEM'},
      // Fundação rochosa profunda
      {kind: 'box', x: 0, y: -82, w: 188, h: 18, color: '#475569', label: 'ROCHA FIRME'},
      // Setas de pressão aumentando com a profundidade
      {kind: 'arrow', x1: -62, y1: 22, x2: -24, y2: 22, color: '#BAE6FD', anim: 'flow'},
      {kind: 'arrow', x1: -72, y1: -12, x2: -18, y2: -12, color: '#38BDF8', anim: 'flow'},
      {kind: 'arrow', x1: -82, y1: -48, x2: -12, y2: -48, color: '#EF4444', label: 'PRESSÃO MÁXIMA', anim: 'flow'},
      // Vetor de resistência da barragem para a fundação
      {kind: 'arrow', x1: 22, y1: -20, x2: 44, y2: -68, color: '#22C55E', label: 'DESCARGA NO SOLO', anim: 'pulse'},
    ],
  };
}

function buildSinkholeVisualForScene(sc: StudioSceneSpec, sceneIdx: number): CustomSceneVisualSpec {
  const isCollapsed = sceneIdx === 0 || sceneIdx >= 3;
  return {
    themeTag: 'underground_sinkhole',
    environment: 'underground',
    parts: [
      // Camada profunda de rocha calcária
      {kind: 'box', x: 0, y: -58, w: 184, h: 52, color: '#64748B', label: 'ROCHA CALCÁRIA'},
      // Camada intermediária de solo arenoso
      {kind: 'box', x: 0, y: -8, w: 184, h: 48, color: '#B45309'},
      // Caverna dissolvida subterrânea
      {
        kind: 'sphere',
        x: 0,
        y: -38,
        r: isCollapsed ? 38 : 28,
        color: '#0F172A',
        label: 'CAVERNA OCULTA',
        anim: 'pulse',
      },
      // Pista / Rua na superfície
      {kind: 'box', x: -58, y: 24, w: 68, h: 14, color: '#334155', label: 'ASFALTO'},
      {kind: 'box', x: 58, y: 24, w: 68, h: 14, color: '#334155'},
      // Infiltração de água e colapso central
      {kind: 'arrow', x1: -32, y1: 52, x2: -14, y2: -18, color: '#38BDF8', label: 'INFILTRAÇÃO', anim: 'flow'},
      {
        kind: 'arrow',
        x1: 0,
        y1: 38,
        x2: 0,
        y2: -28,
        color: '#EF4444',
        label: isCollapsed ? 'COLAPSO!' : 'EROSÃO',
        anim: 'flow',
      },
    ],
  };
}

function buildNavigationVisualForScene(sc: StudioSceneSpec, sceneIdx: number): CustomSceneVisualSpec {
  const txt = `${sc.narration} ${sc.headline}`.toLowerCase();
  const focusCrystal = /pedra|cristal|polariza|nuvem|neblina/.test(txt);
  return {
    themeTag: 'viking_navigation',
    environment: 'water',
    parts: [
      // Mar agitado na base
      {kind: 'wave_layer', x: 0, y: -62, w: 192, h: 44, color: '#0284C7', opacity: 0.88, label: 'OCEANO NORTE'},
      // Casco curvo do navio Viking
      {kind: 'arch', x: 0, y: -32, w: 108, h: 36, flip: true, color: '#92400E', label: 'DRAKKAR', anim: 'bob'},
      // Mastro + Vela listrada
      {kind: 'beam', x1: 0, y1: -32, x2: 0, y2: 38, thickness: 5, color: '#78350F'},
      {kind: 'box', x: 6, y: 8, w: 52, h: 44, color: '#EF4444', anim: 'sway'},
      // Sol / Estrela guia no céu
      {kind: 'sphere', x: -58, y: 66, r: 18, color: '#FACC15', label: 'SOL / ASTROS', anim: 'pulse'},
      ...(focusCrystal
        ? ([
            {
              kind: 'cone',
              x: 56,
              y: 44,
              w: 28,
              h: 28,
              dir: 'up',
              color: '#38BDF8',
              label: 'PEDRA SOLAR',
              anim: 'pulse',
            },
            {kind: 'arrow', x1: -38, y1: 60, x2: 42, y2: 46, color: '#FDE047', anim: 'flow'},
          ] as CustomVisualPart[])
        : ([
            {kind: 'arrow', x1: -44, y1: 52, x2: -6, y2: -12, color: '#FDE047', label: 'DIREÇÃO REAL', anim: 'flow'},
          ] as CustomVisualPart[])),
    ],
  };
}

function buildSpaceSpectrumVisualForScene(sc: StudioSceneSpec): CustomSceneVisualSpec {
  return {
    themeTag: 'star_spectroscopy',
    environment: 'space',
    parts: [
      // Estrela luminosa à esquerda
      {kind: 'sphere', x: -62, y: 8, r: 28, color: '#FACC15', label: 'ESTRELA', anim: 'pulse'},
      {kind: 'ring', x: -62, y: 8, r: 38, thickness: 2.5, color: '#FDE047', anim: 'spin'},
      // Feixe de luz branca até o prisma
      {kind: 'beam', x1: -32, y1: 8, x2: -4, y2: 8, thickness: 5, color: '#F8FAFC'},
      // Prisma óptico central
      {kind: 'cone', x: 6, y: 6, w: 36, h: 40, dir: 'up', color: '#38BDF8', label: 'PRISMA'},
      // Decomposição espectral em bandas coloridas (código de barras químico)
      {kind: 'beam', x1: 20, y1: 14, x2: 78, y2: 38, thickness: 5, color: '#EF4444'},
      {kind: 'beam', x1: 20, y1: 8, x2: 78, y2: 14, thickness: 5, color: '#22C55E', label: 'ESPECTRO'},
      {kind: 'beam', x1: 20, y1: 2, x2: 78, y2: -12, thickness: 5, color: '#6366F1'},
    ],
  };
}

function buildGenericDynamicVisual(
  project: StudioProjectSpec,
  sc: StudioSceneSpec,
  sceneIdx: number,
  totalScenes: number
): CustomSceneVisualSpec {
  const isFirst = sceneIdx === 0;
  const isLast = sceneIdx === totalScenes - 1;
  const leftLbl = (sc.leftBadge || 'ENTRADA').slice(0, 16);
  const centerLbl = (sc.screenLine1 || sc.headline || project.name).slice(0, 16);
  const rightLbl = (sc.rightBadge || 'RESULTADO').slice(0, 16);

  return {
    themeTag: 'dynamic_concept_model',
    environment: 'ground',
    cameraAngle: sceneIdx % 2 === 0 ? 'iso_left' : 'iso_right',
    parts: [
      {kind: 'box', x: 0, y: -76, w: 156, h: 12, color: '#475569'},
      // Bloco da causa / origem
      {
        kind: 'box',
        x: -56,
        y: -18,
        w: 44,
        h: 48,
        color: isFirst ? '#EF4444' : '#3B82F6',
        label: leftLbl,
        anim: isFirst ? 'pulse' : 'none',
      },
      // Estrutura central transformadora
      {
        kind: 'truss',
        x1: 0,
        y1: -68,
        x2: 0,
        y2: 34,
        thickness: 18,
        color: '#FACC15',
      },
      {
        kind: 'sphere',
        x: 0,
        y: 42,
        r: 18,
        color: '#38BDF8',
        label: centerLbl,
        anim: 'pulse',
      },
      // Bloco de consequência / prova
      {
        kind: 'box',
        x: 56,
        y: -12,
        w: 44,
        h: 60,
        color: isLast ? '#22C55E' : '#F59E0B',
        label: rightLbl,
        anim: isLast ? 'pulse' : 'bob',
      },
      // Setas dinâmicas conectando o raciocínio físico
      {kind: 'arrow', x1: -30, y1: -10, x2: -10, y2: 18, color: '#FACC15', anim: 'flow'},
      {kind: 'arrow', x1: 12, y1: 18, x2: 32, y2: -6, color: '#22C55E', anim: 'flow'},
    ],
  };
}

export function resolveSceneCustomVisual(
  project: StudioProjectSpec,
  scene: StudioSceneSpec,
  sceneIdx: number
): CustomSceneVisualSpec {
  if (scene.customVisual && Array.isArray(scene.customVisual.parts) && scene.customVisual.parts.length > 0) {
    return scene.customVisual;
  }

  const globalContext = `${project.name} ${project.promptIdea}`.toLowerCase();
  const totalScenes = Math.max(1, project.scenes.length);

  if (/guindaste|grua|contrapeso.*lança|lança.*contrapeso/.test(globalContext)) {
    return buildCraneVisualForScene(scene, sceneIdx, totalScenes);
  }
  if (/elevador|cabine.*cabo|cabo rompido/.test(globalContext)) {
    return buildElevatorVisualForScene(scene, sceneIdx);
  }
  if (/barragem|represa|hidrelétrica|toneladas de água/.test(globalContext)) {
    return buildDamVisualForScene(scene, sceneIdx);
  }
  if (/cratera|dolina|chão abriu|subterrân|vulcão|terremoto|erosão/.test(globalContext)) {
    return buildSinkholeVisualForScene(scene, sceneIdx);
  }
  if (/viking|bússola|navio|barco|oceano|ilha.*nasceu|mar/.test(globalContext)) {
    return buildNavigationVisualForScene(scene, sceneIdx);
  }
  if (/estrela|espectro|prisma|planeta|galáxia|astronomia|buraco negro/.test(globalContext)) {
    return buildSpaceSpectrumVisualForScene(scene);
  }

  return buildGenericDynamicVisual(project, scene, sceneIdx, totalScenes);
}

// ============================================================================
// 2. RENDERIZADOR VETORIAL 2D MULTIMODELO (ADAPTA ESTILO AO CANAL ESCOLHIDO!)
// ============================================================================
function computeAnimTransform2D(
  anim: VisualPartAnim | undefined,
  N: number,
  idx: number
): {dx: number; dy: number; rotDeg: number; scaleMul: number} {
  switch (anim) {
    case 'bob':
      return {dx: 0, dy: Math.sin(N * 0.12 + idx) * 6, rotDeg: 0, scaleMul: 1};
    case 'sway':
      return {dx: 0, dy: 0, rotDeg: Math.sin(N * 0.1 + idx) * 2.8, scaleMul: 1};
    case 'spin':
      return {dx: 0, dy: 0, rotDeg: (N * 2.4) % 360, scaleMul: 1};
    case 'pulse':
      return {dx: 0, dy: 0, rotDeg: 0, scaleMul: 1 + 0.06 * Math.sin(N * 0.18 + idx)};
    case 'shake':
      return {
        dx: Math.sin(N * 0.85 + idx) * 3.5,
        dy: Math.cos(N * 0.95 + idx) * 2.5,
        rotDeg: 0,
        scaleMul: 1,
      };
    default:
      return {dx: 0, dy: 0, rotDeg: 0, scaleMul: 1};
  }
}

export const CustomVisual2DSvg: React.FC<{
  spec: CustomSceneVisualSpec;
  cx: number;
  cy: number;
  scalePx: number;
  N: number;
  localN: number;
  artStyle: Custom2DArtStyle;
}> = ({spec, cx, cy, scalePx, N, localN, artStyle}) => {
  const isXray = artStyle === 'blueprint_xray';
  const isTactical = artStyle === 'tactical_dark';
  const isFlat = artStyle === 'flat_editorial';

  const outlineColor = isXray
    ? '#64748B'
    : isTactical
      ? 'rgba(226, 232, 240, 0.85)'
      : isFlat
        ? '#141428'
        : '#1E293B';
  const strokeW = isTactical ? 2.8 : isFlat ? 4.5 : 3.8;

  const toSx = (nx = 0) => cx + nx * scalePx;
  const toSy = (ny = 0) => cy - ny * scalePx;

  const resolveFill = (rawColor: string, fallback = '#38BDF8') => {
    if (isXray) return '#E2E8F0';
    return rawColor || fallback;
  };

  // Coleta até 5 rótulos sem colisão para manter leitura limpa
  const labelItems: Array<{sx: number; sy: number; text: string; color: string}> = [];

  return (
    <g>
      {/* Moldura sutil de palco conforme o estilo visual */}
      {isTactical && (
        <circle
          cx={cx}
          cy={cy}
          r={104 * scalePx}
          fill="rgba(15, 23, 42, 0.42)"
          stroke="rgba(56, 189, 248, 0.25)"
          strokeWidth={2}
          strokeDasharray="10 8"
        />
      )}
      {(artStyle === 'clean_colorful' || isXray) && (
        <rect
          x={cx - 106 * scalePx}
          y={cy - 102 * scalePx}
          width={212 * scalePx}
          height={204 * scalePx}
          rx={28}
          fill={isXray ? 'rgba(241, 245, 249, 0.92)' : 'rgba(255, 255, 255, 0.78)'}
          stroke={isXray ? '#64748B' : '#1E293B'}
          strokeWidth={4}
          strokeDasharray={isXray ? '14 10' : undefined}
        />
      )}

      {/* Peças da Cena */}
      {spec.parts.map((part, idx) => {
        const entryScale = popScale(localN - idx * 2, 12);
        if (entryScale <= 0.01) return null;

        const {dx, dy, rotDeg, scaleMul} = computeAnimTransform2D(part.anim, N, idx);
        const fill = resolveFill(part.color);
        const fillOp = isXray ? 0.55 : part.opacity ?? (isTactical ? 0.86 : 1);
        const dash = isXray ? '8 6' : undefined;

        if (part.kind === 'truss' || part.kind === 'beam') {
          const sx1 = toSx(part.x1 ?? -40) + dx;
          const sy1 = toSy(part.y1 ?? 0) + dy;
          const sx2 = toSx(part.x2 ?? 40) + dx;
          const sy2 = toSy(part.y2 ?? 0) + dy;
          const midX = (sx1 + sx2) * 0.5;
          const midY = (sy1 + sy2) * 0.5;
          const vx = sx2 - sx1;
          const vy = sy2 - sy1;
          const len = Math.max(1, Math.hypot(vx, vy));
          const ux = vx / len;
          const uy = vy / len;
          const nx = -uy;
          const ny = ux;
          const th = Math.max(4, (part.thickness ?? 10) * scalePx * 0.5);

          if (part.label && labelItems.length < 5) {
            labelItems.push({sx: midX, sy: midY - th - 14, text: part.label, color: part.color});
          }

          if (part.kind === 'beam') {
            return (
              <g
                key={idx}
                opacity={entryScale * fillOp}
                transform={`rotate(${rotDeg} ${midX} ${midY})`}
              >
                <line
                  x1={sx1}
                  y1={sy1}
                  x2={sx2}
                  y2={sy2}
                  stroke={outlineColor}
                  strokeWidth={th * 2 + 4}
                  strokeLinecap="round"
                />
                <line
                  x1={sx1}
                  y1={sy1}
                  x2={sx2}
                  y2={sy2}
                  stroke={fill}
                  strokeWidth={th * 2}
                  strokeLinecap="round"
                  strokeDasharray={dash}
                />
              </g>
            );
          }

          // TRUSS: 2 banzos paralelos + diagonais estruturais em zigue-zague
          const steps = Math.max(3, Math.min(14, Math.round(len / Math.max(16, th * 1.9))));
          const zigPoints: string[] = [];
          for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const side = s % 2 === 0 ? 1 : -1;
            const px = sx1 + vx * t + nx * th * side;
            const py = sy1 + vy * t + ny * th * side;
            zigPoints.push(`${px.toFixed(1)},${py.toFixed(1)}`);
          }

          return (
            <g
              key={idx}
              opacity={entryScale * fillOp}
              transform={`rotate(${rotDeg} ${midX} ${midY})`}
            >
              <polyline
                points={zigPoints.join(' ')}
                fill="none"
                stroke={isXray ? '#94A3B8' : fill}
                strokeWidth={Math.max(2.5, strokeW * 0.85)}
                strokeLinejoin="round"
              />
              <line
                x1={sx1 + nx * th}
                y1={sy1 + ny * th}
                x2={sx2 + nx * th}
                y2={sy2 + ny * th}
                stroke={isXray ? '#64748B' : fill}
                strokeWidth={strokeW + 1.5}
                strokeLinecap="round"
              />
              <line
                x1={sx1 - nx * th}
                y1={sy1 - ny * th}
                x2={sx2 - nx * th}
                y2={sy2 - ny * th}
                stroke={isXray ? '#64748B' : fill}
                strokeWidth={strokeW + 1.5}
                strokeLinecap="round"
              />
            </g>
          );
        }

        if (part.kind === 'arrow') {
          const sx1 = toSx(part.x1 ?? -30);
          const sy1 = toSy(part.y1 ?? 0);
          const sx2 = toSx(part.x2 ?? 30);
          const sy2 = toSy(part.y2 ?? 0);
          const angleDeg = (Math.atan2(sy2 - sy1, sx2 - sx1) * 180) / Math.PI;
          const arrowColor = isXray ? '#EF4444' : part.color || '#FACC15';
          const flowOffset = part.anim === 'flow' ? -(N * 2.6) : 0;

          if (part.label && labelItems.length < 5) {
            labelItems.push({
              sx: (sx1 + sx2) * 0.5,
              sy: (sy1 + sy2) * 0.5 - 16,
              text: part.label,
              color: arrowColor,
            });
          }

          return (
            <g key={idx} opacity={entryScale}>
              <line
                x1={sx1}
                y1={sy1}
                x2={sx2}
                y2={sy2}
                stroke="#0F172A"
                strokeWidth={11}
                strokeLinecap="round"
              />
              <line
                x1={sx1}
                y1={sy1}
                x2={sx2}
                y2={sy2}
                stroke={arrowColor}
                strokeWidth={6.5}
                strokeLinecap="round"
                strokeDasharray="14 9"
                strokeDashoffset={flowOffset}
              />
              <g transform={`translate(${sx2}, ${sy2}) rotate(${angleDeg})`}>
                <polygon
                  points="-20,-13 8,0 -20,13 -13,0"
                  fill={arrowColor}
                  stroke="#0F172A"
                  strokeWidth={3.5}
                  strokeLinejoin="round"
                />
              </g>
            </g>
          );
        }

        const px = toSx(part.x ?? 0) + dx;
        const py = toSy(part.y ?? 0) + dy;
        const pw = Math.max(12, (part.w ?? 32) * scalePx);
        const ph = Math.max(10, (part.h ?? 24) * scalePx);
        const pr = Math.max(8, (part.r ?? 18) * scalePx);
        const totalScale = entryScale * scaleMul;

        if (part.label && labelItems.length < 5) {
          const offsetY = part.kind === 'sphere' || part.kind === 'ring' ? pr + 18 : ph * 0.5 + 18;
          labelItems.push({sx: px, sy: py - offsetY, text: part.label, color: part.color});
        }

        if (part.kind === 'sphere') {
          return (
            <g key={idx} transform={`translate(${px}, ${py}) scale(${totalScale})`}>
              <circle
                r={pr}
                fill={fill}
                fillOpacity={fillOp}
                stroke={outlineColor}
                strokeWidth={strokeW}
                strokeDasharray={dash}
              />
            </g>
          );
        }

        if (part.kind === 'ring') {
          const ringTh = Math.max(3, (part.thickness ?? 4) * (scalePx * 0.45));
          return (
            <g key={idx} transform={`translate(${px}, ${py}) rotate(${rotDeg}) scale(${totalScale})`}>
              <circle
                r={pr}
                fill="none"
                stroke={isXray ? '#64748B' : part.color || '#FACC15'}
                strokeWidth={ringTh}
                strokeDasharray="12 8"
              />
            </g>
          );
        }

        if (part.kind === 'cone') {
          const dir = part.dir || 'up';
          let pts = `0,${-ph / 2} ${pw / 2},${ph / 2} ${-pw / 2},${ph / 2}`;
          if (dir === 'down') pts = `${-pw / 2},${-ph / 2} ${pw / 2},${-ph / 2} 0,${ph / 2}`;
          if (dir === 'left') pts = `${-pw / 2},0 ${pw / 2},${-ph / 2} ${pw / 2},${ph / 2}`;
          if (dir === 'right') pts = `${pw / 2},0 ${-pw / 2},${-ph / 2} ${-pw / 2},${ph / 2}`;
          return (
            <g key={idx} transform={`translate(${px}, ${py}) rotate(${rotDeg}) scale(${totalScale})`}>
              <polygon
                points={pts}
                fill={fill}
                fillOpacity={fillOp}
                stroke={outlineColor}
                strokeWidth={strokeW}
                strokeLinejoin="round"
                strokeDasharray={dash}
              />
            </g>
          );
        }

        if (part.kind === 'arch') {
          const flipSign = part.flip ? 1 : -1;
          const d = `M ${-pw / 2} 0 Q 0 ${flipSign * ph * 1.4} ${pw / 2} 0 Z`;
          return (
            <g key={idx} transform={`translate(${px}, ${py}) rotate(${rotDeg}) scale(${totalScale})`}>
              <path
                d={d}
                fill={fill}
                fillOpacity={fillOp}
                stroke={outlineColor}
                strokeWidth={strokeW}
                strokeLinejoin="round"
                strokeDasharray={dash}
              />
            </g>
          );
        }

        if (part.kind === 'wave_layer') {
          const waveShift = Math.sin(N * 0.1) * 8;
          const topY = -ph / 2;
          const d = `M ${-pw / 2} ${topY} Q ${-pw * 0.25} ${topY - 8 + waveShift} 0 ${topY} T ${pw / 2} ${topY} L ${pw / 2} ${ph / 2} L ${-pw / 2} ${ph / 2} Z`;
          return (
            <g key={idx} transform={`translate(${px}, ${py})`} opacity={entryScale * fillOp}>
              <path d={d} fill={fill} stroke={outlineColor} strokeWidth={strokeW * 0.8} />
            </g>
          );
        }

        // Default: 'box' ou 'cylinder'
        const rx = part.kind === 'cylinder' ? Math.min(pw * 0.45, 16) : 10;
        return (
          <g key={idx} transform={`translate(${px}, ${py}) rotate(${rotDeg}) scale(${totalScale})`}>
            <rect
              x={-pw / 2}
              y={-ph / 2}
              width={pw}
              height={ph}
              rx={rx}
              fill={fill}
              fillOpacity={fillOp}
              stroke={outlineColor}
              strokeWidth={strokeW}
              strokeDasharray={dash}
            />
          </g>
        );
      })}

      {/* Selo de Interrogação no Modo Raio-X (Cena 1 @curiosicasabr) */}
      {isXray && (
        <g transform={`translate(${cx + 84 * scalePx}, ${cy - 84 * scalePx}) scale(${popScale(localN - 6, 12)})`}>
          <circle r={34} fill="#EF4444" stroke="#FFFFFF" strokeWidth={4.5} />
          <text
            x={0}
            y={12}
            textAnchor="middle"
            fill="#FFFFFF"
            fontFamily={FONT_HEAVY}
            fontWeight={900}
            fontSize={38}
          >
            ?
          </text>
        </g>
      )}

      {/* Etiquetas Inteligentes nas Peças */}
      {!isXray &&
        labelItems.map((lbl, lIdx) => {
          const textClean = lbl.text.slice(0, 18).toUpperCase();
          const pillW = Math.max(96, textClean.length * 11.5 + 24);
          return (
            <g key={`lbl-${lIdx}`} transform={`translate(${lbl.sx}, ${lbl.sy})`}>
              <rect
                x={-pillW / 2}
                y={-15}
                width={pillW}
                height={30}
                rx={15}
                fill="rgba(15, 23, 42, 0.92)"
                stroke={lbl.color || '#FACC15'}
                strokeWidth={2.2}
              />
              <text
                x={0}
                y={5}
                textAnchor="middle"
                fill="#F8FAFC"
                fontFamily={isTactical ? FONT_MONO : FONT_CLEAN}
                fontWeight={800}
                fontSize={15}
                letterSpacing="0.04em"
              >
                {textClean}
              </text>
            </g>
          );
        })}
    </g>
  );
};

// ============================================================================
// 3. CONSTRUTOR DE MAQUETE 3D SOB MEDIDA (THREE.JS BANCADA & ESTÚDIO)
// ============================================================================
export interface Custom3DPartAnimated {
  node: THREE.Object3D;
  basePos: THREE.Vector3;
  baseRotZ: number;
  anim: VisualPartAnim;
  flowDir?: THREE.Vector3;
  idx: number;
}

export interface Custom3DSceneRuntime {
  root: THREE.Group;
  animatedParts: Custom3DPartAnimated[];
  cameraAngle: NonNullable<CustomSceneVisualSpec['cameraAngle']>;
  disposables: Array<{dispose: () => void}>;
}

function makeLabelSprite3D(
  text: string,
  borderColor: string,
  disposables: Array<{dispose: () => void}>
): THREE.Sprite {
  const clean = text.slice(0, 18).toUpperCase();
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 384, 80);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = borderColor || '#FACC15';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(8, 10, 368, 60, 30);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '900 26px "Plus Jakarta Sans", "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(clean, 192, 41);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({map: tex, transparent: true, depthTest: false});
  disposables.push(tex, mat);
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.76, 0.16, 1);
  sprite.renderOrder = 20;
  return sprite;
}

function addOrientedStrut3D(
  parent: THREE.Group,
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  radius: number,
  mat: THREE.Material,
  disposables: Array<{dispose: () => void}>
) {
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const len = dir.length();
  if (len < 0.005) return;
  const geom = new THREE.CylinderGeometry(radius, radius, len, 10);
  disposables.push(geom);
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.copy(p1).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
}

export function buildCustomVisual3DScene(
  spec: CustomSceneVisualSpec,
  stageScale = 1
): Custom3DSceneRuntime {
  const root = new THREE.Group();
  const animatedParts: Custom3DPartAnimated[] = [];
  const disposables: Array<{dispose: () => void}> = [];

  // Mapeia [-100..+100] em X e [-90..+90] em Y para uma maquete de 2.30m x 1.52m sobre a bancada (y=0 na superfície da bancada)
  const w3d = 2.32 * stageScale;
  const h3d = 1.52 * stageScale;
  const mapX = (nx = 0) => (nx / 100) * (w3d * 0.5);
  const mapY = (ny = 0) => Math.max(0.02, ((ny + 90) / 180) * h3d);
  const mapZ = (nz = 0) => (nz / 100) * 0.36 * stageScale;
  const mapW = (nw = 24) => Math.max(0.05, (nw / 200) * w3d);
  const mapH = (nh = 20) => Math.max(0.05, (nh / 180) * h3d);

  let labelCount = 0;

  spec.parts.forEach((part, idx) => {
    const colorHex = part.color || '#38BDF8';
    const isTranslucent = (part.opacity ?? 1) < 0.95;
    const mat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.38,
      metalness: part.kind === 'truss' || part.kind === 'beam' ? 0.35 : 0.12,
      transparent: isTranslucent,
      opacity: part.opacity ?? 1,
    });
    disposables.push(mat);

    const holder = new THREE.Group();
    let flowDir: THREE.Vector3 | undefined;

    if (part.kind === 'truss' || part.kind === 'beam') {
      const p1 = new THREE.Vector3(mapX(part.x1 ?? -30), mapY(part.y1 ?? 0), mapZ(part.z ?? 0));
      const p2 = new THREE.Vector3(mapX(part.x2 ?? 30), mapY(part.y2 ?? 0), mapZ(part.z ?? 0));
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      holder.position.copy(mid);
      const localP1 = p1.clone().sub(mid);
      const localP2 = p2.clone().sub(mid);
      const thWorld = Math.max(0.03, ((part.thickness ?? 10) / 200) * w3d);

      if (part.kind === 'beam') {
        addOrientedStrut3D(holder, localP1, localP2, thWorld * 0.42, mat, disposables);
      } else {
        // Treliça espacial 3D autêntica (4 cordas principais + diagonais em Z)
        const dir = new THREE.Vector3().subVectors(localP2, localP1);
        const len = Math.max(0.05, dir.length());
        const u = dir.clone().normalize();
        const refUp = Math.abs(u.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
        const n1 = new THREE.Vector3().crossVectors(u, refUp).normalize().multiplyScalar(thWorld * 0.48);
        const n2 = new THREE.Vector3().crossVectors(u, n1).normalize().multiplyScalar(thWorld * 0.38);
        const chordR = Math.max(0.012, thWorld * 0.13);

        const offsets = [
          n1.clone().add(n2),
          n1.clone().sub(n2),
          n1.clone().negate().add(n2),
          n1.clone().negate().sub(n2),
        ];
        offsets.forEach((off) => {
          addOrientedStrut3D(
            holder,
            localP1.clone().add(off),
            localP2.clone().add(off),
            chordR,
            mat,
            disposables
          );
        });

        const bays = Math.max(3, Math.min(12, Math.round(len / Math.max(0.11, thWorld * 1.15))));
        for (let b = 0; b < bays; b++) {
          const t0 = b / bays;
          const t1 = (b + 1) / bays;
          const baseA = localP1.clone().addScaledVector(dir, t0);
          const baseB = localP1.clone().addScaledVector(dir, t1);
          const sideA = b % 2 === 0 ? n1 : n1.clone().negate();
          const sideB = b % 2 === 0 ? n1.clone().negate() : n1;
          addOrientedStrut3D(
            holder,
            baseA.clone().add(sideA).add(n2),
            baseB.clone().add(sideB).add(n2),
            chordR * 0.72,
            mat,
            disposables
          );
          addOrientedStrut3D(
            holder,
            baseA.clone().add(sideA).sub(n2),
            baseB.clone().add(sideB).sub(n2),
            chordR * 0.72,
            mat,
            disposables
          );
        }
      }

      if (part.label && labelCount < 4) {
        labelCount++;
        const sp = makeLabelSprite3D(part.label, colorHex, disposables);
        sp.position.set(0, thWorld + 0.16, 0.12);
        holder.add(sp);
      }
    } else if (part.kind === 'arrow') {
      const p1 = new THREE.Vector3(mapX(part.x1 ?? -25), mapY(part.y1 ?? 0), 0.18 * stageScale);
      const p2 = new THREE.Vector3(mapX(part.x2 ?? 25), mapY(part.y2 ?? 0), 0.18 * stageScale);
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      holder.position.copy(mid);
      const dir = new THREE.Vector3().subVectors(p2, p1);
      const len = Math.max(0.08, dir.length());
      const u = dir.clone().normalize();
      flowDir = u.clone();

      const arrowMat = new THREE.MeshBasicMaterial({color: colorHex});
      disposables.push(arrowMat);

      const headLen = Math.min(0.14 * stageScale, len * 0.42);
      const shaftEnd = p2.clone().sub(mid).addScaledVector(u, -headLen * 0.7);
      addOrientedStrut3D(holder, p1.clone().sub(mid), shaftEnd, 0.022 * stageScale, arrowMat, disposables);

      const coneGeom = new THREE.ConeGeometry(0.058 * stageScale, headLen, 14);
      disposables.push(coneGeom);
      const coneMesh = new THREE.Mesh(coneGeom, arrowMat);
      coneMesh.position.copy(p2.clone().sub(mid).addScaledVector(u, -headLen * 0.45));
      coneMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), u);
      holder.add(coneMesh);

      if (part.label && labelCount < 4) {
        labelCount++;
        const sp = makeLabelSprite3D(part.label, colorHex, disposables);
        sp.position.set(0, 0.15 * stageScale, 0.08);
        holder.add(sp);
      }
    } else {
      const px = mapX(part.x ?? 0);
      const py = mapY(part.y ?? 0);
      const pz = mapZ(part.z ?? 0);
      holder.position.set(px, py, pz);

      const ww = mapW(part.w ?? 28);
      const wh = mapH(part.h ?? 22);
      const wr = Math.max(0.05, ((part.r ?? 18) / 200) * w3d);
      const depth = part.kind === 'wave_layer' ? 0.56 * stageScale : Math.min(0.42 * stageScale, Math.max(0.14, ww * 0.65));

      let mesh: THREE.Mesh;
      if (part.kind === 'sphere') {
        const g = new THREE.SphereGeometry(wr, 22, 22);
        disposables.push(g);
        mesh = new THREE.Mesh(g, mat);
      } else if (part.kind === 'cylinder') {
        const g = new THREE.CylinderGeometry(ww * 0.45, ww * 0.48, wh, 20);
        disposables.push(g);
        mesh = new THREE.Mesh(g, mat);
      } else if (part.kind === 'cone') {
        const g = new THREE.ConeGeometry(ww * 0.52, wh, 4);
        disposables.push(g);
        mesh = new THREE.Mesh(g, mat);
        mesh.rotation.y = Math.PI / 4;
        if (part.dir === 'down') mesh.rotation.z = Math.PI;
        if (part.dir === 'left') mesh.rotation.z = Math.PI / 2;
        if (part.dir === 'right') mesh.rotation.z = -Math.PI / 2;
      } else if (part.kind === 'ring') {
        const g = new THREE.TorusGeometry(wr, Math.max(0.016, wr * 0.14), 12, 28);
        disposables.push(g);
        mesh = new THREE.Mesh(g, mat);
      } else if (part.kind === 'arch') {
        const g = new THREE.CylinderGeometry(ww * 0.5, ww * 0.36, depth, 18, 1, false, 0, Math.PI);
        disposables.push(g);
        mesh = new THREE.Mesh(g, mat);
        mesh.rotation.x = Math.PI / 2;
        mesh.rotation.z = part.flip ? Math.PI / 2 : -Math.PI / 2;
      } else {
        const g = new RoundedBoxGeometry(ww, wh, depth, 3, Math.min(0.03, Math.min(ww, wh) * 0.15));
        disposables.push(g);
        mesh = new THREE.Mesh(g, mat);
      }

      mesh.castShadow = !isTranslucent;
      mesh.receiveShadow = true;
      holder.add(mesh);

      if (part.label && labelCount < 4) {
        labelCount++;
        const sp = makeLabelSprite3D(part.label, colorHex, disposables);
        const topOff = part.kind === 'sphere' || part.kind === 'ring' ? wr + 0.14 : wh * 0.5 + 0.14;
        sp.position.set(0, topOff, 0.1);
        holder.add(sp);
      }
    }

    root.add(holder);
    animatedParts.push({
      node: holder,
      basePos: holder.position.clone(),
      baseRotZ: holder.rotation.z,
      anim: part.anim || 'none',
      flowDir,
      idx,
    });
  });

  return {
    root,
    animatedParts,
    cameraAngle: spec.cameraAngle || 'iso_left',
    disposables,
  };
}

export function animateCustomVisual3DScene(
  rt: Custom3DSceneRuntime,
  N: number,
  localN: number
) {
  const entry = BEZ_SCALE_IN(clamp01(localN / 14));
  rt.root.scale.setScalar(Math.max(0.01, entry));

  rt.animatedParts.forEach((ap) => {
    const {node, basePos, baseRotZ, anim, flowDir, idx} = ap;
    node.position.copy(basePos);
    node.rotation.z = baseRotZ;
    node.scale.setScalar(1);

    if (anim === 'bob') {
      node.position.y = basePos.y + Math.sin(N * 0.12 + idx) * 0.045;
    } else if (anim === 'sway') {
      node.rotation.z = baseRotZ + Math.sin(N * 0.09 + idx) * 0.048;
    } else if (anim === 'spin') {
      node.rotation.z = baseRotZ - N * 0.06;
    } else if (anim === 'pulse') {
      node.scale.setScalar(1 + 0.075 * Math.sin(N * 0.18 + idx));
    } else if (anim === 'shake') {
      node.position.x = basePos.x + Math.sin(N * 0.9 + idx) * 0.024;
      node.position.y = basePos.y + Math.cos(N * 1.05 + idx) * 0.018;
    } else if (anim === 'flow' && flowDir) {
      const cycle = ((N * 0.045 + idx * 0.25) % 1) - 0.5;
      node.position.addScaledVector(flowDir, cycle * 0.12);
    }
  });
}

