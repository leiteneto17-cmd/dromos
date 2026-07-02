/**
 * "Ouvir" — audiobook assistido (CLAUDE.md §2.1). Três motores, mesma interface; o
 * motor é escolhido na hora de tocar, nesta ordem:
 *
 *  1. ULTRA (ElevenLabs BYOK): o usuário trouxe a própria chave → prioridade.
 *  2. NEURAL GERIDA (Azure via Edge Function tts-proxy — [[voz-tts-estrategia]]):
 *     vozes Francisca/Antonio da nuvem do +leitura, sem chave do usuário. Exige
 *     login (a função verifica o JWT) e tem cota diária de caracteres.
 *  3. GRÁTIS (voz do aparelho, expo-speech): sem chave, offline, funciona no Expo Go.
 *
 * Os motores 1–2 sintetizam cada parágrafo, tocam com expo-audio, cacheiam o áudio
 * (§5) p/ não regerar/gastar cota, e fazem prefetch do próximo parágrafo. Qualquer
 * falha (sem chave, sem rede, cota do dia) cai na voz grátis sem interromper.
 *
 * DESTAQUE: o leitor (reader.tsx) realça apenas o PARÁGRAFO sendo lido (a partir de
 * `state.paraIndex`) — muda 1× por parágrafo, custo desprezível. O karaokê
 * palavra-a-palavra foi REMOVIDO por pesar demais no render (decisão do usuário): em
 * parágrafos longos, re-renderizar várias vezes por segundo travava no modo dev/emulador.
 */
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';

import { synthesize } from '@/services/ai/tts';
import { hashKey, loadCachedAudio, saveCachedAudio, type CachedAudio } from '@/services/ai/tts-cache';
import { managedTtsAvailable, synthesizeManaged } from '@/services/ai/tts-managed';
import { getTtsKey, useAI } from '@/store/ai';

export type ReadEngine = 'device' | 'premium';

export type ReadAloudState = {
  /** Sessão de leitura ligada (tocando OU pausada). */
  active: boolean;
  /** Falando agora. */
  playing: boolean;
  /** Gerando o áudio premium (entre parágrafos, na primeira vez). */
  loading: boolean;
  /** Motor em uso nesta sessão. */
  engine: ReadEngine;
  /** Índice do parágrafo atual (na lista passada ao hook). */
  paraIndex: number;
};

const IDLE: ReadAloudState = {
  active: false,
  playing: false,
  loading: false,
  engine: 'device',
  paraIndex: 0,
};

const RATES = [0.75, 1.0, 1.25, 1.5];

type Sub = { remove: () => void };
type Boundary = { charIndex?: number };

