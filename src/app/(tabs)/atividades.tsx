/**
 * Aba Atividades — cada período de leitura como um "treino" (estilo Strava).
 * Usa dados REAIS (store.stats.perDay): resumo do dia, últimos 7 dias e recordes.
 * Base neutra; verde = números/ação, roxo = detalhe (CLAUDE.md §2.6/§2.7).
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, ScreenBG, SectionTitle } from '@/components/social-ui';
import { useUI } from '@/hooks/use-ui';
import { syncActivities } from '@/services/activity-sync';
import { deriveStats, fmtHMS } from '@/services/progress';
import { getFeed, toggleKudo, type FeedItem } from '@/services/social';
import { useAuth } from '@/store/auth';
import { useLibrary } from '@/store/library';

/** Data amigável da sessão: "hoje 14:30", "ontem 09:10" ou "12/06/2026". Usa data
 * LOCAL (não UTC) para casar com a hora local exibida — senão erra "hoje/ontem" perto
 * da meia-noite. */
function fmtSessionDate(ts: number): string {
  const d = new Date(ts);
  const localKey = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const hhmm = d.toTimeString().slice(0, 5);
  if (localKey(d) === localKey(today)) return `hoje ${hhmm}`;
  if (localKey(d) === localKey(yesterday)) return `ontem ${hhmm}`;
  return d.toLocaleDateString('pt-BR');
}

