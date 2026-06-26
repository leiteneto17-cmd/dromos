/**
 * "Sessão concluída / Conquista desbloqueada" — overlay que fecha o laço Strava
 * (ler → registrar → comemorar → compartilhar). Aparece quando o reader empurra
 * uma celebração para o store efêmero (src/store/session.ts) ao terminar uma
 * sessão. Usa a identidade ROXO + VERDE da camada social (CLAUDE.md §2.7).
 *
 * Montado uma vez na raiz (src/app/_layout.tsx) para sobrepor qualquer tela.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandIcon } from '@/components/icon';
import { Social, SocialGradient } from '@/theme/social';
import { useSession } from '@/store/session';

/** Segundos → "12:34" (ou "1h 05:00" para sessões longas). */
function fmtClock(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}h ${mm}:${ss}` : `${mm}:${ss}`;
}

export function CelebrationOverlay() {
  const celebration = useSession((s) => s.celebration);
  const clear = useSession((s) => s.clearCelebration);

  const isSession = celebration?.kind === 'session';
  const hasAchievements = isSession && celebration.newAchievements.length > 0;

  function share() {
    if (celebration?.kind !== 'session') return;
    const sessionId = celebration.sessionId;
    clear();
    router.navigate({ pathname: '/compartilhar', params: { sessionId } });
  }

  const kicker =
    celebration?.kind === 'goal'
      ? '🎯 Meta concluída'
      : hasAchievements
        ? '🏆 Conquista desbloqueada'
        : '✅ Sessão concluída';

  return (
    <Modal visible={!!celebration} transparent animationType="fade" onRequestClose={clear}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <LinearGradient colors={SocialGradient} style={StyleSheet.absoluteFill} />

          <Text style={styles.kicker}>{kicker}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {celebration?.kind === 'goal' ? celebration.goalTitle : celebration?.bookTitle ?? ''}
          </Text>

          {celebration?.kind === 'session' ? (
            <>
              {/* Resumo da sessão (tempo + páginas) */}
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{fmtClock(celebration.seconds)}</Text>
                  <Text style={styles.statLabel}>tempo</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{celebration.pages}</Text>
                  <Text style={styles.statLabel}>{celebration.pages === 1 ? 'página' : 'páginas'}</Text>
                </View>
              </View>

              {hasAchievements ? (
                <ScrollView style={styles.achList} contentContainerStyle={styles.achListContent}>
                  {celebration.newAchievements.map((a) => (
                    <View key={a.id} style={styles.achRow}>
                      <Text style={styles.achIcon}>{a.icon}</Text>
                      <View style={styles.flex}>
                        <Text style={styles.achTitle}>{a.title}</Text>
                        <Text style={styles.achDesc}>{a.desc}</Text>
                      </View>
                      <Text style={styles.achCheck}>✓</Text>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.encoura}>Continue assim — cada sessão conta. 📖</Text>
              )}
            </>
          ) : (
            <View style={styles.goalBox}>
              <BrandIcon name="trophy" size={68} strokeWidth={2} />
              <Text style={styles.goalDetail}>{celebration?.detail ?? ''}</Text>
            </View>
          )}

          {/* Ações: compartilhar (só sessão — o card é da sessão) + concluir */}
          {isSession ? (
            <Pressable onPress={share} style={styles.shareBtn} accessibilityRole="button">
              <Text style={styles.shareBtnText}>📤 Compartilhar</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={clear} style={isSession ? styles.doneBtn : styles.shareBtn} accessibilityRole="button">
            <Text style={isSession ? styles.doneBtnText : styles.shareBtnText}>Concluir</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: '#000A', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 26,
    padding: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Social.border,
  },
  kicker: { color: Social.lavender, fontSize: 13, fontWeight: '700', letterSpacing: 0.5, textAlign: 'center' },
  title: { color: Social.white, fontSize: 22, fontWeight: '800', textAlign: 'center', marginTop: 6 },

  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22, marginTop: 22, marginBottom: 4 },
  stat: { alignItems: 'center' },
  statDivider: { width: 1, height: 38, backgroundColor: Social.border },
  statValue: {
    color: Social.green,
    fontSize: 28,
    fontWeight: '800',
    textShadowColor: 'rgba(125,243,173,0.4)',
    textShadowRadius: 10,
  },
  statLabel: { color: Social.muted, fontSize: 12, marginTop: 2 },

  achList: { maxHeight: 210, marginTop: 18 },
  achListContent: { gap: 10 },
  achRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Social.card,
    borderColor: Social.greenDeep,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  achIcon: { fontSize: 26 },
  achTitle: { color: Social.white, fontSize: 15, fontWeight: '800' },
  achDesc: { color: Social.lavender, fontSize: 12, marginTop: 1 },
  achCheck: { color: Social.green, fontSize: 18, fontWeight: '800' },

  encoura: { color: Social.lavender, fontSize: 14, textAlign: 'center', marginTop: 18 },

  goalBox: { alignItems: 'center', marginTop: 20 },
  goalDetail: { color: Social.green, fontSize: 16, fontWeight: '800', textAlign: 'center', marginTop: 10 },

  shareBtn: { marginTop: 22, borderRadius: 999, paddingVertical: 14, alignItems: 'center', backgroundColor: Social.greenDeep },
  shareBtnText: { color: Social.dark, fontSize: 15, fontWeight: '800' },
  doneBtn: { marginTop: 10, paddingVertical: 12, alignItems: 'center' },
  doneBtnText: { color: Social.lavender, fontSize: 14, fontWeight: '700' },
});
