---
name: leitura-app-project
description: "App de leitura (MindReaderApp / pasta +leitura) — React Native+Expo, iOS+Android; diretrizes completas no CLAUDE.md do projeto"
metadata: 
  node_type: memory
  type: project
  originSessionId: fea1e27c-e1ea-40f3-a19d-6740ca360685
---

Projeto **+leitura** (app de trabalho: *MindReaderApp*): app de leitura de livros estilo
Kindle com foco em **aprendizado ativo**, não só virar páginas. Roda em iPhone e Android
com uma única base de código.

**Diferenciais:** Bionic Reading + TTS de IA com destaque palavra-a-palavra sincronizado;
dicionário contextual por IA (significado no contexto + sinônimos/antônimos + 3 frases);
banco de vocabulário; gráficos de PPM/consistência; UI sépia/claro/escuro estilo Kindle;
**comunidade estilo Strava** — sessões de leitura como "atividades", feed social com kudos, e
**card compartilhável** de stats (páginas/tempo/PPM do livro) para postar em Stories. Card é local
(sem backend); feed social precisa de backend Supabase + moderação obrigatória (UGC, Apple 1.2).

**Stack:** React Native + Expo (TS, Expo Router, Dev Client/prebuild — não Expo Go puro),
SQLite/WatermelonDB offline-first, epubjs/react-native-readium, react-native-track-player
(áudio em background), Supabase opcional. Monetização freemium (premium = recursos de IA,
que têm custo por caractere) via RevenueCat/IAP.

**Onde estão as diretrizes completas:** arquivo `CLAUDE.md` na raiz de
`C:\Users\CASA\Claude\Projects\+leitura` (carregado automaticamente ao abrir sessão lá).
Inclui as regras críticas iOS/Android: áudio em background, IAP obrigatório p/ assinatura,
privacidade (App Tracking / Data Safety), chaves de API só no backend, roadmap em 4 fases.

**Como trabalhar (ver também [[usuario-leite-modding]]):** PT-BR, uma fase de cada vez,
incrementos pequenos e testáveis — o usuário testa cada passo.

**STATUS (2026-06-18):** Base criada com `create-expo-app` (Expo SDK 56, RN 0.85, expo-router,
TypeScript) na raiz `+leitura`. Rotas em `src/app` (abas "Ler" e "Biblioteca" via NativeTabs).
Fase 1 iniciada: `src/app/index.tsx` é o leitor estilo Kindle com 3 temas (claro/sépia/escuro),
controle de fonte e **Bionic Reading** (`src/components/bionic-text.tsx`, `src/theme/reading.ts`),
usando texto de exemplo (Dom Casmurro, domínio público). `npm install` ok, `tsc --noEmit` limpo.
Importador adicionado: `expo-document-picker` + store Zustand (`src/store/library.ts`); aba
Biblioteca importa .epub/.pdf, lista os livros e abre na aba Ler (banner "extração é o próximo
passo"). **Decisão do usuário:** PDF será **convertido para reflow** (extração de texto no device
via pdf.js, sem servidor) por padrão; modo página fiel = fallback p/ PDF complexo/escaneado (§4.9).
**Extração de PDF implementada:** `src/services/pdf-extractor.tsx` roda pdf.js (CDN jsdelivr) numa
WebView invisível (`react-native-webview`), lê o arquivo com `expo-file-system/legacy` (base64),
extrai só texto (ignora imagens) e reconstrói parágrafos por heurística de posição. **Gotcha Expo
Go (resolvido):** para LER o arquivo, `expo-document-picker` + `readAsStringAsync`/`File.base64()`
falham ("isn't readable" / "Missing READ permission" — fora do sandbox por-experiência). Solução que
funcionou: usar **`File.pickFileAsync`** (do expo-file-system) e **`picked.copy(new File(Paths.cache,
...))`** para o app; o leitor lê o uri copiado. Nome via SAF vem sem extensão ("document:38") → detectar
formato por **MIME (`picked.type`) ou bytes mágicos** (%PDF / PK), não por nome.
**ESCALA (limite conhecido):** converter o PDF inteiro de uma vez NÃO escala — pdf.js do CDN é lento
(~0,3s/página), livro de 1200 págs trava, e renderizar tudo sem virtualização trava o app; PDF muito
ilustrado (O Pequeno Príncipe) engasga no getDocument. MVP atual: cap **30 páginas** + **watchdog 45s**
(trava → erro amigável) + guarda de 25 MB. **Próximo p/ livro inteiro:** empacotar pdf.js offline,
extração preguiçosa/paginada, render virtualizado (FlatList), e modo "página fiel" p/ PDF complexo (§4.9).

**EPUB implementado (decisão: focar EPUB, formato nativo do app):** `src/services/epub-parser.ts` —
puro JS com **jszip** (sem WebView, sem CDN, leve). Descompacta o .epub, lê container.xml→OPF→spine,
extrai o TEXTO de cada capítulo (strip de HTML→parágrafos). O leitor (`src/app/index.tsx`) mostra
**um capítulo por vez com navegação (‹ Anterior / Próximo ›)**. Guarda de 30 MB. Import via
`File.pickFileAsync`+copy (mesmo do PDF). EPUB é o caminho recomendado p/ Bionic/áudio/dicionário.
**ANR resolvido (importante):** renderizar capítulo grande de uma vez dava "Expo Go isn't responding".
Corrigido com (1) **leitura preguiçosa**: `openEpub` lê só a estrutura, `loadChapter` lê 1 capítulo
sob demanda; (2) **render virtualizado**: `src/app/index.tsx` usa **FlatList** com `BionicParagraph`
por item (`src/components/bionic-text.tsx` exporta `splitParagraphs`+`BionicParagraph`) → só os
parágrafos visíveis montam. Confirmado funcionando: Moby Dick (Gutenberg), texto limpo, título/autor ok.
**Fluidez ao navegar (modelo Kindle):** o modelo "processa capítulo a cada toque" trava (htmlToText
pesado na thread única). Reescrito para **preparar o livro inteiro UMA vez** (`prepareEpub` em
`epub-parser.ts`, processa seção a seção cedendo a thread, com barra de progresso) → vira uma lista
plana de parágrafos num **scroll único virtualizado**; navegar capítulo = `scrollToIndex` (pulo
instantâneo, zero reprocessamento). `splitParagraphs` movido p/ `src/services/text-utils.ts`. Custo:
~poucos seg de "Preparando o livro… %" ao abrir (será 1x só quando houver persistência).
**Refinos de fluidez aplicados:** (1) render só do **capítulo atual** (fatia de `paragraphs`), não a
lista inteira — scrollToIndex numa lista gigante renderizava tudo até o alvo e travava; troca de
capítulo = `scrollToOffset(0)` + fatia nova. (2) **Capítulos reais**: `splitSectionIntoChapters` corta
as seções do Gutenberg nos títulos `<h1>–<h3>` → unidades pequenas (estilo Kindle). (3) `BionicParagraph`
em `React.memo`. Usuário: "deu uma melhorada". **Conclusão:** o resto da aspereza é **Expo Go dev mode**
(JS lento); só dá p/ julgar fluidez real num build de release. Leitor = bom o suficiente.
Para testar perf "de produção" sem build nativo: `npx expo start --no-dev --minify` (Expo Go roda o
bundle minificado/sem dev). Build nativo real depois: `npx expo run:android --variant release` (já tem
Android SDK) ou EAS — fica p/ Fase 4 (lojas).

**PERSISTÊNCIA (Fase 3) — feito:** store Zustand com `persist`+AsyncStorage (`@react-native-async-
storage/async-storage`) → biblioteca e posição de leitura sobrevivem ao recarregar. Arquivos importados
agora vão para **`Paths.document`** (permanente, não cache). Leitor salva/restaura o **capítulo**
(`positions[bookId]`, continua de onde parou). Biblioteca: **segurar o card remove** o livro (apaga arquivo).
**FUNCIONOU** (confirmado: biblioteca sobrevive + continua do capítulo). **Lição:** o middleware
`persist` (AsyncStorage E file) não hidratava de forma confiável no Expo Go → trocado por persistência
**MANUAL e síncrona**: `loadInitial()` lê com `f.textSync()` na criação da store, `useLibrary.subscribe`
regrava com `f.write()` (criando o arquivo antes: `if(!f.exists)f.create()`). Arquivo:
`Paths.document/leitura-library.json`.
**Cache do EPUB preparado (feito):** `loadPreparedCache/savePreparedCache/deletePreparedCache` em
`epub-parser.ts` (`Paths.document/prepared-<id>.json`); o leitor tenta o cache antes de `prepareEpub`
→ reabrir = instantâneo, sem "Preparando…". Removido o `[debug]` da Biblioteca. Remover livro apaga
arquivo + cache.

**DICIONÁRIO + MARCAÇÃO (feito, §2.2/§2.3):** tocar numa palavra no leitor abre um painel
(`src/components/word-panel.tsx`): **Marcar** (salva no banco de vocabulário, persistido na store +
arquivo) e **Significado** (busca básica em `api.dictionaryapi.dev`, inglês, sem chave). `BionicParagraph`
agora torna cada palavra tocável (`onWordPress(word, paragraph)`); guarda o parágrafo como `context`
(base p/ o significado CONTEXTUAL por IA = Fase 2, precisa backend §5). Banco de vocabulário visível
na aba Biblioteca (botão "Vocabulário" → Modal com lista + remover). `VocabWord` na store.
**Marca-texto (feito):** palavras marcadas ficam **realçadas no texto** (fundo por tema = campo
`highlight` em `ReadingThemes`); `BionicParagraph` recebe `markedSet`+`highlightColor`; helper
`cleanWord` em `text-utils.ts`. Botão "Marcar" é alternador (marca/desmarca) e o painel lê o vocab
direto da store (reativo).

**REFERÊNCIA VISUAL (roxo+verde) — ADICIONADA ao CLAUDE.md §2.7:** mockup aprovado do card de stats/
gamificação. Fundo gradiente roxo→quase-preto, destaques verde-neon com glow, rótulos lavanda, "trilha
do livro" verde neon (= mapa do Strava). Identidade da camada **social/stats** (o leitor segue sépia/
claro/escuro). Hex de referência no §2.7.

===== ESTADO ATUAL CONSOLIDADO (2026-06-19 — não se perder) =====
PRONTO (leitor): importar EPUB+PDF (File.pickFileAsync→copy p/ Paths.document; formato por MIME/magic
bytes); leitor Kindle (sépia/claro/escuro, fonte serifada, **Bionic**); EPUB com capítulos reais (split
<h1-3>), FlatList virtualizado + render só do capítulo atual; PDF curto→reflow (pdf.js em WebView, cap
30 pág, guarda 8MB, watchdog 45s); **persistência manual em arquivo** (`Paths.document/leitura-library.json`
via `loadInitial`/`subscribe`), continuar de onde parou, cache do EPUB preparado; dicionário+marcação
(tocar palavra→painel `word-panel.tsx`; banco de vocabulário; marca-texto).

PRONTO (camada social / Fases 3 + 5a): **REESTRUTURA DE NAVEGAÇÃO** — raiz virou `Stack`
(`src/app/_layout.tsx`) com grupo de abas `src/app/(tabs)/` (5 abas via NativeTabs em
`components/app-tabs.tsx` [+ `.web.tsx`]): **Leitura(index/hub) · Comunidade · Atividades · Conquistas ·
Perfil**. O **leitor agora é `src/app/reader.tsx`** (rota EMPILHADA, não aba — tela cheia sem barra,
botão Voltar); **Biblioteca = `src/app/biblioteca.tsx`** (empilhada, importa/lista; `importBookFlow`
exportada e reusada pelo hub); **Compartilhar = `src/app/compartilhar.tsx`** (empilhada). Os antigos
`src/app/index.tsx` e `explore.tsx` foram DELETADOS. Rota home = "/" (typed routes regeneram sozinhas).
- **Hub** (`(tabs)/index.tsx`): cabeçalho de perfil (`components/profile-header.tsx`: avatar/nível/
  emblemas), "Continuar lendo", carrossel da biblioteca, barras da semana.
- **Atividades**: resumo do dia/semana + totais + recordes (dados reais).
- **Conquistas**: grade de achievements estilo Steam (substituiu "Steam" do mockup, escolha do usuário).
- **Perfil**: cabeçalho + `StatsCard` + **seletor de tema** + Vocabulário (Modal).
- Gamificação derivada de dados reais em `src/services/progress.ts` (`deriveStats`, `computeAchievements`,
  nível = 1/30min, streak, last7, fmtHMS).
- **TEMA (60-30-10) — ver [[leitura-design-base-neutra]]:** base NEUTRA claro/escuro com alternância
  (Perfil→Aparência), roxo só acento / verde nas ações. Paleta `src/theme/ui.ts`, hook
  `src/hooks/use-ui.ts`, persistido em `store/library.ts` campo `uiTheme` ('system'|'light'|'dark').
  Decidido porque fundo 100% roxo cansava a vista. EXCEÇÃO marca: `stats-card.tsx`, `shareable-card.tsx`,
  `book-trail.tsx` mantêm o gradiente roxo→verde fixo (`src/theme/social.ts`) — são artefatos/imagem.
- **FASE 5a (card compartilhável) FEITA:** `components/shareable-card.tsx` (modelos 'escuro'/
  'transparente'/'compacto', altura dirigida pelo conteúdo — NÃO usar aspectRatio fixo, cortava) +
  `components/book-trail.tsx` (trilha do livro em `react-native-svg`, glow por traços empilhados) +
  tela `compartilhar.tsx` estilo Strava: **carrossel** de modelos + **barra** (Story·Copiar·Salvar·
  Link·Mais) capturando com `react-native-view-shot` (`captureRef`), `expo-sharing`, `expo-clipboard`.
- **GOTCHA Expo Go (resolvido):** `expo-media-library` (v "Next") faz `requireNativeModule(
  'ExpoMediaLibraryNext')` no topo do módulo → quebra no Expo Go; `import()` dinâmico NÃO ajuda (resolve
  com funções undefined). Solução: detectar Expo Go por `Constants.executionEnvironment==='storeClient'`
  e nem importar; Salvar cai no share sheet (`expo-sharing`). `react-native-view-shot` só falha se
  `captureRef` for chamado (import é seguro) — provável que funcione no Expo Go; confirmar no aparelho.
Deps instaladas p/ 5a: react-native-view-shot, expo-sharing, expo-media-library, react-native-svg,
expo-clipboard (via `npx expo install`). app.json: plugins expo-sharing + expo-media-library.
Tudo verifica com `tsc --noEmit` (limpo). **Usuário confirmou: "tudo funcionando".**

