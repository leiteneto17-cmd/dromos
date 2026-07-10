/**
 * Paleta do HUB — REPINTADA no rebrand claro+azul (2026-07-06) e re-hierarquizada em
 * 2026-07-09 pela regra 90-9-1 do GUIA-DE-MARCA v2 (~90% neutro · ~9% accentSoft · ~1% azul
 * pleno: 1 CTA por tela, links "›" e progresso ativo). Fundo claro (papel), cards brancos e
 * UM acento azul, batendo com os tokens globais (src/theme/tokens.ts).
 *
 * Usada pelo hub (src/app/(tabs)/index.tsx) e, via `hubUI`, por estatísticas e afins.
 */
import type { UIPalette } from './ui';

export const HUB = {
  grad: ['#F9F8F4', '#F7F6F2'] as const, // fundo claro (papel quente)
  base: '#F7F6F2',
  hero: '#EAF2FB', // card "Lendo agora" — azul-clarinho (camada accentSoft do hero)
  heroBorder: '#CFE4F6', // borda suave do hero
  cardBg: '#FFFFFF',
  cardText: '#2A2C33',
  cardMuted: '#6B7280',
  onBg: '#2A2C33', // texto sobre o fundo CLARO = tinta escura
  onBgDim: '#6B7280', // texto secundário sobre o fundo claro
  // Acento único da marca (Tokens.color.light.accent*).
  accent: '#3A9AD9', // CTA cheio, barras/anéis de progresso ativos
  accentDeep: '#2675AE', // texto azul PEQUENO (links, labels) — passa AA sobre branco
  accentSoft: '#E8F4FB', // fundo de badge/chip em destaque calmo
  onAccent: '#FFFFFF',
  // Verde = SÓ estado concluído/positivo (success dos tokens), nunca ação.
  success: '#22C55E',
  successDeep: '#16A34A', // texto verde pequeno sobre claro (AA)
  successSoft: '#E7F6EC',
  // Barras do gráfico semanal: azul (topo) → azul claro (base).
  barTop: '#3A9AD9',
  barBottom: '#B9D7EE',
};

/**
 * Mesmo "skin" do hub, mas no formato `UIPalette` — assim as telas-aba podem trocar
 * `useUI()` por esta constante e o `c.text`/`c.card`/`c.accent` existente resolve para o
 * claro+azul do hub sem reescrever cada cor. As chaves legadas `green`/`purple` apontam
 * para o acento azul (compat, como em ui.ts).
 *
 * As cores são pensadas para conteúdo DENTRO de cards brancos. Texto colocado direto
 * sobre o fundo claro usa `HUB.onBg` / `HUB.onBgDim` explicitamente.
 */
export const hubUI: UIPalette = {
  mode: 'light',
  bg: HUB.base,
  surface: HUB.cardBg,
  surfaceAlt: '#EFF1F0',
  border: '#E9ECEA',
  text: HUB.cardText,
  textSecondary: HUB.cardMuted,
  accent: HUB.accent,
  accentHover: HUB.accent,
  accentPressed: HUB.accentDeep,
  accentSoft: 'rgba(58,154,217,0.12)',
  onAccent: HUB.onAccent,
  success: HUB.success,
  warning: '#F59E0B',
  danger: '#EF4444',
  disabled: '#D1D5DB',
  focus: HUB.accent,
  // legadas
  card: HUB.cardBg,
  cardElevated: '#EFF1F0',
  textDim: HUB.cardMuted,
  textFaint: HUB.cardMuted,
  purple: HUB.accent,
  green: HUB.accent,
  onGreen: HUB.onAccent,
};
