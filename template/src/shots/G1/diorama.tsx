import React from 'react';
import {FONT_HEAVY, FONT_ORB, clamp01} from '../../common';

/**
 * Biblioteca visual 2.5D/3D Cartoon Diorama inspirada no modelo @desmontandoomundo (1080×1920 vertical 9:16).
 */

/** Letreiro Amarelo 3D com borda preta grossa e leve inclinação (ex: "EVAPORADOR", "FERVE A -50 °C") */
export const YellowLabel3D: React.FC<{
  cx: number;
  cy: number;
  text: string;
  size?: number;
  tilt?: number;
  scale?: number;
  opacity?: number;
}> = ({cx, cy, text, size = 44, tilt = -3, scale = 1, opacity = 1}) => {
  if (opacity <= 0.01) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: cx,
        top: cy,
        transform: `translate(-50%, -50%) rotate(${tilt}deg) scale(${scale})`,
        fontFamily: FONT_HEAVY,
        fontWeight: 900,
        fontSize: size,
        color: '#FFD833',
        letterSpacing: 1.5,
        whiteSpace: 'nowrap',
        WebkitTextStroke: '10px #1C1309',
        paintOrder: 'stroke fill',
        filter: 'drop-shadow(0 6px 0 #1C1309) drop-shadow(0 10px 16px rgba(0,0,0,0.38))',
        opacity,
        zIndex: 30,
      }}
    >
      {text}
    </div>
  );
};

/** Pílula branca de status com bolinha colorida (ex: "• QUARTO: 30 °C", "• +70 °C", "• ESPREMIDO") */
export const StatusPillBadge: React.FC<{
  cx: number;
  cy: number;
  text: string;
  dotColor?: string;
  size?: number;
  scale?: number;
  opacity?: number;
}> = ({cx, cy, text, dotColor = '#FF5733', size = 30, scale = 1, opacity = 1}) => {
  if (opacity <= 0.01) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: cx,
        top: cy,
        transform: `translate(-50%, -50%) scale(${scale})`,
        background: '#FFFFFF',
        border: '3.5px solid #1E1E1E',
        borderRadius: 999,
        padding: '8px 22px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: '0 6px 0 rgba(0,0,0,0.22), 0 10px 20px rgba(0,0,0,0.25)',
        opacity,
        whiteSpace: 'nowrap',
        zIndex: 28,
      }}
    >
      <span
        style={{
          width: size * 0.52,
          height: size * 0.52,
          borderRadius: '50%',
          background: dotColor,
          display: 'inline-block',
          boxShadow: `0 0 8px ${dotColor}`,
        }}
      />
      <span
        style={{
          fontFamily: FONT_HEAVY,
          fontWeight: 900,
          fontSize: size,
          color: '#181818',
          letterSpacing: 0.5,
        }}
      >
        {text}
      </span>
    </div>
  );
};

