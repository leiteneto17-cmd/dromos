/**
 * Voz neural GERIDA do +leitura (CLAUDE.md §2.1/§5 — [[voz-tts-estrategia]]).
 * A chave do Azure fica NO SERVIDOR (Edge Function `tts-proxy`), nunca no app.
 * É a voz "premium de verdade" incluída no plano: quem NÃO trouxe chave do
 * ElevenLabs (BYOK) ouve com ela. Ordem dos motores em use-read-aloud:
 * ElevenLabs BYOK → esta (gerida) → voz do aparelho (expo-speech).
 *
 * Sem timestamps por palavra (o REST do Azure não fornece) — o "ouvir a partir
 * daqui" começa do início do parágrafo neste motor. O áudio é cacheado no
 * aparelho (tts-cache) para nunca regerar o mesmo trecho (§5).
 */
import Constants from 'expo-constants';

import { supabase } from '@/services/supabase';
import { useAuth } from '@/store/auth';

/** Slug da Edge Function (o painel pode gerar outro nome — igual ao aiProxyFunction). */
const FUNCTION_NAME =
  (Constants.expoConfig?.extra?.ttsProxyFunction as string | undefined) || 'tts-proxy';

/** Vozes pt-BR oferecidas (Azure Neural). O id curto é o que vai pro proxy e pro cache. */
export const MANAGED_VOICES = [
  { id: 'francisca', name: 'Francisca', desc: 'feminina' },
  { id: 'antonio', name: 'Antonio', desc: 'masculina' },
] as const;

export type ManagedVoiceId = (typeof MANAGED_VOICES)[number]['id'];

export const MANAGED_DEFAULT_VOICE: ManagedVoiceId = 'francisca';

/** true quando a voz gerida pode ser usada agora (Supabase configurado + logado). */
export function managedTtsAvailable(): boolean {
  return !!supabase && !!useAuth.getState().session;
}

/** Sintetiza via proxy e devolve o MP3 em base64. Lança Error com mensagem PT-BR. */
export async function synthesizeManaged(args: {
  text: string;
  voice: string;
}): Promise<string> {
  if (!supabase) throw new Error('Backend não configurado.');

  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
    body: { text: args.text, voice: args.voice },
  });

  if (error) throw new Error(await extractError(error));

  const payload = data as { audio?: string; error?: string } | null;
  if (payload?.error) throw new Error(payload.error);
  if (!payload?.audio) throw new Error('A voz neural devolveu áudio vazio.');
  return payload.audio;
}

/** Traduz o erro do invoke numa mensagem PT-BR clara (a crua é "non-2xx status code"). */
async function extractError(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response }).context;

  // 1) Mensagem PT que a NOSSA função devolve no corpo (503/429/etc.).
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.clone().json();
      if (body?.error) return String(body.error);
    } catch {
      // corpo não-JSON (ex.: 404 da plataforma quando a função não existe)
    }
  }

  // 2) Sem corpo útil: traduz pelo status / tipo do erro.
  const status = ctx?.status;
  if (status === 404) {
    return `A voz neural não foi encontrada no servidor (função “${FUNCTION_NAME}”). Confira se ela está publicada no Supabase e se o nome em app.json (extra.ttsProxyFunction) bate com o slug da função.`;
  }
  if (status === 401 || status === 403) {
    return 'Sem permissão para a voz neural. Entre na sua conta de novo.';
  }
  if (status && status >= 500) {
    return 'A voz neural falhou no servidor agora. Tente de novo em instantes.';
  }
  if ((error as { name?: string }).name === 'FunctionsFetchError') {
    return 'Sem conexão com o servidor da voz neural. Verifique a internet.';
  }
  return error instanceof Error ? error.message : 'Falha ao gerar a voz neural.';
}
