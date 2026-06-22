/**
 * Temas de leitura (estilo Kindle) — escolhidos manualmente pelo usuário,
 * independentes do modo claro/escuro do sistema.
 * Ver diretrizes em CLAUDE.md (§2.5 UI limpa estilo Kindle, §4.5 tipografia).
 */

export type ReadingThemeName = 'claro' | 'sepia' | 'escuro';

export type ReadingPalette = {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  accent: string;
  border: string;
  /** Fundo de realce das palavras marcadas (efeito marca-texto). */
  highlight: string;
};

export const ReadingThemes: Record<ReadingThemeName, ReadingPalette> = {
  claro: {
    background: '#FAF9F6',
    surface: '#FFFFFF',
    text: '#1A1A1A',
    textSecondary: '#6B6B6B',
    accent: '#C0653A',
    border: '#E6E3DC',
    highlight: '#FCE39A',
  },
  sepia: {
    background: '#F4ECD8',
    surface: '#EFE6CE',
    text: '#3A2F22',
    textSecondary: '#7A6A52',
    accent: '#B5651D',
    border: '#E0D4B8',
    highlight: '#E2C173',
  },
  escuro: {
    background: '#121212',
    surface: '#1C1C1C',
    text: '#D9D4CC',
    textSecondary: '#8A857C',
    accent: '#D8843B',
    border: '#2A2A2A',
    highlight: '#4A3D1A',
  },
};

export const ReadingThemeOrder: ReadingThemeName[] = ['claro', 'sepia', 'escuro'];

export const ReadingThemeLabel: Record<ReadingThemeName, string> = {
  claro: 'Claro',
  sepia: 'Sépia',
  escuro: 'Escuro',
};

export const FontSizeRange = { min: 14, max: 28, step: 2, default: 19 } as const;

/** Entrelinha confortável para leitura longa. */
export const LineHeightRatio = 1.6;
