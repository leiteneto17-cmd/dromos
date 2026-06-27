/**
 * Central de notificações — "quem interagiu COM VOCÊ" (camada social, §2.6).
 * Tipos: Logos (kudos) que deram nas suas atividades, novos seguidores, e recados
 * no seu mural. É DERIVADO das tabelas que já existem (activity_kudos, follows,
 * scraps) — sem tabela própria nem triggers — então não precisa de schema novo.
 *
 * "Não lido": guardamos só o INSTANTE da última visita à tela (AsyncStorage, por
 * usuário); a bolinha do sino conta o que chegou depois disso. Simples e offline-safe.
 *
 * Obs: pedidos de seguir (pending) continuam no Perfil, onde têm Aceitar/Recusar.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/services/supabase';

export type NotifKind = 'logos' | 'follower' | 'scrap';

export type Notif = {
  /** id único e estável do evento (key da lista) */
  id: string;
  kind: NotifKind;
  actorId: string | null;
  actorName: string;
  actorAvatar: string | null;
  /** frase pronta exibida APÓS o nome (ex.: 'te deu um Logos 📜') */
  text: string;
  createdAt: string;
};

async function uid(): Promise<string | null> {
  if (!supabase) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user.id ?? null;
}

function snippet(s: string, n = 60): string {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/** Notificações recentes (mais novas primeiro). Vazio se deslogado/sem backend. */
export async function getNotifications(limit = 50): Promise<Notif[]> {
  if (!supabase) return [];
  const me = await uid();
  if (!me) return [];

  const out: Notif[] = [];
  const actorIds = new Set<string>();

  // 1) Logos (kudos) que outras pessoas deram nas MINHAS atividades.
  const { data: acts } = await supabase
    .from('reading_activities')
    .select('id, book_title')
    .eq('user_id', me)
    .order('created_at', { ascending: false })
    .limit(100);
  const myActs = (acts as { id: string; book_title: string }[] | null) ?? [];
  const titleOf = new Map(myActs.map((a) => [a.id, a.book_title]));
  if (myActs.length) {
    const { data: k } = await supabase
      .from('activity_kudos')
      .select('activity_id, user_id, created_at')
      .in(
        'activity_id',
        myActs.map((a) => a.id),
      )
      .neq('user_id', me)
      .order('created_at', { ascending: false })
      .limit(limit);
    (k as { activity_id: string; user_id: string; created_at: string }[] | null)?.forEach((r) => {
      actorIds.add(r.user_id);
      const book = titleOf.get(r.activity_id);
      out.push({
        id: `logos-${r.activity_id}-${r.user_id}`,
        kind: 'logos',
        actorId: r.user_id,
        actorName: '',
        actorAvatar: null,
        text: book ? `te deu um Logos 📜 em "${book}"` : 'te deu um Logos 📜',
        createdAt: r.created_at,
      });
    });
  }

  // 2) Novos seguidores (aceitos).
  const { data: f } = await supabase
    .from('follows')
    .select('follower_id, created_at')
    .eq('followee_id', me)
    .eq('status', 'accepted')
    .order('created_at', { ascending: false })
    .limit(limit);
  (f as { follower_id: string; created_at: string }[] | null)?.forEach((r) => {
    actorIds.add(r.follower_id);
    out.push({
      id: `follower-${r.follower_id}`,
      kind: 'follower',
      actorId: r.follower_id,
      actorName: '',
      actorAvatar: null,
      text: 'começou a te seguir',
      createdAt: r.created_at,
    });
  });

  // 3) Recados no meu mural (de outras pessoas).
  const { data: sc } = await supabase
    .from('scraps')
    .select('id, author_id, body, created_at')
    .eq('recipient_id', me)
    .neq('author_id', me)
    .order('created_at', { ascending: false })
    .limit(limit);
  (sc as { id: string; author_id: string; body: string; created_at: string }[] | null)?.forEach((r) => {
    actorIds.add(r.author_id);
    out.push({
      id: `scrap-${r.id}`,
      kind: 'scrap',
      actorId: r.author_id,
      actorName: '',
      actorAvatar: null,
      text: `te deixou um recado: "${snippet(r.body)}"`,
      createdAt: r.created_at,
    });
  });

  // Nome/avatar dos atores (uma consulta só).
  if (actorIds.size) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .in('id', [...actorIds]);
    const pm = new Map<string, { name: string | null; avatar: string | null }>();
    (profs as { id: string; name: string | null; avatar_url: string | null }[] | null)?.forEach((p) =>
      pm.set(p.id, { name: p.name, avatar: p.avatar_url }),
    );
    out.forEach((n) => {
      if (n.actorId) {
        n.actorName = pm.get(n.actorId)?.name?.trim() || 'Leitor';
        n.actorAvatar = pm.get(n.actorId)?.avatar ?? null;
      }
    });
  }

  return out
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

// ---------- "não lido" (instante da última visita, por usuário) ----------
const seenKey = (me: string) => `notifs:lastSeen:${me}`;

/** Marca tudo como visto agora (chamado ao abrir a tela). */
export async function markNotificationsSeen(): Promise<void> {
  const me = await uid();
  if (!me) return;
  await AsyncStorage.setItem(seenKey(me), String(Date.now()));
}

/** Quantas notificações chegaram DEPOIS da última visita (p/ a bolinha do sino). */
export async function getUnreadCount(): Promise<number> {
  const me = await uid();
  if (!me) return 0;
  const [list, raw] = await Promise.all([getNotifications(), AsyncStorage.getItem(seenKey(me))]);
  const seen = raw ? Number(raw) : 0;
  return list.filter((n) => new Date(n.createdAt).getTime() > seen).length;
}
