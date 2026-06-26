/**
 * "Trilha do livro" — o equivalente ao MAPA DO TRAJETO do Strava (CLAUDE.md §2.6/§2.7):
 * uma rota verde brilhante com nós (capítulos/progresso), ícone de livro no início e
 * uma xícara de café, com o rótulo "Maratona do Clássico". O brilho (glow) é simulado
 * empilhando o mesmo traço em larguras decrescentes (filtros SVG não são confiáveis
 * em todas as plataformas).
 */
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { Social } from '@/theme/social';

const ROUTE =
  'M62,150 C52,112 86,82 116,92 C138,99 138,72 160,70 C188,67 196,98 178,124 ' +
  'C206,122 234,116 240,146 C245,172 214,182 198,170 C210,200 192,226 166,214 ' +
  'C150,208 150,230 128,226 C98,221 108,186 132,182 C102,182 80,186 82,160';

/** Nó (losango verde com brilho) em (x,y). */
function Node({ x, y, size = 16 }: { x: number; y: number; size?: number }) {
  return (
    <>
      <Rect
        x={x - size / 2}
        y={y - size / 2}
        width={size}
        height={size}
        rx={4}
        transform={`rotate(45 ${x} ${y})`}
        fill={Social.green}
        opacity={0.25}
      />
      <Rect
        x={x - size / 2 + 3}
        y={y - size / 2 + 3}
        width={size - 6}
        height={size - 6}
        rx={3}
        transform={`rotate(45 ${x} ${y})`}
        fill={Social.green}
      />
    </>
  );
}

export function BookTrail({ label = 'Maratona do Clássico' }: { label?: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.canvas}>
        <Svg viewBox="0 0 300 250" width="100%" height="100%">
          {/* glow (traços largos e translúcidos) → linha brilhante fina por cima */}
          <Path d={ROUTE} stroke={Social.green} strokeWidth={16} opacity={0.12} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Path d={ROUTE} stroke={Social.green} strokeWidth={9} opacity={0.28} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Path d={ROUTE} stroke={Social.green} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Node x={178} y={124} size={18} />
          <Node x={240} y={146} />
          <Node x={198} y={170} />
          <Node x={132} y={182} />
        </Svg>

        {/* ícones de início/fim sobre a rota (emoji é mais simples que desenhar no SVG) */}
        <Text style={[styles.emoji, styles.book]}>📗</Text>
        <Text style={[styles.emoji, styles.coffee]}>☕</Text>
      </View>

      {/* rótulo como LEGENDA abaixo da trilha (não mais por cima da linha) */}
      <Text style={styles.label} numberOfLines={1}>
        🏁 {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center' },
  canvas: { width: '100%', aspectRatio: 300 / 250 },
  emoji: { position: 'absolute', fontSize: 22 },
  book: { left: '17%', top: '44%' },
  coffee: { left: '60%', top: '83%' },
  label: {
    marginTop: 8,
    color: Social.lavender,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
});
