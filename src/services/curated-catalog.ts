/**
 * Acervo próprio CURADO (CLAUDE.md §4.3) — clássicos de domínio público escolhidos a
 * dedo, com licença verificada. Resolve o buraco do Explorar: o Project Gutenberg NÃO
 * tem traduções em PT de clássicos estrangeiros (Sun Tzu, Maquiavel, Platão…), então
 * esses títulos nunca apareciam na busca. Aqui garantimos a presença deles.
 *
 * COMO O CATÁLOGO É CARREGADO (decisão do usuário, 2026-06-28):
 *  1. Tenta um MANIFESTO JSON remoto no Supabase Storage (bucket público `acervo`,
 *     arquivo `catalog.json`) — assim dá para ADICIONAR LIVROS SEM REPUBLICAR o app.
 *  2. Se o manifesto não existir / estiver offline, cai na LISTA-SEMENTE abaixo
 *     (embutida no app), para o recurso já funcionar e ser testável de imediato.
 *
 * FORMATO de cada item do catalog.json (= tipo CuratedEntry):
 *   {
 *     "title": "A Arte da Guerra",
 *     "author": "Sun Tzu",
 *     "language": "pt",
 *     "epubUrl": "https://SEU-PROJETO.supabase.co/storage/v1/object/public/acervo/sun-tzu.epub",
 *     "coverUrl": "https://.../capa.jpg"
 *   }
 * Suba o EPUB no Storage (bucket público `acervo`) e cole a URL pública em `epubUrl`.
 */
import type { CatalogBook, CatalogLang } from '@/services/catalog';
import { SUPABASE_URL, supabase } from '@/services/supabase';

export type CuratedEntry = {
  title: string;
  author: string;
  /** 'pt' | 'en' | … — usado pelo filtro de idioma do Explorar. */
  language: string;
  epubUrl: string;
  coverUrl?: string | null;
  /** Formato do arquivo (default 'epub'). O acervo próprio pode ter PDF. */
  format?: 'epub' | 'pdf';
};

/** Manifesto no Storage (bucket público `acervo`). Vazio se o Supabase não está configurado. */
const MANIFEST_URL = SUPABASE_URL
  ? `${SUPABASE_URL}/storage/v1/object/public/acervo/catalog.json`
  : '';

/**
 * LISTA-SEMENTE — exemplos REAIS de domínio público para o recurso já funcionar antes de
 * você subir o seu acervo. TROQUE/AUMENTE pelo catalog.json no Supabase.
 *
 * Sun Tzu está aqui de propósito: é o título que o usuário buscou e o Explorar não achava
 * (o Gutenberg só tem em inglês). Quando você hospedar uma TRADUÇÃO EM PT, adicione-a ao
 * catalog.json com "language": "pt".
 */
const SEED: CuratedEntry[] = [
  // --- Catálogo PT-BR (decisão do usuário 2026-07-04: acervo só em português). Os clássicos
  // universais em inglês foram REMOVIDOS; entram como TRADUÇÕES PT hospedadas no nosso acervo
  // (curated_books/Storage) quando prontas. Clássicos brasileiros/portugueses via Gutenberg: ---
  { title: 'Dom Casmurro', author: 'Machado de Assis', language: 'pt', epubUrl: 'https://www.gutenberg.org/ebooks/55752.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/55752/pg55752.cover.medium.jpg' },
  { title: 'Quincas Borba', author: 'Machado de Assis', language: 'pt', epubUrl: 'https://www.gutenberg.org/ebooks/55682.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/55682/pg55682.cover.medium.jpg' },
  { title: 'O Cortiço', author: 'Aluísio Azevedo', language: 'pt', epubUrl: 'https://www.gutenberg.org/ebooks/69187.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/69187/pg69187.cover.medium.jpg' },
  { title: 'Iracema', author: 'José de Alencar', language: 'pt', epubUrl: 'https://www.gutenberg.org/ebooks/67740.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/67740/pg67740.cover.medium.jpg' },
];

/**
 * Formato do arquivo com blindagem contra cadastro errado no banco: a EXTENSÃO da URL
 * vence o campo `format` (a coluna tem default 'epub' — um INSERT sem ela mandava PDF
 * pro pipeline de EPUB e quebrava o leitor). Sem extensão reconhecível, vale o declarado.
 */
function inferFormat(declared: string | undefined | null, url: string): 'epub' | 'pdf' {
  const path = url.split(/[?#]/)[0].toLowerCase();
  if (path.endsWith('.pdf')) return 'pdf';
  if (path.endsWith('.epub')) return 'epub';
  return declared === 'pdf' ? 'pdf' : 'epub';
}

function toCatalogBook(e: CuratedEntry, i: number): CatalogBook {
  return {
    id: `curated-${i}-${e.title}`,
    source: 'curated',
    title: e.title,
    author: e.author,
    language: e.language,
    coverUrl: e.coverUrl ?? null,
    epubUrl: e.epubUrl,
    format: inferFormat(e.format, e.epubUrl),
  };
}

/** Lê o acervo da TABELA `curated_books` (fonte de verdade). null se sem Supabase/vazio/erro. */
async function loadFromDB(): Promise<CuratedEntry[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('curated_books')
      .select('title, author, language, format, file_url, cover_url')
      .eq('active', true)
      .order('sort_order', { ascending: false });
    if (error || !data || data.length === 0) return null;
    return (data as {
      title: string;
      author: string | null;
      language: string | null;
      format: string | null;
      file_url: string;
      cover_url: string | null;
    }[]).map((r) => ({
      title: r.title,
      author: r.author ?? '',
      language: r.language ?? 'pt',
      epubUrl: r.file_url,
      coverUrl: r.cover_url,
      format: r.format === 'pdf' ? 'pdf' : 'epub',
    }));
  } catch {
    return null; // offline / tabela ainda não criada → cai no JSON/semente
  }
}

/** Cache de sessão (reinicia o app para reler o manifesto). */
let cache: CatalogBook[] | null = null;

/**
 * Carrega o acervo curado. Ordem de prioridade:
 *   1. TABELA `curated_books` no Supabase (fonte de verdade — gerida por SQL/painel);
 *   2. manifesto `catalog.json` no Storage (legado);
 *   3. LISTA-SEMENTE embutida (offline / nada configurado).
 * Memoiza na sessão (reinicie o app para reler).
 */
export async function loadCurated(): Promise<CatalogBook[]> {
  if (cache) return cache;
  let entries: CuratedEntry[] | null = await loadFromDB();
  if (!entries && MANIFEST_URL) {
    try {
      const r = await fetch(MANIFEST_URL);
      if (r.ok) {
        const data = (await r.json()) as CuratedEntry[];
        if (Array.isArray(data) && data.length) entries = data;
      }
    } catch {
      // offline / manifesto ainda não existe → usa a semente embutida
    }
  }
  cache = (entries ?? SEED).filter((e) => e?.title && e?.epubUrl).map(toCatalogBook);
  return cache;
}

/** Filtra o acervo curado por idioma + termo (título/autor, sem distinção de maiúsculas). */
export function filterCurated(
  books: CatalogBook[],
  query: string,
  lang: CatalogLang,
): CatalogBook[] {
  const q = query.trim().toLowerCase();
  return books.filter((b) => {
    if (lang !== 'all' && b.language && b.language !== lang) return false;
    if (!q) return true;
    return b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q);
  });
}
