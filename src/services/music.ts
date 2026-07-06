/**
 * Trilhas para Leitura — áudio 100% LEGAL para os stories (decisão do usuário 2026-07-06):
 *  - **Jamendo API** (música independente/Creative Commons, API grátis oficial) por busca de TAGS;
 *  - **Sons Ambientes** (chuva/cafeteria/lareira/floresta) — acervo próprio CC0.
 * NADA de Spotify/iTunes (licença comercial que não temos). Posicionado como "trilhas/ambiente de
 * leitura", não "músicas famosas" — combina com o foco do Dromos e blinda juridicamente.
 *
 * O `client_id` do Jamendo (grátis, registra em developer.jamendo.com) vai em app.json →
 * `extra.jamendoClientId` (ou EXPO_PUBLIC_JAMENDO_CLIENT_ID), mesmo padrão da chave do Google Books.
 * Sem client_id, a busca Jamendo volta vazia, mas os Ambientes (URLs próprias) seguem funcionando.
 */
import Constants from 'expo-constants';

import type { StoryAudioMeta } from '@/types/story-composition';

export type Track = {
  id: string;
  name: string;
  artist: string;
  previewUrl: string;
  albumImage?: string | null;
  source: 'jamendo' | 'ambient';
  /** Emoji decorativo (só ambientes). */
  emoji?: string;
};

const JAMENDO_CLIENT_ID =
  (Constants.expoConfig?.extra?.jamendoClientId as string | undefined) ||
  process.env.EXPO_PUBLIC_JAMENDO_CLIENT_ID ||
  '';

const JAMENDO = 'https://api.jamendo.com/v3.0/tracks';

/** Gêneros/climas da aba "Explorar" (tags do Jamendo que rendem bem p/ leitura). */
export const GENRE_TAGS: { label: string; tag: string; emoji: string }[] = [
  { label: 'Relaxante', tag: 'relaxing', emoji: '🌿' },
  { label: 'Foco', tag: 'focus', emoji: '🎯' },
  { label: 'Clássica', tag: 'classical', emoji: '🎻' },
  { label: 'Lo-Fi', tag: 'lofi', emoji: '🎧' },
  { label: 'Cinematográfica', tag: 'cinematic', emoji: '🎬' },
  { label: 'Piano', tag: 'piano', emoji: '🎹' },
  { label: 'Ambiente', tag: 'ambient', emoji: '🌌' },
  { label: 'Acústica', tag: 'acoustic', emoji: '🪕' },
];

/**
 * Sons Ambientes (CC0). URLs: idealmente hospedar no bucket `acervo` (Supabase Storage) ou usar
 * fontes CC0 (Pixabay). Começa curto — some sem crash se a URL faltar. TODO: subir os .mp3.
 */
export const AMBIENTS: Track[] = [
  { id: 'amb-chuva', name: 'Chuva na Janela', artist: 'Ambiente', emoji: '🌧️', source: 'ambient', previewUrl: '' },
  { id: 'amb-cafe', name: 'Cafeteria Movimentada', artist: 'Ambiente', emoji: '☕', source: 'ambient', previewUrl: '' },
  { id: 'amb-lareira', name: 'Lareira Estalando', artist: 'Ambiente', emoji: '🔥', source: 'ambient', previewUrl: '' },
  { id: 'amb-floresta', name: 'Floresta Clássica', artist: 'Ambiente', emoji: '🌲', source: 'ambient', previewUrl: '' },
];

type JamendoTrack = {
  id: string;
  name: string;
  artist_name?: string;
  audio?: string; // stream/preview
  album_image?: string;
};

function mapJamendo(t: JamendoTrack): Track | null {
  if (!t.audio) return null;
  return {
    id: `jamendo-${t.id}`,
    name: t.name || 'Faixa',
    artist: t.artist_name || 'Artista independente',
    previewUrl: t.audio,
    albumImage: t.album_image || null,
    source: 'jamendo',
  };
}

/** Busca no Jamendo. `tags` refina por clima (ex.: 'relaxing'); sem client_id volta vazio. */
export async function searchTracks(query: string, tags?: string, signal?: AbortSignal): Promise<Track[]> {
  if (!JAMENDO_CLIENT_ID) return [];
  const params = new URLSearchParams({
    client_id: JAMENDO_CLIENT_ID,
    format: 'json',
    limit: '25',
    audioformat: 'mp32',
    include: 'musicinfo',
    order: 'popularity_total',
  });
  if (query.trim()) params.set('namesearch', query.trim());
  if (tags) params.set('tags', tags);
  try {
    const r = await fetch(`${JAMENDO}?${params.toString()}`, { signal });
    if (!r.ok) return [];
    const data = (await r.json()) as { results?: JamendoTrack[] };
    return (data.results ?? []).map(mapJamendo).filter((t): t is Track => t !== null);
  } catch {
    return [];
  }
}

/** "Para Você": trilhas calmas por padrão (independe do livro; pode refinar por tag no futuro). */
export async function recommendedForBook(_bookTitle: string, signal?: AbortSignal): Promise<Track[]> {
  // Clássicos/leitura combinam com calmo/instrumental — bom ponto de partida universal.
  return searchTracks('', 'relaxing+instrumental', signal);
}

/** Converte a faixa escolhida no metadado que o story guarda (o feed usa p/ tocar). */
export function trackToAudioMeta(t: Track, startSeconds = 0): StoryAudioMeta {
  return {
    track_id: t.id,
    track_name: t.name,
    artist: t.artist,
    preview_url: t.previewUrl,
    start_time_seconds: startSeconds,
    source: t.source,
    album_image: t.albumImage ?? null,
  };
}