===== BACKEND SUPABASE + BYOK (iniciado 2026-06-19) =====
**DECISÃO DO USUÁRIO:** fazer o backend Supabase, MAS a IA é **BYOK (Bring Your Own Key)** — o usuário
integra a chave DELE (OpenAI/ElevenLabs/Anthropic), guardada **no aparelho** via `expo-secure-store`,
chamadas vão **direto do device** ao provedor (custo por caractere é do usuário). Isso DESACOPLA: a IA
(Fase 2) NÃO precisa de backend; Supabase fica só p/ **auth + sync + feed social** (Fase 5b). CLAUDE.md
§5 e §6 atualizados com isso. (Antiga regra "chave só no backend" valia p/ chave NOSSA; se um dia
houver IA gerida, aí sim via Edge Function.)
**FEITO até agora:** deps instaladas (`@supabase/supabase-js`, `react-native-url-polyfill`,
`expo-secure-store` via `npx expo install`). Plugin `expo-secure-store` + bloco `extra`
(supabaseUrl/supabaseAnonKey vazios) no `app.json`. Cliente em `src/services/supabase.ts`: lê config de
`Constants.expoConfig.extra` OU env `EXPO_PUBLIC_SUPABASE_URL/ANON_KEY` (prioridade); `supabase` é `null`
se não configurado (não quebra o app); exports `isSupabaseConfigured`, `requireSupabase()`. Auth com
AsyncStorage (persistSession, detectSessionInUrl:false). `tsc` limpo.
**PROJETO SUPABASE CRIADO (2026-06-19):** usuário criou. URL `https://tffpsfjrqgayrosgmsxy.supabase.co`,
publishable key `sb_publishable_2nyZ...` (NOVO formato de anon key; pública, ok no client) — preenchidas
em `app.json` extra. Conexão validada via curl (`/auth/v1/health`=200, provider email=true).
`mailer_autoconfirm=FALSE` → pedi ao usuário DESLIGAR "Confirm email" (Auth→Sign In/Providers→Email) p/
testar liso no dev. ⚠️ usuário colou a senha do banco no chat → avisei p/ resetar em Settings→Database.

**AUTH IMPLEMENTADO (2026-06-19) — login OPCIONAL (CLAUDE.md §6, ler offline é grátis, só social exige
conta):** `src/store/auth.ts` (Zustand: session/user/initializing/configured; init único no import via
`getSession`+`onAuthStateChange`; actions `signUp`/`signIn`/`signOut`; `displayName(user)`; erros
traduzidos PT-BR). Tela `src/app/login.tsx` (e-mail+senha, alterna Entrar/Criar conta, KeyboardAvoiding;
trata needsConfirmation) registrada como modal em `_layout.tsx`. Perfil (`(tabs)/perfil.tsx`) ganhou
seção "Conta": deslogado→"Entrar/Criar conta"→/login; logado→nome+email+Sair; sem config→aviso.
ProfileHeader agora usa `displayName(user)` (era fixo "Leitor"). `tsc` limpo. **GOTCHA typed routes:**
nova rota /login não existia nos tipos gerados → `tsc` falhava; regenerei rodando `npx expo start --no-dev`
em background ~6s até `.expo/types/router.d.ts` incluir login, depois matei o Metro (porta 8081).
**AUTH TESTADO E APROVADO pelo usuário (2026-06-19):** criar conta/entrar/sair/persistência OK.

**BUGS BIBLIOTECA corrigidos (2026-06-19):** (1) **duplicata** — `importBookFlow` (biblioteca.tsx) agora
deduplica por (formato+nome+tamanho) via `useLibrary.getState().books`; se duplicado, Alert
Cancelar/Abrir/Importar-mesmo-assim (commit extraído p/ reuso). (2) **remover não era descoberto** (só
long-press) → adicionado **botão 🗑 visível** em cada card + dica "Toque para abrir · 🗑 para remover".

**PERFIL NO BANCO (2026-06-19) — feito (falta usuário rodar SQL + testar):**
- **`supabase/schema.sql`** (rodar UMA VEZ no SQL Editor; idempotente): tabela **`profiles`** (id→auth.users,
  name, avatar_url, timestamps) + **`reading_activities`** (sessões estilo Strava: book_title, seconds,
  pages, visibility default 'private' §4.8) — **RLS ligado** em ambas (cada um só mexe no próprio;
  profiles legível por autenticados p/ feed futuro). Trigger `handle_new_user` cria profile no cadastro;
  `touch_updated_at`.
- **`src/store/profile.ts`** — Zustand; carrega profile quando a sessão muda (`useAuth.subscribe`), cria
  linha padrão se faltar (usuário antigo), `updateProfile({name,avatar_url})`. **`ProfileEditor`**
  (`components/profile-editor.tsx`) = modal nome + **avatar emoji** (set de 12; foto fica p/ depois).
- ProfileHeader aceita `avatar` (emoji) e mostra; Perfil e HUB usam `profile.name || displayName(user)`.
  Perfil: card de conta vira "Editar perfil" (abre o modal) + Sair. `tsc` limpo.
- **AVATAR = emoji por enquanto** (sem Storage/foto). avatar_url guarda o emoji.

**TESTADO E APROVADO pelo usuário (2026-06-19):** SQL rodou OK, editar perfil (nome/avatar) funciona,
biblioteca exclui itens. Bloco do banco fechado.

**BYOK + DICIONÁRIO CONTEXTUAL (Fase 2) — feito (2026-06-19), falta usuário testar:**
Decisão de arquitetura (registrei): em RN/Expo Go os SDKs Node (anthropic/openai) não rodam bem e pesam →
chamo as APIs via **`fetch`** com o formato de fio correto (conferido na skill claude-api). Suporta
**OpenAI e Anthropic (Claude)**.
- `src/services/ai/providers.ts`: `PROVIDERS` (label/defaultModel/models/keyHint/keysUrl; OpenAI
  default `gpt-4o-mini`, Anthropic default `claude-haiku-4-5`), `validateKey` (GET /v1/models — barato,
  não gasta token; OpenAI Bearer, Anthropic x-api-key + anthropic-version:2023-06-01), `chatJSON`
  (OpenAI chat/completions com response_format json_object; Anthropic /v1/messages, pega content[].text).
- `src/store/ai.ts`: Zustand {provider,model,hasKey,ready}; chave em **expo-secure-store** (key=`leitura_ai_key`,
  cfg=`leitura_ai_cfg`); `getApiKey()` (só na hora de chamar), `saveAIConfig`, `clearAIKey`. Chave NUNCA
  vai pro Supabase nem é logada.
- `src/services/ai/dictionary.ts`: `contextualLookup(word, context)` → JSON {significado, sinonimos,
  antonimos, exemplos[3]} em PT-BR; envia só palavra+parágrafo (§5); parse tolerante a ```json```.
- Tela `src/app/integracoes.tsx` (empilhada, registrada em _layout): escolher provedor, modelo (input+
  chips), colar chave, **validar e conectar**, status, desconectar, link "onde consigo a chave".
- `word-panel.tsx`: botão **"✨ Explicar no contexto (IA)"** → renderiza significado+sin/ant+exemplos;
  se sem chave, botão "Configurar IA →" leva a /integracoes.
- Perfil: seção "Inteligência Artificial" → card Integrações (mostra Conectado·Provedor ou convite).
- `tsc` limpo (regenerei typed routes p/ /integracoes via expo start ~15s, matei Metro).
- **expo-secure-store** já instalado (veio no setup do Supabase) + plugin no app.json.

**BYOK TESTADO E APROVADO pelo usuário (2026-06-19):** validar chave + "Explicar (IA)" funcionam.

**GEMINI (provedor grátis) + AUDIOBOOK TTS — feito (2026-06-19), falta usuário testar:**
- **Gemini** virou 3º provedor BYOK (free tier do Google AI Studio, SEM cartão). `providers.ts`:
  `AIProvider` agora 'openai'|'anthropic'|'gemini'; endpoint `generativelanguage.googleapis.com/v1beta`,
  header `x-goog-api-key`; default `gemini-2.5-flash` (tb 2.5-flash-lite/2.0-flash); validate=GET /models;
  chatJSON usa systemInstruction + contents + generationConfig.responseMimeType:'application/json'.
  Tela Integrações: PROVIDER_IDS=['gemini','openai','anthropic'], chips com flexWrap (3 cabem).
- **AUDIOBOOK ASSISTIDO GRÁTIS (§2.1)** via **expo-speech** (voz do APARELHO, sem chave, offline,
  funciona no Expo Go; confirmado na doc: tem `onBoundary` p/ palavra, suporta pt-BR/rate). Instalado
  `expo-speech ~56.0.3`. Hook `src/hooks/use-read-aloud.ts`: lê os parágrafos do capítulo atual em
  sequência; expõe {active,playing,paraIndex,wordStart}; start/pause/resume/stop/cycleRate
  (rates 0.75–1.5). pause=stop guardando índice (expo-speech pause só iOS) → resume refala o parágrafo.
  Para o áudio no unmount.
- `BionicParagraph` ganhou `spokenStart`+`spokenColor` → destaca a palavra falada (karaokê) calculando
  offset de char por token. Reader: botão "🔊 Ouvir" no cabeçalho, barra inferior (velocidade/⏸▶/⏹),
  auto-scroll p/ o parágrafo falado, para ao trocar capítulo. renderItem lê estado via `readRef` +
  `extraData` (só o parágrafo ativo re-renderiza). Cor karaokê = `t.accent+'55'`.
- **Limite conhecido:** `onBoundary` (destaque palavra-a-palavra) é confiável no iOS; no Android depende
  da engine de TTS — pode não destacar, mas o ÁUDIO toca. Vozes ultrarrealistas = upgrade BYOK (OpenAI/
  ElevenLabs/Gemini TTS) depois. `tsc` limpo.

**GEMINI + AUDIOBOOK GRÁTIS TESTADOS E APROVADOS pelo usuário (2026-06-19):** funcionam; áudio do
expo-speech soa robótico (esperado p/ TTS grátis do device). Usuário pediu voz humana.

**VOZ HUMANA — ElevenLabs BYOK (decisão do usuário 2026-06-19):** manter grátis = chave free-tier do
PRÓPRIO usuário (~10k chars/mês); acesso "gerido pago" fica p/ depois. Escolhido ElevenLabs por ser o
mais realista E ter timestamps por caractere (karaokê real). Confirmado na doc: expo-audio tem
createAudioPlayer/.play/.currentTime/listener playbackStatusUpdate(didJustFinish) e está no Expo Go;
ElevenLabs POST /v1/text-to-speech/{voice}/with-timestamps, header xi-api-key, model
`eleven_multilingual_v2` (PT ok), resposta {audio_base64, alignment.character_start_times_seconds[]}.
**DIVIDIDO EM 2 PASSOS (incrementos testáveis):**
- **PASSO 1 FEITO E TESTADO/APROVADO pelo usuário (2026-06-20) — config + testar voz + contador:**
  instalado `expo-audio ~56.0.12` (plugin no app.json). `src/services/ai/tts.ts`: `listVoices` (GET
  /voices, valida chave), `synthesize` (with-timestamps → {audioBase64, alignment{starts[],ends[]}}),
  `charIndexAt(t)`, **`getUsage`** (GET /user/subscription → {used,limit,resetUnix}; campos
  character_count/character_limit/next_character_count_reset_unix). Defaults: voz Rachel
  `21m00Tcm4TlvDq8ikWAM`, modelo `eleven_multilingual_v2`. Store `ai.ts` ganhou config TTS separada
  (ttsVoice/ttsVoiceName/ttsModel/hasTtsKey; secure-store `leitura_tts_key`/`_cfg`;
  getTtsKey/saveTtsConfig/clearTtsKey). Tela Integrações, seção "Voz da leitura": colar chave →
  "Validar e buscar vozes" (lista vozes em chips) → escolher voz → "▶ Testar voz" (sintetiza frase,
  grava base64 via `expo-file-system/legacy` writeAsStringAsync Base64 em cache/tts/sample.mp3, toca com
  createAudioPlayer) → **CONTADOR de caracteres** (barra usados/limite ~10k free + restantes + data de
  renovação; recarrega ao abrir/validar/testar; fica vermelho ≥90%). `tsc` limpo. Free tier ElevenLabs
  = 10.000 caracteres/mês.
- **PASSO 2 FEITO (2026-06-20) — karaokê premium no leitor (falta usuário testar no aparelho):**
  Motor unificado em `src/hooks/use-read-aloud.ts` (REESCRITO): mesma interface de antes
  ({state,rate,start,pause,resume,stop,cycleRate}); `start()` escolhe o motor por `hasTtsKey`
  (lido de `useAI`). `ReadAloudState` ganhou `loading:boolean` + `engine:'device'|'premium'`.
  - **Motor GRÁTIS** = expo-speech (igual antes, voz do aparelho).
  - **Motor PREMIUM** = ElevenLabs: `getOrSynthesize(parágrafo)` (cache→chave→synthesize) →
    `createAudioPlayer({uri},{updateInterval:60})` → listener `playbackStatusUpdate`:
    `charIndexAt(alignment, currentTime)` vira `wordStart` (karaokê), `didJustFinish`→próximo
    parágrafo. **pause/resume = player.pause()/play()** (mantém posição, sem re-sintetizar).
    `cycleRate` aplica `player.playbackRate` AO VIVO (currentTime é tempo de mídia → alinhamento
    continua casando). **Prefetch** do parágrafo i+1 (fire-and-forget) p/ reduzir a pausa.
    **Fallback**: sem chave OU falha de síntese → cai p/ a voz grátis (`speakFrom(i)`).
  - **CACHE (§5, não regerar):** `src/services/ai/tts-cache.ts` — memória + disco em
    `${cacheDirectory}tts-cache/<hash>.mp3`+`.json`; `hashKey(voz|modelo|texto)` djb2. **Dedupe de
    sínteses em voo** (`inflightRef` Map por hash) p/ prefetch+avanço não gerarem o mesmo trecho 2x
    e gastar cota em dobro.
  - **Reader (`reader.tsx`):** botão do cabeçalho mostra **🎙️ Ouvir** quando há voz premium (senão
    🔊); barra de áudio mostra **"⏳ Gerando áudio…"** (com spinner no ▶) e **"🎙️ Voz premium · ¶ x/y"**.
    Importa `useAI` (`hasTtsKey`). Mecanismo de destaque `spokenStart`/`extraData` já existia.
  - `tsc` limpo. **Risco a confirmar no aparelho:** `onBoundary` do device é fraco no Android (áudio
    toca, destaque pode falhar) — mas o PREMIUM usa timestamps reais, então o karaokê deve funcionar
    nas duas plataformas. expo-audio já provou tocar mp3 local no Expo Go (teste do Passo 1).

**TTS PREMIUM TESTADO E APROVADO pelo usuário (2026-06-20):** karaokê com voz humana funciona.

===== 3 FRENTES (2026-06-20) — vozes do aparelho + catálogo online + contador no leitor =====
Usuário pediu "fazer todos". Referência dele: **KyBook3** (iPhone) dá várias vozes SEM pedir API.
Insight registrado: KyBook usa as **vozes do PRÓPRIO SO** (Apple/Google), incl. as "Aprimoradas"
(Enhanced) que o usuário baixa de graça nas configs do aparelho — é o MESMO mecanismo do nosso
`expo-speech`. Só faltava deixar **escolher** a voz. Estratégia de voz agora em 3 níveis, custo nosso = 0:
(1) **grátis bom** = vozes do aparelho com seletor; (2) **premium BYOK** = ElevenLabs (chave do usuário,
karaokê perfeito); (3) gerido pago = futuro. **Custo/peso do seletor: ZERO** (expo-speech já instalado;
vozes ficam no SO, não no bundle). Premium tem PRIORIDADE quando há chave ElevenLabs.

- **FRENTE 1 — Seletor de vozes do aparelho (feito, falta usuário testar):**
  `src/services/ai/tts-device.ts`: `listDeviceVoices()` (Speech.getAvailableVoicesAsync → filtra pt,
  Aprimoradas/pt-BR no topo; campos identifier/name/language/enhanced), `previewDeviceVoice(id)`.
  Store `ai.ts`: novos `deviceVoice`/`deviceVoiceName` (secure-store `leitura_device_voice`) +
  `saveDeviceVoice`/`clearDeviceVoice`; carregados no init. Hook `use-read-aloud.ts`: motor GRÁTIS passa
  `voice: deviceVoiceRef.current` ao `Speech.speak`. Tela Integrações: a seção "Voz da leitura" virou
  2 blocos — "🗣️ Voz do aparelho · grátis" (lista vozes em chips, ✨=Aprimorada, toca prévia ao escolher,
  "Usar voz padrão", dica de como baixar vozes melhores no iOS/Android) e "🎙️ Voz premium · ElevenLabs"
  (o conteúdo antigo). Reader: botão mostra 🎙️/🔊 conforme premium.
