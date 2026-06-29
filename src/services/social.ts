/**
 * Camada social ABERTA (opt-in) — follows + feed estilo Strava (§2.6/§4.8).
 * Princípio: privado por padrão; só quem tornou o perfil público aparece para os outros
 * (perfil visível, estante visível, atividades no feed de quem o segue).
 *
 * Schema/RLS: supabase/schema.sql. Reusa profiles/book_shelves/book_reviews/reading_activities.
 */
import { supabase } from '@/services/supabase';
import type { BookReview, ShelfItem } from '@/services/community';

export type PublicProfile = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  is_public: boolean;
  /** Emblemas (conquistas) desbloqueados — ids; default [] p/ perfis antigos sem a coluna. */
  badges: string[];
  /** Brasão de fundador (um dos 50 primeiros cadastrados). */
  is_founder: boolean;
  /** Fundador escolheu exibir os realces (anel/linha/nome verde/selo). */
  founder_flair: boolean;
};

export type FeedItem = {
  id: string;
  user_id: string;
  author_name: string;
  author_avatar: string | null;
  book_title: string;
  seconds: number;
  pages: number | null;
  created_at: string;
  kudos: number;
  iKudoed: boolean;
  /** Autor é fundador COM realce ligado → nome em verde no feed. */
  author_founder: boolean;
};

async function uid(): Promise<string | null> {
  if (!supabase) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user.id ?? null;
}

/**
 * Busca leitores por nome para seguir (aba Comunidade). Só retorna perfis PÚBLICOS
 * (§4.8: privado por padrão não aparece em buscas) e nunca você mesmo.
 */
export async function searchUsers(query: string): Promise<PublicProfile[]> {
  if (!supabase) return [];
  const q = query.trim();
  if (q.length < 2) return [];
  const me = await uid();
  // ilike = case-insensitive; escapamos % e _ para não virarem curingas.
  const safe = q.replace(/[%_]/g, '\\$&');
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, avatar_url, is_public, badges, is_founder, founder_flair')
    .eq('is_public', true)
    .ilike('name', `%${safe}%`)
    .limit(20);
  if (error || !data) return [];
  return (data as PublicProfile[])
    .filter((p) => p.id !== me && (p.name ?? '').trim().length > 0)
    .map((p) => ({
      ...p,
      badges: Array.isArray(p.badges) ? p.badges : [],
      is_founder: !!p.is_founder,
      founder_flair: p.founder_flair !== false,
    }));
}

/** Dados públicos de um perfil (qualquer autenticado pode ler profiles). */
export async function getUserProfile(userId: string): Promise<PublicProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, avatar_url, is_public, badges, is_founder, founder_flair')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  const p = data as PublicProfile;
  return {
    ...p,
    badges: Array.isArray(p.badges) ? p.badges : [],
    is_founder: !!p.is_founder,
    founder_flair: p.founder_flair !== false, // default true (perfis antigos sem a coluna)
  };
}

/** Estante de outra pessoa (a RLS só devolve se o perfil for público — ou se for a minha). */
export async function getUserShelf(userId: string): Promise<ShelfItem[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('book_shelves')
    .select('book_key, status, book_title, book_author, cover_url, isbn, collection_id')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error || !data) return [];
  return data as ShelfItem[];
}

/** Resenhas de outra pessoa (RLS pública, menos bloqueados). */
export async function getUserReviews(userId: string): Promise<BookReview[]> {
  if (!supabase) return [];
  const me = await uid();
  const { data, error } = await supabase
    .from('book_reviews')
    .select('id, user_id, rating, text, created_at, book_title')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return (
    data as { id: string; user_id: string; rating: number; text: string | null; created_at: string; book_title: string }[]
  ).map((r) => ({
    id: r.id,
    user_id: r.user_id,
    rating: r.rating,
    text: r.text,
    created_at: r.created_at,
    author_name: '',
    author_avatar: null,
    is_mine: r.user_id === me,
    book_title: r.book_title,
  }));
}

