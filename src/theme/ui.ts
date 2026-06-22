/**
 * Tema da camada SOCIAL (hub, abas, perfil, etc.) — base NEUTRA com a marca
 * roxo+verde aplicada como acento (regra 60-30-10). Isso elimina a fadiga visual
 * do fundo 100% roxo, mantendo a identidade (CLAUDE.md §2.7).
 *
 *  - 60% base:     fundo neutro (grafite no escuro / off-white no claro)
 *  - 30% camada:   cards/containers levemente elevados
 *  - 10% acento:   ROXO em detalhes (títulos de seção, ícones, abas inativas,
 *                  divisórias) e VERDE nas ações principais (CTA, ativo, conquistas)
 *
 * Obs.: o CARD COMPARTILHÁVEL e a TRILHA continuam no roxo→verde fixo
 * (src/theme/social.ts) — são artefatos de marca, não telas que cansam.
 */
export type UIMode = 'light' | 'dark';

export type UIPalette = {
  mode: UIMode;
  bg: string; // 60% — fundo geral
  card: string; // 30% — cards/containers
  cardElevated: string; // realce dentro de card
  border: string; // divisórias sutis
  text: string; // texto primário
  textDim: string; // texto secundário
  textFaint: string; // texto terciário/legendas
  purple: string; // acento de detalhe (10%)
  green: string; // acento de ação/marca (10%)
  onGreen: string; // texto sobre botão verde
};

export const UIThemes: Record<UIMode, UIPalette> = {
  // Opção 1 — Escuro minimalista (grafite com toque imperceptível de roxo)
  dark: {
    mode: 'dark',
    bg: '#121214',
    card: '#1E1B24',
    cardElevated: '#262230',
    border: '#2C2833',
    text: '#E2E2E5',
    textDim: '#B9A6E8', // lavanda — detalhe roxo
    textFaint: '#7C7689',
    purple: '#9D8AD4',
    green: '#5EF0A0',
    onGreen: '#0E0B16',
  },
  // Opção 2 — Claro off-white (limpo e leve)
  light: {
    mode: 'light',
    bg: '#F8F9FA',
    card: '#FFFFFF',
    cardElevated: '#F1F0F6',
    border: '#E6E4EC',
    text: '#1A1A1A',
    textDim: '#6E4FB0', // roxo da marca em títulos/categorias
    textFaint: '#8A8590',
    purple: '#6E4FB0',
    green: '#0FA968', // verde mais fechado p/ contraste no claro
    onGreen: '#FFFFFF',
  },
};
