import React from 'react';
import {FONT_HEAVY} from '../../common';
import {STECH_BRAND} from '../../brand';

export type ProcessStep = {
  id: string;
  shortLabel: string;
  statusBadge: string;
  detail: string;
  accent: string;
};

/**
 * Componente 100% reutilizável de Demonstração Viva de Fluxo de Software.
 * Pode ser reaproveitado em qualquer nicho da Mini Produtora (Restaurante, Clínica,
 * Oficina, Estoque/ERP, WhatsApp CRM) apenas trocando o array `steps` e `ticketTitle`.
 */
export const LiveProcessCard: React.FC<{
  steps: ProcessStep[];
  activeIndex: number;
  headerTitle?: string;
  ticketTitle: string;
  opacity: number;
  scale?: number;
  top?: number;
  left?: number;
  width?: number;
}> = ({
  steps,
  activeIndex,
  headerTitle = 'STECH • FLUXO EM TEMPO REAL',
  ticketTitle,
  opacity,
  scale = 1,
  top = 345,
  left = 72,
  width = 852,
}) => {
  if (opacity <= 0.01) return null;
  const clampedIdx = Math.max(0, Math.min(steps.length - 1, activeIndex));
  const cur = steps[clampedIdx];

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width,
        transform: `scale(${scale})`,
        transformOrigin: 'top center',
        opacity,
        background: 'rgba(255, 255, 255, 0.97)',
        borderRadius: 24,
        border: `3px solid ${STECH_BRAND.colors.navy}`,
        boxShadow: '0 12px 28px rgba(11, 31, 58, 0.28)',
        overflow: 'hidden',
        zIndex: 36,
        fontFamily: FONT_HEAVY,
      }}
    >
      {/* Barra superior do sistema */}
      <div
        style={{
          background: STECH_BRAND.colors.navy,
          padding: '12px 20px',
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{color: '#FFFFFF', fontSize: 20, fontWeight: 900, letterSpacing: 0.6}}>
          {headerTitle}
        </span>
        <span
          style={{
            background: cur.accent,
            color: cur.accent === '#FACC15' ? '#0B1F3A' : '#FFFFFF',
            fontSize: 18,
            fontWeight: 900,
            padding: '5px 14px',
            borderRadius: 999,
          }}
        >
          {cur.statusBadge}
        </span>
      </div>

      {/* Stepper de 4 etapas conectado */}
      <div
        style={{
          padding: '14px 18px 10px 18px',
          display: 'flex',
          flexDirection: 'row',
          gap: 10,
          alignItems: 'center',
        }}
      >
        {steps.map((s, idx) => {
          const isDone = idx < clampedIdx;
          const isActive = idx === clampedIdx;
          return (
            <div
              key={s.id}
              style={{
                flex: 1,
                background: isActive ? cur.accent : isDone ? '#ECFDF5' : '#F1F5F9',
                border: `2px solid ${isActive ? cur.accent : isDone ? '#10B981' : '#CBD5E1'}`,
                borderRadius: 12,
                padding: '8px 6px',
                textAlign: 'center',
                color: isActive
                  ? cur.accent === '#FACC15'
                    ? '#0B1F3A'
                    : '#FFFFFF'
                  : isDone
                    ? '#047857'
                    : '#64748B',
                fontSize: 17,
                fontWeight: 900,
                whiteSpace: 'nowrap',
              }}
            >
              {isDone ? `✓ ${s.shortLabel}` : `${idx + 1}. ${s.shortLabel}`}
            </div>
          );
        })}
      </div>

      {/* Detalhe vivo do registro/pedido atual */}
      <div
        style={{
          margin: '4px 18px 14px 18px',
          background: '#F8FAFC',
          border: '2px solid #E2E8F0',
          borderLeft: `7px solid ${cur.accent}`,
          borderRadius: 14,
          padding: '10px 16px',
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span style={{color: STECH_BRAND.colors.navyDark, fontSize: 22, fontWeight: 900}}>
          {ticketTitle}
        </span>
        <span style={{color: '#334155', fontSize: 20, fontWeight: 700, textAlign: 'right'}}>
          {cur.detail}
        </span>
      </div>
    </div>
  );
};
