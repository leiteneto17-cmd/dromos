/**
 * Sincroniza as sessões de leitura locais (offline-first) para o Supabase
 * (`reading_activities`) — a base "estilo Strava" do app (§2.6). Só roda se houver
 * projeto configurado E usuário logado; senão é no-op (ler offline não exige conta, §6).
 *
 * As sessões nascem locais com `synced=false`. Aqui empurramos as pendentes e marcamos
 * `synced=true` (guardando o id remoto). É idempotente por sessão: o que falhar continua
 * pendente e tenta de novo na próxima chamada (ao abrir Atividades, ao logar, ao fim de
 * uma leitura). Visibilidade nasce 'friends' (visível a seguidores aceitos — a privacidade
 * de fato vem da aprovação de quem te segue, §4.8); o RLS esconde as 'private' até deles.
 */
import { supabase } from '@/services/supabase';
import { useLibrary, type BookFormat } from '@/store/library';

let inFlight = false;
/** uid já restaurado nesta execução do app (evita re-baixar a cada foco). */
let restoredFor: string | null = null;

export type SyncResult = { pushed: number } | null;

/** Empurra as sessões pendentes. Retorna quantas subiram, ou null se não deu p/ sincronizar. */
export async function syncActivities(): Promise<SyncResult> {
  if (!supabase || inFlight) return null;
  inFlight = true;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return null; // deslogado → mantém tudo local
    const userId = session.user.id;

    const pending = useLibrary.getState().sessions.filter((s) => !s.synced);
    if (pending.length === 0) return { pushed: 0 };

    const markSessionSynced = useLibrary.getState().markSessionSynced;
    let pushed = 0;
    // Uma a uma para casar o id remoto com a sessão local com segurança. Para no 1º erro
    // (ex.: rede caiu) → o restante segue pendente e tenta na próxima vez.
    for (const s of pending) {
      const { data, error } = await supabase
        .from('reading_activities')
        .insert({
          user_id: userId,
          book_title: s.bookTitle,
          book_format: s.format,
          seconds: s.seconds,
          pages: s.pages,
          started_at: new Date(s.startedAt).toISOString(),
          // Respeita a escolha do usuário (Configurações → "Compartilhar minhas leituras").
          visibility: useLibrary.getState().shareActivities ? 'friends' : 'private',
        })
        .select('id')
        .single();
      if (error) break;
      markSessionSynced(s.id, data?.id as string | undefined);
      pushed++;
    }
    return { pushed };
  } catch {
    return null;
  } finally {
    inFlight = false;
  }
}

/**
 * Liga/desliga o COMPARTILHAMENTO das atividades de leitura (escolha do usuário, §4.8).
 * Salva a preferência localmente (vale para as próximas sessões) E atualiza as atividades
 * JÁ enviadas: 'friends' (aparecem no feed de quem te segue) ou 'private' (só você vê).
 * O RLS já permite o dono atualizar as próprias linhas. No-op no backend se deslogado.
 */
export async function setActivitySharing(share: boolean): Promise<void> {
  useLibrary.getState().setShareActivities(share); // imediato/local (offline-first)
  if (!supabase) return;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    await supabase
      .from('reading_activities')
      .update({ visibility: share ? 'friends' : 'private' })
      .eq('user_id', session.user.id);
  } catch {
    // melhor-esforço: a preferência local já valeu; tenta de novo numa próxima alternância
  }
}

/**
 * Restauração da nuvem (cloud → app): puxa as atividades já sincronizadas do Supabase e
 * funde no estado local, reconstruindo o HISTÓRICO de sessões e as ESTATÍSTICAS num
 * aparelho/instalação novo (resolve "atualizei o app e perdi tudo"). É offline-first
 * amigável: o merge não apaga nada local (sessões por remoteId; perDay por MAX — ver
 * store.mergeCloudActivities). Roda 1× por usuário/execução. No-op se deslogado.
 *
 * Obs: livros importados são arquivos LOCAIS → não restauram aqui (precisa do backup de
 * arquivos no Storage, recurso Pro). A ESTANTE (book_shelves) já volta da nuvem por si.
 */
export async function restoreActivities(): Promise<void> {
  if (!supabase) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;
  const userId = session.user.id;
  if (restoredFor === userId) return;

  const { data, error } = await supabase
    .from('reading_activities')
    .select('id, book_title, book_format, seconds, pages, started_at')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(300);
  if (error || !data) return;

  const rows = (
    data as { id: string; book_title: string; book_format: string | null; seconds: number; pages: number | null; started_at: string }[]
  ).map((r) => ({
    remoteId: r.id,
    bookTitle: r.book_title,
    format: (r.book_format as BookFormat) || 'epub',
    seconds: r.seconds || 0,
    pages: r.pages || 0,
    startedAt: new Date(r.started_at).getTime(),
  }));

  useLibrary.getState().mergeCloudActivities(rows);
  restoredFor = userId; // marca só após sucesso (se falhar, tenta de novo depois)
}
