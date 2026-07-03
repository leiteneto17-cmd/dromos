/**
 * Assinatura Premium via RevenueCat (Fase 4 — CLAUDE.md §4.2/§6).
 * IAP nativo unificado (App Store / Google Play); o RevenueCat só confirma a compra
 * e nós chamamos `setPlan('premium')` — `store/plan.ts` segue sendo a FONTE ÚNICA
 * do gating (nada mais muda no app).
 *
 * ⚠️ MÓDULO NATIVO: `react-native-purchases` não existe no Expo Go → require
 * PREGUIÇOSO e no-op lá dentro ([[expo-go-native-modules]]), igual ao AdMob.
 *
 * PREÇOS (decisão 2026-07-02): Mensal R$ 5,90 · Anual R$ 59,90 ("2 meses grátis").
 * Entitlement no RevenueCat: `premium`. Produtos sugeridos nas lojas:
 * `premium_mensal` / `premium_anual` (os pacotes vêm do Offering "default").
 *
 * CONFIG PENDENTE (sem isso, tudo aqui é no-op e a tela /premium usa o fallback):
 *  1. Criar conta no revenuecat.com → projeto → apps Android/iOS.
 *  2. Colar as chaves PÚBLICAS de API em app.json → extra.revenueCatAndroidKey /
 *     revenueCatIosKey (chave "public SDK key", pode ir no cliente).
 *  3. Criar os produtos nas lojas + Offering "default" com pacotes MONTHLY/ANNUAL.
 *  4. Rebuild do dev client (módulo nativo novo): npx expo run:android.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { useAuth } from '@/store/auth';
import { usePlan } from '@/store/plan';

const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

const API_KEY = Platform.select({
  android: (Constants.expoConfig?.extra?.revenueCatAndroidKey as string | undefined) ?? '',
  ios: (Constants.expoConfig?.extra?.revenueCatIosKey as string | undefined) ?? '',
  default: '',
})?.trim();

/** Entitlement configurado no painel do RevenueCat. */
const ENTITLEMENT = 'premium';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RC = any;
let mod: RC | null = null;
function rc(): RC | null {
  if (IS_EXPO_GO || !API_KEY) return null;
  if (!mod) {
    try {
      mod = require('react-native-purchases').default;
    } catch {
      mod = null; // build sem o módulo nativo → no-op
    }
  }
  return mod;
}

/** true quando a compra REAL está disponível (fora do Expo Go, chave configurada, módulo ok). */
export function purchasesSupported(): boolean {
  return !!rc();
}

/** Pacote de assinatura pronto p/ a tela (preço já localizado pela loja). */
export type PremiumPackage = {
  id: string;
  /** 'MONTHLY' | 'ANNUAL' | outro (packageType do RevenueCat). */
  type: string;
  /** Preço formatado pela loja (ex.: "R$ 5,90"). */
  priceString: string;
  /** Objeto nativo do RevenueCat (passar de volta em purchasePremium). */
  raw: unknown;
};

/** Sincroniza o plano a partir do customerInfo. UPGRADE-ONLY nesta fase: só promove a
 * premium quando o entitlement está ativo — nunca rebaixa sozinho, para não brigar com o
 * seletor de teste de Integrações. Quando as lojas estiverem configuradas e o seletor de
 * teste for removido, passar a rebaixar também (entitlement ausente → 'free'). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function syncFromCustomerInfo(info: any): void {
  const active = !!info?.entitlements?.active?.[ENTITLEMENT];
  if (active && usePlan.getState().plan !== 'premium') {
    usePlan.getState().setPlan('premium');
  }
}

let initStarted = false;

/** Inicializa o SDK (uma vez, no boot). Identifica o usuário pelo id do Supabase quando
 * logado — a assinatura segue a CONTA, não o aparelho. Tolera qualquer falha (no-op). */
export async function initPurchases(): Promise<void> {
  const m = rc();
  if (!m || initStarted) return;
  initStarted = true;
  try {
    const userId = useAuth.getState().session?.user?.id;
    m.configure({ apiKey: API_KEY, ...(userId ? { appUserID: userId } : {}) });
    // Mudanças de assinatura (compra em outro aparelho, renovação, upgrade) → plano.
    m.addCustomerInfoUpdateListener((info: unknown) => syncFromCustomerInfo(info));
    const info = await m.getCustomerInfo();
    syncFromCustomerInfo(info);
  } catch (e) {
    console.warn('purchases init falhou (no-op):', String(e).slice(0, 160));
  }
}

/** Pacotes do Offering "default" (mensal/anual) p/ a tela de assinatura. [] se indisponível. */
export async function getPremiumPackages(): Promise<PremiumPackage[]> {
  const m = rc();
  if (!m) return [];
  try {
    const offerings = await m.getOfferings();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const packs: any[] = offerings?.current?.availablePackages ?? [];
    return packs.map((p) => ({
      id: String(p?.identifier ?? ''),
      type: String(p?.packageType ?? ''),
      priceString: String(p?.product?.priceString ?? ''),
      raw: p,
    }));
  } catch {
    return [];
  }
}

export type PurchaseResult =
  | { ok: true }
  | { ok: false; cancelled?: boolean; error?: string };

/** Compra o pacote escolhido. Sucesso = entitlement ativo → setPlan('premium'). */
export async function purchasePremium(pkg: PremiumPackage): Promise<PurchaseResult> {
  const m = rc();
  if (!m) return { ok: false, error: 'Compra indisponível neste ambiente.' };
  try {
    const { customerInfo } = await m.purchasePackage(pkg.raw);
    syncFromCustomerInfo(customerInfo);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const active = !!(customerInfo as any)?.entitlements?.active?.[ENTITLEMENT];
    return active ? { ok: true } : { ok: false, error: 'A loja não confirmou a assinatura.' };
  } catch (e) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((e as any)?.userCancelled) return { ok: false, cancelled: true };
    return { ok: false, error: e instanceof Error ? e.message : 'Falha na compra.' };
  }
}

/** Restaura compras anteriores (troca de aparelho / reinstalação). true = premium ativo. */
export async function restorePurchases(): Promise<boolean> {
  const m = rc();
  if (!m) return false;
  try {
    const info = await m.restorePurchases();
    syncFromCustomerInfo(info);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return !!(info as any)?.entitlements?.active?.[ENTITLEMENT];
  } catch {
    return false;
  }
}
