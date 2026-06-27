/**
 * Tira compacta de emblemas para o PERFIL: mostra só a arte da conquista (sem
 * nome), para 20 emblemas não ocuparem a tela toda. O nome aparece ao TOCAR um
 * emblema (equivalente touch de "passar o dedo por cima") — num rótulo único
 * abaixo da tira, evitando tooltip flutuante por item (que quebra em grade que
 * quebra linha). Toque de novo (ou em outro) alterna a seleção.
 *
 * Usa a arte de `assets/medalhas` via medalImage(id); cai no emoji do catálogo
 * quando ainda não há arte. Cada item tem accessibilityLabel com o nome (VoiceOver/
 * TalkBack — §4.7). O toque ganha o micro-feedback do PressableScale.
 */
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { useUI } from '@/hooks/use-ui';
import { founderAchievement, type Achievement } from '@/services/progress';
import { medalImage } from '@/theme/medals';

export function EmblemStrip({
  achievements,
  founder = false,
}: {
  achievements: Achievement[];
  /** Mostra o brasão de FUNDADOR à frente (primeiros 50 cadastrados, profiles.is_founder). */
  founder?: boolean;
}) {
  const c = useUI();
  const earned = achievements.filter((a) => a.unlocked && a.id !== 'founder');
  const unlocked = founder ? [founderAchievement(), ...earned] : earned;
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = unlocked.find((a) => a.id === activeId);

  if (unlocked.length === 0) {
    return (
      <Text style={[styles.empty, { color: c.textFaint }]}>Leia para desbloquear emblemas 🏅</Text>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {unlocked.map((a) => {
          const img = medalImage(a.id);
          const sel = a.id === activeId;
          return (
            <PressableScale
              key={a.id}
              onPress={() => setActiveId(sel ? null : a.id)}
              accessibilityRole="button"
              accessibilityLabel={`Emblema ${a.title}`}
              style={[
                styles.emblem,
                { borderColor: sel ? c.green : c.border, backgroundColor: c.cardElevated },
                sel && {
                  shadowColor: c.green,
                  shadowOpacity: 0.5,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: 5,
                },
              ]}>
              {img ? (
                <Image source={img} style={styles.img} contentFit="contain" />
              ) : (
                <Text style={styles.fallback}>{a.icon}</Text>
              )}
            </PressableScale>
          );
        })}
      </View>

      {/* Rótulo revelado: nome do emblema tocado, ou a contagem como dica. */}
      <Text style={[styles.label, { color: active ? c.green : c.textFaint }]} numberOfLines={1}>
        {active ? active.title : `${unlocked.length} emblema${unlocked.length === 1 ? '' : 's'} · toque para ver o nome`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emblem: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  img: { width: '100%', height: '100%' },
  fallback: { fontSize: 22 },
  label: { fontSize: 12, fontWeight: '700', marginTop: 8 },
  empty: { fontSize: 13, marginTop: 12 },
});
