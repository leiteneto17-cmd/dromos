/**
 * Paleta ativa da camada social. Resolve 'system' usando o esquema do aparelho;
 * o usuário pode forçar claro/escuro (persistido em src/store/library.ts).
 */
import { useColorScheme } from 'react-native';

import { useLibrary } from '@/store/library';
import { UIThemes, type UIPalette } from '@/theme/ui';

export function useUI(): UIPalette {
  const scheme = useColorScheme();
  const pref = useLibrary((s) => s.uiTheme);
  const resolved = pref === 'system' ? (scheme === 'dark' ? 'dark' : 'light') : pref;
  return UIThemes[resolved];
}
