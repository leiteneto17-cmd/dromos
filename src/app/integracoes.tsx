/**
 * Tela de Integrações — BYOK (CLAUDE.md §5). O usuário escolhe o provedor de IA,
 * cola a CHAVE dele, valida e salva (guardada com expo-secure-store). Destrava o
 * dicionário contextual (Fase 2) sem custo para nós — quem paga é a chave do usuário.
 */
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { openBrowserAsync } from 'expo-web-browser';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useUI } from '@/hooks/use-ui';
import { PROVIDERS, validateKey, type AIProvider } from '@/services/ai/providers';
import { getUsage, listVoices, synthesize, type ElevenVoice, type TtsUsage } from '@/services/ai/tts';
import { listDeviceVoices, previewDeviceVoice, type DeviceVoice } from '@/services/ai/tts-device';
import {
  clearAIKey,
  clearDeviceVoice,
  clearTtsKey,
  getTtsKey,
  saveAIConfig,
  saveDeviceVoice,
  saveTtsConfig,
  useAI,
} from '@/store/ai';

const PROVIDER_IDS: AIProvider[] = ['gemini', 'openai', 'anthropic'];

export default function IntegracoesScreen() {
  const c = useUI();
  const savedProvider = useAI((s) => s.provider);
  const savedModel = useAI((s) => s.model);
  const hasKey = useAI((s) => s.hasKey);

  const [provider, setProvider] = useState<AIProvider>(savedProvider);
  const [model, setModel] = useState(savedModel);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // --- Voz (ElevenLabs / TTS) ---
  const hasTtsKey = useAI((s) => s.hasTtsKey);
  const savedVoice = useAI((s) => s.ttsVoice);
  const savedVoiceName = useAI((s) => s.ttsVoiceName);
  const savedTtsModel = useAI((s) => s.ttsModel);
  const [ttsKey, setTtsKey] = useState('');
  const [voices, setVoices] = useState<ElevenVoice[]>([]);
  const [voiceId, setVoiceId] = useState(savedVoice);
  const [voiceName, setVoiceName] = useState(savedVoiceName);
  const [ttsBusy, setTtsBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [ttsOk, setTtsOk] = useState<string | null>(null);
  const [usage, setUsage] = useState<TtsUsage | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);

  // --- Voz do aparelho (grátis) ---
  const deviceVoiceId = useAI((s) => s.deviceVoice);
  const deviceVoiceName = useAI((s) => s.deviceVoiceName);
  const [deviceVoices, setDeviceVoices] = useState<DeviceVoice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);

  const carregarUso = useCallback(async () => {
    const k = await getTtsKey();
    if (!k) {
      setUsage(null);
      return;
    }
    setUsage(await getUsage(k));
  }, []);

  const carregarVozesAparelho = useCallback(async () => {
    setLoadingVoices(true);
    const vs = await listDeviceVoices();
    setDeviceVoices(vs);
    setLoadingVoices(false);
  }, []);

  // libera o player de teste ao sair; carrega o uso e as vozes do aparelho ao abrir
  useEffect(() => {
    carregarUso();
    carregarVozesAparelho();
    return () => {
      try {
        playerRef.current?.remove();
      } catch {
        // já liberado
      }
    };
  }, [carregarUso, carregarVozesAparelho]);

  async function escolherVozAparelho(v: DeviceVoice) {
    await saveDeviceVoice({ voice: v.identifier, name: v.name });
    previewDeviceVoice(v.identifier); // prévia imediata
  }

  async function usarVozPadrao() {
    await clearDeviceVoice();
  }

  const info = PROVIDERS[provider];

  function pickProvider(p: AIProvider) {
    setProvider(p);
    setModel(PROVIDERS[p].defaultModel);
    setError(null);
    setOkMsg(null);
  }

  async function salvar() {
    setError(null);
    setOkMsg(null);
    // Sem chave nova: só atualiza provider/modelo (se já houver chave salva).
    if (!key.trim()) {
      if (!hasKey) {
        setError('Cole sua chave de IA para conectar.');
        return;
      }
      await saveAIConfig({ provider, model: model.trim() || info.defaultModel });
      setOkMsg('Provedor e modelo atualizados.');
      return;
    }
    setBusy(true);
    const res = await validateKey(provider, key.trim());
    if (!res.ok) {
      setBusy(false);
      setError(res.error ?? 'Não foi possível validar a chave.');
      return;
    }
    await saveAIConfig({ provider, model: model.trim() || info.defaultModel, key: key.trim() });
    setBusy(false);
    setKey('');
    setOkMsg('Chave validada e salva! Dicionário contextual ativado.');
  }

  async function desconectar() {
    await clearAIKey();
    setKey('');
    setOkMsg('Chave removida.');
    setError(null);
  }

  // Valida a chave do ElevenLabs e lista as vozes da conta.
  async function buscarVozes() {
    setTtsError(null);
    setTtsOk(null);
    const usar = ttsKey.trim() || (await getTtsKey()) || '';
    if (!usar) {
      setTtsError('Cole sua chave do ElevenLabs primeiro.');
      return;
    }
    setTtsBusy(true);
    const res = await listVoices(usar);
    setTtsBusy(false);
    if (!res.ok) {
      setTtsError(res.error);
      return;
    }
    setVoices(res.voices);
    // Se uma chave nova foi colada, já salva (com a voz atual).
    if (ttsKey.trim()) {
      await saveTtsConfig({ voice: voiceId, voiceName, model: savedTtsModel, key: ttsKey.trim() });
      setTtsKey('');
      setTtsOk(`Chave validada! ${res.voices.length} vozes disponíveis.`);
    } else {
      setTtsOk(`${res.voices.length} vozes disponíveis.`);
    }
    carregarUso();
  }

  async function escolherVoz(v: ElevenVoice) {
    setVoiceId(v.voice_id);
    setVoiceName(v.name);
    await saveTtsConfig({ voice: v.voice_id, voiceName: v.name, model: savedTtsModel });
    setTtsOk(`Voz definida: ${v.name}.`);
  }

  // Sintetiza uma frase de exemplo e toca (prova que a voz funciona).
  async function testarVoz() {
    setTtsError(null);
    setTtsOk(null);
    const usar = (await getTtsKey()) || ttsKey.trim();
    if (!usar) {
      setTtsError('Conecte sua chave do ElevenLabs primeiro.');
      return;
    }
    setTesting(true);
    try {
      const out = await synthesize({
        key: usar,
        voiceId,
        model: savedTtsModel,
        text: 'Esta é a sua voz de leitura no mais leitura. Boa leitura!',
      });
      const dir = `${FileSystem.cacheDirectory}tts`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
      const uri = `${dir}/sample.mp3`;
      await FileSystem.writeAsStringAsync(uri, out.audioBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      playerRef.current?.remove();
      const player = createAudioPlayer({ uri });
      playerRef.current = player;
      player.play();
      setTtsOk('Tocando a voz de exemplo… 🔊');
      carregarUso(); // o teste consumiu alguns caracteres
    } catch (e) {
      setTtsError(e instanceof Error ? e.message : 'Falha ao gerar o áudio.');
    } finally {
      setTesting(false);
    }
  }

  async function desconectarTts() {
    await clearTtsKey();
    setTtsKey('');
    setVoices([]);
    setUsage(null);
    setTtsOk('Voz premium removida. Voltou para a voz grátis do aparelho.');
    setTtsError(null);
  }

  const usagePct = usage && usage.limit > 0 ? usage.used / usage.limit : 0;
  const usageLeft = usage ? Math.max(0, usage.limit - usage.used) : 0;
  const usageReset = usage?.resetUnix
    ? new Date(usage.resetUnix * 1000).toLocaleDateString('pt-BR')
    : '';

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={[styles.back, { color: c.green }]}>‹ Voltar</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: c.text }]}>Integrações de IA</Text>
          <Text style={[styles.subtitle, { color: c.textFaint }]}>
            Use sua própria chave de IA. Ela fica só no seu aparelho (criptografada) e as
            consultas vão direto para o provedor — quem paga o uso é a sua conta.
          </Text>

          {/* Estado atual */}
          <View
            style={[
              styles.statusRow,
              { backgroundColor: c.card, borderColor: hasKey ? c.green : c.border },
            ]}>
            <Text style={[styles.statusDot, { color: hasKey ? c.green : c.textFaint }]}>●</Text>
            <Text style={[styles.statusText, { color: c.text }]}>
              {hasKey
                ? `Conectado a ${PROVIDERS[savedProvider].label} · ${savedModel}`
                : 'Nenhuma IA conectada'}
            </Text>
          </View>

          {/* Provedor */}
          <Text style={[styles.label, { color: c.textDim }]}>Provedor</Text>
          <View style={styles.providerRow}>
            {PROVIDER_IDS.map((p) => {
              const active = provider === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => pickProvider(p)}
                  style={[
                    styles.providerChip,
                    { backgroundColor: c.card, borderColor: active ? c.green : c.border },
                    active && { borderWidth: 2 },
                  ]}>
                  <Text style={[styles.providerText, { color: active ? c.green : c.textDim }]}>
                    {PROVIDERS[p].label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Modelo */}
          <Text style={[styles.label, { color: c.textDim }]}>Modelo</Text>
          <TextInput
            value={model}
            onChangeText={setModel}
            placeholder={info.defaultModel}
            placeholderTextColor={c.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
          />
          <View style={styles.suggestions}>
            {info.models.map((m) => (
              <Pressable key={m} onPress={() => setModel(m)} style={[styles.sugChip, { borderColor: c.border }]}>
                <Text style={[styles.sugText, { color: c.textFaint }]}>{m}</Text>
              </Pressable>
            ))}
          </View>

          {/* Chave */}
          <Text style={[styles.label, { color: c.textDim }]}>
            Chave de API {hasKey ? '(deixe em branco para manter a atual)' : ''}
          </Text>
          <TextInput
            value={key}
            onChangeText={setKey}
            placeholder={info.keyHint}
            placeholderTextColor={c.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
          />
          <Pressable onPress={() => openBrowserAsync(info.keysUrl)} hitSlop={6}>
            <Text style={[styles.linkText, { color: c.purple }]}>Onde consigo minha chave? ↗</Text>
          </Pressable>

          {error ? <Text style={[styles.error, { color: '#E5484D' }]}>{error}</Text> : null}
          {okMsg ? <Text style={[styles.ok, { color: c.green }]}>{okMsg}</Text> : null}

          <Pressable
            onPress={salvar}
            disabled={busy}
            style={[styles.cta, { backgroundColor: c.green, opacity: busy ? 0.7 : 1 }]}>
            {busy ? (
              <ActivityIndicator color={c.onGreen} />
            ) : (
              <Text style={[styles.ctaText, { color: c.onGreen }]}>
                {hasKey && !key.trim() ? 'Salvar alterações' : 'Validar e conectar'}
              </Text>
            )}
          </Pressable>

          {hasKey ? (
            <Pressable onPress={desconectar} hitSlop={8} style={styles.disconnect}>
              <Text style={[styles.disconnectText, { color: c.textFaint }]}>Desconectar / remover chave</Text>
            </Pressable>
          ) : null}

          {/* ---- Voz da leitura ---- */}
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          <Text style={[styles.sectionTitle, { color: c.text }]}>🔊 Voz da leitura (audiobook)</Text>
          <Text style={[styles.subtitle, { color: c.textFaint }]}>
            Escolha a voz que lê em voz alta. As vozes do seu aparelho são grátis e funcionam
            offline; o <Text style={{ fontWeight: '700' }}>ElevenLabs</Text> (premium) soa ainda mais
            humano com destaque palavra-a-palavra perfeito.
          </Text>

          {/* Voz do aparelho (grátis) */}
          <Text style={[styles.sectionSub, { color: c.text }]}>🗣️ Voz do aparelho · grátis</Text>
          <Text style={[styles.statusText, { color: deviceVoiceId ? c.green : c.textFaint, marginBottom: 8 }]}>
            {deviceVoiceId ? `Voz escolhida: ${deviceVoiceName}` : 'Usando a voz padrão do sistema'}
          </Text>

          {loadingVoices ? (
            <ActivityIndicator color={c.green} style={{ alignSelf: 'flex-start', marginVertical: 8 }} />
          ) : deviceVoices.length === 0 ? (
            <Text style={[styles.note, { color: c.textFaint, textAlign: 'left', marginTop: 4 }]}>
              Nenhuma voz em português foi encontrada no aparelho. Instale uma voz pt-BR/pt-PT nas
              configurações do sistema (veja a dica abaixo).
            </Text>
          ) : (
            <View style={styles.suggestions}>
              {deviceVoices.map((v) => {
                const active = v.identifier === deviceVoiceId;
                return (
                  <Pressable
                    key={v.identifier}
                    onPress={() => escolherVozAparelho(v)}
                    style={[
                      styles.sugChip,
                      { borderColor: active ? c.green : c.border },
                      active && { borderWidth: 2 },
                    ]}>
                    <Text style={[styles.sugText, { color: active ? c.green : c.textDim }]}>
                      {v.name}
                      {v.enhanced ? ' ✨' : ''} · {v.language}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {deviceVoiceId ? (
            <Pressable onPress={usarVozPadrao} hitSlop={8} style={styles.disconnect}>
              <Text style={[styles.disconnectText, { color: c.textFaint }]}>Usar a voz padrão</Text>
            </Pressable>
          ) : null}

          <Text style={[styles.note, { color: c.textFaint, textAlign: 'left', marginTop: 12 }]}>
            ✨ = voz Aprimorada (soa bem melhor). Para baixá-las de graça:{'\n'}
            • iPhone: Ajustes → Acessibilidade → Conteúdo Falado → Vozes → Português.{'\n'}
            • Android: Configurações → Sistema → Texto para fala → instale/atualize o motor e baixe vozes.
          </Text>

          {/* Voz premium (ElevenLabs) */}
          <Text style={[styles.sectionSub, { color: c.text, marginTop: 22 }]}>
            🎙️ Voz premium · ElevenLabs
          </Text>
          <Text style={[styles.note, { color: c.textFaint, textAlign: 'left', marginTop: 0, marginBottom: 4 }]}>
            Quando conectada, tem prioridade na leitura. Free tier ~10 mil caracteres/mês.
          </Text>

          <View
            style={[
              styles.statusRow,
              { backgroundColor: c.card, borderColor: hasTtsKey ? c.green : c.border },
            ]}>
            <Text style={[styles.statusDot, { color: hasTtsKey ? c.green : c.textFaint }]}>●</Text>
            <Text style={[styles.statusText, { color: c.text }]}>
              {hasTtsKey ? `Voz premium · ${savedVoiceName}` : 'Não conectada'}
            </Text>
          </View>

          {hasTtsKey && usage ? (
            <View style={[styles.usageCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={styles.usageTop}>
                <Text style={[styles.usageLabel, { color: c.textDim }]}>Uso de caracteres (mês)</Text>
                <Text style={[styles.usageVal, { color: c.text }]}>
                  {usage.used.toLocaleString('pt-BR')} / {usage.limit.toLocaleString('pt-BR')}
                </Text>
              </View>
              <View style={[styles.usageTrack, { backgroundColor: c.border }]}>
                <View
                  style={[
                    styles.usageFill,
                    {
                      backgroundColor: usagePct >= 0.9 ? '#E5484D' : c.green,
                      width: `${Math.min(100, Math.round(usagePct * 100))}%`,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.usageReset, { color: c.textFaint }]}>
                {usageLeft.toLocaleString('pt-BR')} restantes
                {usageReset ? ` · renova em ${usageReset}` : ''}
              </Text>
            </View>
          ) : null}

          <Text style={[styles.label, { color: c.textDim }]}>
            Chave do ElevenLabs {hasTtsKey ? '(em branco mantém a atual)' : ''}
          </Text>
          <TextInput
            value={ttsKey}
            onChangeText={setTtsKey}
            placeholder="xi-api-key"
            placeholderTextColor={c.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
          />
          <Pressable onPress={() => openBrowserAsync('https://elevenlabs.io/app/settings/api-keys')} hitSlop={6}>
            <Text style={[styles.linkText, { color: c.purple }]}>Onde consigo minha chave? ↗</Text>
          </Pressable>

          <Pressable
            onPress={buscarVozes}
            disabled={ttsBusy}
            style={[styles.cta, { backgroundColor: c.green, opacity: ttsBusy ? 0.7 : 1 }]}>
            {ttsBusy ? (
              <ActivityIndicator color={c.onGreen} />
            ) : (
              <Text style={[styles.ctaText, { color: c.onGreen }]}>Validar e buscar vozes</Text>
            )}
          </Pressable>

          {voices.length > 0 ? (
            <>
              <Text style={[styles.label, { color: c.textDim }]}>Escolha a voz</Text>
              <View style={styles.suggestions}>
                {voices.map((v) => {
                  const active = v.voice_id === voiceId;
                  return (
                    <Pressable
                      key={v.voice_id}
                      onPress={() => escolherVoz(v)}
                      style={[
                        styles.sugChip,
                        { borderColor: active ? c.green : c.border },
                        active && { borderWidth: 2 },
                      ]}>
                      <Text style={[styles.sugText, { color: active ? c.green : c.textDim }]}>
                        {v.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          {hasTtsKey ? (
            <Pressable
              onPress={testarVoz}
              disabled={testing}
              style={[styles.testBtn, { borderColor: c.green, opacity: testing ? 0.7 : 1 }]}>
              {testing ? (
                <ActivityIndicator color={c.green} />
              ) : (
                <Text style={{ color: c.green, fontWeight: '800', fontSize: 15 }}>▶ Testar voz</Text>
              )}
            </Pressable>
          ) : null}

          {ttsError ? <Text style={[styles.error, { color: '#E5484D' }]}>{ttsError}</Text> : null}
          {ttsOk ? <Text style={[styles.ok, { color: c.green }]}>{ttsOk}</Text> : null}

          {hasTtsKey ? (
            <Pressable onPress={desconectarTts} hitSlop={8} style={styles.disconnect}>
              <Text style={[styles.disconnectText, { color: c.textFaint }]}>
                Remover voz premium
              </Text>
            </Pressable>
          ) : null}

          <Text style={[styles.note, { color: c.textFaint }]}>
            🔒 A chave nunca é enviada aos nossos servidores nem sincronizada. Fica apenas neste
            aparelho.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 8 },
  back: { fontSize: 16, fontWeight: '700' },
  body: { paddingHorizontal: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', marginTop: 4 },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 18 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 8 },
  statusDot: { fontSize: 12 },
  statusText: { fontSize: 14, fontWeight: '600', flex: 1 },
  label: { fontSize: 13, fontWeight: '700', marginTop: 18, marginBottom: 8 },
  providerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  providerChip: { flexGrow: 1, flexBasis: '47%', borderWidth: 1, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 8, alignItems: 'center' },
  providerText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  sugChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  sugText: { fontSize: 13, fontWeight: '600' },
  linkText: { fontSize: 13, fontWeight: '700', marginTop: 10 },
  error: { fontSize: 14, marginTop: 14, fontWeight: '600' },
  ok: { fontSize: 14, marginTop: 14, fontWeight: '600' },
  cta: { marginTop: 20, borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  ctaText: { fontSize: 16, fontWeight: '800' },
  disconnect: { marginTop: 16, alignItems: 'center' },
  disconnectText: { fontSize: 14, fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth, marginTop: 28, marginBottom: 4 },
  sectionTitle: { fontSize: 20, fontWeight: '800', marginTop: 14 },
  sectionSub: { fontSize: 16, fontWeight: '800', marginTop: 16, marginBottom: 4 },
  testBtn: { marginTop: 14, borderRadius: 999, borderWidth: 1, paddingVertical: 13, alignItems: 'center' },
  usageCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 4 },
  usageTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  usageLabel: { fontSize: 13, fontWeight: '700' },
  usageVal: { fontSize: 14, fontWeight: '700' },
  usageTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  usageFill: { height: '100%', borderRadius: 4 },
  usageReset: { fontSize: 12, marginTop: 8 },
  note: { fontSize: 12, lineHeight: 18, marginTop: 24, textAlign: 'center' },
});
