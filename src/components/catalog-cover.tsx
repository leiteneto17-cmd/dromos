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

/** Gradientes da capa tipográfica — tons CLAROS (rebrand 2026-07-06): azul/neutro suave,
 * variando um pouco por título. Antes eram roxos escuros (viravam "buracos" no tema claro). */
const GRADIENTS: [string, string][] = [
  ['#EAF2FB', '#D7E6F5'],
  ['#F1F2F4', '#E1E4E9'],
  ['#EAF0F6', '#DCE4EE'],
  ['#EFEDF7', '#DFDCEC'],
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
  img: { backgroundColor: '#E5E7EB' },
  fallback: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(42,44,51,0.10)', // borda neutra suave (tema claro)
  },
  spine: { fontSize: 16, marginBottom: 6, opacity: 0.6 },
  title: { color: '#2A2C33', fontSize: 12, fontWeight: '800', textAlign: 'center', lineHeight: 15 },
  author: { color: '#6B7280', fontSize: 10, fontWeight: '600', textAlign: 'center', marginTop: 4 },
  glyph: { fontSize: 22 },
});
