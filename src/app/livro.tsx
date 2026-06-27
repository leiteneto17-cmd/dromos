/**
 * Página do livro (Comunidade · C2) — estilo Skoob. Aberta ao tocar num livro na aba
 * Comunidade. Mostra: capa grande + título/autor, status na MINHA estante (escolher/
 * trocar/remover inline), a "temperatura" do livro na comunidade (quantas pessoas em
 * cada status — só números, §4.8), sinopse, ficha (páginas/idioma/gênero/ano) e livros
 * do mesmo autor. Reviews + moderação ficam p/ o C3.
 *
 * Metadados (sinopse etc.) vêm do catálogo público (Google Books + Open Library). As
 * contagens vêm de `book_status_counts` (função SECURITY DEFINER já existente no banco),
 * então esta tela NÃO exige rodar SQL novo.
 */
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookReviews } from '@/components/book-reviews';
import { BuyLinks } from '@/components/buy-links';
import { Card, SectionTitle } from '@/components/social-ui';
import { useUI } from '@/hooks/use-ui';
import { bookDetails, similarBooks, type CatalogBook } from '@/services/book-catalog';
import {
  bookKeyOf,
  getBookStatusCounts,
  getPublicReaders,
  getShelfStatusFor,
  removeShelf,
  setShelf,
  SHELF_LABEL,
  SHELF_STATUSES,
  type PublicReader,
  type ShelfStatus,
} from '@/services/community';
import { useAuth } from '@/store/auth';

type Params = {
  title?: string;
  author?: string;
  cover?: string;
  isbn?: string;
  /** Livro completo do catálogo (JSON) quando a origem já tinha o metadado (busca/Em alta). */
  data?: string;
};

const STATUS_EMOJI: Record<ShelfStatus, string> = {
  lendo: '📖',
  quero_ler: '🔖',
  lido: '✅',
  relendo: '🔁',
  abandonei: '🚪',
};

const LANG_NAMES: Record<string, string> = {
  pt: 'Português',
  en: 'Inglês',
  es: 'Espanhol',
  fr: 'Francês',
  de: 'Alemão',
  it: 'Italiano',
};

/** Nome amigável do idioma (cai p/ o código em maiúsculas se desconhecido). */
function langName(code: string): string {
  return LANG_NAMES[code.toLowerCase()] ?? code.toUpperCase();
}

/** Mescla detalhes: mantém os campos já presentes no `base` (edição boa) e completa
 * com os do `extra` (ex.: sinopse que faltava). Evita que a re-busca sobrescreva o idioma. */
function mergePreferring(base: CatalogBook | null, extra: CatalogBook): CatalogBook {
  if (!base) return extra;
  const filled = Object.fromEntries(
    Object.entries(base).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0)),
  );
  return { ...extra, ...filled } as CatalogBook;
}

/** Limpa os gêneros do catálogo: tira prefixos técnicos ("series:..."), normaliza e dedup. */
function cleanGenres(raw?: string[]): string[] {
  if (!raw?.length) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const g of raw) {
    const cleaned = g.replace(/^[a-z_]+:/i, '').replace(/_/g, ' ').trim();
    const k = cleaned.toLowerCase();
    if (!cleaned || seen.has(k)) continue;
    seen.add(k);
    out.push(cleaned);
  }
  return out;
}

