// Supabase Edge Function: ai-proxy
// -----------------------------------------------------------------------------
// Proxy seguro da IA "grátis/gerida" do +leitura (CLAUDE.md §5/§6).
//
// A chave do Gemini fica como SEGREDO no servidor — NUNCA no app (§5/§8):
//   supabase secrets set GEMINI_API_KEY=sua_chave_do_google_ai_studio
//   supabase functions deploy ai-proxy
//
// O app (autenticado) chama via supabase.functions.invoke('ai-proxy', { body }).
// Como verify_jwt fica LIGADO por padrão, só usuários LOGADOS gastam a nossa cota.
//
// A chave grátis é UMA só, compartilhada entre todos os usuários, então tem limite
// diário. Quando estourar, o app sugere o usuário trazer a própria chave (BYOK).
// -----------------------------------------------------------------------------

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-2.5-flash-lite';
const ALLOWED_MODELS = new Set([
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
]);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) return json({ error: 'IA grátis ainda não foi configurada no servidor.' }, 503);

  let payload: { system?: string; user?: string; model?: string; maxTokens?: number };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Corpo inválido.' }, 400);
  }

  // Limites defensivos: o dicionário manda só palavra + parágrafo (§5), nunca o livro.
  const userText = String(payload.user ?? '').slice(0, 8000);
  const system = String(payload.system ?? '').slice(0, 4000);
  if (!userText.trim()) return json({ error: 'Faltou o texto da consulta.' }, 400);

  const model = ALLOWED_MODELS.has(String(payload.model)) ? String(payload.model) : DEFAULT_MODEL;
  const maxTokens = Math.min(Math.max(Number(payload.maxTokens) || 700, 16), 1024);

  try {
    const r = await fetch(`${GEMINI_BASE}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: maxTokens },
      }),
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('gemini error', r.status, detail.slice(0, 300));
      if (r.status === 429) {
        return json(
          {
            error:
              'O limite da IA grátis foi atingido por enquanto. Tente mais tarde ou conecte sua própria chave em Integrações.',
          },
          429,
        );
      }
      return json({ error: 'A IA grátis falhou agora. Tente de novo em instantes.' }, 502);
    }

    const data = await r.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts)
      ? parts.map((p: { text?: string }) => p.text ?? '').join('')
      : '';
    return json({ text });
  } catch (e) {
    console.error('proxy exception', e);
    return json({ error: 'Falha ao falar com a IA.' }, 502);
  }
});
