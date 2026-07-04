/**
 * Navegação inferior FLUTUANTE (estilo referência 2026) — pílula CLARA que flutua na
 * base, ícones verdes (ativo) / cinza (inativo) e um BOTÃO CENTRAL maior (círculo verde)
 * que abre a leitura atual. Substitui as abas nativas por tab bar customizada (expo-router
 * Tabs + tabBar próprio), com ícones vetoriais (react-native-svg).
 */
import { BlurView } from 'expo-blur';
import { router, Tabs } from 'expo-router';
import type { ComponentType, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { Social } from '@/theme/social';
import { useLibrary } from '@/store/library';

// Paleta da nav — OLED dark-first (vidro escuro + verde da MARCA). Independe do tema do app.
// Verde = Social.green (#5EF0A0), não mais o #00FF66 puro (fora da marca — GUIA-DE-MARCA §3).
const NAV = {
  pill: 'rgba(20, 20, 25, 0.55)', // fundo escuro ultra-translúcido (vidro)
  border: 'rgba(255, 255, 255, 0.12)', // linha de brilho reflexivo (border gloss)
  inactive: Social.muted, // ícones inativos (cinza roxo da marca)
  active: Social.green, // verde-menta da marca (aba ativa)
  centerBg: '#052E16', // botão central (verde escuro profundo — surface do FAB)
  centerGlow: Social.green, // halo verde da marca
  centerIcon: Social.green, // ícone central combinando
  pillFallback: 'rgba(15, 15, 15, 0.85)', // fallback OLED escuro se o blur falhar
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

function ShelfIcon({ color, size = 23 }: IconProps) {
  // Estante: dois livros em pé + um inclinado (aba Biblioteca).
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4.5 4.5h3.4v15H4.5z" />
      <Path d="M10.3 4.5h3.4v15h-3.4z" />
      <Path d="M16.2 5.6l3.2.9-3.6 12.9-3.2-.9z" />
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
  index: { Icon: HomeIcon, label: 'Início' },
  biblioteca: { Icon: ShelfIcon, label: 'Biblioteca' },
  comunidade: { Icon: UsersIcon, label: 'Comunidade' },
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

  // Slots: [Início, Biblioteca, (Ler central), Comunidade, Perfil]
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
      <View style={[styles.bar, { borderColor: NAV.border, backgroundColor: NAV.pillFallback }]}>
        {/* iOS: desfoque nativo real. Android: frost escuro translúcido (o blur real exigiria
            blurTarget + snapshot que não atualiza ao rolar e pesa — não vale p/ a nav). */}
        <BlurView intensity={64} tint="dark" style={styles.barBlur} />
        {slots}
      </View>
    </View>
  );
}

export default function AppTabs() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <FloatingTabBar {...(props as unknown as TabBarProps)} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="biblioteca" />
      <Tabs.Screen name="comunidade" />
      <Tabs.Screen name="perfil" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // O wrap só posiciona (área segura + espaço p/ o botão central que sobe). As margens
  // laterais/inferiores da pílula ficam no `bar` (flutua suspensa).
  wrap: { backgroundColor: 'transparent', paddingTop: 6 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 34,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  // Vidro (Liquid Glass): desfoque + véu ESCURO sutil, recortado ao formato da pílula.
  // Fica ATRÁS dos ícones; o botão central (que sobe) NÃO é recortado (overflow só aqui).
  barBlur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 34,
    overflow: 'hidden',
    backgroundColor: 'rgba(10, 10, 12, 0.35)', // véu escuro sutil (legibilidade dos ícones)
  },
  item: { alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 6, paddingVertical: 2 },
  dot: { width: 16, height: 3, borderRadius: 2, backgroundColor: 'transparent' },
  center: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
    borderWidth: 2,
    borderColor: NAV.border,
    shadowColor: NAV.centerGlow, // halo verde-neon intenso (glow do design system)
    shadowOpacity: 0.8,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },
});
