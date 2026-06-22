import { Tabs, TabList, TabTrigger, TabSlot, TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, Text, View, StyleSheet } from 'react-native';

import { useUI } from '@/hooks/use-ui';

/** Barra de abas para a web (NativeTabs é só nativo). Base neutra: inativa roxo, ativa verde. */
export default function AppTabs() {
  const c = useUI();
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <View style={[styles.bar, { backgroundColor: c.bg, borderTopColor: c.border }]}>
          <TabTrigger name="index" href="/" asChild>
            <TabButton>📖 Leitura</TabButton>
          </TabTrigger>
          <TabTrigger name="comunidade" href="/comunidade" asChild>
            <TabButton>👥 Comunidade</TabButton>
          </TabTrigger>
          <TabTrigger name="atividades" href="/atividades" asChild>
            <TabButton>🔥 Atividades</TabButton>
          </TabTrigger>
          <TabTrigger name="perfil" href="/perfil" asChild>
            <TabButton>👤 Perfil</TabButton>
          </TabTrigger>
        </View>
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  const c = useUI();
  return (
    <Pressable {...props} style={styles.btn}>
      <Text style={[styles.label, { color: isFocused ? c.green : c.purple }]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  btn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  label: { fontSize: 14, fontWeight: '700' },
});
