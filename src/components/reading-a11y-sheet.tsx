/**
 * Folha de AJUSTES DE LEITURA / ACESSIBILIDADE (IDEIAS-FUTURAS §4 — apoio a Dislexia/TDAH).
 * Abre pelo botão "Aa" no leitor. Controla, com persistência (store `readerPrefs`):
 *  - Leitura Biônica: liga/desliga + intensidade (leve/médio/forte).
 *  - Entrelinha (espaçamento vertical) e Espaço entre letras (apoio a dislexia).
 *  - Preset "Modo Dislexia" (liga tudo de uma vez) e "Padrão".
 *
 * Usa a paleta do LEITOR (sépia/claro/escuro), não a social.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassSheet } from '@/components/glass-sheet';
import type { ReaderPrefs } from '@/store/library';
import type { ReadingPalette } from '@/theme/reading';

type Props = {
  t: ReadingPalette;
  prefs: ReaderPrefs;
  setPrefs: (p: Partial<ReaderPrefs>) => void;
  onClose: () => void;
};

const near = (a: number, b: number) => Math.abs(a - b) < 0.01;

const BIONIC_LEVELS = [
  { label: 'Leve', value: 0.35 },
  { label: 'Médio', value: 0.45 },
  { label: 'Forte', value: 0.55 },
];
const LINE_LEVELS = [
  { label: 'Normal', value: 1.0 },
  { label: 'Ampla', value: 1.2 },
  { label: 'Muito ampla', value: 1.45 },
];
const LETTER_LEVELS = [
  { label: 'Normal', value: 0 },
  { label: 'Médio', value: 0.6 },
  { label: 'Amplo', value: 1.2 },
];

export function ReadingA11ySheet({ t, prefs, setPrefs, onClose }: Props) {
  const Chip = ({ label, active, onPress, dim }: { label: string; active: boolean; onPress: () => void; dim?: boolean }) => (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: active ? t.accent : t.border, backgroundColor: active ? t.accent : 'transparent', opacity: dim ? 0.4 : 1 },
      ]}>
      <Text style={{ color: active ? t.surface : t.text, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );

  return (
    <GlassSheet onClose={onClose} surface={t.surface} accent={t.accent} bgForTint={t.background}>
      <Text style={[styles.title, { color: t.text }]}>Leitura e acessibilidade</Text>

          {/* Bionic */}
          <View style={styles.rowHead}>
            <Text style={[styles.label, { color: t.text }]}>Leitura Biônica</Text>
            <Pressable
              onPress={() => setPrefs({ bionic: !prefs.bionic })}
              style={[styles.toggle, { borderColor: prefs.bionic ? t.accent : t.border, backgroundColor: prefs.bionic ? t.accent : 'transparent' }]}>
              <Text style={{ color: prefs.bionic ? t.surface : t.textSecondary, fontWeight: '700', fontSize: 13 }}>
                {prefs.bionic ? 'Ligada' : 'Desligada'}
              </Text>
            </Pressable>
          </View>
          <Text style={[styles.hint, { color: t.textSecondary }]}>Negrita o início das palavras para guiar o olho.</Text>
          <View style={styles.chipRow}>
            {BIONIC_LEVELS.map((l) => (
              <Chip
                key={l.label}
                label={l.label}
                active={prefs.bionic && near(prefs.bionicRatio, l.value)}
                dim={!prefs.bionic}
                onPress={() => setPrefs({ bionic: true, bionicRatio: l.value })}
              />
            ))}
          </View>

          {/* Entrelinha */}
          <Text style={[styles.label, { color: t.text, marginTop: 18 }]}>Entrelinha</Text>
          <View style={styles.chipRow}>
            {LINE_LEVELS.map((l) => (
              <Chip key={l.label} label={l.label} active={near(prefs.lineSpacing, l.value)} onPress={() => setPrefs({ lineSpacing: l.value })} />
            ))}
          </View>

          {/* Espaço entre letras */}
          <Text style={[styles.label, { color: t.text, marginTop: 18 }]}>Espaço entre letras</Text>
          <View style={styles.chipRow}>
            {LETTER_LEVELS.map((l) => (
              <Chip key={l.label} label={l.label} active={near(prefs.letterSpacing, l.value)} onPress={() => setPrefs({ letterSpacing: l.value })} />
            ))}
          </View>

          {/* Presets */}
          <View style={styles.presetRow}>
            <Pressable
              onPress={() => setPrefs({ bionic: true, bionicRatio: 0.45, lineSpacing: 1.45, letterSpacing: 1.2 })}
              style={[styles.preset, { backgroundColor: t.accent }]}>
              <Text style={{ color: t.surface, fontWeight: '800', fontSize: 14 }}>🧠 Modo Dislexia</Text>
            </Pressable>
            <Pressable
              onPress={() => setPrefs({ bionicRatio: 0.4, lineSpacing: 1.0, letterSpacing: 0 })}
              style={[styles.preset, styles.presetGhost, { borderColor: t.border }]}>
              <Text style={{ color: t.text, fontWeight: '700', fontSize: 14 }}>Padrão</Text>
            </Pressable>
          </View>

      <Pressable onPress={onClose} style={styles.close}>
        <Text style={{ color: t.textSecondary, fontSize: 14 }}>Fechar</Text>
      </Pressable>
    </GlassSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', marginBottom: 16 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 15, fontWeight: '700' },
  hint: { fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 8 },
  toggle: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  presetRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
  preset: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  presetGhost: { borderWidth: 1 },
  close: { marginTop: 18, alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 16 },
});
