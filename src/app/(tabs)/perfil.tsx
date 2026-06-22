/**
 * Aba Perfil — cabeçalho do leitor, card de estatísticas (roxo+verde, base do
 * card compartilhável da Fase 5a), seletor de aparência (claro/escuro/sistema)
 * e o banco de Vocabulário (§2.3). Base neutra; card de stats mantém a marca.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileEditor } from '@/components/profile-editor';
import { ProfileHeader } from '@/components/profile-header';
import { Card, ScreenBG, SectionTitle } from '@/components/social-ui';
import { StatsCard } from '@/components/stats-card';
import { useUI } from '@/hooks/use-ui';
import { computeAchievements, deriveStats } from '@/services/progress';
import { approveRequest, getFollowRequests, rejectRequest, type FollowRequest } from '@/services/social';
import { useAI } from '@/store/ai';
import { displayName, signOut, useAuth } from '@/store/auth';
import { useLibrary, type UITheme } from '@/store/library';
import { updateProfile, useProfile } from '@/store/profile';
import { PROVIDERS } from '@/services/ai/providers';

const THEME_OPTIONS: { id: UITheme; label: string }[] = [
  { id: 'system', label: 'Sistema' },
  { id: 'light', label: 'Claro' },
  { id: 'dark', label: 'Escuro' },
];

export default function ProfileScreen() {
  const c = useUI();
  const books = useLibrary((s) => s.books.length);
  const vocab = useLibrary((s) => s.vocab);
  const removeVocab = useLibrary((s) => s.removeVocab);
  const stats = useLibrary((s) => s.stats);
  const uiTheme = useLibrary((s) => s.uiTheme);
  const setUiTheme = useLibrary((s) => s.setUiTheme);
  const user = useAuth((s) => s.user);
  const configured = useAuth((s) => s.configured);
  const profile = useProfile((s) => s.profile);
  const aiProvider = useAI((s) => s.provider);
  const aiHasKey = useAI((s) => s.hasKey);
  const [showVocab, setShowVocab] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [savingPublic, setSavingPublic] = useState(false);
  const [requests, setRequests] = useState<FollowRequest[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (user) getFollowRequests().then(setRequests);
      else setRequests([]);
    }, [user]),
  );

  async function togglePublic(next: boolean) {
    setSavingPublic(true);
    await updateProfile({ is_public: next });
    setSavingPublic(false);
  }

  async function respondRequest(followerId: string, accept: boolean) {
    setRequests((prev) => prev.filter((r) => r.follower_id !== followerId)); // otimista
    await (accept ? approveRequest(followerId) : rejectRequest(followerId));
  }

  const derived = deriveStats(stats);
  const achievements = computeAchievements({ booksCount: books, vocabCount: vocab.length, derived });
  const unlocked = achievements.filter((a) => a.unlocked).length;
  const headerName = profile?.name?.trim() || displayName(user);

  return (
    <ScreenBG>
      <ProfileHeader
        name={headerName}
        avatar={profile?.avatar_url}
        derived={derived}
        achievements={achievements}
      />

      <SectionTitle icon="👤">Conta</SectionTitle>
      {!configured ? (
        <Card>
          <Text style={[styles.acctTitle, { color: c.text }]}>Backend não configurado</Text>
          <Text style={[styles.acctSub, { color: c.textFaint }]}>
            Preencha as credenciais do Supabase em app.json para habilitar conta e sincronização.
          </Text>
        </Card>
      ) : user ? (
        <Card style={styles.acctRow}>
          <Pressable style={styles.flex} onPress={() => setShowEditProfile(true)}>
            <Text style={[styles.acctTitle, { color: c.text }]}>{headerName}</Text>
            <Text style={[styles.acctSub, { color: c.textFaint }]}>{user.email}</Text>
            <Text style={[styles.acctEdit, { color: c.green }]}>Editar perfil ›</Text>
          </Pressable>
          <Pressable onPress={() => signOut()} hitSlop={8}>
            <Text style={[styles.acctAction, { color: c.textDim }]}>Sair</Text>
          </Pressable>
        </Card>
      ) : (
        <Pressable onPress={() => router.navigate('/login')}>
          <Card style={styles.acctRow}>
            <View style={styles.flex}>
              <Text style={[styles.acctTitle, { color: c.text }]}>Entrar / Criar conta</Text>
              <Text style={[styles.acctSub, { color: c.textFaint }]}>
                Para feed, kudos e sincronizar entre aparelhos.
              </Text>
            </View>
            <Text style={[styles.chev, { color: c.textFaint }]}>›</Text>
          </Card>
        </Pressable>
      )}

      {user ? (
        <>
          <Pressable onPress={() => router.navigate({ pathname: '/usuario', params: { id: user.id, name: headerName } })}>
            <Card style={[styles.acctRow, { marginTop: 12 }]}>
              <View style={styles.flex}>
                <Text style={[styles.acctTitle, { color: c.text }]}>Meu perfil e recados</Text>
                <Text style={[styles.acctSub, { color: c.textFaint }]}>Veja como os outros te veem · mural de recados</Text>
              </View>
              <Text style={[styles.chev, { color: c.textFaint }]}>›</Text>
            </Card>
          </Pressable>

          <SectionTitle icon="🌐">Privacidade</SectionTitle>
          <Card style={styles.acctRow}>
            <View style={styles.flex}>
              <Text style={[styles.acctTitle, { color: c.text }]}>Perfil público</Text>
              <Text style={[styles.acctSub, { color: c.textFaint }]}>
                {profile?.is_public
                  ? 'Outros leitores veem seu perfil, sua estante e suas leituras.'
                  : 'Seu perfil é privado. Ative para participar do feed e ser seguido.'}
              </Text>
            </View>
            <Switch
              value={!!profile?.is_public}
              onValueChange={togglePublic}
              disabled={savingPublic}
              trackColor={{ true: c.green, false: c.border }}
              thumbColor="#fff"
            />
          </Card>

          {requests.length > 0 ? (
            <>
              <SectionTitle icon="🙋">Solicitações de seguir</SectionTitle>
              {requests.map((r) => (
                <Card key={r.follower_id} style={styles.reqRow}>
                  <Pressable
                    style={styles.reqWho}
                    onPress={() => router.navigate({ pathname: '/usuario', params: { id: r.follower_id, name: r.name ?? '' } })}>
                    <Text style={styles.reqAvatar}>{r.avatar_url || '🦉'}</Text>
                    <Text style={[styles.reqName, { color: c.text }]} numberOfLines={1}>
                      {r.name?.trim() || 'Leitor'}
                    </Text>
                  </Pressable>
                  <View style={styles.reqActions}>
                    <Pressable onPress={() => respondRequest(r.follower_id, true)} style={[styles.reqAccept, { backgroundColor: c.green }]}>
                      <Text style={[styles.reqAcceptText, { color: c.onGreen }]}>Aceitar</Text>
                    </Pressable>
                    <Pressable onPress={() => respondRequest(r.follower_id, false)} hitSlop={6}>
                      <Text style={[styles.reqReject, { color: c.textFaint }]}>Recusar</Text>
                    </Pressable>
                  </View>
                </Card>
              ))}
            </>
          ) : null}
        </>
      ) : null}

      <SectionTitle icon="📈">Estatísticas</SectionTitle>
      <StatsCard />
      <Pressable onPress={() => router.navigate('/compartilhar')} style={[styles.shareCta, { backgroundColor: c.green }]}>
        <Text style={[styles.shareCtaText, { color: c.onGreen }]}>📤 Compartilhar</Text>
      </Pressable>

      <SectionTitle icon="🎯">Metas</SectionTitle>
      <Pressable onPress={() => router.navigate('/conquistas')}>
        <Card style={styles.acctRow}>
          <View style={styles.flex}>
            <Text style={[styles.acctTitle, { color: c.text }]}>Metas e conquistas</Text>
            <Text style={[styles.acctSub, { color: c.textFaint }]}>
              Crie objetivos com prazo · {unlocked} de {achievements.length} emblemas
            </Text>
          </View>
          <Text style={[styles.chev, { color: c.textFaint }]}>›</Text>
        </Card>
      </Pressable>

      <SectionTitle icon="🎨">Aparência</SectionTitle>
      <View style={[styles.segment, { backgroundColor: c.card, borderColor: c.border }]}>
        {THEME_OPTIONS.map((opt) => {
          const active = uiTheme === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => setUiTheme(opt.id)}
              style={[styles.segItem, active && { backgroundColor: c.green }]}>
              <Text style={[styles.segText, { color: active ? c.onGreen : c.textDim }]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <SectionTitle icon="✨">Inteligência Artificial</SectionTitle>
      <Pressable onPress={() => router.navigate('/integracoes')}>
        <Card style={styles.acctRow}>
          <View style={styles.flex}>
            <Text style={[styles.acctTitle, { color: c.text }]}>Integrações de IA</Text>
            <Text style={[styles.acctSub, { color: c.textFaint }]}>
              {aiHasKey
                ? `Conectado · ${PROVIDERS[aiProvider].label}`
                : 'Use sua própria chave para o dicionário contextual'}
            </Text>
          </View>
          <Text style={[styles.chev, { color: aiHasKey ? c.green : c.textFaint }]}>
            {aiHasKey ? '●' : '›'}
          </Text>
        </Card>
      </Pressable>

      <SectionTitle icon="💬">Vocabulário</SectionTitle>
      <Pressable onPress={() => setShowVocab(true)}>
        <Card style={styles.vocabRow}>
          <View>
            <Text style={[styles.vocabTitle, { color: c.text }]}>Banco de palavras</Text>
            <Text style={[styles.vocabSub, { color: c.textFaint }]}>
              {vocab.length} palavra{vocab.length === 1 ? '' : 's'} marcada
              {vocab.length === 1 ? '' : 's'}
            </Text>
          </View>
          <Text style={[styles.chev, { color: c.textFaint }]}>›</Text>
        </Card>
      </Pressable>

      <Modal visible={showVocab} animationType="slide" onRequestClose={() => setShowVocab(false)}>
        <View style={[styles.flex, { backgroundColor: c.bg }]}>
          <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: c.text }]}>Vocabulário</Text>
              <Pressable onPress={() => setShowVocab(false)} hitSlop={8}>
                <Text style={[styles.close, { color: c.green }]}>Fechar</Text>
              </Pressable>
            </View>
            {vocab.length === 0 ? (
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: c.textFaint }]}>
                  Nenhuma palavra ainda.{'\n'}Enquanto lê, toque numa palavra e escolha “Marcar”.
                </Text>
              </View>
            ) : (
              <FlatList
                data={vocab}
                keyExtractor={(v) => v.id}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => (
                  <Card style={styles.vCard}>
                    <View style={styles.flex}>
                      <Text style={[styles.vWord, { color: c.text }]}>{item.word}</Text>
                      {item.context ? (
                        <Text style={[styles.vCtx, { color: c.textFaint }]} numberOfLines={2}>
                          {item.context}
                        </Text>
                      ) : null}
                      {item.bookName ? (
                        <Text style={[styles.vBook, { color: c.textDim }]}>— {item.bookName}</Text>
                      ) : null}
                    </View>
                    <Pressable onPress={() => removeVocab(item.id)} hitSlop={12}>
                      <Text style={[styles.remove, { color: c.textFaint }]}>×</Text>
                    </Pressable>
                  </Card>
                )}
              />
            )}
          </SafeAreaView>
        </View>
      </Modal>

      <ProfileEditor
        visible={showEditProfile}
        profile={profile}
        onClose={() => setShowEditProfile(false)}
      />
    </ScreenBG>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  acctRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  acctTitle: { fontSize: 16, fontWeight: '700' },
  acctSub: { fontSize: 13, marginTop: 3 },
  acctEdit: { fontSize: 13, marginTop: 6, fontWeight: '700' },
  acctAction: { fontSize: 15, fontWeight: '700' },
  reqRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  reqWho: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  reqAvatar: { fontSize: 26 },
  reqName: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  reqActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reqAccept: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7 },
  reqAcceptText: { fontSize: 13, fontWeight: '800' },
  reqReject: { fontSize: 13, fontWeight: '700' },
  shareCta: { marginTop: 14, borderRadius: 999, paddingVertical: 13, alignItems: 'center' },
  shareCtaText: { fontSize: 15, fontWeight: '800' },
  segment: { flexDirection: 'row', borderRadius: 999, borderWidth: 1, padding: 4, gap: 4 },
  segItem: { flex: 1, borderRadius: 999, paddingVertical: 9, alignItems: 'center' },
  segText: { fontSize: 14, fontWeight: '700' },
  vocabRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  vocabTitle: { fontSize: 16, fontWeight: '700' },
  vocabSub: { fontSize: 13, marginTop: 3 },
  chev: { fontSize: 22 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  modalTitle: { fontSize: 22, fontWeight: '800' },
  close: { fontSize: 15, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  emptyText: { textAlign: 'center', fontSize: 15, lineHeight: 22 },
  list: { gap: 10, paddingHorizontal: 16, paddingBottom: 24 },
  vCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vWord: { fontSize: 16, fontWeight: '700' },
  vCtx: { fontSize: 13, marginTop: 3 },
  vBook: { fontSize: 12, marginTop: 3 },
  remove: { fontSize: 26, fontWeight: '300' },
});
