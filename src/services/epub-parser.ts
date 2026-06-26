/**
 * Parser de EPUB (puro JS, funciona no Expo Go — sem WebView).
 *
 * EPUB = um ZIP com META-INF/container.xml (aponta o OPF), o OPF (manifest +
 * spine = ordem de leitura) e arquivos XHTML (os capítulos).
 *
 * Para não travar o app, a leitura é **preguiçosa**:
 *  - `openEpub(uri)` lê só a estrutura (título, autor, ordem dos capítulos) → rápido.
 *  - `loadChapter(zip, path)` lê e converte UM capítulo em texto, sob demanda.
 * Ver CLAUDE.md §4.6 (virtualizar/paginar) e §4.9.
 */
import { File, Paths } from 'expo-file-system';
import JSZip from 'jszip';

import { splitParagraphs } from '@/services/text-utils';

export type EpubChapterRef = { path: string };
export type EpubHandle = {
  title?: string;
  author?: string;
  chapters: EpubChapterRef[];
  /** Caminho (dentro do zip) da imagem de capa, quando o EPUB declara uma. */
  coverPath?: string;
  zip: JSZip;
};

/** Limite de segurança de memória. Leitura é preguiçosa+virtualizada → folga maior. */
const MAX_EPUB_BYTES = 60 * 1024 * 1024;

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(parseInt(n, 10)));
}

/** Converte o XHTML de um capítulo em texto com parágrafos (\n\n). */
function htmlToText(html: string): string {
  let s = html;
  s = s.replace(/<head[\s\S]*?<\/head>/gi, '');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<\/(p|div|h[1-6]|li|blockquote|section|article|tr)>/gi, '\n\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
  s = decodeEntities(s);
  s = s.replace(/[ \t]+/g, ' ');
  s = s.replace(/\n[ \t]+/g, '\n').replace(/[ \t]+\n/g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(name + '\\s*=\\s*"([^"]*)"', 'i'));
  return m ? m[1] : undefined;
}

function dirOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i >= 0 ? path.slice(0, i + 1) : '';
}

/** Resolve "base + rel" tratando ./ e ../ (caminhos dentro do zip). */
function joinPath(base: string, rel: string): string {
  const stack: string[] = [];
  for (const seg of (base + rel).split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') stack.pop();
    else stack.push(seg);
  }
  return stack.join('/');
}

