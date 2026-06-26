/**
 * Menu CONTEXTUAL da palavra tocada (interface invisível — design system 2026):
 * uma barrinha flutuante que aparece PERTO do toque, com ações rápidas, e some no
 * scroll. Ações que precisam de espaço (Significado / ✨ IA) expandem para o
 * WordPanel completo; "Marcar" alterna na hora e "▶" inicia o áudio daqui.
 *
 * Não é Modal (não escurece a tela) — é uma camada flutuante sobre o leitor, para
 * não tirar o foco da leitura (CLAUDE.md §2.5).
 */
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { ReadingPalette } from '@/theme/reading';

const POPOVER_MAX_W = 320;
const POPOVER_H = 132; // estimativa p/ decidir acima/abaixo do toque (chips podem quebrar 2 linhas)

type Props = {
  word: string;
  marked: boolean;
  t: ReadingPalette;
  /** Posição do toque (tela). */
  x: number;
  y: number;
  onMark: () => void;
  onMeaning: () => void;
  onExplainAI: () => void;
  onListen?: () => void;
  /** Inicia a seleção de trecho (citação de verdade). */
  onSelect?: () => void;
  /** A palavra está dentro de um grifo salvo → oferece remover. */
  highlighted?: boolean;
  onRemoveHighlight?: () => void;
};

export function WordPopover({
  word,
  marked,
  t,
  x,
  y,
  onMark,
  onMeaning,
  onExplainAI,
  onListen,
  onSelect,
  highlighted,
  onRemoveHighlight,
}: Props) {
  const { width: winW, height: winH } = useWindowDimensions();
  const w = Math.min(POPOVER_MAX_W, winW - 24);

  // Acima do toque quando há espaço; senão, abaixo. Esquerda centralizada e presa à tela.
  const above = y - POPOVER_H - 14 > 70;
  const top = above ? y - POPOVER_H - 14 : Math.min(y + 20, winH - POPOVER_H - 16);
  const left = Math.max(12, Math.min(x - w / 2, winW - w - 12));

  return (
    <View
      style={[
        styles.card,
        { top, left, width: w, backgroundColor: t.surface, borderColor: t.accent + '55' },
      ]}>
      <Text style={[styles.word, { color: t.text }]} numberOfLines={1}>
        {word}
      </Text>
      <View style={styles.row}>
        <Pressable
          onPress={onMark}
          style={[styles.chip, { borderColor: marked ? t.accent : t.border, backgroundColor: marked ? t.accent : 'transparent' }]}>
          <Text style={[styles.chipText, { color: marked ? t.surface : t.text }]}>{marked ? '✓ Marcada' : 'Marcar'}</Text>
        </Pressable>
        <Pressable onPress={onMeaning} style={[styles.chip, { borderColor: t.border }]}>
          <Text style={[styles.chipText, { color: t.text }]}>Significado</Text>
        </Pressable>
        <Pressable onPress={onExplainAI} style={[styles.chip, { borderColor: t.accent, backgroundColor: t.accent + '14' }]}>
          <Text style={[styles.chipText, { color: t.accent, fontWeight: '800' }]}>✨ IA</Text>
        </Pressable>
        {onListen ? (
          <Pressable onPress={onListen} style={[styles.chip, styles.iconChip, { borderColor: t.border }]}>
            <Text style={[styles.chipText, { color: t.text }]}>▶</Text>
          </Pressable>
        ) : null}
        {highlighted && onRemoveHighlight ? (
          <Pressable onPress={onRemoveHighlight} style={[styles.chip, { borderColor: t.border }]}>
            <Text style={[styles.chipText, { color: t.textSecondary }]}>✕ Grifo</Text>
          </Pressable>
        ) : onSelect ? (
          <Pressable onPress={onSelect} style={[styles.chip, { borderColor: t.border }]}>
            <Text style={[styles.chipText, { color: t.text }]}>✎ Grifar</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    zIndex: 50,
    elevation: 20,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  word: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  iconChip: { paddingHorizontal: 14 },
  chipText: { fontSize: 13, fontWeight: '700' },
});
