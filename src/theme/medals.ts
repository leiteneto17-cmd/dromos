/**
 * Arte das conquistas (roxo+verde, §2.7) — uma imagem por emblema, indexada pelo
 * `id` do catálogo em `computeAchievements` (services/progress.ts). Os arquivos em
 * `assets/medalhas/` foram renomeados para slugs ASCII = id (sem espaços/acentos/+),
 * porque nomes com esses caracteres quebram o empacotamento de assets no Android (§4).
 *
 * `require` exige string literal estática (o Metro resolve em build), por isso o mapa
 * é explícito. Use `medalImage(id)` — devolve `undefined` se ainda não houver arte,
 * para a UI cair no emoji como fallback.
 */
import type { ImageSourcePropType } from 'react-native';

const MEDALS: Record<string, ImageSourcePropType> = {
  'first-book': require('@/assets/medalhas/first-book.png'),
  'first-mark': require('@/assets/medalhas/first-mark.png'),
  shelf: require('@/assets/medalhas/shelf.png'),
  collector: require('@/assets/medalhas/collector.png'),
  'streak-3': require('@/assets/medalhas/streak-3.png'),
  'streak-7': require('@/assets/medalhas/streak-7.png'),
  'streak-14': require('@/assets/medalhas/streak-14.png'),
  'streak-30': require('@/assets/medalhas/streak-30.png'),
  'hour-1': require('@/assets/medalhas/hour-1.png'),
  'hour-10': require('@/assets/medalhas/hour-10.png'),
  'hour-50': require('@/assets/medalhas/hour-50.png'),
  marathon: require('@/assets/medalhas/marathon.png'),
  'pages-burst': require('@/assets/medalhas/pages-burst.png'),
  'pages-100': require('@/assets/medalhas/pages-100.png'),
  'pages-1000': require('@/assets/medalhas/pages-1000.png'),
  'book-done': require('@/assets/medalhas/book-done.png'),
  'night-owl': require('@/assets/medalhas/night-owl.png'),
  'words-10': require('@/assets/medalhas/words-10.png'),
  'words-50': require('@/assets/medalhas/words-50.png'),
  'words-100': require('@/assets/medalhas/words-100.png'),
  // Brasão especial de FUNDADOR (primeiros 50) — não é conquista de leitura (§founder).
  founder: require('@/assets/medalhas/founder.png'),
};

/** Imagem do emblema para um `id` de conquista, ou `undefined` se não houver arte. */
export function medalImage(id: string): ImageSourcePropType | undefined {
  return MEDALS[id];
}
