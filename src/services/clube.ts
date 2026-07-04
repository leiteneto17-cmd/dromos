/**
 * CLUBE DO LIVRO GUIADO (social v2 — docs/FEATURES/SOCIAL/ROADMAP-CLUBE.md, G2).
 * Clube em torno de UM livro: cronograma por etapas (determinístico, calculado aqui)
 * + perguntas de discussão por etapa geradas por IA (anti-spoiler, cacheadas 1× no
 * banco via RPC `club_stage_set_questions` — §5: nunca regerar).
 *
 * Toda escrita de clube/membro passa pelos RPCs do schema (`club_create`/`club_join`);
 * leitura é SELECT direto — o RLS já garante "só membros veem" (sem descoberta pública
 * no MVP). Posts têm RLS próprio (membro posta; bloqueio esconde; dono modera).
 */
import { managedAIAvailable, managedChatJSON } from '@/services/ai/managed';
import { chatJSON } from '@/services/ai/providers';
import { supabase } from '@/services/supabase';
import { getApiKey, useAI } from '@/store/ai';

export type Clube = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  book_title: string;
  book_author: string | null;
  book_cover_url: string | null;
  book_file_url: string | null;
  invite_code: string;
  weeks: number;
  created_at: string;
};

export type ClubeStage = {
  club_id: string;
  stage_no: number;
  title: string;
  chapters: string | null;
  target_date: string | null;
  perguntas_json: string[] | null;
};

export type ClubeMember = { user_id: string; role: 'owner' | 'member'; name: string };

export type ClubePost = {
  id: string;
  club_id: string;
  stage_no: number | null;
  author_id: string;
  body: string;
  created_at: string;
  author_name: string;
};

/** Cronograma determinístico: N semanas → N etapas, alvo a cada 7 dias (sem IA — §5). */
export function montarCronograma(weeks: number): {
  stage_no: number;
  title: string;
  chapters: string;
  target_date: string;
}[] {
  const out = [];
  for (let i = 1; i <= weeks; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i * 7);
    out.push({
      stage_no: i,
      title: `Semana ${i}`,
      chapters: `Parte ${i} de ${weeks} do livro`,
      target_date: d.toISOString().slice(0, 10),
    });
  }
  return out;
}

export async function criarClube(input: {
  name: string;
  bookTitle: string;
  bookAuthor?: string | null;
  bookCoverUrl?: string | null;
  weeks: number;
}): Promise<{ clube?: Clube; error?: string }> {
  if (!supabase) return { error: 'Entre na sua conta para criar um clube.' };
  const { data, error } = await supabase.rpc('club_create', {
    p_name: input.name,
    p_book_title: input.bookTitle,
    p_book_author: input.bookAuthor ?? null,
    p_book_cover_url: input.bookCoverUrl ?? null,
    p_book_file_url: null,
    p_description: null,
    p_weeks: input.weeks,
    p_stages: montarCronograma(input.weeks),
  });
  if (error) return { error: error.message };
  // RPC devolve a linha do clube (objeto; algumas versões embrulham em array).
  const clube = (Array.isArray(data) ? data[0] : data) as Clube | undefined;
  return clube?.id ? { clube } : { error: 'Resposta inesperada ao criar o clube.' };
}

export async function entrarPorCodigo(code: string): Promise<{ clube?: Clube; error?: string }> {
  if (!supabase) return { error: 'Entre na sua conta para participar de um clube.' };
  const { data, error } = await supabase.rpc('club_join', { p_code: code.trim() });
  if (error)
    return { error: /inválido/i.test(error.message) ? 'Código de convite inválido.' : error.message };
  const clube = (Array.isArray(data) ? data[0] : data) as Clube | undefined;
  return clube?.id ? { clube } : { error: 'Resposta inesperada ao entrar no clube.' };
}

/** Meus clubes (RLS já filtra: só volta clube em que sou membro). */
export async function meusClubes(): Promise<Clube[]> {
  if (!supabase) return [];
  const { data } = await supabase.from('clubs').select('*').order('created_at', { ascending: false });
  return (data as Clube[] | null) ?? [];
}

export async function getClube(id: string): Promise<{
  clube: Clube | null;
  etapas: ClubeStage[];
  membros: ClubeMember[];
}> {
  if (!supabase) return { clube: null, etapas: [], membros: [] };
  const [c, s, m] = await Promise.all([
    supabase.from('clubs').select('*').eq('id', id).maybeSingle(),
    supabase.from('club_stages').select('*').eq('club_id', id).order('stage_no'),
    supabase.from('club_members').select('user_id, role').eq('club_id', id),
  ]);
  const membrosRaw = (m.data as { user_id: string; role: 'owner' | 'member' }[] | null) ?? [];
  const nomes = await nomesDe(membrosRaw.map((x) => x.user_id));
  return {
    clube: (c.data as Clube | null) ?? null,
    etapas: ((s.data as ClubeStage[] | null) ?? []).map(normalizeStage),
    membros: membrosRaw.map((x) => ({ ...x, name: nomes.get(x.user_id) ?? 'Leitor(a)' })),
  };
}

