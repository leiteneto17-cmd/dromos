/**
 * Card de estatísticas de leitura (Fase 3) na identidade roxo+verde (CLAUDE.md §2.7).
 * Layout DINÂMICO: alinhado à esquerda como o mockup, adapta-se à largura, sem
 * altura fixa. É a base do card compartilhável (Fase 5a) — a mesma View vira
 * imagem com react-native-view-shot.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { deriveStats, fmtHMS } from '@/services/progress';
import { Social, SocialGradient } from '@/theme/social';
import { useLibrary } from '@/store/library';

export function StatsCard() {
  const books = useLibrary((s) => s.books.length);
  const stats = useLibrary((s) => s.stats);
  const d = deriveStats(stats);

  return (
    <LinearGradient colors={SocialGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <Text style={styles.logo}>+leitura</Text>
      <Text style={styles.kicker}>Meu progresso</Text>

      <View style={styles.row}>
        <Metric value={`${books}`} unit={books === 1 ? 'livro' : 'livros'} label="Biblioteca" />
        <Metric value={`${d.avgMinPerDay}`} unit="min/dia" label="Consistência" />
      </View>

      <View style={styles.divider} />

      <Text style={styles.label}>Tempo total de leitura</Text>
      <Text style={styles.big}>{fmtHMS(d.totalSeconds)}</Text>

      <View style={styles.footer}>
        <View style={styles.streakBox}>
          <Text style={styles.streak}>
            🔥 {d.streak} {d.streak === 1 ? 'dia seguido' : 'dias seguidos'}
          </Text>
        </View>
        <Text style={styles.level}>Nível {d.level}</Text>
      </View>
    </LinearGradient>
  );
}

function Metric({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>
        {value}
        <Text style={styles.metricUnit}> {unit}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: Social.border,
  },
  logo: { color: Social.green, fontSize: 22, fontWeight: '800', textShadowColor: Social.green, textShadowRadius: 12 },
  kicker: { color: Social.lavender, fontSize: 13, letterSpacing: 1, marginTop: 2 },
  row: { flexDirection: 'row', gap: 16, marginTop: 22 },
  metric: { flex: 1 },
  metricLabel: { color: Social.lavender, fontSize: 13 },
  metricValue: { color: Social.green, fontSize: 30, fontWeight: '800', marginTop: 2, textShadowColor: Social.green, textShadowRadius: 10 },
  metricUnit: { color: Social.white, fontSize: 15, fontWeight: '400' },
  divider: { height: 1, backgroundColor: Social.border, marginVertical: 22 },
  label: { color: Social.white, fontSize: 15 },
  big: { color: Social.green, fontSize: 34, fontWeight: '800', marginTop: 4, textShadowColor: Social.green, textShadowRadius: 12 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24 },
  streakBox: { borderWidth: 1, borderColor: Social.lavender, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  streak: { color: Social.lavender, fontSize: 14, fontWeight: '700' },
  level: { color: Social.green, fontSize: 16, fontWeight: '800' },
});
