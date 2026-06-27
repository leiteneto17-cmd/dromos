/**
 * Perfil PÚBLICO de outro leitor (camada social · follows). Aberto ao tocar no autor de
 * uma resenha ou num item do feed. Mostra avatar/nome + seguidores/seguindo + botão
 * Seguir, e — se o perfil for público — a estante e as resenhas da pessoa.
 *
 * Privacidade (§4.8): se o perfil não for público, nada do conteúdo aparece (a RLS já
 * impede a leitura da estante/atividades; aqui mostramos um aviso amigável).
 */
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmblemStrip } from '@/components/emblem-strip';
import { ProfileScraps } from '@/components/profile-scraps';
import { Card, SectionTitle } from '@/components/social-ui';
import { useUI } from '@/hooks/use-ui';
import type { BookReview, ShelfItem } from '@/services/community';
import { SHELF_LABEL } from '@/services/community';
import { achievementsFromIds } from '@/services/progress';
import {
  followUser,
  getFollowCounts,
  getFollowState,
  getUserProfile,
  getUserReviews,
  getUserShelf,
  unfollowUser,
  type FollowState,
  type PublicProfile,
} from '@/services/social';
import { useAuth } from '@/store/auth';

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
}

export default function UserScreen() {
  const c = useUI();
  const me = useAuth((s) => s.user);
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const userId = (params.id ?? '').trim();
  const isMe = !!me && me.id === userId;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [shelf, setShelf] = useState<ShelfItem[]>([]);
  const [reviews, setReviews] = useState<BookReview[]>([]);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [followState, setFollowState] = useState<FollowState>('none');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const [prof, cnt, fs] = await Promise.all([getUserProfile(userId), getFollowCounts(userId), getFollowState(userId)]);
    setProfile(prof);
    setCounts(cnt);
    setFollowState(fs);
    // Estante/resenhas só vêm se eu puder ver (RLS: público, eu, ou seguidor aceito).
    const [sh, rv] = await Promise.all([getUserShelf(userId), getUserReviews(userId)]);
    setShelf(sh);
    setReviews(rv);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const toggleFollow = useCallback(async () => {
    setBusy(true);
    const err =
      followState === 'none' ? await followUser(userId) : await unfollowUser(userId); // pending/accepted → cancela
    if (!err) await load(); // recarrega: status real (pending p/ privado, accepted p/ público) + conteúdo
    setBusy(false);
  }, [followState, userId, load]);

  const name = profile?.name?.trim() || (params.name ? String(params.name) : 'Leitor');
  const avatar = profile?.avatar_url || '🦉';
  // Vê o conteúdo se for eu, o perfil é público, ou eu sou seguidor ACEITO.
  const canSee = isMe || !!profile?.is_public || followState === 'accepted';
  // Fundador COM realce ligado (anel/linha/emblema). O toggle é do próprio fundador.
  const showFounder = !!profile?.is_founder && profile?.founder_flair !== false;

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <SafeAreaView style={styles.fill} edges={['top', 'left', 'right']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={[styles.back, { color: c.green }]}>‹ Voltar</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={c.green} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Cabeçalho */}
            <View style={styles.header}>
              {showFounder ? (
                <View style={[styles.avatarRing, { borderColor: c.green, shadowColor: c.green }]}>
                  <Text style={styles.avatar}>{avatar}</Text>
                </View>
              ) : (
                <Text style={styles.avatar}>{avatar}</Text>
              )}
              <Text
                style={[
                  styles.name,
                  { color: c.text },
                  showFounder && { textShadowColor: c.green, textShadowRadius: 12, textShadowOffset: { width: 0, height: 0 } },
                ]}>
                {name}
              </Text>
              {showFounder ? (
                <Text style={[styles.founderLine, { color: c.green }]} numberOfLines={1}>
                  👑 Fundador · entre os 50 primeiros
                </Text>
              ) : null}
              <View style={styles.countRow}>
                <Text style={[styles.count, { color: c.text }]}>
                  {counts.followers} <Text style={{ color: c.textFaint }}>seguidores</Text>
                </Text>
                <Text style={[styles.count, { color: c.text }]}>
                  {counts.following} <Text style={{ color: c.textFaint }}>seguindo</Text>
                </Text>
              </View>
              {!isMe ? (
                <Pressable
                  onPress={toggleFollow}
                  disabled={busy}
                  style={[
                    styles.followBtn,
                    followState === 'none'
                      ? { backgroundColor: c.green }
                      : { backgroundColor: 'transparent', borderColor: c.border, borderWidth: 1 },
                  ]}>
                  <Text style={[styles.followText, { color: followState === 'none' ? c.onGreen : c.textDim }]}>
                    {followState === 'accepted'
                      ? 'Seguindo ✓'
                      : followState === 'pending'
                        ? 'Solicitado'
                        : profile?.is_public
                          ? '+ Seguir'
                          : '+ Solicitar'}
                  </Text>
                </Pressable>
              ) : (
                <Text style={[styles.meTag, { color: c.textFaint }]}>Este é o seu perfil</Text>
              )}
            </View>

            {!canSee ? (
              <Card style={styles.privateCard}>
                <Text style={[styles.privateTitle, { color: c.text }]}>🔒 Perfil privado</Text>
                <Text style={[styles.privateSub, { color: c.textFaint }]}>
                  {followState === 'pending'
                    ? 'Seu pedido foi enviado. Quando for aceito, você verá a estante e as resenhas.'
                    : 'Solicite para seguir. Quando for aceito, a estante e as resenhas aparecem aqui.'}
                </Text>
              </Card>
            ) : (
              <>
                {/* Emblemas conquistados (profiles.badges) + brasão de fundador (is_founder) */}
                {(profile?.badges?.length ?? 0) > 0 || showFounder ? (
                  <>
                    <SectionTitle name="trophy">
                      {`Emblemas (${(profile?.badges?.length ?? 0) + (showFounder ? 1 : 0)})`}
                    </SectionTitle>
                    <EmblemStrip achievements={achievementsFromIds(profile?.badges ?? [])} founder={showFounder} />
                  </>
                ) : null}

                {/* Estante */}
                {shelf.length > 0 ? (
                  <>
                    <SectionTitle name="books">{`Estante (${shelf.length})`}</SectionTitle>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelfRow}>
                      {shelf.map((s) => (
                        <Pressable
                          key={s.book_key}
                          style={styles.shelfCell}
                          onPress={() =>
                            router.push({
                              pathname: '/livro',
                              params: { title: s.book_title, author: s.book_author, cover: s.cover_url, isbn: s.isbn },
                            })
                          }>
                          {s.cover_url ? (
                            <Image source={{ uri: s.cover_url }} style={styles.cover} contentFit="cover" transition={150} />
                          ) : (
                            <View style={[styles.cover, styles.coverFallback, { backgroundColor: c.cardElevated }]}>
                              <Text style={{ fontSize: 22 }}>📘</Text>
                            </View>
                          )}
                          <Text style={[styles.shelfStatus, { color: c.green }]}>{SHELF_LABEL[s.status]}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </>
                ) : null}

                {/* Resenhas */}
                {reviews.length > 0 ? (
                  <>
                    <SectionTitle name="star">{`Resenhas (${reviews.length})`}</SectionTitle>
                    {reviews.map((r) => (
                      <Card key={r.id} style={styles.review}>
                        {r.book_title ? (
                          <Text style={[styles.reviewBook, { color: c.text }]} numberOfLines={1}>
                            {r.book_title}
                          </Text>
                        ) : null}
                        <View style={styles.reviewMeta}>
                          <Text style={{ color: c.green, letterSpacing: 1 }}>
                            {'★'.repeat(r.rating)}
                            <Text style={{ color: c.border }}>{'★'.repeat(5 - r.rating)}</Text>
                          </Text>
                          <Text style={[styles.date, { color: c.textFaint }]}>· {fmtDate(r.created_at)}</Text>
                        </View>
                        {r.text ? <Text style={[styles.reviewText, { color: c.textDim }]}>{r.text}</Text> : null}
                      </Card>
                    ))}
                  </>
                ) : null}

                {shelf.length === 0 && reviews.length === 0 ? (
                  <Text style={[styles.empty, { color: c.textFaint }]}>
                    Este leitor ainda não tem livros na estante nem resenhas públicas.
                  </Text>
                ) : null}
              </>
            )}

            {/* Mural de recados (sempre — a permissão de enviar/ver é do componente/RLS) */}
            <ProfileScraps recipientId={userId} recipientName={name} isMe={isMe} />
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topBar: { paddingHorizontal: 16, paddingVertical: 10 },
  back: { fontSize: 16, fontWeight: '800' },
  content: { paddingHorizontal: 16, paddingBottom: 48 },
  header: { alignItems: 'center', marginTop: 8 },
  avatar: { fontSize: 64 },
  name: { fontSize: 22, fontWeight: '800', marginTop: 8 },
  // Anel neon (glow) ao redor do avatar do fundador (shadowColor inline = cor do tema).
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.9,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  founderLine: { fontSize: 12.5, fontWeight: '800', letterSpacing: 0.3, marginTop: 8 },
  countRow: { flexDirection: 'row', gap: 24, marginTop: 10 },
  count: { fontSize: 15, fontWeight: '800' },
  followBtn: { marginTop: 16, borderRadius: 999, paddingHorizontal: 28, paddingVertical: 11 },
  followText: { fontSize: 15, fontWeight: '800' },
  meTag: { fontSize: 13, marginTop: 14 },
  privateCard: { marginTop: 24, alignItems: 'center' },
  privateTitle: { fontSize: 16, fontWeight: '700' },
  privateSub: { fontSize: 13, lineHeight: 20, marginTop: 6, textAlign: 'center' },
  shelfRow: { gap: 12, paddingVertical: 4, paddingRight: 16 },
  shelfCell: { width: 86 },
  cover: { width: 86, height: 126, borderRadius: 6 },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  shelfStatus: { fontSize: 11, fontWeight: '700', marginTop: 5 },
  review: { marginTop: 12 },
  reviewBook: { fontSize: 14, fontWeight: '700' },
  reviewMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  date: { fontSize: 12 },
  reviewText: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  empty: { fontSize: 13, lineHeight: 20, marginTop: 24, textAlign: 'center' },
});
