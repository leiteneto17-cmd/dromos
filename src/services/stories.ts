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
  /** Já abri esta story? (anel cinza vs verde, estilo Instagram). Sempre true na minha. */
  seenByMe: boolean;
  /** "Visto por N" — preenchido só para a MINHA story (o autor vê quem viu). */
  views?: number;
  /** Conteúdo opcional que o autor anexou p/ o story não ficar vazio. */
  caption: string | null;
  sticker: string | null; // 1 emoji
  photoUrl: string | null; // fatia 2
  audioUrl: string | null; // fatia 3
};

/** Conteúdo anexável ao publicar um story (tudo opcional). */
export type StoryContent = {
  caption?: string | null;
  sticker?: string | null;
  photoUrl?: string | null;
  audioUrl?: string | null;
};

async function myId(): Promise<string | null> {
  if (!supabase) return null;
  return (await supabase.auth.getUser()).data.user?.id ?? null;
}

/** Tempo relativo curto estilo Instagram ("agora", "há 3h", "há 1d"). */
export function tempoAtras(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 0) return 'agora';
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

/** Publica a MINHA atividade de leitura mais recente como story (24h), com conteúdo opcional
 * (legenda/sticker/foto/áudio) para o story não ficar vazio. */
export async function publishLatestAsStory(content?: StoryContent): Promise<{ ok: boolean; error?: string }> {
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
  const patch: Record<string, unknown> = {
    shared_as_story_at: new Date().toISOString(),
    // Sobrescreve o conteúdo a cada publicação (null limpa o anterior).
    story_caption: content?.caption?.trim() || null,
    story_sticker: content?.sticker || null,
    story_photo_url: content?.photoUrl || null,
    story_audio_url: content?.audioUrl || null,
  };
  if (act.visibility === 'private') patch.visibility = 'friends';
  const { error } = await supabase.from('reading_activities').update(patch).eq('id', act.id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Prévia da minha leitura mais recente (para a tela de publicar mostrar o que vai virar story). */
export async function getLatestActivityPreview(): Promise<{ book_title: string; seconds: number; pages: number | null } | null> {
  if (!supabase) return null;
  const me = await myId();
  if (!me) return null;
  const { data } = await supabase
    .from('reading_activities')
    .select('book_title, seconds, pages')
    .eq('user_id', me)
    .order('created_at', { ascending: false })
    .limit(1);
  return (data as { book_title: string; seconds: number; pages: number | null }[] | null)?.[0] ?? null;
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
    .select(
      'id, user_id, book_title, seconds, pages, created_at, shared_as_story_at, story_caption, story_sticker, story_photo_url, story_audio_url',
    )
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
      story_caption: string | null;
      story_sticker: string | null;
      story_photo_url: string | null;
      story_audio_url: string | null;
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

  const actIds = unique.map((r) => r.id);

  // "Visto por mim?" (anel Insta): as MINHAS linhas em story_views entre essas stories.
  const seen = new Set<string>();
  const { data: vData } = await supabase
    .from('story_views')
    .select('activity_id')
    .eq('viewer_id', me)
    .in('activity_id', actIds);
  (vData as { activity_id: string }[] | null)?.forEach((v) => seen.add(v.activity_id));

  // "Visto por N" — só nas MINHAS stories (o autor vê a contagem via RPC security definer).
  const viewsByAct = new Map<string, number>();
  const myActIds = unique.filter((r) => r.user_id === me).map((r) => r.id);
  if (myActIds.length) {
    const { data: cData } = await supabase.rpc('story_view_counts', { p_ids: myActIds });
    (cData as { activity_id: string; n: number }[] | null)?.forEach((c) =>
      viewsByAct.set(c.activity_id, Number(c.n)),
    );
  }

  const out: Story[] = unique.map((r) => {
    const isMine = r.user_id === me;
    return {
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
      isMine,
      seenByMe: isMine ? true : seen.has(r.id),
      views: isMine ? viewsByAct.get(r.id) ?? 0 : undefined,
      caption: r.story_caption,
      sticker: r.story_sticker,
      photoUrl: r.story_photo_url,
      audioUrl: r.story_audio_url,
    };
  });
  // A minha bolha primeiro.
  out.sort((a, b) => (a.isMine === b.isMine ? 0 : a.isMine ? -1 : 1));
  return out;
}

/** Marca uma story como VISTA por mim (idempotente). No-op sem login. A RLS/insert já
 * garante que só registro a MINHA visualização e só de algo publicado como story. */
export async function markStorySeen(activityId: string): Promise<void> {
  if (!supabase) return;
  const me = await myId();
  if (!me) return;
  await supabase
    .from('story_views')
    .upsert({ activity_id: activityId, viewer_id: me }, { onConflict: 'activity_id,viewer_id' });
}
