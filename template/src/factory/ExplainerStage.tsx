import React, {useMemo} from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {Fonts, FONT_HEAVY} from '../common';
import {YellowLabel3D, StatusPillBadge} from '../shots/G1/diorama';
import {ExplainerDiorama} from './ExplainerDiorama';
import type {ExplainerProjectConfig, ExplainerTiming, WordCue} from './types';

type Chunk = {words: WordCue[]; from: number; to: number};

function buildChunks(words: WordCue[], maxPerChunk: number): Chunk[] {
  const out: Chunk[] = [];
  let cur: WordCue[] = [];
  words.forEach((w, i) => {
    cur.push(w);
    const next = words[i + 1];
    const punct = /[.,;!?]$/.test(w.text);
    const gap = next ? next.from - w.to > 8 : true;
    if (cur.length >= maxPerChunk || punct || gap) {
      out.push({words: cur, from: cur[0].from, to: cur[cur.length - 1].to});
      cur = [];
    }
  });
  if (cur.length) out.push({words: cur, from: cur[0].from, to: cur[cur.length - 1].to});
  return out;
}

function activeChunk(chunks: Chunk[], frame: number): Chunk | null {
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const nextFrom = chunks[i + 1]?.from ?? Infinity;
    if (frame >= c.from - 2 && frame < Math.min(c.to + 12, nextFrom - 1)) return c;
  }
  return null;
}

const OverlayCardBox: React.FC<{
  children: React.ReactNode;
  accentColor: string;
  k: number;
  style?: React.CSSProperties;
}> = ({children, accentColor, k, style}) => (
  <div
    style={{
      position: 'absolute',
      background: 'rgba(255,255,255,0.96)',
      borderRadius: 28,
      boxShadow: '0 24px 60px rgba(10,40,25,0.32)',
      borderTop: `8px solid ${accentColor}`,
      padding: '26px 34px',
      fontFamily: FONT_HEAVY,
      opacity: k,
      transform: `translateY(${(1 - k) * 36}px) scale(${0.92 + 0.08 * k})`,
      ...style,
    }}
  >
    {children}
  </div>
);

export interface ExplainerStageProps {
  config: ExplainerProjectConfig;
  timing: ExplainerTiming;
}

