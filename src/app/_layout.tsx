import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import { ActivityIndicator, useColorScheme, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { CelebrationOverlay } from '@/components/celebration-overlay';
import { OnboardingOverlay } from '@/components/onboarding-overlay';
import { useUI } from '@/hooks/use-ui';
import { setupNotificationHandler } from '@/services/reminders';
import { useAuth } from '@/store/auth';

// Mostra os lembretes de leitura mesmo com o app aberto (no-op no Expo Go).
setupNotificationHandler();

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

  // Liberado quando logado. Se o Supabase NÃO estiver configurado, não dá para exigir
  // login (não há backend de auth) → libera para não deixar o app inacessível.
  const allowed = !!user || !configured;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={allowed}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="reader" />
          <Stack.Screen name="biblioteca" />
          <Stack.Screen name="explorar" />
          <Stack.Screen name="compartilhar" />
          <Stack.Screen name="conquistas" />
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
      {initializing ? <BootGate /> : null}
    </ThemeProvider>
  );
}
