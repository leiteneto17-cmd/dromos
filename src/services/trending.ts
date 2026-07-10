/**
 * "Em alta no Brasil" — curadoria semanal REAL (decisão 2026-07-10), gerada pelo
 * Dromos Harvester (`harvester/update_trending.py` → `out/trending.json`) a partir de
 * PublishNews / Veja / #BookTokBrasil. Só METADADOS (título/autor/capa/link de compra) —
 * best-sellers têm copyright, então aqui NÃO há arquivo para baixar (§4.3).
 *
 * O app lê o JSON hospedado estático (raw do GitHub / Supabase Storage) → a seção troca
 * toda semana SEM release. Sem manifesto/offline → devolve [] e a Comunidade cai no
 * fallback "Em alta no mundo 🌍" (Open Library).
 */
import Constants from 'expo-constants';

import { SUPABASE_URL } from '@/services/supabase';

export type TrendingBook = {
  rank: number;
  title: string;
  author: string;
  coverUrl: string | null;
  /** Página de compra/preview (Google Books/afiliado). Sem ela, o app usa busca na Amazon BR. */
  buyUrl: string | null;
  /** De onde veio a tendência (PublishNews, Veja, BookTokBrasil…). */
  source: string | null;
};

/**
 * URL do trending.json. Prioridade:
 *   1. `extra.trendingUrl` (app.json) / EXPO_PUBLIC_TRENDING_URL;
 *   2. irmão do catalogUrl do harvester (troca catalog.json → trending.json);
 *   3. bucket público `acervo` do Supabase.
 */
const OVERRIDE =
  (Constants.expoConfig?.extra?.trendingUrl as string | undefined) ||
  process.env.EXPO_PUBLIC_TRENDING_URL ||
  '';
const CATALOG_URL =
  (Constants.expoConfig?.extra?.catalogUrl as string | undefined) ||
  process.env.EXPO_PUBLIC_CATALOG_URL ||
  '';
const MANIFEST_URL =
  OVERRIDE ||
  (CATALOG_URL ? CATALOG_URL.replace(/catalog\.json(\?.*)?$/, 'trending.json') : '') ||
  (SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/acervo/trending.json` : '');

/** Busca na Amazon BR — fallback de "onde comprar" quando o item não traz buyUrl. */
export function buySearchUrl(title: string, author?: string | null): string {
  const q = encodeURIComponent([title, author].filter(Boolean).join(' '));
  return `https://www.amazon.com.br/s?k=${q}&i=stripbooks`;
}

let cache: TrendingBook[] | null = null;

/** Curadoria "Em alta no Brasil". [] sem manifesto/offline (a UI cai no fallback mundial). */
export async function getTrendingBR(): Promise<TrendingBook[]> {
  if (cache) return cache;
  if (!MANIFEST_URL) return [];
  try {
    const r = await fetch(MANIFEST_URL);
    if (!r.ok) return [];
    const data = (await r.json()) as { items?: Partial<TrendingBook>[] };
    const items = (data.items ?? [])
      .filter((it) => it?.title && it?.author)
      .map(
        (it, i): TrendingBook => ({
          rank: Number(it.rank ?? i + 1),
          title: String(it.title),
          author: String(it.author),
          coverUrl: it.coverUrl ?? null,
          buyUrl: it.buyUrl ?? null,
          source: it.source ?? null,
        }),
      );
    cache = items;
    return items;
  } catch {
    return []; // offline — fallback mundial na UI
  }
}
