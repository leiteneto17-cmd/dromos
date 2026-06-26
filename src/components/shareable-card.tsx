/**
 * Card COMPARTILHÁVEL (Fase 5a) — segue o mockup aprovado (CLAUDE.md §2.6/§2.7):
 * centralizado, roxo+verde, com a "trilha do livro" e o logo +leitura. É a View
 * capturada como imagem (react-native-view-shot) para postar nos Stories/redes.
 *
 * Modelos (o usuário desliza no carrossel, igual ao Strava):
 *  - 'escuro'      → fundo gradiente + trilha do livro (como o mockup)
 *  - 'transparente'→ SEM fundo → vira sticker por cima da foto/Story
 *  - 'compacto'    → gradiente, só os números (sem trilha)
 *  - 'capa'        → as stats SOBRE a capa do livro (com véu escuro p/ legibilidade)
 *  - 'foto'        → as stats SOBRE uma foto do usuário (escolhida na tela)
 *  - 'citacao'     → um trecho MARCADO pelo usuário + título do livro (não os números)
 */
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { BookTrail } from '@/components/book-trail';
import { deriveStats, fmtHMS } from '@/services/progress';
import { cleanSnippet } from '@/services/text-utils';
import { Social, SocialGradient } from '@/theme/social';
import { useLibrary, type ReadingSession } from '@/store/library';

export type CardVariant = 'escuro' | 'transparente' | 'compacto' | 'capa' | 'foto' | 'citacao';

export const CARD_VARIANTS: { id: CardVariant; label: string }[] = [
  { id: 'escuro', label: 'Escuro' },
  { id: 'transparente', label: 'Transparente' },
  { id: 'compacto', label: 'Compacto' },
  { id: 'capa', label: 'Sobre a capa' },
  { id: 'foto', label: 'Sobre sua foto' },
  { id: 'citacao', label: 'Citação' },
];

/** Véu escuro (de cima translúcido p/ baixo escuro) sobre imagem de fundo → texto legível. */
const SCRIM = ['rgba(14,11,22,0.30)', 'rgba(14,11,22,0.72)', 'rgba(14,11,22,0.90)'] as const;

