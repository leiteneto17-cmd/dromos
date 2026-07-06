/**
 * Gaveta de stickers (emoji). Tocar num emoji adiciona uma camada no centro do card.
 */
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { BottomSheet } from '@/components/story-editor/BottomSheet';
import { Social } from '@/theme/social';

const STICKERS = [
  '📖', '📚', '🔥', '😍', '😭', '🤯', '☕', '🌙', '🥹', '✨', '👀', '💡',
  '❤️', '💚', '💜', '⭐', '🎯', '🏆', '🧠', '🌱', '🕯️', '🎧', '🦉', '🐉',
  '🧚', '🌈', '🚀', '🍂', '🌸', '💭', '📝', '🔖',
];

export function StickerSheet({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (emoji: string) => void }) {
  return (
    <BottomSheet visible={visible} onClose={onClose} heightPct={0.55}>
      <Text style={styles.title}>Stickers</Text>
      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {STICKERS.map((e) => (
          <Pressable
            key={e}
            onPress={() => {
              onPick(e);
              onClose();
            }}
            style={styles.cell}>
            <Text style={styles.emoji}>{e}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { color: Social.white, fontSize: 16, fontWeight: '800', marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: { width: '12%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 30 },
});
