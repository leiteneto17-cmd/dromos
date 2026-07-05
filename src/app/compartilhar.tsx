/**
 * Tela "Compartilhar atividade" (Fase 5a) — copia o fluxo do Strava:
 *  - CARROSSEL de modelos do card (desliza p/ escolher): Escuro, Transparente, Compacto.
 *  - BARRA de compartilhamento: Instagram Story · Copiar · Salvar · Copiar link · Mais.
 * O card vira imagem com react-native-view-shot; o modelo "Transparente" é capturado
 * em PNG sem fundo (vira sticker por cima da foto/Story). Ver CLAUDE.md §2.6.
 *
 * Nota Expo Go: salvar (galeria) e "Mais" (share sheet) funcionam direto. O envio
 * DIRETO ao Story do Instagram (sticker) precisa de dev build/prebuild — aqui ele
 * tenta o deep link e, se não der, cai no share sheet.
 */
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState, type ElementRef } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ViewShot, { captureRef } from 'react-native-view-shot';

import { CARD_VARIANTS, ShareableCard, type CardVariant } from '@/components/shareable-card';
import {
  CARD_H as SKIA_H,
  CARD_W as SKIA_W,
  SkiaShareCard,
  type SkiaCardHandle,
} from '@/components/skia-share-card';
import { useUI } from '@/hooks/use-ui';
import { computeWeekRecap } from '@/services/recap';
import { useLibrary } from '@/store/library';

const SCREEN = Dimensions.get('window').width;
const CARD_W = Math.min(SCREEN * 0.72, 300);

/** App ID do Facebook (Instagram exige p/ o Stories sticker). Vazio = tenta mesmo assim
 * no Android (é lenient) e cai no share sheet se falhar. Registrar 1 grátis em
 * developers.facebook.com para produção/iOS e colar em app.json → extra.fbAppId. */
const FB_APP_ID = (Constants.expoConfig?.extra as { fbAppId?: string } | undefined)?.fbAppId ?? '';
// Cores do fundo do Story (gradiente da identidade social §2.7) — o card vai como
// STICKER por cima, então o modelo "Transparente" flutua sobre este fundo/na foto do usuário.
// Gradiente do Story = marca (Social.purpleTop → Social.dark). Hex literal porque o nome
// `Social` aqui é o do react-native-share; valores batem com src/theme/social.ts.
const STORY_TOP = '#3B2A63';
const STORY_BOTTOM = '#0E0B16';

// No Expo Go o módulo nativo do expo-media-library não existe → nem tentamos
// importá-lo (o import dinâmico ainda "resolve" com funções undefined e quebraria).
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';


