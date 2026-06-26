/**
 * Micro-interação base (frente A — casca premium): um Pressable que "afunda" um
 * pouco e clareia ao toque, voltando com mola. Dá a sensação tátil dos apps
 * premium sem custo de render — usa o `Animated` nativo (native driver, sem
 * worklet), seguro no Expo Go e em qualquer aparelho.
 *
 * Anima o próprio Pressable (createAnimatedComponent) — não adiciona nó extra de
 * layout, então `style` passa direto e pode substituir `<Pressable>` em qualquer
 * lugar (CTAs, cards, células) sem mexer no layout. `scaleTo`/`dimTo` ajustam a
 * intensidade; respeita "Reduzir movimento" do sistema (§4.7).
 */
import { useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, Animated, Pressable, type PressableProps } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = PressableProps & {
  /** Quanto encolhe no toque (0..1). Padrão 0.96. */
  scaleTo?: number;
  /** Opacidade no toque. Padrão 0.9. */
  dimTo?: number;
};

export function PressableScale({
  scaleTo = 0.96,
  dimTo = 0.9,
  style,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  // Acessibilidade (§4.7): se "Reduzir movimento" estiver ligado, não animamos a escala.
  const reduceMotion = useRef(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => {
      if (alive) reduceMotion.current = v;
    });
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => {
      reduceMotion.current = v;
    });
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);

  const animateTo = (toScale: number, toOpacity: number) => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: reduceMotion.current ? 1 : toScale,
        useNativeDriver: true,
        speed: 40,
        bounciness: 6,
      }),
      Animated.timing(opacity, { toValue: toOpacity, duration: 90, useNativeDriver: true }),
    ]).start();
  };

  // `style` pode ser função (estado de press do Pressable) — preservamos isso e só
  // injetamos o transform/opacity animados por cima.
  const animatedStyle = useMemo(() => ({ transform: [{ scale }], opacity }), [scale, opacity]);

  return (
    <AnimatedPressable
      {...rest}
      style={
        typeof style === 'function'
          ? (state) => [style(state), animatedStyle]
          : [style, animatedStyle]
      }
      onPressIn={(e) => {
        animateTo(scaleTo, dimTo);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animateTo(1, 1);
        onPressOut?.(e);
      }}>
      {children}
    </AnimatedPressable>
  );
}
