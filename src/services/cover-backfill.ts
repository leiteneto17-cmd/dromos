/**
 * Backfill de capas — extrai a capa embutida dos EPUBs que já estavam na
 * biblioteca ANTES de passarmos a salvar `coverUrl` no import. Roda uma vez por
 * sessão, em segundo plano, sem travar a UI (cede a thread entre os livros).
 *
 * Só toca EPUBs locais sem capa cujo arquivo ainda existe; PDFs ficam de fora
 * (capa de PDF é outra história — render da 1ª página via pdf.js). Idempotente:
 * assim que um livro ganha `coverUrl`, não é reprocessado.
 */
import { File } from 'expo-file-system';

import { openEpub, saveEpubCover } from '@/services/epub-parser';
import { useLibrary } from '@/store/library';

let ran = false;

export async function backfillCovers(): Promise<void> {
  if (ran) return;
  ran = true;

  const { books } = useLibrary.getState();
  const pending = books.filter((b) => b.format === 'epub' && !b.coverUrl);
  if (pending.length === 0) return;

  for (const book of pending) {
    try {
      if (!new File(book.uri).exists) continue; // arquivo removido → ignora
      const handle = await openEpub(book.uri);
      const coverUrl = await saveEpubCover(handle, book.id);
      // confere se o livro ainda existe (pode ter sido removido durante o backfill)
      if (coverUrl && useLibrary.getState().books.some((b) => b.id === book.id)) {
        useLibrary.getState().setBookCover(book.id, coverUrl);
      }
    } catch {
      // EPUB sem capa/ilegível → segue para o próximo
    }
    // cede a thread para a UI respirar entre um livro e outro (evita ANR)
    await new Promise<void>((r) => setTimeout(r, 0));
  }
}
