/**
 * Comunidade por LIVRO (Fase 5b), estilo Skoob. Em vez de "seguir", cada livro entra na
 * ESTANTE do usuário com um status: lendo / quero ler / lido / relendo / abandonei.
 *
 * Identidade do livro = `book_key` = título NORMALIZADO (minúsculo, sem acento, trim) —
 * casa o "mesmo livro" entre usuários (edições diferentes ainda agrupam). ISBN guardado à
 * parte. Metadados (capa/autor) denormalizados na linha p/ exibir sem nova busca.
 *
 * Privacidade (§4.8): cada um só lê a PRÓPRIA estante (RLS). As contagens vêm de funções
 * SECURITY DEFINER que só devolvem números — nunca quem leu o quê. Precisa de login.
 */
import { supabase } from '@/services/supabase';

export const SHELF_STATUSES = ['lendo', 'quero_ler', 'lido', 'relendo', 'abandonei'] as const;
export type ShelfStatus = (typeof SHELF_STATUSES)[number];

export const SHELF_LABEL: Record<ShelfStatus, string> = {
  lendo: 'Lendo',
  quero_ler: 'Quero ler',
  lido: 'Lido',
  relendo: 'Relendo',
  abandonei: 'Abandonei',
};

export type ShelfItem = {
  book_key: string;
  status: ShelfStatus;
  book_title: string;
  book_author: string | null;
  cover_url: string | null;
  isbn: string | null;
  collection_id: string | null;
};

export type Collection = { id: string; name: string };

export type PopularBook = {
  book_key: string;
  book_title: string;
  cover_url: string | null;
  reader_count: number;
};

/** Chave canônica do livro a partir do título (minúsculo, sem acento, trim). */
export function bookKeyOf(title: string): string {
  return (title ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove os acentos (diacríticos combinantes)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

async function uid(): Promise<string | null> {
  if (!supabase) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user.id ?? null;
}

/** A estante DESTE usuário (todos os status). */
export async function getMyShelf(): Promise<ShelfItem[]> {
  if (!supabase) return [];
  const userId = await uid();
  if (!userId) return [];
  const { data, error } = await supabase
    .from('book_shelves')
    .select('book_key, status, book_title, book_author, cover_url, isbn, collection_id')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error || !data) return [];
  return data as ShelfItem[];
}

// ---------- Coleções (grupos personalizados da estante) ----------

/** As coleções deste usuário (ordem alfabética). */
export async function getCollections(): Promise<Collection[]> {
  if (!supabase) return [];
  const userId = await uid();
  if (!userId) return [];
  const { data, error } = await supabase
    .from('shelf_collections')
    .select('id, name')
    .eq('user_id', userId)
    .order('name', { ascending: true });
  if (error || !data) return [];
  return data as Collection[];
}

/** Cria uma coleção. Retorna null em sucesso ou a mensagem de erro (ex.: nome repetido). */
export async function createCollection(name: string): Promise<string | null> {
  if (!supabase) return 'Backend não configurado (Supabase).';
  const userId = await uid();
  if (!userId) return 'Entre na sua conta.';
  const clean = name.trim();
  if (!clean) return 'Dê um nome à coleção.';
  const { error } = await supabase.from('shelf_collections').insert({ user_id: userId, name: clean });
  if (error) return /duplicate|unique/i.test(error.message) ? 'Você já tem uma coleção com esse nome.' : error.message;
  return null;
}

/** Apaga uma coleção (os livros dela voltam p/ "sem coleção" via on delete set null). */
export async function deleteCollection(id: string): Promise<string | null> {
  if (!supabase) return 'Backend não configurado (Supabase).';
  const userId = await uid();
  if (!userId) return 'Entre na sua conta.';
  const { error } = await supabase.from('shelf_collections').delete().eq('id', id).eq('user_id', userId);
  return error ? error.message : null;
}

/** Coloca/tira um livro da estante numa coleção (collectionId null = sem coleção). */
export async function setBookCollection(bookKey: string, collectionId: string | null): Promise<string | null> {
  if (!supabase) return 'Backend não configurado (Supabase).';
  const userId = await uid();
  if (!userId) return 'Entre na sua conta.';
  const { error } = await supabase
    .from('book_shelves')
    .update({ collection_id: collectionId })
    .eq('user_id', userId)
    .eq('book_key', bookKey);
  return error ? error.message : null;
}

/** O status DESTE livro na minha estante (ou null se não está). P/ a página do livro (C2). */
export async function getShelfStatusFor(bookKey: string): Promise<ShelfStatus | null> {
  if (!supabase) return null;
  const userId = await uid();
  if (!userId) return null;
  const { data, error } = await supabase
    .from('book_shelves')
    .select('status')
    .eq('user_id', userId)
    .eq('book_key', bookKey)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { status: ShelfStatus }).status;
}

