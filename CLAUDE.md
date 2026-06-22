# +leitura — Diretrizes do Projeto (Memória de Longo Prazo)

> Este arquivo é carregado automaticamente pelo Claude Code toda vez que uma sessão
> é aberta nesta pasta. Ele guarda a visão, as decisões de arquitetura e as regras
> que NÃO podem ser esquecidas entre uma conversa e outra.
> Idioma do projeto: **Português (PT-BR)**. Falar e comentar código em PT-BR.

---

## 1. Visão do produto

App de leitura de livros (estilo Kindle) cujo diferencial não é "virar páginas",
mas **leitura ativa e aprendizado**. O objetivo é fazer a pessoa ler mais e melhor:
mais retenção, mais vocabulário, mais consistência.

Uma única base de código rodando em **iPhone (iOS)** e **Android**.

Nome de trabalho do app: **MindReaderApp** (pasta do projeto: `+leitura`).

---

## 2. Funcionalidades críticas (o diferencial)

1. **Bionic Reading + TTS sincronizado**
   - Bionic Reading: as primeiras 2–3 letras de cada palavra em **negrito** para guiar o olho.
   - Áudio com vozes de IA ultra-realistas (ElevenLabs / OpenAI TTS).
   - **Destaque palavra-a-palavra sincronizado com o áudio** (karaokê de texto). Isso exige
     *timestamps por palavra* (word-level timings) — ver §5 "TTS".
     - **STATUS (2026-06-20):** o karaokê *por palavra* foi **adiado** — re-renderizar o parágrafo
       ativo ~4×/s travava no emulador/modo dev (ANR). A implementação atual destaca o **parágrafo
       em leitura** (leve, muda 1× por parágrafo) + auto-scroll que acompanha. Reavaliar o por-palavra
       só em **build de release / aparelho físico**; se valer, refatorar por **frases** ou destaque
       nativo (não re-renderizar texto a 60ms). Detalhes em `docs/MEMORIA-PROJETO.md`.
2. **Dicionário contextual (não estático)**
   - A IA lê o parágrafo e explica o significado da palavra **naquele contexto**.
   - Gera sinônimos, antônimos e **3 frases de exemplo** de uso no dia a dia.
3. **Banco de Vocabulário do usuário**
   - Toda palavra consultada/marcada entra automaticamente num banco pessoal.
   - Base para revisão espaçada (SRS) no futuro.
4. **Gráficos de desempenho (gamificação)**
   - PPM (palavras por minuto), histórico de consistência (dias seguidos), metas de tempo.
5. **UI limpa estilo Kindle**
   - Fundo sépia/claro/escuro selecionável, fontes serifadas otimizadas para leitura longa.
   - **Zero notificações externas durante a leitura** — foco total.
6. **Comunidade e compartilhamento (estilo Strava)** — o "pilar social" do app:
   - **Atividades/sessões de leitura registradas:** cada sessão vira um "treino" (livro, páginas
     lidas, tempo, PPM, data). Histórico, biblioteca e estatísticas acumuladas.
   - **Feed da comunidade (stream):** as atividades de quem o usuário segue aparecem num feed,
     com **kudos** (curtidas) e comentários, para sentir pertencimento a uma comunidade de leitores.
   - **Card compartilhável (o "print do Strava" para livro):** imagem gerada com as estatísticas da
     sessão — *"42 páginas em 29m de O Hobbit"*, PPM, % do livro — para postar em Stories/redes.
     Mapeamento dos números do Strava → leitura:
     `Distância → páginas` · `Pace → ritmo (min/pág ou PPM)` · `Tempo → tempo de leitura` ·
     `Mapa do trajeto → trilha/barra de progresso do livro (capítulos lidos)`.
   - **A experiência deve copiar o fluxo do Strava ("Compartilhar atividade"):**
     - **Carrossel de modelos** do mesmo card, o usuário desliza para escolher. Modelos mínimos:
       1. **Transparente** (fundo xadrez/sem fundo → vira sticker por cima da foto/Story);
       2. **Escuro** (sépia/preto, como o mockup);
       3. **Com a trilha do livro** (a "rota" = progresso/capítulos);
       4. **Sobre a capa do livro**;
       5. **Sobre foto do usuário**.
     - **Card de citação:** modelo que exibe uma **frase/trecho marcado pelo usuário** + título/autor
       do livro (ótimo para compartilhar uma passagem favorita, não só números).
     - **Barra de compartilhamento idêntica:** *Instagram Story*, *Copiar*, *Salvar* (na galeria),
       *Copiar link*, *Mais* (share sheet nativo). Implementar com `expo-sharing`/Share API,
       `expo-media-library` (salvar) e deep link de Stories do Instagram (camada sticker + fundo).
   - **Distinção importante:** o *card compartilhável* é local (só renderiza stats → imagem, **não
     precisa de backend**) e pode sair cedo. O *feed social* precisa de backend + moderação (§4.8).
