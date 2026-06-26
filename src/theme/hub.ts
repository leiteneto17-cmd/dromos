/**
 * Paleta do HUB (verde clean + cards brancos), fiel à imagem aprovada
 * (image_75a1a1.jpg). É a "pele do feed" — fixa, NÃO segue claro/escuro.
 *
 * Usada pelo hub (src/app/(tabs)/index.tsx) e, via `hubUI`, pelas demais
 * abas sociais (Atividades, Comunidade, Perfil) para ficarem consistentes
 * com o hub em vez do tema neutro claro/escuro (CLAUDE.md §2.7).
 */
import type { UIPalette } from './ui';

export const HUB = {
  grad: ['#2C7E5E', '#1F6147', '#1B4F3D'] as const, // verde vibrante → mais fechado
  base: '#1F6147', // verde sólido (fallback do gradiente)
  hero: '#5B4FA6', // roxo do card de leitura
  cardBg: '#FFFFFF',
  cardText: '#1A1A1A',
  cardMuted: '#6B7280',
  purple: '#6E4FB0',
  greenInk: '#0FA968', // verde para texto/acento sobre branco
  onBg: '#FFFFFF', // texto sobre o fundo verde
  onBgDim: '#CFEFDD', // texto secundário sobre o verde
  green: '#5EF0A0', // verde-menta (barra do hero)
  neon: '#3DFF85', // verde-NEON p/ ação/barra ativa (com glow) — design system 2026
  onGreen: '#0E2A1E',
  // Barras do gráfico semanal: gradiente ROXO na base → VERDE-NEON no topo (guia 2026).
  barTop: '#3DFF85',
  barBottom: '#6E4FB0',
};

/**
 * Mesmo "skin" do hub, mas no formato `UIPalette` — assim as telas-aba podem
 * trocar `useUI()` por esta constante e todo o `c.text`/`c.card`/`c.green`
 * existente passa a resolver para o verde+branco do hub, sem reescrever cada cor.
 *
 * As cores são pensadas para conteúdo DENTRO de cards brancos. Texto colocado
 * direto sobre o fundo verde deve usar `HUB.onBg` / `HUB.onBgDim` explicitamente.
 */
export const hubUI: UIPalette = {
  mode: 'light',
  bg: HUB.base,
  card: HUB.cardBg,
  cardElevated: '#EFF1F0',
  border: '#E9ECEA',
  text: HUB.cardText,
  textDim: HUB.purple,
  textFaint: HUB.cardMuted,
  purple: HUB.purple,
  green: HUB.greenInk,
  onGreen: '#FFFFFF',
};
