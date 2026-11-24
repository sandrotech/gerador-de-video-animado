import React from 'react';
import {useCurrentFrame} from 'remotion';
import {FONT_HEAVY, FONT_ORB, GlitchIn, clamp01} from '../../common';
import {
  CText,
  TechText,
  Box,
  Pill,
  TagBlock,
  Svg,
  LineArrow,
  SoftIn,
  PURPLE,
  PURPLE_LIGHT,
  ORANGE,
  CYAN,
  GREEN,
  GREY,
  GREY_LINE,
  WHITE,
  GLOW_PURPLE,
  GLOW_ORANGE,
  firstOp,
  exitOp,
  glowOffK,
  slideUp,
  abs,
  mixHex,
} from '../../ui';
import {HeroGlow, CameraRig, countTo} from '../../fx';
import {PipeParticles} from './ac_parts';

/**
 * SC01 (78–500): O Segredo — Não cria frio, rouba calor com fluido refrigerante
 * S01 (86–270): 86 não cria frio | 144 esponja | 191 suga calor do quarto | 230 joga lá para fora
 * S02 (281–478): 281 mágica | 325 fluido refrigerante | 404 viaja sem parar dentro de tubos de cobre
 */
const F0 = 78;
const TO = 500;

export const SC01: React.FC = () => {
  const N = useCurrentFrame() + F0;
  const n = N - F0;
  const op = firstOp(n, 8) * exitOp(N, TO, 8);
  const gk = glowOffK(N, TO);

  // Temperatura do quarto caindo de 32°C para 20°C quando o fluido circula (f340->f440)
  const coolK = clamp01((N - 340) / 90);
  const roomTemp = Math.round(32 - 12 * coolK);
  const roomColor = mixHex(ORANGE, CYAN, coolK);

  // Entrada da esponja / circuito de cobre
  const spongeIn = clamp01((N - 140) / 18);
  const suckIn = clamp01((N - 188) / 22);
  const outIn = clamp01((N - 226) / 22);
  const pipeIn = clamp01((N - 320) / 24);

  return (
    <div style={{position: 'absolute', inset: 0, opacity: op}}>
      <CameraRig
        N={N}
        keys={[
          {f: F0, x: 640, y: 360, s: 1},
          {f: 455, x: 640, y: 360, s: 1.04},
        ]}
      >
        {/* Caixa Esquerda: QUARTO */}
        <div style={{transform: `translateY(${slideUp(n, 160, 20)}px)`}}>
          <HeroGlow x={100} y={175} w={420} h={390} r={18} N={N} k={gk * (1 - 0.3 * coolK)} color={roomColor} />
          <Box x={100} y={175} w={420} h={390} r={18} stroke={roomColor} sw={3}>
            <Pill x={24} y={20} w={210} h={40} fill={PURPLE} sw={2} text="SEU QUARTO" fontSize={24} />
            <CText cx={210} cy={145} size={86} family={FONT_ORB} weight={700} color={roomColor}>
              {`${roomTemp}°C`}
            </CText>
            <CText cx={210} cy={210} size={24} weight={600} color={GREY}>
              {coolK > 0.5 ? 'CALOR REMOVIDO · AMBIENTE FRESCO' : 'AR ABAFADO CHEIO DE CALOR'}
            </CText>
          </Box>
        </div>

        {/* Parede divisória central */}
        <Box x={622} y={155} w={36} h={430} r={6} fill="#141418" stroke={GREY_LINE} sw={2} />
        <CText cx={640} cy={135} size={22} weight={700} color={GREY}>
          PAREDE
        </CText>

        {/* Caixa Direita: LADO DE FORA (RUA) */}
        <div style={{transform: `translateY(${slideUp(Math.max(0, n - 4), 160, 20)}px)`}}>
          <Box x={760} y={175} w={420} h={390} r={18} stroke={outIn > 0.2 ? ORANGE : WHITE} sw={2.5} glow={outIn > 0.2 ? GLOW_ORANGE : undefined}>
            <Pill x={24} y={20} w={240} h={40} fill="#222" stroke={WHITE} sw={2} text="LADO DE FORA (RUA)" fontSize={22} />
            <CText cx={210} cy={145} size={54} weight={900} color={outIn > 0.2 ? ORANGE : GREY}>
              {outIn > 0.2 ? 'CALOR EXPULSO!' : 'AMBIENTE EXTERNO'}
            </CText>
            <CText cx={210} cy={210} size={24} weight={600} color={GREY}>
              O calor do quarto é despejado aqui
            </CText>
          </Box>
        </div>

        {/* S01 (144): Conceito Esponja Térmica atravessando a parede */}
        {spongeIn > 0 ? (
          <SoftIn N={N} f0={140} dy={16}>
            <TagBlock x={445} y={118} w={390} h={54} color={PURPLE} text="NÃO CRIA FRIO · ROUBA CALOR" fontSize={28} />
          </SoftIn>
        ) : null}

        {/* Circuito fechado de Tubos de Cobre + Fluido Refrigerante */}
        <Svg>
          {/* Tubo superior: levando calor do quarto para a rua */}
          {suckIn > 0 ? (
            <>
              <LineArrow x0={360} y0={435} x1={910} y1={435} p={suckIn} rodW={10} headL={26} headW={26} color={ORANGE} />
              <PipeParticles x0={360} y0={435} x1={890} y1={435} N={N} count={7} color={WHITE} speed={0.022} r={5} opacity={suckIn} />
            </>
          ) : null}

          {/* Tubo inferior: voltando gelado da rua para o quarto */}
          {pipeIn > 0 ? (
            <>
              <LineArrow x0={910} y0={515} x1={360} y1={515} p={pipeIn} rodW={10} headL={26} headW={26} color={CYAN} />
              <PipeParticles x0={910} y0={515} x1={380} y1={515} N={N} count={7} color={CYAN} speed={0.022} r={5} opacity={pipeIn} />
            </>
          ) : null}
        </Svg>

        {/* Rótulos sobre os tubos */}
        {suckIn > 0.4 ? (
          <SoftIn N={N} f0={191} dy={10}>
            <Pill x={475} y={392} w={330} h={36} fill={ORANGE} sw={2} text="1. SUGA O CALOR DO QUARTO →" fontSize={22} />
          </SoftIn>
        ) : null}

        {/* S02 (325): GlitchIn no termo protagonista FLUIDO REFRIGERANTE */}
        {N >= 320 ? (
          <GlitchIn N={N} f0={320} rgbSplit={4}>
            <Pill
              x={420}
              y={472}
              w={440}
              h={42}
              fill={PURPLE}
              stroke={WHITE}
              sw={2.5}
              text="FLUIDO REFRIGERANTE (TUBOS DE COBRE)"
              fontSize={23}
              glow={GLOW_PURPLE}
            />
          </GlitchIn>
        ) : null}
      </CameraRig>
    </div>
  );
};

