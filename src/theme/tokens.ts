/**
 * DESIGN TOKENS globais do Dromos — fonte única de verdade da nova identidade (rebrand
 * 2026-07-06: claro + azul, aposentando o roxo+verde neon). Inspiração: Fluent Design +
 * Material 3 + Apple HIG + leitores (Kindle/Apple Books/Kobo). Foco: conforto para leitura longa.
 *
 * Camadas de uso:
 *  - `Tokens.color.light` / `.dark` → papéis semânticos (bg/surface/accent/success/…).
 *  - `Tokens.space` / `.radius` / `.shadow` / `.motion` / `.type` → escalas reutilizáveis.
 * O tema ativo (src/theme/ui.ts) monta a `UIPalette` a partir daqui, então TODA tela que usa
 * `useUI()` adota a nova identidade sem reescrita (migração incremental por cima disso).
 */

/** Paleta bruta (não usar direto na UI — use os papéis semânticos abaixo). */
const raw = {
  ice: '#F7F6F2', // fundo papel (light) — tom QUENTE (refino 2026-07-10, era #F4F5F0 mais frio)
  white: '#FFFFFF',
  gray50: '#F8F9FA',
  gray100: '#F1F2F4',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  ink: '#2A2C33',
  // accent azul (Fluent-ish)
  blue: '#3A9AD9',
  blueHover: '#2E88C6',
  bluePressed: '#2675AE',
  blueSoft: '#E8F4FB',
  // status
  green: '#22C55E',
  amber: '#F59E0B',
  red: '#EF4444',
  // dark surfaces
  d_bg: '#16181D',
  d_surface: '#1E2127',
  d_surfaceAlt: '#262A32',
  d_border: '#2E333D',
  d_text: '#E7E9EE',
  d_textSec: '#9AA3B2',
  d_blue: '#4AA9E6',
} as const;

export type ColorRoles = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textSecondary: string;
  textFaint: string;
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
};

export const Tokens = {
  color: {
    light: {
      bg: raw.ice,
      surface: raw.white,
      surfaceAlt: raw.gray100,
      border: raw.gray200,
      text: raw.ink,
      textSecondary: raw.gray500,
      textFaint: raw.gray400,
      accent: raw.blue,
      accentHover: raw.blueHover,
      accentPressed: raw.bluePressed,
      accentSoft: raw.blueSoft,
      onAccent: raw.white,
      success: raw.green,
      warning: raw.amber,
      danger: raw.red,
      disabled: raw.gray300,
      focus: raw.blue,
    } satisfies ColorRoles,
    dark: {
      bg: raw.d_bg,
      surface: raw.d_surface,
      surfaceAlt: raw.d_surfaceAlt,
      border: raw.d_border,
      text: raw.d_text,
      textSecondary: raw.d_textSec,
      textFaint: '#6C7482',
      accent: raw.d_blue,
      accentHover: '#5FB4EC',
      accentPressed: '#3D97D6',
      accentSoft: 'rgba(74,169,230,0.16)',
      onAccent: '#0B0E13',
      success: '#34D27B',
      warning: raw.amber,
      danger: '#F87171',
      disabled: '#3A414D',
      focus: raw.d_blue,
    } satisfies ColorRoles,
  },

  /** Escala de espaçamento (múltiplos de 4). */
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },

  /** Raios dos componentes (arredondamento moderno). */
  radius: { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 },

  /** Movimento — 150–250ms com easing moderno (Material/Fluent "standard"). */
  motion: {
    fast: 150,
    base: 200,
    slow: 250,
    easing: 'cubic-bezier(0.2, 0, 0, 1)', // p/ Reanimated/Easing.bezier(0.2,0,0,1)
    easingIn: 'cubic-bezier(0.4, 0, 1, 1)',
  },

  /** Tipografia (tamanhos + alturas de linha confortáveis p/ leitura). */
  type: {
    display: { size: 28, line: 34, weight: '800' as const },
    title: { size: 22, line: 28, weight: '800' as const },
    heading: { size: 18, line: 24, weight: '700' as const },
    body: { size: 15, line: 22, weight: '400' as const },
    label: { size: 14, line: 20, weight: '600' as const },
    caption: { size: 12, line: 16, weight: '500' as const },
  },
} as const;

/**
 * Sombras suaves em múltiplas camadas (Fluent/Material elevation). RN só aceita UMA sombra por
 * View no iOS, então aproximamos com raio/opacidade calibrados + `elevation` no Android.
 * `mode` ajusta a cor (sombra some no escuro; usamos borda/realce lá).
 */
export function shadow(level: 1 | 2 | 3, mode: 'light' | 'dark' = 'light') {
  if (mode === 'dark') return { shadowColor: 'transparent', elevation: 0 } as const;
  const map = {
    1: { radius: 8, opacity: 0.06, y: 2, elevation: 2 },
    2: { radius: 16, opacity: 0.08, y: 6, elevation: 5 },
    3: { radius: 28, opacity: 0.12, y: 12, elevation: 10 },
  } as const;
  const s = map[level];
  return {
    shadowColor: '#0B1220',
    shadowOpacity: s.opacity,
    shadowRadius: s.radius,
    shadowOffset: { width: 0, height: s.y },
    elevation: s.elevation,
  } as const;
}
