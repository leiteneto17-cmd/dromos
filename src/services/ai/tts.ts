/**
 * TTS realista por IA (BYOK) — ElevenLabs. Voz humana (CLAUDE.md §2.1). A chave é do
 * usuário (free tier ~10k caracteres/mês); as chamadas vão direto do aparelho. O áudio
 * é cacheado para não regerar o mesmo trecho e gastar a cota à toa (§5).
 *
 * Resposta do /with-timestamps: { audio_base64, alignment: { characters[],
 * character_start_times_seconds[], character_end_times_seconds[] } }. Mantemos o
 * endpoint with-timestamps porque o `alignment` ainda serve para o seek de "ouvir a
 * partir daqui" (pula o áudio até o tempo da palavra escolhida).
 */
const BASE = 'https://api.elevenlabs.io/v1';

export const TTS_DEFAULT_MODEL = 'eleven_multilingual_v2';
/** Voz premade comum (Rachel). O usuário pode trocar buscando as próprias vozes. */
export const TTS_DEFAULT_VOICE = '21m00Tcm4TlvDq8ikWAM';

export type Alignment = {
  /** Tempo (s) em que cada caractere começa, alinhado ao texto enviado. */
  starts: number[];
  /** Tempo (s) em que cada caractere termina. */
  ends: number[];
};

export type Synthesis = { audioBase64: string; alignment: Alignment };

export type ElevenVoice = { voice_id: string; name: string };

/** Valida a chave e já devolve as vozes da conta (GET /voices). */
export async function listVoices(key: string): Promise<{ ok: true; voices: ElevenVoice[] } | { ok: false; error: string }> {
  try {
    const r = await fetch(`${BASE}/voices`, { headers: { 'xi-api-key': key } });
    if (r.status === 401) return { ok: false, error: 'Chave inválida ou sem permissão.' };
    if (!r.ok) return { ok: false, error: `Erro ${r.status} ao validar.` };
    const data = await r.json();
    const voices: ElevenVoice[] = Array.isArray(data?.voices)
      ? data.voices.map((v: { voice_id: string; name: string }) => ({ voice_id: v.voice_id, name: v.name }))
      : [];
    return { ok: true, voices };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Falha de rede.' };
  }
}

export type TtsUsage = {
  /** Caracteres já usados no período. */
  used: number;
  /** Cota total do período (free tier ≈ 10.000). */
  limit: number;
  /** Unix (s) da próxima renovação da cota. */
  resetUnix: number;
};

/** Uso real da conta (GET /user/subscription) — para o contador de caracteres. */
export async function getUsage(key: string): Promise<TtsUsage | null> {
  try {
    const r = await fetch(`${BASE}/user/subscription`, { headers: { 'xi-api-key': key } });
    if (!r.ok) return null;
    const d = await r.json();
    return {
      used: Number(d?.character_count ?? 0),
      limit: Number(d?.character_limit ?? 0),
      resetUnix: Number(d?.next_character_count_reset_unix ?? 0),
    };
  } catch {
    return null;
  }
}

/** Sintetiza o texto e retorna áudio (base64 mp3) + alinhamento por caractere. */
export async function synthesize(args: {
  key: string;
  voiceId: string;
  model: string;
  text: string;
}): Promise<Synthesis> {
  const { key, voiceId, model, text } = args;
  const r = await fetch(`${BASE}/text-to-speech/${voiceId}/with-timestamps`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: model, output_format: 'mp3_44100_128' }),
  });
  if (!r.ok) throw new Error(await mensagemErro(r));
  const data = await r.json();
  const a = data?.alignment ?? {};
  return {
    audioBase64: data?.audio_base64 ?? '',
    alignment: {
      starts: Array.isArray(a.character_start_times_seconds) ? a.character_start_times_seconds : [],
      ends: Array.isArray(a.character_end_times_seconds) ? a.character_end_times_seconds : [],
    },
  };
}

/** Índice do caractere sendo falado no tempo `t` (s) — para o destaque karaokê. */
export function charIndexAt(alignment: Alignment, t: number): number {
  const { starts } = alignment;
  if (!starts.length) return -1;
  // último caractere cujo início <= t (busca linear é ok: parágrafos curtos)
  let idx = -1;
  for (let i = 0; i < starts.length; i++) {
    if (starts[i] <= t) idx = i;
    else break;
  }
  return idx;
}

async function mensagemErro(r: Response): Promise<string> {
  let detalhe = '';
  try {
    const j = await r.json();
    detalhe = j?.detail?.message ?? (typeof j?.detail === 'string' ? j.detail : '') ?? '';
  } catch {
    // sem corpo JSON
  }
  if (r.status === 401) return 'Chave inválida (401).';
  if (r.status === 422) return 'Voz ou modelo inválido (422). Verifique o voice_id.';
  if (r.status === 429) return 'Cota do ElevenLabs atingida (429).';
  return `Erro ${r.status}${detalhe ? `: ${detalhe}` : ''}`;
}