/** Seguidores / seguindo de um usuário. */
export async function getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  if (!supabase) return { followers: 0, following: 0 };
  const { data, error } = await supabase.rpc('follow_counts', { p_user: userId });
  const row = (data as { followers: number; following: number }[] | null)?.[0];
  if (error || !row) return { followers: 0, following: 0 };
  return { followers: Number(row.followers), following: Number(row.following) };
}

export type FollowListItem = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  is_founder: boolean;
  founder_flair: boolean;
};

/**
 * Lista de SEGUIDORES (mode='followers') ou de QUEM o usuário segue (mode='following').
 * Só vínculos ACEITOS (combina com os contadores). A RLS de `follows` permite leitura a
 * qualquer autenticado, então vale tanto p/ o meu perfil quanto p/ o de outros.
 */
export async function getFollowList(
  userId: string,
  mode: 'followers' | 'following',
): Promise<FollowListItem[]> {
  if (!supabase) return [];
  const matchCol = mode === 'followers' ? 'followee_id' : 'follower_id';
  const pickCol = mode === 'followers' ? 'follower_id' : 'followee_id';
  const { data, error } = await supabase
    .from('follows')
    .select(pickCol)
    .eq(matchCol, userId)
    .eq('status', 'accepted');
  if (error || !data) return [];
  const ids = (data as Record<string, string>[]).map((r) => r[pickCol]).filter(Boolean);
  if (ids.length === 0) return [];
  const { data: profs } = await supabase
    .from('profiles')
    .select('id, name, avatar_url, is_founder, founder_flair')
    .in('id', ids);
  const rows =
    (profs as
      | { id: string; name: string | null; avatar_url: string | null; is_founder: boolean; founder_flair: boolean }[]
      | null) ?? [];
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    avatar_url: p.avatar_url,
    is_founder: !!p.is_founder,
    founder_flair: p.founder_flair !== false,
  }));
}

export type FollowState = 'none' | 'pending' | 'accepted';

export type FollowRequest = { follower_id: string; name: string | null; avatar_url: string | null };

/** Meu estado em relação a este usuário: não sigo / pedido pendente / seguindo. */
export async function getFollowState(userId: string): Promise<FollowState> {
  if (!supabase) return 'none';
  const me = await uid();
  if (!me) return 'none';
  const { data } = await supabase
    .from('follows')
    .select('status')
    .eq('follower_id', me)
    .eq('followee_id', userId)
    .maybeSingle();
  if (!data) return 'none';
  return (data as { status: FollowState }).status;
}

/** Seguir (público = aceito na hora; privado = vira pedido). O status é definido pelo
 * trigger no banco. Retorna null em sucesso ou a mensagem de erro. */
export async function followUser(userId: string): Promise<string | null> {
  if (!supabase) return 'Backend não configurado (Supabase).';
  const me = await uid();
  if (!me) return 'Entre na sua conta.';
  if (me === userId) return 'Você não pode seguir a si mesmo.';
  const { error } = await supabase.from('follows').insert({ follower_id: me, followee_id: userId });
  return error ? error.message : null;
}

/** Deixar de seguir / cancelar pedido. */
export async function unfollowUser(userId: string): Promise<string | null> {
  if (!supabase) return 'Backend não configurado (Supabase).';
  const me = await uid();
  if (!me) return 'Entre na sua conta.';
  const { error } = await supabase.from('follows').delete().eq('follower_id', me).eq('followee_id', userId);
  return error ? error.message : null;
}

/** Pedidos de seguir PENDENTES direcionados a mim (perfil privado). */
export async function getFollowRequests(): Promise<FollowRequest[]> {
  if (!supabase) return [];
  const me = await uid();
  if (!me) return [];
  const { data } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('followee_id', me)
    .eq('status', 'pending');
  const ids = (data as { follower_id: string }[] | null)?.map((r) => r.follower_id) ?? [];
  if (ids.length === 0) return [];
  const { data: profs } = await supabase.from('profiles').select('id, name, avatar_url').in('id', ids);
  const map = new Map(
    (profs as { id: string; name: string | null; avatar_url: string | null }[] | null)?.map((p) => [p.id, p]) ?? [],
  );
  return ids.map((id) => ({ follower_id: id, name: map.get(id)?.name ?? null, avatar_url: map.get(id)?.avatar_url ?? null }));
}

