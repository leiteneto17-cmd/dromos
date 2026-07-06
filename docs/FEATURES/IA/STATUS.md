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
  **simulado ENEM** (ESTUDO), coach de metas, **Fábrica de Histórias / Dromos Kids** (2026-07-06).
- **Fábrica de Histórias (`src/services/ai/story.ts`, 2026-07-06):** gera conto/fábula/apólogo/
  parábola infantil (8–10 páginas curtas) a partir de "ingredientes" (tipo/herói/cenário/moral).
  Mesmo padrão do simulado (BYOK → proxy gerido, JSON tolerante). **Guardrails de segurança**
  no system prompt (conteúdo 3–12 anos; ignora injeção via nome do herói) + `sanitizeHeroName`
  no cliente. **Cota MENSAL** em `store/kids-stories.ts` (grátis 2/mês, Premium 30/mês, BYOK ∞)
  = isca do Premium. Histórias salvas LOCALMENTE ("Minhas Criações"). Telas: `/kids-criar`
  (form lúdico) + `/kids-historia` (leitor de carrossel). Fase 2 pendente: narração TTS + capa
  ilustrada por IA (custo de imagem).

## Decisões firmadas (ADR resumido)
- BYOK (2026-06-19) + IA grátis via proxy (2026-06-25) — CLAUDE.md §5. Chave nossa NUNCA
  no app; chave do usuário NUNCA no Supabase/logs.
- Cache de respostas por (palavra + contexto); enviar só parágrafo + palavra.
- Cota: `AI_DAILY_LIMIT` (padrão 20 chamadas/dia/usuário) — pouco p/ tradução; alavancas
  documentadas em [[proximos-passos]] item 5b.

## Roadmap / próximos passos
1. ✅ **FEITO (2026-07-03):** ai-proxy re-deployado com teto de saída 2048 tokens
   (`min(max(payload.maxTokens || 700, 16), 2048)`). Próximo: subir `BATCH_CHARS` da
   tradução no hook (hoje 1400, conservador p/ caber em 1024) e testar.
2. Avaliar `AI_DAILY_LIMIT=150` (chave Gemini free ≈ 1500/dia no total — cuidado).
3. Limite por usuário DENTRO da Edge Function (TODO do CLAUDE.md §5).
4. Fase 6 (backlog `docs/IDEIAS-FUTURAS.md`): busca semântica, guia de personagens sem
   spoiler, recomendações, modos Dislexia/TDAH.
