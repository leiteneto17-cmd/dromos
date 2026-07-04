/**
 * Coordenador de áudio do app — garante que só UMA fonte de voz toca por vez.
 *
 * Motivo (bug 2026-07-04): o "Ouvir" do leitor e as prévias de voz em Integrações
 * criavam cada um o seu próprio `AudioPlayer` (expo-audio), sem parar o outro — dava
 * para sobrepor Francisca e Antonio tocando juntos. Além disso, `player.remove()` no
 * expo-audio nem sempre SILENCIA um som já em reprodução; é preciso `pause()` antes.
 *
 * Toda reprodução (leitor + prévias) registra seu player aqui via `setActiveAudioPlayer`
 * e chama `stopAllAudio()` antes de começar. Assim, um novo play sempre cala o anterior.
 */
import type { AudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';

let activePlayer: AudioPlayer | null = null;

/** Silencia + libera um player com segurança (pause ANTES de remove — senão pode continuar tocando). */
function kill(player: AudioPlayer | null) {
  if (!player) return;
  try {
    player.pause();
  } catch {
    // já pausado/liberado
  }
  try {
    player.remove();
  } catch {
    // já removido
  }
}

/** Registra o player que passa a tocar agora, parando o anterior (se for outro). */
export function setActiveAudioPlayer(player: AudioPlayer | null) {
  if (activePlayer && activePlayer !== player) kill(activePlayer);
  activePlayer = player;
}

/** Para TUDO que estiver tocando no app: o player premium ativo + a voz do aparelho. */
export function stopAllAudio() {
  try {
    Speech.stop();
  } catch {
    // expo-speech ausente/ocioso
  }
  kill(activePlayer);
  activePlayer = null;
}
