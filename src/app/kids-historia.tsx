/**
 * Leitor de carrossel do Dromos Kids — mostra uma história gerada (store/kids-stories) como
 * um "livrinho": uma página por tela, letras grandes e espaçadas, deslizando para o lado
 * (sensação de virar a página). Página 0 é a capa mágica (título + emoji).
 *
 * TODO (Fase 2): narração em áudio (🔊 "vovó conta história") reusando o motor de TTS do app
 * e capa ilustrada por IA — ver handoff da Fábrica de Histórias.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
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

import { BrandFont } from '@/constants/theme';
import { useKidsStories } from '@/store/kids-stories';
import { KIDS } from '@/theme/kids';

const { width: SCREEN_W } = Dimensions.get('window');

export default function KidsHistoriaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const story = useKidsStories((s) => s.stories.find((x) => x.id === id));
  const [page, setPage] = useState(0);
  const listRef = useRef<FlatList>(null);

  if (!story) {
    return (
      <SafeAreaView style={[styles.flex, styles.center, { backgroundColor: KIDS.to }]}>
        <Text style={styles.missing}>Ops! Não encontrei essa história.</Text>
        <Pressable onPress={() => router.back()} style={styles.missingBtn}>
          <Text style={styles.missingBtnText}>‹ Voltar</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // Página 0 = capa; depois as páginas do texto.
  const slides = ['__cover__', ...story.paginas];
  const total = slides.length;

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const p = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (p !== page) setPage(p);
  }

  function go(delta: number) {
    const next = Math.min(Math.max(page + delta, 0), total - 1);
    listRef.current?.scrollToOffset({ offset: next * SCREEN_W, animated: true });
    setPage(next);
  }

  return (
    <View style={[styles.flex, { backgroundColor: KIDS.to }]}>
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {story.titulo}
          </Text>
          <View style={styles.closeSpacer} />
        </View>

        <FlatList
          ref={listRef}
          data={slides}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          renderItem={({ item, index }) =>
            index === 0 ? (
              <View style={[styles.slide, styles.coverSlide]}>
                <Text style={styles.coverEmoji}>{story.coverEmoji}</Text>
                <Text style={styles.coverTitle}>{story.titulo}</Text>
                <Text style={styles.coverMeta}>
                  {story.kindLabel} · {story.moralLabel}
                </Text>
                <Text style={styles.coverSwipe}>deslize para começar →</Text>
              </View>
            ) : (
              <View style={styles.slide}>
                <Text style={styles.pageNum}>{index}</Text>
                <Text style={styles.pageText}>{item}</Text>
              </View>
            )
          }
        />

        {/* Rodapé: setas + progresso em bolinhas. */}
        <View style={styles.footer}>
          <Pressable onPress={() => go(-1)} disabled={page === 0} hitSlop={8} style={[styles.arrow, { opacity: page === 0 ? 0.3 : 1 }]}>
            <Text style={styles.arrowText}>‹</Text>
          </Pressable>
          <View style={styles.dots}>
            {slides.map((_, i) => (
              <View key={i} style={[styles.dot, { backgroundColor: i === page ? KIDS.mint : 'rgba(255,255,255,0.25)' }]} />
            ))}
          </View>
          <Pressable onPress={() => go(1)} disabled={page === total - 1} hitSlop={8} style={[styles.arrow, { opacity: page === total - 1 ? 0.3 : 1 }]}>
            <Text style={styles.arrowText}>›</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 16 },
  missing: { color: KIDS.ink, fontSize: 17, fontWeight: '700' },
  missingBtn: { borderRadius: 999, borderWidth: 1.5, borderColor: KIDS.mint, paddingHorizontal: 20, paddingVertical: 10 },
  missingBtnText: { color: KIDS.mint, fontSize: 15, fontWeight: '800' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  close: { color: KIDS.violet, fontSize: 22, fontWeight: '800', width: 28 },
  closeSpacer: { width: 28 },
  headerTitle: { flex: 1, textAlign: 'center', color: KIDS.ink, fontSize: 15, fontWeight: '800' },
  slide: { width: SCREEN_W, paddingHorizontal: 30, alignItems: 'center', justifyContent: 'center' },
  coverSlide: { gap: 14 },
  coverEmoji: { fontSize: 84 },
  coverTitle: { color: KIDS.ink, fontSize: 30, fontFamily: BrandFont.extrabold, textAlign: 'center', lineHeight: 36 },
  coverMeta: { color: KIDS.violetSoft, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  coverSwipe: { color: KIDS.mint, fontSize: 15, fontWeight: '800', marginTop: 10 },
  pageNum: { color: 'rgba(185,166,232,0.5)', fontSize: 20, fontWeight: '900', marginBottom: 20 },
  pageText: { color: KIDS.ink, fontSize: 24, lineHeight: 38, fontWeight: '600', textAlign: 'center', letterSpacing: 0.3 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 12 },
  arrow: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  arrowText: { color: KIDS.ink, fontSize: 26, fontWeight: '900', lineHeight: 28 },
  dots: { flexDirection: 'row', gap: 7, flex: 1, justifyContent: 'center', flexWrap: 'wrap' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
