/**
 * METAS (Fase 6) — evolui as "Conquistas". O usuário cria objetivos com prazo (ex.: "ler
 * 120 min em 7 dias"); a app calcula o RITMO necessário por dia e recalcula sozinha
 * (cronograma adaptativo): se atrasar, o min/dia sobe. Concluir vira uma conquista
 * personalizada (medalha) que fica aqui. Abaixo, os emblemas automáticos de sempre.
 *
 * Rota EMPILHADA `/conquistas` (mantida p/ não regenerar typed routes), acessada por
 * Perfil → Metas. Base neutra; verde = ação/concluído, roxo = detalhe (CLAUDE.md §2.7).
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { Card, ScreenBG, SectionTitle } from '@/components/social-ui';
import { medalImage } from '@/theme/medals';
import { useUI } from '@/hooks/use-ui';
import { suggestGoal, reminderText } from '@/services/ai/goal-coach';
import {
  computeAchievements,
  dayKeyInDays,
  deriveGoal,
  deriveStats,
  fmtShortDate,
  localDayKey,
} from '@/services/progress';
import {
  cancelDailyReminder,
  fmtTime,
  remindersUnsupported,
  scheduleDailyReminder,
} from '@/services/reminders';
import { evaluateGoals } from '@/services/goals';
import { useAI } from '@/store/ai';
import { useLibrary, type Goal, type GoalKind, type ReminderConfig } from '@/store/library';

const WINDOWS = [7, 14, 30];

/** Janela de prazo (7/14/30) mais próxima de `n` dias — p/ encaixar a sugestão da IA nos chips. */
function nearestWindow(n: number): number {
  return WINDOWS.reduce((best, w) => (Math.abs(w - n) < Math.abs(best - n) ? w : best), WINDOWS[0]);
}

/** Horários comuns de leitura (o usuário escolhe; §1b "deixar escolher horário"). */
const REMINDER_TIMES: { h: number; m: number; label: string }[] = [
  { h: 8, m: 0, label: 'Manhã' },
  { h: 12, m: 0, label: 'Almoço' },
  { h: 18, m: 0, label: 'Fim da tarde' },
  { h: 20, m: 0, label: 'Noite' },
  { h: 22, m: 0, label: 'Antes de dormir' },
];

