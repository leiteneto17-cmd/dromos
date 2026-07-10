/**
 * HUB (aba Leitura) — feed claro+azul (GUIA-DE-MARCA v2): fundo papel/gelo, header avatar +
 * busca/sino, card "Lendo agora" (progresso real), cards BRANCOS de atividade e gráfico
 * semanal, biblioteca + estante. Dose de cor pela regra 90-9-1: azul pleno só em CTA, links
 * "›" e progresso ativo; verde só em estado concluído. O leitor continua sépia/claro/escuro.
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
import { computeBestStreak, deriveLevel, deriveStats } from '@/services/progress';
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

  const derived = deriveStats(stats);
  const lvl = deriveLevel(stats);
  const bestStreak = computeBestStreak(stats.perDay);
  const current = books.find((b) => b.id === currentBookId) ?? books[0] ?? null;
  const pct = current ? Math.round((progress[current.id] ?? 0) * 100) : 0;
  const weekMinutes = derived.last7.reduce((a, day) => a + day.minutes, 0);

  // --- Desafios (alma do app = Strava social + bons hábitos). A "Missão diária" foi
  // UNIFICADA aqui (2026-07-06): é o desafio 'diaria' de computeDesafios. ---
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
                  <View style={styles.levelTitleRow}>
                    <Text style={styles.levelTitle} numberOfLines={1}>
                      {lvl.title}
                    </Text>
                    <Text style={styles.levelNum}>Nível {lvl.level}</Text>
                  </View>
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

          {/* DESAFIOS (unificado com a antiga "Missão diária" — inclui a missão de hoje).
              Destaca o desafio mais perto de completar; toque → todos os desafios. */}
          {topDesafio ? (
            <Pressable onPress={() => router.navigate('/desafios')}>
              <View style={styles.missionCard}>
                <View style={styles.missionHead}>
                  <Text style={styles.missionIcon}>🏆</Text>
                  <Text style={styles.missionTitle}>Desafios</Text>
                  <View style={styles.flex} />
                  <Text style={styles.feedShare}>Ver todos ›</Text>
                </View>
                <View style={styles.missionRow}>
                  <View style={styles.flex}>
                    <Text style={styles.missionMain}>
                      {topDesafio.icon} {topDesafio.title}
                    </Text>
                    <Text style={styles.missionSub}>{topDesafio.desc}</Text>
                  </View>
                  <View style={styles.periodBadge}>
                    <Text style={styles.periodBadgeText}>{topDesafio.period}</Text>
                  </View>
                </View>
                <View style={styles.missionTrack}>
                  {/* Progresso em andamento = azul; concluído = verde (success). */}
                  <View
                    style={[
                      styles.missionFill,
                      topDesafio.done && { backgroundColor: HUB.success },
                      { width: `${Math.round(topDesafio.pct * 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.missionProg}>
                  {topDesafio.done
                    ? 'Concluído! 🎉'
                    : `${topDesafio.current.toLocaleString('pt-BR')} / ${topDesafio.target.toLocaleString('pt-BR')} ${topDesafio.unit}`}
                </Text>
              </View>
            </Pressable>
          ) : null}

          {/* Lendo agora — card hero em accentSoft (progresso real) */}
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
                  <Text style={[styles.tileHalfIcon, { color: HUB.accentDeep }]}>＋</Text>
                  <Text style={[styles.tileHalfLabel, { color: HUB.accentDeep }]}>Importar</Text>
                </Pressable>
                <Pressable onPress={() => router.navigate('/explorar')} style={styles.tileHalf}>
                  <Text style={styles.tileHalfIcon}>🔎</Text>
                  <Text style={[styles.tileHalfLabel, { color: HUB.accentDeep }]}>Explorar</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}

          {/* Gráfico semanal estilo Strava — card branco, barras azuis. Toque → /estatisticas. */}
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
  // Sino + bolinha de não lidas (vermelha p/ saltar sobre o fundo claro).
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

  // Hero "Lendo agora" = destaque principal: superfície accentSoft + borda suave (90-9-1:
  // o destaque vem da CAMADA suave, não de mais azul pleno) + respiro em cima/baixo.
  hero: { flexDirection: 'row', gap: 14, borderRadius: 24, padding: 16, marginTop: 16, marginBottom: 2, alignItems: 'center', backgroundColor: HUB.hero, borderWidth: 1.5, borderColor: HUB.heroBorder, ...cardShadow },
  heroCover: { width: 60, height: 84, borderRadius: 10, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', gap: 4 },
  heroCoverText: { color: HUB.cardMuted, fontSize: 10, fontWeight: '800' },
  heroCoverIcon: { fontSize: 24 },
  heroBody: { flex: 1, minWidth: 0 },
  heroKicker: { color: HUB.cardMuted, fontSize: 13, fontWeight: '700' },
  heroTitle: { color: HUB.cardText, fontSize: 21, fontWeight: '800', marginTop: 2 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12 },
  heroSub: { color: HUB.cardMuted, fontSize: 13 },
  heroPct: { color: HUB.cardText, fontSize: 14, fontWeight: '800' },
  heroTrack: { height: 7, borderRadius: 4, backgroundColor: '#DCE6EF', marginTop: 6 },
  // Barra de progresso = azul pleno, SEM glow (sombra colorida é a marca antiga).
  heroFill: { height: '100%', borderRadius: 4, backgroundColor: HUB.accent },
  heroChapter: { color: HUB.accentDeep, fontSize: 13, fontWeight: '700', marginTop: 12 },

  // Cards de feed BRANCOS
  feedCard: { backgroundColor: HUB.cardBg, borderRadius: 20, padding: 16, marginTop: 14, ...cardShadow },
  feedKicker: { color: HUB.cardMuted, fontSize: 12, fontWeight: '700' },
  feedText: { color: HUB.cardText, fontSize: 17, fontWeight: '600', marginTop: 6, lineHeight: 23 },
  feedStrong: { fontWeight: '800' },
  feedFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  feedWho: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  feedAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: HUB.accentSoft, alignItems: 'center', justifyContent: 'center' },
  feedAvatarText: { fontSize: 15, color: HUB.cardText, fontWeight: '700' },
  feedMeta: { color: HUB.cardMuted, fontSize: 12 },
  feedShare: { color: HUB.accentDeep, fontSize: 13, fontWeight: '700' },

  // --- Card de STATS (Nível/XP + colunas) ---
  statsCard: { backgroundColor: HUB.cardBg, borderRadius: 20, padding: 14, marginTop: 16, ...cardShadow },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  levelBadge: { width: 44, height: 44, borderRadius: 13, backgroundColor: HUB.hero, borderWidth: 1, borderColor: HUB.heroBorder, alignItems: 'center', justifyContent: 'center' },
  levelBadgeIcon: { fontSize: 22 },
  levelTitleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  levelTitle: { color: HUB.cardText, fontSize: 17, fontWeight: '800', flexShrink: 1 },
  levelNum: { color: HUB.cardMuted, fontSize: 12.5, fontWeight: '800' },
  xpTrack: { height: 6, borderRadius: 3, backgroundColor: '#E5E7EB', marginTop: 7, overflow: 'hidden' },
  xpFill: { height: '100%', borderRadius: 3, backgroundColor: HUB.accent },
  xpLabel: { color: HUB.cardMuted, fontSize: 11, fontWeight: '700', marginTop: 4 },
  statCols: { flexDirection: 'row', marginTop: 12, borderTopWidth: 1, borderTopColor: '#EFF1F0', paddingTop: 10 },
  statCol: { flex: 1, alignItems: 'center' },
  statColDivider: { borderLeftWidth: 1, borderLeftColor: '#EFF1F0' },
  statColLabel: { color: HUB.cardMuted, fontSize: 11.5, fontWeight: '600' },
  statColIcon: { fontSize: 16, marginTop: 3 },
  statColValue: { color: HUB.cardText, fontSize: 18, fontWeight: '900', marginTop: 1 },
  statColUnit: { color: HUB.cardMuted, fontSize: 11, fontWeight: '700' },
  statColSub: { color: HUB.cardMuted, fontSize: 10, marginTop: 2 },

  // --- Missão diária ---
  missionCard: { backgroundColor: HUB.cardBg, borderRadius: 20, padding: 16, marginTop: 14, ...cardShadow },
  missionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  missionIcon: { fontSize: 16 },
  missionTitle: { color: HUB.cardMuted, fontSize: 14, fontWeight: '800' },
  missionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  missionMain: { color: HUB.cardText, fontSize: 16, fontWeight: '800' },
  missionSub: { color: HUB.cardMuted, fontSize: 12.5, marginTop: 2 },
  // Recompensa (+XP) é estado POSITIVO → tons de success (verde só aqui e no concluído).
  xpBadge: { backgroundColor: HUB.successSoft, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  xpBadgeText: { color: HUB.successDeep, fontSize: 13, fontWeight: '900' },
  periodBadge: { backgroundColor: HUB.accentSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  periodBadgeText: { color: HUB.accentDeep, fontSize: 12, fontWeight: '800' },
  missionTrack: { height: 7, borderRadius: 4, backgroundColor: '#E5E7EB', marginTop: 12, overflow: 'hidden' },
  missionFill: { height: '100%', borderRadius: 4, backgroundColor: HUB.accent },
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
  // Dia lido = estado CONCLUÍDO → verde success (guia §6.2); hoje = contorno azul.
  habitDotOn: { backgroundColor: HUB.success, borderColor: HUB.success },
  habitDotToday: { borderColor: HUB.accent },
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
  habitGoalArrow: { color: HUB.cardMuted, fontSize: 18, fontWeight: '800' },

  recapRow: { alignItems: 'flex-end', marginTop: 12 },

  // Desafios (faixa na Home)
  desafioTitle: { color: HUB.cardText, fontSize: 16, fontWeight: '800', marginBottom: 10 },
  desafioTrack: { height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: '#EFF1F0' },
  desafioFill: { height: '100%', borderRadius: 4, backgroundColor: HUB.accent },
  desafioMeta: { color: HUB.cardMuted, fontSize: 12.5, fontWeight: '700', marginTop: 8 },

  // Semana
  weekHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 },
  weekTotal: { color: HUB.cardText, fontSize: 16, fontWeight: '800' },
  bars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 96, gap: 7 },
  barCol: { flex: 1, alignItems: 'center' },
  barTrack: { width: '100%', height: 76, justifyContent: 'flex-end', borderRadius: 7, overflow: 'hidden', backgroundColor: '#EFF1F0' },
  bar: { width: '100%', borderRadius: 7 },
  barLabel: { color: HUB.cardMuted, fontSize: 11, marginTop: 6 },

  ad: { marginTop: 14 },

  // Biblioteca (sobre o fundo claro)
  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 12 },
  sectionTitle: { color: HUB.onBg, fontSize: 18, fontWeight: '800' },
  link: { color: HUB.accentDeep, fontSize: 14, fontWeight: '700' },
  emptyCard: { backgroundColor: HUB.cardBg, borderRadius: 20, padding: 16, ...cardShadow },
  emptyText: { color: HUB.cardMuted, fontSize: 14, lineHeight: 21 },
  cta: { marginTop: 16, borderRadius: 999, paddingVertical: 12, alignItems: 'center', backgroundColor: HUB.accent },
  ctaText: { fontSize: 15, fontWeight: '800', color: HUB.onAccent },
  ctaSecondary: { marginTop: 10, borderRadius: 999, paddingVertical: 11, alignItems: 'center', borderWidth: 1.5, borderColor: HUB.heroBorder },
  ctaSecondaryText: { fontSize: 15, fontWeight: '800', color: HUB.accentDeep },
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