- **FRENTE 3 — Contador de caracteres NO LEITOR (feito):** o usuário não achava o contador (ele só estava
  em Integrações, condicional a hasTtsKey+usage carregado). Agora o leitor (`reader.tsx`) busca `getUsage`
  UMA vez ao iniciar sessão premium e a barra de áudio mostra "🎙️ Voz premium · ¶ x/y · N restantes".
- **FRENTE 2 — Catálogo online "Explorar" (feito, falta usuário testar):** SEM aba nova (já temos 5).
  `src/services/catalog.ts`: API **Gutendex (Project Gutenberg)** — JSON aberto, sem chave, só domínio
  público (§4.3). `searchCatalog(query, lang 'pt'|'en'|'all', page)` → {results: CatalogBook{id,title,
  author,language,epubUrl,coverUrl}, hasNext}; filtra só itens com epub. Tela `src/app/explorar.tsx`
  (rota EMPILHADA, registrada em `_layout.tsx`): busca + chips de idioma + lista com capa/título/autor +
  "Baixar" → `File.downloadFileAsync(epubUrl, Paths.document/book-*.epub)` → vira `ImportedBook` via
  `addBook` (mesmo modelo da importação) → abre /reader. Dedup por título (se já existe, abre). Acesso:
  botão **🔎 Explorar** no cabeçalho da Biblioteca (`biblioteca.tsx`). Acervo PT é pequeno, EN é enorme
  (default = Português). **GOTCHA typed routes** (de novo): /explorar não existia nos tipos → regenerei
  com `npx expo start --no-dev` em background até `.expo/types/router.d.ts` incluir, depois matei o Metro.
Tudo verifica com `tsc --noEmit` (limpo).

**PENDÊNCIAS / PRÓXIMO (combinar):**
- **Sync de ATIVIDADES p/ o banco:** tabela `reading_activities` pronta, mas falta o código que empurra
  as sessões de leitura locais p/ lá.
- **Áudio em background p/ o TTS premium** (§4.1): hoje toca em foreground; tela bloqueada/app em 2º
  plano exige `setAudioModeAsync({shouldPlayInBackground:true})` + UIBackgroundModes/Foreground Service
  (ou migrar p/ react-native-track-player). Fica p/ depois.
- **Catálogo — FONTES VERIFICADAS (2026-06-20), NÃO repetir o trabalho:** usuário pediu mais acervos
  (BibliON, Senado, Feedbooks, Standard Ebooks). Probei todas: **só Project Gutenberg (Gutendex) é
  aberto+curado**. Standard Ebooks=401 (exige login agora); Feedbooks=403 (bloqueia bots);
  BibliON=empréstimo com DRM (§4.3); Senado/Livraria=site sem API. **Internet Archive** tem API aberta
  e o mecanismo funciona (advancedsearch→metadata→download, baixou EPUB 13MB ok) — MAS mesmo excluindo
  `inlibrary`/`printdisabled` a busca surge PIRATEADA/OFENSIVA (top PT por downloads: "Halim" do Milton
  Hatoum c/ copyright, Conan, Mein Kampf). **REJEITADO** por §4.3+§4.8. Catálogo virou **multi-fonte na
  arquitetura** (`catalog.ts`: `CatalogSource`, `searchCatalog(source,...)`, `resolveEpubUrl` p/ resolver
  link do Archive via metadata) mas **SOURCES expõe só gutenberg** (o código do Archive fica gated p/ se
  algum dia houver feed curado). Explorar ganhou **QUICK_SEARCHES** (Machado, Eça, Aventura, Romance, FC,
  Poesia) p/ descoberta; seletor de fonte só aparece se SOURCES.length>1. Caminho legal p/ acervos PT
  (BibliON/Senado): usuário baixa no navegador e **importa** (fluxo de importação já existe).
  Paginação "carregar mais" (hasNext já vem do serviço) = futuro.
- Foto de avatar (Supabase Storage + image-picker) = incremento futuro.

===== LEITURA CONTÍNUA estilo KyBook (2026-06-20) — reescrita do reader.tsx =====
Usuário pediu (referência KyBook3): livro inteiro num **scroll único**, SEM Anterior/Próximo, com
**marcador de progresso**; reclamou de "leve travadinha" ao trocar de capítulo. A travada vinha de
**fatiar o capítulo atual** (recriava a lista a cada navegação). REESCRITO p/ leitura contínua:
- `paragraphs` agora = **livro INTEIRO** (`epubBook.data.paragraphs`), não mais a fatia do capítulo.
  FlatList virtualiza (só monta o visível). Removidos: `currentChapter` como estado, `goToChapter`,
  `showNav`, a navBar Anterior/Próximo, o efeito que parava o áudio ao trocar capítulo, o `chapterParas`.
- **Capítulos viram títulos INLINE**: `chapterTitleAt` (Map start→title); `renderItem` desenha o título
  acima do parágrafo que inicia o capítulo (estilo livro). `currentChapter` agora é DERIVADO do scroll
  via `chapterAt(chapters, topIndex)`.
- **Posição/progresso pelo scroll**: `onViewableItemsChanged` (config estável via useRef) seta `topIndex`
  (parágrafo no topo); barra de progresso fixa abaixo do cabeçalho mostra "Capítulo · NN%"
  (`readProgress = topIndex/(total-1)`). Áudio "Ouvir" começa de `topIndexRef.current` (parágrafo visível),
  não do 0.
- **RESTAURAR posição = por OFFSET de rolagem** (NÃO scrollToIndex!). Salva `positions[bookId]` = offset Y
  (em `onMomentumScrollEnd`/`onScrollEndDrag`); ao abrir, `scrollToOffset({offset:savedY})` num
  requestAnimationFrame, uma vez (`restoredRef`). **Por quê:** o scar antigo era scrollToIndex em lista
  gigante renderizar tudo até o alvo e travar — offset não mede itens, então não trava. Trade-off: se a
  fonte mudar entre sessões o offset desvia um pouco (fonte reseta ao padrão a cada abertura → ok); em
  livro enorme pode parar um tico antes do ponto exato. `positions` só é usado no reader (repurposado de
  nº de capítulo p/ offset; valores antigos viram offset ~0 = topo, inofensivo).
- `tsc` limpo. **Falta usuário testar fluidez** (Expo Go é lento; julgar de verdade em release). Possível
  futuro: TOC/sumário p/ pular capítulo (pulo distante precisa de estratégia que não congele).
**Obs. do usuário:** alguns livros do Gutenberg parecem "só demonstrativos" — investigar (pode ser EPUB
que o nosso parser extrai pouco, ou obra curta); avaliar filtrar resultados muito pequenos no catálogo.

===== LIMITES DE TAMANHO AUMENTADOS (2026-06-20) — "ler arquivos >9MB" =====
Usuário batia no bloqueio ~9MB (era o guard de PDF de 8MB). Aumentados:
- **PDF:** `reader.tsx` MAX_PDF_BYTES 8→**25 MB**; `pdf-extractor.tsx` guard de base64 11→**35 MB** (~25 MB
  de arquivo) e **MAX_PAGES 20→150**. Seguro aumentar páginas porque o **watchdog (45s) reseta a cada
  página** (onMessage→bumpWatchdog, linha ~189), não é total. Mensagens atualizadas p/ "~25 MB".
- **EPUB:** `epub-parser.ts` MAX_EPUB_BYTES 30→**60 MB** (leitura é preguiçosa+virtualizada → baixo risco).
- **Tradeoff honesto:** o PDF ainda é carregado INTEIRO como base64 e injetado na WebView via
  `injectJavaScript(JSON.stringify(b64))` — string de ~35 MB. OK no emulador 32GB do usuário, mas pode
  pesar/OOM em celular fraco. PDFs >150 págs ainda cortam nas 150 primeiras (cap). **Fix real (futuro):**
  extração preguiçosa/paginada sem carregar o arquivo todo + pdf.js empacotado offline (já era pendência).
  `tsc` limpo.

===== MARCADORES + "OUVIR A PARTIR DAQUI" (2026-06-20) =====
Usuário não notou a barra de progresso (era fina demais) e pediu marcador de página + escolher de onde
o áudio começa.
- **Marcadores (bookmark):** store `library.ts` ganhou `Bookmark{id,offset,index,snippet,progress,createdAt}`
  + `bookmarks: Record<bookId, Bookmark[]>` (persistido) + `addBookmark`/`removeBookmark`. **Salto por
  OFFSET** (scrollToOffset), nunca scrollToIndex (não trava). Componente `components/bookmarks-sheet.tsx`
  (folha inferior: posição atual + "🔖 Marcar esta página" + lista com % e trecho, tocar=pular, 🗑=remover).
- **Barra de progresso virou TOCÁVEL** (reader.tsx): mostra 🔖[N] + capítulo + % e abre a BookmarksSheet
  (assim o progresso fica perceptível). offset atual rastreado em `offsetRef` via `onScroll`
  (scrollEventThrottle 64, só ref, barato); `addBookmarkHere` usa offsetRef+topIndex.
- **"▶ Ouvir a partir daqui":** `BionicParagraph` agora repassa o ÍNDICE do parágrafo no toque
  (`onWordPress(word, paragraph, paraIndex)` + prop `paraIndex`); reader guarda `selectedWord.index`;
  `WordPanel` ganhou prop `onListenFromHere` (botão) → `read.start(index)`. Tocar palavra→painel→ouvir
  daquele parágrafo (premium ou device). `tsc` limpo.

**FIX karaokê não sincronizava (2026-06-20):** ao testar "Ouvir a partir daqui" (premium), o áudio tocava
mas o destaque não acompanhava. Causa = **regressão da rolagem contínua**: eu tinha posto
`removeClippedSubviews` na FlatList, que no Android impede o item visível de re-renderizar com o novo
`extraData` (o destaque ficava congelado). **Removido** + destaque mais forte (`spokenColor` accent+'99'
em vez de '55'). NOTA p/ debug futuro: a alinhamento do ElevenLabs usa `alignment` (não
`normalized_alignment`) que casa 1:1 com o texto ENVIADO → o índice de char mapeia certo (não é problema
de normalização tipo "Sr."). O `extraData={read.state}` + `readRef` é o mecanismo de re-render; mantê-lo.
**Demora do premium** = síntese ElevenLabs do parágrafo é uma chamada de rede (inerente, ~1-3s); voz
grátis do aparelho começa na hora.

**FIX "Ouvir a partir daqui" começava do início do PARÁGRAFO, não da PALAVRA (2026-06-20):** usuário
esclareceu — o sync funciona, o que faltava era começar na palavra tocada. Agora passa o **offset do
caractere** da palavra por toda a cadeia: `BionicParagraph.onWordPress(word, paragraph, paraIndex,
charOffset)` (o `start` do token); reader guarda `selectedWord.charOffset`; `read.start(index, charOffset)`.
No hook: **premium** sintetiza o parágrafo e dá **seek** até `alignment.starts[charOffset]` (no 1º
`playbackStatusUpdate` com `isLoaded`, via `player.seekTo`); **device** fala `paras[i].slice(charOffset)`
e soma o offset no `onBoundary`. Offset só vale no 1º parágrafo (próximos começam do 0). `tsc` limpo.
**"Ouvir a partir daqui" TESTADO E APROVADO (2026-06-20):** começa na palavra clicada. (Possível "blip"
de ~60ms do início antes do seek — aceitável.)

**FIX destaque ATRASADO + otimização (2026-06-20):** depois do fix de sync, o karaokê ficou laggando.
Causa: o parágrafo falado **re-dividia o texto (regex split) e recriava TODAS as palavras a cada ~60ms**
(o `content` useMemo dependia de spokenStart). REESCRITO `bionic-text.tsx`: o split + negrito + marca-texto
viram um `tokens` memoizado (deps SEM spokenStart) e **cada palavra é um componente `Word` memoizado** —
quando a palavra falada muda, só as 1–2 palavras afetadas re-renderizam.
**AINDA travava no Expo Go → 2º reforço (2026-06-20):** (1) **destaque por PALAVRA, não por caractere** —
helpers `computeWordStarts`/`wordStartFor` no hook; o listener premium só dá `setState` quando MUDA de
palavra (~2-4x/s em vez de ~16x/s). (2) **Botão ✨ na barra de áudio liga/desliga o karaokê** (`karaoke`
state no reader; `spokenStart` só passa se ligado). (3) `extraData={karaoke ? read.state :
read.state.paraIndex}` → com o destaque OFF a lista só reconcilia ao trocar de parágrafo (áudio liso).
Device (expo-speech) já era por palavra (onBoundary). `tsc` limpo. Falta usuário confirmar fluidez.

===== REVISÃO DE SEGURANÇA (2026-06-20) — pedido do usuário (conversa com Gemini) =====
Aplicado o que era viável:
- **BYOK / chaves:** confirmado `grep` — **ZERO `console.*` no `src`** (chave nunca logada); clear*Key já
  chamam `SecureStore.deleteItemAsync`. OK, nada a mudar.
- **Supabase RLS (`supabase/schema.sql`):** achei e corrigi um furo — a policy de UPDATE de
  `reading_activities` não tinha **`WITH CHECK`** → dono poderia trocar o `user_id` da própria linha p/
  outro. Adicionado `with check (auth.uid() = user_id)`. (Profiles já tinha with check.) **SELECT de
  atividades segue SÓ do dono** (privado por padrão §4.8) — NÃO adicionei `OR visibility='public'` que o
  Gemini sugeriu, porque o feed/moderação (Fase 5b) ainda não existem; só abrir público quando houver
  denúncia/bloqueio. **Usuário precisa re-rodar o schema.sql** no SQL Editor.
- **WebView do PDF (`pdf-extractor.tsx`):** blindada — `allowFileAccess={false}`,
  `allowFileAccessFromFileURLs={false}`, `allowUniversalAccessFromFileURLs={false}`,
  `setSupportMultipleWindows={false}`, `domStorageEnabled={false}`; `onMessage` agora valida tipo e
  campos (string/number) — só aceita o JSON do nosso parser.
- **Moderação UGC (Apple 1.2):** criado `src/services/moderation.ts` (`containsProfanity`, blocklist
  PT+EN conservadora, casa palavra inteira sobre texto normalizado) e aplicado no `ProfileEditor.save`
  (bloqueia nome ofensivo antes de subir). **Denúncia/bloqueio/contato completos = Fase 5b** com o feed
  (Comunidade é mock hoje; quando vier, criar tabela `blocks` + botões report/block). `tsc` limpo.
- **Pedido do usuário:** cópia desta memória salva no projeto em `docs/MEMORIA-PROJETO.md`.
**Usuário precisa testar:** Perfil→Inteligência Artificial→Integrações→colar chave (OpenAI sk-... ou
Anthropic sk-ant-...)→Validar e conectar; depois abrir um livro, tocar numa palavra→"✨ Explicar (IA)".

PRÓXIMO (a combinar) — recomendado nesta ordem:
1. **Dev build** (`npx expo prebuild` + build dev) — destrava Salvar-na-galeria e sticker no Story do
   Instagram (Expo Go limita; CLAUDE.md §3). Passo de infra, testa "de verdade" iOS+Android.
