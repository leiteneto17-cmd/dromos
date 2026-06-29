/**
 * Plano do usuário (Zustand) — base do GATING de monetização (CLAUDE.md §6 / [[monetizacao-planos]]).
 *
 * Hoje NÃO há enforcement real: o paywall/RevenueCat é Fase 4. Este store existe para que
 * os recursos que dependem de plano (a começar pelos ANÚNCIOS do tier grátis) já consultem
 * uma fonte única de verdade. Quando o RevenueCat entrar, ele só passa a chamar `setPlan`
 * com o que a loja confirmou — o resto do app não muda.
 *
 * Mapeamento (decisão 2026-06-26):
 *   - 'free'   → grátis COM anúncios;
 *   - 'basico' → R$ 4,90/mês, SEM anúncios (+ áudio assistido, metas, a11y);
 *   - 'pro'    → R$ 9,90/mês, SEM anúncios, tudo liberado.
 *
 * Também guarda a JANELA "sem anúncios" temporária (`adFreeUntil`) — recompensa do anúncio
 * rewarded (Bloco 3): o usuário grátis assiste um vídeo e ganha X minutos sem anúncios.
 *
 * Persistido em AsyncStorage (leve, chave-valor). Default = 'free'.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export type Plan = 'free' | 'basico' | 'pro';

const STORAGE_KEY = 'leitura-plan';
const AD_FREE_KEY = 'leitura-ad-free-until';

type PlanState = {
  plan: Plan;
  /** ms (Date.now) até quando o usuário grátis fica sem anúncios (recompensa do rewarded). */
  adFreeUntil: number;
  /** Define o plano (futuro: chamado pelo RevenueCat após confirmar a compra). Persiste. */
  setPlan: (plan: Plan) => void;
  /** Concede uma janela "sem anúncios" de `minutes` minutos (recompensa do rewarded). */
  grantAdFree: (minutes: number) => void;
  /** Regra final de exibição de anúncios: tier grátis E fora da janela sem-anúncios. */
  shouldShowAds: () => boolean;
};

export const usePlan = create<PlanState>((set, get) => ({
  plan: 'free',
  adFreeUntil: 0,
  setPlan: (plan) => {
    set({ plan });
    AsyncStorage.setItem(STORAGE_KEY, plan).catch(() => {});
  },
  grantAdFree: (minutes) => {
    // Estende a partir do MAIOR entre agora e a janela atual (não encurta se já houver uma).
    const base = Math.max(Date.now(), get().adFreeUntil);
    const until = base + minutes * 60_000;
    set({ adFreeUntil: until });
    AsyncStorage.setItem(AD_FREE_KEY, String(until)).catch(() => {});
  },
  shouldShowAds: () => {
    const s = get();
    return planHasAds(s.plan) && Date.now() >= s.adFreeUntil;
  },
}));

// Restaura plano + janela sem-anúncios salvos na inicialização.
AsyncStorage.multiGet([STORAGE_KEY, AD_FREE_KEY])
  .then((pairs) => {
    const map = Object.fromEntries(pairs);
    const saved = map[STORAGE_KEY];
    const until = parseInt(map[AD_FREE_KEY] ?? '0', 10);
    usePlan.setState({
      plan: saved === 'basico' || saved === 'pro' || saved === 'free' ? saved : 'free',
      adFreeUntil: Number.isFinite(until) ? until : 0,
    });
  })
  .catch(() => {});

/** true quando o PLANO em si vê anúncios (só o grátis). Pago = sem ads, sempre. */
export function planHasAds(plan: Plan): boolean {
  return plan === 'free';
}

/** Hook de conveniência: o usuário atual deve ver anúncios AGORA (plano + janela sem-ads)? */
export function useHasAds(): boolean {
  const plan = usePlan((s) => s.plan);
  const adFreeUntil = usePlan((s) => s.adFreeUntil);
  return planHasAds(plan) && Date.now() >= adFreeUntil;
}
