/**
 * Fábrica de Histórias — formulário lúdico (pills) para montar os "ingredientes" e pedir à
 * IA um conto/fábula/apólogo/parábola curto para a criança. Ao gerar, salva em "Minhas
 * Criações" (store/kids-stories) e abre o leitor de carrossel (/kids-historia).
 *
 * Sem caixa em branco (dá bloqueio): tudo é escolha por botão, com um campo opcional para o
 * pai personalizar o herói (ex.: o nome do filho). Cota mensal é a isca do Premium.
 */
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BrandFont } from '@/constants/theme';
import { ScreenBG } from '@/components/social-ui';
import { useUI } from '@/hooks/use-ui';
import {
  gerarHistoria,
  HERO_PRESETS,
  MORAL_PRESETS,
  SETTING_PRESETS,
  STORY_KINDS,
  type StoryKind,
} from '@/services/ai/story';
import { useAI } from '@/store/ai';
import { canGenerate, remainingThisMonth, useKidsStories } from '@/store/kids-stories';
import { KIDS } from '@/theme/kids';

export default function KidsCriarScreen() {
  const c = useUI();
  const addStory = useKidsStories((s) => s.addStory);
  const registerManagedUse = useKidsStories((s) => s.registerManagedUse);

  const [kind, setKind] = useState<StoryKind>('fabula');
  const [hero, setHero] = useState<string>(HERO_PRESETS[0].label);
  const [customHero, setCustomHero] = useState('');
  const [setting, setSetting] = useState<string>(SETTING_PRESETS[0].label);
  const [moral, setMoral] = useState<string>(MORAL_PRESETS[0].label);
  const [loading, setLoading] = useState(false);

  const restam = remainingThisMonth();
  const kindMeta = STORY_KINDS.find((k) => k.id === kind)!;

  async function criar() {
    const gate = canGenerate();
    if (!gate.ok) {
      Alert.alert('Fábrica de Histórias', gate.reason ?? 'Limite atingido.', [
        { text: 'Agora não', style: 'cancel' },
        ...(gate.offerPremium ? [{ text: 'Ver Premium', onPress: () => router.push('/premium') }] : []),
      ]);
      return;
    }

    const heroFinal = customHero.trim() || hero;
    setLoading(true);
    const res = await gerarHistoria({ kind, hero: heroFinal, setting, moral });
    setLoading(false);

    if (!res.ok) {
      Alert.alert('Não deu para criar', res.error);
      return;
    }
    // Só conta na cota mensal quando usou a IA GERIDA (BYOK é ilimitado).
    if (!useAI.getState().hasKey) registerManagedUse();

    const id = `${Date.now()}`;
    addStory({
      id,
      titulo: res.story.titulo,
      paginas: res.story.paginas,
      createdAt: Date.now(),
      kindLabel: kindMeta.label,
      heroLabel: heroFinal,
      settingLabel: setting,
      moralLabel: moral,
      coverEmoji: kindMeta.emoji,
    });
    router.replace(`/kids-historia?id=${id}` as Href);
  }

  return (
    <ScreenBG>
      <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
        <Text style={[styles.backText, { color: c.textDim }]}>‹ Voltar</Text>
      </Pressable>

      <Text style={[styles.title, { color: c.text }]}>✨ Fábrica de Histórias</Text>
      <Text style={[styles.subtitle, { color: c.textFaint }]}>
        Escolha os ingredientes e a mágica da IA cria uma história só sua.
      </Text>

      <Text style={[styles.remain, { color: restam === Infinity ? KIDS.mint : c.textDim }]}>
        {restam === Infinity ? '✨ Criações ilimitadas (sua chave)' : `Você pode criar mais ${restam} este mês`}
      </Text>

      <Section n="1" label="Que tipo de história?">
        <View style={styles.wrap}>
          {STORY_KINDS.map((k) => (
            <ChoicePill key={k.id} active={kind === k.id} emoji={k.emoji} label={k.label} onPress={() => setKind(k.id)} />
          ))}
        </View>
        <Text style={[styles.hint, { color: c.textFaint }]}>{kindMeta.hint}</Text>
      </Section>

      <Section n="2" label="Quem é o herói?">
        <View style={styles.wrap}>
          {HERO_PRESETS.map((h) => (
            <ChoicePill
              key={h.label}
              active={!customHero.trim() && hero === h.label}
              emoji={h.emoji}
              label={h.label}
              onPress={() => {
                setHero(h.label);
                setCustomHero('');
              }}
            />
          ))}
        </View>
        <TextInput
          value={customHero}
          onChangeText={setCustomHero}
          placeholder="Ou digite: um menino chamado Theo que adora correr…"
          placeholderTextColor={c.textFaint}
          maxLength={60}
          style={[styles.input, { backgroundColor: c.card, borderColor: customHero.trim() ? KIDS.mint : c.border, color: c.text }]}
        />
      </Section>

      <Section n="3" label="Onde acontece?">
        <View style={styles.wrap}>
          {SETTING_PRESETS.map((s) => (
            <ChoicePill key={s.label} active={setting === s.label} emoji={s.emoji} label={s.label} onPress={() => setSetting(s.label)} />
          ))}
        </View>
      </Section>

      <Section n="4" label="Qual é o aprendizado?">
        <View style={styles.wrap}>
          {MORAL_PRESETS.map((m) => (
            <ChoicePill key={m.label} active={moral === m.label} emoji={m.emoji} label={m.label} onPress={() => setMoral(m.label)} />
          ))}
        </View>
      </Section>

      <Pressable onPress={criar} disabled={loading} style={[styles.cta, { opacity: loading ? 0.8 : 1 }]}>
        {loading ? (
          <View style={styles.ctaLoading}>
            <ActivityIndicator color={KIDS.dark} />
            <Text style={styles.ctaText}>Criando a mágica…</Text>
          </View>
        ) : (
          <Text style={styles.ctaText}>✨ Criar minha história</Text>
        )}
      </Pressable>
      <Text style={[styles.safety, { color: c.textFaint }]}>
        🔒 As histórias são sempre feitas para crianças — sem conteúdo assustador ou impróprio.
      </Text>
    </ScreenBG>
  );
}

