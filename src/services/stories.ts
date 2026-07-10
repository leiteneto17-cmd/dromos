/**
 * Apoio às PUBLICAÇÕES da Comunidade (ex-stories; posts de verdade vivem em
 * services/social.ts → community_posts). Aqui ficam só o `tempoAtras` e a prévia da
 * última leitura (o anexo "📖 Minha leitura" da tela /publicar). O story efêmero
 * (viewer 24h, story_views, colunas story_*) foi APOSENTADO em 2026-07-10.
 */
import { supabase } from '@/services/supabase';

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

/** Prévia da minha leitura mais recente (o anexo "📖 Minha leitura" da tela /publicar). */
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