export default function ShareScreen() {
  const c = useUI();
  // Se veio `?model=`, abre o carrossel já naquele modelo (ex.: 'citacao' vindo do leitor).
  // `?recap=1` mostra o RECAP da semana em vez da sessão/resumo geral.
  const params = useLocalSearchParams<{ sessionId?: string; model?: string; recap?: string }>();
  const initialIndex = Math.max(0, CARD_VARIANTS.findIndex((v) => v.id === params.model));
  const [index, setIndex] = useState(initialIndex);
  const [busy, setBusy] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);
  const shotRefs = useRef<(ElementRef<typeof ViewShot> | null)[]>([]);
  const skiaRef = useRef<SkiaCardHandle>(null);

  // Se veio um sessionId (compartilhar UMA atividade), o card mostra aquela sessão.
  const session = useLibrary((s) => s.sessions.find((x) => x.id === params.sessionId));
  const books = useLibrary((s) => s.books);
  const currentBookId = useLibrary((s) => s.currentBookId);
  const stats = useLibrary((s) => s.stats);
  const sessions = useLibrary((s) => s.sessions);
  // Recap da semana (?recap=1): derivado na hora dos dados locais (services/recap.ts).
  const recap = params.recap ? computeWeekRecap(stats, sessions) : undefined;

  const variant: CardVariant = CARD_VARIANTS[index].id;

  // Imagem de fundo do modelo ativo (mesma regra do card): capa do livro ou a foto.
  const refBookId = session?.bookId ?? currentBookId ?? null;
  const coverUri = refBookId ? books.find((b) => b.id === refBookId)?.coverUrl : undefined;
  const activeBg = variant === 'capa' ? coverUri : variant === 'foto' ? photoUri : undefined;

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN);
    if (i !== index) setIndex(i);
  }

  /** Aguarda dois frames para o React Native PINTAR antes de capturar. */
  function waitTwoFrames() {
    return new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(() => res())));
  }

  async function capture(result: 'tmpfile' | 'base64'): Promise<string | null> {
    // Modelo transparente → renderer SKIA (PNG com alpha REAL no Android; view-shot achata preto).
    if (variant === 'transparente') {
      const b64 = skiaRef.current?.exportBase64() ?? null;
      if (!b64) {
        Alert.alert('Ops', 'Não consegui gerar o card transparente.');
        return null;
      }
      if (result === 'base64') return b64;
      try {
        const uri = `${FileSystem.cacheDirectory}dromos-card-${Date.now()}.png`;
        await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });
        return uri;
      } catch {
        Alert.alert('Ops', 'Não consegui salvar a imagem do card.');
        return null;
      }
    }
    const ref = shotRefs.current[index];
    if (!ref) return null;
    try {
      // Modelos com imagem de fundo (capa/foto): garante que a imagem já decodificou
      // ANTES de capturar — senão o PNG sai só com o gradiente (race do expo-image).
      if (activeBg) {
        try {
          await Image.prefetch(activeBg);
        } catch {
          /* prefetch é best-effort; segue mesmo se falhar */
        }
        await waitTwoFrames();
      }
      return await captureRef(ref, { format: 'png', quality: 1, result });
    } catch (e) {
      Alert.alert('Ops', 'Não consegui gerar a imagem do card.');
      return null;
    }
  }

  async function withBusy(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  const onSave = () =>
    withBusy(async () => {
      const uri = await capture('tmpfile');
      if (!uri) return;
      // expo-media-library exige módulo nativo (ausente no Expo Go). Só importamos
      // fora do Expo Go E confirmando que as funções existem; senão, share sheet.
      let ML: typeof import('expo-media-library') | null = null;
      if (!IS_EXPO_GO) {
        try {
          const mod = await import('expo-media-library');
          if (typeof mod.requestPermissionsAsync === 'function' && typeof mod.saveToLibraryAsync === 'function') {
            ML = mod;
          }
        } catch {
          ML = null;
        }
      }
      if (!ML) {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Salvar imagem' });
        } else {
          Alert.alert('Salvar', 'Salvar na galeria precisa do app de desenvolvimento (dev build).');
        }
        return;
      }
      // Salvar precisa só de permissão de ESCRITA (writeOnly=true) — no Android 13+ isso
      // evita pedir acesso total à galeria (que o usuário costuma negar → "não salvava").
      const perm = await ML.requestPermissionsAsync(true);
      if (!perm.granted) {
        Alert.alert('Permissão necessária', 'Autorize salvar fotos para guardar o card na galeria.');
        return;
      }
      try {
        await ML.saveToLibraryAsync(uri);
        Alert.alert('Salvo ✅', 'O card foi salvo na sua galeria.');
      } catch (e) {
        // Se o saveToLibrary falhar (algumas ROMs/Android), cai no share sheet (o usuário
        // escolhe "Salvar em Fotos"), em vez de falhar silencioso.
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Salvar imagem' });
        } else {
          Alert.alert('Não deu para salvar', e instanceof Error ? e.message : 'Tente compartilhar e salvar por lá.');
        }
      }
    });

  const onMore = () =>
    withBusy(async () => {
      const uri = await capture('tmpfile');
      if (!uri) return;
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Indisponível', 'Compartilhamento não disponível neste aparelho.');
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Compartilhar card' });
    });

  const onCopyImage = () =>
    withBusy(async () => {
      const b64 = await capture('base64');
      if (!b64) return;
      try {
        await Clipboard.setImageAsync(b64);
        Alert.alert('Copiado ✅', 'Imagem copiada — cole onde quiser.');
      } catch {
        Alert.alert('Ops', 'Este aparelho não permitiu copiar a imagem.');
      }
    });

  const onCopyLink = () =>
    withBusy(async () => {
      // Placeholder até existir backend/perfil público (Fase 5b).
      await Clipboard.setStringAsync('https://mindreaderapp.com');
      Alert.alert('Link copiado', 'Link placeholder — vira o link do seu perfil quando tivermos backend.');
    });

  const onPickPhoto = () =>
    withBusy(async () => {
      // Módulo nativo: ausente no Expo Go e em dev build gerado ANTES de instalar o
      // pacote (erro "Cannot find native module 'ExponentImagePicker'"). Carregamos
      // preguiçosamente e, se faltar, avisamos em vez de derrubar a tela.
      let ImagePicker: typeof import('expo-image-picker');
      try {
        ImagePicker = await import('expo-image-picker');
        if (typeof ImagePicker.launchImageLibraryAsync !== 'function') throw new Error('no native module');
      } catch {
        Alert.alert(
          'Recurso indisponível',
          'Escolher foto precisa do app de desenvolvimento atualizado. Rode "npx expo run:android" para reconstruir, ou use o Expo Go (tecla s).',
        );
        return;
      }
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permissão necessária', 'Autorize o acesso às fotos para usar uma imagem sua de fundo.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.9,
      });
      if (!res.canceled && res.assets[0]?.uri) {
        setPhotoUri(res.assets[0].uri);
      }
    });

  const onInstagram = () =>
    withBusy(async () => {
      // O card vai como STICKER do Instagram Stories (assim o modelo "Transparente"
      // flutua de verdade sobre a foto/Story do usuário — antes o deep link abria o
      // Story em branco, descartando a imagem). react-native-share monta o intent no
      // Android e o pasteboard no iOS. Fundo = gradiente da marca (o usuário troca por
      // foto dentro do Instagram); a foto do próprio card vem embutida no sticker.
      const b64 = await capture('base64');
      if (!b64) return;
      try {
        const { default: Share, Social } = await import('react-native-share');
        await Share.shareSingle({
          social: Social.InstagramStories,
          appId: FB_APP_ID,
          stickerImage: `data:image/png;base64,${b64}`,
          backgroundTopColor: STORY_TOP,
          backgroundBottomColor: STORY_BOTTOM,
        });
        return;
      } catch (e) {
        // Instagram ausente / recusou (ex.: appId vazio no iOS) → share sheet nativo.
      }
      const uri = await capture('tmpfile');
      if (!uri) return;
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Compartilhar no Instagram' });
      } else {
        Alert.alert('Instagram', 'Abra com “Mais” e escolha o Instagram.');
      }
    });

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={[styles.back, { color: c.textDim }]}>‹ Voltar</Text>
          </Pressable>
          <Text style={[styles.title, { color: c.text }]}>
            {recap ? 'Recap da semana' : session ? 'Compartilhar atividade' : 'Compartilhar'}
          </Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Carrossel de modelos */}
        <FlatList
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          data={CARD_VARIANTS}
          keyExtractor={(v) => v.id}
          onMomentumScrollEnd={onScrollEnd}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({ length: SCREEN, offset: SCREEN * i, index: i })}
          style={styles.flex}
          renderItem={({ item, index: i }) => (
            <View style={styles.page}>
              <View style={[styles.cardSlot, { width: CARD_W }]}>
                {item.id === 'transparente' ? (
                  // Skia em resolução cheia (460×640), escalado só para caber no slot.
                  // O makeImageSnapshot exporta o tamanho REAL da canvas, não o exibido.
                  <View style={{ width: CARD_W, height: (CARD_W / SKIA_W) * SKIA_H, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ transform: [{ scale: CARD_W / SKIA_W }] }}>
                      <SkiaShareCard ref={skiaRef} />
                    </View>
                  </View>
                ) : (
                  <ViewShot
                    ref={(r) => {
                      shotRefs.current[i] = r;
                    }}
                    style={styles.shot}>
                    <ShareableCard variant={item.id} session={session} recap={recap} photoUri={photoUri} />
                  </ViewShot>
                )}
              </View>
            </View>
          )}
        />

        {/* Indicador + nome do modelo */}
        <Text style={[styles.variantName, { color: c.green }]}>{CARD_VARIANTS[index].label}</Text>
        <View style={styles.dots}>
          {CARD_VARIANTS.map((v, i) => (
            <View
              key={v.id}
              style={[styles.dot, { backgroundColor: i === index ? c.green : c.border }, i === index && styles.dotActive]}
            />
          ))}
        </View>

        {/* Ação contextual: escolher foto de fundo (só na variante 'foto') */}
        {variant === 'foto' ? (
          <Pressable onPress={onPickPhoto} style={[styles.pickPhoto, { borderColor: c.green }]}>
            <Text style={[styles.pickPhotoText, { color: c.green }]}>
              📸 {photoUri ? 'Trocar foto' : 'Escolher foto'}
            </Text>
          </Pressable>
        ) : null}

        {/* Barra de compartilhamento (estilo Strava) */}
        <View style={styles.shareBar}>
          <ShareBtn icon="📷" label="Story" onPress={onInstagram} />
          <ShareBtn icon="📋" label="Copiar" onPress={onCopyImage} />
          <ShareBtn icon="💾" label="Salvar" onPress={onSave} />
          <ShareBtn icon="🔗" label="Link" onPress={onCopyLink} />
          <ShareBtn icon="➕" label="Mais" onPress={onMore} />
        </View>
      </SafeAreaView>
    </View>
  );
}

