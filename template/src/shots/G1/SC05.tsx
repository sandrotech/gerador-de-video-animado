import React from 'react';
import {useCurrentFrame} from 'remotion';
import {FONT_ORB, GlitchIn, clamp01} from '../../common';
import {
  CText,
  Box,
  Pill,
  Svg,
  LineArrow,
  SoftIn,
  PURPLE,
  PURPLE_LIGHT,
  ORANGE,
  CYAN,
  GREY,
  WHITE,
  GLOW_PURPLE,
  firstOp,
  exitOp,
  glowOffK,
  slideUp,
} from '../../ui';
import {HeroGlow, Sparkle, CameraRig} from '../../fx';
import {PipeParticles} from './ac_parts';

/**
 * SC05 (1758–2170): Peça 4 — A Válvula de Expansão (O Estrangulamento / Efeito Spray que Congela)
 * S09 (1766–1930): 1766 Quarta peça: a válvula de expansão | 1844 estrangulamento minúsculo | 1886 bem no meio da tubulação
 * S10 (1941–2148): 1941 Igual a um spray desodorante que gela ao sair | 2024 perde pressão de repente | 2078 despenca para 5 graus negativos
 */
const F0 = 1758;
const TO = 2170;

export const SC05: React.FC = () => {
  const N = useCurrentFrame() + F0;
  const n = N - F0;
  const op = firstOp(n, 8) * exitOp(N, TO, 8);
  const gk = glowOffK(N, TO);

  const neckIn = clamp01((N - 1840) / 22);
  const sprayIn = clamp01((N - 1938) / 22);
  const dropIn = clamp01((N - 2020) / 22);
  const freezeK = clamp01((N - 2074) / 36);
  const tempNow = Math.round(40 - 45 * freezeK);

  return (
    <div style={{position: 'absolute', inset: 0, opacity: op}}>
      <CameraRig
        N={N}
        keys={[
          {f: F0, x: 640, y: 360, s: 1},
          {f: 2024, x: 640, y: 370, s: 1.06},
        ]}
      >
        {/* Moldura Principal da Válvula de Expansão */}
        <div style={{transform: `translateY(${slideUp(n, 180, 22)}px)`}}>
          <HeroGlow x={180} y={200} w={920} h={380} r={22} N={N} k={gk} color={freezeK > 0.3 ? CYAN : PURPLE} />
          <Box x={180} y={200} w={920} h={380} r={22} stroke={freezeK > 0.3 ? CYAN : WHITE} sw={3}>
            <GlitchIn N={N} f0={1766} rgbSplit={4}>
              <Pill x={24} y={18} w={420} h={42} fill={PURPLE} sw={2} text="PEÇA 4 · VÁLVULA DE EXPANSÃO" fontSize={24} />
            </GlitchIn>
            {sprayIn > 0 ? (
              <SoftIn N={N} f0={1941} dy={8}>
                <Pill x={464} y={18} w={428} h={42} fill="#141824" stroke={CYAN} sw={2} text="EFEITO SPRAY DESODORANTE (EXPANSÃO)" fontSize={21} />
              </SoftIn>
            ) : null}
          </Box>
        </div>

        {/* Tubulação com Estrangulamento Central (Venturi / Bico de Spray) */}
        <Svg>
          {/* Tubo Largo Esquerdo (Alta Pressão 40°C) -> Gargalo Minúsculo (x=600..680) -> Expansão Direita (-5°C) */}
          <path
            d="M 230,320 L 560,320 L 625,378 L 655,378 L 720,305 L 1050,305 L 1050,475 L 720,475 L 655,402 L 625,402 L 560,460 L 230,460 Z"
            fill="#090b12"
            stroke={WHITE}
            strokeWidth={3.5}
            strokeLinejoin="round"
          />

          {/* Preenchimento esquerdo: Líquido denso sob alta pressão */}
          <path
            d="M 234,324 L 558,324 L 623,380 L 623,400 L 558,456 L 234,456 Z"
            fill={PURPLE}
            opacity={0.45}
          />

          {/* Partículas lentas e apertadas na esquerda */}
          <PipeParticles x0={250} y0={365} x1={575} y1={385} N={N} count={6} color={PURPLE_LIGHT} speed={0.014} r={6} />
          <PipeParticles x0={250} y0={415} x1={575} y1={395} N={N} count={6} color={WHITE} speed={0.014} r={5} />

          {/* Jato de Spray / Névoa Gelada expandindo rápido na direita */}
          <PipeParticles x0={658} y0={390} x1={1030} y1={335} N={N} count={7} color={CYAN} speed={0.038} r={4.5} />
          <PipeParticles x0={658} y0={390} x1={1030} y1={390} N={N} count={7} color={WHITE} speed={0.042} r={4} />
          <PipeParticles x0={658} y0={390} x1={1030} y1={445} N={N} count={7} color={CYAN} speed={0.036} r={4.5} />

          {/* Setas indicando o estrangulamento minúsculo */}
          {neckIn > 0 ? (
            <>
              <LineArrow x0={640} y0={265} x1={640} y1={362} p={neckIn} rodW={4} headL={18} headW={18} color={ORANGE} />
              <LineArrow x0={640} y0={515} x1={640} y1={418} p={neckIn} rodW={4} headL={18} headW={18} color={ORANGE} />
            </>
          ) : null}
        </Svg>

        {/* Cristais de gelo (Sparkles) quando despenca para -5°C */}
        {freezeK > 0.1 ? (
          <>
            <Sparkle cx={820} cy={340} r={12 * freezeK} color={CYAN} opacity={0.85} />
            <Sparkle cx={940} cy={365} r={14 * freezeK} color={WHITE} opacity={0.9} />
            <Sparkle cx={875} cy={435} r={11 * freezeK} color={CYAN} opacity={0.85} />
          </>
        ) : null}

        {/* Rótulos Esquerda (Alta Pressão) vs Direita (Baixa Pressão / -5°C) */}
        <CText cx={395} cy={292} size={23} weight={700} color={PURPLE_LIGHT}>
          ALTA PRESSÃO · 40°C
        </CText>

        {neckIn > 0.2 ? (
          <SoftIn N={N} f0={1844} dy={8}>
            <Pill x={515} y={518} w={250} h={38} fill={ORANGE} sw={2} text="ESTRANGULAMENTO" fontSize={21} />
          </SoftIn>
        ) : null}

        {dropIn > 0 ? (
          <SoftIn N={N} f0={2024} dy={10}>
            <CText cx={885} cy={280} size={23} weight={700} color={CYAN}>
              QUEDA BRUSCA DE PRESSÃO!
            </CText>
          </SoftIn>
        ) : null}

        {/* Contador de temperatura despencando para -5°C */}
        {N >= 2050 ? (
          <SoftIn N={N} f0={2050} dy={12}>
            <Box x={800} y={488} w={255} h={74} r={14} stroke={CYAN} sw={2.5} glow={GLOW_PURPLE}>
              <CText cx={127} cy={37} size={44} family={FONT_ORB} weight={700} color={CYAN}>
                {`${tempNow}°C`}
              </CText>
            </Box>
          </SoftIn>
        ) : null}
      </CameraRig>
    </div>
  );
};

