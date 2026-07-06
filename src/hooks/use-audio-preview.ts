/**
 * Player de PRÉVIA/loop para as Trilhas de Leitura (editor e viewer de story). Usa expo-audio
 * (mesmo motor do "Ouvir") e o coordenador `audio-session` para nunca tocar duas fontes juntas.
 *
 * `play(url)` toca em loop; `stop()` silencia. Limpa ao desmontar. No-op se a URL for vazia
 * (ex.: som ambiente ainda sem arquivo hospedado) — degrada sem crash.
 */
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

import { setActiveAudioPlayer, stopAllAudio } from '@/services/ai/audio-session';

export function useAudioPreview() {
  const playerRef = useRef<AudioPlayer | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  const stop = useCallback(() => {
    stopAllAudio(); // pausa + remove o player ativo (o nosso, se for o caso)
    playerRef.current = null;
    setPlayingUrl(null);
  }, []);

  const play = useCallback(
    (url: string, loop = true) => {
      if (!url) return;
      stopAllAudio();
      try {
        const player = createAudioPlayer({ uri: url });
        player.loop = loop;
        playerRef.current = player;
        setActiveAudioPlayer(player);
        player.play();
        setPlayingUrl(url);
      } catch {
        playerRef.current = null;
        setPlayingUrl(null);
      }
    },
    [],
  );

  /** Alterna: se já toca esta URL, para; senão, toca. Útil no botão ▶ da lista. */
  const toggle = useCallback(
    (url: string, loop = true) => {
      if (playingUrl === url) stop();
      else play(url, loop);
    },
    [playingUrl, play, stop],
  );

  // Silencia ao desmontar a tela.
  useEffect(() => () => stop(), [stop]);

  return { play, stop, toggle, playingUrl };
}
