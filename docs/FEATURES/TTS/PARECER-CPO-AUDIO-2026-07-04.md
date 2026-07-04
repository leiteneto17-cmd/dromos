# Parecer CPO: Áudio do acervo (pré-render, Kokoro/Chatterbox, voice cloning)
*2026-07-04 · skill chief-product-officer · ideias trazidas pelo usuário*

## Vereditos (RICE)
| Ideia | Score | Veredito |
|---|---|---|
| Pré-render do acervo POR CAPÍTULO (streaming, offline por capítulo, regeração cirúrgica) | 2.4 | **CONSTRUIR** — "50 clássicos com audiolivro incluso" = ativo permanente do premium; arquitetura vale p/ qualquer motor |
| Cloudflare R2 + CDN p/ os áudios | alto | **CONSTRUIR** — Supabase Storage free = 1 GB (6 GB NÃO cabem); R2 = 10 GB grátis + egress ZERO |
| Kokoro local como motor | C=50% | **VALIDAR ANTES** — pt-BR é o critério que mata/aprova (teste cego decide em 1h) |
| Chatterbox + voice cloning POR USUÁRIO ("Motor de Voz") | 0.15 | **ADIAR** — quebra o modelo "gera 1×, serve todos": exige servidor SEU ligado + storage por usuário×livro (36 GB+ com 100 users); viola a regra "sem infra antes de validar" (2026-07-02). Preservar: Chatterbox pode ser o MOTOR do pré-render (voz oficial do Dromos via cloning zero-shot, sem servidor); cloning por usuário → IDEIAS-FUTURAS (Fase 6/escala) |

## Riscos técnicos identificados
1. **Opus NÃO toca nativo no iOS** (AVPlayer) — testar 1 arquivo antes de converter 50 livros;
   plano B: **AAC 48–64 kbps mono** (~30–40 MB/livro → acervo ~2 GB, toca em tudo).
2. Áudio pré-renderizado não tem word timestamps → karaokê (§2.1) continua vindo do caminho Azure.
3. Texto original da ideia citava "Flutter" — Dromos é React Native/Expo (conversa genérica; filtrado).

## Plano aprovado a executar
1. **Sessão 0 (usuário, ~1h no PC): TESTE CEGO pt-BR** — capítulo 1 de Dom Casmurro 3×:
   Kokoro local · Chatterbox local · Azure Francisca (cota própria). Vencedor = motor do pré-render.
   Se Azure vencer: pré-render via cota grátis (1 livro/mês) ou pago pontual (~US$8 pelos 50).
2. Sessões 1–2: pipeline local (EPUB → capítulos → áudio → compressão → upload R2) + player
   por capítulo com cache offline no app.
3. Voice cloning por usuário: registrar em IDEIAS-FUTURAS (premium de escala).

*Decisão desacoplada: a arquitetura por capítulo + R2 é a mesma seja qual for o motor.*
