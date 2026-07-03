# Plano de Projeto: Clube do Livro — v2 REFORMULADO (CPO + project-director)
*2026-07-03 · substitui o plano v1 desta manhã · decisão do usuário: Clube SERÁ feito, nesta forma*
*Insumos: PARECER-CPO-2026-07-03.md (crítica de estágio) + plano v1 (base técnica, preservada abaixo)*

## Visão Geral
Clube de leitura **guiado**: escolhe um livro → o app monta um cronograma por capítulos e
gera discussão por etapa (IA). **Funciona sozinho (N=1)**, fica melhor com um amigo por
convite (N=2), e já nasce com a estrutura para virar rede quando houver usuários. Reformulação
resolve a falha fatal do v1 (clube vazio pré-lançamento): o valor inicial vem do CONTEÚDO
(cronograma + discussão), não dos outros membros. RICE sobe de 0.19 → ~1.6.

## O que muda vs. v1 (critério: funcionar com N=1/N=2 — parecer CPO)
- ➕ **Cronograma de leitura** (etapas por capítulos/semana, conforme meta do usuário) — é a
  espinha do clube e reusa a identidade "trilha do livro" (roxo+verde, CLAUDE.md §2.7).
- ➕ **Discussão guiada por IA** por etapa (perguntas de reflexão, SEM spoiler — só até onde
  o membro chegou). Gerada 1× por livro/etapa e cacheada (custo ~zero, padrão §5).
- ➕ **Convite por link/código** (N=2) — absorve o "desafio duo" do parecer CPO.
- ➖ **Adiado p/ v3 (pós-rede):** descoberta pública de clubes, lista/busca, ranking entre
  membros, notificações de clube.
- ✔️ **Mantido do v1:** schema base (clubs/members/posts), moderação plugada (JÁ existe:
  `user_blocks`, `content_reports`, `moderation.ts`), privacidade por consentimento no join.

## Marcos
- **M1 — Backend no ar:** schema (incl. etapas) + RLS testados com 2 contas no SQL Editor. (~1 sessão)
- **M2 — Clube guiado vivo (N=1):** criar clube de um livro, ver trilha de etapas com
  cronograma, ler as perguntas da etapa atual e responder (post). Testável SOZINHO. (~1–2 sessões)
- **M3 — A dois (N=2) + moderação:** convite por link/código, amigo entra, discussão por
  etapa com Logos, progresso mútuo, denunciar/bloquear/remover na UI. (~1–2 sessões)

## Backlog Priorizado

### Epic G: Clube do Livro Guiado — Prioridade: Alta — MVP: Sim
Dependências: schema social aplicado; ai-proxy/BYOK (perguntas) · Estimativa: 3–5 sessões

- **Feature G1 — Schema + RLS** — MVP: Sim (~1 sessão)
  - Task G1.1: `clubs` (nome, livro título/autor/capa/file_url, owner_id, meta ex.: semanas),
    `club_members` (role owner|member, unique), `club_stages` (nº, capítulos, data-alvo,
    perguntas_json cacheadas), `club_posts` (texto, stage_nº opcional, autor).
  - Task G1.2: RLS — membro lê/posta; entrar SÓ por convite (`invite_code` no clube);
    owner remove membro/post; filtrar `user_blocks`; `content_reports` aceita `club_post`.
  - Pronto quando: 2 contas criam/entram (por código)/postam via SQL e bloqueio esconde conteúdo.
- **Feature G2 — Clube guiado single-player** — MVP: Sim (~1–2 sessões)
  - Task G2.1: criar clube a partir de livro (biblioteca/acervo) + meta → gera cronograma
    local (capítulos ÷ semanas; sem IA para o cálculo, determinístico).
  - Task G2.2: tela `/clube/[id]`: trilha de etapas (pele roxo+verde), etapa atual destacada,
    progresso do membro sobre a trilha.
  - Task G2.3: perguntas de discussão por etapa via IA (ai-proxy/BYOK, cache em
    `club_stages.perguntas_json` — regra anti-spoiler: só etapas ≤ atual) + responder (post).
  - Pronto quando: usuário cria clube de Dom Casmurro sozinho no aparelho, vê cronograma e
    responde a 1 pergunta da etapa 1.
- **Feature G3 — Convite + discussão a dois + moderação** — MVP: Sim (~1–2 sessões)
  - Task G3.1: convite por link (deep link) E código digitável (fallback — app ainda fora
    das lojas, link pode não resolver); tela de join com AVISO de consentimento ("seu
    progresso neste livro fica visível para o clube").
  - Task G3.2: discussão por etapa (posts dos membros + Logos), progresso dos 2 na trilha.
  - Task G3.3: moderação na UI: ⋯ → Denunciar (post/membro), Bloquear, owner remove.
  - Pronto quando: fluxo Apple 1.2 demonstrável e 2 aparelhos discutindo a mesma etapa.

### v3 — Pós-rede (gatilho: app nas lojas + primeiras dezenas de usuários ativos)
1. Descoberta pública de clubes (o C2.1 do v1). 2. Ranking interno. 3. Notificações de
clube. 4. Meta coletiva (reusa `desafios.ts`). 5. Vários livros/estante.

## Riscos Gerais
- **R1 — Custo/cota da IA das perguntas:** mitigado por geração 1× por livro+etapa com cache
  no banco (compartilhado entre TODOS os membros/clubes do mesmo livro se possível).
- **R2 — Deep link sem loja:** convite por LINK pode falhar em aparelho sem o app; por isso
  o CÓDIGO digitável é parte do MVP, não extra.
- **R3 — Spoiler:** perguntas de etapa futura vazando estragam a experiência âncora;
  regra anti-spoiler é critério de pronto do G2.3, não polish.
- **R4 — Apple 1.2:** posts = UGC; G3.3 obrigatório antes de qualquer release de loja.
- **R5 — RLS solo dev:** testar cada policy com 2 contas (critério de pronto do G1).

## Sequenciamento Recomendado
G1 → G2 → G3 (cada marco testável no aparelho; G2 já entrega valor SOZINHO — se o projeto
precisar pausar depois do M2, o que existe é útil, não um esqueleto vazio).
