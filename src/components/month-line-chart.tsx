/**
 * Gráfico de linha mensal (12 pontos, Jan–Dez) — o "Resumo de atividades" do Perfil.
 * SVG puro (Polyline + Circles), responsivo à largura via onLayout. Linha fina com
 * pontos discretos, sem eixos — igual à referência (leitura rápida de tendência).
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function MonthLineChart({
  values,
  color,
  labelColor,
  height = 64,
}: {
  /** 12 valores (minutos por mês, Jan..Dez). */
  values: number[];
  color: string;
  labelColor: string;
  height?: number;
}) {
  const [width, setWidth] = useState(0);
  const max = Math.max(1, ...values);
  const padX = 10; // p/ o primeiro/último ponto não cortar
  const padY = 6;
  const stepX = values.length > 1 ? (width - padX * 2) / (values.length - 1) : 0;
  const points = values.map((v, i) => ({
    x: padX + i * stepX,
    y: padY + (1 - v / max) * (height - padY * 2),
  }));

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Polyline
            points={points.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color} />
          ))}
        </Svg>
      ) : null}
      <View style={s.labels}>
        {MONTH_LABELS.map((m) => (
          <Text key={m} style={[s.label, { color: labelColor }]}>
            {m}
          </Text>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  label: { fontSize: 10.5 },
});
