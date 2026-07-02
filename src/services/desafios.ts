/**
 * DESAFIOS — a mecânica de retenção nº 1 do Strava, versão leitura ("alma do app" —
 * decisão do usuário 2026-07-02: Strava social + bons hábitos). v1 é 100% LOCAL:
 * tudo derivado de `stats.perDay` e `sessions` que já existem (zero backend, zero
 * risco pro que está validado). Participação automática: todo mundo está nos
 * desafios do período — entrar/ranquear entre amigos fica pra v2 (Supabase).
 *
 * Convenção de datas: `stats.perDay` usa chave UTC 'YYYY-MM-DD'
 * (`toISOString().slice(0,10)`, igual ao computeStreak) — mantemos a MESMA aqui
 * para os números baterem com o streak/semana já validados.
 */
import type { ReadingSession, ReadingStats } from '@/store/library';

export type Desafio = {
  id: string;
  icon: string;
  title: string;
  desc: string;
  /** Período legível ("Julho" | "Esta semana"). */
  period: string;
  current: number;
  target: number;
  unit: string;
  /** 0..1 */
  pct: number;
  done: boolean;
};

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** Chave UTC 'YYYY-MM-DD' (mesma convenção do stats.perDay/computeStreak). */
function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Os 7 dias (chaves UTC) da SEMANA atual, de segunda a domingo.
 * Exportada: o Recap semanal (services/recap.ts) usa a MESMA janela. */
export function semanaAtualKeys(): string[] {
  const now = new Date();
  const dow = now.getDay(); // 0=dom … 6=sáb
  const diasDesdeSegunda = (dow + 6) % 7; // seg=0 … dom=6
  const keys: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - diasDesdeSegunda + i);
    keys.push(utcDayKey(d));
  }
  return keys;
}

function make(
  id: string,
  icon: string,
  title: string,
  desc: string,
  period: string,
  current: number,
  target: number,
  unit: string,
): Desafio {
  return {
    id,
    icon,
    title,
    desc,
    period,
    current: Math.round(current),
    target,
    unit,
    pct: Math.max(0, Math.min(1, current / target)),
    done: current >= target,
  };
}

/** Desafios do período atual, com progresso real. Ordem: semana primeiro, depois o mês. */
export function computeDesafios(stats: ReadingStats, sessions: ReadingSession[]): Desafio[] {
  const now = new Date();
  const mesKey = now.toISOString().slice(0, 7); // 'YYYY-MM' (UTC, mesma base do perDay)
  const mesNome = MESES[now.getMonth()];

  // --- Este mês (perDay + sessões filtradas pelo mês corrente) ---
  let segundosMes = 0;
  let diasAtivosMes = 0;
  for (const [key, sec] of Object.entries(stats.perDay)) {
    if (!key.startsWith(mesKey) || !(sec > 0)) continue;
    segundosMes += sec;
    diasAtivosMes++;
  }
  const paginasMes = sessions.reduce((a, s) => {
    const k = utcDayKey(new Date(s.startedAt));
    return k.startsWith(mesKey) ? a + (s.pages || 0) : a;
  }, 0);

  // --- Esta semana (segunda → domingo) ---
  const semana = semanaAtualKeys();
  const diasAtivosSemana = semana.filter((k) => (stats.perDay[k] ?? 0) > 0).length;

  return [
    make(
      'semana-consistente',
      '🔥',
      'Semana consistente',
      'Leia em 5 dias diferentes desta semana.',
      'Esta semana',
      diasAtivosSemana,
      5,
      'dias',
    ),
    make(
      `maratona-${mesKey}`,
      '📖',
      `Maratona de ${mesNome}`,
      `Leia 300 páginas ao longo de ${mesNome}.`,
      mesNome,
      paginasMes,
      300,
      'págs',
    ),
    make(
      `horas-${mesKey}`,
      '⏱️',
      'Dez horas no mês',
      `Acumule 10 horas de leitura em ${mesNome}.`,
      mesNome,
      segundosMes / 60,
      600,
      'min',
    ),
    make(
      `dias-${mesKey}`,
      '📅',
      'Metade do mês lendo',
      `Leia em 15 dias diferentes de ${mesNome}.`,
      mesNome,
      diasAtivosMes,
      15,
      'dias',
    ),
  ];
}
