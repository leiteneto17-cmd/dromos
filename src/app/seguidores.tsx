/**
 * Lista de SEGUIDORES / SEGUINDO de um perfil. Aberta ao tocar nos contadores em
 * usuario.tsx. Cada linha leva ao perfil da pessoa. Só vínculos aceitos (§4.8).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useUI } from '@/hooks/use-ui';
import { getFollowList, type FollowListItem } from '@/services/social';

type Mode = 'followers' | 'following';

const TABS: { id: Mode; label: string }[] = [
  { id: 'followers', label: 'Seguidores' },
  { id: 'following', label: 'Seguindo' },
];

export default function FollowListScreen() {
  const c = useUI();
  const params = useLocalSearchParams<{ id?: string; name?: string; tab?: string }>();
  const userId = (params.id ?? '').trim();

  const [mode, setMode] = useState<Mode>(params.tab === 'following' ? 'following' : 'followers');
  const [list, setList] = useState<FollowListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (m: Mode) => {
      if (!userId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const data = await getFollowList(userId, m);
      setList(data);
      setLoading(false);
    },
    [userId],
  );

  useEffect(() => {
    load(mode);
  }, [mode, load]);

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <SafeAreaView style={styles.fill} edges={['top', 'left', 'right']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={[styles.back, { color: c.green }]}>‹ Voltar</Text>
          </Pressable>
        </View>

        {params.name ? (
          <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
            {String(params.name)}
          </Text>
        ) : null}

        <View style={[styles.tabs, { borderBottomColor: c.border }]}>
          {TABS.map((t) => {
            const active = t.id === mode;
            return (
              <Pressable
                key={t.id}
                onPress={() => setMode(t.id)}
                style={[styles.tab, { borderBottomColor: active ? c.green : 'transparent' }]}>
                <Text style={[styles.tabText, { color: active ? c.green : c.textFaint }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <ActivityIndicator color={c.green} style={{ marginTop: 40 }} />
        ) : list.length === 0 ? (
          <Text style={[styles.empty, { color: c.textFaint }]}>
            {mode === 'followers'
              ? 'Ninguém segue este perfil ainda.'
              : 'Este perfil ainda não segue ninguém.'}
          </Text>
        ) : (
          <FlatList
            data={list}
            keyExtractor={(u) => u.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const founder = item.is_founder && item.founder_flair;
              return (
                <Pressable
                  style={[styles.row, { borderBottomColor: c.border }]}
                  onPress={() =>
                    router.push({ pathname: '/usuario', params: { id: item.id, name: item.name ?? '' } })
                  }>
                  <Text style={styles.avatar}>{item.avatar_url || '🦉'}</Text>
                  <Text style={[styles.name, { color: founder ? c.green : c.text }]} numberOfLines={1}>
                    {(item.name ?? '').trim() || 'Leitor'}
                    {founder ? ' 👑' : ''}
                  </Text>
                </Pressable>
              );
            }}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topBar: { paddingHorizontal: 16, paddingVertical: 10 },
  back: { fontSize: 16, fontWeight: '800' },
  title: { fontSize: 18, fontWeight: '800', paddingHorizontal: 16, marginBottom: 8 },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, gap: 24, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { paddingVertical: 10, borderBottomWidth: 2 },
  tabText: { fontSize: 15, fontWeight: '800' },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: { fontSize: 30 },
  name: { fontSize: 16, fontWeight: '700', flex: 1 },
  empty: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 40, paddingHorizontal: 24 },
});
