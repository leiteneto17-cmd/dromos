/**
 * Plano do usuário (Zustand) — fonte única do GATING de monetização (CLAUDE.md §6 / [[monetizacao-planos]]).
 *
 * MODELO (decisão 2026-06-30 — substitui os 3 planos): só DOIS planos.
 *   - 'free'    → grátis COM anúncios. SÓ o leitor: importar/ler EPUB/PDF, Bionic, temas,
 *                 marcações, atividades/estatísticas. SEM áudio/vozes, SEM Metas, SEM Coach,
 *                 SEM dicionário por IA, SEM social avançado.
 *   - 'premium' → R$ 4,90/mês, TUDO liberado e SEM anúncios.
 *
 * Sem enforcement de COBRANÇA ainda: a compra real é via IAP nativo (App Store / Google Play)
 * unificado por RevenueCat (Fase 4). O RevenueCat só vai chamar `setPlan('premium')` quando a
 * loja confirmar a assinatura. Até lá, o seletor de teste em Integrações flipa o plano.
 *
 * Também guarda a JANELA "sem anúncios" temporária (`adFreeUntil`) — recompensa do rewarded:
 * o usuário grátis assiste um vídeo e ganha X minutos sem anúncios.
 *
 * Persistido em AsyncStorage. Default = 'free'.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export type Plan = 'free' | 'premium';

const STORAGE_KEY = 'leitura-plan';
const AD_FREE_KEY = 'leitura-ad-free-until';

/** Normaliza valores salvos (inclui os planos antigos 'basico'/'pro' → 'premium'). */
function normalizePlan(v: string | null | undefined): Plan {
  return v === 'premium' || v === 'basico' || v === 'pro' ? 'premium' : 'free';
}

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
    const until = parseInt(map[AD_FREE_KEY] ?? '0', 10);
    usePlan.setState({
      plan: normalizePlan(map[STORAGE_KEY]),
      adFreeUntil: Number.isFinite(until) ? until : 0,
    });
  })
  .catch(() => {});

/** true quando o PLANO em si vê anúncios (só o grátis). Premium = sem ads, sempre. */
export function planHasAds(plan: Plan): boolean {
  return plan === 'free';
}

/** Hook: o usuário atual deve ver anúncios AGORA (plano grátis E fora da janela sem-ads)? */
export function useHasAds(): boolean {
  const plan = usePlan((s) => s.plan);
  const adFreeUntil = usePlan((s) => s.adFreeUntil);
  return planHasAds(plan) && Date.now() >= adFreeUntil;
}

/** Hook: o usuário é Premium? (gate de áudio/vozes, Metas, Coach, IA, social avançado). */
export function useIsPremium(): boolean {
  return usePlan((s) => s.plan === 'premium');
}
