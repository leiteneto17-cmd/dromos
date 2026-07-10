/**
 * Aba Comunidade — o lar SOCIAL do app: feed "Seguindo" (leituras de quem você segue,
 * com Logos 📜) + DESCOBERTA de livros, estilo Skoob. Busca num catálogo público
 * (Google Books + Open Library, regionalizado por idioma) com resultados AO VIVO,
 * grade "Em alta" e "Populares na comunidade". Tocar num livro abre a página dele
 * (/livro), onde se cataloga na estante, avalia e vê quem está lendo.
 *
 * NOTA (2026-06-21): a "Minha estante" foi MOVIDA para a aba Leitura (hub) —
 * componente `components/my-shelf.tsx`. Aqui só ficou a descoberta + indicador "✓"
 * de quais resultados já estão na sua estante.
 * NOTA (2026-07-01): o feed "Seguindo" veio da ex-aba Atividades (removida) — o feed
 * dos seguidos é o conteúdo social mais valioso e agora abre por padrão (era recolhido).
 * As estatísticas/sessões daquela aba viraram a tela /estatisticas.
 * NOTA (2026-07-01b): anti-rolagem — "Em alta" e "Populares" viraram CARROSSÉIS horizontais
 * (padrão prateleira, Netflix/Skoob) e os chips Livros/Pessoas + idioma só aparecem com a
 * busca ativa (padrão iOS: controles de busca são contextuais). Hierarquia: feed primeiro
 * (vertical), descoberta depois (horizontal, explorar é opcional).
 */
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AdBanner } from '@/components/ad-banner';
import { CatalogCover } from '@/components/catalog-cover';
import { Card, ScreenBG } from '@/components/social-ui';
import { useUI } from '@/hooks/use-ui';
import { BrandFont } from '@/constants/theme';
import { searchBooks, trendingBooks, type CatalogBook, type LangFilter } from '@/services/book-catalog';
import {
  bookKeyOf,
  getMyShelf,
  getPopularBooks,
  SHELF_LABEL,
  type PopularBook,
  type ShelfItem,
} from '@/services/community';
import { getPosts, searchUsers, togglePostLogo, type Post, type PublicProfile } from '@/services/social';
import { meusClubes, type Clube } from '@/services/clube';
import { getUnreadCount } from '@/services/notifications';
import { tempoAtras } from '@/services/stories';
import { buySearchUrl, getTrendingBR, type TrendingBook } from '@/services/trending';
import { useAuth } from '@/store/auth';
import { useProfile } from '@/store/profile';

/** Regra "listas de 3": o feed mostra 3 atividades e expande até este teto no "Ver mais". */
const FEED_PREVIEW = 3;
const FEED_MAX = 12;

/** Sugestões de busca (chips) — aparecem com a busca aberta e vazia, como os
 * QUICK_SEARCHES do Explorar, mas adaptadas ao catálogo (Google Books/Open Library):
 * autores clássicos + séries populares funcionam bem em PT. */
const SEARCH_SUGGESTIONS = [
  'Machado de Assis',
  'Clarice Lispector',
  'Jane Austen',
  'Dostoiévski',
  'Agatha Christie',
  'George Orwell',
  'Harry Potter',
  'Sherlock Holmes',
];

type SearchMode = 'books' | 'people';

type CoverSize = 'sm' | 'shelf';

/** Capa do catálogo com fallback tipográfico (título) — ver components/catalog-cover.tsx. */
function Cover({
  uri,
  title,
  author,
  size = 'sm',
}: {
  uri?: string | null;
  title: string;
  author?: string | null;
  size?: CoverSize;
}) {
  const dims = size === 'shelf' ? { width: 92, height: 138, radius: 6 } : { width: 44, height: 64, radius: 4 };
  return <CatalogCover uri={uri} title={title} author={author} {...dims} />;
}