function Section({ n, label, children }: { n: string; label: string; children: React.ReactNode }) {
  const c = useUI();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={styles.stepDot}>
          <Text style={styles.stepDotText}>{n}</Text>
        </View>
        <Text style={[styles.sectionLabel, { color: c.text }]}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

function ChoicePill({
  active,
  emoji,
  label,
  onPress,
}: {
  active: boolean;
  emoji: string;
  label: string;
  onPress: () => void;
}) {
  const c = useUI();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pill,
        { borderColor: active ? KIDS.mint : 'rgba(185,166,232,0.35)', backgroundColor: active ? 'rgba(124,240,184,0.14)' : c.card },
      ]}>
      <Text style={styles.pillEmoji}>{emoji}</Text>
      <Text style={[styles.pillText, { color: active ? KIDS.mint : c.textDim }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: { paddingVertical: 4, paddingRight: 8, alignSelf: 'flex-start' },
  backText: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 26, fontFamily: BrandFont.extrabold, marginTop: 2 },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  remain: { fontSize: 13, fontWeight: '800', marginTop: 10 },
  section: { marginTop: 22 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: KIDS.from,
    borderWidth: 1.5,
    borderColor: KIDS.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotText: { color: KIDS.ink, fontSize: 12, fontWeight: '900' },
  sectionLabel: { fontSize: 16, fontWeight: '800' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  pillEmoji: { fontSize: 15 },
  pillText: { fontSize: 13, fontWeight: '700' },
  hint: { fontSize: 12, marginTop: 8 },
  input: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, marginTop: 10 },
  cta: {
    marginTop: 28,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: KIDS.mint,
  },
  ctaLoading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ctaText: { fontSize: 16, fontWeight: '900', color: KIDS.dark },
  safety: { fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 14 },
});
