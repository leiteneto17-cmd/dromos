/**
 * Vozes de TTS do PRÓPRIO aparelho (iOS/Android) via expo-speech — grátis, offline e
 * sem chave de IA (o mesmo mecanismo do KyBook). O usuário escolhe entre as vozes
 * instaladas; as "Aprimoradas" (Enhanced) soam bem melhor e são baixadas de graça nas
 * configurações do sistema. Não pesa no app: as vozes ficam no SO, não no nosso bundle.
 */
import * as Speech from 'expo-speech';

export type DeviceVoice = {
  identifier: string;
  name: string;
  language: string;
  /** Voz de alta qualidade (precisa ser baixada nas configurações do aparelho). */
  enhanced: boolean;
};

/** Vozes do aparelho em português, com as melhores (Aprimoradas / pt-BR) no topo. */
export async function listDeviceVoices(): Promise<DeviceVoice[]> {
  let voices: Awaited<ReturnType<typeof Speech.getAvailableVoicesAsync>> = [];
  try {
    voices = await Speech.getAvailableVoicesAsync();
  } catch {
    return [];
  }
  return voices
    .filter((v) => (v.language ?? '').toLowerCase().startsWith('pt'))
    .map((v) => ({
      identifier: v.identifier,
      name: v.name || v.identifier,
      language: v.language ?? '',
      enhanced: v.quality === Speech.VoiceQuality.Enhanced,
    }))
    .sort((a, b) => {
      if (a.enhanced !== b.enhanced) return a.enhanced ? -1 : 1; // Aprimoradas primeiro
      const aBR = a.language.toLowerCase() === 'pt-br';
      const bBR = b.language.toLowerCase() === 'pt-br';
      if (aBR !== bBR) return aBR ? -1 : 1; // pt-BR antes de pt-PT
      return a.name.localeCompare(b.name);
    });
}

/** Fala uma frase curta na voz escolhida (prévia ao tocar na voz). */
export function previewDeviceVoice(identifier: string): void {
  Speech.stop();
  Speech.speak('Esta é a voz da sua leitura. Boa leitura!', {
    language: 'pt-BR',
    voice: identifier,
  });
}
