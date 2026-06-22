/**
 * Blocos visuais reutilizáveis da camada social — agora sobre BASE NEUTRA (60-30-10),
 * com roxo+verde só como acento (CLAUDE.md §2.7). Cada bloco lê a paleta ativa via
 * useUI(), então responde ao tema claro/escuro automaticamente.
 */
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';
import { useUI } from '@/hooks/use-ui';

/** Fundo neutro + área segura + rolagem. Base de toda tela social. */
export function ScreenBG({
  children,
  scroll = true,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const c = useUI();
  const inner = scroll ? (
    <ScrollView
      style={s.flex}
      contentContainerStyle={[s.scrollContent, contentStyle]}
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={[s.flex, s.scrollContent, contentStyle]}>{children}</View>
  );

  return (
    <View style={[s.flex, { backgroundColor: c.bg }]}>
      <SafeAreaView style={s.flex} edges={['top', 'left', 'right']}>
        {inner}
      </SafeAreaView>
    </View>
  );
}

/** Card neutro (camada 30%). `glow` destaca em verde (ação/conquista). */
export function Card({
  children,
  style,
  glow = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  glow?: boolean;
}) {
  const c = useUI();
  return (
    <View
      style={[
        s.card,
        { backgroundColor: c.card, borderColor: glow ? c.green : c.border },
        glow && { shadowColor: c.green, shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
        style,
      ]}>
      {children}
    </View>
  );
}

/** Título de seção — acento ROXO (detalhe 10%), com ícone (emoji) opcional. */
export function SectionTitle({ children, icon }: { children: string; icon?: string }) {
  const c = useUI();
  return (
    <View style={s.sectionRow}>
      {icon ? <Text style={s.sectionIcon}>{icon}</Text> : null}
      <Text style={[s.sectionTitle, { color: c.purple }]}>{children}</Text>
    </View>
  );
}

/** Pílula pequena (badge/tag). */
export function Pill({ children, tone = 'purple' }: { children: string; tone?: 'purple' | 'green' }) {
  const c = useUI();
  const color = tone === 'green' ? c.green : c.purple;
  return (
    <View style={[s.pill, { borderColor: color }]}>
      <Text style={[s.pillText, { color }]}>{children}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: BottomTabInset + 32 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22, marginBottom: 10 },
  sectionIcon: { fontSize: 18 },
  sectionTitle: { fontSize: 18, fontWeight: '700', letterSpacing: 0.3 },
  pill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '700' },
});
