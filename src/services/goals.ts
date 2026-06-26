/**
 * Avaliação central de METAS (Fase 6). Antes a auto-conclusão vivia só no
 * `useEffect` da tela /conquistas — então a meta só "fechava" quando o usuário
 * abria aquela tela. Agora isto é chamado também do reader (a cada tick e ao sair),
 * para concluir e CELEBRAR a meta no momento exato em que o alvo é batido.
 *
 * Conclui todas as metas que bateram o alvo e dispara a celebração "Meta concluída"
 * para a PRIMEIRA delas (p/ não empilhar modais). Retorna true se celebrou alguma.
 */
import { deriveGoal } from '@/services/progress';
import { useLibrary, type Goal } from '@/store/library';
import { useSession } from '@/store/session';

/** Linha curta exibida na celebração "Meta concluída" (CLAUDE.md §7). */
function celebrationDetail(g: Goal): string {
  if (g.kind === 'livro') return 'Livro concluído 🎉';
  if (g.kind === 'dias') return `${g.target} ${g.target === 1 ? 'dia' : 'dias'} de leitura`;
  return `${g.target} min lidos`;
}

export function evaluateGoals(): boolean {
  const st = useLibrary.getState();
  const active = st.goals.filter((g) => !g.doneAt);
  let celebrated = false;
  for (const g of active) {
    const book = g.bookId
      ? { progress: st.progress[g.bookId] ?? 0, pages: st.bookPages[g.bookId] ?? 0 }
      : undefined;
    if (deriveGoal(g, st.stats, book).done) {
      st.completeGoal(g.id, Date.now());
      if (!celebrated) {
        useSession.getState().celebrate({ kind: 'goal', goalTitle: g.title, detail: celebrationDetail(g) });
        celebrated = true;
      }
    }
  }
  return celebrated;
}
