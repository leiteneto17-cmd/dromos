/**
 * Cantinho do Estudo — "Clássicos de prova" (ENEM/vestibulares). Prateleira curada
 * de obras de domínio público que caem nas provas ([[proximos-passos]] 2026-07-02:
 * validação do posicionamento "companheiro de estudo"). Cada obra tem:
 *  - 📖 Ler grátis → mesmo download/leitor do Explorar (Gutenberg, PT);
 *  - 🎓 Simulado → questões estilo ENEM geradas por IA (recurso Premium, como as
 *    demais features de IA — grátis vai para /premium).
 * Rota EMPILHADA alcançada pelo Explorar (card no topo).
 */
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AdBanner } from '@/components/ad-banner';
import { BrandFont } from '@/constants/theme';
import { Card, ScreenBG } from '@/components/social-ui';
import { useUI } from '@/hooks/use-ui';
import { downloadCatalogBook } from '@/services/catalog-download';
import { ENEM_BOOKS, enemToCatalogBook, type EnemBook } from '@/services/enem';
import { useIsPremium } from '@/store/plan';

export default function EnemScreen() {
  const c = useUI();
  const isPremium = useIsPremium();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function ler(b: EnemBook) {
    setDownloadingId(b.id);
    try {
      const target = await downloadCatalogBook(enemToCatalogBook(b));
      setDownloadingId(null);
      router.navigate(target);
    } catch (e) {
      setDownloadingId(null);
      Alert.alert('Falha no download', e instanceof Error ? e.message : 'Tente novamente.');
    }
  }

  function simulado(b: EnemBook) {
    // Simulado é IA → recurso Premium (§6), igual dicionário/coach/voz.
    if (!isPremium) {
      router.push('/premium');
      return;
    }
    router.push({ pathname: '/simulado', params: { title: b.title, author: b.author } });
  }

  return (
    <ScreenBG scroll={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
          <Text style={[styles.backText, { color: c.textDim }]}>‹ Voltar</Text>
        </Pressable>
      </View>

      <Text style={[styles.title, { color: c.text }]}>🎓 Clássicos de prova</Text>
      <Text style={[styles.subtitle, { color: c.textFaint }]}>
        Obras que caem no ENEM e nos vestibulares — todas em português, grátis (domínio
        público). Leia no app e teste sua compreensão com um simulado gerado por IA.
      </Text>

      <FlatList
        data={ENEM_BOOKS}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const busy = downloadingId === item.id;
          const cover = `https://www.gutenberg.org/cache/epub/${item.gutenbergId}/pg${item.gutenbergId}.cover.medium.jpg`;
          return (
            <Card style={styles.card}>
              <View style={styles.top}>
                <Image source={{ uri: cover }} style={styles.cover} resizeMode="cover" />
                <View style={styles.topBody}>
                  <Text style={[styles.bookName, { color: c.text }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={[styles.bookSub, { color: c.textFaint }]} numberOfLines={1}>
                    {item.author} · {item.year}
                  </Text>
                  <View style={[styles.movChip, { borderColor: c.purple }]}>
                    <Text style={[styles.movText, { color: c.purple }]}>{item.movement}</Text>
                  </View>
                </View>
              </View>

              <Text style={[styles.noteLabel, { color: c.green }]}>O que as provas cobram</Text>
              <Text style={[styles.note, { color: c.textDim }]}>{item.note}</Text>

              <View style={styles.btnRow}>
                <Pressable
                  onPress={() => ler(item)}
                  disabled={busy}
                  style={[styles.btn, { backgroundColor: c.green, opacity: busy ? 0.7 : 1 }]}>
                  {busy ? (
                    <ActivityIndicator color={c.onGreen} />
                  ) : (
                    <Text style={[styles.btnText, { color: c.onGreen }]}>📖 Ler grátis</Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => simulado(item)}
                  style={[styles.btnOutline, { borderColor: c.purple }]}>
                  <Text style={[styles.btnText, { color: c.purple }]}>
                    🎓 Simulado{isPremium ? '' : ' ✦'}
                  </Text>
                </Pressable>
              </View>
            </Card>
          );
        }}
      />

      {/* Banner do tier grátis — fora do leitor (§2.5). */}
      <AdBanner style={styles.ad} />
    </ScreenBG>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  back: { paddingVertical: 4, paddingRight: 8 },
  backText: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 28, fontFamily: BrandFont.extrabold },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 2, marginBottom: 12 },
  list: { gap: 12, paddingTop: 4, paddingBottom: 24 },
  card: { gap: 8 },
  top: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  cover: { width: 56, height: 80, borderRadius: 6 },
  topBody: { flex: 1, gap: 3 },
  bookName: { fontSize: 16, fontWeight: '700' },
  bookSub: { fontSize: 13 },
  movChip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 3,
  },
  movText: { fontSize: 11, fontWeight: '800' },
  noteLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  note: { fontSize: 13, lineHeight: 19 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutline: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 14, fontWeight: '800' },
  ad: { marginTop: 12 },
});
