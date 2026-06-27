/**
 * Cabeçalho do perfil (estilo "TrackSync Hub"): avatar, nome, nível com barra de
 * progresso e chips de emblemas. Base neutra; verde = ação/ativo, roxo = detalhe.
 * Usado no HUB (Leitura) e na aba Perfil.
 */
import { StyleSheet, Text, View } from 'react-native';

import { EmblemStrip } from '@/components/emblem-strip';
import { useUI } from '@/hooks/use-ui';
import type { Achievement, DerivedStats } from '@/services/progress';

export function ProfileHeader({
  name,
  avatar,
  derived,
  achievements,
  founder = false,
}: {
  name: string;
  /** Emoji do avatar (ex.: "🦉"). Sem ele, mostra a inicial do nome. */
  avatar?: string | null;
  derived: DerivedStats;
  achievements: Achievement[];
  /** Brasão de fundador (primeiros 50) — exibido à frente dos emblemas. */
  founder?: boolean;
}) {
  const c = useUI();
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <View style={s.wrap}>
      <View style={s.topRow}>
        <View
          style={[
            s.avatar,
            { backgroundColor: c.cardElevated, borderColor: c.green },
            founder && s.avatarFounder,
            founder && { shadowColor: c.green },
          ]}>
          {avatar ? (
            <Text style={s.avatarEmoji}>{avatar}</Text>
          ) : (
            <Text style={[s.avatarText, { color: c.green }]}>{initial}</Text>
          )}
        </View>
        <View style={s.info}>
          <Text
            style={[
              s.name,
              { color: c.text },
              founder && { textShadowColor: c.green, textShadowRadius: 12, textShadowOffset: { width: 0, height: 0 } },
            ]}
            numberOfLines={1}>
            {name}
          </Text>
          <Text style={[s.level, { color: c.textDim }]}>Nível {derived.level} · Leitor</Text>
          {founder ? (
            <Text style={[s.founderLine, { color: c.green }]} numberOfLines={1}>
              👑 Fundador · entre os 50 primeiros
            </Text>
          ) : null}
        </View>
      </View>

      {/* Barra de progresso do nível */}
      <View style={[s.track, { backgroundColor: c.border }]}>
        <View style={[s.fill, { backgroundColor: c.green, width: `${Math.round(derived.levelProgress * 100)}%` }]} />
      </View>

      {/* Emblemas — só a arte (compacto); o nome aparece ao tocar (EmblemStrip) */}
      <EmblemStrip achievements={achievements} founder={founder} />
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
  // Anel neon (glow) no avatar do fundador — shadowColor é aplicado inline (cor do tema).
  avatarFounder: { borderWidth: 2.5, shadowOpacity: 0.9, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
  founderLine: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3, marginTop: 5 },
});
