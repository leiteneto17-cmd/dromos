/**
 * Preços de EXIBIÇÃO do Premium — FONTE ÚNICA (CLAUDE.md §6 / [[monetizacao-planos]]).
 *
 * Por que existe: os valores estavam hardcoded espalhados (perfil, paywall, premium-lock…)
 * e desincronizaram (umas telas com R$4,90, outras com R$5,90). Centralizar aqui garante
 * que "mudar o preço" seja UMA edição. ⚠️ Estes são valores de REFERÊNCIA/fallback — quando
 * o RevenueCat está ativo, o preço REAL vem localizado da loja (services/purchases.ts). Só
 * são exibidos enquanto a loja não responde (Expo Go / fase de teste).
 *
 * Valor oficial (decisão do usuário 2026-07-06): Mensal R$ 5,90 · Anual R$ 59,90.
 */
export const PRICE_MONTHLY_LABEL = 'R$ 5,90';
export const PRICE_YEARLY_LABEL = 'R$ 59,90';

/** Custo mensal EQUIVALENTE do plano anual (59,90 / 12 ≈ 4,99) — usado como isca de valor. */
export const PRICE_YEARLY_PER_MONTH_LABEL = 'R$ 4,99';

/** Sufixo curto pronto p/ chamadas de conversão (ex.: "✨ Seja Premium · R$ 5,90/mês"). */
export const PRICE_MONTHLY_SUFFIX = `${PRICE_MONTHLY_LABEL}/mês`;

/** Preços de referência por ciclo (fallback quando a loja não respondeu). */
export const PRICE_FALLBACK = { mensal: PRICE_MONTHLY_LABEL, anual: PRICE_YEARLY_LABEL } as const;
