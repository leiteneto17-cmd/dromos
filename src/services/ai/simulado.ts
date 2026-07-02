/**
 * Simulado estilo ENEM por IA — o "gerador de provas" do Cantinho do Estudo
 * ([[proximos-passos]] 2026-07-02: validação do posicionamento de estudo com
 * produto REAL, sem fake door). Gera 5 questões de múltipla escolha (A–E) sobre
 * uma OBRA literária — o modelo conhece os clássicos de domínio público, então
 * não precisamos enviar o texto do livro (barato, §5).
 *
 * Mesmo padrão do goal-coach: chave própria (BYOK) se houver; senão a IA
 * grátis/gerida via ai-proxy (precisa estar logado; consome a cota diária).
 * Foco em COMPREENSÃO/interpretação (§4.8 — gamificação saudável), não decoreba.
 */
import { managedAIAvailable, managedChatJSON } from '@/services/ai/managed';
import { chatJSON } from '@/services/ai/providers';
import { getApiKey, useAI } from '@/store/ai';

export type QuizQuestion = {
  pergunta: string;
  /** 5 alternativas, SEM a letra na frente (a UI põe A–E). */
  alternativas: string[];
  /** Índice (0–4) da alternativa correta. */
  correta: number;
  /** 1–2 frases justificando a resposta certa. */
  explicacao: string;
};

export type QuizResult =
  | { ok: true; questoes: QuizQuestion[] }
  | { ok: false; error: string; needsKey?: boolean };

const SYSTEM =
  'Você é um professor de literatura brasileira que elabora questões de múltipla escolha no ' +
  'ESTILO ENEM sobre obras literárias. Estilo ENEM: enunciado contextualizado (pode citar um ' +
  'trecho curto da obra), cobrando interpretação, características do movimento literário, ' +
  'narrador, personagens e temas — nunca memorização boba de detalhes. Distratores plausíveis. ' +
  'Responda APENAS com um objeto JSON válido, sem nenhum texto fora dele, com a chave exata ' +
  '"questoes": array de EXATAMENTE 5 objetos, cada um com: "pergunta" (string), "alternativas" ' +
  '(array de exatamente 5 strings, SEM letra na frente), "correta" (número de 0 a 4, índice da ' +
  'alternativa certa — varie a posição entre as questões) e "explicacao" (1 a 2 frases curtas ' +
  'justificando a resposta certa). Português do Brasil. Seja conciso para caber na resposta.';

/** Gera um simulado de 5 questões sobre a obra. */
export async function gerarSimulado(title: string, author: string): Promise<QuizResult> {
  const { provider, model, hasKey } = useAI.getState();
  const useManaged = !hasKey;
  if (useManaged && !managedAIAvailable()) {
    return {
      ok: false,
      error: 'Entre na sua conta para gerar o simulado, ou conecte sua própria chave em Integrações.',
      needsKey: true,
    };
  }

  const user = `Obra: "${title}", de ${author}. Gere o simulado sobre esta obra.`;
  try {
    // maxTokens no teto do proxy (2048): 5 questões + explicações são longas, e os
    // modelos Gemini 2.5 "pensam" antes do JSON (orçamento baixo → resposta vazia).
    let raw: string;
    if (hasKey) {
      const key = await getApiKey();
      if (!key) return { ok: false, error: 'Chave não encontrada. Reconfigure em Integrações.', needsKey: true };
      raw = await chatJSON({ provider, key, model, system: SYSTEM, user, maxTokens: 2048 });
    } else {
      raw = await managedChatJSON({ system: SYSTEM, user, maxTokens: 2048 });
    }
    const questoes = normalize(parseJSON(raw));
    if (!questoes || questoes.length < 3) {
      return { ok: false, error: 'A IA respondeu num formato inesperado. Tente gerar de novo.' };
    }
    return { ok: true, questoes };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Falha ao gerar o simulado.',
      needsKey: useManaged,
    };
  }
}

/** Valida/normaliza as questões cruas da IA (descarta as malformadas). */
function normalize(parsed: Record<string, unknown> | null): QuizQuestion[] | null {
  const raw = parsed && Array.isArray(parsed.questoes) ? (parsed.questoes as Record<string, unknown>[]) : null;
  if (!raw) return null;
  const out: QuizQuestion[] = [];
  for (const q of raw) {
    const pergunta = String(q?.pergunta ?? '').trim();
    const alternativas = Array.isArray(q?.alternativas)
      ? (q.alternativas as unknown[]).map((a) => String(a ?? '').trim()).filter(Boolean)
      : [];
    const correta = Math.round(Number(q?.correta));
    const explicacao = String(q?.explicacao ?? '').trim();
    if (!pergunta || alternativas.length !== 5) continue;
    if (!Number.isFinite(correta) || correta < 0 || correta > 4) continue;
    out.push({ pergunta, alternativas, correta, explicacao });
  }
  return out.slice(0, 5);
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