/** Seta Curva Tracejada Amarela com Contorno Preto (estilo @desmontandoomundo para mostrar ciclo fechado) */
export const CurvedDashedArrow2D: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  arcHeight?: number;
  progress?: number;
  opacity?: number;
  dashOffset?: number;
}> = ({x1, y1, x2, y2, arcHeight = 180, progress = 1, opacity = 1, dashOffset = 0}) => {
  if (opacity <= 0.01 || progress <= 0.01) return null;
  const mx = (x1 + x2) * 0.5;
  const my = Math.min(y1, y2) - arcHeight;
  const d = `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
  // Ângulo da tangente final da curva de Bézier quadrática (de (mx,my) para (x2,y2))
  const angleDeg = (Math.atan2(y2 - my, x2 - mx) * 180) / Math.PI;
  return (
    <svg
      width={1080}
      height={1920}
      viewBox="0 0 1080 1920"
      style={{position: 'absolute', inset: 0, pointerEvents: 'none', opacity, zIndex: 26}}
    >
      {/* Contorno preto grosso */}
      <path
        d={d}
        fill="none"
        stroke="#141414"
        strokeWidth={22}
        strokeLinecap="round"
        strokeDasharray="24 22"
        strokeDashoffset={-dashOffset}
      />
      {/* Miolo amarelo vibrante */}
      <path
        d={d}
        fill="none"
        stroke="#FFE135"
        strokeWidth={12}
        strokeLinecap="round"
        strokeDasharray="24 22"
        strokeDashoffset={-dashOffset}
      />
      {/* Ponta da seta com contorno preto e preenchimento amarelo */}
      <g transform={`translate(${x2}, ${y2}) rotate(${angleDeg})`}>
        <polygon
          points="-32,-22 14,0 -32,22 -22,0"
          fill="#FFE135"
          stroke="#141414"
          strokeWidth={6}
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
};

/** Card de Velocímetro Animado ("VELOCIDADE" — estilo @desmontandoomundo para explicar o Inverter) */
export const SpeedometerGaugeCard: React.FC<{
  cx: number;
  cy: number;
  needleValue: number; // 0 (lento/verde) .. 1 (máximo/vermelho)
  scale?: number;
  opacity?: number;
}> = ({cx, cy, needleValue, scale = 1, opacity = 1}) => {
  if (opacity <= 0.01) return null;
  const clamped = Math.max(0, Math.min(1, needleValue));
  const deg = -90 + clamped * 180; // -90° (esquerda) a +90° (direita)
  return (
    <div
      style={{
        position: 'absolute',
        left: cx,
        top: cy,
        width: 230,
        height: 158,
        transform: `translate(-50%, -50%) scale(${scale})`,
        background: '#FFFFFF',
        border: '5px solid #141414',
        borderRadius: 22,
        boxShadow: '0 8px 0 rgba(0,0,0,0.25), 0 14px 24px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
        zIndex: 29,
      }}
    >
      <svg width={190} height={105} viewBox="0 0 190 105" style={{overflow: 'visible'}}>
        {/* Arco Verde (Baixa velocidade / economia) */}
        <path
          d="M 25 90 A 70 70 0 0 1 65 27"
          fill="none"
          stroke="#22C55E"
          strokeWidth={18}
          strokeLinecap="round"
        />
        {/* Arco Amarelo (Média velocidade) */}
        <path
          d="M 67 26 A 70 70 0 0 1 123 26"
          fill="none"
          stroke="#FACC15"
          strokeWidth={18}
        />
        {/* Arco Vermelho (Alta velocidade / gasto) */}
        <path
          d="M 125 27 A 70 70 0 0 1 165 90"
          fill="none"
          stroke="#EF4444"
          strokeWidth={18}
          strokeLinecap="round"
        />
        {/* Ponteiro */}
        <g transform={`translate(95, 88) rotate(${deg})`}>
          <polygon points="-5,0 0,-60 5,0" fill="#181818" />
          <polygon points="-3,-42 0,-62 3,-42" fill="#EF4444" />
          <circle cx={0} cy={0} r={9} fill="#181818" />
        </g>
      </svg>
      <div
        style={{
          fontFamily: FONT_HEAVY,
          fontWeight: 900,
          fontSize: 22,
          color: '#141414',
          letterSpacing: 1,
          marginTop: -4,
        }}
      >
        VELOCIDADE
      </div>
    </div>
  );
};

/** Display Digital do Termostato ("23°C") fixado ao lado do evaporador */
export const ThermostatBadge2D: React.FC<{
  cx: number;
  cy: number;
  tempText?: string;
  scale?: number;
  opacity?: number;
}> = ({cx, cy, tempText = '23°', scale = 1, opacity = 1}) => {
  if (opacity <= 0.01) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: cx,
        top: cy,
        transform: `translate(-50%, -50%) scale(${scale})`,
        background: '#0F172A',
        border: '4px solid #CBD5E1',
        borderRadius: 12,
        padding: '6px 14px',
        boxShadow: '0 6px 14px rgba(0,0,0,0.35)',
        opacity,
        zIndex: 28,
      }}
    >
      <span
        style={{
          fontFamily: FONT_ORB,
          fontWeight: 900,
          fontSize: 26,
          color: '#38BDF8',
          textShadow: '0 0 8px rgba(56,189,248,0.8)',
        }}
      >
        {tempText}
      </span>
    </div>
  );
};


/** Fundo 2.5D da Sala de Estar (1080×1920) */
export const LivingRoomBg: React.FC<{N: number; clockFast?: boolean; zoom?: number}> = ({N, clockFast = false}) => {
  const minAngle = clockFast ? N * 22 : N * 1.2;
  const hourAngle = clockFast ? N * 3.5 : 65 + N * 0.1;
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: '#EDE3D2'}}>
      {/* Teto / Sanca de madeira */}
      <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 110, background: '#C59B6D', borderBottom: '8px solid #A47B4F'}} />

      {/* Janela Esquerda com Céu, Árvores e Cerquinha */}
      <div
        style={{
          position: 'absolute',
          left: 48,
          top: 290,
          width: 260,
          height: 440,
          background: '#87CEFA',
          border: '14px solid #F5F2EB',
          borderRadius: 8,
          boxShadow: 'inset 0 0 20px rgba(0,0,0,0.12), 8px 12px 0 rgba(0,0,0,0.08)',
          overflow: 'hidden',
        }}
      >
        {/* Gramado lá fora */}
        <div style={{position: 'absolute', left: 0, bottom: 0, width: 260, height: 150, background: '#68B42E'}} />
        {/* Árvores low-poly na janela */}
        <svg width={260} height={440} style={{position: 'absolute', left: 0, top: 0}}>
          <polygon points="65,150 15,280 115,280" fill="#2E8B22" />
          <polygon points="185,120 120,290 250,290" fill="#399E2D" />
          {/* Cerquinha branca */}
          {[15, 55, 95, 135, 175, 215].map((x) => (
            <rect key={x} x={x} y={255} width={22} height={65} rx={4} fill="#FFF" />
          ))}
          <rect x={0} y={275} width={260} height={10} fill="#EAEAEA" />
          {/* Divisórias da janela */}
          <rect x={120} y={0} width={12} height={440} fill="#F5F2EB" />
          <rect x={0} y={210} width={260} height={12} fill="#F5F2EB" />
        </svg>
      </div>

      {/* Relógio de Parede */}
      <svg width={130} height={130} style={{position: 'absolute', left: 345, top: 245}}>
        <circle cx={65} cy={65} r={54} fill="#FFF" stroke="#2B1D12" strokeWidth={9} />
        {Array.from({length: 12}, (_, i) => {
          const a = (i * 30 * Math.PI) / 180;
          return (
            <line
              key={i}
              x1={65 + Math.cos(a) * 38}
              y1={65 + Math.sin(a) * 38}
              x2={65 + Math.cos(a) * 45}
              y2={65 + Math.sin(a) * 45}
              stroke="#2B1D12"
              strokeWidth={3}
            />
          );
        })}
        <line
          x1={65}
          y1={65}
          x2={65 + Math.cos(((hourAngle - 90) * Math.PI) / 180) * 26}
          y2={65 + Math.sin(((hourAngle - 90) * Math.PI) / 180) * 26}
          stroke="#2B1D12"
          strokeWidth={5}
          strokeLinecap="round"
        />
        <line
          x1={65}
          y1={65}
          x2={65 + Math.cos(((minAngle - 90) * Math.PI) / 180) * 38}
          y2={65 + Math.sin(((minAngle - 90) * Math.PI) / 180) * 38}
          stroke="#D9381E"
          strokeWidth={4}
          strokeLinecap="round"
        />
        <circle cx={65} cy={65} r={5} fill="#2B1D12" />
      </svg>

      {/* Quadro de Montanha na Parede */}
      <div
        style={{
          position: 'absolute',
          left: 500,
          top: 345,
          width: 175,
          height: 125,
          background: '#D8F0FA',
          border: '10px solid #6E4726',
          borderRadius: 6,
          boxShadow: '0 8px 0 rgba(0,0,0,0.12)',
          overflow: 'hidden',
        }}
      >
        <svg width={160} height={110}>
          <polygon points="45,25 5,105 90,105" fill="#2E8B22" />
          <polygon points="110,40 60,105 155,105" fill="#3FA632" />
        </svg>
      </div>

      {/* Rodapé + Piso de Madeira */}
      <div style={{position: 'absolute', left: 0, top: 1095, width: 1080, height: 26, background: '#D7C7B2', borderTop: '4px solid #BDA992'}} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 1120,
          width: 1080,
          height: 800,
          background: 'linear-gradient(180deg, #C68E59 0%, #A9713E 100%)',
        }}
      >
        {/* Linhas das tábuas do piso e tapete */}
        <svg width={1080} height={800}>
          {[90, 210, 350, 510, 680].map((y) => (
            <line key={y} x1={0} y1={y} x2={1080} y2={y} stroke="#8C5828" strokeWidth={3} opacity={0.55} />
          ))}
          {/* Tapete terracota no centro */}
          <polygon points="310,60 880,60 980,760 180,760" fill="#DE8C4E" stroke="#F3C187" strokeWidth={10} opacity={0.85} />
        </svg>
      </div>
    </div>
  );
};

/** Personagem sentado na Poltrona Verde (esquerda da sala) */
export const CharacterInArmchair: React.FC<{
  x?: number;
  y?: number;
  scale?: number;
  N: number;
  mode?: 'hot' | 'cool' | 'freezing';
}> = ({x = 55, y = 695, scale = 1, N, mode = 'hot'}) => {
  const bob = Math.sin(N * 0.15) * 4;
  return (
    <div style={{position: 'absolute', left: x, top: y, transform: `scale(${scale})`, transformOrigin: '0 0'}}>
      <svg width={380} height={520} style={{overflow: 'visible'}}>
        {/* Sombra no chão */}
        <ellipse cx={185} cy={470} rx={155} ry={34} fill="rgba(0,0,0,0.22)" />
        {/* Encosto da Poltrona Verde */}
        <rect x={35} y={85} width={220} height={260} rx={36} fill="#0F8B74" stroke="#095E4E" strokeWidth={5} />
        {/* Assento e Braços da Poltrona */}
        <rect x={45} y={280} width={260} height={95} rx={24} fill="#14A88B" stroke="#095E4E" strokeWidth={5} />
        <rect x={15} y={210} width={65} height={175} rx={24} fill="#0C7662" stroke="#095E4E" strokeWidth={5} />
        <rect x={235} y={210} width={65} height={175} rx={24} fill="#17BA9B" stroke="#095E4E" strokeWidth={5} />
        {/* Pés da poltrona */}
        <rect x={45} y={375} width={22} height={70} rx={6} fill="#5C3A1E" />
        <rect x={255} y={375} width={22} height={70} rx={6} fill="#5C3A1E" />

        {/* Corpo do Personagem (Camiseta Amarela + Bermuda Azul) */}
        <g transform={`translate(0, ${bob})`}>
          {/* Pernas */}
          <rect x={145} y={310} width={36} height={120} rx={14} fill="#F2C18D" />
          <rect x={200} y={310} width={36} height={120} rx={14} fill="#F2C18D" />
          {/* Chinelos azuis */}
          <ellipse cx={165} cy={438} rx={26} ry={12} fill="#1E66D0" />
          <ellipse cx={220} cy={438} rx={26} ry={12} fill="#1E66D0" />
          {/* Bermuda */}
          <rect x={130} y={265} width={115} height={60} rx={14} fill="#2563EB" />
          {/* Tronco (Camiseta Amarela) */}
          <rect x={122} y={145} width={120} height={135} rx={26} fill="#FACC15" stroke="#CA8A04" strokeWidth={3} />
          {/* Braços */}
          <rect x={95} y={160} width={34} height={95} rx={16} fill="#F2C18D" transform="rotate(14 112 160)" />
          <rect x={232} y={160} width={34} height={95} rx={16} fill="#F2C18D" transform="rotate(-12 248 160)" />
          {/* Cabeça */}
          <circle cx={182} cy={95} r={46} fill="#F5C693" />
          {/* Cabelo Castanho */}
          <path d="M 136,88 C 136,44 228,44 228,88 C 210,70 155,70 136,88 Z" fill="#4A2C18" />
          {/* Olhos e Boca */}
          <circle cx={168} cy={92} r={5} fill="#1E1E1E" />
          <circle cx={198} cy={92} r={5} fill="#1E1E1E" />
          {mode === 'hot' ? (
            <>
              {/* Boca ofegante + gotas de suor */}
              <ellipse cx={184} cy={114} rx={10} ry={7} fill="#991B1B" />
              <circle cx={142} cy={78 + ((N * 2) % 24)} r={5} fill="#38BDF8" />
              <circle cx={222} cy={84 + ((N * 2 + 12) % 24)} r={5} fill="#38BDF8" />
            </>
          ) : (
            <>
              {/* Sorriso aliviado */}
              <path d="M 168,110 Q 184,124 200,110" fill="none" stroke="#1E1E1E" strokeWidth={4} strokeLinecap="round" />
            </>
          )}
        </g>
      </svg>
    </div>
  );
};

/** Banquinho de Madeira Redondo 3D */
export const WoodenStool: React.FC<{cx: number; cy: number; scale?: number}> = ({cx, cy, scale = 1}) => (
  <div style={{position: 'absolute', left: cx, top: cy, transform: `translate(-50%, -50%) scale(${scale})`}}>
    <svg width={360} height={420} style={{overflow: 'visible'}}>
      <ellipse cx={180} cy={380} rx={135} ry={28} fill="rgba(0,0,0,0.24)" />
      {/* 4 Pernas de madeira */}
      <line x1={95} y1={95} x2={65} y2={375} stroke="#7A4921" strokeWidth={22} strokeLinecap="round" />
      <line x1={145} y1={105} x2={135} y2={395} stroke="#8D5629" strokeWidth={22} strokeLinecap="round" />
      <line x1={215} y1={105} x2={225} y2={395} stroke="#8D5629" strokeWidth={22} strokeLinecap="round" />
      <line x1={265} y1={95} x2={295} y2={375} stroke="#7A4921" strokeWidth={22} strokeLinecap="round" />
      {/* Assento redondo 3D */}
      <ellipse cx={180} cy={92} rx={138} ry={42} fill="#7C4A21" />
      <ellipse cx={180} cy={76} rx={138} ry={42} fill="#B87A44" stroke="#6B3E19" strokeWidth={4} />
    </svg>
  </div>
);

/** Balde de Gelo em cima do banquinho (derrete com meltProgress 0 -> 1) */
export const IceBucketOnStool: React.FC<{cx: number; cy: number; meltProgress: number; N: number}> = ({cx, cy, meltProgress, N}) => {
  const m = clamp01(meltProgress);
  return (
    <div style={{position: 'absolute', left: cx, top: cy, transform: 'translate(-50%, -50%)'}}>
      <svg width={340} height={360} style={{overflow: 'visible'}}>
        {/* Corpo do balde metálico escuro */}
        <polygon points="55,95 285,95 250,305 90,305" fill="#5A5853" stroke="#363532" strokeWidth={5} />
        <ellipse cx={170} cy={305} rx={80} ry={24} fill="#484642" stroke="#363532" strokeWidth={4} />
        {/* Interior do balde */}
        <ellipse cx={170} cy={95} rx={115} ry={36} fill="#3E3D3A" stroke="#222" strokeWidth={5} />
        {/* Água morna subindo conforme derrete */}
        <ellipse cx={170} cy={102} rx={104} ry={28} fill={m > 0.4 ? '#5B9BD5' : '#A6D8FF'} opacity={0.85} />
        {/* Cubos de gelo (encolhem quando m -> 1) */}
        {m < 0.92 ? (
          <g transform={`translate(170, 96) scale(${1 - m * 0.78}) translate(-170, -96)`}>
            <rect x={105} y={68} width={44} height={38} rx={6} fill="#F0F9FF" stroke="#BAE6FD" strokeWidth={3} transform="rotate(-12 125 85)" />
            <rect x={152} y={62} width={48} height={42} rx={6} fill="#E0F2FE" stroke="#BAE6FD" strokeWidth={3} transform="rotate(8 175 82)" />
            <rect x={195} y={72} width={42} height={36} rx={6} fill="#F0F9FF" stroke="#BAE6FD" strokeWidth={3} transform="rotate(-6 215 90)" />
            <rect x={130} y={82} width={46} height={36} rx={6} fill="#FFF" stroke="#BAE6FD" strokeWidth={3} transform="rotate(15 150 98)" />
          </g>
        ) : null}
        {/* Alça preta do balde */}
        <path d="M 52,95 A 118,110 0 0 1 288,95" fill="none" stroke="#222" strokeWidth={10} strokeLinecap="round" />
        {/* Listras de vento cruzando o balde */}
        {Array.from({length: 5}, (_, i) => {
          const off = ((N * 12 + i * 55) % 280) - 40;
          const col = m > 0.55 ? '#F59E0B' : '#38BDF8';
          return (
            <line
              key={i}
              x1={300 - off}
              y1={80 + i * 32}
              x2={230 - off}
              y2={95 + i * 32}
              stroke={col}
              strokeWidth={7}
              strokeLinecap="round"
              opacity={0.85}
            />
          );
        })}
      </svg>
    </div>
  );
};

/** Cilindro Transparente com Tampa Rosa ("FERVE A -50 °C / FLUIDO REFRIGERANTE") */
export const RefrigerantTankPink: React.FC<{cx: number; cy: number; N: number; scale?: number}> = ({cx, cy, N, scale = 1}) => (
  <div style={{position: 'absolute', left: cx, top: cy, transform: `translate(-50%, -50%) scale(${scale})`}}>
    <svg width={260} height={360} style={{overflow: 'visible'}}>
      {/* Base rosa */}
      <ellipse cx={130} cy={305} rx={78} ry={22} fill="#D6336C" stroke="#9C1D4B" strokeWidth={4} />
      {/* Corpo de vidro transparente com líquido azul borbulhando */}
      <rect x={52} y={75} width={156} height={230} fill="rgba(186,230,253,0.42)" stroke="#94A3B8" strokeWidth={4} />
      <rect x={56} y={145} width={148} height={158} fill="rgba(56,189,248,0.55)" />
      {/* Bolhas brancas de fervura a -50°C */}
      {Array.from({length: 7}, (_, i) => {
        const by = 285 - (((N * 4.5 + i * 31) % 195));
        const bx = 82 + ((i * 37) % 96);
        const r = 10 + (i % 3) * 5;
        return <circle key={i} cx={bx} cy={by} r={r} fill="#FFFFFF" opacity={0.88} />;
      })}
      {/* Tampa rosa superior */}
      <ellipse cx={130} cy={75} rx={82} ry={24} fill="#E64980" stroke="#A61E4D" strokeWidth={4} />
      <ellipse cx={130} cy={58} rx={48} ry={14} fill="#F06595" stroke="#A61E4D" strokeWidth={4} />
    </svg>
  </div>
);

/** Serpentina Espiral de Cobre Transparente com Bolinhas Azuis/Laranjas + Chaminé de Vapor ou Retorno Fechado */
export const CopperSpiralEvaporator: React.FC<{
  cx: number;
  cy: number;
  N: number;
  scale?: number;
  openSteam?: boolean;
  showValve?: boolean;
  drippingWater?: boolean;
}> = ({cx, cy, N, scale = 1, openSteam = false, showValve = false, drippingWater = false}) => (
  <div style={{position: 'absolute', left: cx, top: cy, transform: `translate(-50%, -50%) scale(${scale})`}}>
    <svg width={460} height={460} style={{overflow: 'visible'}}>
      {/* Bandeja metálica sobre o banquinho */}
      <polygon points="35,315 415,315 385,342 65,342" fill="#94A3B8" stroke="#475569" strokeWidth={4} />

      {/* 5 Espiras de Cobre Transparente */}
      {[0, 1, 2, 3, 4].map((loopIdx) => {
        const lx = 95 + loopIdx * 56;
        return (
          <g key={loopIdx}>
            {/* Arco traseiro da espira */}
            <ellipse cx={lx} cy={205} rx={36} ry={108} fill="none" stroke="#B46535" strokeWidth={24} opacity={0.65} />
            <ellipse cx={lx} cy={205} rx={36} ry={108} fill="none" stroke="#F4A261" strokeWidth={16} opacity={0.55} />
            {/* Bolinhas circulando dentro da espira */}
            {Array.from({length: 6}, (_, bi) => {
              const a = ((N * 0.055 + bi / 6 + loopIdx * 0.12) % 1) * Math.PI * 2;
              const bx = lx + Math.cos(a) * 36;
              const by = 205 + Math.sin(a) * 108;
              // Esquerda mais laranja/quente ou direita mais azul/gelada
              const isCold = loopIdx >= 2 || Math.sin(a) > 0;
              return (
                <circle
                  key={bi}
                  cx={bx}
                  cy={by}
                  r={8.5}
                  fill={isCold ? '#3B82F6' : '#F97316'}
                  stroke="#FFF"
                  strokeWidth={1.5}
                />
              );
            })}
          </g>
        );
      })}

      {/* Chaminé saindo vapor branco (quando openSteam=true na Cena 2) */}
      {openSteam ? (
        <g>
          <rect x={78} y={40} width={28} height={70} rx={6} fill="#C87541" stroke="#7C3F18" strokeWidth={4} />
          {Array.from({length: 6}, (_, i) => {
            const p = ((N * 2.8 + i * 28) % 160) / 160;
            const sy = 35 - p * 190;
            const sx = 92 + Math.sin(N * 0.1 + i) * (18 + p * 25);
            const sr = 18 + p * 34;
            return <circle key={i} cx={sx} cy={sy} r={sr} fill="#F8FAFC" opacity={(1 - p) * 0.88} />;
          })}
        </g>
      ) : null}

      {/* Válvula de Expansão dourada ("furinho") na direita quando showValve=true */}
      {showValve ? (
        <g>
          {/* Tubo vindo de fora (apertado com bolinhas laranjas) */}
          <rect x={372} y={250} width={28} height={155} fill="#D98A4E" stroke="#7C3F18" strokeWidth={3} />
          {/* Peça de latão estranguladora (Válvula de Expansão) */}
          <rect x={364} y={295} width={44} height={24} rx={4} fill="#D97706" stroke="#78350F" strokeWidth={3} />
          <rect x={375} y={319} width={22} height={22} fill="#B45309" stroke="#78350F" strokeWidth={3} />
          <rect x={364} y={341} width={44} height={24} rx={4} fill="#D97706" stroke="#78350F" strokeWidth={3} />
        </g>
      ) : null}

      {/* Gotinhas de condensação pingando quando drippingWater=true */}
      {drippingWater
        ? Array.from({length: 5}, (_, i) => {
            const dy = 320 + ((N * 4 + i * 24) % 95);
            const dx = 115 + i * 52;
            return <circle key={i} cx={dx} cy={dy} r={7} fill="#38BDF8" />;
          })
        : null}
    </svg>
  </div>
);

/** Ventilador de Pedestal Branco à direita da sala */
export const PedestalFanWhite: React.FC<{
  cx: number;
  cy: number;
  N: number;
  scale?: number;
  windColor?: 'warm' | 'cold';
}> = ({cx, cy, N, scale = 1, windColor = 'warm'}) => {
  const spin = (N * 18) % 360;
  const streakCol = windColor === 'cold' ? '#38BDF8' : '#FB923C';
  return (
    <div style={{position: 'absolute', left: cx, top: cy, transform: `translate(-50%, -50%) scale(${scale})`}}>
      <svg width={320} height={640} style={{overflow: 'visible'}}>
        {/* Sombra e Base Branca */}
        <ellipse cx={170} cy={590} rx={105} ry={26} fill="rgba(0,0,0,0.18)" />
        <ellipse cx={170} cy={575} rx={98} ry={24} fill="#F8FAFC" stroke="#CBD5E1" strokeWidth={5} />
        {/* Haste vertical */}
        <rect x={158} y={250} width={24} height={325} rx={10} fill="#E2E8F0" stroke="#94A3B8" strokeWidth={3} />
        {/* Grade e Hélice Giratória */}
        <circle cx={165} cy={185} r={108} fill="rgba(255,255,255,0.45)" stroke="#CBD5E1" strokeWidth={7} />
        <g transform={`translate(165, 185) rotate(${spin})`}>
          {[0, 90, 180, 270].map((d) => (
            <ellipse key={d} cx={0} cy={-52} rx={24} ry={44} fill="#93C5FD" stroke="#3B82F6" strokeWidth={3} transform={`rotate(${d})`} />
          ))}
          <circle cx={0} cy={0} r={20} fill="#E2E8F0" stroke="#64748B" strokeWidth={4} />
        </g>
        {/* Listras de vento sopradas para a esquerda (em direção ao sofá) */}
        {Array.from({length: 6}, (_, i) => {
          const prog = ((N * 14 + i * 65) % 420);
          const x0 = 90 - prog;
          const y0 = 110 + i * 32;
          return (
            <g key={i} opacity={clamp01(1 - prog / 420)}>
              <line x1={x0} y1={y0} x2={x0 + 75} y2={y0 + 8} stroke={streakCol} strokeWidth={6} strokeLinecap="round" />
              <circle cx={x0 - 15} cy={y0} r={8} fill={streakCol} />
            </g>
          );
        })}
      </svg>
    </div>
  );
};

/** Fundo do Quintal Externo (Parede externa, grama verde, cerquinha branca e árvores) */
export const BackyardOutdoorBg: React.FC = () => (
  <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: '#7CC0FF'}}>
    {/* Nuvens no céu */}
    <svg width={1080} height={600} style={{position: 'absolute', left: 0, top: 0}}>
      <ellipse cx={280} cy={120} rx={95} ry={42} fill="#F8FAFC" />
      <ellipse cx={350} cy={115} rx={75} ry={36} fill="#FFFFFF" />
      <ellipse cx={780} cy={150} rx={110} ry={45} fill="#F8FAFC" />
    </svg>
    {/* Gramado verde */}
    <div style={{position: 'absolute', left: 0, top: 520, width: 1080, height: 1400, background: 'linear-gradient(180deg, #6BB330 0%, #4D8B1F 100%)'}} />
    {/* Árvores low-poly ao fundo */}
    <svg width={1080} height={700} style={{position: 'absolute', left: 0, top: 140}}>
      {[460, 680, 920].map((tx, i) => (
        <g key={tx}>
          <rect x={tx - 16} y={240} width={32} height={130} fill="#6B4226" />
          <polygon points={`${tx},55 ${tx - 95},255 ${tx + 95},255`} fill={i % 2 === 0 ? '#2E8B22' : '#399E2D'} />
        </g>
      ))}
      {/* Cerquinha branca */}
      {Array.from({length: 14}, (_, i) => (
        <rect key={i} x={380 + i * 52} y={310} width={32} height={140} rx={6} fill="#F8FAFC" stroke="#CBD5E1" strokeWidth={2} />
      ))}
      <rect x={370} y={345} width={710} height={16} fill="#E2E8F0" />
      <rect x={370} y={405} width={710} height={16} fill="#E2E8F0" />
    </svg>
    {/* Parede externa da casa à esquerda em perspectiva */}
    <polygon style={{position: 'absolute'}} />
    <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0}}>
      <polygon points="0,0 420,0 420,1080 0,1320" fill="#D5B895" stroke="#A68966" strokeWidth={6} />
      {[160, 320, 480, 640, 800, 960].map((y) => (
        <line key={y} x1={0} y1={y + 120} x2={420} y2={y} stroke="#B89974" strokeWidth={4} />
      ))}
      {/* Base de concreto no chão */}
      <polygon points="210,1150 960,1270 840,1520 110,1360" fill="#94A3B8" stroke="#64748B" strokeWidth={6} />
    </svg>
  </div>
);

/** Compressor Preto + Bomba de Pneu Vermelha + Grade do Condensador no Quintal */
export const OutdoorCompressorAndCondenser: React.FC<{
  N: number;
  showPump?: boolean;
  showCondenser?: boolean;
  hotLevel?: number;
}> = ({N, showPump = false, showCondenser = false, hotLevel = 1}) => {
  const pumpStroke = Math.sin(N * 0.35) * 42;
  const fanSpin = (N * 16) % 360;
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
      {/* Tubo vindo da parede da casa (gás frio azul entrando no compressor) */}
      <path d="M 220,980 L 340,1040" fill="none" stroke="#C87541" strokeWidth={24} strokeLinecap="round" />
      <circle cx={260 + ((N * 3) % 70)} cy={1000 + ((N * 1.5) % 35)} r={8} fill="#38BDF8" />

      {/* Corpo Preto do Compressor */}
      <g transform="translate(310, 815)">
        <ellipse cx={95} cy={385} rx={92} ry={28} fill="#0F172A" />
        <rect x={22} y={75} width={146} height={300} rx={68} fill="#1E293B" stroke="#0F172A" strokeWidth={6} />
        {/* Etiqueta amarela lateral */}
        <rect x={44} y={195} width={38} height={58} rx={4} fill="#FACC15" />
        {/* Tubo superior saindo gás superquente (+70°C, bolinhas vermelhas/laranjas) */}
        <path d="M 95,75 Q 95,15 165,35 L 225,95" fill="none" stroke="#C87541" strokeWidth={26} strokeLinecap="round" />
        {Array.from({length: 5}, (_, i) => {
          const t = ((N * 0.04 + i / 5) % 1);
          return <circle key={i} cx={105 + t * 110} cy={45 + t * 45} r={9} fill={hotLevel > 0.3 ? '#EF4444' : '#38BDF8'} stroke="#FFF" strokeWidth={1.5} />;
        })}
      </g>

      {/* Bomba de Pneu Vermelha ao lado do Compressor */}
      {showPump ? (
        <g transform="translate(520, 875)">
          <ellipse cx={60} cy={390} rx={55} ry={18} fill="#1E293B" />
          {/* Haste + Manopla subindo e descendo */}
          <rect x={52} y={45 + pumpStroke} width={16} height={150} fill="#CBD5E1" />
          <rect x={8} y={32 + pumpStroke} width={104} height={24} rx={10} fill="#1E293B" />
          {/* Cilindro vermelho da bomba */}
          <rect x={34} y={145} width={52} height={240} rx={12} fill="#EF4444" stroke="#B91C1C" strokeWidth={4} />
          {/* Mangueirinha ligada ao compressor */}
          <path d="M 34,355 Q -25,365 -55,315" fill="none" stroke="#1E293B" strokeWidth={10} />
        </g>
      ) : null}

      {/* Grade do Condensador + Ventilador Externo soprando calor para a grama */}
      {showCondenser ? (
        <g transform="translate(530, 860)">
          {/* Ventilador escuro atrás da grade */}
          <circle cx={230} cy={225} r={140} fill="rgba(15,23,42,0.38)" stroke="#475569" strokeWidth={5} />
          <g transform={`translate(230, 225) rotate(${fanSpin})`}>
            {[0, 90, 180, 270].map((d) => (
              <ellipse key={d} cx={0} cy={-75} rx={32} ry={62} fill="#334155" transform={`rotate(${d})`} />
            ))}
          </g>

          {/* Postes cinzas de suporte */}
          <rect x={15} y={40} width={22} height={380} fill="#64748B" />
          <rect x={435} y={60} width={22} height={380} fill="#64748B" />

          {/* 5 Tubos Horizontais de Cobre da Grade Condensadora */}
          {[0, 1, 2, 3, 4].map((r) => {
            const ry = 85 + r * 68;
            return (
              <g key={r}>
                <line x1={25} y1={ry} x2={445} y2={ry + 18} stroke="#C87541" strokeWidth={22} strokeLinecap="round" />
                {Array.from({length: 7}, (_, bi) => {
                  const p = ((N * 0.035 + bi / 7) % 1);
                  const bx = r % 2 === 0 ? 35 + p * 395 : 430 - p * 395;
                  const by = ry + (bx - 25) * (18 / 420);
                  const col = r < 2 ? '#EF4444' : r < 4 ? '#F97316' : '#F59E0B';
                  return <circle key={bi} cx={bx} cy={by} r={7.5} fill={col} stroke="#FFF" strokeWidth={1.2} />;
                })}
              </g>
            );
          })}

          {/* Listras vermelhas/laranjas de calor sendo expulsas na grama */}
          {Array.from({length: 8}, (_, i) => {
            const prog = ((N * 10 + i * 38) % 260);
            const sx = 80 + i * 48;
            const sy = 380 + prog;
            return (
              <line
                key={i}
                x1={sx}
                y1={sy}
                x2={sx - 18}
                y2={sy + 42}
                stroke="#EF4444"
                strokeWidth={7}
                strokeLinecap="round"
                opacity={clamp01(1 - prog / 260)}
              />
            );
          })}
        </g>
      ) : null}
    </svg>
  );
};

/** Corte Transversal da Casa Inteira (Sala à Esquerda + Parede + Quintal à Direita) */
export const HouseCutawayFull: React.FC<{
  N: number;
  finishedCasing?: boolean;
}> = ({N, finishedCasing = false}) => (
  <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: '#7CC0FF'}}>
    {/* Céu + Nuvens */}
    <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0}}>
      <ellipse cx={250} cy={220} rx={120} ry={48} fill="#F8FAFC" />
      <ellipse cx={780} cy={240} rx={140} ry={52} fill="#F8FAFC" />

      {/* Gramado e Subsolo */}
      <rect x={0} y={1180} width={1080} height={160} fill="#68B42E" />
      <rect x={0} y={1340} width={1080} height={580} fill="#8B5A2B" />

      {/* Telhado e Estrutura da Casa (Esquerda x=30..680) */}
      <polygon points="10,640 355,410 700,640" fill="#7C4722" stroke="#5A3216" strokeWidth={8} />
      <polygon points="45,640 355,440 665,640" fill="#EDE3D2" />
      {/* Sala de Estar */}
      <rect x={45} y={640} width={620} height={580} fill="#EDE3D2" stroke="#D5C7B2" strokeWidth={12} />
      <rect x={45} y={1160} width={620} height={60} fill="#B87A44" />

      {/* Poltrona e Personagem miniatura na Sala */}
      <rect x={75} y={980} width={115} height={165} rx={18} fill="#0F8B74" />
      <circle cx={135} cy={955} r={24} fill="#F5C693" />
      <rect x={115} y={980} width={44} height={65} rx={10} fill="#FACC15" />

      {!finishedCasing ? (
        <>
          {/* Serpentina no banquinho + Ventilador + Tubo atravessando a parede até o Compressor/Condensador */}
          <rect x={320} y={1040} width={95} height={120} fill="#94A3B8" opacity={0.4} />
          {/* Espiras de cobre */}
          {[0, 1, 2, 3].map((i) => (
            <ellipse key={i} cx={335 + i * 20} cy={1015} rx={14} ry={42} fill="none" stroke="#C87541" strokeWidth={8} />
          ))}
          {/* Tubo atravessando a parede para o quintal */}
          <path d="M 415,1035 L 780,1035 L 780,1135 L 335,1135 L 335,1055" fill="none" stroke="#C87541" strokeWidth={12} />
          {/* Bolinhas azuis/laranjas correndo no circuito fechado */}
          {Array.from({length: 8}, (_, i) => {
            const p = ((N * 0.03 + i / 8) % 1);
            const x = 340 + p * 430;
            return (
              <g key={i}>
                <circle cx={x} cy={1035} r={6} fill="#38BDF8" />
                <circle cx={770 - p * 430} cy={1135} r={6} fill="#F97316" />
              </g>
            );
          })}
          {/* Compressor preto lá fora */}
          <rect x={745} y={1025} width={64} height={125} rx={28} fill="#1E293B" />
          {/* Grade Condensadora lá fora */}
          <rect x={835} y={1015} width={155} height={135} fill="none" stroke="#C87541" strokeWidth={10} />
        </>
      ) : (
        <>
          {/* AR-CONDICIONADO MONTADO COM CARENAGEM BRANCA! */}
          {/* Split Interno Branco no alto da parede da sala */}
          <rect x={355} y={735} width={235} height={78} rx={16} fill="#FFFFFF" stroke="#CBD5E1" strokeWidth={5} />
          <line x1={375} y1={795} x2={570} y2={795} stroke="#94A3B8" strokeWidth={4} />
          {/* Brisa azul saindo do Split para o personagem no sofá */}
          {Array.from({length: 5}, (_, i) => {
            const p = ((N * 8 + i * 45) % 220);
            return (
              <line
                key={i}
                x1={380 - p}
                y1={815 + i * 24 + p * 0.35}
                x2={435 - p}
                y2={800 + i * 24 + p * 0.35}
                stroke="#38BDF8"
                strokeWidth={6}
                strokeLinecap="round"
              />
            );
          })}
          {/* Caixa Condensadora Externa Branca no quintal */}
          <rect x={735} y={995} width={210} height={165} rx={14} fill="#F8FAFC" stroke="#CBD5E1" strokeWidth={5} />
          <circle cx={815} cy={1078} r={56} fill="#334155" stroke="#94A3B8" strokeWidth={5} />
          <circle cx={815} cy={1078} r={22} fill="#C87541" />
        </>
      )}
    </svg>
  </div>
);

