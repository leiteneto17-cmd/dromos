/**
 * Aba Comunidade — DESCOBERTA de livros, estilo Skoob. Busca num catálogo público
 * (Google Books + Open Library, regionalizado por idioma) com resultados AO VIVO,
 * grade "Em alta" e "Populares na comunidade". Tocar num livro abre a página dele
 * (/livro), onde se cataloga na estante, avalia e vê quem está lendo.
 *
 * NOTA (2026-06-21): a "Minha estante" foi MOVIDA para a aba Leitura (hub) —
 * componente `components/my-shelf.tsx`. Aqui só ficou a descoberta + indicador "✓"
 * de quais resultados já estão na sua estante.
 */
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, ScreenBG, SectionTitle } from '@/components/social-ui';
import { useUI } from '@/hooks/use-ui';
import { featuredBooks, searchBooks, type CatalogBook, type LangFilter } from '@/services/book-catalog';
import {
  bookKeyOf,
  getMyShelf,
  getPopularBooks,
  SHELF_LABEL,
  type PopularBook,
  type ShelfItem,
} from '@/services/community';
import { useAuth } from '@/store/auth';

type CoverSize = 'sm' | 'grid';

function Cover({ uri, size = 'sm' }: { uri?: string | null; size?: CoverSize }) {
  const c = useUI();
  const dim = size === 'grid' ? styles.gridCover : styles.coverSm;
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

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogBook[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [lang, setLang] = useState<LangFilter>('pt');

  const [featured, setFeatured] = useState<CatalogBook[]>([]);
  const [shelf, setShelf] = useState<ShelfItem[]>([]); // só p/ o indicador "✓ / status"
  const [popular, setPopular] = useState<PopularBook[]>([]);

  const load = useCallback(async () => {
    featuredBooks(lang).then(setFeatured);
    if (!user) {
      setShelf([]);
      setPopular([]);
      return;
    }
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
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearched(false);
      setSearching(false);
      return;
    }
    const ctrl = new AbortController();
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await searchBooks(q, lang, ctrl.signal);
        if (!ctrl.signal.aborted) {
          setResults(r);
          setSearched(true);
        }
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 450);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, lang]);

  const clearSearch = useCallback(() => {
    setResults([]);
    setQuery('');
    setSearched(false);
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
          {/* Busca no catálogo (descoberta liberada p/ todos) */}
          <View style={styles.searchRow}>
            <View style={[styles.inputWrap, { backgroundColor: c.card, borderColor: c.border }]}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => Keyboard.dismiss()}
                placeholder="Buscar livro ou autor…"
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
            <Pressable onPress={() => Keyboard.dismiss()} style={[styles.searchBtn, { backgroundColor: c.green }]}>
              {searching ? (
                <ActivityIndicator size="small" color={c.onGreen} />
              ) : (
                <Text style={[styles.searchBtnText, { color: c.onGreen }]}>Buscar</Text>
              )}
            </Pressable>
          </View>

          {/* Idioma (regionalização) */}
          <View style={styles.langRow}>
            {([
              ['pt', '🇧🇷 Português'],
              ['en', '🇺🇸 Inglês'],
              ['all', '🌐 Todos'],
            ] as const).map(([l, label]) => {
              const active = lang === l;
              return (
                <Pressable
                  key={l}
                  onPress={() => setLang(l)}
                  style={[styles.langChip, { borderColor: active ? c.green : c.border, backgroundColor: active ? c.green : 'transparent' }]}>
                  <Text style={[styles.langText, { color: active ? c.onGreen : c.textDim }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          {query.trim().length >= 2 ? (
            /* ---- Modo de busca (resultados ao vivo) ---- */
            <>
              <View style={styles.resultsHead}>
                <Text style={[styles.resultsTitle, { color: c.purple }]}>🔎 Resultados</Text>
                <Pressable onPress={clearSearch} hitSlop={8}>
                  <Text style={[styles.clearLink, { color: c.green }]}>‹ Voltar</Text>
                </Pressable>
              </View>
              {searching && results.length === 0 ? (
                <ActivityIndicator color={c.green} style={{ marginTop: 24 }} />
              ) : results.length === 0 && searched ? (
                <Text style={[styles.hint, { color: c.textFaint, marginTop: 8 }]}>
                  Nenhum resultado para “{query.trim()}”. Tente outro termo ou troque o idioma para 🌐 Todos.
                </Text>
              ) : null}
              {results.map((b) => {
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
          ) : (
            /* ---- Tela inicial: Em alta + Populares ---- */
            <>
              {featured.length > 0 ? (
                <>
                  <SectionTitle icon="📈">Em alta</SectionTitle>
                  <View style={styles.grid}>
                    {featured.map((b) => (
                      <Pressable key={`${b.source}-${b.id}`} style={styles.gridCell} onPress={() => openCatalog(b)}>
                        <Cover uri={b.coverUrl} size="grid" />
                        <Text style={[styles.gridTitle, { color: c.text }]} numberOfLines={2}>
                          {b.title}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
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
                  <SectionTitle icon="🔥">Populares na comunidade</SectionTitle>
                  {popular.slice(0, 10).map((p) => (
                    <Pressable key={p.book_key} onPress={() => openPopular(p)}>
                      <Card style={styles.row}>
                        <Cover uri={p.cover_url} />
                        <View style={styles.rowBody}>
                          <Text style={[styles.bookTitle, { color: c.text }]} numberOfLines={2}>
                            {p.book_title}
                          </Text>
                          <Text style={[styles.readers, { color: c.textFaint }]}>👥 {p.reader_count} leitores</Text>
                        </View>
                        <Text style={[styles.addChip, { color: shelfByKey.has(p.book_key) ? c.green : c.purple }]}>
                          {shelfByKey.has(p.book_key) ? '✓' : '+ Estante'}
                        </Text>
                      </Card>
                    </Pressable>
                  ))}
                </>
              ) : (
                <Text style={[styles.hint, { color: c.textFaint }]}>
                  Busque um livro acima para começar. Sua estante fica na aba Leitura.
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
  searchRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14 },
  input: { flex: 1, paddingVertical: 10, fontSize: 15 },
  clearX: { paddingLeft: 8 },
  searchBtn: { borderRadius: 12, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', minWidth: 84 },
  searchBtnText: { fontSize: 14, fontWeight: '800' },
  langRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  langChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  langText: { fontSize: 13, fontWeight: '700' },
  resultsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 },
  resultsTitle: { fontSize: 18, fontWeight: '700', letterSpacing: 0.3 },
  clearLink: { fontSize: 15, fontWeight: '800' },
  hint: { fontSize: 13, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  rowBody: { flex: 1 },
  cover: { borderRadius: 4, overflow: 'hidden' },
  coverSm: { width: 44, height: 64 },
  gridCover: { width: '100%', aspectRatio: 0.66, borderRadius: 6 },
  bookTitle: { fontSize: 15, fontWeight: '700' },
  author: { fontSize: 13, marginTop: 2 },
  readers: { fontSize: 12, marginTop: 4 },
  addChip: { fontSize: 13, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridCell: { width: '31.5%', marginBottom: 16 },
  gridTitle: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  privacy: { marginTop: 18 },
  privacyText: { fontSize: 13, lineHeight: 20 },
});
