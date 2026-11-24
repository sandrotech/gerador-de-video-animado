import React from 'react';
import {AbsoluteFill, Audio, Img, staticFile, useCurrentFrame} from 'remotion';
import {Fonts, FONT_HEAVY, clamp01, BEZ_SCALE_IN} from '../../common';
import {STECH_BRAND} from '../../brand';
import {YellowLabel3D} from './diorama';
import {StechDioramaStage} from './StechDiorama';
import {LiveProcessCard, ProcessStep} from './LiveProcessCard';
import {STECH_V3_CUES as C, STECH_V3_WORDS as WORDS} from './stechV3Words';

const popScale = (n: number, dur = 10) => (n < 0 ? 0 : BEZ_SCALE_IN(clamp01(n / dur)));
const windowOp = (N: number, from: number, to: number, fade = 8) => {
  if (N < from || N > to) return 0;
  return Math.min(clamp01((N - from) / fade), clamp01((to - N) / fade));
};

const YELLOW_KEYS = new Set([
  'sistema',
  'stech',
  'integrada',
  'central',
  'cozinha',
  'pronto',
  'salão',
  'painel',
  'gestão',
  'controle',
  'tecnologia',
  'eficiência',
  'medida',
]);

const ORANGE_KEYS = new Set(['papel', 'mão', 'desencontradas', 'esperando', 'depende']);

// Exemplo plugável para o nicho Restaurante (pode ser trocado por Clínica, Oficina, ERP, CRM em novos vídeos)
const RESTAURANT_STEPS: ProcessStep[] = [
  {
    id: 'recebido',
    shortLabel: 'Recebido',
    statusBadge: 'RECEBIDO • FILA',
    detail: 'Lançado no terminal ou celular',
    accent: '#FACC15',
  },
  {
    id: 'preparo',
    shortLabel: 'Preparo',
    statusBadge: 'EM PREPARO • KDS',
    detail: '2x Prato Executivo • Obs: Sem cebola',
    accent: '#0EA5E9',
  },
  {
    id: 'pronto',
    shortLabel: 'Pronto',
    statusBadge: 'PRONTO ✓ • SALÃO',
    detail: 'Equipe avisada em tempo real',
    accent: '#10B981',
  },
  {
    id: 'gestao',
    shortLabel: 'Gestão',
    statusBadge: 'CAIXA & ESTOQUE',
    detail: 'Vendas e indicadores atualizados',
    accent: '#004A99',
  },
];

/** Agrupa palavras em blocos naturais de 3 a 5 palavras para leitura confortável no Reels */
function buildBlocks() {
  const blocks: Array<{from: number; to: number; words: Array<{text: string; from: number; to: number}>}> = [];
  let cur: Array<{text: string; from: number; to: number}> = [];
  for (let i = 0; i < WORDS.length; i++) {
    const w = WORDS[i];
    cur.push(w);
    const endsPunct = /[.,!?:;]$/.test(w.text);
    const nextPause = i + 1 < WORDS.length && WORDS[i + 1].from - w.to > 7;
    if (cur.length >= 4 || (cur.length >= 3 && (endsPunct || nextPause)) || endsPunct || i === WORDS.length - 1) {
      blocks.push({
        from: cur[0].from,
        to: cur[cur.length - 1].to + 5,
        words: cur,
      });
      cur = [];
    }
  }
  return blocks;
}

const CAPTION_BLOCKS = buildBlocks();

