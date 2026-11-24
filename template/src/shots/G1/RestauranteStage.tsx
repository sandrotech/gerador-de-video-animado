import React from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame} from 'remotion';
import {Fonts, FONT_HEAVY, clamp01, easeInOutPow, BEZ_SCALE_IN} from '../../common';
import {YellowLabel3D, StatusPillBadge} from './diorama';
import {
  RestauranteDioramaStage,
  getRestauranteScreenAnchors,
  REST_W,
  REST_H,
} from './RestauranteDiorama';
import {RESTAURANTE_WORDS, RESTAURANTE_CUES as C} from './restauranteWords';

const popScale = (n: number, dur = 12) => (n < 0 ? 0 : BEZ_SCALE_IN(clamp01(n / dur)));
const windowOp = (N: number, from: number, to: number, fade = 10) => {
  if (N < from || N > to) return 0;
  return Math.min(clamp01((N - from) / fade), clamp01((to - N) / fade));
};

const YELLOW_KEYWORDS = new Set([
  'restaurantes',
  'mesmo',
  'prato',
  'preço',
  'rua',
  'dona',
  'maria',
  'cheio',
  'mapa',
  'google',
  'rota',
  'celular',
  'avaliações',
  'confia',
  'whatsapp',
  'cupom',
  'fila',
  'encontrado',
]);

const ORANGE_KEYWORDS = new Set([
  'seu',
  'zé',
  'vazia',
  'errado',
  'pdf',
  'zoom',
  'abandonado',
  'taxa',
  'taxas',
  'placa',
  'ponto',
]);

function getWordColor(raw: string): {color: string; boost: number} {
  const clean = raw
    .toLowerCase()
    .replace(/[.,!?:;"—]/g, '')
    .trim();
  if (YELLOW_KEYWORDS.has(clean)) return {color: '#FFE135', boost: 1.08};
  if (ORANGE_KEYWORDS.has(clean)) return {color: '#FFA800', boost: 1.06};
  return {color: '#FFFFFF', boost: 1.0};
}

/** Indicador de Etapa + Placar Animado Dona Maria vs Seu Zé */
const TopWorkflowBar: React.FC<{N: number}> = ({N}) => {
  let label = 'ATO 1/6 • MESMO PRATO, MESMO PREÇO';
  let accent = '#FACC15';
  if (N >= C.f_fila_maria - 50) {
    label = 'ATO 6/6 • RESULTADO 1 ANO DEPOIS';
    accent = '#FFE135';
  } else if (N >= C.f_delivery_taxas - 50) {
    label = 'ATO 5/6 • DELIVERY & ANÚNCIO LOCAL';
    accent = '#10B981';
  } else if (N >= C.f_avaliacoes - 20) {
    label = 'ATO 4/6 • AVALIAÇÕES & PROVA SOCIAL';
    accent = '#38BDF8';
  } else if (N >= C.f_cardapio_pdf - 40) {
    label = 'ATO 3/6 • EXPERIÊNCIA NO CARDÁPIO';
    accent = '#22D3EE';
  } else if (N >= C.f_mapa_search - 60) {
    label = 'ATO 2/6 • PRESENÇA NO GOOGLE MAPS';
    accent = '#38BDF8';
  }

  const introT = easeInOutPow(2.0)(clamp01(N / 42));
  const progressRatio = clamp01(N / C.total_frames);
  const targetX = 92 + progressRatio * 4;
  const targetY = 36 - progressRatio * 18;
  const salesX = Math.round(targetX * introT);
  const salesY = Math.round((50 - (50 - targetY) * introT) * introT);

  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 42,
          top: 28,
          background: 'rgba(15, 23, 42, 0.9)',
          border: '3px solid #1E293B',
          borderRadius: 999,
          padding: '8px 22px',
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
            background: accent,
            boxShadow: `0 0 10px ${accent}`,
          }}
        />
        <span
          style={{
            fontFamily: FONT_HEAVY,
            fontWeight: 900,
            fontSize: 20,
            color: '#F8FAFC',
            letterSpacing: 0.8,
          }}
        >
          {label}
        </span>
      </div>

      {/* Placar Animado Dona Maria vs Seu Zé */}
      <div
        style={{
          position: 'absolute',
          right: 42,
          top: 28,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          zIndex: 45,
        }}
      >
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.92)',
            border: '3px solid #22D3EE',
            borderRadius: 16,
            padding: '7px 18px',
            fontFamily: FONT_HEAVY,
            fontWeight: 900,
            fontSize: 19,
            color: '#F8FAFC',
            boxShadow: '0 6px 16px rgba(0,0,0,0.32)',
            minWidth: 235,
          }}
        >
          <div style={{display: 'flex', justifyContent: 'space-between', gap: 10}}>
            <span>DONA MARIA</span>
            <span style={{color: '#10B981'}}>▲ {salesX}%</span>
          </div>
          <div style={{height: 6, background: '#1E293B', borderRadius: 4, marginTop: 5, overflow: 'hidden'}}>
            <div style={{width: `${salesX}%`, height: '100%', background: '#10B981', borderRadius: 4}} />
          </div>
        </div>

        <div
          style={{
            background: 'rgba(15, 23, 42, 0.92)',
            border: '3px solid #EF4444',
            borderRadius: 16,
            padding: '7px 18px',
            fontFamily: FONT_HEAVY,
            fontWeight: 900,
            fontSize: 19,
            color: '#F8FAFC',
            boxShadow: '0 6px 16px rgba(0,0,0,0.32)',
            minWidth: 210,
          }}
        >
          <div style={{display: 'flex', justifyContent: 'space-between', gap: 10}}>
            <span>SEU ZÉ</span>
            <span style={{color: '#EF4444'}}>▼ {salesY}%</span>
          </div>
          <div style={{height: 6, background: '#1E293B', borderRadius: 4, marginTop: 5, overflow: 'hidden'}}>
            <div style={{width: `${salesY}%`, height: '100%', background: '#EF4444', borderRadius: 4}} />
          </div>
        </div>
      </div>
    </>
  );
};