2. **Backend Supabase** → abre Fase **2** (IA: dicionário contextual + TTS sincronizado, chaves só no
   backend §5) e Fase **5b** (feed social real — Comunidade hoje é só PRÉVIA mock; precisa moderação/
   denúncia/bloqueio §4.8 + visibilidade privada por padrão).
Pendências menores: card de stats não rastreia "páginas"/"livro concluído" (mostra nº de livros + dias);
nome de usuário fixo "Leitor" (sem login ainda). Rodar com `npx expo start`.

**TESTE/AMBIENTE:** O Expo Go do iPhone do usuário está travado no **SDK 54** (App Store), mas o
projeto é **SDK 56** → no iPhone dá "requires a newer version of Expo Go". Decisão: **manter SDK 56**
e testar via **emulador Android** (no Android o Expo instala o Expo Go compatível automaticamente).
PC do usuário: sem Android Studio ainda; Hyper-V presente (virtualização OK, WHPX); 32 GB RAM. NÃO
sugerir downgrade de SDK nem testar via iPhone Expo Go. iOS Simulator não roda no Windows.

===== DEV BUILD ANDROID — FEITO E FUNCIONANDO (2026-06-20) =====
**AMBIENTE ATUALIZADO (a nota "sem Android Studio" acima ficou DESATUALIZADA):** o usuário JÁ instalou
Android Studio + SDK + criou emulador. Caminhos confirmados:
- **Android SDK:** `C:\Users\CASA\AppData\Local\Android\Sdk` (platform android-36.1, build-tools 36.1.0/37.0.0,
  platform-tools/adb 37.0.0, emulator, system-image android-37.0; SEM NDK — Expo baixa se precisar).
- **JDK:** o **JBR embutido no Android Studio = OpenJDK 21** em `C:\Program Files\Android\Android Studio\jbr`.
  O `java` do PATH é **Java 8** (velho demais p/ Gradle) e `JAVA_HOME` está vazio.
- **Emulador criado:** AVD `Medium_Phone`. `eas` NÃO instalado (build é LOCAL, não nuvem).
**O QUE FOI FEITO (passos do dev build local — repetir se precisar regenerar):**
1. `app.json`: adicionado **`android.package: "com.leiteneto.leitura"`** (era ausente). iOS bundleId fica p/ depois.
2. `npx expo prebuild --platform android --clean` → gera `android/` (gitignored, regenerável). Rodar DEPOIS de
   instalar `expo-dev-client` (`npx expo install expo-dev-client`) p/ ele integrar.
3. **`android/local.properties`** (criar à mão; o `--clean` apaga): `sdk.dir=C\:\\Users\\CASA\\AppData\\Local\\Android\\Sdk`.
4. **`android/gradle.properties`**: adicionado `org.gradle.java.home=C\:\\Program Files\\Android\\Android Studio\\jbr`
   (FIXA o JDK 21; sem isso o Gradle pega o Java 8 e morre com "requires JVM 17 or later"). ⚠️ `--clean` regenera
   esse arquivo → **re-adicionar esta linha** se rodar prebuild --clean de novo.
5. `npx expo run:android` (1ª vez ~15-30 min: baixa Gradle 9.3.1 + AAR do RN de 255 MB; instala no emulador + sobe Metro).
**BUG GRADLE 9 (resolvido, mas FRÁGIL):** o Expo SDK 56 gera wrapper **Gradle 9.3.1**, mas o `@react-native/gradle-plugin`
(RN 0.85.3) fixa **foojay-resolver-convention 0.5.0**, que referencia `JvmVendorSpec.IBM_SEMERU` (REMOVIDO no Gradle 9)
→ build falha em "JvmVendorSpec does not have member field IBM_SEMERU". **FIX:** editar
`node_modules/@react-native/gradle-plugin/settings.gradle.kts` linha 16: foojay **0.5.0 → 1.0.0** (confirmado pela PR
oficial do RN #54160). ⚠️ **ESTÁ EM node_modules → qualquer `npm install`/`expo install` reverte e o próximo build NATIVO
quebra de novo.** PENDÊNCIA: tornar durável com **patch-package** (postinstall) ANTES de instalar qualquer lib nativa nova.
**Loop do dia a dia:** `npx expo start` + tecla `a` (app já instalado); só `run:android` quando mexer em código nativo.

===== KARAOKÊ REMOVIDO → REALCE POR PARÁGRAFO (2026-06-20) — decisão do usuário =====
O destaque **palavra-a-palavra** (§2.1) **TRAVAVA** no emulador/modo dev (ANR "isn't responding") durante o áudio.
Tentativas que NÃO bastaram (todas aplicadas e ainda travou): (1) desacoplar via store `useKaraoke` (só o parágrafo
ativo assinava/re-renderizava); (2) marcar só ao pausar; (3) updateInterval 60→250. **Causa raiz:** mover o destaque
exige **re-renderizar o parágrafo ativo** (100–200 palavras) ~4×/s — pesado demais p/ o JS em dev no emulador, por mais
cirúrgico que seja o escopo (o exemplo de "outra IA" tinha o MESMO custo). **DECISÃO:** abandonar o karaokê por palavra.
**SOLUÇÃO ATUAL:** `BionicParagraph` recebe `activePara`+`activeColor` → o PARÁGRAFO sendo lido ganha um leve fundo
(`t.accent+'22'`), muda 1× por parágrafo (custo desprezível). Toggle ✨ na barra liga/desliga o realce; 📍 = acompanhar
rolagem. **Removido:** store `src/store/karaoke.ts` (deletado), tracking por palavra, `spokenStart`/`spokenColor`/`karaokeOn`.
**`use-read-aloud.ts` reescrito enxuto** (sem onBoundary p/ destaque; premium poll 250ms). **Bug pause/continue corrigido:**
o `resume` chamava o áudio DENTRO do updater do `setState` (React 19 + React Compiler podem rodar 2× → áudio duplicado) →
agora usa `curParaRef`. **Retomar de onde parou (voz do aparelho):** `onBoundary` voltou SÓ p/ atualizar um `ref`
(`lastCharRef`, zero re-render) com a posição lida; no resume, `speakFrom(cur, lastCharRef)` retoma da palavra (não do
início do parágrafo). Premium retoma nativo (player.play). **Word-level karaokê = reavaliar só em build de release/aparelho
físico** (onde o JS é rápido); aí talvez valha refatorar por FRASES ou destaque nativo. **CLAUDE.md §2.1 atualizado.**
**Usuário aprovou: "está melhor".** `tsc` limpo em tudo.

===== SESSÕES DE LEITURA + SYNC + REORG DE ABAS + COMPARTILHAR ATIVIDADE (2026-06-20) =====
Usuário escolheu fazer: (1) sync de atividades, depois (2) feed social — e detalhou a parte social como
**comunidade por LIVRO** + mover Conquistas pro Perfil + compartilhar atividade individual. Disse "tudo
você consegue, campeão". Feito nesta ordem: Parte 2 (sync) → B (Conquistas→Perfil) → A (compartilhar
atividade); falta a C (comunidade por livro).

**MODELO DE SESSÃO (novo conceito) — feito:** antes só havia tempo AGREGADO por dia (`stats.perDay`).
Criado o conceito de **sessão** (um período contínuo no leitor = uma "atividade" estilo Strava).
`store/library.ts`: tipo `ReadingSession {id,bookId,bookTitle,format,seconds,pages,startedAt,createdAt,
synced,remoteId?}` + `sessions: ReadingSession[]` (persistido no arquivo, cap 300) + ações `addSession`/
`markSessionSynced`. **Captura no `reader.tsx`:** o `useFocusEffect` agora, ao SAIR do leitor (cleanup),
finaliza a sessão se durou ≥15s — tempo acumulado nos ticks de 15s, **páginas = parágrafos percorridos
(topIndex final − inicial) ÷ 4** (`PARAS_PER_PAGE`, "páginas equivalentes" §4.9; EPUB/PDF não têm página
fixa). Título via `sessionTitleRef` (epub title ?? nome do arquivo). **Aba Atividades** lista "Sessões
recentes" (livro · data · min · págs), `fmtSessionDate` ("hoje HH:MM"/"ontem"/"DD/MM"; usa data LOCAL,
não UTC, p/ não errar hoje/ontem na meia-noite).

**PARTE 2 — SYNC PRO SUPABASE — feito e TESTADO/APROVADO:** `src/services/activity-sync.ts`
(`syncActivities()`): se logado, insere as sessões pendentes (`synced=false`) em `reading_activities`
(uma a uma, casando o id remoto; para no 1º erro → resto fica pendente e tenta depois). No-op se
deslogado/offline (ler offline não exige conta §6). Visibilidade nasce 'private' (§4.8). **Dispara:** ao
sair do leitor (após `addSession`) e no `useFocusEffect` da aba Atividades. Aba mostra ☁️ (sincronizada)/
↻ (pendente) por sessão e convite "Entre para sincronizar…" se deslogado. **CONFIRMADO pelo usuário:** as
linhas aparecem no Supabase (Table Editor → reading_activities) com user_id/título/segundos/páginas. O
INSERT já era permitido pela policy existente (não precisou re-rodar o schema da revisão de segurança).
**OBS HORA (não é bug):** o app mostra a hora LOCAL do aparelho; o **emulador está em UTC**, então a hora
parece "errada" (started_at +00 == hora exibida). Num celular real fica certo. Guardar UTC no banco é o
correto. Fix de emulador: Settings→Date&time→fuso GMT-3, ou `adb shell setprop persist.sys.timezone
"America/Sao_Paulo"`.

**B — CONQUISTAS VIROU SUB-PÁGINA DO PERFIL — feito (falta usuário testar):** arquivo movido de
`src/app/(tabs)/conquistas.tsx` → **`src/app/conquistas.tsx`** (rota EMPILHADA; ganhou botão "‹ Voltar").
**O caminho `/conquistas` NÃO muda** (grupos `(tabs)` não aparecem na URL) → **typed routes não quebram,
sem regen**. Removido o trigger das abas em `components/app-tabs.tsx` E `app-tabs.web.tsx` (agora **4 abas**:
Leitura·Comunidade·Atividades·Perfil). Registrado `<Stack.Screen name="conquistas" />` em `app/_layout.tsx`.
**Perfil** ganhou seção "🏆 Conquistas" (mostra "X de Y desbloqueadas" → `/conquistas`). `tsc` limpo.

**A — COMPARTILHAR UMA ATIVIDADE (estilo Strava) — feito (falta usuário testar):** `ShareableCard`
(`components/shareable-card.tsx`) ganhou prop opcional `session?: ReadingSession`: se vier, mostra o card
DAQUELA sessão (kicker "Sessão de leitura", **título do livro**, min, págs, **Ritmo = min/pág**, **Tempo de
leitura** = `fmtDuration`), senão mostra o resumo agregado de antes. `compartilhar.tsx` lê `sessionId` via
`useLocalSearchParams` e acha a sessão na store → passa pro card; título vira "Compartilhar atividade".
**Aba Atividades:** cada sessão é **Pressable** (com 📤) → `router.navigate({pathname:'/compartilhar',
params:{sessionId}})`. O botão "Compartilhar" geral (Perfil/Atividades) segue mostrando o resumo. `tsc` limpo.

**C — COMUNIDADE POR LIVRO — NÃO FEITO (próximo). PLANO + DECISÕES (registrado p/ retomar):**
Ângulo: comunidade **centrada no LIVRO** (não feed de pessoas). "Seguir livro" → "N pessoas lendo" + reviews.
- **DECISÃO — identidade do livro = `book_key` = título NORMALIZADO** (minúsculo, sem acento, trim). Funciona
  p/ EPUB/PDF/catálogo; evoluir p/ ISBN depois. (Criar helper de normalização.)
- **Tabelas novas (Supabase, RLS) a criar em `supabase/schema.sql`:** `book_follows` (user_id, book_key,
  book_title, created_at), `book_reviews` (user_id, book_key, book_title, rating, text, visibility,
  created_at), `user_blocks` (blocker_id, blocked_id), `content_reports` (reporter_id, target_type, target_id,
  reason). **Moderação OBRIGATÓRIA (§4.8, senão reprova nas lojas):** filtro de palavrão (já existe
  `src/services/moderation.ts` `containsProfanity`), **denúncia**, **bloqueio** (esconder reviews de quem
  bloqueou), **contato com o dev**. Reviews "públicos por amigos/global" só DEPOIS da moderação pronta.
- **Sub-passos combinados:** **C1** = schema SQL + seguir livro + "quantas pessoas lendo"; **C2** = reviews +
  moderação (denúncia/bloqueio/filtro). Usuário precisa RODAR o SQL novo no painel.
- **Aba Comunidade** hoje é mock → vira o lar dessa feature (buscar livros com atividade → página do livro).

**PENDÊNCIA DE INFRA (importante, registrada):** a correção do **foojay 1.0.0** vive em
`node_modules/@react-native/gradle-plugin/settings.gradle.kts` → **qualquer `npm install`/`expo install`
reverte e o próximo build NATIVO quebra**. ANTES de instalar QUALQUER lib nativa nova, tornar durável com
**patch-package** (postinstall). Sync/B/A/C1 são puro JS → não disparam isso; só cuidado se C precisar de
lib nativa (não deve).

**ESTADO P/ RETOMAR:** falta (1) usuário testar B+A; (2) implementar C1 (schema + seguir livro + contagem);
(3) C2 (reviews + moderação). Rodar `npx expo start` + `a`. Build nativo só com `npx expo run:android`
(JDK 21 já fixado no gradle.properties; ver seção "DEV BUILD ANDROID" acima).

===== COMUNIDADE POR LIVRO — REDESENHO ESTILO SKOOB (2026-06-20) =====
Feedback do usuário (referência: app **SKOOB**): o "seguir livro" simples não basta. Quer o livro NO CENTRO:
estante por status, página rica do livro, reviews. "Começar com banco de livros já pronto + a comunidade
alimenta." **DECISÃO de fonte de metadados: Google Books + Open Library (fallback).**

**C1 (follow simples) foi SUPERSEDIDO pelo C1.5 (estante por status).** A tabela `book_follows` ficou ÓRFÃ
no banco (inofensiva); o app usa `book_shelves` agora.

**C1.5 — FEITO (falta usuário re-rodar SQL + testar):**
- **`src/services/book-catalog.ts`**: `searchBooks(q)` (Google Books primeiro; se vazio/erro → Open Library)
  → `CatalogBook{id,isbn?,title,author?,coverUrl?,synopsis?,pages?,language?,genres?,year?,source}`.
  `featuredBooks()` = grade "Em alta" (Google "best sellers" langRestrict=pt, só itens com capa). Sem chave/
  sem custo (catálogo público de metadados — NÃO é BYOK). Capas http→https (Android bloqueia http puro).
- **`src/services/community.ts`** (REESCRITO p/ estante): `SHELF_STATUSES=['lendo','quero_ler','lido',
  'relendo','abandonei']`, `SHELF_LABEL`, `bookKeyOf(title)` (título normalizado = identidade; ISBN à parte),
  `getMyShelf`, `setShelf({title,author,coverUrl,isbn,status})` (upsert onConflict user_id,book_key),
  `removeShelf(key)`, `getPopularBooks()` (RPC), `getBookStatusCounts(key)` (RPC, pronto p/ C2).
