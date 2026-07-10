/**
 * NOVA PUBLICAÇÃO (Comunidade v3 — 2026-07-10).
 * Post estilo X: texto livre + livro anexado OPCIONAL. O anexo pode ser:
 *  📖 minha última leitura (com págs/min) · 🔥 um livro do "Em alta" · 📚 o livro de um clube.
 * Publica em `community_posts` (createPost) → aparece no feed "Publicações" com Logos 📜.
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CatalogCover } from '@/components/catalog-cover';
import { Card } from '@/components/social-ui';
import { BrandFont } from '@/constants/theme';
import { useUI } from '@/hooks/use-ui';
import { meusClubes, type Clube } from '@/services/clube';
import { createPost, type PostBook } from '@/services/social';
import { getLatestActivityPreview } from '@/services/stories';
import { getTrendingBR, type TrendingBook } from '@/services/trending';
import { useProfile } from '@/store/profile';

const MAX_LEN = 400;

/** Fonte do anexo em edição (abre a lista correspondente). */
type PickerTab = 'none' | 'trending' | 'clube';

export default function PublicarScreen() {
  const c = useUI();
  const profile = useProfile((s) => s.profile);
  const [caption, setCaption] = useState('');
  const [book, setBook] = useState<PostBook | null>(null);
  const [picker, setPicker] = useState<PickerTab>('none');
  const [leitura, setLeitura] = useState<PostBook | null>(null);
  const [trending, setTrending] = useState<TrendingBook[]>([]);
  const [clubes, setClubes] = useState<Clube[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Minha última leitura vem PRÉ-ANEXADA (é o caso comum), mas é removível no ✕.
    getLatestActivityPreview().then((p) => {
      if (!p) return;
      const b: PostBook = { title: p.book_title, kind: 'leitura', seconds: p.seconds, pages: p.pages };
      setLeitura(b);
      setBook((prev) => prev ?? b);
    });
    getTrendingBR().then(setTrending);
    meusClubes().then(setClubes);
  }, []);

  async function publicar() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const err = await createPost({ caption, book });
    setBusy(false);
    if (err) setError(err);
    else router.back();
  }

  const canPublish = !busy && (caption.trim().length > 0 || !!book);

  function bookMeta(b: PostBook): string {
    if (b.kind === 'leitura')
      return `${b.pages ? `${b.pages} págs · ` : ''}${Math.max(1, Math.round((b.seconds ?? 60) / 60))} min`;
    if (b.kind === 'tendencia') return b.author ? `${b.author} · Em alta 🔥` : 'Em alta 🔥';
    return b.author ? `${b.author} · Clube 📚` : 'Clube 📚';
  }

  return (
    <View style={[st.flex, { backgroundColor: c.bg }]}>
      <SafeAreaView style={st.flex} edges={['top', 'left', 'right']}>
        {/* Header: fechar · título · publicar */}
        <View style={st.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Fechar">
            <Text style={[st.close, { color: c.textSecondary }]}>✕</Text>
          </Pressable>
          <Text style={[st.title, { color: c.text }]}>Nova publicação</Text>
          <Pressable
            onPress={publicar}
            disabled={!canPublish}
            accessibilityLabel="Publicar"
            style={[st.publishBtn, { backgroundColor: canPublish ? c.accent : c.disabled }]}>
            {busy ? (
              <ActivityIndicator size="small" color={c.onAccent} />
            ) : (
              <Text style={[st.publishText, { color: c.onAccent }]}>Publicar</Text>
            )}
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={st.scroll}>
          {/* Corpo estilo X: avatar + campo de texto livre */}
          <View style={st.body}>
            <View style={[st.avatar, { backgroundColor: c.accentSoft }]}>
              <Text style={st.avatarText}>
                {profile?.avatar_url || (profile?.name?.trim().charAt(0).toUpperCase() ?? '🦉')}
              </Text>
            </View>
            <TextInput
              value={caption}
              onChangeText={(t) => setCaption(t.slice(0, MAX_LEN))}
              placeholder="O que você quer compartilhar?"
              placeholderTextColor={c.textFaint}
              multiline
              autoFocus
              style={[st.input, { color: c.text }]}
            />
          </View>
          <Text style={[st.counter, { color: caption.length >= MAX_LEN ? c.danger : c.textFaint }]}>
            {caption.length}/{MAX_LEN}
          </Text>

          {/* Livro anexado (OPCIONAL — removível no ✕) */}
          {book ? (
            <Card style={st.attachCard}>
              <View style={st.attachRow}>
                <CatalogCover uri={book.coverUrl} title={book.title} author={book.author} width={40} height={58} radius={6} />
                <View style={st.flex}>
                  <Text style={[st.attachBook, { color: c.text }]} numberOfLines={2}>
                    {book.title}
                  </Text>
                  <Text style={[st.attachMeta, { color: c.textSecondary }]} numberOfLines={1}>
                    {bookMeta(book)}
                  </Text>
                </View>
                <Pressable onPress={() => setBook(null)} hitSlop={10} accessibilityLabel="Remover livro anexado">
                  <Text style={[st.remove, { color: c.textFaint }]}>✕</Text>
                </Pressable>
              </View>
            </Card>
          ) : (
            <>
              {/* Sem anexo: escolher de onde linkar um livro */}
              <Text style={[st.pickLabel, { color: c.textSecondary }]}>ANEXAR UM LIVRO (OPCIONAL)</Text>
              <View style={st.pickRow}>
                {leitura ? (
                  <Pressable
                    onPress={() => {
                      setBook(leitura);
                      setPicker('none');
                    }}
                    style={[st.pickChip, { borderColor: c.border, backgroundColor: c.surface }]}>
                    <Text style={[st.pickChipText, { color: c.text }]}>📖 Minha leitura</Text>
                  </Pressable>
                ) : null}
                {trending.length > 0 ? (
                  <Pressable
                    onPress={() => setPicker(picker === 'trending' ? 'none' : 'trending')}
                    style={[
                      st.pickChip,
                      picker === 'trending'
                        ? { borderColor: c.accent, backgroundColor: c.accentSoft }
                        : { borderColor: c.border, backgroundColor: c.surface },
                    ]}>
                    <Text style={[st.pickChipText, { color: picker === 'trending' ? c.accentPressed : c.text }]}>
                      🔥 Em alta
                    </Text>
                  </Pressable>
                ) : null}
                {clubes.length > 0 ? (
                  <Pressable
                    onPress={() => setPicker(picker === 'clube' ? 'none' : 'clube')}
                    style={[
                      st.pickChip,
                      picker === 'clube'
                        ? { borderColor: c.accent, backgroundColor: c.accentSoft }
                        : { borderColor: c.border, backgroundColor: c.surface },
                    ]}>
                    <Text style={[st.pickChipText, { color: picker === 'clube' ? c.accentPressed : c.text }]}>
                      📚 Meu clube
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              {picker === 'trending'
                ? trending.map((t) => (
                    <Pressable
                      key={`t-${t.rank}`}
                      onPress={() => {
                        setBook({ title: t.title, author: t.author, coverUrl: t.coverUrl, kind: 'tendencia' });
                        setPicker('none');
                      }}
                      style={[st.pickItem, { borderBottomColor: c.border }]}>
                      <Text style={[st.pickItemRank, { color: c.textFaint }]}>#{t.rank}</Text>
                      <Text style={[st.pickItemTitle, { color: c.text }]} numberOfLines={1}>
                        {t.title}
                      </Text>
                      <Text style={[st.pickItemMeta, { color: c.textSecondary }]} numberOfLines={1}>
                        {t.author}
                      </Text>
                    </Pressable>
                  ))
                : null}

              {picker === 'clube'
                ? clubes.map((cl) => (
                    <Pressable
                      key={cl.id}
                      onPress={() => {
                        setBook({ title: cl.book_title, author: cl.book_author, coverUrl: cl.book_cover_url, kind: 'clube' });
                        setPicker('none');
                      }}
                      style={[st.pickItem, { borderBottomColor: c.border }]}>
                      <Text style={st.pickItemRank}>📚</Text>
                      <Text style={[st.pickItemTitle, { color: c.text }]} numberOfLines={1}>
                        {cl.book_title}
                      </Text>
                      <Text style={[st.pickItemMeta, { color: c.textSecondary }]} numberOfLines={1}>
                        {cl.name}
                      </Text>
                    </Pressable>
                  ))
                : null}
            </>
          )}

          {error ? <Text style={[st.error, { color: c.danger }]}>{error}</Text> : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  close: { fontSize: 20, fontWeight: '600', width: 40 },
  title: { fontSize: 17, fontFamily: BrandFont.semibold },
  publishBtn: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, minWidth: 88, alignItems: 'center' },
  publishText: { fontSize: 14, fontWeight: '800' },
  body: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 19 },
  input: { flex: 1, fontSize: 17, lineHeight: 24, minHeight: 110, textAlignVertical: 'top', paddingTop: 8 },
  counter: { textAlign: 'right', paddingHorizontal: 16, fontSize: 12, marginTop: 4 },
  // Anexo
  attachCard: { marginHorizontal: 16, marginTop: 12, paddingVertical: 12 },
  attachRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  attachBook: { fontSize: 15, fontWeight: '800' },
  attachMeta: { fontSize: 12.5, marginTop: 2 },
  remove: { fontSize: 18, fontWeight: '600', padding: 4 },
  // Seletor
  pickLabel: { fontSize: 10.5, fontWeight: '900', letterSpacing: 0.8, paddingHorizontal: 16, marginTop: 14 },
  pickRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 8, flexWrap: 'wrap' },
  pickChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  pickChipText: { fontSize: 13.5, fontWeight: '700' },
  pickItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  pickItemRank: { fontSize: 13, fontWeight: '800', width: 28 },
  pickItemTitle: { fontSize: 14.5, fontWeight: '700', flexShrink: 1 },
  pickItemMeta: { fontSize: 12.5, flex: 1, textAlign: 'right' },
  error: { paddingHorizontal: 16, marginTop: 12, fontSize: 13.5, fontWeight: '700' },
});
