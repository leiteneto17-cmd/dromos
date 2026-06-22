/**
 * Card COMPARTILHÁVEL (Fase 5a) — segue o mockup aprovado (CLAUDE.md §2.6/§2.7):
 * centralizado, roxo+verde, com a "trilha do livro" e o logo +leitura. É a View
 * capturada como imagem (react-native-view-shot) para postar nos Stories/redes.
 *
 * Modelos (o usuário desliza no carrossel, igual ao Strava):
 *  - 'escuro'      → fundo gradiente (como o mockup)
 *  - 'transparente'→ SEM fundo → vira sticker por cima da foto/Story
 *  - 'compacto'    → gradiente, só os números (sem trilha)
 */
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { BookTrail } from '@/components/book-trail';
import { deriveStats, fmtHMS } from '@/services/progress';
import { Social, SocialGradient } from '@/theme/social';
import { useLibrary, type ReadingSession } from '@/store/library';

export type CardVariant = 'escuro' | 'transparente' | 'compacto';

export const CARD_VARIANTS: { id: CardVariant; label: string }[] = [
  { id: 'escuro', label: 'Escuro' },
  { id: 'transparente', label: 'Transparente' },
  { id: 'compacto', label: 'Compacto' },
];

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
}: {
  variant: CardVariant;
  /** Se vier, o card mostra ESTA sessão (estilo Strava); senão, o resumo geral. */
  session?: ReadingSession;
}) {
  const books = useLibrary((s) => s.books.length);
  const stats = useLibrary((s) => s.stats);
  const d = deriveStats(stats);

  const showTrail = variant !== 'compacto';

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

  const content = sessionContent ?? generalContent;

  if (variant === 'transparente') {
    // Fundo transparente → o PNG capturado fica sem fundo (sticker p/ Story).
    return <View style={[s.card, s.transparent]}>{content}</View>;
  }

  return (
    <LinearGradient colors={SocialGradient} style={s.card}>
      {content}
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
});
