# +leitura — Ideias Futuras (Backlog de Produto)

> Backlog de funcionalidades aprovadas como **direção futura** pelo usuário (não implementadas).
> Registrado para não se perder entre sessões. Quando formos construir, mover o item para o
> roadmap do `CLAUDE.md` (§7) e detalhar a arquitetura. Idioma: PT-BR.
>
> *Origem: pedido do usuário em 2026-06-21 ("salve essas ideias para serem usadas no futuro").*

---

## 1. METAS (substitui/evolui "Conquistas") — PRIORIDADE do usuário

Trocar a tela **Conquistas** por **Metas**: objetivos que o **próprio usuário cria**, e a
**conquista vira a RECOMPENSA da meta** (não mais um catálogo fixo estilo Steam).

- **Usuário cria a meta**, ex.: *"ler este livro nesta semana"*.
- **A IA calcula o plano**: quantas **páginas por dia** ele precisa ler para bater a meta no prazo.
- **Ao concluir**, ganha uma **conquista personalizada daquela meta**, que fica **no perfil**
  (medalha/emblema gerado a partir do objetivo — não um achievement genérico).
- **Integra com o que já existe:** sessões de leitura (`store/library.ts` → `ReadingSession`),
  progresso/ritmo (`services/progress.ts`), perfil. A grade de Conquistas atual
  (`src/app/conquistas.tsx`, `computeAchievements`) seria refeita como "Metas + conquistas ganhas".
- **Liga com o item 3 (Cronograma Adaptativo):** se atrasar/adiantar, a IA **reajusta as páginas/dia**.
- **STATUS (2026-06-21):** **Metas v1 FEITO** (tipos minutos/dias; ritmo recalculado = adaptativo;
  concluir = medalha). Falta: **meta por LIVRO** (páginas/dia — em andamento) e a camada de IA abaixo.

### 1b. IA opcional (BYOK) p/ Metas — SUGESTÕES + LEMBRETES (pedido do usuário 2026-06-21)
A IA é **opcional e só funciona DEPOIS de o usuário configurar a chave dele no Perfil** (BYOK §5 — já
existe a tela de Integrações e o store `useAI`). Sem chave configurada, as Metas funcionam normalmente só
com a matemática local (já é assim). Com chave:
- **Sugerir metas e ritmo:** a IA olha o histórico (PPM, consistência, livro atual, tamanho) e propõe metas
  realistas ("você lê ~20 min/dia; que tal terminar X em 10 dias = 18 págs/dia?"). Botão "Sugerir meta (IA)"
  na tela de Metas, só aparece se `useAI.hasKey`.
- **Lembretes no celular (notificações locais):** lembrar de ler no horário that funciona pro usuário e
  avisar o ritmo do dia ("faltam 12 págs hoje p/ bater a meta"). **`expo-notifications`** (notificação LOCAL
  agendada — não precisa de servidor de push; funciona offline). Pedir permissão; deixar o usuário escolher
  horário; respeitar §2.5 "zero notificações externas durante a leitura". A IA (opcional) ajusta o texto/
  horário pelo ritmo; sem IA, lembrete simples no horário fixo escolhido.
- **Gate:** tudo isso atrás de `useAI.hasKey` (configurado em Perfil → Integrações). Notificação local NÃO
  exige IA, mas a personalização do texto/horário sim. `expo-notifications` é módulo nativo → ok no dev
  build (já temos); no Expo Go tem limitações — confirmar.
- **STATUS (2026-06-22): §1b FEITO** (falta teste do usuário). Incremento 1 = lembrete local diário
  (`expo-notifications`, `src/services/reminders.ts`, card na tela Metas, sem IA). Incremento 2 = IA opcional
  (`src/services/ai/goal-coach.ts`): botão "✨ Sugerir meta (IA)" pré-preenche a meta + justificativa, e o
  texto do lembrete vira personalizado pelo ritmo quando há chave. ⚠️ exige `npx expo run:android` (módulo
  nativo novo). Detalhes em `docs/MEMORIA-PROJETO.md`.

---

## 2. Navegação e Interatividade com a Obra (IA "conversa" com o texto)

Quebrar a linearidade do livro:

- **Busca Semântica (busca por IDEIA, não palavra exata):** o usuário digita o conceito
  (ex.: *"a teoria do caos aplicada ao cotidiano"*) e a IA localiza o trecho, mesmo sem a
  palavra literal. *(Técnico: embeddings dos parágrafos + busca por similaridade; cabe BYOK.)*
