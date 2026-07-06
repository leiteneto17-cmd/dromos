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
  // Fundo = gradiente da MARCA (roxo→preto), não mais verde (GUIA-DE-MARCA §3: verde é ACENTO,
  // não fundo). Bate com Social.purpleTop→purpleMid→dark. Repintura 2026-07-04.
  grad: ['#3B2A63', '#241B3D', '#0E0B16'] as const, // roxo profundo → quase preto
  base: '#241B3D', // fallback do gradiente (roxo médio)
  hero: '#5B4FA6', // roxo do card de leitura
  cardBg: '#FFFFFF',
  cardText: '#1A1A1A',
  cardMuted: '#6B7280',
  purple: '#6E4FB0',
  greenInk: '#0FA968', // verde para texto/acento sobre branco
  onBg: '#FFFFFF', // texto sobre o fundo escuro
  onBgDim: '#B9A6E8', // texto secundário sobre o fundo (lavanda da marca)
  green: '#5EF0A0', // verde-menta (barra do hero)
  neon: '#5EF0A0', // verde da MARCA p/ ação/barra ativa (era #3DFF85 puro, fora da paleta)
  onGreen: '#0E0B16',
  // Barras do gráfico semanal: gradiente ROXO na base → VERDE-MENTA no topo (da marca).
  barTop: '#5EF0A0',
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
// NOTA (rebrand 2026-07-06): o hub ainda usa a pele antiga (roxo+verde) — será migrado para
// claro+azul num próximo incremento. Por ora satisfaz a UIPalette nova sem mudar o visual.
export const hubUI: UIPalette = {
  mode: 'light',
  bg: HUB.base,
  surface: HUB.cardBg,
  surfaceAlt: '#EFF1F0',
  border: '#E9ECEA',
  text: HUB.cardText,
  textSecondary: HUB.cardMuted,
  accent: HUB.greenInk,
  accentHover: HUB.greenInk,
  accentPressed: HUB.greenInk,
  accentSoft: 'rgba(15,169,104,0.12)',
  onAccent: '#FFFFFF',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  disabled: '#D1D5DB',
  focus: HUB.greenInk,
  // legadas
  card: HUB.cardBg,
  cardElevated: '#EFF1F0',
  textDim: HUB.purple,
  textFaint: HUB.cardMuted,
  purple: HUB.purple,
  green: HUB.greenInk,
  onGreen: '#FFFFFF',
};
