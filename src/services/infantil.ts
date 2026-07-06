/**
 * Dromos Kids — "Clássicos Infantis". Prateleira curada de histórias de DOMÍNIO PÚBLICO
 * para crianças, em português, seguindo a mesma regra legal do Explorar (§4.3) e o mesmo
 * download/leitor (services/catalog-download.ts), igual ao Cantinho do Estudo (enem.ts).
 *
 * FONTES (todas verificadas em 2026-07-06):
 *  - Project Gutenberg (Gutendex), EPUB em PT — IDs conferidos por API (não inventados):
 *      30510 "Pérolas e Diamantes: Contos Infantis" (Grimm)
 *      16429 "Contos para a Infância" (Guerra Junqueiro)
 *      45840 "Histórias de Reis e Príncipes" (Alberto Pimentel)
 *  - Acervo PRÓPRIO (bucket público `acervo` no Supabase Storage), traduções PT que o
 *    Gutenberg não tem: `alice-pt.pdf`, `peter-pan-pt.pdf` (HTTP 200 confirmado).
 *
 * FAIXAS ETÁRIAS (portão de entrada da UX pedida): um livro pode servir a mais de uma
 * faixa. É um FILTRO suave — "Todas" mostra tudo. O acervo é pequeno de propósito nesta v1
 * (só título verificado entra); cresce pelo mesmo curated_books/Storage sem republicar app.
 */
import type { CatalogBook } from '@/services/catalog';
import { SUPABASE_URL } from '@/services/supabase';

export type AgeBand = '3-5' | '6-8' | '9-12';

export const AGE_BANDS: { id: AgeBand; label: string; hint: string; emoji: string }[] = [
  { id: '3-5', label: '3 a 5 anos', hint: 'Para ouvir e ver figuras', emoji: '🧸' },
  { id: '6-8', label: '6 a 8 anos', hint: 'Começando a ler', emoji: '🌈' },
  { id: '9-12', label: '9 a 12 anos', hint: 'Pequenos leitores', emoji: '🚀' },
];

export type KidsBook = {
  id: string;
  title: string;
  author: string;
  ageBands: AgeBand[];
  /** Descrição curta e afetuosa (para a criança/responsável). */
  blurb: string;
  /** Emoji decorativo do card (o "brilho mágico" no lugar da capa quando ela falta). */
  emoji: string;
  gutenbergId?: number;
  /** URL direta do acervo próprio (quando não é Gutenberg). */
  fileUrl?: string;
  format?: 'epub' | 'pdf';
  coverUrl?: string | null;
};

/** URL pública de um arquivo do bucket `acervo` (vazia se o Supabase não está configurado). */
function acervo(file: string): string {
  return SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/acervo/${file}` : '';
}

export const KIDS_BOOKS: KidsBook[] = [
  {
    id: 'kids-grimm-contos',
    title: 'Pérolas e Diamantes: Contos Infantis',
    author: 'Irmãos Grimm',
    ageBands: ['3-5', '6-8'],
    blurb: 'Contos de fadas clássicos dos Irmãos Grimm — perfeitos para ler junto na hora de dormir.',
    emoji: '🧚',
    gutenbergId: 30510,
  },
  {
    id: 'kids-alice',
    title: 'Alice no País das Maravilhas',
    author: 'Lewis Carroll',
    ageBands: ['6-8', '9-12'],
    blurb: 'Alice cai na toca do coelho e vive um mundo de lógica de cabeça para baixo. Pura imaginação.',
    emoji: '🐇',
    fileUrl: acervo('alice-pt.pdf'),
    format: 'pdf',
  },
  {
    id: 'kids-peter-pan',
    title: 'Peter Pan',
    author: 'J. M. Barrie',
    ageBands: ['6-8'],
    blurb: 'O menino que não queria crescer, a Terra do Nunca e as aventuras com os Meninos Perdidos.',
    emoji: '🧚‍♂️',
    fileUrl: acervo('peter-pan-pt.pdf'),
    format: 'pdf',
  },
  {
    id: 'kids-junqueiro-infancia',
    title: 'Contos para a Infância',
    author: 'Guerra Junqueiro',
    ageBands: ['6-8', '9-12'],
    blurb: 'Uma seleção dos melhores contos para crianças, reunida pelo poeta Guerra Junqueiro.',
    emoji: '📚',
    gutenbergId: 16429,
  },
  {
    id: 'kids-reis-principes',
    title: 'Histórias de Reis e Príncipes',
    author: 'Alberto Pimentel',
    ageBands: ['9-12'],
    blurb: 'Reis, princesas e castelos em histórias encantadas para os pequenos leitores mais crescidos.',
    emoji: '👑',
    gutenbergId: 45840,
  },
];

/** Converte para o modelo do catálogo (mesmo download/leitor do Explorar). */
export function kidsToCatalogBook(b: KidsBook): CatalogBook {
  if (b.gutenbergId) {
    return {
      id: b.id,
      source: 'gutenberg',
      title: b.title,
      author: b.author,
      language: 'pt',
      coverUrl: `https://www.gutenberg.org/cache/epub/${b.gutenbergId}/pg${b.gutenbergId}.cover.medium.jpg`,
      epubUrl: `https://www.gutenberg.org/ebooks/${b.gutenbergId}.epub3.images`,
      format: 'epub',
    };
  }
  return {
    id: b.id,
    source: 'curated',
    title: b.title,
    author: b.author,
    language: 'pt',
    coverUrl: b.coverUrl ?? null,
    epubUrl: b.fileUrl ?? null,
    format: b.format ?? 'pdf',
  };
}
