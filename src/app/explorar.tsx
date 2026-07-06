/**
 * Explorar — catálogo online MULTI-FONTE de livros (CLAUDE.md §4.3: só acervo livre/
 * sem DRM). Rota EMPILHADA alcançada pela Biblioteca (não vira aba nova — já temos 5).
 * Fontes: Project Gutenberg (padrão, curado) e Internet Archive (acervo aberto, com
 * aviso). Baixa o EPUB para `Paths.document` e o adiciona pelo MESMO modelo da
 * importação (ImportedBook), então leitor/progresso/stats funcionam igual.
 */
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AdBanner } from '@/components/ad-banner';
import { Card, ScreenBG } from '@/components/social-ui';
import { BrandFont } from '@/constants/theme';
import { useUI } from '@/hooks/use-ui';
import {
  featuredBrazilian,
  resolveEpubUrl,
  searchCatalog,
  SOURCES,
  type CatalogBook,
  type CatalogLang,
  type CatalogSource,
} from '@/services/catalog';
import { filterCurated, loadCurated } from '@/services/curated-catalog';
import { useLibrary, type ImportedBook } from '@/store/library';

// Acervo só em PT-BR (decisão do usuário 2026-07-04): sem catálogo inglês. Mantido como
// lista p/ o seletor voltar fácil se um dia houver outro idioma; hoje 1 item = row escondida.
const LANGS: { id: CatalogLang; label: string }[] = [
  { id: 'pt', label: '🇧🇷 Português' },
];

/**
 * Filtro de GÊNERO (substitui a parede de pills autores+gêneros — decisão 2026-07-06:
 * liberar espaço vertical). Só gêneros (autores agora se acham pela busca). O `query` é em
 * inglês porque casa melhor com o assunto no Gutenberg. `''` = limpa e volta à vitrine BR.
 */
const GENRES: { label: string; query: string; emoji: string }[] = [
  { label: 'Todos', query: '', emoji: '✦' },
  { label: 'Aventura', query: 'adventure', emoji: '🧭' },
  { label: 'Romance', query: 'romance', emoji: '💗' },
  { label: 'Ficção científica', query: 'science fiction', emoji: '🚀' },
  { label: 'Terror', query: 'horror', emoji: '👻' },
  { label: 'Poesia', query: 'poetry', emoji: '🕊️' },
  { label: 'Contos', query: 'short stories', emoji: '📜' },
];

