import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {FONT_HEAVY, clamp01, BEZ_SCALE_IN} from '../common';
import {
  getCanvasSize,
  type StudioProjectSpec,
  type StudioSceneSpec,
  type StudioWordTiming,
} from './StudioSchema';
import {CustomVisual2DSvg, resolveSceneCustomVisual} from './StudioCustomVisuals';

const FONT_CLEAN = "'Plus Jakarta Sans', 'Inter', 'Segoe UI', sans-serif";
const FONT_CONDENSED = "'Oswald', 'Impact', 'Arial Narrow', 'Plus Jakarta Sans', sans-serif";
const FONT_MONO = "'JetBrains Mono', Consolas, monospace";

const popScale = (n: number, dur = 12) => (n < 0 ? 0 : BEZ_SCALE_IN(clamp01(n / dur)));

const windowOp = (N: number, from: number, to: number, fade = 10) => {
  if (N < from || N > to) return 0;
  return Math.min(clamp01((N - from) / fade), clamp01((to - N) / fade));
};

interface WordPhraseChunk {
  words: StudioWordTiming[];
  from: number;
  to: number;
}

function buildPhraseChunks(words: StudioWordTiming[], wordsPerChunk = 4): WordPhraseChunk[] {
  const chunks: WordPhraseChunk[] = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    const slice = words.slice(i, i + wordsPerChunk);
    if (slice.length === 0) continue;
    chunks.push({
      words: slice,
      from: slice[0].from,
      to: slice[slice.length - 1].to + 4,
    });
  }
  return chunks;
}

