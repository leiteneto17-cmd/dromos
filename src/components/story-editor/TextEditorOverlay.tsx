/**
 * Overlay de texto (estilo Instagram): tela escurecida com um TextInput central. O usuário
 * digita, escolhe cor e o fundo (none/solid/soft) e confirma — vira uma camada flutuante.
 */
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Social } from '@/theme/social';
import { TEXT_COLORS, type LayerBg } from '@/types/story-composition';

const BG_CYCLE: LayerBg[] = ['none', 'soft', 'solid'];
const BG_LABEL: Record<LayerBg, string> = { none: 'Sem fundo', soft: 'Fundo suave', solid: 'Fundo sólido' };

export function TextEditorOverlay({
  visible,
  initial,
  onDone,
  onCancel,
}: {
  visible: boolean;
  initial?: { text: string; color: string; bg: LayerBg };
  onDone: (v: { text: string; color: string; bg: LayerBg }) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial?.text ?? '');
  const [color, setColor] = useState(initial?.color ?? TEXT_COLORS[0]);
  const [bg, setBg] = useState<LayerBg>(initial?.bg ?? 'none');

  function done() {
    if (text.trim()) onDone({ text: text.trim(), color, bg });
    else onCancel();
  }

  const boxStyle = bg === 'solid' ? styles.solid : bg === 'soft' ? styles.soft : undefined;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} onShow={() => { setText(initial?.text ?? ''); setColor(initial?.color ?? TEXT_COLORS[0]); setBg(initial?.bg ?? 'none'); }}>
      <View style={styles.fill}>
        <Pressable style={styles.backdrop} onPress={done} />

        <View style={styles.topRow}>
          <Pressable onPress={() => setBg(BG_CYCLE[(BG_CYCLE.indexOf(bg) + 1) % BG_CYCLE.length])} hitSlop={8}>
            <Text style={styles.bgToggle}>◐ {BG_LABEL[bg]}</Text>
          </Pressable>
          <Pressable onPress={done} hitSlop={8}>
            <Text style={styles.done}>Concluir</Text>
          </Pressable>
        </View>

        <View style={styles.center} pointerEvents="box-none">
          <View style={boxStyle}>
            <TextInput
              value={text}
              onChangeText={setText}
              autoFocus
              multiline
              placeholder="Digite algo…"
              placeholderTextColor="rgba(255,255,255,0.5)"
              style={[styles.input, { color }]}
            />
          </View>
        </View>

        <View style={styles.colors}>
          {TEXT_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              style={[styles.swatch, { backgroundColor: c, borderWidth: color === c ? 3 : 1 }]}
            />
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingTop: 54 },
  bgToggle: { color: Social.white, fontSize: 14, fontWeight: '700' },
  done: { color: Social.green, fontSize: 16, fontWeight: '900' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  input: { fontSize: 28, fontWeight: '800', textAlign: 'center', minWidth: 120 },
  solid: { backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  soft: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  colors: { flexDirection: 'row', justifyContent: 'center', gap: 12, paddingBottom: 40, flexWrap: 'wrap', paddingHorizontal: 20 },
  swatch: { width: 30, height: 30, borderRadius: 15, borderColor: '#FFFFFF' },
});
