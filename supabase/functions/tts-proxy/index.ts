// Supabase Edge Function: tts-proxy
// -----------------------------------------------------------------------------
// Proxy da VOZ NEURAL GERIDA do +leitura (CLAUDE.md §2.1/§5 — [[voz-tts-estrategia]]).
//
// Fase 1 da escada de provedores (decisão 2026-07-02): Microsoft Azure TTS no tier
// GRÁTIS F0 (500 mil caracteres neurais/mês). Vozes pt-BR Francisca e Antonio.
// A chave do Azure fica como SEGREDO no servidor — NUNCA no app (§8):
//
//   supabase secrets set AZURE_SPEECH_KEY="..." AZURE_SPEECH_REGION="brazilsouth"
//   supabase secrets set TTS_DAILY_CHARS=20000        (opcional; padrão 20 mil)
//   supabase functions deploy tts-proxy
//
// Cota: por CARACTERES/dia por usuário (não por chamada — áudio gasta muito mais que
// dicionário). RPC tts_quota_consume no Postgres (schema.sql); FAIL-OPEN enquanto o
// SQL não for aplicado. verify_jwt LIGADO (só logado). O app cacheia o MP3 no
// aparelho (§5) — o mesmo parágrafo nunca é gerado duas vezes.
//
// Resposta: { audio: "<mp3 em base64>" } — sem timestamps por palavra (o endpoint
// REST v1 do Azure não os fornece; o SDK/websocket sim → avaliar quando o karaokê
// palavra-a-palavra voltar, ver §2.1).
// -----------------------------------------------------------------------------

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';

/** Vozes neurais pt-BR oferecidas (id curto do app → nome completo do Azure). */
const VOICES: Record<string, string> = {
  francisca: 'pt-BR-FranciscaNeural',
  antonio: 'pt-BR-AntonioNeural',
};
const DEFAULT_VOICE = 'francisca';

/** Teto de texto por chamada (o app manda parágrafo a parágrafo, nunca o livro — §5). */
const MAX_TEXT = 3000;

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

/** Escapa o texto p/ dentro do SSML (XML). */
function xmlEscape(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/** Cota diária de CARACTERES do usuário (rpc SECURITY DEFINER). `true` = dentro do limite.
 * FAIL-OPEN: se a função/tabela ainda não existir no banco, libera (não trava antes do SQL). */
async function withinQuota(authHeader: string, chars: number, limit: number): Promise<boolean> {
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anon) return true; // ambiente incompleto → não bloqueia
  try {
    const supa = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data, error } = await supa.rpc('tts_quota_consume', { p_chars: chars, p_limit: limit });
    if (error) {
      console.warn('quota tts rpc indisponível (fail-open):', error.message);
      return true;
    }
    return data !== false;
  } catch (e) {
    console.warn('quota tts falhou (fail-open):', String(e).slice(0, 160));
    return true;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const azureKey = Deno.env.get('AZURE_SPEECH_KEY')?.trim();
  const region = Deno.env.get('AZURE_SPEECH_REGION')?.trim();
  if (!azureKey || !region) {
    return json({ error: 'A voz neural ainda não foi configurada no servidor.' }, 503);
  }

  let payload: { text?: string; voice?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Corpo inválido.' }, 400);
  }

  const text = String(payload.text ?? '').slice(0, MAX_TEXT).trim();
  if (!text) return json({ error: 'Faltou o texto para narrar.' }, 400);
  const voiceName = VOICES[String(payload.voice ?? DEFAULT_VOICE)] ?? VOICES[DEFAULT_VOICE];

  // Cota diária por usuário, em caracteres — ANTES de gastar a cota da Azure.
  const limit = Math.max(500, Number(Deno.env.get('TTS_DAILY_CHARS')) || 20_000);
  const ok = await withinQuota(req.headers.get('Authorization') ?? '', text.length, limit);
  if (!ok) {
    return json(
      {
        error:
          'A voz neural descansou por hoje 😴 Você usou sua cota diária — a leitura segue na voz do aparelho, ou conecte sua própria chave em Integrações.',
        quota: true,
      },
      429,
    );
  }

  const ssml =
    `<speak version='1.0' xml:lang='pt-BR'>` +
    `<voice name='${voiceName}'>${xmlEscape(text)}</voice>` +
    `</speak>`;

  const r = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': azureKey,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'leitura-tts-proxy',
    },
    body: ssml,
  });

  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    console.error(`azure tts ${r.status}: ${detail.slice(0, 200)}`);
    if (r.status === 429) {
      // Tier F0 tem limite de requisições/minuto e de caracteres/mês.
      return json(
        { error: 'A voz neural está sobrecarregada agora. Tente de novo em instantes.', quota: true },
        429,
      );
    }
    if (r.status === 401 || r.status === 403) {
      return json({ error: 'A voz neural está mal configurada no servidor (chave/região).' }, 503);
    }
    return json({ error: 'A voz neural falhou agora. A leitura segue na voz do aparelho.' }, 502);
  }

  const audio = encodeBase64(await r.arrayBuffer());
  if (!audio) return json({ error: 'A voz neural devolveu áudio vazio.' }, 502);
  return json({ audio });
});
