/**
 * Biblioteca completa — importar e gerenciar os livros (.epub / .pdf).
 * Rota empilhada, alcançada pelo HUB ("Ver biblioteca" / "+ Importar").
 * Toque num livro → abre o leitor (/reader). Pressão longa → remover.
 * Usa a pele social (roxo+verde), igual ao restante da camada de navegação.
 */
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, ScreenBG } from '@/components/social-ui';
import { useUI } from '@/hooks/use-ui';
import { deletePreparedCache, openEpub } from '@/services/epub-parser';
import { readPdfTitle } from '@/services/pdf-metadata';
import { useLibrary, type BookFormat, type ImportedBook } from '@/store/library';

function detectFormat(name: string, mime?: string): BookFormat | null {
  const lower = name.toLowerCase();
  if (lower.endsWith('.epub') || mime === 'application/epub+zip') return 'epub';
  if (lower.endsWith('.pdf') || mime === 'application/pdf') return 'pdf';
  return null;
}

function formatFromMime(mime?: string | null): BookFormat | null {
  if (!mime) return null;
  const m = mime.toLowerCase();
  if (m.includes('pdf')) return 'pdf';
  if (m.includes('epub') || m.includes('zip')) return 'epub';
  return null;
}

/** Detecta pelo "número mágico" do início do arquivo (independe de nome/extensão). */
function formatFromMagic(head: Uint8Array): BookFormat | null {
  if (head.length >= 4 && head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46)
    return 'pdf'; // "%PDF"
  if (head.length >= 2 && head[0] === 0x50 && head[1] === 0x4b) return 'epub'; // "PK" (zip)
  return null;
}

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export async function importBookFlow(
  addBook: (b: ImportedBook) => void,
  onDone?: () => void,
): Promise<void> {
  try {
    // Seletor do próprio expo-file-system: o arquivo volta com permissão de leitura
    // (diferente do expo-document-picker, cujo cache o Expo Go recusa ler).
    // Abrimos para TODOS os tipos ('*/*') de propósito: o Android costuma ESCONDER os
    // EPUBs quando filtramos por 'application/epub+zip' (MIME mal indexado pelo sistema),
    // deixando a tela "Sem itens". Validamos o formato real depois (extensão/MIME/bytes).
    const result = await File.pickFileAsync({ mimeTypes: ['*/*'] });
    if (result.canceled) return;

    const picked = result.result;
    // O nome via SAF (Android) costuma vir sem extensão (ex.: "document:38").
    // Detectamos por: extensão → tipo MIME → bytes mágicos.
    let format: BookFormat | null = detectFormat(picked.name) ?? formatFromMime(picked.type);
    if (!format) {
      try {
        const head = new Uint8Array(await picked.slice(0, 16).arrayBuffer());
        format = formatFromMagic(head);
      } catch {
        // ignora; cai no alerta abaixo
      }
    }
    if (!format) {
      Alert.alert('Formato não reconhecido', `nome="${picked.name}" tipo="${picked.type}"`);
      return;
    }

    const displayName = /\.(pdf|epub)$/i.test(picked.name)
      ? picked.name.replace(/\.(epub|pdf)$/i, '')
      : `Documento ${format.toUpperCase()}`;
    const size = picked.size || undefined;

    // Cópia + adição na biblioteca (extraída p/ poder reusar no "Importar mesmo assim").
    const fmt = format;
    async function commit() {
      const dest = new File(Paths.document, `book-${Date.now()}.${fmt}`);
      await picked.copy(dest);
      // Captura o título real já na importação — assim a biblioteca/comunidade mostram o
      // nome do livro, não "Documento EPUB/PDF". EPUB: metadado do OPF. PDF: entrada
      // /Title do dicionário Info. Em ambos, se não houver metadado, cai no nome do arquivo.
      let title: string | undefined;
      try {
        if (fmt === 'epub') title = (await openEpub(dest.uri)).title;
        else if (fmt === 'pdf') title = (await readPdfTitle(dest.uri)) ?? undefined;
      } catch {
        // sem metadado legível → mantém o nome do arquivo
      }
      const book: ImportedBook = {
        id: `${Date.now()}`,
        name: displayName,
        title,
        fileName: picked.name,
        uri: dest.uri,
        size: dest.size || size,
        format: fmt,
        addedAt: Date.now(),
      };
      addBook(book);
      onDone?.();
    }

    // Deduplicação: mesmo formato + mesmo nome + mesmo tamanho ⇒ provavelmente o
    // mesmo livro. Evita o card duplicado ao importar o arquivo de novo.
    const dup = useLibrary
      .getState()
      .books.find(
        (b) => b.format === format && b.name === displayName && (b.size ?? 0) === (size ?? 0),
      );
    if (dup) {
      Alert.alert('Livro já na biblioteca', `“${displayName}” já está na sua biblioteca.`, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Abrir',
          onPress: () => {
            useLibrary.getState().openBook(dup.id);
            onDone?.();
          },
        },
        { text: 'Importar mesmo assim', style: 'destructive', onPress: () => void commit() },
      ]);
      return;
    }

    await commit();
  } catch (e) {
    Alert.alert('Erro ao importar', e instanceof Error ? e.message : String(e));
  }
}

