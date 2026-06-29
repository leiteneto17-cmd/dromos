/**
 * Catálogo de livros para o Explorar — MULTI-FONTE. CLAUDE.md §4.3: só acervo livre/
 * sem DRM. Fontes verificadas (2026-06-20):
 *  - **Project Gutenberg** (via API Gutendex): JSON aberto, 100% domínio público. PADRÃO.
 *  - **Internet Archive** (advancedsearch): API aberta; EXCLUÍMOS as coleções de
 *    empréstimo (inlibrary/printdisabled, que têm DRM) e avisamos que é acervo aberto
 *    da comunidade — qualidade/direitos variam. Fica como fonte opcional.
 * (Standard Ebooks passou a exigir login; Feedbooks bloqueia bots; BibliON usa DRM de
 *  empréstimo; Senado não tem API — por isso não entram.)
 */
export type CatalogSource = 'gutenberg' | 'archive' | 'curated' | 'google';
export type CatalogLang = 'pt' | 'en' | 'all';

export type CatalogBook = {
  /** Único entre fontes (prefixado pela fonte). */
  id: string;
  source: CatalogSource;
  title: string;
  author: string;
  language: string;
  coverUrl: string | null;
  /** Conhecido no Gutenberg; no Archive resolvemos na hora de baixar (resolveEpubUrl). */
  epubUrl: string | null;
  iaIdentifier?: string;
};

export type CatalogPage = { results: CatalogBook[]; hasNext: boolean };

/**
 * Fontes EXPOSTAS na interface. Só Gutenberg por enquanto: é 100% domínio público.
 *
 * ⚠️ Internet Archive ficou FORA de propósito (código abaixo permanece para o futuro):
 * a verificação (2026-06-20) mostrou que, mesmo excluindo o acervo de empréstimo, a
 * busca surge cheia de livro PIRATEADO e conteúdo OFENSIVO — ordenado por downloads, o
 * topo em PT trazia "Halim" (Milton Hatoum, com copyright), quadrinho do Conan e
 * "Mein Kampf". Expor isso violaria §4.3 (direitos) e §4.8 (moderação). Só reabilitar
 * se houver um feed CURADO de domínio público.
 */
export const SOURCES: { id: CatalogSource; label: string; note?: string }[] = [
  { id: 'gutenberg', label: 'Project Gutenberg' },
];

/** Atalhos de descoberta (busca pronta) — funciona bem em PT e EN no Gutenberg. */
export const QUICK_SEARCHES: { label: string; query: string }[] = [
  { label: 'Machado de Assis', query: 'Machado de Assis' },
  { label: 'Eça de Queirós', query: 'Eça de Queirós' },
  { label: 'José de Alencar', query: 'Alencar' },
  { label: 'Lima Barreto', query: 'Lima Barreto' },
  { label: 'Aventura', query: 'adventure' },
  { label: 'Romance', query: 'romance' },
  { label: 'Ficção científica', query: 'science fiction' },
  { label: 'Terror', query: 'horror' },
  { label: 'Poesia', query: 'poetry' },
  { label: 'Contos', query: 'short stories' },
];

// ----------------- Project Gutenberg (Gutendex) -----------------

type GutendexBook = {
  id: number;
  title?: string;
  authors?: { name?: string }[];
  languages?: string[];
  formats?: Record<string, string>;
};

function pickEpub(formats: Record<string, string>): string | null {
  const direct = formats['application/epub+zip'];
  if (direct) return direct;
  const alt = Object.entries(formats).find(([k]) => k.startsWith('application/epub'));
  return alt ? alt[1] : null;
}

