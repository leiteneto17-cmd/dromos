# Design: Comunidade estilo Stories (feed "Seguindo" v2)
*ui-ux-design-director · 2026-07-04 · Complexity Mode: Pequeno→Médio*

## Objetivo da Experiência
Quem segue muita gente hoje afoga na lista vertical de "fulano leu X" (cada sessão vira item
automático). Objetivo: a pessoa **bate o olho** em quem leu (bolhas no topo, como Instagram),
**escolhe** o que ver, e o autor **escolhe** o que publicar — menos ruído, mais intenção,
escala com N seguidores sem virar muro de texto. Sensação: leve, curioso, "quero ver".

## Fluxo (User Flow)
**Ver:** Comunidade → faixa de bolhas no topo → toca numa bolha → story em tela cheia (o card
de leitura da pessoa) → auto-avança 5s → toca à direita (próximo) / esquerda (anterior) /
segura (pausa) / arrasta pra baixo (fecha). Anel colorido = não visto; anel apagado = visto.

**Publicar (opt-in — a mudança-chave):** ao FIM de uma sessão de leitura (reader.tsx já
finaliza a sessão) aparece um convite discreto **"📣 Publicar como story?"**; OU na Home/
Estatísticas, cada sessão tem **"Compartilhar como story"**. Publicar = a atividade vira story
por **24h**. Sem publicar = a leitura fica só nas SUAS estatísticas (não vaza pro feed).
Isso INVERTE o modelo: de "tudo aparece" para "eu decido".

**Estado pré-rede (N=1):** a 1ª bolha é sempre **a sua** ("Sua leitura" / "+" se nada hoje),
com dica "Publique sua leitura de hoje". Nunca fica vazio nem constrange.

## Wireframe (tela-chave)
```
┌─────────────────────────────┐   Comunidade
│ [+Você] (Ana) (Léo) (Mia) → │  ← faixa de bolhas (scroll horizontal); anel verde=novo
├─────────────────────────────┤
│  🔎 Buscar livro ou autor   │
│  📖 Clube do Livro   Entrar›│  ← card destaque (já existe)
│  ── Em alta / Populares ──  │  ← descoberta (carrosséis, já existem)
└─────────────────────────────┘

STORY (tela cheia, ao tocar a bolha):
┌─────────────────────────────┐
│ ▬▬▬ ▬  · · ·  (barras topo)  │  ← progresso por story (auto 5s)
│ (avatar) Ana · há 2h    ✕    │
│                             │
│     [ card de leitura ]     │  ← o ShareableCard em formato story (roxo→preto, verde)
│     "Ana leu 32 págs de     │
│      Dom Casmurro · 41 min" │
│                             │
│   📜 Logos      💬 Responder │  ← reações (reusa Logos + scraps/DM)
└─────────────────────────────┘
```

## Decisão de Design
```
Decisão: bolhas de story (efêmeras, opt-in) SUBSTITUEM o feed automático de "Seguindo".
Alternativas: (A) manter feed vertical + só encurtar (feito hoje: 7 dias/5 itens) —
  continua ruído linear e passivo; (B) feed algorítmico "melhores" — precisa de escala/dados
  que não temos; (C) Stories (escolhida).
Trade-offs: familiaridade (todo mundo entende Stories) vs. custo de construir o viewer;
  densidade (bolhas mostram MUITA gente em pouco espaço) vs. profundidade (1 toque pra ver).
Recomendação: Stories. Resolve o problema real (poluição com N seguidores) porque o formato
  é O(1) no topo (cabe 20 pessoas numa faixa) em vez de O(n) empilhado; e o opt-in reduce
  o volume na fonte. Efemeridade (24h) cria leveza e um empurrão de hábito diário (Zeigarnik/
  FOMO saudável): "publiquei hoje?".
Impacto: a Comunidade deixa de ser "mural infinito" e vira "quem está lendo agora" — mais
  vivo, menos culpa de scroll, e o autor sente controle (privacidade por escolha, §4.8).
Quando revisar: se a taxa de "publicar story" ficar baixa (<15% das sessões) com rede real,
  reavaliar o gatilho de publicação (talvez publicar por padrão os PÚBLICOS).
```

## O que fazer com o feed atual
- **Aposentar** o feed vertical "Seguindo" (a lista de atividades). As bolhas o substituem.
- **Manter** kudos/Logos e comentários (agora dentro do story, como reação).
- **Manter** descoberta (Em alta / Populares / busca / Clube) — são outra função (achar livro).
- Sessões continuam gravadas em `reading_activities` (estatísticas pessoais). O que muda é
  que só as **publicadas como story** aparecem para os outros.

## Acessibilidade (mínimo — Pequeno)
- Bolha = `accessibilityRole="button"`, label "Story de Ana, leu Dom Casmurro" (não só avatar).
- Anel "novo/visto" NÃO pode ser o único sinal (daltônico): somar um ponto/negrito no nome.
- Story auto-avança: **respeitar "reduzir movimento"** e permitir PAUSAR (segurar) — nunca
  prender o usuário; ✕ e arrastar-pra-baixo sempre fecham. Contraste do texto sobre o card AA
  (já garantido pela paleta da marca).

## Implicações de backend (p/ o software-architect/eng., não decididas aqui)
- Publicar story = marcar a `reading_activity` como compartilhada + timestamp; visível a
  seguidores por 24h. Sugestão: coluna `shared_as_story_at timestamptz null` + RLS "seguidor
  vê atividades com shared_as_story_at nas últimas 24h" (respeitando bloqueio/visibility).
- "Visto" (anel apagado): tabela leve `story_views (activity_id, viewer_id)` OU só local no
  device (mais barato p/ MVP — recomendado começar local).

## Justificativa (ligada à persona)
A persona é o leitor-que-quer-hábito-e-pertencimento (alma "Strava da leitura"). Stories servem
melhor que o feed porque: (1) escalam visualmente sem punir quem segue muita gente; (2) o
opt-in devolve controle e privacidade (lição Strava/§4.8); (3) a efemeridade transforma
"compartilhei uma leitura" num micro-hábito diário — exatamente o loop de retenção que o app
persegue. É a mesma razão pela qual Instagram/Strava moveram o social para Stories: menos
pressão de permanência, mais frequência.

## Escopo sugerido de implementação (faseado, p/ o project-director)
- **S1:** coluna `shared_as_story_at` + RPC/flag "publicar story" + faixa de bolhas (só a sua +
  seguidos que publicaram) — testável com N=1/N=2.
- **S2:** viewer de story em tela cheia (auto-avança, gestos) reusando o ShareableCard.
- **S3:** reações no story (Logos + responder via scrap/DM) + "visto" local. Aposentar o feed antigo.
