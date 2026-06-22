/**
 * Sincroniza as sessões de leitura locais (offline-first) para o Supabase
 * (`reading_activities`) — a base "estilo Strava" do app (§2.6). Só roda se houver
 * projeto configurado E usuário logado; senão é no-op (ler offline não exige conta, §6).
 *
 * As sessões nascem locais com `synced=false`. Aqui empurramos as pendentes e marcamos
 * `synced=true` (guardando o id remoto). É idempotente por sessão: o que falhar continua
 * pendente e tenta de novo na próxima chamada (ao abrir Atividades, ao logar, ao fim de
 * uma leitura). Visibilidade nasce 'private' por padrão no banco (§4.8).
 */
import { supabase } from '@/services/supabase';
import { useLibrary } from '@/store/library';

let inFlight = false;

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
