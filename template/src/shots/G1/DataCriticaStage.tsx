import React from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame} from 'remotion';
import {Fonts, FONT_HEAVY, clamp01, BEZ_SCALE_IN} from '../../common';
import {YellowLabel3D, StatusPillBadge} from './diorama';
import {DataCriticaDioramaStage, DC_W, DC_H} from './DataCriticaDiorama';
import {DATACRITICA_WORDS, DATACRITICA_CUES as C} from './dataCriticaWords';

const popScale = (n: number, dur = 12) => (n < 0 ? 0 : BEZ_SCALE_IN(clamp01(n / dur)));
const windowOp = (N: number, from: number, to: number, fade = 10) => {
  if (N < from || N > to) return 0;
  return Math.min(clamp01((N - from) / fade), clamp01((to - N) / fade));
};

/** Seta Curva Tracejada Amarela 16:9 Widescreen (1920x1080) estilo @desmontandoomundo */
const WidescreenCurvedArrow: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  arcHeight?: number;
  opacity?: number;
  dashOffset?: number;
}> = ({x1, y1, x2, y2, arcHeight = 150, opacity = 1, dashOffset = 0}) => {
  if (opacity <= 0.01) return null;
  const mx = (x1 + x2) * 0.5;
  const my = Math.min(y1, y2) - arcHeight;
  const d = `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
  const angleDeg = (Math.atan2(y2 - my, x2 - mx) * 180) / Math.PI;
  return (
    <svg
      width={DC_W}
      height={DC_H}
      viewBox={`0 0 ${DC_W} ${DC_H}`}
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

const YELLOW_KEYWORDS = new Set([
  'sistema',
  'crítica',
  'celular',
  'bipa',
  'código',
  'barras',
  'aplicativo',
  'compras',
  'aprovado',
  'cadastro',
  'rpinfo',
  'etiquetas',
  'etiqueta',
  'baixa',
  'cola',
  'caixa',
  'pronto',
]);

const ORANGE_KEYWORDS = new Set([
  'vencimento',
  'vencer',
  'perda',
  'quantidade',
  'foto',
  'rebaixa',
  'preço',
  'valor',
  'rebaixado',
  'desperdício',
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

/** Indicador discreto de Etapa no canto superior esquerdo (16:9 Reunião/Treinamento) */
const WorkflowStepBanner: React.FC<{N: number}> = ({N}) => {
  let label = 'ETAPA 1/4 • LOJA: BIPAGEM NO CELULAR';
  let accent = '#FACC15';
  if (N >= 2605) {
    label = 'VISÃO GERAL • SISTEMA DE DATA CRÍTICA INTEGRADO';
    accent = '#FFE135';
  } else if (N >= 2060) {
    label = 'ETAPA 4/4 • LOJA: FILA DE ETIQUETAS & GÔNDOLA';
    accent = '#22C55E';
  } else if (N >= 1490) {
    label = 'ETAPA 3/4 • CADASTRO: RPINFO & BAIXA';
    accent = '#10B981';
  } else if (N >= 955) {
    label = 'ETAPA 2/4 • COMPRAS: ANÁLISE & REBAIXA DE PREÇO';
    accent = '#38BDF8';
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: 42,
        top: 34,
        background: 'rgba(15, 23, 42, 0.88)',
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
          fontSize: 21,
          color: '#F8FAFC',
          letterSpacing: 0.8,
        }}
      >
        {label}
      </span>
    </div>
  );
};

const DataCriticaWordSubtitles: React.FC<{N: number}> = ({N}) => {
  const cur = DATACRITICA_WORDS.find((w) => N >= w.from && N <= w.to + 2);
  if (!cur) return null;
  const n = N - cur.from;
  const {color, boost} = getWordColor(cur.text);
  const s = (0.86 + 0.14 * Math.min(1, n / 4)) * boost;
  return (
    <div
      style={{
        position: 'absolute',
        left: DC_W / 2,
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

export const DataCriticaReelVideo: React.FC = () => {
  const N = useCurrentFrame() + 1;

  return (
    <AbsoluteFill style={{background: '#66B2F2', overflow: 'hidden'}}>
      <Fonts />
      <Audio src={staticFile('assets/data-critica/audio.wav')} />

      {/* Palco 3D Contínuo Widescreen (1920x1080) com os 3 Setores e Bonecos Oficiais */}
      <DataCriticaDioramaStage N={N} />

      {/* Indicador de Etapa no Topo Esquerdo */}
      <WorkflowStepBanner N={N} />

      {/* ==================== ATO 1: PROBLEMA DO PRODUTO PRÓXIMO DE VENCER ==================== */}
      {N >= 14 && N <= 182 ? (
        <>
          <YellowLabel3D
            cx={1260}
            cy={215}
            text="PRÓXIMO DO VENCIMENTO"
            size={44}
            scale={popScale(N - 14, 12)}
            opacity={windowOp(N, 14, 182)}
          />
          {N >= 110 ? (
            <StatusPillBadge
              cx={520}
              cy={315}
              text="ANOTAR NO PAPEL = DEMORA!"
              dotColor="#F59E0B"
              size={28}
              scale={popScale(N - 110, 12)}
              opacity={windowOp(N, 110, 182)}
            />
          ) : null}
        </>
      ) : null}

      {N >= C.f_perda - 10 && N <= 258 ? (
        <StatusPillBadge
          cx={960}
          cy={215}
          text="GERA PERDA NA PRATELEIRA!"
          dotColor="#EF4444"
          size={32}
          scale={popScale(N - (C.f_perda - 10), 12)}
          opacity={windowOp(N, C.f_perda - 10, 258)}
        />
      ) : null}

      {N >= 270 && N <= 362 ? (
        <YellowLabel3D
          cx={960}
          cy={195}
          text="SISTEMA DE DATA CRÍTICA"
          size={54}
          tilt={-2}
          scale={popScale(N - 270, 12)}
          opacity={windowOp(N, 270, 362)}
        />
      ) : null}

      {/* ==================== ATO 2: SEÇÃO DA LOJA + BIPAGEM DO CÓDIGO DE BARRAS NO CELULAR ==================== */}
      {N >= C.f_secao - 8 && N <= 512 ? (
        <>
          <YellowLabel3D
            cx={1240}
            cy={205}
            text="SEÇÃO DO SUPERMERCADO"
            size={44}
            scale={popScale(N - (C.f_secao - 8), 12)}
            opacity={windowOp(N, C.f_secao - 8, 512)}
          />
          <StatusPillBadge
            cx={510}
            cy={315}
            text="RESPONSÁVEL DA LOJA"
            dotColor="#FACC15"
            size={28}
            scale={popScale(N - (C.f_secao + 15), 12)}
            opacity={windowOp(N, C.f_secao + 15, 512)}
          />
        </>
      ) : null}

      {N >= C.f_celular - 6 && N <= 720 ? (
        <>
          <YellowLabel3D
            cx={960}
            cy={180}
            text="BIPA O CÓDIGO DE BARRAS!"
            size={46}
            scale={popScale(N - (C.f_celular - 6), 12)}
            opacity={windowOp(N, C.f_celular - 6, 720)}
          />
          {N >= 618 ? (
            <StatusPillBadge
              cx={1380}
              cy={315}
              text="PUXA NOME + PREÇO: R$ 12,90"
              dotColor="#38BDF8"
              size={28}
              scale={popScale(N - 618, 12)}
              opacity={windowOp(N, 618, 720)}
            />
          ) : null}
        </>
      ) : null}

      {/* ==================== ATO 3: QUANTIDADE + DATA DE VENCIMENTO + FOTO REAL + ENVIO ==================== */}
      {N >= 730 && N <= 895 ? (
        <>
          <YellowLabel3D
            cx={960}
            cy={175}
            text="LANÇAMENTO NO CELULAR"
            size={46}
            tilt={-2}
            scale={popScale(N - 730, 12)}
            opacity={windowOp(N, 730, 895)}
          />
          {N >= C.f_quantidade - 4 ? (
            <StatusPillBadge
              cx={430}
              cy={310}
              text="1. QUANTIDADE: 24 UN"
              dotColor="#3B82F6"
              size={27}
              scale={popScale(N - (C.f_quantidade - 4), 10)}
              opacity={windowOp(N, C.f_quantidade - 4, 895)}
            />
          ) : null}
          {N >= C.f_vencimento - 4 ? (
            <StatusPillBadge
              cx={430}
              cy={405}
              text="2. DATA DE VENCIMENTO"
              dotColor="#F59E0B"
              size={27}
              scale={popScale(N - (C.f_vencimento - 4), 10)}
              opacity={windowOp(N, C.f_vencimento - 4, 895)}
            />
          ) : null}
          {N >= C.f_foto - 4 ? (
            <StatusPillBadge
              cx={430}
              cy={500}
              text="3. FOTO REAL DO PRODUTO 📷"
              dotColor="#10B981"
              size={27}
              scale={popScale(N - (C.f_foto - 4), 10)}
              opacity={windowOp(N, C.f_foto - 4, 895)}
            />
          ) : null}
        </>
      ) : null}

      {N >= C.f_envia - 2 && N <= 1005 ? (
        <>
          <YellowLabel3D
            cx={960}
            cy={195}
            text="DIRETO PARA COMPRAS!"
            size={48}
            scale={popScale(N - (C.f_envia - 2), 12)}
            opacity={windowOp(N, C.f_envia - 2, 1005)}
          />
          <WidescreenCurvedArrow
            x1={640}
            y1={460}
            x2={1280}
            y2={430}
            arcHeight={165}
            opacity={windowOp(N, C.f_envia, 1005)}
            dashOffset={(N - C.f_envia) * 4}
          />
        </>
      ) : null}

      {/* ==================== ATO 4: SETOR ADMINISTRATIVO DE COMPRAS (REBAIXA DE PREÇO) ==================== */}
      {N >= C.f_compras - 10 && N <= 1465 ? (
        <>
          <YellowLabel3D
            cx={960}
            cy={175}
            text="SETOR DE COMPRAS"
            size={50}
            tilt={-2}
            scale={popScale(N - (C.f_compras - 10), 12)}
            opacity={windowOp(N, C.f_compras - 10, 1465)}
          />
          {N >= 1100 && N <= 1225 ? (
            <StatusPillBadge
              cx={435}
              cy={345}
              text="ANALISA FOTO, QTD E DIAS"
              dotColor="#38BDF8"
              size={28}
              scale={popScale(N - 1100, 12)}
              opacity={windowOp(N, 1100, 1225)}
            />
          ) : null}
          {N >= C.f_rebaixa - 5 ? (
            <StatusPillBadge
              cx={435}
              cy={345}
              text="REBAIXA: R$ 12,90 → R$ 6,99"
              dotColor="#FACC15"
              size={28}
              scale={popScale(N - (C.f_rebaixa - 5), 12)}
              opacity={windowOp(N, C.f_rebaixa - 5, 1465)}
            />
          ) : null}
          {N >= C.f_aprovado - 6 ? (
            <StatusPillBadge
              cx={1485}
              cy={345}
              text="VALOR APROVADO ✓"
              dotColor="#22C55E"
              size={28}
              scale={popScale(N - (C.f_aprovado - 6), 12)}
              opacity={windowOp(N, C.f_aprovado - 6, 1465)}
            />
          ) : null}
        </>
      ) : null}

      {N >= 1468 && N <= 1545 ? (
        <WidescreenCurvedArrow
          x1={660}
          y1={450}
          x2={1260}
          y2={450}
          arcHeight={155}
          opacity={windowOp(N, 1468, 1545, 8)}
          dashOffset={(N - 1468) * 4}
        />
      ) : null}

      {/* ==================== ATO 5: SETOR DE CADASTRO & LANÇAMENTO NO SISTEMA OFICIAL RPINFO ==================== */}
      {N >= C.f_cadastro - 8 && N <= 1928 ? (
        <>
          <YellowLabel3D
            cx={960}
            cy={175}
            text="SETOR DE CADASTRO"
            size={50}
            tilt={-2}
            scale={popScale(N - (C.f_cadastro - 8), 12)}
            opacity={windowOp(N, C.f_cadastro - 8, 1928)}
          />
          {N >= 1595 && N <= 1742 ? (
            <StatusPillBadge
              cx={440}
              cy={345}
              text="RECEBE QTD + PREÇO R$ 6,99"
              dotColor="#38BDF8"
              size={28}
              scale={popScale(N - 1595, 12)}
              opacity={windowOp(N, 1595, 1742)}
            />
          ) : null}
          {N >= C.f_rpinfo - 6 ? (
            <>
              <YellowLabel3D
                cx={1460}
                cy={265}
                text="SISTEMA RPINFO"
                size={44}
                tilt={2}
                scale={popScale(N - (C.f_rpinfo - 6), 12)}
                opacity={windowOp(N, C.f_rpinfo - 6, 1928)}
              />
              <WidescreenCurvedArrow
                x1={840}
                y1={465}
                x2={1165}
                y2={465}
                arcHeight={105}
                opacity={windowOp(N, C.f_rpinfo - 4, 1928)}
                dashOffset={(N - C.f_rpinfo) * 3.5}
              />
            </>
          ) : null}
          {N >= C.f_etiquetas_cad - 6 ? (
            <StatusPillBadge
              cx={1460}
              cy={365}
              text="VALOR + 24 ETIQUETAS"
              dotColor="#FACC15"
              size={28}
              scale={popScale(N - (C.f_etiquetas_cad - 6), 12)}
              opacity={windowOp(N, C.f_etiquetas_cad - 6, 1928)}
            />
          ) : null}
        </>
      ) : null}

      {/* ==================== ATO 6: BAIXA NO DATA CRÍTICA + RETORNO AUTOMÁTICO PARA A LOJA ==================== */}
      {N >= C.f_baixa - 12 && N <= 2055 ? (
        <>
          <YellowLabel3D
            cx={960}
            cy={180}
            text="BAIXA NO DATA CRÍTICA!"
            size={50}
            scale={popScale(N - (C.f_baixa - 12), 12)}
            opacity={windowOp(N, C.f_baixa - 12, 2055)}
          />
          <StatusPillBadge
            cx={465}
            cy={350}
            text="RPINFO + DATA CRÍTICA OK ✓"
            dotColor="#22C55E"
            size={28}
            scale={popScale(N - C.f_baixa, 12)}
            opacity={windowOp(N, C.f_baixa, 2055)}
          />
        </>
      ) : null}

      {N >= C.f_volta - 10 && N <= 2178 ? (
        <>
          <YellowLabel3D
            cx={960}
            cy={190}
            text="VOLTA PARA O CELULAR DA LOJA!"
            size={48}
            scale={popScale(N - (C.f_volta - 10), 12)}
            opacity={windowOp(N, C.f_volta - 10, 2178)}
          />
          <WidescreenCurvedArrow
            x1={1360}
            y1={430}
            x2={560}
            y2={430}
            arcHeight={185}
            opacity={windowOp(N, C.f_volta - 6, 2178)}
            dashOffset={(N - C.f_volta) * 4.2}
          />
        </>
      ) : null}

      {/* ==================== ATO 7: VERIFICAÇÃO DA FILA DE ETIQUETAS + COLAGEM NOS PRODUTOS ==================== */}
      {N >= 2185 && N <= 2350 ? (
        <>
          <StatusPillBadge
            cx={455}
            cy={325}
            text="RETORNO RECEBIDO NA LOJA ✓"
            dotColor="#22C55E"
            size={28}
            scale={popScale(N - 2185, 12)}
            opacity={windowOp(N, 2185, 2350)}
          />
          {N >= C.f_disponiveis - 25 ? (
            <>
              <YellowLabel3D
                cx={1410}
                cy={255}
                text="FILA DE ETIQUETAS"
                size={44}
                tilt={2}
                scale={popScale(N - (C.f_disponiveis - 25), 12)}
                opacity={windowOp(N, C.f_disponiveis - 25, 2350)}
              />
              <StatusPillBadge
                cx={1410}
                cy={350}
                text="ETIQUETAS DISPONÍVEIS!"
                dotColor="#FACC15"
                size={28}
                scale={popScale(N - (C.f_disponiveis - 6), 12)}
                opacity={windowOp(N, C.f_disponiveis - 6, 2350)}
              />
            </>
          ) : null}
        </>
      ) : null}

      {N >= C.f_cola - 5 && N <= 2472 ? (
        <>
          <YellowLabel3D
            cx={960}
            cy={180}
            text="NOVA ETIQUETA EM CADA PRODUTO!"
            size={48}
            scale={popScale(N - (C.f_cola - 5), 12)}
            opacity={windowOp(N, C.f_cola - 5, 2472)}
          />
          <StatusPillBadge
            cx={1440}
            cy={380}
            text="PREÇO REBAIXADO: R$ 6,99"
            dotColor="#22C55E"
            size={29}
            scale={popScale(N - (C.f_cola + 15), 12)}
            opacity={windowOp(N, C.f_cola + 15, 2472)}
          />
        </>
      ) : null}

      {/* ==================== ATO 8A: VENDA RÁPIDA NO CAIXA E ZERO DESPERDÍCIO ==================== */}
      {N >= 2478 && N <= 2602 ? (
        <>
          <YellowLabel3D
            cx={960}
            cy={180}
            text="VENDE RÁPIDO NO CAIXA!"
            size={50}
            scale={popScale(N - 2478, 12)}
            opacity={windowOp(N, 2478, 2602)}
          />
          <StatusPillBadge
            cx={455}
            cy={335}
            text="CAIXA PDV: R$ 6,99 CERTO ✓"
            dotColor="#22C55E"
            size={28}
            scale={popScale(N - (C.f_caixa - 6), 12)}
            opacity={windowOp(N, C.f_caixa - 6, 2602)}
          />
          <StatusPillBadge
            cx={1465}
            cy={335}
            text="ZERO DESPERDÍCIO!"
            dotColor="#FACC15"
            size={28}
            scale={popScale(N - 2555, 12)}
            opacity={windowOp(N, 2555, 2602)}
          />
        </>
      ) : null}

      {/* ==================== ATO 8B: PANORAMA FINAL 16:9 CONECTANDO OS 3 SETORES ==================== */}
      {N >= C.f_pronto - 4 ? (
        <>
          <YellowLabel3D
            cx={960}
            cy={165}
            text="PRONTO! SISTEMA DE DATA CRÍTICA!"
            size={52}
            tilt={0}
            scale={popScale(N - (C.f_pronto - 4), 14)}
            opacity={windowOp(N, C.f_pronto - 4, 2784)}
          />
          <StatusPillBadge
            cx={395}
            cy={285}
            text="1. LOJA: BIPA & ETIQUETA"
            dotColor="#FACC15"
            size={25}
            scale={popScale(N - (C.f_pronto + 12), 12)}
            opacity={windowOp(N, C.f_pronto + 12, 2784)}
          />
          <StatusPillBadge
            cx={960}
            cy={285}
            text="2. COMPRAS: APROVA REBAIXA"
            dotColor="#38BDF8"
            size={25}
            scale={popScale(N - (C.f_pronto + 22), 12)}
            opacity={windowOp(N, C.f_pronto + 22, 2784)}
          />
          <StatusPillBadge
            cx={1525}
            cy={285}
            text="3. CADASTRO: RPINFO & BAIXA"
            dotColor="#10B981"
            size={25}
            scale={popScale(N - (C.f_pronto + 32), 12)}
            opacity={windowOp(N, C.f_pronto + 32, 2784)}
          />
        </>
      ) : null}

      {/* Legendas Dinâmicas Palavra por Palavra na Zona Segura Inferior 16:9 */}
      <DataCriticaWordSubtitles N={N} />
    </AbsoluteFill>
  );
};

