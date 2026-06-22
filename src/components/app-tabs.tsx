import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useUI } from '@/hooks/use-ui';

/**
 * Barra de abas nativa (iOS/Android). Base neutra com acento: aba inativa em ROXO,
 * aba ativa em VERDE (CLAUDE.md §2.7). Ícones: SF Symbols no iOS + Material no Android.
 */
export default function AppTabs() {
  const c = useUI();
  return (
    <NativeTabs
      backgroundColor={c.bg}
      indicatorColor={c.cardElevated}
      labelStyle={{ color: c.purple, selected: { color: c.green } }}
      iconColor={c.purple}
      tintColor={c.green}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Leitura</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'book', selected: 'book.fill' }} md="auto_stories" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="comunidade">
        <NativeTabs.Trigger.Label>Comunidade</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.2', selected: 'person.2.fill' }}
          md="groups"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="atividades">
        <NativeTabs.Trigger.Label>Atividades</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'flame', selected: 'flame.fill' }}
          md="local_fire_department"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="perfil">
        <NativeTabs.Trigger.Label>Perfil</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
          md="account_circle"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
