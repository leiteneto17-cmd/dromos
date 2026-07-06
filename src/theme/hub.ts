/**
 * Paleta do HUB — REPINTADA no rebrand claro+azul (2026-07-06, ver [[rebrand-claro-azul-2026]]).
 * Antes era roxo/verde escuro; agora fundo claro (papel), cards brancos e AZUL de acento, batendo
 * com os tokens globais (src/theme/tokens.ts). É a "pele do feed" — fixa, mas agora clara.
 *
 * Usada pelo hub (src/app/(tabs)/index.tsx) e, via `hubUI`, por estatísticas e afins.
 */
import type { UIPalette } from './ui';

export const HUB = {
  grad: ['#F6F7F2', '#F4F5F0'] as const, // fundo claro (papel/gelo)
  base: '#F4F5F0',
  hero: '#EAF2FB', // card "Lendo agora" — azul-clarinho
  cardBg: '#FFFFFF',
  cardText: '#2A2C33',
  cardMuted: '#6B7280',
  purple: '#3A9AD9', // acento (era roxo) → azul
  greenInk: '#3A9AD9', // acento de ação (era verde) → azul
  onBg: '#2A2C33', // texto sobre o fundo CLARO = tinta escura
  onBgDim: '#6B7280', // texto secundário sobre o fundo claro
  green: '#CFE4F6', // borda suave do hero (azul bem claro)
  neon: '#3A9AD9', // barra de progresso do hero → azul
  onGreen: '#FFFFFF',
  // Barras do gráfico semanal: azul (topo) → azul claro (base).
  barTop: '#3A9AD9',
  barBottom: '#B9D7EE',
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
  accentSoft: 'rgba(58,154,217,0.12)',
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