export default function ExplorarScreen() {
  const c = useUI();
  const addBook = useLibrary((s) => s.addBook);

  const [source, setSource] = useState<CatalogSource>('gutenberg');
  const [query, setQuery] = useState('');
  const [lang, setLang] = useState<CatalogLang>('pt');
  const [results, setResults] = useState<CatalogBook[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  // Filtro de gênero colapsável (fechado por padrão — 1 linha só, anti-rolagem).
  const [genreOpen, setGenreOpen] = useState(false);
  const [genre, setGenre] = useState<string>('Todos');

  const buscar = useCallback(async (src: CatalogSource, q: string, l: CatalogLang) => {
    setLoading(true);
    setError(null);
    try {
      // Acervo PRÓPRIO curado primeiro (clássicos que o Gutenberg não tem, ex.: Sun Tzu).
      // Carrega uma vez e filtra localmente por idioma/termo — sempre vem no topo.
      const curated = filterCurated(await loadCurated(), q, l);

      // Vitrine padrão em PT (sem busca) = clássicos brasileiros curados; o resto usa o
      // catálogo normal. O Gutenberg não separa pt-BR de pt-PT, então curamos por autor.
      const isBrShelf = !q.trim() && src === 'gutenberg' && l === 'pt';
      let base: CatalogBook[];
      if (isBrShelf) {
        base = await featuredBrazilian();
      } else if (q.trim()) {
        // Busca: combina Gutenberg + Google Books (grátis baixável). Se uma fonte falhar
        // (ex.: Google em 429), a outra ainda responde — não derruba a busca.
        const [g, gb] = await Promise.all([
          searchCatalog(src, q, l).then((r) => r.results).catch(() => [] as CatalogBook[]),
          searchCatalog('google', q, l).then((r) => r.results).catch(() => [] as CatalogBook[]),
        ]);
        // INTERCALA as duas fontes (1 de cada) para o Google aparecer no topo também,
        // em vez de enterrado embaixo de todos os resultados do Gutenberg.
        base = [];
        for (let i = 0; i < Math.max(g.length, gb.length); i++) {
          if (g[i]) base.push(g[i]);
          if (gb[i]) base.push(gb[i]);
        }
      } else {
        base = (await searchCatalog(src, q, l)).results;
      }

      // Mescla acervo próprio + fonte online, sem repetir o mesmo título.
      const seen = new Set<string>();
      const results: CatalogBook[] = [];
      for (const b of [...curated, ...base]) {
        const key = b.title.trim().toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(b);
      }

      setResults(results);
      if (results.length === 0)
        setError('Nenhum livro encontrado. Tente outro termo, idioma ou fonte.');
    } catch (e) {
      setResults([]);
      setError(e instanceof Error ? e.message : 'Falha de rede ao buscar o catálogo.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Recarrega ao abrir e ao trocar fonte/idioma.
  useEffect(() => {
    buscar(source, query, lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, lang]);

  async function baixar(book: CatalogBook) {
    // Livro não está em português (ex.: clássico em inglês)? Abre já com a tradução
    // automática LIGADA — o leitor lê o sinal `pt=1` (combina com o aviso "Leia em
    // português no app" do card).
    const ptAuto = !!(book.language && book.language !== 'pt');
    const readerTarget = ptAuto ? { pathname: '/reader' as const, params: { pt: '1' } } : '/reader';
    const fmt = book.format ?? 'epub'; // acervo curado pode ser PDF; catálogos externos são EPUB

    // Já está na biblioteca? Abre em vez de baixar de novo.
    const dup = useLibrary
      .getState()
      .books.find((b) => b.format === fmt && b.name === book.title);
    if (dup) {
      useLibrary.getState().openBook(dup.id);
      router.navigate(readerTarget);
      return;
    }

    setDownloadingId(book.id);
    try {
      const url = await resolveEpubUrl(book);
      if (!url) throw new Error('Arquivo indisponível para este título.');
      // O servidor do Project Gutenberg às vezes responde devagar (timeout de leitura).
      // Tentamos até 2 vezes antes de desistir.
      let f: File | null = null;
      let lastErr: unknown;
      for (let attempt = 0; attempt < 2 && !f; attempt++) {
        try {
          const dest = new File(Paths.document, `book-${Date.now()}-${attempt}.${fmt}`);
          f = await File.downloadFileAsync(url, dest);
        } catch (e) {
          lastErr = e;
        }
      }
      if (!f) throw lastErr ?? new Error('Falha no download.');
      const id = `${Date.now()}`;
      // Capa: baixa a imagem do catálogo para um arquivo local (offline-first). Se falhar,
      // guarda a própria URL remota como fallback (expo-image ainda cacheia ao carregar).
      let coverUrl: string | undefined = book.coverUrl ?? undefined;
      if (book.coverUrl) {
        try {
          const cDest = new File(Paths.document, `cover-${id}.jpg`);
          const cf = await File.downloadFileAsync(book.coverUrl, cDest);
          coverUrl = cf.uri;
        } catch {
          // mantém a URL remota
        }
      }
      const imported: ImportedBook = {
        id,
        name: book.title,
        fileName: `${book.title}.${fmt}`,
        uri: f.uri,
        size: f.size ?? undefined,
        format: fmt,
        addedAt: Date.now(),
        coverUrl,
      };
      addBook(imported); // store já marca como livro atual
      setDownloadingId(null);
      router.navigate(readerTarget);
    } catch (e) {
      setDownloadingId(null);
      const msg = e instanceof Error ? e.message : '';
      const friendly = /tim(e|ed)\s*out|timeout/i.test(msg)
        ? 'A conexão com o acervo ficou lenta e o download expirou. Tente de novo — o servidor do Project Gutenberg às vezes oscila.'
        : msg || 'Tente novamente.';
      Alert.alert('Falha no download', friendly);
    }
  }

  const archiveNote = source === 'archive' ? SOURCES.find((s) => s.id === 'archive')?.note : null;

  return (
    <ScreenBG scroll={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
          <Text style={[styles.backText, { color: c.textDim }]}>‹ Voltar</Text>
        </Pressable>
      </View>

      <Text style={[styles.title, { color: c.text }]}>Explorar</Text>
      <Text style={[styles.subtitle, { color: c.textFaint }]}>
        Clássicos populares para baixar e ler de graça (domínio público). Busque um título ou
        explore os mais lidos.
      </Text>

      {/* "Grandes Jornadas" (ENEM + Dromos Kids) MOVIDO p/ a Biblioteca (2026-07-06). */}

      {/* Fonte do acervo (só aparece quando há mais de uma) */}
      {SOURCES.length > 1 ? (
        <View style={styles.sourceRow}>
          {SOURCES.map((s) => {
            const active = s.id === source;
            return (
              <Pressable
                key={s.id}
                onPress={() => setSource(s.id)}
                style={[
                  styles.sourceChip,
                  { backgroundColor: c.card, borderColor: active ? c.green : c.border },
                  active && { borderWidth: 2 },
                ]}>
                <Text style={[styles.sourceText, { color: active ? c.green : c.textDim }]}>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {archiveNote ? (
        <Text style={[styles.note, { color: c.textFaint }]}>⚠️ {archiveNote}</Text>
      ) : null}

      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => buscar(source, query, lang)}
          returnKeyType="search"
          placeholder="Buscar título ou autor…"
          placeholderTextColor={c.textFaint}
          style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
        />
        <Pressable
          onPress={() => buscar(source, query, lang)}
          style={[styles.searchBtn, { backgroundColor: c.green }]}>
          <Text style={[styles.searchBtnText, { color: c.onGreen }]}>Buscar</Text>
        </Pressable>
      </View>

      {/* Seletor de idioma só aparece se houver mais de um idioma (hoje: só PT-BR). */}
      {LANGS.length > 1 ? (
        <View style={styles.langRow}>
          {LANGS.map((l) => {
            const active = l.id === lang;
            return (
              <Pressable
                key={l.id}
                onPress={() => setLang(l.id)}
                style={[
                  styles.langChip,
                  { borderColor: active ? c.green : c.border },
                  active && { borderWidth: 2 },
                ]}>
                <Text style={[styles.langText, { color: active ? c.green : c.textDim }]}>{l.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* Filtro de gênero COLAPSÁVEL (substitui a parede de pills — só 1 linha quando fechado). */}
      <Pressable
        onPress={() => setGenreOpen((v) => !v)}
        style={[styles.genreBar, { backgroundColor: c.card, borderColor: genreOpen ? c.green : c.border }]}>
        <Text style={[styles.genreBarText, { color: c.textDim }]}>
          🎭 Gênero: <Text style={{ fontWeight: '800', color: c.text }}>{genre}</Text>
        </Text>
        <Text style={[styles.genreCaret, { color: c.purple }]}>{genreOpen ? '▲' : '▼'}</Text>
      </Pressable>

      {genreOpen ? (
        <View style={styles.genrePanel}>
          {GENRES.map((g) => {
            const active = g.label === genre;
            return (
              <Pressable
                key={g.label}
                onPress={() => {
                  setGenre(g.label);
                  setGenreOpen(false);
                  setQuery(g.query);
                  buscar(source, g.query, lang);
                }}
                style={[
                  styles.genreChip,
                  { borderColor: active ? c.green : c.border, backgroundColor: active ? c.card : 'transparent' },
                ]}>
                <Text style={[styles.genreChipText, { color: active ? c.green : c.purple }]}>
                  {g.emoji} {g.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.green} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: c.textFaint }]}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            results.length > 0 ? (
              <Text style={[styles.sectionLabel, { color: c.purple }]}>
                {query.trim()
                  ? '🔎 Resultados'
                  : lang === 'pt'
                    ? '🇧🇷 Clássicos brasileiros'
                    : '🔥 Populares'}
              </Text>
            ) : null
          }
          renderItem={({ item }) => {
            const busy = downloadingId === item.id;
            return (
              <Pressable onPress={() => baixar(item)} disabled={busy}>
                <Card style={styles.row}>
                  {item.coverUrl ? (
                    <Image source={{ uri: item.coverUrl }} style={styles.cover} resizeMode="cover" />
                  ) : (
                    <View style={[styles.cover, styles.coverPlaceholder, { backgroundColor: c.cardElevated, borderColor: c.border }]}>
                      <Text style={[styles.coverPlaceholderText, { color: c.textFaint }]}>
                        {(item.format ?? 'epub').toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.rowBody}>
                    <Text style={[styles.bookName, { color: c.text }]} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={[styles.bookSub, { color: c.textFaint }]} numberOfLines={1}>
                      {item.author}
                      {item.language ? ` · ${item.language.toUpperCase()}` : ''}
                    </Text>
                    {item.source === 'curated' ? (
                      <Text style={[styles.srcTag, { color: c.green }]}>★ Acervo +leitura</Text>
                    ) : (
                      <Text style={[styles.srcTag, { color: c.textFaint }]}>
                        {item.source === 'google'
                          ? '🔎 Google Books'
                          : item.source === 'archive'
                            ? 'Internet Archive'
                            : '📚 Project Gutenberg'}
                      </Text>
                    )}
                    {item.language && item.language !== 'pt' ? (
                      <Text style={[styles.ptHint, { color: c.purple }]}>🌐 Leia em português no app</Text>
                    ) : null}
                  </View>
                  {busy ? (
                    <ActivityIndicator color={c.green} style={styles.dl} />
                  ) : (
                    <View style={[styles.dlBtn, { borderColor: c.green }]}>
                      <Text style={[styles.dlText, { color: c.green }]}>Baixar</Text>
                    </View>
                  )}
                </Card>
              </Pressable>
            );
          }}
        />
      )}

      {/* Banner do tier grátis — fixo no rodapé (sempre visível, fora do leitor §2.5). */}
      <AdBanner style={styles.ad} />
    </ScreenBG>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  back: { paddingVertical: 4, paddingRight: 8 },
  backText: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 28, fontFamily: BrandFont.extrabold },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 2, marginBottom: 12 },
  sourceRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  sourceChip: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  sourceText: { fontSize: 13, fontWeight: '700' },
  note: { fontSize: 12, lineHeight: 17, marginBottom: 8 },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
  input: { flex: 1, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11, fontSize: 16 },
  searchBtn: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  searchBtnText: { fontWeight: '800', fontSize: 14 },
  langRow: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 8 },
  langChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  langText: { fontSize: 13, fontWeight: '700' },
  genreBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 12,
    marginBottom: 8,
  },
  genreBarText: { fontSize: 14 },
  genreCaret: { fontSize: 12, fontWeight: '800' },
  genrePanel: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  genreChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  genreChipText: { fontSize: 13, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  errorText: { fontSize: 15, lineHeight: 22, textAlign: 'center', paddingHorizontal: 20 },
  list: { gap: 12, paddingTop: 8, paddingBottom: 24 },
  ad: { marginTop: 12 },
  sectionLabel: { fontSize: 16, fontWeight: '800', letterSpacing: 0.3, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cover: { width: 46, height: 64, borderRadius: 6 },
  coverPlaceholder: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  coverPlaceholderText: { fontSize: 11, fontWeight: '800' },
  rowBody: { flex: 1, gap: 3 },
  bookName: { fontSize: 15, fontWeight: '600' },
  bookSub: { fontSize: 13 },
  srcTag: { fontSize: 11, fontWeight: '800', marginTop: 2 },
  ptHint: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  dl: { paddingHorizontal: 8 },
  dlBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  dlText: { fontSize: 13, fontWeight: '700' },
});
