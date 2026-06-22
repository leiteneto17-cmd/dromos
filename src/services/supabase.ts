/**
 * Cliente Supabase do +leitura (auth + sync + feed social — Fases 5b).
 *
 * IMPORTANTE (CLAUDE.md §5): o Supabase NÃO guarda chaves de IA. A IA roda em
 * modo BYOK (a chave do próprio usuário, no aparelho, via expo-secure-store).
 * Aqui só tratamos identidade do usuário, sincronização e a camada social.
 *
 * Config: as credenciais (URL do projeto + anon key) vêm de `app.json` → `extra`
 * (`supabaseUrl` / `supabaseAnonKey`) ou das variáveis de ambiente
 * `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` (têm prioridade).
 * A **anon key é pública por design** — quem protege os dados é o RLS no Postgres.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import 'react-native-url-polyfill/auto';

const extra = (Constants.expoConfig?.extra ?? {}) as {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || extra.supabaseUrl || '';
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra.supabaseAnonKey || '';

/** true quando as credenciais foram preenchidas (projeto Supabase configurado). */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/**
 * Cliente único. Se as credenciais ainda não foram preenchidas, fica `null`
 * (em vez de quebrar o app) — a UI mostra o aviso de "configurar Supabase".
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // Sessão persiste no AsyncStorage (sobrevive ao fechar o app).
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // No RN não há URL de redirect do navegador para detectar.
        detectSessionInUrl: false,
      },
    })
  : null;

/** Helper: lança um erro claro quando algo tenta usar o Supabase sem config. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase não configurado. Preencha supabaseUrl/supabaseAnonKey em app.json (extra) ' +
        'ou as variáveis EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  return supabase;
}
