import React from 'react';
import {useCurrentFrame} from 'remotion';
import {FONT_ORB, GlitchIn, clamp01} from '../../common';
import {
  CText,
  Box,
  Pill,
  Svg,
  LineArrow,
  Gauge,
  SoftIn,
  PURPLE,
  PURPLE_LIGHT,
  ORANGE,
  CYAN,
  GREY,
  WHITE,
  GLOW_ORANGE,
  firstOp,
  exitOp,
  glowOffK,
  slideUp,
  mixHex,
} from '../../ui';
import {HeroGlow, CameraRig} from '../../fx';
import {PipeParticles} from './ac_parts';

/**
 * SC03 (922–1342): Peça 2 — O Compressor (O Coração da Máquina na Unidade Externa)
 * S05 (930–1109): 930 Segunda peça: o compressor | 1002 coração da máquina | 1049 caixa do lado de fora
 * S06 (1120–1320): 1120 recebe gás que evaporou | 1167 aperta com força até 65 graus | 1250 concentrando calor para expulsá-lo
 */
const F0 = 922;
const TO = 1342;

export const SC03: React.FC = () => {
  const N = useCurrentFrame() + F0;
  const n = N - F0;
  const op = firstOp(n, 8) * exitOp(N, TO, 8);
  const gk = glowOffK(N, TO);

  const gasIn = clamp01((N - 1118) / 20);
  const pressK = clamp01((N - 1165) / 55);
  const outGas = clamp01((N - 1245) / 22);

  // Movimento contínuo do pistão de compressão
  const speed = N >= 1165 ? 0.36 : 0.18;
  const strokeCycle = 0.5 + 0.5 * Math.sin(N * speed);
  const pistonY = 365 - strokeCycle * (38 + 26 * pressK);
  const chamberColor = mixHex(PURPLE, ORANGE, pressK);
  const tempVal = Math.round(15 + 50 * pressK);

  return (
    <div style={{position: 'absolute', inset: 0, opacity: op}}>
      <CameraRig
        N={N}
        keys={[
          {f: F0, x: 640, y: 360, s: 1},
          {f: 1167, x: 640, y: 360, s: 1},
          {f: 1210, x: 640, y: 370, s: 1.06},
        ]}
      >
        {/* Corpo Central do Compressor */}
        <div style={{transform: `translateY(${slideUp(n, 180, 22)}px)`}}>
          <HeroGlow x={380} y={195} w={440} h={390} r={26} N={N} k={gk} color={chamberColor} />
          <Box x={380} y={195} w={440} h={390} r={26} stroke={chamberColor} sw={3.5}>
            <GlitchIn N={N} f0={930} rgbSplit={4}>
              <Pill x={24} y={18} w={330} h={42} fill={PURPLE} sw={2} text="PEÇA 2 · COMPRESSOR" fontSize={25} />
            </GlitchIn>
            {N >= 1002 ? (
              <SoftIn N={N} f0={1002} dy={8}>
                <CText cx={220} cy={85} size={23} weight={700} color={PURPLE_LIGHT}>
                  O CORAÇÃO DA MÁQUINA · UNIDADE EXTERNA
                </CText>
              </SoftIn>
            ) : null}
          </Box>
        </div>

        {/* Câmara Interna + Pistão Animado + Partículas de Gás */}
        <Svg>
          {/* Cilindro de compressão */}
          <rect x={470} y={295} width={260} height={195} rx={12} fill="#08080e" stroke={WHITE} strokeWidth={2.5} />
          {/* Gás comprimido no topo do cilindro */}
          <rect
            x={474}
            y={299}
            width={252}
            height={Math.max(28, pistonY - 299)}
            rx={8}
            fill={chamberColor}
            opacity={0.35 + 0.35 * strokeCycle}
          />
          {/* Cabeça do Pistão */}
          <rect x={476} y={pistonY} width={248} height={28} rx={6} fill={WHITE} />
          {/* Haste / Biela do Pistão */}
          <rect x={586} y={pistonY + 28} width={28} height={485 - (pistonY + 28)} fill={GREY} />
          <circle cx={600} cy={495} r={20} fill="#000" stroke={WHITE} strokeWidth={3} />

          {/* Tubo Esquerdo: Entrada de Gás Morno */}
          {gasIn > 0 ? (
            <>
              <LineArrow x0={100} y0={335} x1={465} y1={335} p={gasIn} rodW={8} color={CYAN} />
              <PipeParticles x0={100} y0={335} x1={450} y1={335} N={N} count={5} color={CYAN} speed={0.022} r={5} opacity={gasIn} />
            </>
          ) : null}

          {/* Tubo Direito: Saída de Gás Superaquecido a 65°C */}
          {outGas > 0 ? (
            <>
              <LineArrow x0={735} y0={320} x1={1160} y1={320} p={outGas} rodW={9} color={ORANGE} />
              <PipeParticles x0={735} y0={320} x1={1140} y1={320} N={N} count={6} color={ORANGE} speed={0.032} r={5.5} opacity={outGas} />
            </>
          ) : null}
        </Svg>

        {/* Rótulo Esquerdo: Entrada */}
        {gasIn > 0.2 ? (
          <SoftIn N={N} f0={1120} dy={10}>
            <Box x={80} y={370} w={265} h={95} r={12} stroke={CYAN} sw={2}>
              <CText cx={132} cy={34} size={24} weight={700} color={CYAN}>
                GÁS QUE EVAPOROU
              </CText>
              <CText cx={132} cy={68} size={22} weight={600} color={GREY}>
                Baixa Pressão · 15°C
              </CText>
            </Box>
          </SoftIn>
        ) : null}

        {/* Manômetro + Temperatura subindo até 65°C */}
        {N >= 1165 ? (
          <SoftIn N={N} f0={1165} dy={12}>
            <Gauge
              cx={1020}
              cy={470}
              r={92}
              v={0.25 + 0.68 * pressK}
              accent={pressK > 0.4 ? ORANGE : PURPLE}
              value={`${tempVal}°C`}
              valueSize={38}
              label="ALTA PRESSÃO · CALOR CONCENTRADO"
              labelSize={22}
            />
          </SoftIn>
        ) : null}

        {/* Pill inferior explicando a ação do pistão */}
        <Pill
          x={430}
          y={525}
          w={340}
          h={40}
          fill={pressK > 0.3 ? ORANGE : PURPLE}
          sw={2}
          text={pressK > 0.3 ? 'APERTA O GÁS ATÉ 65°C!' : 'PISTÃO DE COMPRESSÃO'}
          fontSize={22}
          glow={pressK > 0.3 ? GLOW_ORANGE : undefined}
        />
      </CameraRig>
    </div>
  );
};

