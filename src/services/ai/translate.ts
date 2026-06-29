/**
 * Tradutor de TRECHO por IA (selecionar texto no leitor → traduzir p/ PT-BR). Útil
 * principalmente p/ ler os clássicos em INGLÊS do acervo grátis (Gutenberg).
 *
 * Mesma camada do dicionário/Coach: usa a chave do usuário (BYOK) se houver; senão a IA
 * grátis/gerida (logado, via Edge Function `ai-proxy`/`hyper-task`). CACHE em memória por
 * trecho — não regerar a mesma tradução (§5).
 */
import { managedAIAvailable, managedChatJSON } from '@/services/ai/managed';
import { chatJSON } from '@/services/ai/providers';
import { getApiKey, useAI } from '@/store/ai';

export type TranslateResult =
  | { ok: true; text: string }
  | { ok: false; error: string; needsKey?: boolean };

/** Tradução por trecho (sessão). Evita gastar IA com o mesmo texto duas vezes. */
const cache = new Map<string, string>();

const SYSTEM =
  'Você é um tradutor para português do Brasil. Traduza FIELMENTE o trecho recebido para PT-BR, ' +
  'preservando o sentido e o tom literário (sem explicar, sem comentar). Responda APENAS com um objeto ' +
  'JSON válido, sem texto fora dele, com a chave exatamente "traducao" (string com a tradução).';

export async function translateToPT(text: string): Promise<TranslateResult> {
  const clean = text.trim();
  if (!clean) return { ok: false, error: 'Nada selecionado para traduzir.' };

  const cached = cache.get(clean);
  if (cached) return { ok: true, text: cached };

  const { provider, model, hasKey } = useAI.getState();
  const useManaged = !hasKey;
  if (useManaged && !managedAIAvailable()) {
    return {
      ok: false,
      error: 'Entre na sua conta para usar a tradução, ou conecte sua própria chave em Integrações.',
      needsKey: true,
    };
  }

  const user = clean.slice(0, 4000); // limite defensivo (§5) — trechos, não o livro
  try {
    let raw: string;
    if (hasKey) {
      const key = await getApiKey();
      if (!key) return { ok: false, error: 'Chave não encontrada. Reconfigure em Integrações.', needsKey: true };
      raw = await chatJSON({ provider, key, model, system: SYSTEM, user, maxTokens: 1024 });
    } else {
      raw = await managedChatJSON({ system: SYSTEM, user, maxTokens: 1024 });
    }
    const parsed = parseJSON(raw);
    const traducao = parsed && String(parsed.traducao ?? '').trim();
    if (!traducao) return { ok: false, error: 'A IA respondeu num formato inesperado. Tente de novo.' };
    cache.set(clean, traducao);
    return { ok: true, text: traducao };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Falha ao traduzir.', needsKey: useManaged };
  }
}

export type TranslateBatchResult =
  | { ok: true; texts: string[] }
  | { ok: false; error: string; needsKey?: boolean };

const BATCH_SYSTEM =
  'Você é um tradutor para português do Brasil. Receberá um JSON array de trechos de um livro. ' +
  'Traduza CADA trecho FIELMENTE para PT-BR, preservando o sentido e o tom literário (sem explicar, ' +
  'sem comentar). Responda APENAS com um objeto JSON válido, sem texto fora dele, no formato ' +
  '{"traducoes": [ ... ]} — um array de strings na MESMA ORDEM e com a MESMA QUANTIDADE de itens ' +
  'recebidos. Não junte nem divida trechos.';

/**
 * Tradução EM LOTE (vários parágrafos numa chamada só) — economiza ~5–10× a cota/IA frente
 * a traduzir um por um (§5). Usada pela leitura "🌐 Ler em português". Devolve as traduções
 * NA MESMA ORDEM do array recebido; se o formato vier errado, retorna ok:false (o chamador
 * mostra o texto original).
 */
export async function translateManyToPT(texts: string[]): Promise<TranslateBatchResult> {
  const items = texts.map((t) => t.trim());
  if (items.length === 0) return { ok: true, texts: [] };

  const { provider, model, hasKey } = useAI.getState();
  const useManaged = !hasKey;
  if (useManaged && !managedAIAvailable()) {
    return {
      ok: false,
      error: 'Entre na sua conta para usar a tradução, ou conecte sua própria chave em Integrações.',
      needsKey: true,
    };
  }

  const user = JSON.stringify(items);
  const maxTokens = Math.min(4096, 600 + Math.ceil(user.length / 2)); // folga p/ a saída em PT

  try {
    let raw: string;
    if (hasKey) {
      const key = await getApiKey();
      if (!key) return { ok: false, error: 'Chave não encontrada. Reconfigure em Integrações.', needsKey: true };
      raw = await chatJSON({ provider, key, model, system: BATCH_SYSTEM, user, maxTokens });
    } else {
      raw = await managedChatJSON({ system: BATCH_SYSTEM, user, maxTokens });
    }
    const parsed = parseJSON(raw);
    const arr = parsed && Array.isArray(parsed.traducoes) ? (parsed.traducoes as unknown[]) : null;
    if (!arr || arr.length !== items.length) {
      return { ok: false, error: 'A IA respondeu num formato inesperado. Tente de novo.' };
    }
    const out = arr.map((x) => String(x ?? '').trim());
    // alimenta o cache por trecho (reaproveita se o mesmo texto aparecer de novo)
    items.forEach((src, i) => {
      if (src && out[i]) cache.set(src, out[i]);
    });
    return { ok: true, texts: out };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Falha ao traduzir.', needsKey: useManaged };
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