- **Guia de Personagens + Linha do Tempo:** em obras com muitos personagens/tramas
  (*Guerra e Paz*, fantasias longas), a IA mapeia **quem é quem** e relembra o histórico do
  personagem **até o ponto atual da leitura — SEM spoiler do final**. *(Respeitar a posição de
  leitura: só usar o texto já lido.)*

---

## 3. Hiper-Personalização da Experiência

A leitura se adapta ao ritmo e estilo de cada usuário:

- **Recomendações Preditivas:** sugerir a próxima leitura considerando **estilo de escrita, tom,
  densidade e ritmo** (não só gênero) dos livros lidos/favoritados. Casa com a Comunidade/estante.
- **Cronograma de Leitura Adaptativo:** dada uma meta (ex.: *terminar em 15 dias*), a IA calcula
  **páginas/dia**; se o usuário **atrasar ou acelerar**, ela **reajusta as metas diárias
  automaticamente** com base no **ritmo real**. *(É o motor por trás do item 1 — Metas.)*

---

## 4. Acessibilidade e Inclusão (remover barreiras de leitura)

- **Audiolivros Dinâmicos (TTS natural):** transformar qualquer livro digital em audiolivro com
  vozes de IA com **entonação humana, pausas naturais** e **mudança de tom conforme a emoção da
  cena** (narrador vs. diálogo). *(Evolui o TTS premium atual — ElevenLabs/BYOK §5; explorar
  marcação de "narrador vs. fala" e direção de emoção por trecho.)*
- **Adaptação para Dislexia e TDAH:** reformatar o texto dinamicamente — ajustar **espaçamento**,
  **destacar sílabas tônicas**, aplicar **Bionic Reading** (início das palavras em negrito) — para
  ajudar concentração e velocidade. *(Bionic já existe em `components/bionic-text.tsx`; faltam os
  modos de espaçamento e sílaba tônica como perfis de acessibilidade.)*

---

## 5. CAMADA SOCIAL ABERTA (opt-in) — pedido do usuário 2026-06-21

Hoje a comunidade é **anônima** ("a contagem mostra só números — ninguém vê quem leu o quê"). O usuário
quer torná-la mais social: **ver quem leu/está lendo**, **abrir o perfil das pessoas** e **trocar
mensagens** — sempre **respeitando a privacidade**: cada um **escolhe** tornar o perfil público ou não.
Mantém o princípio do §4.8 (privado por padrão), só adiciona a opção de abrir.

- **A) Perfil público/privado (FUNDAÇÃO):** flag `is_public` em `profiles` (default **false**). Toggle no
  Perfil ("Tornar meu perfil público"). Tudo o que segue só vale para quem optou por público.
- **B) Ver quem está lendo:** na página do livro, listar os **leitores públicos** daquele livro (nome +
  avatar + status), além da contagem agregada. Privados continuam só no número. Função SECURITY DEFINER
  `public_readers(book_key)` que só devolve quem é público.
- **C) Abrir o perfil de outra pessoa:** tela de perfil read-only (nome/avatar + estante pública +
  resenhas). RLS: ler estante/atividade de quem é público.
- **D) Mensagens entre leitores (DMs) — MAIOR, tem regra de loja:** tabelas `conversations`/`messages`
  (Supabase Realtime), RLS (só os 2 participantes leem). **Apple 1.2 / §4.8 obrigam** p/ DMs:
  **denunciar mensagem**, **bloquear** (já temos `user_blocks` → reusar p/ impedir DM), e contato. Mensagem
  é vetor clássico de abuso → moderação caprichada. Considerar: só pode mandar DM p/ quem é público / ou
  p/ quem você segue. Filtro de palavrão (`moderation.ts`) na mensagem.
- **E) Seguir leitores (follows) + feed (§2.6 original):** segue sendo o "pilar social" estilo Strava;
  encaixa aqui (feed das atividades públicas de quem você segue, com kudos/comentários + moderação).

