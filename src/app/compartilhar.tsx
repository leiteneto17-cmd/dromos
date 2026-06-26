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
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState, type ElementRef } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import ViewShot, { captureRef } from 'react-native-view-shot';

import { CARD_VARIANTS, ShareableCard, type CardVariant } from '@/components/shareable-card';
import { useUI } from '@/hooks/use-ui';
import { useLibrary } from '@/store/library';

const SCREEN = Dimensions.get('window').width;
const CARD_W = Math.min(SCREEN * 0.72, 300);

// No Expo Go o módulo nativo do expo-media-library não existe → nem tentamos
// importá-lo (o import dinâmico ainda "resolve" com funções undefined e quebraria).
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

/** Quadriculado (estilo Photoshop) para sinalizar fundo transparente. */
function Checkerboard() {
  return (
    <Svg style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern id="checker" width="28" height="28" patternUnits="userSpaceOnUse">
          <Rect width="28" height="28" fill="#211B33" />
          <Rect width="14" height="14" fill="#2C2542" />
          <Rect x="14" y="14" width="14" height="14" fill="#2C2542" />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#checker)" rx={28} />
    </Svg>
  );
}

export default function ShareScreen() {
  const c = useUI();
  // Se veio `?model=`, abre o carrossel já naquele modelo (ex.: 'citacao' vindo do leitor).
  const params = useLocalSearchParams<{ sessionId?: string; model?: string }>();
  const initialIndex = Math.max(0, CARD_VARIANTS.findIndex((v) => v.id === params.model));
  const [index, setIndex] = useState(initialIndex);
  const [busy, setBusy] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);
  const shotRefs = useRef<(ElementRef<typeof ViewShot> | null)[]>([]);

  // Se veio um sessionId (compartilhar UMA atividade), o card mostra aquela sessão.
  const session = useLibrary((s) => s.sessions.find((x) => x.id === params.sessionId));
  const books = useLibrary((s) => s.books);
  const currentBookId = useLibrary((s) => s.currentBookId);

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
      const perm = await ML.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permissão necessária', 'Autorize o acesso à galeria para salvar a imagem.');
        return;
      }
      await ML.saveToLibraryAsync(uri);
      Alert.alert('Salvo ✅', 'O card foi salvo na sua galeria.');
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
      const uri = await capture('tmpfile');
      if (!uri) return;
      // Tenta o Story do Instagram; sem dev build/sticker, cai no share sheet.
      const igUrl = 'instagram-stories://share';
      const can = await Linking.canOpenURL(igUrl).catch(() => false);
      if (can) {
        try {
          await Linking.openURL(igUrl);
          return;
        } catch {
          // segue para o share sheet
        }
      }
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
            {session ? 'Compartilhar atividade' : 'Compartilhar'}
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
                {item.id === 'transparente' ? <Checkerboard /> : null}
                <ViewShot
                  ref={(r) => {
                    shotRefs.current[i] = r;
                  }}
                  style={styles.shot}>
                  <ShareableCard variant={item.id} session={session} photoUri={photoUri} />
                </ViewShot>
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
  cardSlot: { borderRadius: 28, overflow: 'hidden' },
  shot: { borderRadius: 28, overflow: 'hidden' },
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
