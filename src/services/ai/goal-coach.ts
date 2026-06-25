/**
 * Coach de METAS por IA (BYOK — IDEIAS-FUTURAS §1b, incremento 2). OPCIONAL: só funciona
 * com a chave do usuário configurada (`useAI.hasKey`). Sem chave, as Metas seguem só com a
 * matemática local (já é o padrão) — este módulo nunca é chamado.
 *
 * Duas funções:
 *  - `suggestGoal`: olha o histórico (ritmo/consistência/livro atual) e propõe uma meta
 *    realista com prazo + a justificativa ("você lê ~20 min/dia; que tal...").
 *  - `reminderText`: gera o texto do lembrete diário ajustado ao ritmo/meta do dia.
 *
 * Envia só números/resumo (não o livro inteiro) para baratear (§5).
 */
import { chatJSON } from '@/services/ai/providers';
import { getApiKey, useAI } from '@/store/ai';
import type { GoalKind } from '@/store/library';

/** Resumo do estado de leitura passado para a IA (só números, barato — §5). */
export type CoachInput = {
  avgMinPerDay: number;
  streak: number;
  activeDays: number;
  totalMinutes: number;
  booksCount: number;
  /** Livro aberto agora (candidato para meta por LIVRO), se houver. */
  currentBook?: { id: string; title: string; pct: number; pages: number; pagesLeft: number };
};

export type GoalSuggestion = {
  kind: GoalKind;
  /** minutos (kind='minutos') ou dias de leitura (kind='dias'); ignorado p/ 'livro'. */
  target: number;
  /** prazo sugerido em dias. */
  days: number;
  /** id do livro-alvo quando kind='livro'. */
  bookId?: string;
  title: string;
  rationale: string;
};

export type SuggestResult =
  | { ok: true; data: GoalSuggestion }
  | { ok: false; error: string; needsKey?: boolean };

const SUGGEST_SYSTEM =
  'Você é um coach de leitura em português do Brasil. Recebe um RESUMO numérico dos hábitos de ' +
  'leitura do usuário e propõe UMA meta realista e motivadora, nem fácil demais nem impossível, ' +
  'calibrada pelo ritmo atual dele. Responda APENAS com um objeto JSON válido, sem texto fora dele, ' +
  'com as chaves exatamente: "kind" (uma de "minutos", "dias", "livro"), "target" (número inteiro: ' +
  'minutos totais se kind="minutos"; quantidade de dias de leitura se kind="dias"; 0 se kind="livro"), ' +
  '"days" (prazo em dias, entre 3 e 30), "title" (título curto da meta em PT-BR), "rationale" (1 frase ' +
  'curta explicando por que essa meta faz sentido para o ritmo dele). Só use kind="livro" se houver um ' +
  'livro atual no resumo (terminar esse livro no prazo). Seja conservador: baseie o alvo no ritmo médio.';

/** Propõe uma meta com base no histórico. Requer IA configurada (BYOK). */
export async function suggestGoal(input: CoachInput): Promise<SuggestResult> {
  const { provider, model, hasKey } = useAI.getState();
  if (!hasKey) return { ok: false, error: 'Configure sua chave de IA em Integrações.', needsKey: true };

  const key = await getApiKey();
  if (!key) return { ok: false, error: 'Chave não encontrada. Reconfigure em Integrações.', needsKey: true };

  const lines = [
    `Média de leitura por dia ativo: ${input.avgMinPerDay} min`,
    `Dias seguidos atuais (streak): ${input.streak}`,
    `Total de dias já lidos: ${input.activeDays}`,
    `Tempo total acumulado: ${input.totalMinutes} min`,
    `Livros na biblioteca: ${input.booksCount}`,
  ];
  if (input.currentBook) {
    lines.push(
      `Livro atual: "${input.currentBook.title}" — ${Math.round(input.currentBook.pct * 100)}% lido, ` +
        `~${input.currentBook.pages} págs (faltam ~${input.currentBook.pagesLeft} págs)`,
    );
  }

  try {
    // maxTokens alto (teto, não custo): modelos Gemini 2.5 "pensam" antes do JSON e, com
    // orçamento baixo, estouram no raciocínio e devolvem vazio → parse falha. 1024 dá folga.
    const raw = await chatJSON({ provider, key, model, system: SUGGEST_SYSTEM, user: lines.join('\n'), maxTokens: 1024 });
    const parsed = parseJSON(raw);
    if (!parsed) return { ok: false, error: 'A IA respondeu num formato inesperado. Tente de novo.' };

    let kind = String(parsed.kind ?? 'minutos') as GoalKind;
    if (kind !== 'minutos' && kind !== 'dias' && kind !== 'livro') kind = 'minutos';
    // Meta por livro só é possível se há um livro atual; senão, cai p/ minutos.
    if (kind === 'livro' && !input.currentBook) kind = 'minutos';

    const days = clampInt(parsed.days, 3, 30, 7);
    const target =
      kind === 'livro' ? 0 : kind === 'minutos' ? clampInt(parsed.target, 5, 100000, 60) : clampInt(parsed.target, 1, 60, 5);

    return {
      ok: true,
      data: {
        kind,
        target,
        days,
        bookId: kind === 'livro' ? input.currentBook?.id : undefined,
        title: String(parsed.title ?? '').trim() || defaultTitle(kind, target, input.currentBook?.title),
        rationale: String(parsed.rationale ?? '').trim(),
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Falha ao consultar a IA.' };
  }
}

const REMINDER_SYSTEM =
  'Você escreve UMA frase curta (máx ~90 caracteres) em português do Brasil para uma notificação ' +
  'diária que incentiva a pessoa a ler agora, com tom leve e gentil (sem pressão tóxica, sem virar ' +
  'corrida de velocidade — §4.8). Pode usar 1 emoji. Responda APENAS com um JSON válido com a chave ' +
  '"texto" (string). Use os números do resumo para deixar o lembrete pessoal (ritmo, meta do dia).';

/** Gera o texto do lembrete diário ajustado ao ritmo. Volta `null` se não der (usa o texto fixo). */
export async function reminderText(summary: string): Promise<string | null> {
  const { provider, model, hasKey } = useAI.getState();
  if (!hasKey) return null;
  const key = await getApiKey();
  if (!key) return null;
  try {
    // Teto alto pelo mesmo motivo do suggestGoal (Gemini 2.5 "pensa" antes do JSON).
    const raw = await chatJSON({ provider, key, model, system: REMINDER_SYSTEM, user: summary, maxTokens: 512 });
    const parsed = parseJSON(raw);
    const texto = parsed && String(parsed.texto ?? '').trim();
    return texto && texto.length > 0 ? texto.slice(0, 140) : null;
  } catch {
    return null;
  }
}

function defaultTitle(kind: GoalKind, target: number, bookTitle?: string): string {
  if (kind === 'livro') return `Terminar ${bookTitle ?? 'o livro'}`;
  if (kind === 'minutos') return `${target} min de leitura`;
  return `Ler em ${target} dias`;
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/** Extrai o JSON da resposta, tolerando texto/```json``` ao redor. */
function parseJSON(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}