7. **Identidade visual do card de stats / gamificação — referência ROXO + VERDE** (mockup aprovado
   pelo usuário). Direção de design para os gráficos de desempenho (§2.4) e o card compartilhável (§2.6):
   - **Fundo:** gradiente do **roxo profundo** no topo (~`#3B2A63` / `#2E2147`) descendo para **quase
     preto** (~`#14121C`). Clima escuro/premium, estilo "Strava noturno".
   - **Destaques** (números grandes, logo `+leitura`): **verde neon/menta com brilho (glow)**
     (~`#8BFFC4` / `#5EF0A0` / `#3EE89A`).
   - **Rótulos de seção** ("Consistência", "Dedicado"): **lavanda / roxo-claro** (~`#B9A6E8`).
   - **Texto secundário/valores** ("Média de Leitura", "Tempo Total…"): **branco/quase branco** (~`#EDEAF5`).
   - **"Trilha do livro" (= o mapa do Strava):** **linha verde neon brilhante** com nós (pinos/hexágonos),
     ícone de livro no início + xícara de café, rótulo tipo "Maratona do Clássico". É a "rota" = capítulos/
     progresso lidos.
   - Métricas do exemplo: *Livros Lidos (5 livros · 123 págs)* · *Consistência (45m/dia)* ·
     *Tempo Total de Leitura (11h 23m 45s)*.
   - **Regra:** usar **roxo+verde** como identidade da camada **social/stats** (perfil, gráficos, card).
     O **leitor** em si continua **sépia/claro/escuro** (§2.5) — são duas "peles" distintas do app.

---

## 3. Stack escolhida

| Camada | Escolha | Observação |
|---|---|---|
| Framework | **React Native + Expo (TypeScript)** | Protótipo rápido, 1 base p/ iOS+Android |
| Navegação | **Expo Router** (file-based, com Tabs) | |
| Banco local (offline-first) | **SQLite** (`expo-sqlite`) ou **WatermelonDB** | AsyncStorage só p/ chave-valor leve |
| Render de livro (EPUB) | **EPUB** via `epubjs` em WebView (ok no Expo Go), ou `react-native-readium` | Texto reflow → Bionic/TTS/temas funcionam |
| Render de PDF | **pdf.js** em WebView (Expo Go) ou `react-native-pdf` (dev client) | Estudo/apostilas; ver §4.9 (fixo vs reflow) |
| Áudio em background | **react-native-track-player** | Controles na tela de bloqueio + background |
| Gráficos | `react-native-svg` + `react-native-svg-charts` / `victory-native` | |
| Backend/sync + comunidade | **Supabase** (Postgres + RLS + Realtime) | Auth, sync, feed social, follows, kudos, comentários |
| Card compartilhável | **react-native-view-shot** + `expo-sharing` / Share API | Renderiza as stats numa imagem p/ Stories/redes |

> **IMPORTANTE — Expo Managed não basta.** O app usa módulos nativos (track-player,
> sqlite, talvez readium). Use **Expo com Dev Client / prebuild (`expo prebuild`)**,
> não o Expo Go puro. Planejar isso desde o início evita retrabalho.

### Estrutura de pastas
```
/src
  /components   → UI reutilizável (Reader, BionicText, Tooltip, charts...)
  /screens      → telas (Leitura, Biblioteca, Perfil, Vocabulário)
  /services     → integrações (TTS, IA/dicionário, DB, sync)
  /hooks
  /store        → estado global (Zustand recomendado, leve)
  /theme        → cores sépia/claro/escuro, fontes
```

---

## 4. DIRETRIZES iOS + Android (o que mais quebra entre as duas plataformas)

Estas são as regras que precisam estar sempre na cabeça ao construir cada feature:

### 4.1 Áudio em background (TTS)
- **iOS:** habilitar `UIBackgroundModes: ["audio"]` no `Info.plist` (via `app.json`/config plugin).
  Sem isso, o áudio para quando a tela bloqueia.
