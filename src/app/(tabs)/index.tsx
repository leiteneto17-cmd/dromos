/**
 * HUB (aba Leitura) — "Feed" estilo referência 2026 (image_75a1a1.jpg): fundo VERDE
 * vibrante (clean), header avatar + busca/sino, card "Lendo agora" roxo (progresso real),
 * cards BRANCOS de atividade (dados reais de sessão) e gráfico semanal, biblioteca + estante.
 *
 * Esta tela tem cores próprias (verde + branco) para bater com a imagem aprovada — não
 * segue o claro/escuro do app (é a "pele" do feed). O leitor continua sépia/claro/escuro.
 */
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { AdBanner } from '@/components/ad-banner';
import { importBookFlow } from '@/app/(tabs)/biblioteca';
import { BottomTabInset } from '@/constants/theme';
import { restoreActivities } from '@/services/activity-sync';
import { backfillCovers } from '@/services/cover-backfill';
import { computeDesafios } from '@/services/desafios';
import { getUnreadCount } from '@/services/notifications';
import { deriveGoal, deriveStats } from '@/services/progress';
import { displayName, useAuth } from '@/store/auth';
import { useLibrary, type ImportedBook } from '@/store/library';
import { useProfile } from '@/store/profile';
import { HUB } from '@/theme/hub';

const TILE_COLORS = ['#4C3A7A', '#3A5A78', '#6A3A5A', '#3A6A55', '#5A4A2A'];

function SearchIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={HUB.onBg} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="11" cy="11" r="7" />
      <Path d="M21 21l-4.3-4.3" />
    </Svg>
  );
}

function BellIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={HUB.onBg} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5 2 5.5H4c.5-.5 2-1.5 2-5.5" />
      <Path d="M10 19.5a2 2 0 0 0 4 0" />
    </Svg>
  );
}

function fmtMin(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60));
}

function fmtDay(ts: number): string {
  const d = new Date(ts);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? `hoje ${d.toTimeString().slice(0, 5)}` : d.toLocaleDateString('pt-BR');
}

