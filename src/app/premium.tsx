/**
 * Tela de assinatura — "Tornar-se Premium" (CLAUDE.md §6 / [[monetizacao-planos]]).
 *
 * MODELO: Free (com anúncios, só o leitor) × Premium R$ 4,90/mês (tudo, sem anúncios).
 *
 * PAGAMENTO (decisão): assinatura digital DENTRO do app DEVE usar IAP nativo (App Store /
 * Google Play) — regra anti-steering da Apple/Google (§4.2). Unificamos as duas lojas com
 * RevenueCat (Fase 4). Por isso o botão "Assinar" vai disparar a compra da LOJA, não um
 * checkout externo/Pix dentro do app (isso reprovaria na revisão).
 *
 * DIREITOS DO CONSUMIDOR (BR/CDC) exibidos aqui: preço claro, renovação automática, como
 * cancelar (pela loja), direito de arrependimento (7 dias, art. 49 CDC) e links de Termos +
 * Privacidade. A própria loja processa reembolso/cancelamento conforme a política dela.
 *
 * Enquanto o RevenueCat não entra: "Assinar" explica o fluxo e há um atalho de TESTE
 * (simular Premium) para validar o gating dos recursos.
 */
import { router } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useUI } from '@/hooks/use-ui';
import { usePlan } from '@/store/plan';

// TODO: trocar pelos links REAIS quando o site estiver no ar (ver discussão Hostinger).
const TERMS_URL = '';
const PRIVACY_URL = '';

const BENEFITS = [
  ['🚫', 'Sem anúncios', 'Leitura e navegação limpas, sem interrupções.'],
  ['🔊', 'Áudio e vozes', 'Ouça seus livros (vozes do aparelho e premium). Em breve: vozes próprias treinadas.'],
  ['🎯', 'Metas + Coach de IA', 'Crie metas e deixe a IA montar um plano sob medida pro seu ritmo.'],
  ['✨', 'Dicionário contextual por IA', 'Significado da palavra naquele contexto, sinônimos e exemplos.'],
  ['📚', 'Social completo', 'Estante, coleções, feed, Logos 📜, recados e perfil público.'],
  ['☁️', 'Backup e sincronização', 'Suas atividades e estante seguras na nuvem, entre aparelhos.'],
] as const;

