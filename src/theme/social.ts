/**
 * "Pele" social/stats do app — identidade ROXO + VERDE (CLAUDE.md §2.7).
 * É distinta da pele do leitor (sépia/claro/escuro em src/theme/reading.ts):
 * o HUB, Comunidade, Atividades, Conquistas e Perfil usam ESTE tema escuro
 * premium; só a tela de leitura usa as cores do livro.
 */
export const Social = {
  // fundo (gradiente do roxo profundo → quase preto)
  purpleTop: '#3B2A63',
  purpleMid: '#241B3D',
  dark: '#0E0B16',
  // superfícies de card
  card: '#1B1530',
  cardSoft: '#221A3A',
  border: '#2E2247',
  // destaques verdes (números/CTA) — com glow
  green: '#7DF3AD',
  greenDeep: '#3EE89A',
  // rótulos e textos
  lavender: '#B9A6E8',
  white: '#EDEAF5',
  muted: '#8B82A8',
} as const;

/** Gradiente de fundo padrão das telas sociais. */
export const SocialGradient = [Social.purpleTop, Social.purpleMid, Social.dark] as const;
