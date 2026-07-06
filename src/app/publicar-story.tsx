/**
 * Publicar Story — EDITOR imersivo estilo Instagram. O card 9:16 é o próprio story (espelho
 * fiel via StoryCanvas). Toolbar translúcida no topo (Aa/sticker/efeito/trilha), camadas
 * flutuantes arrastáveis (texto/sticker/música), botão flutuante no rodapé. A música toca em
 * loop enquanto edita (Trilhas para Leitura — Jamendo/Ambientes). Publica a composição como JSON.
 */
import { router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MusicSheet } from '@/components/story-editor/MusicSheet';
import { StickerSheet } from '@/components/story-editor/StickerSheet';
import { StoryCanvas } from '@/components/story-editor/StoryCanvas';
import { TextEditorOverlay } from '@/components/story-editor/TextEditorOverlay';
import { useAudioPreview } from '@/hooks/use-audio-preview';
import { trackToAudioMeta, type Track } from '@/services/music';
import { getLatestActivityPreview, publishLatestAsStory } from '@/services/stories';
import { Social } from '@/theme/social';
import {
  BG_PRESETS,
  emptyComposition,
  type LayerBg,
  type StoryComposition,
  type StoryTextLayer,
} from '@/types/story-composition';

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export default function PublicarStoryScreen() {
  const [preview, setPreviewData] = useState<{ book_title: string; seconds: number; pages: number | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [comp, setComp] = useState<StoryComposition>(emptyComposition());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showStickers, setShowStickers] = useState(false);
  const [showMusic, setShowMusic] = useState(false);
  const [textEditing, setTextEditing] = useState<{ id?: string } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const audioPreview = useAudioPreview();

  useEffect(() => {
    let alive = true;
    getLatestActivityPreview().then((p) => {
      if (!alive) return;
      setPreviewData(p);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Toca a trilha em loop enquanto edita (feedback em tempo real).
  useEffect(() => {
    const url = comp.audio?.preview_url;
    if (url) audioPreview.play(url, true);
    else audioPreview.stop();
  }, [comp.audio?.preview_url, audioPreview]);

  const selected = comp.layers.find((l) => l.id === selectedId) ?? null;

  const addLayer = useCallback((layer: StoryComposition['layers'][number]) => {
    setComp((c) => ({ ...c, layers: [...c.layers, layer] }));
    setSelectedId(layer.id);
  }, []);

  const changeLayer = useCallback((id: string, u: { x: number; y: number; scale: number }) => {
    setComp((c) => ({
      ...c,
      layers: c.layers.map((l) => (l.id === id ? { ...l, x: u.x, y: u.y, ...('scale' in l ? { scale: u.scale } : {}) } : l)),
    }));
  }, []);

  const removeSelected = useCallback(() => {
    if (!selected) return;
    setComp((c) => {
      const layers = c.layers.filter((l) => l.id !== selected.id);
      // Removeu o sticker de música → tira também o áudio.
      const audio = selected.type === 'music' ? null : c.audio;
      return { ...c, layers, audio };
    });
    setSelectedId(null);
  }, [selected]);

  const onTextDone = useCallback(
    (v: { text: string; color: string; bg: LayerBg }) => {
      const editingId = textEditing?.id;
      setComp((c) => {
        if (editingId) {
          return { ...c, layers: c.layers.map((l) => (l.id === editingId && l.type === 'text' ? { ...l, ...v } : l)) };
        }
        const layer: StoryTextLayer = { type: 'text', id: uid(), x: 0.5, y: 0.5, scale: 1, rotation: 0, ...v };
        return { ...c, layers: [...c.layers, layer] };
      });
      setTextEditing(null);
    },
    [textEditing],
  );

  const pickSticker = useCallback(
    (emoji: string) => addLayer({ type: 'sticker', id: uid(), emoji, x: 0.5, y: 0.5, scale: 1, rotation: 0 }),
    [addLayer],
  );

  const pickTrack = useCallback(
    (t: Track) => {
      setComp((c) => {
        const hasMusic = c.layers.some((l) => l.type === 'music');
        const layers = hasMusic ? c.layers : [...c.layers, { type: 'music' as const, id: uid(), style: 'player' as const, x: 0.5, y: 0.32 }];
        return { ...c, audio: trackToAudioMeta(t), layers };
      });
    },
    [],
  );

  const cycleMusicStyle = useCallback(() => {
    if (!selected || selected.type !== 'music') return;
    setComp((c) => ({
      ...c,
      layers: c.layers.map((l) => (l.id === selected.id && l.type === 'music' ? { ...l, style: l.style === 'player' ? 'neon' : 'player' } : l)),
    }));
  }, [selected]);

  const cycleBg = useCallback(() => {
    setComp((c) => {
      const i = BG_PRESETS.findIndex((b) => b.id === c.bg);
      return { ...c, bg: BG_PRESETS[(i + 1) % BG_PRESETS.length].id };
    });
  }, []);

  async function publicar() {
    if (publishing) return;
    setPublishing(true);
    audioPreview.stop();
    const r = await publishLatestAsStory({ composition: comp });
    setPublishing(false);
    if (!r.ok) {
      Alert.alert('Story', r.error ?? 'Não deu para publicar.');
      return;
    }
    Alert.alert('Publicado 📣', 'Sua leitura está no topo da Comunidade por 24h.', [{ text: 'Boa!', onPress: () => router.back() }]);
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        {loading ? (
          <ActivityIndicator color={Social.green} style={{ marginTop: 60 }} />
        ) : !preview ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Nada para publicar ainda</Text>
            <Text style={styles.emptySub}>Leia um pouco primeiro 📖 — aí sua sessão pode virar story.</Text>
            <Pressable onPress={() => router.back()} style={styles.emptyBtn}>
              <Text style={styles.emptyBtnText}>‹ Voltar</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Toolbar translúcida */}
            <BlurView intensity={30} tint="dark" style={styles.toolbar}>
              <Pressable onPress={() => router.back()} hitSlop={8}>
                <Text style={styles.toolIcon}>✕</Text>
              </Pressable>
              <View style={styles.toolRight}>
                <Pressable onPress={() => setTextEditing({})} hitSlop={8} style={styles.toolBtn}>
                  <Text style={styles.toolAa}>Aa</Text>
                </Pressable>
                <Pressable onPress={() => setShowStickers(true)} hitSlop={8} style={styles.toolBtn}>
                  <Text style={styles.toolIcon}>😊</Text>
                </Pressable>
                <Pressable onPress={cycleBg} hitSlop={8} style={styles.toolBtn}>
                  <Text style={styles.toolIcon}>✨</Text>
                </Pressable>
                <Pressable onPress={() => setShowMusic(true)} hitSlop={8} style={styles.toolBtn}>
                  <Text style={styles.toolIcon}>🎵</Text>
                </Pressable>
              </View>
            </BlurView>

            {/* Canvas 9:16 (o story). Tocar no fundo abre o editor de texto. */}
            <View style={styles.canvasWrap}>
              <Pressable style={styles.canvas} onPress={() => setSelectedId(null)}>
                <StoryCanvas
                  book={preview.book_title}
                  seconds={preview.seconds}
                  pages={preview.pages}
                  composition={comp}
                  editable
                  selectedId={selectedId}
                  onSelectLayer={setSelectedId}
                  onChangeLayer={changeLayer}
                />
              </Pressable>
            </View>

            {/* Barra da camada selecionada */}
            {selected ? (
              <View style={styles.layerBar}>
                {selected.type === 'text' ? (
                  <Pressable onPress={() => setTextEditing({ id: selected.id })} style={styles.layerAction}>
                    <Text style={styles.layerActionText}>✎ Editar</Text>
                  </Pressable>
                ) : null}
                {selected.type === 'music' ? (
                  <Pressable onPress={cycleMusicStyle} style={styles.layerAction}>
                    <Text style={styles.layerActionText}>↺ Estilo</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={removeSelected} style={styles.layerAction}>
                  <Text style={styles.layerActionText}>🗑 Remover</Text>
                </Pressable>
              </View>
            ) : null}

            {/* Publicar flutuante */}
            <View style={styles.footer} pointerEvents="box-none">
              <Pressable onPress={publicar} disabled={publishing} style={[styles.cta, { opacity: publishing ? 0.8 : 1 }]}>
                {publishing ? <ActivityIndicator color={Social.dark} /> : <Text style={styles.ctaText}>Publicar por 24h</Text>}
              </Pressable>
            </View>

            <StickerSheet visible={showStickers} onClose={() => setShowStickers(false)} onPick={pickSticker} />
            <MusicSheet visible={showMusic} onClose={() => setShowMusic(false)} book={preview.book_title} onPick={pickTrack} />
            <TextEditorOverlay
              visible={!!textEditing}
              initial={
                textEditing?.id
                  ? (() => {
                      const l = comp.layers.find((x) => x.id === textEditing.id);
                      return l && l.type === 'text' ? { text: l.text, color: l.color, bg: l.bg } : undefined;
                    })()
                  : undefined
              }
              onDone={onTextDone}
              onCancel={() => setTextEditing(null)}
            />
          </>
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 30 },
  emptyTitle: { color: Social.white, fontSize: 18, fontWeight: '800' },
  emptySub: { color: Social.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { marginTop: 16, borderWidth: 1.5, borderColor: Social.green, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 10 },
  emptyBtnText: { color: Social.green, fontSize: 15, fontWeight: '800' },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, marginHorizontal: 12, marginTop: 6, overflow: 'hidden' },
  toolRight: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  toolBtn: { alignItems: 'center', justifyContent: 'center' },
  toolIcon: { fontSize: 20, color: Social.white },
  toolAa: { fontSize: 18, fontWeight: '900', color: Social.white },
  canvasWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  canvas: { width: '100%', maxWidth: 430, aspectRatio: 9 / 16 },
  layerBar: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingBottom: 6 },
  layerAction: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  layerActionText: { color: Social.white, fontSize: 13, fontWeight: '800' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 24, alignItems: 'center' },
  cta: { backgroundColor: Social.green, borderRadius: 999, paddingVertical: 15, paddingHorizontal: 44, shadowColor: Social.green, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
  ctaText: { color: Social.dark, fontSize: 16, fontWeight: '900' },
});
