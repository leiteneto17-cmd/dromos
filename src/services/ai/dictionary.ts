/**
 * Dicionário CONTEXTUAL por IA (CLAUDE.md §2.2). Diferente do dicionário estático:
 * a IA lê o parágrafo e explica o significado da palavra NAQUELE contexto, com
 * sinônimos, antônimos e 3 frases de exemplo do dia a dia.
 *
 * BYOK: usa a chave do próprio usuário (src/store/ai.ts) chamando o provedor direto.
 * Envia só a palavra + o parágrafo (não o livro) para baratear (§5).
 */
import { chatJSON } from '@/services/ai/providers';
import { getApiKey, useAI } from '@/store/ai';

export type ContextualMeaning = {
  significado: string;
  sinonimos: string[];
  antonimos: string[];
  exemplos: string[];
};

const SYSTEM =
  'Você é um dicionário contextual em português do Brasil. Recebe uma PALAVRA e o ' +
  'PARÁGRAFO onde ela aparece. Explique o significado da palavra NAQUELE contexto, de ' +
  'forma curta e clara. Responda APENAS com um objeto JSON válido, sem texto fora dele, ' +
  'com as chaves exatamente: "significado" (string), "sinonimos" (array de strings), ' +
  '"antonimos" (array de strings), "exemplos" (array com 3 frases curtas usando a palavra ' +
  'no dia a dia). Se não houver sinônimos/antônimos, use arrays vazios.';

export type LookupResult =
  | { ok: true; data: ContextualMeaning }
  | { ok: false; error: string; needsKey?: boolean };

/** Busca o significado contextual da palavra. Requer IA configurada (BYOK). */
export async function contextualLookup(word: string, context: string): Promise<LookupResult> {
  const { provider, model, hasKey } = useAI.getState();
  if (!hasKey) return { ok: false, error: 'Configure sua chave de IA em Integrações.', needsKey: true };

  const key = await getApiKey();
  if (!key) return { ok: false, error: 'Chave não encontrada. Reconfigure em Integrações.', needsKey: true };

  const user = `PALAVRA: ${word}\n\nPARÁGRAFO: ${context}`;

  try {
    const raw = await chatJSON({ provider, key, model, system: SYSTEM, user });
    const parsed = parseJSON(raw);
    if (!parsed) return { ok: false, error: 'A IA respondeu num formato inesperado. Tente de novo.' };
    return {
      ok: true,
      data: {
        significado: String(parsed.significado ?? '').trim() || 'Sem explicação.',
        sinonimos: arr(parsed.sinonimos),
        antonimos: arr(parsed.antonimos),
        exemplos: arr(parsed.exemplos),
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Falha ao consultar a IA.' };
  }
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

function arr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean).slice(0, 5);
}
