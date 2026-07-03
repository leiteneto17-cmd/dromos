# docs/FEATURES — Estado do projeto por módulo

> **Para que serve:** camada de contexto ACIMA das skills. As skills do framework
> (`.claude/AI_FRAMEWORK_STARTER_KIT_v1.5.0`) são genéricas — antes de trabalhar num
> módulo, a skill (ou o Claude) lê o `STATUS.md` do módulo em vez de depender da
> memória da conversa.
>
> **Formato:** 1 arquivo `STATUS.md` por módulo, com 3 seções fixas:
> **Estado atual** · **Decisões firmadas (ADR resumido)** · **Roadmap / próximos passos**.
> (Arquivo único por módulo é deliberado — mesmo racional da decisão D-006 do framework:
> só quebrar em STATUS/ROADMAP/ADR separados quando o módulo tiver volume que justifique.)
>
> **Regra de manutenção:** quem mexe no módulo atualiza o STATUS no fim da sessão
> (data no topo). STATUS desatualizado é pior que não ter STATUS.
>
> **Precedência:** decisões de produto/arquitetura oficiais vivem no `CLAUDE.md` e em
> `docs/MEMORIA-PROJETO.md`. O STATUS resume e aponta — não contradiz.

## Módulos

| Módulo | O que cobre |
|---|---|
| [SOCIAL](SOCIAL/STATUS.md) | A ALMA do app ("Strava da leitura"): feed, kudos, hábito/streak, desafios, recap, card compartilhável |
| [LEITOR](LEITOR/STATUS.md) | Leitor EPUB, Bionic Reading, temas, tradução 🌐 PT, karaokê |
| [TTS](TTS/STATUS.md) | Voz: escada de provedores, tts-proxy (Azure), BYOK ElevenLabs, cotas |
| [IA](IA/STATUS.md) | Dicionário contextual, ai-proxy (Gemini), BYOK, cotas de IA |
| [PDF](PDF/STATUS.md) | PDF reflow vs página fiel, OCR |
| [ACERVO](ACERVO/STATUS.md) | Explorar: Gutenberg, acervo curado (Supabase Storage), fontes legais |
| [ESTUDO](ESTUDO/STATUS.md) | Vertical ENEM: prateleira de clássicos + simulado por IA |
| [MONETIZACAO](MONETIZACAO/STATUS.md) | Planos Free/Premium, RevenueCat, AdMob, paywall |
| [PERFORMANCE](PERFORMANCE/STATUS.md) | Gargalos conhecidos e regras de performance do leitor |
