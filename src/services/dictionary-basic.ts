/**
 * Dicionário BÁSICO grátis (sem IA) — em PORTUGUÊS. Tenta, nesta ordem:
 *  1. Dicionário Aberto (dicionario-aberto.net) — dicionário PT dedicado, bem confiável;
 *  2. Wiktionary PT (Wikimedia REST);
 *  3. Wiktionary EN (reserva, para termos técnicos/estrangeiros).
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

// A Wikimedia exige um User-Agent descritivo; sem ele a API pode responder 403.
const UA = 'mais-leitura/1.0 (app de leitura; dicionario contextual)';

/** Remove tags HTML/XML e entidades, normalizando espaços. */
function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 1) Dicionário Aberto: devolve entradas com um campo `xml` contendo tags <def>. */
async function fromDicionarioAberto(word: string, signal?: AbortSignal): Promise<string[]> {
  const url = `https://api.dicionario-aberto.net/word/${encodeURIComponent(word.toLowerCase())}`;
  const res = await fetch(url, { headers: { accept: 'application/json' }, signal });
  if (!res.ok) return [];
  const data = (await res.json()) as { xml?: string }[];
  const out: string[] = [];
  for (const entry of data ?? []) {
    const defs = (entry.xml ?? '').match(/<def>([\s\S]*?)<\/def>/gi) ?? [];
    for (const d of defs) {
      const txt = stripHtml(d);
      if (txt) out.push(txt);
      if (out.length >= 3) return out;
    }
  }
  return out;
}

type WiktSite = 'pt' | 'en';
type WiktGroup = { definitions?: { definition?: string }[] };

/** 2/3) Wiktionary do site indicado. Devolve até 3 definições, ou [] se nada. */
async function fromWiktionary(word: string, site: WiktSite, signal?: AbortSignal): Promise<string[]> {
  const url = `https://${site}.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`;
  const res = await fetch(url, {
    headers: { accept: 'application/json', 'User-Agent': UA, 'Api-User-Agent': UA },
    signal,
  });
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

/** Tenta as fontes PT (Dicionário Aberto → Wiktionary PT) e cai para EN. */
export async function basicDefinitions(word: string, signal?: AbortSignal): Promise<BasicLookup> {
  const w = word.trim();
  if (!w) return { ok: false };
  const lower = w.toLowerCase();

  // 1) Dicionário Aberto (PT)
  try {
    const da = await fromDicionarioAberto(lower, signal);
    if (da.length) return { ok: true, defs: da, lang: 'pt' };
  } catch {
    // segue para as próximas fontes
  }

  // 2) Wiktionary PT (palavra como está e em minúsculas — títulos são case-sensitive)
  for (const v of w === lower ? [w] : [w, lower]) {
    try {
      const pt = await fromWiktionary(v, 'pt', signal);
      if (pt.length) return { ok: true, defs: pt, lang: 'pt' };
    } catch {
      // tenta a próxima variante / o inglês
    }
  }

  // 3) Wiktionary EN (reserva)
  try {
    const en = await fromWiktionary(lower, 'en', signal);
    if (en.length) return { ok: true, defs: en, lang: 'en' };
  } catch {
    // sem rede / sem entrada
  }

  return { ok: false };
}
