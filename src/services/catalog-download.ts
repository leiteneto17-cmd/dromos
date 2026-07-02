/**
 * Download compartilhado de livros do catálogo (Explorar, Cantinho do Estudo…).
 * Baixa o EPUB/PDF para `Paths.document`, adiciona à biblioteca pelo modelo da
 * importação (ImportedBook) e devolve o alvo de navegação do leitor. Lógica
 * extraída do Explorar (dup-check + retry + capa offline) para reuso nas
 * prateleiras temáticas.
 */
import { File, Paths } from 'expo-file-system';

import { resolveEpubUrl, type CatalogBook } from '@/services/catalog';
import { useLibrary, type ImportedBook } from '@/store/library';

export type ReaderTarget = '/reader' | { pathname: '/reader'; params: { pt: '1' } };

/**
 * Baixa (ou reaproveita) o livro e o deixa como atual na biblioteca.
 * Lança Error com mensagem amigável em caso de falha; o chamador navega.
 */
export async function downloadCatalogBook(book: CatalogBook): Promise<ReaderTarget> {
  // Livro não está em português? Abre já com a tradução automática LIGADA (pt=1).
  const ptAuto = !!(book.language && book.language !== 'pt');
  const readerTarget: ReaderTarget = ptAuto
    ? { pathname: '/reader', params: { pt: '1' } }
    : '/reader';
  const fmt = book.format ?? 'epub';

  // Já está na biblioteca? Abre em vez de baixar de novo.
  const dup = useLibrary.getState().books.find((b) => b.format === fmt && b.name === book.title);
  if (dup) {
    useLibrary.getState().openBook(dup.id);
    return readerTarget;
  }

  const url = await resolveEpubUrl(book);
  if (!url) throw new Error('Arquivo indisponível para este título.');

  // O servidor do Project Gutenberg às vezes responde devagar — tenta até 2 vezes.
  let f: File | null = null;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2 && !f; attempt++) {
    try {
      const dest = new File(Paths.document, `book-${Date.now()}-${attempt}.${fmt}`);
      f = await File.downloadFileAsync(url, dest);
    } catch (e) {
      lastErr = e;
    }
  }
  if (!f) {
    const msg = lastErr instanceof Error ? lastErr.message : '';
    throw new Error(
      /tim(e|ed)\s*out|timeout/i.test(msg)
        ? 'A conexão com o acervo ficou lenta e o download expirou. Tente de novo — o servidor do Project Gutenberg às vezes oscila.'
        : msg || 'Falha no download. Tente novamente.',
    );
  }

  const id = `${Date.now()}`;
  // Capa: baixa para arquivo local (offline-first); se falhar, mantém a URL remota.
  let coverUrl: string | undefined = book.coverUrl ?? undefined;
  if (book.coverUrl) {
    try {
      const cDest = new File(Paths.document, `cover-${id}.jpg`);
      const cf = await File.downloadFileAsync(book.coverUrl, cDest);
      coverUrl = cf.uri;
    } catch {
      // mantém a URL remota (expo-image cacheia ao carregar)
    }
  }

  const imported: ImportedBook = {
    id,
    name: book.title,
    fileName: `${book.title}.${fmt}`,
    uri: f.uri,
    size: f.size ?? undefined,
    format: fmt,
    addedAt: Date.now(),
    coverUrl,
  };
  useLibrary.getState().addBook(imported); // store já marca como livro atual
  return readerTarget;
}
