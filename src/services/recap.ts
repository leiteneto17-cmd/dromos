/**
 * RECAP SEMANAL — o "Wrapped" da semana de leitura (pacote hábito, 2026-07-02).
 * Deriva um resumo da SEMANA ATUAL (segunda → domingo, mesma janela dos Desafios)
 * a partir de `stats.perDay` + `sessions` locais. Vira um modo do ShareableCard
 * (tela /compartilhar?recap=1) → imagem pros Stories, o ritual de domingo.
 */
import { semanaAtualKeys } from '@/services/desafios';
import { computeStreak } from '@/services/progress';
import type { ReadingSession, ReadingStats } from '@/store/library';

export type WeekRecap = {
  /** "16/06 – 22/06" */
  label: string;
  minutes: number;
  pages: number;
  /** Dias com leitura na semana (0..7). */
  daysActive: number;
  bestDay: { label: string; minutes: number } | null;
  /** Títulos distintos lidos na semana (mais lidos primeiro). */
  books: string[];
  streak: number;
};

const DAY_LABELS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** "DD/MM" a partir da chave UTC 'YYYY-MM-DD'. */
function ddmm(key: string): string {
  const [, m, d] = key.split('-');
  return `${d}/${m}`;
}

export function computeWeekRecap(stats: ReadingStats, sessions: ReadingSession[]): WeekRecap {
  const semana = semanaAtualKeys();
  const setSemana = new Set(semana);

  let minutes = 0;
  let daysActive = 0;
  let bestDay: WeekRecap['bestDay'] = null;
  for (const key of semana) {
    const sec = stats.perDay[key] ?? 0;
    if (!(sec > 0)) continue;
    const min = Math.round(sec / 60);
    minutes += min;
    daysActive++;
    if (!bestDay || min > bestDay.minutes) {
      // meio-dia UTC evita a data "escorregar" de dia ao converter p/ local
      const dow = new Date(`${key}T12:00:00Z`).getUTCDay();
      bestDay = { label: DAY_LABELS[dow], minutes: min };
    }
  }

  // Sessões da semana → páginas + livros distintos (ordenados por tempo lido).
  let pages = 0;
  const porLivro = new Map<string, number>();
  for (const s of sessions) {
    const key = new Date(s.startedAt).toISOString().slice(0, 10);
    if (!setSemana.has(key)) continue;
    pages += s.pages || 0;
    const titulo = s.bookTitle?.trim();
    if (titulo) porLivro.set(titulo, (porLivro.get(titulo) ?? 0) + (s.seconds || 0));
  }
  const books = [...porLivro.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);

  return {
    label: `${ddmm(semana[0])} – ${ddmm(semana[6])}`,
    minutes,
    pages,
    daysActive,
    bestDay,
    books,
    streak: computeStreak(stats.perDay),
  };
}
