/**
 * Anúncio INTERSTICIAL (vídeo/tela cheia) por TEMPO DE LEITURA — tier grátis (CLAUDE.md §6).
 *
 * ⚠️ REGRA DE OURO (§2.5): NUNCA mostrar por cima do texto vivo. O usuário pediu "um vídeo a
 * cada ~10 min de leitura", mas interromper o capítulo quebra a leitura e arrisca rejeição na
 * loja. Solução: ACUMULAMOS o tempo lido (`accrueReadingSeconds`, chamado pelo cronômetro do
 * reader) e só mostramos o intersticial no PRÓXIMO PONTO NATURAL — quando o usuário SAI do
 * leitor (`maybeShowReadingInterstitial`, chamado no cleanup do useFocusEffect do reader).
 *
 * Tudo é preguiçoso/no-op no Expo Go e à prova de falha (anúncio é acessório, nunca trava o app).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { adsModule, adsUnsupported } from '@/services/ads';
import { adUnitId } from '@/services/ads/config';
import { planHasAds, usePlan } from '@/store/plan';

/** A cada quantos segundos de leitura ACUMULADA cabe um intersticial. */
const AD_INTERVAL_SECONDS = 10 * 60; // 10 min
const PROGRESS_KEY = 'leitura-ad-reading-seconds';

let secondsTowardAd = 0;
// Restaura o progresso salvo (continua "a cada 10 min" entre aberturas do app).
AsyncStorage.getItem(PROGRESS_KEY)
  .then((v) => {
    const n = v ? parseInt(v, 10) : 0;
    if (Number.isFinite(n) && n > 0) secondsTowardAd = n;
  })
  .catch(() => {});

/** Soma tempo de leitura rumo ao próximo intersticial (chamado pelo cronômetro do reader). */
export function accrueReadingSeconds(seconds: number): void {
  if (adsUnsupported) return;
  if (!planHasAds(usePlan.getState().plan)) return; // plano pago não acumula
  secondsTowardAd += seconds;
  AsyncStorage.setItem(PROGRESS_KEY, String(secondsTowardAd)).catch(() => {});
}

// --- Intersticial pré-carregado ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let interstitial: any = null;
let loaded = false;

/** Cria e carrega um intersticial (idempotente). Re-chamar após exibir recarrega o próximo. */
export function preloadInterstitial(): void {
  if (adsUnsupported) return;
  const m = adsModule();
  if (!m?.InterstitialAd) return;
  try {
    const unitId = adUnitId('interstitial', m.TestIds?.INTERSTITIAL ?? '');
    interstitial = m.InterstitialAd.createForAdRequest(unitId, {
      requestNonPersonalizedAdsOnly: true,
    });
    loaded = false;
    interstitial.addAdEventListener(m.AdEventType.LOADED, () => {
      loaded = true;
    });
    interstitial.addAdEventListener(m.AdEventType.CLOSED, () => {
      loaded = false;
      preloadInterstitial(); // já deixa o próximo pronto
    });
    interstitial.addAdEventListener(m.AdEventType.ERROR, () => {
      loaded = false;
    });
    interstitial.load();
  } catch {
    interstitial = null;
    loaded = false;
  }
}

/**
 * Mostra o intersticial SE: tier com anúncios + já acumulou o intervalo de leitura + há um
 * anúncio pronto. Chamado ao SAIR do leitor (ponto natural). Reseta o contador ao exibir.
 * Pequeno atraso para a navegação de volta assentar antes da tela cheia do anúncio.
 */
export function maybeShowReadingInterstitial(): void {
  if (adsUnsupported) return;
  // useHasAds embute plano pago E janela "sem anúncios" do rewarded (Bloco 3).
  if (!usePlan.getState().shouldShowAds()) return;
  if (secondsTowardAd < AD_INTERVAL_SECONDS) return;
  if (!interstitial || !loaded) {
    preloadInterstitial(); // não estava pronto; deixa pronto p/ a próxima saída
    return;
  }
  // Consumimos o intervalo (guarda o excedente p/ não "perder" minutos já lidos).
  secondsTowardAd = Math.max(0, secondsTowardAd - AD_INTERVAL_SECONDS);
  AsyncStorage.setItem(PROGRESS_KEY, String(secondsTowardAd)).catch(() => {});
  setTimeout(() => {
    try {
      interstitial.show();
    } catch {
      loaded = false;
      preloadInterstitial();
    }
  }, 600);
}
