/**
 * METAS (Fase 6) — evolui as "Conquistas". O usuário cria objetivos com prazo (ex.: "ler
 * 120 min em 7 dias"); a app calcula o RITMO necessário por dia e recalcula sozinha
 * (cronograma adaptativo): se atrasar, o min/dia sobe. Concluir vira uma conquista
 * personalizada (medalha) que fica aqui. Abaixo, os emblemas automáticos de sempre.
 *
 * Rota EMPILHADA `/conquistas` (mantida p/ não regenerar typed routes), acessada por
 * Perfil → Metas. Base neutra; verde = ação/concluído, roxo = detalhe (CLAUDE.md §2.7).
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, ScreenBG, SectionTitle } from '@/components/social-ui';
import { useUI } from '@/hooks/use-ui';
import {
  computeAchievements,
  dayKeyInDays,
  deriveGoal,
  deriveStats,
  fmtShortDate,
  localDayKey,
} from '@/services/progress';
import { useLibrary, type Goal, type GoalKind } from '@/store/library';

const WINDOWS = [7, 14, 30];

export default function GoalsScreen() {
  const c = useUI();
  const booksList = useLibrary((s) => s.books);
  const vocab = useLibrary((s) => s.vocab.length);
  const stats = useLibrary((s) => s.stats);
  const goals = useLibrary((s) => s.goals);
  const bookProgress = useLibrary((s) => s.progress);
  const bookPages = useLibrary((s) => s.bookPages);
  const addGoal = useLibrary((s) => s.addGoal);
  const removeGoal = useLibrary((s) => s.removeGoal);
  const completeGoal = useLibrary((s) => s.completeGoal);

  const [showNew, setShowNew] = useState(false);
  const [kind, setKind] = useState<GoalKind>('minutos');
  const [target, setTarget] = useState('');
  const [days, setDays] = useState(7);
  const [bookId, setBookId] = useState<string | null>(null);

  const derived = deriveStats(stats);
  const achievements = computeAchievements({ booksCount: booksList.length, vocabCount: vocab, derived });
  const unlocked = achievements.filter((a) => a.unlocked).length;

  // Dados do livro-alvo (progresso/páginas) p/ as metas por livro.
  const bookFor = (g: Goal) =>
    g.bookId ? { progress: bookProgress[g.bookId] ?? 0, pages: bookPages[g.bookId] ?? 0 } : undefined;

  const active = goals.filter((g) => !g.doneAt);
  const completed = goals.filter((g) => g.doneAt);

  // Auto-conclui metas que bateram o alvo (vira conquista).
  useEffect(() => {
    for (const g of active) {
      if (deriveGoal(g, stats, bookFor(g)).done) completeGoal(g.id, Date.now());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals, stats, bookProgress]);

  const goBack = () => (router.canGoBack() ? router.back() : router.navigate('/perfil'));

  function create() {
    let goal: Goal;
    if (kind === 'livro') {
      const book = booksList.find((b) => b.id === bookId);
      if (!book) {
        Alert.alert('Escolha um livro', 'Selecione um livro da sua biblioteca para a meta.');
        return;
      }
      goal = {
        id: `${Date.now()}`,
        kind: 'livro',
        title: `Terminar ${book.title ?? book.name}`,
        target: 0,
        deadline: dayKeyInDays(days),
        createdAt: Date.now(),
        createdDayKey: localDayKey(),
        baselineSeconds: stats.totalSeconds,
        bookId: book.id,
      };
    } else {
      const tt = parseInt(target, 10);
      if (!tt || tt < 1) {
        Alert.alert('Defina um alvo', kind === 'minutos' ? 'Quantos minutos quer ler?' : 'Em quantos dias quer ler?');
        return;
      }
      goal = {
        id: `${Date.now()}`,
        kind,
        title: kind === 'minutos' ? `${tt} min de leitura` : `Ler em ${tt} dias`,
        target: tt,
        deadline: dayKeyInDays(days),
        createdAt: Date.now(),
        createdDayKey: localDayKey(),
        baselineSeconds: stats.totalSeconds,
      };
    }
    addGoal(goal);
    setTarget('');
    setBookId(null);
    setKind('minutos');
    setDays(7);
    setShowNew(false);
  }

  return (
    <ScreenBG>
      <Pressable onPress={goBack} hitSlop={8} style={styles.backRow}>
        <Text style={[styles.back, { color: c.textDim }]}>‹ Voltar</Text>
      </Pressable>

      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: c.text }]}>Metas</Text>
        <Pressable onPress={() => setShowNew(true)} style={[styles.newBtn, { backgroundColor: c.green }]}>
          <Text style={[styles.newBtnText, { color: c.onGreen }]}>+ Nova meta</Text>
        </Pressable>
      </View>

      {/* Metas ativas */}
      {active.length === 0 ? (
        <Card style={{ marginTop: 14 }}>
          <Text style={[styles.emptyTitle, { color: c.text }]}>Crie sua primeira meta 🎯</Text>
          <Text style={[styles.emptySub, { color: c.textFaint }]}>
            Defina um objetivo com prazo (ex.: ler 120 min em 7 dias) e a app calcula quanto ler por dia,
            ajustando conforme seu ritmo.
          </Text>
        </Card>
      ) : (
        active.map((g) => {
          const gp = deriveGoal(g, stats, bookFor(g));
          return (
            <Card key={g.id} style={styles.goal}>
              <View style={styles.goalHead}>
                <Text style={[styles.goalTitle, { color: c.text }]} numberOfLines={1}>
                  {g.title}
                </Text>
                <Pressable onPress={() => removeGoal(g.id)} hitSlop={10}>
                  <Text style={{ color: c.textFaint, fontSize: 18 }}>🗑</Text>
                </Pressable>
              </View>
              <Text style={[styles.goalMeta, { color: gp.expired ? '#E5484D' : c.textFaint }]}>
                até {fmtShortDate(g.deadline)} · {gp.expired ? 'prazo encerrado' : `${gp.daysLeft} dia${gp.daysLeft === 1 ? '' : 's'} restante${gp.daysLeft === 1 ? '' : 's'}`}
              </Text>

              <View style={[styles.track, { backgroundColor: c.border }]}>
                <View style={[styles.fill, { backgroundColor: gp.expired ? '#E5484D' : c.green, width: `${Math.round(gp.pct * 100)}%` }]} />
              </View>

              <Text style={[styles.goalStats, { color: c.text }]}>
                {gp.current}/{gp.target} {gp.unit}
                {gp.remaining > 0 && !gp.expired ? (
                  <Text style={{ color: c.green }}>
                    {g.kind === 'minutos'
                      ? `  ·  ${gp.perDay} min/dia para bater`
                      : g.kind === 'dias'
                        ? `  ·  faltam ${gp.remaining} dia${gp.remaining === 1 ? '' : 's'} de leitura`
                        : `  ·  ${gp.perDay} ${gp.unit}/dia para terminar`}
                  </Text>
                ) : gp.expired ? (
                  <Text style={{ color: c.textFaint }}>  ·  não concluída a tempo</Text>
                ) : null}
              </Text>
            </Card>
          );
        })
      )}

      {/* Concluídas (conquistas personalizadas) */}
      {completed.length > 0 ? (
        <>
          <SectionTitle icon="🏅">Metas concluídas</SectionTitle>
          {completed.map((g) => (
            <Card key={g.id} glow style={styles.medal}>
              <Text style={styles.medalIcon}>🏅</Text>
              <View style={styles.flex}>
                <Text style={[styles.medalTitle, { color: c.text }]} numberOfLines={1}>
                  {g.title}
                </Text>
                <Text style={[styles.medalSub, { color: c.green }]}>
                  Concluída{g.doneAt ? ` em ${fmtShortDate(localDayKey(new Date(g.doneAt)))}` : ''}
                </Text>
              </View>
              <Pressable onPress={() => removeGoal(g.id)} hitSlop={10}>
                <Text style={{ color: c.textFaint, fontSize: 18 }}>🗑</Text>
              </Pressable>
            </Card>
          ))}
        </>
      ) : null}

      {/* Emblemas automáticos (gamificação de sempre) */}
      <View style={styles.embHead}>
        <SectionTitle icon="🏆">Emblemas</SectionTitle>
        <Text style={[styles.embCount, { color: c.textFaint }]}>
          {unlocked}/{achievements.length}
        </Text>
      </View>
      <View style={styles.grid}>
        {achievements.map((a) => (
          <Card key={a.id} glow={a.unlocked} style={[styles.cell, !a.unlocked && styles.cellLocked]}>
            <Text style={[styles.icon, !a.unlocked && styles.iconLocked]}>{a.icon}</Text>
            <Text style={[styles.cellTitle, { color: a.unlocked ? c.text : c.textDim }]} numberOfLines={1}>
              {a.title}
            </Text>
            <Text style={[styles.cellDesc, { color: c.textFaint }]} numberOfLines={2}>
              {a.desc}
            </Text>
            {a.unlocked ? (
              <Text style={[styles.done, { color: c.green }]}>✓ Desbloqueada</Text>
            ) : (
              <View style={[styles.miniTrack, { backgroundColor: c.cardElevated }]}>
                <View style={[styles.miniFill, { backgroundColor: c.purple, width: `${Math.round(a.progress * 100)}%` }]} />
              </View>
            )}
          </Card>
        ))}
      </View>

      {/* Criar meta */}
      <Modal visible={showNew} transparent animationType="fade" onRequestClose={() => setShowNew(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowNew(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: c.card, borderColor: c.border }]} onPress={() => {}}>
            <Text style={[styles.sheetTitle, { color: c.text }]}>Nova meta</Text>

            <Text style={[styles.label, { color: c.textDim }]}>Tipo</Text>
            <View style={[styles.segment, { borderColor: c.border }]}>
              {(['minutos', 'dias', 'livro'] as GoalKind[]).map((k) => (
                <Pressable key={k} onPress={() => setKind(k)} style={[styles.segItem, kind === k && { backgroundColor: c.green }]}>
                  <Text style={[styles.segText, { color: kind === k ? c.onGreen : c.textDim }]}>
                    {k === 'minutos' ? 'Minutos' : k === 'dias' ? 'Dias' : 'Livro'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {kind === 'livro' ? (
              <>
                <Text style={[styles.label, { color: c.textDim }]}>Qual livro terminar?</Text>
                {booksList.length === 0 ? (
                  <Text style={[styles.emptySub, { color: c.textFaint }]}>
                    Importe um livro na aba Leitura primeiro.
                  </Text>
                ) : (
                  <View style={styles.bookPick}>
                    {booksList.map((b) => {
                      const sel = bookId === b.id;
                      return (
                        <Pressable
                          key={b.id}
                          onPress={() => setBookId(b.id)}
                          style={[styles.bookChip, { borderColor: sel ? c.green : c.border, backgroundColor: sel ? c.green : 'transparent' }]}>
                          <Text style={[styles.bookChipText, { color: sel ? c.onGreen : c.text }]} numberOfLines={1}>
                            {b.title ?? b.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </>
            ) : (
              <>
                <Text style={[styles.label, { color: c.textDim }]}>
                  {kind === 'minutos' ? 'Quantos minutos?' : 'Em quantos dias diferentes?'}
                </Text>
                <TextInput
                  value={target}
                  onChangeText={setTarget}
                  keyboardType="number-pad"
                  placeholder={kind === 'minutos' ? 'ex.: 120' : 'ex.: 5'}
                  placeholderTextColor={c.textFaint}
                  style={[styles.input, { backgroundColor: c.cardElevated, borderColor: c.border, color: c.text }]}
                />
              </>
            )}

            <Text style={[styles.label, { color: c.textDim }]}>Prazo</Text>
            <View style={styles.winRow}>
              {WINDOWS.map((w) => (
                <Pressable
                  key={w}
                  onPress={() => setDays(w)}
                  style={[styles.winChip, { borderColor: days === w ? c.green : c.border, backgroundColor: days === w ? c.green : 'transparent' }]}>
                  <Text style={[styles.winText, { color: days === w ? c.onGreen : c.textDim }]}>{w} dias</Text>
                </Pressable>
              ))}
            </View>

            <Pressable onPress={create} style={[styles.createBtn, { backgroundColor: c.green }]}>
              <Text style={[styles.createText, { color: c.onGreen }]}>Criar meta</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenBG>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backRow: { marginBottom: 6 },
  back: { fontSize: 16, fontWeight: '600' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 28, fontWeight: '800' },
  newBtn: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  newBtnText: { fontSize: 14, fontWeight: '800' },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptySub: { fontSize: 13, marginTop: 4, lineHeight: 19 },
  goal: { marginTop: 12 },
  goalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  goalTitle: { fontSize: 16, fontWeight: '800', flex: 1 },
  goalMeta: { fontSize: 12, marginTop: 3 },
  track: { height: 9, borderRadius: 5, marginTop: 12, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  goalStats: { fontSize: 14, fontWeight: '700', marginTop: 10 },
  medal: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  medalIcon: { fontSize: 30 },
  medalTitle: { fontSize: 15, fontWeight: '800' },
  medalSub: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  embHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  embCount: { fontSize: 13, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '47.8%', flexGrow: 1, minHeight: 132 },
  cellLocked: { opacity: 0.7 },
  icon: { fontSize: 30 },
  iconLocked: { opacity: 0.5 },
  cellTitle: { fontSize: 15, fontWeight: '800', marginTop: 8 },
  cellDesc: { fontSize: 12, marginTop: 3, lineHeight: 17 },
  done: { fontSize: 12, fontWeight: '800', marginTop: 8 },
  miniTrack: { height: 5, borderRadius: 3, marginTop: 10, overflow: 'hidden' },
  miniFill: { height: '100%', borderRadius: 3 },
  backdrop: { flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, padding: 20, paddingBottom: 34 },
  sheetTitle: { fontSize: 18, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  segment: { flexDirection: 'row', borderRadius: 999, borderWidth: 1, padding: 4, gap: 4 },
  segItem: { flex: 1, borderRadius: 999, paddingVertical: 9, alignItems: 'center' },
  segText: { fontSize: 14, fontWeight: '700' },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  winRow: { flexDirection: 'row', gap: 8 },
  winChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  winText: { fontSize: 14, fontWeight: '700' },
  bookPick: { gap: 8 },
  bookChip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  bookChipText: { fontSize: 14, fontWeight: '700' },
  createBtn: { marginTop: 22, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  createText: { fontSize: 16, fontWeight: '800' },
});
