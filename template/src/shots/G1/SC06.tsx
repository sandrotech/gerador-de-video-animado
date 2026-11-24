import React from 'react';
import {useCurrentFrame} from 'remotion';
import {GlitchIn, clamp01} from '../../common';
import {
  CText,
  Box,
  Pill,
  TagBlock,
  Svg,
  LineArrow,
  Check,
  SoftIn,
  PURPLE,
  PURPLE_LIGHT,
  ORANGE,
  CYAN,
  GREEN,
  WHITE,
  GLOW_PURPLE,
  firstOp,
  glowOffK,
  slideUp,
} from '../../ui';
import {HeroGlow, HaloRing, StageLine, CameraRig} from '../../fx';
import {PartNodeCard, PipeParticles} from './ac_parts';

/**
 * SC06 (2171–2545): Montagem Completa das 4 Peças em Circuito Fechado + "Agora você sabe como montar um ar-condicionado!"
 * S11 (2179–2396): 2179 Conecte evaporador, compressor | 2247 condensador e válvula em um circuito fechado | 2331 e o calor sai do quarto sem parar
 * S12 (2407–2533): 2407 Pronto! | 2446 Agora você sabe como montar | 2497 um ar-condicionado!
 */
const F0 = 2171;
const TO = 2545;

export const SC06: React.FC = () => {
  const N = useCurrentFrame() + F0;
  const n = N - F0;
  const op = firstOp(n, 8);
  const gk = glowOffK(N, TO);

  const topPairIn = clamp01((N - 2175) / 20);
  const botPairIn = clamp01((N - 2244) / 22);
  const loopRun = clamp01((N - 2325) / 22);
  const finaleIn = clamp01((N - 2407) / 18);

  return (
    <div style={{position: 'absolute', inset: 0, opacity: op}}>
      <CameraRig
        N={N}
        keys={[
          {f: F0, x: 640, y: 360, s: 1},
          {f: 2407, x: 640, y: 360, s: 1},
          {f: 2450, x: 640, y: 365, s: 1.05},
        ]}
      >
        {/* Divisão Quarto (Esquerda) vs Rua (Direita) */}
        <Box x={85} y={180} w={480} h={420} r={18} fill="rgba(10,16,28,0.55)" stroke={CYAN} sw={2} dashed opacity={0.85} />
        <CText cx={325} cy={204} size={22} weight={700} color={CYAN}>
          UNIDADE INTERNA (QUARTO · 20°C)
        </CText>

        <Box x={715} y={180} w={480} h={420} r={18} fill="rgba(28,12,10,0.55)" stroke={ORANGE} sw={2} dashed opacity={0.85} />
        <CText cx={955} cy={204} size={22} weight={700} color={ORANGE}>
          UNIDADE EXTERNA (RUA · EXPULSA CALOR)
        </CText>

        {/* As 4 Peças Conectadas */}
        {topPairIn > 0 ? (
          <div style={{transform: `translateY(${slideUp(n, 120, 20)}px)`, opacity: topPairIn}}>
            <PartNodeCard
              x={125}
              y={230}
              w={400}
              h={145}
              stepNum="01"
              title="EVAPORADOR"
              subtitle="Suga o calor do quarto"
              tempTag="20°C FRESCO"
              accent={CYAN}
            />
            <PartNodeCard
              x={755}
              y={230}
              w={400}
              h={145}
              stepNum="02"
              title="COMPRESSOR"
              subtitle="Aperta e esquenta o gás"
              tempTag="65°C QUENTE"
              accent={ORANGE}
            />
          </div>
        ) : null}

        {botPairIn > 0 ? (
          <div style={{transform: `translateY(${slideUp(Math.max(0, N - 2244), 120, 20)}px)`, opacity: botPairIn}}>
            <PartNodeCard
              x={755}
              y={430}
              w={400}
              h={145}
              stepNum="03"
              title="CONDENSADOR"
              subtitle="Ventoinha joga calor na rua"
              tempTag="40°C LÍQUIDO"
              accent={PURPLE}
            />
            <PartNodeCard
              x={125}
              y={430}
              w={400}
              h={145}
              stepNum="04"
              title="VÁLVULA DE EXPANSÃO"
              subtitle="Efeito spray congela o fluido"
              tempTag="-5°C GELADO"
              accent={CYAN}
            />
          </div>
        ) : null}

        {/* Tubos Conectando o Circuito Fechado Completo */}
        <Svg>
          {/* 1 -> 2 (Topo: Evaporador -> Compressor) */}
          <LineArrow x0={530} y0={302} x1={750} y1={302} p={topPairIn} rodW={6} color={CYAN} />
          {/* 2 -> 3 (Direita: Compressor -> Condensador) */}
          <LineArrow x0={955} y0={380} x1={955} y1={425} p={botPairIn} rodW={6} color={ORANGE} />
          {/* 3 -> 4 (Base: Condensador -> Válvula) */}
          <LineArrow x0={750} y0={502} x1={530} y1={502} p={botPairIn} rodW={6} color={PURPLE_LIGHT} />
          {/* 4 -> 1 (Esquerda: Válvula -> Evaporador) */}
          <LineArrow x0={325} y0={425} x1={325} y1={380} p={botPairIn} rodW={6} color={CYAN} />

          {/* Partículas circulando em todo o ciclo fechado */}
          {loopRun > 0 ? (
            <>
              <PipeParticles x0={530} y0={302} x1={745} y1={302} N={N} count={4} color={CYAN} speed={0.025} r={5} opacity={loopRun} />
              <PipeParticles x0={955} y0={380} x1={955} y1={425} N={N} count={2} color={ORANGE} speed={0.025} r={5} opacity={loopRun} />
              <PipeParticles x0={745} y0={502} x1={530} y1={502} N={N} count={4} color={PURPLE_LIGHT} speed={0.025} r={5} opacity={loopRun} />
              <PipeParticles x0={325} y0={425} x1={325} y1={380} N={N} count={2} color={CYAN} speed={0.025} r={5} opacity={loopRun} />
            </>
          ) : null}
        </Svg>

        {/* S12 (2407–2533): Fechamento Heroico "AGORA VOCÊ SABE COMO MONTAR UM AR-CONDICIONADO!" */}
        {N >= 2407 ? (
          <>
            <StageLine N={N} f0={2407} flashAt={2446} cx={640} cy={400} w={920} h={4} />
            <HaloRing cx={640} cy={475} rxo={380} ryo={68} rxi={270} ryi={38} p={finaleIn} fillOp={0.85 * gk} phase={Math.floor((N - 2407) / 2) * 5} />
            <HeroGlow x={210} y={325} w={860} h={155} r={22} N={N} k={gk} />
            <GlitchIn N={N} f0={2442} rgbSplit={5} slices={12}>
              <Box x={210} y={325} w={860} h={155} r={22} fill="#080614" stroke={WHITE} sw={3.5} glow={GLOW_PURPLE}>
                <TagBlock x={280} y={-26} w={300} h={46} color={PURPLE} text="CICLO COMPLETO!" fontSize={26} />
                <CText cx={430} cy={62} size={36} weight={900} color={WHITE}>
                  AGORA VOCÊ SABE COMO MONTAR
                </CText>
                <CText cx={430} cy={114} size={44} weight={900} color={CYAN}>
                  UM AR-CONDICIONADO!
                </CText>
              </Box>
            </GlitchIn>
            <Svg>
              <Check cx={265} cy={402} size={46} color={GREEN} p={clamp01((N - 2460) / 16)} />
              <Check cx={1015} cy={402} size={46} color={GREEN} p={clamp01((N - 2466) / 16)} />
            </Svg>
          </>
        ) : null}
      </CameraRig>
    </div>
  );
};

