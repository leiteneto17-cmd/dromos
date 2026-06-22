/**
 * Tela de login / criar conta (e-mail + senha) sobre o Supabase Auth.
 * LOGIN OBRIGATÓRIO (decisão do usuário 2026-06-21): é a única tela quando deslogado.
 * Não tem "Voltar" (não há app por trás); ao logar, o `Stack.Protected` do _layout
 * troca para o app automaticamente — por isso não navegamos manualmente aqui.
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useUI } from '@/hooks/use-ui';
import { signIn, signUp } from '@/store/auth';

type Mode = 'entrar' | 'criar';

export default function LoginScreen() {
  const c = useUI();
  const [mode, setMode] = useState<Mode>('entrar');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const criar = mode === 'criar';

  async function submit() {
    setError(null);
    setInfo(null);
    if (!email.trim() || !password) {
      setError('Preencha e-mail e senha.');
      return;
    }
    setBusy(true);
    const res = criar ? await signUp(email, password, name) : await signIn(email, password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.ok && 'needsConfirmation' in res && res.needsConfirmation) {
      setInfo('Conta criada! Confirme pelo link enviado ao seu e-mail e depois entre.');
      setMode('entrar');
      return;
    }
    // Logado com sucesso → o Stack.Protected do _layout troca para o app sozinho.
  }

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.body}>
            <Text style={[styles.brand, { color: c.purple }]}>+leitura</Text>
            <Text style={[styles.title, { color: c.text }]}>
              {criar ? 'Criar conta' : 'Entrar'}
            </Text>
            <Text style={[styles.subtitle, { color: c.textFaint }]}>
              {criar
                ? 'Crie sua conta para começar a ler.'
                : 'Entre para acessar sua biblioteca e sua estante.'}
            </Text>

            {criar ? (
              <Field
                label="Nome"
                value={name}
                onChangeText={setName}
                placeholder="Como quer ser chamado"
                autoCapitalize="words"
                c={c}
              />
            ) : null}
            <Field
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              placeholder="voce@exemplo.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              c={c}
            />
            <Field
              label="Senha"
              value={password}
              onChangeText={setPassword}
              placeholder="Mínimo 6 caracteres"
              secureTextEntry
              autoCapitalize="none"
              c={c}
            />

            {error ? <Text style={[styles.error, { color: '#E5484D' }]}>{error}</Text> : null}
            {info ? <Text style={[styles.info, { color: c.green }]}>{info}</Text> : null}

            <Pressable
              onPress={submit}
              disabled={busy}
              style={[styles.cta, { backgroundColor: c.green, opacity: busy ? 0.7 : 1 }]}>
              {busy ? (
                <ActivityIndicator color={c.onGreen} />
              ) : (
                <Text style={[styles.ctaText, { color: c.onGreen }]}>
                  {criar ? 'Criar conta' : 'Entrar'}
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => {
                setMode(criar ? 'entrar' : 'criar');
                setError(null);
                setInfo(null);
              }}
              hitSlop={8}
              style={styles.switch}>
              <Text style={[styles.switchText, { color: c.textDim }]}>
                {criar ? 'Já tem conta? ' : 'Ainda não tem conta? '}
                <Text style={{ color: c.green, fontWeight: '800' }}>
                  {criar ? 'Entrar' : 'Criar conta'}
                </Text>
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function Field({
  label,
  c,
  ...props
}: React.ComponentProps<typeof TextInput> & {
  label: string;
  c: ReturnType<typeof useUI>;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.textDim }]}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={c.textFaint}
        style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  brand: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  title: { fontSize: 30, fontWeight: '800', marginTop: 6 },
  subtitle: { fontSize: 15, marginTop: 6, marginBottom: 24 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  error: { fontSize: 14, marginTop: 2, marginBottom: 4, fontWeight: '600' },
  info: { fontSize: 14, marginTop: 2, marginBottom: 4, fontWeight: '600' },
  cta: { marginTop: 12, borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  ctaText: { fontSize: 16, fontWeight: '800' },
  switch: { marginTop: 18, alignItems: 'center' },
  switchText: { fontSize: 14 },
});
