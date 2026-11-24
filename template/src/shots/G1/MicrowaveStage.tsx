import React from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame } from 'remotion';
import { Fonts, FONT_HEAVY, clamp01, BEZ_SCALE_IN } from '../../common';
import {
  YellowLabel3D,
  StatusPillBadge,
  CurvedDashedArrow2D,
  SpeedometerGaugeCard,
  ThermostatBadge2D,
} from './diorama';
import { MicrowaveDioramaStage, getMicrowaveScreenAnchors } from './MicrowaveDiorama';
import { MICROWAVE_WORDS, MICROWAVE_CUES as C } from './microwaveWords';

const popScale = (n: number, dur = 12) => (n < 0 ? 0 : BEZ_SCALE_IN(clamp01(n / dur)));
const windowOp = (N: number, from: number, to: number, fade = 10) => {
  if (N < from || N > to) return 0;
  return Math.min(clamp01((N - from) / fade), clamp01((to - N) / fade));
};

const YELLOW_KEYWORDS = new Set([
  'água',
  'magnetron',
  'ondas',
  'rádio',
  'invisíveis',
  'moléculas',
  'caixa',
  'metal',
  'espelho',
  'motorzinho',
  'giratório',
  'porta',
  'furadinha',
  'luz',
  'furinhos',
  'vidro',
  'louça',
  'potência',
  'sininho',
  'pronto',
  'micro-ondas',
]);

const ORANGE_KEYWORDS = new Set([
  'fogo',
  'maçarico',
  'calor',
  'queima',
  'congelado',
  'bilhões',
  'atrito',
  'quentes',
  'frios',
  'escapam',
  'doze',
  'centímetros',
  'esquentar',
]);

