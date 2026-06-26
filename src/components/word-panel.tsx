/**
 * Painel que aparece ao tocar numa palavra durante a leitura (CLAUDE.md §2.2/§2.3).
 * - "Marcar"/"Marcada" → alterna a palavra no banco de vocabulário (persistido).
 * - "Significado" → busca básica grátis no dicionário em PORTUGUÊS (cai p/ inglês).
 * - "✨ Explicar (IA)" → dicionário CONTEXTUAL em PT-BR (Fase 2): com a chave do
 *   usuário (BYOK) ou a IA grátis/gerida — significado no contexto + sinônimos/exemplos.
 *
 * O painel lê o vocabulário direto da store, então o estado "Marcada" atualiza
 * sozinho ao marcar/desmarcar.
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { contextualLookup, type ContextualMeaning } from '@/services/ai/dictionary';
import { basicDefinitions } from '@/services/dictionary-basic';
import { useLibrary } from '@/store/library';
import type { ReadingPalette } from '@/theme/reading';

type Props = {
  word: string;
  context: string;
  bookId?: string;
  bookName?: string;
  t: ReadingPalette;
  onClose: () => void;
  /** Inicia o áudio a partir deste parágrafo (escolher de onde ouvir). */
  onListenFromHere?: () => void;
  /** Dispara automaticamente uma ação ao abrir (vindo do menu contextual). */
  autoAction?: 'significado' | 'ia';
};

