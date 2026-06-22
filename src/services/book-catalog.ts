/**
 * Catálogo de livros (metadados) p/ a comunidade estilo Skoob.
 *
 * Fonte PRIMÁRIA: **Google Books** (melhor cobertura PT: sinopse/páginas/gênero/idioma/ISBN),
 * regionalizada por `langRestrict`. REDE DE SEGURANÇA: **Open Library** — usada só quando o
 * Google falha (ex.: **HTTP 429 = cota diária esgotada**) ou volta vazio. Sem chave, via fetch.
 *
 * IMPORTANTE (lição 2026-06-21): o Google Books sem API key tem **cota diária por IP**. Só ele
 * = busca quebra quando estoura. Por isso o Open Library voltou como fallback. Os idiomas do
 * Open Library (3 letras: por/eng/bul) são normalizados p/ 2 letras (pt/en) p/ não exibir "BUL".
 */
export type LangFilter = 'pt' | 'en' | 'all';

export type CatalogBook = {
  id: string;
  isbn?: string;
  title: string;
  author?: string;
  coverUrl?: string;
  synopsis?: string;
  pages?: number;
  language?: string;
  genres?: string[];
  year?: string;
  source: 'google' | 'openlibrary';
};

const GOOGLE = 'https://www.googleapis.com/books/v1/volumes';
const OL_SEARCH = 'https://openlibrary.org/search.json';

/** http→https nas capas (Android bloqueia http puro por padrão). */
function https(url?: string): string | undefined {
  return url ? url.replace(/^http:\/\//, 'https://') : undefined;
}

/** Normaliza código de idioma p/ 2 letras (por→pt, eng→en…) p/ casar com langName/langRestrict. */
const LANG_3TO2: Record<string, string> = {
  por: 'pt', eng: 'en', spa: 'es', fra: 'fr', fre: 'fr', deu: 'de', ger: 'de', ita: 'it',
};
function normLang(code?: string): string | undefined {
  if (!code) return undefined;
  const c = code.toLowerCase();
  return c.length === 3 ? LANG_3TO2[c] ?? c : c;
}

// ---------- Google Books ----------
type GVolume = {
  id: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    description?: string;
    pageCount?: number;
    categories?: string[];
    language?: string;
    publishedDate?: string;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    industryIdentifiers?: { type?: string; identifier?: string }[];
  };
};

function mapGoogle(v: GVolume): CatalogBook | null {
  const info = v.volumeInfo ?? {};
  if (!info.title) return null;
  const ids = info.industryIdentifiers ?? [];
  const isbn =
    ids.find((i) => i.type === 'ISBN_13')?.identifier ?? ids.find((i) => i.type === 'ISBN_10')?.identifier;
  return {
    id: isbn ?? v.id,
    isbn,
    title: info.title,
    author: info.authors?.join(', '),
    coverUrl: https(info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail),
    synopsis: info.description,
    pages: info.pageCount,
    language: normLang(info.language),
    genres: info.categories,
    year: info.publishedDate?.slice(0, 4),
    source: 'google',
  };
}

async function searchGoogle(query: string, lang?: LangFilter, signal?: AbortSignal): Promise<CatalogBook[]> {
  const langParam = lang && lang !== 'all' ? `&langRestrict=${lang}` : '';
  const url = `${GOOGLE}?q=${encodeURIComponent(query)}${langParam}&maxResults=20&printType=books`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`google ${res.status}`); // 429 = cota esgotada → cai p/ Open Library
  const json = (await res.json()) as { items?: GVolume[] };
  return (json.items ?? []).map(mapGoogle).filter((b): b is CatalogBook => b !== null);
}

// ---------- Open Library (rede de segurança) ----------
type OLDoc = {
  title?: string;
  author_name?: string[];
  cover_i?: number;
  isbn?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
  subject?: string[];
  language?: string[];
  key?: string;
};

function mapOpenLibrary(d: OLDoc): CatalogBook | null {
  if (!d.title) return null;
  return {
    id: d.isbn?.[0] ?? d.key ?? d.title,
    isbn: d.isbn?.[0],
    title: d.title,
    author: d.author_name?.join(', '),
    coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : undefined,
    pages: d.number_of_pages_median,
    language: normLang(d.language?.[0]),
    genres: d.subject?.slice(0, 5),
    year: d.first_publish_year ? String(d.first_publish_year) : undefined,
    source: 'openlibrary',
  };
}

