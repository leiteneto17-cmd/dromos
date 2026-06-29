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
import { SUPABASE_URL } from '@/services/supabase';

export type CuratedEntry = {
  title: string;
  author: string;
  /** 'pt' | 'en' | … — usado pelo filtro de idioma do Explorar. */
  language: string;
  epubUrl: string;
  coverUrl?: string | null;
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
  // --- Clássicos universais (edições em domínio público; em INGLÊS via Gutenberg).
  // Aparecem em "Todos"/"Inglês". Para mostrá-los em "Português", hospede a tradução
  // PT no catalog.json com "language": "pt". Títulos verificados em 2026-06-28. ---
  { title: 'A Arte da Guerra (The Art of War)', author: 'Sun Tzu', language: 'en', epubUrl: 'https://www.gutenberg.org/ebooks/132.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/132/pg132.cover.medium.jpg' },
  { title: 'A Divina Comédia (The Divine Comedy)', author: 'Dante Alighieri', language: 'en', epubUrl: 'https://www.gutenberg.org/ebooks/1004.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/1004/pg1004.cover.medium.jpg' },
  { title: 'O Príncipe (The Prince)', author: 'Maquiavel', language: 'en', epubUrl: 'https://www.gutenberg.org/ebooks/1232.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/1232/pg1232.cover.medium.jpg' },
  { title: 'Meditações (Meditations)', author: 'Marco Aurélio', language: 'en', epubUrl: 'https://www.gutenberg.org/ebooks/2680.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/2680/pg2680.cover.medium.jpg' },
  { title: 'Assim Falou Zaratustra', author: 'Friedrich Nietzsche', language: 'en', epubUrl: 'https://www.gutenberg.org/ebooks/1998.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/1998/pg1998.cover.medium.jpg' },
  { title: 'A República (The Republic)', author: 'Platão', language: 'en', epubUrl: 'https://www.gutenberg.org/ebooks/1497.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/1497/pg1497.cover.medium.jpg' },
  { title: 'Crime e Castigo (Crime and Punishment)', author: 'Dostoiévski', language: 'en', epubUrl: 'https://www.gutenberg.org/ebooks/2554.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/2554/pg2554.cover.medium.jpg' },
  { title: 'Os Irmãos Karamázov', author: 'Dostoiévski', language: 'en', epubUrl: 'https://www.gutenberg.org/ebooks/28054.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/28054/pg28054.cover.medium.jpg' },
  { title: 'Guerra e Paz (War and Peace)', author: 'Liev Tolstói', language: 'en', epubUrl: 'https://www.gutenberg.org/ebooks/2600.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/2600/pg2600.cover.medium.jpg' },
  { title: 'Anna Kariênina (Anna Karenina)', author: 'Liev Tolstói', language: 'en', epubUrl: 'https://www.gutenberg.org/ebooks/1399.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/1399/pg1399.cover.medium.jpg' },
  { title: 'Orgulho e Preconceito (Pride and Prejudice)', author: 'Jane Austen', language: 'en', epubUrl: 'https://www.gutenberg.org/ebooks/1342.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg' },
  { title: 'Frankenstein', author: 'Mary Shelley', language: 'en', epubUrl: 'https://www.gutenberg.org/ebooks/84.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/84/pg84.cover.medium.jpg' },
  { title: 'Drácula (Dracula)', author: 'Bram Stoker', language: 'en', epubUrl: 'https://www.gutenberg.org/ebooks/345.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/345/pg345.cover.medium.jpg' },
  { title: 'As Aventuras de Sherlock Holmes', author: 'Arthur Conan Doyle', language: 'en', epubUrl: 'https://www.gutenberg.org/ebooks/1661.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/1661/pg1661.cover.medium.jpg' },
  { title: 'Moby Dick', author: 'Herman Melville', language: 'en', epubUrl: 'https://www.gutenberg.org/ebooks/2701.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/2701/pg2701.cover.medium.jpg' },
  { title: 'O Conde de Monte Cristo (Monte Cristo)', author: 'Alexandre Dumas', language: 'en', epubUrl: 'https://www.gutenberg.org/ebooks/1184.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/1184/pg1184.cover.medium.jpg' },
  { title: 'Os Miseráveis (Les Misérables)', author: 'Victor Hugo', language: 'en', epubUrl: 'https://www.gutenberg.org/ebooks/135.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/135/pg135.cover.medium.jpg' },
  { title: 'Dom Quixote (Don Quixote)', author: 'Miguel de Cervantes', language: 'en', epubUrl: 'https://www.gutenberg.org/ebooks/996.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/996/pg996.cover.medium.jpg' },
  { title: 'A Ilíada (The Iliad)', author: 'Homero', language: 'en', epubUrl: 'https://www.gutenberg.org/ebooks/6130.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/6130/pg6130.cover.medium.jpg' },
  { title: 'A Odisseia (The Odyssey)', author: 'Homero', language: 'en', epubUrl: 'https://www.gutenberg.org/ebooks/1727.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/1727/pg1727.cover.medium.jpg' },
  { title: 'Hamlet', author: 'William Shakespeare', language: 'en', epubUrl: 'https://www.gutenberg.org/ebooks/27761.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/27761/pg27761.cover.medium.jpg' },
  { title: 'Romeu e Julieta (Romeo and Juliet)', author: 'William Shakespeare', language: 'en', epubUrl: 'https://www.gutenberg.org/ebooks/1513.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/1513/pg1513.cover.medium.jpg' },
  { title: 'O Retrato de Dorian Gray', author: 'Oscar Wilde', language: 'en', epubUrl: 'https://www.gutenberg.org/ebooks/174.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/174/pg174.cover.medium.jpg' },
  { title: 'Alice no País das Maravilhas', author: 'Lewis Carroll', language: 'en', epubUrl: 'https://www.gutenberg.org/ebooks/11.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/11/pg11.cover.medium.jpg' },
  { title: 'A Máquina do Tempo (The Time Machine)', author: 'H. G. Wells', language: 'en', epubUrl: 'https://www.gutenberg.org/ebooks/35.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/35/pg35.cover.medium.jpg' },
  { title: 'A Guerra dos Mundos (War of the Worlds)', author: 'H. G. Wells', language: 'en', epubUrl: 'https://www.gutenberg.org/ebooks/36.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/36/pg36.cover.medium.jpg' },
  { title: 'A Metamorfose (Metamorphosis)', author: 'Franz Kafka', language: 'en', epubUrl: 'https://www.gutenberg.org/ebooks/5200.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/5200/pg5200.cover.medium.jpg' },
  { title: 'O Coração das Trevas (Heart of Darkness)', author: 'Joseph Conrad', language: 'en', epubUrl: 'https://www.gutenberg.org/ebooks/219.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/219/pg219.cover.medium.jpg' },
  { title: 'Contos de Grimm', author: 'Irmãos Grimm', language: 'en', epubUrl: 'https://www.gutenberg.org/ebooks/2591.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/2591/pg2591.cover.medium.jpg' },

  // --- Clássicos brasileiros/portugueses (em PT via Gutenberg). Aparecem em "Português". ---
  { title: 'Dom Casmurro', author: 'Machado de Assis', language: 'pt', epubUrl: 'https://www.gutenberg.org/ebooks/55752.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/55752/pg55752.cover.medium.jpg' },
  { title: 'Quincas Borba', author: 'Machado de Assis', language: 'pt', epubUrl: 'https://www.gutenberg.org/ebooks/55682.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/55682/pg55682.cover.medium.jpg' },
  { title: 'O Cortiço', author: 'Aluísio Azevedo', language: 'pt', epubUrl: 'https://www.gutenberg.org/ebooks/69187.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/69187/pg69187.cover.medium.jpg' },
  { title: 'Iracema', author: 'José de Alencar', language: 'pt', epubUrl: 'https://www.gutenberg.org/ebooks/67740.epub3.images', coverUrl: 'https://www.gutenberg.org/cache/epub/67740/pg67740.cover.medium.jpg' },
];

function toCatalogBook(e: CuratedEntry, i: number): CatalogBook {
  return {
    id: `curated-${i}-${e.title}`,
    source: 'curated',
    title: e.title,
    author: e.author,
    language: e.language,
    coverUrl: e.coverUrl ?? null,
    epubUrl: e.epubUrl,
  };
}

/** Cache de sessão (reinicia o app para reler o manifesto). */
let cache: CatalogBook[] | null = null;

/** Carrega o acervo curado (manifesto remoto → senão a semente). Memoiza na sessão. */
export async function loadCurated(): Promise<CatalogBook[]> {
  if (cache) return cache;
  let entries: CuratedEntry[] = SEED;
  if (MANIFEST_URL) {
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
  cache = entries.filter((e) => e?.title && e?.epubUrl).map(toCatalogBook);
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
