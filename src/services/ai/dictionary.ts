/**
 * Dicionário CONTEXTUAL por IA (CLAUDE.md §2.2). Diferente do dicionário estático:
 * a IA lê o parágrafo e explica o significado da palavra NAQUELE contexto, com
 * sinônimos, antônimos e 3 frases de exemplo do dia a dia.
 *
 * Duas formas de IA, nesta ordem:
 *  1. BYOK — se o usuário trouxe a chave dele (src/store/ai.ts), fala direto com o provedor.
 *  2. IA grátis/gerida — senão, e se estiver logado, usa a nossa chave no servidor
 *     (Edge Function `ai-proxy`, via services/ai/managed.ts). Padrão para todo mundo.
 * Envia só a palavra + o parágrafo (não o livro) para baratear (§5).
 */
import { managedAIAvailable, managedChatJSON } from '@/services/ai/managed';
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

/**
 * Busca o significado contextual da palavra. Usa a chave do usuário (BYOK) se houver;
 * senão a IA grátis/gerida (precisa estar logado). Só pede a chave quando nenhuma das
 * duas está disponível.
 */
export async function contextualLookup(word: string, context: string): Promise<LookupResult> {
  const { provider, model, hasKey } = useAI.getState();
  const user = `PALAVRA: ${word}\n\nPARÁGRAFO: ${context}`;
  const useManaged = !hasKey;

  // Nem chave própria, nem IA grátis disponível (deslogado / sem backend).
  if (useManaged && !managedAIAvailable()) {
    return {
      ok: false,
      error: 'Entre na sua conta para usar a IA grátis, ou conecte sua própria chave em Integrações.',
      needsKey: true,
    };
  }

  try {
    let raw: string;
    if (hasKey) {
      const key = await getApiKey();
      if (!key) return { ok: false, error: 'Chave não encontrada. Reconfigure em Integrações.', needsKey: true };
      raw = await chatJSON({ provider, key, model, system: SYSTEM, user });
    } else {
      raw = await managedChatJSON({ system: SYSTEM, user });
    }

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
    const msg = e instanceof Error ? e.message : 'Falha ao consultar a IA.';
    // Se foi pela IA grátis, oferece a própria chave como saída (needsKey → botão Configurar).
    return { ok: false, error: msg, needsKey: useManaged };
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
