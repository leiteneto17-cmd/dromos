/**
 * Anel de progresso (SVG) — o "72% concluída" do card de meta do Perfil.
 * Traço grosso arredondado sobre trilha clara, começa no topo (12h), sentido horário.
 * Reutilizável: cor/tamanho/conteúdo central por prop (crianças viram o miolo).
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export function ProgressRing({
  size = 132,
  strokeWidth = 12,
  progress,
  color,
  trackColor,
  children,
}: {
  size?: number;
  strokeWidth?: number;
  /** 0..1 */
  progress: number;
  color: string;
  trackColor: string;
  /** Conteúdo central (ex.: "72%\nconcluída"). */
  children?: ReactNode;
}) {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cx} r={r} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={cx}
          cy={cx}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={circ * (1 - pct)}
          // gira -90° p/ o progresso começar no topo
          transform={`rotate(-90 ${cx} ${cx})`}
        />
      </Svg>
      <View style={s.center}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
