# IA — Status
*Atualizado: 2026-07-03*

## Estado atual
- **Três camadas de IA funcionando:**
  1. **BYOK** — usuário cola a própria chave (expo-secure-store), chamada direta do device.
  2. **IA grátis gerida** — `supabase/functions/ai-proxy` (nossa chave Gemini, `verify_jwt`),
     ligada por padrão para logados. Slug produção: `hyper-task` (ver [[supabase-schema]]).
  3. **Dicionário básico em PT** — Wiktionary PT com fallback EN (`src/services/dictionary-basic.ts`).
- Ordem de uso: BYOK → proxy gerido (se logado) → pede login/chave.
  Ver `src/services/ai/dictionary.ts` e `src/services/ai/managed.ts`.
- Consumidores do ai-proxy hoje: dicionário contextual, **tradução em lote** (LEITOR),
  **simulado ENEM** (ESTUDO), coach de metas.

## Decisões firmadas (ADR resumido)
- BYOK (2026-06-19) + IA grátis via proxy (2026-06-25) — CLAUDE.md §5. Chave nossa NUNCA
  no app; chave do usuário NUNCA no Supabase/logs.
- Cache de respostas por (palavra + contexto); enviar só parágrafo + palavra.
- Cota: `AI_DAILY_LIMIT` (padrão 20 chamadas/dia/usuário) — pouco p/ tradução; alavancas
  documentadas em [[proximos-passos]] item 5b.

## Roadmap / próximos passos
1. **Deploy pendente:** teto de saída do ai-proxy 1024→2048 tokens
   (`supabase functions deploy ai-proxy`) → depois subir `BATCH_CHARS` da tradução (hoje 1400).
2. Avaliar `AI_DAILY_LIMIT=150` (chave Gemini free ≈ 1500/dia no total — cuidado).
3. Limite por usuário DENTRO da Edge Function (TODO do CLAUDE.md §5).
4. Fase 6 (backlog `docs/IDEIAS-FUTURAS.md`): busca semântica, guia de personagens sem
   spoiler, recomendações, modos Dislexia/TDAH.