/** Seta Curva Tracejada Amarela 16:9 estilo @desmontandoomundo */
const WidescreenCurvedArrow: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  arcHeight?: number;
  opacity?: number;
  dashOffset?: number;
}> = ({x1, y1, x2, y2, arcHeight = 140, opacity = 1, dashOffset = 0}) => {
  if (opacity <= 0.01) return null;
  const mx = (x1 + x2) * 0.5;
  const my = Math.min(y1, y2) - arcHeight;
  const d = `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
  const angleDeg = (Math.atan2(y2 - my, x2 - mx) * 180) / Math.PI;
  return (
    <svg
      width={REST_W}
      height={REST_H}
      viewBox={`0 0 ${REST_W} ${REST_H}`}
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

/** Legenda Dinâmica Palavra por Palavra (WordBoundary exato do Edge-TTS) */
const RestauranteWordSubtitles: React.FC<{N: number}> = ({N}) => {
  const cur = RESTAURANTE_WORDS.find((w) => N >= w.from && N <= w.to + 2);
  if (!cur) return null;
  const n = N - cur.from;
  const {color, boost} = getWordColor(cur.text);
  const s = (0.86 + 0.14 * Math.min(1, n / 4)) * boost;
  return (
    <div
      style={{
        position: 'absolute',
        left: REST_W / 2,
        top: 972,
        transform: `translate(-50%, -50%) scale(${s})`,
        fontFamily: FONT_HEAVY,
        fontWeight: 900,
        fontSize: 60,
        color,
        whiteSpace: 'nowrap',
        WebkitTextStroke: '12px #141414',
        paintOrder: 'stroke fill',
        filter: 'drop-shadow(0 8px 14px rgba(0,0,0,0.48))',
        zIndex: 50,
      }}
    >
      {cur.text}
    </div>
  );
};

export const RestauranteStage: React.FC = () => {
  const N = useCurrentFrame();
  const anchors = getRestauranteScreenAnchors(N);

  return (
    <AbsoluteFill style={{background: '#66B2F2', overflow: 'hidden'}}>
      <Fonts />
      <Audio src={staticFile('assets/restaurante-contrast/master_audio_sfx.wav')} />

      {/* Palco 3D Diorama Arquitetônico padrão Data Crítica */}
      <RestauranteDioramaStage N={N} />

      {/* Barra Superior com Placar Animado Dona Maria vs Seu Zé */}
      <TopWorkflowBar N={N} />

      {/* ==================== ATO 1: GANCHO MAGNÉTICO ==================== */}
      {N >= 2 && N <= C.f_mapa_search - 60 ? (
        <>
          <YellowLabel3D
            cx={960}
            cy={168}
            text="MESMO PRATO • MESMO PREÇO"
            size={44}
            tilt={0}
            scale={popScale(N - 2, 10)}
            opacity={windowOp(N, 2, C.f_mapa_search - 60)}
          />
          {N >= 38 ? (
            <YellowLabel3D
              cx={960}
              cy={228}
              text="SÓ UM LOTA!"
              size={60}
              tilt={-1.5}
              scale={popScale(N - 38, 10)}
              opacity={windowOp(N, 38, C.f_mapa_search - 60)}
            />
          ) : null}
          {N >= C.f_prato - 4 ? (
            <>
              <StatusPillBadge
                cx={anchors.restXPlate.x}
                cy={anchors.restXPlate.y + 12}
                text="DONA MARIA: R$ 49"
                dotColor="#10B981"
                size={25}
                scale={popScale(N - (C.f_prato - 4), 10)}
                opacity={windowOp(N, C.f_prato - 4, 380)}
              />
              {N >= C.f_preco - 2 ? (
                <StatusPillBadge
                  cx={anchors.restYPlate.x}
                  cy={anchors.restYPlate.y + 12}
                  text="SEU ZÉ: R$ 49"
                  dotColor="#94A3B8"
                  size={25}
                  scale={popScale(N - (C.f_preco - 2), 10)}
                  opacity={windowOp(N, C.f_preco - 2, 380)}
                />
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      {/* ==================== ATO 2: GOOGLE MAPS & ROTA ==================== */}
      {N >= C.f_mapa_search - 40 && N <= C.f_cardapio_pdf - 45 ? (
        <>
          <YellowLabel3D
            cx={960}
            cy={168}
            text="ONDE JANTAR HOJE?"
            size={50}
            tilt={-1.5}
            scale={popScale(N - (C.f_mapa_search - 40), 12)}
            opacity={windowOp(N, C.f_mapa_search - 40, C.f_maria_rota - 15)}
          />
          {N >= C.f_ze_sem_foto - 10 ? (
            <StatusPillBadge
              cx={1410}
              cy={280}
              text="SEU ZÉ: SEM FOTO & HORÁRIO ERRADO!"
              dotColor="#EF4444"
              size={25}
              scale={popScale(N - (C.f_ze_sem_foto - 10), 12)}
              opacity={windowOp(N, C.f_ze_sem_foto - 10, C.f_maria_rota - 10)}
            />
          ) : null}
          {N >= C.f_maria_rota - 10 ? (
            <>
              <YellowLabel3D
                cx={960}
                cy={168}
                text="DONA MARIA: GOOGLE OK + ROTA!"
                size={46}
                tilt={-1.5}
                scale={popScale(N - (C.f_maria_rota - 10), 12)}
                opacity={windowOp(N, C.f_maria_rota - 10, C.f_cardapio_pdf - 45)}
              />
              <WidescreenCurvedArrow
                x1={1240}
                y1={280}
                x2={anchors.restXManager.x}
                y2={anchors.restXManager.y}
                arcHeight={120}
                opacity={windowOp(N, C.f_maria_rota, C.f_cardapio_pdf - 45)}
                dashOffset={(N - C.f_maria_rota) * 4}
              />
            </>
          ) : null}
        </>
      ) : null}

      {/* ==================== ATO 3: CARDÁPIO PDF vs MOBILE ==================== */}
      {N >= C.f_cardapio_pdf - 35 && N <= C.f_avaliacoes - 25 ? (
        <>
          <YellowLabel3D
            cx={960}
            cy={168}
            text={
              N < C.f_cardapio_mobile - 40
                ? 'SEU ZÉ: PDF LENTO QUE PRECISA DE ZOOM!'
                : 'DONA MARIA: LINK MOBILE COM FOTO & PREÇO!'
            }
            size={44}
            tilt={-1.5}
            scale={popScale(N - (N < C.f_cardapio_mobile - 40 ? C.f_cardapio_pdf - 35 : C.f_cardapio_mobile - 40), 12)}
            opacity={windowOp(N, C.f_cardapio_pdf - 35, C.f_avaliacoes - 25)}
          />
          <StatusPillBadge
            cx={N < C.f_cardapio_mobile - 40 ? 1420 : 480}
            cy={270}
            text={N < C.f_cardapio_mobile - 40 ? 'DEMORA PARA ABRIR (18 MB)' : '1 CLIQUE NO CELULAR ✓'}
            dotColor={N < C.f_cardapio_mobile - 40 ? '#EF4444' : '#10B981'}
            size={28}
            scale={popScale(N - (C.f_cardapio_pdf - 20), 12)}
            opacity={windowOp(N, C.f_cardapio_pdf - 20, C.f_avaliacoes - 25)}
          />
        </>
      ) : null}

      {/* ==================== ATO 4: AVALIAÇÕES ==================== */}
      {N >= C.f_avaliacoes - 20 && N <= C.f_delivery_taxas - 55 ? (
        <>
          <YellowLabel3D
            cx={960}
            cy={168}
            text={
              N < C.f_maria_responde - 35
                ? 'SEU ZÉ: NOTA BAIXA & SEM RESPOSTA'
                : 'DONA MARIA: RESPONDE TUDO & GERA CONFIANÇA!'
            }
            size={44}
            tilt={-1.5}
            scale={popScale(N - (N < C.f_maria_responde - 35 ? C.f_avaliacoes - 20 : C.f_maria_responde - 35), 12)}
            opacity={windowOp(N, C.f_avaliacoes - 20, C.f_delivery_taxas - 55)}
          />
          <StatusPillBadge
            cx={N < C.f_maria_responde - 35 ? 1420 : 480}
            cy={270}
            text={N < C.f_maria_responde - 35 ? 'PARECE ABANDONADO (2.8★)' : '4.9★ CLIENTE CONFIA ✓'}
            dotColor={N < C.f_maria_responde - 35 ? '#EF4444' : '#10B981'}
            size={28}
            scale={popScale(N - (C.f_avaliacoes - 5), 12)}
            opacity={windowOp(N, C.f_avaliacoes - 5, C.f_delivery_taxas - 55)}
          />
        </>
      ) : null}

      {/* ==================== ATO 5: DELIVERY, WHATSAPP & ANÚNCIOS ==================== */}
      {N >= C.f_delivery_taxas - 50 && N <= C.f_fila_maria - 50 ? (
        <>
          <YellowLabel3D
            cx={960}
            cy={168}
            text={
              N < C.f_whatsapp_cupom - 30
                ? 'SEU ZÉ: SÓ APP DEIXANDO LUCRO EM TAXA'
                : 'DONA MARIA: WHATSAPP PRÓPRIO + ANÚNCIO LOCAL!'
            }
            size={43}
            tilt={-1.5}
            scale={popScale(N - (N < C.f_whatsapp_cupom - 30 ? C.f_delivery_taxas - 50 : C.f_whatsapp_cupom - 30), 12)}
            opacity={windowOp(N, C.f_delivery_taxas - 50, C.f_fila_maria - 50)}
          />
          <StatusPillBadge
            cx={N < C.f_whatsapp_cupom - 30 ? 1420 : 480}
            cy={270}
            text={N < C.f_whatsapp_cupom - 30 ? '-27% DO LUCRO EM TAXAS' : 'CUPOM FIDELIDADE + RAIO 3KM ✓'}
            dotColor={N < C.f_whatsapp_cupom - 30 ? '#EF4444' : '#10B981'}
            size={27}
            scale={popScale(N - (C.f_delivery_taxas - 35), 12)}
            opacity={windowOp(N, C.f_delivery_taxas - 35, C.f_fila_maria - 50)}
          />
        </>
      ) : null}

      {/* ==================== ATO 6: 1 ANO DEPOIS + CTA ==================== */}
      {N >= C.f_fila_maria - 45 ? (
        <>
          <YellowLabel3D
            cx={960}
            cy={168}
            text={N < C.f_cta_final - 40 ? '1 ANO DEPOIS: FILA NA DONA MARIA!' : 'MESMO PRATO. SÓ UM FOI ENCONTRADO!'}
            size={48}
            tilt={0}
            scale={popScale(N - (C.f_fila_maria - 45), 12)}
            opacity={windowOp(N, C.f_fila_maria - 45, C.total_frames)}
          />
          {N >= C.f_cta_final - 40 ? (
            <StatusPillBadge
              cx={960}
              cy={255}
              text="QUER QUE O SEU SEJA O PRÓXIMO? CHAMA A GENTE!"
              dotColor="#10B981"
              size={30}
              scale={popScale(N - (C.f_cta_final - 40), 12)}
              opacity={windowOp(N, C.f_cta_final - 40, C.total_frames)}
            />
          ) : null}
        </>
      ) : null}

      {/* Legendas Dinâmicas Palavra por Palavra */}
      <RestauranteWordSubtitles N={N} />
    </AbsoluteFill>
  );
};
