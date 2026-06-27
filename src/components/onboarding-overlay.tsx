/**
 * Boas-vindas + TUTORIAL OPCIONAL no primeiro acesso (pós-login). Aparece uma única vez
 * (flag `onboarding:v1:seen` no AsyncStorage). O usuário escolhe fazer o tour rápido das
 * principais funções ou pular. Identidade ROXO+VERDE da camada social (§2.7).
 *
 * Montado na raiz (_layout.tsx). Só mostra com usuário logado — nunca sobre a tela de login.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandIcon } from '@/components/icon';
import { useAuth } from '@/store/auth';
import { Social, SocialGradient } from '@/theme/social';

const SEEN_KEY = 'onboarding:v1:seen';

/** Slides do tour — as funções que mais importam pra ativar o usuário. */
const SLIDES: { icon: string; title: string; body: string }[] = [
  {
    icon: '📖',
    title: 'Leitura ativa',
    body: 'Importe seus EPUB e PDF e leia com Bionic Reading — as primeiras letras em negrito guiam seu olho e aceleram a leitura.',
  },
  {
    icon: '✨',
    title: 'Dicionário com IA',
    body: 'Tocou numa palavra difícil? A IA explica o significado naquele contexto e guarda no seu banco de vocabulário.',
  },
  {
    icon: '🎯',
    title: 'Metas & Coach',
    body: 'Diga seu objetivo e o Coach de IA monta um plano sob medida pro seu ritmo, ajustando conforme você lê.',
  },
  {
    icon: '🏆',
    title: 'Conquistas & comunidade',
    body: 'Cada sessão vira uma atividade: ganhe emblemas, siga leitores, troque Logos 📜 e compartilhe seu progresso.',
  },
];

export function OnboardingOverlay() {
  const user = useAuth((s) => s.user);
  // 'loading' até saber se já viu; 'hidden' = não mostra; 'welcome'/'tour' = visível.
  const [phase, setPhase] = useState<'loading' | 'hidden' | 'welcome' | 'tour'>('loading');
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!user) {
      setPhase('hidden'); // sem login → nunca aparece (não sobrepõe a tela de login)
      return;
    }
    let alive = true;
    AsyncStorage.getItem(SEEN_KEY).then((v) => {
      if (alive) setPhase(v ? 'hidden' : 'welcome');
    });
    return () => {
      alive = false;
    };
  }, [user]);

  const finish = useCallback(() => {
    AsyncStorage.setItem(SEEN_KEY, '1').catch(() => {});
    setPhase('hidden');
    setStep(0);
  }, []);

  if (phase !== 'welcome' && phase !== 'tour') return null;

  const isWelcome = phase === 'welcome';
  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={finish}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <LinearGradient colors={SocialGradient} style={StyleSheet.absoluteFill} />

          {/* "Pular" sempre disponível (tutorial é opcional) */}
          <Pressable onPress={finish} hitSlop={10} style={styles.skip} accessibilityRole="button">
            <Text style={styles.skipText}>Pular</Text>
          </Pressable>

          {isWelcome ? (
            <View style={styles.body}>
              <BrandIcon name="books" size={64} strokeWidth={2} />
              <Text style={styles.kicker}>Bem-vindo ao Dromos (+Leitura)</Text>
              <Text style={styles.title}>Ler mais — e melhor.</Text>
              <Text style={styles.text}>
                Um leitor que te ajuda a aprender de verdade: leitura guiada, IA no contexto, metas e uma
                comunidade de leitores. Quer um tour rápido pelas principais funções?
              </Text>
              <Pressable onPress={() => setPhase('tour')} style={styles.primaryBtn} accessibilityRole="button">
                <Text style={styles.primaryText}>Fazer o tour rápido</Text>
              </Pressable>
              <Pressable onPress={finish} style={styles.ghostBtn} accessibilityRole="button">
                <Text style={styles.ghostText}>Agora não</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.body}>
              <Text style={styles.slideIcon}>{slide.icon}</Text>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.text}>{slide.body}</Text>

              {/* Indicador de passos */}
              <View style={styles.dots}>
                {SLIDES.map((_, i) => (
                  <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
                ))}
              </View>

              <Pressable
                onPress={() => (isLast ? finish() : setStep((s) => s + 1))}
                style={styles.primaryBtn}
                accessibilityRole="button">
                <Text style={styles.primaryText}>{isLast ? 'Começar a ler' : 'Próximo'}</Text>
              </Pressable>
              {step > 0 ? (
                <Pressable onPress={() => setStep((s) => s - 1)} style={styles.ghostBtn} accessibilityRole="button">
                  <Text style={styles.ghostText}>Voltar</Text>
                </Pressable>
              ) : (
                <Pressable onPress={finish} style={styles.ghostBtn} accessibilityRole="button">
                  <Text style={styles.ghostText}>Pular o tour</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000B', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 26,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Social.border,
  },
  skip: { position: 'absolute', top: 14, right: 16, padding: 6, zIndex: 2 },
  skipText: { color: Social.lavender, fontSize: 14, fontWeight: '700' },
  body: { alignItems: 'center' },
  kicker: { color: Social.lavender, fontSize: 13, fontWeight: '700', letterSpacing: 0.5, marginTop: 16 },
  slideIcon: { fontSize: 56, marginBottom: 8 },
  title: { color: Social.white, fontSize: 24, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  text: { color: Social.lavender, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 12 },
  dots: { flexDirection: 'row', gap: 7, marginTop: 22 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Social.border },
  dotActive: { backgroundColor: Social.green, width: 20 },
  primaryBtn: {
    alignSelf: 'stretch',
    marginTop: 24,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: Social.greenDeep,
  },
  primaryText: { color: Social.dark, fontSize: 16, fontWeight: '800' },
  ghostBtn: { marginTop: 10, paddingVertical: 10, alignItems: 'center' },
  ghostText: { color: Social.lavender, fontSize: 14, fontWeight: '700' },
});
