/**
 * Tema ATIVO da UI (retornado por `useUI()`), montado a partir dos DESIGN TOKENS globais
 * (src/theme/tokens.ts). Rebrand 2026-07-06: identidade CLARA + AZUL (§2.7 atualizado),
 * inspirada em Fluent/Material 3/Apple HIG e leitores, com foco em conforto de leitura longa.
 *
 * COMPAT (migração incremental, sem breaking changes): as chaves legadas continuam existindo —
 * `green`/`purple` agora apontam para o AZUL de acento, então toda tela que já lê `c.green`
 * (CTA) ou `c.purple` (detalhe) adota o novo visual sem reescrita. Telas migradas passam a usar
 * os papéis semânticos novos (`accent`, `success`, `danger`, `surface`, …).
 */
import { Tokens } from '@/theme/tokens';

export type UIMode = 'light' | 'dark';

export type UIPalette = {
  mode: UIMode;
  // --- Papéis semânticos (novos — preferir nas telas migradas) ---
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textSecondary: string;
  accent: string;
  accentHover: string;
  accentPressed: string;
  accentSoft: string;
  onAccent: string;
  success: string;
  warning: string;
  danger: string;
  disabled: string;
  focus: string;
  // --- Chaves LEGADAS (mantidas p/ não quebrar telas ainda não migradas) ---
  card: string; // = surface
  cardElevated: string; // = surfaceAlt
  textDim: string; // = textSecondary
  textFaint: string;
  purple: string; // = accent (detalhe) — o roxo foi aposentado
  green: string; // = accent (ação) — o verde de marca foi aposentado
  onGreen: string; // = onAccent
};

function build(mode: UIMode): UIPalette {
  const c = Tokens.color[mode];
  return {
    mode,
    bg: c.bg,
    surface: c.surface,
    surfaceAlt: c.surfaceAlt,
    border: c.border,
    text: c.text,
    textSecondary: c.textSecondary,
    accent: c.accent,
    accentHover: c.accentHover,
    accentPressed: c.accentPressed,
    accentSoft: c.accentSoft,
    onAccent: c.onAccent,
    success: c.success,
    warning: c.warning,
    danger: c.danger,
    disabled: c.disabled,
    focus: c.focus,
    // legadas
    card: c.surface,
    cardElevated: c.surfaceAlt,
    textDim: c.textSecondary,
    textFaint: c.textFaint,
    purple: c.accent,
    green: c.accent,
    onGreen: c.onAccent,
  };
}

export const UIThemes: Record<UIMode, UIPalette> = {
  light: build('light'),
  dark: build('dark'),
};
