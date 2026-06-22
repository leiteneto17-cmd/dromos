/** Remove pontuação do início/fim de uma palavra (mantém letras/acentos/números/internos). */
export function cleanWord(token: string): string {
  return token.replace(/^[^A-Za-zÀ-ÿ0-9]+|[^A-Za-zÀ-ÿ0-9]+$/g, '');
}

/** Divide o texto cru em parágrafos (separados por linha em branco). */
export function splitParagraphs(text: string): string[] {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 0);
}