async function searchGutenberg(query: string, lang: CatalogLang, page: number): Promise<CatalogPage> {
  const params = new URLSearchParams();
  if (query.trim()) params.set('search', query.trim());
  else params.set('sort', 'popular'); // navegação (sem busca) = os mais lidos primeiro
  if (lang !== 'all') params.set('languages', lang);
  params.set('page', String(page));

  const r = await fetch(`https://gutendex.com/books?${params.toString()}`);
  if (!r.ok) throw new Error(`Erro ${r.status} ao buscar o catálogo.`);
  const data = (await r.json()) as { results?: GutendexBook[]; next?: string | null };

  const results: CatalogBook[] = (data.results ?? [])
    .map((b): CatalogBook => {
      const formats = b.formats ?? {};
      return {
        id: `gutenberg-${b.id}`,
        source: 'gutenberg',
        title: b.title ?? 'Sem título',
        author: b.authors?.[0]?.name || 'Autor desconhecido',
        language: b.languages?.[0] ?? '',
        coverUrl: formats['image/jpeg'] ?? null,
        epubUrl: pickEpub(formats),
      };
    })
    .filter((b) => !!b.epubUrl);

  return { results, hasNext: Boolean(data.next) };
}

// ----------------- Internet Archive (advancedsearch) -----------------

type IADoc = {
  identifier: string;
  title?: string;
  creator?: string | string[];
  language?: string | string[];
};

const IA_ROWS = 20;

function first(v: string | string[] | undefined, fallback: string): string {
  if (Array.isArray(v)) return v[0] ?? fallback;
  return v || fallback;
}

async function searchArchive(query: string, lang: CatalogLang, page: number): Promise<CatalogPage> {
  // exclui o acervo de empréstimo (DRM) e exige derivativo EPUB
  const clauses = [
    'mediatype:texts',
    'format:EPUB',
    'NOT collection:(inlibrary)',
    'NOT collection:(printdisabled)',
  ];
  if (lang !== 'all') clauses.push(`language:(${lang === 'pt' ? 'portuguese' : 'english'})`);
  if (query.trim()) clauses.push(`(${query.trim()})`);

  const params = new URLSearchParams();
  params.set('q', clauses.join(' AND '));
  ['identifier', 'title', 'creator', 'language'].forEach((f) => params.append('fl[]', f));
  params.append('sort[]', 'downloads desc'); // mais baixados primeiro (clássicos conhecidos)
  params.set('rows', String(IA_ROWS));
  params.set('page', String(page));
  params.set('output', 'json');

  const r = await fetch(`https://archive.org/advancedsearch.php?${params.toString()}`);
  if (!r.ok) throw new Error(`Erro ${r.status} ao buscar o catálogo.`);
  const data = (await r.json()) as { response?: { numFound?: number; docs?: IADoc[] } };
  const docs = data.response?.docs ?? [];
  const numFound = data.response?.numFound ?? 0;

  const results: CatalogBook[] = docs.map((d) => ({
    id: `archive-${d.identifier}`,
    source: 'archive',
    title: d.title || 'Sem título',
    author: first(d.creator, 'Autor desconhecido'),
    language: first(d.language, ''),
    coverUrl: `https://archive.org/services/img/${d.identifier}`,
    epubUrl: null, // resolvido no download
    iaIdentifier: d.identifier,
  }));

  return { results, hasNext: numFound > page * IA_ROWS };
}

// ----------------- Google Books (free-ebooks) -----------------

type GBItem = {
  id: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    language?: string;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
  accessInfo?: {
    publicDomain?: boolean;
    epub?: { isAvailable?: boolean; downloadLink?: string };
  };
};

const GB_MAX = 20;

/**
 * Chave do Google Books (OPCIONAL). Sem ela funciona, mas a quota keyless é baixa e
 * vários usuários juntos batem em 429. Em produção, gere uma chave grátis no Google Cloud
 * (API "Books") e exponha em `EXPO_PUBLIC_GOOGLE_BOOKS_KEY` (ou app.json → extra).
 */
const GB_KEY = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_KEY || '';