export default function GoalsScreen() {
  const c = useUI();
  const booksList = useLibrary((s) => s.books);
  const vocab = useLibrary((s) => s.vocab.length);
  const stats = useLibrary((s) => s.stats);
  const sessions = useLibrary((s) => s.sessions);
  const goals = useLibrary((s) => s.goals);
  const bookProgress = useLibrary((s) => s.progress);
  const bookPages = useLibrary((s) => s.bookPages);
  const addGoal = useLibrary((s) => s.addGoal);
  const removeGoal = useLibrary((s) => s.removeGoal);
  const reminder = useLibrary((s) => s.reminder);
  const setReminder = useLibrary((s) => s.setReminder);
  const currentBookId = useLibrary((s) => s.currentBookId);
  const hasKey = useAI((s) => s.hasKey);

  const [showNew, setShowNew] = useState(false);
  const [kind, setKind] = useState<GoalKind>('minutos');
  const [target, setTarget] = useState('');
  const [days, setDays] = useState(7);
  const [bookId, setBookId] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  /** Justificativa da IA p/ a meta sugerida (mostrada no modal). */
  const [aiRationale, setAiRationale] = useState('');

  const derived = deriveStats(stats);
  const achievements = computeAchievements({
    booksCount: booksList.length,
    vocabCount: vocab,
    derived,
    sessions,
    progress: bookProgress,
  });
  const unlocked = achievements.filter((a) => a.unlocked).length;

  // Dados do livro-alvo (progresso/páginas) p/ as metas por livro.
  const bookFor = (g: Goal) =>
    g.bookId ? { progress: bookProgress[g.bookId] ?? 0, pages: bookPages[g.bookId] ?? 0 } : undefined;

  const active = goals.filter((g) => !g.doneAt);
  const completed = goals.filter((g) => g.doneAt);

  // Auto-conclui metas que bateram o alvo (vira conquista) e comemora (§7), via a
  // mesma função central usada pelo reader.
  useEffect(() => {
    evaluateGoals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals, stats, bookProgress]);

  const goBack = () => (router.canGoBack() ? router.back() : router.navigate('/perfil'));

  // --- Sugestão de meta por IA (BYOK, §1b incremento 2) ---
  async function onSuggest() {
    if (suggesting) return;
    setSuggesting(true);
    try {
      const cb = currentBookId ? booksList.find((b) => b.id === currentBookId) : undefined;
      const pct = cb ? bookProgress[cb.id] ?? 0 : 0;
      const pages = cb ? bookPages[cb.id] ?? 0 : 0;
      const res = await suggestGoal({
        avgMinPerDay: derived.avgMinPerDay,
        streak: derived.streak,
        activeDays: derived.activeDays,
        totalMinutes: Math.round(derived.totalSeconds / 60),
        booksCount: booksList.length,
        currentBook: cb
          ? {
              id: cb.id,
              title: cb.title ?? cb.name,
              pct,
              pages,
              pagesLeft: pages > 0 ? Math.ceil(pages * (1 - pct)) : 0,
            }
          : undefined,
      });
      if (!res.ok) {
        if (res.needsKey) {
          Alert.alert('IA não configurada', 'Configure sua chave em Perfil → Integrações para usar sugestões.');
        } else {
          Alert.alert('Não consegui sugerir', res.error);
        }
        return;
      }
      // Pré-preenche o modal "Nova meta" com a sugestão (o usuário revisa e cria).
      const s = res.data;
      setKind(s.kind);
      setTarget(s.kind === 'livro' ? '' : String(s.target));
      setDays(WINDOWS.includes(s.days) ? s.days : nearestWindow(s.days));
      setBookId(s.bookId ?? null);
      setAiRationale(s.rationale);
      setShowNew(true);
    } finally {
      setSuggesting(false);
    }
  }

  // --- Lembrete de leitura (notificação local diária — §1b) ---
  async function applyReminder(next: ReminderConfig) {
    if (next.enabled) {
      // Com IA (BYOK), personaliza o texto pelo ritmo/meta; senão, texto fixo no serviço.
      let body: string | undefined;
      if (hasKey) {
        const g = active[0] ? deriveGoal(active[0], stats, bookFor(active[0])) : null;
        const summary = [
          `Média: ${derived.avgMinPerDay} min/dia`,
          `Sequência: ${derived.streak} dia(s)`,
          g && !g.expired
            ? `Meta ativa "${active[0].title}": faltam ${g.remaining} ${g.unit} (${g.perDay} ${g.unit}/dia, ${g.daysLeft} dia(s))`
            : 'Sem meta ativa no momento',
        ].join('. ');
        body = (await reminderText(summary)) ?? undefined;
      }
      const ok = await scheduleDailyReminder(next.hour, next.minute, body);
      if (!ok) {
        Alert.alert(
          'Permissão necessária',
          remindersUnsupported
            ? 'Lembretes precisam do app instalado (dev build), não funcionam no Expo Go.'
            : 'Ative as notificações do +leitura nas configurações do aparelho para receber lembretes.',
        );
        setReminder({ ...next, enabled: false });
        return;
      }
    } else {
      await cancelDailyReminder();
    }
    setReminder(next);
  }

  const toggleReminder = (enabled: boolean) => applyReminder({ ...reminder, enabled });
  const pickTime = (h: number, m: number) =>
    applyReminder({ ...reminder, hour: h, minute: m, enabled: true });

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
    setAiRationale('');
    setShowNew(false);
  }

  return (
    <ScreenBG>
      <Pressable onPress={goBack} hitSlop={8} style={styles.backRow}>
        <Text style={[styles.back, { color: c.textDim }]}>‹ Voltar</Text>
      </Pressable>

      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: c.text }]}>Metas</Text>
        <PressableScale
          onPress={() => {
            setAiRationale('');
            setShowNew(true);
          }}
          style={[styles.newBtn, { backgroundColor: c.green }]}>
          <Text style={[styles.newBtnText, { color: c.onGreen }]}>+ Nova meta</Text>
        </PressableScale>
      </View>

      {/* Sugestão por IA (BYOK) — só aparece com chave configurada (§1b) */}
      {hasKey ? (
        <Pressable
          onPress={onSuggest}
          disabled={suggesting}
          style={[styles.suggestBtn, { borderColor: c.purple, opacity: suggesting ? 0.7 : 1 }]}>
          {suggesting ? (
            <ActivityIndicator size="small" color={c.purple} />
          ) : (
            <Text style={[styles.suggestText, { color: c.purple }]}>✨ Sugerir meta (IA)</Text>
          )}
        </Pressable>
      ) : null}

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

      {/* Lembrete de leitura (notificação local diária — §1b) */}
      <Card style={styles.reminder}>
        <View style={styles.remHead}>
          <View style={styles.flex}>
            <Text style={[styles.remTitle, { color: c.text }]}>🔔 Lembrete de leitura</Text>
            <Text style={[styles.remSub, { color: c.textFaint }]}>
              {reminder.enabled
                ? `Todo dia às ${fmtTime(reminder.hour, reminder.minute)}`
                : 'Receba um aviso diário para manter o ritmo'}
            </Text>
          </View>
          <Switch
            value={reminder.enabled}
            onValueChange={toggleReminder}
            trackColor={{ true: c.green, false: c.border }}
            thumbColor="#fff"
          />
        </View>

        {reminder.enabled ? (
          <View style={styles.timeRow}>
            {REMINDER_TIMES.map((t) => {
              const sel = reminder.hour === t.h && reminder.minute === t.m;
              return (
                <Pressable
                  key={`${t.h}:${t.m}`}
                  onPress={() => pickTime(t.h, t.m)}
                  style={[styles.timeChip, { borderColor: sel ? c.green : c.border, backgroundColor: sel ? c.green : 'transparent' }]}>
                  <Text style={[styles.timeLabel, { color: sel ? c.onGreen : c.text }]}>{t.label}</Text>
                  <Text style={[styles.timeClock, { color: sel ? c.onGreen : c.textFaint }]}>{fmtTime(t.h, t.m)}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {remindersUnsupported ? (
          <Text style={[styles.remNote, { color: c.textFaint }]}>
            No Expo Go os lembretes não disparam — teste no app instalado (dev build).
          </Text>
        ) : null}
      </Card>

      {/* Concluídas (conquistas personalizadas) */}
      {completed.length > 0 ? (
        <>
          <SectionTitle name="medal">Metas concluídas</SectionTitle>
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
        <SectionTitle name="trophy">Emblemas</SectionTitle>
        <Text style={[styles.embCount, { color: c.textFaint }]}>
          {unlocked}/{achievements.length}
        </Text>
      </View>
      <View style={styles.grid}>
        {achievements.map((a) => {
          const img = medalImage(a.id);
          return (
          <PressableScale
            key={a.id}
            onPress={() =>
              Alert.alert(
                `${a.title}`,
                `${a.desc}\n\n${a.unlocked ? '✓ Desbloqueada' : `Progresso: ${Math.round(a.progress * 100)}%`}`,
              )
            }
            style={[
              styles.cell,
              { backgroundColor: c.card, borderColor: a.unlocked ? c.green : c.border },
              a.unlocked && { shadowColor: c.green, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
              !a.unlocked && styles.cellLocked,
            ]}>
            <View style={styles.iconWrap}>
              {img ? (
                // Arte da medalha; bloqueada fica apagada (a célula já tem opacity + 🔒).
                <Image
                  source={img}
                  style={[styles.medalImg, !a.unlocked && styles.medalImgLocked]}
                  contentFit="contain"
                />
              ) : (
                <Text
                  style={[
                    styles.icon,
                    a.unlocked
                      ? { textShadowColor: c.green, textShadowRadius: 16, textShadowOffset: { width: 0, height: 0 } }
                      : styles.iconLocked,
                  ]}>
                  {a.icon}
                </Text>
              )}
              {!a.unlocked ? <Text style={styles.lockBadge}>🔒</Text> : null}
            </View>
            <Text style={[styles.cellTitle, { color: a.unlocked ? c.text : c.textDim }]} numberOfLines={2}>
              {a.title}
            </Text>
            {a.unlocked ? (
              <Text style={[styles.done, { color: c.green }]}>✓</Text>
            ) : (
              <View style={[styles.miniTrack, { backgroundColor: c.cardElevated }]}>
                <View style={[styles.miniFill, { backgroundColor: c.purple, width: `${Math.round(a.progress * 100)}%` }]} />
              </View>
            )}
          </PressableScale>
          );
        })}
      </View>

      {/* Criar meta */}
      <Modal visible={showNew} transparent animationType="fade" onRequestClose={() => setShowNew(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowNew(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: c.card, borderColor: c.border }]} onPress={() => {}}>
            <Text style={[styles.sheetTitle, { color: c.text }]}>Nova meta</Text>

            {aiRationale ? (
              <View style={[styles.aiTip, { backgroundColor: c.cardElevated, borderColor: c.purple }]}>
                <Text style={[styles.aiTipText, { color: c.text }]}>✨ {aiRationale}</Text>
              </View>
            ) : null}

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

            <PressableScale onPress={create} style={[styles.createBtn, { backgroundColor: c.green }]}>
              <Text style={[styles.createText, { color: c.onGreen }]}>Criar meta</Text>
            </PressableScale>
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
  suggestBtn: { marginTop: 12, borderWidth: 1, borderRadius: 999, paddingVertical: 11, alignItems: 'center', justifyContent: 'center', minHeight: 42 },
  suggestText: { fontSize: 14, fontWeight: '800' },
  aiTip: { marginTop: 14, borderWidth: 1, borderRadius: 12, padding: 12 },
  aiTipText: { fontSize: 13, lineHeight: 19, fontWeight: '600' },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptySub: { fontSize: 13, marginTop: 4, lineHeight: 19 },
  goal: { marginTop: 12 },
  goalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  goalTitle: { fontSize: 16, fontWeight: '800', flex: 1 },
  goalMeta: { fontSize: 12, marginTop: 3 },
  track: { height: 9, borderRadius: 5, marginTop: 12, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  goalStats: { fontSize: 14, fontWeight: '700', marginTop: 10 },
  reminder: { marginTop: 14 },
  remHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  remTitle: { fontSize: 16, fontWeight: '800' },
  remSub: { fontSize: 12, marginTop: 3 },
  timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  timeChip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  timeLabel: { fontSize: 13, fontWeight: '700' },
  timeClock: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  remNote: { fontSize: 11, marginTop: 12, lineHeight: 16 },
  medal: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  medalIcon: { fontSize: 30 },
  medalTitle: { fontSize: 15, fontWeight: '800' },
  medalSub: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  embHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  embCount: { fontSize: 13, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  // Célula quadrada estilo Steam (3 por linha). Quadrado via aspectRatio (sem flexGrow,
  // p/ a última linha não esticar). Conteúdo centralizado: ícone + título + status.
  cell: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellLocked: { opacity: 0.55 },
  iconWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  medalImg: { width: 56, height: 56 },
  medalImgLocked: { opacity: 0.55 },
  icon: { fontSize: 38, textAlign: 'center' },
  iconLocked: { opacity: 0.85 },
  lockBadge: { position: 'absolute', right: -12, bottom: -2, fontSize: 13 },
  cellTitle: { fontSize: 11.5, fontWeight: '800', textAlign: 'center', marginTop: 8, lineHeight: 14 },
  done: { fontSize: 14, fontWeight: '900', marginTop: 6 },
  miniTrack: { height: 4, width: '78%', borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  miniFill: { height: '100%', borderRadius: 2 },
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