- **`supabase/schema.sql`** (⚠️ USUÁRIO PRECISA RE-RODAR): tabela **`book_shelves`** (status CHECK, book_title/
  author/cover_url/isbn denormalizados, unique(user_id,book_key)) + RLS (dono só a própria estante) + trigger
  touch_updated_at. **`popular_books` REDEFINIDA** (DROP antes — assinatura mudou: retorna cover_url também;
  conta distinct user em book_shelves). **`book_status_counts(p_book_key)`** nova (contagem por status,
  SECURITY DEFINER, só números — §4.8).
- **Aba Comunidade reescrita** (`(tabs)/comunidade.tsx`): busca no catálogo (capas via **expo-image**) +
  **grade "📈 Em alta"** na abertura + **Minha estante** (filtro por status) + **Populares** + **seletor de
  status** (Modal bottom-sheet) ao tocar num livro. Gate login/backend. **✕ na busca + "‹ Voltar"** nos
  resultados (pedido do usuário: faltava como voltar).

**FIX NOME DOS LIVROS ("Documento EPUB"/"Documento PDF") — FEITO:** import via SAF não dá nome real → caía em
"Documento EPUB". Agora: (1) `ImportedBook` ganhou campo **`title?`** + ação `setBookTitle`; (2) **import**
(`biblioteca.tsx commit()`) lê o título do OPF via `openEpub(dest.uri).title` já na importação; (3) **reader**
também grava `setBookTitle` ao preparar (conserta livros antigos ao abrir 1×); (4) HUB (`(tabs)/index.tsx`),
Biblioteca e Comunidade exibem **`title ?? name`**. PDF ainda fica com o nome do arquivo (título de PDF =
futuro; viria do metadado ao converter).

**PENDÊNCIAS / PRÓXIMO:** **C2 = página do livro** (toca → sinopse/páginas/idioma/gênero do catálogo + stats
por status via `book_status_counts` + livros similares). **C3 = reviews + moderação** (denúncia/bloqueio/
filtro `moderation.ts` §4.8 — tabelas a criar: `book_reviews`/`user_blocks`/`content_reports`). Refinar
identidade do livro (ISBN) e título de PDF = futuro. `tsc` limpo em tudo.

===== C2 — PÁGINA DO LIVRO — FEITO (2026-06-21, falta usuário testar) =====
**NÃO precisou de SQL novo** (`book_status_counts` já existia no banco). Puro JS/UI.
- **`src/app/livro.tsx`** (rota EMPILHADA, registrada em `_layout.tsx`): página de detalhe estilo Skoob.
  Recebe params `title/author/cover/isbn` via `useLocalSearchParams`. Mostra: capa grande + título/autor/
  ano + "👥 N na comunidade"; **estante inline** (chips de status com emoji — tocar = setShelf; tocar no
  status ATUAL = remove); **"Na comunidade"** (contagem por status via `getBookStatusCounts`, só os >0);
  **sinopse** (numberOfLines 6 + "Ler mais"); **ficha** (páginas/idioma/gênero/ISBN); **"Do mesmo autor"**
  (carrossel horizontal → abre /livro recursivo); aviso de privacidade. Carrega detalhes em `useEffect`
  por `title` (1 abort flag `alive`); recarrega estante/contagens em `reloadShelf`.
- **`src/services/book-catalog.ts`** ganhou: `bookDetails(title, isbn?)` (ISBN no Google = preciso; senão
  título preferindo item COM sinopse; fallback Open Library) e `similarBooks(author, excludeTitle)`
  (`inauthor:` no Google, só com capa, exclui o próprio, cap 12).
- **`src/services/community.ts`** ganhou `getShelfStatusFor(bookKey)` (consulta pontual `maybeSingle` do
  meu status naquele livro).
- **`(tabs)/comunidade.tsx` REESCRITO o toque:** tocar em QUALQUER livro (resultado/grade/estante/popular)
  agora **navega p/ /livro** (`openBook` → router.push com params) em vez de abrir o Modal de status. O
  **Modal de status foi REMOVIDO** da aba (estado `pick/busy`, handlers `choose/removeFromShelf`,
  `pickCurrent`, import `Modal`/`setShelf`/`removeShelf` e estilos do sheet). `useFocusEffect` já recarrega
  a estante ao voltar da página → reflete mudanças. `Cover size="lg"` ficou sem uso (componente mantém).
- **GOTCHA typed routes (de novo):** /livro não existia nos tipos → regenerei com `npx expo start --no-dev
  --offline` em background até `.expo/types/router.d.ts` incluir `/livro`, depois matei o Metro (porta 8081).
  `tsc` limpo.

**FEEDBACK DO USUÁRIO + FIXES (2026-06-21) — "clico no status e nada acontece" + "em alta como Skoob":**
- **Causa nº1 do status não salvar = SQL NÃO re-rodado** (tabela `book_shelves` não existe no banco dele
  → upsert falha calado). A falha era SILENCIOSA. **Fix:** `setShelf`/`removeShelf` (community.ts) agora
  retornam **`string | null`** (mensagem de erro do Supabase, ou null em sucesso). `livro.tsx choose()`
  mostra **Alert**; se a mensagem casar /book_shelves|does not exist|relation|schema cache/ → texto
  amigável "rode o supabase/schema.sql". Também trata **deslogado** (Alert "Entre na sua conta" → /login)
  e a seção "Minha estante" avisa quando sem login. **AÇÃO DO USUÁRIO: rodar `supabase/schema.sql` no SQL
  Editor** (idempotente) — é o que destrava a estante. (NÃO mudei o schema; o arquivo já estava certo.)
- **Metadados errados na ficha (mostrou "Idioma BUL", "Gênero series:Harry_Potter")** = `bookDetails`
  pegava uma edição estrangeira e a página SOBRESCREVIA os dados bons da grade. **Fix:** (1) `livro.tsx`
  agora **PREFERE os params** (capa/autor/isbn vindos da grade PT) e usa `details` só p/ preencher o que
  falta (sinopse/páginas/gênero). (2) `bookDetails(title, isbn, author?)` reescrito: busca por
  `intitle:+inauthor:` e escolhe a MELHOR edição (`pickBestEdition`: prefere sinopse + idioma pt/en). (3)
  helpers em livro.tsx: `langName` (BUL→código; pt→Português, en→Inglês…) e `cleanGenres` (tira prefixo
  "series:"/"_", dedup).
- **"Em alta" estilo Skoob = descoberta liberada p/ TODOS:** antes a aba inteira ficava atrás do portão de
  login (só via "Entrar/Criar conta"). Agora `comunidade.tsx`: **busca + grade "Em alta" aparecem mesmo
  deslogado** (catálogo público); o convite de login virou um CARD no meio (não bloqueia); **estante +
  populares** seguem atrás de login. `featuredBooks()` carrega sempre (fora do gate de `user`).
- `tsc` limpo. **Próximo: confirmar c/ usuário que rodar o SQL destrava o status; depois C3 (reviews +
  moderação).**

===== LOGIN OBRIGATÓRIO (2026-06-21) — REVERTE o "login opcional" do CLAUDE.md §6 =====
Decisão do usuário: "login obrigatório para usar o aplicativo". Avisei do risco de loja (Apple 5.1.1(v):
exigir conta p/ ler o próprio EPUB pode reprovar) → anotado p/ revisitar na Fase 4 (mitigação =
"continuar como convidado"). Implementado com **`Stack.Protected`** (expo-router 56.2.11 tem):
- **`src/app/_layout.tsx` reescrito:** lê `useAuth` (initializing/user/configured). `allowed = !!user ||
  !configured` (se Supabase não configurado, libera — não há backend de auth p/ exigir). Todos os screens
  do app ficam em `<Stack.Protected guard={allowed}>`; `login` em `<Stack.Protected guard={!allowed}>`.
  **BootGate** (overlay com ActivityIndicator, cor do tema) cobre a tela enquanto `initializing` p/ não
  piscar a tela errada. Ao logar/deslogar, o guard troca de tela SOZINHO (não navegar manual).
- **`src/app/login.tsx`:** virou a única tela quando deslogado. **Removido** o "‹ Voltar" (e estilos
  header/back) e o `router.back()` pós-login (o guard cuida) e o import `router`. Copy ajustada
  ("Entre para acessar sua biblioteca…"). NÃO é mais `presentation:'modal'`.
- **Sair (perfil.tsx):** `signOut()` → onAuthStateChange zera user → `allowed=false` → volta pro login
  automático. (Os branches "deslogado" do Perfil e da Comunidade viraram inalcançáveis dentro do app —
  só aparecem no fallback !configured; deixei como estão, inofensivos. A "descoberta sem login" que eu
  tinha posto na Comunidade fica moot, mas não atrapalha.)
- Sessão persiste (AsyncStorage) → após o 1º login, abrir o app offline continua liberando (getSession
  lê o token local, não exige rede). `tsc` limpo. CLAUDE.md §6 atualizado com a nota + o risco de loja.

===== FIX "idioma BUL" + C3 (RESENHAS + MODERAÇÃO) — 2026-06-21 =====
**Estante CONFIRMADA funcionando** pelo usuário (linha no `book_shelves`). `book_follows` segue VAZIA =
tabela órfã do C1 (substituída pelo `book_shelves`; inofensiva, pode dropar um dia).

**FIX idioma "BUL"/edição estrangeira na ficha:** a página re-buscava os detalhes e caía numa edição
búlgara do **Open Library** (idioma 3-letras maiúsculo = cara do OL). **Solução:** reaproveitar o
metadado que a grade JÁ tem (Google, PT/EN). `comunidade.tsx`: novo `openCatalog(b)` passa o **livro
inteiro em JSON** (param `data`) ao navegar (busca + "Em alta" usam ele; estante/popular seguem com
`openBook` mínimo). `livro.tsx`: `seeded = JSON.parse(p.data)`; usa como `details` inicial; **se tem
sinopse, NÃO re-busca** (evita a edição estrangeira); senão busca e mescla com `mergePreferring`
(mantém campos bons do seed, completa o que falta). `tsc` limpo.

**C3 — RESENHAS + MODERAÇÃO (feito, falta usuário RODAR O SQL + testar):** cumpre os 4 requisitos de UGC
das lojas (§4.8 / Apple 1.2): filtro de palavrão, denúncia, bloqueio, contato com a equipe.
- **`supabase/schema.sql` (⚠️ USUÁRIO PRECISA RE-RODAR — idempotente):** 3 tabelas novas + 1 função:
  - **`user_blocks`** (blocker/blocked, unique; RLS: dono gerencia os próprios) — criada ANTES das
    resenhas porque a policy delas referencia.
  - **`content_reports`** (reporter, target_type='review', target_id, target_user_id, reason; RLS:
    dono insere/vê as próprias).
  - **`book_reviews`** (user_id, book_key, book_title, rating 1–5 CHECK, text, unique(user_id,book_key);
    RLS SELECT = público autenticado **MENOS** resenhas envolvendo bloqueio nos 2 sentidos; INSERT/
    UPDATE/DELETE só do dono) + trigger touch_updated_at.
  - **`book_rating(p_book_key)`** SECURITY DEFINER → {avg_rating, n} (só números).
- **`src/services/community.ts`:** `BookReview` + `getBookRating`, `getReviews` (junta nome/avatar via
  query em `profiles` pelos user_ids), `getMyReview`, `upsertReview` (retorna string|null), `deleteReview`,
  `blockUser`, `reportReview`. Resenhas são PÚBLICAS (escrever = publicar) — ok porque agora HÁ denúncia/
  bloqueio (condição que faltava na revisão de segurança).
- **`src/components/book-reviews.tsx` (novo):** seção "⭐ Resenhas" na página do livro — média+estrelas,
  editor (estrelas 1–5 + texto, **`containsProfanity` no submit**, Publicar/Salvar/Excluir), lista das
  resenhas dos OUTROS com **Denunciar** (Alert c/ motivos: ofensivo/spam/spoiler) e **Bloquear** (após
  bloquear, recarrega → RLS some com elas), e link **mailto** de contato (leiteneto17@gmail.com). Mostra
  Alert amigável "rode o schema.sql" se a tabela faltar.
- **`livro.tsx`:** renderiza `<BookReviews>` (logado) no fim da página.
- **Validação:** `tsc` limpo + **`npx expo export` exit 0** (compila TODAS as rotas — smoke test real;
  o bundle de entrada do expo-router NÃO contém as telas, então grep no entry.bundle não vale como teste).
**ESTADO P/ RETOMAR:** usuário precisa (1) RE-RODAR `supabase/schema.sql` (tabelas de resenha/bloqueio/
denúncia) e (2) testar resenha+denúncia+bloqueio. Comunidade (C1.5→C3) fechada se aprovar.

===== FEEDBACK 2026-06-21 (3): Google-only + regionalização + resenha visível + nota na estante =====
**A — BUL resolvido de vez + REGIONALIZAÇÃO (decisão do usuário "usar só o google" + "buscar por idioma"):**
`book-catalog.ts` REESCRITO **Google-only** (Open Library REMOVIDO — era a origem das edições búlgaras). Tudo
ganhou `LangFilter` ('pt'|'en'|'all') via `langRestrict` do Google; **PT por padrão**. `searchBooks(q, lang)`,
`featuredBooks(lang)`, `bookDetails(title, isbn, author, lang)` (1ª passada no idioma, 2ª sem restrição;
`pickBestEdition` prefere o idioma pedido), `similarBooks(author, title, lang)`. `comunidade.tsx`: chips de
idioma (🇧🇷 Português / 🇺🇸 Inglês / 🌐 Todos) abaixo da busca; trocar idioma re-busca + recarrega "Em alta".
`livro.tsx`: passa o idioma do seed ('en' se o seed for inglês, senão 'pt'). **Por quê some o BUL:** buscar
"Harry Potter" com langRestrict=pt traz a edição PT (idioma 'pt') em vez da inglesa/búlgara.
**B — Resenha do próprio usuário VISÍVEL + nota na estante:** antes eu escondia a resenha do autor (só no
editor) → parecia que "não aparecia o comentário". Agora `book-reviews.tsx`: se já avaliei, mostra **minha
resenha como CARD** ("Você" + estrelas + texto + data) com **Editar/Excluir**; "Editar" abre o editor inline
(estado `editing`); o editor também serve p/ criar. Lista dos OUTROS abaixo (`others`). **Nota na estante:**
`getMyRatings()` (community.ts → book_key→rating) carregado no `load` da Comunidade; cada carta da estante
mostra as ⭐ do usuário (★ verdes preenchidas/cinza). `tsc` limpo + `expo export` exit 0.
**C — COLEÇÕES PERSONALIZADAS da estante (feito, falta usuário RE-RODAR SQL + testar).** Usuário escolheu
"Coleções personalizadas" (entre sort/gênero/coleções/recolher). Grupos com nome que o usuário cria e onde
organiza os livros da estante; cada livro fica em UMA coleção (v1).
- **`supabase/schema.sql` (⚠️ RE-RODAR):** tabela **`shelf_collections`** (id, user_id, name, unique(user_id,
  name); RLS dono) + **`alter table book_shelves add column if not exists collection_id uuid references
  shelf_collections on delete set null`** (apagar coleção → livro volta p/ "sem coleção").
- **`community.ts`:** `Collection` type; `ShelfItem` ganhou `collection_id`; `getCollections`,
  `createCollection` (trata nome repetido), `deleteCollection`, `setBookCollection(bookKey, id|null)`.
  `getMyShelf` agora seleciona `collection_id`.
