/**
 * Story em tela cheia no estilo Instagram (SOCIAL/DESIGN-STORIES.md, S2):
 *  - Carrega a lista de stories (getStories) e navega ENTRE PESSOAS;
 *  - Barra de progresso SEGMENTADA (1 por pessoa) que preenche em ~6s e AUTO-AVANÇA;
 *  - Toque à direita = próximo · à esquerda = anterior · ✕ ou fim da última = fechar;
 *  - Marca VISTO ao abrir cada story dos outros (anel cinza depois); "visto por N" na minha;
 *  - Stickers de informação: livro + Paginômetro (páginas/min) + tempo ("há 3h").
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Paginometro } from '@/components/paginometro';
import { getStories, markStorySeen, tempoAtras, type Story } from '@/services/stories';
import { Social, SocialGradient } from '@/theme/social';

const STORY_MS = 6000; // duração de cada story antes de auto-avançar

export default function StoryScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [stories, setStories] = useState<Story[]>([]);
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  // Animated.Value estável (state lazy, não ref) — pode ser lido no render sem violar as
  // regras de hooks; o `anim` (animação em curso) fica em ref pois só é tocado em efeitos.
  const [progress] = useState(() => new Animated.Value(0));
  const anim = useRef<Animated.CompositeAnimation | null>(null);

  // Carrega as stories e começa na que foi tocada (id = activity_id).
  useEffect(() => {
    let alive = true;
    getStories().then((list) => {
      if (!alive) return;
      setStories(list);
      const start = Math.max(0, list.findIndex((s) => s.activity_id === id));
      setIndex(start);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  const current = stories[index];

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.navigate('/');
  }, []);

  const goTo = useCallback(
    (next: number) => {
      if (next < 0) return; // já na primeira: ignora
      if (next >= stories.length) {
        close();
        return;
      }
      setIndex(next);
    },
    [stories.length, close],
  );

  // Marca como vista + roda a barra de progresso a cada troca de story.
  useEffect(() => {
    if (!ready || !current) return;
    if (!current.isMine) markStorySeen(current.activity_id).catch(() => {});

    progress.setValue(0);
    anim.current?.stop();
    anim.current = Animated.timing(progress, {
      toValue: 1,
      duration: STORY_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    anim.current.start(({ finished }) => {
      if (finished) goTo(index + 1);
    });
    return () => anim.current?.stop();
  }, [ready, current, index, progress, goTo]);

  const widths = useMemo(
    () => stories.map(() => progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })),
    [stories, progress],
  );

  if (!ready) {
    return (
      <View style={styles.flex}>
        <LinearGradient colors={SocialGradient} style={StyleSheet.absoluteFill} />
      </View>
    );
  }
  if (!current) {
    return (
      <Pressable style={[styles.flex, styles.center]} onPress={close}>
        <LinearGradient colors={SocialGradient} style={StyleSheet.absoluteFill} />
        <Text style={styles.empty}>Nenhuma story para ver agora.</Text>
        <Text style={styles.hint}>Toque para voltar</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.flex}>
      <LinearGradient colors={SocialGradient} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        {/* Barra de progresso segmentada (1 por pessoa). */}
        <View style={styles.topBar}>
          {stories.map((s, i) => (
            <View key={s.activity_id} style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  i < index ? styles.progressDone : i === index ? { width: widths[i] } : styles.progressEmpty,
                ]}
              />
            </View>
          ))}
        </View>

        <View style={styles.head}>
          <Text style={styles.avatar}>{current.avatar || '🦉'}</Text>
          <View style={styles.headText}>
            <Text style={styles.who} numberOfLines={1}>
              {current.isMine ? 'Você' : current.name}
              {current.founder ? ' 👑' : ''}
            </Text>
            <Text style={styles.time}>{tempoAtras(current.shared_at)}</Text>
          </View>
          <Pressable onPress={close} hitSlop={12}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>

        {/* Card central (stickers de informação + conteúdo do autor). */}
        <View style={styles.center} pointerEvents="none">
          <Text style={styles.kicker}>leu</Text>
          <Text style={styles.book} numberOfLines={3}>
            {current.book_title || 'um livro'}
          </Text>
          {current.sticker ? <Text style={styles.sticker}>{current.sticker}</Text> : null}
          <View style={styles.paginometro}>
            <Paginometro pages={current.pages} seconds={current.seconds} />
          </View>
          {current.caption ? (
            <Text style={styles.caption} numberOfLines={4}>
              {current.caption}
            </Text>
          ) : null}
          <Text style={styles.logo}>Dromos</Text>
        </View>

        {/* Rodapé: "visto por N" na minha, dica de avanço nas outras. */}
        <Text style={styles.footer}>
          {current.isMine ? `👁 visto por ${current.views ?? 0}` : 'toque para avançar'}
        </Text>

        {/* Zonas de toque (Insta): esquerda = anterior, direita = próximo. Ficam por cima
            do conteúdo mas abaixo do ✕ (que tem seu próprio hitSlop no head). */}
        <View style={styles.tapZones} pointerEvents="box-none">
          <Pressable style={styles.tapLeft} onPress={() => goTo(index - 1)} />
          <Pressable style={styles.tapRight} onPress={() => goTo(index + 1)} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  empty: { color: Social.white, fontSize: 16, fontWeight: '700' },
  topBar: { flexDirection: 'row', gap: 4, paddingHorizontal: 12, paddingTop: 8 },
  progressTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Social.green },
  progressDone: { width: '100%' },
  progressEmpty: { width: '0%' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  avatar: { fontSize: 26 },
  headText: { flex: 1 },
  who: { color: Social.white, fontSize: 15, fontWeight: '800' },
  time: { color: Social.muted, fontSize: 12, marginTop: 1 },
  close: { color: Social.white, fontSize: 20, fontWeight: '800' },
  kicker: { color: Social.lavender, fontSize: 16, letterSpacing: 1 },
  book: { color: Social.green, fontSize: 32, fontWeight: '900', textAlign: 'center', textShadowColor: Social.green, textShadowRadius: 16, marginTop: 4, paddingHorizontal: 28 },
  sticker: { fontSize: 48, marginTop: 14 },
  paginometro: { marginTop: 22 },
  caption: { color: Social.white, fontSize: 16, textAlign: 'center', marginTop: 18, paddingHorizontal: 28, lineHeight: 22 },
  logo: { color: Social.green, fontSize: 20, fontWeight: '900', marginTop: 30, textShadowColor: Social.green, textShadowRadius: 12 },
  footer: { color: Social.muted, fontSize: 13, textAlign: 'center', paddingBottom: 10 },
  tapZones: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 90, flexDirection: 'row' },
  tapLeft: { width: '32%' },
  tapRight: { flex: 1 },
  hint: { color: Social.muted, fontSize: 13, textAlign: 'center', marginTop: 8 },
});
