/**
 * Cache do áudio TTS premium (ElevenLabs) — CLAUDE.md §5: "Nunca regerar TTS do
 * mesmo trecho". A chave do usuário (free tier ~10k caracteres/mês) é cara, então
 * guardamos o MP3 + o alinhamento por caractere indexados por hash(voz+modelo+texto).
 *
 * Dois níveis: memória (mesma sessão, instantâneo) e disco (sobrevive entre sessões).
 * Fica em cacheDirectory porque é regenerável; se o SO limpar, só re-sintetiza.
 */
import * as FileSystem from 'expo-file-system/legacy';

import type { Alignment } from './tts';

export type CachedAudio = { uri: string; alignment: Alignment };

const DIR = `${FileSystem.cacheDirectory}tts-cache`;
const mem = new Map<string, CachedAudio>();

/** Hash estável (djb2) de voz+modelo+texto → nome de arquivo curto. */
export function hashKey(voice: string, model: string, text: string): string {
  const s = `${voice}|${model}|${text}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; // h*33 + c, sem sinal
  }
  // inclui o tamanho do texto para reduzir colisão de hashes curtos
  return `${h.toString(16)}-${s.length.toString(16)}`;
}

async function ensureDir(): Promise<void> {
  await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => {});
}

/** Recupera do cache (memória → disco). null se não houver. */
export async function loadCachedAudio(key: string): Promise<CachedAudio | null> {
  const inMem = mem.get(key);
  if (inMem) return inMem;

  const mp3 = `${DIR}/${key}.mp3`;
  const json = `${DIR}/${key}.json`;
  try {
    const [a, b] = await Promise.all([
      FileSystem.getInfoAsync(mp3),
      FileSystem.getInfoAsync(json),
    ]);
    if (!a.exists || !b.exists) return null;
    const raw = await FileSystem.readAsStringAsync(json);
    const alignment = JSON.parse(raw) as Alignment;
    const hit: CachedAudio = { uri: mp3, alignment };
    mem.set(key, hit);
    return hit;
  } catch {
    return null;
  }
}

/** Grava o MP3 (base64) + alinhamento no cache e devolve o uri local. */
export async function saveCachedAudio(
  key: string,
  audioBase64: string,
  alignment: Alignment,
): Promise<CachedAudio> {
  await ensureDir();
  const mp3 = `${DIR}/${key}.mp3`;
  const json = `${DIR}/${key}.json`;
  await FileSystem.writeAsStringAsync(mp3, audioBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await FileSystem.writeAsStringAsync(json, JSON.stringify(alignment));
  const saved: CachedAudio = { uri: mp3, alignment };
  mem.set(key, saved);
  return saved;
}