export default function LibraryScreen() {
  const c = useUI();
  const books = useLibrary((s) => s.books);
  const addBook = useLibrary((s) => s.addBook);
  const openBook = useLibrary((s) => s.openBook);
  const removeBook = useLibrary((s) => s.removeBook);

  function open(book: ImportedBook) {
    openBook(book.id);
    router.navigate('/reader');
  }

  function confirmDelete(book: ImportedBook) {
    Alert.alert('Remover livro', `Remover "${book.name}" da biblioteca?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () => {
          try {
            new File(book.uri).delete();
          } catch {
            // arquivo já pode não existir; segue removendo da lista
          }
          deletePreparedCache(book.id);
          removeBook(book.id);
        },
      },
    ]);
  }

  return (
    <ScreenBG scroll={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
          <Text style={[styles.backText, { color: c.textDim }]}>‹ Voltar</Text>
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.navigate('/explorar')}
            accessibilityRole="button"
            accessibilityLabel="Explorar catálogo"
            style={[styles.importBtn, { borderColor: c.purple }]}>
            <Text style={[styles.importText, { color: c.purple }]}>🔎 Explorar</Text>
          </Pressable>
          <Pressable
            onPress={() => importBookFlow(addBook, () => router.navigate('/reader'))}
            accessibilityRole="button"
            accessibilityLabel="Importar livro"
            style={[styles.importBtn, { borderColor: c.green }]}>
            <Text style={[styles.importText, { color: c.green }]}>+ Importar</Text>
          </Pressable>
        </View>
      </View>

      <Text style={[styles.title, { color: c.text }]}>Biblioteca</Text>
      {books.length > 0 ? (
        <Text style={[styles.hint, { color: c.textFaint }]}>
          Toque para abrir · 🗑 para remover
        </Text>
      ) : null}

      {books.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: c.textFaint }]}>
            Nenhum livro ainda.{'\n'}Toque em “+ Importar” e escolha um arquivo .epub ou .pdf.
          </Text>
        </View>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable onPress={() => open(item)} onLongPress={() => confirmDelete(item)}>
              <Card style={styles.row}>
                <View style={[styles.badge, { backgroundColor: c.cardElevated, borderColor: c.border }]}>
                  <Text style={[styles.badgeText, { color: c.textDim }]}>{item.format.toUpperCase()}</Text>
                </View>
                <View style={styles.rowBody}>
                  <Text style={[styles.bookName, { color: c.text }]} numberOfLines={1}>
                    {item.title ?? item.name}
                  </Text>
                  <Text style={[styles.bookSub, { color: c.textFaint }]} numberOfLines={1}>
                    {item.format === 'pdf' ? 'PDF · convertido para leitura' : 'EPUB'}
                    {item.size ? ` · ${formatSize(item.size)}` : ''}
                  </Text>
                </View>
                <Pressable
                  onPress={() => confirmDelete(item)}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={`Remover ${item.name}`}
                  style={styles.trashBtn}>
                  <Text style={[styles.trash, { color: c.textFaint }]}>🗑</Text>
                </Pressable>
              </Card>
            </Pressable>
          )}
        />
      )}
    </ScreenBG>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: { paddingVertical: 4, paddingRight: 8 },
  backText: { fontSize: 16, fontWeight: '600' },
  importBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7 },
  importText: { fontWeight: '700', fontSize: 14 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  hint: { fontSize: 13, marginBottom: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { textAlign: 'center', fontSize: 15, lineHeight: 22 },
  list: { gap: 12, paddingBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  badge: { width: 46, height: 60, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 12, fontWeight: '800' },
  rowBody: { flex: 1, gap: 3 },
  bookName: { fontSize: 16, fontWeight: '600' },
  bookSub: { fontSize: 13 },
  trashBtn: { paddingHorizontal: 4, paddingVertical: 4 },
  trash: { fontSize: 20 },
});