/**
 * Põe/atualiza um livro na estante com um status (1 linha por livro).
 * Retorna `null` em sucesso ou uma MENSAGEM de erro (p/ a UI mostrar — ex.: tabela
 * `book_shelves` ainda não existe = falta rodar o schema.sql).
 */
export async function setShelf(input: {
  title: string;
  author?: string | null;
  coverUrl?: string | null;
  isbn?: string | null;
  status: ShelfStatus;
}): Promise<string | null> {
  if (!supabase) return 'Backend não configurado (Supabase).';
  const userId = await uid();
  if (!userId) return 'Entre na sua conta para usar a estante.';
  const key = bookKeyOf(input.title);
  if (!key) return 'Livro sem título.';
  const { error } = await supabase.from('book_shelves').upsert(
    {
      user_id: userId,
      book_key: key,
      status: input.status,
      book_title: input.title.trim(),
      book_author: input.author ?? null,
      cover_url: input.coverUrl ?? null,
      isbn: input.isbn ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,book_key' },
  );
  return error ? error.message : null;
}

/** Tira um livro da estante. Retorna `null` em sucesso ou a mensagem de erro. */
export async function removeShelf(bookKey: string): Promise<string | null> {
  if (!supabase) return 'Backend não configurado (Supabase).';
  const userId = await uid();
  if (!userId) return 'Entre na sua conta para usar a estante.';
  const { error } = await supabase.from('book_shelves').delete().eq('user_id', userId).eq('book_key', bookKey);
  return error ? error.message : null;
}

/** Livros com mais leitores na comunidade (agregado). */
export async function getPopularBooks(limit = 30): Promise<PopularBook[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('popular_books', { p_limit: limit });
  if (error || !data) return [];
  return (data as { book_key: string; book_title: string; cover_url: string | null; reader_count: number }[]).map(
    (r) => ({
      book_key: r.book_key,
      book_title: r.book_title,
      cover_url: r.cover_url,
      reader_count: Number(r.reader_count),
    }),
  );
}

/** Contagem por status de um livro (p/ a página do livro — C2). */
export async function getBookStatusCounts(bookKey: string): Promise<Record<ShelfStatus, number>> {
  const empty = { lendo: 0, quero_ler: 0, lido: 0, relendo: 0, abandonei: 0 } as Record<ShelfStatus, number>;
  if (!supabase) return empty;
  const { data, error } = await supabase.rpc('book_status_counts', { p_book_key: bookKey });
  if (error || !data) return empty;
  for (const r of data as { status: ShelfStatus; n: number }[]) {
    if (r.status in empty) empty[r.status] = Number(r.n);
  }
  return empty;
}

export type PublicReader = {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  status: ShelfStatus;
};

/** Leitores PÚBLICOS de um livro (os privados ficam só na contagem agregada — §4.8). */
export async function getPublicReaders(bookKey: string): Promise<PublicReader[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('public_readers', { p_book_key: bookKey });
  if (error || !data) return [];
  return (data as PublicReader[]).filter((r) => SHELF_STATUSES.includes(r.status));
}

// =====================================================================
// C3 — RESENHAS + MODERAÇÃO (denúncia/bloqueio/filtro §4.8). Schema: supabase/schema.sql.
// =====================================================================

export type BookReview = {
  id: string;
  user_id: string;
  rating: number;
  text: string | null;
  created_at: string;
  author_name: string;
  author_avatar: string | null;
  is_mine: boolean;
  /** Título do livro — preenchido na tela de PERFIL (resenhas de vários livros). */
  book_title?: string;
};

/** Média + nº de resenhas de um livro (só números — §4.8). */
export async function getBookRating(bookKey: string): Promise<{ avg: number; n: number }> {
  if (!supabase) return { avg: 0, n: 0 };
  const { data, error } = await supabase.rpc('book_rating', { p_book_key: bookKey });
  const row = (data as { avg_rating: number | null; n: number }[] | null)?.[0];
  if (error || !row) return { avg: 0, n: 0 };
  return { avg: Number(row.avg_rating ?? 0), n: Number(row.n ?? 0) };
}

/** Resenhas de um livro (a RLS já esconde quem se bloqueou). Junta nome/avatar do autor. */
export async function getReviews(bookKey: string): Promise<BookReview[]> {
  if (!supabase) return [];
  const me = await uid();
  const { data, error } = await supabase
    .from('book_reviews')
    .select('id, user_id, rating, text, created_at')
    .eq('book_key', bookKey)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  const rows = data as { id: string; user_id: string; rating: number; text: string | null; created_at: string }[];

  const ids = [...new Set(rows.map((r) => r.user_id))];
  const profs = new Map<string, { name: string | null; avatar: string | null }>();
  if (ids.length) {
    const { data: pData } = await supabase.from('profiles').select('id, name, avatar_url').in('id', ids);
    (pData as { id: string; name: string | null; avatar_url: string | null }[] | null)?.forEach((p) =>
      profs.set(p.id, { name: p.name, avatar: p.avatar_url }),
    );
  }
  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    rating: r.rating,
    text: r.text,
    created_at: r.created_at,
    author_name: profs.get(r.user_id)?.name?.trim() || 'Leitor',
    author_avatar: profs.get(r.user_id)?.avatar ?? null,
    is_mine: r.user_id === me,
  }));
}

