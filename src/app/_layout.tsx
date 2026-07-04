import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/poppins';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, useColorScheme, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { CelebrationOverlay } from '@/components/celebration-overlay';
import { OnboardingOverlay } from '@/components/onboarding-overlay';
import { useUI } from '@/hooks/use-ui';
import { initAds } from '@/services/ads';
import { initPurchases } from '@/services/purchases';
import { setupNotificationHandler } from '@/services/reminders';
import { useAuth } from '@/store/auth';

// Mostra os lembretes de leitura mesmo com o app aberto (no-op no Expo Go).
setupNotificationHandler();

// Inicializa o AdMob + consentimento (tier grátis). No-op no Expo Go; tolera qualquer falha.
void initAds();

/**
 * Pilha raiz com LOGIN OBRIGATÓRIO (decisão do usuário 2026-06-21 — reverte o
 * "login opcional" do CLAUDE.md §6). Todo o app fica atrás de `Stack.Protected`:
 *  - logado (ou sem Supabase configurado, p/ não travar o app): mostra o app inteiro;
 *  - deslogado: só a tela /login (sem como escapar — o guard troca de tela sozinho).
 * Enquanto checa a sessão salva (`initializing`), um BootGate cobre a tela p/ não
 * piscar a tela errada.
 *
 * ⚠️ Risco de loja (Apple 5.1.1(v)/§4.4): exigir conta p/ ler o próprio EPUB pode ser
 * rejeitado. Antes de publicar (Fase 4), avaliar um "continuar como convidado".
 */
function BootGate() {
  const c = useUI();
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: c.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <ActivityIndicator size="large" color={c.green} />
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const initializing = useAuth((s) => s.initializing);
  const user = useAuth((s) => s.user);
  const configured = useAuth((s) => s.configured);

  // Fonte de marca (Poppins — CLAUDE.md §4.5: empacotada, não do sistema). Se falhar,
  // o app segue com o fallback (não travar a leitura por causa de fonte).
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });
  const fontsReady = fontsLoaded || !!fontError;

  // Liberado quando logado. Se o Supabase NÃO estiver configurado, não dá para exigir
  // login (não há backend de auth) → libera para não deixar o app inacessível.
  const allowed = !!user || !configured;

  // Assinatura (RevenueCat): inicializa quando o usuário LOGA — a assinatura fica
  // amarrada à conta (appUserID = id do Supabase), não ao aparelho. No-op no Expo Go
  // ou sem a chave em app.json (extra.revenueCat*Key).
  useEffect(() => {
    if (user) void initPurchases();
  }, [user]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={allowed}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="reader" />
          <Stack.Screen name="estatisticas" />
          <Stack.Screen name="explorar" />
          <Stack.Screen name="compartilhar" />
          <Stack.Screen name="conquistas" />
          <Stack.Screen name="premium" />
          <Stack.Screen name="livro" />
          <Stack.Screen name="usuario" />
          <Stack.Screen name="seguidores" />
          <Stack.Screen name="notificacoes" />
          <Stack.Screen name="integracoes" />
        </Stack.Protected>
        <Stack.Protected guard={!allowed}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
      <CelebrationOverlay />
      <OnboardingOverlay />
      {initializing || !fontsReady ? <BootGate /> : null}
    </ThemeProvider>
  );
}