export default function PremiumScreen() {
  const c = useUI();
  const plan = usePlan((s) => s.plan);
  const setPlan = usePlan((s) => s.setPlan);
  const isPremium = plan === 'premium';

  function assinar() {
    // Fase 4: aqui entra a compra via RevenueCat (App Store / Google Play).
    Alert.alert(
      'Assinatura pela loja',
      'O pagamento será feito com segurança pela App Store / Google Play (em implementação). ' +
        'Você poderá cancelar quando quiser nas configurações da sua conta na loja.',
      [{ text: 'Entendi' }],
    );
  }

  function abrirLink(url: string, nome: string) {
    if (!url) {
      Alert.alert(nome, 'Documento em finalização — será publicado antes do lançamento.');
      return;
    }
    openBrowserAsync(url);
  }

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.navigate('/'))} hitSlop={10}>
            <Text style={[styles.back, { color: c.green }]}>‹ Voltar</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={[styles.kicker, { color: c.purple }]}>DROMOS PREMIUM</Text>
          <Text style={[styles.title, { color: c.text }]}>Tudo liberado, sem anúncios</Text>
          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: c.green }]}>R$ 4,90</Text>
            <Text style={[styles.per, { color: c.textFaint }]}>/mês</Text>
          </View>

          {isPremium ? (
            <View style={[styles.activeBox, { borderColor: c.green, backgroundColor: c.card }]}>
              <Text style={[styles.activeText, { color: c.green }]}>✓ Premium ativo — aproveite tudo!</Text>
            </View>
          ) : null}

          <View style={styles.benefits}>
            {BENEFITS.map(([icon, t, sub]) => (
              <View key={t} style={[styles.benefitRow, { borderColor: c.border, backgroundColor: c.card }]}>
                <Text style={styles.benefitIcon}>{icon}</Text>
                <View style={styles.flex}>
                  <Text style={[styles.benefitTitle, { color: c.text }]}>{t}</Text>
                  <Text style={[styles.benefitSub, { color: c.textFaint }]}>{sub}</Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={[styles.freeNote, { color: c.textFaint }]}>
            No plano <Text style={{ fontWeight: '800' }}>Grátis</Text> você lê seus próprios EPUB/PDF à vontade
            (com anúncios), com Bionic, temas e estatísticas. Áudio, Metas, Coach e IA são do Premium.
          </Text>

          {!isPremium ? (
            <Pressable onPress={assinar} style={[styles.cta, { backgroundColor: c.green }]}>
              <Text style={[styles.ctaText, { color: c.onGreen }]}>Assinar por R$ 4,90/mês</Text>
            </Pressable>
          ) : null}

          {/* Direitos do consumidor (BR / CDC) — obrigatório ser claro. */}
          <Text style={[styles.legal, { color: c.textFaint }]}>
            Assinatura mensal com <Text style={styles.legalStrong}>renovação automática</Text> pelo valor vigente.
            Cobrança pela App Store / Google Play. <Text style={styles.legalStrong}>Cancele quando quiser</Text> nas
            configurações da sua conta na loja — o acesso continua até o fim do período pago.
            {'\n\n'}
            <Text style={styles.legalStrong}>Direito de arrependimento (art. 49 do CDC):</Text> você pode desistir em
            até 7 dias da contratação e pedir reembolso pela loja.
          </Text>

          <View style={styles.linksRow}>
            <Pressable onPress={() => abrirLink(TERMS_URL, 'Termos de Uso')} hitSlop={6}>
              <Text style={[styles.link, { color: c.purple }]}>Termos de Uso</Text>
            </Pressable>
            <Text style={[styles.linkDot, { color: c.textFaint }]}>·</Text>
            <Pressable onPress={() => abrirLink(PRIVACY_URL, 'Política de Privacidade')} hitSlop={6}>
              <Text style={[styles.link, { color: c.purple }]}>Política de Privacidade</Text>
            </Pressable>
          </View>

          {/* Atalho de TESTE (provisório até o RevenueCat) — flipa o plano p/ validar o gating. */}
          <Pressable
            onPress={() => setPlan(isPremium ? 'free' : 'premium')}
            hitSlop={8}
            style={styles.testBtn}>
            <Text style={[styles.testText, { color: c.textFaint }]}>
              🧪 {isPremium ? 'Voltar ao Grátis (teste)' : 'Simular Premium (teste)'}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 8 },
  back: { fontSize: 16, fontWeight: '700' },
  body: { paddingHorizontal: 20, paddingBottom: 48 },
  kicker: { fontSize: 13, fontWeight: '800', letterSpacing: 1.5, marginTop: 6 },
  title: { fontSize: 28, fontWeight: '800', marginTop: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 14, gap: 4 },
  price: { fontSize: 40, fontWeight: '800' },
  per: { fontSize: 16, fontWeight: '600' },
  activeBox: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 16, alignItems: 'center' },
  activeText: { fontSize: 15, fontWeight: '800' },
  benefits: { gap: 10, marginTop: 22 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: 14, padding: 14 },
  benefitIcon: { fontSize: 24 },
  benefitTitle: { fontSize: 15, fontWeight: '800' },
  benefitSub: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  freeNote: { fontSize: 13, lineHeight: 19, marginTop: 18 },
  cta: { borderRadius: 999, paddingVertical: 16, alignItems: 'center', marginTop: 22 },
  ctaText: { fontSize: 17, fontWeight: '800' },
  legal: { fontSize: 12, lineHeight: 18, marginTop: 20 },
  legalStrong: { fontWeight: '800' },
  linksRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 16 },
  link: { fontSize: 13, fontWeight: '700' },
  linkDot: { fontSize: 13 },
  testBtn: { alignItems: 'center', marginTop: 24 },
  testText: { fontSize: 12, fontWeight: '600' },
});
