# LEITOR — Status
*Atualizado: 2026-07-03*

## Estado atual
- Leitor EPUB via WebView (epubjs), temas sépia/claro/escuro, fonte serifada, Bionic
  Reading — funcionando (Fase 1 completa).
- **Destaque sincronizado com áudio = por PARÁGRAFO** (não por palavra): o karaokê
  palavra-a-palavra foi **adiado** (ANR no emulador/dev — re-render ~4×/s). Auto-scroll
  acompanha. Detalhes em `docs/MEMORIA-PROJETO.md`.
- **Tradução 🌐 PT (v1) funcionando e aprovada:** toggle no leitor traduz clássicos EN sob
  demanda (prefetch + cache em disco, tradução em lote ~12 parágrafos/chamada via ai-proxy).
  Auto-traduzir ao abrir pelo Explorar (`pt=1`) — pendente teste no aparelho.
- Sessão de leitura fecha com `syncActivities()` no `reader.tsx`.

## Decisões firmadas (ADR resumido)
- Reavaliar karaokê por palavra **só em build de release / aparelho físico**; se voltar,
  refatorar por frases ou destaque nativo — nunca re-render de texto a 60ms.
- Zero notificações/anúncios POR CIMA do texto durante a leitura (CLAUDE.md §2.5).
- Bionic em texto grande = memoizado, conteúdo virtualizado/paginado (§4.6).

## Roadmap / próximos passos
1. Testar auto-traduzir (`pt=1`) no aparelho.
2. Evoluir tradução v1 (se valer): "Ouvir" em PT; seleção/grifo no modo PT; blocos maiores
   se ficar "picotada".
3. Karaokê por palavra: retestar em release build (depende de TTS com word timestamps —
   ver TTS/STATUS).