export default function ActivitiesScreen() {
  const c = useUI();
  const stats = useLibrary((s) => s.stats);
  const sessions = useLibrary((s) => s.sessions);
  const session = useAuth((s) => s.session);
  const configured = useAuth((s) => s.configured);
  const d = deriveStats(stats);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [feedOpen, setFeedOpen] = useState(false); // recolhido por padrão (economiza espaço)

  // Ao abrir a aba: sobe sessões pendentes (no-op se deslogado) e carrega o feed.
  useFocusEffect(
    useCallback(() => {
      syncActivities();
      if (session) getFeed().then(setFeed);
      else setFeed([]);
    }, [session]),
  );

  const onKudo = useCallback(async (item: FeedItem) => {
    const on = !item.iKudoed;
    // otimista: atualiza na hora; reverte se der erro
    setFeed((prev) =>
      prev.map((f) => (f.id === item.id ? { ...f, iKudoed: on, kudos: f.kudos + (on ? 1 : -1) } : f)),
    );
    const err = await toggleKudo(item.id, on);
    if (err) {
      setFeed((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, iKudoed: !on, kudos: f.kudos + (on ? -1 : 1) } : f)),
      );
    }
  }, []);

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayMin = Math.round((stats.perDay[todayKey] ?? 0) / 60);
  const weekMin = d.last7.reduce((a, x) => a + x.minutes, 0);
  const pendingCount = sessions.filter((s) => !s.synced).length;

  return (
    <ScreenBG>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: c.text }]}>Atividades</Text>
        <Pressable
          onPress={() => router.navigate('/compartilhar')}
          style={[styles.shareChip, { borderColor: c.green }]}>
          <Text style={[styles.shareChipText, { color: c.green }]}>📤 Compartilhar</Text>
        </Pressable>
      </View>

      {/* Feed — leituras de quem você segue (camada social, §2.6). Recolhível. */}
      {session ? (
        <>
          <Pressable style={styles.feedHeader} onPress={() => setFeedOpen((o) => !o)}>
            <View style={styles.feedHeaderLeft}>
              <Text style={styles.feedHeaderIcon}>📡</Text>
              <Text style={[styles.feedHeaderTitle, { color: c.purple }]}>
                Seguindo{feed.length > 0 ? ` (${feed.length})` : ''}
              </Text>
            </View>
            <Text style={[styles.feedChevron, { color: c.purple }]}>{feedOpen ? '▾' : '▸'}</Text>
          </Pressable>
          {!feedOpen ? null : feed.length === 0 ? (
            <Text style={[styles.hint, { color: c.textFaint, marginTop: 0, textAlign: 'left' }]}>
              Siga leitores (toque no nome de quem escreve resenhas) e ative seu perfil público no Perfil para
              que as leituras apareçam aqui.
            </Text>
          ) : (
            feed.map((f) => (
              <Card key={f.id} style={styles.feedRow}>
                <Pressable
                  onPress={() => router.push({ pathname: '/usuario', params: { id: f.user_id, name: f.author_name } })}>
                  <Text style={styles.feedAvatar}>{f.author_avatar || '🦉'}</Text>
                </Pressable>
                <View style={styles.flex}>
                  <Text style={[styles.feedWho, { color: c.text }]} numberOfLines={1}>
                    <Text style={{ fontWeight: '800' }}>{f.author_name}</Text> leu
                  </Text>
                  <Text style={[styles.feedBook, { color: c.textDim }]} numberOfLines={1}>
                    {f.book_title}
                  </Text>
                  <Text style={[styles.feedMeta, { color: c.textFaint }]}>
                    {fmtSessionDate(new Date(f.created_at).getTime())} · {Math.max(1, Math.round(f.seconds / 60))} min
                    {f.pages ? ` · ${f.pages} ${f.pages === 1 ? 'pág' : 'págs'}` : ''}
                  </Text>
                </View>
                <Pressable onPress={() => onKudo(f)} hitSlop={8} style={styles.kudoBtn}>
                  <Text style={[styles.kudoIcon, { opacity: f.iKudoed ? 1 : 0.4 }]}>👏</Text>
                  {f.kudos > 0 ? (
                    <Text style={[styles.kudoCount, { color: f.iKudoed ? c.green : c.textFaint }]}>{f.kudos}</Text>
                  ) : null}
                </Pressable>
              </Card>
            ))
          )}
        </>
      ) : null}

      {/* Resumo do dia */}
      <SectionTitle icon="🏃">Resumo do dia</SectionTitle>
      <Card glow>
        <View style={styles.dayRow}>
          <View>
            <Text style={[styles.bigGreen, { color: c.green }]}>
              {todayMin}
              <Text style={[styles.unit, { color: c.text }]}> min</Text>
            </Text>
            <Text style={[styles.dayLabel, { color: c.textFaint }]}>hoje</Text>
          </View>
          <View style={[styles.dayDivider, { backgroundColor: c.border }]} />
          <View>
            <Text style={[styles.bigGreen, { color: c.green }]}>
              {weekMin}
              <Text style={[styles.unit, { color: c.text }]}> min</Text>
            </Text>
            <Text style={[styles.dayLabel, { color: c.textFaint }]}>na semana</Text>
          </View>
        </View>
        <WeekBars data={d.last7} />
      </Card>

      {/* Totais */}
      <SectionTitle icon="📊">Totais</SectionTitle>
      <View style={styles.statGrid}>
        <StatBox label="Tempo total" value={fmtHMS(d.totalSeconds)} />
        <StatBox label="Dias lidos" value={`${d.activeDays}`} />
        <StatBox label="Média/dia" value={`${d.avgMinPerDay} min`} />
        <StatBox label="Sequência" value={`${d.streak} ${d.streak === 1 ? 'dia' : 'dias'}`} />
      </View>

      {/* Recordes */}
      <SectionTitle icon="🥇">Recordes pessoais</SectionTitle>
      <Card style={styles.recordRow}>
        <Text style={[styles.recordLabel, { color: c.text }]}>Melhor dia de leitura</Text>
        <Text style={[styles.recordValue, { color: c.green }]}>{d.bestDayMinutes} min</Text>
      </Card>
      <Card style={styles.recordRow}>
        <Text style={[styles.recordLabel, { color: c.text }]}>Maior sequência atual</Text>
        <Text style={[styles.recordValue, { color: c.green }]}>
          {d.streak} {d.streak === 1 ? 'dia' : 'dias'}
        </Text>
      </Card>

      {/* Sessões recentes (cada período de leitura = uma "atividade", §2.6) */}
      {sessions.length > 0 ? (
        <>
          <SectionTitle icon="📖">Sessões recentes</SectionTitle>
          {configured && !session ? (
            <Pressable onPress={() => router.navigate('/login')} style={styles.syncHint}>
              <Text style={[styles.syncHintText, { color: c.green }]}>
                Entre para sincronizar suas atividades na nuvem ›
              </Text>
            </Pressable>
          ) : configured && session && pendingCount > 0 ? (
            <Text style={[styles.syncHint, styles.syncHintText, { color: c.textFaint }]}>
              ↻ {pendingCount} {pendingCount === 1 ? 'sessão pendente' : 'sessões pendentes'}…
            </Text>
          ) : null}
          {sessions.slice(0, 8).map((s) => (
            <Pressable
              key={s.id}
              onPress={() =>
                router.navigate({ pathname: '/compartilhar', params: { sessionId: s.id } })
              }>
              <Card style={styles.sessionRow}>
                <View style={styles.sessionInfo}>
                  <Text style={[styles.sessionTitle, { color: c.text }]} numberOfLines={1}>
                    {s.bookTitle}
                  </Text>
                  <Text style={[styles.sessionMeta, { color: c.textFaint }]}>
                    {fmtSessionDate(s.startedAt)}
                    {configured && session ? (s.synced ? ' · ☁️' : ' · ↻') : ''}
                  </Text>
                </View>
                <View style={styles.sessionStats}>
                  <Text style={[styles.sessionValue, { color: c.green }]}>
                    {Math.max(1, Math.round(s.seconds / 60))} min
                  </Text>
                  {s.pages > 0 ? (
                    <Text style={[styles.sessionPages, { color: c.textFaint }]}>
                      {s.pages} {s.pages === 1 ? 'pág' : 'págs'}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.sessionShare}>📤</Text>
              </Card>
            </Pressable>
          ))}
        </>
      ) : null}

      {d.totalSeconds === 0 ? (
        <Text style={[styles.hint, { color: c.textFaint }]}>
          Comece a ler na aba Leitura — o tempo é registrado automaticamente e aparece aqui.
        </Text>
      ) : null}
    </ScreenBG>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  const c = useUI();
  return (
    <Card style={styles.statBox}>
      <Text style={[styles.statValue, { color: c.green }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: c.textFaint }]}>{label}</Text>
    </Card>
  );
}

