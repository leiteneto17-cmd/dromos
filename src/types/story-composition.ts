/**
 * Tipos da COMPOSIÇÃO do story (editor imersivo estilo Instagram). Guardado como JSON em
 * `reading_activities.story_composition` — sem upload de imagem (o viewer re-renderiza fiel).
 * Coordenadas x,y são NORMALIZADAS (0..1, fração do card) → mesmo resultado em qualquer tela.
 * Sem imports p/ evitar ciclos (stories.ts, music.ts e os componentes do editor consomem daqui).
 */
export type LayerBg = 'none' | 'solid' | 'soft';

export type StoryTextLayer = {
  type: 'text';
  id: string;
  text: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  color: string;
  bg: LayerBg;
};

export type StoryStickerLayer = {
  type: 'sticker';
  id: string;
  emoji: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
};

export type StoryMusicLayer = {
  type: 'music';
  id: string;
  style: 'player' | 'neon';
  x: number;
  y: number;
};

export type StoryLayer = StoryTextLayer | StoryStickerLayer | StoryMusicLayer;

/** Metadados do áudio anexado (Jamendo ou som ambiente) — o feed sabe o que tocar. */
export type StoryAudioMeta = {
  track_id: string;
  track_name: string;
  artist: string;
  preview_url: string;
  start_time_seconds: number;
  source: 'jamendo' | 'ambient';
  album_image?: string | null;
};

export type StoryComposition = {
  version: 1;
  bg: string; // id de BG_PRESETS
  layers: StoryLayer[];
  audio: StoryAudioMeta | null;
};

/** Fundos do card (efeitos/filtros) — gradientes fixos da identidade (§2.7). */
export const BG_PRESETS: { id: string; label: string; colors: [string, string] }[] = [
  { id: 'roxo', label: 'Roxo', colors: ['#3B2A63', '#14121C'] },
  { id: 'meia-noite', label: 'Meia-noite', colors: ['#141A2E', '#05070D'] },
  { id: 'floresta', label: 'Floresta', colors: ['#123524', '#0A140F'] },
  { id: 'poente', label: 'Poente', colors: ['#4A2350', '#171021'] },
];

export function bgColors(id: string): [string, string] {
  return (BG_PRESETS.find((b) => b.id === id) ?? BG_PRESETS[0]).colors;
}

/** Cores de texto disponíveis no editor de camada. */
export const TEXT_COLORS = ['#FFFFFF', '#7CF0B8', '#B9A6E8', '#FFD36E', '#FF8FA3', '#8FD0FF'];

/** Composição vazia padrão. */
export function emptyComposition(): StoryComposition {
  return { version: 1, bg: 'roxo', layers: [], audio: null };
}
