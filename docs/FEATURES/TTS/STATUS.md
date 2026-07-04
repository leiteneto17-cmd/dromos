# TTS — Status
*Atualizado: 2026-07-03*

## Estado atual
- **Voz neural gerida NO AR e testada:** Edge Function `supabase/functions/tts-proxy`
  (slug produção `tts-proxy-`) → Azure TTS **tier grátis F0** (500k chars/mês), vozes
  `pt-BR-FranciscaNeural` / `AntonioNeural`. Cota diária de caracteres por usuário
  (`tts_quota_consume` no schema.sql) + cache local do MP3 (nunca regera).
- Seletor de voz 🎙️ no leitor; fix do áudio duplicado aplicado.
- Ordem dos motores em `src/hooks/use-read-aloud.ts`: **ElevenLabs BYOK → neural gerida →
  voz do aparelho** (fallback silencioso).

## Decisões firmadas (ADR resumido)
- **Escada de provedores (2026-07-02):** Azure grátis → Azure pago (≈ preço do OpenAI E
  mantém word timestamps p/ o karaokê) → GPU própria (Kokoro/F5) só com escala real.
  **Não montar infra complexa antes de validar no mercado.**
- Voz neural é a **âncora do premium** ("qualquer livro vira audiolivro em pt-BR").
  Free = voz do sistema (expo-speech).
- Cache sempre: nunca regerar TTS do mesmo trecho (CLAUDE.md §5).

## 🐛 Bugs abertos (teste APK 2026-07-04)
- **P1 — Áudio DUPLO:** dá p/ apertar play em Francisca E Antonio e tocam sobrepostos. Guard
  atual (`pausedRef`/`genLoadingRef` em `use-read-aloud.ts`) não cobre 2 vozes/motores
  simultâneos. Provável: cada disparo cria uma corrente sem parar a anterior de forma global.
- **P2 — Áudio ignora a tradução:** com 🌐 PT ligado, o áudio sai em INGLÊS. Raiz: o hook lê
  `paragraphs` (original), não o `ptMap` traduzido. Ligado à decisão de tirar tradução on-device
  e pré-traduzir o acervo (ver LEITOR/STATUS + [[proximos-passos]]).

## Roadmap / próximos passos
1. Confirmar que o schema com `tts_quota_consume` foi aplicado por inteiro (há indício de
   que sim — o RPC respondeu bloqueando anônimo — mas o usuário não confirmou).
2. Pré-render de áudio do acervo curado (títulos carro-chefe) — barato e melhora latência.
3. Quando migrar p/ Azure pago: capturar word timestamps → destrava o karaokê (LEITOR).
