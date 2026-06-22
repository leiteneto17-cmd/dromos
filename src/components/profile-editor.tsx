/**
 * Modal de edição do perfil (nome + avatar emoji), persistindo no banco
 * (tabela profiles via src/store/profile.ts). Avatar é um emoji por enquanto;
 * upload de foto fica para um próximo incremento.
 */
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useUI } from '@/hooks/use-ui';
import { containsProfanity } from '@/services/moderation';
import { updateProfile, type Profile } from '@/store/profile';

const AVATARS = ['🦉', '📚', '🐱', '🦊', '🐢', '🌙', '☕', '🌱', '🐳', '🦄', '🔮', '🎧'];

export function ProfileEditor({
  visible,
  profile,
  onClose,
}: {
  visible: boolean;
  profile: Profile | null;
  onClose: () => void;
}) {
  const c = useUI();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sincroniza os campos quando o modal abre / o perfil muda.
  useEffect(() => {
    if (visible) {
      setName(profile?.name ?? '');
      setAvatar(profile?.avatar_url ?? null);
      setError(null);
    }
  }, [visible, profile]);

  async function save() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Escolha um nome.');
      return;
    }
    // Moderação básica (Apple 1.2 / §4.8): bloqueia nome ofensivo antes de subir.
    if (containsProfanity(trimmed)) {
      setError('Esse nome contém um termo não permitido. Escolha outro.');
      return;
    }
    setBusy(true);
    const res = await updateProfile({ name: trimmed, avatar_url: avatar });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: c.bg }]}>
          <View style={styles.handleRow}>
            <Text style={[styles.title, { color: c.text }]}>Editar perfil</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={[styles.cancel, { color: c.textDim }]}>Cancelar</Text>
            </Pressable>
          </View>

          <Text style={[styles.label, { color: c.textDim }]}>Avatar</Text>
          <View style={styles.avatarGrid}>
            {AVATARS.map((emoji) => {
              const active = avatar === emoji;
              return (
                <Pressable
                  key={emoji}
                  onPress={() => setAvatar(emoji)}
                  style={[
                    styles.avatarChip,
                    { backgroundColor: c.card, borderColor: active ? c.green : c.border },
                    active && { borderWidth: 2 },
                  ]}>
                  <Text style={styles.avatarEmoji}>{emoji}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: c.textDim }]}>Nome</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Seu nome de leitor"
            placeholderTextColor={c.textFaint}
            autoCapitalize="words"
            style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
          />

          {error ? <Text style={[styles.error, { color: '#E5484D' }]}>{error}</Text> : null}

          <Pressable
            onPress={save}
            disabled={busy}
            style={[styles.save, { backgroundColor: c.green, opacity: busy ? 0.7 : 1 }]}>
            {busy ? (
              <ActivityIndicator color={c.onGreen} />
            ) : (
              <Text style={[styles.saveText, { color: c.onGreen }]}>Salvar</Text>
            )}
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 28 },
  handleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  title: { fontSize: 20, fontWeight: '800' },
  cancel: { fontSize: 15, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 6 },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  avatarChip: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarEmoji: { fontSize: 26 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  error: { fontSize: 14, marginTop: 10, fontWeight: '600' },
  save: { marginTop: 20, borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  saveText: { fontSize: 16, fontWeight: '800' },
});
