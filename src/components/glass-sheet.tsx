/**
 * Folha "Liquid Glass" reutilizável (design system 2026): bottom sheet translúcido
 * com desfoque (BlurView) recortado ao topo arredondado + borda fina com brilho (accent).
 * Centraliza o padrão que estava duplicado em `bookmarks-sheet.tsx`, para todas as
 * folhas terem o MESMO vidro.
 *
 * É palette-agnóstico (recebe cores cruas), então serve tanto à pele do LEITOR
 * (sépia/claro/escuro) quanto à pele SOCIAL (roxo+verde).
 *
 * ⚠️ Blur real: iOS = nativo; Android = frost translúcido (ver decisão em
 * docs/MEMORIA-PROJETO.md). Os fundos translúcidos garantem legibilidade mesmo sem
 * o módulo nativo (Expo Go / dev build sem expo-blur).
 */
import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

/** #RRGGBB → rgba(r,g,b,a) — deixa a superfície translúcida (vidro). */
export function withAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Luminância do fundo → escolhe o tom do desfoque (claro/escuro). */
export function blurTint(bg: string): 'light' | 'dark' {
  const h = bg.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b < 110 ? 'dark' : 'light';
}

type Props = {
  onClose: () => void;
  /** Cor base da superfície da folha (hex). */
  surface: string;
  /** Cor do brilho da borda (hex). */
  accent: string;
  /** Fundo da tela atrás da folha (hex) — decide o tom claro/escuro do desfoque. */
  bgForTint: string;
  /** Intensidade do desfoque (0–100). */
  intensity?: number;
  /** Estilo extra do corpo da folha (ex.: paddings específicos). */
  sheetStyle?: ViewStyle;
  children: ReactNode;
};

export function GlassSheet({ onClose, surface, accent, bgForTint, intensity = 60, sheetStyle, children }: Props) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { borderColor: withAlpha(accent, 0.45), backgroundColor: withAlpha(surface, 0.3) }, sheetStyle]}
          onPress={() => {}}>
          <BlurView intensity={intensity} tint={blurTint(bgForTint)} style={[styles.blur, { backgroundColor: withAlpha(surface, 0.45) }]} />
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 28,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1, // borda fina com brilho (accent translúcido) — Liquid Glass
    overflow: 'hidden',
  },
  // Vidro recortado ao topo arredondado (fica atrás do conteúdo).
  blur: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
});