/** Aprovar um pedido de seguir (status → accepted). */
export async function approveRequest(followerId: string): Promise<string | null> {
  if (!supabase) return 'Backend não configurado (Supabase).';
  const me = await uid();
  if (!me) return 'Entre na sua conta.';
  const { error } = await supabase
    .from('follows')
    .update({ status: 'accepted' })
    .eq('follower_id', followerId)
    .eq('followee_id', me);
  return error ? error.message : null;
}

/** Recusar/remover um seguidor (apaga a linha). */
export async function rejectRequest(followerId: string): Promise<string | null> {
  if (!supabase) return 'Backend não configurado (Supabase).';
  const me = await uid();
  if (!me) return 'Entre na sua conta.';
  const { error } = await supabase.from('follows').delete().eq('follower_id', followerId).eq('followee_id', me);
  return error ? error.message : null;
}

/** Feed: leituras recentes (públicas) de quem eu sigo. */
export async function getFeed(limit = 30): Promise<FeedItem[]> {
  if (!supabase) return [];
  const me = await uid();
  if (!me) return [];
  // Quem eu sigo (aceito)
  const { data: fData } = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', me)
    .eq('status', 'accepted');
  const ids = (fData as { followee_id: string }[] | null)?.map((f) => f.followee_id) ?? [];
  if (ids.length === 0) return [];

  // Atividades deles (a RLS já garante: só públicas e de quem eu sigo)
  const { data, error } = await supabase
    .from('reading_activities')
    .select('id, user_id, book_title, seconds, pages, created_at')
    .in('user_id', ids)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  const rows = data as { id: string; user_id: string; book_title: string; seconds: number; pages: number | null; created_at: string }[];

  // Nome/avatar dos autores
  const authorIds = [...new Set(rows.map((r) => r.user_id))];
  const profs = new Map<string, { name: string | null; avatar: string | null; founder: boolean }>();
  if (authorIds.length) {
    const { data: pData } = await supabase
      .from('profiles')
      .select('id, name, avatar_url, is_founder, founder_flair')
      .in('id', authorIds);
    (pData as { id: string; name: string | null; avatar_url: string | null; is_founder: boolean; founder_flair: boolean }[] | null)?.forEach((p) =>
      profs.set(p.id, { name: p.name, avatar: p.avatar_url, founder: !!p.is_founder && p.founder_flair !== false }),
    );
  }

  // Kudos das atividades visíveis (contagem + se EU curti)
  const actIds = rows.map((r) => r.id);
  const kudosCount = new Map<string, number>();
  const myKudos = new Set<string>();
  if (actIds.length) {
    const { data: kData } = await supabase.from('activity_kudos').select('activity_id, user_id').in('activity_id', actIds);
    (kData as { activity_id: string; user_id: string }[] | null)?.forEach((k) => {
      kudosCount.set(k.activity_id, (kudosCount.get(k.activity_id) ?? 0) + 1);
      if (k.user_id === me) myKudos.add(k.activity_id);
    });
  }

  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    author_name: profs.get(r.user_id)?.name?.trim() || 'Leitor',
    author_avatar: profs.get(r.user_id)?.avatar ?? null,
    book_title: r.book_title,
    seconds: r.seconds,
    pages: r.pages,
    created_at: r.created_at,
    kudos: kudosCount.get(r.id) ?? 0,
    iKudoed: myKudos.has(r.id),
    author_founder: profs.get(r.user_id)?.founder ?? false,
  }));
}

/** Curtir / descurtir uma atividade do feed. Retorna null em sucesso ou a mensagem de erro. */
export async function toggleKudo(activityId: string, on: boolean): Promise<string | null> {
  if (!supabase) return 'Backend não configurado (Supabase).';
  const me = await uid();
  if (!me) return 'Entre na sua conta.';
  if (on) {
    const { error } = await supabase
      .from('activity_kudos')
      .upsert({ activity_id: activityId, user_id: me }, { onConflict: 'activity_id,user_id' });
    return error ? error.message : null;
  }
  const { error } = await supabase.from('activity_kudos').delete().eq('activity_id', activityId).eq('user_id', me);
  return error ? error.message : null;
}

