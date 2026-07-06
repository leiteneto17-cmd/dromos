# SOCIAL — Status
*Atualizado: 2026-07-03 · branch `checkpoint/redesign-social-2026`*

## Estado atual
- **Posicionamento (reafirmado 2× pelo usuário em 2026-07-02): a ALMA do app é o "Strava
  da leitura"** — hábito social, leitura e bons hábitos. Estudo/ENEM é vertical que
  monetiza, não a identidade. Não inverter.
- **Já construído e no ar:** sessões de leitura, feed "Seguindo" (na aba Comunidade, aberto
  por padrão), **Logos** 📜 (nosso nome para curtidas — NÃO usar "kudos"), follows, comentários (scraps), estatísticas/recordes
  (tela `/estatisticas`), streak, metas + coach IA, conquistas/badges, card compartilhável
  (`/compartilhar`, react-native-view-shot).
- **Pacote Hábito v1 (commit `577caaa`, TESTADO):** card Hábito no topo da Home (🔥 streak +
  bolinhas da semana + meta do dia), faixa 🏆 Desafios, tela `/desafios` (4 desafios locais
  por período em `src/services/desafios.ts`, zero backend).
- **Recap semanal "Wrapped" (commit `6f6f8f9`, TESTADO):** modo `recap` do ShareableCard
  (semana seg→dom), entrada na Home via "📤 Compartilhar minha semana".
- Aba Atividades foi removida e redistribuída (commit `9eca41e`, aprovado); nav =
  `[Início, Biblioteca, (Ler), Comunidade, Perfil]`.

## Decisões firmadas (ADR resumido)
- Identidade visual social/stats = **roxo + verde neon** (CLAUDE.md §2.7); leitor continua
  sépia/claro/escuro — duas "peles".
- **Privacidade por padrão:** atividade `friends` por default; RLS novo respeita
  `visibility` (pendente confirmar deploy — ver ACERVO/MONETIZACAO e [[supabase-schema]]).
- Feed social exige moderação/denúncia/bloqueio (Apple 1.2 — CLAUDE.md §4.8) antes de
  qualquer expansão de UGC.

## Card compartilhável — Instagram Stories sticker (2026-07-04)
- **Bug corrigido:** o botão "Instagram Story" abria o Story EM BRANCO (deep link
  `instagram-stories://share` sem payload). Agora usa `react-native-share`
  (`Social.InstagramStories`) enviando o card como **stickerImage** (PNG base64) sobre
  gradiente da marca — o modelo "Transparente" flutua de verdade sobre a foto do usuário.
  Fallback: share sheet nativo. `src/app/compartilhar.tsx`.
- **⚠️ Config:** `app.json → extra.fbAppId` está VAZIO. Android é lenient (funciona no
  teste), mas p/ produção/iOS registrar 1 App ID grátis em developers.facebook.com.
- **Reforço:** fundo transparente explícito nos wrappers do view-shot (Problema A — alpha
  no Android). **❌ TESTADO 2026-07-04: NÃO bastou — card ainda sai com FUNDO PRETO.**
  **Direção do usuário (estilo Strava, P3):** salvar PNG SEM fundo na galeria + postar direto
  no Instagram (lá não há preto). Fix real da captura alpha: subir react-native-view-shot OU
  trocar o método de captura. Sticker já plugado, mas depende do PNG sair transparente.
- **Dependência nova:** react-native-share 12.3.1 (autolinkada no build; exige APK nova).

## Comunidade Stories (2026-07-04) — S1 construída, aguardando teste
Design em `DESIGN-STORIES.md`. **S1 pronta:** coluna `shared_as_story_at` no schema
(⚠️ REAPLICAR schema.sql), `src/services/stories.ts` (publicar minha última leitura + ler
stories de 24h), faixa de **bolhas** no topo da Comunidade (1ª = Você: publica/vê), tela
`/story` em tela cheia (toque fecha). **Feed vertical "Seguindo" APOSENTADO** (as bolhas o
substituem — decisão do usuário). Preview do card transparente ganhou o QUADRICULADO estilo
Strava. **Falta S2/S3:** auto-avançar entre pessoas, "visto" (anel apagado), reações
(Logos/responder) no story; limpar o dead code do feed antigo (onKudo/feed state).

## Card compartilhável TRANSPARENTE — 🔍 CAUSA-RAIZ ENCONTRADA (2026-07-05, auditoria)
**O sticker NUNCA chegava ao Instagram.** Auditoria do react-native-share 12.3.1 instalado:
- **Causa-raiz:** `appId` vazio → o **JS da lib lança exceção** ANTES do código nativo
  (`lib/module/index.js:54`: "To share to Instagram Stories you need to provide appId").
  O Intent `com.instagram.share.ADD_TO_STORY` nunca era montado. O `catch` silencioso do
  `onInstagram` engolia o erro e caía no `Sharing.shareAsync` (ACTION_SEND genérico) → o IG
  recebia o card como FOTO comum → achatava em fundo preto, imóvel. Confirma o teste do
  usuário: sticker NÃO movia + transparência NÃO permanecia = não era sticker.
