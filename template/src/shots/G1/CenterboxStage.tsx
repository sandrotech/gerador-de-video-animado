import React from 'react';
import {AbsoluteFill, Audio, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Fonts, FONT_HEAVY} from '../../common';
import {YellowLabel3D, StatusPillBadge} from './diorama';
import {CenterboxDioramaStage, CB} from './CenterboxDiorama';
import {CENTERBOX_CUES as C, CENTERBOX_WORDS} from './centerboxWords';

type Chunk = {words: typeof CENTERBOX_WORDS; from: number; to: number};
const CHUNKS: Chunk[] = (() => {
  const out: Chunk[] = [];
  let cur: typeof CENTERBOX_WORDS = [];
  CENTERBOX_WORDS.forEach((w, i) => {
    cur.push(w);
    const next = CENTERBOX_WORDS[i + 1];
    const punct = /[.,;!?]$/.test(w.text);
    const gap = next ? next.from - w.to > 8 : true;
    if (cur.length >= 5 || punct || gap) {
      out.push({words: cur, from: cur[0].from, to: cur[cur.length - 1].to});
      cur = [];
    }
  });
  if (cur.length) out.push({words: cur, from: cur[0].from, to: cur[cur.length - 1].to});
  return out;
})();

function activeChunk(frame: number): Chunk | null {
  for (let i = 0; i < CHUNKS.length; i++) {
    const c = CHUNKS[i];
    const nextFrom = CHUNKS[i + 1]?.from ?? Infinity;
    if (frame >= c.from - 2 && frame < Math.min(c.to + 12, nextFrom - 1)) return c;
  }
  return null;
}

const ACTS = [
  {from: C.f_ato1, title: 'CENÁRIO ANTERIOR', badge: 'INTERMEDIÁRIA 0,75% • CENTERBOX 2,75%', dot: CB.red},
  {from: C.f_ato2, title: 'SETOR DE TI', badge: 'PORTAL PRÓPRIO • 3% LIVRE DE INTERMEDIADOR', dot: CB.blue},
  {from: C.f_ato3, title: 'SIMULAÇÃO NA PRÁTICA', badge: 'R$ 23.581,28 → R$ 21.844,87 LÍQUIDOS', dot: CB.orange},
  {from: C.f_ato4, title: 'FINANCEIRO & AUDITORIA', badge: 'APROVAR • NEGOCIAR • REPROVAR', dot: CB.green},
  {from: C.f_ato5, title: 'RESULTADO', badge: '100% RENTÁVEL • GRUPO CENTERBOX', dot: CB.green},
];

const Card: React.FC<{children: React.ReactNode; style?: React.CSSProperties; k: number}> = ({children, style, k}) => (
  <div
    style={{
      position: 'absolute',
      background: 'rgba(255,255,255,0.96)',
      borderRadius: 28,
      boxShadow: '0 24px 60px rgba(10,40,25,0.35)',
      borderTop: `8px solid ${CB.green}`,
      padding: '26px 34px',
      fontFamily: FONT_HEAVY,
      opacity: k,
      transform: `translateY(${(1 - k) * 40}px) scale(${0.9 + 0.1 * k})`,
      ...style,
    }}
  >
    {children}
  </div>
);