/** Força https (a App Store bloqueia http puro por causa do ATS). */
function toHttps(u?: string | null): string | null {
  if (!u) return null;
  return u.replace(/^http:\/\//i, 'https://');
}

/**
 * Google Books — só os GRÁTIS com EPUB BAIXÁVEL (domínio público). Os "grátis com DRM"
 * (promoções de best-seller) NÃO expõem `downloadLink` → ficam de fora de propósito, pois
 * não dá para importar/ler no app (§4.3). Amplia o acervo grátis em PT além do Gutenberg.
 * A API exige um termo de busca (`q`) — sem busca, não retorna nada.
 */
async function searchGoogleBooks(query: string, lang: CatalogLang, page: number): Promise<CatalogPage> {
  const q = query.trim();
  if (!q) return { results: [], hasNext: false };

  const params = new URLSearchParams();
  params.set('q', q);
  params.set('filter', 'free-ebooks');
  params.set('country', 'BR');
  if (lang !== 'all') params.set('langRestrict', lang);
  params.set('startIndex', String((page - 1) * GB_MAX));
  params.set('maxResults', String(GB_MAX));
  if (GB_KEY) params.set('key', GB_KEY);

  const r = await fetch(`https://www.googleapis.com/books/v1/volumes?${params.toString()}`);
  if (!r.ok) throw new Error(`Erro ${r.status} ao buscar no Google Books.`);
  const data = (await r.json()) as { totalItems?: number; items?: GBItem[] };
  const items = data.items ?? [];

  const results: CatalogBook[] = items
    .map((it): CatalogBook | null => {
      const v = it.volumeInfo ?? {};
      const epub = toHttps(it.accessInfo?.epub?.downloadLink);
      if (!epub) return null; // só os baixáveis (domínio público) — descarta os "grátis com DRM"
      return {
        id: `google-${it.id}`,
        source: 'google',
        title: v.title ?? 'Sem título',
        author: v.authors?.[0] || 'Autor desconhecido',
        language: v.language ?? '',
        coverUrl: toHttps(v.imageLinks?.thumbnail),
        epubUrl: epub,
      };
    })
    .filter((b): b is CatalogBook => b !== null);

  return { results, hasNext: (data.totalItems ?? 0) > page * GB_MAX };
}

// ----------------- API pública -----------------

export async function searchCatalog(
  source: CatalogSource,
  query: string,
  lang: CatalogLang,
  page = 1,
): Promise<CatalogPage> {
  if (source === 'archive') return searchArchive(query, lang, page);
  if (source === 'google') return searchGoogleBooks(query, lang, page);
  return searchGutenberg(query, lang, page);
}

/**
 * Vitrine de CLÁSSICOS BRASILEIROS (o Gutenberg só tem o código `pt` genérico, sem
 * separar Brasil de Portugal). Em vez da popularidade crua do `pt` — que sobe obras de
 * Portugal —, buscamos autores brasileiros conhecidos e intercalamos para dar variedade.
 */
const AUTORES_BR = [
  'Machado de Assis',
  'José de Alencar',
  'Lima Barreto',
  'Aluísio Azevedo',
  'Bernardo Guimarães',
  'Manuel Antônio de Almeida',
  'Olavo Bilac',
];

export async function featuredBrazilian(): Promise<CatalogBook[]> {
  const listas = await Promise.all(
    AUTORES_BR.map((a) =>
      searchGutenberg(a, 'pt', 1)
        .then((p) => p.results)
        .catch(() => [] as CatalogBook[]),
    ),
  );
  // Intercala (1º de cada autor, depois o 2º…) e remove repetidos.
  const seen = new Set<string>();
  const out: CatalogBook[] = [];
  const maxLen = listas.reduce((m, l) => Math.max(m, l.length), 0);
  for (let i = 0; i < maxLen; i++) {
    for (const l of listas) {
      const b = l[i];
      if (b && !seen.has(b.id)) {
        seen.add(b.id);
        out.push(b);
      }
    }
  }
  return out;
}

/** URL final do EPUB. No Archive, busca o nome do arquivo via metadata API. */
export async function resolveEpubUrl(book: CatalogBook): Promise<string | null> {
  if (book.epubUrl) return book.epubUrl;
  if (book.source === 'archive' && book.iaIdentifier) {
    const r = await fetch(`https://archive.org/metadata/${book.iaIdentifier}`);
    if (!r.ok) return null;
    const d = (await r.json()) as { files?: { name?: string; format?: string }[] };
    const files = d.files ?? [];
    const epub = files.find(
      (f) =>
        (f.format ?? '').toUpperCase().includes('EPUB') ||
        (f.name ?? '').toLowerCase().endsWith('.epub'),
    );
    if (!epub?.name) return null;
    return `https://archive.org/download/${book.iaIdentifier}/${encodeURIComponent(epub.name)}`;
  }
  return null;
}
