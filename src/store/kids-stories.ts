/**
 * "Minhas Criações" — histórias que a criança/pai gerou na Fábrica de Histórias
 * (services/ai/story.ts). Guardadas LOCALMENTE (privacidade: conteúdo infantil não sai do
 * aparelho) via AsyncStorage, no mesmo estilo manual de `store/plan.ts`.
 *
 * Também mantém a COTA MENSAL de geração (a isca do Premium, decisão do usuário 2026-07-06):
 *  - BYOK (chave própria) → ilimitado (a chave é do usuário).
 *  - Premium → teto alto (protege o custo da nossa chave gerida).
 *  - Grátis → poucas por mês, para "provar" e converter.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { useAI } from '@/store/ai';
import { usePlan } from '@/store/plan';

export const FREE_MONTHLY = 2;
export const PREMIUM_MONTHLY = 30;

const STORIES_KEY = 'leitura-kids-stories';
const USAGE_KEY = 'leitura-kids-usage';

export type SavedStory = {
  id: string;
  titulo: string;
  paginas: string[];
  createdAt: number;
  /** Ingredientes (para exibir o "selo" e permitir recriar depois). */
  kindLabel: string;
  heroLabel: string;
  settingLabel: string;
  moralLabel: string;
  /** Emoji decorativo da capa mágica (sem imagem de IA nesta v1). */
  coverEmoji: string;
};

type Usage = { month: string; count: number };

/** Chave do mês corrente (ano-mês) para zerar a cota a cada mês. */
function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}`;
}

type KidsState = {
  stories: SavedStory[];
  usage: Usage;
  addStory: (s: SavedStory) => void;
  removeStory: (id: string) => void;
  /** Conta +1 no mês (chamar só quando usou a IA GERIDA — BYOK não conta). */
  registerManagedUse: () => void;
};

export const useKidsStories = create<KidsState>((set, get) => ({
  stories: [],
  usage: { month: monthKey(), count: 0 },
  addStory: (s) => {
    const stories = [s, ...get().stories];
    set({ stories });
    AsyncStorage.setItem(STORIES_KEY, JSON.stringify(stories)).catch(() => {});
  },
  removeStory: (id) => {
    const stories = get().stories.filter((x) => x.id !== id);
    set({ stories });
    AsyncStorage.setItem(STORIES_KEY, JSON.stringify(stories)).catch(() => {});
  },
  registerManagedUse: () => {
    const cur = get().usage;
    const mk = monthKey();
    const usage: Usage = cur.month === mk ? { month: mk, count: cur.count + 1 } : { month: mk, count: 1 };
    set({ usage });
    AsyncStorage.setItem(USAGE_KEY, JSON.stringify(usage)).catch(() => {});
  },
}));

// Hidrata do disco na inicialização (stories + cota do mês).
AsyncStorage.multiGet([STORIES_KEY, USAGE_KEY])
  .then((pairs) => {
    const map = Object.fromEntries(pairs);
    let stories: SavedStory[] = [];
    try {
      const raw = map[STORIES_KEY];
      if (raw) stories = JSON.parse(raw) as SavedStory[];
    } catch {
      stories = [];
    }
    let usage: Usage = { month: monthKey(), count: 0 };
    try {
      const raw = map[USAGE_KEY];
      if (raw) {
        const parsed = JSON.parse(raw) as Usage;
        // Só mantém a contagem se ainda for o mesmo mês (senão zera).
        usage = parsed.month === monthKey() ? parsed : { month: monthKey(), count: 0 };
      }
    } catch {
      // usa o default
    }
    useKidsStories.setState({ stories, usage });
  })
  .catch(() => {});

/** Teto mensal do usuário atual (∞ com BYOK; alto no Premium; baixo no grátis). */
export function monthlyLimit(): number {
  if (useAI.getState().hasKey) return Infinity; // chave própria = sem limite nosso
  return usePlan.getState().plan === 'premium' ? PREMIUM_MONTHLY : FREE_MONTHLY;
}

/** Quantas ainda cabem neste mês (Infinity com BYOK). */
export function remainingThisMonth(): number {
  const limit = monthlyLimit();
  if (limit === Infinity) return Infinity;
  const { usage } = useKidsStories.getState();
  const used = usage.month === monthKey() ? usage.count : 0;
  return Math.max(0, limit - used);
}

/** Pode gerar agora? Devolve motivo + se a saída é oferecer Premium (grátis estourou a cota). */
export function canGenerate(): { ok: boolean; reason?: string; offerPremium?: boolean } {
  if (remainingThisMonth() > 0) return { ok: true };
  const isPremium = usePlan.getState().plan === 'premium';
  return {
    ok: false,
    offerPremium: !isPremium,
    reason: isPremium
      ? `Você já criou as ${PREMIUM_MONTHLY} histórias deste mês. Elas voltam no próximo mês — ou conecte sua própria chave em Integrações para criar sem limite.`
      : `As histórias grátis deste mês acabaram (${FREE_MONTHLY}/mês). Seja Premium para criar até ${PREMIUM_MONTHLY} por mês.`,
  };
}
