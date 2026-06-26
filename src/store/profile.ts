/**
 * Perfil do usuário no banco (tabela public.profiles): nome + avatar.
 * Carrega quando há sessão; se a linha não existir (usuário criado antes do
 * trigger), cria uma com nome padrão. Mantém o perfil em memória (Zustand) para
 * o cabeçalho (ProfileHeader) e a tela de edição lerem reativamente.
 *
 * Schema/RLS: supabase/schema.sql.
 */
import { create } from 'zustand';

import { supabase } from '@/services/supabase';
import { displayName, useAuth } from './auth';

export type Profile = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  is_public: boolean;
};

type ProfileState = {
  profile: Profile | null;
  loading: boolean;
};

export const useProfile = create<ProfileState>(() => ({ profile: null, loading: false }));

async function loadProfile(userId: string | undefined): Promise<void> {
  if (!supabase || !userId) {
    useProfile.setState({ profile: null, loading: false });
    return;
  }
  useProfile.setState({ loading: true });
  const { data } = await supabase
    .from('profiles')
    .select('id, name, avatar_url, is_public')
    .eq('id', userId)
    .maybeSingle();

  if (data) {
    useProfile.setState({ profile: data as Profile, loading: false });
    return;
  }

  // Sem linha → cria perfil padrão (cobre usuários criados antes do trigger).
  const name = displayName(useAuth.getState().user);
  const { data: created } = await supabase
    .from('profiles')
    .upsert({ id: userId, name })
    .select('id, name, avatar_url, is_public')
    .maybeSingle();
  useProfile.setState({
    profile: (created as Profile) ?? { id: userId, name, avatar_url: null, is_public: false },
    loading: false,
  });
}

// Recarrega sempre que o usuário logado muda (login/logout).
let lastUserId: string | undefined;
useAuth.subscribe((s) => {
  const id = s.user?.id;
  if (id !== lastUserId) {
    lastUserId = id;
    void loadProfile(id);
  }
});
// Carga inicial (caso a sessão já tenha sido restaurada antes deste import).
void loadProfile(useAuth.getState().user?.id);

export type UpdateResult = { ok: true } | { ok: false; error: string };

// Última lista de emblemas publicada (evita reescrever o perfil a cada foco/sessão).
let lastBadgesKey = '';

/**
 * Publica os emblemas DESBLOQUEADOS (ids) no próprio perfil, para aparecerem no perfil
 * PÚBLICO (outras pessoas veem o esforço). No-op se deslogado/sem backend ou se nada mudou
 * desde a última sincronização. As conquistas continuam sendo calculadas localmente
 * (computeAchievements) — aqui só espelhamos o resultado no banco.
 */
export async function syncBadges(unlockedIds: string[]): Promise<void> {
  const user = useAuth.getState().user;
  if (!supabase || !user) return;
  const ids = [...unlockedIds].sort();
  const key = ids.join(',');
  if (key === lastBadgesKey) return;
  const { error } = await supabase.from('profiles').update({ badges: ids }).eq('id', user.id);
  if (!error) lastBadgesKey = key; // só marca como sincronizado se deu certo (senão tenta de novo)
}

/** Atualiza nome, avatar e/ou visibilidade pública do próprio perfil no banco. */
export async function updateProfile(fields: {
  name?: string;
  avatar_url?: string | null;
  is_public?: boolean;
}): Promise<UpdateResult> {
  const user = useAuth.getState().user;
  if (!supabase || !user) return { ok: false, error: 'Você precisa estar logado.' };
  const { error } = await supabase.from('profiles').update(fields).eq('id', user.id);
  if (error) return { ok: false, error: error.message };
  await loadProfile(user.id);
  return { ok: true };
}
