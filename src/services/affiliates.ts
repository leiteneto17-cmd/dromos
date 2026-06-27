/**
 * Links de AFILIADO ("onde comprar") — modelo de receita do app (CLAUDE.md §6 / plano
 * 2026-06-27). NÃO vendemos o livro no app: apenas REDIRECIONAMOS para a loja (fora do
 * app), então NÃO cai na taxa de IAP da Apple/Google (é o modelo "agregador de links").
 *
 * v1 (atual): links de BUSCA por ISBN/título — sem preço ao vivo, sem backend. O
 * comparador de preços (ranking com valores em tempo real via PA-API + scrapers) é uma
 * FASE FUTURA com servidor.
 *
 * IDs de afiliado NÃO são segredo (aparecem na URL) — preencha em AFFILIATE quando se
 * cadastrar nos programas. Sem o ID, o link ainda abre a loja (só não comissiona).
 */
import { Linking } from 'react-native';

export const AFFILIATE = {
  /** Amazon Associados (ex.: "dromos-20"). A `tag` comissiona direto na URL. */
  amazonTag: '',
  // Google Play Livros e Magazine Luiza geralmente comissionam via REDE de afiliados
  // (Awin/Lomadee): quando tiver o cadastro, troque o `build` da loja por um deep link
  // da rede (que embute seu ID) em vez do link de busca simples abaixo.
};

export type BookRef = { title: string; author?: string | null; isbn?: string | null };

export type AffiliateStore = {
  id: string;
  name: string;
  emoji: string;
  /** Monta a URL de busca na loja para o livro. */
  build: (b: BookRef) => string;
  /** true = já comissiona (tem ID configurado); false = abre a loja sem comissão ainda. */
  earns: () => boolean;
};

/** Termo de busca: título + autor (URL-encoded). */
function term(b: BookRef): string {
  return encodeURIComponent([b.title, b.author].filter(Boolean).join(' '));
}

export const STORES: AffiliateStore[] = [
  {
    id: 'amazon',
    name: 'Amazon',
    emoji: '📦',
    build: (b) => {
      const k = b.isbn ? encodeURIComponent(b.isbn) : term(b);
      const tag = AFFILIATE.amazonTag ? `&tag=${encodeURIComponent(AFFILIATE.amazonTag)}` : '';
      return `https://www.amazon.com.br/s?k=${k}&i=stripbooks${tag}`;
    },
    earns: () => !!AFFILIATE.amazonTag,
  },
  {
    id: 'googleplay',
    name: 'Google Play Livros',
    emoji: '▶️',
    build: (b) => `https://play.google.com/store/search?q=${term(b)}&c=books`,
    earns: () => false, // trocar por deep link da rede de afiliados quando tiver cadastro
  },
  {
    id: 'magalu',
    name: 'Magazine Luiza',
    emoji: '🛍️',
    build: (b) => `https://www.magazineluiza.com.br/busca/${term(b)}/`,
    earns: () => false,
  },
];

/** Abre a loja no navegador/app nativo (fora do app). No-op silencioso se não der. */
export async function openAffiliate(store: AffiliateStore, b: BookRef): Promise<void> {
  try {
    await Linking.openURL(store.build(b));
  } catch {
    // sem navegador/app p/ abrir — ignora
  }
}
