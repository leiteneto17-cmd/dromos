/**
 * Capa de um livro de CATÁLOGO (Comunidade/Explorar) com FALLBACK elegante.
 *
 * Diferente do `BookCover` (livro LOCAL já importado, que mostra o FORMATO no fallback),
 * aqui o livro é remoto e muitos títulos vêm SEM capa (Google Books / Open Library /
 * trending). O placeholder antigo era um emoji 📘 solto — feio e sem informação. Em vez
 * disso desenhamos uma "capa de tipografia": gradiente roxo da identidade social (§2.7) +
 * o TÍTULO (e autor), no espírito das capas geradas do Spotify.
 *
 *  - `uri` presente → imagem real (expo-image, cache/transição).
 *  - sem `uri` → capa tipográfica. Em tamanhos pequenos (width < 70) o texto fica ilegível,
 *    então mostramos só o glifo 📖 sobre o gradiente.
 */
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text } from 'react-native';

/** Gradientes da capa tipográfica — variedade dentro da mesma família roxo (§2.7). */
const GRADIENTS: [string, string][] = [
  ['#3B2A63', '#1B1530'],
  ['#2E2147', '#14121C'],
  ['#3A2558', '#191225'],
  ['#2B2350', '#12101B'],
];

/** Gradiente estável a partir do título (o mesmo livro sempre recebe a mesma cor). */
function gradientFor(title: string): [string, string] {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

export function CatalogCover({
  uri,
  title,
  author,
  width,
  height,
  radius = 6,
}: {
  uri?: string | null;
  title: string;
  author?: string | null;
  width: number;
  height: number;
  radius?: number;
}) {
  const dim = { width, height, borderRadius: radius };

  if (uri) {
    return <Image source={{ uri }} style={[styles.img, dim]} contentFit="cover" transition={150} />;
  }

  const [from, to] = gradientFor(title || '?');
  const showText = width >= 70;

  return (
    <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.fallback, dim]}>
      {showText ? (
        <>
          <Text style={styles.spine}>📖</Text>
          <Text style={styles.title} numberOfLines={4}>
            {title}
          </Text>
          {author ? (
            <Text style={styles.author} numberOfLines={1}>
              {author}
            </Text>
          ) : null}
        </>
      ) : (
        <Text style={styles.glyph}>📖</Text>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  img: { backgroundColor: '#1B1530' },
  fallback: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(185,166,232,0.22)', // lavanda translúcida (§2.7)
  },
  spine: { fontSize: 16, marginBottom: 6, opacity: 0.9 },
  title: { color: '#EDEAF5', fontSize: 12, fontWeight: '800', textAlign: 'center', lineHeight: 15 },
  author: { color: '#B9A6E8', fontSize: 10, fontWeight: '600', textAlign: 'center', marginTop: 4 },
  glyph: { fontSize: 22 },
});
