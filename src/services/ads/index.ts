/**
 * Inicialização do Google AdMob + consentimento (UMP) — tier grátis (CLAUDE.md §6 / §4.4).
 *
 * ⚠️ MÓDULO NATIVO: `react-native-google-mobile-ads` NÃO existe no Expo Go (igual ao
 * expo-notifications — ver [[expo-go-native-modules]]). Por isso carregamos o pacote de
 * forma PREGUIÇOSA e SÓ fora do Expo Go; lá dentro vira no-op (sem ads, sem crash). O app
 * roda em dev build/prebuild (CLAUDE.md §3), onde os anúncios funcionam.
 *
 * UMP (User Messaging Platform): exigência das lojas (§4.4) para ads personalizados na
 * UE/Brasil (GDPR/LGPD). Pedimos o formulário de consentimento ANTES de carregar anúncios;
 * sem consentimento, o AdMob serve anúncios não-personalizados automaticamente.
 */
import Constants from 'expo-constants';

const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

/** true quando anúncios não são suportados no ambiente atual (Expo Go). */
export const adsUnsupported = IS_EXPO_GO;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdsModule = any;
let mod: AdsModule | null = null;
function ads(): AdsModule | null {
  if (IS_EXPO_GO) return null;
  if (!mod) {
    try {
      mod = require('react-native-google-mobile-ads');
    } catch {
      mod = null; // pacote ausente (ex.: build sem o módulo) → no-op
    }
  }
  return mod;
}

/** Acesso ao módulo nativo p/ os componentes (BannerAd, etc.). null no Expo Go. */
export function adsModule(): AdsModule | null {
  return ads();
}

let initStarted = false;

/**
 * Inicializa o SDK + pede consentimento (uma vez, no boot). Idempotente e à prova de erro:
 * qualquer falha (sem rede, módulo ausente) é engolida — anúncio é acessório, nunca trava o app.
 */
export async function initAds(): Promise<void> {
  if (IS_EXPO_GO || initStarted) return;
  initStarted = true;
  const m = ads();
  if (!m) return;

  // 1) Consentimento (UMP) — não bloqueia o init do SDK; corre em paralelo e tolera falha.
  try {
    const consent = m.AdsConsent;
    if (consent?.requestInfoUpdate) {
      await consent.requestInfoUpdate();
      // Mostra o formulário só se for exigido (UE/regiões com lei de privacidade).
      if (consent.loadAndShowConsentFormIfRequired) {
        await consent.loadAndShowConsentFormIfRequired();
      } else if (consent.gatherConsent) {
        await consent.gatherConsent();
      }
    }
  } catch {
    // sem consentimento explícito → o AdMob serve anúncios não-personalizados.
  }

  // 2) Inicializa o SDK de anúncios.
  try {
    await m.default().initialize();
  } catch {
    // sem init → os componentes simplesmente não renderizam (guardam contra módulo nulo).
  }

  // 3) Já deixa um intersticial pré-carregado p/ a 1ª saída do leitor (Bloco 2).
  try {
    // require tardio: evita ciclo de import (interstitial.ts importa daqui).
    (require('@/services/ads/interstitial') as typeof import('./interstitial')).preloadInterstitial();
  } catch {
    // sem preload → maybeShowReadingInterstitial recarrega sob demanda.
  }
}
