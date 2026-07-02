/**
 * Banner de anúncio discreto — SÓ para o tier grátis e SÓ fora do leitor (CLAUDE.md §2.5/§6).
 *
 * Regras que este componente garante:
 *  - **Tier grátis apenas:** `useHasAds()` (plano pago = nada renderiza).
 *  - **Nunca no leitor:** é responsabilidade de QUEM usa — só montamos este banner em telas
 *    fora de `/reader` (biblioteca, explorar, estatísticas). Não importar dentro do leitor.
 *  - **À prova de Expo Go / módulo ausente:** sem o nativo, vira no-op (não quebra).
 *
 * Anúncio adaptativo ancorado (altura recomendada pelo AdMob para a largura da tela).
 */
import { useState } from 'react';
import { View } from 'react-native';

import { adsModule, adsUnsupported } from '@/services/ads';
import { adUnitId } from '@/services/ads/config';
import { useHasAds } from '@/store/plan';

export function AdBanner({ style }: { style?: object }) {
  const hasAds = useHasAds();
  const [failed, setFailed] = useState(false);

  const m = adsModule();
  // Não renderiza nada se: plano pago, Expo Go, módulo ausente, ou o anúncio falhou ao carregar.
  if (!hasAds || adsUnsupported || !m || failed) return null;

  const BannerAd = m.BannerAd;
  const BannerAdSize = m.BannerAdSize;
  const TestIds = m.TestIds;
  if (!BannerAd) return null;

  const unitId = adUnitId('banner', TestIds?.BANNER ?? '');

  return (
    <View style={[{ alignItems: 'center' }, style]}>
      <BannerAd
        unitId={unitId}
        size={BannerAdSize?.ANCHORED_ADAPTIVE_BANNER ?? 'ANCHORED_ADAPTIVE_BANNER'}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}
