/**
 * Capa de um livro local (ImportedBook). Mostra a imagem real quando há `uri`
 * (capa embutida do EPUB ou baixada do catálogo) e, na falta, um bloco com o
 * formato + 📖 — o mesmo "fallback" antigo, agora num só lugar.
 *
 * O tamanho/raio vêm do `style` do chamador (hero, tile, lista). `expo-image`
 * cacheia em disco, então a capa aparece offline depois do 1º carregamento.
 */
import { Image, type ImageStyle } from 'expo-image';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { BookFormat } from '@/store/library';

export function BookCover({
  uri,
  format,
  style,
  rounded = 10,
  fallbackBg = 'rgba(0,0,0,0.22)',
  fallbackBorder,
  fallbackColor = '#FFFFFF',
  iconSize = 22,
}: {
  uri?: string;
  format: BookFormat;
  style?: StyleProp<ViewStyle>;
  rounded?: number;
  fallbackBg?: string;
  fallbackBorder?: string;
  fallbackColor?: string;
  iconSize?: number;
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[style as StyleProp<ImageStyle>, { borderRadius: rounded }]}
        contentFit="cover"
        transition={150}
        accessibilityLabel="Capa do livro"
      />
    );
  }
  return (
    <View
      style={[
        style,
        s.fallback,
        { borderRadius: rounded, backgroundColor: fallbackBg },
        fallbackBorder ? { borderWidth: 1, borderColor: fallbackBorder } : null,
      ]}>
      <Text style={[s.badge, { color: fallbackColor }]}>{format.toUpperCase()}</Text>
      <Text style={{ fontSize: iconSize }}>📖</Text>
    </View>
  );
}

const s = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', gap: 4, overflow: 'hidden' },
  badge: { fontSize: 10, fontWeight: '800', opacity: 0.85 },
});
