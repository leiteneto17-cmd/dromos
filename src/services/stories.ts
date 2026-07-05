/**
 * STORIES da Comunidade (docs/FEATURES/SOCIAL/DESIGN-STORIES.md).
 * Publicar uma leitura como story é OPT-IN e efêmero (24h). As bolhas mostram quem publicou
 * nas últimas 24h (eu + quem sigo). A visibilidade de leitura é filtrada pela RLS que já existe.
 */
import { supabase } from '@/services/supabase';

const DAY_MS = 24 * 60 * 60 * 1000;

export type Story = {
  activity_id: string;
  user_id: string;
  name: string;
  avatar: string | null;
  founder: boolean;
  book_title: string;
  seconds: number;
  pages: number | null;
  created_at: string;
  shared_at: string;
  isMine: boolean;
};

async function myId(): Promise<string | null> {
  if (!supabase) return null;
  return (await supabase.auth.getUser()).data.user?.id ?? null;
}

/** Publica a MINHA atividade de leitura mais recente como story (24h). */
export async function publishLatestAsStory(): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Entre na sua conta.' };
  const me = await myId();
  if (!me) return { ok: false, error: 'Entre na sua conta.' };
  const { data } = await supabase
    .from('reading_activities')
    .select('id, visibility')
    .eq('user_id', me)
    .order('created_at', { ascending: false })
    .limit(1);
  const act = (data as { id: string; visibility: string }[] | null)?.[0];
  if (!act) return { ok: false, error: 'Você ainda não tem uma leitura para publicar. Leia um pouco primeiro 📖' };
  // Story precisa ser visível a seguidores; se estiver 'private', sobe para 'friends' ao publicar.
  const patch: Record<string, unknown> = { shared_as_story_at: new Date().toISOString() };
  if (act.visibility === 'private') patch.visibility = 'friends';
  const { error } = await supabase.from('reading_activities').update(patch).eq('id', act.id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Bolhas de story: a minha (se publiquei) + de quem sigo, últimas 24h, 1 por pessoa (a mais nova). */
export async function getStories(): Promise<Story[]> {
  if (!supabase) return [];
  const me = await myId();
  if (!me) return [];
  const since = new Date(Date.now() - DAY_MS).toISOString();

  // A RLS já limita ao que EU posso ver (minhas + de quem sigo, não-privadas). Só filtro 24h.
  const { data } = await supabase
    .from('reading_activities')
    .select('id, user_id, book_title, seconds, pages, created_at, shared_as_story_at')
    .not('shared_as_story_at', 'is', null)
    .gte('shared_as_story_at', since)
    .order('shared_as_story_at', { ascending: false })
    .limit(100);
  const rows =
    (data as {
      id: string;
      user_id: string;
      book_title: string;
      seconds: number;
      pages: number | null;
      created_at: string;
      shared_as_story_at: string;
    }[] | null) ?? [];
  if (rows.length === 0) return [];

  // 1 story por pessoa (a mais recente já vem primeiro pela ordenação).
  const perUser = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!perUser.has(r.user_id)) perUser.set(r.user_id, r);
  const unique = [...perUser.values()];

  // Perfis (nome/avatar/fundador).
  const ids = unique.map((r) => r.user_id);
  const profs = new Map<string, { name: string | null; avatar: string | null; founder: boolean }>();
  const { data: pData } = await supabase
    .from('profiles')
    .select('id, name, avatar_url, is_founder, founder_flair')
    .in('id', ids);
  (pData as { id: string; name: string | null; avatar_url: string | null; is_founder: boolean; founder_flair: boolean }[] | null)?.forEach(
    (p) => profs.set(p.id, { name: p.name, avatar: p.avatar_url, founder: !!p.is_founder && p.founder_flair !== false }),
  );

  const out: Story[] = unique.map((r) => ({
    activity_id: r.id,
    user_id: r.user_id,
    name: profs.get(r.user_id)?.name?.trim() || 'Leitor(a)',
    avatar: profs.get(r.user_id)?.avatar ?? null,
    founder: profs.get(r.user_id)?.founder ?? false,
    book_title: r.book_title,
    seconds: r.seconds,
    pages: r.pages,
    created_at: r.created_at,
    shared_at: r.shared_as_story_at,
    isMine: r.user_id === me,
  }));
  // A minha bolha primeiro.
  out.sort((a, b) => (a.isMine === b.isMine ? 0 : a.isMine ? -1 : 1));
  return out;
}