**Ordem recomendada:** A (fundação) → B → C → E (follows/feed) → D (mensagens por último, é a maior +
mais sensível). Atualizar CLAUDE.md §2.6/§4.8 quando construir (manter "privado por padrão, público por
opção"). Reusar `user_blocks`/`content_reports`/`moderation.ts` do C3.

---

### Notas de implementação (quando chegar a hora)
- **Custo de IA:** itens 2 e 3 são pesados em tokens/embeddings → seguir a regra **BYOK + cache**
  (CLAUDE.md §5): não reprocessar o mesmo livro/trecho; guardar embeddings e respostas localmente.
- **Privacidade:** o que a pessoa lê é íntimo (§4.8) — metas e histórico nascem privados.
- **Sem spoiler:** itens que "resumem" a obra (personagens/linha do tempo) devem respeitar a
  **posição de leitura** e nunca usar o texto ainda não lido.

## Catálogo infantil PT-BR + voz do pai (ideia 2026-07-04)
Substituir o catálogo inglês por um **acervo infantil/educativo em PT-BR**. Diferencial de alto
impacto emocional: o **pai/mãe clona a própria voz** (Chatterbox, ~15s de áudio, sem GPU) e o
filho ouve o livro na voz do responsável. Encaixa no motor de voz pré-renderizado (voz-tts-estrategia)
e no público família. Validar: qualidade pt-BR do clone, consentimento/LGPD de voz de menor, UX do
upload de voz. Ver docs/FEATURES/TTS/PARECER-CPO-AUDIO-2026-07-04.md.

## Social sem arquivo — parecer CPO 2026-07-10 (empréstimo digital MORTO; alternativas aprovadas)
Contexto: o "empréstimo de EPUB entre usuários" (estilo CDL/Open Library) foi **descartado em
definitivo** — o Internet Archive PERDEU o caso Hachette (CDL ≠ fair use, confirmado em apelação
2024), "só ler no app" exige DRM (§4.3) e a LDA brasileira não tem exceção. **Nunca transitar
arquivo importado pelo usuário entre contas.** O valor social vem SEM arquivo:

1. **📚 Passar o bastão (CONSTRUIR, 1ª pós-polish, ~2 sessões):** ao terminar um livro →
   "Quem você recomenda ler agora?" → escolhe um seguido → notificação com dedicatória →
   aceito = livro na estante do outro (acervo DP entra na hora; com copyright é só a
   recomendação, sem arquivo) + item de feed "1984 passou de Paulo → Ana". Gatilho no fim
   do livro (Zeigarnik), funciona com N=2, reusa follows/notificações/estante/feed. Absorve
   o "Presentear um clássico". RICE ≈ 1.8.
2. **📖 Linha do tempo do livro (subproduto do bastão, ~1 sessão):** página do livro mostra a
   cadeia de quem passou/leu/resenhou (reader_count + reviews já existem).
3. **🏆 Desafio em dupla (REFORMULADO, ~3 sessões):** estilo Duolingo Friend Quests — "você e
   Ana: 60 min juntos até domingo". NÃO fazer desafio de multidão (precisa densidade).
4. **🤝 Biblioteca física por proximidade (ADIADO):** Dromos só conecta pessoas, livro é papel —
   legalmente limpo, mas marketplace com cold-start² (mesma cidade + mesmo livro) e peso de
   confiança/segurança. Gatilho de revisão: ~500 usuários ativos numa mesma cidade.
5. **🗺️ Mapa de leitores (MORTO):** localização + hábito de leitura = dado duplamente sensível
   (§4.8, lição do heatmap do Strava). Não construir.

## Trilhas de leitura (Jamendo/ambientes) — código removido, decisão preservada (2026-07-10)
O serviço `src/services/music.ts` foi DELETADO junto com o editor de story (posts estilo X o
substituíram). A DECISÃO LEGAL continua valendo se a ideia voltar como "som ambiente no leitor":
**Jamendo API** (CC, grátis, `client_id` em `extra.jamendoClientId`) + **sons ambientes CC0**
(chuva/cafeteria/lareira). NADA de Spotify/iTunes (sem licença comercial). Recuperar o código no
git history (commit anterior a 2026-07-10) se for reconstruir.

## Tendências REAIS de leitura no Brasil (acompanhamento — 2026-07-10)
A seção "Em alta" da Comunidade usa o trending global do Open Library (única fonte com API legal
hoje) — foi rotulada honestamente como **"Em alta no mundo 🌍"**. Para "Em alta no BRASIL" de
verdade, criar **curadoria semanal via harvester** (pipeline PC→catalog.json que já existe):
monitorar manualmente/scraper leve: **PublishNews** (ranking oficial de vendas BR), **lista Veja**,
**#BookTokBrasil / #Bookstagram** (viral), **Skoob** (sem API — inspiração, não fonte). Saída:
campo `trending: true` (+ posição) nos itens do catalog.json → o app troca a fonte da seção sem
release. Quando houver usuários, somar a NOSSA telemetria (Populares na comunidade já é real).
