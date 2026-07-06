/**
 * Paginômetro — sticker de informação da leitura (estilo Strava/Instagram), usado no viewer
 * de Story. Destaca as PÁGINAS lidas + o tempo, na identidade social (verde neon §2.7).
 * Contido num só lugar para não inflar a tela do story e reusar em cards futuros.
 */
import { StyleSheet, Text, View } from 'react-native';

import { Social } from '@/theme/social';

export function Paginometro({ pages, seconds }: { pages: number | null; seconds: number }) {
  const min = Math.max(1, Math.round((seconds ?? 0) / 60));
  const p = pages ?? 0;
  // Ritmo só quando faz sentido (≥1 página e ≥1 min): minutos por página.
  const pace = p > 0 ? (min / p) : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.stat}>
        <Text style={styles.num}>{min}</Text>
        <Text style={styles.label}>min</Text>
      </View>
      {p > 0 ? (
        <>
          <View style={styles.sep} />
          <View style={styles.stat}>
            <Text style={styles.num}>{p}</Text>
            <Text style={styles.label}>{p === 1 ? 'página' : 'páginas'}</Text>
          </View>
          {pace >= 0.1 ? (
            <>
              <View style={styles.sep} />
              <View style={styles.stat}>
                <Text style={styles.num}>{pace < 10 ? pace.toFixed(1) : Math.round(pace)}</Text>
                <Text style={styles.label}>min/pág</Text>
              </View>
            </>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(124,240,184,0.35)',
    paddingHorizontal: 22,
    paddingVertical: 16,
  },
  stat: { alignItems: 'center', minWidth: 56 },
  num: { color: Social.green, fontSize: 34, fontWeight: '900' },
  label: { color: Social.white, fontSize: 13, marginTop: 2 },
  sep: { width: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.18)' },
});
