/**
 * Cantinho do Estudo — "Clássicos de prova" (ENEM/vestibulares). Validação do
 * posicionamento "companheiro de estudo" ([[proximos-passos]] 2026-07-02): obras de
 * DOMÍNIO PÚBLICO que caem recorrentemente nas provas, todas com download em PT
 * verificado no Project Gutenberg (mesma fonte legal do Explorar — §4.3).
 *
 * O texto `note` ("o que as provas cobram") é escrito à mão e fica no campo seguro:
 * movimento literário + temas classicamente cobrados — sem inventar ano/edição de
 * prova específica. O simulado por IA (services/ai/simulado.ts) complementa isso.
 */
import type { CatalogBook } from '@/services/catalog';

export type EnemBook = {
  id: string;
  title: string;
  author: string;
  year: string;
  /** Escola/movimento literário — vira o chip do card. */
  movement: string;
  /** O que as provas costumam cobrar desta obra (2–3 linhas). */
  note: string;
  gutenbergId: number;
};

export const ENEM_BOOKS: EnemBook[] = [
  {
    id: 'enem-bras-cubas',
    title: 'Memórias Póstumas de Brás Cubas',
    author: 'Machado de Assis',
    year: '1881',
    movement: 'Realismo',
    note:
      'Marco inaugural do Realismo no Brasil. As provas adoram o "defunto autor", a ironia ' +
      'machadiana, a crítica à elite do século XIX e o pessimismo (a filosofia do Humanitas).',
    gutenbergId: 54829,
  },
  {
    id: 'enem-dom-casmurro',
    title: 'Dom Casmurro',
    author: 'Machado de Assis',
    year: '1899',
    movement: 'Realismo',
    note:
      'O narrador não confiável mais famoso da literatura brasileira: Capitu traiu ou não? ' +
      'Cobra-se o ciúme de Bentinho, os "olhos de ressaca" e a ambiguidade proposital do texto.',
    gutenbergId: 55752,
  },
  {
    id: 'enem-o-cortico',
    title: 'O Cortiço',
    author: 'Aluísio Azevedo',
    year: '1890',
    movement: 'Naturalismo',
    note:
      'A obra-símbolo do Naturalismo: determinismo (meio molda o homem), zoomorfização das ' +
      'personagens e o cortiço como personagem coletivo. Presença constante em provas.',
    gutenbergId: 69187,
  },
  {
    id: 'enem-iracema',
    title: 'Iracema',
    author: 'José de Alencar',
    year: '1865',
    movement: 'Romantismo indianista',
    note:
      'A "virgem dos lábios de mel": idealização do indígena, mito de fundação do Brasil ' +
      '(Iracema = anagrama de América) e prosa poética. Clássico do Romantismo nas provas.',
    gutenbergId: 67740,
  },
  {
    id: 'enem-o-ateneu',
    title: 'O Ateneu',
    author: 'Raul Pompéia',
    year: '1888',
    movement: 'Realismo/Impressionismo',
    note:
      'Romance de formação num internato: memória, crítica à sociedade do Império em ' +
      'miniatura e o estilo impressionista de Sérgio. Frequente em listas de vestibular.',
    gutenbergId: 68541,
  },
  {
    id: 'enem-quincas-borba',
    title: 'Quincas Borba',
    author: 'Machado de Assis',
    year: '1891',
    movement: 'Realismo',
    note:
      'Sequência do universo de Brás Cubas: o Humanitas ("ao vencedor, as batatas!"), a ' +
      'loucura de Rubião e a ganância do casal Palha. Cobra-se a crítica social machadiana.',
    gutenbergId: 55682,
  },
  {
    id: 'enem-o-alienista',
    title: 'Papéis Avulsos (com O Alienista)',
    author: 'Machado de Assis',
    year: '1882',
    movement: 'Realismo · contos',
    note:
      'O Alienista é o conto mais cobrado de Machado: Simão Bacamarte e a Casa Verde — os ' +
      'limites entre razão e loucura e a sátira ao cientificismo. Ótimo para leitura rápida.',
    gutenbergId: 57001,
  },
  {
    id: 'enem-escrava-isaura',
    title: 'A Escrava Isaura',
    author: 'Bernardo Guimarães',
    year: '1875',
    movement: 'Romantismo',
    note:
      'Romance abolicionista do Romantismo: a idealização da heroína branca escravizada e os ' +
      'limites da crítica à escravidão no século XIX — ângulo comum em questões de prova.',
    gutenbergId: 74475,
  },
];

/** Converte para o modelo do catálogo (mesmo download/leitor do Explorar). */
export function enemToCatalogBook(b: EnemBook): CatalogBook {
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