// ---------- SCRAPS / RECADOS (mural no perfil, público ou privado) ----------

export type Scrap = {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  body: string;
  is_public: boolean;
  created_at: string;
  is_mine: boolean; // sou o AUTOR do recado
  /** Autor é fundador COM realce ligado → nome em verde no mural. */
  author_founder: boolean;
};

/** Recados do mural de `recipientId` (a RLS já decide o que aparece). Junta nome/avatar do autor. */
export async function getScraps(recipientId: string): Promise<Scrap[]> {
  if (!supabase) return [];
  const me = await uid();
  const { data, error } = await supabase
    .from('scraps')
    .select('id, author_id, body, is_public, created_at')
    .eq('recipient_id', recipientId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  const rows = data as { id: string; author_id: string; body: string; is_public: boolean; created_at: string }[];

  const ids = [...new Set(rows.map((r) => r.author_id))];
  const profs = new Map<string, { name: string | null; avatar: string | null; founder: boolean }>();
  if (ids.length) {
    const { data: pData } = await supabase
      .from('profiles')
      .select('id, name, avatar_url, is_founder, founder_flair')
      .in('id', ids);
    (pData as { id: string; name: string | null; avatar_url: string | null; is_founder: boolean; founder_flair: boolean }[] | null)?.forEach((p) =>
      profs.set(p.id, { name: p.name, avatar: p.avatar_url, founder: !!p.is_founder && p.founder_flair !== false }),
    );
  }
  return rows.map((r) => ({
    id: r.id,
    author_id: r.author_id,
    author_name: profs.get(r.author_id)?.name?.trim() || 'Leitor',
    author_avatar: profs.get(r.author_id)?.avatar ?? null,
    author_founder: profs.get(r.author_id)?.founder ?? false,
    body: r.body,
    is_public: r.is_public,
    created_at: r.created_at,
    is_mine: r.author_id === me,
  }));
}

/** Posso mandar recado para este perfil? (público; OU ele me segue aceito; OU eu o sigo aceito). */
export async function canSendScrap(recipientId: string): Promise<boolean> {
  if (!supabase) return false;
  const me = await uid();
  if (!me || me === recipientId) return false;
  const { data: prof } = await supabase.from('profiles').select('is_public').eq('id', recipientId).maybeSingle();
  if ((prof as { is_public: boolean } | null)?.is_public) return true;
  // perfil privado: ele me segue (aceito) OU eu o sigo (aceito)
  const { data: a } = await supabase
    .from('follows')
    .select('status')
    .eq('follower_id', recipientId)
    .eq('followee_id', me)
    .eq('status', 'accepted')
    .maybeSingle();
  if (a) return true;
  const { data: b } = await supabase
    .from('follows')
    .select('status')
    .eq('follower_id', me)
    .eq('followee_id', recipientId)
    .eq('status', 'accepted')
    .maybeSingle();
  return !!b;
}

/** Envia um recado. (Filtro de palavrão é feito na UI antes.) Retorna null ok / msg de erro. */
export async function sendScrap(input: {
  recipientId: string;
  body: string;
  isPublic: boolean;
}): Promise<string | null> {
  if (!supabase) return 'Backend não configurado (Supabase).';
  const me = await uid();
  if (!me) return 'Entre na sua conta.';
  const body = input.body.trim();
  if (!body) return 'Escreva algo.';
  const { error } = await supabase
    .from('scraps')
    .insert({ author_id: me, recipient_id: input.recipientId, body, is_public: input.isPublic });
  if (error) {
    if (/row-level security|violates|policy/i.test(error.message)) {
      return 'Você não pode mandar recado para este perfil (privado, só de quem ele segue ou aprovou).';
    }
    return error.message;
  }
  return null;
}

/** Apaga um recado (autor ou dono do mural). */
export async function deleteScrap(id: string): Promise<string | null> {
  if (!supabase) return 'Backend não configurado (Supabase).';
  const me = await uid();
  if (!me) return 'Entre na sua conta.';
  const { error } = await supabase.from('scraps').delete().eq('id', id);
  return error ? error.message : null;
}