function WeekBars({ data }: { data: { label: string; minutes: number }[] }) {
  const c = useUI();
  const max = Math.max(10, ...data.map((x) => x.minutes));
  return (
    <View style={styles.bars}>
      {data.map((x, i) => (
        <View key={i} style={styles.barCol}>
          <View style={[styles.barTrack, { backgroundColor: c.cardElevated }]}>
            <View
              style={[
                styles.bar,
                { backgroundColor: c.green, height: `${Math.round((x.minutes / max) * 100)}%`, opacity: x.minutes ? 1 : 0.25 },
              ]}
            />
          </View>
          <Text style={[styles.barLabel, { color: c.textFaint }]}>{x.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 28, fontWeight: '800' },
  shareChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  shareChipText: { fontSize: 13, fontWeight: '700' },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  dayDivider: { width: 1, height: 40 },
  bigGreen: { fontSize: 30, fontWeight: '800' },
  unit: { fontSize: 15, fontWeight: '400' },
  dayLabel: { fontSize: 13, marginTop: 2 },
  bars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 90, marginTop: 18, gap: 6 },
  barCol: { flex: 1, alignItems: 'center' },
  barTrack: { width: '100%', height: 70, justifyContent: 'flex-end', borderRadius: 6, overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 6 },
  barLabel: { fontSize: 11, marginTop: 5 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statBox: { width: '47.8%', flexGrow: 1 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 13, marginTop: 4 },
  recordRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  recordLabel: { fontSize: 15 },
  recordValue: { fontSize: 18, fontWeight: '800' },
  hint: { fontSize: 13, lineHeight: 20, marginTop: 16, textAlign: 'center' },
  syncHint: { marginBottom: 10 },
  syncHintText: { fontSize: 13 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  sessionInfo: { flex: 1 },
  sessionTitle: { fontSize: 15, fontWeight: '700' },
  sessionMeta: { fontSize: 13, marginTop: 2 },
  sessionStats: { alignItems: 'flex-end' },
  sessionValue: { fontSize: 16, fontWeight: '800' },
  sessionPages: { fontSize: 12, marginTop: 2 },
  sessionShare: { fontSize: 16, marginLeft: 2 },
  feedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 },
  feedHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  feedHeaderIcon: { fontSize: 18 },
  feedHeaderTitle: { fontSize: 18, fontWeight: '700', letterSpacing: 0.3 },
  feedChevron: { fontSize: 16, fontWeight: '800' },
  feedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  feedAvatar: { fontSize: 30 },
  feedWho: { fontSize: 14 },
  feedBook: { fontSize: 14, fontWeight: '700', marginTop: 1 },
  feedMeta: { fontSize: 12, marginTop: 3 },
  kudoBtn: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, minWidth: 36 },
  kudoIcon: { fontSize: 22 },
  kudoCount: { fontSize: 12, fontWeight: '800', marginTop: 2 },
});