function getWordColor(raw: string): { color: string; boost: number } {
  const clean = raw
    .toLowerCase()
    .replace(/[.,!?:;"]/g, '')
    .trim();
  if (YELLOW_KEYWORDS.has(clean)) return { color: '#FFE135', boost: 1.07 };
  if (ORANGE_KEYWORDS.has(clean)) return { color: '#FFA800', boost: 1.06 };
  return { color: '#FFFFFF', boost: 1.0 };
}

const MicrowaveWordSubtitles: React.FC<{ N: number }> = ({ N }) => {
  const cur = MICROWAVE_WORDS.find((w) => N >= w.from && N <= w.to + 2);
  if (!cur) return null;
  const n = N - cur.from;
  const { color, boost } = getWordColor(cur.text);
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

export const MicrowaveReelVideo: React.FC = () => {
  const N = useCurrentFrame() + 1;
  const a = getMicrowaveScreenAnchors(N);

  const isPowerOn = Math.floor(N / 22) % 2 === 0;

  return (
    <AbsoluteFill style={{ background: '#69B3F5', overflow: 'hidden' }}>
      <Fonts />
      <Audio src={staticFile('assets/micro-ondas/audio.wav')} />

      {/* Palco 3D Contínuo reutilizando o Boneco Oficial (DesmontandoRig.ts) */}
      <MicrowaveDioramaStage N={N} />

      {/* ==================== ATO 1: TENTATIVA COM MAÇARICO / FOGO QUEIMA POR FORA E CONGELA NO MEIO ==================== */}
      {N >= 12 && N <= 172 ? (
        <StatusPillBadge
          cx={Math.max(310, a.foodTop.x - 85)}
          cy={a.foodTop.y - 95}
          text="COMIDA: GELADA"
          dotColor="#38BDF8"
          scale={popScale(N - 12, 12)}
          opacity={windowOp(N, 12, 172)}
        />
      ) : null}

      {N >= 78 && N <= 172 ? (
        <YellowLabel3D
          cx={Math.min(760, a.torchTip.x - 65)}
          cy={a.torchTip.y - 165}
          text="CALOR POR FORA"
          size={44}
          scale={popScale(N - 78, 12)}
          opacity={windowOp(N, 78, 172)}
        />
      ) : null}

      {N >= 175 && N <= 345 ? (
        <YellowLabel3D
          cx={a.foodTop.x}
          cy={a.foodTop.y - 120}
          text="2 MINUTOS DEPOIS"
          size={48}
          scale={popScale(N - 175, 12)}
          opacity={windowOp(N, 175, 345)}
        />
      ) : null}

      {N >= C.f_queima - 5 && N <= 345 ? (
        <StatusPillBadge
          cx={a.foodTop.x - 130}
          cy={a.foodTop.y - 25}
          text="FORA: QUEIMADO!"
          dotColor="#EF4444"
          scale={popScale(N - (C.f_queima - 5), 12)}
          opacity={windowOp(N, C.f_queima - 5, 345)}
        />
      ) : null}

      {N >= C.f_congelado - 10 && N <= 348 ? (
        <StatusPillBadge
          cx={a.foodMid.x + 125}
          cy={a.foodMid.y + 45}
          text="MEIO: CONGELADO 0 °C"
          dotColor="#38BDF8"
          scale={popScale(N - (C.f_congelado - 10), 12)}
          opacity={windowOp(N, C.f_congelado - 10, 348)}
        />
      ) : null}

      {/* ==================== ATO 2: MOLÉCULAS DE ÁGUA + MAGNETRON ==================== */}
      {N >= C.f_agua - 15 && N <= 640 ? (
        <StatusPillBadge
          cx={a.foodTop.x - 60}
          cy={a.foodTop.y - 55}
          text="MOLÉCULAS DE ÁGUA"
          dotColor="#0EA5E9"
          scale={popScale(N - (C.f_agua - 15), 12)}
          opacity={windowOp(N, C.f_agua - 15, 640)}
        />
      ) : null}

      {N >= C.f_magnetron - 10 && N <= 660 ? (
        <YellowLabel3D
          cx={Math.min(760, a.magnetronTop.x - 30)}
          cy={a.magnetronTop.y - 75}
          text="MAGNETRON"
          size={52}
          scale={popScale(N - (C.f_magnetron - 10), 12)}
          opacity={windowOp(N, C.f_magnetron - 10, 660)}
        />
      ) : null}

      {N >= C.f_magnetron + 25 && N <= 645 ? (
        <StatusPillBadge
          cx={a.magnetronMid.x}
          cy={a.magnetronMid.y + 95}
          text="ONDAS DE RÁDIO"
          dotColor="#FACC15"
          scale={popScale(N - (C.f_magnetron + 25), 12)}
          opacity={windowOp(N, C.f_magnetron + 25, 645)}
        />
      ) : null}

      {/* ==================== ATO 3: 2 BILHÕES DE VEZES/S + ATRITO = CALOR ==================== */}
      {N >= C.f_bilhoes - 12 && N <= 1035 ? (
        <YellowLabel3D
          cx={a.foodTop.x}
          cy={a.foodTop.y - 115}
          text="2,45 BILHÕES / SEG"
          size={48}
          scale={popScale(N - (C.f_bilhoes - 12), 12)}
          opacity={windowOp(N, C.f_bilhoes - 12, 1035)}
        />
      ) : null}

      {N >= C.f_atrito - 12 && N <= 1040 ? (
        <>
          <StatusPillBadge
            cx={a.foodMid.x - 110}
            cy={a.foodMid.y + 65}
            text="ATRITO = CALOR!"
            dotColor="#FF5733"
            scale={popScale(N - (C.f_atrito - 12), 12)}
            opacity={windowOp(N, C.f_atrito - 12, 1040)}
          />
          <StatusPillBadge
            cx={a.foodTop.x + 150}
            cy={a.foodTop.y - 25}
            text="+85 °C"
            dotColor="#EF4444"
            size={34}
            scale={popScale(N - (C.f_atrito + 10), 12)}
            opacity={windowOp(N, C.f_atrito + 10, 1040)}
          />
        </>
      ) : null}

      {/* ==================== ATO 4: ONDAS ESCAPANDO PELA SALA -> CAIXA DE METAL ESPELHADA ==================== */}
      {N >= C.f_escapam - 12 && N <= C.f_caixa - 5 ? (
        <YellowLabel3D
          cx={540}
          cy={380}
          text="ONDAS ESCAPANDO!"
          size={52}
          scale={popScale(N - (C.f_escapam - 12), 12)}
          opacity={windowOp(N, C.f_escapam - 12, C.f_caixa - 5)}
        />
      ) : null}

      {N >= C.f_caixa - 5 && N <= 1335 ? (
        <>
          <YellowLabel3D
            cx={a.boxTop.x}
            cy={a.boxTop.y - 75}
            text="CAIXA METÁLICA"
            size={52}
            scale={popScale(N - (C.f_caixa - 5), 12)}
            opacity={windowOp(N, C.f_caixa - 5, 1335)}
          />
          <StatusPillBadge
            cx={a.boxTop.x}
            cy={a.boxTop.y + 215}
            text="ESPELHO DE ONDAS"
            dotColor="#FACC15"
            scale={popScale(N - (C.f_caixa + 25), 12)}
            opacity={windowOp(N, C.f_caixa + 25, 1335)}
          />
        </>
      ) : null}

      {/* ==================== ATO 5: PONTOS QUENTES E FRIOS -> PRATO GIRATÓRIO + MOTORZINHO ==================== */}
      {N >= C.f_pontos - 10 && N <= C.f_prato + 15 ? (
        <>
          <StatusPillBadge
            cx={a.foodTop.x - 135}
            cy={a.foodTop.y - 45}
            text="PONTO QUENTE"
            dotColor="#EF4444"
            scale={popScale(N - (C.f_pontos - 10), 12)}
            opacity={windowOp(N, C.f_pontos - 10, C.f_prato + 15)}
          />
          <StatusPillBadge
            cx={a.foodTop.x + 145}
            cy={a.foodTop.y - 45}
            text="PONTO FRIO"
            dotColor="#38BDF8"
            scale={popScale(N - (C.f_pontos + 5), 12)}
            opacity={windowOp(N, C.f_pontos + 5, C.f_prato + 15)}
          />
        </>
      ) : null}

      {N >= C.f_prato - 8 && N <= 1655 ? (
        <>
          <YellowLabel3D
            cx={a.boxTop.x}
            cy={a.boxTop.y - 70}
            text="PRATO GIRATÓRIO"
            size={52}
            scale={popScale(N - (C.f_prato - 8), 12)}
            opacity={windowOp(N, C.f_prato - 8, 1655)}
          />
          <CurvedDashedArrow2D
            x1={a.foodMid.x - 150}
            y1={a.foodMid.y + 60}
            x2={a.foodMid.x + 150}
            y2={a.foodMid.y + 60}
            arcHeight={-85}
            opacity={windowOp(N, C.f_prato, 1655, 10)}
            dashOffset={(N - C.f_prato) * 3.5}
          />
          <StatusPillBadge
            cx={a.motorLow.x}
            cy={a.motorLow.y + 95}
            text="ESQUENTA POR IGUAL"
            dotColor="#4ADE80"
            scale={popScale(N - (C.f_prato + 35), 12)}
            opacity={windowOp(N, C.f_prato + 35, 1655)}
          />
        </>
      ) : null}

      {/* ==================== ATO 6: PORTA COM TELA FURADINHA (GAIOLA DE FARADAY VS LUZ) ==================== */}
      {N >= C.f_porta - 8 && N <= 1935 ? (
        <YellowLabel3D
          cx={a.boxTop.x}
          cy={a.boxTop.y - 75}
          text="TELA FURADINHA"
          size={50}
          scale={popScale(N - (C.f_porta - 8), 12)}
          opacity={windowOp(N, C.f_porta - 8, 1935)}
        />
      ) : null}

      {N >= C.f_doze - 10 && N <= 1935 ? (
        <>
          <StatusPillBadge
            cx={a.doorFront.x - 140}
            cy={a.doorFront.y - 40}
            text="ONDA 12 CM: BLOQUEADA!"
            dotColor="#EF4444"
            scale={popScale(N - (C.f_doze - 10), 12)}
            opacity={windowOp(N, C.f_doze - 10, 1935)}
          />
          <StatusPillBadge
            cx={a.doorFront.x + 135}
            cy={a.doorFront.y + 85}
            text="LUZ: PASSA NOS FURINHOS"
            dotColor="#FACC15"
            scale={popScale(N - (C.f_doze + 45), 12)}
            opacity={windowOp(N, C.f_doze + 45, 1935)}
          />
        </>
      ) : null}

      {/* ==================== ATO 7: VIDRO SEM ÁGUA FICA FRIO + BOTÃO DE POTÊNCIA ==================== */}
      {N >= C.f_vidro - 10 && N <= C.f_potencia - 5 ? (
        <>
          <YellowLabel3D
            cx={a.boxTop.x}
            cy={a.boxTop.y - 65}
            text="VIDRO E LOUÇA"
            size={50}
            scale={popScale(N - (C.f_vidro - 10), 12)}
            opacity={windowOp(N, C.f_vidro - 10, C.f_potencia - 5)}
          />
          <StatusPillBadge
            cx={a.foodLow.x}
            cy={a.foodLow.y + 85}
            text="SEM ÁGUA = NÃO ESQUENTA!"
            dotColor="#38BDF8"
            scale={popScale(N - (C.f_vidro + 20), 12)}
            opacity={windowOp(N, C.f_vidro + 20, C.f_potencia - 5)}
          />
        </>
      ) : null}

      {N >= C.f_potencia - 8 && N <= 2265 ? (
        <>
          <YellowLabel3D
            cx={a.magnetronTop.x - 40}
            cy={a.magnetronTop.y - 95}
            text="CONTROLE DE POTÊNCIA"
            size={48}
            scale={popScale(N - (C.f_potencia - 8), 12)}
            opacity={windowOp(N, C.f_potencia - 8, 2265)}
          />
          <SpeedometerGaugeCard
            cx={760}
            cy={430}
            needleValue={isPowerOn ? 0.85 : 0.18}
            scale={popScale(N - C.f_potencia, 12)}
            opacity={windowOp(N, C.f_potencia, 2265)}
          />
          <ThermostatBadge2D
            cx={320}
            cy={430}
            tempText={isPowerOn ? 'LIGA' : 'PAUSA'}
            scale={popScale(N - (C.f_potencia + 12), 12)}
            opacity={windowOp(N, C.f_potencia + 12, 2265)}
          />
        </>
      ) : null}

      {/* ==================== ATO 8: CARCAÇA BRANCA FINAL + SININHO CLÁSSICO DING! ==================== */}
      {N >= 2270 ? (
        <>
          <YellowLabel3D
            cx={610}
            cy={a.boxTop.y - 115}
            text="MICRO-ONDAS PRONTO!"
            size={48}
            scale={popScale(N - 2270, 12)}
            opacity={windowOp(N, 2270, 2579)}
          />
          <StatusPillBadge
            cx={310}
            cy={a.chair.y - 95}
            text="QUENTINHO POR IGUAL!"
            dotColor="#4ADE80"
            scale={popScale(N - (C.f_sininho - 5), 12)}
            opacity={windowOp(N, C.f_sininho - 5, 2579)}
          />
        </>
      ) : null}

      {N >= C.f_pronto ? (
        <YellowLabel3D
          cx={540}
          cy={285}
          text="AGORA VOCÊ SABE COMO MONTAR!"
          size={46}
          scale={popScale(N - C.f_pronto, 12)}
          opacity={windowOp(N, C.f_pronto, 2579)}
        />
      ) : null}

      {/* Legendas Pop Palavra-por-Palavra com Destaque Automático */}
      <MicrowaveWordSubtitles N={N} />
    </AbsoluteFill>
  );
};

