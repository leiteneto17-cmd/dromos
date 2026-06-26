/**
 * Folha de marcadores de página (abre ao tocar na barra de progresso do leitor).
 * Mostra a posição atual, permite adicionar um marcador aqui e pular para marcadores
 * salvos. O salto usa OFFSET de rolagem (não scrollToIndex) — não trava em livro grande.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassSheet } from '@/components/glass-sheet';
import type { Bookmark } from '@/store/library';
import type { ReadingPalette } from '@/theme/reading';

type Props = {
  t: ReadingPalette;
  bookmarks: Bookmark[];
  /** Rótulo da posição atual, ex.: "Capítulo III · 23%". */
  currentLabel: string;
  onAdd: () => void;
  onJump: (bm: Bookmark) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
};

export function BookmarksSheet({ t, bookmarks, currentLabel, onAdd, onJump, onRemove, onClose }: Props) {
  return (
    <GlassSheet onClose={onClose} surface={t.surface} accent={t.accent} bgForTint={t.background}>
      <Text style={[styles.title, { color: t.text }]}>Marcadores</Text>
      <Text style={[styles.current, { color: t.textSecondary }]}>Você está em {currentLabel}</Text>

      <Pressable onPress={onAdd} style={[styles.addBtn, { borderColor: t.accent, backgroundColor: t.accent }]}>
        <Text style={{ color: t.surface, fontWeight: '800', fontSize: 14 }}>🔖 Marcar esta página</Text>
      </Pressable>

      {bookmarks.length === 0 ? (
        <Text style={[styles.empty, { color: t.textSecondary }]}>
          Nenhum marcador ainda. Marque uma página para voltar a ela depois.
        </Text>
      ) : (
        <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={styles.list}>
          {bookmarks.map((bm) => (
            <View key={bm.id} style={[styles.row, { borderColor: t.border }]}>
              <Pressable style={styles.rowBody} onPress={() => onJump(bm)}>
                <Text style={[styles.pct, { color: t.accent }]}>{Math.round(bm.progress * 100)}%</Text>
                <Text style={[styles.snippet, { color: t.text }]} numberOfLines={2}>
                  {bm.snippet || 'Marcador'}
                </Text>
              </Pressable>
              <Pressable onPress={() => onRemove(bm.id)} hitSlop={10} style={styles.trash}>
                <Text style={{ color: t.textSecondary, fontSize: 18 }}>🗑</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      <Pressable onPress={onClose} style={styles.close}>
        <Text style={{ color: t.textSecondary, fontSize: 14 }}>Fechar</Text>
      </Pressable>
    </GlassSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700' },
  current: { fontSize: 13, marginTop: 4, marginBottom: 14 },
  addBtn: { paddingVertical: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center', marginBottom: 14 },
  empty: { fontSize: 14, lineHeight: 20, paddingVertical: 8 },
  list: { gap: 10, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pct: { fontSize: 13, fontWeight: '800', minWidth: 38 },
  snippet: { flex: 1, fontSize: 14, lineHeight: 19 },
  trash: { paddingHorizontal: 4 },
  close: { marginTop: 16, alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 16 },
});
