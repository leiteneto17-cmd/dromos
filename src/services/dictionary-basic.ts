/**
 * Dicionário BÁSICO grátis (sem IA) — agora em PORTUGUÊS. Usa o Wiktionary em PT
 * (API REST pública da Wikimedia) e cai para o inglês como reserva.
 *
 * Antes o app consultava SÓ um dicionário em inglês (api.dictionaryapi.dev/.../en),
 * então toda palavra em português "não era encontrada". Este é o caminho rápido/grátis;
 * o significado CONTEXTUAL rico (no parágrafo, com sinônimos e exemplos) continua sendo o
 * "✨ Explicar no contexto (IA)" — services/ai/dictionary.ts.
 *
 * Limitação conhecida: dicionário lista o LEMA (ex.: "correr"), então formas flexionadas
 * ("correu") podem não casar — nesses casos a UI sugere a IA, que entende a flexão.
 */
export type BasicLookup =
  | { ok: true; defs: string[]; lang: 'pt' | 'en' }
  | { ok: false };

/** Remove tags HTML/entidades e normaliza espaços do texto da definição. */
function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

type WiktSite = 'pt' | 'en';
type WiktGroup = { definitions?: { definition?: string }[] };

/** Busca até 3 definições no Wiktionary do site indicado. Devolve [] se nada. */
async function fromWiktionary(word: string, site: WiktSite, signal?: AbortSignal): Promise<string[]> {
  const url = `https://${site}.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`;
  const res = await fetch(url, { headers: { accept: 'application/json' }, signal });
  if (!res.ok) return [];
  const data = (await res.json()) as Record<string, WiktGroup[]>;
  // Preferimos a língua do próprio site (pt no site pt); senão, o 1º grupo disponível.
  const groups = data[site] ?? Object.values(data)[0] ?? [];
  const out: string[] = [];
  for (const g of groups) {
    for (const d of g.definitions ?? []) {
      const txt = stripHtml(d.definition ?? '');
      if (txt) out.push(txt);
      if (out.length >= 3) return out;
    }
  }
  return out;
}

/** Tenta PT (palavra como está e em minúsculas) e cai para EN. */
export async function basicDefinitions(word: string, signal?: AbortSignal): Promise<BasicLookup> {
  const w = word.trim();
  if (!w) return { ok: false };

  const lower = w.toLowerCase();
  const variants = w === lower ? [w] : [w, lower];

  for (const v of variants) {
    try {
      const pt = await fromWiktionary(v, 'pt', signal);
      if (pt.length) return { ok: true, defs: pt, lang: 'pt' };
    } catch {
      // tenta a próxima variante / o inglês
    }
  }

  try {
    const en = await fromWiktionary(lower, 'en', signal);
    if (en.length) return { ok: true, defs: en, lang: 'en' };
  } catch {
    // sem rede / sem entrada
  }

  return { ok: false };
}