export function WordPanel({ word, context, bookId, bookName, t, onClose, onListenFromHere, autoAction }: Props) {
  const vocab = useLibrary((s) => s.vocab);
  const addVocab = useLibrary((s) => s.addVocab);
  const removeVocab = useLibrary((s) => s.removeVocab);
  const existing = vocab.find((v) => v.word.toLowerCase() === word.toLowerCase());
  const marked = !!existing;

  const [defs, setDefs] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ai, setAi] = useState<ContextualMeaning | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(false);

  function toggleMark() {
    if (existing) {
      removeVocab(existing.id);
    } else {
      addVocab({ id: `${Date.now()}`, word, context, bookId, bookName, addedAt: Date.now() });
    }
  }

  async function lookup() {
    setLoading(true);
    setError(null);
    setDefs(null);
    try {
      const res = await basicDefinitions(word);
      if (res.ok) {
        setDefs(res.defs);
      } else {
        setError(
          'Definição não encontrada no dicionário (pode ser uma forma flexionada). Use “✨ Explicar no contexto (IA)” para o significado em PT-BR.',
        );
      }
    } catch {
      setError('Não foi possível buscar agora. Verifique a conexão e tente de novo.');
    } finally {
      setLoading(false);
    }
  }

  async function explainAI() {
    setAiLoading(true);
    setAiError(null);
    setNeedsKey(false);
    setAi(null);
    const res = await contextualLookup(word, context);
    setAiLoading(false);
    if (res.ok) {
      setAi(res.data);
    } else {
      setAiError(res.error);
      if (res.needsKey) setNeedsKey(true);
    }
  }

  // Vindo do menu contextual: já abre executando a ação escolhida (Significado / ✨ IA).
  useEffect(() => {
    if (autoAction === 'significado') void lookup();
    else if (autoAction === 'ia') void explainAI();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: t.surface, borderColor: t.border }]}
          onPress={() => {}}>
          <Text style={[styles.word, { color: t.text }]}>{word}</Text>

          <View style={styles.row}>
            <Pressable
              onPress={toggleMark}
              style={[
                styles.btn,
                {
                  borderColor: marked ? t.accent : t.border,
                  backgroundColor: marked ? t.accent : 'transparent',
                },
              ]}>
              <Text style={{ color: marked ? t.surface : t.text, fontWeight: '700', fontSize: 14 }}>
                {marked ? '✓ Marcada' : 'Marcar'}
              </Text>
            </Pressable>
            <Pressable onPress={lookup} style={[styles.btn, { borderColor: t.border }]}>
              <Text style={{ color: t.text, fontSize: 14 }}>Significado</Text>
            </Pressable>
          </View>

          {onListenFromHere ? (
            <Pressable
              onPress={() => {
                onListenFromHere();
                onClose();
              }}
              style={[styles.listenBtn, { borderColor: t.accent }]}>
              <Text style={{ color: t.accent, fontWeight: '700', fontSize: 14 }}>
                ▶ Ouvir a partir daqui
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={explainAI}
            disabled={aiLoading}
            style={[styles.aiBtn, { borderColor: t.accent, backgroundColor: t.accent + '14' }]}>
            <Text style={{ color: t.accent, fontWeight: '800', fontSize: 14 }}>
              ✨ Explicar no contexto (IA)
            </Text>
          </Pressable>

          {/* Resultado da IA (dicionário contextual) */}
          {aiLoading ? (
            <View style={styles.aiLoading}>
              <ActivityIndicator color={t.accent} />
              <Text style={{ color: t.textSecondary, fontSize: 13 }}>Consultando a IA…</Text>
            </View>
          ) : null}
          {aiError ? (
            <View style={styles.aiBlock}>
              <Text style={{ color: t.textSecondary, fontSize: 13, lineHeight: 19 }}>{aiError}</Text>
              {needsKey ? (
                <Pressable
                  onPress={() => {
                    onClose();
                    router.navigate('/integracoes');
                  }}
                  style={[styles.aiCfgBtn, { borderColor: t.accent }]}>
                  <Text style={{ color: t.accent, fontWeight: '700', fontSize: 13 }}>
                    Configurar IA →
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {ai ? (
            <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={styles.aiBlock}>
              <Text style={{ color: t.text, fontSize: 15, lineHeight: 21 }}>{ai.significado}</Text>
              {ai.sinonimos.length > 0 ? (
                <Text style={[styles.aiLine, { color: t.textSecondary }]}>
                  <Text style={{ fontWeight: '700' }}>Sinônimos: </Text>
                  {ai.sinonimos.join(', ')}
                </Text>
              ) : null}
              {ai.antonimos.length > 0 ? (
                <Text style={[styles.aiLine, { color: t.textSecondary }]}>
                  <Text style={{ fontWeight: '700' }}>Antônimos: </Text>
                  {ai.antonimos.join(', ')}
                </Text>
              ) : null}
              {ai.exemplos.length > 0 ? (
                <View style={{ marginTop: 8 }}>
                  <Text style={{ color: t.text, fontWeight: '700', fontSize: 13, marginBottom: 4 }}>
                    Exemplos
                  </Text>
                  {ai.exemplos.map((ex, i) => (
                    <Text key={i} style={{ color: t.text, fontSize: 14, lineHeight: 20, marginBottom: 4 }}>
                      • {ex}
                    </Text>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          ) : null}

          <View style={styles.defs}>
            {loading ? <ActivityIndicator color={t.accent} /> : null}
            {error ? (
              <Text style={{ color: t.textSecondary, fontSize: 13, lineHeight: 19 }}>{error}</Text>
            ) : null}
            {defs && defs.length === 0 ? (
              <Text style={{ color: t.textSecondary, fontSize: 13 }}>Sem definição encontrada.</Text>
            ) : null}
            {defs && defs.length > 0 ? (
              <ScrollView style={{ maxHeight: 180 }}>
                {defs.map((d, i) => (
                  <Text
                    key={i}
                    style={{ color: t.text, fontSize: 14, lineHeight: 20, marginBottom: 8 }}>
                    • {d}
                  </Text>
                ))}
              </ScrollView>
            ) : null}
          </View>

          <Pressable onPress={onClose} style={styles.close}>
            <Text style={{ color: t.textSecondary, fontSize: 14 }}>Fechar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 28,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  word: { fontSize: 24, fontWeight: '600', marginBottom: 16 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  btn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10, borderWidth: 1 },
  listenBtn: { paddingVertical: 11, borderRadius: 10, borderWidth: 1, alignItems: 'center', marginBottom: 12 },
  aiBtn: { paddingVertical: 11, borderRadius: 10, borderWidth: 1, alignItems: 'center', marginBottom: 12 },
  aiLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  aiBlock: { paddingVertical: 4, gap: 6 },
  aiLine: { fontSize: 13, lineHeight: 19 },
  aiCfgBtn: { alignSelf: 'flex-start', marginTop: 8, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  defs: { minHeight: 28 },
  close: { marginTop: 16, alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 16 },
});
