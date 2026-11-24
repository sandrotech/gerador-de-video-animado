import React from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame} from 'remotion';
import {Fonts, FONT_HEAVY, clamp01, BEZ_SCALE_IN} from '../../common';
import {VIDEO} from '../../config';
import {WORDS} from '../../common/words';
import {
  YellowLabel3D,
  StatusPillBadge,
  CurvedDashedArrow2D,
  SpeedometerGaugeCard,
  ThermostatBadge2D,
} from './diorama';
import {ThreeDioramaStage, getScreenAnchors} from './ThreeDiorama';

const popScale = (n: number, dur = 12) => (n < 0 ? 0 : BEZ_SCALE_IN(clamp01(n / dur)));
const windowOp = (N: number, from: number, to: number, fade = 10) => {
  if (N < from || N > to) return 0;
  return Math.min(clamp01((N - from) / fade), clamp01((to - N) / fade));
};

// Palavras-chave que ganham destaque automático em Amarelo (#FFE135) ou Laranja (#FFA800) igual ao @desmontandoomundo
const YELLOW_KEYWORDS = new Set([
  'gelo',
  'geladinho',
  'fluido',
  'refrigerante',
  'evaporador',
  'condensador',
  'válvula',
  'expansão',
  'congela',
  'ciclo',
  'dreno',
  'mangueirinha',
  'inverter',
  'velocidade',
  'pronto',
  'ar-condicionado',
]);

const ORANGE_KEYWORDS = new Set([
  'calor',
  'quente',
  'derrete',
  'ferve',
  '50',
  '35',
  '70',
  'graus',
  'compressor',
  'bomba',
  'pneu',
  'espreme',
  'apertado',
  'pressão',
]);

