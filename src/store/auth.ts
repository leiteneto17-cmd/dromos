/**
 * Estado de autenticação (Zustand) sobre o Supabase Auth.
 *
 * Login é OPCIONAL no +leitura (CLAUDE.md §6): ler os próprios livros offline é
 * grátis e não exige conta. A identidade só é necessária para a camada SOCIAL
 * (feed, kudos, comentários — Fase 5b) e para sincronizar na nuvem.
 *
 * A sessão persiste no AsyncStorage (config em src/services/supabase.ts), então
 * o usuário continua logado entre aberturas do app.
 */
import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

import { isSupabaseConfigured, supabase } from '@/services/supabase';

type AuthState = {
  /** Sessão atual (null = deslogado). */
  session: Session | null;
  user: User | null;
  /** true enquanto checamos a sessão salva na inicialização. */
  initializing: boolean;
  /** false quando o projeto Supabase ainda não foi configurado (app.json). */
  configured: boolean;
};

export const useAuth = create<AuthState>(() => ({
  session: null,
  user: null,
  initializing: isSupabaseConfigured,
  configured: isSupabaseConfigured,
}));

// Inicialização única (no import): restaura a sessão salva e escuta mudanças.
if (supabase) {
  supabase.auth
    .getSession()
    .then(({ data }) => {
      useAuth.setState({
        session: data.session,
        user: data.session?.user ?? null,
        initializing: false,
      });
    })
    .catch(() => useAuth.setState({ initializing: false }));

  supabase.auth.onAuthStateChange((_event, session) => {
    useAuth.setState({ session, user: session?.user ?? null, initializing: false });
  });
}

/** Nome para exibição: metadado `name`, senão o trecho antes do @ do e-mail. */
export function displayName(user: User | null): string {
  if (!user) return 'Leitor';
  const meta = (user.user_metadata?.name as string | undefined)?.trim();
  if (meta) return meta;
  const email = user.email ?? '';
  return email ? email.split('@')[0] : 'Leitor';
}

export type AuthResult = { ok: true; needsConfirmation?: boolean } | { ok: false; error: string };

/** Cria conta com e-mail/senha. Pode exigir confirmação por e-mail (config do projeto). */
export async function signUp(email: string, password: string, name?: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: 'Supabase não configurado.' };
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: name ? { data: { name: name.trim() } } : undefined,
  });
  if (error) return { ok: false, error: traduzErro(error.message) };
  // Sem sessão = projeto exige confirmação de e-mail antes de logar.
  return { ok: true, needsConfirmation: !data.session };
}

/** Entra com e-mail/senha. */
export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: 'Supabase não configurado.' };
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return { ok: false, error: traduzErro(error.message) };
  return { ok: true };
}

/** Sai da conta. */
export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

/**
 * Exclui PERMANENTEMENTE a conta do usuário (obrigatório nas lojas — Apple
 * Guideline 5.1.1(v) + Google). Chama a função `delete_current_user` no Supabase
 * (apaga de auth.users; o cascade remove perfil, atividades, estante, follows,
 * resenhas, recados, etc.) e então desloga. Irreversível.
 */
export async function deleteAccount(): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: 'Supabase não configurado.' };
  const { error } = await supabase.rpc('delete_current_user');
  if (error) return { ok: false, error: traduzErro(error.message) };
  await supabase.auth.signOut(); // limpa a sessão local; o guard leva ao /login
  return { ok: true };
}

/** Mensagens de erro mais comuns do Supabase Auth em PT-BR. */
function traduzErro(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('user already registered')) return 'Este e-mail já tem conta. Tente entrar.';
  if (m.includes('password should be at least')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (m.includes('unable to validate email') || m.includes('invalid email')) return 'E-mail inválido.';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  return msg;
}
