# PERFORMANCE — Status
*Atualizado: 2026-07-03*

## Estado atual
- **Gargalo histórico #1 (resolvido por contorno):** karaokê palavra-a-palavra causava ANR
  (re-render do parágrafo ~4×/s em dev/emulador) → trocado por destaque por parágrafo
  (1 re-render por parágrafo). Ver LEITOR/STATUS.
- Comunidade: rolagem da aba caiu de ~4–5 telas p/ ~1,5 (carrosséis horizontais).
- Feed "Seguindo" limitado (5 + "Ver mais"); sessões recentes 3/15 — evita listas infinitas.
- Lint: erro `set-state-in-effect` em comunidade.tsx é PRÉ-existente (debounce da busca).
- Detalhe aberto: `eslint.config.js` untracked criado por engano pelo `expo lint` (projeto
  não tem eslint instalado) — decidir remover ou adotar.

## Decisões firmadas (ADR resumido)
- Nunca re-renderizar texto do leitor em alta frequência (60ms) — se karaokê voltar, é por
  frases ou destaque nativo, e só medido em RELEASE build/aparelho físico.
- Virtualizar/paginar conteúdo do livro; Bionic memoizado (CLAUDE.md §4.6).
- Medições de performance em dev/emulador NÃO valem como veredito (o ANR era pior em dev).

## Roadmap / próximos passos
1. Rodada de profiling em build de release num aparelho físico (abre a porta do karaokê).
2. Resolver o `eslint.config.js` órfão (remover ou instalar eslint de verdade).