async function searchOpenLibrary(query: string, lang?: LangFilter, signal?: AbortSignal): Promise<CatalogBook[]> {
  const ol3 = lang === 'pt' ? 'por' : lang === 'en' ? 'eng' : '';
  const langParam = ol3 ? `&language=${ol3}` : '';
  const fields = 'title,author_name,cover_i,isbn,first_publish_year,number_of_pages_median,subject,language,key';
  const url = `${OL_SEARCH}?q=${encodeURIComponent(query)}${langParam}&limit=20&fields=${fields}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`openlibrary ${res.status}`);
  const json = (await res.json()) as { docs?: OLDoc[] };
  return (json.docs ?? []).map(mapOpenLibrary).filter((b): b is CatalogBook => b !== null);
}

/** Google → se falhar/vazio, Open Library. Mantém a regionalização nos dois. */
async function searchAny(query: string, lang: LangFilter, signal?: AbortSignal): Promise<CatalogBook[]> {
  try {
    const g = await searchGoogle(query, lang, signal);
    if (g.length > 0) return g;
    if (lang !== 'all') {
      const gAll = await searchGoogle(query, 'all', signal);
      if (gAll.length > 0) return gAll;
    }
  } catch {
    // Google indisponível/cota → tenta o Open Library
  }
  try {
    const ol = await searchOpenLibrary(query, lang, signal);
    if (ol.length > 0) return ol;
    if (lang !== 'all') return await searchOpenLibrary(query, 'all', signal);
    return ol;
  } catch {
    return [];
  }
}

/** Livros "em alta"/destaque (grade da abertura). Por idioma; só com capa. */
export async function featuredBooks(lang: LangFilter = 'pt', signal?: AbortSignal): Promise<CatalogBook[]> {
  const items = await searchAny('best sellers', lang, signal);
  const seen = new Set<string>();
  const out: CatalogBook[] = [];
  for (const b of items) {
    if (!b.coverUrl) continue;
    const k = b.title.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(b);
  }
  return out;
}

/** Busca regionalizada (PT por padrão). Google primeiro; Open Library de fallback. */
export async function searchBooks(query: string, lang: LangFilter = 'pt', signal?: AbortSignal): Promise<CatalogBook[]> {
  const q = query.trim();
  if (!q) return [];
  return searchAny(q, lang, signal);
}

/**
 * Detalhes de UM livro (com sinopse) p/ a página do livro. Busca por título (+autor) no
 * idioma pedido e escolhe a melhor edição (prefere o idioma + sinopse). Google primeiro;
 * Open Library de fallback (idioma já normalizado, então não exibe "BUL").
 */
export async function bookDetails(
  title: string,
  isbn?: string,
  author?: string,
  lang: LangFilter = 'pt',
  signal?: AbortSignal,
): Promise<CatalogBook | null> {
  const queries = author ? [`intitle:${title} inauthor:${author}`, `intitle:${title}`] : [`intitle:${title}`];
  try {
    for (const lf of lang !== 'all' ? [lang, 'all' as LangFilter] : ['all' as LangFilter]) {
      for (const q of queries) {
        const best = pickBestEdition(await searchGoogle(q, lf, signal), title, lang);
        if (best) return best;
      }
    }
    if (isbn) {
      const g = await searchGoogle(`isbn:${isbn}`, 'all', signal);
      if (g.length > 0) return g[0];
    }
  } catch {
    // Google indisponível → Open Library
  }
  try {
    const ol = await searchOpenLibrary(title, lang, signal);
    const best = pickBestEdition(ol, title, lang);
    if (best) return best;
  } catch {
    // sem detalhes
  }
  return null;
}

/** Escolhe a edição mais útil: prefere o idioma pedido + sinopse; depois só sinopse. */
function pickBestEdition(list: CatalogBook[], title: string, lang: LangFilter): CatalogBook | null {
  const t = title.toLowerCase();
  const matches = list.filter((b) => {
    const bt = b.title.toLowerCase();
    return bt.includes(t) || t.includes(bt);
  });
  const pool = matches.length > 0 ? matches : list;
  const wanted = (b: CatalogBook) => lang === 'all' || b.language === lang;
  return (
    pool.find((b) => b.synopsis && wanted(b)) ??
    pool.find((b) => wanted(b)) ??
    pool.find((b) => b.synopsis) ??
    pool[0] ??
    null
  );
}

/**
 * Livros similares: mesmo AUTOR. Google primeiro; Open Library de fallback. Só com capa.
 */
export async function similarBooks(
  author: string | undefined,
  excludeTitle: string,
  lang: LangFilter = 'pt',
  signal?: AbortSignal,
): Promise<CatalogBook[]> {
  if (!author) return [];
  const exclude = excludeTitle.trim().toLowerCase();
  let list: CatalogBook[] = [];
  try {
    list = await searchGoogle(`inauthor:${author}`, lang, signal);
  } catch {
    list = [];
  }
  if (list.length === 0) {
    try {
      list = await searchOpenLibrary(author, lang, signal);
    } catch {
      return [];
    }
  }
  const seen = new Set<string>();
  const out: CatalogBook[] = [];
  for (const b of list) {
    if (!b.coverUrl) continue;
    const k = b.title.toLowerCase();
    if (k === exclude || seen.has(k)) continue;
    seen.add(k);
    out.push(b);
    if (out.length >= 12) break;
  }
  return out;
}
