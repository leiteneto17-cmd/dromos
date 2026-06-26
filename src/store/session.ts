/**
 * Estado EFÊMERO da sessão de leitura (não persiste). Hoje guarda só a
 * "celebração pendente": quando uma sessão termina no reader, ele empurra aqui
 * o resumo (tempo, páginas) + as conquistas recém-desbloqueadas, e um overlay
 * montado na raiz mostra a tela "Sessão concluída / Conquista desbloqueada".
 *
 * Fica fora do store da biblioteca de propósito: é volátil (some ao fechar o app)
 * e não deve disparar a escrita do arquivo de estado a cada mudança.
 */
import { create } from 'zustand';

import type { Achievement } from '@/services/progress';

/** Fim de uma sessão de leitura: resumo (tempo/páginas) + conquistas novas. */
export type SessionCelebration = {
  kind: 'session';
  /** id da sessão recém-gravada (para o botão Compartilhar abrir o card certo). */
  sessionId: string;
  bookTitle: string;
  seconds: number;
  pages: number;
  /** Conquistas que passaram de bloqueadas → desbloqueadas NESTA sessão. */
  newAchievements: Achievement[];
};

/** Conclusão de uma META (CLAUDE.md §7: "concluir = conquista personalizada"). */
export type GoalCelebration = {
  kind: 'goal';
  goalTitle: string;
  /** Linha curta do que foi batido (ex.: "120 min lidos" / "Livro concluído"). */
  detail: string;
};

export type Celebration = SessionCelebration | GoalCelebration;

type SessionState = {
  celebration: Celebration | null;
  celebrate: (c: Celebration) => void;
  clearCelebration: () => void;
};

export const useSession = create<SessionState>((set) => ({
  celebration: null,
  celebrate: (celebration) => set({ celebration }),
  clearCelebration: () => set({ celebration: null }),
}));