export const CenterboxStage: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const chunk = activeChunk(frame);

  let actIdx = 0;
  ACTS.forEach((a, i) => {
    if (frame >= a.from) actIdx = i;
  });
  const act = ACTS[actIdx];
  const actIn = spring({frame: frame - act.from - 6, fps, config: {damping: 16, mass: 0.7}});

  const fade = interpolate(frame, [0, 14, C.total_frames - 20, C.total_frames], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ATO 1: Card R$ 32,6 MI + divisão 0,75% vs 2,75%
  const a1k =
    spring({frame: frame - 55, fps, config: {damping: 18}}) *
    interpolate(frame, [C.f_ato2 - 18, C.f_ato2], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const counter = interpolate(frame, [55, 140], [0, 32.6], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  // ATO 2: Card Economia do Setor de TI (0,75% -> 0% | 3,50% integral = +R$ 244,5 mil)
  const a2k =
    spring({frame: frame - C.f_ato2 - 40, fps, config: {damping: 18}}) *
    interpolate(frame, [C.f_ato3 - 18, C.f_ato3], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  // ATO 4: Checklist de segurança
  const L4 = C.f_ato5 - C.f_ato4;
  const a4k =
    spring({frame: frame - C.f_ato4 - 30, fps, config: {damping: 18}}) *
    interpolate(frame, [C.f_ato5 - 16, C.f_ato5], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const checks = [
    'Analisa títulos, débito e limite',
    'Aprova, negocia ou reprova na tela',
    'Núcleo único reconfere o saldo',
    'Tudo registrado em trilha de auditoria',
  ];

  // ATO 5: Cartão final com logo
  const endK = spring({frame: frame - (C.f_ato5 + 140), fps, config: {damping: 15}});

  return (
    <AbsoluteFill style={{backgroundColor: CB.greenDark, opacity: fade}}>
      <Fonts />
      <Audio src={staticFile('assets/centerbox-antecipacao/master_audio_sfx.wav')} />
      <CenterboxDioramaStage />

      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 60%, rgba(0,20,10,0.32) 100%)', pointerEvents: 'none'}} />

      <div style={{opacity: actIn}}>
        <YellowLabel3D cx={340} cy={86} text={act.title} size={46} scale={0.85 + 0.15 * actIn} />
        <StatusPillBadge cx={1510} cy={86} text={act.badge} dotColor={act.dot} size={23} scale={0.9 + 0.1 * actIn} />
      </div>

      {a1k > 0.01 && (
        <Card k={a1k} style={{right: 90, top: 200, width: 530, textAlign: 'center', borderTopColor: CB.red}}>
          <div style={{fontSize: 25, color: '#64748B', letterSpacing: 1}}>VOLUME VIA INTERMEDIÁRIA</div>
          <div style={{fontSize: 78, color: CB.red, lineHeight: 1.1, whiteSpace: 'nowrap'}}>
            R$ {counter.toFixed(1).replace('.', ',')} MI
          </div>
          <div style={{fontSize: 26, color: '#334155', marginTop: 8}}>
            <span style={{color: CB.red}}>0,75% Intermediária</span> • <span style={{color: CB.green}}>2,75% Centerbox</span>
          </div>
        </Card>
      )}

      {a2k > 0.01 && (
        <Card k={a2k} style={{left: 85, top: 210, width: 540, borderTopColor: CB.blue}}>
          <div style={{fontSize: 24, color: CB.blue, letterSpacing: 1}}>PORTAL CRIADO PELO SETOR DE TI</div>
          <div style={{fontSize: 48, color: CB.greenDark, marginTop: 6}}>3% LIVRE</div>
          <div style={{fontSize: 26, color: '#334155', marginTop: 6}}>Sem empresa intermediadora</div>
          <div style={{marginTop: 14, padding: '12px 18px', borderRadius: 16, background: '#DCFCE7', color: CB.green, fontSize: 30}}>
            Economia direta para o grupo
          </div>
        </Card>
      )}

      {a4k > 0.01 && (
        <Card k={a4k} style={{left: 90, top: 210, width: 610}}>
          <div style={{fontSize: 26, color: CB.green, marginBottom: 12}}>PORTAL DE ANTECIPAÇÃO DE TÍTULOS</div>
          {checks.map((c, i) => {
            const ik = spring({frame: frame - C.f_ato4 - 45 - i * Math.round(L4 * 0.16), fps, config: {damping: 14}});
            return (
              <div key={c} style={{display: 'flex', alignItems: 'center', gap: 16, margin: '12px 0', opacity: ik, transform: `translateX(${(1 - ik) * -30}px)`}}>
                <div style={{width: 42, height: 42, borderRadius: 21, background: CB.green, color: '#fff', fontSize: 26, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>✓</div>
                <div style={{fontSize: 29, color: '#0F172A'}}>{c}</div>
              </div>
            );
          })}
        </Card>
      )}

      {endK > 0.01 && (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', pointerEvents: 'none'}}>
          <div
            style={{
              background: 'rgba(255,255,255,0.97)',
              borderRadius: 36,
              padding: '40px 64px',
              boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
              textAlign: 'center',
              opacity: endK,
              transform: `scale(${0.85 + 0.15 * endK})`,
              marginTop: -120,
            }}
          >
            <Img src={staticFile('assets/centerbox-antecipacao/logo_centerbox.jpg')} style={{width: 620}} />
            <div style={{fontFamily: FONT_HEAVY, fontSize: 46, color: CB.greenDark, marginTop: 18}}>Portal de Antecipação de Títulos</div>
            <div style={{fontFamily: FONT_HEAVY, fontSize: 26, color: CB.orange, marginTop: 6, letterSpacing: 2}}>DO PEDIDO À LIQUIDAÇÃO • 100% RENTÁVEL</div>
          </div>
        </AbsoluteFill>
      )}

      {chunk && (
        <div style={{position: 'absolute', bottom: 70, left: 160, right: 160, display: 'flex', justifyContent: 'center', pointerEvents: 'none'}}>
          <div
            style={{
              background: 'rgba(12, 38, 26, 0.86)',
              borderRadius: 18,
              padding: '14px 30px',
              boxShadow: '0 14px 34px rgba(0,0,0,0.35)',
              display: 'flex',
              gap: 14,
              flexWrap: 'wrap',
              justifyContent: 'center',
              borderBottom: `4px solid ${CB.orange}`,
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
                    fontSize: 44,
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
