/**
 * Resenhas de um livro (Comunidade · C3) + moderação obrigatória (§4.8 / Apple 1.2):
 *  - escrever/editar/excluir a PRÓPRIA resenha (nota 1–5 + texto), com filtro de palavrão;
 *  - ver as resenhas dos outros (a RLS já esconde quem se bloqueou);
 *  - **Denunciar** e **Bloquear** o autor de cada resenha;
 *  - link de **contato com a equipe** (requisito de UGC das lojas).
 *
 * Resenhas são públicas (escrever = publicar). Usado dentro da página do livro (/livro).
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, SectionTitle } from '@/components/social-ui';
import { useUI } from '@/hooks/use-ui';
import {
  blockUser,
  deleteReview,
  getBookRating,
  getMyReview,
  getReviews,
  reportReview,
  upsertReview,
  type BookReview,
} from '@/services/community';
import { containsProfanity } from '@/services/moderation';

const CONTACT_EMAIL = 'leiteneto17@gmail.com';

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Linha de estrelas. Interativa quando `onPick` é passado. */
function Stars({
  value,
  size = 18,
  onPick,
  color,
  dim,
}: {
  value: number;
  size?: number;
  onPick?: (n: number) => void;
  color: string;
  dim: string;
}) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        const star = (
          <Text style={{ fontSize: size, color: filled ? color : dim }}>{filled ? '★' : '☆'}</Text>
        );
        return onPick ? (
          <Pressable key={n} onPress={() => onPick(n)} hitSlop={6} style={styles.starHit}>
            {star}
          </Pressable>
        ) : (
          <View key={n} style={styles.starHit}>
            {star}
          </View>
        );
      })}
    </View>
  );
}

