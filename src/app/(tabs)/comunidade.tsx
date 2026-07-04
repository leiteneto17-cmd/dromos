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
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AdBanner } from '@/components/ad-banner';
import { Card, ScreenBG, SectionTitle } from '@/components/social-ui';
import { useUI } from '@/hooks/use-ui';
import { Social } from '@/theme/social';
import { featuredBooks, searchBooks, type CatalogBook, type LangFilter } from '@/services/book-catalog';
import {
  bookKeyOf,
  getMyShelf,
  getPopularBooks,
  SHELF_LABEL,
  type PopularBook,
  type ShelfItem,
} from '@/services/community';
import { getFeed, searchUsers, toggleKudo, type FeedItem, type PublicProfile } from '@/services/social';
import { useAuth } from '@/store/auth';

/** Quantos itens do feed "Seguindo" mostrar antes do "Ver mais" (não vira lista infinita). */
const FEED_PREVIEW = 5;

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

/** Data amigável da atividade: "hoje 14:30", "ontem 09:10" ou "12/06/2026". Usa data
 * LOCAL (não UTC) para casar com a hora local exibida — senão erra "hoje/ontem" perto
 * da meia-noite. */
function fmtFeedDate(ts: number): string {
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

type SearchMode = 'books' | 'people';

type CoverSize = 'sm' | 'shelf';

function Cover({ uri, size = 'sm' }: { uri?: string | null; size?: CoverSize }) {
  const c = useUI();
  const dim = size === 'shelf' ? styles.shelfCover : styles.coverSm;
  if (uri) return <Image source={{ uri }} style={[styles.cover, dim]} contentFit="cover" transition={150} />;
  return (
    <View style={[styles.cover, dim, { backgroundColor: c.cardElevated, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ fontSize: size === 'sm' ? 18 : 26 }}>📘</Text>
    </View>
  );
}

export default function CommunityScreen() {
  const c = useUI();
  const configured = useAuth((s) => s.configured);
  const user = useAuth((s) => s.user);

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
  const [feed, setFeed] = useState<FeedItem[]>([]); // "Seguindo" — leituras de quem sigo
  const [feedExpanded, setFeedExpanded] = useState(false); // mostra poucas e expande

  const load = useCallback(async () => {
    featuredBooks(lang).then(setFeatured);
    if (!user) {
      setShelf([]);
      setPopular([]);
      setFeed([]);
      return;
    }
    const [sh, pop, fd] = await Promise.all([getMyShelf(), getPopularBooks(), getFeed()]);
    setShelf(sh);
    setPopular(pop);
    // Janela de 7 dias: quem segue muita gente acumulava atividade VELHA no feed —
    // mesmo retrátil, virava poluição. Feed social é sobre o AGORA (estilo Strava).
    const corte = Date.now() - 7 * 24 * 60 * 60 * 1000;
    setFeed(fd.filter((f) => new Date(f.created_at).getTime() >= corte));
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

  // Logos 📜 (kudo): otimista — atualiza na hora e reverte se der erro.
  const onKudo = useCallback(async (item: FeedItem) => {
    const on = !item.iKudoed;
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
      <Text style={[styles.title, { color: c.text }]}>Comunidade</Text>
      <Text style={[styles.subtitle, { color: c.textFaint }]}>
        Descubra livros e veja o que a comunidade está lendo.
      </Text>

      {!configured ? (
        <Card style={styles.note}>
          <Text style={[styles.noteTitle, { color: c.text }]}>Backend não configurado</Text>
          <Text style={[styles.noteSub, { color: c.textFaint }]}>
            Preencha as credenciais do Supabase em app.json para habilitar a comunidade.
          </Text>
        </Card>
      ) : (
        <>
          {/* Campo de busca (livros no catálogo / pessoas por nome). Focar abre os chips. */}
          <View style={styles.searchRow}>
            <View style={[styles.inputWrap, { backgroundColor: c.card, borderColor: c.border }]}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                onFocus={() => setSearchOpen(true)}
                onSubmitEditing={() => Keyboard.dismiss()}
                placeholder={mode === 'people' ? 'Buscar leitor pelo nome…' : 'Buscar livro ou autor…'}
                placeholderTextColor={c.textFaint}
                returnKeyType="search"
                style={[styles.input, { color: c.text }]}
              />
              {query.length > 0 ? (
                <Pressable onPress={clearSearch} hitSlop={8} style={styles.clearX}>
                  <Text style={{ color: c.textFaint, fontSize: 17 }}>✕</Text>
                </Pressable>
              ) : null}
            </View>
            {/* Sem texto, o botão fecha a busca (chips somem); com texto, é o "Buscar". */}
            <Pressable
              onPress={() => (query.trim() ? Keyboard.dismiss() : searchOpen ? closeSearch() : setSearchOpen(true))}
              style={[styles.searchBtn, { backgroundColor: c.green }]}>
              {searching ? (
                <ActivityIndicator size="small" color={c.onGreen} />
              ) : (
                <Text style={[styles.searchBtnText, { color: c.onGreen }]}>
                  {searchOpen && !query.trim() ? 'Fechar' : 'Buscar'}
                </Text>
              )}
            </Pressable>
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
                        { borderColor: active ? c.green : c.border, backgroundColor: active ? c.green : 'transparent' },
                      ]}>
                      <Text style={[styles.modeText, { color: active ? c.onGreen : c.textDim }]}>{label}</Text>
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
                <Text style={[styles.resultsTitle, { color: c.purple }]}>
                  {mode === 'people' ? '🔎 Pessoas' : '🔎 Resultados'}
                </Text>
                <Pressable onPress={closeSearch} hitSlop={8}>
                  <Text style={[styles.clearLink, { color: c.green }]}>‹ Voltar</Text>
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
                    <ActivityIndicator color={c.green} style={{ marginTop: 24 }} />
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
                            <Text style={[styles.addChip, { color: c.purple }]}>Ver ›</Text>
                          </Card>
                        </Pressable>
                      ))
                    : results.map((b) => {
                        const mine = shelfByKey.get(bookKeyOf(b.title));
                        return (
                          <Pressable key={`${b.source}-${b.id}`} onPress={() => openCatalog(b)}>
                            <Card style={styles.row}>
                              <Cover uri={b.coverUrl} />
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
                              <Text style={[styles.addChip, { color: mine ? c.green : c.purple }]}>
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
            /* ---- Tela inicial (livros): Seguindo + Em alta + Populares ---- */
            <>
              {/* Clube do Livro guiado — card de destaque (gradiente roxo da identidade
                  social §2.7 + borda/acento verde neon). É a feature-vitrine da aba. */}
              <Pressable onPress={() => router.push({ pathname: '/clubes' })}>
                <LinearGradient
                  colors={['#3B2A63', '#221A38']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.clubeCard}>
                  <View style={styles.clubeIconWrap}>
                    <Text style={styles.clubeIcon}>📖</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.clubeTitle}>Clube do Livro</Text>
                    <Text style={styles.clubeSub} numberOfLines={1}>
                      Leia junto: cronograma semanal + discussão guiada
                    </Text>
                  </View>
                  <View style={styles.clubeCta}>
                    <Text style={styles.clubeCtaText}>Entrar ›</Text>
                  </View>
                </LinearGradient>
              </Pressable>

              {/* Feed "Seguindo" — leituras de quem você segue (§2.6, veio da ex-aba Atividades) */}
              {user ? (
                <>
                  <SectionTitle name="users">Seguindo</SectionTitle>
                  {feed.length === 0 ? (
                    <Text style={[styles.hint, { color: c.textFaint, marginBottom: 6 }]}>
                      Nenhuma leitura de quem você segue nos últimos 7 dias. Siga mais leitores
                      (busque em 👥 Pessoas) — as leituras recentes deles aparecem aqui.
                    </Text>
                  ) : (
                    <>
                      {(feedExpanded ? feed : feed.slice(0, FEED_PREVIEW)).map((f) => (
                        <Card key={f.id} style={styles.feedRow}>
                          <Pressable
                            onPress={() =>
                              router.push({ pathname: '/usuario', params: { id: f.user_id, name: f.author_name } })
                            }>
                            <Text style={styles.feedAvatar}>{f.author_avatar || '🦉'}</Text>
                          </Pressable>
                          <View style={styles.flex}>
                            <Text style={[styles.feedWho, { color: c.text }]} numberOfLines={1}>
                              <Text style={{ fontWeight: '800', color: f.author_founder ? c.green : c.text }}>
                                {f.author_name}
                                {f.author_founder ? ' 👑' : ''}
                              </Text>{' '}
                              leu
                            </Text>
                            <Text style={[styles.feedBook, { color: c.textDim }]} numberOfLines={1}>
                              {f.book_title}
                            </Text>
                            <Text style={[styles.feedMeta, { color: c.textFaint }]}>
                              {fmtFeedDate(new Date(f.created_at).getTime())} ·{' '}
                              {Math.max(1, Math.round(f.seconds / 60))} min
                              {f.pages ? ` · ${f.pages} ${f.pages === 1 ? 'pág' : 'págs'}` : ''}
                            </Text>
                          </View>
                          <Pressable
                            onPress={() => onKudo(f)}
                            hitSlop={8}
                            style={styles.kudoBtn}
                            accessibilityRole="button"
                            accessibilityLabel={
                              f.iKudoed
                                ? `Tirar seu Logos (${f.kudos})`
                                : f.kudos > 0
                                  ? `Dar um Logos — ${f.kudos} Logos`
                                  : 'Dar um Logos'
                            }>
                            {/* "Logos" 📜 = a interação social (antigo "kudo" do Strava) */}
                            <Text style={[styles.kudoIcon, { opacity: f.iKudoed ? 1 : 0.4 }]}>📜</Text>
                            {f.kudos > 0 ? (
                              <Text style={[styles.kudoCount, { color: f.iKudoed ? c.green : c.textFaint }]}>
                                {f.kudos}
                              </Text>
                            ) : null}
                          </Pressable>
                        </Card>
                      ))}
                      {feed.length > FEED_PREVIEW ? (
                        <Pressable onPress={() => setFeedExpanded((v) => !v)} style={styles.moreBtn}>
                          <Text style={[styles.moreText, { color: c.purple }]}>
                            {feedExpanded ? 'Ver menos ▴' : `Ver mais (${feed.length}) ▾`}
                          </Text>
                        </Pressable>
                      ) : null}
                    </>
                  )}
                </>
              ) : null}

              {featured.length > 0 ? (
                <>
                  <SectionTitle name="trendingUp">Em alta</SectionTitle>
                  {/* Prateleira horizontal (anti-rolagem): explorar é deslizar pro lado. */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelfRow}>
                    {featured.map((b) => (
                      <Pressable key={`${b.source}-${b.id}`} style={styles.shelfCell} onPress={() => openCatalog(b)}>
                        <Cover uri={b.coverUrl} size="shelf" />
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
                  <SectionTitle name="flame">Populares na comunidade</SectionTitle>
                  {/* Mesma prateleira horizontal do "Em alta" (✓ = já está na sua estante). */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelfRow}>
                    {popular.slice(0, 10).map((p) => (
                      <Pressable key={p.book_key} style={styles.shelfCell} onPress={() => openPopular(p)}>
                        <Cover uri={p.cover_url} size="shelf" />
                        <Text style={[styles.shelfTitle, { color: c.text }]} numberOfLines={2}>
                          {p.book_title}
                        </Text>
                        <Text style={[styles.shelfMeta, { color: shelfByKey.has(p.book_key) ? c.green : c.textFaint }]}>
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
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 14, marginTop: 4 },
  note: { marginTop: 16 },
  noteTitle: { fontSize: 16, fontWeight: '700' },
  noteSub: { fontSize: 13, marginTop: 3 },
  acctRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chev: { fontSize: 22 },
  modeRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  modeChip: { flex: 1, borderWidth: 1, borderRadius: 999, paddingVertical: 9, alignItems: 'center' },
  modeText: { fontSize: 14, fontWeight: '800' },
  personAvatar: { fontSize: 30, width: 44, textAlign: 'center' },
  searchRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14 },
  input: { flex: 1, paddingVertical: 10, fontSize: 15 },
  clearX: { paddingLeft: 8 },
  searchBtn: { borderRadius: 12, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', minWidth: 84 },
  searchBtnText: { fontSize: 14, fontWeight: '800' },
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
  feedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  feedAvatar: { fontSize: 30 },
  feedWho: { fontSize: 14 },
  feedBook: { fontSize: 14, fontWeight: '700', marginTop: 1 },
  feedMeta: { fontSize: 12, marginTop: 3 },
  kudoBtn: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, minWidth: 36 },
  kudoIcon: { fontSize: 22 },
  kudoCount: { fontSize: 12, fontWeight: '800', marginTop: 2 },
  moreBtn: { alignItems: 'center', paddingVertical: 10, marginBottom: 4 },
  // Card de destaque do Clube do Livro — cores FIXAS da identidade social (§2.7):
  // gradiente roxo profundo + verde neon, independente do tema do leitor.
  clubeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(62,232,154,0.35)',
  },
  clubeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(62,232,154,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubeIcon: { fontSize: 22 },
  clubeTitle: { fontSize: 16, fontWeight: '900', color: '#EDEAF5' },
  clubeSub: { fontSize: 12.5, color: '#B9A6E8', marginTop: 1 },
  clubeCta: {
    backgroundColor: '#3EE89A',
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  clubeCtaText: { fontSize: 13, fontWeight: '900', color: Social.dark },
  moreText: { fontSize: 14, fontWeight: '700' },
});