- **Android:** áudio em background exige um **Foreground Service** com notificação persistente
  (o `react-native-track-player` já cuida disso se configurado).
- Testar SEMPRE: tela bloqueada, app em segundo plano, e controle pela tela de bloqueio.

### 4.2 Pagamentos / monetização (regra que reprova app na revisão)
- **Compras de assinatura digital DEVEM usar IAP nativo** (App Store / Google Play) — a Apple
  cobra comissão e **proíbe** mandar o usuário pagar por fora (regra anti-steering).
  Use **RevenueCat** para unificar assinaturas nas duas lojas com pouco código.
- **Não** colocar link "assine no site" dentro do app iOS sem seguir as regras vigentes — é
  motivo clássico de rejeição.

### 4.3 Conteúdo / direitos autorais
- Permitir o usuário importar **os próprios EPUBs** (free) é seguro.
- Distribuir/vender livros com **DRM** (Adobe DRM, Readium LCP) é um projeto à parte — não
  assumir que dá pra abrir qualquer EPUB pago. Começar só com EPUBs sem DRM.

### 4.4 Privacidade (obrigatório nas duas lojas)
- **iOS:** preencher *Privacy Nutrition Labels* e, se houver tracking, *App Tracking Transparency*.
- **Android:** preencher o formulário *Data Safety* no Play Console.
- Texto dos livros e vocabulário do usuário são dados sensíveis de uso — declarar o que é
  enviado para APIs de IA/TTS.

### 4.5 Fontes, tipografia e layout
- Fontes serifadas devem ser **empacotadas** (`expo-font`) — não confiar em fonte do sistema,
  que difere entre iOS e Android.
- Respeitar **safe areas** (notch/ilha dinâmica no iOS, barras do Android) com
  `react-native-safe-area-context`.
- Densidade de pixels e tamanho de tela variam muito: testar em telas pequenas (iPhone SE) e
  grandes (tablets).

### 4.6 Performance de leitura
- Livro inteiro na tela = problema. **Virtualizar/paginar** o conteúdo (não renderizar tudo).
- Bionic Reading aplicado a textos grandes precisa ser memoizado — não reprocessar a cada render.

### 4.7 Acessibilidade (é um app de leitura — isso importa de verdade)
- Suportar **Dynamic Type** (iOS) e escala de fonte do sistema.
- Não quebrar **VoiceOver / TalkBack**. O recurso de áudio é complementar, não substitui o leitor de tela.

### 4.8 Conteúdo gerado por usuário — feed social (regra que reprova app na revisão)
A feature de comunidade (§2.6) traz exigências obrigatórias das duas lojas:
- **Apple App Store, Guideline 1.2 (UGC):** para qualquer app com feed/comentários é **obrigatório**
  ter: (a) filtro de conteúdo ofensivo, (b) **mecanismo de denúncia (report)**, (c) **bloquear
  usuários** abusivos, (d) forma de contato com o desenvolvedor. Sem isso = **rejeição**.
- **Google Play** tem exigência equivalente de moderação de UGC.
- **Privacidade por padrão:** o que a pessoa lê é íntimo (saúde, religião, sexualidade, política).
  A visibilidade de uma atividade deve ser **privada/só amigos por padrão**, com opção explícita de
  tornar pública. Lição do Strava: dados sociais "abertos por padrão" geram escândalo de privacidade.
- **Compartilhar capa do livro** no card é geralmente OK para uso pessoal, mas a imagem é conteúdo de
  terceiro — não tratar capas como ativos livres do app.
- **Gamificação saudável:** medir leitura não pode virar só "corrida de velocidade" que incentiva ler
  sem compreender. Equilibrar PPM com metas de consistência/compreensão.

### 4.9 Formatos de arquivo: EPUB (reflow) vs PDF (fixo) — público de estudo
Suportar **EPUB e PDF** (PDF abre o app para estudo: apostilas, artigos, livros técnicos). Mas os dois
formatos são tecnicamente opostos e isso afeta TODAS as features:
- **EPUB = texto reflowável.** O texto flui; dá para mudar fonte/tamanho/tema e aplicar **Bionic
  Reading, TTS sincronizado e dicionário contextual** naturalmente. É o formato "nativo" do app.