/** Legenda em blocos de 3-5 palavras dentro da Safe Zone do Instagram Reels */
const StechBlockSubtitles: React.FC<{N: number; hideAfter: number}> = ({N, hideAfter}) => {
  if (N >= hideAfter) return null;
  const active = CAPTION_BLOCKS.find((b) => N >= b.from && N <= b.to);
  if (!active) return null;

  const op = Math.min(1, clamp01((N - active.from) / 4));
  return (
    <div
      style={{
        position: 'absolute',
        left: 72,
        right: 156,
        top: 1385,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        opacity: op,
        zIndex: 48,
      }}
    >
      <div
        style={{
          background: 'rgba(11, 31, 58, 0.94)',
          border: `3.5px solid ${STECH_BRAND.colors.cyan}`,
          borderRadius: 22,
          padding: '16px 26px',
          boxShadow: '0 10px 24px rgba(0,0,0,0.42)',
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 10,
        }}
      >
        {active.words.map((w) => {
          const clean = w.text.toLowerCase().replace(/[.,!?:;]/g, '');
          const isNow = N >= w.from && N <= w.to + 2;
          let color = '#FFFFFF';
          if (isNow) {
            if (ORANGE_KEYS.has(clean)) color = '#FDBA74';
            else if (YELLOW_KEYS.has(clean)) color = '#FACC15';
            else color = '#38BDF8';
          }
          return (
            <span
              key={w.from}
              style={{
                fontFamily: FONT_HEAVY,
                fontWeight: 900,
                fontSize: 44,
                lineHeight: 1.15,
                color,
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};

/** Tela Final Comercial Padrão Stech (3.5–4s) com contatos oficiais lidos de STECH_BRAND */
const StechCommercialEndCard: React.FC<{N: number; startFrame: number}> = ({N, startFrame}) => {
  if (N < startFrame) return null;
  const local = N - startFrame;
  const bgOp = clamp01(local / 12);
  const cardScale = 0.88 + 0.12 * BEZ_SCALE_IN(clamp01(local / 14));

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `rgba(11, 31, 58, ${0.84 * bgOp})`,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '220px 156px 390px 72px',
        zIndex: 60,
        fontFamily: FONT_HEAVY,
      }}
    >
      <div
        style={{
          width: '100%',
          background: '#FFFFFF',
          borderRadius: 34,
          border: `5px solid ${STECH_BRAND.colors.cyan}`,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45)',
          padding: '44px 36px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
          opacity: bgOp,
          transform: `scale(${cardScale})`,
        }}
      >
        <Img
          src={staticFile('assets/stech-automacao/Logo_stech.png')}
          style={{height: 118, width: 'auto', display: 'block'}}
        />

        <div
          style={{
            fontSize: 38,
            fontWeight: 900,
            color: STECH_BRAND.colors.navy,
            textAlign: 'center',
            lineHeight: 1.12,
          }}
        >
          {STECH_BRAND.headline}
        </div>

        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: '#334155',
            textAlign: 'center',
            lineHeight: 1.25,
          }}
        >
          {STECH_BRAND.tagline}
        </div>

        <div
          style={{
            background: STECH_BRAND.colors.navy,
            color: '#FFFFFF',
            borderRadius: 999,
            padding: '18px 44px',
            border: `4px solid ${STECH_BRAND.colors.cyan}`,
            fontSize: 34,
            fontWeight: 900,
            letterSpacing: 0.6,
          }}
        >
          {STECH_BRAND.cta} →
        </div>

        {/* Contatos Oficiais */}
        <div
          style={{
            width: '100%',
            background: '#F1F5F9',
            borderRadius: 20,
            border: '2px solid #CBD5E1',
            padding: '18px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <div style={{fontSize: 30, fontWeight: 900, color: STECH_BRAND.colors.navyDark}}>
            Instagram: {STECH_BRAND.instagram}
          </div>
          <div style={{fontSize: 30, fontWeight: 900, color: '#047857'}}>
            WhatsApp: {STECH_BRAND.whatsapp}
          </div>
          <div style={{fontSize: 26, fontWeight: 800, color: '#475569'}}>
            {STECH_BRAND.website}
          </div>
        </div>
      </div>
    </div>
  );
};

export const StechV3ReelsStage: React.FC = () => {
  const N = useCurrentFrame();
  // Centro horizontal deslocado levemente para esquerda (x=498) para manter 100% livre da coluna de ícones do Reels!
  const safeCx = 498;
  const topTitleY = 232;

  // Etapas vivas do LiveProcessCard sincronizadas com a narração
  const showFlowCard = N >= C.f_recebimento - 6 && N < C.f_cta - 6;
  let activeStep = 0;
  if (N >= C.f_gestao - 4) activeStep = 3;
  else if (N >= C.f_pronto - 4) activeStep = 2;
  else if (N >= C.f_cozinha - 4) activeStep = 1;

  return (
    <AbsoluteFill style={{background: '#66B2F2', overflow: 'hidden'}}>
      <Fonts />
      <Audio src={staticFile('assets/stech-automacao/master_audio_v3_sfx.wav')} />

      {/* Palco 3D Stech v3 — Maquete 15-20% maior no vertical */}
      <StechDioramaStage N={N} variant="9:16" mode="v3-short" />

      {/* 0s–2.4s: GANCHO IMEDIATO NO FRAME 0 (sem atraso!) */}
      {N < C.f_dor - 2 ? (
        <YellowLabel3D
          cx={safeCx}
          cy={topTitleY}
          text="SEU RESTAURANTE AINDA DEPENDE DE PAPEL?"
          size={30}
          tilt={0}
          scale={1}
          opacity={N < C.f_dor - 10 ? 1 : clamp01((C.f_dor - 2 - N) / 8)}
        />
      ) : null}

      {/* 2.4s–6.7s: Dor reconhecível */}
      {N >= C.f_dor - 2 && N < C.f_virada - 4 ? (
        <YellowLabel3D
          cx={safeCx}
          cy={topTitleY}
          text="PAPEL, IMPROVISO E CLIENTES ESPERANDO"
          size={30}
          tilt={-1}
          scale={popScale(N - (C.f_dor - 2), 8)}
          opacity={windowOp(N, C.f_dor - 2, C.f_virada - 4, 6)}
        />
      ) : null}

      {/* 6.7s–9.6s: Virada para o sistema */}
      {N >= C.f_virada - 4 && N < C.f_recebimento - 6 ? (
        <YellowLabel3D
          cx={safeCx}
          cy={topTitleY}
          text="E SE TUDO FUNCIONASSE INTEGRADO?"
          size={31}
          tilt={0}
          scale={popScale(N - (C.f_virada - 4), 8)}
          opacity={windowOp(N, C.f_virada - 4, C.f_recebimento - 6, 6)}
        />
      ) : null}

      {/* 9.6s–16.2s: Recebimento (sem promessas absolutas) */}
      {N >= C.f_recebimento - 6 && N < C.f_cozinha - 4 ? (
        <YellowLabel3D
          cx={safeCx}
          cy={topTitleY}
          text="PEDIDOS CENTRALIZADOS EM UM SÓ LUGAR"
          size={29}
          tilt={0}
          scale={popScale(N - (C.f_recebimento - 6), 8)}
          opacity={windowOp(N, C.f_recebimento - 6, C.f_cozinha - 4, 6)}
        />
      ) : null}

      {/* 16.2s–22.4s: Cozinha KDS + Status */}
      {N >= C.f_cozinha - 4 && N < C.f_gestao - 4 ? (
        <YellowLabel3D
          cx={safeCx}
          cy={topTitleY}
          text="SALÃO E COZINHA CONECTADOS"
          size={32}
          tilt={0}
          scale={popScale(N - (C.f_cozinha - 4), 8)}
          opacity={windowOp(N, C.f_cozinha - 4, C.f_gestao - 4, 6)}
        />
      ) : null}

      {/* 22.4s–28.8s: Gestão & Caixa */}
      {N >= C.f_gestao - 4 && N < C.f_cta - 6 ? (
        <YellowLabel3D
          cx={safeCx}
          cy={topTitleY}
          text="DA ENTRADA DO PEDIDO AO CAIXA"
          size={31}
          tilt={0}
          scale={popScale(N - (C.f_gestao - 4), 8)}
          opacity={windowOp(N, C.f_gestao - 4, C.f_cta - 6, 6)}
        />
      ) : null}

      {/* 28.8s–36.2s: Benefício + Logo Stech antes da tela final */}
      {N >= C.f_cta - 6 && N < C.f_cta_card ? (
        <YellowLabel3D
          cx={safeCx}
          cy={topTitleY}
          text="MAIS CONTROLE SOBRE CADA PEDIDO"
          size={30}
          tilt={0}
          scale={popScale(N - (C.f_cta - 6), 8)}
          opacity={windowOp(N, C.f_cta - 6, C.f_cta_card, 6)}
        />
      ) : null}

      {/* Card Reutilizável de Demonstração Viva do Fluxo (preenche o espaço superior livre com leitura 100% nítida!) */}
      {showFlowCard ? (
        <LiveProcessCard
          steps={RESTAURANT_STEPS}
          activeIndex={activeStep}
          headerTitle="STECH • SISTEMA EM FUNCIONAMENTO"
          ticketTitle="Pedido #104 • Mesa 03"
          top={304}
          left={72}
          width={852}
          scale={popScale(N - (C.f_recebimento - 6), 10)}
          opacity={windowOp(N, C.f_recebimento - 6, C.f_cta - 6, 8)}
        />
      ) : null}

      {/* Legendas em Blocos de 3 a 5 Palavras (Safe Zone Reels) */}
      <StechBlockSubtitles N={N} hideAfter={C.f_cta_card} />

      {/* Tela Final Comercial Padrão Stech (4.2s com contatos oficiais) */}
      <StechCommercialEndCard N={N} startFrame={C.f_cta_card} />
    </AbsoluteFill>
  );
};
