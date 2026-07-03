# ESTUDO — Status (vertical ENEM / Cantinho do Estudo)
*Atualizado: 2026-07-03*

## Estado atual
- **É uma VERTICAL que monetiza, não a alma do app** (a alma é SOCIAL — ver SOCIAL/STATUS).
- **Construído e testado (commits `501f342` + ajustes `9adb3d3`):**
  - Prateleira "Clássicos de prova" (`/enem`) com 8 obras PT do Gutenberg
    (`src/services/enem.ts`), card discreto de entrada no Explorar.
  - **Simulado estilo ENEM por IA** (`/simulado`): 5 questões A–E via BYOK/ai-proxy,
    correção + explicações + gabarito + "📤 Exportar questões". Premium (grátis → /premium).
    Limite local 5/dia na IA gerida (BYOK sem limite).
  - Download compartilhado extraído p/ `src/services/catalog-download.ts`.

## Decisões firmadas (ADR resumido)
- Gamificação saudável (CLAUDE.md §4.8): não virar corrida de PPM sem compreensão — o
  simulado é justamente a peça de "compreensão".
- Simulado é feature premium (gating por `store/plan.ts`).

## Roadmap / próximos passos
1. Reteste no aparelho dos ajustes do commit `9adb3d3` (gabarito/exportar/limite 5-dia).
2. Prateleira ENEM depende do bucket `acervo` p/ os títulos que não estão no Gutenberg
   (ver ACERVO/STATUS item 1).
3. Futuro: mais bancos de questões, cronograma de estudo adaptativo (Fase 6).
