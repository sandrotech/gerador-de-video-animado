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
  GLOW_ORANGE,
  firstOp,
  exitOp,
  glowOffK,
  slideUp,
} from '../../ui';
import {HeroGlow, CameraRig} from '../../fx';
import {CoilZigZag, FanWheel, PipeParticles} from './ac_parts';

/**
 * SC04 (1343–1757): Peça 3 — O Condensador e a Ventoinha Externa (Unidade Externa na Rua)
 * S07 (1351–1524): 1351 Terceira peça: o condensador | 1420 segunda serpentina de tubos | 1471 grande ventoinha soprando
 * S08 (1535–1735): 1535 vento sopra calor intenso para a rua | 1609 gás esfria até condensar | 1667 voltando a ser líquido sob alta pressão
 */
const F0 = 1343;
const TO = 1757;

export const SC04: React.FC = () => {
  const N = useCurrentFrame() + F0;
  const n = N - F0;
  const op = firstOp(n, 8) * exitOp(N, TO, 8);
  const gk = glowOffK(N, TO);

  const coilIn = clamp01((N - 1416) / 22);
  const fanIn = clamp01((N - 1468) / 22);
  const blowIn = clamp01((N - 1532) / 22);
  const condenseIn = clamp01((N - 1606) / 22);
  const liqOut = clamp01((N - 1664) / 22);

  return (
    <div style={{position: 'absolute', inset: 0, opacity: op}}>
      <CameraRig
        N={N}
        keys={[
          {f: F0, x: 640, y: 360, s: 1},
          {f: 1580, x: 640, y: 372, s: 1.05},
        ]}
      >
        {/* Caixa da Unidade Externa (Condensadora) */}
        <div style={{transform: `translateY(${slideUp(n, 180, 22)}px)`}}>
          <HeroGlow x={220} y={200} w={840} h={380} r={22} N={N} k={gk} />
          <Box x={220} y={200} w={840} h={380} r={22} stroke={WHITE} sw={3}>
            <GlitchIn N={N} f0={1351} rgbSplit={4}>
              <Pill x={24} y={18} w={355} h={42} fill={PURPLE} sw={2} text="PEÇA 3 · CONDENSADOR" fontSize={25} />
            </GlitchIn>
            <Pill x={396} y={18} w={395} h={42} fill="#181822" stroke={ORANGE} sw={2} text="UNIDADE EXTERNA (DISSIPA CALOR)" fontSize={21} />
          </Box>
        </div>

        {/* Ventoinha Externa + Serpentina Condensadora (65°C Laranja no topo -> 40°C Roxo/Ciano na base) */}
        <Svg>
          {fanIn > 0 ? (
            <FanWheel cx={375} cy={395} r={92} N={N} speed={10} accent={ORANGE} opacity={fanIn} />
          ) : null}

          {coilIn > 0 ? (
            <CoilZigZag
              x={545}
              y={290}
              w={410}
              h={195}
              rows={5}
              topColor={ORANGE}
              botColor={PURPLE_LIGHT}
              N={N}
              opacity={coilIn}
              fins={12}
            />
          ) : null}

          {/* S08 (1535): Vento expulsando calor para a rua (direita) */}
          {blowIn > 0 ? (
            <>
              <LineArrow x0={980} y0={315} x1={1205} y1={285} p={blowIn} rodW={6} color={ORANGE} />
              <LineArrow x0={980} y0={385} x1={1205} y1={385} p={blowIn} rodW={6} color={ORANGE} />
              <LineArrow x0={980} y0={455} x1={1205} y1={485} p={blowIn} rodW={6} color={ORANGE} />
              <PipeParticles x0={980} y0={385} x1={1200} y1={385} N={N} count={6} color={ORANGE} speed={0.03} r={5} opacity={blowIn} />
            </>
          ) : null}

          {/* S08 (1667): Saída inferior de líquido sob alta pressão */}
          {liqOut > 0 ? (
            <>
              <LineArrow x0={545} y0={525} x1={250} y1={525} p={liqOut} rodW={8} color={PURPLE_LIGHT} />
              <PipeParticles x0={545} y0={525} x1={270} y1={525} N={N} count={5} color={CYAN} speed={0.024} r={5} opacity={liqOut} />
            </>
          ) : null}
        </Svg>

        {fanIn > 0.3 ? (
          <CText cx={375} cy={520} size={22} weight={700} color={WHITE}>
            VENTOINHA EXTERNA
          </CText>
        ) : null}

        {/* Rótulo Calor Expulso na Rua */}
        {blowIn > 0.2 ? (
          <SoftIn N={N} f0={1535} dy={10}>
            <Box x={1075} y={190} w={175} h={92} r={12} stroke={ORANGE} sw={2.5} glow={GLOW_ORANGE}>
              <CText cx={87} cy={32} size={23} weight={800} color={ORANGE}>
                CALOR NA RUA
              </CText>
              <CText cx={87} cy={66} size={22} family={FONT_ORB} weight={700} color={WHITE}>
                65°C → 40°C
              </CText>
            </Box>
          </SoftIn>
        ) : null}

        {/* S08 (1609): Condensação Gás -> Líquido */}
        {condenseIn > 0 ? (
          <SoftIn N={N} f0={1609} dy={10}>
            <Pill
              x={555}
              y={518}
              w={445}
              h={42}
              fill={PURPLE}
              stroke={WHITE}
              sw={2}
              text={liqOut > 0.3 ? 'CONDENSAÇÃO: VIRA LÍQUIDO (ALTA PRESSÃO)' : 'GÁS ESFRIA E CONDENSA NOS TUBOS'}
              fontSize={20}
              glow={GLOW_PURPLE}
            />
          </SoftIn>
        ) : null}
      </CameraRig>
    </div>
  );
};

