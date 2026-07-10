/**
 * Set de ícones SVG (traço, estilo Feather/Lucide) — substitui os emojis do CHROME
 * da interface (títulos de seção, botões, barras) por um visual limpo e consistente
 * (design system 2026). Os emojis de CONQUISTA continuam como badges coloridos.
 *
 *  - `Icon`      → ícone chato, herda 1 cor (`color`). Para o chrome (17px).
 *  - `BrandIcon` → ícone de DESTAQUE com o gradiente da marca (roxo→verde-neon) e
 *    glow neon. Use em pontos grandes (≥28px) onde o gradiente realmente aparece.
 *
 * Decisões (ver análise no histórico):
 *  - O gradiente usa um `id` ÚNICO por instância (`useId`) — ids duplicados colidem
 *    no react-native-svg (todos apontariam pro mesmo def ou não resolveriam).
 *  - O glow NÃO usa `<filter>`/`feGaussianBlur` (instável no Android — ver
 *    `book-trail.tsx`); é feito EMPILHANDO traços largos translúcidos (confiável).
 */
import { useId } from 'react';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Polyline, Rect, Stop } from 'react-native-svg';

export type IconName =
  | 'star'
  | 'books'
  | 'userPlus'
  | 'target'
  | 'chat'
  | 'flame'
  | 'users'
  | 'fileText'
  | 'info'
  | 'edit'
  | 'medal'
  | 'trophy'
  | 'trendingUp'
  | 'user'
  | 'palette'
  | 'globe'
  | 'sparkles'
  | 'logout';

/** Cores da marca (Dromos) — usadas só no gradiente de destaque dos ícones.
 *  Rebrand claro+azul (GUIA-DE-MARCA v2 §3): azul-escuro → azul do acento
 *  (Tokens.color.light accentPressed → accent). Roxo/verde neon aposentados. */
const BRAND_DEEP = '#2675AE';
const BRAND_ACCENT = '#3A9AD9';

type ShapeOpts = {
  stroke: string;
  strokeWidth: number;
  strokeOpacity?: number;
  /** Preenchimento dos pontinhos (alvo/paleta). 'transparent' p/ a camada de glow. */
  dotFill: string;
};