export default function BookScreen() {
  const c = useUI();
  const p = useLocalSearchParams<Params>();
  const user = useAuth((s) => s.user);
  const title = (p.title ?? '').trim();
  const bookKey = bookKeyOf(title);

  // Metadado completo recebido da grade/busca (já é uma edição boa do Google em PT/EN).
  const seeded = useMemo<CatalogBook | null>(() => {
    if (!p.data) return null;
    try {
      return JSON.parse(String(p.data)) as CatalogBook;
    } catch {
      return null;
    }
  }, [p.data]);

  const [details, setDetails] = useState<CatalogBook | null>(seeded);
  const [loadingDetails, setLoadingDetails] = useState(!seeded?.synopsis);
  const [counts, setCounts] = useState<Record<ShelfStatus, number>>({
    lendo: 0,
    quero_ler: 0,
    lido: 0,
    relendo: 0,
    abandonei: 0,
  });
  const [myStatus, setMyStatus] = useState<ShelfStatus | null>(null);
  const [readers, setReaders] = useState<PublicReader[]>([]);
  const [similar, setSimilar] = useState<CatalogBook[]>([]);
  const [busy, setBusy] = useState(false);
  const [expandSynopsis, setExpandSynopsis] = useState(false);

  // PREFERE os dados que vieram da grade (já são uma boa edição em PT); os "details"
  // do catálogo só PREENCHEM o que falta (sinopse/páginas/gênero) — sem sobrescrever
  // capa/autor por uma edição estrangeira pega na re-busca.
  const author = (p.author ? String(p.author) : undefined) ?? details?.author;
  const cover = (p.cover ? String(p.cover) : undefined) ?? details?.coverUrl;
  const isbn = (p.isbn ? String(p.isbn) : undefined) ?? details?.isbn;
  const genres = cleanGenres(details?.genres);

  const reloadShelf = useCallback(async () => {
    if (!user) {
      setMyStatus(null);
      setReaders([]);
      return;
    }
    const [st, cs, rd] = await Promise.all([
      getShelfStatusFor(bookKey),
      getBookStatusCounts(bookKey),
      getPublicReaders(bookKey),
    ]);
    setMyStatus(st);
    setCounts(cs);
    setReaders(rd);
  }, [bookKey, user]);

  // Recarrega ao focar (ex.: voltar da tela de login) e quando muda o usuário.
  useFocusEffect(
    useCallback(() => {
      reloadShelf();
    }, [reloadShelf]),
  );

  useEffect(() => {
    let alive = true;
    if (!title) {
      setLoadingDetails(false);
      return;
    }
    reloadShelf();
    setDetails(seeded);
    const paramAuthor = p.author ? String(p.author) : undefined;
    const seedAuthor = paramAuthor ?? seeded?.author;

    // Idioma do seed (regionalização) p/ buscar a mesma edição/idioma; PT por padrão.
    const lang = seeded?.language === 'en' ? 'en' : 'pt';

    // Livros do mesmo autor (sempre), no mesmo idioma.
    similarBooks(seedAuthor, title, lang).then((sim) => {
      if (alive) setSimilar(sim);
    });

    if (seeded?.synopsis) {
      // Já temos ficha + sinopse boas da grade → NÃO re-busca (evita edição estrangeira).
      setLoadingDetails(false);
    } else {
      setLoadingDetails(true);
      bookDetails(title, p.isbn ? String(p.isbn) : undefined, seedAuthor, lang)
        .then((d) => {
          if (alive && d) setDetails((prev) => mergePreferring(prev, d));
        })
        .finally(() => {
          if (alive) setLoadingDetails(false);
        });
    }
    return () => {
      alive = false;
    };
    // só (re)carrega quando muda o livro
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  const choose = useCallback(
    async (status: ShelfStatus) => {
      if (busy) return;
      if (!user) {
        Alert.alert('Entre na sua conta', 'Você precisa estar logado para montar a estante.', [
          { text: 'Agora não', style: 'cancel' },
          { text: 'Entrar', onPress: () => router.push('/login') },
        ]);
        return;
      }
      setBusy(true);
      const err =
        myStatus === status
          ? await removeShelf(bookKey) // tocar no status atual = tirar da estante
          : await setShelf({ title, author: author ?? null, coverUrl: cover ?? null, isbn: isbn ?? null, status });
      setBusy(false);
      if (err) {
        const tableMissing = /book_shelves|does not exist|relation|schema cache/i.test(err);
        Alert.alert(
          'Não deu para salvar na estante',
          tableMissing
            ? 'O banco ainda não tem a tabela da estante. Rode o arquivo supabase/schema.sql no painel do Supabase (SQL Editor) e tente de novo.'
            : err,
        );
        return;
      }
      await reloadShelf();
    },
    [busy, user, myStatus, bookKey, title, author, cover, isbn, reloadShelf],
  );

  const totalReaders = SHELF_STATUSES.reduce((sum, st) => sum + counts[st], 0);
  const synopsis = details?.synopsis?.trim();

  if (!title) {
    return (
      <View style={[styles.fill, { backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: c.textFaint }}>Livro não encontrado.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <SafeAreaView style={styles.fill} edges={['top', 'left', 'right']}>
        {/* Cabeçalho com Voltar */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={[styles.back, { color: c.green }]}>‹ Voltar</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Capa + título */}
          <View style={styles.hero}>
            {cover ? (
              <Image source={{ uri: cover }} style={styles.cover} contentFit="cover" transition={150} />
            ) : (
              <View style={[styles.cover, styles.coverFallback, { backgroundColor: c.cardElevated }]}>
                <Text style={{ fontSize: 40 }}>📘</Text>
              </View>
            )}
            <View style={styles.heroBody}>
              <Text style={[styles.title, { color: c.text }]}>{title}</Text>
              {author ? <Text style={[styles.author, { color: c.textFaint }]}>{author}</Text> : null}
              {details?.year ? <Text style={[styles.meta, { color: c.textFaint }]}>{details.year}</Text> : null}
              {totalReaders > 0 ? (
                <Text style={[styles.readers, { color: c.purple }]}>👥 {totalReaders} na comunidade</Text>
              ) : null}
            </View>
          </View>

          {/* Estante: escolher/trocar status */}
          <SectionTitle name="books">Minha estante</SectionTitle>
          <Text style={[styles.hint, { color: c.textFaint }]}>
            {!user
              ? 'Entre na sua conta para montar a estante.'
              : myStatus
                ? 'Toque no status atual para remover da estante.'
                : 'Escolha um status para adicionar.'}
          </Text>
          <View style={styles.statusGrid}>
            {SHELF_STATUSES.map((st) => {
              const active = myStatus === st;
              return (
                <Pressable
                  key={st}
                  disabled={busy}
                  onPress={() => choose(st)}
                  style={[
                    styles.statusChip,
                    { borderColor: active ? c.green : c.border, backgroundColor: active ? c.green : 'transparent' },
                  ]}>
                  <Text style={[styles.statusChipText, { color: active ? c.onGreen : c.text }]}>
                    {STATUS_EMOJI[st]} {SHELF_LABEL[st]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Onde comprar (links de afiliado — abre fora do app, §6) */}
          <BuyLinks book={{ title, author, isbn }} />

          {/* Temperatura na comunidade */}
          {totalReaders > 0 ? (
            <>
              <SectionTitle name="flame">Na comunidade</SectionTitle>
              <Card>
                {SHELF_STATUSES.filter((st) => counts[st] > 0).map((st) => (
                  <View key={st} style={styles.countRow}>
                    <Text style={[styles.countLabel, { color: c.textDim }]}>
                      {STATUS_EMOJI[st]} {SHELF_LABEL[st]}
                    </Text>
                    <Text style={[styles.countValue, { color: c.text }]}>{counts[st]}</Text>
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          {/* Quem está lendo (só perfis públicos — §4.8) */}
          {readers.length > 0 ? (
            <>
              <SectionTitle name="users">Quem está lendo</SectionTitle>
              {readers.map((r) => (
                <Pressable
                  key={r.user_id}
                  onPress={() => router.push({ pathname: '/usuario', params: { id: r.user_id, name: r.name ?? '' } })}>
                  <Card style={styles.readerRow}>
                    <Text style={styles.readerAvatar}>{r.avatar_url || '🦉'}</Text>
                    <Text style={[styles.readerName, { color: c.text }]} numberOfLines={1}>
                      {r.name?.trim() || 'Leitor'}
                    </Text>
                    <Text style={[styles.readerStatus, { color: c.green, borderColor: c.green }]}>
                      {SHELF_LABEL[r.status]}
                    </Text>
                  </Card>
                </Pressable>
              ))}
            </>
          ) : null}

          {/* Sinopse / ficha */}
          {loadingDetails ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={c.green} />
              <Text style={[styles.hint, { color: c.textFaint, marginTop: 8 }]}>Carregando detalhes…</Text>
            </View>
          ) : (
            <>
              {synopsis ? (
                <>
                  <SectionTitle name="fileText">Sinopse</SectionTitle>
                  <Text
                    style={[styles.synopsis, { color: c.textDim }]}
                    numberOfLines={expandSynopsis ? undefined : 6}>
                    {synopsis}
                  </Text>
                  {synopsis.length > 280 ? (
                    <Pressable onPress={() => setExpandSynopsis((v) => !v)} hitSlop={8}>
                      <Text style={[styles.moreLink, { color: c.green }]}>
                        {expandSynopsis ? 'Ver menos' : 'Ler mais'}
                      </Text>
                    </Pressable>
                  ) : null}
                </>
              ) : null}

              {details && (details.pages || details.language || genres.length) ? (
                <>
                  <SectionTitle name="info">Ficha</SectionTitle>
                  <Card>
                    {details.pages ? (
                      <FichaRow label="Páginas" value={String(details.pages)} c={c} />
                    ) : null}
                    {details.language ? (
                      <FichaRow label="Idioma" value={langName(details.language)} c={c} />
                    ) : null}
                    {genres.length ? (
                      <FichaRow label="Gênero" value={genres.slice(0, 3).join(', ')} c={c} />
                    ) : null}
                    {isbn ? <FichaRow label="ISBN" value={isbn} c={c} /> : null}
                  </Card>
                </>
              ) : null}

              {!synopsis && !details ? (
                <Text style={[styles.hint, { color: c.textFaint, marginTop: 16 }]}>
                  Sem detalhes no catálogo para este livro.
                </Text>
              ) : null}
            </>
          )}

          {/* Livros do mesmo autor */}
          {similar.length > 0 ? (
            <>
              <SectionTitle name="edit">Do mesmo autor</SectionTitle>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similarRow}>
                {similar.map((b) => (
                  <Pressable
                    key={`${b.source}-${b.id}`}
                    style={styles.similarCell}
                    onPress={() =>
                      router.push({
                        pathname: '/livro',
                        params: { title: b.title, author: b.author, cover: b.coverUrl, isbn: b.isbn },
                      })
                    }>
                    {b.coverUrl ? (
                      <Image source={{ uri: b.coverUrl }} style={styles.similarCover} contentFit="cover" transition={150} />
                    ) : (
                      <View style={[styles.similarCover, styles.coverFallback, { backgroundColor: c.cardElevated }]}>
                        <Text style={{ fontSize: 22 }}>📘</Text>
                      </View>
                    )}
                    <Text style={[styles.similarTitle, { color: c.text }]} numberOfLines={2}>
                      {b.title}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}

          <Card style={styles.privacy}>
            <Text style={[styles.privacyText, { color: c.textDim }]}>
              🔒 Só quem tornou o perfil público aparece em “quem está lendo”. Os demais entram só na contagem.
            </Text>
          </Card>

          {/* Resenhas + moderação (C3) */}
          {user ? (
            <BookReviews bookKey={bookKey} bookTitle={title} />
          ) : (
            <Text style={[styles.hint, { color: c.textFaint, marginTop: 20 }]}>
              Entre na sua conta para ver e escrever resenhas.
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function FichaRow({ label, value, c }: { label: string; value: string; c: ReturnType<typeof useUI> }) {
  return (
    <View style={styles.countRow}>
      <Text style={[styles.countLabel, { color: c.textFaint }]}>{label}</Text>
      <Text style={[styles.countValue, { color: c.text, flexShrink: 1, textAlign: 'right' }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topBar: { paddingHorizontal: 16, paddingVertical: 10 },
  back: { fontSize: 16, fontWeight: '800' },
  content: { paddingHorizontal: 16, paddingBottom: 48 },
  hero: { flexDirection: 'row', gap: 16, marginTop: 4 },
  cover: { width: 104, height: 152, borderRadius: 8 },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  heroBody: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', lineHeight: 28 },
  author: { fontSize: 15, marginTop: 6 },
  meta: { fontSize: 13, marginTop: 4 },
  readers: { fontSize: 13, fontWeight: '700', marginTop: 10 },
  hint: { fontSize: 13, lineHeight: 19, marginBottom: 10 },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  statusChipText: { fontSize: 14, fontWeight: '700' },
  readerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  readerAvatar: { fontSize: 26 },
  readerName: { flex: 1, fontSize: 15, fontWeight: '700' },
  readerStatus: { fontSize: 12, fontWeight: '800', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  countLabel: { fontSize: 14, fontWeight: '600' },
  countValue: { fontSize: 15, fontWeight: '800' },
  loadingRow: { alignItems: 'center', marginTop: 28 },
  synopsis: { fontSize: 14, lineHeight: 21 },
  moreLink: { fontSize: 14, fontWeight: '800', marginTop: 8 },
  similarRow: { gap: 12, paddingVertical: 4, paddingRight: 16 },
  similarCell: { width: 96 },
  similarCover: { width: 96, height: 140, borderRadius: 6 },
  similarTitle: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  privacy: { marginTop: 24 },
  privacyText: { fontSize: 13, lineHeight: 20 },
});
