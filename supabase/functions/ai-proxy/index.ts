// Supabase Edge Function: ai-proxy
// -----------------------------------------------------------------------------
// Proxy seguro da IA "grátis/gerida" do +leitura (CLAUDE.md §5/§6).
//
// As chaves ficam como SEGREDO no servidor — NUNCA no app (§5/§8). Suporta:
//   - VÁRIAS chaves Gemini (rotação p/ distribuir carga e resiliência). Dois formatos
//     (pode usar QUALQUER um, ou os dois — todas são juntadas):
//       a) secrets NOMEADAS: GEMINI_API_KEY, GEMINI_API_KEY2, GEMINI_API_KEY3 … até 10
//       b) UMA lista por vírgula: GEMINI_API_KEYS="chave1,chave2,chave3"
//   - OpenAI como REDE DE SEGURANÇA (último recurso se todas as Gemini falharem):
//       supabase secrets set OPENAI_API_KEY="sk-..."
//   - Limite diário por usuário (cota): AI_DAILY_LIMIT (padrão 20).
//   supabase functions deploy ai-proxy
//
// Resiliência: tenta as chaves Gemini (em ordem embaralhada p/ não martelar sempre a
// 1ª) e, se todas falharem/saturarem, cai p/ a OpenAI. Só erra quando TODAS falham.
//
// Cota: cada usuário logado tem N chamadas/dia (rpc ai_quota_consume no Postgres).
// Estourou → mensagem amigável "A IA foi dormir 😴". verify_jwt LIGADO (só logado).
// -----------------------------------------------------------------------------

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-2.5-flash-lite';
const ALLOWED_MODELS = new Set(['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash']);
const OPENAI_MODEL = 'gpt-4o-mini';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

/** Erro de provedor com o status HTTP anexado (p/ decidir se continua a rotação). */
class ProviderError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}

async function callGemini(
  key: string,
  system: string,
  user: string,
  model: string,
  maxTokens: number,
): Promise<string> {
  const r = await fetch(`${GEMINI_BASE}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: maxTokens },
    }),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    throw new ProviderError(`gemini ${r.status}: ${detail.slice(0, 200)}`, r.status);
  }
  const data = await r.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts) ? parts.map((p: { text?: string }) => p.text ?? '').join('') : '';
  if (!text.trim()) throw new ProviderError('gemini resposta vazia', 502);
  return text;
}

async function callOpenAI(key: string, system: string, user: string, maxTokens: number): Promise<string> {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: user }],
      response_format: { type: 'json_object' },
      max_tokens: maxTokens,
    }),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    throw new ProviderError(`openai ${r.status}: ${detail.slice(0, 200)}`, r.status);
  }
  const data = await r.json();
  const text = data?.choices?.[0]?.message?.content ?? '';
  if (!text.trim()) throw new ProviderError('openai resposta vazia', 502);
  return text;
}

/** Junta as chaves Gemini de TODAS as fontes: secrets nomeadas (GEMINI_API_KEY,
 * GEMINI_API_KEY2…GEMINI_API_KEY10) + a lista por vírgula (GEMINI_API_KEYS). Sem duplicatas. */
function collectGeminiKeys(): string[] {
  const keys: string[] = [];
  const list = Deno.env.get('GEMINI_API_KEYS');
  if (list) keys.push(...list.split(',').map((s) => s.trim()));
  const first = Deno.env.get('GEMINI_API_KEY');
  if (first) keys.push(first.trim());
  for (let i = 2; i <= 10; i++) {
    const k = Deno.env.get(`GEMINI_API_KEY${i}`);
    if (k) keys.push(k.trim());
  }
  return [...new Set(keys.filter(Boolean))];
}

/** Cota diária do usuário (rpc SECURITY DEFINER). `true` = ainda dentro do limite.
 * FAIL-OPEN: se a função/tabela ainda não existir, libera (não trava o app antes do SQL). */
async function withinQuota(authHeader: string, limit: number): Promise<boolean> {
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anon) return true; // ambiente incompleto → não bloqueia
  try {
    const supa = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data, error } = await supa.rpc('ai_quota_consume', { p_limit: limit });
    if (error) {
      console.warn('quota rpc indisponível (fail-open):', error.message);
      return true;
    }
    return data !== false;
  } catch (e) {
    console.warn('quota check falhou (fail-open):', String(e).slice(0, 160));
    return true;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  // Monta a lista de chaves Gemini (secrets nomeadas + lista por vírgula) + fallback OpenAI.
  const geminiKeys = collectGeminiKeys();
  const openaiKey = Deno.env.get('OPENAI_API_KEY')?.trim();
  if (geminiKeys.length === 0 && !openaiKey) {
    return json({ error: 'IA grátis ainda não foi configurada no servidor.' }, 503);
  }

  let payload: { system?: string; user?: string; model?: string; maxTokens?: number };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Corpo inválido.' }, 400);
  }

  // Limites defensivos: o app manda só o necessário (§5), nunca o livro inteiro.
  const userText = String(payload.user ?? '').slice(0, 8000);
  const system = String(payload.system ?? '').slice(0, 4000);
  if (!userText.trim()) return json({ error: 'Faltou o texto da consulta.' }, 400);

  const model = ALLOWED_MODELS.has(String(payload.model)) ? String(payload.model) : DEFAULT_MODEL;
  // Teto de saída: 2048 (era 1024). Folga p/ a tradução em LOTE do leitor (vários
  // parágrafos numa resposta) e p/ não truncar parágrafos longos. Requer redeploy.
  const maxTokens = Math.min(Math.max(Number(payload.maxTokens) || 700, 16), 2048);

  // Cota diária por usuário (antes de gastar API). Estourou → "a IA foi dormir".
  const limit = Math.max(1, Number(Deno.env.get('AI_DAILY_LIMIT')) || 20);
  const ok = await withinQuota(req.headers.get('Authorization') ?? '', limit);
  if (!ok) {
    return json(
      { error: 'A IA foi dormir 😴 Você usou sua cota grátis de hoje — volte amanhã, ou conecte sua própria chave em Integrações.', quota: true },
      429,
    );
  }

  // Rotação: embaralha as chaves Gemini (distribui carga) e deixa a OpenAI por último.
  for (let i = geminiKeys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [geminiKeys[i], geminiKeys[j]] = [geminiKeys[j], geminiKeys[i]];
  }
  const attempts: Array<() => Promise<string>> = geminiKeys.map(
    (k) => () => callGemini(k, system, userText, model, maxTokens),
  );
  if (openaiKey) attempts.push(() => callOpenAI(openaiKey, system, userText, maxTokens));

  for (const attempt of attempts) {
    try {
      const text = await attempt();
      return json({ text });
    } catch (e) {
      const status = e instanceof ProviderError ? e.status : 0;
      console.error(`provedor falhou (status ${status}), tentando próximo:`, String(e).slice(0, 200));
      // 429 (cota) ou 5xx/rede → tenta o próximo provedor. Segue o laço.
    }
  }

  // Todos os provedores falharam.
  return json(
    { error: 'A IA está instável agora (todos os provedores falharam). Tente de novo em instantes, ou use sua própria chave em Integrações.' },
    502,
  );
});
