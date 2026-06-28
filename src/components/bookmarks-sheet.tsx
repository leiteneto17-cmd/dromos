/**
 * Folha de marcadores de página (abre ao tocar na barra de progresso do leitor).
 * Mostra a posição atual, permite adicionar um marcador aqui e pular para marcadores
 * salvos. O salto usa OFFSET de rolagem (não scrollToIndex) — não trava em livro grande.
 */
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassSheet } from '@/components/glass-sheet';
import type { Bookmark } from '@/store/library';
import type { ReadingPalette } from '@/theme/reading';

type Props = {
  t: ReadingPalette;
  bookmarks: Bookmark[];
  /** Rótulo da posição atual, ex.: "Capítulo III · 23%". */
  currentLabel: string;
  /** Sumário denso: cada marca tem rótulo, parágrafo inicial, % e se é capítulo real. */
  chapters?: { label: string; start: number; pct: number; isChapter: boolean }[];
  /** Índice do capítulo atual (p/ destacar no sumário). */
  currentChapter?: number;
  onAdd: () => void;
  onJump: (bm: Bookmark) => void;
  /** Pular para o início de um capítulo (índice de parágrafo). */
  onJumpChapter?: (start: number) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
};

export function BookmarksSheet({
  t,
  bookmarks,
  currentLabel,
  chapters,
  currentChapter,
  onAdd,
  onJump,
  onJumpChapter,
  onRemove,
  onClose,
}: Props) {
  const hasToc = !!chapters && chapters.length > 1;

  // Abre o sumário já rolado até a marca atual (altura de linha estimada).
  const TOC_ROW = 44;
  const tocRef = useRef<ScrollView>(null);
  useEffect(() => {
    if (!hasToc || typeof currentChapter !== 'number') return;
    const y = Math.max(0, (currentChapter - 1) * TOC_ROW);
    const id = setTimeout(() => tocRef.current?.scrollTo({ y, animated: false }), 60);
    return () => clearTimeout(id);
  }, [hasToc, currentChapter]);

  return (
    <GlassSheet onClose={onClose} surface={t.surface} accent={t.accent} bgForTint={t.background}>
      <Text style={[styles.title, { color: t.text }]}>{hasToc ? 'Navegação' : 'Marcadores'}</Text>
      <Text style={[styles.current, { color: t.textSecondary }]}>Você está em {currentLabel}</Text>

      {hasToc ? (
        <>
          <Text style={[styles.section, { color: t.text }]}>📑 Sumário</Text>
          <ScrollView ref={tocRef} style={{ maxHeight: 300 }} contentContainerStyle={styles.tocList}>
            {chapters!.map((ch, i) => {
              const here = i === currentChapter;
              return (
                <Pressable
                  key={`${i}-${ch.start}`}
                  onPress={() => onJumpChapter?.(ch.start)}
                  style={[styles.tocRow, here && { backgroundColor: t.accent + '1A' }]}>
                  <Text style={[styles.tocPct, { color: here ? t.accent : t.textSecondary }]}>
                    {Math.round(ch.pct * 100)}%
                  </Text>
                  <Text
                    style={[
                      styles.tocLabel,
                      {
                        color: here ? t.accent : ch.isChapter ? t.text : t.textSecondary,
                        fontWeight: ch.isChapter ? '700' : '400',
                      },
                    ]}
                    numberOfLines={1}>
                    {ch.isChapter ? ch.label : `· ${ch.label}`}
                  </Text>
                  {here ? <Text style={[styles.tocNow, { color: t.accent }]}>•</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={[styles.section, { color: t.text, marginTop: 16 }]}>🔖 Marcadores</Text>
        </>
      ) : null}

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
  section: { fontSize: 14, fontWeight: '800', marginBottom: 8 },
  tocList: { paddingBottom: 4 },
  tocRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  tocPct: { fontSize: 12, fontWeight: '800', minWidth: 40 },
  tocLabel: { flex: 1, fontSize: 14, lineHeight: 18 },
  tocNow: { fontSize: 16, fontWeight: '900' },
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