/** Minhas notas por livro (book_key → rating 1–5) p/ exibir na estante. */
export async function getMyRatings(): Promise<Record<string, number>> {
  if (!supabase) return {};
  const userId = await uid();
  if (!userId) return {};
  const { data, error } = await supabase.from('book_reviews').select('book_key, rating').eq('user_id', userId);
  if (error || !data) return {};
  const map: Record<string, number> = {};
  (data as { book_key: string; rating: number }[]).forEach((r) => {
    map[r.book_key] = r.rating;
  });
  return map;
}

/** Minha resenha deste livro (p/ preencher o editor), ou null. */
export async function getMyReview(bookKey: string): Promise<{ rating: number; text: string } | null> {
  if (!supabase) return null;
  const userId = await uid();
  if (!userId) return null;
  const { data, error } = await supabase
    .from('book_reviews')
    .select('rating, text')
    .eq('user_id', userId)
    .eq('book_key', bookKey)
    .maybeSingle();
  if (error || !data) return null;
  const r = data as { rating: number; text: string | null };
  return { rating: r.rating, text: r.text ?? '' };
}

/** Cria/atualiza minha resenha (1 por livro). Retorna null em sucesso ou a msg de erro. */
export async function upsertReview(input: {
  title: string;
  rating: number;
  text: string;
}): Promise<string | null> {
  if (!supabase) return 'Backend não configurado (Supabase).';
  const userId = await uid();
  if (!userId) return 'Entre na sua conta para avaliar.';
  const key = bookKeyOf(input.title);
  if (!key) return 'Livro sem título.';
  const { error } = await supabase.from('book_reviews').upsert(
    {
      user_id: userId,
      book_key: key,
      book_title: input.title.trim(),
      rating: input.rating,
      text: input.text.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,book_key' },
  );
  return error ? error.message : null;
}

/** Apaga minha resenha do livro. */
export async function deleteReview(bookKey: string): Promise<string | null> {
  if (!supabase) return 'Backend não configurado (Supabase).';
  const userId = await uid();
  if (!userId) return 'Entre na sua conta.';
  const { error } = await supabase.from('book_reviews').delete().eq('user_id', userId).eq('book_key', bookKey);
  return error ? error.message : null;
}

/** Bloqueia um usuário (esconde as resenhas dele de mim e as minhas dele). */
export async function blockUser(blockedId: string): Promise<string | null> {
  if (!supabase) return 'Backend não configurado (Supabase).';
  const userId = await uid();
  if (!userId) return 'Entre na sua conta.';
  if (userId === blockedId) return 'Você não pode bloquear a si mesmo.';
  const { error } = await supabase
    .from('user_blocks')
    .upsert({ blocker_id: userId, blocked_id: blockedId }, { onConflict: 'blocker_id,blocked_id' });
  return error ? error.message : null;
}

/** Denuncia conteúdo (resenha/recado) — vai p/ content_reports (moderação). */
async function reportContent(
  targetType: 'review' | 'scrap',
  targetId: string,
  authorId: string,
  reason: string,
): Promise<string | null> {
  if (!supabase) return 'Backend não configurado (Supabase).';
  const userId = await uid();
  if (!userId) return 'Entre na sua conta.';
  const { error } = await supabase.from('content_reports').insert({
    reporter_id: userId,
    target_type: targetType,
    target_id: targetId,
    target_user_id: authorId,
    reason,
  });
  return error ? error.message : null;
}

/** Denuncia uma resenha (conteúdo ofensivo). */
export async function reportReview(reviewId: string, authorId: string, reason: string): Promise<string | null> {
  return reportContent('review', reviewId, authorId, reason);
}

/** Denuncia um recado (scrap). */
export async function reportScrap(scrapId: string, authorId: string, reason: string): Promise<string | null> {
  return reportContent('scrap', scrapId, authorId, reason);
}