- **`comunidade.tsx`:** na "Minha estante", 2ª linha de chips = coleções (📚 Todas + cada 📁 + "+ Coleções"),
  filtra a estante por coleção (combina com o filtro de status). Cada carta tem um **📁 {coleção ou
  "Organizar"}** → abre **modal** (criar nova com TextInput — funciona Android, NÃO usei Alert.prompt que é
  só iOS; atribuir "Sem coleção"/coleção com ✓; 🗑 apaga a coleção). `manageOpen` abre o mesmo modal sem
  livro (só gerenciar). Coleções são PRIVADAS (RLS dono) → sem moderação de nome.
- `tsc` limpo + `expo export` exit 0.
**ESTADO P/ RETOMAR:** usuário precisa **RE-RODAR `supabase/schema.sql`** (agora tem resenhas+bloqueio+
denúncia DO C3 **e** coleções) e testar: (1) idioma PT na busca/ficha (sem BUL), (2) resenha própria
aparece como card + nota na estante, (3) criar coleção + organizar livro nela + filtrar. Comunidade
praticamente fechada. Pendências antigas seguem: sync já ok; áudio em background; Fase 6 (Metas) guardada
em `docs/IDEIAS-FUTURAS.md`.

===== CAMADA SOCIAL ABERTA — FOLLOWS + FEED (2026-06-21) — opt-in, estilo Strava =====
Usuário pediu p/ tornar a comunidade social (ver quem leu, abrir perfis, mensagens), **respeitando a
privacidade com escolha público/privado**. Escolheu começar por **follows + feed** (Strava). Sobre
mensagens: ideia dele = **scrap do Orkut**; combinamos **recado com toggle público (mural) / privado (DM)**
— fica p/ DEPOIS do feed (precisa moderação, reusa C3). Visão completa em `docs/IDEIAS-FUTURAS.md` §5.
**FEITO (falta usuário RE-RODAR SQL + testar):**
- **`supabase/schema.sql` (⚠️ RE-RODAR):** `profiles.is_public` (default **false** = privado, §4.8);
  tabela **`follows`** (follower/followee, RLS: follows legíveis por autenticados p/ contagem, dono
  segue/desfaz); policies novas de SELECT: ver **estante** de perfil público (`book_shelves`), ver
  **atividades** de quem sigo E é público (`reading_activities` → alimenta o feed); função
  `follow_counts(uuid)`.
- **`src/services/social.ts` (novo):** `getUserProfile`, `getUserShelf`, `getUserReviews`, `getFollowCounts`,
  `isFollowing`, `followUser`/`unfollowUser`, `getFeed` (atividades dos que sigo, junta nome/avatar). Reusa
  `ShelfItem`/`BookReview` (este ganhou `book_title?` opcional p/ a tela de perfil).
- **`store/profile.ts`:** `Profile` ganhou `is_public`; `updateProfile` aceita `is_public`; select inclui.
- **Perfil (`(tabs)/perfil.tsx`):** seção "🌐 Privacidade" com **Switch "Perfil público"** (chama updateProfile).
- **`src/app/usuario.tsx` (novo, rota EMPILHADA registrada no grupo protegido do _layout):** perfil read-only
  de outro leitor — avatar/nome + seguidores/seguindo + **Seguir/Seguindo**; se público, mostra estante
  (carrossel) + resenhas; se privado, aviso "🔒 Perfil privado" (pode seguir, conteúdo oculto). Tocar num
  livro da estante → /livro.
- **Descoberta:** em `book-reviews.tsx` o **autor da resenha virou Pressable** → /usuario?id=...&name=...
- **Feed (`(tabs)/atividades.tsx`):** seção "📡 Seguindo" no topo lista as leituras recentes de quem sigo
  (getFeed no useFocusEffect); vazio → dica de seguir + ativar perfil público. Autor clicável → /usuario.
- **GOTCHA typed routes:** regenerei p/ /usuario (expo start --offline em bg até router.d.ts, matei Metro).
  `tsc` limpo + `expo export` exit 0.
**ESTADO P/ RETOMAR (social):** usuário RE-RODA o schema.sql, ativa "Perfil público" (Perfil), e testa com
2 contas: A escreve resenha → B abre o perfil de A pela resenha → segue → A aparece no feed "Seguindo" de B
(precisa A ter perfil público + sessões sincronizadas). **PRÓXIMO (a combinar):** kudos/comentários no feed
(UGC → moderação), "ver quem está lendo" na página do livro (item B do §5), e mensagens/scrap (item D).

===== FIX BUSCA QUEBRADA (cota Google) + BUSCA AO VIVO (2026-06-21) =====
**Causa:** a busca da Comunidade parou de funcionar = **Google Books retornou HTTP 429 "Quota exceeded"**
(cota diária por IP, esgotada de tanto testar). Como eu tinha tirado o Open Library ("usar só o google"),
ficou SEM fallback → resultado vazio. **LIÇÃO:** Google Books sem API key tem cota diária; não dá p/
depender só dele.
- **`book-catalog.ts`:** **Open Library VOLTOU como REDE DE SEGURANÇA** (não como fonte primária). `searchAny`
  = Google (com langRestrict) primeiro; se **lançar erro (429/rede) OU vier vazio** → Open Library (com
  `language=por/eng`). `searchBooks`/`featuredBooks`/`bookDetails`/`similarBooks` usam isso. **Idiomas do OL
  (3 letras: por/eng/bul) NORMALIZADOS p/ 2 letras** (`normLang`: por→pt, eng→en…) → não exibe mais "BUL"
  (o BUL vinha do código de idioma cru do OL). `CatalogBook.source` voltou a ser 'google'|'openlibrary'.
  Quando a cota do Google reseta (diário), ele volta a ser primário sozinho.
- **BUSCA AO VIVO (autopreenchimento) — `comunidade.tsx`:** `useEffect` com **debounce 450ms** + **mín. 2
  letras** + **AbortController** (cancela busca anterior) → resultados aparecem **enquanto digita**, reagindo
  também ao idioma. Estados: `searching` (spinner no modo busca) e `searched` ("Nenhum resultado para X.
  Tente outro termo ou 🌐 Todos."). O botão "Buscar" e o Enter agora só fazem `Keyboard.dismiss()` (a busca
  já é ao vivo); as chips de idioma viraram `setLang` (o effect re-busca). Condição da tela: `query>=2 letras`
  = modo busca; senão tela inicial (Em alta/estante).
- `tsc` limpo + `expo export` exit 0. **Obs.:** OL é fallback de qualidade inferior (o `language=por` dele não
  filtra rígido — mistura idiomas), mas é melhor que "busca vazia". Futuro possível: API key do Google Books
  (cota alta) se a cota incomodar usuários reais.

===== FIX "atividades unificadas entre contas" (store local por usuário) — 2026-06-21 =====
**Bug (teste de seguir com 2 contas no MESMO emulador):** a aba Atividades de B mostrava as sessões/stats de
A. **Causa:** o store `library.ts` persistia num ÚNICO arquivo do aparelho (`leitura-library.json`) — não por
conta. Sessões/stats/posições/marcadores/vocab/livros eram device-wide → a 2ª conta via os dados da 1ª. (O
feed do Supabase é por usuário/RLS e estava certo; o problema era só o store LOCAL.)
**Fix — `store/library.ts` escopado por usuário:**
- Arquivo agora é **`leitura-library-<uid>.json`** (`fileFor(uid)`). `currentUserId` rastreia a conta ativa.
- **`useAuth.subscribe`**: ao trocar de usuário (login/logout/troca), `useLibrary.setState(loadInitialFor(id))`
  recarrega o arquivo da conta; `persist()` passa a gravar no arquivo dela. Flag `switchingUser` evita
  regravar durante a troca.
- **Migração única:** `loadInitialFor(uid)` — se não há arquivo da conta mas existe o legado
  (`leitura-library.json`), a **1ª conta a entrar herda** os dados antigos e o legado é **apagado** → a 2ª
  conta entra limpa. Boot sem usuário ainda resolvido = carrega o legado; quando a sessão resolve, o subscribe
  recarrega/migra (BootGate cobre o flash).
- `library.ts` agora importa `./auth` (sem ciclo: auth não importa library). `tsc` limpo + `expo export` exit 0.
**P/ TESTAR:** no emulador, **A** lê um pouco → Sair → entrar como **B**: Atividades de B deve estar VAZIA;
voltar p/ A mantém as sessões de A. (Atenção: como o legado foi migrado p/ a 1ª conta que entrou após o
update, os dados antigos mistos A+B ficaram com essa 1ª conta — normal, é artefato de teste único.)
**CONFIRMADO pelo usuário: atividades separadas corretamente.**

===== FEED RECOLHÍVEL + KUDOS + "QUEM ESTÁ LENDO" (2026-06-21) =====
- **Feed "Seguindo" recolhível (`atividades.tsx`):** usuário achou que ocupava muito espaço. Cabeçalho virou
  Pressable com seta (▸ recolhido / ▾ aberto) + contagem "(N)"; **recolhido por padrão** (state local
  `feedOpen`, reinicia ao remontar — se incomodar, persistir). Resumo do dia volta ao topo.
- **KUDOS (curtidas) no feed — feito:** tabela **`activity_kudos`** (activity_id, user_id, PK composta; RLS:
  select autenticado true [social, estilo Strava], dono insere/apaga). `social.ts`: `FeedItem` ganhou
  `kudos`+`iKudoed`; `getFeed` agora também busca `activity_kudos` das atividades visíveis (conta + se eu
  curti); **`toggleKudo(activityId, on)`**. `atividades.tsx`: botão 👏 em cada card do feed (opacidade
  cheia se curti + contagem verde), **toggle OTIMISTA** (atualiza na hora, reverte se erro).
