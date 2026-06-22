/**
 * "Minha estante" (catálogo estilo Skoob) — agora vive na aba LEITURA (hub), não mais na
 * Comunidade. Lista os livros que o usuário catalogou com status (lendo/quero ler/lido…),
 * com filtro por status, COLEÇÕES personalizadas (criar/atribuir/apagar) e a nota dada.
 * Tocar num livro abre a página dele (/livro). Auto-carrega ao focar a tela.
 *
 * Dados no Supabase (book_shelves/shelf_collections/book_reviews via community.ts). Se não
 * houver login/itens, mostra um convite para buscar livros na Comunidade.
 */
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, SectionTitle } from '@/components/social-ui';
import { useUI } from '@/hooks/use-ui';
import {
  createCollection,
  deleteCollection,
  getCollections,
  getMyRatings,
  getMyShelf,
  setBookCollection,
  SHELF_LABEL,
  SHELF_STATUSES,
  type Collection,
  type ShelfItem,
  type ShelfStatus,
} from '@/services/community';
import { useAuth } from '@/store/auth';

function Cover({ uri }: { uri?: string | null }) {
  const c = useUI();
  if (uri) return <Image source={{ uri }} style={styles.cover} contentFit="cover" transition={150} />;
  return (
    <View style={[styles.cover, { backgroundColor: c.cardElevated, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ fontSize: 18 }}>📘</Text>
    </View>
  );
}

export function MyShelf() {
  const c = useUI();
  const user = useAuth((s) => s.user);

  const [shelf, setShelf] = useState<ShelfItem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [myRatings, setMyRatings] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<ShelfStatus | 'todos'>('todos');
  const [colFilter, setColFilter] = useState<string | 'todas'>('todas');

  const [assignTarget, setAssignTarget] = useState<ShelfItem | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [colBusy, setColBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setShelf([]);
      setCollections([]);
      setMyRatings({});
      return;
    }
    const [sh, cols, ratings] = await Promise.all([getMyShelf(), getCollections(), getMyRatings()]);
    setShelf(sh);
    setCollections(cols);
    setMyRatings(ratings);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openBook = useCallback((s: ShelfItem) => {
    router.push({
      pathname: '/livro',
      params: {
        title: s.book_title,
        ...(s.book_author ? { author: s.book_author } : {}),
        ...(s.cover_url ? { cover: s.cover_url } : {}),
        ...(s.isbn ? { isbn: s.isbn } : {}),
      },
    });
  }, []);

  const colName = (id: string | null) => collections.find((cc) => cc.id === id)?.name ?? null;
  const liveTarget = assignTarget ? shelf.find((s) => s.book_key === assignTarget.book_key) ?? assignTarget : null;

  const addCollection = useCallback(async () => {
    setColBusy(true);
    const err = await createCollection(newColName);
    setColBusy(false);
    if (err) {
      Alert.alert('Não deu para criar', err);
      return;
    }
    setNewColName('');
    await load();
  }, [newColName, load]);

  const assignTo = useCallback(
    async (collectionId: string | null) => {
      if (!assignTarget) return;
      setColBusy(true);
      await setBookCollection(assignTarget.book_key, collectionId);
      await load();
      setColBusy(false);
      setAssignTarget(null);
    },
    [assignTarget, load],
  );

  const removeCollection = useCallback(
    (col: Collection) => {
      Alert.alert('Apagar coleção', `Apagar "${col.name}"? Os livros dela voltam para "sem coleção".`, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: async () => {
            await deleteCollection(col.id);
            if (colFilter === col.id) setColFilter('todas');
            await load();
          },
        },
      ]);
    },
    [colFilter, load],
  );

  const closeColModal = () => {
    if (colBusy) return;
    setAssignTarget(null);
    setManageOpen(false);
    setNewColName('');
  };

  const filteredShelf = shelf.filter(
    (s) => (filter === 'todos' || s.status === filter) && (colFilter === 'todas' || s.collection_id === colFilter),
  );

  return (
    <>
      <SectionTitle icon="📚">Minha estante</SectionTitle>

      {shelf.length === 0 ? (
        <Pressable onPress={() => router.navigate('/comunidade')}>
          <Card>
            <Text style={[styles.emptyTitle, { color: c.text }]}>Sua estante está vazia</Text>
            <Text style={[styles.emptySub, { color: c.textFaint }]}>
              Busque livros na Comunidade e marque com um status (lendo, quero ler, lido…). ›
            </Text>
          </Card>
        </Pressable>
      ) : (
        <>
          {/* Filtro por status */}
          <View style={styles.filterRow}>
            {(['todos', ...SHELF_STATUSES] as const).map((f) => {
              const active = filter === f;
              const label = f === 'todos' ? 'Todos' : SHELF_LABEL[f];
              return (
                <Pressable
                  key={f}
                  onPress={() => setFilter(f)}
                  style={[styles.chip, { borderColor: active ? c.green : c.border, backgroundColor: active ? c.green : 'transparent' }]}>
                  <Text style={[styles.chipText, { color: active ? c.onGreen : c.textDim }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Coleções */}
          <View style={styles.filterRow}>
            <Pressable
              onPress={() => setColFilter('todas')}
              style={[styles.chip, { borderColor: colFilter === 'todas' ? c.purple : c.border, backgroundColor: colFilter === 'todas' ? c.purple : 'transparent' }]}>
              <Text style={[styles.chipText, { color: colFilter === 'todas' ? c.onGreen : c.textDim }]}>📚 Todas</Text>
            </Pressable>
            {collections.map((col) => {
              const active = colFilter === col.id;
              return (
                <Pressable
                  key={col.id}
                  onPress={() => setColFilter(col.id)}
                  style={[styles.chip, { borderColor: active ? c.purple : c.border, backgroundColor: active ? c.purple : 'transparent' }]}>
                  <Text style={[styles.chipText, { color: active ? c.onGreen : c.textDim }]}>📁 {col.name}</Text>
                </Pressable>
              );
            })}
            <Pressable onPress={() => setManageOpen(true)} style={[styles.chip, { borderColor: c.border }]}>
              <Text style={[styles.chipText, { color: c.purple }]}>+ Coleções</Text>
            </Pressable>
          </View>

          {filteredShelf.map((s) => (
            <Pressable key={s.book_key} onPress={() => openBook(s)}>
              <Card style={styles.row}>
                <Cover uri={s.cover_url} />
                <View style={styles.rowBody}>
                  <Text style={[styles.bookTitle, { color: c.text }]} numberOfLines={2}>
                    {s.book_title}
                  </Text>
                  {s.book_author ? (
                    <Text style={[styles.author, { color: c.textFaint }]} numberOfLines={1}>
                      {s.book_author}
                    </Text>
                  ) : null}
                  {myRatings[s.book_key] ? (
                    <Text style={[styles.myStars, { color: c.green }]}>
                      {'★'.repeat(myRatings[s.book_key])}
                      <Text style={{ color: c.border }}>{'★'.repeat(5 - myRatings[s.book_key])}</Text>
                    </Text>
                  ) : null}
                  <Pressable onPress={() => setAssignTarget(s)} hitSlop={6} style={styles.colTag}>
                    <Text style={[styles.colTagText, { color: c.purple }]} numberOfLines={1}>
                      📁 {colName(s.collection_id) ?? 'Organizar'}
                    </Text>
                  </Pressable>
                </View>
                <Text style={[styles.statusBadge, { color: c.green, borderColor: c.green }]}>{SHELF_LABEL[s.status]}</Text>
              </Card>
            </Pressable>
          ))}
        </>
      )}

      {/* Coleções: criar / atribuir / apagar */}
      <Modal visible={!!assignTarget || manageOpen} transparent animationType="fade" onRequestClose={closeColModal}>
        <Pressable style={styles.backdrop} onPress={closeColModal}>
          <Pressable style={[styles.sheet, { backgroundColor: c.card, borderColor: c.border }]} onPress={() => {}}>
            <Text style={[styles.sheetTitle, { color: c.text }]}>
              {assignTarget ? 'Organizar em coleção' : 'Suas coleções'}
            </Text>
            {assignTarget ? (
              <Text style={[styles.sheetSub, { color: c.textFaint }]} numberOfLines={1}>
                {assignTarget.book_title}
              </Text>
            ) : null}

            <View style={styles.newColRow}>
              <TextInput
                value={newColName}
                onChangeText={setNewColName}
                placeholder="Nova coleção (ex.: Faculdade)"
                placeholderTextColor={c.textFaint}
                style={[styles.newColInput, { backgroundColor: c.cardElevated, borderColor: c.border, color: c.text }]}
                onSubmitEditing={addCollection}
                returnKeyType="done"
              />
              <Pressable
                onPress={addCollection}
                disabled={colBusy || !newColName.trim()}
                style={[styles.newColBtn, { backgroundColor: c.green, opacity: colBusy || !newColName.trim() ? 0.5 : 1 }]}>
                <Text style={[styles.newColBtnText, { color: c.onGreen }]}>Criar</Text>
              </Pressable>
            </View>

            {assignTarget ? (
              <Pressable onPress={() => assignTo(null)} disabled={colBusy} style={[styles.colRow, { borderColor: c.border }]}>
                <Text style={[styles.colRowText, { color: c.textDim }]}>Sem coleção</Text>
                {!liveTarget?.collection_id ? <Text style={{ color: c.green }}>✓</Text> : null}
              </Pressable>
            ) : null}

            {collections.length === 0 ? (
              <Text style={[styles.emptySub, { color: c.textFaint, marginTop: 12 }]}>
                Crie uma coleção acima para organizar seus livros.
              </Text>
            ) : (
              collections.map((col) => {
                const active = liveTarget?.collection_id === col.id;
                return (
                  <View key={col.id} style={[styles.colRow, { borderColor: c.border }]}>
                    <Pressable
                      onPress={() => (assignTarget ? assignTo(col.id) : undefined)}
                      disabled={colBusy || !assignTarget}
                      style={styles.flex}>
                      <Text style={[styles.colRowText, { color: c.text }]}>📁 {col.name}</Text>
                    </Pressable>
                    {active ? <Text style={{ color: c.green, marginRight: 12 }}>✓</Text> : null}
                    <Pressable onPress={() => removeCollection(col)} hitSlop={6}>
                      <Text style={{ color: c.textFaint, fontSize: 16 }}>🗑</Text>
                    </Pressable>
                  </View>
                );
              })
            )}

            <Pressable onPress={closeColModal} style={styles.sheetClose}>
              <Text style={[styles.sheetCloseText, { color: c.textDim }]}>Fechar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptySub: { fontSize: 13, marginTop: 4, lineHeight: 19 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  rowBody: { flex: 1 },
  cover: { width: 44, height: 64, borderRadius: 4, overflow: 'hidden' },
  bookTitle: { fontSize: 15, fontWeight: '700' },
  author: { fontSize: 13, marginTop: 2 },
  myStars: { fontSize: 12, letterSpacing: 1, marginTop: 4 },
  colTag: { marginTop: 6, alignSelf: 'flex-start' },
  colTagText: { fontSize: 12, fontWeight: '700' },
  statusBadge: { fontSize: 12, fontWeight: '800', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  backdrop: { flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, padding: 20, paddingBottom: 34 },
  sheetTitle: { fontSize: 17, fontWeight: '800' },
  sheetSub: { fontSize: 13, marginTop: 4 },
  newColRow: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 6 },
  newColInput: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  newColBtn: { borderRadius: 12, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  newColBtnText: { fontSize: 14, fontWeight: '800' },
  colRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingVertical: 14 },
  colRowText: { fontSize: 15, fontWeight: '600' },
  sheetClose: { marginTop: 18, alignItems: 'center' },
  sheetCloseText: { fontSize: 15, fontWeight: '700' },
});
