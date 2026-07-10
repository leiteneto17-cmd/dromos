/**
 * Aba Perfil — "retrato do leitor" (reforma 2026-07-10, referência aprovada pelo usuário):
 * header identidade → linha de 4 stats → card META (anel de progresso) → card RESUMO DE
 * ATIVIDADES (mini-stats + gráfico mensal) → abas ATIVIDADES/LEITURAS/RESENHAS/METAS/LISTAS
 * → utilitários compactos ("Mais"). Paleta claro+azul do GUIA-DE-MARCA v2 (90-9-1: azul
 * pleno só no anel/linha do gráfico/links). O ⚙️ mantém a SettingsSheet de sempre.
 * Tudo derivado de dados REAIS: deriveStats/deriveGoal, sessões, estante e resenhas.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MonthLineChart } from '@/components/month-line-chart';
import { MyShelf } from '@/components/my-shelf';
import { PressableScale } from '@/components/pressable-scale';
import { ProfileEditor } from '@/components/profile-editor';
import { ProgressRing } from '@/components/progress-ring';
import { SettingsSheet } from '@/components/settings-sheet';
import { Card, ScreenBG } from '@/components/social-ui';
import { BrandFont } from '@/constants/theme';
import { PRICE_MONTHLY_SUFFIX } from '@/constants/pricing';
import { useUI } from '@/hooks/use-ui';
import { bookKeyOf, getCollections, getMyRatings, getMyShelf, type Collection, type ShelfItem } from '@/services/community';
import { computeAchievements, computeBestStreak, deriveGoal, deriveLevel, deriveStats } from '@/services/progress';
import { approveRequest, getFollowRequests, rejectRequest, type FollowRequest } from '@/services/social';
import { displayName, useAuth } from '@/store/auth';
import { useLibrary, type ReadingSession } from '@/store/library';
import { useIsPremium } from '@/store/plan';
import { syncBadges, useProfile } from '@/store/profile';

// ---------- helpers de formatação ----------

/** 24730 → "24.7k" (estilo da referência). */
function fmtK(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace('.0', '')}k`;
  return String(n);
}

function dateLabel(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return 'Hoje';
  if (same(d, yest)) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}

/** Minutos lidos por mês (Jan..Dez) do ano corrente, a partir de perDay. */
function monthlyMinutes(perDay: Record<string, number>): number[] {
  const year = String(new Date().getFullYear());
  const months = Array(12).fill(0) as number[];
  for (const [key, secs] of Object.entries(perDay)) {
    if (!key.startsWith(year)) continue;
    const m = Number(key.slice(5, 7)) - 1;
    if (m >= 0 && m < 12) months[m] += Math.round(secs / 60);
  }
  return months;
}

function Stars({ rating, color, dim }: { rating: number; color: string; dim: string }) {
  return (
    <Text style={st.stars} accessibilityLabel={`Nota ${rating} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Text key={i} style={{ color: i <= rating ? color : dim }}>
          ★
        </Text>
      ))}
      <Text style={[st.starsNum, { color: dim }]}>  {rating.toFixed(1)}</Text>
    </Text>
  );
}

const TABS = ['ATIVIDADES', 'LEITURAS', 'RESENHAS', 'METAS', 'LISTAS'] as const;
type Tab = (typeof TABS)[number];

