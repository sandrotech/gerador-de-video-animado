import React from 'react';
import {AbsoluteFill, Audio, Img, staticFile, useCurrentFrame} from 'remotion';
import {Fonts, FONT_HEAVY, clamp01, BEZ_SCALE_IN} from '../../common';
import {YellowLabel3D, StatusPillBadge} from './diorama';
import {
  StechDioramaStage,
  StechVariant,
  getStechScreenAnchors,
} from './StechDiorama';
import {STECH_WORDS, STECH_CUES as C} from './stechWords';

const popScale = (n: number, dur = 12) => (n < 0 ? 0 : BEZ_SCALE_IN(clamp01(n / dur)));
const windowOp = (N: number, from: number, to: number, fade = 10) => {
  if (N < from || N > to) return 0;
  return Math.min(clamp01((N - from) / fade), clamp01((to - N) / fade));
};

const YELLOW_KEYWORDS = new Set([
  'sistema',
  'automação',
  'stech',
  'conecta',
  'pedidos',
  'cozinha',
  'caixa',
  'organizado',
  'tela',
  'tempo',
  'real',
  'painel',
  'gestão',
  'integrado',
  'eficiência',
  'negócio',
]);

const ORANGE_KEYWORDS = new Set([
  'problema',
  'manual',
  'papel',
  'memória',
  'atrasa',
  'perde',
  'trocado',
  'acumulado',
  'caderno',
  'retrabalho',
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

/** Seta Curva Tracejada Amarela responsiva para 16:9 e 9:16 */
const ResponsiveCurvedArrow: React.FC<{
  W: number;
  H: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  arcHeight?: number;
  opacity?: number;
  dashOffset?: number;
}> = ({W, H, x1, y1, x2, y2, arcHeight = 140, opacity = 1, dashOffset = 0}) => {
  if (opacity <= 0.01) return null;
  const mx = (x1 + x2) * 0.5;
  const my = Math.min(y1, y2) - arcHeight;
  const d = `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
  const angleDeg = (Math.atan2(y2 - my, x2 - mx) * 180) / Math.PI;
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
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

/** Legenda Dinâmica Palavra por Palavra limpa no rodapé */
const StechWordSubtitles: React.FC<{N: number; W: number; H: number; isVertical: boolean}> = ({
  N,
  W,
  H,
  isVertical,
}) => {
  const cur = STECH_WORDS.find((w) => N >= w.from && N <= w.to + 2);
  if (!cur) return null;
  const n = N - cur.from;
  const {color, boost} = getWordColor(cur.text);
  const s = (0.86 + 0.14 * Math.min(1, n / 4)) * boost;
  return (
    <div
      style={{
        position: 'absolute',
        left: W / 2,
        top: isVertical ? H - 430 : 972,
        transform: `translate(-50%, -50%) scale(${s})`,
        fontFamily: FONT_HEAVY,
        fontWeight: 900,
        fontSize: isVertical ? 64 : 60,
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

/** Badge limpo com a Logo Oficial da Stech Soluções */
const StechLogoBadge: React.FC<{
  cx: number;
  cy: number;
  scale: number;
  opacity: number;
  isVertical: boolean;
}> = ({cx, cy, scale, opacity, isVertical}) => {
  if (opacity <= 0.01) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: cx,
        top: cy,
        transform: `translate(-50%, -50%) scale(${scale})`,
        background: 'rgba(255, 255, 255, 0.97)',
        border: '3.5px solid #004A99',
        borderRadius: 22,
        padding: isVertical ? '12px 26px' : '12px 30px',
        boxShadow: '0 8px 0 rgba(0, 74, 153, 0.22), 0 14px 28px rgba(0,0,0,0.28)',
        opacity,
        zIndex: 34,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Img
        src={staticFile('assets/stech-automacao/Logo_stech.png')}
        style={{
          height: isVertical ? 96 : 86,
          width: 'auto',
          display: 'block',
        }}
      />
    </div>
  );
};

export const StechStage: React.FC<{variant?: StechVariant}> = ({variant = '16:9'}) => {
  const N = useCurrentFrame();
  const isVertical = variant === '9:16';
  const W = isVertical ? 1080 : 1920;
  const H = isVertical ? 1920 : 1080;
  const cx = W / 2;
  const topTitleY = isVertical ? 235 : 72;
  const subPillY = isVertical ? 330 : 144;
  const titleScale = isVertical ? 0.65 : 0.96;

  const anchors = getStechScreenAnchors(N, variant);

  return (
    <AbsoluteFill style={{background: '#66B2F2', overflow: 'hidden'}}>
      <Fonts />
      <Audio src={staticFile('assets/stech-automacao/master_audio_sfx.wav')} />

      {/* Palco 3D Stech Soluções */}
      <StechDioramaStage N={N} variant={variant} />

      {/* ==================== ATO 1 (0s-16s): DOR -> CONTRASTE -> CONEXÃO -> STECH ==================== */}
      {/* 0s - 3.3s: O problema pode estar na operação */}
      {N >= 2 && N < C.f_administra - 25 ? (
        <YellowLabel3D
          cx={cx}
          cy={topTitleY}
          text="O PROBLEMA PODE ESTAR NA OPERAÇÃO!"
          size={Math.round(46 * titleScale)}
          tilt={0}
          scale={popScale(N - 2, 10)}
          opacity={windowOp(N, 2, C.f_administra - 25, 8)}
        />
      ) : null}

      {/* 3.5s - 6.3s: No improviso × Com automação */}
      {N >= C.f_administra - 22 && N < 186 ? (
        <YellowLabel3D
          cx={cx}
          cy={topTitleY}
          text="NO IMPROVISO × COM AUTOMAÇÃO"
          size={Math.round(48 * titleScale)}
          tilt={-1}
          scale={popScale(N - (C.f_administra - 22), 10)}
          opacity={windowOp(N, C.f_administra - 22, 186, 8)}
        />
      ) : null}

      {/* 6.3s - 11.2s: Tudo conectado. Menos retrabalho. */}
      {N >= 188 && N < C.f_stech_intro - 20 ? (
        <YellowLabel3D
          cx={cx}
          cy={topTitleY}
          text="TUDO CONECTADO. MENOS RETRABALHO."
          size={Math.round(46 * titleScale)}
          tilt={0}
          scale={popScale(N - 188, 10)}
          opacity={windowOp(N, 188, C.f_stech_intro - 20, 8)}
        />
      ) : null}

      {/* 11.2s - 16s: Apresentação oficial com a Logo Stech Soluções */}
      {N >= C.f_stech_intro - 18 && N < C.f_recebimento - 15 ? (
        <>
          <StechLogoBadge
            cx={cx}
            cy={isVertical ? 232 : 86}
            scale={popScale(N - (C.f_stech_intro - 18), 10)}
            opacity={windowOp(N, C.f_stech_intro - 18, C.f_recebimento - 15, 8)}
            isVertical={isVertical}
          />
          <StatusPillBadge
            cx={cx}
            cy={isVertical ? 356 : 180}
            text="Sistemas sob medida para negócios que querem evoluir."
            dotColor="#004A99"
            size={isVertical ? 23 : 25}
            scale={popScale(N - (C.f_stech_intro - 6), 10)}
            opacity={windowOp(N, C.f_stech_intro - 6, C.f_recebimento - 15, 8)}
          />
        </>
      ) : null}

      {/* ==================== ATO 2: RECEBIMENTO (MANUAL vs CENTRALIZADO) ==================== */}
      {N >= C.f_recebimento - 14 && N < C.f_cozinha - 15 ? (
        <>
          <YellowLabel3D
            cx={cx}
            cy={topTitleY}
            text={N < C.f_fila_central - 12 ? 'ANOTAÇÃO NO PAPEL = RETRABALHO' : 'ENTRADA CENTRALIZADA SEM ERROS'}
            size={Math.round(46 * titleScale)}
            tilt={-1}
            scale={popScale(N - (N < C.f_fila_central - 12 ? C.f_recebimento - 14 : C.f_fila_central - 12), 10)}
            opacity={windowOp(N, C.f_recebimento - 14, C.f_cozinha - 15, 8)}
          />
          {N >= C.f_fila_central - 10 ? (
            <StatusPillBadge
              cx={cx}
              cy={subPillY}
              text="PEDIDO NO CELULAR OU TERMINAL ✓"
              dotColor="#10B981"
              size={isVertical ? 25 : 27}
              scale={popScale(N - (C.f_fila_central - 10), 10)}
              opacity={windowOp(N, C.f_fila_central - 10, C.f_cozinha - 15, 8)}
            />
          ) : null}
        </>
      ) : null}

      {/* ==================== ATO 3: COZINHA (KDS EM TEMPO REAL) ==================== */}
      {N >= C.f_cozinha - 12 && N < C.f_atendimento - 20 ? (
        <>
          <YellowLabel3D
            cx={cx}
            cy={topTitleY}
            text={N < C.f_tela_kds - 12 ? 'COMANDA DE PAPEL SE PERDE' : 'COZINHA SINCRONIZADA EM TEMPO REAL'}
            size={Math.round(45 * titleScale)}
            tilt={-1}
            scale={popScale(N - (N < C.f_tela_kds - 12 ? C.f_cozinha - 12 : C.f_tela_kds - 12), 10)}
            opacity={windowOp(N, C.f_cozinha - 12, C.f_atendimento - 20, 8)}
          />
          {N >= C.f_tela_kds - 10 ? (
            <StatusPillBadge
              cx={cx}
              cy={subPillY}
              text="ORDEM, OBSERVAÇÕES E PREPARO NA TELA ✓"
              dotColor="#22D3EE"
              size={isVertical ? 24 : 26}
              scale={popScale(N - (C.f_tela_kds - 10), 10)}
              opacity={windowOp(N, C.f_tela_kds - 10, C.f_atendimento - 20, 8)}
            />
          ) : null}
        </>
      ) : null}

      {/* ==================== ATO 4: ATENDIMENTO & COMUNICAÇÃO ==================== */}
      {N >= C.f_atendimento - 18 && N < C.f_gestao - 18 ? (
        <>
          <YellowLabel3D
            cx={cx}
            cy={topTitleY}
            text="COMUNICAÇÃO FLUIDA ENTRE EQUIPES"
            size={Math.round(46 * titleScale)}
            tilt={0}
            scale={popScale(N - (C.f_atendimento - 18), 10)}
            opacity={windowOp(N, C.f_atendimento - 18, C.f_gestao - 18, 8)}
          />
          {N >= C.f_tempo_real - 12 ? (
            <>
              <StatusPillBadge
                cx={cx}
                cy={subPillY}
                text="SALÃO, COZINHA E BALCÃO INTEGRADOS ✓"
                dotColor="#10B981"
                size={isVertical ? 24 : 26}
                scale={popScale(N - (C.f_tempo_real - 12), 10)}
                opacity={windowOp(N, C.f_tempo_real - 12, C.f_gestao - 18, 8)}
              />
              <ResponsiveCurvedArrow
                W={W}
                H={H}
                x1={anchors.stechKds.x}
                y1={anchors.stechKds.y}
                x2={anchors.stechWaiter.x}
                y2={anchors.stechWaiter.y}
                arcHeight={isVertical ? 90 : 125}
                opacity={windowOp(N, C.f_tempo_real - 8, C.f_gestao - 18, 8)}
                dashOffset={(N - C.f_tempo_real) * 4}
              />
            </>
          ) : null}
        </>
      ) : null}

      {/* ==================== ATO 5: GESTÃO, RELATÓRIOS & ESTOQUE ==================== */}
      {N >= C.f_gestao - 15 && N < C.f_resultado - 60 ? (
        <>
          <YellowLabel3D
            cx={cx}
            cy={topTitleY}
            text={N < C.f_painel_gestao - 12 ? 'CHEGA DE SOMAR PAPEL NO CADERNO' : 'GESTÃO, RELATÓRIOS E INDICADORES'}
            size={Math.round(46 * titleScale)}
            tilt={-1}
            scale={popScale(N - (N < C.f_painel_gestao - 12 ? C.f_gestao - 15 : C.f_painel_gestao - 12), 10)}
            opacity={windowOp(N, C.f_gestao - 15, C.f_resultado - 60, 8)}
          />
          {N >= C.f_painel_gestao - 10 ? (
            <StatusPillBadge
              cx={cx}
              cy={subPillY}
              text="VENDAS, ESTOQUE E CAIXA EM UM SÓ PAINEL ✓"
              dotColor="#38BDF8"
              size={isVertical ? 24 : 26}
              scale={popScale(N - (C.f_painel_gestao - 10), 10)}
              opacity={windowOp(N, C.f_painel_gestao - 10, C.f_resultado - 60, 8)}
            />
          ) : null}
        </>
      ) : null}

      {/* ==================== ATO 6: RESULTADO & CTA OFICIAL COM LOGO STECH ==================== */}
      {N >= C.f_resultado - 55 ? (
        <>
          {N < C.f_cta - 15 ? (
            <YellowLabel3D
              cx={cx}
              cy={topTitleY}
              text="DO PEDIDO AO CAIXA: TUDO INTEGRADO"
              size={Math.round(50 * titleScale)}
              tilt={0}
              scale={popScale(N - (C.f_resultado - 55), 10)}
              opacity={windowOp(N, C.f_resultado - 55, C.f_cta - 12, 8)}
            />
          ) : (
            <>
              <StechLogoBadge
                cx={cx}
                cy={isVertical ? 232 : 86}
                scale={popScale(N - (C.f_cta - 15), 10)}
                opacity={windowOp(N, C.f_cta - 15, C.total_frames, 8)}
                isVertical={isVertical}
              />
              <StatusPillBadge
                cx={cx}
                cy={isVertical ? 356 : 182}
                text="Fale com a Stech • Sistemas sob medida para o seu negócio."
                dotColor="#10B981"
                size={isVertical ? 23 : 27}
                scale={popScale(N - (C.f_cta - 12), 10)}
                opacity={windowOp(N, C.f_cta - 12, C.total_frames, 8)}
              />
            </>
          )}
        </>
      ) : null}

      {/* Legenda Palavra por Palavra */}
      <StechWordSubtitles N={N} W={W} H={H} isVertical={isVertical} />
    </AbsoluteFill>
  );
};
