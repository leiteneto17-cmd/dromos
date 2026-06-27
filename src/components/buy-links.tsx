/**
 * "Onde comprar" — lista de lojas (links de afiliado) na página do livro. Cada toque
 * abre a loja FORA do app (modelo agregador, permitido pelas lojas — §6). v1 sem preço
 * ao vivo; o comparador de preços é fase futura. Inclui aviso de transparência
 * (link de afiliado), recomendado/obrigatório em algumas jurisdições.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, SectionTitle } from '@/components/social-ui';
import { useUI } from '@/hooks/use-ui';
import { openAffiliate, STORES, type BookRef } from '@/services/affiliates';

export function BuyLinks({ book }: { book: BookRef }) {
  const c = useUI();
  if (!book.title?.trim()) return null;

  return (
    <>
      <SectionTitle name="globe">Onde comprar</SectionTitle>
      {STORES.map((store) => (
        <Pressable key={store.id} onPress={() => openAffiliate(store, book)}>
          <Card style={styles.row}>
            <Text style={styles.emoji}>{store.emoji}</Text>
            <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
              {store.name}
            </Text>
            <Text style={[styles.go, { color: c.green }]}>Ver na loja ›</Text>
          </Card>
        </Pressable>
      ))}
      <Text style={[styles.disclosure, { color: c.textFaint }]}>
        Links de afiliado: você é levado para a loja e podemos receber uma pequena comissão — sem custo extra
        pra você. Preços e disponibilidade são definidos pela loja.
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  emoji: { fontSize: 20 },
  name: { flex: 1, fontSize: 15, fontWeight: '700' },
  go: { fontSize: 14, fontWeight: '800' },
  disclosure: { fontSize: 11.5, lineHeight: 16, marginTop: 4 },
});