/** Lê só a estrutura do EPUB (rápido). */
export async function openEpub(uri: string): Promise<EpubHandle> {
  const bytes = await new File(uri).bytes();
  if (bytes.length > MAX_EPUB_BYTES) {
    throw new Error('EPUB grande demais para abrir no aparelho por enquanto (até ~60 MB).');
  }

  const zip = await JSZip.loadAsync(bytes);

  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) throw new Error('EPUB inválido (sem container.xml).');
  const container = await containerFile.async('text');
  const opfPath = container.match(/full-path\s*=\s*"([^"]+)"/i)?.[1];
  if (!opfPath) throw new Error('EPUB inválido (OPF não encontrado).');

  const opfFile = zip.file(opfPath);
  if (!opfFile) throw new Error('EPUB inválido (OPF ausente).');
  const opf = await opfFile.async('text');
  const opfDir = dirOf(opfPath);

  const title = decodeEntities(opf.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i)?.[1]?.trim() ?? '');
  const author = decodeEntities(
    opf.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i)?.[1]?.trim() ?? '',
  );

  // manifest: id -> href
  const manifest: Record<string, string> = {};
  const itemRe = /<item\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(opf))) {
    const id = attr(m[0], 'id');
    const href = attr(m[0], 'href');
    if (id && href) manifest[id] = href;
  }

  // spine: ordem de leitura (sem ler o texto ainda)
  const chapters: EpubChapterRef[] = [];
  const refRe = /<itemref\b[^>]*>/gi;
  while ((m = refRe.exec(opf))) {
    const idref = attr(m[0], 'idref');
    if (!idref) continue;
    const href = manifest[idref];
    if (!href) continue;
    const path = joinPath(opfDir, decodeEntities(href.split('#')[0]));
    if (zip.file(path)) chapters.push({ path });
  }

  // Capa: 1) <meta name="cover" content="ID"> → manifest; 2) item EPUB3 com
  // properties="cover-image"; 3) um item de imagem cujo id contém "cover".
  let coverHref: string | undefined;
  const coverId = attr(opf.match(/<meta\b[^>]*name\s*=\s*"cover"[^>]*>/i)?.[0] ?? '', 'content');
  if (coverId && manifest[coverId]) coverHref = manifest[coverId];
  if (!coverHref) {
    const itRe = /<item\b[^>]*>/gi;
    let it: RegExpExecArray | null;
    while ((it = itRe.exec(opf))) {
      const href = attr(it[0], 'href');
      if (!href) continue;
      const props = attr(it[0], 'properties');
      const mt = attr(it[0], 'media-type');
      const id = attr(it[0], 'id');
      if (props && /cover-image/i.test(props)) {
        coverHref = href;
        break;
      }
      if (!coverHref && id && /cover/i.test(id) && mt && /^image\//i.test(mt)) coverHref = href;
    }
  }
  const coverPath =
    coverHref && zip.file(joinPath(opfDir, decodeEntities(coverHref.split('#')[0])))
      ? joinPath(opfDir, decodeEntities(coverHref.split('#')[0]))
      : undefined;

  if (chapters.length === 0) throw new Error('Não encontramos capítulos neste EPUB.');
  return { title: title || undefined, author: author || undefined, chapters, coverPath, zip };
}

/**
 * Salva a capa embutida do EPUB num arquivo local (`cover-<bookId>.<ext>`) e
 * devolve a uri — para mostrar a capa real na biblioteca/hub (offline). Retorna
 * null se o EPUB não declara capa ou a imagem não pôde ser lida.
 */
export async function saveEpubCover(handle: EpubHandle, bookId: string): Promise<string | null> {
  try {
    if (!handle.coverPath) return null;
    const entry = handle.zip.file(handle.coverPath);
    if (!entry) return null;
    const bytes = await entry.async('uint8array');
    if (!bytes.length) return null;
    const raw = handle.coverPath.match(/\.(jpe?g|png|gif|webp)$/i)?.[1]?.toLowerCase() ?? 'jpg';
    const ext = raw === 'jpeg' ? 'jpg' : raw;
    const dest = new File(Paths.document, `cover-${bookId}.${ext}`);
    if (dest.exists) dest.delete();
    dest.create();
    dest.write(bytes);
    return dest.uri;
  } catch {
    return null;
  }
}

/** Remove o arquivo de capa local do livro (qualquer extensão), ao excluí-lo. */
export function deleteCoverFile(bookId: string): void {
  for (const ext of ['jpg', 'png', 'gif', 'webp']) {
    try {
      const f = new File(Paths.document, `cover-${bookId}.${ext}`);
      if (f.exists) f.delete();
    } catch {
      // ignora
    }
  }
}

/** Lê e converte UM capítulo em texto (sob demanda). */
export async function loadChapter(
  zip: JSZip,
  path: string,
): Promise<{ title?: string; text: string }> {
  const f = zip.file(path);
  if (!f) return { text: '' };
  const html = await f.async('text');
  const text = htmlToText(html);
  const headMatch = html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
  const title = headMatch
    ? decodeEntities(headMatch[1].replace(/<[^>]+>/g, '').trim())
    : undefined;
  return { title: title || undefined, text };
}

function extractHeading(html: string): string | undefined {
  const h = html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
  if (!h) return undefined;
  return decodeEntities(h[1].replace(/<[^>]+>/g, '').trim()) || undefined;
}

