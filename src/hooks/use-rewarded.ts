/**
 * Hook do anúncio REWARDED (recompensado) — Bloco 3 dos anúncios (CLAUDE.md §6 "rewarded p/ degustar").
 *
 * O usuário grátis ESCOLHE assistir um vídeo até o fim e ganha uma recompensa. Aqui a recompensa
 * é uma janela "sem anúncios" (ver `usePlan.grantAdFree`), mas o hook é genérico: quem chama passa
 * o `onReward`. Diferente do intersticial (forçado), rewarded é sempre OPT-IN.
 *
 * Preguiçoso/no-op no Expo Go e à prova de falha. Pré-carrega ao montar e recarrega após fechar.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { adsModule, adsUnsupported } from '@/services/ads';
import { adUnitId } from '@/services/ads/config';

type UseRewarded = {
  /** true quando há um vídeo pronto para exibir. */
  ready: boolean;
  /** true enquanto carrega / exibe (para desabilitar o botão). */
  loading: boolean;
  /** Exibe o vídeo; chama `onReward` se o usuário ganhar a recompensa (assistiu o suficiente). */
  show: (onReward: () => void) => void;
};

export function useRewardedAd(): UseRewarded {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adRef = useRef<any>(null);
  const onRewardRef = useRef<(() => void) | null>(null);
  const earnedRef = useRef(false);

  const load = useCallback(() => {
    if (adsUnsupported) return;
    const m = adsModule();
    if (!m?.RewardedAd) return;
    try {
      const unitId = adUnitId('rewarded', m.TestIds?.REWARDED ?? '');
      const ad = m.RewardedAd.createForAdRequest(unitId, { requestNonPersonalizedAdsOnly: true });
      earnedRef.current = false;
      ad.addAdEventListener(m.RewardedAdEventType.LOADED, () => setReady(true));
      ad.addAdEventListener(m.RewardedAdEventType.EARNED_REWARD, () => {
        earnedRef.current = true;
      });
      ad.addAdEventListener(m.AdEventType.CLOSED, () => {
        setReady(false);
        setLoading(false);
        // Concede a recompensa só se o usuário realmente ganhou (assistiu o suficiente).
        if (earnedRef.current) onRewardRef.current?.();
        onRewardRef.current = null;
        load(); // já prepara o próximo
      });
      ad.addAdEventListener(m.AdEventType.ERROR, () => {
        setReady(false);
        setLoading(false);
      });
      adRef.current = ad;
      setLoading(true);
      ad.load();
      // `load` é estável (sem deps externas) — o setLoading(false) ocorre em LOADED via ready.
    } catch {
      adRef.current = null;
      setReady(false);
      setLoading(false);
    }
  }, []);

  // LOADED não desliga `loading` sozinho; sincroniza pelo `ready`.
  useEffect(() => {
    if (ready) setLoading(false);
  }, [ready]);

  useEffect(() => {
    load();
  }, [load]);

  const show = useCallback((onReward: () => void) => {
    const ad = adRef.current;
    if (!ad || !ready) return;
    onRewardRef.current = onReward;
    try {
      ad.show();
    } catch {
      setReady(false);
      setLoading(false);
      load();
    }
  }, [ready, load]);

  return { ready, loading, show };
}