export default function ProfileScreen() {
  const c = useUI();
  const books = useLibrary((s) => s.books);
  const vocab = useLibrary((s) => s.vocab);
  const removeVocab = useLibrary((s) => s.removeVocab);
  const stats = useLibrary((s) => s.stats);
  const sessions = useLibrary((s) => s.sessions);
  const bookProgress = useLibrary((s) => s.progress);
  const bookPages = useLibrary((s) => s.bookPages);
  const goals = useLibrary((s) => s.goals);
  const user = useAuth((s) => s.user);
  const configured = useAuth((s) => s.configured);
  const profile = useProfile((s) => s.profile);
  const isPremium = useIsPremium();

  const [tab, setTab] = useState<Tab>('ATIVIDADES');
  const [showVocab, setShowVocab] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [shelf, setShelf] = useState<ShelfItem[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [collections, setCollections] = useState<Collection[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        setRequests([]);
        setShelf([]);
        setRatings({});
        setCollections([]);
        return;
      }
      getFollowRequests().then(setRequests);
      getMyShelf().then(setShelf);
      getMyRatings().then(setRatings);
      getCollections().then(setCollections);
    }, [user]),
  );

  async function respondRequest(followerId: string, accept: boolean) {
    setRequests((prev) => prev.filter((r) => r.follower_id !== followerId)); // otimista
    await (accept ? approveRequest(followerId) : rejectRequest(followerId));
  }

  // ---------- números do retrato (tudo derivado de dado real) ----------
  const derived = deriveStats(stats);
  const lvl = deriveLevel(stats);
  const bestStreak = computeBestStreak(stats.perDay);
  const pagesTotal = sessions.reduce((a, s) => a + (s.pages || 0), 0);
  const hoursTotal = Math.round(derived.totalSeconds / 3600);
  const booksRead = shelf.filter((s) => s.status === 'lido' || s.status === 'relendo').length;
  const months = useMemo(() => monthlyMinutes(stats.perDay), [stats.perDay]);

  const headerName = profile?.name?.trim() || displayName(user);
  const sinceYear = user?.created_at ? new Date(user.created_at).getFullYear() : null;
  const founder = !!profile?.is_founder && profile?.founder_flair !== false;

  // Meta ativa (a mais recente não concluída) — anel do card de meta.
  const activeGoal = goals.find((g) => !g.doneAt);
  const goalBook = activeGoal?.bookId ? books.find((b) => b.id === activeGoal.bookId) : undefined;
  const gp = activeGoal
    ? deriveGoal(
        activeGoal,
        stats,
        goalBook ? { progress: bookProgress[goalBook.id] ?? 0, pages: bookPages[goalBook.id] ?? 0 } : undefined,
      )
    : null;

  const achievements = computeAchievements({
    booksCount: books.length,
    vocabCount: vocab.length,
    derived,
    sessions,
    progress: bookProgress,
  });
  const unlockedIds = achievements.filter((a) => a.unlocked).map((a) => a.id);

  // Espelha os emblemas no perfil público (no-op se nada mudou / deslogado).
  const badgesKey = unlockedIds.join(',');
  useEffect(() => {
    void syncBadges(unlockedIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badgesKey]);

  // Regra das abas (decisão do usuário 2026-07-10): NUNCA lista longa dentro da aba —
  // sempre "últimas 3" + link "Ver histórico/todos" para a tela completa.
  const reviewed = shelf.filter((s) => ratings[s.book_key] != null);
  const recent = sessions.slice(0, 3);

  return (
    <ScreenBG>
      {/* Barra do topo — título central + compartilhar + configurações (referência) */}
      <View style={st.topBar}>
        <View style={st.topSide} />
        <Text style={[st.topTitle, { color: c.text }]}>Perfil</Text>
        <View style={[st.topSide, st.topActions]}>
          <Pressable onPress={() => router.navigate('/compartilhar')} hitSlop={10} accessibilityLabel="Compartilhar">
            <Text style={st.topIcon}>📤</Text>
          </Pressable>
          {user ? (
            <Pressable onPress={() => setShowSettings(true)} hitSlop={10} accessibilityLabel="Configurações">
              <Text style={st.topIcon}>⚙️</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* ---------- Identidade ---------- */}
      <View style={st.idRow}>
        <Pressable
          onPress={() => user && setShowEditProfile(true)}
          style={[st.avatar, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
          {profile?.avatar_url ? (
            <Text style={st.avatarEmoji}>{profile.avatar_url}</Text>
          ) : (
            <Text style={[st.avatarInitial, { color: c.textSecondary }]}>
              {headerName.trim().charAt(0).toUpperCase() || '?'}
            </Text>
          )}
        </Pressable>
        <View style={st.idInfo}>
          <View style={st.nameRow}>
            <Text style={[st.name, { color: c.text }]} numberOfLines={1}>
              {headerName}
            </Text>
            {/* Selo de nível (o "escudo" da referência) */}
            <View style={[st.lvlBadge, { backgroundColor: c.accentPressed }]} accessibilityLabel={`Nível ${lvl.level}`}>
              <Text style={st.lvlBadgeText}>{lvl.level}</Text>
            </View>
          </View>
          <Text style={[st.idLine, { color: c.textSecondary }]}>
            {sinceYear ? `Leitor desde ${sinceYear}` : `${lvl.title} · Nível ${lvl.level}`}
          </Text>
          {founder ? (
            <Text style={[st.idLine, { color: c.textSecondary }]} numberOfLines={1}>
              👑 Fundador · entre os 50 primeiros
            </Text>
          ) : null}
        </View>
      </View>

      {/* ---------- 4 stats em linha ---------- */}
      <View style={st.statsRow}>
        {/* Horas no lugar de páginas (decisão 2026-07-10): tempo é o dado MEDIDO;
            páginas é estimativa e segue no card Resumo (que assim complementa em vez
            de duplicar). Rótulos curtos = mais premium. */}
        {(
          [
            [booksRead, 'Livros'],
            [hoursTotal, 'Horas'],
            [derived.activeDays, 'Dias'],
            [derived.streak, 'Sequência'],
          ] as const
        ).map(([value, label], i) => (
          <View key={label} style={[st.statCol, i > 0 && { borderLeftWidth: 1, borderLeftColor: c.border }]}>
            <Text style={[st.statValue, { color: c.text }]} accessibilityLabel={`${value} ${label}`}>
              {value}
            </Text>
            <Text style={[st.statLabel, { color: c.textSecondary }]}>{label}</Text>
          </View>
        ))}
      </View>

      {/* ---------- Card META (anel de progresso) ---------- */}
      <Card style={st.blockCard}>
        <View style={st.cardHead}>
          <Text style={[st.kicker, { color: c.text }]}>META DE LEITURA {new Date().getFullYear()}</Text>
          <Pressable onPress={() => router.navigate('/conquistas')} hitSlop={8}>
            <Text style={[st.link, { color: c.accentPressed }]}>{gp ? 'Editar meta' : 'Criar meta'}</Text>
          </Pressable>
        </View>
        {/* O anel fica SEMPRE visível (0% sem meta) — é a âncora visual do card. */}
        <View style={st.goalRow}>
          <ProgressRing
            progress={gp?.pct ?? 0}
            color={gp?.done ? c.success : c.accent}
            trackColor={c.surfaceAlt}
            size={124}
            strokeWidth={12}>
            <Text style={[st.ringPct, { color: c.text }]}>{Math.round((gp?.pct ?? 0) * 100)}%</Text>
            <Text style={[st.ringSub, { color: c.textSecondary }]}>concluída</Text>
          </ProgressRing>
          {gp ? (
            <View style={st.goalBody}>
              <Text style={[st.goalMain, { color: c.text }]}>
                {gp.current.toLocaleString('pt-BR')} de {gp.target.toLocaleString('pt-BR')} {gp.unit}
              </Text>
              <Text style={[st.goalSub, { color: c.textSecondary }]} numberOfLines={2}>
                {gp.done
                  ? 'Meta concluída! 🎉'
                  : `Faltam ${gp.remaining.toLocaleString('pt-BR')} ${gp.unit} para sua meta`}
              </Text>
              <View style={[st.goalTrack, { backgroundColor: c.surfaceAlt }]}>
                <View
                  style={[
                    st.goalFill,
                    { backgroundColor: gp.done ? c.success : c.accent, width: `${Math.round(gp.pct * 100)}%` },
                  ]}
                />
              </View>
              {!gp.done ? (
                <Text style={[st.goalHint, { color: c.textSecondary }]} numberOfLines={2}>
                  ↗ Ritmo para chegar lá: {gp.perDay.toLocaleString('pt-BR')} {gp.unit}/dia · restam {gp.daysLeft}{' '}
                  {gp.daysLeft === 1 ? 'dia' : 'dias'}
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={st.goalBody}>
              <Text style={[st.goalSub, { color: c.textSecondary }]}>
                Nenhuma meta ativa. Crie um objetivo com prazo — o app calcula o ritmo por dia e acompanha com você.
              </Text>
            </View>
          )}
        </View>
      </Card>

      {/* ---------- Card RESUMO DE ATIVIDADES ---------- */}
      <PressableScale onPress={() => router.navigate('/estatisticas')}>
        <Card style={st.blockCard}>
          <View style={st.cardHead}>
            <Text style={[st.kicker, { color: c.text }]}>RESUMO DE ATIVIDADES</Text>
            <Text style={[st.link, { color: c.textSecondary }]}>Este ano ▾</Text>
          </View>
          <View style={st.miniRow}>
            {(
              [
                ['📖', fmtK(pagesTotal), 'Páginas lidas'],
                ['🕐', String(hoursTotal), 'Horas de leitura'],
                ['📅', String(derived.activeDays), 'Dias de leitura'],
                ['🔥', String(bestStreak), 'Maior sequência'],
              ] as const
            ).map(([icon, value, label]) => (
              <View key={label} style={st.miniCol}>
                <View style={st.miniTop}>
                  <Text style={st.miniIcon}>{icon}</Text>
                  <Text style={[st.miniValue, { color: c.text }]}>{value}</Text>
                </View>
                <Text style={[st.miniLabel, { color: c.textSecondary }]} numberOfLines={1}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
          <View style={st.chartWrap}>
            <MonthLineChart values={months} color={c.accent} labelColor={c.textSecondary} />
          </View>
        </Card>
      </PressableScale>

      {/* ---------- Abas ---------- */}
      <Card style={st.tabsCard}>
        <View style={[st.tabsRow, { borderBottomColor: c.border }]}>
          {TABS.map((t) => {
            const active = t === tab;
            return (
              <Pressable key={t} onPress={() => setTab(t)} style={st.tabBtn} accessibilityLabel={`Aba ${t}`}>
                <Text style={[st.tabText, { color: active ? c.accentPressed : c.textSecondary }]}>{t}</Text>
                <View style={[st.tabUnderline, { backgroundColor: active ? c.accent : 'transparent' }]} />
              </Pressable>
            );
          })}
        </View>

        {tab === 'ATIVIDADES' ? (
          recent.length === 0 ? (
            <Text style={[st.emptyText, { color: c.textSecondary }]}>
              Nenhuma atividade ainda. Cada sessão de leitura aparece aqui, estilo diário do leitor.
            </Text>
          ) : (
            <>
            {recent.map((s: ReadingSession) => {
              const book = books.find((b) => b.id === s.bookId);
              const rating = ratings[bookKeyOf(s.bookTitle)];
              return (
                <View key={s.id} style={[st.actRow, { borderBottomColor: c.border }]}>
                  {book?.coverUrl ? (
                    <Image source={{ uri: book.coverUrl }} style={st.actCover} />
                  ) : (
                    <View style={[st.actCover, st.actCoverEmpty, { backgroundColor: c.surfaceAlt }]}>
                      <Text>📖</Text>
                    </View>
                  )}
                  <View style={st.actBody}>
                    <Text style={[st.actMeta, { color: c.textSecondary }]} numberOfLines={1}>
                      <Text style={{ fontWeight: '700', color: c.text }}>{headerName}</Text> leu{' '}
                      {s.pages > 0 ? `${s.pages} págs · ` : ''}
                      {Math.max(1, Math.round(s.seconds / 60))} min
                    </Text>
                    <Text style={[st.actTitle, { color: c.text }]} numberOfLines={1}>
                      {s.bookTitle}
                    </Text>
                    {rating ? <Stars rating={rating} color={c.warning} dim={c.border} /> : null}
                  </View>
                  <Text style={[st.actWhen, { color: c.textSecondary }]}>{dateLabel(s.startedAt)}</Text>
                </View>
              );
            })}
            <Pressable onPress={() => router.navigate('/estatisticas')} hitSlop={8} style={st.tabFootLink}>
              <Text style={[st.link, { color: c.accentPressed }]}>Ver histórico completo ›</Text>
            </Pressable>
            </>
          )
        ) : null}

        {tab === 'LEITURAS' ? (
          <View style={st.shelfWrap}>
            <MyShelf />
          </View>
        ) : null}

        {tab === 'RESENHAS' ? (
          reviewed.length === 0 ? (
            <Text style={[st.emptyText, { color: c.textSecondary }]}>
              Você ainda não avaliou nenhum livro. Toque num livro da estante para dar sua nota.
            </Text>
          ) : (
            <>
            {reviewed.slice(0, 3).map((s) => (
              <Pressable
                key={s.book_key}
                onPress={() =>
                  router.push({
                    pathname: '/livro',
                    params: {
                      title: s.book_title,
                      ...(s.book_author ? { author: s.book_author } : {}),
                      ...(s.cover_url ? { cover: s.cover_url } : {}),
                      ...(s.isbn ? { isbn: s.isbn } : {}),
                    },
                  })
                }
                style={[st.actRow, { borderBottomColor: c.border }]}>
                {s.cover_url ? (
                  <Image source={{ uri: s.cover_url }} style={st.actCover} />
                ) : (
                  <View style={[st.actCover, st.actCoverEmpty, { backgroundColor: c.surfaceAlt }]}>
                    <Text>📖</Text>
                  </View>
                )}
                <View style={st.actBody}>
                  <Text style={[st.actTitle, { color: c.text }]} numberOfLines={1}>
                    {s.book_title}
                  </Text>
                  {s.book_author ? (
                    <Text style={[st.actMeta, { color: c.textSecondary }]} numberOfLines={1}>
                      {s.book_author}
                    </Text>
                  ) : null}
                  <Stars rating={ratings[s.book_key]} color={c.warning} dim={c.border} />
                </View>
                <Text style={[st.chev, { color: c.textFaint }]}>›</Text>
              </Pressable>
            ))}
            {reviewed.length > 3 ? (
              <Pressable onPress={() => setTab('LEITURAS')} hitSlop={8} style={st.tabFootLink}>
                <Text style={[st.link, { color: c.accentPressed }]}>Ver todas na estante ›</Text>
              </Pressable>
            ) : null}
            </>
          )
        ) : null}

        {tab === 'METAS' ? (
          <>
            {goals.length === 0 ? (
              <Text style={[st.emptyText, { color: c.textSecondary }]}>
                Nenhuma meta criada ainda.
              </Text>
            ) : (
              goals.slice(0, 3).map((g) => {
                const p = deriveGoal(
                  g,
                  stats,
                  g.bookId && books.find((b) => b.id === g.bookId)
                    ? { progress: bookProgress[g.bookId] ?? 0, pages: bookPages[g.bookId] ?? 0 }
                    : undefined,
                );
                const done = !!g.doneAt || p.done;
                return (
                  <View key={g.id} style={[st.goalListRow, { borderBottomColor: c.border }]}>
                    <View style={st.actBody}>
                      <Text style={[st.actTitle, { color: c.text }]} numberOfLines={1}>
                        {done ? '✓ ' : ''}
                        {g.title}
                      </Text>
                      <View style={[st.goalTrack, st.goalTrackSm, { backgroundColor: c.surfaceAlt }]}>
                        <View
                          style={[
                            st.goalFill,
                            { backgroundColor: done ? c.success : c.accent, width: `${Math.round(p.pct * 100)}%` },
                          ]}
                        />
                      </View>
                    </View>
                    <Text style={[st.actWhen, { color: c.textSecondary }]}>{Math.round(p.pct * 100)}%</Text>
                  </View>
                );
              })
            )}
            <Pressable onPress={() => router.navigate('/conquistas')} hitSlop={8} style={st.tabFootLink}>
              <Text style={[st.link, { color: c.accentPressed }]}>
                Metas e conquistas · {unlockedIds.length} de {achievements.length} emblemas ›
              </Text>
            </Pressable>
          </>
        ) : null}

        {tab === 'LISTAS' ? (
          collections.length === 0 ? (
            <Text style={[st.emptyText, { color: c.textSecondary }]}>
              Nenhuma lista ainda. Crie coleções na estante para organizar suas leituras.
            </Text>
          ) : (
            <>
            {collections.slice(0, 3).map((col) => (
              <View key={col.id} style={[st.actRow, { borderBottomColor: c.border }]}>
                <Text style={st.listIcon}>🗂️</Text>
                <Text style={[st.actTitle, st.flex, { color: c.text }]} numberOfLines={1}>
                  {col.name}
                </Text>
                <Text style={[st.actWhen, { color: c.textSecondary }]}>
                  {shelf.filter((s) => s.collection_id === col.id).length}
                </Text>
              </View>
            ))}
            {collections.length > 3 ? (
              <Pressable onPress={() => setTab('LEITURAS')} hitSlop={8} style={st.tabFootLink}>
                <Text style={[st.link, { color: c.accentPressed }]}>Ver todas as listas ›</Text>
              </Pressable>
            ) : null}
            </>
          )
        ) : null}
      </Card>

      {/* ---------- Solicitações de seguir (só quando existem) ---------- */}
      {requests.length > 0 ? (
        <Card style={st.blockCard}>
          <Text style={[st.kicker, { color: c.text, marginBottom: 10 }]}>SOLICITAÇÕES DE SEGUIR</Text>
          {requests.map((r) => (
            <View key={r.follower_id} style={st.reqRow}>
              <Pressable
                style={st.reqWho}
                onPress={() => router.navigate({ pathname: '/usuario', params: { id: r.follower_id, name: r.name ?? '' } })}>
                <Text style={st.reqAvatar}>{r.avatar_url || '🦉'}</Text>
                <Text style={[st.reqName, { color: c.text }]} numberOfLines={1}>
                  {r.name?.trim() || 'Leitor'}
                </Text>
              </Pressable>
              <View style={st.reqActions}>
                <Pressable
                  onPress={() => respondRequest(r.follower_id, true)}
                  style={[st.reqAccept, { backgroundColor: c.accent }]}>
                  <Text style={[st.reqAcceptText, { color: c.onAccent }]}>Aceitar</Text>
                </Pressable>
                <Pressable onPress={() => respondRequest(r.follower_id, false)} hitSlop={6}>
                  <Text style={[st.reqReject, { color: c.textFaint }]}>Recusar</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {/* ---------- "Mais" — utilitários compactos ---------- */}
      {!configured ? (
        <Card style={st.blockCard}>
          <Text style={[st.moreTitle, { color: c.text }]}>Backend não configurado</Text>
          <Text style={[st.moreSub, { color: c.textFaint }]}>
            Preencha as credenciais do Supabase em app.json para habilitar conta e sincronização.
          </Text>
        </Card>
      ) : !user ? (
        <Pressable onPress={() => router.navigate('/login')}>
          <Card style={[st.blockCard, st.moreRow]}>
            <View style={st.flex}>
              <Text style={[st.moreTitle, { color: c.text }]}>Entrar / Criar conta</Text>
              <Text style={[st.moreSub, { color: c.textFaint }]}>
                Para estante, metas e sincronizar entre aparelhos.
              </Text>
            </View>
            <Text style={[st.chev, { color: c.textFaint }]}>›</Text>
          </Card>
        </Pressable>
      ) : (
        <Card style={st.blockCard}>
          <Pressable onPress={() => setShowVocab(true)} style={[st.moreLine, { borderBottomColor: c.border }]}>
            <Text style={[st.moreTitle, { color: c.text }]}>Banco de palavras</Text>
            <Text style={[st.moreSub, { color: c.textSecondary }]}>
              {vocab.length} ›
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.navigate({ pathname: '/usuario', params: { id: user.id, name: headerName } })}
            style={[st.moreLine, { borderBottomColor: c.border }]}>
            <Text style={[st.moreTitle, { color: c.text }]}>Como os outros me veem</Text>
            <Text style={[st.chev, { color: c.textFaint }]}>›</Text>
          </Pressable>
          <Pressable onPress={() => router.navigate('/premium')} style={st.moreLineLast}>
            <Text style={[st.moreTitle, { color: isPremium ? c.success : c.text }]}>
              {isPremium ? '✓ Premium ativo' : '✨ Seja Premium'}
            </Text>
            {!isPremium ? (
              <Text style={[st.moreSub, { color: c.textSecondary }]}>{PRICE_MONTHLY_SUFFIX} ›</Text>
            ) : null}
          </Pressable>
        </Card>
      )}

      {/* ---------- Modais (inalterados) ---------- */}
      <Modal visible={showVocab} animationType="slide" onRequestClose={() => setShowVocab(false)}>
        <View style={[st.flex, { backgroundColor: c.bg }]}>
          <SafeAreaView style={st.flex} edges={['top', 'left', 'right']}>
            <View style={st.modalHeader}>
              <Text style={[st.modalTitle, { color: c.text }]}>Vocabulário</Text>
              <Pressable onPress={() => setShowVocab(false)} hitSlop={8}>
                <Text style={[st.close, { color: c.accentPressed }]}>Fechar</Text>
              </Pressable>
            </View>
            {vocab.length === 0 ? (
              <View style={st.empty}>
                <Text style={[st.emptyText, { color: c.textFaint, textAlign: 'center' }]}>
                  Nenhuma palavra ainda.{'\n'}Enquanto lê, toque numa palavra e escolha “Marcar”.
                </Text>
              </View>
            ) : (
              <FlatList
                data={vocab}
                keyExtractor={(v) => v.id}
                contentContainerStyle={st.list}
                renderItem={({ item }) => (
                  <Card style={st.vCard}>
                    <View style={st.flex}>
                      <Text style={[st.vWord, { color: c.text }]}>{item.word}</Text>
                      {item.context ? (
                        <Text style={[st.vCtx, { color: c.textFaint }]} numberOfLines={2}>
                          {item.context}
                        </Text>
                      ) : null}
                      {item.bookName ? (
                        <Text style={[st.vBook, { color: c.textDim }]}>— {item.bookName}</Text>
                      ) : null}
                    </View>
                    <Pressable onPress={() => removeVocab(item.id)} hitSlop={12}>
                      <Text style={[st.remove, { color: c.textFaint }]}>×</Text>
                    </Pressable>
                  </Card>
                )}
              />
            )}
          </SafeAreaView>
        </View>
      </Modal>

      <SettingsSheet
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        onEditProfile={() => {
          setShowSettings(false);
          setShowEditProfile(true);
        }}
      />

      <ProfileEditor visible={showEditProfile} profile={profile} onClose={() => setShowEditProfile(false)} />
    </ScreenBG>
  );
}

const st = StyleSheet.create({
  flex: { flex: 1 },

  // Topo
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  topSide: { width: 72 },
  topActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16 },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 19, fontFamily: BrandFont.semibold },
  topIcon: { fontSize: 20 },

  // Identidade
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  avatar: { width: 86, height: 86, borderRadius: 43, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarEmoji: { fontSize: 42 },
  avatarInitial: { fontSize: 34, fontWeight: '800' },
  idInfo: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 24, fontFamily: BrandFont.extrabold, flexShrink: 1 },
  lvlBadge: { minWidth: 22, height: 22, borderRadius: 6, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  lvlBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  idLine: { fontSize: 14.5, marginTop: 4 },

  // Linha de 4 stats
  statsRow: { flexDirection: 'row', marginBottom: 16 },
  statCol: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  // Número pesado (Poppins) × rótulo leve — o contraste de peso da referência.
  statValue: { fontSize: 24, fontFamily: BrandFont.extrabold },
  statLabel: { fontSize: 11.5, marginTop: 2, textAlign: 'center' },

  // Cards de bloco
  blockCard: { marginBottom: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  kicker: { fontSize: 13, fontWeight: '800', letterSpacing: 0.6 },
  link: { fontSize: 13.5, fontWeight: '700' },

  // Meta
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  ringPct: { fontSize: 24, fontFamily: BrandFont.extrabold },
  ringSub: { fontSize: 12, marginTop: 1 },
  goalBody: { flex: 1, minWidth: 0 },
  goalMain: { fontSize: 19, fontWeight: '800' },
  goalSub: { fontSize: 13.5, marginTop: 4 },
  goalTrack: { height: 8, borderRadius: 4, marginTop: 10, overflow: 'hidden' },
  goalTrackSm: { height: 6, marginTop: 6 },
  goalFill: { height: '100%', borderRadius: 4 },
  goalHint: { fontSize: 12.5, marginTop: 10, lineHeight: 18 },

  // Resumo de atividades
  miniRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  miniCol: { flex: 1, minWidth: 0 },
  miniTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  miniIcon: { fontSize: 14 },
  miniValue: { fontSize: 16, fontWeight: '800' },
  miniLabel: { fontSize: 10.5, marginTop: 2 },
  chartWrap: { marginTop: 14 },

  // Abas
  tabsCard: { marginBottom: 14, paddingHorizontal: 0, paddingTop: 4, paddingBottom: 6 },
  tabsRow: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 6 },
  tabBtn: { flex: 1, alignItems: 'center', paddingTop: 8 },
  tabText: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.4 },
  tabUnderline: { height: 2.5, borderRadius: 2, alignSelf: 'stretch', marginHorizontal: 8, marginTop: 8 },
  tabFootLink: { alignItems: 'center', paddingVertical: 12 },
  shelfWrap: { paddingHorizontal: 16 },

  // Linhas de atividade/resenha/lista
  actRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  actCover: { width: 44, height: 62, borderRadius: 6 },
  actCoverEmpty: { alignItems: 'center', justifyContent: 'center' },
  actBody: { flex: 1, minWidth: 0 },
  actMeta: { fontSize: 12.5 },
  actTitle: { fontSize: 15.5, fontWeight: '800', marginTop: 2 },
  actWhen: { fontSize: 12.5 },
  stars: { fontSize: 13, marginTop: 4, letterSpacing: 1 },
  starsNum: { fontSize: 12, letterSpacing: 0 },
  listIcon: { fontSize: 20 },
  goalListRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  emptyText: { fontSize: 13.5, lineHeight: 20, padding: 16 },

  // Solicitações
  reqRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  reqWho: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  reqAvatar: { fontSize: 26 },
  reqName: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  reqActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reqAccept: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7 },
  reqAcceptText: { fontSize: 13, fontWeight: '800' },
  reqReject: { fontSize: 13, fontWeight: '700' },

  // "Mais"
  moreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  moreLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  moreLineLast: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  moreTitle: { fontSize: 15, fontWeight: '700' },
  moreSub: { fontSize: 13 },
  chev: { fontSize: 20 },

  // Modal vocabulário
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  modalTitle: { fontSize: 22, fontWeight: '800' },
  close: { fontSize: 15, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  list: { gap: 10, paddingHorizontal: 16, paddingBottom: 24 },
  vCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vWord: { fontSize: 16, fontWeight: '700' },
  vCtx: { fontSize: 13, marginTop: 3 },
  vBook: { fontSize: 12, marginTop: 3 },
  remove: { fontSize: 26, fontWeight: '300' },
});
