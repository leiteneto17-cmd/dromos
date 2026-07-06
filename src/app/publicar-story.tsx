/**
 * Publicar Story — em vez de publicar com 1 toque (story "vazio"), o autor monta o conteúdo:
 * legenda + sticker (emoji). Foto e áudio entram nas próximas fatias (Storage + moderação).
 * Publica a leitura mais recente como story de 24h (services/stories.publishLatestAsStory).
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, ScreenBG } from '@/components/social-ui';
import { Paginometro } from '@/components/paginometro';
import { BrandFont } from '@/constants/theme';
import { useUI } from '@/hooks/use-ui';
import { getLatestActivityPreview, publishLatestAsStory } from '@/services/stories';
import { Social } from '@/theme/social';

const CAPTION_MAX = 140;

/** Stickers de humor de leitura (1 emoji, opcional). */
const STICKERS = ['📖', '🔥', '😍', '😭', '🤯', '☕', '🌙', '💡', '🥹', '✨', '👀', '📚'];

export default function PublicarStoryScreen() {
  const c = useUI();
  const [preview, setPreview] = useState<{ book_title: string; seconds: number; pages: number | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [caption, setCaption] = useState('');
  const [sticker, setSticker] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    let alive = true;
    getLatestActivityPreview().then((p) => {
      if (!alive) return;
      setPreview(p);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function publicar() {
    if (publishing) return;
    setPublishing(true);
    const r = await publishLatestAsStory({ caption, sticker });
    setPublishing(false);
    if (!r.ok) {
      Alert.alert('Story', r.error ?? 'Não deu para publicar.');
      return;
    }
    Alert.alert('Publicado 📣', 'Sua leitura está no topo da Comunidade por 24h.', [
      { text: 'Boa!', onPress: () => router.back() },
    ]);
  }

  return (
    <ScreenBG>
      <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
        <Text style={[styles.backText, { color: c.textDim }]}>‹ Voltar</Text>
      </Pressable>

      <Text style={[styles.title, { color: c.text }]}>Publicar story</Text>
      <Text style={[styles.subtitle, { color: c.textFaint }]}>
        Sua leitura mais recente vira um story de 24h. Adicione um toque seu para não ficar vazio.
      </Text>

      {loading ? (
        <ActivityIndicator color={c.green} style={{ marginTop: 30 }} />
      ) : !preview ? (
        <Card style={styles.note}>
          <Text style={[styles.noteTitle, { color: c.text }]}>Nada para publicar ainda</Text>
          <Text style={[styles.noteSub, { color: c.textFaint }]}>
            Leia um pouco primeiro 📖 — aí sua sessão de leitura pode virar story.
          </Text>
        </Card>
      ) : (
        <>
          {/* Prévia do que vai virar story (mesmo card do viewer). */}
          <View style={styles.previewCard}>
            <Text style={styles.previewKicker}>leu</Text>
            <Text style={styles.previewBook} numberOfLines={2}>
              {preview.book_title}
            </Text>
            {sticker ? <Text style={styles.previewSticker}>{sticker}</Text> : null}
            <View style={{ marginTop: 14 }}>
              <Paginometro pages={preview.pages} seconds={preview.seconds} />
            </View>
            {caption.trim() ? <Text style={styles.previewCaption}>{caption.trim()}</Text> : null}
          </View>

          {/* Legenda */}
          <Text style={[styles.label, { color: c.text }]}>Legenda</Text>
          <TextInput
            value={caption}
            onChangeText={(t) => setCaption(t.slice(0, CAPTION_MAX))}
            placeholder="Escreva algo sobre essa leitura…"
            placeholderTextColor={c.textFaint}
            multiline
            style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
          />
          <Text style={[styles.counter, { color: c.textFaint }]}>
            {caption.length}/{CAPTION_MAX}
          </Text>

          {/* Sticker */}
          <Text style={[styles.label, { color: c.text }]}>Sticker</Text>
          <View style={styles.stickerWrap}>
            {STICKERS.map((s) => {
              const active = sticker === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => setSticker(active ? null : s)}
                  style={[styles.stickerChip, { borderColor: active ? c.green : c.border, backgroundColor: active ? c.card : 'transparent' }]}>
                  <Text style={styles.stickerEmoji}>{s}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Foto/áudio — próximas fatias (Storage + moderação §4.8). */}
          <View style={[styles.soon, { borderColor: c.border }]}>
            <Text style={[styles.soonText, { color: c.textFaint }]}>📷 Foto e 🎙️ áudio chegam em breve</Text>
          </View>

          <Pressable
            onPress={publicar}
            disabled={publishing}
            style={[styles.cta, { backgroundColor: c.green, opacity: publishing ? 0.8 : 1 }]}>
            {publishing ? (
              <ActivityIndicator color={c.onGreen} />
            ) : (
              <Text style={[styles.ctaText, { color: c.onGreen }]}>Publicar por 24h</Text>
            )}
          </Pressable>
        </>
      )}
    </ScreenBG>
  );
}

const styles = StyleSheet.create({
  back: { paddingVertical: 4, paddingRight: 8, alignSelf: 'flex-start' },
  backText: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 26, fontFamily: BrandFont.extrabold, marginTop: 2 },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  note: { marginTop: 20 },
  noteTitle: { fontSize: 16, fontWeight: '700' },
  noteSub: { fontSize: 13, marginTop: 4, lineHeight: 19 },
  previewCard: {
    marginTop: 18,
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    backgroundColor: Social.card,
    borderWidth: 1,
    borderColor: 'rgba(124,240,184,0.28)',
  },
  previewKicker: { color: Social.lavender, fontSize: 14, letterSpacing: 1 },
  previewBook: { color: Social.green, fontSize: 24, fontWeight: '900', textAlign: 'center', marginTop: 4 },
  previewSticker: { fontSize: 40, marginTop: 8 },
  previewCaption: { color: Social.white, fontSize: 14, textAlign: 'center', marginTop: 14, lineHeight: 20 },
  label: { fontSize: 15, fontWeight: '800', marginTop: 22, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, minHeight: 72, textAlignVertical: 'top' },
  counter: { fontSize: 12, textAlign: 'right', marginTop: 4 },
  stickerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stickerChip: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  stickerEmoji: { fontSize: 22 },
  soon: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 22 },
  soonText: { fontSize: 13, fontWeight: '600' },
  cta: { borderRadius: 999, paddingVertical: 16, alignItems: 'center', marginTop: 22 },
  ctaText: { fontSize: 16, fontWeight: '800' },
});
