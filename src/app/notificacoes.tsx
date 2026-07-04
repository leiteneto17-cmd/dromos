/**
 * Central de notificações — quem interagiu com você (Logos 📜, novos seguidores,
 * recados). Lista DERIVADA do backend (services/notifications.ts). Abrir a tela
 * marca tudo como visto (zera a bolinha do sino no hub). Tocar num item leva ao
 * perfil de quem interagiu. Tema neutro (igual Perfil/usuario), §2.7.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, ScreenBG } from '@/components/social-ui';
import { BrandFont } from '@/constants/theme';
import { useUI } from '@/hooks/use-ui';
import { getNotifications, markNotificationsSeen, type Notif } from '@/services/notifications';

/** "agora", "12 min", "3 h", "2 d" ou a data. */
function fmtAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

const KIND_BADGE: Record<Notif['kind'], string> = { logos: '📜', follower: '👤', scrap: '✍️' };

export default function NotificationsScreen() {
  const c = useUI();
  const [items, setItems] = useState<Notif[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getNotifications().then((list) => {
        if (alive) {
          setItems(list);
          setLoaded(true);
        }
      });
      void markNotificationsSeen(); // visto ao abrir → zera a bolinha do sino na volta
      return () => {
        alive = false;
      };
    }, []),
  );

  const goBack = () => (router.canGoBack() ? router.back() : router.navigate('/'));
  const openActor = (n: Notif) => {
    if (n.actorId) router.push({ pathname: '/usuario', params: { id: n.actorId, name: n.actorName } });
  };

  return (
    <ScreenBG>
      <Pressable onPress={goBack} hitSlop={8} style={styles.backRow}>
        <Text style={[styles.back, { color: c.textDim }]}>‹ Voltar</Text>
      </Pressable>
      <Text style={[styles.title, { color: c.text }]}>Notificações</Text>

      {!loaded ? (
        <ActivityIndicator color={c.green} style={{ marginTop: 32 }} />
      ) : items.length === 0 ? (
        <Card style={{ marginTop: 14 }}>
          <Text style={[styles.emptyTitle, { color: c.text }]}>Tudo em dia 🎉</Text>
          <Text style={[styles.emptySub, { color: c.textFaint }]}>
            Quando alguém te der um Logos 📜, começar a te seguir ou deixar um recado, aparece aqui.
          </Text>
        </Card>
      ) : (
        items.map((n) => (
          <Pressable key={n.id} onPress={() => openActor(n)}>
            <Card style={styles.row}>
              <View style={styles.avatarWrap}>
                <Text style={styles.avatar}>{n.actorAvatar || '🦉'}</Text>
                <Text style={styles.kindBadge}>{KIND_BADGE[n.kind]}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={[styles.text, { color: c.text }]} numberOfLines={3}>
                  <Text style={styles.name}>{n.actorName}</Text> {n.text}
                </Text>
                <Text style={[styles.time, { color: c.textFaint }]}>{fmtAgo(n.createdAt)}</Text>
              </View>
            </Card>
          </Pressable>
        ))
      )}
    </ScreenBG>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backRow: { marginBottom: 6 },
  back: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 28, fontFamily: BrandFont.extrabold, marginBottom: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptySub: { fontSize: 13, marginTop: 4, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  avatarWrap: { position: 'relative', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  avatar: { fontSize: 32 },
  // Selo do tipo (📜/👤/✍️) no canto do avatar, p/ identificar a interação de relance.
  kindBadge: { position: 'absolute', right: -4, bottom: -2, fontSize: 15 },
  text: { fontSize: 14, lineHeight: 20 },
  name: { fontWeight: '800' },
  time: { fontSize: 12, marginTop: 3 },
});