/** Geometria de cada ícone, parametrizada — reutilizada por `Icon` e `BrandIcon`. */
function shapes(name: IconName, o: ShapeOpts) {
  const p = {
    stroke: o.stroke,
    strokeWidth: o.strokeWidth,
    strokeOpacity: o.strokeOpacity ?? 1,
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const dot = o.dotFill;
  switch (name) {
    case 'star':
      return <Path {...p} d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.4l6-.9z" />;
    case 'sparkles':
      return (
        <>
          <Path {...p} d="M11 3l1.7 4.6L17 9.3l-4.3 1.7L11 15.6 9.3 11 5 9.3l4.3-1.7z" />
          <Line {...p} x1={18} y1={4} x2={18} y2={8} />
          <Line {...p} x1={16} y1={6} x2={20} y2={6} />
        </>
      );
    case 'books':
      return (
        <>
          <Rect {...p} x={4} y={5} width={4} height={15} rx={1} />
          <Rect {...p} x={9.5} y={5} width={4} height={15} rx={1} />
          <Path {...p} d="M15.5 6.5l4 1-2.8 12-4-1z" />
        </>
      );
    case 'user':
      return (
        <>
          <Circle {...p} cx={12} cy={8} r={3.6} />
          <Path {...p} d="M4.5 20c0-4 3.4-6 7.5-6s7.5 2 7.5 6" />
        </>
      );
    case 'users':
      return (
        <>
          <Circle {...p} cx={9} cy={8} r={3.2} />
          <Path {...p} d="M3 20c0-3.5 2.7-5.3 6-5.3s6 1.8 6 5.3" />
          <Path {...p} d="M16 5.2a3.2 3.2 0 0 1 0 6" />
          <Path {...p} d="M17 15c2.6.2 4 2.1 4 5" />
        </>
      );
    case 'userPlus':
      return (
        <>
          <Circle {...p} cx={10} cy={8} r={3.4} />
          <Path {...p} d="M3.5 20c0-3.8 3-5.7 6.5-5.7 1.4 0 2.7.3 3.8.9" />
          <Line {...p} x1={18.5} y1={6} x2={18.5} y2={12} />
          <Line {...p} x1={15.5} y1={9} x2={21.5} y2={9} />
        </>
      );
    case 'target':
      return (
        <>
          <Circle {...p} cx={12} cy={12} r={8.5} />
          <Circle {...p} cx={12} cy={12} r={4.5} />
          <Circle cx={12} cy={12} r={1.4} fill={dot} />
        </>
      );
    case 'chat':
      return <Path {...p} d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9.5L5 20.5V16H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />;
    case 'flame':
      return (
        <Path
          {...p}
          d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"
        />
      );
    case 'fileText':
      return (
        <>
          <Path {...p} d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <Path {...p} d="M14 3v5h5" />
          <Line {...p} x1={9} y1={13} x2={15} y2={13} />
          <Line {...p} x1={9} y1={17} x2={15} y2={17} />
        </>
      );
    case 'info':
      return (
        <>
          <Circle {...p} cx={12} cy={12} r={9} />
          <Line {...p} x1={12} y1={11} x2={12} y2={16.5} />
          <Line {...p} x1={12} y1={7.6} x2={12.01} y2={7.6} />
        </>
      );
    case 'edit':
      return (
        <>
          <Path {...p} d="M12 20h9" />
          <Path {...p} d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4z" />
        </>
      );
    case 'medal':
      return (
        <>
          <Path {...p} d="M8.5 3l3.5 6M15.5 3l-3.5 6" />
          <Circle {...p} cx={12} cy={15} r={5.5} />
          <Path {...p} d="M12 12.7l.9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2L9.1 14.8l2-.3z" />
        </>
      );
    case 'trophy':
      return (
        <>
          <Path {...p} d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <Path {...p} d="M6 4h12v5a6 6 0 0 1-12 0z" />
          <Line {...p} x1={12} y1={15} x2={12} y2={18} />
          <Path {...p} d="M8.5 21h7M9 21c0-2 1-3 3-3s3 1 3 3" />
        </>
      );
    case 'trendingUp':
      return (
        <>
          <Polyline {...p} points="3 17 9 11 13 15 21 7" />
          <Polyline {...p} points="16 7 21 7 21 12" />
        </>
      );
    case 'palette':
      return (
        <>
          <Path {...p} d="M12 3a9 9 0 1 0 0 18 1.8 1.8 0 0 0 1.5-2.8 1.6 1.6 0 0 1 1.3-2.5H17a4 4 0 0 0 4-4A9 9 0 0 0 12 3z" />
          <Circle cx={7.5} cy={11} r={1.1} fill={dot} />
          <Circle cx={10} cy={7.5} r={1.1} fill={dot} />
          <Circle cx={14.5} cy={7.5} r={1.1} fill={dot} />
        </>
      );
    case 'globe':
      return (
        <>
          <Circle {...p} cx={12} cy={12} r={9} />
          <Line {...p} x1={3} y1={12} x2={21} y2={12} />
          <Path {...p} d="M12 3a13 13 0 0 1 0 18a13 13 0 0 1 0-18z" />
        </>
      );
    case 'logout':
      return (
        <>
          <Path {...p} d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <Polyline {...p} points="16 17 21 12 16 7" />
          <Line {...p} x1={21} y1={12} x2={9} y2={12} />
        </>
      );
  }
}

/** Ícone chato do chrome — herda a cor do tema. */
export function Icon({ name, size = 18, color = '#000', strokeWidth = 2 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {shapes(name, { stroke: color, strokeWidth, dotFill: color })}
    </Svg>
  );
}

/**
 * Ícone de DESTAQUE com o gradiente da marca.
 *  - `active` (padrão true): traço com gradiente azul-escuro→azul.
 *    `false`: cai na cor do tema (`color`).
 *  - `glow` foi aposentado no rebrand (guia v2 §6.4) — a prop segue aceita
 *    (compat), mas não desenha halo.
 */
export function BrandIcon({
  name,
  size = 28,
  active = true,
  color = '#9CA3AF',
  glow: _glow = true,
  strokeWidth = 2.2,
}: {
  name: IconName;
  size?: number;
  active?: boolean;
  /** Cor do estado inativo (deve vir do tema). */
  color?: string;
  glow?: boolean;
  strokeWidth?: number;
}) {
  // id único por instância → sem colisão de gradiente entre vários ícones na tela.
  const gid = 'bgrad-' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const stroke = active ? `url(#${gid})` : color;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor={BRAND_DEEP} />
          <Stop offset="1" stopColor={BRAND_ACCENT} />
        </LinearGradient>
      </Defs>
      {shapes(name, { stroke, strokeWidth, dotFill: active ? BRAND_ACCENT : color })}
    </Svg>
  );
}