- **"VER QUEM ESTÁ LENDO" na página do livro — feito:** função SQL **`public_readers(p_book_key)`**
  (SECURITY DEFINER): lista leitores de perfil **PÚBLICO** (nome/avatar/status), escondendo bloqueados nos 2
  sentidos; privados ficam só na contagem agregada (§4.8). `community.ts`: `PublicReader` + `getPublicReaders`.
  `livro.tsx`: estado `readers` carregado no `reloadShelf`; seção "👥 Quem está lendo" (avatar+nome+status,
  toca → /usuario). Nota de privacidade do livro reescrita ("só perfis públicos aparecem; demais só na
  contagem").
- `tsc` limpo + `expo export` exit 0. **⚠️ USUÁRIO PRECISA RE-RODAR `supabase/schema.sql`** (agora tem
  `activity_kudos` + `public_readers` além de tudo do social anterior).
**ESTADO P/ RETOMAR:** social = perfil público + follows + feed + kudos + quem-está-lendo PRONTOS (faltam
mensagens/scrap §5-D + kudos/comentários por RESENHA, se quiser). Testar com 2 contas públicas: B curte a
atividade de A no feed; A (público) aparece em "Quem está lendo" do livro que tem na estante.

===== "MINHA ESTANTE" MOVIDA P/ A ABA LEITURA (2026-06-21) =====
Usuário pediu tirar "Minha estante" da Comunidade e pôr na Leitura. **Extraído `components/my-shelf.tsx`**
(`<MyShelf/>`): toda a estante Skoob (filtro por status + coleções criar/atribuir/apagar + modal + nota
dada), self-contained (carrega getMyShelf/getCollections/getMyRatings no useFocusEffect; tocar→/livro;
vazio→convite p/ Comunidade). Adicionado no **hub `(tabs)/index.tsx`** após "Biblioteca atual" (= arquivos
importados; estante = catálogo). **`(tabs)/comunidade.tsx` REESCRITO enxuto:** só DESCOBERTA (busca ao vivo +
idioma + Em alta + Populares) + indicador "✓/status" nos resultados (mantém `getMyShelf` leve p/ isso);
removidos shelf/coleções/modal/myRatings e estilos órfãos. Subtítulo e nota de privacidade atualizados.
`tsc` limpo + `expo export` exit 0.

===== SCRAPS (RECADOS estilo Orkut) — PROPOSTO, A CONSTRUIR =====
Próxima feature. Decisão de modelo (Orkut, do usuário): recado no PERFIL com toggle **público (mural) /
privado (só o destinatário vê = DM)**. Reusa moderação do C3 (filtro `containsProfanity`, denúncia
`reportContent` com target_type='scrap', bloqueio `user_blocks`, contato mailto). Tabela `scraps`
(author_id, recipient_id, body, is_public, created_at) + RLS (ver público de perfil público OU ser
autor/destinatário; esconder bloqueados). UI: seção "💬 Recados" em `usuario.tsx` (e no próprio perfil):
compose com switch público/privado + lista de cards (avatar+nome do autor→perfil, texto, hora, 🔒 se
privado, denunciar/bloquear, apagar se autor/dono). **Layout aprovado** (mockup mostrado). FALTA CODAR
(é a próxima feature, depois do follow-request abaixo).

===== PERFIS PRIVADOS = PEDIR PARA SEGUIR (modelo Instagram) — FEITO 2026-06-21 =====
Decisão do usuário: perfil **público** = qualquer um segue na hora; **privado** = vira **PEDIDO** que o dono
aprova; seguidor ACEITO de privado **vê TUDO** (estante/atividades/resenhas), não-seguidor não vê nada.
(É a base p/ os scraps: privado só recebe recado de quem ele segue ou de seguidor aceito.)
- **`supabase/schema.sql` (⚠️ RE-RODAR):** `follows` ganhou **`status` ('pending'|'accepted')** (+ migração
  `add column if not exists` default 'accepted' p/ follows antigos). **Trigger `set_follow_status`** (BEFORE
  INSERT, SECURITY DEFINER): público→accepted, privado→pending (cliente NÃO escolhe = seguro). Policies:
  UPDATE "dono aceita seguidor" (followee aprova), DELETE agora permite follower OU followee (cancelar/
  recusar). **RLS de conteúdo p/ seguidor aceito:** `book_shelves` (público OU seguidor aceito),
  `reading_activities` (só seguidor aceito — alimenta o feed), `book_reviews` (autor público OU eu OU
  seguidor aceito, menos bloqueio → resenha de privado fica gateada). `follow_counts` agora conta só
  'accepted'.
- **`src/services/social.ts`:** `FollowState`('none'|'pending'|'accepted'), `getFollowState` (substitui
  isFollowing), `followUser` (insert simples — trigger define status), `getFollowRequests` (pendentes p/
  mim + nome/avatar), `approveRequest`/`rejectRequest`. `getFeed` filtra follows `status='accepted'`.
- **`usuario.tsx`:** botão em 4 textos — `+ Seguir`(público none) / `+ Solicitar`(privado none) /
  `Solicitado`(pending, toca cancela) / `Seguindo ✓`(accepted, toca deixa de seguir); `toggleFollow`
  recarrega após agir (status real + conteúdo). `canSee = isMe || is_public || accepted` → senão card
  "🔒 Perfil privado" (texto muda se pending).
- **`perfil.tsx`:** seção "🙋 Solicitações de seguir" (só aparece se há pendentes) com Aceitar/Recusar
  (otimista) + nome→/usuario; carrega no useFocusEffect.
- `tsc` limpo + `expo export` exit 0. **TESTAR (2 contas):** B (privado) → A abre perfil de B → "+ Solicitar"
  → A vê "Solicitado" e conteúdo oculto; B vai em Perfil → "Solicitações" → Aceitar → A recarrega e vê tudo +
  "Seguindo ✓". Perfil público segue instantâneo.
**PRÓXIMO:** SCRAPS (recados) com a trava: privado só recebe de quem ele segue / seguidor aceito; público de
qualquer um. Layout já aprovado.

===== FASE 6 — METAS v1 (2026-06-21) — substitui/evolui Conquistas =====
Usuário pediu Fase 6. Feito v1 LOCAL (sem backend/IA — a matemática do ritmo é determinística e já é
"adaptativa": recalcula remaining/daysLeft a cada render). Tipos: **minutos** (ler N min até o prazo) e
**dias** (ler em N dias diferentes). Meta por LIVRO ("ler este livro nessa semana") = PRÓXIMO incremento
(precisa persistir progresso %/páginas por livro no leitor — não feito ainda).
- **`store/library.ts`:** tipo `Goal`{id,kind('minutos'|'dias'),title,target,deadline'YYYY-MM-DD',createdAt,
  createdDayKey,baselineSeconds,doneAt?} + `goals: Goal[]` (persistido, POR USUÁRIO) + ações `addGoal`/
  `removeGoal`/`completeGoal(id,doneAt)`. Atualizado emptyPersisted/parsePersisted/initial/persist.
- **`services/progress.ts`:** `deriveGoal(goal,stats)` → {current,target,remaining,pct,daysLeft,perDay,unit,
  done,expired}. minutos: current=(totalSeconds-baselineSeconds)/60; dias: conta dias em perDay com key>=
  createdDayKey e v>0. perDay=ceil(remaining/daysLeft) (ritmo necessário, recalcula=adaptativo). Helpers
  `localDayKey`/`dayKeyInDays`/`fmtShortDate`.
- **`app/conquistas.tsx` REESCRITO = tela "Metas"** (rota /conquistas mantida → sem regen): "+ Nova meta"
  (modal: tipo segmentado + alvo number-pad + prazo chips 7/14/30 dias) · metas ATIVAS (título, "até DD/MM
  · X dias restantes", barra de progresso, "{cur}/{tgt} {unit} · {perDay} min/dia para bater" ou "faltam N
  dias de leitura"; vermelho se prazo encerrado) · auto-conclui no useEffect quando bate o alvo →
  **Metas concluídas** (medalha 🏅) · **Emblemas** (achievements automáticos de antes, mantidos embaixo).
- **`(tabs)/perfil.tsx`:** seção "🎯 Metas" → "Metas e conquistas" (era "🏆 Conquistas/Emblemas").
- `tsc` limpo + `expo export` exit 0. **TESTAR:** Perfil→Metas→Nova meta (ex.: 10 min em 7 dias) → leia um
  pouco → o progresso sobe e o min/dia recalcula; ao bater, vira medalha em "Metas concluídas".
**PRÓXIMO (Metas):** meta por LIVRO (persistir progresso/páginas do livro no reader.tsx → "ler X até DD/MM"
com páginas/dia). Depois: IA opcional p/ sugerir metas/ritmo (BYOK).

===== META POR LIVRO (2026-06-21) — FEITO (⚠️ tsc/export NÃO rodados ainda — classificador do Bash caiu) =====
Terceiro tipo de meta: **'livro'** ("Terminar [livro] até DD/MM") com **páginas/dia**.
- **`store/library.ts`:** `Goal.kind` agora inclui `'livro'` + campo `bookId?`. Novos mapas persistidos
  **`progress: Record<bookId,0..1>`** e **`bookPages: Record<bookId,number>`** + ações `setBookProgress`/
  `setBookPages`. Atualizados Persisted/empty/parse/initial/persist (POR USUÁRIO).
- **`reader.tsx`:** `saveOffset` agora também grava `setBookProgress(id, topIndex/(len-1))`; `useEffect`
  grava `setBookPages(id, ceil(len/PARAS_PER_PAGE))` quando os parágrafos carregam.
- **`progress.ts`:** `deriveGoal(goal, stats, book?)` — p/ 'livro' usa `book={progress,pages}`: se há páginas
  → current/target em PÁGINAS (unit 'págs'), senão em % (unit '%'); `done = progress>=0.97`. perDay =
  ceil(remaining/daysLeft) = páginas/dia.
- **`conquistas.tsx`:** tipo "Livro" no segmento; se 'livro' → **seletor de livro** (chips da biblioteca)
  em vez de campo numérico; render passa `bookFor(g)` ao deriveGoal; texto do ritmo p/ livro = "X págs/dia
  para terminar". Auto-conclui quando progress>=0.97 → medalha.
- **IDEIA SALVA** (IDEIAS-FUTURAS §1b): IA opcional BYOK p/ **sugerir metas/ritmo** + **lembretes via
  notificação local** (`expo-notifications`), tudo só DEPOIS de o usuário configurar a chave (gate
  `useAI.hasKey` em Perfil→Integrações); notificação local não exige IA, só a personalização do texto/horário.
- **BUNDLE CONFIRMADO (usuário rodou `npx expo export`):** **iOS (1767 mód.) e Android (1855 mód.)
  bundlaram SEM erro** → meta-por-livro OK nas plataformas-alvo. (`tsc` em si ainda não rodei — classificador
  do Bash caiu; bundling Metro não faz type-check completo, mas a revisão manual ficou limpa.)
- **⚠️ ACHADO — WEB static render quebra:** `npx expo export` (sem `--platform`) exporta WEB também, e a web
  faz **pré-render estático no Node** (`app.json` tem `web.output: "static"`). Aí dá
  **`ReferenceError: window is not defined`** vindo do **Supabase auth lendo a sessão do storage**
  (`getItemAsync`→`window`) durante o SSR no Node. **NÃO é bug do nosso código** nem afeta iOS/Android (web
  não é alvo do app — §1 iOS+Android). Por isso eu sempre exportava só `--platform android` e nunca batia.
  **FIX recomendado (a combinar):** (a) trocar `app.json` `web.output: "static"` → **`"single"`** (web vira
  SPA client-side, sem pré-render Node → some o erro), OU (b) exportar só `--platform ios --platform android`,
  OU (c) deixar a inicialização do auth (`store/auth.ts` getSession no import) SSR-safe (guardar `typeof
  window`). Como web não é alvo, (a) é o mais simples e mantém `expo export` limpo. **NÃO aplicado ainda
  (aguardando OK — é decisão de config; talvez nem queiram web).**
- **PENDÊNCIA — RESOLVIDA (2026-06-21):** `npx tsc --noEmit` rodou **limpo (exit 0)**; fix de web aplicado =
  **`app.json web.output: "static" → "single"`** (opção (a)). `npx expo export --platform web` agora exporta
  **1 `index.html` (SPA client-side) SEM o `ReferenceError: window`** — esteira de build web silenciosa. iOS/
  Android seguem inalterados (web não é alvo). Bloco de build fechado.

═══════════════════════════════════════════════════════════════════════════════
===== RETOMAR — PRÓXIMA SESSÃO (resumo consolidado 2026-06-21) =====
═══════════════════════════════════════════════════════════════════════════════
**TUDO verifica:** `tsc --noEmit` limpo + `npx expo export --platform android` exit 0 (smoke test que
compila TODAS as rotas — usar sempre; o bundle de entrada do expo-router NÃO contém as telas, então grep
no entry.bundle não vale).

**SCHEMA SINCRONIZADO ✅ (2026-06-21):** usuário rodou o `supabase/schema.sql` inteiro com SUCESSO ("tudo
certo"), depois dos fixes de ordem (`follows.status` pré-requisito antes do C3) e idempotência (drop do nome
NOVO das policies renomeadas). Backend em dia com TUDO: profiles+is_public, reading_activities, book_shelves
+coleções, resenhas/bloqueio/denúncia (C3), kudos, public_readers, follows com status+trigger de aprovação,
scraps. **Se mexer no schema de novo, lembrar:** todo `create policy "X"` precisa de `drop policy if exists
"X"` antes; e referências a colunas/tabelas devem vir DEPOIS da criação no arquivo.
**FIX de ordem (2026-06-21):** dava `ERROR 42703: column f.status does not exist` ao rodar do zero — a policy
de resenhas (C3, mais acima) referencia `follows.status`, criado só na seção social (abaixo). Resolvido com
um bloco de **PRÉ-REQUISITOS antes da seção C3** (cria `profiles.is_public` + tabela `follows` com `status`);
as definições completas seguem abaixo, idempotentes. Se reorganizar o schema, manter essa ordem.
**FIX idempotência (2026-06-21):** dava `ERROR 42710: policy "ver estante (público ou seguidor aceito)" already
exists` na re-execução — a policy foi RENOMEADA mas o `drop if exists` só apagava o nome ANTIGO. Regra: TODO
`create policy "X"` precisa de `drop policy if exists "X"` (mesmo nome) logo antes. Auditado: todos os creates
têm drop correspondente agora.

**ESTADO DO APP (o que está pronto):**
- **Leitor:** EPUB/PDF, Bionic, temas, persistência (POR USUÁRIO agora), TTS premium+device, dicionário BYOK.
- **Login OBRIGATÓRIO** (Stack.Protected). Store local **escopado por conta** (`leitura-library-<uid>.json`).
- **Comunidade (aba):** só DESCOBERTA — busca AO VIVO (debounce) + idioma (Google-only c/ fallback Open
  Library quando estoura cota 429) + Em alta + Populares.
- **Minha estante** (catálogo Skoob com status + COLEÇÕES) → MOVIDA p/ a aba **Leitura** (`components/
  my-shelf.tsx`).
- **Página do livro (`/livro`):** ficha + estante + "Na comunidade" + **"Quem está lendo"** (perfis
  públicos) + **Resenhas** (C3: nota/texto, denúncia/bloqueio/filtro, contato) + similares.
- **Social:** **Perfil público (opt-in)** · **follows com PEDIDO+APROVAÇÃO p/ privados** (Instagram) ·
  **feed "Seguindo"** (recolhível, na aba Atividades) · **kudos 👏** · perfil de outro leitor (`/usuario`)
  com botão Seguir/Solicitar/Solicitado/Seguindo e gate de conteúdo p/ seguidor aceito · **Solicitações de
  seguir** no Perfil (aceitar/recusar) · **Recados/scraps** (mural público/privado).
- **Metas (Fase 6, `/conquistas`):** criar metas com prazo — **minutos**, **dias**, e **por LIVRO**
  (págs/dia); ritmo recalculado (adaptativo); concluir = medalha. Emblemas automáticos embaixo.

**STATUS BUILD (2026-06-21) — ✅ TUDO VERDE:** iOS + Android bundlam OK; **`tsc --noEmit` limpo (exit 0)**;
**WEB CORRIGIDA** — `app.json web.output: "static"→"single"` aplicado → `expo export --platform web` gera SPA
client-side (1 `index.html`) **sem `window is not defined`**. Esteira de build 100% limpa nas 3 saídas.
Detalhe na seção "META POR LIVRO".

**PRÓXIMA IDEIA combinada (IDEIAS-FUTURAS §1b):** IA opcional (BYOK) p/ **sugerir metas/ritmo** + **lembretes
via notificação local** (`expo-notifications`), só após o usuário configurar a chave (gate `useAI.hasKey`).

===== SCRAPS / RECADOS — FEITO (2026-06-21, falta usuário RE-RODAR SQL + testar) =====
Mural no perfil estilo Orkut: recado **público** (mural) ou **privado** (DM). Trava de permissão do usuário.
- **`supabase/schema.sql` (⚠️ RE-RODAR):** tabela **`scraps`** (author_id, recipient_id, body, is_public,
  created_at) + RLS: **SELECT** = sou autor/destinatário OU (público E destinatário tem perfil público), sem
  bloqueio; **INSERT** = sou autor, não p/ mim, não bloqueado, e destinatário PERMITE (público; OU me segue
  aceito; OU eu o sigo aceito); **DELETE** = autor ou dono do mural. `content_reports` reusado p/ denúncia
  (target_type='scrap').
- **`social.ts`:** `Scrap` + `getScraps(recipientId)` (junta nome/avatar), `canSendScrap(recipientId)`
  (público OU follow aceito em qualquer direção), `sendScrap({recipientId,body,isPublic})` (erro de RLS vira
  msg amigável "perfil privado…"), `deleteScrap(id)`. **`community.ts`:** `reportContent` genérico +
  `reportReview`/`reportScrap`.
- **`components/profile-scraps.tsx` (novo):** seção "💬 Recados" — compose (textarea + toggle 🌐público/
  🔒privado + Enviar, com `containsProfanity`) só quando `canSend` (e não isMe); cards (avatar+nome→/usuario,
  texto, hora relativa, 🔒 se privado; Apagar se meu/dono; Denunciar/Bloquear se de outro) + contato mailto.
- **`usuario.tsx`:** `<ProfileScraps recipientId={userId} recipientName={name} isMe={isMe}/>` no fim (sempre;
  permissão é do componente/RLS). **`perfil.tsx`:** card "Meu perfil e recados" → /usuario?id=meu (p/ ver o
  próprio mural, incl. recados privados recebidos).
- `tsc` limpo + `expo export` exit 0. **TESTAR (2 contas):** A manda recado público no perfil de B → aparece;
  B (privado) só recebe de quem segue/aprovou; recado privado some pra terceiros; denúncia/bloquear/apagar ok.
**Comunidade + social: COMPLETOS (estante, descoberta, resenhas, follows+aprovação, feed, kudos, quem-está-
lendo, recados).**

===== (histórico) PLANO ORIGINAL DOS SCRAPS — implementado acima =====
- Tabela `scraps` (author_id, recipient_id, body, is_public bool, created_at) + RLS. **Trava de permissão:**
  recado p/ perfil PRIVADO só é permitido se o autor é seguido pelo destinatário OU é seguidor ACEITO dele;
  perfil PÚBLICO recebe de qualquer um. INSERT with check valida isso (+ não bloqueado). SELECT: público de
  perfil público OU autor/destinatário; esconder bloqueados.
- Reusar moderação C3: `containsProfanity` no envio, `reportContent` (target_type='scrap'), `user_blocks`,
  contato mailto.
- UI: seção "💬 Recados" em `usuario.tsx` (e no próprio perfil, onde vê públicos + privados recebidos):
  compose com switch público/privado + Enviar; cards (avatar+nome→/usuario, texto, hora, 🔒 se privado,
  denunciar/bloquear, apagar se autor/dono).
- Service novo (ex.: estender `social.ts`): `getScraps(profileId)`, `sendScrap({recipientId, body, isPublic})`
  (filtro palavrão antes), `deleteScrap(id)`, `canScrap(profileId)` (checa permissão p/ habilitar o compose).

===== FASE 4 INICIADA — PRIVACIDADE (2026-06-22) =====
Usuário escolheu começar a Fase 4 pela **preparação de privacidade**.
- **DECISÃO premium (revisa CLAUDE.md §6 pós-BYOK):** atrás do paywall = **IA/OCR gerida (chave NOSSA, via
  Edge Function)** + **gráficos/estatísticas avançadas** + **feed social avançado**. **Sync na nuvem/backup
  NÃO entrou no premium** (será grátis ou fica p/ depois — confirmar quando implementar o paywall).
- **`docs/PRIVACIDADE.md` (novo):** doc de conformidade fiel ao código (auditado). Cobre: princípios (offline-
  first, BYOK no device, SEM analytics/tracking — confirmado por grep, zero SDKs), tabela de dados tratados +
  onde ficam, terceiros (Supabase; OpenAI/Anthropic/Gemini/ElevenLabs via BYOK; dictionaryapi.dev; catálogos),
  mapeamento **Apple Nutrition Labels** (Data Linked: email/nome/User ID/User Content; Tracking: nenhum) e
  **Google Data Safety**, permissões (notif + media-library; sem mic/câmera/localização), e o rascunho da ficha.
- **PENDÊNCIAS OBRIGATÓRIAS p/ loja levantadas (no doc §6):** (1) **exclusão de conta** NÃO existe (Apple
  5.1.1(v)+Google exigem; criar botão em Perfil) · (2) **Política de Privacidade pública (URL)** não existe
  (redigir do doc + hospedar) · (3) login obrigatório × Apple 5.1.1(v) (avaliar "convidado") · (4) disclosure
  BYOK · (5) moderação UGC já feita (confirmar na ficha).
- **EXCLUSÃO DE CONTA — FEITO (2026-06-22, falta usuário rodar SQL + testar):** pendência #1 da loja resolvida.
  - **`supabase/schema.sql`** (⚠️ RE-RODAR): função `public.delete_current_user()` (`security definer`, deleta
    `auth.users where id=auth.uid()`; o `on delete cascade` de TODAS as tabelas remove o resto). `revoke` de
    public/anon + `grant execute` só p/ `authenticated`. (Confirmado: todas as FKs já têm `on delete cascade`.)
  - **`src/store/auth.ts`:** `deleteAccount()` → `supabase.rpc('delete_current_user')` → `signOut()` → o guard
    do `_layout` leva ao /login. Erros traduzidos.
  - **`(tabs)/perfil.tsx`:** botão **"Excluir conta"** (vermelho, fim do bloco de conta logada) com **DUPLA
    confirmação** (Alert destrutivo: lista o que será apagado → "Tem certeza?") + spinner; sucesso = Alert.
  - `tsc` limpo + `expo export --platform android` exit 0. **TESTADO E APROVADO pelo usuário (2026-06-22):**
    "contas excluídas do supa" — a conta some do Supabase (cascade ok) e o app volta ao login. NOTA: os dados
    LOCAIS (arquivo `leitura-library-<uid>.json`) não são apagados (ficam órfãos no device; inofensivo).
- **PRÓXIMO Fase 4 (a combinar):** paywall + gating premium (UI, sem conta paga, testável) → RevenueCat/IAP
  (precisa conta + produtos nas lojas) → builds de release (Apple $99/ano, Google $25; iOS exige Mac/EAS).
  Pendências de loja restantes: **Política de Privacidade pública (URL)** + avaliar "continuar como convidado".
- **POLÍTICA DE PRIVACIDADE REDIGIDA (2026-06-22):** `docs/POLITICA-DE-PRIVACIDADE.md` — texto completo PT-BR
  ancorado na **LGPD** (art. 7º/18/33), fiel ao inventário do `PRIVACIDADE.md`. Cobre: resumo, dados locais vs
  nuvem vs terceiros (BYOK), o que NÃO fazemos (sem ads/tracking/venda), compartilhamento, transferência
  internacional, segurança, retenção/exclusão (linka o botão Excluir conta), direitos LGPD, crianças, moderação
  UGC, alterações, contato. **Campos 〔em colchetes〕 a preencher:** responsável/razão social, e-mail de
  contato/DPO. **FALTA o usuário:** preencher os colchetes + HOSPEDAR numa URL (ex.: mindreaderapp.com/privacidade)
  + informar a URL nas fichas das lojas. **DEPOIS:** linkar no app (Perfil → "Privacidade" abrindo a URL via
  expo-web-browser/Linking — ainda NÃO feito p/ não criar link morto antes de hospedar).

**COMO RODAR:** `npx expo start` + tecla `a` (app já instalado no emulador Medium_Phone). Build nativo só se
mexer em lib nativa: `npx expo run:android` (JDK 21 fixado em gradle.properties; patch foojay agora DURÁVEL via
patch-package/postinstall — ver seção PATCH-PACKAGE 2026-06-22).

**BACKLOG FUTURO:** `docs/IDEIAS-FUTURAS.md` — Metas (substitui Conquistas), IA sobre a obra (busca
semântica/personagens), hiper-personalização, acessibilidade (dislexia/TDAH), e a camada social aberta §5
(scraps = item D, em andamento). Kudos/comentários por RESENHA também ficou de backlog.

===== CHECKPOINT — PRONTO PARA CLOSED TEST (2026-06-22, decisão do usuário) =====
Usuário decidiu **pausar o desenvolvimento de features** e ir para um **teste fechado**, resolvendo as
pendências de loja depois. **Código está pronto p/ closed test** (nada bloqueando do lado de programação):
leitor completo, IA BYOK, social, metas+lembretes, **exclusão de conta FEITA/testada**, build Android funciona.
**O QUE FALTA é console/conta (não código), p/ subir um closed test no Google Play (caminho realista — Android
já buildou; iOS precisa Mac/EAS):**
1. Conta **Google Play Console** ($25 única). [Apple = $99/ano + Mac/EAS p/ iOS — fica p/ depois.]
2. **Build de release assinado** (AAB): `npx expo run:android --variant release` ou EAS; configurar keystore.
3. **Ficha "App content" no Play Console:** Política de Privacidade URL (texto pronto em
   `docs/POLITICA-DE-PRIVACIDADE.md` — só preencher 〔responsável〕+〔e-mail〕 e HOSPEDAR) · **Data Safety**
   (mapa pronto em `docs/PRIVACIDADE.md` §4) · content rating · público-alvo · declarar "sem anúncios".
4. Adicionar testadores (e-mails/Google Group). NB: conta pessoal Google exige closed test com ~12 testadores
   por 14 dias antes de liberar produção.
**NÃO precisa p/ closed test (DEFERIDO):** paywall + RevenueCat/IAP, IA/OCR gerida (premium), áudio em
background, "continuar como convidado" (só vira risco na REVIEW da Apple, não no closed test Android), foto de
avatar, testes automatizados, karaokê por palavra. Detalhe do premium decidido: IA/OCR gerida + gráficos
avançados + feed social avançado (sync/backup ficou de fora).
**Estado do build:** `tsc --noEmit` limpo + `expo export --platform android` exit 0 + web SPA limpa. Tudo verde.

===== APK DE TESTE GERADO (2026-06-22) =====
Primeiro **APK de release standalone** (roda sem Metro), p/ instalar em aparelho físico / closed test informal.
- **Como foi feito:** `npx expo prebuild --platform android` (sincroniza expo-notifications — sem `--clean`,
  preservou local.properties + linha JDK 21 do gradle.properties + foojay 1.0.0) → `./android/gradlew -p android
  assembleRelease` (21m34s, exit 0, 1026 tasks).
- **Assinatura:** o template Expo assina `release` com a **chave de DEBUG** (`android/app/build.gradle`:
  `release { signingConfig signingConfigs.debug }`) → instala em qualquer device p/ teste, MAS **não serve p/
  Play Store** (lá precisa keystore próprio + AAB).
- **Saída:** `android/app/build/outputs/apk/release/app-release.apk` (~110 MB — APK UNIVERSAL, todas as ABIs +
  sem minify; reduzir depois com ABI splits ou AAB). Instalar: copiar p/ o celular + permitir fontes
  desconhecidas, ou `adb install -r <apk>`.
- Contém tudo desta sessão (lembretes locais funcionando fora do Expo Go, IA de metas, exclusão de conta).

**TESTE NO IPHONE — caminho definido (2026-06-22, usuário vai decidir depois):** no Windows, a ÚNICA via é
**EAS Build (nuvem, compila em Mac da Expo) + conta Apple Developer US$99/ano** (obrigatória p/ instalar em
iPhone físico; o "grátis" só com Mac+Xcode/7 dias). Expo Go no iPhone NÃO serve (App Store = SDK 54, projeto =
SDK 56). Quando decidir: setar `ios.bundleIdentifier` no app.json (hoje ausente) + `eas.json` + `eas build
--platform ios` → instalar via TestFlight ou ad-hoc (registrar UDID). Usuário escolheu "decidir depois" — não
preparado ainda.

===== GIT DO PROJETO ARRUMADO (2026-06-21) =====
O repo estava inicializado em `C:/Users/CASA/.git` (home), SEM commits → `git status` listava o perfil inteiro
e qualquer `git add` era perigoso. **Fix:** `git init -b main` DENTRO de `+leitura` (agora o git para de subir
p/ o home); `.idea/` adicionado ao `.gitignore`; **commit inicial `d40f3ad`** (107 arquivos; `node_modules`/
`android`/`ios`/`dist`/`.expo` ignorados; `package-lock.json` versionado; SEM segredos — só a publishable key
pública do Supabase em app.json). O `.git` órfão do home ficou intocado (inofensivo agora; usuário decide se
remove). Sem remoto ainda (é só local; oferecido push p/ GitHub via `gh` se quiser).

===== WEB BUILD CORRIGIDA (2026-06-21) =====
`app.json` `web.output: "static" → "single"` → `expo export --platform web` vira SPA client-side (1 `index.html`),
some o `ReferenceError: window is not defined` (que vinha do SSR no Node lendo a sessão do Supabase). iOS/Android
inalterados (web não é alvo). `tsc --noEmit` limpo. Esteira de build 100% silenciosa nas 3 saídas.

===== LEMBRETES DE LEITURA — notificação local (2026-06-21, IDEIAS-FUTURAS §1b — INCREMENTO 1, falta testar) =====
Parte SEM IA da ideia §1b (a IA personaliza texto/horário = incremento 2, ainda não feito). Lembrete diário via
**notificação LOCAL** (sem servidor de push; offline).
- **Instalado `expo-notifications`** (módulo NATIVO) + plugin no `app.json` (`color: "#5EF0A0"`). ⚠️ **EXIGE
  REBUILD** (`npx expo run:android`) — o app no emulador hoje NÃO tem o módulo; só `expo start`+`a` quebra no boot.
- **`src/services/reminders.ts`:** `setupNotificationHandler` (chamado 1x no `_layout.tsx`, mostra notif com app
  aberto), `requestReminderPermission`, `scheduleDailyReminder(hour,minute,body?)` (trigger DAILY, id estável
  `leitura-daily-reminder` → reagendar substitui), `cancelDailyReminder`, `fmtTime`, `remindersUnsupported`
  (=Expo Go via `Constants.executionEnvironment==='storeClient'` → no-op + aviso). Texto fixo por enquanto:
  "Hora de ler 📖 — mantenha seu ritmo!".
- **Store `library.ts`:** novo `ReminderConfig{enabled,hour,minute}` + campo persistido `reminder` (default
  20:00, desligado) + ação `setReminder`. Atualizados Persisted/empty/parse/initial/persist (POR USUÁRIO).
- **`app/conquistas.tsx` (tela Metas):** card "🔔 Lembrete de leitura" entre metas ativas e concluídas — `Switch`
  liga/desliga (pede permissão; nega → desliga + Alert) + chips de horário (Manhã 8h/Almoço 12h/Fim da tarde 18h/
  Noite 20h/Antes de dormir 22h). NÃO gated por `hasKey` (lembrete simples não exige IA). `applyReminder` agenda/
  cancela e persiste. **A schedule DAILY persiste no SO** (sobrevive a restart) → sem reagendar no boot.
- `tsc` limpo + `expo export --platform android` exit 0. **TESTAR (no dev build, após `npx expo run:android`):**
  Perfil→Metas→ligar lembrete→escolher horário→conceder permissão; conferir notificação no horário (ou pôr um
  horário ~1-2 min à frente p/ testar rápido); desligar cancela.
===== METAS COM IA (BYOK) — INCREMENTO 2 (2026-06-22, §1b — falta usuário testar) =====
Parte de IA da §1b, OPCIONAL e gated em `useAI.hasKey` (sem chave, Metas seguem só com a matemática local).
- **`src/services/ai/goal-coach.ts` (novo):** `suggestGoal(CoachInput)` → `GoalSuggestion{kind,target,days,
  bookId?,title,rationale}` via `chatJSON` (providers.ts, reusa provider/model/chave do `useAI`+`getApiKey`).
  Envia só RESUMO numérico (avgMinPerDay/streak/activeDays/totalMin/booksCount + livro atual %/págs — barato §5).
  Clampa a resposta (days 3–30, minutos 5–100000, dias 1–60; kind inválido→'minutos'; 'livro' só se há livro
  atual). `reminderText(summary)` → frase curta personalizada p/ o lembrete (null se sem chave/falha → texto fixo).
  parseJSON tolerante a ```json``` (igual dictionary.ts).
- **`app/conquistas.tsx`:** botão **"✨ Sugerir meta (IA)"** (só se `hasKey`, abaixo do título; spinner enquanto
  pensa) → monta `CoachInput` do estado real (currentBookId+bookProgress+bookPages+derived) → `suggestGoal` →
  **pré-preenche o modal "Nova meta"** (kind/target/days via `nearestWindow`/bookId) + mostra a **justificativa
  da IA** num card roxo no topo do modal (`aiRationale`). Usuário REVISA e cria (não cria sozinho). Erros:
  needsKey→manda p/ Integrações; outro→Alert. `aiRationale` limpa ao criar/abrir manualmente.
- **Lembrete personalizado:** `applyReminder` (do incremento 1) agora, se `hasKey`, monta um summary (média/
  streak/meta ativa: faltam X unit, perDay/dia, daysLeft) → `reminderText` → passa como `body` ao
  `scheduleDailyReminder`. Sem chave, mantém o texto fixo. ⚠️ o texto é fixado NO MOMENTO de agendar (trigger
  DAILY tem body estático); "dinâmico de verdade por dia" exigiria reagendar diariamente — fica p/ depois.
- `tsc` limpo + `expo export --platform android` exit 0. **TESTAR (precisa de chave de IA configurada +, p/
  lembretes, o dev build com `npx expo run:android`):** Perfil→Integrações→colar chave; Metas→"✨ Sugerir meta"
  → revisar sugestão+justificativa → criar; ligar lembrete com chave → o texto vem personalizado.
**STATUS §1b:** AMBOS os incrementos (1 lembrete local + 2 IA sugere/personaliza) FEITOS; falta o teste do usuário.

**FIX "Sugerir meta (IA)" dava "formato inesperado" (2026-06-22):** no aparelho o botão ✨ falhava no parse.
Causa = `maxTokens` baixo (suggest 300, reminder 80): modelos **Gemini 2.5** "pensam" antes do JSON e, com
orçamento pequeno, estouram no raciocínio e devolvem TEXTO VAZIO → parseJSON(null) → erro. (O dicionário usa
700 e por isso nunca falhou.) **Fix:** suggest 300→**1024**, reminder 80→**512** (maxTokens é TETO, não custo;
seguro/grátis p/ OpenAI/Anthropic). `goal-coach.ts`. `tsc` limpo. NOTA p/ futuro: se reincidir, considerar
`thinkingConfig.thinkingBudget:0` no branch Gemini do `providers.ts` (só em flash; pode quebrar pro).

===== PATCH-PACKAGE — patch foojay DURÁVEL (2026-06-22) =====
A nota antiga "patch foojay 1.0.0 some a cada npm install" está RESOLVIDA. Instalado `patch-package` (devDep) +
script **`"postinstall": "patch-package"`** no package.json. Patch em `patches/@react-native+gradle-plugin+0.85.3.patch`
(LIMPO — só a linha `settings.gradle.kts` foojay `0.5.0→1.0.0`; o 1º patch saiu poluído com `.gradle/`+`build/
classes/*.class` de um build anterior em node_modules → refeito com `--include 'settings\.gradle\.kts$'`).
**Testado:** revertendo o arquivo p/ 0.5.0 e rodando `npm run postinstall`, ele reaplica p/ 1.0.0 ✔. Agora
qualquer `npm install`/`expo install` reaplica sozinho → build nativo não quebra mais por isso. ⚠️ se o patch
poluir de novo, rodar `rm` no .patch + recriar com `--include`.
