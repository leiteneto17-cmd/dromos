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