function getWordColor(raw: string): {color: string; boost: number} {
  const clean = raw
    .toLowerCase()
    .replace(/[.,!?:;"]/g, '')
    .trim();
  if (YELLOW_KEYWORDS.has(clean)) return {color: '#FFE135', boost: 1.07};
  if (ORANGE_KEYWORDS.has(clean)) return {color: '#FFA800', boost: 1.06};
  return {color: '#FFFFFF', boost: 1.0};
}

/** Legenda Pop Palavra-por-Palavra estilo Reels (@desmontandoomundo) na parte inferior (y=1435) */
const ReelWordSubtitles: React.FC<{N: number}> = ({N}) => {
  const cur = WORDS.find((w) => N >= w.from && N <= w.to + 2);
  if (!cur) return null;
  const n = N - cur.from;
  const {color, boost} = getWordColor(cur.text);
  const s = (0.85 + 0.15 * Math.min(1, n / 4)) * boost;
  return (
    <div
      style={{
        position: 'absolute',
        left: 540,
        top: 1435,
        transform: `translate(-50%, -50%) scale(${s})`,
        fontFamily: FONT_HEAVY,
        fontWeight: 900,
        fontSize: 66,
        color,
        whiteSpace: 'nowrap',
        WebkitTextStroke: '13px #141414',
        paintOrder: 'stroke fill',
        filter: 'drop-shadow(0 8px 14px rgba(0,0,0,0.45))',
        zIndex: 50,
      }}
    >
      {cur.text}
    </div>
  );
};

export const ReelVideo: React.FC = () => {
  const N = useCurrentFrame() + 1;
  const a = getScreenAnchors(N);

  return (
    <AbsoluteFill style={{background: '#69B3F5', overflow: 'hidden'}}>
      <Fonts />
      <Audio src={staticFile(`assets/${VIDEO.slug}/audio.wav`)} />

      {/* Mundo 3D Único Contínuo com Sombra Projetada, Tubos Helicoidais 3D e Transições Suaves de Câmera */}
      <ThreeDioramaStage N={N} />

      {/* ==================== RÓTULOS 3D E WIDGETS 2.5D ANCORADOS AOS OBJETOS ==================== */}
      {/* Cena 1: Sala Quente + Balde de Gelo + 2 HORAS DEPOIS */}
      {N <= 190 ? (
        <StatusPillBadge
          cx={a.chair.x}
          cy={a.chair.y - 70}
          text="QUARTO: 30 °C"
          dotColor="#FF5733"
          scale={popScale(N - 10, 12)}
          opacity={windowOp(N, 10, 190)}
        />
      ) : null}

      {N >= 288 && N <= 368 ? (
        <YellowLabel3D
          cx={a.stoolTop.x}
          cy={a.stoolTop.y - 90}
          text="2 HORAS DEPOIS"
          size={48}
          scale={popScale(N - 288, 12)}
          opacity={windowOp(N, 288, 368)}
        />
      ) : null}

      {/* Cena 2: Tanque Rosa (-50 °C) + EVAPORADOR + GÁS REFRIGERANTE */}
      {N >= 405 && N <= 562 ? (
        <YellowLabel3D
          cx={a.stoolTop.x}
          cy={a.stoolTop.y - 80}
          text="FERVE A -50 °C"
          size={50}
          scale={popScale(N - 405, 12)}
          opacity={windowOp(N, 405, 562)}
        />
      ) : null}
      {N >= 495 && N <= 562 ? (
        <YellowLabel3D
          cx={a.stoolTop.x}
          cy={a.stoolTop.y - 165}
          text="FLUIDO REFRIGERANTE"
          size={44}
          scale={popScale(N - 495, 12)}
          opacity={windowOp(N, 495, 562)}
        />
      ) : null}
      {N >= 625 && N <= 755 ? (
        <YellowLabel3D
          cx={a.stoolTop.x}
          cy={a.stoolTop.y - 60}
          text="EVAPORADOR"
          size={52}
          scale={popScale(N - 625, 12)}
          opacity={windowOp(N, 625, 755)}
        />
      ) : null}
      {N >= 670 && N <= 755 ? (
        <YellowLabel3D
          cx={a.stoolHigh.x}
          cy={a.stoolHigh.y - 140}
          text="GÁS REFRIGERANTE"
          size={44}
          scale={popScale(N - 670, 12)}
          opacity={windowOp(N, 670, 755)}
        />
      ) : null}

      {/* Cena 3A (f758..832): Seta Curva Tracejada Amarela mostrando o retorno do ciclo sobre o ventilador */}
      {N >= 758 && N <= 832 ? (
        <CurvedDashedArrow2D
          x1={a.stoolHigh.x - 30}
          y1={a.stoolHigh.y - 40}
          x2={a.fanTop.x + 70}
          y2={a.fanTop.y + 80}
          arcHeight={175}
          opacity={windowOp(N, 758, 832, 8)}
          dashOffset={(N - 758) * 3.5}
        />
      ) : null}

      {/* Cena 3B (f832..922): Corte Transversal da Casa Inteira */}
      {N >= 832 && N <= 922 ? (
        <>
          <StatusPillBadge
            cx={a.chair.x}
            cy={a.chair.y - 40}
            text="QUARTO: 30 °C"
            dotColor="#FF5733"
            scale={popScale(N - 835, 12)}
            opacity={windowOp(N, 832, 922)}
          />
          <StatusPillBadge
            cx={a.stoolTop.x + 40}
            cy={a.stoolTop.y + 10}
            text="GÁS: GELADO"
            dotColor="#38BDF8"
            scale={popScale(N - 845, 12)}
            opacity={windowOp(N, 838, 922)}
          />
          <StatusPillBadge
            cx={a.yardSky.x}
            cy={a.yardSky.y}
            text="RUA: 35 °C"
            dotColor="#FF5733"
            scale={popScale(N - 840, 12)}
            opacity={windowOp(N, 835, 922)}
          />
        </>
      ) : null}

      {/* Cena 4: Quintal — COMPRESSOR + Bomba de Pneu (+70 °C) */}
      {N >= 930 && N <= 1515 ? (
        <StatusPillBadge
          cx={780}
          cy={420}
          text="RUA: 35 °C"
          dotColor="#FF5733"
          scale={popScale(N - 930, 12)}
          opacity={windowOp(N, 930, 1515)}
        />
      ) : null}
      {N >= 1045 && N <= 1265 ? (
        <YellowLabel3D
          cx={a.compressorTop.x}
          cy={a.compressorTop.y - 95}
          text="COMPRESSOR"
          size={52}
          scale={popScale(N - 1045, 12)}
          opacity={windowOp(N, 1045, 1265)}
        />
      ) : null}
      {N >= 1108 && N <= 1265 ? (
        <StatusPillBadge
          cx={a.pumpTop.x + 40}
          cy={a.pumpTop.y - 50}
          text="ESPREMIDO"
          dotColor="#FF5733"
          scale={popScale(N - 1108, 12)}
          opacity={windowOp(N, 1108, 1265)}
        />
      ) : null}
      {N >= 1185 && N <= 1515 ? (
        <StatusPillBadge
          cx={a.compressorTop.x}
          cy={a.compressorTop.y - 25}
          text="+70 °C"
          dotColor="#EF4444"
          size={34}
          scale={popScale(N - 1185, 12)}
          opacity={windowOp(N, 1185, 1515)}
        />
      ) : null}

      {/* Cena 5: Quintal — CONDENSADOR */}
      {N >= 1365 && N <= 1515 ? (
        <YellowLabel3D
          cx={a.condenserTop.x}
          cy={a.condenserTop.y - 70}
          text="CONDENSADOR"
          size={52}
          scale={popScale(N - 1365, 12)}
          opacity={windowOp(N, 1365, 1515)}
        />
      ) : null}
      {N >= 1455 && N <= 1515 ? (
        <StatusPillBadge
          cx={a.condenserBot.x}
          cy={a.condenserBot.y + 50}
          text="ESPREMIDO (LÍQUIDO)"
          dotColor="#38BDF8"
          scale={popScale(N - 1455, 12)}
          opacity={windowOp(N, 1455, 1515)}
        />
      ) : null}

      {/* Cena 6: Close-up na VÁLVULA DE EXPANSÃO ("furinho") */}
      {N >= 1545 && N <= 1802 ? (
        <StatusPillBadge
          cx={a.valveLow.x + 90}
          cy={a.valveLow.y + 40}
          text="APERTADO"
          dotColor="#FF5733"
          scale={popScale(N - 1545, 12)}
          opacity={windowOp(N, 1545, 1802)}
        />
      ) : null}
      {N >= 1605 && N <= 1802 ? (
        <YellowLabel3D
          cx={a.valveHigh.x}
          cy={a.valveHigh.y - 80}
          text="VÁLVULA DE EXPANSÃO"
          size={46}
          scale={popScale(N - 1605, 12)}
          opacity={windowOp(N, 1605, 1802)}
        />
      ) : null}
      {N >= 1665 && N <= 1802 ? (
        <StatusPillBadge
          cx={a.valve.x + 110}
          cy={a.valve.y - 45}
          text="SOLTO"
          dotColor="#38BDF8"
          scale={popScale(N - 1665, 12)}
          opacity={windowOp(N, 1665, 1802)}
        />
      ) : null}

      {/* Cena 7A (f1805..1854): Pingos na Bandeja + Copo Gelado Suando + Termostato 23° */}
      {N >= 1808 && N <= 1854 ? (
        <>
          <StatusPillBadge
            cx={a.stoolTop.x - 120}
            cy={a.stoolTop.y - 95}
            text="UMIDADE DO AR"
            dotColor="#38BDF8"
            scale={popScale(N - 1808, 10)}
            opacity={windowOp(N, 1808, 1854, 8)}
          />
          <ThermostatBadge2D
            cx={a.stoolTop.x - 160}
            cy={a.stoolTop.y + 35}
            tempText="23°"
            scale={popScale(N - 1815, 10)}
            opacity={windowOp(N, 1815, 1854, 8)}
          />
        </>
      ) : null}

      {/* Cena 7B (f1855..1900): Mangueirinha Branca do DRENO no Quintal */}
      {N >= 1856 && N <= 1902 ? (
        <YellowLabel3D
          cx={a.drainTip.x}
          cy={a.drainTip.y - 120}
          text="DRENO"
          size={52}
          scale={popScale(N - 1858, 10)}
          opacity={windowOp(N, 1856, 1902, 8)}
        />
      ) : null}

      {/* Cena 7C (f1903..1982): Motor INVERTER + Velocímetro de VELOCIDADE no Compressor */}
      {N >= 1903 && N <= 1982 ? (
        <>
          <SpeedometerGaugeCard
            cx={a.compressorTop.x + 15}
            cy={a.compressorTop.y - 185}
            needleValue={0.85 - 0.58 * clamp01((N - 1922) / 38)}
            scale={popScale(N - 1905, 12)}
            opacity={windowOp(N, 1903, 1982, 8)}
          />
          <YellowLabel3D
            cx={a.compressorTop.x - 45}
            cy={a.compressorTop.y - 45}
            text="INVERTER"
            size={50}
            scale={popScale(N - 1918, 12)}
            opacity={windowOp(N, 1915, 1982, 8)}
          />
        </>
      ) : null}

      {/* Cena 8: Montagem Final com Carenagem Branca + Fechamento */}
      {N >= 1990 ? (
        <YellowLabel3D
          cx={a.splitWall.x + 40}
          cy={a.splitWall.y - 30}
          text="AR-CONDICIONADO"
          size={46}
          scale={popScale(N - 1990, 12)}
        />
      ) : null}
      {N >= 2105 ? (
        <>
          <YellowLabel3D
            cx={540}
            cy={215}
            text="AGORA VOCÊ SABE COMO MONTAR"
            size={44}
            tilt={-2}
            scale={popScale(N - 2105, 12)}
          />
          <YellowLabel3D
            cx={540}
            cy={290}
            text="UM AR-CONDICIONADO!"
            size={52}
            tilt={-2}
            scale={popScale(N - 2145, 12)}
          />
        </>
      ) : null}

      {/* Legenda Pop Palavra por Palavra com Destaque Automático na parte inferior */}
      <ReelWordSubtitles N={N} />
    </AbsoluteFill>
  );
};
