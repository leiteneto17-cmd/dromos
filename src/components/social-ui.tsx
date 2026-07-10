/**
 * Blocos visuais reutilizáveis da camada social — agora sobre BASE NEUTRA (60-30-10),
 * com roxo+verde só como acento (CLAUDE.md §2.7). Cada bloco lê a paleta ativa via
 * useUI(), então responde ao tema claro/escuro automaticamente.
 */
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { BottomTabInset, BrandFont } from '@/constants/theme';
import { useUI } from '@/hooks/use-ui';
import { HUB } from '@/theme/hub';
import { shadow } from '@/theme/tokens';

/**
 * Fundo + área segura + rolagem. Base de toda tela social.
 * `hub` pinta o gradiente verde do hub (em vez do fundo neutro do tema) para
 * as abas que devem casar com o hub (Atividades, Comunidade, Perfil).
 */
export function ScreenBG({
  children,
  scroll = true,
  contentStyle,
  hub = false,
}: {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  hub?: boolean;
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
    <View style={[s.flex, { backgroundColor: hub ? HUB.base : c.bg }]}>
      {hub ? <LinearGradient colors={HUB.grad} style={StyleSheet.absoluteFill} /> : null}
      <SafeAreaView style={s.flex} edges={['top', 'left', 'right']}>
        {inner}
      </SafeAreaView>
    </View>
  );
}

/**
 * Card (camada 30%). `glow` destaca em verde (ação/conquista).
 * `hub` força o card BRANCO com sombra (pele do hub), independente do tema.
 */
export function Card({
  children,
  style,
  glow = false,
  hub = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  glow?: boolean;
  hub?: boolean;
}) {
  const c = useUI();
  if (hub) {
    return (
      <View style={[s.card, s.cardHub, glow && s.cardHubGlow, style]}>{children}</View>
    );
  }
  return (
    <View
      style={[
        s.card,
        { backgroundColor: c.surface, borderColor: glow ? c.accent : c.border },
        // Sombra suave (Fluent "acrylic") só no claro; no escuro a borda já dá a separação.
        c.mode === 'light' ? shadow(1) : null,
        glow && { shadowColor: c.accent, shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
        style,
      ]}>
      {children}
    </View>
  );
}

/**
 * Título de seção — acento ROXO (detalhe 10%). Prefira `name` (ícone SVG do chrome,
 * design system 2026); `icon` (emoji) fica como fallback p/ casos sem SVG.
 * `hub` usa branco (o título fica sobre o fundo verde do hub).
 */
export function SectionTitle({
  children,
  name,
  icon,
  hub = false,
}: {
  children: string;
  name?: IconName;
  icon?: string;
  hub?: boolean;
}) {
  const c = useUI();
  // Título de seção em TINTA (guia v2 §4: rótulo não é azul) — sério/clássico.
  const color = hub ? HUB.onBg : c.text;
  return (
    <View style={s.sectionRow}>
      {name ? (
        <Icon name={name} size={17} color={color} />
      ) : icon ? (
        <Text style={s.sectionIcon}>{icon}</Text>
      ) : null}
      <Text style={[s.sectionTitle, { color }]}>{children}</Text>
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
  // Cantos 22 + sombra bem suave (refino 2026-07-10, referência do Perfil).
  card: { borderRadius: 22, borderWidth: 1, padding: 16 },
  cardHub: {
    backgroundColor: HUB.cardBg,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  // "Glow" aposentado no rebrand (guia §6.4): destaque agora é só elevação maior, sombra NEUTRA.
  cardHubGlow: { shadowColor: '#0B1220', shadowOpacity: 0.16, shadowRadius: 16 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22, marginBottom: 10 },
  sectionIcon: { fontSize: 18 },
  sectionTitle: { fontSize: 18, fontFamily: BrandFont.semibold, letterSpacing: 0.3 },
  pill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '700' },
});
