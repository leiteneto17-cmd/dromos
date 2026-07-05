/**
 * Story em tela cheia (DESIGN-STORIES.md, S1) — mostra a leitura publicada de uma pessoa
 * como um card grande sobre o gradiente da marca. Toque em qualquer lugar OU ✕ fecha.
 * Auto-avançar entre várias pessoas + reações (Logos/responder) ficam para a S2/S3.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Social, SocialGradient } from '@/theme/social';

export default function StoryScreen() {
  const p = useLocalSearchParams<{
    name?: string;
    avatar?: string;
    book?: string;
    seconds?: string;
    pages?: string;
    founder?: string;
  }>();
  const min = Math.max(1, Math.round(Number(p.seconds ?? 0) / 60));
  const pages = Number(p.pages ?? 0);

  return (
    <Pressable style={styles.flex} onPress={() => router.back()}>
      <LinearGradient colors={SocialGradient} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        {/* Barra de progresso (1 story por enquanto) + cabeçalho */}
        <View style={styles.topBar}>
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>
        </View>
        <View style={styles.head}>
          <Text style={styles.avatar}>{p.avatar || '🦉'}</Text>
          <Text style={styles.who} numberOfLines={1}>
            {p.name || 'Leitor(a)'}
            {p.founder ? ' 👑' : ''}
          </Text>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>

        {/* Card central */}
        <View style={styles.center}>
          <Text style={styles.kicker}>leu</Text>
          <Text style={styles.book} numberOfLines={3}>
            {p.book || 'um livro'}
          </Text>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{min}</Text>
              <Text style={styles.statLabel}>min</Text>
            </View>
            {pages > 0 ? (
              <View style={styles.stat}>
                <Text style={styles.statNum}>{pages}</Text>
                <Text style={styles.statLabel}>{pages === 1 ? 'página' : 'páginas'}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.logo}>Dromos</Text>
        </View>

        <Text style={styles.hint}>Toque para fechar</Text>
      </SafeAreaView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { paddingHorizontal: 12, paddingTop: 8 },
  progressTrack: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  progressFill: { height: '100%', width: '100%', backgroundColor: Social.green },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  avatar: { fontSize: 26 },
  who: { flex: 1, color: Social.white, fontSize: 15, fontWeight: '800' },
  close: { color: Social.white, fontSize: 20, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 6 },
  kicker: { color: Social.lavender, fontSize: 16, letterSpacing: 1 },
  book: { color: Social.green, fontSize: 34, fontWeight: '900', textAlign: 'center', textShadowColor: Social.green, textShadowRadius: 16, marginTop: 4 },
  stats: { flexDirection: 'row', gap: 36, marginTop: 26 },
  stat: { alignItems: 'center' },
  statNum: { color: Social.green, fontSize: 40, fontWeight: '900' },
  statLabel: { color: Social.white, fontSize: 15, marginTop: 2 },
  logo: { color: Social.green, fontSize: 22, fontWeight: '900', marginTop: 40, textShadowColor: Social.green, textShadowRadius: 12 },
  hint: { color: Social.muted, fontSize: 13, textAlign: 'center', paddingBottom: 10 },
});
