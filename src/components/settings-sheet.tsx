/**
 * Folha de CONFIGURAÇÕES (estilo Instagram) — agrupa tudo que é "ajuste" num único
 * lugar, aberta pelo ⚙️ do Perfil: editar perfil, aparência, privacidade, IA, sair e
 * excluir conta. Antes esses itens ficavam espalhados na aba Perfil, ocupando espaço.
 *
 * Para evitar Modal-dentro-de-Modal (problemático no iOS), a edição de perfil é
 * delegada ao componente pai via `onEditProfile` (fecha esta folha e abre o editor lá).
 */
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, SectionTitle } from '@/components/social-ui';
import { useUI } from '@/hooks/use-ui';
import { PROVIDERS } from '@/services/ai/providers';
import { useAI } from '@/store/ai';
import { deleteAccount, displayName, signOut, useAuth } from '@/store/auth';
import { useLibrary, type UITheme } from '@/store/library';
import { updateProfile, useProfile } from '@/store/profile';

const THEME_OPTIONS: { id: UITheme; label: string }[] = [
  { id: 'system', label: 'Sistema' },
  { id: 'light', label: 'Claro' },
  { id: 'dark', label: 'Escuro' },
];

export function SettingsSheet({
  visible,
  onClose,
  onEditProfile,
}: {
  visible: boolean;
  onClose: () => void;
  onEditProfile: () => void;
}) {
  const c = useUI();
  const user = useAuth((s) => s.user);
  const profile = useProfile((s) => s.profile);
  const uiTheme = useLibrary((s) => s.uiTheme);
  const setUiTheme = useLibrary((s) => s.setUiTheme);
  const aiProvider = useAI((s) => s.provider);
  const aiHasKey = useAI((s) => s.hasKey);
  const aiActive = aiHasKey || !!user;

  const [savingPublic, setSavingPublic] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const headerName = profile?.name?.trim() || displayName(user);

  async function togglePublic(next: boolean) {
    setSavingPublic(true);
    await updateProfile({ is_public: next });
    setSavingPublic(false);
  }

  const goIntegracoes = useCallback(() => {
    onClose();
    router.navigate('/integracoes');
  }, [onClose]);

  // Exclusão de conta (Apple 5.1.1(v) + Google): dupla confirmação por ser irreversível.
  function confirmDeleteAccount() {
    Alert.alert(
      'Excluir conta',
      'Isso apaga PERMANENTEMENTE sua conta e todos os seus dados na nuvem: perfil, ' +
        'atividades de leitura, estante, resenhas, recados, seguidores e curtidas. Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Continuar', style: 'destructive', onPress: askFinalConfirm },
      ],
    );
  }

  function askFinalConfirm() {
    Alert.alert('Tem certeza?', 'Confirma a exclusão definitiva da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir minha conta', style: 'destructive', onPress: runDeleteAccount },
    ]);
  }

  async function runDeleteAccount() {
    setDeleting(true);
    const res = await deleteAccount();
    setDeleting(false);
    if (!res.ok) {
      Alert.alert('Não foi possível excluir', res.error);
      return;
    }
    onClose(); // a sessão caiu → o guard em _layout leva para /login automaticamente
    Alert.alert('Conta excluída', 'Sua conta e seus dados foram removidos.');
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: c.bg }]}>
        <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: c.text }]}>Configurações</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={[styles.close, { color: c.green }]}>Fechar</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {/* Conta */}
          <SectionTitle icon="👤">Conta</SectionTitle>
          <Pressable onPress={onEditProfile}>
            <Card style={styles.row}>
              <View style={styles.flex}>
                <Text style={[styles.itemTitle, { color: c.text }]}>{headerName}</Text>
                {user?.email ? (
                  <Text style={[styles.itemSub, { color: c.textFaint }]}>{user.email}</Text>
                ) : null}
                <Text style={[styles.edit, { color: c.green }]}>Editar perfil ›</Text>
              </View>
              <Text style={[styles.chev, { color: c.textFaint }]}>›</Text>
            </Card>
          </Pressable>

          {/* Aparência */}
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

          {/* Privacidade */}
          <SectionTitle icon="🌐">Privacidade</SectionTitle>
          <Card style={styles.row}>
            <View style={styles.flex}>
              <Text style={[styles.itemTitle, { color: c.text }]}>Perfil público</Text>
              <Text style={[styles.itemSub, { color: c.textFaint }]}>
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

          {/* IA */}
          <SectionTitle icon="✨">Inteligência Artificial</SectionTitle>
          <Pressable onPress={goIntegracoes}>
            <Card style={styles.row}>
              <View style={styles.flex}>
                <Text style={[styles.itemTitle, { color: c.text }]}>Integrações de IA</Text>
                <Text style={[styles.itemSub, { color: c.textFaint }]}>
                  {aiHasKey
                    ? `Sua chave · ${PROVIDERS[aiProvider].label}`
                    : aiActive
                      ? 'IA grátis ativada · ou conecte sua própria chave'
                      : 'Entre na conta para a IA grátis, ou use sua chave'}
                </Text>
              </View>
              <Text style={[styles.chev, { color: aiActive ? c.green : c.textFaint }]}>
                {aiActive ? '●' : '›'}
              </Text>
            </Card>
          </Pressable>

          {/* Sessão / conta */}
          <SectionTitle icon="🚪">Sessão</SectionTitle>
          <Pressable
            onPress={() => {
              onClose();
              signOut();
            }}>
            <Card style={styles.row}>
              <Text style={[styles.itemTitle, { color: c.text }]}>Sair da conta</Text>
              <Text style={[styles.chev, { color: c.textFaint }]}>›</Text>
            </Card>
          </Pressable>

          <Pressable
            onPress={confirmDeleteAccount}
            disabled={deleting}
            style={styles.deleteRow}
            hitSlop={8}>
            {deleting ? (
              <ActivityIndicator size="small" color="#E5484D" />
            ) : (
              <Text style={styles.deleteText}>Excluir conta</Text>
            )}
          </Pressable>
        </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  title: { fontSize: 24, fontWeight: '800' },
  close: { fontSize: 15, fontWeight: '700' },
  body: { paddingHorizontal: 16, paddingBottom: 48 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemTitle: { fontSize: 16, fontWeight: '700' },
  itemSub: { fontSize: 13, marginTop: 3 },
  edit: { fontSize: 13, marginTop: 6, fontWeight: '700' },
  chev: { fontSize: 22 },
  segment: { flexDirection: 'row', borderRadius: 999, borderWidth: 1, padding: 4, gap: 4 },
  segItem: { flex: 1, borderRadius: 999, paddingVertical: 9, alignItems: 'center' },
  segText: { fontSize: 14, fontWeight: '700' },
  deleteRow: { marginTop: 24, alignItems: 'center', paddingVertical: 8, minHeight: 36, justifyContent: 'center' },
  deleteText: { fontSize: 14, fontWeight: '700', color: '#E5484D' },
});