- **Lado nativo da lib está CORRETO** (auditado): `stickerImage` → `interactive_asset_uri`
  (`InstagramStoriesShare.java:121`), MIME `image/*` sticker-only, `grantUriPermission` c/
  `FLAG_GRANT_READ_URI_PERMISSION`, base64 → arquivo → FileProvider `.rnshare.fileprovider`.
  Sem fallback ACTION_SEND na lib quando o IG está instalado.

### O que foi feito (aguardando teste na APK nova):
1. `FB_APP_ID` ganhou **placeholder temporário `'123456789'`** (compartilhar.tsx) — só p/
   validar o pipeline; Android não valida o `source_application`. **Produção/iOS: registrar
   App ID real grátis em developers.facebook.com → app.json `extra.fbAppId`.**
2. **Fallback silencioso REMOVIDO** do `onInstagram` durante o dev — erro agora dá
   `console.error` + `Alert` (o fallback mascarou o bug por dias).
3. **Logs do fluxo inteiro** (`[IG Stories] …`): FB_APP_ID, tamanho do base64, **color type
   do PNG lido do header** (6 = RGBA c/ alpha, 2 = RGB achatado — helper `pngColorType`),
   chamada e resultado do `shareSingle`.
4. Se o sticker chegar MÓVEL mas ainda preto → aí sim o suspeito vira a exportação Skia sem
   alpha (o log do color type responde isso na hora).

## Roadmap / próximos passos
1. **Clube do livro GUIADO (social v2)** — REFORMULADO (2026-07-03, decisão do usuário
   após parecer CPO): ver `ROADMAP-CLUBE.md` (v2) — MVP funciona com N=1 (cronograma por
   capítulos + discussão por IA anti-spoiler) e N=2 (convite por link/código); descoberta
   pública/ranking adiados p/ v3 pós-rede. Parecer: `PARECER-CPO-2026-07-03.md`.
   **✅ G1 CONCLUÍDA — M1 BATIDO (2026-07-03, testado em produção com 2 contas):** seção
   "CLUBE DO LIVRO GUIADO" no `supabase/schema.sql` (clubs/members/stages/posts + RLS via
   `is_club_member` security definer + RPCs `club_create`/`club_join`/
   `club_stage_set_questions`). Os 4 blocos de `supabase/teste-clube-g1.sql` passaram:
   criação com etapas, invisibilidade pré-join, entrada por código, post, bloqueio
   escondendo post, dono removendo membro.
   **🔶 G2 CONSTRUÍDA (2026-07-03, aguardando teste no aparelho):** `services/clube.ts`
   (cronograma determinístico semanas→etapas; perguntas por IA BYOK→gerida com anti-spoiler
   no prompt e cache via `club_stage_set_questions`; posts com nomes de perfil) + telas
   `/clubes` (meus clubes, criar de livro da biblioteca, entrar por código — G3.1 antecipado)
   e `/clube` (trilha de etapas, discussão da etapa, publicar/apagar resposta, compartilhar
   código via Share) + faixa "📖 Clube do Livro" na aba Comunidade. Rotas novas exigiram
   patch manual do `.expo/types/router.d.ts` (regenera no próximo `expo start`).
   **✅ G3 TESTADA — M3 BATIDO, MVP DO CLUBE COMPLETO (2026-07-03, testado na APK de
   release: Logos ok, código de convite ok, moderação ok).** Ajustes pós-teste (aguardando
   verificação): feed "Seguindo" agora só mostra os ÚLTIMOS 7 DIAS (quem segue muita gente
   acumulava velharia) e o Clube ganhou CARD DE DESTAQUE na Comunidade (gradiente roxo +
   CTA verde neon, cores fixas §2.7). v3 do clube (descoberta/ranking) = pós-rede.
   Conteúdo original da G3: consentimento explícito no
   join (R2); seção "Lendo junto" com páginas por membro no livro do clube (respeita
   visibility — sem dado = "—"); Logos 📜 em post (NOVA tabela `club_post_logos` no
   schema.sql — ⚠️ REAPLICAR a seção do clube no SQL Editor); ⋯ do post = denunciar
   (`content_reports` 'club_post') + bloquear autor; dono remove membro (⋯ em "Lendo
   junto"), apaga clube; membro sai. **Teste M3:** 2 aparelhos na mesma etapa, post some
   ao bloquear, denúncia grava, remoção funciona. Depois do M3: v3 fica pós-rede
   (descoberta/ranking) — voltar ao fluxo normal (Kokoro é a próxima pauta do usuário).
2. Ranking de desafios entre amigos.
3. Notificação de domingo do recap (opcional; expo-notifications via require preguiçoso).
4. Checklist de boas-vindas na Home (junto do paywall).