- **PDF = layout fixo.** Cada página tem posições fixas (colunas, fórmulas, figuras, tabelas). Não dá
  reflow sem perder o layout. Dois sabores:
  - **PDF com camada de texto** (gerado por computador): dá para **extrair o texto** (pdf.js
    `getTextContent`) e jogar no mesmo motor de leitura → "modo reflow".
  - **PDF escaneado (imagem):** sem texto → precisa de **OCR** (Tesseract no device é pesado, ou OCR
    na nuvem com custo). Tratar OCR como recurso **premium** (§5/§6).
- **Estratégia recomendada (atende o público de estudo): dois modos de PDF.**
  1. **Modo página fiel** (renderiza o PDF como é) — ideal para material técnico com fórmulas/figuras;
     com **realce e anotações** por cima. Bionic/TTS **não** se aplicam neste modo.
  2. **Modo reflow** (texto extraído) — para PDFs de texto corrido; habilita Bionic/TTS/dicionário.
  Detectar automaticamente se há camada de texto e oferecer o modo adequado.
- **DECISÃO (do usuário):** ao adicionar um PDF, **converter para reflow por padrão** (extração de
  texto no próprio device via **pdf.js**, sem servidor → privacidade + Expo Go). O **modo página fiel**
  fica como **fallback** para PDFs complexos (fórmulas/figuras/colunas) ou escaneados. Avisar o usuário
  quando a qualidade da conversão for baixa e oferecer o modo página fiel. OCR de escaneado = premium.
- **Expo Go × nativo:** **pdf.js/epubjs em WebView** (`react-native-webview`) funciona no **Expo Go**
  (bom para testar agora). `react-native-pdf` é nativo → exige **dev client/prebuild**. Preferir
  WebView enquanto estiver em Expo Go.
- **Modelo de dados:** um "livro" tem `formato` (epub | pdf) e `modo` (reflow | fixo). Biblioteca,
  progresso e estatísticas (§2.6) precisam funcionar para os dois — "páginas" é natural no PDF; no
  EPUB usar locator/% e converter para "páginas equivalentes".

---

## 5. Controle de custo da IA e do TTS (decisão de arquitetura, não detalhe)

APIs de TTS e LLM **cobram por caractere/token**. Isso define o modelo de negócio (§6) e a arquitetura:

- **Cachear áudio gerado.** Nunca regerar TTS do mesmo trecho. Guardar o arquivo + os timings
  de palavra (localmente e/ou no Supabase Storage).
- **Word-level timestamps:** preferir provedores/endpoints que retornam tempo por palavra
  (necessário para o destaque sincronizado). Se não houver, será preciso alinhar (forced alignment).
- **Dicionário contextual:** enviar só o parágrafo + a palavra, não o livro. Cachear respostas
  por (palavra + contexto).
- **DECISÃO (do usuário, 2026-06-19) — BYOK (Bring Your Own Key):** a IA é **integrada pelo próprio
  usuário**. Ele cola a chave *dele* (OpenAI / ElevenLabs / Anthropic / etc.) numa tela de Integrações;
  o app guarda a chave **no aparelho, criptografada** (`expo-secure-store`) e chama o provedor **direto
  do device**. Quem paga o custo por caractere é o usuário, não nós. Isso **desacopla** as camadas:
  - A regra clássica "chave NUNCA no app, sempre via backend" valia para uma chave **NOSSA** (se um dia
    oferecermos IA "nativa"/gerida, ela continua obrigatoriamente via Supabase Edge Function). Com BYOK
    a chave é **do próprio usuário, no aparelho dele** — padrão aceito (igual apps tipo "traga sua chave").
  - **Supabase deixa de ser necessário para a IA** (Fase 2). Supabase fica só para **auth + sync + feed
    social** (Fase 5b). A IA (dicionário contextual + TTS) funciona **sem backend** no modo BYOK.
  - **Cache continua valendo:** áudio + timings + respostas do dicionário cacheados localmente (não
    regerar e não gastar a chave do usuário à toa).
  - **Segurança:** nunca logar a chave; nunca sincronizá-la pro Supabase; usar `expo-secure-store`
    (Keychain iOS / Keystore Android). Validar a chave com uma chamada barata antes de salvar.

---

## 6. Modelo de negócio (Freemium)

