/**
 * Moderação client-side BÁSICA (CLAUDE.md §4.8) — primeira linha de defesa para a
 * Diretriz Apple 1.2 (conteúdo gerado por usuário). Filtra termos ofensivos em
 * NOMES DE PERFIL antes de enviar ao Supabase.
 *
 * NÃO substitui a moderação completa do feed social (denúncia + bloqueio + contato),
 * que é OBRIGATÓRIA e entra na Fase 5b junto com o feed (Comunidade hoje é só prévia).
 *
 * Conservador de propósito: casa PALAVRA INTEIRA sobre o texto normalizado (minúsculo,
 * sem acento) para evitar falsos positivos do tipo "Scunthorpe" (ex.: "assistir").
 */
const BLOCKLIST = [
  // PT-BR (termos ofensivos fortes)
  'porra', 'caralho', 'buceta', 'viado', 'veado', 'puta', 'arrombado', 'corno',
  'fdp', 'cuzao', 'piranha', 'vagabunda', 'vadia', 'retardado', 'baitola',
  // EN (palavrões fortes / slurs)
  'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'nigger', 'faggot', 'retard', 'slut', 'whore',
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos (combining marks)
    .replace(/[^a-z0-9\s]/g, ' '); // pontuação → espaço
}

/** true se o texto contém algum termo bloqueado (como palavra inteira). */
export function containsProfanity(text: string): boolean {
  const words = new Set(normalize(text).split(/\s+/).filter(Boolean));
  return BLOCKLIST.some((bad) => words.has(bad));
}
