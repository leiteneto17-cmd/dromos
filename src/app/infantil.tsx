/**
 * Dromos Kids — "Clássicos Infantis". Seção isolada e afetuosa dentro do Explorar
 * (decisão do usuário 2026-07-06: começar como área robusta no app, não app à parte).
 *
 * Direção visual: o "brilho mágico" no lugar do neon cyberpunk (fadas/estrelas/poções) —
 * gradiente violeta + acento verde, capas GRANDES (a criança escolhe pelos olhos) e um
 * "portão de entrada" por faixa etária. Mesmo download/leitor do Explorar (catalog-download).
 *
 * v1 (seed): 5 títulos de domínio público VERIFICADOS (services/infantil.ts). Cresce pela
 * mesma via curada, sem republicar o app. Camadas futuras (karaokê, gamificação "Caminho da
 * Leitura", tipografia disléxica) ficam para depois — ver a visão do usuário no handoff.
 */
import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AdBanner } from '@/components/ad-banner';
import { CatalogCover } from '@/components/catalog-cover';
import { BrandFont } from '@/constants/theme';
import { ScreenBG } from '@/components/social-ui';
import { useUI } from '@/hooks/use-ui';
import { downloadCatalogBook } from '@/services/catalog-download';
import { AGE_BANDS, KIDS_BOOKS, kidsToCatalogBook, type AgeBand, type KidsBook } from '@/services/infantil';
import { useKidsStories } from '@/store/kids-stories';
import { KIDS as MAGIC } from '@/theme/kids';

const COLS = 2;
const GAP = 14;
const H_PAD = 16; // = paddingHorizontal do ScreenBG
const CARD_W = (Dimensions.get('window').width - H_PAD * 2 - GAP) / COLS;
const COVER_H = Math.round(CARD_W * 1.4);

type BandFilter = AgeBand | 'all';

