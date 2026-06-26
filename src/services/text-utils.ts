/** Remove pontuação do início/fim de uma palavra (mantém letras/acentos/números/internos). */
export function cleanWord(token: string): string {
  return token.replace(/^[^A-Za-zÀ-ÿ0-9]+|[^A-Za-zÀ-ÿ0-9]+$/g, '');
}

/**
 * Limpa um trecho para virar uma CITAÇÃO legível (card compartilhável §2.6):
 *  - normaliza espaços; corta na FRONTEIRA DE PALAVRA (nunca no meio);
 *  - adiciona reticências "…" quando o texto foi cortado.
 * `assumeCut` força o "…" quando o trecho JÁ chegou truncado de fora (ex.: bookmarks
 * antigos guardados com `slice(0, 90)`, que terminavam no meio da palavra).
 */
export function cleanSnippet(raw: string, max = 180, assumeCut = false): string {
  const t = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const ENDERS = /[.!?…"”»)]$/;
  if (t.length <= max) {
    // Trecho já curto: só "remenda" se parece ter sido cortado à força (perto do cap antigo).
    if (assumeCut && t.length >= 80 && !ENDERS.test(t)) {
      const sp = t.lastIndexOf(' ');
      const base = sp > t.length * 0.5 ? t.slice(0, sp) : t;
      return base.replace(/[\s,;:—-]+$/, '') + '…';
    }
    return t;
  }
  let cut = t.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  if (sp > max * 0.6) cut = cut.slice(0, sp);
  return cut.replace(/[\s.,;:!?—-]+$/, '') + '…';
}

/** Divide o texto cru em parágrafos (separados por linha em branco). */
export function splitParagraphs(text: string): string[] {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 0);
}
