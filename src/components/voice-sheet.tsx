/**
 * Seletor de VOZ do "Ouvir" — abre pelo botão 🎙️ na barra de áudio do leitor.
 * Configuração no PONTO DE USO (decisão de produto 2026-07-02): a dúvida "posso
 * trocar essa voz?" nasce aqui, não num menu escondido. Opções:
 *  - Vozes neurais da nuvem (Francisca/Antonio via tts-proxy) — ou a voz do
 *    ElevenLabs, se o usuário conectou a própria chave (BYOK tem prioridade);
 *  - Voz do aparelho (offline, expo-speech).
 * A troca vale na hora: o leitor reinicia o parágrafo atual com a voz nova.
 * Velocidade continua no botão "1×" da própria barra. Usa a paleta do LEITOR.
 */
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassSheet } from '@/components/glass-sheet';
import { MANAGED_VOICES } from '@/services/ai/tts-managed';
import { saveManagedVoice, saveVoiceEngine, useAI } from '@/store/ai';
import type { ReadingPalette } from '@/theme/reading';

type Props = {
  t: ReadingPalette;
  /** Chamado após trocar a voz (o leitor re-fala o parágrafo atual com a voz nova). */
  onApplied: () => void;
  onClose: () => void;
};

export function VoiceSheet({ t, onApplied, onClose }: Props) {
  const hasTtsKey = useAI((s) => s.hasTtsKey);
  const ttsVoiceName = useAI((s) => s.ttsVoiceName);
  const managedVoice = useAI((s) => s.managedVoice);
  const voiceEngine = useAI((s) => s.voiceEngine);
  const deviceVoiceName = useAI((s) => s.deviceVoiceName);

  async function pickCloud(voiceId?: string) {
    if (voiceId) await saveManagedVoice(voiceId);
    await saveVoiceEngine('cloud');
    onApplied();
    onClose();
  }

  async function pickDevice() {
    await saveVoiceEngine('device');
    onApplied();
    onClose();
  }

  const Option = ({
    emoji,
    label,
    sub,
    active,
    onPress,
  }: {
    emoji: string;
    label: string;
    sub: string;
    active: boolean;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      style={[
        styles.option,
        { borderColor: active ? t.accent : t.border },
        active && { borderWidth: 2 },
      ]}>
      <Text style={styles.optEmoji}>{emoji}</Text>
      <View style={styles.optBody}>
        <Text style={[styles.optLabel, { color: t.text }]}>{label}</Text>
        <Text style={[styles.optSub, { color: t.textSecondary }]}>{sub}</Text>
      </View>
      {active ? <Text style={{ color: t.accent, fontSize: 16, fontWeight: '800' }}>✓</Text> : null}
    </Pressable>
  );

  return (
    <GlassSheet onClose={onClose} surface={t.surface} accent={t.accent} bgForTint={t.background}>
      <Text style={[styles.title, { color: t.text }]}>Voz da leitura</Text>

      {hasTtsKey ? (
        <>
          <Option
            emoji="🎙️"
            label={`${ttsVoiceName} · ElevenLabs`}
            sub="Sua chave conectada (tem prioridade)"
            active={voiceEngine === 'cloud'}
            onPress={() => pickCloud()}
          />
          <Text style={[styles.hint, { color: t.textSecondary }]}>
            Para usar as vozes do app (Francisca/Antonio), remova sua chave em Integrações.
          </Text>
        </>
      ) : (
        MANAGED_VOICES.map((v) => (
          <Option
            key={v.id}
            emoji="🌟"
            label={v.name}
            sub={`Neural · ${v.desc} · nuvem do +leitura`}
            active={voiceEngine === 'cloud' && managedVoice === v.id}
            onPress={() => pickCloud(v.id)}
          />
        ))
      )}

      <Option
        emoji="🔊"
        label={deviceVoiceName ? `Voz do aparelho · ${deviceVoiceName}` : 'Voz do aparelho'}
        sub="Offline e sem limite diário"
        active={voiceEngine === 'device'}
        onPress={pickDevice}
      />

      <Text style={[styles.hint, { color: t.textSecondary }]}>
        ⚡ A velocidade você troca no botão “1×” da barra de áudio.
      </Text>

      <Pressable
        onPress={() => {
          onClose();
          router.push('/integracoes');
        }}
        hitSlop={6}
        style={styles.more}>
        <Text style={[styles.moreText, { color: t.accent }]}>Mais opções de voz › Integrações</Text>
      </Pressable>

      <Pressable onPress={onClose} style={styles.close}>
        <Text style={{ color: t.textSecondary, fontSize: 14 }}>Fechar</Text>
      </Pressable>
    </GlassSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', marginBottom: 14 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  optEmoji: { fontSize: 20 },
  optBody: { flex: 1, gap: 2 },
  optLabel: { fontSize: 15, fontWeight: '700' },
  optSub: { fontSize: 12.5, lineHeight: 17 },
  hint: { fontSize: 12.5, lineHeight: 18, marginTop: 2, marginBottom: 10 },
  more: { alignSelf: 'flex-start', paddingVertical: 4 },
  moreText: { fontSize: 14, fontWeight: '700' },
  close: { marginTop: 14, alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 16 },
});
