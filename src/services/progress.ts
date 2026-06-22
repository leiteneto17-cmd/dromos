/**
 * Cálculos de progresso/gamificação a partir do estado real da biblioteca
 * (livros, tempo de leitura por dia, vocabulário). Tudo derivado — sem inventar
 * dados. Usado pelo HUB (nível/badges), Atividades, Conquistas e Perfil.
 */
import type { Goal, ReadingStats } from '@/store/library';

export type DerivedStats = {
  totalSeconds: number;
  activeDays: number;
  avgMinPerDay: number;
  streak: number;
  level: number;
  /** Progresso 0..1 dentro do nível atual (p/ barra). */
  levelProgress: number;
  /** Últimos 7 dias (do mais antigo p/ o mais novo) em minutos. */
  last7: { key: string; label: string; minutes: number }[];
  bestDayMinutes: number;
};

const DAY_LABELS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function computeStreak(perDay: Record<string, number>): number {
  const d = new Date();
  if (!(perDay[dayKey(d)] > 0)) d.setDate(d.getDate() - 1); // ainda não leu hoje → não quebra
  let streak = 0;
  while (perDay[dayKey(d)] > 0) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function deriveStats(stats: ReadingStats): DerivedStats {
  const total = stats.totalSeconds;
  const activeDays = Object.values(stats.perDay).filter((v) => v > 0).length;
  const avgMinPerDay = activeDays ? Math.round(total / activeDays / 60) : 0;
  const streak = computeStreak(stats.perDay);

  // Nível: 1 nível a cada 30 min de leitura acumulada (ritmo cedo gratificante).
  const LEVEL_SECONDS = 30 * 60;
  const level = Math.floor(total / LEVEL_SECONDS) + 1;
  const levelProgress = (total % LEVEL_SECONDS) / LEVEL_SECONDS;

  const last7: DerivedStats['last7'] = [];
  let bestDayMinutes = 0;
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    const minutes = Math.round((stats.perDay[key] ?? 0) / 60);
    if (minutes > bestDayMinutes) bestDayMinutes = minutes;
    last7.push({ key, label: DAY_LABELS[d.getDay()], minutes });
  }
  // melhor dia considerando todo o histórico (não só 7 dias)
  for (const sec of Object.values(stats.perDay)) {
    const m = Math.round(sec / 60);
    if (m > bestDayMinutes) bestDayMinutes = m;
  }

  return { totalSeconds: total, activeDays, avgMinPerDay, streak, level, levelProgress, last7, bestDayMinutes };
}

export type Achievement = {
  id: string;
  icon: string;
  title: string;
  desc: string;
  unlocked: boolean;
  /** Progresso 0..1 rumo a desbloquear (p/ os ainda bloqueados). */
  progress: number;
};

export function computeAchievements(input: {
  booksCount: number;
  vocabCount: number;
  derived: DerivedStats;
}): Achievement[] {
  const { booksCount, vocabCount, derived } = input;
  const hours = derived.totalSeconds / 3600;

  const make = (
    id: string,
    icon: string,
    title: string,
    desc: string,
    current: number,
    goal: number,
  ): Achievement => ({
    id,
    icon,
    title,
    desc,
    unlocked: current >= goal,
    progress: Math.max(0, Math.min(1, current / goal)),
  });

  return [
    make('first-book', '📚', 'Primeira leitura', 'Adicione 1 livro', booksCount, 1),
    make('shelf', '🗂️', 'Estante', 'Tenha 5 livros', booksCount, 5),
    make('streak-3', '🔥', 'Pegando o ritmo', '3 dias seguidos', derived.streak, 3),
    make('streak-7', '🔥', 'Maratona', '7 dias seguidos', derived.streak, 7),
    make('hour-1', '⏱️', 'Imersão', '1 hora de leitura', hours, 1),
    make('hour-10', '⏱️', 'Dedicado', '10 horas de leitura', hours, 10),
    make('words-10', '💬', 'Curioso', 'Marque 10 palavras', vocabCount, 10),
    make('words-50', '🧠', 'Vocabulário+', 'Marque 50 palavras', vocabCount, 50),
  ];
}

// ---------- METAS (Fase 6) ----------

export type GoalProgress = {
  current: number; // minutos lidos OU dias de leitura desde a criação
  target: number;
  remaining: number;
  pct: number; // 0..1
  daysLeft: number; // dias de calendário até o prazo (>=0)
  perDay: number; // ritmo necessário por dia restante (recalcula = adaptativo)
  unit: string; // 'min' | 'dias'
  done: boolean;
  expired: boolean; // prazo passou sem concluir
};

/** Chave de dia LOCAL 'YYYY-MM-DD' (não UTC — casa com o dia do usuário). */
export function localDayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Dias de calendário de hoje até o prazo (inclui hoje; mínimo 0). */
function daysUntil(deadline: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = deadline.split('-').map(Number);
  const end = new Date(y, (m ?? 1) - 1, d ?? 1);
  end.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((end.getTime() - today.getTime()) / 86_400_000) + 1);
}

/** Progresso e ritmo necessário de uma meta, dado o estado de leitura atual.
 * Para metas por LIVRO, passe `book` = { progress(0..1), pages } do livro-alvo. */
export function deriveGoal(
  goal: Goal,
  stats: ReadingStats,
  book?: { progress: number; pages: number },
): GoalProgress {
  let current: number;
  let target: number;
  let unit: string;
  let done: boolean;

  if (goal.kind === 'minutos') {
    current = Math.max(0, Math.round((stats.totalSeconds - goal.baselineSeconds) / 60));
    target = goal.target;
    unit = 'min';
    done = current >= target;
  } else if (goal.kind === 'dias') {
    current = Object.entries(stats.perDay).filter(([k, v]) => v > 0 && k >= goal.createdDayKey).length;
    target = goal.target;
    unit = 'dias';
    done = current >= target;
  } else {
    // livro: progresso 0..1 do livro; se há páginas estimadas usa páginas, senão %.
    const prog = Math.max(0, Math.min(1, book?.progress ?? 0));
    const pages = book?.pages && book.pages > 0 ? book.pages : 0;
    if (pages > 0) {
      current = Math.round(prog * pages);
      target = pages;
      unit = 'págs';
    } else {
      current = Math.round(prog * 100);
      target = 100;
      unit = '%';
    }
    done = prog >= 0.97; // ~fim do livro (raramente bate 100% exato)
  }

  const remaining = Math.max(0, target - current);
  const pct = target > 0 ? Math.min(1, current / target) : 0;
  const daysLeft = daysUntil(goal.deadline);
  const perDay = remaining === 0 ? 0 : daysLeft > 0 ? Math.ceil(remaining / daysLeft) : remaining;
  const todayKey = localDayKey();
  const expired = !done && todayKey > goal.deadline;
  return { current, target, remaining, pct, daysLeft, perDay, unit, done, expired };
}

/** Data 'YYYY-MM-DD' daqui a `n` dias (p/ criar metas com prazo). */
export function dayKeyInDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return localDayKey(d);
}

/** "DD/MM" a partir de 'YYYY-MM-DD'. */
export function fmtShortDate(key: string): string {
  const [, m, d] = key.split('-');
  return `${d}/${m}`;
}

/** Formata segundos como "11h 23m 45s". */
export function fmtHMS(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  return `${h}h ${m}m ${s}s`;
}