function isKeywordToken(raw: string): boolean {
  const clean = raw.replace(/[.,!?:;"—()]/g, '').trim();
  if (!clean) return false;
  if (/\d|%|km|mil|mi|r\$/i.test(clean)) return true;
  return clean.length >= 8;
}

// ============================================================================
// 1. DESIGN @FronteiraDoc — GEO-DOCUMENTÁRIO ESCURO, MAPAS, RADAR & ESCALA 2D
// ============================================================================
const DocMapaRadarStage: React.FC<{
  project: StudioProjectSpec;
  curScene: StudioSceneSpec;
  sceneIdx: number;
  N: number;
  phraseChunks: WordPhraseChunk[];
}> = ({project, curScene, sceneIdx, N, phraseChunks}) => {
  const {width, height} = getCanvasSize(project.aspectRatio);
  const isWide = project.aspectRatio === '16:9';
  const localN = Math.max(0, N - curScene.fromFrame);
  const sceneOp = windowOp(N, curScene.fromFrame, curScene.toFrame, 9);

  const driftX = (N * 0.45) % 80;
  const driftY = (N * 0.3) % 80;
  const pulse = 0.5 + 0.5 * Math.sin(N * 0.14);
  const radarSweepDeg = (N * 3.4) % 360;

  const activeChunk = project.subtitlesEnabled
    ? phraseChunks.find((c) => N >= c.from && N <= c.to)
    : undefined;

  const brandHeader = (project.sectors[0]?.monitorHeader || 'DOCUMENTÁRIO').slice(0, 18);
  const centerCx = width / 2;
  const centerCy = isWide ? height * 0.53 : height * 0.49;

  return (
    <AbsoluteFill
      style={{
        background: 'radial-gradient(circle at 50% 42%, #132336 0%, #0B1522 58%, #060B12 100%)',
        overflow: 'hidden',
      }}
    >
      {/* Grade Cartográfica Tática em Movimento Suave */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}
      >
        <defs>
          <pattern
            id="docGridFine"
            width={40}
            height={40}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${-driftX}, ${-driftY})`}
          >
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148,163,184,0.055)" strokeWidth={1} />
          </pattern>
          <pattern
            id="docGridMajor"
            width={200}
            height={200}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${-driftX}, ${-driftY})`}
          >
            <path d="M 200 0 L 0 0 0 200" fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth={1.5} />
          </pattern>
        </defs>
        <rect width={width} height={height} fill="url(#docGridFine)" />
        <rect width={width} height={height} fill="url(#docGridMajor)" />

        {/* Eixos de Coordenadas estilo @FronteiraDoc */}
        <line
          x1={0}
          y1={centerCy - (isWide ? 90 : 165)}
          x2={width}
          y2={centerCy - (isWide ? 90 : 165)}
          stroke="rgba(226,232,240,0.22)"
          strokeWidth={1.6}
        />
        <line
          x1={width * (isWide ? 0.72 : 0.78)}
          y1={0}
          x2={width * (isWide ? 0.72 : 0.78)}
          y2={height}
          stroke="rgba(226,232,240,0.18)"
          strokeWidth={1.6}
        />
        <text
          x={isWide ? 72 : 48}
          y={centerCy - (isWide ? 102 : 178)}
          fill="rgba(203,213,225,0.52)"
          fontFamily={FONT_MONO}
          fontSize={isWide ? 18 : 20}
          fontWeight={700}
        >
          {`LAT -23.${12 + sceneIdx * 4}° • SEC-0${sceneIdx + 1}`}
        </text>
        <text
          x={width * (isWide ? 0.72 : 0.78) + 14}
          y={height * 0.71}
          fill="rgba(203,213,225,0.5)"
          fontFamily={FONT_MONO}
          fontSize={isWide ? 18 : 20}
          fontWeight={700}
        >
          {`GRID-${10 + sceneIdx * 15}`}
        </text>
      </svg>

      {/* Marca d'água superior direita estilo FRONTEIRA */}
      <div
        style={{
          position: 'absolute',
          top: isWide ? 42 : 76,
          right: isWide ? 64 : 56,
          fontFamily: FONT_CONDENSED,
          fontWeight: 600,
          fontSize: isWide ? 28 : 32,
          letterSpacing: '0.32em',
          color: 'rgba(241, 245, 249, 0.72)',
          textTransform: 'uppercase',
          zIndex: 20,
        }}
      >
        {brandHeader}
      </div>

      {/* Tag discreta de capítulo superior esquerda */}
      <div
        style={{
          position: 'absolute',
          top: isWide ? 44 : 80,
          left: isWide ? 64 : 54,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          opacity: sceneOp,
          zIndex: 20,
        }}
      >
        <span
          style={{
            width: 11,
            height: 11,
            borderRadius: '50%',
            background: '#EF4444',
            boxShadow: `0 0 ${10 + pulse * 10}px #EF4444`,
          }}
        />
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: isWide ? 18 : 21,
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: '#94A3B8',
          }}
        >
          {curScene.stepBanner}
        </span>
      </div>

      {/* Manchete Gigante Condensada de Impacto (Números / Datas / Fato) */}
      <div
        style={{
          position: 'absolute',
          top: isWide ? 105 : 168,
          left: 60,
          right: 60,
          textAlign: 'center',
          opacity: sceneOp,
          transform: `scale(${0.92 + 0.08 * popScale(localN, 14)})`,
          zIndex: 25,
        }}
      >
        <div
          style={{
            fontFamily: FONT_CONDENSED,
            fontWeight: 900,
            fontSize: isWide ? 76 : 86,
            lineHeight: 1.02,
            letterSpacing: '-0.01em',
            color: '#F8FAFC',
            textTransform: 'uppercase',
            textShadow: '0 10px 28px rgba(0,0,0,0.65)',
          }}
        >
          {curScene.headline}
        </div>
        {curScene.screenLine1 ? (
          <div
            style={{
              marginTop: 10,
              fontFamily: FONT_CONDENSED,
              fontWeight: 800,
              fontSize: isWide ? 42 : 48,
              letterSpacing: '0.06em',
              color: '#F59E0B',
              textTransform: 'uppercase',
              textShadow: '0 4px 16px rgba(0,0,0,0.6)',
            }}
          >
            {curScene.screenLine1}
          </div>
        ) : null}
      </div>

      {/* PALCO CENTRAL 2D TÁTICO SOB MEDIDA (@FronteiraDoc) */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{position: 'absolute', inset: 0, opacity: sceneOp, zIndex: 15}}
      >
        {/* Retículo Cartográfico + Radar Tático de Fundo */}
        <g transform={`translate(${centerCx}, ${centerCy + 22})`}>
          <circle
            r={isWide ? 225 : 295}
            fill="rgba(15, 23, 42, 0.35)"
            stroke="rgba(239, 68, 68, 0.28)"
            strokeWidth={2}
            strokeDasharray="12 10"
          />
          <line
            x1={0}
            y1={0}
            x2={Math.cos((radarSweepDeg * Math.PI) / 180) * (isWide ? 225 : 295)}
            y2={Math.sin((radarSweepDeg * Math.PI) / 180) * (isWide ? 225 : 295)}
            stroke="rgba(248, 113, 113, 0.45)"
            strokeWidth={2.5}
          />
        </g>

        <CustomVisual2DSvg
          spec={resolveSceneCustomVisual(project, curScene, sceneIdx)}
          cx={centerCx}
          cy={centerCy + 22}
          scalePx={isWide ? 2.0 : 2.75}
          N={N}
          localN={localN}
          artStyle="tactical_dark"
        />
      </svg>

      {/* Card de Telemetria Borda Âmbar (Estilo "88 KM/H velocidade de deslocamento") */}
      {(curScene.rightBadge || curScene.screenLine2) && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: isWide ? 185 : 430,
            transform: `translateX(-50%) scale(${popScale(localN - 14, 12)})`,
            opacity: sceneOp,
            background: 'rgba(8, 13, 22, 0.92)',
            border: '2px solid #F59E0B',
            borderRadius: 14,
            padding: isWide ? '12px 28px' : '14px 32px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            boxShadow: '0 14px 34px rgba(0,0,0,0.55)',
            zIndex: 30,
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#F59E0B',
              boxShadow: '0 0 10px #F59E0B',
            }}
          />
          <div style={{textAlign: 'left'}}>
            <div
              style={{
                fontFamily: FONT_CLEAN,
                fontWeight: 900,
                fontSize: isWide ? 25 : 28,
                color: '#F8FAFC',
                letterSpacing: '0.03em',
              }}
            >
              {curScene.rightBadge || curScene.screenLine2}
            </div>
            {curScene.screenLine2 && curScene.rightBadge && curScene.screenLine2 !== curScene.rightBadge ? (
              <div
                style={{
                  fontFamily: FONT_CLEAN,
                  fontSize: isWide ? 16 : 18,
                  color: '#94A3B8',
                  marginTop: 2,
                }}
              >
                {curScene.screenLine2}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Legenda Documental em Frases de 4 Palavras com Palavra Ativa em Âmbar (#FFA800) */}
      {activeChunk ? (
        <div
          style={{
            position: 'absolute',
            left: 56,
            right: 56,
            bottom: isWide ? 72 : 275,
            textAlign: 'center',
            display: 'flex',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: isWide ? 14 : 16,
            zIndex: 45,
          }}
        >
          {activeChunk.words.map((w, idx) => {
            const isSpokenNow = N >= w.from && N <= w.to + 2;
            const highlight = isSpokenNow || isKeywordToken(w.text);
            return (
              <span
                key={`${w.from}-${idx}`}
                style={{
                  fontFamily: FONT_CLEAN,
                  fontWeight: 900,
                  fontSize: isWide ? 48 : 54,
                  color: isSpokenNow ? '#FFA800' : highlight ? '#FBBF24' : '#F8FAFC',
                  textShadow: '0 4px 18px rgba(0,0,0,0.88), 0 2px 4px rgba(0,0,0,0.95)',
                  transform: isSpokenNow ? 'scale(1.06)' : 'scale(1)',
                  display: 'inline-block',
                }}
              >
                {w.text}
              </span>
            );
          })}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ============================================================================
// 2. DESIGN @HistoriandoCuriosidades — ILUSTRAÇÃO FLAT 2D, MASCOTE & CAMADAS
// ============================================================================
const FlatMascot2D: React.FC<{
  x: number;
  y: number;
  scale?: number;
  N: number;
  variant?: 'laurel' | 'explorer' | 'sleepcap' | 'plain';
}> = ({x, y, scale = 1, N, variant = 'laurel'}) => {
  const bobY = Math.sin(N * 0.12) * 5;
  const isBlink = N % 85 >= 81;
  const waveDeg = Math.sin(N * 0.18) * 14;

  return (
    <g transform={`translate(${x}, ${y + bobY}) scale(${scale})`}>
      {/* Sombra no chão */}
      <ellipse cx={0} cy={78} rx={44} ry={10} fill="rgba(15, 23, 42, 0.28)" />
      {/* Perninhas */}
      <rect x={-24} y={54} width={16} height={22} rx={8} fill="#1E1B2E" />
      <rect x={8} y={54} width={16} height={22} rx={8} fill="#1E1B2E" />
      {/* Braço esquerdo */}
      <rect
        x={-54}
        y={8}
        width={22}
        height={13}
        rx={6.5}
        fill="#FFFBEB"
        stroke="#1E1B2E"
        strokeWidth={4.5}
        transform="rotate(-24 -42 14)"
      />
      {/* Braço direito apontando animado */}
      <rect
        x={32}
        y={4}
        width={34}
        height={13}
        rx={6.5}
        fill="#FFFBEB"
        stroke="#1E1B2E"
        strokeWidth={4.5}
        transform={`rotate(${-15 + waveDeg} 36 10)`}
      />
      {/* Corpo pílula arredondado estilo @HistoriandoCuriosidades */}
      <rect
        x={-40}
        y={-46}
        width={80}
        height={106}
        rx={38}
        fill="#FFFBEB"
        stroke="#1E1B2E"
        strokeWidth={5}
      />
      {/* Faixa editorial dourada */}
      <path d="M -38 22 Q 0 34 38 22" fill="none" stroke="#FACC15" strokeWidth={6} />
      {/* Olhos expressivos */}
      {isBlink ? (
        <>
          <line x1={-22} y1={-12} x2={-6} y2={-12} stroke="#1E1B2E" strokeWidth={4.5} strokeLinecap="round" />
          <line x1={6} y1={-12} x2={22} y2={-12} stroke="#1E1B2E" strokeWidth={4.5} strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx={-14} cy={-12} r={11} fill="#FFFFFF" stroke="#1E1B2E" strokeWidth={4} />
          <circle cx={-12} cy={-12} r={5} fill="#1E1B2E" />
          <circle cx={14} cy={-12} r={11} fill="#FFFFFF" stroke="#1E1B2E" strokeWidth={4} />
          <circle cx={16} cy={-12} r={5} fill="#1E1B2E" />
        </>
      )}
      {/* Sorriso simpático */}
      <path d="M -11 6 Q 0 16 11 6" fill="none" stroke="#1E1B2E" strokeWidth={4} strokeLinecap="round" />

      {/* Acessório contextual */}
      {variant === 'laurel' && (
        <g transform="translate(0, -45)">
          {[-26, -14, -2, 10, 22].map((lx, i) => (
            <ellipse
              key={i}
              cx={lx}
              cy={Math.abs(lx) * 0.15}
              rx={8}
              ry={5}
              fill="#4ADE80"
              stroke="#1E1B2E"
              strokeWidth={3}
            />
          ))}
        </g>
      )}
      {variant === 'explorer' && (
        <g transform="translate(0, -48)">
          <ellipse cx={0} cy={4} rx={44} ry={9} fill="#FACC15" stroke="#1E1B2E" strokeWidth={4} />
          <path d="M -26 4 Q 0 -24 26 4 Z" fill="#FACC15" stroke="#1E1B2E" strokeWidth={4} />
        </g>
      )}
    </g>
  );
};

function resolveFlatMode(
  sc: StudioSceneSpec,
  sceneIdx: number,
  totalScenes: number
):
  | 'flat_horizon_globe'
  | 'flat_myth_vs_fact'
  | 'flat_layers_cross_section'
  | 'flat_puzzle_pieces'
  | 'flat_window_conclusion' {
  const eff = sc.visualEffect;
  if (
    eff === 'flat_horizon_globe' ||
    eff === 'flat_myth_vs_fact' ||
    eff === 'flat_layers_cross_section' ||
    eff === 'flat_puzzle_pieces' ||
    eff === 'flat_window_conclusion'
  ) {
    return eff;
  }
  if (sceneIdx === totalScenes - 1) return 'flat_window_conclusion';
  const cycle: Array<
    'flat_horizon_globe' | 'flat_myth_vs_fact' | 'flat_layers_cross_section' | 'flat_puzzle_pieces'
  > = ['flat_horizon_globe', 'flat_myth_vs_fact', 'flat_layers_cross_section', 'flat_puzzle_pieces'];
  return cycle[sceneIdx % cycle.length];
}

const IlustradoFlat2DStage: React.FC<{
  project: StudioProjectSpec;
  curScene: StudioSceneSpec;
  sceneIdx: number;
  N: number;
  phraseChunks: WordPhraseChunk[];
}> = ({project, curScene, sceneIdx, N, phraseChunks}) => {
  const {width, height} = getCanvasSize(project.aspectRatio);
  const isWide = project.aspectRatio === '16:9';
  const localN = Math.max(0, N - curScene.fromFrame);
  const sceneOp = windowOp(N, curScene.fromFrame, curScene.toFrame, 9);
  const totalScenes = Math.max(1, project.scenes.length);
  const mode = resolveFlatMode(curScene, sceneIdx, totalScenes);

  const activeChunk = project.subtitlesEnabled
    ? phraseChunks.find((c) => N >= c.from && N <= c.to)
    : undefined;

  const bgMap: Record<typeof mode, string> = {
    flat_horizon_globe: 'linear-gradient(180deg, #16285E 0%, #0F1B40 62%, #080E24 100%)',
    flat_myth_vs_fact: 'linear-gradient(180deg, #192958 0%, #101A3B 68%, #090F24 100%)',
    flat_layers_cross_section: 'linear-gradient(180deg, #5C8397 0%, #7BA0B0 54%, #5A9347 54%, #497A38 100%)',
    flat_puzzle_pieces: 'linear-gradient(180deg, #17162E 0%, #221E42 100%)',
    flat_window_conclusion: 'linear-gradient(180deg, #19142B 0%, #231B3B 100%)',
  };

  const cx = width / 2;
  const cy = isWide ? height * 0.54 : height * 0.52;

  return (
    <AbsoluteFill style={{background: bgMap[mode], overflow: 'hidden'}}>
      {/* Estrelinhas discretas nos cenários noturnos/espaciais */}
      {mode !== 'flat_layers_cross_section' && (
        <svg width={width} height={height} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          {Array.from({length: 28}).map((_, i) => {
            const sx = ((i * 197 + 83) % (width - 80)) + 40;
            const sy = ((i * 131 + 59) % Math.floor(height * 0.72)) + 40;
            const tw = 0.35 + 0.65 * Math.abs(Math.sin(N * 0.06 + i));
            return <circle key={i} cx={sx} cy={sy} r={i % 3 === 0 ? 3 : 2} fill="#FFFFFF" opacity={tw * 0.55} />;
          })}
        </svg>
      )}

      {/* INDICADOR DE BOLINHAS DE ETAPA NO TOPO (Assinatura @HistoriandoCuriosidades) */}
      <div
        style={{
          position: 'absolute',
          top: isWide ? 38 : 96,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          zIndex: 35,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          {project.scenes.slice(0, 12).map((s, idx) => {
            const isCur = idx === sceneIdx;
            const isPast = idx < sceneIdx;
            return (
              <span
                key={s.id}
                style={{
                  width: isCur ? 20 : 12,
                  height: isCur ? 20 : 12,
                  borderRadius: '50%',
                  background: isCur ? '#FACC15' : isPast ? '#F8FAFC' : 'rgba(248, 250, 252, 0.28)',
                  border: '3px solid #141428',
                  boxShadow: isCur ? '0 0 12px rgba(250, 204, 21, 0.7)' : 'none',
                }}
              />
            );
          })}
        </div>
        <div
          style={{
            fontFamily: FONT_CLEAN,
            fontWeight: 700,
            fontSize: isWide ? 20 : 23,
            color: '#F8FAFC',
            textShadow: '0 2px 8px rgba(0,0,0,0.65)',
            letterSpacing: '0.02em',
          }}
        >
          {`etapa ${sceneIdx + 1} de ${totalScenes} • ${curScene.stepBanner.toLowerCase()}`}
        </div>
      </div>

      {/* Título Editorial com Contorno Escuro Limpo */}
      <div
        style={{
          position: 'absolute',
          top: isWide ? 124 : 210,
          left: 64,
          right: 64,
          textAlign: 'center',
          opacity: sceneOp,
          transform: `scale(${0.92 + 0.08 * popScale(localN, 12)})`,
          zIndex: 30,
        }}
      >
        <div
          style={{
            fontFamily: FONT_CLEAN,
            fontWeight: 900,
            fontSize: isWide ? 54 : 58,
            color: '#FFFFFF',
            WebkitTextStroke: '8px #18182F',
            paintOrder: 'stroke fill',
            lineHeight: 1.12,
          }}
        >
          {curScene.headline}
        </div>
        {curScene.screenLine1 ? (
          <div
            style={{
              marginTop: 8,
              fontFamily: FONT_CLEAN,
              fontWeight: 800,
              fontSize: isWide ? 26 : 29,
              color: '#FDE047',
              WebkitTextStroke: '5px #18182F',
              paintOrder: 'stroke fill',
            }}
          >
            {curScene.screenLine1}
          </div>
        ) : null}
      </div>

      {/* CENÁRIOS ILUSTRADOS FLAT 2D SOB MEDIDA (@HistoriandoCuriosidades) */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{position: 'absolute', inset: 0, opacity: sceneOp, zIndex: 20}}
      >
        <CustomVisual2DSvg
          spec={resolveSceneCustomVisual(project, curScene, sceneIdx)}
          cx={cx}
          cy={cy + 20}
          scalePx={isWide ? 2.05 : 2.75}
          N={N}
          localN={localN}
          artStyle="flat_editorial"
        />

        {/* Pílulas de apoio nas laterais / base + Mascote @HistoriandoCuriosidades */}
        {curScene.leftBadge ? (
          <g transform={`translate(${cx - (isWide ? 310 : 195)}, ${cy + (isWide ? 195 : 315)})`}>
            <rect x={-140} y={-24} width={280} height={48} rx={24} fill="#141428" stroke="#FACC15" strokeWidth={2.5} />
            <text x={0} y={7} textAnchor="middle" fill="#FDE047" fontFamily={FONT_CLEAN} fontWeight={800} fontSize={20}>
              {curScene.leftBadge.slice(0, 22)}
            </text>
          </g>
        ) : null}
        {curScene.rightBadge ? (
          <g transform={`translate(${cx + (isWide ? 240 : 195)}, ${cy + (isWide ? 195 : 315)})`}>
            <rect x={-140} y={-24} width={280} height={48} rx={24} fill="#141428" stroke="#86EFAC" strokeWidth={2.5} />
            <text x={0} y={7} textAnchor="middle" fill="#F8FAFC" fontFamily={FONT_CLEAN} fontWeight={800} fontSize={20}>
              {curScene.rightBadge.slice(0, 22)}
            </text>
          </g>
        ) : null}

        <FlatMascot2D
          x={cx + (isWide ? 390 : 320)}
          y={cy + (isWide ? 105 : 210)}
          scale={0.78}
          N={N}
          variant={sceneIdx % 2 === 0 ? 'laurel' : 'explorer'}
        />
      </svg>

      {/* Legenda Pílula Escura Arredondada com Palavra-Chave em Amarelo */}
      {activeChunk ? (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: isWide ? 64 : 265,
            transform: 'translateX(-50%)',
            background: 'rgba(18, 18, 34, 0.86)',
            border: '2px solid rgba(255,255,255,0.14)',
            borderRadius: 20,
            padding: isWide ? '14px 32px' : '16px 34px',
            display: 'flex',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: 12,
            maxWidth: width - 110,
            boxShadow: '0 10px 28px rgba(0,0,0,0.45)',
            zIndex: 45,
          }}
        >
          {activeChunk.words.map((w, idx) => {
            const isSpokenNow = N >= w.from && N <= w.to + 2;
            return (
              <span
                key={`${w.from}-${idx}`}
                style={{
                  fontFamily: FONT_CLEAN,
                  fontWeight: 800,
                  fontSize: isWide ? 40 : 44,
                  color: isSpokenNow ? '#FDE047' : '#FFFFFF',
                  whiteSpace: 'nowrap',
                }}
              >
                {w.text}
              </span>
            );
          })}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ============================================================================
// 3. DESIGN @curiosicasabr + @engenhocaexplicadas — BLUEPRINT CLEAN & CARDS 2D
// ============================================================================
function resolveEditorialMode(
  sc: StudioSceneSpec,
  sceneIdx: number,
  totalScenes: number
): 'blueprint_question' | 'gears_mechanism' | 'area_ring_scale' | 'step_comparison_cards' | 'confetti_reveal' {
  const eff = sc.visualEffect;
  if (
    eff === 'blueprint_question' ||
    eff === 'gears_mechanism' ||
    eff === 'area_ring_scale' ||
    eff === 'step_comparison_cards' ||
    eff === 'confetti_reveal'
  ) {
    return eff;
  }
  if (sceneIdx === 0) return 'blueprint_question';
  if (sceneIdx === totalScenes - 1) return 'confetti_reveal';
  const cycle: Array<'gears_mechanism' | 'area_ring_scale' | 'step_comparison_cards'> = [
    'gears_mechanism',
    'area_ring_scale',
    'step_comparison_cards',
  ];
  return cycle[(sceneIdx - 1) % cycle.length];
}

const EditorialKinetic2DStage: React.FC<{
  project: StudioProjectSpec;
  curScene: StudioSceneSpec;
  sceneIdx: number;
  N: number;
}> = ({project, curScene, sceneIdx, N}) => {
  const {width, height} = getCanvasSize(project.aspectRatio);
  const isWide = project.aspectRatio === '16:9';
  const localN = Math.max(0, N - curScene.fromFrame);
  const sceneOp = windowOp(N, curScene.fromFrame, curScene.toFrame, 9);
  const totalScenes = Math.max(1, project.scenes.length);
  const mode = resolveEditorialMode(curScene, sceneIdx, totalScenes);

  const curWord = project.subtitlesEnabled
    ? project.words.find((w) => N >= w.from && N <= w.to + 2)
    : undefined;

  const isBlueprint = sceneIdx === 0 || mode === 'blueprint_question';

  const bgStyle = isBlueprint
    ? 'linear-gradient(180deg, #DDE3EA 0%, #C7D0DC 100%)'
    : 'linear-gradient(180deg, #CFE8FA 0%, #DCF1FD 65%, #9BD38A 65%, #84C272 100%)';

  const pillDotColor =
    isBlueprint
      ? '#EF4444'
      : mode === 'confetti_reveal' || sceneIdx === totalScenes - 1
        ? '#22C55E'
        : '#0EA5E9';

  const cx = width / 2;
  const cy = isWide ? height * 0.54 : height * 0.52;

  return (
    <AbsoluteFill style={{background: bgStyle, overflow: 'hidden'}}>
      {/* Nuvens suaves 2D estilo @curiosicasabr */}
      <svg width={width} height={height} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        {[
          {x: 190 + ((N * 0.4) % 160), y: isWide ? 120 : 210, s: 1},
          {x: width - 240 - ((N * 0.3) % 140), y: isWide ? 150 : 290, s: 0.85},
        ].map((cl, idx) => (
          <g key={idx} transform={`translate(${cl.x}, ${cl.y}) scale(${cl.s})`} opacity={isBlueprint ? 0.55 : 0.9}>
            <circle cx={-36} cy={8} r={28} fill="#FFFFFF" />
            <circle cx={0} cy={-6} r={36} fill="#FFFFFF" />
            <circle cx={38} cy={8} r={26} fill="#FFFFFF" />
            <rect x={-40} y={8} width={82} height={28} rx={14} fill="#FFFFFF" />
          </g>
        ))}
      </svg>

      {/* Selo Numérico Amarelo Inclinado (@engenhocaexplicadas) */}
      <div
        style={{
          position: 'absolute',
          top: isWide ? 56 : 165,
          left: isWide ? 78 : 68,
          width: isWide ? 84 : 94,
          height: isWide ? 84 : 94,
          borderRadius: 20,
          background: '#FACC15',
          border: '5px solid #18181B',
          boxShadow: '0 8px 0 #18181B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `rotate(-6deg) scale(${popScale(localN, 12)})`,
          opacity: sceneOp,
          zIndex: 35,
        }}
      >
        <span
          style={{
            fontFamily: FONT_HEAVY,
            fontWeight: 900,
            fontSize: isWide ? 46 : 52,
            color: '#18181B',
          }}
        >
          {sceneIdx + 1}
        </span>
      </div>

      {/* Pílula Branca Flutuante com Ponto Colorido (@curiosicasabr) */}
      <div
        style={{
          position: 'absolute',
          top: isWide ? 72 : 285,
          left: '50%',
          transform: `translateX(-50%) scale(${popScale(localN - 4, 12)})`,
          opacity: sceneOp,
          background: '#FFFFFF',
          border: '3px solid rgba(15, 23, 42, 0.12)',
          borderRadius: 999,
          padding: isWide ? '14px 34px' : '16px 36px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          boxShadow: '0 14px 30px rgba(15, 23, 42, 0.16)',
          maxWidth: width - 140,
          zIndex: 35,
        }}
      >
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: pillDotColor,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: FONT_CLEAN,
            fontWeight: 900,
            fontSize: isWide ? 34 : 36,
            color: '#0F172A',
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {curScene.headline}
        </span>
      </div>

      {/* DIAGRAMA CENTRAL CLEAN 2D SOB MEDIDA */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{position: 'absolute', inset: 0, opacity: sceneOp, zIndex: 20}}
      >
        <CustomVisual2DSvg
          spec={resolveSceneCustomVisual(project, curScene, sceneIdx)}
          cx={cx}
          cy={cy + 20}
          scalePx={isWide ? 1.95 : 2.65}
          N={N}
          localN={localN}
          artStyle={isBlueprint ? 'blueprint_xray' : 'clean_colorful'}
        />

        {/* Chuva de Confetes na Conclusão (Assinatura @curiosicasabr!) */}
        {(mode === 'confetti_reveal' || sceneIdx === totalScenes - 1) &&
          Array.from({length: 46}).map((_, i) => {
            const colors = ['#EF4444', '#3B82F6', '#FACC15', '#22C55E', '#EC4899', '#8B5CF6'];
            const xBase = ((i * 173 + 41) % (width - 60)) + 30;
            const sway = Math.sin(localN * 0.12 + i) * 22;
            const yPos = ((localN * (5.5 + (i % 4) * 1.4) + i * 37) % (height * 0.75)) + 20;
            const rot = localN * (4 + (i % 5)) + i * 25;
            return (
              <rect
                key={i}
                x={xBase + sway}
                y={yPos}
                width={16}
                height={9}
                rx={2}
                fill={colors[i % colors.length]}
                transform={`rotate(${rot} ${xBase + sway} ${yPos})`}
              />
            );
          })}
      </svg>

      {/* Selos inferiores de apoio */}
      {curScene.leftBadge || curScene.rightBadge ? (
        <div
          style={{
            position: 'absolute',
            left: 56,
            right: 56,
            bottom: isWide ? 188 : 445,
            display: 'flex',
            justifyContent: 'center',
            gap: 16,
            flexWrap: 'wrap',
            opacity: sceneOp,
            zIndex: 30,
          }}
        >
          {curScene.leftBadge ? (
            <div
              style={{
                background: '#FFFFFF',
                border: '3px solid #1E293B',
                borderRadius: 999,
                padding: '10px 24px',
                fontFamily: FONT_CLEAN,
                fontWeight: 800,
                fontSize: isWide ? 23 : 25,
                color: '#0F172A',
                boxShadow: '0 6px 0 #1E293B',
              }}
            >
              {curScene.leftBadge}
            </div>
          ) : null}
          {curScene.rightBadge ? (
            <div
              style={{
                background: '#FEF08A',
                border: '3px solid #1E293B',
                borderRadius: 999,
                padding: '10px 24px',
                fontFamily: FONT_CLEAN,
                fontWeight: 800,
                fontSize: isWide ? 23 : 25,
                color: '#0F172A',
                boxShadow: '0 6px 0 #1E293B',
              }}
            >
              {curScene.rightBadge}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Legenda Pop Clean com Contorno Escuro */}
      {curWord ? (
        (() => {
          const wn = N - curWord.from;
          const isKey = isKeywordToken(curWord.text);
          const s = (0.88 + 0.12 * Math.min(1, wn / 4)) * (isKey ? 1.06 : 1);
          return (
            <div
              style={{
                position: 'absolute',
                left: width / 2,
                top: isWide ? 965 : 1545,
                transform: `translate(-50%, -50%) scale(${s})`,
                fontFamily: FONT_HEAVY,
                fontWeight: 900,
                fontSize: isWide ? 60 : 68,
                color: isKey ? '#FFE135' : '#FFFFFF',
                whiteSpace: 'nowrap',
                WebkitTextStroke: '12px #18181B',
                paintOrder: 'stroke fill',
                filter: 'drop-shadow(0 8px 14px rgba(0,0,0,0.32))',
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

// ============================================================================
// DISPATCHER UNIFICADO PARA OS 3 DESIGNS 2D MOTION
// ============================================================================
export const Studio2DStage: React.FC<{
  project: StudioProjectSpec;
  N: number;
}> = ({project, N}) => {
  const phraseChunks = useMemo(() => buildPhraseChunks(project.words, 4), [project.words]);

  const rawIdx = project.scenes.findIndex((s) => N >= s.fromFrame && N <= s.toFrame);
  const sceneIdx = rawIdx >= 0 ? rawIdx : Math.max(0, project.scenes.length - 1);
  const curScene = project.scenes[sceneIdx];

  if (!curScene) {
    return <AbsoluteFill style={{background: '#090D16'}} />;
  }

  if (project.modelId === 'doc_mapa_radar') {
    return (
      <DocMapaRadarStage
        project={project}
        curScene={curScene}
        sceneIdx={sceneIdx}
        N={N}
        phraseChunks={phraseChunks}
      />
    );
  }

  if (project.modelId === 'ilustrado_flat_2d') {
    return (
      <IlustradoFlat2DStage
        project={project}
        curScene={curScene}
        sceneIdx={sceneIdx}
        N={N}
        phraseChunks={phraseChunks}
      />
    );
  }

  return (
    <EditorialKinetic2DStage
      project={project}
      curScene={curScene}
      sceneIdx={sceneIdx}
      N={N}
    />
  );
};

