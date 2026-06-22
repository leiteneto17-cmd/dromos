/**
 * Provedores de IA para o modo BYOK (CLAUDE.md §5): o usuário traz a própria chave.
 * As chamadas vão DIRETO do aparelho ao provedor via `fetch` (sem backend, sem SDK
 * Node — que não roda bem no Expo Go). Suporta OpenAI e Anthropic (Claude).
 *
 * Formato de fio conferido na referência da API:
 *  - Anthropic: POST /v1/messages, headers x-api-key + anthropic-version: 2023-06-01.
 *  - OpenAI:    POST /v1/chat/completions, Authorization: Bearer.
 *  - Gemini:    POST /v1beta/models/{model}:generateContent, header x-goog-api-key.
 *               Tem free tier (chave grátis do Google AI Studio, sem cartão).
 */
export type AIProvider = 'openai' | 'anthropic' | 'gemini';

export type ProviderInfo = {
  label: string;
  /** Modelo padrão barato/rápido (bom para o dicionário contextual). */
  defaultModel: string;
  /** Sugestões de modelo (o usuário pode digitar outro). */
  models: string[];
  /** Dica do formato da chave, mostrada na tela de Integrações. */
  keyHint: string;
  /** Onde o usuário cria a chave. */
  keysUrl: string;
};

export const PROVIDERS: Record<AIProvider, ProviderInfo> = {
  openai: {
    label: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o'],
    keyHint: 'Começa com "sk-..."',
    keysUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    label: 'Anthropic (Claude)',
    defaultModel: 'claude-haiku-4-5',
    models: ['claude-haiku-4-5', 'claude-sonnet-4-6', 'claude-opus-4-8'],
    keyHint: 'Começa com "sk-ant-..."',
    keysUrl: 'https://console.anthropic.com/settings/keys',
  },
  gemini: {
    label: 'Google Gemini · grátis',
    defaultModel: 'gemini-2.5-flash',
    models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'],
    keyHint: 'Chave grátis do Google AI Studio',
    keysUrl: 'https://aistudio.google.com/app/apikey',
  },
};

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/** Valida a chave com uma chamada barata (lista de modelos — não gasta tokens). */
export async function validateKey(provider: AIProvider, key: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (provider === 'openai') {
      const r = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (r.ok) return { ok: true };
      if (r.status === 401) return { ok: false, error: 'Chave inválida ou sem permissão.' };
      return { ok: false, error: `Erro ${r.status} ao validar.` };
    }
    if (provider === 'anthropic') {
      const r = await fetch('https://api.anthropic.com/v1/models', {
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      });
      if (r.ok) return { ok: true };
      if (r.status === 401) return { ok: false, error: 'Chave inválida ou sem permissão.' };
      return { ok: false, error: `Erro ${r.status} ao validar.` };
    }
    // gemini
    const r = await fetch(`${GEMINI_BASE}/models`, { headers: { 'x-goog-api-key': key } });
    if (r.ok) return { ok: true };
    if (r.status === 400 || r.status === 403) return { ok: false, error: 'Chave inválida ou sem permissão.' };
    return { ok: false, error: `Erro ${r.status} ao validar.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Falha de rede.' };
  }
}

/**
 * Faz uma chamada de chat pedindo JSON e devolve o TEXTO bruto da resposta
 * (o chamador faz o parse). Mantém uma interface única para os dois provedores.
 */
export async function chatJSON(args: {
  provider: AIProvider;
  key: string;
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const { provider, key, model, system, user, maxTokens = 700 } = args;

  if (provider === 'openai') {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!r.ok) throw new Error(await mensagemErro(r));
    const data = await r.json();
    return data?.choices?.[0]?.message?.content ?? '';
  }

  if (provider === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!r.ok) throw new Error(await mensagemErro(r));
    const data = await r.json();
    // content é um array de blocos; pegamos o texto.
    return Array.isArray(data?.content)
      ? data.content.filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('')
      : '';
  }

  // gemini
  const r = await fetch(`${GEMINI_BASE}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: maxTokens },
    }),
  });
  if (!r.ok) throw new Error(await mensagemErro(r));
  const data = await r.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  return Array.isArray(parts) ? parts.map((p: { text?: string }) => p.text ?? '').join('') : '';
}

async function mensagemErro(r: Response): Promise<string> {
  let detalhe = '';
  try {
    const j = await r.json();
    detalhe = j?.error?.message ?? '';
  } catch {
    // sem corpo JSON
  }
  if (r.status === 401) return 'Chave inválida (401).';
  if (r.status === 429) return 'Limite de uso atingido no seu provedor (429).';
  return `Erro ${r.status}${detalhe ? `: ${detalhe}` : ''}`;
}