export const ExplainerStage: React.FC<ExplainerStageProps> = ({config, timing}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const isVertical = height > width;

  const chunks = useMemo(
    () => buildChunks(timing.words, isVertical ? 4 : 5),
    [timing.words, isVertical],
  );
  const chunk = activeChunk(chunks, frame);

  const actBounds = useMemo(() => {
    return config.acts.map((act, idx) => {
      const start = timing.act_starts[act.id] ?? 0;
      const next = config.acts[idx + 1];
      const end = next ? (timing.act_starts[next.id] ?? timing.total_frames) : timing.total_frames;
      return {act, start, end, len: Math.max(1, end - start)};
    });
  }, [config, timing]);

  let actIdx = 0;
  actBounds.forEach((b, i) => {
    if (frame >= b.start) actIdx = i;
  });
  const current = actBounds[actIdx] ?? actBounds[0];
  const actIn = spring({frame: frame - current.start - 6, fps, config: {damping: 16, mass: 0.7}});

  const fade = interpolate(frame, [0, 14, timing.total_frames - 20, timing.total_frames], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const lastBound = actBounds[actBounds.length - 1];
  const finaleCardFrame = lastBound ? lastBound.start + Math.round(lastBound.len * 0.42) : timing.total_frames;
  const endK = spring({frame: frame - finaleCardFrame, fps, config: {damping: 15}});

  const hookCfg = config.hook;
  const hookDur = hookCfg?.durationFrames ?? 95;
  const hookK = hookCfg
    ? spring({frame, fps, config: {damping: 14, mass: 0.65}}) *
      interpolate(frame, [hookDur - 16, hookDur], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;
  const hookStopwatch = hookCfg?.stopwatchTargetSec
    ? interpolate(frame, [8, Math.max(24, hookDur - 24)], [0, hookCfg.stopwatchTargetSec], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;

  const card = current.act.overlayCard;
  const cardStartDelay = actIdx === 0 && hookCfg ? hookDur + 8 : 36;
  const cardK = card
    ? spring({frame: frame - current.start - cardStartDelay, fps, config: {damping: 18}}) *
      interpolate(frame, [current.end - 18, current.end], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;

  return (
    <AbsoluteFill style={{backgroundColor: config.brand.primaryDark, opacity: fade}}>
      <Fonts />
      <Audio src={staticFile(`assets/${config.slug}/master_audio_sfx.wav`)} />
      <ExplainerDiorama config={config} timing={timing} />

      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 60%, rgba(0,20,10,0.32) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Top HUD (responsivo 16:9 e 9:16) */}
      <div style={{opacity: actIn}}>
        <YellowLabel3D
          cx={isVertical ? 540 : 340}
          cy={isVertical ? 140 : 86}
          text={current.act.title}
          size={isVertical ? 54 : 46}
          scale={0.85 + 0.15 * actIn}
        />
        <StatusPillBadge
          cx={isVertical ? 540 : 1510}
          cy={isVertical ? 230 : 86}
          text={current.act.badge}
          dotColor={current.act.badgeColor}
          size={isVertical ? 26 : 23}
          scale={0.9 + 0.1 * actIn}
        />
      </div>

      {/* Gancho Visual de Alto Impacto (0–3 segundos) */}
      {hookCfg && hookK > 0.01 && (
        <div
          style={{
            position: 'absolute',
            right: isVertical ? 64 : 90,
            left: isVertical ? 64 : undefined,
            top: isVertical ? 310 : 185,
            width: isVertical ? undefined : 620,
            background: 'rgba(11, 21, 40, 0.92)',
            border: `4px solid ${config.brand.accent}`,
            borderRadius: 30,
            padding: '28px 36px',
            boxShadow: '0 26px 70px rgba(0,0,0,0.55)',
            fontFamily: FONT_HEAVY,
            textAlign: 'center',
            opacity: hookK,
            transform: `translateY(${(1 - hookK) * 40}px) scale(${0.86 + 0.14 * hookK})`,
            pointerEvents: 'none',
          }}
        >
          <div style={{fontSize: 24, color: '#5EEAD4', letterSpacing: 1.5}}>{hookCfg.eyebrow}</div>
          <div style={{fontSize: 42, color: '#FFFFFF', marginTop: 8, lineHeight: 1.1}}>{hookCfg.headline}</div>
          {hookCfg.stopwatchTargetSec !== undefined && (
            <div
              style={{
                fontSize: 94,
                color: config.brand.accent,
                lineHeight: 1.05,
                marginTop: 8,
                textShadow: '0 4px 20px rgba(249,115,22,0.45)',
              }}
            >
              {hookStopwatch.toFixed(2).replace('.', ',')}s
            </div>
          )}
          {hookCfg.badgeText && (
            <div
              style={{
                marginTop: 12,
                display: 'inline-block',
                padding: '8px 20px',
                borderRadius: 999,
                background: 'rgba(45, 212, 191, 0.2)',
                border: '2px solid #2DD4BF',
                color: '#5EEAD4',
                fontSize: 22,
              }}
            >
              ⚡ {hookCfg.badgeText}
            </div>
          )}
        </div>
      )}

      {/* Overlay Card Dinâmico por Ato */}
      {card && cardK > 0.01 && (
        <OverlayCardBox
          k={cardK}
          accentColor={card.accentColor || config.brand.primary}
          style={
            isVertical
              ? {left: 80, right: 80, top: 300, textAlign: card.checklist ? 'left' : 'center'}
              : {
                  [card.side === 'left' ? 'left' : 'right']: 85,
                  top: 205,
                  width: card.checklist ? 610 : 540,
                  textAlign: card.checklist ? 'left' : 'center',
                }
          }
        >
          <div style={{fontSize: 24, color: card.accentColor || config.brand.primary, letterSpacing: 1}}>
            {card.eyebrow}
          </div>

          {card.counter && (
            <div style={{fontSize: 74, color: card.accentColor || config.brand.danger, lineHeight: 1.12, whiteSpace: 'nowrap', marginTop: 6}}>
              {card.counter.prefix}
              {interpolate(frame, [current.start + 36, current.start + 120], [0, card.counter.value], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })
                .toFixed(card.counter.decimals ?? 1)
                .replace('.', ',')}
              {card.counter.suffix}
            </div>
          )}

          {card.headline && (
            <div style={{fontSize: 48, color: config.brand.primaryDark, marginTop: 6}}>
              {card.headline}
            </div>
          )}

          {card.subline && (
            <div style={{fontSize: 25, color: '#334155', marginTop: 8}}>{card.subline}</div>
          )}

          {card.highlight && (
            <div
              style={{
                marginTop: 14,
                padding: '12px 18px',
                borderRadius: 16,
                background: '#DCFCE7',
                color: config.brand.primary,
                fontSize: 29,
              }}
            >
              {card.highlight}
            </div>
          )}

          {card.checklist &&
            card.checklist.map((item, i) => {
              const ik = spring({
                frame: frame - current.start - 45 - i * Math.round(current.len * 0.16),
                fps,
                config: {damping: 14},
              });
              return (
                <div
                  key={item}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    margin: '12px 0',
                    opacity: ik,
                    transform: `translateX(${(1 - ik) * -28}px)`,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      background: config.brand.primary,
                      color: '#fff',
                      fontSize: 24,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </div>
                  <div style={{fontSize: 28, color: '#0F172A'}}>{item}</div>
                </div>
              );
            })}
        </OverlayCardBox>
      )}

      {/* Cartão Final */}
      {endK > 0.01 && (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', pointerEvents: 'none'}}>
          <div
            style={{
              background: 'rgba(255,255,255,0.97)',
              borderRadius: 36,
              padding: isVertical ? '40px 48px' : '40px 64px',
              boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
              textAlign: 'center',
              opacity: endK,
              transform: `scale(${0.85 + 0.15 * endK})`,
              marginTop: isVertical ? -160 : -120,
              maxWidth: isVertical ? 920 : 1100,
              borderTop: `10px solid ${config.brand.primary}`,
            }}
          >
            {config.brand.logoAsset ? (
              <Img src={staticFile(config.brand.logoAsset)} style={{width: isVertical ? 480 : 620}} />
            ) : (
              <div
                style={{
                  fontFamily: FONT_HEAVY,
                  fontSize: isVertical ? 54 : 64,
                  color: config.brand.primary,
                  letterSpacing: 1,
                }}
              >
                {config.brand.name}
              </div>
            )}
            <div
              style={{
                fontFamily: FONT_HEAVY,
                fontSize: isVertical ? 40 : 46,
                color: config.brand.primaryDark,
                marginTop: 14,
              }}
            >
              {config.title}
            </div>
            <div
              style={{
                fontFamily: FONT_HEAVY,
                fontSize: isVertical ? 24 : 26,
                color: config.brand.accent,
                marginTop: 8,
                letterSpacing: 2,
              }}
            >
              {config.tagline}
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* Legendas sincronizadas */}
      {chunk && (
        <div
          style={{
            position: 'absolute',
            bottom: isVertical ? 220 : 70,
            left: isVertical ? 60 : 160,
            right: isVertical ? 60 : 160,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              background: 'rgba(12, 38, 26, 0.88)',
              borderRadius: 18,
              padding: '14px 30px',
              boxShadow: '0 14px 34px rgba(0,0,0,0.35)',
              display: 'flex',
              gap: 14,
              flexWrap: 'wrap',
              justifyContent: 'center',
              borderBottom: `4px solid ${config.brand.accent}`,
            }}
          >
            {chunk.words.map((w, i) => {
              const on = frame >= w.from;
              const active = frame >= w.from && frame <= w.to;
              return (
                <span
                  key={`${w.from}-${i}`}
                  style={{
                    fontFamily: FONT_HEAVY,
                    fontSize: isVertical ? 48 : 44,
                    lineHeight: 1.15,
                    color: active ? '#FDBA74' : '#FFFFFF',
                    opacity: on ? 1 : 0.45,
                  }}
                >
                  {w.text}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