export function BookReviews({ bookKey, bookTitle }: { bookKey: string; bookTitle: string }) {
  const c = useUI();
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<BookReview[]>([]);
  const [rating, setRating] = useState<{ avg: number; n: number }>({ avg: 0, n: 0 });

  // editor da minha resenha
  const [myRating, setMyRating] = useState(0);
  const [myText, setMyText] = useState('');
  const [hasMine, setHasMine] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [revs, rate, mine] = await Promise.all([getReviews(bookKey), getBookRating(bookKey), getMyReview(bookKey)]);
    setReviews(revs);
    setRating(rate);
    setHasMine(!!mine);
    setMyRating(mine?.rating ?? 0);
    setMyText(mine?.text ?? '');
    setLoading(false);
  }, [bookKey]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const submit = useCallback(async () => {
    if (myRating < 1) {
      Alert.alert('Dê uma nota', 'Toque nas estrelas para avaliar de 1 a 5.');
      return;
    }
    if (myText.trim() && containsProfanity(myText)) {
      Alert.alert('Revise o texto', 'Sua resenha tem termos ofensivos. Ajuste antes de publicar.');
      return;
    }
    setBusy(true);
    const err = await upsertReview({ title: bookTitle, rating: myRating, text: myText });
    setBusy(false);
    if (err) {
      const tableMissing = /book_reviews|does not exist|relation|schema cache/i.test(err);
      Alert.alert(
        'Não deu para publicar',
        tableMissing
          ? 'O banco ainda não tem as tabelas de resenha. Rode o supabase/schema.sql no painel do Supabase e tente de novo.'
          : err,
      );
      return;
    }
    setEditing(false);
    await load();
  }, [myRating, myText, bookTitle, load]);

  const removeMine = useCallback(() => {
    Alert.alert('Excluir resenha', 'Tem certeza que quer apagar sua resenha?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          await deleteReview(bookKey);
          setMyRating(0);
          setMyText('');
          setEditing(false);
          setBusy(false);
          await load();
        },
      },
    ]);
  }, [bookKey, load]);

  const onReport = useCallback(
    (r: BookReview) => {
      const send = async (reason: string) => {
        const err = await reportReview(r.id, r.user_id, reason);
        Alert.alert(
          err ? 'Não deu para denunciar' : 'Denúncia enviada',
          err ?? 'Obrigado. Nossa equipe vai analisar essa resenha.',
        );
      };
      Alert.alert('Denunciar resenha', 'Qual o motivo?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Ofensivo', onPress: () => send('ofensivo') },
        { text: 'Spam', onPress: () => send('spam') },
        { text: 'Spoiler', onPress: () => send('spoiler') },
      ]);
    },
    [],
  );

  const onBlock = useCallback(
    (r: BookReview) => {
      Alert.alert('Bloquear leitor', `Não verá mais as resenhas de ${r.author_name}. Continuar?`, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Bloquear',
          style: 'destructive',
          onPress: async () => {
            const err = await blockUser(r.user_id);
            if (err) {
              Alert.alert('Não deu para bloquear', err);
              return;
            }
            await load();
          },
        },
      ]);
    },
    [load],
  );

  const mine = reviews.find((r) => r.is_mine) ?? null;
  const others = reviews.filter((r) => !r.is_mine);

  return (
    <>
      <SectionTitle name="star">Resenhas</SectionTitle>

      {rating.n > 0 ? (
        <View style={styles.ratingHead}>
          <Stars value={Math.round(rating.avg)} size={20} color={c.green} dim={c.border} />
          <Text style={[styles.ratingNum, { color: c.text }]}>{rating.avg.toFixed(1)}</Text>
          <Text style={[styles.ratingCount, { color: c.textFaint }]}>
            · {rating.n} {rating.n === 1 ? 'avaliação' : 'avaliações'}
          </Text>
        </View>
      ) : null}

      {/* Minha resenha: card publicado (se já avaliei e não estou editando) OU editor */}
      {hasMine && !editing ? (
        <Card style={styles.review}>
          <View style={styles.reviewHead}>
            <Text style={styles.avatar}>{mine?.author_avatar || '🦉'}</Text>
            <View style={styles.flex}>
              <Text style={[styles.author, { color: c.text }]} numberOfLines={1}>
                Você
              </Text>
              <View style={styles.reviewMeta}>
                <Stars value={mine?.rating ?? myRating} size={13} color={c.green} dim={c.border} />
                {mine ? <Text style={[styles.date, { color: c.textFaint }]}>· {fmtDate(mine.created_at)}</Text> : null}
              </View>
            </View>
          </View>
          {mine?.text ? <Text style={[styles.reviewText, { color: c.textDim }]}>{mine.text}</Text> : null}
          <View style={styles.modRow}>
            <Pressable onPress={() => setEditing(true)} hitSlop={6}>
              <Text style={[styles.modBtn, { color: c.green }]}>Editar</Text>
            </Pressable>
            <Pressable onPress={removeMine} hitSlop={6}>
              <Text style={[styles.modBtn, { color: c.textFaint }]}>Excluir</Text>
            </Pressable>
          </View>
        </Card>
      ) : (
        <Card style={styles.editor}>
          <Text style={[styles.editorTitle, { color: c.text }]}>
            {hasMine ? 'Editar sua resenha' : 'Avaliar este livro'}
          </Text>
          <Stars value={myRating} size={30} onPick={setMyRating} color={c.green} dim={c.border} />
          <TextInput
            value={myText}
            onChangeText={setMyText}
            placeholder="Escreva o que achou (opcional)…"
            placeholderTextColor={c.textFaint}
            multiline
            style={[styles.input, { backgroundColor: c.cardElevated, borderColor: c.border, color: c.text }]}
          />
          <View style={styles.editorBtns}>
            {hasMine ? (
              <Pressable onPress={() => setEditing(false)} disabled={busy} hitSlop={6} style={styles.delBtn}>
                <Text style={[styles.delText, { color: c.textFaint }]}>Cancelar</Text>
              </Pressable>
            ) : (
              <View style={styles.flex} />
            )}
            <Pressable
              onPress={submit}
              disabled={busy}
              style={[styles.pubBtn, { backgroundColor: c.green, opacity: busy ? 0.7 : 1 }]}>
              {busy ? (
                <ActivityIndicator size="small" color={c.onGreen} />
              ) : (
                <Text style={[styles.pubText, { color: c.onGreen }]}>{hasMine ? 'Salvar' : 'Publicar'}</Text>
              )}
            </Pressable>
          </View>
        </Card>
      )}

      {/* Resenhas dos outros leitores */}
      {loading ? (
        <ActivityIndicator color={c.green} style={{ marginTop: 16 }} />
      ) : others.length === 0 ? (
        <Text style={[styles.empty, { color: c.textFaint }]}>
          Ainda não há resenhas de outros leitores. Seja o primeiro a comentar!
        </Text>
      ) : (
        others.map((r) => (
          <Card key={r.id} style={styles.review}>
            <Pressable
              style={styles.reviewHead}
              onPress={() => router.push({ pathname: '/usuario', params: { id: r.user_id, name: r.author_name } })}>
              <Text style={styles.avatar}>{r.author_avatar || '🦉'}</Text>
              <View style={styles.flex}>
                <Text style={[styles.author, { color: c.text }]} numberOfLines={1}>
                  {r.author_name} ›
                </Text>
                <View style={styles.reviewMeta}>
                  <Stars value={r.rating} size={13} color={c.green} dim={c.border} />
                  <Text style={[styles.date, { color: c.textFaint }]}>· {fmtDate(r.created_at)}</Text>
                </View>
              </View>
            </Pressable>
            {r.text ? <Text style={[styles.reviewText, { color: c.textDim }]}>{r.text}</Text> : null}
            <View style={styles.modRow}>
              <Pressable onPress={() => onReport(r)} hitSlop={6}>
                <Text style={[styles.modBtn, { color: c.textFaint }]}>Denunciar</Text>
              </Pressable>
              <Pressable onPress={() => onBlock(r)} hitSlop={6}>
                <Text style={[styles.modBtn, { color: c.textFaint }]}>Bloquear</Text>
              </Pressable>
            </View>
          </Card>
        ))
      )}

      {/* Contato com a equipe (requisito de UGC das lojas — §4.8) */}
      <Pressable
        onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Reportar conteúdo — Dromos')}`)}
        hitSlop={6}
        style={styles.contact}>
        <Text style={[styles.contactText, { color: c.textFaint }]}>
          Viu algo impróprio? Denuncie acima ou fale com a equipe.
        </Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  starsRow: { flexDirection: 'row' },
  starHit: { paddingHorizontal: 1 },
  ratingHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  ratingNum: { fontSize: 18, fontWeight: '800' },
  ratingCount: { fontSize: 13 },
  editor: { marginTop: 10 },
  editorTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  input: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 15, minHeight: 80, textAlignVertical: 'top', marginTop: 12 },
  editorBtns: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 12 },
  delBtn: { flex: 1 },
  delText: { fontSize: 14, fontWeight: '700' },
  pubBtn: { borderRadius: 999, paddingHorizontal: 24, paddingVertical: 11, alignItems: 'center', minWidth: 110 },
  pubText: { fontSize: 15, fontWeight: '800' },
  empty: { fontSize: 13, lineHeight: 20, marginTop: 14 },
  review: { marginTop: 12 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { fontSize: 26 },
  author: { fontSize: 14, fontWeight: '700' },
  reviewMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  date: { fontSize: 12 },
  reviewText: { fontSize: 14, lineHeight: 20, marginTop: 10 },
  modRow: { flexDirection: 'row', gap: 18, marginTop: 12 },
  modBtn: { fontSize: 12, fontWeight: '700' },
  contact: { marginTop: 18, alignItems: 'center' },
  contactText: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
