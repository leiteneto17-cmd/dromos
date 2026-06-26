/**
 * Navegação inferior FLUTUANTE (estilo referência 2026) — pílula CLARA que flutua na
 * base, ícones verdes (ativo) / cinza (inativo) e um BOTÃO CENTRAL maior (círculo verde)
 * que abre a leitura atual. Substitui as abas nativas por tab bar customizada (expo-router
 * Tabs + tabBar próprio), com ícones vetoriais (react-native-svg).
 */
import { router, Tabs } from 'expo-router';
import type { ComponentType, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { useLibrary } from '@/store/library';

// Paleta da nav (clara, fiel à imagem) — independe do tema claro/escuro do app.
const NAV = {
  pill: '#FFFFFF',
  border: 'rgba(0,0,0,0.06)',
  inactive: '#8A968F',
  active: '#0FA968',
  centerBg: '#16A06B',
  centerIcon: '#FFFFFF',
};

type IconProps = { color: string; size?: number };

type TabRoute = { key: string; name: string };
type TabBarProps = {
  state: { index: number; routes: TabRoute[] };
  navigation: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: boolean }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

function HomeIcon({ color, size = 23 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 11.5 12 4l8 7.5" />
      <Path d="M6 10v9h12v-9" />
    </Svg>
  );
}

function UsersIcon({ color, size = 23 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="9" cy="8" r="3.2" />
      <Path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <Path d="M16 5.4a3 3 0 0 1 0 5.6" />
      <Path d="M21 19c0-2.3-1.4-4-3.4-4.7" />
    </Svg>
  );
}

function ChartIcon({ color, size = 23 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 20V11" />
      <Path d="M12 20V5" />
      <Path d="M19 20v-6" />
    </Svg>
  );
}

function UserIcon({ color, size = 23 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="8" r="3.5" />
      <Path d="M5.5 20c0-3.4 2.9-5.8 6.5-5.8s6.5 2.4 6.5 5.8" />
    </Svg>
  );
}

function BookOpenIcon({ color, size = 26 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 6c-1.7-1-3.8-1.4-5.8-1.4-1 0-2 .1-3 .4v11c1-.3 2-.4 3-.4 2 0 4.1.4 5.8 1.4 1.7-1 3.8-1.4 5.8-1.4 1 0 2 .1 3 .4V5c-1-.3-2-.4-3-.4-2 0-4.1.4-5.8 1.4z" />
      <Path d="M12 6v11" />
    </Svg>
  );
}

const META: Record<string, { Icon: ComponentType<IconProps>; label: string }> = {
  index: { Icon: HomeIcon, label: 'Leitura' },
  comunidade: { Icon: UsersIcon, label: 'Comunidade' },
  atividades: { Icon: ChartIcon, label: 'Atividades' },
  perfil: { Icon: UserIcon, label: 'Perfil' },
};

/** Abre a leitura atual (botão central). Sem livro, cai na biblioteca. */
function openCurrentReading() {
  const s = useLibrary.getState();
  const current = s.books.find((b) => b.id === s.currentBookId) ?? s.books[0];
  if (current) {
    s.openBook(current.id);
    router.navigate('/reader');
  } else {
    router.navigate('/biblioteca');
  }
}

function FloatingTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  function tabButton(route: TabRoute, focused: boolean) {
    const meta = META[route.name];
    if (!meta) return null;
    const Icon = meta.Icon;
    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
    };
    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={focused ? { selected: true } : {}}
        accessibilityLabel={meta.label}
        style={styles.item}>
        <Icon color={focused ? NAV.active : NAV.inactive} />
        <View style={[styles.dot, focused && { backgroundColor: NAV.active }]} />
      </Pressable>
    );
  }

  // Slots: [Leitura, Comunidade, (Ler central), Atividades, Perfil]
  const slots: ReactNode[] = [];
  state.routes.forEach((route, i) => {
    slots.push(tabButton(route, state.index === i));
    if (i === 1) {
      slots.push(
        <Pressable
          key="__center"
          onPress={openCurrentReading}
          accessibilityRole="button"
          accessibilityLabel="Continuar lendo"
          style={[styles.center, { backgroundColor: NAV.centerBg }]}>
          <BookOpenIcon color={NAV.centerIcon} />
        </Pressable>,
      );
    }
  });

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
      <View style={[styles.bar, { backgroundColor: NAV.pill, borderColor: NAV.border }]}>{slots}</View>
    </View>
  );
}

export default function AppTabs() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <FloatingTabBar {...(props as unknown as TabBarProps)} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="comunidade" />
      <Tabs.Screen name="atividades" />
      <Tabs.Screen name="perfil" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: 'transparent', paddingHorizontal: 18, paddingTop: 6 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: 34,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  item: { alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 6, paddingVertical: 2 },
  dot: { width: 16, height: 3, borderRadius: 2, backgroundColor: 'transparent' },
  center: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -26,
    borderWidth: 4,
    borderColor: NAV.pill,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 14,
  },
});
