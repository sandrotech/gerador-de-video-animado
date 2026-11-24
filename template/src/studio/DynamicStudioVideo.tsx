import React from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame} from 'remotion';
import {Fonts, FONT_HEAVY, clamp01, BEZ_SCALE_IN} from '../common';
import {
  YellowLabel3D,
  StatusPillBadge,
  SpeedometerGaugeCard,
  ThermostatBadge2D,
} from '../shots/G1/diorama';
import {DynamicStudioDiorama} from './DynamicStudioDiorama';
import {Studio2DStage} from './Studio2DDesigns';
import {
  StudioProjectSpec,
  DEFAULT_DATA_CRITICA_PROJECT,
  getCanvasSize,
  is2DTemplateModel,
} from './StudioSchema';

const popScale = (n: number, dur = 12) => (n < 0 ? 0 : BEZ_SCALE_IN(clamp01(n / dur)));
const windowOp = (N: number, from: number, to: number, fade = 10) => {
  if (N < from || N > to) return 0;
  return Math.min(clamp01((N - from) / fade), clamp01((to - N) / fade));
};

const StudioCurvedArrow: React.FC<{
  canvasW: number;
  canvasH: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  arcHeight?: number;
  opacity?: number;
  dashOffset?: number;
}> = ({canvasW, canvasH, x1, y1, x2, y2, arcHeight = 145, opacity = 1, dashOffset = 0}) => {
  if (opacity <= 0.01) return null;
  const mx = (x1 + x2) * 0.5;
  const my = Math.min(y1, y2) - arcHeight;
  const d = `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
  const angleDeg = (Math.atan2(y2 - my, x2 - mx) * 180) / Math.PI;
  return (
    <svg
      width={canvasW}
      height={canvasH}
      viewBox={`0 0 ${canvasW} ${canvasH}`}
      style={{position: 'absolute', inset: 0, pointerEvents: 'none', opacity, zIndex: 26}}
    >
      <path
        d={d}
        fill="none"
        stroke="#141414"
        strokeWidth={20}
        strokeLinecap="round"
        strokeDasharray="24 22"
        strokeDashoffset={-dashOffset}
      />
      <path
        d={d}
        fill="none"
        stroke="#FFE135"
        strokeWidth={11}
        strokeLinecap="round"
        strokeDasharray="24 22"
        strokeDashoffset={-dashOffset}
      />
      <g transform={`translate(${x2}, ${y2}) rotate(${angleDeg})`}>
        <polygon
          points="-30,-20 14,0 -30,20 -20,0"
          fill="#FFE135"
          stroke="#141414"
          strokeWidth={6}
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
};

function resolveAudioSrc(audioUrl: string): string {
  if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://') || audioUrl.startsWith('blob:')) {
    return audioUrl;
  }
  const clean = audioUrl.replace(/^\/+/, '');
  return staticFile(clean);
}

function pickWordHighlight(raw: string): {color: string; boost: number} {
  const clean = raw.replace(/[.,!?:;"—()]/g, '').trim();
  if (!clean) return {color: '#FFFFFF', boost: 1};
  if (/^\d|r\$|%|km|ton|kg|m²|°/i.test(clean)) return {color: '#FFA800', boost: 1.08};
  if (clean.length >= 8) {
    return {color: '#FFE135', boost: 1.07};
  }
  const lower = clean.toLowerCase();
  if (
    [
      'força',
      'peso',
      'base',
      'torque',
      'vento',
      'carga',
      'lança',
      'solo',
      'freio',
      'cabo',
      'água',
      'luz',
      'prova',
      'fato',
      'mito',
      'pronto',
    ].includes(lower)
  ) {
    return {color: '#FFA800', boost: 1.06};
  }
  return {color: '#FFFFFF', boost: 1.0};
}

export const DynamicStudioVideo: React.FC<{
  project?: StudioProjectSpec;
}> = ({project = DEFAULT_DATA_CRITICA_PROJECT}) => {
  const N = useCurrentFrame() + 1;
  const {width, height} = getCanvasSize(project.aspectRatio);
  const isWide = project.aspectRatio === '16:9';

  const curScene =
    project.scenes.find((s) => N >= s.fromFrame && N <= s.toFrame) ??
    project.scenes[project.scenes.length - 1];

  const curWord = project.subtitlesEnabled
    ? project.words.find((w) => N >= w.from && N <= w.to + 2)
    : undefined;

  const localN = curScene ? N - curScene.fromFrame : 0;
  const sceneOp = curScene ? windowOp(N, curScene.fromFrame, curScene.toFrame, 10) : 0;
  const sceneDur = curScene ? Math.max(30, curScene.toFrame - curScene.fromFrame) : 90;
  const sendArrowStart = curScene ? curScene.fromFrame + Math.floor(sceneDur * 0.58) : 0;

  const isPowerToggle = Math.floor(N / 22) % 2 === 0;

  if (is2DTemplateModel(project.modelId)) {
    return (
      <AbsoluteFill style={{background: '#090D16', overflow: 'hidden'}}>
        <Fonts />
        {project.audioUrl ? <Audio src={resolveAudioSrc(project.audioUrl)} /> : null}
        <Studio2DStage project={project} N={N} />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{background: '#66B2F2', overflow: 'hidden'}}>
      <Fonts />
      {project.audioUrl ? <Audio src={resolveAudioSrc(project.audioUrl)} /> : null}

      {/* Palco 3D Dinâmico (Fluxo Corporativo ou Sala & Experimento) */}
      <DynamicStudioDiorama project={project} N={N} />

      {/* Banner de Etapa no Topo Esquerdo */}
      {curScene?.stepBanner ? (
        <div
          style={{
            position: 'absolute',
            left: isWide ? 42 : 36,
            top: isWide ? 34 : 52,
            background: 'rgba(15, 23, 42, 0.88)',
            border: '3px solid #1E293B',
            borderRadius: 999,
            padding: isWide ? '8px 22px' : '10px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 6px 16px rgba(0,0,0,0.32)',
            zIndex: 45,
          }}
        >
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#FFE135',
              boxShadow: '0 0 10px #FFE135',
            }}
          />
          <span
            style={{
              fontFamily: FONT_HEAVY,
              fontWeight: 900,
              fontSize: isWide ? 21 : 23,
              color: '#F8FAFC',
              letterSpacing: 0.7,
            }}
          >
            {curScene.stepBanner}
          </span>
        </div>
      ) : null}

      {/* Título Amarelo 3D Central da Cena */}
      {curScene?.headline ? (
        <YellowLabel3D
          cx={width / 2}
          cy={isWide ? 175 : 245}
          text={curScene.headline}
          size={isWide ? 48 : 46}
          tilt={curScene.sectorIndex < 0 ? 0 : -2}
          scale={popScale(localN - 4, 12)}
          opacity={sceneOp}
        />
      ) : null}

      {/* Badges de Status Laterais / Superiores sem sobreposição */}
      {curScene?.leftBadge ? (
        <StatusPillBadge
          cx={isWide ? 425 : width / 2}
          cy={isWide ? 320 : 355}
          text={curScene.leftBadge}
          dotColor={curScene.leftBadgeColor || '#FACC15'}
          size={isWide ? 27 : 28}
          scale={popScale(localN - 12, 12)}
          opacity={sceneOp}
        />
      ) : null}

      {curScene?.rightBadge ? (
        <StatusPillBadge
          cx={isWide ? width - 425 : width / 2}
          cy={isWide ? 320 : 440}
          text={curScene.rightBadge}
          dotColor={curScene.rightBadgeColor || '#22C55E'}
          size={isWide ? 27 : 28}
          scale={popScale(localN - 22, 12)}
          opacity={sceneOp}
        />
      ) : null}

      {/* Velocímetro + Termostato exclusivos do preset legado de Ar-Condicionado */}
      {project.id === 'exemplo-sala-experimento' && curScene?.visualEffect === 'speedometer_control' ? (
        <>
          <SpeedometerGaugeCard
            cx={isWide ? width - 320 : 760}
            cy={isWide ? 520 : 590}
            needleValue={isPowerToggle ? 0.25 : 0.78}
            scale={popScale(localN - 18, 12)}
            opacity={sceneOp}
          />
          <ThermostatBadge2D
            cx={isWide ? 320 : 310}
            cy={isWide ? 520 : 590}
            tempText={curScene.screenLine1 || '23 °C'}
            scale={popScale(localN - 24, 12)}
            opacity={sceneOp}
          />
        </>
      ) : null}

      {/* Seta Curva Tracejada quando há envio de dados entre setores */}
      {curScene &&
      curScene.sendDataToSector !== null &&
      curScene.sectorIndex >= 0 &&
      N >= sendArrowStart ? (
        <StudioCurvedArrow
          canvasW={width}
          canvasH={height}
          x1={curScene.sendDataToSector > curScene.sectorIndex ? width * 0.34 : width * 0.68}
          y1={isWide ? 455 : 880}
          x2={curScene.sendDataToSector > curScene.sectorIndex ? width * 0.68 : width * 0.32}
          y2={isWide ? 455 : 880}
          arcHeight={isWide ? 160 : 140}
          opacity={windowOp(N, sendArrowStart, curScene.toFrame, 8)}
          dashOffset={(N - sendArrowStart) * 4}
        />
      ) : null}

      {project.id === 'exemplo-sala-experimento' && curScene?.visualEffect === 'copper_cycle' ? (
        <StudioCurvedArrow
          canvasW={width}
          canvasH={height}
          x1={width * 0.35}
          y1={isWide ? 560 : 960}
          x2={width * 0.65}
          y2={isWide ? 560 : 960}
          arcHeight={125}
          opacity={sceneOp}
          dashOffset={localN * 3.5}
        />
      ) : null}

      {/* Legenda Pop Palavra-por-Palavra */}
      {curWord ? (
        (() => {
          const wn = N - curWord.from;
          const {color, boost} = pickWordHighlight(curWord.text);
          const s = (0.86 + 0.14 * Math.min(1, wn / 4)) * boost;
          return (
            <div
              style={{
                position: 'absolute',
                left: width / 2,
                top: isWide ? 972 : 1520,
                transform: `translate(-50%, -50%) scale(${s})`,
                fontFamily: FONT_HEAVY,
                fontWeight: 900,
                fontSize: isWide ? 60 : 66,
                color,
                whiteSpace: 'nowrap',
                WebkitTextStroke: '12px #141414',
                paintOrder: 'stroke fill',
                filter: 'drop-shadow(0 8px 14px rgba(0,0,0,0.48))',
                zIndex: 50,
              }}
            >
              {curWord.text}
            </div>
          );
        })()
      ) : null}
    </AbsoluteFill>
  );
};

