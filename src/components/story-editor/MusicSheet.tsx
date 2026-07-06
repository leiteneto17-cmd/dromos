/**
 * Gaveta "Trilhas para Leitura" — áudio legal para o story. Abas: Para Você (recs), Explorar
 * (gêneros/tags do Jamendo) e Ambientes (sons próprios). Busca por nome, ▶ preview de 5s e, ao
 * escolher, devolve a faixa (o editor cria o sticker de música e toca em loop).
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/story-editor/BottomSheet';
import { useAudioPreview } from '@/hooks/use-audio-preview';
import { AMBIENTS, GENRE_TAGS, recommendedForBook, searchTracks, type Track } from '@/services/music';
import { Social } from '@/theme/social';

type Tab = 'foryou' | 'explorar' | 'ambientes';

export function MusicSheet({
  visible,
  onClose,
  book,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  book: string;
  onPick: (track: Track) => void;
}) {
  const [tab, setTab] = useState<Tab>('foryou');
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const preview = useAudioPreview();

  // Carrega "Para Você" ao abrir.
  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    recommendedForBook(book)
      .then(setTracks)
      .finally(() => setLoading(false));
  }, [visible, book]);

  // Busca por nome (debounce). Vazia volta às recs.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      searchTracks(q, undefined, ctrl.signal)
        .then((r) => !ctrl.signal.aborted && setTracks(r))
        .finally(() => !ctrl.signal.aborted && setLoading(false));
    }, 400);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const pickGenre = useCallback((tag: string) => {
    setGenre(tag);
    setLoading(true);
    searchTracks('', tag)
      .then(setTracks)
      .finally(() => setLoading(false));
  }, []);

  const close = useCallback(() => {
    preview.stop();
    onClose();
  }, [preview, onClose]);

  const choose = useCallback(
    (t: Track) => {
      preview.stop();
      onPick(t);
      onClose();
    },
    [preview, onPick, onClose],
  );

  const list = tab === 'ambientes' ? AMBIENTS : tracks;

  return (
    <BottomSheet visible={visible} onClose={close} heightPct={0.8}>
      <Text style={styles.title}>🎵 Trilhas para Leitura</Text>

      <View style={styles.tabs}>
        {([
          ['foryou', 'Para Você'],
          ['explorar', 'Explorar'],
          ['ambientes', 'Ambientes'],
        ] as const).map(([id, label]) => (
          <Pressable
            key={id}
            onPress={() => setTab(id)}
            style={[styles.tab, { borderColor: tab === id ? Social.green : 'transparent' }]}>
            <Text style={[styles.tabText, { color: tab === id ? Social.green : Social.muted }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab !== 'ambientes' ? (
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar trilhas ou clima…"
          placeholderTextColor={Social.muted}
          style={styles.input}
        />
      ) : null}

      {tab === 'explorar' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.genres}>
          {GENRE_TAGS.map((g) => (
            <Pressable
              key={g.tag}
              onPress={() => pickGenre(g.tag)}
              style={[styles.genreChip, { borderColor: genre === g.tag ? Social.green : 'rgba(185,166,232,0.35)' }]}>
              <Text style={[styles.genreText, { color: genre === g.tag ? Social.green : Social.lavender }]}>
                {g.emoji} {g.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {loading ? (
        <ActivityIndicator color={Social.green} style={{ marginTop: 24 }} />
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {list.length === 0 ? (
            <Text style={styles.empty}>
              {tab === 'ambientes'
                ? 'Sons ambientes em breve.'
                : 'Nada encontrado. (Configure o client_id do Jamendo para as trilhas.)'}
            </Text>
          ) : (
            list.map((t) => {
              const isPlaying = preview.playingUrl === t.previewUrl && t.previewUrl !== '';
              return (
                <View key={t.id} style={styles.row}>
                  <Pressable
                    onPress={() => preview.toggle(t.previewUrl)}
                    disabled={!t.previewUrl}
                    style={[styles.play, { opacity: t.previewUrl ? 1 : 0.4 }]}>
                    <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
                  </Pressable>
                  <Pressable style={styles.rowBody} onPress={() => choose(t)}>
                    <Text style={styles.trackName} numberOfLines={1}>
                      {t.emoji ? `${t.emoji} ` : ''}
                      {t.name}
                    </Text>
                    <Text style={styles.trackArtist} numberOfLines={1}>
                      {t.artist}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => choose(t)} style={styles.use}>
                    <Text style={styles.useText}>Usar</Text>
                  </Pressable>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { color: Social.white, fontSize: 16, fontWeight: '800', marginBottom: 10 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  tab: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5 },
  tabText: { fontSize: 13, fontWeight: '800' },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: Social.white, fontSize: 14, marginBottom: 10 },
  genres: { gap: 8, paddingBottom: 10 },
  genreChip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  genreText: { fontSize: 13, fontWeight: '700' },
  list: { maxHeight: 340 },
  empty: { color: Social.muted, fontSize: 13, textAlign: 'center', marginTop: 20, paddingHorizontal: 16, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  play: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(124,240,184,0.16)', alignItems: 'center', justifyContent: 'center' },
  playIcon: { color: Social.green, fontSize: 16, fontWeight: '900' },
  rowBody: { flex: 1 },
  trackName: { color: Social.white, fontSize: 14, fontWeight: '700' },
  trackArtist: { color: Social.muted, fontSize: 12, marginTop: 1 },
  use: { borderWidth: 1, borderColor: Social.green, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  useText: { color: Social.green, fontSize: 12, fontWeight: '800' },
});