export function useReadAloud(paragraphs: string[]) {
  const [state, setState] = useState<ReadAloudState>(IDLE);
  const [rate, setRate] = useState(1.0);

  // config de voz (BYOK) — lida de forma reativa, espelhada em refs para os callbacks
  const hasTtsKey = useAI((s) => s.hasTtsKey);
  const ttsVoice = useAI((s) => s.ttsVoice);
  const ttsModel = useAI((s) => s.ttsModel);
  const managedVoice = useAI((s) => s.managedVoice);
  const deviceVoice = useAI((s) => s.deviceVoice);

  const parasRef = useRef(paragraphs);
  parasRef.current = paragraphs;
  const rateRef = useRef(rate);
  rateRef.current = rate;
  const hasTtsKeyRef = useRef(hasTtsKey);
  hasTtsKeyRef.current = hasTtsKey;
  const voiceRef = useRef(ttsVoice);
  voiceRef.current = ttsVoice;
  const modelRef = useRef(ttsModel);
  modelRef.current = ttsModel;
  const managedVoiceRef = useRef(managedVoice);
  managedVoiceRef.current = managedVoice;
  const deviceVoiceRef = useRef(deviceVoice);
  deviceVoiceRef.current = deviceVoice;

  const engineRef = useRef<ReadEngine>('device');
  const activeRef = useRef(false); // guarda do motor de aparelho
  const sessionRef = useRef(0); // token que invalida trabalho assíncrono premium
  const curParaRef = useRef(0); // parágrafo atual — p/ resume sem depender do estado React
  const lastCharRef = useRef(0); // offset de caractere já lido no parágrafo (device) — p/ retomar
  const playerRef = useRef<AudioPlayer | null>(null);
  const subRef = useRef<Sub | null>(null);
  // sínteses em voo (por hash) — evita gerar o mesmo parágrafo 2x (prefetch + avanço)
  const inflightRef = useRef(new Map<string, Promise<CachedAudio>>());

  const cleanupPlayer = useCallback(() => {
    try {
      subRef.current?.remove();
    } catch {
      // já removido
    }
    subRef.current = null;
    try {
      playerRef.current?.remove();
    } catch {
      // já liberado
    }
    playerRef.current = null;
  }, []);

  const finishSession = useCallback(() => {
    activeRef.current = false;
    setState(IDLE);
  }, []);

  // ---------- Motor GRÁTIS (voz do aparelho) ----------
  const speakFrom = useCallback(
    (i: number, startChar = 0) => {
      const paras = parasRef.current;
      if (i < 0 || i >= paras.length) {
        finishSession();
        return;
      }
      engineRef.current = 'device';
      activeRef.current = true;
      curParaRef.current = i;
      // começa do trecho escolhido (offset; some nos próximos parágrafos)
      const base = startChar > 0 && startChar < paras[i].length ? startChar : 0;
      lastCharRef.current = base; // ponto de leitura inicial deste parágrafo
      setState({
        active: true,
        playing: true,
        loading: false,
        engine: 'device',
        paraIndex: i,
      });
      Speech.speak(base > 0 ? paras[i].slice(base) : paras[i], {
        language: 'pt-BR',
        rate: rateRef.current,
        voice: deviceVoiceRef.current ?? undefined,
        // Só atualiza um REF (sem re-render) com a posição lida → permite retomar de onde
        // parou no resume. O charIndex vem relativo ao trecho falado → soma o offset base.
        onBoundary: (e: Boundary) => {
          if (activeRef.current && typeof e?.charIndex === 'number') {
            lastCharRef.current = base + e.charIndex;
          }
        },
        onDone: () => {
          if (activeRef.current) speakFrom(i + 1);
        },
        onError: () => {
          if (activeRef.current) speakFrom(i + 1);
        },
      });
    },
    [finishSession],
  );

  // ---------- Motores de NUVEM (ElevenLabs BYOK ou Azure gerida) ----------
  // Com chave própria → ElevenLabs; sem chave → voz neural gerida (tts-proxy).
  // O cache é indexado por voz+modelo+texto, então trocar de motor/voz não mistura áudios.
  const getOrSynthesize = useCallback((text: string): Promise<CachedAudio> => {
    const byok = hasTtsKeyRef.current;
    const voice = byok ? voiceRef.current : `azure:${managedVoiceRef.current}`;
    const model = byok ? modelRef.current : 'neural';
    const key = hashKey(voice, model, text);
    const inflight = inflightRef.current.get(key);
    if (inflight) return inflight; // já está gerando este trecho — reaproveita
    const work = (async () => {
      const cached = await loadCachedAudio(key);
      if (cached) return cached;
      if (byok) {
        const apiKey = await getTtsKey();
        if (!apiKey) throw new Error('sem-chave');
        const out = await synthesize({ key: apiKey, voiceId: voiceRef.current, model, text });
        if (!out.audioBase64) throw new Error('audio-vazio');
        return saveCachedAudio(key, out.audioBase64, out.alignment);
      }
      // Gerida: sem timestamps por caractere (o "ouvir a partir daqui" começa do parágrafo).
      const audio = await synthesizeManaged({ text, voice: managedVoiceRef.current });
      return saveCachedAudio(key, audio, { starts: [], ends: [] });
    })();
    inflightRef.current.set(key, work);
    work.finally(() => inflightRef.current.delete(key)).catch(() => {});
    return work;
  }, []);

  const playPremiumFrom = useCallback(
    (i: number, seekChar = 0) => {
      const paras = parasRef.current;
      const token = sessionRef.current;
      if (i < 0 || i >= paras.length) {
        finishSession();
        return;
      }
      engineRef.current = 'premium';
      curParaRef.current = i;
      setState({
        active: true,
        playing: true,
        loading: true,
        engine: 'premium',
        paraIndex: i,
      });

      getOrSynthesize(paras[i])
        .then((audio) => {
          if (token !== sessionRef.current) return; // parou/trocou durante a síntese
          cleanupPlayer();
          // updateInterval alto: sem karaokê, o status só serve p/ o seek inicial e p/
          // detectar o fim do parágrafo — não precisa de poll fino (mais leve).
          const player = createAudioPlayer({ uri: audio.uri }, { updateInterval: 250 });
          playerRef.current = player;
          try {
            player.shouldCorrectPitch = true;
            player.playbackRate = rateRef.current;
          } catch {
            // rate aplicado quando carregar
          }
          setState((s) => (s.paraIndex === i ? { ...s, loading: false } : s));
          // "Ouvir a partir daqui": avança o áudio até o tempo da palavra escolhida.
          // alignment.starts mapeia 1:1 com o texto → starts[seekChar] é quando ela começa.
          let pendingSeek =
            seekChar > 0 ? audio.alignment.starts[Math.min(seekChar, audio.alignment.starts.length - 1)] ?? 0 : 0;
          const sub = player.addListener('playbackStatusUpdate', (st) => {
            if (token !== sessionRef.current) return;
            if (pendingSeek > 0 && st.isLoaded) {
              const target = pendingSeek;
              pendingSeek = 0;
              player.seekTo(target).catch(() => {});
              return; // espera o próximo status já na posição certa
            }
            if (st.didJustFinish) {
              cleanupPlayer();
              if (token === sessionRef.current) playPremiumFrom(i + 1);
            }
          });
          subRef.current = sub;
          player.play();
          // adianta o próximo parágrafo para reduzir a pausa (já fica em cache)
          const next = paras[i + 1];
          if (next) getOrSynthesize(next).catch(() => {});
        })
        .catch(() => {
          if (token !== sessionRef.current) return;
          // sem chave ou falha de rede → cai para a voz grátis do aparelho
          engineRef.current = 'device';
          activeRef.current = true;
          speakFrom(i, seekChar);
        });
    },
    [cleanupPlayer, finishSession, getOrSynthesize, speakFrom],
  );

  // ---------- Controles (interface única) ----------
  const start = useCallback(
    (from = 0, charOffset = 0) => {
      sessionRef.current++; // nova sessão: invalida qualquer trabalho premium pendente
      Speech.stop();
      cleanupPlayer();
      // Nuvem (BYOK ou gerida) quando disponível; senão, voz do aparelho.
      if (hasTtsKeyRef.current || managedTtsAvailable()) playPremiumFrom(from, charOffset);
      else speakFrom(from, charOffset);
    },
    [cleanupPlayer, playPremiumFrom, speakFrom],
  );

  const pause = useCallback(() => {
    if (engineRef.current === 'premium') {
      try {
        playerRef.current?.pause();
      } catch {
        // sem player ainda (gerando)
      }
      setState((s) => ({ ...s, playing: false }));
    } else {
      activeRef.current = false;
      Speech.stop();
      setState((s) => ({ ...s, playing: false }));
    }
  }, []);

  const resume = useCallback(() => {
    if (engineRef.current === 'premium') {
      if (playerRef.current) {
        try {
          playerRef.current.play();
          setState((s) => ({ ...s, playing: true }));
        } catch {
          playPremiumFrom(curParaRef.current); // player perdido — refaz o parágrafo
        }
      } else {
        playPremiumFrom(curParaRef.current);
      }
    } else {
      // expo-speech não retoma nativamente (pause = stop no Android) → refala o parágrafo
      // A PARTIR da última palavra lida (lastCharRef), não do início.
      speakFrom(curParaRef.current, lastCharRef.current);
    }
  }, [playPremiumFrom, speakFrom]);

  const stop = useCallback(() => {
    sessionRef.current++;
    activeRef.current = false;
    Speech.stop();
    cleanupPlayer();
    finishSession();
  }, [cleanupPlayer, finishSession]);

  const cycleRate = useCallback(() => {
    setRate((r) => {
      const next = RATES[(RATES.indexOf(r) + 1) % RATES.length];
      if (engineRef.current === 'premium' && playerRef.current) {
        try {
          playerRef.current.playbackRate = next;
        } catch {
          // ignora — aplica no próximo parágrafo
        }
      }
      return next;
    });
  }, []);

  // Para tudo ao desmontar (sair do leitor) — não deixa áudio em background.
  useEffect(() => {
    return () => {
      sessionRef.current++;
      activeRef.current = false;
      Speech.stop();
      cleanupPlayer();
    };
  }, [cleanupPlayer]);

  return { state, rate, start, pause, resume, stop, cycleRate };
}
