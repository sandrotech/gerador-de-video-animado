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
import {HeroGlow, CameraRig} from '../../fx';
import {CoilZigZag, FanWheel, PipeParticles} from './ac_parts';

/**
 * SC02 (501–921): Peça 1 — O Evaporador e a Turbina Interna (y175–620 por causa da Rail no topo)
 * S03 (509–675): 509 Primeira peça: o evaporador | 573 grade de tubos gelados | 621 na parede do seu quarto
 * S04 (686–899): 686 turbina puxa ar a 32 graus | 771 fluido ferve roubando calor | 827 devolve brisa fresca a 20 graus
 */
const F0 = 501;
const TO = 921;

export const SC02: React.FC = () => {
  const N = useCurrentFrame() + F0;
  const n = N - F0;
  const op = firstOp(n, 8) * exitOp(N, TO, 8);
  const gk = glowOffK(N, TO);

  const coilIn = clamp01((N - 565) / 22);
  const fanIn = clamp01((N - 618) / 20);
  const hotAirIn = clamp01((N - 684) / 22);
  const boilIn = clamp01((N - 768) / 22);
  const coldAirIn = clamp01((N - 824) / 22);

  return (
    <div style={{position: 'absolute', inset: 0, opacity: op}}>
      <CameraRig
        N={N}
        keys={[
          {f: F0, x: 640, y: 360, s: 1},
          {f: 760, x: 640, y: 375, s: 1.06},
        ]}
      >
        {/* Gabinete Principal da Unidade Interna (Split) */}
        <div style={{transform: `translateY(${slideUp(n, 180, 22)}px)`}}>
          <HeroGlow x={250} y={205} w={780} h={370} r={22} N={N} k={gk} />
          <Box x={250} y={205} w={780} h={370} r={22} stroke={WHITE} sw={3}>
            <GlitchIn N={N} f0={509} rgbSplit={4}>
              <Pill x={26} y={20} w={340} h={42} fill={PURPLE} sw={2} text="PEÇA 1 · EVAPORADOR" fontSize={26} />
            </GlitchIn>
            {N >= 620 ? (
              <SoftIn N={N} f0={620} dy={8}>
                <Pill x={384} y={20} w={368} h={42} fill="#161622" stroke={PURPLE_LIGHT} sw={2} text="UNIDADE INTERNA (NO QUARTO)" fontSize={22} />
              </SoftIn>
            ) : null}
          </Box>
        </div>

        {/* Grade de Tubos Gelados (Serpentina Evaporadora) + Turbina */}
        <Svg>
          {coilIn > 0 ? (
            <CoilZigZag
              x={310}
              y={300}
              w={390}
              h={180}
              rows={5}
              topColor={CYAN}
              botColor={PURPLE_LIGHT}
              N={N}
              opacity={coilIn}
              fins={12}
            />
          ) : null}

          {fanIn > 0 ? (
            <FanWheel cx={865} cy={390} r={78} N={N} speed={9} accent={PURPLE} opacity={fanIn} />
          ) : null}

          {/* S04 (686): Ar quente 32°C entrando pela esquerda/topo */}
          {hotAirIn > 0 ? (
            <>
              <LineArrow x0={110} y0={285} x1={290} y1={325} p={hotAirIn} rodW={6} color={ORANGE} />
              <LineArrow x0={110} y0={365} x1={290} y1={390} p={hotAirIn} rodW={6} color={ORANGE} />
              <PipeParticles x0={110} y0={325} x1={290} y1={360} N={N} count={5} color={ORANGE} speed={0.025} r={5} opacity={hotAirIn} />
            </>
          ) : null}

          {/* S04 (827): Brisa fresca 20°C saindo pela direita */}
          {coldAirIn > 0 ? (
            <>
              <LineArrow x0={975} y0={355} x1={1175} y1={325} p={coldAirIn} rodW={6} color={CYAN} />
              <LineArrow x0={975} y0={425} x1={1175} y1={455} p={coldAirIn} rodW={6} color={CYAN} />
              <PipeParticles x0={975} y0={390} x1={1175} y1={390} N={N} count={6} color={CYAN} speed={0.028} r={5} opacity={coldAirIn} />
            </>
          ) : null}
        </Svg>

        {fanIn > 0.3 ? (
          <CText cx={865} cy={505} size={23} weight={700} color={WHITE} opacity={fanIn}>
            TURBINA INTERNA
          </CText>
        ) : null}

        {/* Rótulo Ar Quente 32°C */}
        {hotAirIn > 0.2 ? (
          <SoftIn N={N} f0={686} dy={10}>
            <Box x={68} y={405} w={165} h={105} r={12} stroke={ORANGE} sw={2.5}>
              <CText cx={82} cy={38} size={38} family={FONT_ORB} weight={700} color={ORANGE}>
                32°C
              </CText>
              <CText cx={82} cy={78} size={22} weight={700} color={WHITE}>
                AR ABAFADO
              </CText>
            </Box>
          </SoftIn>
        ) : null}

        {/* S04 (771): Fluido ferve roubando calor */}
        {boilIn > 0 ? (
          <SoftIn N={N} f0={770} dy={12}>
            <Pill
              x={315}
              y={512}
              w={390}
              h={40}
              fill={PURPLE}
              stroke={CYAN}
              sw={2}
              text="FLUIDO FERVE (LÍQUIDO → GÁS) E SUGA CALOR"
              fontSize={20}
              glow={GLOW_PURPLE}
            />
          </SoftIn>
        ) : null}

        {/* S04 (827): Devolve brisa fresca a 20°C */}
        {coldAirIn > 0.2 ? (
          <SoftIn N={N} f0={827} dy={10}>
            <Box x={1048} y={205} w={175} h={105} r={12} stroke={CYAN} sw={2.5} glow={GLOW_PURPLE}>
              <CText cx={87} cy={38} size={38} family={FONT_ORB} weight={700} color={CYAN}>
                20°C
              </CText>
              <CText cx={87} cy={78} size={22} weight={700} color={WHITE}>
                BRISA FRESCA
              </CText>
            </Box>
          </SoftIn>
        ) : null}
      </CameraRig>
    </div>
  );
};