> **LOGIN OBRIGATÓRIO (decisão do usuário, 2026-06-21 — REVERTE o "login opcional" anterior).**
> O app inteiro fica atrás de autenticação: sem conta, só a tela de login (`Stack.Protected` no
> `src/app/_layout.tsx`). A sessão persiste (AsyncStorage), então após o 1º login o uso offline
> continua funcionando. Fallback: se o Supabase **não** estiver configurado, o gate libera (não há
> backend de auth p/ exigir). **⚠️ Risco de loja (Apple Guideline 5.1.1(v), ver §4.4):** exigir conta
> para ler o **próprio** EPUB pode causar rejeição. Antes de publicar (Fase 4), avaliar um
> **"continuar como convidado"** (ou Sign in with Apple) como mitigação. O texto "grátis sem conta"
> abaixo descreve o MODELO DE COBRANÇA (não exige pagamento), não o acesso — o acesso exige login.

- **Grátis:** ler **EPUBs e PDFs próprios**, marcações/anotações, dicionário básico, e **recursos de IA
  via BYOK** (o usuário traz a própria chave — §5). *(Tudo isso exige estar logado — ver nota acima.)*
- **Premium (mensal/anual):** valor agregado **sem custo marginal por caractere** — sync na nuvem, feed
  social avançado, backups, gráficos detalhados; e, opcionalmente, **IA "nativa" gerida** (chave NOSSA,
  via Supabase Edge Function) e **OCR gerido** para quem não quer trazer a própria chave.
- **Ajuste pós-BYOK (§5):** o premium **deixa de se justificar pelo custo de API** (agora é a chave do
  próprio usuário). Se um dia oferecermos IA gerida, aí sim valem cotas/limites no backend. Revisar
  este modelo conforme evoluir.

---

## 7. Roadmap por fases (construir em blocos funcionais)

- **Fase 1 — Core (leitor Kindle):** abrir **EPUB e PDF** (PDF: modo página fiel + modo reflow quando
  houver camada de texto — §4.9), paginação, tema sépia/claro/escuro, fonte serifada, Bionic Reading.
  *Sem IA ainda.*
- **Fase 2 — IA + Áudio:** TTS com destaque sincronizado; dicionário contextual; backend que
  guarda chaves e dá os blocos de texto para a IA.
- **Fase 3 — Persistência + Gráficos:** SQLite (progresso, marcações, vocabulário); tela de
  Perfil com gráficos de PPM/consistência.
- **Fase 4 — Monetização + Lojas:** RevenueCat/IAP, telas de paywall, formulários de privacidade,
  builds de release para App Store e Play Store.
- **Fase 5 — Comunidade & Compartilhamento (estilo Strava):**
  - **5a (cedo, sem backend):** registro de sessões de leitura + **card compartilhável** das stats
    (`react-native-view-shot` → imagem → Share/Stories). Pode adiantar para a Fase 3.
  - **5b (precisa de backend):** feed social, follows, kudos, comentários (Supabase + RLS),
    com **moderação/denúncia/bloqueio obrigatórios** (§4.8) e visibilidade privada por padrão.
- **Fase 6 (futuro) — IA avançada + Metas + Acessibilidade:** ver o backlog em
  **`docs/IDEIAS-FUTURAS.md`** (aprovado pelo usuário em 2026-06-21). Destaques:
  - **Metas** (substitui "Conquistas"): usuário cria objetivos (ex.: "ler este livro nesta semana"),
    a IA calcula páginas/dia e ajusta pelo ritmo real; concluir = **conquista personalizada da meta**
    no perfil.
  - **IA sobre a obra:** busca semântica (por ideia), guia de personagens + linha do tempo sem spoiler.
  - **Hiper-personalização:** recomendações preditivas (estilo/tom/ritmo) + cronograma adaptativo.
  - **Acessibilidade:** audiolivro dinâmico (entonação/emoção) + modos Dislexia/TDAH (espaçamento,
    sílaba tônica, Bionic). Tudo seguindo BYOK+cache (§5) e privacidade (§4.8).

---

## 8. Regras de trabalho neste projeto

- Falar e documentar em **PT-BR**.
- Construir **uma fase de cada vez**, sempre testável no fim de cada bloco.
- O usuário **testa cada passo** — entregar incrementos pequenos e verificáveis, não um app inteiro de uma vez.
- Antes de assumir que um EPUB/voz/recurso "funciona nas duas plataformas", **testar nas duas**.
- Não embarcar segredos (chaves de API) no código do cliente.

---

*Última atualização: 2026-06-21 — documento vivo; atualizar conforme as decisões evoluírem.*
