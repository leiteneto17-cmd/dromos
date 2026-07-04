/**
 * DESAFIOS — tela dos desafios do período (estilo Strava Challenges). v1 local
 * (services/desafios.ts): progresso derivado das sessões/stats já existentes,
 * participação automática, sem backend. Ranking entre amigos e troféu no perfil
 * ficam pra v2. Pele hub roxo+verde (§2.7 — camada social/stats).
 */
import { router } from 'expo-router';
import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';

import { AdBanner } from '@/components/ad-banner';
import { BrandFont } from '@/constants/theme';
import { Card, ScreenBG } from '@/components/social-ui';
import { useUI } from '@/hooks/use-ui';
import { computeDesafios, type Desafio } from '@/services/desafios';
import { useLibrary } from '@/store/library';

export default function DesafiosScreen() {
  const c = useUI();
  const stats = useLibrary((s) => s.stats);
  const sessions = useLibrary((s) => s.sessions);

  const desafios = computeDesafios(stats, sessions);
  const semana = desafios.filter((d) => d.period === 'Esta semana');
  const mes = desafios.filter((d) => d.period !== 'Esta semana');
  const concluidos = desafios.filter((d) => d.done).length;

  return (
    <ScreenBG scroll={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
          <Text style={[styles.backText, { color: c.textDim }]}>‹ Voltar</Text>
        </Pressable>
      </View>

      <Text style={[styles.title, { color: c.text }]}>🏆 Desafios</Text>
      <Text style={[styles.subtitle, { color: c.textFaint }]}>
        Desafios do período contam sua leitura automaticamente — complete e mantenha o hábito
        vivo. {concluidos > 0 ? `Você já concluiu ${concluidos} ✓` : 'Toda leitura conta!'}
      </Text>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <Text style={[styles.section, { color: c.purple }]}>ESTA SEMANA</Text>
        {semana.map((d) => (
          <DesafioCard key={d.id} d={d} />
        ))}

        <Text style={[styles.section, { color: c.purple, marginTop: 10 }]}>
          {mes[0]?.period.toUpperCase() ?? 'ESTE MÊS'}
        </Text>
        {mes.map((d) => (
          <DesafioCard key={d.id} d={d} />
        ))}

        <Text style={[styles.note, { color: c.textFaint }]}>
          Os desafios renovam a cada semana/mês. Ranking entre amigos vem em breve. 👀
        </Text>
      </ScrollView>

      <AdBanner style={styles.ad} />
    </ScreenBG>
  );
}

function DesafioCard({ d }: { d: Desafio }) {
  const c = useUI();
  return (
    <Card style={[styles.card, d.done && { borderColor: c.green, borderWidth: 1.5 }]}>
      <View style={styles.cardTop}>
        <Text style={styles.icon}>{d.icon}</Text>
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: c.text }]}>{d.title}</Text>
          <Text style={[styles.cardDesc, { color: c.textFaint }]}>{d.desc}</Text>
        </View>
        {d.done ? <Text style={[styles.doneMark, { color: c.green }]}>✓</Text> : null}
      </View>
      <View style={[styles.track, { backgroundColor: c.border }]}>
        <View
          style={[
            styles.fill,
            { backgroundColor: c.green, width: `${Math.round(d.pct * 100)}%` },
          ]}
        />
      </View>
      <Text style={[styles.meta, { color: d.done ? c.green : c.textDim }]}>
        {d.done
          ? 'Concluído! 🎉'
          : `${d.current.toLocaleString('pt-BR')} / ${d.target.toLocaleString('pt-BR')} ${d.unit}`}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  back: { paddingVertical: 4, paddingRight: 8 },
  backText: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 28, fontFamily: BrandFont.extrabold },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 2, marginBottom: 12 },
  list: { gap: 12, paddingTop: 4, paddingBottom: 24 },
  section: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  card: { gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { fontSize: 26 },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  cardDesc: { fontSize: 13, lineHeight: 18 },
  doneMark: { fontSize: 22, fontWeight: '900' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  meta: { fontSize: 13, fontWeight: '700' },
  note: { fontSize: 12.5, lineHeight: 18, textAlign: 'center', marginTop: 8 },
  ad: { marginTop: 12 },
});
