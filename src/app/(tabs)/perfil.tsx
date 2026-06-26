/**
 * Aba Perfil — estilo Instagram: cabeçalho do leitor + um ⚙️ que abre a folha de
 * CONFIGURAÇÕES (editar perfil, aparência, privacidade, IA, sair, excluir conta —
 * components/settings-sheet.tsx). O corpo do perfil fica enxuto: estatísticas
 * (retráteis), Metas, Vocabulário e a parte social (recados + solicitações).
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MyShelf } from '@/components/my-shelf';
import { PressableScale } from '@/components/pressable-scale';
import { ProfileEditor } from '@/components/profile-editor';
import { ProfileHeader } from '@/components/profile-header';
import { SettingsSheet } from '@/components/settings-sheet';
import { Card, ScreenBG, SectionTitle } from '@/components/social-ui';
import { StatsCard } from '@/components/stats-card';
import { Fonts } from '@/constants/theme';
import { useUI } from '@/hooks/use-ui';
import { computeAchievements, deriveStats } from '@/services/progress';
import { approveRequest, getFollowRequests, rejectRequest, type FollowRequest } from '@/services/social';
import { displayName, useAuth } from '@/store/auth';
import { useLibrary } from '@/store/library';
import { syncBadges, useProfile } from '@/store/profile';

export default function ProfileScreen() {
  const c = useUI();
  const books = useLibrary((s) => s.books.length);
  const vocab = useLibrary((s) => s.vocab);
  const removeVocab = useLibrary((s) => s.removeVocab);
  const stats = useLibrary((s) => s.stats);
  const sessions = useLibrary((s) => s.sessions);
  const bookProgress = useLibrary((s) => s.progress);
  const user = useAuth((s) => s.user);
  const configured = useAuth((s) => s.configured);
  const profile = useProfile((s) => s.profile);

  const [showVocab, setShowVocab] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // Estatísticas retráteis — começam recolhidas para o perfil ocupar menos espaço.
  const [showStats, setShowStats] = useState(false);
  const [requests, setRequests] = useState<FollowRequest[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (user) getFollowRequests().then(setRequests);
      else setRequests([]);
    }, [user]),
  );

  async function respondRequest(followerId: string, accept: boolean) {
    setRequests((prev) => prev.filter((r) => r.follower_id !== followerId)); // otimista
    await (accept ? approveRequest(followerId) : rejectRequest(followerId));
  }

  const derived = deriveStats(stats);
  const achievements = computeAchievements({
    booksCount: books,
    vocabCount: vocab.length,
    derived,
    sessions,
    progress: bookProgress,
  });
  const unlockedIds = achievements.filter((a) => a.unlocked).map((a) => a.id);
  const unlocked = unlockedIds.length;
  const headerName = profile?.name?.trim() || displayName(user);

  // Espelha os emblemas desbloqueados no perfil do banco, p/ aparecerem no perfil
  // PÚBLICO (outras pessoas veem). No-op se nada mudou / deslogado (ver syncBadges).
  const badgesKey = unlockedIds.join(',');
  useEffect(() => {
    void syncBadges(unlockedIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badgesKey]);

  return (
    <ScreenBG>
      {/* Barra superior com o ⚙️ (entrada para Configurações), estilo Instagram */}
      {user ? (
        <View style={styles.topBar}>
          <Pressable onPress={() => setShowSettings(true)} hitSlop={10} style={styles.gearBtn}>
            <Text style={styles.gear}>⚙️</Text>
            <Text style={[styles.gearLabel, { color: c.textDim }]}>Configurações</Text>
          </Pressable>
        </View>
      ) : null}

      <ProfileHeader
        name={headerName}
        avatar={profile?.avatar_url}
        derived={derived}
        achievements={achievements}
      />

      {!configured ? (
        <Card>
          <Text style={[styles.cardTitle, { color: c.text }]}>Backend não configurado</Text>
          <Text style={[styles.cardSub, { color: c.textFaint }]}>
            Preencha as credenciais do Supabase em app.json para habilitar conta e sincronização.
          </Text>
        </Card>
      ) : !user ? (
        <Pressable onPress={() => router.navigate('/login')}>
          <Card style={styles.row}>
            <View style={styles.flex}>
              <Text style={[styles.cardTitle, { color: c.text }]}>Entrar / Criar conta</Text>
              <Text style={[styles.cardSub, { color: c.textFaint }]}>
                Para feed, kudos e sincronizar entre aparelhos.
              </Text>
            </View>
            <Text style={[styles.chev, { color: c.textFaint }]}>›</Text>
          </Card>
        </Pressable>
      ) : (
        <>
          <PressableScale onPress={() => router.navigate({ pathname: '/usuario', params: { id: user.id, name: headerName } })}>
            <Card style={styles.row}>
              <View style={styles.flex}>
                <Text style={[styles.cardTitle, { color: c.text }]}>Meu perfil e recados</Text>
                <Text style={[styles.cardSub, { color: c.textFaint }]}>Veja como os outros te veem · mural de recados</Text>
              </View>
              <Text style={[styles.chev, { color: c.textFaint }]}>›</Text>
            </Card>
          </PressableScale>

          {requests.length > 0 ? (
            <>
              <SectionTitle name="userPlus">Solicitações de seguir</SectionTitle>
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
      )}

      {/* Estatísticas — retrátil (toque no título para abrir/fechar) */}
      <Pressable onPress={() => setShowStats((v) => !v)} style={styles.statsHeader}>
        <View style={styles.statsHeaderLeft}>
          <Text style={styles.statsIcon}>📈</Text>
          <Text style={[styles.statsTitle, { color: c.purple }]}>Estatísticas</Text>
        </View>
        <Text style={[styles.statsChevron, { color: c.purple }]}>{showStats ? '▾' : '▸'}</Text>
      </Pressable>
      {showStats ? (
        <>
          <StatsCard />
          <PressableScale onPress={() => router.navigate('/compartilhar')} style={[styles.shareCta, { backgroundColor: c.green }]}>
            <Text style={[styles.shareCtaText, { color: c.onGreen }]}>📤 Compartilhar</Text>
          </PressableScale>
        </>
      ) : null}

      <SectionTitle name="target">Metas</SectionTitle>
      <PressableScale onPress={() => router.navigate('/conquistas')}>
        <Card style={styles.row}>
          <View style={styles.flex}>
            <Text style={[styles.cardTitle, { color: c.text }]}>Metas e conquistas</Text>
            <Text style={[styles.cardSub, { color: c.textFaint }]}>
              Crie objetivos com prazo · {unlocked} de {achievements.length} emblemas
            </Text>
          </View>
          <Text style={[styles.chev, { color: c.textFaint }]}>›</Text>
        </Card>
      </PressableScale>

      <SectionTitle name="chat">Vocabulário</SectionTitle>
      <PressableScale onPress={() => setShowVocab(true)}>
        <Card style={styles.row}>
          <View style={styles.flex}>
            <Text style={[styles.cardTitle, { color: c.text }]}>Banco de palavras</Text>
            <Text style={[styles.cardSub, { color: c.textFaint }]}>
              {vocab.length} palavra{vocab.length === 1 ? '' : 's'} marcada
              {vocab.length === 1 ? '' : 's'}
            </Text>
          </View>
          <Text style={[styles.chev, { color: c.textFaint }]}>›</Text>
        </Card>
      </PressableScale>

      {/* Minha estante (catálogo Skoob) — saiu do hub (era redundante com a Biblioteca);
          aqui no perfil também é o que os outros veem quando o perfil é público. */}
      <MyShelf />

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

      <SettingsSheet
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        onEditProfile={() => {
          setShowSettings(false);
          setShowEditProfile(true);
        }}
      />

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
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 2 },
  gearBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 4 },
  gear: { fontSize: 20 },
  // Rótulo em fonte monoespaçada ("máquina de escrever") para deixar claro o que o ⚙️ abre.
  gearLabel: { fontFamily: Fonts?.mono, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardSub: { fontSize: 13, marginTop: 3 },
  chev: { fontSize: 22 },
  reqRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  reqWho: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  reqAvatar: { fontSize: 26 },
  reqName: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  reqActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reqAccept: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7 },
  reqAcceptText: { fontSize: 13, fontWeight: '800' },
  reqReject: { fontSize: 13, fontWeight: '700' },
  statsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 },
  statsHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statsIcon: { fontSize: 18 },
  statsTitle: { fontSize: 18, fontWeight: '700', letterSpacing: 0.3 },
  statsChevron: { fontSize: 16, fontWeight: '800' },
  shareCta: { marginTop: 14, borderRadius: 999, paddingVertical: 13, alignItems: 'center' },
  shareCtaText: { fontSize: 15, fontWeight: '800' },
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