export default function HubScreen() {
  const books = useLibrary((s) => s.books);
  const stats = useLibrary((s) => s.stats);
  const sessions = useLibrary((s) => s.sessions);
  const progress = useLibrary((s) => s.progress);
  const currentBookId = useLibrary((s) => s.currentBookId);
  const openBook = useLibrary((s) => s.openBook);
  const addBook = useLibrary((s) => s.addBook);
  const user = useAuth((s) => s.user);
  const profile = useProfile((s) => s.profile);

  const goals = useLibrary((s) => s.goals);
  const bookPages = useLibrary((s) => s.bookPages);

  const derived = deriveStats(stats);
  const current = books.find((b) => b.id === currentBookId) ?? books[0] ?? null;
  const pct = current ? Math.round((progress[current.id] ?? 0) * 100) : 0;
  const weekMinutes = derived.last7.reduce((a, day) => a + day.minutes, 0);
  const lastSession = sessions[0] ?? null;

  // --- Home do Hábito (alma do app = Strava social + bons hábitos, 2026-07-02) ---
  // Tudo derivado do que já existe: streak/last7 (deriveStats), metas e desafios locais.
  const readToday = (derived.last7[6]?.minutes ?? 0) > 0;
  const activeGoal = goals.find((g) => !g.doneAt) ?? null;
  const goalProg = activeGoal
    ? deriveGoal(
        activeGoal,
        stats,
        activeGoal.bookId
          ? { progress: progress[activeGoal.bookId] ?? 0, pages: bookPages[activeGoal.bookId] ?? 0 }
          : undefined,
      )
    : null;
  const desafios = computeDesafios(stats, sessions);
  // Destaque: o desafio em aberto mais perto de completar (senão o primeiro concluído).
  const topDesafio = desafios.filter((d) => !d.done).sort((a, b) => b.pct - a.pct)[0] ?? desafios[0];

  const name = profile?.name?.trim() || displayName(user);
  const firstName = name.split(' ')[0];
  const avatar = profile?.avatar_url;

  // Bolinha do sino: quantas notificações chegaram desde a última visita. Recarrega ao
  // focar o hub (volta de /notificacoes zera, pois a tela marca como visto ao abrir).
  const [unread, setUnread] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getUnreadCount().then((n) => alive && setUnread(n));
      return () => {
        alive = false;
      };
    }, []),
  );

  // Capas: extrai (uma vez) a capa embutida dos EPUBs importados antes de termos
  // `coverUrl`. Roda em segundo plano — o livro aparece com 📖 e troca pela capa.
  useEffect(() => {
    void backfillCovers();
    // Restaura histórico/estatísticas da nuvem num install/aparelho novo (1× por usuário).
    void restoreActivities();
  }, []);

  function open(book: ImportedBook) {
    openBook(book.id);
    router.navigate('/reader');
  }

  function continueReading() {
    if (current) openBook(current.id);
    router.navigate('/reader');
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={HUB.grad} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Header: avatar -> nome -> busca + sino */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{avatar || firstName.charAt(0).toUpperCase() || '🦉'}</Text>
              </View>
              <Text style={styles.appName} numberOfLines={1}>
                Dromos
              </Text>
            </View>
            <View style={styles.headerIcons}>
              <Pressable onPress={() => router.navigate('/explorar')} hitSlop={8} accessibilityLabel="Explorar">
                <SearchIcon />
              </Pressable>
              <Pressable
                onPress={() => router.navigate('/notificacoes')}
                hitSlop={8}
                accessibilityLabel={unread > 0 ? `Notificações, ${unread} não lidas` : 'Notificações'}
                style={styles.bellWrap}>
                <BellIcon />
                {unread > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
                  </View>
                ) : null}
              </Pressable>
            </View>
          </View>

          <Text style={styles.bigTitle}>Olá, {firstName}</Text>

          {/* HÁBITO — streak-herói + semana em bolinhas + meta do dia (estilo Duolingo/Strava).
              Toque no card → estatísticas; na linha da meta → Metas. */}
          <Pressable onPress={() => router.navigate('/estatisticas')}>
            <View style={styles.feedCard}>
              <View style={styles.habitTop}>
                <Text style={styles.habitFlame}>🔥</Text>
                <View style={styles.habitTitles}>
                  <Text style={styles.habitStreak}>
                    {derived.streak} {derived.streak === 1 ? 'dia seguido' : 'dias seguidos'}
                  </Text>
                  <Text style={styles.habitHint}>
                    {readToday
                      ? 'Chama acesa hoje! Continue assim.'
                      : derived.streak > 0
                        ? 'Leia hoje para manter a chama.'
                        : 'Leia alguns minutos e acenda a chama.'}
                  </Text>
                </View>
              </View>
              <View style={styles.habitWeek}>
                {derived.last7.map((d, i) => (
                  <View key={d.key} style={styles.habitDayCol}>
                    <View
                      style={[
                        styles.habitDot,
                        d.minutes > 0 && styles.habitDotOn,
                        i === 6 && styles.habitDotToday,
                      ]}>
                      {d.minutes > 0 ? <Text style={styles.habitDotCheck}>✓</Text> : null}
                    </View>
                    <Text style={styles.habitDayLabel}>{d.label}</Text>
                  </View>
                ))}
              </View>
              <Pressable
                onPress={() => router.navigate('/conquistas')}
                hitSlop={6}
                style={styles.habitGoalRow}>
                <Text style={styles.habitGoalText} numberOfLines={1}>
                  {activeGoal && goalProg
                    ? goalProg.done
                      ? `🎯 ${activeGoal.title} — concluída! 🎉`
                      : `🎯 ${activeGoal.title} · ~${goalProg.perDay} ${goalProg.unit}/dia · ${goalProg.daysLeft}d`
                    : '🎯 Definir uma meta de leitura'}
                </Text>
                <Text style={styles.habitGoalArrow}>›</Text>
              </Pressable>
            </View>
          </Pressable>

          {/* Lendo agora — card hero roxo (progresso real) */}
          <Pressable onPress={continueReading}>
            <View style={styles.hero}>
              {current?.coverUrl ? (
                <Image source={{ uri: current.coverUrl }} style={styles.heroCover} contentFit="cover" transition={150} />
              ) : (
                <View style={styles.heroCover}>
                  <Text style={styles.heroCoverText}>{current ? current.format.toUpperCase() : 'LER'}</Text>
                  <Text style={styles.heroCoverIcon}>📖</Text>
                </View>
              )}
              <View style={styles.heroBody}>
                <Text style={styles.heroKicker}>Lendo agora</Text>
                <Text style={styles.heroTitle} numberOfLines={2}>
                  {current ? current.title ?? current.name : 'Dom Casmurro'}
                </Text>
                <View style={styles.heroRow}>
                  <Text style={styles.heroSub}>{current ? `${pct}% concluído` : 'Amostra · Machado de Assis'}</Text>
                  {current ? <Text style={styles.heroPct}>{pct}%</Text> : null}
                </View>
                <View style={styles.heroTrack}>
                  <View style={[styles.heroFill, { width: `${current ? pct : 0}%` }]} />
                </View>
                <Text style={styles.heroChapter}>{current ? 'Continuar lendo ›' : 'Ler amostra ›'}</Text>
              </View>
            </View>
          </Pressable>

          {/* Atividade recente (dados reais da última sessão) — card branco */}
          {lastSession ? (
            <Pressable onPress={() => router.navigate('/estatisticas')}>
              <View style={styles.feedCard}>
                <Text style={styles.feedKicker}>Atividade recente</Text>
                <Text style={styles.feedText}>
                  Você leu <Text style={styles.feedStrong}>{lastSession.bookTitle}</Text>
                </Text>
                <View style={styles.feedFooter}>
                  <View style={styles.feedWho}>
                    <View style={styles.feedAvatar}>
                      <Text style={styles.feedAvatarText}>{avatar || firstName.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.feedMeta}>
                      {fmtMin(lastSession.seconds)} min · {fmtDay(lastSession.startedAt)}
                    </Text>
                  </View>
                  <Pressable onPress={() => router.navigate('/compartilhar')} hitSlop={8}>
                    <Text style={styles.feedShare}>Compartilhar ›</Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          ) : null}

          {/* Gráfico semanal estilo Strava — card branco, barras verdes. Toque → /estatisticas. */}
          <Pressable onPress={() => router.navigate('/estatisticas')}>
            <View style={styles.feedCard}>
              <View style={styles.weekHead}>
                <Text style={styles.feedKicker}>Leitura na semana</Text>
                <Text style={styles.weekTotal}>{weekMinutes} min</Text>
              </View>
              <WeekBars data={derived.last7} />
            </View>
          </Pressable>

          {/* Desafios (estilo Strava Challenges) — destaca o mais perto de completar. */}
          {topDesafio ? (
            <Pressable onPress={() => router.navigate('/desafios')}>
              <View style={styles.feedCard}>
                <View style={styles.weekHead}>
                  <Text style={styles.feedKicker}>🏆 Desafios</Text>
                  <Text style={styles.feedShare}>Ver todos ›</Text>
                </View>
                <Text style={styles.desafioTitle}>
                  {topDesafio.icon} {topDesafio.title}
                </Text>
                <View style={styles.desafioTrack}>
                  <View style={[styles.desafioFill, { width: `${Math.round(topDesafio.pct * 100)}%` }]} />
                </View>
                <Text style={styles.desafioMeta}>
                  {topDesafio.done
                    ? 'Concluído! 🎉'
                    : `${topDesafio.current.toLocaleString('pt-BR')} / ${topDesafio.target.toLocaleString('pt-BR')} ${topDesafio.unit}`}
                </Text>
              </View>
            </Pressable>
          ) : null}

          {/* Banner do tier grátis — no meio do feed (visível, fora do leitor §2.5).
              No-op p/ plano pago / Expo Go. */}
          <AdBanner style={styles.ad} />

          {/* Biblioteca atual */}
          <View style={styles.sectionHeadRow}>
            <Text style={styles.sectionTitle}>📚 Biblioteca atual</Text>
            <Pressable onPress={() => router.navigate('/biblioteca')} hitSlop={8}>
              <Text style={styles.link}>Ver tudo ›</Text>
            </Pressable>
          </View>

          {books.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Sua estante está vazia. Importe um .epub ou .pdf — ou explore o acervo grátis.</Text>
              <Pressable
                onPress={() => importBookFlow(addBook, () => router.navigate('/reader'))}
                style={styles.cta}>
                <Text style={styles.ctaText}>+ Importar livro</Text>
              </Pressable>
              <Pressable onPress={() => router.navigate('/explorar')} style={styles.ctaSecondary}>
                <Text style={styles.ctaSecondaryText}>🔎 Explorar o acervo</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>
              {books.map((b, i) => (
                <Pressable key={b.id} onPress={() => open(b)} style={styles.tileWrap}>
                  <View style={[styles.tile, !b.coverUrl && { backgroundColor: TILE_COLORS[i % TILE_COLORS.length] }]}>
                    {b.coverUrl ? (
                      <Image
                        source={{ uri: b.coverUrl }}
                        style={[StyleSheet.absoluteFill, styles.tileImage]}
                        contentFit="cover"
                        transition={150}
                      />
                    ) : null}
                    <Text style={[styles.tileBadge, b.coverUrl && styles.tileBadgeOnCover]}>{b.format.toUpperCase()}</Text>
                    {b.coverUrl ? null : (
                      <Text style={styles.tileTitle} numberOfLines={4}>
                        {b.title ?? b.name}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.tileCaption} numberOfLines={1}>
                    {b.title ?? b.name}
                  </Text>
                </Pressable>
              ))}
              <View style={styles.tileStack}>
                <Pressable
                  onPress={() => importBookFlow(addBook, () => router.navigate('/reader'))}
                  style={styles.tileHalf}>
                  <Text style={[styles.tileHalfIcon, { color: HUB.greenInk }]}>＋</Text>
                  <Text style={[styles.tileHalfLabel, { color: HUB.greenInk }]}>Importar</Text>
                </Pressable>
                <Pressable onPress={() => router.navigate('/explorar')} style={styles.tileHalf}>
                  <Text style={styles.tileHalfIcon}>🔎</Text>
                  <Text style={[styles.tileHalfLabel, { color: HUB.purple }]}>Explorar</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function WeekBars({ data }: { data: { label: string; minutes: number }[] }) {
  const max = Math.max(10, ...data.map((d) => d.minutes));
  return (
    <View style={styles.bars}>
      {data.map((d, i) => {
        const h = Math.max(4, Math.round((d.minutes / max) * 100));
        return (
          <View key={i} style={styles.barCol}>
            <View style={styles.barTrack}>
              <LinearGradient
                colors={[HUB.barBottom, HUB.barTop]}
                start={{ x: 0, y: 1 }}
                end={{ x: 0, y: 0 }}
                style={[styles.bar, { height: `${h}%`, opacity: d.minutes ? 1 : 0.3 }]}
              />
            </View>
            <Text style={styles.barLabel}>{d.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const cardShadow = {
  shadowColor: '#000',
  shadowOpacity: 0.12,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1F6147' },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: BottomTabInset + 60 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, color: HUB.onBg, fontWeight: '700' },
  appName: { color: HUB.onBg, fontSize: 17, fontWeight: '700' },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  // Sino + bolinha de não lidas (vermelha p/ saltar sobre o verde do hub).
  bellWrap: { position: 'relative' },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: '#FF4D4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  bigTitle: { color: HUB.onBg, fontSize: 30, fontWeight: '800', marginTop: 14, marginBottom: 14 },

  // Hero "Lendo agora" (roxo)
  hero: { flexDirection: 'row', gap: 14, borderRadius: 24, padding: 16, alignItems: 'center', backgroundColor: HUB.hero, ...cardShadow },
  heroCover: { width: 60, height: 84, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.22)', alignItems: 'center', justifyContent: 'center', gap: 4 },
  heroCoverText: { color: 'rgba(255,255,255,0.9)', fontSize: 10, fontWeight: '800' },
  heroCoverIcon: { fontSize: 24 },
  heroBody: { flex: 1, minWidth: 0 },
  heroKicker: { color: '#E7E1FB', fontSize: 13, fontWeight: '600' },
  heroTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '800', marginTop: 2 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12 },
  heroSub: { color: '#E7E1FB', fontSize: 13 },
  heroPct: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  heroTrack: { height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.28)', marginTop: 6 },
  heroFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: HUB.neon,
    shadowColor: HUB.neon,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  heroChapter: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', marginTop: 12 },

  // Cards de feed BRANCOS
  feedCard: { backgroundColor: HUB.cardBg, borderRadius: 20, padding: 16, marginTop: 14, ...cardShadow },
  feedKicker: { color: HUB.purple, fontSize: 12, fontWeight: '700' },
  feedText: { color: HUB.cardText, fontSize: 17, fontWeight: '600', marginTop: 6, lineHeight: 23 },
  feedStrong: { fontWeight: '800' },
  feedFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  feedWho: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  feedAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(15,169,104,0.14)', alignItems: 'center', justifyContent: 'center' },
  feedAvatarText: { fontSize: 15, color: HUB.greenInk, fontWeight: '700' },
  feedMeta: { color: HUB.cardMuted, fontSize: 12 },
  feedShare: { color: HUB.greenInk, fontSize: 13, fontWeight: '700' },

  // Hábito (streak-herói + bolinhas da semana + meta do dia)
  habitTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  habitFlame: { fontSize: 34 },
  habitTitles: { flex: 1, minWidth: 0 },
  habitStreak: { color: HUB.cardText, fontSize: 20, fontWeight: '800' },
  habitHint: { color: HUB.cardMuted, fontSize: 13, marginTop: 2 },
  habitWeek: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, gap: 6 },
  habitDayCol: { flex: 1, alignItems: 'center', gap: 4 },
  habitDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#E4E7E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  habitDotOn: { backgroundColor: HUB.greenInk, borderColor: HUB.greenInk },
  habitDotToday: { borderColor: HUB.purple },
  habitDotCheck: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  habitDayLabel: { color: HUB.cardMuted, fontSize: 10.5 },
  habitGoalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EFF1F0',
    gap: 8,
  },
  habitGoalText: { flex: 1, color: HUB.cardText, fontSize: 13.5, fontWeight: '700' },
  habitGoalArrow: { color: HUB.purple, fontSize: 18, fontWeight: '800' },

  // Desafios (faixa na Home)
  desafioTitle: { color: HUB.cardText, fontSize: 16, fontWeight: '800', marginBottom: 10 },
  desafioTrack: { height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: '#EFF1F0' },
  desafioFill: { height: '100%', borderRadius: 4, backgroundColor: HUB.greenInk },
  desafioMeta: { color: HUB.cardMuted, fontSize: 12.5, fontWeight: '700', marginTop: 8 },

  // Semana
  weekHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 },
  weekTotal: { color: HUB.greenInk, fontSize: 16, fontWeight: '800' },
  bars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 96, gap: 7 },
  barCol: { flex: 1, alignItems: 'center' },
  barTrack: { width: '100%', height: 76, justifyContent: 'flex-end', borderRadius: 7, overflow: 'hidden', backgroundColor: '#EFF1F0' },
  bar: { width: '100%', borderRadius: 7 },
  barLabel: { color: HUB.cardMuted, fontSize: 11, marginTop: 6 },

  ad: { marginTop: 14 },

  // Biblioteca (sobre o fundo verde)
  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 12 },
  sectionTitle: { color: HUB.onBg, fontSize: 18, fontWeight: '800' },
  link: { color: HUB.onBg, fontSize: 14, fontWeight: '700' },
  emptyCard: { backgroundColor: HUB.cardBg, borderRadius: 20, padding: 16, ...cardShadow },
  emptyText: { color: HUB.cardMuted, fontSize: 14, lineHeight: 21 },
  cta: { marginTop: 16, borderRadius: 999, paddingVertical: 12, alignItems: 'center', backgroundColor: HUB.greenInk },
  ctaText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  ctaSecondary: { marginTop: 10, borderRadius: 999, paddingVertical: 11, alignItems: 'center', borderWidth: 1.5, borderColor: HUB.greenInk },
  ctaSecondaryText: { fontSize: 15, fontWeight: '800', color: HUB.greenInk },
  shelf: { gap: 14, paddingVertical: 4, paddingRight: 8 },
  tileWrap: { width: 110 },
  tile: { width: 110, height: 156, borderRadius: 14, padding: 10, justifyContent: 'space-between', overflow: 'hidden', ...cardShadow },
  tileImage: { borderRadius: 14 },
  tileBadge: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '800' },
  // Sobre a capa real, o selo do formato ganha um fundo escuro p/ ler em qualquer imagem.
  tileBadgeOnCover: {
    alignSelf: 'flex-start',
    color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  tileTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  tileCaption: { color: HUB.onBgDim, fontSize: 12, marginTop: 6 },
  tileStack: { width: 110, height: 156, justifyContent: 'space-between' },
  tileHalf: { width: 110, height: 73, borderRadius: 14, backgroundColor: HUB.cardBg, alignItems: 'center', justifyContent: 'center', ...cardShadow },
  tileHalfIcon: { fontSize: 22, fontWeight: '300' },
  tileHalfLabel: { fontSize: 12, fontWeight: '700', marginTop: 2 },
});
