/**
 * IA "grátis/gerida" do +leitura (CLAUDE.md §5/§6). A chave do Gemini fica NO
 * SERVIDOR (Supabase Edge Function `ai-proxy`), nunca no app. Só usuários LOGADOS
 * usam (a função exige JWT) — é o caminho PADRÃO do dicionário contextual quando o
 * usuário ainda não trouxe a própria chave (BYOK). Quem traz a chave fala direto
 * com o provedor (services/ai/providers.ts), sem passar por aqui.
 */
import { supabase } from '@/services/supabase';
import { useAuth } from '@/store/auth';

/** true quando a IA grátis pode ser usada agora (Supabase configurado + logado). */
export function managedAIAvailable(): boolean {
  return !!supabase && !!useAuth.getState().session;
}

/** Chama o proxy e devolve o TEXTO bruto da resposta (o chamador faz o parse). */
export async function managedChatJSON(args: {
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
}): Promise<string> {
  if (!supabase) throw new Error('Backend não configurado.');

  const { data, error } = await supabase.functions.invoke('ai-proxy', {
    body: {
      system: args.system,
      user: args.user,
      ...(args.model ? { model: args.model } : {}),
      ...(args.maxTokens ? { maxTokens: args.maxTokens } : {}),
    },
  });

  if (error) throw new Error(await extractError(error));

  const payload = data as { text?: string; error?: string } | null;
  if (payload?.error) throw new Error(payload.error);
  return payload?.text ?? '';
}

/** Extrai a mensagem PT-BR que a função devolveu no corpo do erro HTTP. */
async function extractError(error: unknown): Promise<string> {
  try {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      const body = await ctx.json();
      if (body?.error) return String(body.error);
    }
  } catch {
    // sem corpo JSON utilizável
  }
  return error instanceof Error ? error.message : 'Falha ao consultar a IA grátis.';
}
