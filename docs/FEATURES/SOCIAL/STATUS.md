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
   **Falta da G3:** progresso dos membros na trilha, Logos em post, denunciar/bloquear na
   UI do clube (moderation.ts), aviso de consentimento no join.
2. Ranking de desafios entre amigos.
3. Notificação de domingo do recap (opcional; expo-notifications via require preguiçoso).
4. Checklist de boas-vindas na Home (junto do paywall).