export async function getPosts(clubId: string): Promise<ClubePost[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from('club_posts')
    .select('*')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })
    .limit(100);
  const posts = (data as Omit<ClubePost, 'author_name'>[] | null) ?? [];
  const nomes = await nomesDe(posts.map((p) => p.author_id));
  return posts.map((p) => ({ ...p, author_name: nomes.get(p.author_id) ?? 'Leitor(a)' }));
}

export async function postar(
  clubId: string,
  stageNo: number | null,
  body: string,
): Promise<string | null> {
  if (!supabase) return 'Entre na sua conta.';
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return 'Entre na sua conta.';
  const { error } = await supabase
    .from('club_posts')
    .insert({ club_id: clubId, stage_no: stageNo, author_id: uid, body: body.trim() });
  return error ? error.message : null;
}

export async function apagarPost(id: string): Promise<string | null> {
  if (!supabase) return 'Entre na sua conta.';
  const { error } = await supabase.from('club_posts').delete().eq('id', id);
  return error ? error.message : null;
}

/** Nomes de perfil (RLS de profiles pode esconder alguns → fallback no chamador). */
async function nomesDe(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unicos = [...new Set(ids)].filter(Boolean);
  if (!supabase || unicos.length === 0) return map;
  const { data } = await supabase.from('profiles').select('id, name').in('id', unicos);
  for (const p of (data as { id: string; name: string | null }[] | null) ?? []) {
    if (p.name) map.set(p.id, p.name);
  }
  return map;
}

function normalizeStage(s: ClubeStage): ClubeStage {
  // perguntas_json chega como jsonb (array) — valida a forma p/ não quebrar a UI.
  const raw = s.perguntas_json as unknown;
  const ok = Array.isArray(raw) ? raw.map((x) => String(x)).filter(Boolean) : null;
  return { ...s, perguntas_json: ok && ok.length ? ok : null };
}

// ---------------------------------------------------------------------------
// Perguntas de discussão por IA (mesmo padrão BYOK → gerida do simulado.ts).
// Anti-spoiler é critério de pronto (R3 do plano): o prompt limita a etapa.
// ---------------------------------------------------------------------------
const SYSTEM =
  'Você é o mediador de um clube do livro brasileiro, caloroso e provocador de boas conversas. ' +
  'Gere perguntas de DISCUSSÃO (abertas, sem resposta certa) sobre o trecho indicado da obra. ' +
  'REGRA ANTI-SPOILER ABSOLUTA: as perguntas só podem tocar em eventos até o fim do trecho ' +
  'indicado — nunca insinue, anteceipe ou pergunte sobre o que vem depois. ' +
  'Responda APENAS com JSON válido: {"perguntas": [array de exatamente 3 strings em português ' +
  'do Brasil, cada uma com no máximo 200 caracteres]}.';

export async function gerarPerguntasEtapa(
  clube: Clube,
  etapa: ClubeStage,
): Promise<{ perguntas?: string[]; error?: string; needsKey?: boolean }> {
  const { provider, model, hasKey } = useAI.getState();
  if (!hasKey && !managedAIAvailable())
    return {
      error: 'Entre na sua conta para gerar as perguntas, ou conecte sua chave em Integrações.',
      needsKey: true,
    };

  const pct0 = Math.round(((etapa.stage_no - 1) / clube.weeks) * 100);
  const pct1 = Math.round((etapa.stage_no / clube.weeks) * 100);
  const user =
    `Obra: "${clube.book_title}"${clube.book_author ? `, de ${clube.book_author}` : ''}. ` +
    `Clube de ${clube.weeks} semanas; etapa ${etapa.stage_no} de ${clube.weeks} ` +
    `(${etapa.chapters ?? `de ~${pct0}% a ~${pct1}% da obra`}). Gere as 3 perguntas desta etapa.`;

  try {
    let raw: string;
    if (hasKey) {
      const key = await getApiKey();
      if (!key) return { error: 'Chave não encontrada. Reconfigure em Integrações.', needsKey: true };
      raw = await chatJSON({ provider, key, model, system: SYSTEM, user, maxTokens: 1024 });
    } else {
      raw = await managedChatJSON({ system: SYSTEM, user, maxTokens: 1024 });
    }
    const parsed = parseJSON(raw);
    const perguntas = Array.isArray(parsed?.perguntas)
      ? (parsed.perguntas as unknown[]).map((p) => String(p).trim()).filter(Boolean).slice(0, 3)
      : null;
    if (!perguntas || perguntas.length === 0)
      return { error: 'A IA respondeu num formato inesperado. Tente de novo.' };

    // Cacheia no banco (só grava se ainda NULL — quem chegou primeiro pagou a geração).
    if (supabase) {
      await supabase.rpc('club_stage_set_questions', {
        p_club: clube.id,
        p_stage: etapa.stage_no,
        p_questions: perguntas,
      });
    }
    return { perguntas };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Falha ao gerar as perguntas.' };
  }
}

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
