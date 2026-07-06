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
import { CatalogCover } from '@/components/catalog-cover';
import { importBookFlow } from '@/app/(tabs)/biblioteca';
import { BottomTabInset, BrandFont } from '@/constants/theme';
import { restoreActivities } from '@/services/activity-sync';
import { featuredBrazilian, type CatalogBook } from '@/services/catalog';
import { downloadCatalogBook } from '@/services/catalog-download';
import { backfillCovers } from '@/services/cover-backfill';
import { computeDesafios } from '@/services/desafios';
import { getUnreadCount } from '@/services/notifications';
import { computeBestStreak, deriveGoal, deriveLevel, deriveStats } from '@/services/progress';
import { displayName, useAuth } from '@/store/auth';
import { useLibrary, type ImportedBook } from '@/store/library';
import { useProfile } from '@/store/profile';
import { HUB } from '@/theme/hub';

// Placeholders CLAROS para tiles sem capa (rebrand): azul/neutro suave, não mais roxo escuro.
const TILE_COLORS = ['#DCE7F2', '#E5E7EB', '#E7E1F2', '#DCEAE3', '#EDE7DC'];

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
  const lvl = deriveLevel(stats);
  const bestStreak = computeBestStreak(stats.perDay);
  const current = books.find((b) => b.id === currentBookId) ?? books[0] ?? null;
  const pct = current ? Math.round((progress[current.id] ?? 0) * 100) : 0;
  const weekMinutes = derived.last7.reduce((a, day) => a + day.minutes, 0);
  // Missão diária: ler 15 min hoje (usa os minutos de hoje já derivados).
  const MISSION_MIN = 15;
  const todayMin = derived.last7[6]?.minutes ?? 0;
  const missionPct = Math.min(1, todayMin / MISSION_MIN);
  const missionDone = todayMin >= MISSION_MIN;

  // --- Home do Hábito (alma do app = Strava social + bons hábitos, 2026-07-02) ---
  // Tudo derivado do que já existe: streak/last7 (deriveStats), metas e desafios locais.
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
  // Recomendações (clássicos BR do acervo) — carregadas 1× em segundo plano.
  const [recs, setRecs] = useState<CatalogBook[]>([]);
  const [recBusy, setRecBusy] = useState<string | null>(null);
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
    // Recomendações do acervo (clássicos BR) — falha silenciosa (some a seção).
    featuredBrazilian()
      .then((list) => setRecs(list.slice(0, 10)))
      .catch(() => {});
  }, []);

  async function openRec(b: CatalogBook) {
    if (recBusy) return;
    setRecBusy(b.id);
    try {
      const target = await downloadCatalogBook(b);
      router.navigate(target);
    } catch {
      router.navigate('/explorar');
    } finally {
      setRecBusy(null);
    }
  }

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
          <Text style={styles.bigSubtitle}>Que bom ver você de volta!</Text>

          {/* Card de STATS (hub-alvo): Nível/XP + Sequência + XP total + Leitura na semana. */}
          <Pressable onPress={() => router.navigate('/estatisticas')}>
            <View style={styles.statsCard}>
              <View style={styles.levelRow}>
                <View style={styles.levelBadge}>
                  <Text style={styles.levelBadgeIcon}>📖</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.statColLabel}>Nível atual</Text>
                  <Text style={styles.levelTitle}>{lvl.title}</Text>
                  <Text style={styles.levelNum}>Nível {lvl.level}</Text>
                  <View style={styles.xpTrack}>
                    <View style={[styles.xpFill, { width: `${Math.round(lvl.progress * 100)}%` }]} />
                  </View>
                  <Text style={styles.xpLabel}>
                    {lvl.xp} / {lvl.nextFloor} XP
                  </Text>
                </View>
              </View>
              <View style={styles.statCols}>
                <StatCol label="Sequência" icon="🔥" value={String(derived.streak)} unit={derived.streak === 1 ? 'dia' : 'dias'} sub={`Melhor: ${bestStreak}`} />
                <StatCol label="XP total" icon="⭐" value={String(lvl.xp)} unit="XP" divider />
                <StatCol label="Na semana" icon="🕐" value={String(weekMinutes)} unit="min" divider />
              </View>
            </View>
          </Pressable>

          {/* Missão diária — ler alguns minutos hoje e ganhar XP. Toque → Metas. */}
          <Pressable onPress={() => router.navigate('/conquistas')}>
            <View style={styles.missionCard}>
              <View style={styles.missionHead}>
                <Text style={styles.missionIcon}>🎯</Text>
                <Text style={styles.missionTitle}>Missão diária</Text>
              </View>
              <View style={styles.missionRow}>
                <View style={styles.flex}>
                  <Text style={styles.missionMain}>
                    {missionDone ? 'Missão do dia concluída! 🎉' : `Leia por ${MISSION_MIN} minutos`}
                  </Text>
                  <Text style={styles.missionSub}>
                    {activeGoal && goalProg && !goalProg.done
                      ? `Meta: ${activeGoal.title} · ${goalProg.daysLeft}d`
                      : 'Continue sua jornada e ganhe XP!'}
                  </Text>
                </View>
                <View style={styles.xpBadge}>
                  <Text style={styles.xpBadgeText}>+25 XP</Text>
                </View>
              </View>
              <View style={styles.missionTrack}>
                <View style={[styles.missionFill, { width: `${Math.round(missionPct * 100)}%` }]} />
              </View>
              <Text style={styles.missionProg}>
                {todayMin} / {MISSION_MIN} min
              </Text>
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

          {/* "Atividade recente" REMOVIDA (2026-07-04) — era redundante com o hero "Lendo
              agora". O compartilhar de sessão vive no card semanal e em /estatisticas. */}

          {/* Biblioteca atual — PROMOVIDA para perto do "Lendo agora" (2026-07-04): é a
              continuação natural do que ler a seguir, não pode ficar perdida no rodapé. */}
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

          {/* Gráfico semanal estilo Strava — card branco, barras verdes. Toque → /estatisticas. */}
          <Pressable onPress={() => router.navigate('/estatisticas')}>
            <View style={styles.feedCard}>
              <View style={styles.weekHead}>
                <Text style={styles.weekTitle}>Sua semana em resumo</Text>
                <Text style={styles.feedShare}>Ver detalhes ›</Text>
              </View>
              <WeekBars data={derived.last7} />
              {/* Recap semanal ("Wrapped") → carrossel do card compartilhável */}
              <Pressable
                onPress={() => router.navigate({ pathname: '/compartilhar', params: { recap: '1' } })}
                hitSlop={6}
                style={styles.recapRow}>
                <Text style={styles.feedShare}>📤 Compartilhar minha semana ›</Text>
              </Pressable>
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

          {/* Recomendações para você — clássicos do acervo (carrossel). */}
          {recs.length > 0 ? (
            <>
              <View style={styles.sectionHeadRow}>
                <Text style={styles.sectionTitle}>✨ Recomendações para você</Text>
                <Pressable onPress={() => router.navigate('/explorar')} hitSlop={8}>
                  <Text style={styles.link}>Ver todas ›</Text>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>
                {recs.map((b) => (
                  <Pressable key={b.id} style={styles.recWrap} onPress={() => openRec(b)} disabled={recBusy === b.id}>
                    <CatalogCover uri={b.coverUrl} title={b.title} author={b.author} width={110} height={156} radius={14} />
                    <Text style={styles.tileCaption} numberOfLines={1}>
                      {recBusy === b.id ? 'Abrindo…' : b.title}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}

          {/* Banner do tier grátis — no meio do feed (visível, fora do leitor §2.5).
              No-op p/ plano pago / Expo Go. */}
          <AdBanner style={styles.ad} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function StatCol({
  label,
  icon,
  value,
  unit,
  sub,
  divider,
}: {
  label: string;
  icon: string;
  value: string;
  unit: string;
  sub?: string;
  divider?: boolean;
}) {
  return (
    <View style={[styles.statCol, divider ? styles.statColDivider : null]}>
      <Text style={styles.statColLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.statColIcon}>{icon}</Text>
      <Text style={styles.statColValue}>{value}</Text>
      <Text style={styles.statColUnit}>{unit}</Text>
      {sub ? (
        <Text style={styles.statColSub} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
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
  root: { flex: 1, backgroundColor: HUB.base },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: BottomTabInset + 60 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, color: HUB.onBg, fontWeight: '700' },
  appName: { color: HUB.onBg, fontSize: 17, fontFamily: BrandFont.bold },
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
  bigTitle: { color: HUB.onBg, fontSize: 30, fontFamily: BrandFont.extrabold, marginTop: 14, marginBottom: 2 },
  bigSubtitle: { color: HUB.onBgDim, fontSize: 15, marginBottom: 14 },

  // Hero "Lendo agora" (roxo)
  // Hero "Lendo agora" = CTA principal. Borda verde da marca p/ destacar sobre o fundo roxo
  // (antes o card roxo sumia no fundo roxo) + respiro em cima/baixo.
  hero: { flexDirection: 'row', gap: 14, borderRadius: 24, padding: 16, marginTop: 16, marginBottom: 2, alignItems: 'center', backgroundColor: HUB.hero, borderWidth: 1.5, borderColor: HUB.green, ...cardShadow },
  heroCover: { width: 60, height: 84, borderRadius: 10, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', gap: 4 },
  heroCoverText: { color: HUB.cardMuted, fontSize: 10, fontWeight: '800' },
  heroCoverIcon: { fontSize: 24 },
  heroBody: { flex: 1, minWidth: 0 },
  heroKicker: { color: HUB.greenInk, fontSize: 13, fontWeight: '700' },
  heroTitle: { color: HUB.cardText, fontSize: 21, fontWeight: '800', marginTop: 2 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12 },
  heroSub: { color: HUB.cardMuted, fontSize: 13 },
  heroPct: { color: HUB.cardText, fontSize: 14, fontWeight: '800' },
  heroTrack: { height: 7, borderRadius: 4, backgroundColor: '#DCE6EF', marginTop: 6 },
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
  heroChapter: { color: HUB.greenInk, fontSize: 13, fontWeight: '700', marginTop: 12 },

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

  // --- Card de STATS (Nível/XP + colunas) ---
  statsCard: { backgroundColor: HUB.cardBg, borderRadius: 20, padding: 16, marginTop: 16, ...cardShadow },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  levelBadge: { width: 54, height: 54, borderRadius: 15, backgroundColor: '#EAF2FB', borderWidth: 1, borderColor: '#CFE4F6', alignItems: 'center', justifyContent: 'center' },
  levelBadgeIcon: { fontSize: 26 },
  levelTitle: { color: HUB.cardText, fontSize: 18, fontWeight: '800', marginTop: 1 },
  levelNum: { color: HUB.greenInk, fontSize: 13, fontWeight: '800', marginTop: 1 },
  xpTrack: { height: 6, borderRadius: 3, backgroundColor: '#E5E7EB', marginTop: 8, overflow: 'hidden' },
  xpFill: { height: '100%', borderRadius: 3, backgroundColor: HUB.greenInk },
  xpLabel: { color: HUB.cardMuted, fontSize: 11, fontWeight: '700', marginTop: 4 },
  statCols: { flexDirection: 'row', marginTop: 16, borderTopWidth: 1, borderTopColor: '#EFF1F0', paddingTop: 12 },
  statCol: { flex: 1, alignItems: 'center' },
  statColDivider: { borderLeftWidth: 1, borderLeftColor: '#EFF1F0' },
  statColLabel: { color: HUB.cardMuted, fontSize: 11.5, fontWeight: '600' },
  statColIcon: { fontSize: 16, marginTop: 3 },
  statColValue: { color: HUB.cardText, fontSize: 18, fontWeight: '900', marginTop: 1 },
  statColUnit: { color: HUB.greenInk, fontSize: 11, fontWeight: '700' },
  statColSub: { color: HUB.cardMuted, fontSize: 10, marginTop: 2 },

  // --- Missão diária ---
  missionCard: { backgroundColor: HUB.cardBg, borderRadius: 20, padding: 16, marginTop: 14, ...cardShadow },
  missionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  missionIcon: { fontSize: 16 },
  missionTitle: { color: '#16A34A', fontSize: 14, fontWeight: '800' },
  missionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  missionMain: { color: HUB.cardText, fontSize: 16, fontWeight: '800' },
  missionSub: { color: HUB.cardMuted, fontSize: 12.5, marginTop: 2 },
  xpBadge: { backgroundColor: '#E7F6EC', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  xpBadgeText: { color: '#16A34A', fontSize: 13, fontWeight: '900' },
  missionTrack: { height: 7, borderRadius: 4, backgroundColor: '#E5E7EB', marginTop: 12, overflow: 'hidden' },
  missionFill: { height: '100%', borderRadius: 4, backgroundColor: '#22C55E' },
  missionProg: { color: HUB.cardMuted, fontSize: 11.5, fontWeight: '700', marginTop: 6, textAlign: 'right' },
  weekTitle: { color: HUB.cardText, fontSize: 15, fontWeight: '800' },
  recWrap: { width: 110 },

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

  recapRow: { alignItems: 'flex-end', marginTop: 12 },

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
  link: { color: HUB.greenInk, fontSize: 14, fontWeight: '700' },
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
  tileBadge: { color: '#6B7280', fontSize: 11, fontWeight: '800' },
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
  tileTitle: { color: '#2A2C33', fontSize: 14, fontWeight: '700' },
  tileCaption: { color: HUB.onBgDim, fontSize: 12, marginTop: 6 },
  tileStack: { width: 110, height: 156, justifyContent: 'space-between' },
  tileHalf: { width: 110, height: 73, borderRadius: 14, backgroundColor: HUB.cardBg, alignItems: 'center', justifyContent: 'center', ...cardShadow },
  tileHalfIcon: { fontSize: 22, fontWeight: '300' },
  tileHalfLabel: { fontSize: 12, fontWeight: '700', marginTop: 2 },
});
