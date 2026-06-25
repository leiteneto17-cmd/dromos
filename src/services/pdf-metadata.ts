/**
 * Lê o TÍTULO de um PDF a partir dos metadados do próprio arquivo (dicionário Info,
 * entrada `/Title`) — sem WebView, direto dos bytes. Usado na importação para que o
 * PDF entre na estante com o nome do livro, igual ao EPUB (antes ficava só com o nome
 * do arquivo, que no Android costuma vir genérico tipo "Documento PDF").
 *
 * É best-effort: se o `/Title` estiver num stream comprimido (PDFs "linearizados"),
 * a varredura por texto não acha e devolvemos null → o chamador mantém o nome do arquivo.
 */
import { File } from 'expo-file-system';

/** Converte bytes em string latin1 (1 byte = 1 char), limitando o volume varrido. */
function toLatin1(bytes: Uint8Array): string {
  const N = bytes.length;
  const MAX = 16 * 1024 * 1024;
  // PDFs grandes: o dicionário Info costuma ficar perto do fim (trailer) → varremos
  // o começo + o fim, evitando montar uma string gigante.
  const ranges: [number, number][] =
    N <= MAX ? [[0, N]] : [[0, 1024 * 1024], [N - 4 * 1024 * 1024, N]];
  let out = '';
  const CHUNK = 32768;
  for (const [a, b] of ranges) {
    for (let i = a; i < b; i += CHUNK) {
      out += String.fromCharCode(...bytes.subarray(i, Math.min(b, i + CHUNK)));
    }
  }
  return out;
}

/** Decodifica uma string PDF (literal "(...)" ou hex "<...>") para texto Unicode. */
function decodePdfString(raw: string, isHex: boolean): string {
  const bytes: number[] = [];
  if (isHex) {
    const hex = raw.replace(/[^0-9A-Fa-f]/g, '');
    for (let i = 0; i + 1 < hex.length; i += 2) bytes.push(parseInt(hex.substr(i, 2), 16));
  } else {
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch !== '\\') {
        bytes.push(ch.charCodeAt(0) & 0xff);
        continue;
      }
      const n = raw[i + 1];
      if (n === undefined) break;
      if (n === 'n') bytes.push(10);
      else if (n === 'r') bytes.push(13);
      else if (n === 't') bytes.push(9);
      else if (n === 'b') bytes.push(8);
      else if (n === 'f') bytes.push(12);
      else if (n === '\n') { i++; continue; } // continuação de linha
      else if (n >= '0' && n <= '7') {
        let oct = '';
        let j = i + 1;
        while (j < raw.length && oct.length < 3 && raw[j] >= '0' && raw[j] <= '7') oct += raw[j++];
        bytes.push(parseInt(oct, 8) & 0xff);
        i = j - 1;
        continue;
      } else bytes.push(n.charCodeAt(0) & 0xff); // \( \) \\ e desconhecidos
      i++;
    }
  }
  // UTF-16BE quando há BOM FE FF; senão PDFDocEncoding (~latin1).
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let s = '';
    for (let i = 2; i + 1 < bytes.length; i += 2) s += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    return s;
  }
  return bytes.map((b) => String.fromCharCode(b)).join('');
}

/** Acha o valor de `/Title` na string do PDF (primeiro com conteúdo não vazio). */
function extractTitle(s: string): string | null {
  const re = /\/Title\s*(\(|<)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const start = re.lastIndex;
    if (m[1] === '(') {
      let depth = 1;
      let i = start;
      let raw = '';
      while (i < s.length) {
        const ch = s[i];
        if (ch === '\\') {
          raw += ch + (s[i + 1] ?? '');
          i += 2;
          continue;
        }
        if (ch === '(') depth++;
        else if (ch === ')') {
          depth--;
          if (depth === 0) break;
        }
        raw += ch;
        i++;
      }
      const t = decodePdfString(raw, false).trim();
      if (t) return t;
    } else {
      const end = s.indexOf('>', start);
      if (end > start) {
        const t = decodePdfString(s.slice(start, end), true).trim();
        if (t) return t;
      }
    }
  }
  return null;
}

/** Título do PDF pelos metadados, ou null se não der para ler. */
export async function readPdfTitle(uri: string): Promise<string | null> {
  let bytes: Uint8Array;
  try {
    bytes = await new File(uri).bytes();
  } catch {
    return null;
  }
  if (!bytes || bytes.length === 0) return null;
  try {
    const raw = extractTitle(toLatin1(bytes));
    if (!raw) return null;
    // remove caracteres de controle e normaliza espaços
    const clean = raw.replace(/[\x00-\x1f]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!clean) return null;
    return clean.length > 200 ? clean.slice(0, 200) : clean;
  } catch {
    return null;
  }
}
