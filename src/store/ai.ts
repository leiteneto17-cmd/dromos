/**
 * Configuração de IA do usuário (BYOK — CLAUDE.md §5). A CHAVE fica no aparelho,
 * criptografada via expo-secure-store (Keychain iOS / Keystore Android). Provider
 * e modelo (não secretos) também ficam no secure-store por simplicidade.
 *
 * A chave NUNCA vai para o Supabase, nunca é logada, e só sai do device direto
 * para o provedor escolhido (src/services/ai/providers.ts).
 */
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { PROVIDERS, type AIProvider } from '@/services/ai/providers';
import { TTS_DEFAULT_MODEL, TTS_DEFAULT_VOICE } from '@/services/ai/tts';

const KEY_STORE = 'leitura_ai_key';
const CFG_STORE = 'leitura_ai_cfg';
const TTS_KEY_STORE = 'leitura_tts_key';
const TTS_CFG_STORE = 'leitura_tts_cfg';
const DEVICE_VOICE_STORE = 'leitura_device_voice';
const MANAGED_VOICE_STORE = 'leitura_managed_voice';
const VOICE_ENGINE_STORE = 'leitura_voice_engine';

/** Preferência do "Ouvir": nuvem (ElevenLabs/neural gerida) ou voz do aparelho. */
export type VoiceEngine = 'cloud' | 'device';

type AIState = {
  // --- Dicionário (LLM) ---
  provider: AIProvider;
  model: string;
  /** true quando há uma chave salva. Nunca expomos a chave em si no estado. */
  hasKey: boolean;
  // --- Voz (TTS / ElevenLabs) ---
  ttsVoice: string;
  ttsVoiceName: string;
  ttsModel: string;
  hasTtsKey: boolean;
  // --- Voz neural gerida (Azure via tts-proxy — [[voz-tts-estrategia]]) ---
  /** Voz escolhida da nuvem do +leitura ('francisca' | 'antonio'). */
  managedVoice: string;
  /** Motor preferido do "Ouvir" (seletor de voz do leitor). Default: nuvem. */
  voiceEngine: VoiceEngine;
  // --- Voz do aparelho (grátis, expo-speech) ---
  /** Identificador da voz do SO escolhida (null = voz padrão do sistema). */
  deviceVoice: string | null;
  deviceVoiceName: string;
  /** true depois de carregar a config salva do secure-store. */
  ready: boolean;
};

export const useAI = create<AIState>(() => ({
  // Padrão = Gemini (free tier). Sem chave própria, o app usa a IA grátis/gerida.
  provider: 'gemini',
  model: PROVIDERS.gemini.defaultModel,
  hasKey: false,
  ttsVoice: TTS_DEFAULT_VOICE,
  ttsVoiceName: 'Rachel',
  ttsModel: TTS_DEFAULT_MODEL,
  hasTtsKey: false,
  managedVoice: 'francisca',
  voiceEngine: 'cloud',
  deviceVoice: null,
  deviceVoiceName: '',
  ready: false,
}));

// Carga inicial (no import): restaura provider/modelo/voz e detecta se há chaves.
(async () => {
  try {
    const [cfgRaw, key, ttsCfgRaw, ttsKey, deviceRaw, managedRaw, engineRaw] = await Promise.all([
      SecureStore.getItemAsync(CFG_STORE),
      SecureStore.getItemAsync(KEY_STORE),
      SecureStore.getItemAsync(TTS_CFG_STORE),
      SecureStore.getItemAsync(TTS_KEY_STORE),
      SecureStore.getItemAsync(DEVICE_VOICE_STORE),
      SecureStore.getItemAsync(MANAGED_VOICE_STORE),
      SecureStore.getItemAsync(VOICE_ENGINE_STORE),
    ]);
    const cfg = cfgRaw ? (JSON.parse(cfgRaw) as { provider?: AIProvider; model?: string }) : null;
    const provider = cfg?.provider ?? 'gemini';
    const ttsCfg = ttsCfgRaw
      ? (JSON.parse(ttsCfgRaw) as { voice?: string; voiceName?: string; model?: string })
      : null;
    const deviceCfg = deviceRaw
      ? (JSON.parse(deviceRaw) as { voice?: string; name?: string })
      : null;
    useAI.setState({
      provider,
      model: cfg?.model || PROVIDERS[provider].defaultModel,
      hasKey: Boolean(key),
      ttsVoice: ttsCfg?.voice || TTS_DEFAULT_VOICE,
      ttsVoiceName: ttsCfg?.voiceName || 'Rachel',
      ttsModel: ttsCfg?.model || TTS_DEFAULT_MODEL,
      hasTtsKey: Boolean(ttsKey),
      managedVoice: managedRaw || 'francisca',
      voiceEngine: engineRaw === 'device' ? 'device' : 'cloud',
      deviceVoice: deviceCfg?.voice || null,
      deviceVoiceName: deviceCfg?.name || '',
      ready: true,
    });
  } catch {
    useAI.setState({ ready: true });
  }
})();