/**
 * Quebra uma seção (1 arquivo XHTML, que no Gutenberg costuma juntar vários
 * capítulos) em capítulos menores, cortando nos títulos (<h1>–<h3>). Deixa a
 * leitura mais "Kindle": unidades pequenas e leves para navegar.
 */
function splitSectionIntoChapters(html: string): { title?: string; text: string }[] {
  const headingRe = /<h[1-3][\s>]/gi;
  const positions: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(html))) positions.push(m.index);

  // 0 ou 1 título → não dá para subdividir, vira um capítulo só
  if (positions.length <= 1) {
    const text = htmlToText(html);
    return text ? [{ title: extractHeading(html), text }] : [];
  }

  const out: { title?: string; text: string }[] = [];
  // conteúdo antes do primeiro título (capa/prólogo, sem título)
  if (positions[0] > 0) {
    const pre = htmlToText(html.slice(0, positions[0]));
    if (pre) out.push({ text: pre });
  }
  for (let i = 0; i < positions.length; i++) {
    const end = i + 1 < positions.length ? positions[i + 1] : html.length;
    const seg = html.slice(positions[i], end);
    const text = htmlToText(seg);
    if (text) out.push({ title: extractHeading(seg), text });
  }
  return out;
}

export type PreparedEpub = {
  title?: string;
  author?: string;
  /** Todos os parágrafos do livro, em ordem (1 item = 1 parágrafo). */
  paragraphs: string[];
  /** Início de cada capítulo, como índice em `paragraphs`. */
  chapters: { title?: string; start: number }[];
};

/**
 * Prepara o livro INTEIRO uma vez: lê todos os capítulos e os transforma numa
 * lista plana de parágrafos (para um scroll virtualizado). Processa seção a
 * seção cedendo a thread entre elas (não trava o app) e reporta o progresso.
 * Depois disso, navegar/rolar é instantâneo (nada é reprocessado).
 */
export async function prepareEpub(
  uri: string,
  onProgress?: (fraction: number) => void,
): Promise<PreparedEpub> {
  const handle = await openEpub(uri);
  const paragraphs: string[] = [];
  const chapters: { title?: string; start: number }[] = [];
  const total = handle.chapters.length;

  for (let i = 0; i < total; i++) {
    const f = handle.zip.file(handle.chapters[i].path);
    if (f) {
      const html = await f.async('text');
      // cada seção pode virar vários capítulos pequenos (corte nos títulos)
      for (const sub of splitSectionIntoChapters(html)) {
        const paras = splitParagraphs(sub.text);
        if (paras.length === 0) continue;
        chapters.push({ title: sub.title, start: paragraphs.length });
        for (const p of paras) paragraphs.push(p);
      }
    }
    onProgress?.((i + 1) / total);
    // cede a thread para a UI atualizar o progresso e não disparar ANR
    await new Promise<void>((r) => setTimeout(r, 0));
  }

  if (paragraphs.length === 0) throw new Error('Não encontramos texto neste EPUB.');
  return { title: handle.title, author: handle.author, paragraphs, chapters };
}

// --- Cache do livro já preparado (para o "Preparando…" rodar só uma vez) ---
function preparedFile(bookId: string) {
  return new File(Paths.document, `prepared-${bookId}.json`);
}

export async function loadPreparedCache(bookId: string): Promise<PreparedEpub | null> {
  try {
    const f = preparedFile(bookId);
    if (f.exists) return JSON.parse(await f.text()) as PreparedEpub;
  } catch {
    // cache ausente/corrompido → ignora e reprepara
  }
  return null;
}

export function savePreparedCache(bookId: string, data: PreparedEpub): void {
  try {
    const f = preparedFile(bookId);
    if (!f.exists) f.create();
    f.write(JSON.stringify(data));
  } catch {
    // ignora falha de escrita do cache
  }
}

export function deletePreparedCache(bookId: string): void {
  try {
    const f = preparedFile(bookId);
    if (f.exists) f.delete();
  } catch {
    // ignora
  }
}