export default function CommunityScreen() {
  const c = useUI();
  const configured = useAuth((s) => s.configured);
  const user = useAuth((s) => s.user);
  const profile = useProfile((s) => s.profile);

  const [mode, setMode] = useState<SearchMode>('books');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogBook[]>([]);
  const [people, setPeople] = useState<PublicProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const lang: LangFilter = 'pt'; // acervo só PT-BR (2026-07-04)
  // Busca "aberta" = mostra os chips Livros/Pessoas + idioma (contextuais). Abre ao focar
  // o campo e só fecha no "Fechar"/"‹ Voltar" (blur não fecha — senão tocar num chip fecharia).
  const [searchOpen, setSearchOpen] = useState(false);

  const [featured, setFeatured] = useState<CatalogBook[]>([]);
  const [shelf, setShelf] = useState<ShelfItem[]>([]); // só p/ o indicador "✓ / status"
  const [popular, setPopular] = useState<PopularBook[]>([]);
  const [posts, setPosts] = useState<Post[]>([]); // publicações (feed estilo X)
  const [feedExpanded, setFeedExpanded] = useState(false); // mostra poucas e expande
  const [meuClube, setMeuClube] = useState<Clube | null>(null); // card "Clube do Livro"
  const [unread, setUnread] = useState(0); // bolinha do sino
  const [trendingBR, setTrendingBR] = useState<TrendingBook[]>([]); // curadoria semanal

  const load = useCallback(async () => {
    trendingBooks().then(setFeatured);
    getTrendingBR().then(setTrendingBR); // curadoria BR (harvester); [] → fallback mundial
    if (!user) {
      setShelf([]);
      setPopular([]);
      setPosts([]);
      return;
    }
    getPosts().then(setPosts); // publicações (minhas + de quem sigo) — coração da aba
    getUnreadCount().then(setUnread);
    meusClubes().then((l) => setMeuClube(l[0] ?? null));
    const [sh, pop] = await Promise.all([getMyShelf(), getPopularBooks()]);
    setShelf(sh);
    setPopular(pop);
  }, [user, lang]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const shelfByKey = new Map(shelf.map((s) => [s.book_key, s] as const));

  // Busca AO VIVO (debounce 450ms, mín. 2 letras) com cancelamento da anterior.
  // Atende os dois modos: livros (catálogo) e pessoas (perfis públicos).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setPeople([]);
      setSearched(false);
      setSearching(false);
      return;
    }
    const ctrl = new AbortController();
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        if (mode === 'people') {
          const r = await searchUsers(q);
          if (!ctrl.signal.aborted) {
            setPeople(r);
            setSearched(true);
          }
        } else {
          const r = await searchBooks(q, lang, ctrl.signal);
          if (!ctrl.signal.aborted) {
            setResults(r);
            setSearched(true);
          }
        }
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 450);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, lang, mode]);

  const clearSearch = useCallback(() => {
    setResults([]);
    setPeople([]);
    setQuery('');
    setSearched(false);
  }, []);

  // Fecha a experiência de busca inteira (limpa, esconde os chips e volta p/ livros).
  const closeSearch = useCallback(() => {
    clearSearch();
    setSearchOpen(false);
    setMode('books');
    Keyboard.dismiss();
  }, [clearSearch]);

  // Trocar de modo limpa a busca atual (livros e pessoas têm resultados diferentes).
  const switchMode = useCallback(
    (m: SearchMode) => {
      setMode(m);
      clearSearch();
    },
    [clearSearch],
  );

  const openUser = useCallback((p: PublicProfile) => {
    router.push({ pathname: '/usuario', params: { id: p.id, name: p.name ?? '' } });
  }, []);

  // Logos 📜 (kudo) no post: otimista — atualiza na hora e reverte se der erro.
  const onKudo = useCallback(async (item: Post) => {
    const on = !item.iKudoed;
    setPosts((prev) =>
      prev.map((f) => (f.id === item.id ? { ...f, iKudoed: on, kudos: f.kudos + (on ? 1 : -1) } : f)),
    );
    const err = await togglePostLogo(item.id, on);
    if (err) {
      setPosts((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, iKudoed: !on, kudos: f.kudos + (on ? -1 : 1) } : f)),
      );
    }
  }, []);

  // Publicar: abre a tela de nova publicação (post estilo X).
  const goPublish = useCallback(() => router.push('/publicar' as Href), []);

  // Abre a página do livro. Da busca/Em alta passa o livro inteiro (JSON) p/ não re-buscar.
  const openCatalog = useCallback((b: CatalogBook) => {
    router.push({
      pathname: '/livro',
      params: {
        title: b.title,
        ...(b.author ? { author: b.author } : {}),
        ...(b.coverUrl ? { cover: b.coverUrl } : {}),
        ...(b.isbn ? { isbn: b.isbn } : {}),
        data: JSON.stringify(b),
      },
    });
  }, []);

  const openPopular = useCallback((p: PopularBook) => {
    router.push({
      pathname: '/livro',
      params: { title: p.book_title, ...(p.cover_url ? { cover: p.cover_url } : {}) },
    });
  }, []);

  return (
    <ScreenBG>
      {/* Header: título + sino (referência aprovada 2026-07-10) — sem subtítulo. */}
      <View style={styles.headRow}>
        <Text style={[styles.title, { color: c.text }]}>Comunidade</Text>
        <Pressable
          onPress={() => router.push({ pathname: '/notificacoes' })}
          hitSlop={10}
          accessibilityLabel={unread > 0 ? `Notificações, ${unread} não lidas` : 'Notificações'}
          style={styles.bellWrap}>
          <Text style={styles.bell}>🔔</Text>
          {unread > 0 ? <View style={styles.bellDot} /> : null}
        </Pressable>
      </View>

      {!configured ? (
        <Card style={styles.note}>
          <Text style={[styles.noteTitle, { color: c.text }]}>Backend não configurado</Text>
          <Text style={[styles.noteSub, { color: c.textFaint }]}>
            Preencha as credenciais do Supabase em app.json para habilitar a comunidade.
          </Text>
        </Card>
      ) : (
        <>
          {/* Campo de busca ÚNICO (a busca já é ao vivo — botão "Buscar" era redundante).
              Focar abre os chips; o ✕ limpa (com texto) ou fecha (sem texto). */}
          <View style={[styles.inputWrap, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.searchGlyph, { color: c.textFaint }]}>🔎</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onFocus={() => setSearchOpen(true)}
              onSubmitEditing={() => Keyboard.dismiss()}
              placeholder="Buscar leitores, livros ou clubes…"
              placeholderTextColor={c.textFaint}
              returnKeyType="search"
              style={[styles.input, { color: c.text }]}
            />
            {searching ? <ActivityIndicator size="small" color={c.accent} /> : null}
            {searchOpen || query.length > 0 ? (
              <Pressable
                onPress={() => (query.length > 0 ? clearSearch() : closeSearch())}
                hitSlop={8}
                style={styles.clearX}
                accessibilityLabel={query.length > 0 ? 'Limpar busca' : 'Fechar busca'}>
                <Text style={{ color: c.textFaint, fontSize: 17 }}>✕</Text>
              </Pressable>
            ) : null}
          </View>

          {/* Controles CONTEXTUAIS da busca (anti-rolagem: só aparecem com a busca aberta) */}
          {searchOpen ? (
            <>
              {/* Seletor: buscar livros (catálogo) ou pessoas (leitores p/ seguir) */}
              <View style={styles.modeRow}>
                {([
                  ['books', '📚 Livros'],
                  ['people', '👥 Pessoas'],
                ] as const).map(([m, label]) => {
                  const active = mode === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => switchMode(m)}
                      style={[
                        styles.modeChip,
                        // Chip ativo = accentSoft + texto accentPressed; inativo = neutro (guia §6.3).
                        { borderColor: active ? c.accent : c.border, backgroundColor: active ? c.accentSoft : 'transparent' },
                      ]}>
                      <Text style={[styles.modeText, { color: active ? c.accentPressed : c.textDim }]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Idioma: acervo só PT-BR (2026-07-04) → seletor removido. `lang` fica fixo 'pt'. */}

              {/* Sugestões — atalhos de busca pronta (praticidade: 1 toque já busca) */}
              {mode === 'books' && query.trim().length < 2 ? (
                <View style={styles.suggestWrap}>
                  {SEARCH_SUGGESTIONS.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setQuery(s)}
                      style={[styles.suggestChip, { borderColor: c.border, backgroundColor: c.card }]}>
                      <Text style={[styles.suggestText, { color: c.textDim }]}>🔎 {s}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </>
          ) : null}

          {/* Banner do tier grátis — abaixo da busca (visível, fora do leitor §2.5). */}
          <AdBanner style={styles.ad} />

          {query.trim().length >= 2 ? (
            /* ---- Modo de busca (resultados ao vivo: livros ou pessoas) ---- */
            <>
              <View style={styles.resultsHead}>
                <Text style={[styles.resultsTitle, { color: c.textSecondary }]}>
                  {mode === 'people' ? '🔎 Pessoas' : '🔎 Resultados'}
                </Text>
                <Pressable onPress={closeSearch} hitSlop={8}>
                  <Text style={[styles.clearLink, { color: c.accentPressed }]}>‹ Voltar</Text>
                </Pressable>
              </View>

              {mode === 'people' && !user ? (
                <Pressable onPress={() => router.navigate('/login')}>
                  <Card style={styles.acctRow}>
                    <View style={styles.flex}>
                      <Text style={[styles.noteTitle, { color: c.text }]}>Entrar para buscar leitores</Text>
                      <Text style={[styles.noteSub, { color: c.textFaint }]}>
                        Crie sua conta ou entre para encontrar e seguir leitores.
                      </Text>
                    </View>
                    <Text style={[styles.chev, { color: c.textFaint }]}>›</Text>
                  </Card>
                </Pressable>
              ) : (
                <>
                  {searching && (mode === 'people' ? people.length === 0 : results.length === 0) ? (
                    <ActivityIndicator color={c.accent} style={{ marginTop: 24 }} />
                  ) : (mode === 'people' ? people.length === 0 : results.length === 0) && searched ? (
                    <Text style={[styles.hint, { color: c.textFaint, marginTop: 8 }]}>
                      {mode === 'people'
                        ? `Nenhum leitor público encontrado para “${query.trim()}”. Só quem ativa o perfil público aparece aqui.`
                        : `Nenhum resultado para “${query.trim()}”. Tente outro termo ou troque o idioma para 🌐 Todos.`}
                    </Text>
                  ) : null}

                  {mode === 'people'
                    ? people.map((p) => (
                        <Pressable key={p.id} onPress={() => openUser(p)}>
                          <Card style={styles.row}>
                            <Text style={styles.personAvatar}>
                              {p.avatar_url && !p.avatar_url.startsWith('http') ? p.avatar_url : '🦉'}
                            </Text>
                            <View style={styles.rowBody}>
                              <Text style={[styles.bookTitle, { color: c.text }]} numberOfLines={1}>
                                {p.name?.trim() || 'Leitor'}
                              </Text>
                              <Text style={[styles.author, { color: c.textFaint }]}>Perfil público</Text>
                            </View>
                            <Text style={[styles.addChip, { color: c.accentPressed }]}>Ver ›</Text>
                          </Card>
                        </Pressable>
                      ))
                    : results.map((b) => {
                        const mine = shelfByKey.get(bookKeyOf(b.title));
                        return (
                          <Pressable key={`${b.source}-${b.id}`} onPress={() => openCatalog(b)}>
                            <Card style={styles.row}>
                              <Cover uri={b.coverUrl} title={b.title} author={b.author} />
                              <View style={styles.rowBody}>
                                <Text style={[styles.bookTitle, { color: c.text }]} numberOfLines={2}>
                                  {b.title}
                                </Text>
                                {b.author ? (
                                  <Text style={[styles.author, { color: c.textFaint }]} numberOfLines={1}>
                                    {b.author}
                                    {b.year ? ` · ${b.year}` : ''}
                                  </Text>
                                ) : null}
                              </View>
                              {/* Já na estante = estado CONCLUÍDO → verde success; ação → azul. */}
                              <Text style={[styles.addChip, { color: mine ? c.success : c.accentPressed }]}>
                                {mine ? SHELF_LABEL[mine.status] + ' ✓' : '+ Estante'}
                              </Text>
                            </Card>
                          </Pressable>
                        );
                      })}
                </>
              )}
            </>
          ) : mode === 'people' ? (
            /* ---- Pessoas, sem busca: instrução / login ---- */
            !user ? (
              <Pressable onPress={() => router.navigate('/login')}>
                <Card style={[styles.acctRow, { marginTop: 22 }]}>
                  <View style={styles.flex}>
                    <Text style={[styles.noteTitle, { color: c.text }]}>Entrar para buscar leitores</Text>
                    <Text style={[styles.noteSub, { color: c.textFaint }]}>
                      Crie sua conta ou entre para encontrar e seguir leitores.
                    </Text>
                  </View>
                  <Text style={[styles.chev, { color: c.textFaint }]}>›</Text>
                </Card>
              </Pressable>
            ) : (
              <Text style={[styles.hint, { color: c.textFaint, marginTop: 22 }]}>
                Digite o nome de um leitor para encontrá-lo e seguir. Só aparecem perfis públicos.
              </Text>
            )
          ) : (
            /* ---- Tela inicial: FEED SOCIAL (reforma 2026-07-10 — pessoas primeiro,
                    livros como descoberta; hierarquia aprovada pelo usuário) ---- */
            <>
              {/* Clube do Livro — card CLARO (referência 2026-07-10): pill azul + livro real
                  do SEU clube (meusClubes) com capa; sem clube, vira convite p/ /clubes. */}
              <Pressable
                onPress={() =>
                  meuClube
                    ? router.push({ pathname: '/clube', params: { id: meuClube.id } })
                    : router.push({ pathname: '/clubes' })
                }>
                <Card style={styles.clubeCard}>
                  <View style={styles.flex}>
                    <View style={[styles.clubePill, { backgroundColor: c.accentSoft }]}>
                      <Text style={[styles.clubePillText, { color: c.accentPressed }]}>
                        {meuClube ? 'SEU CLUBE DO LIVRO' : 'CLUBE DO LIVRO'}
                      </Text>
                    </View>
                    <Text style={[styles.clubeTitle, { color: c.text }]} numberOfLines={2}>
                      {meuClube ? meuClube.book_title : 'Leia junto com outros leitores'}
                    </Text>
                    <Text style={[styles.clubeSub, { color: c.textDim }]} numberOfLines={1}>
                      {meuClube
                        ? meuClube.book_author ?? meuClube.name
                        : 'Cronograma semanal + discussão guiada'}
                    </Text>
                    <View style={[styles.clubeCta, { backgroundColor: c.accent }]}>
                      <Text style={[styles.clubeCtaText, { color: c.onAccent }]}>
                        {meuClube ? 'Continuar ›' : 'Entrar ›'}
                      </Text>
                    </View>
                  </View>
                  <CatalogCover
                    uri={meuClube?.book_cover_url}
                    title={meuClube?.book_title ?? 'Clube do Livro'}
                    author={meuClube?.book_author}
                    width={64}
                    height={92}
                    radius={8}
                  />
                </Card>
              </Pressable>

              {/* Composer estilo Threads — substitui o botão "Publicar" gordo. */}
              {user ? (
                <Pressable onPress={goPublish} accessibilityLabel="Nova publicação">
                  <Card style={styles.composer}>
                    <View style={[styles.composerAvatar, { backgroundColor: c.accentSoft }]}>
                      <Text style={styles.composerAvatarText}>
                        {profile?.avatar_url || (profile?.name?.trim().charAt(0).toUpperCase() ?? '🦉')}
                      </Text>
                    </View>
                    <Text style={[styles.composerHint, { color: c.textFaint }]}>O que você leu hoje?</Text>
                    <View style={[styles.composerBtn, { backgroundColor: c.accent }]}>
                      <Text style={[styles.composerCta, { color: c.onAccent }]}>✏️ Publicar</Text>
                    </View>
                  </Card>
                </Pressable>
              ) : null}

              {/* PUBLICAÇÕES (reforma 2026-07-10, referência BooKal/X): stories e "atividades
                  recentes" foram MORTOS — o feed agora é de POSTS permanentes (texto do autor
                  + o que ele estava lendo), reusando reading_activities publicadas (getPosts). */}
              {user ? (
                <>
                  <View style={styles.sectionHead}>
                    <Text style={[styles.sectionHeadTitle, { color: c.text }]}>Publicações</Text>
                    {posts.length > FEED_PREVIEW ? (
                      <Pressable onPress={() => setFeedExpanded((v) => !v)} hitSlop={8}>
                        <Text style={[styles.sectionHeadLink, { color: c.accentPressed }]}>
                          {feedExpanded ? 'Ver menos' : 'Ver todas'}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                  {posts.length === 0 ? (
                    <Text style={[styles.hint, { color: c.textFaint, marginBottom: 6 }]}>
                      Nenhuma publicação ainda. Escreva a primeira no “O que você leu hoje?” —
                      e siga leitores (busque 👥 Pessoas acima) para ver as deles.
                    </Text>
                  ) : (
                    posts.slice(0, feedExpanded ? FEED_MAX : FEED_PREVIEW).map((p) => (
                      <Card key={p.id} style={styles.postCard}>
                        {/* Cabeçalho: avatar + nome + tempo */}
                        <View style={styles.postHead}>
                          <Text style={styles.postAvatar}>{p.author_avatar || '🦉'}</Text>
                          <View style={styles.flex}>
                            <Text style={[styles.postName, { color: c.text }]} numberOfLines={1}>
                              {p.author_name}
                            </Text>
                            <Text style={[styles.postWhen, { color: c.textFaint }]}>{tempoAtras(p.created_at)}</Text>
                          </View>
                          {/* Logos 📜 (nosso "kudos") — otimista via onKudo */}
                          <Pressable
                            onPress={() => onKudo(p)}
                            hitSlop={8}
                            accessibilityLabel={p.iKudoed ? 'Remover Logos' : 'Dar Logos'}
                            style={[
                              styles.kudoBtn,
                              { borderColor: p.iKudoed ? c.accent : c.border, backgroundColor: p.iKudoed ? c.accentSoft : 'transparent' },
                            ]}>
                            <Text style={[styles.kudoText, { color: p.iKudoed ? c.accentPressed : c.textDim }]}>
                              📜 {p.kudos}
                            </Text>
                          </Pressable>
                        </View>
                        {/* Texto do post (quando o autor escreveu algo) */}
                        {p.caption ? (
                          <Text style={[styles.postText, { color: c.text }]}>{p.caption}</Text>
                        ) : null}
                        {/* Chip do livro anexado (OPCIONAL): leitura, Em alta ou clube */}
                        {p.book ? (
                          <View style={[styles.postBookChip, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
                            <Text style={[styles.postBookText, { color: c.textDim }]} numberOfLines={1}>
                              {p.book.kind === 'tendencia' ? '🔥' : p.book.kind === 'clube' ? '📚' : '📖'}{' '}
                              <Text style={{ fontWeight: '800', color: c.text }}>{p.book.title}</Text>
                              {p.book.kind === 'leitura'
                                ? `  ·  ${p.book.pages ? `${p.book.pages} págs · ` : ''}${Math.max(1, Math.round((p.book.seconds ?? 60) / 60))} min`
                                : p.book.author
                                  ? `  ·  ${p.book.author}`
                                  : ''}
                            </Text>
                          </View>
                        ) : null}
                      </Card>
                    ))
                  )}
                  {posts.length > FEED_PREVIEW ? (
                    <Pressable onPress={() => setFeedExpanded((v) => !v)} hitSlop={8} style={styles.feedMore}>
                      <Text style={[styles.feedMoreText, { color: c.accentPressed }]}>
                        {feedExpanded ? 'Mostrar menos ▴' : 'Ver mais publicações ▾'}
                      </Text>
                    </Pressable>
                  ) : null}
                </>
              ) : null}

              {/* Em alta: CURADORIA BR do harvester quando existir (PublishNews/Veja/BookTok,
                  trending.json semanal — só metadados + onde comprar, §4.3); senão o fallback
                  HONESTO "no mundo" (Open Library global). */}
              {trendingBR.length > 0 ? (
                <>
                  <View style={styles.sectionHead}>
                    <Text style={[styles.sectionHeadTitle, { color: c.text }]}>Em alta no Brasil 🇧🇷</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelfRow}>
                    {trendingBR.map((t) => (
                      <Pressable
                        key={`br-${t.rank}`}
                        style={styles.shelfCell}
                        onPress={() =>
                          router.push({
                            pathname: '/livro',
                            params: {
                              title: t.title,
                              author: t.author,
                              ...(t.coverUrl ? { cover: t.coverUrl } : {}),
                              buy: t.buyUrl ?? buySearchUrl(t.title, t.author),
                            },
                          })
                        }>
                        <View>
                          <Cover uri={t.coverUrl} title={t.title} author={t.author} size="shelf" />
                          <View style={[styles.rankBadge, { backgroundColor: c.text }]}>
                            <Text style={[styles.rankBadgeText, { color: c.bg }]}>{t.rank}</Text>
                          </View>
                        </View>
                        <Text style={[styles.shelfTitle, { color: c.text }]} numberOfLines={2}>
                          {t.title}
                        </Text>
                        {t.source ? (
                          <Text style={[styles.shelfMeta, { color: c.textFaint }]} numberOfLines={1}>
                            via {t.source}
                          </Text>
                        ) : null}
                      </Pressable>
                    ))}
                  </ScrollView>
                </>
              ) : featured.length > 0 ? (
                <>
                  <View style={styles.sectionHead}>
                    <Text style={[styles.sectionHeadTitle, { color: c.text }]}>Em alta no mundo 🌍</Text>
                    <Pressable onPress={() => router.push({ pathname: '/explorar' })} hitSlop={8}>
                      <Text style={[styles.sectionHeadLink, { color: c.accentPressed }]}>Ver todas</Text>
                    </Pressable>
                  </View>
                  {/* Prateleira horizontal com RANKING (1–5, referência) — deslizar pro lado. */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelfRow}>
                    {featured.slice(0, 8).map((b, i) => (
                      <Pressable key={`${b.source}-${b.id}`} style={styles.shelfCell} onPress={() => openCatalog(b)}>
                        <View>
                          <Cover uri={b.coverUrl} title={b.title} author={b.author} size="shelf" />
                          <View style={[styles.rankBadge, { backgroundColor: c.text }]}>
                            <Text style={[styles.rankBadgeText, { color: c.bg }]}>{i + 1}</Text>
                          </View>
                        </View>
                        <Text style={[styles.shelfTitle, { color: c.text }]} numberOfLines={2}>
                          {b.title}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </>
              ) : null}

              {!user ? (
                <Pressable onPress={() => router.navigate('/login')}>
                  <Card style={[styles.acctRow, { marginTop: 22 }]}>
                    <View style={styles.flex}>
                      <Text style={[styles.noteTitle, { color: c.text }]}>Entrar / Criar conta</Text>
                      <Text style={[styles.noteSub, { color: c.textFaint }]}>
                        Para montar sua estante e ver quem está lendo.
                      </Text>
                    </View>
                    <Text style={[styles.chev, { color: c.textFaint }]}>›</Text>
                  </Card>
                </Pressable>
              ) : popular.length > 0 ? (
                <>
                  {/* Atalhos de navegação: Clubes e Desafios (cada seção com 1 propósito). */}
                  <View style={styles.navRow}>
                    <Pressable onPress={() => router.push({ pathname: '/clubes' })} style={styles.navHalf}>
                      <Card style={styles.navCard}>
                        <Text style={styles.navIcon}>👥</Text>
                        <Text style={[styles.navLabel, { color: c.text }]}>Clubes</Text>
                        <Text style={[styles.chev, { color: c.textFaint }]}>›</Text>
                      </Card>
                    </Pressable>
                    <Pressable onPress={() => router.push({ pathname: '/desafios' })} style={styles.navHalf}>
                      <Card style={styles.navCard}>
                        <Text style={styles.navIcon}>🎯</Text>
                        <Text style={[styles.navLabel, { color: c.text }]}>Desafios</Text>
                        <Text style={[styles.chev, { color: c.textFaint }]}>›</Text>
                      </Card>
                    </Pressable>
                  </View>

                  <View style={styles.sectionHead}>
                    <Text style={[styles.sectionHeadTitle, { color: c.text }]}>Descubra livros</Text>
                    <Pressable onPress={() => router.push({ pathname: '/explorar' })} hitSlop={8}>
                      <Text style={[styles.sectionHeadLink, { color: c.accentPressed }]}>Ver todos</Text>
                    </Pressable>
                  </View>
                  {/* "Populares na comunidade" (✓ = já está na sua estante) — reader_count real. */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelfRow}>
                    {popular.slice(0, 10).map((p) => (
                      <Pressable key={p.book_key} style={styles.shelfCell} onPress={() => openPopular(p)}>
                        <Cover uri={p.cover_url} title={p.book_title} size="shelf" />
                        <Text style={[styles.shelfTitle, { color: c.text }]} numberOfLines={2}>
                          {p.book_title}
                        </Text>
                        <Text style={[styles.shelfMeta, { color: shelfByKey.has(p.book_key) ? c.success : c.textFaint }]}>
                          👥 {p.reader_count}
                          {shelfByKey.has(p.book_key) ? ' · ✓' : ''}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </>
              ) : (
                <Text style={[styles.hint, { color: c.textFaint }]}>
                  Busque um livro acima para começar. Sua estante fica no Perfil.
                </Text>
              )}
            </>
          )}
        </>
      )}

      <Card style={styles.privacy}>
        <Text style={[styles.privacyText, { color: c.textDim }]}>
          🔒 O que você lê é íntimo. Só quem torna o perfil público aparece para os outros (Perfil → Privacidade).
        </Text>
      </Card>
    </ScreenBG>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { fontSize: 28, fontFamily: BrandFont.extrabold },
  subtitle: { fontSize: 14, marginTop: 4 },
  note: { marginTop: 16 },
  noteTitle: { fontSize: 16, fontWeight: '700' },
  noteSub: { fontSize: 13, marginTop: 3 },
  acctRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chev: { fontSize: 22 },
  // Header com sino
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bellWrap: { position: 'relative', padding: 2 },
  bell: { fontSize: 22 },
  bellDot: { position: 'absolute', top: 0, right: 0, width: 9, height: 9, borderRadius: 5, backgroundColor: '#EF4444' },
  searchGlyph: { fontSize: 15, marginRight: 8 },
  // Cabeçalho de seção: título tinta + link "Ver todas" (padrão da referência)
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 },
  sectionHeadTitle: { fontSize: 18, fontFamily: BrandFont.semibold, letterSpacing: 0.2 },
  sectionHeadLink: { fontSize: 13.5, fontWeight: '700' },
  // Ranking das Tendências
  rankBadge: { position: 'absolute', top: -6, left: -6, minWidth: 24, height: 24, borderRadius: 7, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  rankBadgeText: { fontSize: 12.5, fontWeight: '900' },
  // Posts (feed estilo X — reforma 2026-07-10)
  postCard: { marginBottom: 10, paddingVertical: 13 },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  postAvatar: { fontSize: 26, width: 34, textAlign: 'center' },
  postName: { fontSize: 15, fontWeight: '800' },
  postWhen: { fontSize: 12, marginTop: 1 },
  postText: { fontSize: 14.5, lineHeight: 21, marginTop: 10 },
  postBookChip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, marginTop: 10 },
  postBookText: { fontSize: 13 },
  // Composer "O que você leu hoje?" (estilo Threads)
  composer: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, marginBottom: 12 },
  composerAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  composerAvatarText: { fontSize: 18 },
  composerHint: { flex: 1, fontSize: 14.5 },
  composerBtn: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  composerCta: { fontSize: 13.5, fontWeight: '800' },
  kudoBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  kudoText: { fontSize: 13, fontWeight: '700' },
  feedMore: { alignItems: 'center', paddingVertical: 11 },
  feedMoreText: { fontSize: 14, fontWeight: '700' },
  // Atalhos Clubes/Desafios
  navRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  navHalf: { flex: 1 },
  navCard: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 13 },
  navIcon: { fontSize: 18 },
  navLabel: { flex: 1, fontSize: 15, fontWeight: '800' },
  modeRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  modeChip: { flex: 1, borderWidth: 1, borderRadius: 999, paddingVertical: 9, alignItems: 'center' },
  modeText: { fontSize: 14, fontWeight: '800' },
  personAvatar: { fontSize: 30, width: 44, textAlign: 'center' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, marginTop: 14, marginBottom: 14 },
  input: { flex: 1, paddingVertical: 11, fontSize: 15 },
  clearX: { paddingLeft: 8 },
  langRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  langChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  langText: { fontSize: 13, fontWeight: '700' },
  suggestWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  suggestChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  suggestText: { fontSize: 13, fontWeight: '600' },
  resultsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 },
  resultsTitle: { fontSize: 18, fontWeight: '700', letterSpacing: 0.3 },
  clearLink: { fontSize: 15, fontWeight: '800' },
  hint: { fontSize: 13, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  rowBody: { flex: 1 },
  cover: { borderRadius: 4, overflow: 'hidden' },
  coverSm: { width: 44, height: 64 },
  shelfCover: { width: 92, height: 138, borderRadius: 6 },
  bookTitle: { fontSize: 15, fontWeight: '700' },
  author: { fontSize: 13, marginTop: 2 },
  addChip: { fontSize: 13, fontWeight: '800' },
  shelfRow: { gap: 12, paddingBottom: 4 },
  shelfCell: { width: 92 },
  shelfTitle: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  shelfMeta: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  privacy: { marginTop: 18 },
  privacyText: { fontSize: 13, lineHeight: 20 },
  ad: { marginTop: 16 },
  // Card do Clube do Livro — superfície CLARA (referência 2026-07-10): pill azul +
  // livro real do clube com capa à direita; cores do tema via inline.
  clubeCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  clubePill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  clubePillText: { fontSize: 10.5, fontWeight: '900', letterSpacing: 0.8 },
  clubeTitle: { fontSize: 19, fontWeight: '900', marginTop: 8 },
  clubeSub: { fontSize: 13, marginTop: 2 },
  clubeCta: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, marginTop: 10 },
  clubeCtaText: { fontSize: 13, fontWeight: '900' },
  moreText: { fontSize: 14, fontWeight: '700' },
});
