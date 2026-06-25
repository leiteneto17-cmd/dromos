/**
 * IA "grátis/gerida" do +leitura (CLAUDE.md §5/§6). A chave do Gemini fica NO
 * SERVIDOR (Supabase Edge Function `ai-proxy`), nunca no app. Só usuários LOGADOS
 * usam (a função exige JWT) — é o caminho PADRÃO do dicionário contextual quando o
 * usuário ainda não trouxe a própria chave (BYOK). Quem traz a chave fala direto
 * com o provedor (services/ai/providers.ts), sem passar por aqui.
 */
import Constants from 'expo-constants';

import { supabase } from '@/services/supabase';
import { useAuth } from '@/store/auth';

/**
 * Nome (slug) da Edge Function. Por padrão `ai-proxy`, mas o painel do Supabase às
 * vezes gera um slug aleatório ao criar a função (ex.: "hyper-task"). Nesses casos,
 * defina `extra.aiProxyFunction` no app.json com o slug real (o que aparece na URL
 * `/functions/v1/<slug>`).
 */
const FUNCTION_NAME =
  (Constants.expoConfig?.extra?.aiProxyFunction as string | undefined) || 'ai-proxy';

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

  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
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
    return `A IA grátis não foi encontrada no servidor (função “${FUNCTION_NAME}”). Confira se ela está publicada no Supabase e se o nome em app.json (extra.aiProxyFunction) bate com o slug da função (o que aparece na URL /functions/v1/…). Ou conecte sua própria chave em Integrações.`;
  }
  if (status === 401 || status === 403) {
    return 'Sem permissão para a IA grátis. Entre na sua conta de novo, ou use sua própria chave em Integrações.';
  }
  if (status && status >= 500) {
    return 'A IA grátis falhou no servidor agora. Tente de novo em instantes, ou use sua própria chave.';
  }
  if ((error as { name?: string }).name === 'FunctionsFetchError') {
    return 'Sem conexão com o servidor da IA grátis. Verifique a internet e tente de novo.';
  }
  return error instanceof Error ? error.message : 'Falha ao consultar a IA grátis.';
}
