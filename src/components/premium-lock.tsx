/**
 * Bloco "recurso Premium" — mostrado no lugar de um recurso pago quando o usuário é grátis
 * (CLAUDE.md §6 / [[monetizacao-planos]]). Leva à tela de assinatura (/premium).
 *
 * Usado em tela cheia (ex.: Metas) dentro de um <ScreenBG>. Não inclui o fundo de propósito,
 * para casar com a pele de quem chama.
 */
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/social-ui';
import { useUI } from '@/hooks/use-ui';

export function PremiumLock({ feature, note }: { feature: string; note?: string }) {
  const c = useUI();
  return (
    <View>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.navigate('/'))} hitSlop={8} style={styles.back}>
        <Text style={[styles.backText, { color: c.textDim }]}>‹ Voltar</Text>
      </Pressable>

      <Card glow style={styles.card}>
        <Text style={styles.lock}>🔒</Text>
        <Text style={[styles.tag, { color: c.green }]}>RECURSO PREMIUM</Text>
        <Text style={[styles.title, { color: c.text }]}>{feature}</Text>
        {note ? <Text style={[styles.note, { color: c.textFaint }]}>{note}</Text> : null}

        <Pressable onPress={() => router.push('/premium')} style={[styles.cta, { backgroundColor: c.green }]}>
          <Text style={[styles.ctaText, { color: c.onGreen }]}>✨ Conhecer o Premium · R$ 4,90/mês</Text>
        </Pressable>
        <Text style={[styles.sub, { color: c.textFaint }]}>
          No plano grátis você lê seus livros à vontade (com anúncios). O Premium libera áudio,
          Metas, Coach de IA e mais — sem anúncios.
        </Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { paddingVertical: 8, paddingRight: 8 },
  backText: { fontSize: 16, fontWeight: '600' },
  card: { alignItems: 'center', marginTop: 24, paddingVertical: 28 },
  lock: { fontSize: 44 },
  tag: { fontSize: 12, fontWeight: '800', letterSpacing: 1, marginTop: 12 },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  note: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 10 },
  cta: { borderRadius: 999, paddingVertical: 14, paddingHorizontal: 22, marginTop: 22, alignSelf: 'stretch', alignItems: 'center' },
  ctaText: { fontSize: 15, fontWeight: '800' },
  sub: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 14 },
});