/** Duração curta p/ o card: "1h 05m", "29m 30s" ou "45s". */
function fmtDuration(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = Math.floor(total % 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

export function ShareableCard({
  variant,
  session,
  photoUri,
}: {
  variant: CardVariant;
  /** Se vier, o card mostra ESTA sessão (estilo Strava); senão, o resumo geral. */
  session?: ReadingSession;
  /** Foto escolhida pelo usuário (variante 'foto'). */
  photoUri?: string;
}) {
  const bookList = useLibrary((s) => s.books);
  const currentBookId = useLibrary((s) => s.currentBookId);
  const bookmarks = useLibrary((s) => s.bookmarks);
  const highlights = useLibrary((s) => s.highlights);
  const stats = useLibrary((s) => s.stats);
  const d = deriveStats(stats);

  const books = bookList.length;

  // Livro de referência p/ capa e citação: o da sessão, senão o livro atual.
  const refBookId = session?.bookId ?? currentBookId ?? null;
  const refBook = refBookId ? bookList.find((b) => b.id === refBookId) : undefined;
  const refTitle = session?.bookTitle ?? refBook?.title ?? refBook?.name;
  // Citação: prefere o GRIFO escolhido pelo usuário (trecho exato); se não houver, cai
  // no trecho do marcador mais recente. `assumeCut` remenda marcadores antigos (90 chars).
  const hlText = refBookId ? highlights[refBookId]?.[0]?.text : undefined;
  const rawQuote = refBookId ? bookmarks[refBookId]?.[0]?.snippet : undefined;
  const quote = hlText
    ? cleanSnippet(hlText, 300)
    : rawQuote
      ? cleanSnippet(rawQuote, 180, true)
      : undefined;

  // Trilha só no 'escuro' (sobre imagem competiria com a foto/capa; no compacto não cabe).
  const showTrail = variant === 'escuro';

  // ---- Card de UMA sessão (livro, tempo, páginas, ritmo) ----
  const sessionContent = session ? (
    <>
      <Text style={s.kicker}>Sessão de leitura 📖</Text>
      <Text style={s.bookTitle} numberOfLines={2}>
        {session.bookTitle}
      </Text>

      <View style={s.metaRow}>
        <Text style={s.meta}>
          <Text style={s.metaNum}>{Math.max(1, Math.round(session.seconds / 60))}</Text> min
        </Text>
        {session.pages > 0 ? (
          <Text style={s.meta}>
            <Text style={s.metaNum}>{session.pages}</Text> {session.pages === 1 ? 'pág' : 'págs'}
          </Text>
        ) : null}
      </View>

      {session.pages > 0 ? (
        <>
          <Text style={s.section}>Ritmo</Text>
          <Text style={s.label}>Tempo por página</Text>
          <Text style={s.value}>
            {(session.seconds / 60 / session.pages).toFixed(1).replace('.', ',')}m{' '}
            <Text style={s.unit}>/pág</Text>
          </Text>
        </>
      ) : null}

      <Text style={s.section}>Tempo de leitura</Text>
      <Text style={s.value}>{fmtDuration(session.seconds)}</Text>

      {showTrail ? (
        <View style={s.trail}>
          <BookTrail />
        </View>
      ) : null}

      <Text style={s.logo}>✦ +leitura</Text>
    </>
  ) : null;

  // ---- Card do RESUMO geral (acumulado) ----
  const generalContent = (
    <>
      <Text style={s.kicker}>Progresso 🔄 ⏱️</Text>
      <Text style={s.bigTitle}>Minha Leitura</Text>

      <View style={s.metaRow}>
        <Text style={s.meta}>
          <Text style={s.metaNum}>{books}</Text> {books === 1 ? 'livro' : 'livros'}
        </Text>
        <Text style={s.meta}>
          <Text style={s.metaNum}>{d.activeDays}</Text> {d.activeDays === 1 ? 'dia' : 'dias'}
        </Text>
      </View>

      <Text style={s.section}>Consistência</Text>
      <Text style={s.label}>Média de Leitura</Text>
      <Text style={s.value}>
        {d.avgMinPerDay}m <Text style={s.unit}>/dia</Text>
      </Text>

      <Text style={s.section}>Dedicado</Text>
      <Text style={s.label}>Tempo Total de Leitura</Text>
      <Text style={s.value}>{fmtHMS(d.totalSeconds)}</Text>

      {showTrail ? (
        <View style={s.trail}>
          <BookTrail />
        </View>
      ) : (
        <View style={s.streakBox}>
          <Text style={s.streak}>
            🔥 {d.streak} {d.streak === 1 ? 'dia seguido' : 'dias seguidos'} · Nível {d.level}
          </Text>
        </View>
      )}

      <Text style={s.logo}>✦ +leitura</Text>
    </>
  );

  // ---- Card de CITAÇÃO (trecho marcado + título do livro) ----
  const quoteContent = (
    <>
      <Text style={s.quoteMark}>“</Text>
      {quote ? (
        <Text style={s.quoteText} numberOfLines={8}>
          {quote}
        </Text>
      ) : (
        <Text style={s.quoteEmpty}>
          Grife um trecho no leitor (toque numa{'\n'}palavra → ✎ Grifar) para criar a citação.
        </Text>
      )}
      {refTitle ? (
        <Text style={s.quoteSource} numberOfLines={2}>
          — {refTitle}
        </Text>
      ) : null}
      <Text style={s.logo}>✦ +leitura</Text>
    </>
  );

  const content = variant === 'citacao' ? quoteContent : sessionContent ?? generalContent;

  if (variant === 'transparente') {
    // Fundo transparente → o PNG capturado fica sem fundo (sticker p/ Story).
    return <View style={[s.card, s.transparent]}>{content}</View>;
  }

  // Variantes com imagem de fundo (capa do livro / foto do usuário) + véu escuro.
  const bgUri = variant === 'capa' ? refBook?.coverUrl : variant === 'foto' ? photoUri : undefined;
  if ((variant === 'capa' || variant === 'foto') && bgUri) {
    return (
      <View style={s.card}>
        <Image source={{ uri: bgUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={SCRIM} style={StyleSheet.absoluteFill} />
        {content}
      </View>
    );
  }

  // capa/foto sem imagem disponível → cai no gradiente (com aviso amigável no rodapé).
  return (
    <LinearGradient colors={SocialGradient} style={s.card}>
      {content}
      {variant === 'capa' && !bgUri ? (
        <Text style={s.hint}>Este livro ainda não tem capa.</Text>
      ) : null}
      {variant === 'foto' && !bgUri ? (
        <Text style={s.hint}>Toque em “Escolher foto” abaixo.</Text>
      ) : null}
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  card: {
    // Altura dirigida pelo conteúdo (não cortar nada). Largura vem do slot no carrossel.
    width: '100%',
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 26,
    alignItems: 'center',
    overflow: 'hidden',
  },
  transparent: { backgroundColor: 'transparent' },
  kicker: { color: Social.lavender, fontSize: 15, letterSpacing: 1, fontWeight: '600' },
  bigTitle: {
    color: Social.green,
    fontSize: 38,
    fontWeight: '900',
    textShadowColor: Social.green,
    textShadowRadius: 16,
    marginTop: 2,
  },
  bookTitle: {
    color: Social.green,
    fontSize: 25,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: Social.green,
    textShadowRadius: 14,
    marginTop: 2,
  },
  metaRow: { flexDirection: 'row', gap: 22, marginTop: 4 },
  meta: { color: Social.white, fontSize: 18 },
  metaNum: { color: Social.green, fontWeight: '800' },
  section: { color: Social.lavender, fontSize: 17, marginTop: 22 },
  label: { color: Social.white, fontSize: 18, marginTop: 2 },
  value: {
    color: Social.green,
    fontSize: 32,
    fontWeight: '800',
    marginTop: 2,
    textShadowColor: Social.green,
    textShadowRadius: 12,
  },
  unit: { color: Social.white, fontSize: 18, fontWeight: '400' },
  trail: { width: '78%', marginTop: 14 },
  streakBox: { marginTop: 24, borderWidth: 1, borderColor: Social.lavender, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  streak: { color: Social.lavender, fontSize: 14, fontWeight: '700' },
  logo: {
    color: Social.green,
    fontSize: 26,
    fontWeight: '900',
    marginTop: 18,
    textShadowColor: Social.green,
    textShadowRadius: 12,
  },
  hint: { color: Social.muted, fontSize: 13, marginTop: 12, textAlign: 'center' },
  // ---- Citação ----
  quoteMark: {
    color: Social.green,
    fontSize: 70,
    lineHeight: 70,
    fontWeight: '900',
    textShadowColor: Social.green,
    textShadowRadius: 16,
  },
  quoteText: {
    color: Social.white,
    fontSize: 22,
    lineHeight: 31,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: -8,
  },
  quoteEmpty: { color: Social.lavender, fontSize: 17, lineHeight: 24, textAlign: 'center', marginTop: -4 },
  quoteSource: { color: Social.lavender, fontSize: 16, fontWeight: '700', textAlign: 'center', marginTop: 18 },
});
