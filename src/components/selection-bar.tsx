/**
 * Barra de SELEÇÃO de trecho (citação de verdade — §2.6). Aparece quando o usuário
 * entra no modo de grifo: mostra a prévia do trecho selecionado e as ações.
 * Para AMPLIAR a seleção, o usuário toca em outra palavra do MESMO parágrafo.
 *
 * Também traz o "🌐 Traduzir" (IA → PT-BR, inline) — ótimo p/ os clássicos em inglês.
 * Flutua acima dos controles inferiores (não é Modal — não tira o foco da leitura, §2.5).
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { translateToPT } from '@/services/ai/translate';
import type { ReadingPalette } from '@/theme/reading';

type Props = {
  preview: string;
  /** Texto COMPLETO selecionado (p/ traduzir) — pode ser maior que o preview. */
  text: string;
  t: ReadingPalette;
  onCancel: () => void;
  onHighlight: () => void;
  onQuote: () => void;
};

export function SelectionBar({ preview, text, t, onCancel, onHighlight, onQuote }: Props) {
  const [translating, setTranslating] = useState(false);
  const [translation, setTranslation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Ao ampliar/mudar a seleção, descarta a tradução anterior.
  useEffect(() => {
    setTranslation(null);
    setError(null);
  }, [text]);

  async function onTranslate() {
    if (translating) return;
    setTranslating(true);
    setError(null);
    const res = await translateToPT(text);
    setTranslating(false);
    if (res.ok) setTranslation(res.text);
    else setError(res.error);
  }

  return (
    <View style={[styles.wrap, { backgroundColor: t.surface, borderColor: t.accent + '55' }]}>
      <Text style={[styles.hint, { color: t.textSecondary }]}>Toque em outra palavra para ampliar</Text>
      <Text style={[styles.preview, { color: t.text }]} numberOfLines={2}>
        “{preview}”
      </Text>

      {/* Resultado da tradução (inline) */}
      {translating ? (
        <View style={styles.transLoading}>
          <ActivityIndicator color={t.accent} size="small" />
          <Text style={[styles.transHint, { color: t.textSecondary }]}>Traduzindo…</Text>
        </View>
      ) : translation ? (
        <View style={[styles.transBox, { borderColor: t.accent + '55' }]}>
          <Text style={[styles.transLabel, { color: t.accent }]}>🌐 Tradução</Text>
          <ScrollView style={{ maxHeight: 160 }}>
            <Text style={[styles.transText, { color: t.text }]}>{translation}</Text>
          </ScrollView>
        </View>
      ) : error ? (
        <Text style={[styles.error, { color: t.textSecondary }]}>{error}</Text>
      ) : null}

      <View style={styles.row}>
        <Pressable onPress={onCancel} style={[styles.chip, { borderColor: t.border }]}>
          <Text style={[styles.chipText, { color: t.textSecondary }]}>Cancelar</Text>
        </Pressable>
        <Pressable onPress={onTranslate} style={[styles.chip, { borderColor: t.accent }]}>
          <Text style={[styles.chipText, { color: t.accent }]}>🌐 Traduzir</Text>
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
  transLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  transHint: { fontSize: 13 },
  transBox: { borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 12 },
  transLabel: { fontSize: 12, fontWeight: '800', marginBottom: 4 },
  transText: { fontSize: 15, lineHeight: 21 },
  error: { fontSize: 13, marginBottom: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  primary: {},
  chipText: { fontSize: 14, fontWeight: '700' },
});
