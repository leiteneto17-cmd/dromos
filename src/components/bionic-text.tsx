/**
 * Bionic Reading: destaca em negrito as primeiras letras de cada palavra para
 * guiar o olho e acelerar a leitura. Ver CLAUDE.md (§2.1).
 *
 * - `BionicParagraph` renderiza UM parágrafo (item ideal para virtualizar numa
 *   FlatList — ver src/app/reader.tsx, §4.6).
 * - `splitParagraphs` divide o texto cru (parágrafos separados por linha em branco).
 * - `BionicText` (compat) renderiza um texto inteiro; use só para textos pequenos.
 *
 * DESTAQUE DE LEITURA: quando o áudio ("Ouvir") está lendo este parágrafo, ele recebe
 * um leve realce de fundo (`activePara` + `activeColor`). Isso muda no máximo 1× por
 * parágrafo → custo desprezível. O karaokê palavra-a-palavra foi removido por pesar
 * demais no render (re-renderizava o parágrafo várias vezes por segundo).
 */
import { memo, useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';

import { cleanWord, splitParagraphs } from '@/services/text-utils';

function boldPrefixLength(word: string, ratio: number): number {
  if (word.length <= 1) return word.length;
  return Math.max(1, Math.ceil(word.length * ratio));
}

type WordPress = (word: string, paragraph: string, paraIndex: number, charOffset: number) => void;

type ParaProps = {
  text: string;
  bionic?: boolean;
  /** Fração das letras de cada palavra que fica em negrito (0–1). */
  ratio?: number;
  color: string;
  fontSize: number;
  lineHeight: number;
  fontFamily?: string;
  marginBottom?: number;
  /** Índice do parágrafo na lista (p/ ações como "ouvir a partir daqui"). */
  paraIndex?: number;
  /** Toque numa palavra → (palavra, parágrafo, índice do parágrafo, offset do caractere). */
  onWordPress?: WordPress;
  /** Palavras do vocabulário (minúsculas) a realçar (marca-texto). */
  markedSet?: Set<string>;
  highlightColor?: string;
  /** Este parágrafo está sendo lido pelo áudio agora → realça o fundo (leitura direcionada). */
  activePara?: boolean;
  /** Cor de fundo do parágrafo em leitura (§2.1). */
  activeColor?: string;
};

type Tok = {
  text: string;
  isSpace: boolean;
  start: number;
  len: number;
  /** Nº de letras em negrito (Bionic) — pré-calculado. */
  bold: number;
  /** Está no banco de vocabulário (marca-texto) — pré-calculado. */
  marked: boolean;
};

/**
 * Uma palavra tocável. Memoizada: só re-renderiza se uma prop sua mudar. Como as props
 * são estáveis para a mesma posição (o `bg` do marca-texto muda raramente), na prática
 * ela quase nunca re-renderiza.
 */
const Word = memo(function Word({
  token,
  bold,
  bg,
  start,
  paraIndex,
  paragraph,
  onWordPress,
}: {
  token: string;
  bold: number;
  bg?: string;
  start: number;
  paraIndex: number;
  paragraph: string;
  onWordPress?: WordPress;
}) {
  return (
    <Text
      suppressHighlighting
      onPress={onWordPress ? () => onWordPress(token, paragraph, paraIndex, start) : undefined}
      style={bg ? { backgroundColor: bg } : undefined}>
      {bold > 0 ? <Text style={styles.bold}>{token.slice(0, bold)}</Text> : null}
      {token.slice(bold)}
    </Text>
  );
});

export const BionicParagraph = memo(function BionicParagraph({
  text,
  bionic = true,
  ratio = 0.4,
  color,
  fontSize,
  lineHeight,
  fontFamily,
  marginBottom,
  paraIndex = 0,
  onWordPress,
  markedSet,
  highlightColor,
  activePara,
  activeColor,
}: ParaProps) {
  // Divisão em palavras + negrito + marca-texto: memoizado → não re-roda à toa.
  const tokens = useMemo<Tok[]>(() => {
    let offset = 0;
    const out: Tok[] = [];
    for (const t of text.split(/(\s+)/)) {
      if (t.length === 0) continue;
      const isSpace = /^\s+$/.test(t);
      out.push({
        text: t,
        isSpace,
        start: offset,
        len: t.length,
        bold: !isSpace && bionic ? boldPrefixLength(t, ratio) : 0,
        marked: !isSpace && !!markedSet && !!highlightColor && markedSet.has(cleanWord(t).toLowerCase()),
      });
      offset += t.length;
    }
    return out;
  }, [text, bionic, ratio, markedSet, highlightColor]);

  const bg = activePara && activeColor ? { backgroundColor: activeColor } : null;

  return (
    <Text style={[{ color, fontSize, lineHeight, fontFamily, marginBottom }, bg]}>
      {tokens.map((tk, i) => {
        if (tk.isSpace) return tk.text;
        return (
          <Word
            key={i}
            token={tk.text}
            bold={tk.bold}
            bg={tk.marked ? highlightColor : undefined}
            start={tk.start}
            paraIndex={paraIndex}
            paragraph={text}
            onWordPress={onWordPress}
          />
        );
      })}
    </Text>
  );
});

export function BionicText({
  text,
  paragraphSpacing = 16,
  ...rest
}: ParaProps & { paragraphSpacing?: number }) {
  const paragraphs = useMemo(() => splitParagraphs(text), [text]);
  return (
    <>
      {paragraphs.map((p, i) => (
        <BionicParagraph key={i} text={p} {...rest} marginBottom={paragraphSpacing} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: '700' },
});
