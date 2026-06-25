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

import { Card, ScreenBG } from '@/components/social-ui';
import { useUI } from '@/hooks/use-ui';
import {
  QUICK_SEARCHES,
  resolveEpubUrl,
  searchCatalog,
  SOURCES,
  type CatalogBook,
  type CatalogLang,
  type CatalogSource,
} from '@/services/catalog';
import { useLibrary, type ImportedBook } from '@/store/library';

const LANGS: { id: CatalogLang; label: string }[] = [
  { id: 'pt', label: 'Português' },
  { id: 'en', label: 'Inglês' },
  { id: 'all', label: 'Todos' },
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

  const buscar = useCallback(async (src: CatalogSource, q: string, l: CatalogLang) => {
    setLoading(true);
    setError(null);
    try {
      const page = await searchCatalog(src, q, l);
      setResults(page.results);
      if (page.results.length === 0)
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
    // Já está na biblioteca? Abre em vez de baixar de novo.
    const dup = useLibrary
      .getState()
      .books.find((b) => b.format === 'epub' && b.name === book.title);
    if (dup) {
      useLibrary.getState().openBook(dup.id);
      router.navigate('/reader');
      return;
    }

    setDownloadingId(book.id);
    try {
      const url = await resolveEpubUrl(book);
      if (!url) throw new Error('EPUB indisponível para este título.');
      const dest = new File(Paths.document, `book-${Date.now()}.epub`);
      const f = await File.downloadFileAsync(url, dest);
      const imported: ImportedBook = {
        id: `${Date.now()}`,
        name: book.title,
        fileName: `${book.title}.epub`,
        uri: f.uri,
        size: f.size ?? undefined,
        format: 'epub',
        addedAt: Date.now(),
      };
      addBook(imported); // store já marca como livro atual
      setDownloadingId(null);
      router.navigate('/reader');
    } catch (e) {
      setDownloadingId(null);
      Alert.alert('Falha no download', e instanceof Error ? e.message : 'Tente novamente.');
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

      {/* Atalhos de descoberta */}
      <View style={styles.quickRow}>
        {QUICK_SEARCHES.map((q) => (
          <Pressable
            key={q.label}
            onPress={() => {
              setQuery(q.query);
              buscar(source, q.query, lang);
            }}
            style={[styles.quickChip, { borderColor: c.border, backgroundColor: c.card }]}>
            <Text style={[styles.quickText, { color: c.purple }]}>{q.label}</Text>
          </Pressable>
        ))}
      </View>

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
                {query.trim() ? '🔎 Resultados' : '🔥 Populares'}
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
                      <Text style={[styles.coverPlaceholderText, { color: c.textFaint }]}>EPUB</Text>
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
    </ScreenBG>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  back: { paddingVertical: 4, paddingRight: 8 },
  backText: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '800' },
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
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  quickChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  quickText: { fontSize: 12, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  errorText: { fontSize: 15, lineHeight: 22, textAlign: 'center', paddingHorizontal: 20 },
  list: { gap: 12, paddingTop: 8, paddingBottom: 24 },
  sectionLabel: { fontSize: 16, fontWeight: '800', letterSpacing: 0.3, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cover: { width: 46, height: 64, borderRadius: 6 },
  coverPlaceholder: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  coverPlaceholderText: { fontSize: 11, fontWeight: '800' },
  rowBody: { flex: 1, gap: 3 },
  bookName: { fontSize: 15, fontWeight: '600' },
  bookSub: { fontSize: 13 },
  dl: { paddingHorizontal: 8 },
  dlBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  dlText: { fontSize: 13, fontWeight: '700' },
});
