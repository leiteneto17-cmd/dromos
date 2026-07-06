/**
 * "Grandes Jornadas" — atalhos temáticos para o Cantinho do Estudo (ENEM) e o Dromos Kids.
 * MOVIDO do Explorar para a Biblioteca (decisão do usuário 2026-07-06). Repintado para o
 * rebrand claro+azul: cards de superfície com sombra suave e acento lateral (ENEM azul,
 * Infantil violeta — o Kids mantém um toque "mágico"). Segue o tema via useUI().
 */
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { useUI } from '@/hooks/use-ui';
import { shadow } from '@/theme/tokens';

const KIDS_ACCENT = '#7C5CE0'; // violeta amigável — identidade do Dromos Kids

function Journey({
  onPress,
  icon,
  title,
  sub,
  accent,
  surface,
  border,
  text,
  soft,
}: {
  onPress: () => void;
  icon: string;
  title: string;
  sub: string;
  accent: string;
  surface: string;
  border: string;
  text: string;
  soft: ViewStyle | null;
}) {
  return (
    <Pressable style={styles.cell} onPress={onPress}>
      <View style={[styles.card, { backgroundColor: surface, borderColor: border, borderLeftColor: accent }, soft]}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={[styles.title, { color: text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.sub, { color: accent }]} numberOfLines={2}>
          {sub}
        </Text>
      </View>
    </Pressable>
  );
}

export function JourneysRow() {
  const c = useUI();
  const soft = c.mode === 'light' ? (shadow(1) as ViewStyle) : null;
  const common = { surface: c.surface, border: c.border, text: c.text, soft };
  return (
    <View style={styles.row}>
      <Journey onPress={() => router.push('/enem')} icon="🎓" title="Clássicos de Prova" sub="ENEM & vestibulares · IA" accent={c.accent} {...common} />
      <Journey onPress={() => router.push('/infantil' as Href)} icon="✨📖" title="Clássicos Infantis" sub="Dromos Kids · histórias mágicas" accent={KIDS_ACCENT} {...common} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  cell: { flex: 1 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 104,
    justifyContent: 'center',
  },
  icon: { fontSize: 24 },
  title: { fontSize: 15, fontWeight: '900', marginTop: 8 },
  sub: { fontSize: 11.5, fontWeight: '700', marginTop: 3 },
});
