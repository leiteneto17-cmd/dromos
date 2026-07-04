/**
 * CLUBE (detalhe) — a trilha do clube do livro guiado (G2 do ROADMAP-CLUBE).
 * Trilha de etapas (cronograma), etapa selecionada mostra as perguntas de
 * discussão (IA, cacheadas 1× no banco — quem gera primeiro paga; anti-spoiler
 * no prompt) e as respostas dos membros (posts). Pele hub roxo+verde (§2.7).
 */
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Card, ScreenBG } from '@/components/social-ui';
import { useUI } from '@/hooks/use-ui';
import {
  apagarPost,
  gerarPerguntasEtapa,
  getClube,
  getPosts,
  postar,
  type Clube,
  type ClubeMember,
  type ClubePost,
  type ClubeStage,
} from '@/services/clube';
import { useAuth } from '@/store/auth';

export default function ClubeScreen() {
  const c = useUI();
  const { id } = useLocalSearchParams<{ id: string }>();
  const uid = useAuth((s) => s.user?.id);

  const [clube, setClube] = useState<Clube | null>(null);
  const [etapas, setEtapas] = useState<ClubeStage[]>([]);
  const [membros, setMembros] = useState<ClubeMember[]>([]);
  const [posts, setPosts] = useState<ClubePost[]>([]);
  const [etapaSel, setEtapaSel] = useState<number>(1);
  const [gerando, setGerando] = useState(false);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  const recarregar = useCallback(async () => {
    if (!id) return;
    const [{ clube: cl, etapas: es, membros: ms }, ps] = await Promise.all([
      getClube(id),
      getPosts(id),
    ]);
    setClube(cl);
    setEtapas(es);
    setMembros(ms);
    setPosts(ps);
    // Etapa "atual" = primeira com data-alvo no futuro (ou a última).
    if (es.length) {
      const hoje = new Date().toISOString().slice(0, 10);
      const atual = es.find((e) => (e.target_date ?? '') >= hoje) ?? es[es.length - 1];
      setEtapaSel((prev) => (prev === 1 ? atual.stage_no : prev));
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      recarregar();
    }, [recarregar]),
  );

  const etapa = etapas.find((e) => e.stage_no === etapaSel) ?? null;
  const postsDaEtapa = posts.filter((p) => p.stage_no === etapaSel);
  const souDono = !!clube && clube.owner_id === uid;

  async function gerar() {
    if (!clube || !etapa) return;
    setGerando(true);
    const r = await gerarPerguntasEtapa(clube, etapa);
    setGerando(false);
    if (r.error || !r.perguntas) {
      Alert.alert('Perguntas indisponíveis', r.error ?? 'Tente de novo.');
      return;
    }
    setEtapas((prev) =>
      prev.map((e) => (e.stage_no === etapa.stage_no ? { ...e, perguntas_json: r.perguntas! } : e)),
    );
  }

  async function enviar() {
    if (!id || texto.trim().length === 0) return;
    setEnviando(true);
    const err = await postar(id, etapaSel, texto);
    setEnviando(false);
    if (err) {
      Alert.alert('Não deu para publicar', err);
      return;
    }
    setTexto('');
    setPosts(await getPosts(id));
  }

  function convidar() {
    if (!clube) return;
    Share.share({
      message:
        `📖 Bora ler "${clube.book_title}" comigo no Dromos? ` +
        `Baixe o app e entre no meu clube com o código: ${clube.invite_code}`,
    }).catch(() => {});
  }

  async function apagar(p: ClubePost) {
    const err = await apagarPost(p.id);
    if (err) Alert.alert('Não deu para apagar', err);
    else setPosts((prev) => prev.filter((x) => x.id !== p.id));
  }

  if (!clube) {
    return (
      <ScreenBG scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator color={c.green} />
        </View>
      </ScreenBG>
    );
  }

  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <ScreenBG scroll={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
          <Text style={[styles.backText, { color: c.textDim }]}>‹ Voltar</Text>
        </Pressable>
      </View>

      <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
        {clube.name}
      </Text>
      <Text style={[styles.subtitle, { color: c.textFaint }]} numberOfLines={1}>
        {clube.book_title}
        {clube.book_author ? ` · ${clube.book_author}` : ''} · {membros.length}{' '}
        {membros.length === 1 ? 'membro' : 'membros'}
      </Text>

      {/* Convite (código digitável — G3.1; deep link fica p/ quando o app estiver nas lojas) */}
      <Pressable onPress={convidar} style={[styles.inviteRow, { borderColor: c.border, backgroundColor: c.card }]}>
        <Text style={[styles.inviteText, { color: c.textDim }]}>
          Convite: <Text style={{ color: c.green, fontWeight: '900', letterSpacing: 2 }}>{clube.invite_code}</Text>
        </Text>
        <Text style={[styles.inviteShare, { color: c.purple }]}>Compartilhar ›</Text>
      </Pressable>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {/* ---- Trilha de etapas ---- */}
        <Text style={[styles.section, { color: c.purple }]}>TRILHA DO LIVRO</Text>
        {etapas.map((e) => {
          const on = e.stage_no === etapaSel;
          const passada = (e.target_date ?? '') < hoje;
          return (
            <Pressable key={e.stage_no} onPress={() => setEtapaSel(e.stage_no)}>
              <View style={styles.stageRow}>
                <View
                  style={[
                    styles.stageDot,
                    {
                      backgroundColor: on ? c.green : passada ? c.purple : c.cardElevated,
                      borderColor: on ? c.green : c.border,
                    },
                  ]}>
                  <Text style={[styles.stageNo, { color: on ? '#14121C' : c.textDim }]}>
                    {e.stage_no}
                  </Text>
                </View>
                <View style={[styles.stageBody, on && { borderColor: c.green, borderWidth: 1.5 }, { backgroundColor: c.card }]}>
                  <Text style={[styles.stageTitle, { color: on ? c.text : c.textDim }]}>
                    {e.title}
                  </Text>
                  <Text style={[styles.stageMeta, { color: c.textFaint }]} numberOfLines={1}>
                    {e.chapters ?? ''}
                    {e.target_date
                      ? ` · até ${new Date(e.target_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
                      : ''}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })}

        {/* ---- Discussão da etapa selecionada ---- */}
        {etapa ? (
          <>
            <Text style={[styles.section, { color: c.purple, marginTop: 10 }]}>
              DISCUSSÃO · {etapa.title.toUpperCase()}
            </Text>

            {etapa.perguntas_json ? (
              <Card style={styles.qCard}>
                {etapa.perguntas_json.map((q, i) => (
                  <Text key={i} style={[styles.q, { color: c.text }]}>
                    <Text style={{ color: c.green, fontWeight: '900' }}>{i + 1}.</Text> {q}
                  </Text>
                ))}
                <Text style={[styles.qHint, { color: c.textFaint }]}>
                  Sem spoiler: as perguntas só cobrem até o fim desta etapa. 🤫
                </Text>
              </Card>
            ) : (
              <Pressable
                onPress={gerar}
                disabled={gerando}
                style={[styles.genBtn, { borderColor: c.green }]}>
                {gerando ? (
                  <ActivityIndicator color={c.green} />
                ) : (
                  <Text style={[styles.genText, { color: c.green }]}>
                    ✨ Gerar perguntas de discussão desta etapa
                  </Text>
                )}
              </Pressable>
            )}

            {/* Responder */}
            <View style={styles.postRow}>
              <TextInput
                value={texto}
                onChangeText={setTexto}
                placeholder="O que você achou deste trecho?"
                placeholderTextColor={c.textFaint}
                multiline
                maxLength={2000}
                style={[
                  styles.input,
                  { color: c.text, borderColor: c.border, backgroundColor: c.card },
                ]}
              />
              <Pressable
                onPress={enviar}
                disabled={enviando || texto.trim().length === 0}
                style={[
                  styles.sendBtn,
                  { backgroundColor: !enviando && texto.trim() ? c.green : c.border },
                ]}>
                <Text style={styles.sendText}>{enviando ? '…' : 'Publicar'}</Text>
              </Pressable>
            </View>

            {postsDaEtapa.map((p) => (
              <Card key={p.id} style={styles.post}>
                <View style={styles.postTop}>
                  <Text style={[styles.postAuthor, { color: c.text }]} numberOfLines={1}>
                    {p.author_name}
                  </Text>
                  <Text style={[styles.postWhen, { color: c.textFaint }]}>
                    {new Date(p.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </Text>
                </View>
                <Text style={[styles.postBody, { color: c.textDim }]}>{p.body}</Text>
                {p.author_id === uid || souDono ? (
                  <Pressable onPress={() => apagar(p)} hitSlop={6}>
                    <Text style={[styles.postDelete, { color: c.textFaint }]}>apagar</Text>
                  </Pressable>
                ) : null}
              </Card>
            ))}
            {postsDaEtapa.length === 0 ? (
              <Text style={[styles.empty, { color: c.textFaint }]}>
                Ninguém respondeu ainda — comece a conversa! ☕
              </Text>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </ScreenBG>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  back: { paddingVertical: 4, paddingRight: 8 },
  backText: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 13.5, marginTop: 2 },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 10,
  },
  inviteText: { fontSize: 13.5, fontWeight: '700' },
  inviteShare: { fontSize: 13.5, fontWeight: '800' },
  list: { gap: 10, paddingTop: 12, paddingBottom: 24 },
  section: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stageDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageNo: { fontSize: 14, fontWeight: '900' },
  stageBody: { flex: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  stageTitle: { fontSize: 14.5, fontWeight: '800' },
  stageMeta: { fontSize: 12.5, marginTop: 1 },
  qCard: { gap: 8 },
  q: { fontSize: 14.5, lineHeight: 21 },
  qHint: { fontSize: 12, marginTop: 2 },
  genBtn: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  genText: { fontSize: 14.5, fontWeight: '800' },
  postRow: { gap: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14.5,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  sendBtn: { alignSelf: 'flex-end', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 9 },
  sendText: { fontSize: 14, fontWeight: '800', color: '#14121C' },
  post: { gap: 4 },
  postTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  postAuthor: { fontSize: 13.5, fontWeight: '800', flex: 1 },
  postWhen: { fontSize: 12 },
  postBody: { fontSize: 14, lineHeight: 20 },
  postDelete: { fontSize: 12, fontWeight: '700', alignSelf: 'flex-end', paddingTop: 2 },
  empty: { fontSize: 13, textAlign: 'center', marginTop: 4 },
});
