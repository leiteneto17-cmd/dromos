/**
 * CLUBES — meus clubes do livro + criar novo + entrar por código (G2/G3.1 do
 * ROADMAP-CLUBE). Pele hub roxo+verde (§2.7). Sem descoberta pública no MVP:
 * clube só aparece aqui se sou membro (RLS) ou entrando por código de convite.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AdBanner } from '@/components/ad-banner';
import { BrandFont } from '@/constants/theme';
import { Card, ScreenBG } from '@/components/social-ui';
import { useUI } from '@/hooks/use-ui';
import { criarClube, entrarPorCodigo, meusClubes, type Clube } from '@/services/clube';
import { Social } from '@/theme/social';
import { useAuth } from '@/store/auth';
import { useLibrary } from '@/store/library';

const WEEK_OPTIONS = [2, 4, 6, 8];

export default function ClubesScreen() {
  const c = useUI();
  const user = useAuth((s) => s.user);
  const books = useLibrary((s) => s.books);

  const [clubes, setClubes] = useState<Clube[] | null>(null);
  const [criando, setCriando] = useState(false);
  const [bookId, setBookId] = useState<string | null>(null);
  const [weeks, setWeeks] = useState(4);
  const [codigo, setCodigo] = useState('');
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let on = true;
      meusClubes().then((r) => on && setClubes(r));
      return () => {
        on = false;
      };
    }, []),
  );

  async function criar() {
    const book = books.find((b) => b.id === bookId);
    if (!book) return;
    const titulo = book.title ?? book.name;
    setBusy(true);
    const r = await criarClube({
      name: `Clube: ${titulo}`,
      bookTitle: titulo,
      bookCoverUrl: book.coverUrl ?? null,
      weeks,
    });
    setBusy(false);
    if (r.error || !r.clube) {
      Alert.alert('Não deu para criar o clube', r.error ?? 'Tente novamente.');
      return;
    }
    setCriando(false);
    setBookId(null);
    router.push({ pathname: '/clube', params: { id: r.clube.id } });
  }

  function entrar() {
    if (codigo.trim().length < 4) return;
    // Consentimento explícito (R2 do plano — lição Strava, privacidade por padrão):
    // entrar no clube = concordar em mostrar o progresso NESTE livro aos membros.
    Alert.alert(
      'Entrar no clube',
      'Ao entrar, seu progresso de leitura neste livro fica visível para os membros do clube (atividades privadas continuam privadas). Tudo bem?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Entrar', onPress: () => void confirmarEntrada() },
      ],
    );
  }

  async function confirmarEntrada() {
    setBusy(true);
    const r = await entrarPorCodigo(codigo);
    setBusy(false);
    if (r.error || !r.clube) {
      Alert.alert('Não rolou', r.error ?? 'Tente novamente.');
      return;
    }
    setCodigo('');
    router.push({ pathname: '/clube', params: { id: r.clube.id } });
  }

  return (
    <ScreenBG scroll={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
          <Text style={[styles.backText, { color: c.textDim }]}>‹ Voltar</Text>
        </Pressable>
      </View>

      <Text style={[styles.title, { color: c.text }]}>📖 Clube do Livro</Text>
      <Text style={[styles.subtitle, { color: c.textFaint }]}>
        Leia junto: cronograma por semanas + perguntas de discussão a cada etapa. Sozinho já
        funciona — e um amigo entra com o código do convite.
      </Text>

      {!user ? (
        <Card>
          <Text style={[styles.hint, { color: c.textDim }]}>
            Entre na sua conta para criar ou participar de um clube.
          </Text>
          <Pressable onPress={() => router.navigate('/login')}>
            <Text style={[styles.link, { color: c.green }]}>Fazer login ›</Text>
          </Pressable>
        </Card>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {/* ---- Meus clubes ---- */}
          {clubes === null ? (
            <ActivityIndicator color={c.green} />
          ) : clubes.length === 0 ? (
            <Text style={[styles.hint, { color: c.textFaint }]}>
              Você ainda não está em nenhum clube. Crie o primeiro 👇
            </Text>
          ) : (
            clubes.map((cl) => (
              <Pressable
                key={cl.id}
                onPress={() => router.push({ pathname: '/clube', params: { id: cl.id } })}>
                <Card style={styles.clubRow}>
                  <Text style={styles.clubEmoji}>📖</Text>
                  <View style={styles.flex}>
                    <Text style={[styles.clubName, { color: c.text }]} numberOfLines={1}>
                      {cl.name}
                    </Text>
                    <Text style={[styles.clubBook, { color: c.textFaint }]} numberOfLines={1}>
                      {cl.book_title}
                      {cl.book_author ? ` · ${cl.book_author}` : ''} · {cl.weeks} semanas
                    </Text>
                  </View>
                  <Text style={[styles.chev, { color: c.purple }]}>›</Text>
                </Card>
              </Pressable>
            ))
          )}

          {/* ---- Criar clube ---- */}
          {!criando ? (
            <Pressable onPress={() => setCriando(true)} style={[styles.newBtn, { borderColor: c.green }]}>
              <Text style={[styles.newBtnText, { color: c.green }]}>+ Criar clube de um livro</Text>
            </Pressable>
          ) : (
            <Card style={styles.form}>
              <Text style={[styles.formLabel, { color: c.purple }]}>QUAL LIVRO?</Text>
              {books.length === 0 ? (
                <Text style={[styles.hint, { color: c.textFaint }]}>
                  Sua biblioteca está vazia — importe um livro ou baixe um clássico no Explorar.
                </Text>
              ) : (
                <View style={styles.chips}>
                  {books.slice(0, 12).map((b) => {
                    const on = b.id === bookId;
                    return (
                      <Pressable
                        key={b.id}
                        onPress={() => setBookId(b.id)}
                        style={[
                          styles.chip,
                          { backgroundColor: c.cardElevated, borderColor: on ? c.green : c.border },
                          on && { borderWidth: 2 },
                        ]}>
                        <Text
                          style={[styles.chipText, { color: on ? c.green : c.textDim }]}
                          numberOfLines={1}>
                          {b.title ?? b.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              <Text style={[styles.formLabel, { color: c.purple, marginTop: 10 }]}>
                LER EM QUANTAS SEMANAS?
              </Text>
              <View style={styles.chips}>
                {WEEK_OPTIONS.map((w) => {
                  const on = w === weeks;
                  return (
                    <Pressable
                      key={w}
                      onPress={() => setWeeks(w)}
                      style={[
                        styles.chip,
                        { backgroundColor: c.cardElevated, borderColor: on ? c.green : c.border },
                        on && { borderWidth: 2 },
                      ]}>
                      <Text style={[styles.chipText, { color: on ? c.green : c.textDim }]}>{w}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.formActions}>
                <Pressable onPress={() => setCriando(false)}>
                  <Text style={[styles.link, { color: c.textDim }]}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={criar}
                  disabled={!bookId || busy}
                  style={[styles.cta, { backgroundColor: bookId && !busy ? c.green : c.border }]}>
                  {busy ? (
                    <ActivityIndicator color={Social.dark} />
                  ) : (
                    <Text style={styles.ctaText}>Criar clube</Text>
                  )}
                </Pressable>
              </View>
            </Card>
          )}

          {/* ---- Entrar por código ---- */}
          <Card style={styles.form}>
            <Text style={[styles.formLabel, { color: c.purple }]}>RECEBEU UM CONVITE?</Text>
            <View style={styles.joinRow}>
              <TextInput
                value={codigo}
                onChangeText={(t) => setCodigo(t.toUpperCase())}
                placeholder="CÓDIGO"
                placeholderTextColor={c.textFaint}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={8}
                style={[
                  styles.input,
                  { color: c.text, borderColor: c.border, backgroundColor: c.cardElevated },
                ]}
              />
              <Pressable
                onPress={entrar}
                disabled={busy || codigo.trim().length < 4}
                style={[
                  styles.cta,
                  { backgroundColor: !busy && codigo.trim().length >= 4 ? c.green : c.border },
                ]}>
                <Text style={styles.ctaText}>Entrar</Text>
              </Pressable>
            </View>
          </Card>
        </ScrollView>
      )}

      <AdBanner style={styles.ad} />
    </ScreenBG>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  back: { paddingVertical: 4, paddingRight: 8 },
  backText: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 28, fontFamily: BrandFont.extrabold },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 2, marginBottom: 12 },
  list: { gap: 12, paddingTop: 4, paddingBottom: 24 },
  flex: { flex: 1 },
  hint: { fontSize: 13.5, lineHeight: 19 },
  link: { fontSize: 14, fontWeight: '700', paddingVertical: 6 },
  clubRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clubEmoji: { fontSize: 24 },
  clubName: { fontSize: 16, fontWeight: '800' },
  clubBook: { fontSize: 13, marginTop: 1 },
  chev: { fontSize: 22, fontWeight: '800' },
  newBtn: {
    borderWidth: 1.5,
    borderRadius: 14,
    borderStyle: 'dashed',
    paddingVertical: 14,
    alignItems: 'center',
  },
  newBtnText: { fontSize: 15, fontWeight: '800' },
  form: { gap: 8 },
  formLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: '100%',
  },
  chipText: { fontSize: 13.5, fontWeight: '700' },
  formActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  cta: { borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  ctaText: { fontSize: 14.5, fontWeight: '800', color: Social.dark },
  joinRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
  ad: { marginTop: 12 },
});
