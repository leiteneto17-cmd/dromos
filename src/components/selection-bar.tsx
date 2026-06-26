/**
 * Barra de SELEÇÃO de trecho (citação de verdade — §2.6). Aparece quando o usuário
 * entra no modo de grifo: mostra a prévia do trecho selecionado e as ações.
 * Para AMPLIAR a seleção, o usuário toca em outra palavra do MESMO parágrafo.
 *
 * Flutua acima dos controles inferiores (não é Modal — não tira o foco da leitura, §2.5).
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ReadingPalette } from '@/theme/reading';

type Props = {
  preview: string;
  t: ReadingPalette;
  onCancel: () => void;
  onHighlight: () => void;
  onQuote: () => void;
};

export function SelectionBar({ preview, t, onCancel, onHighlight, onQuote }: Props) {
  return (
    <View style={[styles.wrap, { backgroundColor: t.surface, borderColor: t.accent + '55' }]}>
      <Text style={[styles.hint, { color: t.textSecondary }]}>
        Toque em outra palavra para ampliar
      </Text>
      <Text style={[styles.preview, { color: t.text }]} numberOfLines={2}>
        “{preview}”
      </Text>
      <View style={styles.row}>
        <Pressable onPress={onCancel} style={[styles.chip, { borderColor: t.border }]}>
          <Text style={[styles.chipText, { color: t.textSecondary }]}>Cancelar</Text>
        </Pressable>
        <Pressable onPress={onHighlight} style={[styles.chip, { borderColor: t.accent }]}>
          <Text style={[styles.chipText, { color: t.accent }]}>✎ Grifar</Text>
        </Pressable>
        <Pressable onPress={onQuote} style={[styles.chip, styles.primary, { backgroundColor: t.accent, borderColor: t.accent }]}>
          <Text style={[styles.chipText, { color: t.surface, fontWeight: '800' }]}>“ Citar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 96,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    zIndex: 60,
    elevation: 24,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  hint: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  preview: { fontSize: 15, lineHeight: 21, fontStyle: 'italic', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  primary: {},
  chipText: { fontSize: 14, fontWeight: '700' },
});