export default function InfantilScreen() {
  const c = useUI();
  const stories = useKidsStories((s) => s.stories);
  const [band, setBand] = useState<BandFilter>('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const books = useMemo(
    () => (band === 'all' ? KIDS_BOOKS : KIDS_BOOKS.filter((b) => b.ageBands.includes(band))),
    [band],
  );

  async function ler(b: KidsBook) {
    setDownloadingId(b.id);
    try {
      const target = await downloadCatalogBook(kidsToCatalogBook(b));
      setDownloadingId(null);
      router.navigate(target);
    } catch (e) {
      setDownloadingId(null);
      Alert.alert('Falha ao abrir', e instanceof Error ? e.message : 'Tente novamente.');
    }
  }

  return (
    <ScreenBG scroll={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
          <Text style={[styles.backText, { color: c.textDim }]}>‹ Voltar</Text>
        </Pressable>
      </View>

      <Text style={[styles.title, { color: c.text }]}>✨ Dromos Kids</Text>
      <Text style={[styles.subtitle, { color: c.textFaint }]}>
        Clássicos infantis para ler junto — histórias mágicas de domínio público, em
        português e de graça. Escolha pela idade.
      </Text>

      {/* Portão de entrada: faixa etária (filtro suave — "Todas" mostra tudo). */}
      <FlatList
        data={books}
        keyExtractor={(b) => b.id}
        numColumns={COLS}
        columnWrapperStyle={styles.rowWrap}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Fábrica de Histórias — a IA cria um conto sob medida (isca do Premium). */}
            <Pressable onPress={() => router.push('/kids-criar' as Href)} style={styles.factoryCard}>
              <Text style={styles.factoryEmoji}>🪄</Text>
              <View style={styles.factoryBody}>
                <Text style={styles.factoryTitle}>Fábrica de Histórias</Text>
                <Text style={styles.factorySub}>Peça à IA um conto ou fábula só seu</Text>
              </View>
              <Text style={styles.factoryCta}>Criar ›</Text>
            </Pressable>

            {/* Minhas Criações — prateleira das histórias geradas (relê quantas quiser). */}
            {stories.length > 0 ? (
              <>
                <Text style={[styles.shelfHead, { color: MAGIC.violet }]}>📖 Minhas Criações</Text>
                <View style={styles.creationsWrap}>
                  {stories.map((st) => (
                    <Pressable
                      key={st.id}
                      onPress={() => router.push(`/kids-historia?id=${st.id}` as Href)}
                      style={styles.creationChip}>
                      <Text style={styles.creationEmoji}>{st.coverEmoji}</Text>
                      <Text style={[styles.creationTitle, { color: c.text }]} numberOfLines={1}>
                        {st.titulo}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            <View style={styles.bandRow}>
              <BandChip label="Todas" emoji="🌟" active={band === 'all'} onPress={() => setBand('all')} />
              {AGE_BANDS.map((a) => (
                <BandChip
                  key={a.id}
                  label={a.label}
                  emoji={a.emoji}
                  active={band === a.id}
                  onPress={() => setBand(a.id)}
                />
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const busy = downloadingId === item.id;
          const cat = kidsToCatalogBook(item);
          return (
            <Pressable onPress={() => ler(item)} disabled={busy} style={[styles.card, { width: CARD_W }]}>
              {/* Moldura mágica: brilho violeta ao redor da capa grande. */}
              <View style={styles.coverGlow}>
                <CatalogCover
                  uri={cat.coverUrl}
                  title={item.title}
                  author={item.author}
                  width={CARD_W}
                  height={COVER_H}
                  radius={14}
                />
                <View style={styles.emojiBadge}>
                  <Text style={styles.emojiBadgeText}>{item.emoji}</Text>
                </View>
                {busy ? (
                  <View style={styles.busyVeil}>
                    <ActivityIndicator color={MAGIC.mint} />
                  </View>
                ) : null}
              </View>
              <Text style={[styles.bookTitle, { color: c.text }]} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={[styles.bookAuthor, { color: c.textFaint }]} numberOfLines={1}>
                {item.author}
              </Text>
              <Text style={[styles.blurb, { color: c.textDim }]} numberOfLines={3}>
                {item.blurb}
              </Text>
              <View style={styles.readBtn}>
                <Text style={styles.readBtnText}>{busy ? 'Abrindo…' : '📖 Ler'}</Text>
              </View>
            </Pressable>
          );
        }}
      />

      <AdBanner style={styles.ad} />
    </ScreenBG>
  );
}

function BandChip({
  label,
  emoji,
  active,
  onPress,
}: {
  label: string;
  emoji: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.bandChip,
        { borderColor: active ? MAGIC.mint : 'rgba(185,166,232,0.35)', backgroundColor: active ? 'rgba(124,240,184,0.14)' : 'transparent' },
      ]}>
      <Text style={styles.bandEmoji}>{emoji}</Text>
      <Text style={[styles.bandLabel, { color: active ? MAGIC.mint : MAGIC.violet }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  back: { paddingVertical: 4, paddingRight: 8 },
  backText: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 28, fontFamily: BrandFont.extrabold },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 2, marginBottom: 4 },
  list: { paddingTop: 8, paddingBottom: 24 },
  factoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 6,
    marginBottom: 6,
    backgroundColor: MAGIC.from,
    borderWidth: 1.5,
    borderColor: MAGIC.mint,
  },
  factoryEmoji: { fontSize: 26 },
  factoryBody: { flex: 1 },
  factoryTitle: { fontSize: 16, fontWeight: '900', color: MAGIC.ink },
  factorySub: { fontSize: 12.5, color: MAGIC.violetSoft, marginTop: 2 },
  factoryCta: { fontSize: 14, fontWeight: '900', color: MAGIC.mint },
  shelfHead: { fontSize: 14, fontWeight: '800', marginTop: 14, marginBottom: 8 },
  creationsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  creationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    borderWidth: 1,
    borderColor: 'rgba(185,166,232,0.35)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  creationEmoji: { fontSize: 15 },
  creationTitle: { fontSize: 13, fontWeight: '700', maxWidth: 170 },
  bandRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, marginBottom: 14 },
  bandChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bandEmoji: { fontSize: 14 },
  bandLabel: { fontSize: 13, fontWeight: '800' },
  rowWrap: { gap: GAP },
  card: { marginBottom: 20 },
  coverGlow: {
    borderRadius: 14,
    shadowColor: MAGIC.violet,
    shadowOpacity: 0.55,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  emojiBadge: {
    position: 'absolute',
    top: -8,
    right: -6,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: MAGIC.from,
    borderWidth: 1.5,
    borderColor: MAGIC.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiBadgeText: { fontSize: 17 },
  busyVeil: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(22,15,43,0.55)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookTitle: { fontSize: 14, fontWeight: '800', marginTop: 10, lineHeight: 18 },
  bookAuthor: { fontSize: 12, marginTop: 2 },
  blurb: { fontSize: 12, lineHeight: 16, marginTop: 6 },
  readBtn: {
    marginTop: 10,
    borderRadius: 999,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: MAGIC.mint,
  },
  readBtnText: { fontSize: 13, fontWeight: '900', color: '#14121C' },
  ad: { marginTop: 8 },
});
