import React from 'react';
import {FONT_HEAVY, FONT_ORB, FONT_TECH, clamp01} from '../../common';
import {
  CText,
  Box,
  Pill,
  Svg,
  LineArrow,
  PURPLE,
  PURPLE_LIGHT,
  ORANGE,
  CYAN,
  GREEN,
  GREY,
  GREY_MID,
  GREY_LINE,
  WHITE,
  GLOW_PURPLE,
  GLOW_ORANGE,
  abs,
  mixHex,
} from '../../ui';

/** Partículas fluindo ao longo de um segmento (x0,y0) -> (x1,y1) */
export const PipeParticles: React.FC<{
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  N: number;
  count?: number;
  color?: string;
  speed?: number;
  r?: number;
  opacity?: number;
}> = ({x0, y0, x1, y1, N, count = 5, color = CYAN, speed = 0.018, r = 5, opacity = 1}) => {
  if (opacity <= 0.01) return null;
  return (
    <g opacity={opacity}>
      {Array.from({length: count}, (_, i) => {
        const t = ((N * speed + i / count) % 1 + 1) % 1;
        const x = x0 + (x1 - x0) * t;
        const y = y0 + (y1 - y0) * t;
        return <circle key={i} cx={x} cy={y} r={r} fill={color} />;
      })}
    </g>
  );
};

/** Hélice de ventilador giratória (SVG) */
export const FanWheel: React.FC<{
  cx: number;
  cy: number;
  r: number;
  N: number;
  speed?: number;
  color?: string;
  accent?: string;
  opacity?: number;
}> = ({cx, cy, r, N, speed = 7, color = WHITE, accent = PURPLE, opacity = 1}) => {
  const angle = (N * speed) % 360;
  return (
    <g opacity={opacity}>
      <circle cx={cx} cy={cy} r={r + 8} fill="#050508" stroke={color} strokeWidth={2.5} />
      <circle cx={cx} cy={cy} r={r + 2} fill="none" stroke={GREY_LINE} strokeWidth={1.5} strokeDasharray="8 6" />
      <g transform={`translate(${cx},${cy}) rotate(${angle})`}>
        {[0, 90, 180, 270].map((deg) => (
          <path
            key={deg}
            d={`M 0,0 C ${r * 0.35},${-r * 0.28} ${r * 0.85},${-r * 0.36} ${r * 0.88},0 C ${r * 0.85},${r * 0.32} ${r * 0.35},${r * 0.22} 0,0 Z`}
            transform={`rotate(${deg})`}
            fill={accent}
            stroke={color}
            strokeWidth={2}
            opacity={0.9}
          />
        ))}
        <circle cx={0} cy={0} r={r * 0.2} fill="#000" stroke={color} strokeWidth={2.5} />
      </g>
    </g>
  );
};

/** Serpentina de tubos em zigue-zague (Evaporador ou Condensador) */
export const CoilZigZag: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  rows?: number;
  topColor: string;
  botColor: string;
  N: number;
  opacity?: number;
  fins?: number;
}> = ({x, y, w, h, rows = 5, topColor, botColor, N, opacity = 1, fins = 10}) => {
  const rowH = h / (rows - 1);
  const r = rowH / 2;
  return (
    <g opacity={opacity}>
      {/* Aletas verticais de alumínio */}
      {Array.from({length: fins}, (_, i) => {
        const fx = x + 18 + (i * (w - 36)) / Math.max(1, fins - 1);
        return <line key={i} x1={fx} y1={y - 14} x2={fx} y2={y + h + 14} stroke={GREY_LINE} strokeWidth={2} />;
      })}
      {/* Tubos horizontais + curvas */}
      {Array.from({length: rows}, (_, i) => {
        const ry = y + i * rowH;
        const c = mixHex(topColor, botColor, i / Math.max(1, rows - 1));
        const dir = i % 2 === 0 ? 1 : -1;
        return (
          <g key={i}>
            <line x1={x} y1={ry} x2={x + w} y2={ry} stroke={WHITE} strokeWidth={14} strokeLinecap="round" />
            <line x1={x} y1={ry} x2={x + w} y2={ry} stroke={c} strokeWidth={9} strokeLinecap="round" />
            <PipeParticles
              x0={dir === 1 ? x + 8 : x + w - 8}
              y0={ry}
              x1={dir === 1 ? x + w - 8 : x + 8}
              y1={ry}
              N={N}
              count={4}
              color={WHITE}
              speed={0.022}
              r={3.2}
            />
            {i < rows - 1 ? (
              <path
                d={
                  dir === 1
                    ? `M ${x + w},${ry} A ${r},${r} 0 0 1 ${x + w},${ry + rowH}`
                    : `M ${x},${ry} A ${r},${r} 0 0 0 ${x},${ry + rowH}`
                }
                fill="none"
                stroke={c}
                strokeWidth={10}
              />
            ) : null}
          </g>
        );
      })}
    </g>
  );
};

/** Card compacto para a montagem final das 4 peças (SC06) */
export const PartNodeCard: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  stepNum: string;
  title: string;
  subtitle: string;
  tempTag: string;
  accent: string;
  opacity?: number;
  glow?: string;
}> = ({x, y, w, h, stepNum, title, subtitle, tempTag, accent, opacity = 1, glow}) => (
  <Box x={x} y={y} w={w} h={h} r={14} stroke={WHITE} sw={2.5} opacity={opacity} glow={glow ?? GLOW_PURPLE}>
    <Pill
      x={16}
      y={14}
      w={46}
      h={34}
      fill={accent}
      sw={2}
      text={stepNum}
      fontSize={22}
      family={FONT_ORB}
      weight={700}
    />
    <Pill
      x={w - 134}
      y={14}
      w={118}
      h={34}
      fill="#121218"
      stroke={accent}
      sw={2}
      text={tempTag}
      fontSize={20}
      family={FONT_ORB}
      color={accent === ORANGE ? ORANGE : accent === CYAN ? CYAN : WHITE}
    />
    <CText cx={w / 2} cy={h * 0.56} size={28} weight={800} color={WHITE}>
      {title}
    </CText>
    <CText cx={w / 2} cy={h * 0.8} size={22} weight={600} color={GREY}>
      {subtitle}
    </CText>
  </Box>
);