/** Lê a chave (só na hora de chamar o provedor). Não guardar em estado/log. */
export function getApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_STORE);
}

/** Salva provider+modelo e, se informada, a chave. */
export async function saveAIConfig(args: {
  provider: AIProvider;
  model: string;
  key?: string;
}): Promise<void> {
  const { provider, model, key } = args;
  await SecureStore.setItemAsync(CFG_STORE, JSON.stringify({ provider, model }));
  if (key) await SecureStore.setItemAsync(KEY_STORE, key);
  useAI.setState({
    provider,
    model: model || PROVIDERS[provider].defaultModel,
    hasKey: key ? true : useAI.getState().hasKey,
  });
}

/** Remove a chave (desconecta a IA). Mantém provider/modelo. */
export async function clearAIKey(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_STORE);
  useAI.setState({ hasKey: false });
}

// ---------- Voz (TTS / ElevenLabs) ----------

/** Lê a chave de TTS (só na hora de sintetizar). */
export function getTtsKey(): Promise<string | null> {
  return SecureStore.getItemAsync(TTS_KEY_STORE);
}

/** Salva voz/modelo de TTS e, se informada, a chave do ElevenLabs. */
export async function saveTtsConfig(args: {
  voice: string;
  voiceName: string;
  model: string;
  key?: string;
}): Promise<void> {
  const { voice, voiceName, model, key } = args;
  await SecureStore.setItemAsync(
    TTS_CFG_STORE,
    JSON.stringify({ voice, voiceName, model }),
  );
  if (key) await SecureStore.setItemAsync(TTS_KEY_STORE, key);
  useAI.setState({
    ttsVoice: voice || TTS_DEFAULT_VOICE,
    ttsVoiceName: voiceName || 'Voz',
    ttsModel: model || TTS_DEFAULT_MODEL,
    hasTtsKey: key ? true : useAI.getState().hasTtsKey,
  });
}

/** Remove a chave de TTS (volta para a voz grátis do aparelho). */
export async function clearTtsKey(): Promise<void> {
  await SecureStore.deleteItemAsync(TTS_KEY_STORE);
  useAI.setState({ hasTtsKey: false });
}

// ---------- Voz neural gerida (Azure via tts-proxy) ----------

/** Salva a voz da nuvem do +leitura escolhida ('francisca' | 'antonio'). */
export async function saveManagedVoice(voice: string): Promise<void> {
  await SecureStore.setItemAsync(MANAGED_VOICE_STORE, voice);
  useAI.setState({ managedVoice: voice });
}

/** Salva o motor preferido do "Ouvir" (seletor de voz do leitor). */
export async function saveVoiceEngine(engine: VoiceEngine): Promise<void> {
  await SecureStore.setItemAsync(VOICE_ENGINE_STORE, engine);
  useAI.setState({ voiceEngine: engine });
}

// ---------- Voz do aparelho (grátis) ----------

/** Salva a voz do SO escolhida para a leitura grátis. */
export async function saveDeviceVoice(args: { voice: string; name: string }): Promise<void> {
  await SecureStore.setItemAsync(
    DEVICE_VOICE_STORE,
    JSON.stringify({ voice: args.voice, name: args.name }),
  );
  useAI.setState({ deviceVoice: args.voice, deviceVoiceName: args.name });
}

/** Volta para a voz padrão do sistema (sem voz específica escolhida). */
export async function clearDeviceVoice(): Promise<void> {
  await SecureStore.deleteItemAsync(DEVICE_VOICE_STORE);
  useAI.setState({ deviceVoice: null, deviceVoiceName: '' });
}
