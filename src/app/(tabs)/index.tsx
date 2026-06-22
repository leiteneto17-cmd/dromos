/**
 * HUB (aba Leitura) — tela inicial estilo "TrackSync Hub": cabeçalho de perfil,
 * "Continuar lendo", biblioteca atual (carrossel) e progresso da semana.
 * Base neutra (60-30-10) com roxo+verde só como acento (CLAUDE.md §2.7).
 * Abrir um livro empurra o leitor (/reader) por cima das abas.
 */
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MyShelf } from '@/components/my-shelf';
import { ProfileHeader } from '@/components/profile-header';
import { Card, ScreenBG, SectionTitle } from '@/components/social-ui';
import { importBookFlow } from '@/app/biblioteca';
import { useUI } from '@/hooks/use-ui';
import { computeAchievements, deriveStats } from '@/services/progress';
import { displayName, useAuth } from '@/store/auth';
import { useLibrary, type ImportedBook } from '@/store/library';
import { useProfile } from '@/store/profile';

const TILE_COLORS = ['#4C3A7A', '#3A5A78', '#6A3A5A', '#3A6A55', '#5A4A2A'];

export default function HubScreen() {
  const c = useUI();
  const books = useLibrary((s) => s.books);
  const vocab = useLibrary((s) => s.vocab);
  const stats = useLibrary((s) => s.stats);
  const currentBookId = useLibrary((s) => s.currentBookId);
  const openBook = useLibrary((s) => s.openBook);
  const addBook = useLibrary((s) => s.addBook);
  const user = useAuth((s) => s.user);
  const profile = useProfile((s) => s.profile);

  const derived = deriveStats(stats);
  const achievements = computeAchievements({
    booksCount: books.length,
    vocabCount: vocab.length,
    derived,
  });

  const current = books.find((b) => b.id === currentBookId) ?? books[0] ?? null;
  const weekMinutes = derived.last7.reduce((a, day) => a + day.minutes, 0);

  function open(book: ImportedBook) {
    openBook(book.id);
    router.navigate('/reader');
  }

  function continueReading() {
    if (current) openBook(current.id);
    router.navigate('/reader');
  }

  return (
    <ScreenBG>
      <ProfileHeader
        name={profile?.name?.trim() || displayName(user)}
        avatar={profile?.avatar_url}
        derived={derived}
        achievements={achievements}
      />

      {/* Continuar lendo */}
      <SectionTitle icon="📖">Continuar lendo</SectionTitle>
      <Card glow>
        {current ? (
          <>
            <Text style={[styles.kicker, { color: c.purple }]}>{current.format.toUpperCase()}</Text>
            <Text style={[styles.bookTitle, { color: c.text }]} numberOfLines={2}>
              {current.title ?? current.name}
            </Text>
            <Text style={[styles.bookSub, { color: c.textFaint }]}>
              {current.format === 'pdf' ? 'PDF · convertido para leitura' : 'EPUB'}
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.bookTitle, { color: c.text }]}>Dom Casmurro</Text>
            <Text style={[styles.bookSub, { color: c.textFaint }]}>Amostra · Machado de Assis</Text>
          </>
        )}
        <Pressable onPress={continueReading} style={[styles.cta, { backgroundColor: c.green }]}>
          <Text style={[styles.ctaText, { color: c.onGreen }]}>
            {current ? 'Continuar Lendo' : 'Ler amostra'}
          </Text>
        </Pressable>
      </Card>

      {/* Biblioteca atual */}
      <View style={styles.sectionHeadRow}>
        <SectionTitle icon="📚">Biblioteca atual</SectionTitle>
        <Pressable onPress={() => router.navigate('/biblioteca')} hitSlop={8}>
          <Text style={[styles.link, { color: c.green }]}>Ver tudo ›</Text>
        </Pressable>
      </View>

      {books.length === 0 ? (
        <Card>
          <Text style={[styles.emptyText, { color: c.textFaint }]}>
            Sua estante está vazia. Importe um .epub ou .pdf para começar.
          </Text>
          <Pressable
            onPress={() => importBookFlow(addBook, () => router.navigate('/reader'))}
            style={[styles.cta, { backgroundColor: c.green }]}>
            <Text style={[styles.ctaText, { color: c.onGreen }]}>+ Importar livro</Text>
          </Pressable>
        </Card>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>
          {books.map((b, i) => (
            <Pressable key={b.id} onPress={() => open(b)} style={styles.tileWrap}>
              <View style={[styles.tile, { backgroundColor: TILE_COLORS[i % TILE_COLORS.length], borderColor: c.border }]}>
                <Text style={styles.tileBadge}>{b.format.toUpperCase()}</Text>
                <Text style={styles.tileTitle} numberOfLines={4}>
                  {b.title ?? b.name}
                </Text>
              </View>
              <Text style={[styles.tileCaption, { color: c.textFaint }]} numberOfLines={1}>
                {b.title ?? b.name}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => importBookFlow(addBook, () => router.navigate('/reader'))}
            style={styles.tileWrap}>
            <View style={[styles.tile, styles.tileAdd, { backgroundColor: c.cardElevated, borderColor: c.border }]}>
              <Text style={[styles.tileAddPlus, { color: c.green }]}>+</Text>
            </View>
            <Text style={[styles.tileCaption, { color: c.textFaint }]}>Importar</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* Minha estante (catálogo Skoob) — movida da Comunidade */}
      <MyShelf />

      {/* Progresso da semana */}
      <SectionTitle icon="📈">Progresso da semana</SectionTitle>
      <Card>
        <Text style={[styles.weekTotal, { color: c.green }]}>
          {weekMinutes}
          <Text style={[styles.weekUnit, { color: c.text }]}> min</Text>
          <Text style={[styles.weekLabel, { color: c.textFaint }]}>  nos últimos 7 dias</Text>
        </Text>
        <WeekBars data={derived.last7} />
      </Card>
    </ScreenBG>
  );
}

function WeekBars({ data }: { data: { label: string; minutes: number }[] }) {
  const c = useUI();
  const max = Math.max(10, ...data.map((d) => d.minutes));
  return (
    <View style={styles.bars}>
      {data.map((d, i) => (
        <View key={i} style={styles.barCol}>
          <View style={[styles.barTrack, { backgroundColor: c.cardElevated }]}>
            <View
              style={[
                styles.bar,
                { backgroundColor: c.green, height: `${Math.round((d.minutes / max) * 100)}%`, opacity: d.minutes ? 1 : 0.25 },
              ]}
            />
          </View>
          <Text style={[styles.barLabel, { color: c.textFaint }]}>{d.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  bookTitle: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  bookSub: { fontSize: 14, marginTop: 4 },
  cta: { marginTop: 16, borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  ctaText: { fontSize: 15, fontWeight: '800' },
  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { fontSize: 14, fontWeight: '700' },
  emptyText: { fontSize: 14, lineHeight: 21 },
  shelf: { gap: 14, paddingVertical: 4, paddingRight: 8 },
  tileWrap: { width: 110 },
  tile: { width: 110, height: 156, borderRadius: 12, padding: 10, justifyContent: 'space-between', borderWidth: 1 },
  tileBadge: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '800' },
  tileTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  tileCaption: { fontSize: 12, marginTop: 6 },
  tileAdd: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' },
  tileAddPlus: { fontSize: 40, fontWeight: '300' },
  weekTotal: { fontSize: 30, fontWeight: '800' },
  weekUnit: { fontSize: 16, fontWeight: '400' },
  weekLabel: { fontSize: 13, fontWeight: '400' },
  bars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 90, marginTop: 16, gap: 6 },
  barCol: { flex: 1, alignItems: 'center' },
  barTrack: { width: '100%', height: 70, justifyContent: 'flex-end', borderRadius: 6, overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 6 },
  barLabel: { fontSize: 11, marginTop: 5 },
});
