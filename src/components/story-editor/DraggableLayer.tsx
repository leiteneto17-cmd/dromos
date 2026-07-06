/**
 * Camada arrastável do editor de story (texto/sticker/música). Pan move, Pinch escala; toque
 * seleciona. Coordenadas guardadas NORMALIZADAS (0..1) — o pai converte no publish. Âncora no
 * CENTRO do conteúdo (medido por onLayout). Só é montado depois do canvas ter tamanho (>0),
 * então os shared values inicializam corretos de uma vez (padrão não-controlado).
 */
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

export type LayerChange = { x: number; y: number; scale: number };

export function DraggableLayer({
  xN,
  yN,
  scale,
  canvasW,
  canvasH,
  selected,
  onSelect,
  onChange,
  children,
}: {
  xN: number;
  yN: number;
  scale: number;
  canvasW: number;
  canvasH: number;
  selected: boolean;
  onSelect: () => void;
  onChange: (u: LayerChange) => void;
  children: ReactNode;
}) {
  const tx = useSharedValue(xN * canvasW);
  const ty = useSharedValue(yN * canvasH);
  const sc = useSharedValue(scale);
  const startTx = useSharedValue(0);
  const startTy = useSharedValue(0);
  const startSc = useSharedValue(scale);
  // Tamanho do conteúdo (para ancorar no centro). Em state React — não em shared value —
  // para não "mutar" um valor imutável no onLayout (regra react-hooks/immutability).
  const [size, setSize] = useState({ w: 0, h: 0 });

  const commit = (nx: number, ny: number, ns: number) => {
    onChange({ x: nx / canvasW, y: ny / canvasH, scale: ns });
  };

  const pan = Gesture.Pan()
    .onStart(() => {
      startTx.value = tx.value;
      startTy.value = ty.value;
    })
    .onUpdate((e) => {
      tx.value = startTx.value + e.translationX;
      ty.value = startTy.value + e.translationY;
    })
    .onEnd(() => {
      runOnJS(commit)(tx.value, ty.value, sc.value);
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startSc.value = sc.value;
    })
    .onUpdate((e) => {
      const next = startSc.value * e.scale;
      sc.value = Math.min(Math.max(next, 0.4), 4);
    })
    .onEnd(() => {
      runOnJS(commit)(tx.value, ty.value, sc.value);
    });

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(onSelect)();
  });

  const gesture = Gesture.Race(tap, Gesture.Simultaneous(pan, pinch));

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: 0,
    top: 0,
    transform: [
      { translateX: tx.value - size.w / 2 },
      { translateY: ty.value - size.h / 2 },
      { scale: sc.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={style}
        onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        <View style={selected ? styles.selected : undefined}>{children}</View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  selected: {
    borderWidth: 1,
    borderColor: 'rgba(124,240,184,0.9)',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 4,
  },
});
