/**
 * Cabeçalho do perfil (estilo "TrackSync Hub"): avatar, nome, nível com barra de
 * progresso e chips de emblemas. Base neutra; verde = ação/ativo, roxo = detalhe.
 * Usado no HUB (Leitura) e na aba Perfil.
 */
import { StyleSheet, Text, View } from 'react-native';

import { useUI } from '@/hooks/use-ui';
import type { Achievement, DerivedStats } from '@/services/progress';

export function ProfileHeader({
  name,
  avatar,
  derived,
  achievements,
}: {
  name: string;
  /** Emoji do avatar (ex.: "🦉"). Sem ele, mostra a inicial do nome. */
  avatar?: string | null;
  derived: DerivedStats;
  achievements: Achievement[];
}) {
  const c = useUI();
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const badges = achievements.filter((a) => a.unlocked).slice(0, 3);

  return (
    <View style={s.wrap}>
      <View style={s.topRow}>
        <View style={[s.avatar, { backgroundColor: c.cardElevated, borderColor: c.green }]}>
          {avatar ? (
            <Text style={s.avatarEmoji}>{avatar}</Text>
          ) : (
            <Text style={[s.avatarText, { color: c.green }]}>{initial}</Text>
          )}
        </View>
        <View style={s.info}>
          <Text style={[s.name, { color: c.text }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[s.level, { color: c.textDim }]}>Nível {derived.level} · Leitor</Text>
        </View>
      </View>

      {/* Barra de progresso do nível */}
      <View style={[s.track, { backgroundColor: c.border }]}>
        <View style={[s.fill, { backgroundColor: c.green, width: `${Math.round(derived.levelProgress * 100)}%` }]} />
      </View>

      {/* Emblemas */}
      <View style={s.badges}>
        {badges.length === 0 ? (
          <Text style={[s.noBadges, { color: c.textFaint }]}>Leia para desbloquear emblemas 🏅</Text>
        ) : (
          badges.map((b) => (
            <View key={b.id} style={[s.badge, { backgroundColor: c.cardElevated, borderColor: c.border }]}>
              <Text style={s.badgeIcon}>{b.icon}</Text>
              <Text style={[s.badgeText, { color: c.textDim }]}>{b.title}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 8 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 58, height: 58, borderRadius: 29, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24, fontWeight: '800' },
  avatarEmoji: { fontSize: 30 },
  info: { flex: 1 },
  name: { fontSize: 22, fontWeight: '800' },
  level: { fontSize: 14, marginTop: 2 },
  track: { height: 6, borderRadius: 3, marginTop: 14, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  noBadges: { fontSize: 13 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeIcon: { fontSize: 13 },
  badgeText: { fontSize: 12, fontWeight: '700' },
});