function ShareBtn({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const c = useUI();
  return (
    <Pressable onPress={onPress} style={styles.shareBtn}>
      <View style={[styles.shareIcon, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
      </View>
      <Text style={[styles.shareLabel, { color: c.textDim }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  back: { fontSize: 16, fontWeight: '600', width: 60 },
  title: { fontSize: 18, fontWeight: '800' },
  page: { width: SCREEN, alignItems: 'center', justifyContent: 'center' },
  // backgroundColor transparente EXPLÍCITO nos wrappers: sem isso, o react-native-view-shot
  // no Android às vezes pinta o fundo do modelo "Transparente" de preto ao capturar (perde o
  // canal alpha do PNG). Reforça a transparência de toda a árvore capturada.
  cardSlot: { borderRadius: 28, overflow: 'hidden', backgroundColor: 'transparent' },
  shot: { borderRadius: 28, overflow: 'hidden', backgroundColor: 'transparent' },
  // Sem clipping p/ o modelo transparente — evita o fundo preto do view-shot no Android.
  variantName: { textAlign: 'center', fontSize: 15, fontWeight: '800', marginTop: 4 },
  pickPhoto: {
    alignSelf: 'center',
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  pickPhotoText: { fontSize: 14, fontWeight: '700' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { width: 22 },
  shareBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
    paddingTop: 18,
    paddingBottom: 8,
  },
  shareBtn: { alignItems: 'center', gap: 6, width: 64 },
  shareIcon: { width: 54, height: 54, borderRadius: 27, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  shareLabel: { fontSize: 12, fontWeight: '600' },
});
