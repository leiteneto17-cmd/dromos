/**
 * Simulado estilo ENEM — questões de múltipla escolha (A–E) sobre uma obra,
 * geradas por IA (services/ai/simulado.ts). Fluxo: gera ao abrir → usuário marca
 * as alternativas → "Corrigir" mostra nota + explicações → pode gerar outro.
 * Recurso Premium (a tela de origem já barra o grátis; aqui só reforçamos).
 * Foco em compreensão/interpretação, não velocidade (§4.8).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Card, ScreenBG } from '@/components/social-ui';
import { BrandFont } from '@/constants/theme';
import { useUI } from '@/hooks/use-ui';
import { gerarSimulado, type QuizQuestion } from '@/services/ai/simulado';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

export default function SimuladoScreen() {
  const c = useUI();
  const params = useLocalSearchParams<{ title?: string; author?: string }>();
  const title = String(params.title ?? '');
  const author = String(params.author ?? '');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questoes, setQuestoes] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [corrected, setCorrected] = useState(false);

  const gerar = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCorrected(false);
    setQuestoes([]);
    const res = await gerarSimulado(title, author);
    if (res.ok) {
      setQuestoes(res.questoes);
      setAnswers(new Array(res.questoes.length).fill(null));
    } else {
      setError(res.error);
    }
    setLoading(false);
  }, [title, author]);

  useEffect(() => {
    if (title) gerar();
  }, [title, gerar]);

  const answered = answers.filter((a) => a !== null).length;
  const score = corrected
    ? questoes.reduce((n, q, i) => n + (answers[i] === q.correta ? 1 : 0), 0)
    : 0;

  function marcar(qi: number, ai: number) {
    if (corrected) return; // depois de corrigir, não muda mais
    setAnswers((prev) => {
      const next = [...prev];
      next[qi] = ai;
      return next;
    });
  }

  /** Gabarito compacto: "1-B · 2-D · 3-A…". */
  const gabarito = questoes.map((q, i) => `${i + 1}-${LETTERS[q.correta]}`).join(' · ');

  /** Exporta o simulado como TEXTO (share sheet nativo): questões + gabarito + explicações. */
  function exportar() {
    const linhas: string[] = [
      `🎓 Simulado estilo ENEM — ${title}${author ? ` (${author})` : ''}`,
      '',
    ];
    questoes.forEach((q, i) => {
      linhas.push(`${i + 1}) ${q.pergunta}`);
      q.alternativas.forEach((alt, ai) => linhas.push(`   ${LETTERS[ai]}) ${alt}`));
      linhas.push('');
    });
    linhas.push(`✅ Gabarito: ${gabarito}`, '');
    questoes.forEach((q, i) => {
      if (q.explicacao) linhas.push(`${i + 1}. ${q.explicacao}`);
    });
    linhas.push('', 'Gerado no +leitura 📚');
    Share.share({ message: linhas.join('\n') }).catch(() => {});
  }

  return (
    <ScreenBG scroll={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
          <Text style={[styles.backText, { color: c.textDim }]}>‹ Voltar</Text>
        </Pressable>
      </View>

      <Text style={[styles.title, { color: c.text }]}>🎓 Simulado</Text>
      <Text style={[styles.subtitle, { color: c.textFaint }]} numberOfLines={2}>
        {title}
        {author ? ` · ${author}` : ''}
      </Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.green} size="large" />
          <Text style={[styles.loadingText, { color: c.textFaint }]}>
            Elaborando as questões no estilo ENEM…
          </Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: c.textFaint }]}>{error}</Text>
          <Pressable onPress={gerar} style={[styles.cta, { backgroundColor: c.green }]}>
            <Text style={[styles.ctaText, { color: c.onGreen }]}>Tentar de novo</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {corrected ? (
            <Card style={[styles.scoreCard, { borderColor: c.green }]}>
              <Text style={[styles.scoreBig, { color: c.green }]}>
                {score} de {questoes.length}
              </Text>
              <Text style={[styles.scoreSub, { color: c.textDim }]}>
                {score === questoes.length
                  ? 'Gabaritou! 🏆 A obra está dominada.'
                  : score >= Math.ceil(questoes.length * 0.6)
                    ? 'Mandou bem! Revise as explicações abaixo. 💪'
                    : 'Sem crise — leia as explicações e tente outro simulado. 📚'}
              </Text>
              <Text style={[styles.gabarito, { color: c.purple }]}>Gabarito: {gabarito}</Text>
            </Card>
          ) : null}

          {questoes.map((q, qi) => (
            <Card key={qi} style={styles.qCard}>
              <Text style={[styles.qNum, { color: c.purple }]}>Questão {qi + 1}</Text>
              <Text style={[styles.qText, { color: c.text }]}>{q.pergunta}</Text>
              {q.alternativas.map((alt, ai) => {
                const selected = answers[qi] === ai;
                const isRight = corrected && ai === q.correta;
                const isWrongPick = corrected && selected && ai !== q.correta;
                return (
                  <Pressable
                    key={ai}
                    onPress={() => marcar(qi, ai)}
                    style={[
                      styles.alt,
                      { borderColor: c.border, backgroundColor: c.card },
                      selected && !corrected && { borderColor: c.green, borderWidth: 2 },
                      isRight && { borderColor: c.green, borderWidth: 2 },
                      isWrongPick && { borderColor: '#E5484D', borderWidth: 2 },
                    ]}>
                    <Text
                      style={[
                        styles.altLetter,
                        { color: isRight ? c.green : isWrongPick ? '#E5484D' : c.purple },
                      ]}>
                      {LETTERS[ai]}
                    </Text>
                    <Text style={[styles.altText, { color: c.textDim }]}>{alt}</Text>
                    {isRight ? <Text style={{ color: c.green }}>✓</Text> : null}
                    {isWrongPick ? <Text style={{ color: '#E5484D' }}>✗</Text> : null}
                  </Pressable>
                );
              })}
              {corrected && q.explicacao ? (
                <Text style={[styles.explain, { color: c.textFaint }]}>💡 {q.explicacao}</Text>
              ) : null}
            </Card>
          ))}

          {questoes.length > 0 ? (
            corrected ? (
              <>
                <Pressable onPress={exportar} style={[styles.ctaOutline, { borderColor: c.purple }]}>
                  <Text style={[styles.ctaText, { color: c.purple }]}>📤 Exportar questões</Text>
                </Pressable>
                <Pressable onPress={gerar} style={[styles.cta, { backgroundColor: c.green }]}>
                  <Text style={[styles.ctaText, { color: c.onGreen }]}>🔁 Gerar outro simulado</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={() => setCorrected(true)}
                disabled={answered < questoes.length}
                style={[
                  styles.cta,
                  { backgroundColor: c.green, opacity: answered < questoes.length ? 0.5 : 1 },
                ]}>
                <Text style={[styles.ctaText, { color: c.onGreen }]}>
                  {answered < questoes.length
                    ? `Responda todas (${answered}/${questoes.length})`
                    : 'Corrigir ✅'}
                </Text>
              </Pressable>
            )
          ) : null}
        </ScrollView>
      )}
    </ScreenBG>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  back: { paddingVertical: 4, paddingRight: 8 },
  backText: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 28, fontFamily: BrandFont.extrabold },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 2, marginBottom: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 24 },
  loadingText: { fontSize: 14, textAlign: 'center' },
  errorText: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  list: { gap: 12, paddingBottom: 32 },
  scoreCard: { alignItems: 'center', gap: 4, borderWidth: 1.5 },
  scoreBig: { fontSize: 34, fontWeight: '900' },
  scoreSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  gabarito: { fontSize: 13, fontWeight: '800', marginTop: 4, textAlign: 'center' },
  qCard: { gap: 8 },
  qNum: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  qText: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  alt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  altLetter: { fontSize: 14, fontWeight: '900', width: 18 },
  altText: { flex: 1, fontSize: 14, lineHeight: 20 },
  explain: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  cta: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  ctaOutline: { borderRadius: 14, borderWidth: 1.5, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  ctaText: { fontSize: 15, fontWeight: '800' },
});
