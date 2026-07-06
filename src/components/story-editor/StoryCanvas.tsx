/**
 * StoryCanvas — o card 9:16 que É o story. Usado no EDITOR (editable: camadas arrastáveis) e no
 * VIEWER (estático) → o que você edita é exatamente o que os outros veem ("espelho fiel").
 * Base = gradiente do preset + "leu" + título do livro + Paginometro; por cima, as camadas
 * (texto/sticker/música) posicionadas por coordenadas normalizadas.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Paginometro } from '@/components/paginometro';
import { DraggableLayer, type LayerChange } from '@/components/story-editor/DraggableLayer';
import { Social } from '@/theme/social';
import { bgColors, type StoryAudioMeta, type StoryComposition, type StoryLayer } from '@/types/story-composition';

export function StoryCanvas({
  book,
  seconds,
  pages,
  composition,
  editable = false,
  selectedId,
  onSelectLayer,
  onChangeLayer,
}: {
  book: string;
  seconds: number;
  pages: number | null;
  composition: StoryComposition;
  editable?: boolean;
  selectedId?: string | null;
  onSelectLayer?: (id: string) => void;
  onChangeLayer?: (id: string, u: LayerChange) => void;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const colors = bgColors(composition.bg);

  return (
    <View
      style={styles.card}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

      {/* Base fiel: leitura */}
      <View style={styles.base} pointerEvents="none">
        <Text style={styles.kicker}>leu</Text>
        <Text style={styles.book} numberOfLines={3}>
          {book || 'um livro'}
        </Text>
        <View style={styles.pag}>
          <Paginometro pages={pages} seconds={seconds} />
        </View>
        <Text style={styles.logo}>Dromos</Text>
      </View>

      {/* Camadas — só após medir o card (evita posição errada no 1º frame). */}
      {size.w > 0
        ? composition.layers.map((layer) =>
            editable ? (
              <DraggableLayer
                key={layer.id}
                xN={layer.x}
                yN={layer.y}
                scale={'scale' in layer ? layer.scale : 1}
                canvasW={size.w}
                canvasH={size.h}
                selected={selectedId === layer.id}
                onSelect={() => onSelectLayer?.(layer.id)}
                onChange={(u) => onChangeLayer?.(layer.id, u)}>
                <LayerContent layer={layer} audio={composition.audio} />
              </DraggableLayer>
            ) : (
              <CenteredLayer
                key={layer.id}
                left={layer.x * size.w}
                top={layer.y * size.h}
                scale={'scale' in layer ? layer.scale : 1}>
                <LayerContent layer={layer} audio={composition.audio} />
              </CenteredLayer>
            ),
          )
        : null}
    </View>
  );
}

/** Camada estática (viewer): centra pelo próprio tamanho, sem gestos. */
function CenteredLayer({ left, top, scale, children }: { left: number; top: number; scale: number; children: ReactNode }) {
  const [s, setS] = useState({ w: 0, h: 0 });
  return (
    <View
      onLayout={(e) => setS({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={{ position: 'absolute', left: left - s.w / 2, top: top - s.h / 2, transform: [{ scale }] }}>
      {children}
    </View>
  );
}

/** Conteúdo visual de uma camada (compartilhado editor/viewer). */
export function LayerContent({ layer, audio }: { layer: StoryLayer; audio: StoryAudioMeta | null }) {
  if (layer.type === 'text') {
    const boxStyle =
      layer.bg === 'solid' ? styles.textSolid : layer.bg === 'soft' ? styles.textSoft : undefined;
    return (
      <View style={boxStyle}>
        <Text style={[styles.textLayer, { color: layer.color }]}>{layer.text}</Text>
      </View>
    );
  }
  if (layer.type === 'sticker') {
    return <Text style={styles.stickerLayer}>{layer.emoji}</Text>;
  }
  // music
  if (!audio) return null;
  if (layer.style === 'neon') {
    return (
      <Text style={styles.musicNeon} numberOfLines={1}>
        🎵 {audio.track_name} — {audio.artist}
      </Text>
    );
  }
  return (
    <View style={styles.musicPlayer}>
      <Text style={styles.musicIcon}>{audio.album_image ? '🎧' : '🎵'}</Text>
      <View style={styles.musicText}>
        <Text style={styles.musicTitle} numberOfLines={1}>
          {audio.track_name}
        </Text>
        <Text style={styles.musicArtist} numberOfLines={1}>
          {audio.artist}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: 22, overflow: 'hidden', backgroundColor: Social.dark },
  base: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  kicker: { color: Social.lavender, fontSize: 15, letterSpacing: 1 },
  book: { color: Social.green, fontSize: 28, fontWeight: '900', textAlign: 'center', marginTop: 4, textShadowColor: Social.green, textShadowRadius: 14 },
  pag: { marginTop: 22 },
  logo: { color: Social.green, fontSize: 18, fontWeight: '900', marginTop: 30, opacity: 0.9 },
  textLayer: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  textSolid: { backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  textSoft: { backgroundColor: 'rgba(0,0,0,0.28)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  stickerLayer: { fontSize: 46 },
  musicNeon: { color: Social.green, fontSize: 15, fontWeight: '900', textShadowColor: Social.green, textShadowRadius: 10 },
  musicPlayer: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, maxWidth: 220 },
  musicIcon: { fontSize: 18 },
  musicText: { flexShrink: 1 },
  musicTitle: { color: '#EDEAF5', fontSize: 13, fontWeight: '800' },
  musicArtist: { color: '#B9A6E8', fontSize: 11 },
});
