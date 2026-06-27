/**
 * Mural de RECADOS (scraps) no perfil — estilo Orkut. Cada recado é público (mural) ou
 * privado (só o destinatário vê = DM). A trava de permissão é do banco (RLS); aqui o
 * compose só aparece quando `canSendScrap` libera. Moderação (§4.8): filtro de palavrão
 * no envio, denúncia e bloqueio por recado, contato com a equipe.
 *
 * Usado em `usuario.tsx` (perfil de outro leitor e o próprio, quando isMe).
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, SectionTitle } from '@/components/social-ui';
import { useUI } from '@/hooks/use-ui';
import { blockUser, reportScrap } from '@/services/community';
import { canSendScrap, deleteScrap, getScraps, sendScrap, type Scrap } from '@/services/social';
import { containsProfanity } from '@/services/moderation';

const CONTACT_EMAIL = 'leiteneto17@gmail.com';

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'agora';
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString('pt-BR');
}

export function ProfileScraps({
  recipientId,
  recipientName,
  isMe,
}: {
  recipientId: string;
  recipientName: string;
  isMe: boolean;
}) {
  const c = useUI();
  const [scraps, setScraps] = useState<Scrap[]>([]);
  const [loading, setLoading] = useState(true);
  const [canSend, setCanSend] = useState(false);
  const [body, setBody] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [list, can] = await Promise.all([getScraps(recipientId), isMe ? Promise.resolve(false) : canSendScrap(recipientId)]);
    setScraps(list);
    setCanSend(can);
    setLoading(false);
  }, [recipientId, isMe]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const send = useCallback(async () => {
    if (!body.trim()) return;
    if (containsProfanity(body)) {
      Alert.alert('Revise o texto', 'Seu recado tem termos ofensivos. Ajuste antes de enviar.');
      return;
    }
    setBusy(true);
    const err = await sendScrap({ recipientId, body, isPublic });
    setBusy(false);
    if (err) {
      const tableMissing = /scraps|does not exist|relation|schema cache/i.test(err);
      Alert.alert('Não enviado', tableMissing ? 'Rode o supabase/schema.sql no Supabase e tente de novo.' : err);
      return;
    }
    setBody('');
    await load();
  }, [body, isPublic, recipientId, load]);

  const remove = useCallback(
    (s: Scrap) => {
      Alert.alert('Apagar recado', 'Tem certeza?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: async () => {
            await deleteScrap(s.id);
            await load();
          },
        },
      ]);
    },
    [load],
  );

  const onReport = useCallback((s: Scrap) => {
    const sendReport = async (reason: string) => {
      const err = await reportScrap(s.id, s.author_id, reason);
      Alert.alert(err ? 'Não deu para denunciar' : 'Denúncia enviada', err ?? 'Nossa equipe vai analisar.');
    };
    Alert.alert('Denunciar recado', 'Qual o motivo?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Ofensivo', onPress: () => sendReport('ofensivo') },
      { text: 'Spam', onPress: () => sendReport('spam') },
    ]);
  }, []);

  const onBlock = useCallback(
    (s: Scrap) => {
      Alert.alert('Bloquear leitor', `Não verá mais recados de ${s.author_name}. Continuar?`, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Bloquear',
          style: 'destructive',
          onPress: async () => {
            const err = await blockUser(s.author_id);
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

  return (
    <>
      <SectionTitle name="chat">Recados</SectionTitle>

      {!isMe && canSend ? (
        <Card style={styles.composer}>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder={`Deixe um recado para ${recipientName}…`}
            placeholderTextColor={c.textFaint}
            multiline
            style={[styles.input, { backgroundColor: c.cardElevated, borderColor: c.border, color: c.text }]}
          />
          <View style={styles.composerBtns}>
            <View style={[styles.toggle, { borderColor: c.border }]}>
              <Pressable
                onPress={() => setIsPublic(true)}
                style={[styles.toggleOpt, isPublic && { backgroundColor: c.green }]}>
                <Text style={[styles.toggleText, { color: isPublic ? c.onGreen : c.textDim }]}>🌐 público</Text>
              </Pressable>
              <Pressable
                onPress={() => setIsPublic(false)}
                style={[styles.toggleOpt, !isPublic && { backgroundColor: c.green }]}>
                <Text style={[styles.toggleText, { color: !isPublic ? c.onGreen : c.textDim }]}>🔒 privado</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={send}
              disabled={busy || !body.trim()}
              style={[styles.sendBtn, { backgroundColor: c.green, opacity: busy || !body.trim() ? 0.5 : 1 }]}>
              {busy ? <ActivityIndicator size="small" color={c.onGreen} /> : <Text style={[styles.sendText, { color: c.onGreen }]}>Enviar</Text>}
            </Pressable>
          </View>
        </Card>
      ) : !isMe && !loading ? (
        <Text style={[styles.hint, { color: c.textFaint }]}>
          Este perfil é privado — só recebe recados de quem ele segue ou aprovou.
        </Text>
      ) : null}

      {loading ? (
        <ActivityIndicator color={c.green} style={{ marginTop: 16 }} />
      ) : scraps.length === 0 ? (
        <Text style={[styles.hint, { color: c.textFaint, marginTop: 4 }]}>
          {isMe ? 'Você ainda não recebeu recados.' : 'Nenhum recado ainda. Seja o primeiro!'}
        </Text>
      ) : (
        scraps.map((s) => (
          <Card key={s.id} style={styles.scrap}>
            <View style={styles.scrapHead}>
              <Pressable
                style={styles.who}
                onPress={() => router.push({ pathname: '/usuario', params: { id: s.author_id, name: s.author_name } })}>
                <Text style={styles.avatar}>{s.author_avatar || '🦉'}</Text>
                <Text style={[styles.author, { color: s.author_founder ? c.green : c.text }]} numberOfLines={1}>
                  {s.is_mine ? 'Você' : s.author_name}
                  {s.author_founder ? ' 👑' : ''}
                </Text>
              </Pressable>
              <Text style={[styles.date, { color: c.textFaint }]}>{fmtDate(s.created_at)}</Text>
              {!s.is_public ? (
                <Text style={[styles.lock, { color: c.textFaint, borderColor: c.border }]}>🔒 privado</Text>
              ) : null}
            </View>
            <Text style={[styles.body, { color: c.textDim }]}>{s.body}</Text>
            <View style={styles.actions}>
              {s.is_mine || isMe ? (
                <Pressable onPress={() => remove(s)} hitSlop={6}>
                  <Text style={[styles.action, { color: c.textFaint }]}>Apagar</Text>
                </Pressable>
              ) : null}
              {!s.is_mine ? (
                <>
                  <Pressable onPress={() => onReport(s)} hitSlop={6}>
                    <Text style={[styles.action, { color: c.textFaint }]}>Denunciar</Text>
                  </Pressable>
                  <Pressable onPress={() => onBlock(s)} hitSlop={6}>
                    <Text style={[styles.action, { color: c.textFaint }]}>Bloquear</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          </Card>
        ))
      )}

      <Pressable
        onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Reportar conteúdo — Dromos')}`)}
        hitSlop={6}
        style={styles.contact}>
        <Text style={[styles.contactText, { color: c.textFaint }]}>Algo impróprio? Denuncie acima ou fale com a equipe.</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  composer: { marginBottom: 6 },
  input: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 15, minHeight: 56, textAlignVertical: 'top' },
  composerBtns: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  toggle: { flexDirection: 'row', borderWidth: 1, borderRadius: 999, overflow: 'hidden' },
  toggleOpt: { paddingHorizontal: 11, paddingVertical: 6 },
  toggleText: { fontSize: 12, fontWeight: '700' },
  sendBtn: { borderRadius: 999, paddingHorizontal: 20, paddingVertical: 9, minWidth: 84, alignItems: 'center' },
  sendText: { fontSize: 14, fontWeight: '800' },
  hint: { fontSize: 13, lineHeight: 19, marginBottom: 6 },
  scrap: { marginTop: 10 },
  scrapHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  avatar: { fontSize: 24 },
  author: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  date: { fontSize: 12 },
  lock: { fontSize: 11, fontWeight: '700', borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  body: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 18, marginTop: 10 },
  action: { fontSize: 12, fontWeight: '700' },
  contact: { marginTop: 16, alignItems: 'center' },
  contactText: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
