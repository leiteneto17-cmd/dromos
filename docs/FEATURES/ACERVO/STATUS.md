# ACERVO — Status (aba Explorar + fontes de livros)
*Atualizado: 2026-07-03 (bucket criado)*

## Estado atual
- **Fontes vivas:** Project Gutenberg (funciona). **Fontes mortas/bloqueadas:** Standard
  Ebooks, ws-export (Anubis), Archive.org — ver [[acervo-fontes]].
- Google Books integrado no Explorar (selo 🔎) — **download NÃO validado** (429 por IP em
  dev; downloadLink pode exigir auth/redirect → se vier HTML, descartar/fallback).
- Comunidade/Explorar anti-rolagem: carrosséis horizontais, chips contextuais, sugestões
  de busca (commit `9eca41e`, aprovado).
- **Acervo curado próprio:** tabela `curated_books` no schema.sql é a fonte de verdade;
  leitura em `src/services/curated-catalog.ts` (tabela → catalog.json legado → semente).
- **✅ Bucket `acervo` (público) CRIADO e 4 arquivos no ar (2026-07-03, confirmado por
  print):** `alice-pt.pdf`, `arte-da-guerra.epub` (⚠️ é EPUB, não PDF), `peter-pan-pt.pdf`,
  `romeu-julieta-pt.pdf`. Projeto: `tffpsfjrqgayrosgmsxy`.
  **FALTA o passo final: os INSERT em `curated_books`** com as URLs públicas — sem isso o
  Explorar não vê os livros (SQL pronto entregue ao usuário em 2026-07-03).

## Explorar redesenhado (2026-07-06)
- **Parede de pills (autores+gêneros) → filtro de gênero COLAPSÁVEL** (1 linha fechada, painel
  de chips ao abrir) em `src/app/explorar.tsx`. Autores agora se acham pela busca.
- **"Grandes Jornadas":** o antigo row discreto do ENEM virou DOIS cards lado a lado (gradiente
  neon §2.7): 🎓 Clássicos de Prova (`/enem`) + ✨📖 Clássicos Infantis (`/infantil`).
- **Dromos Kids (`/infantil` + `src/services/infantil.ts`):** seção infantil isolada, "brilho
  mágico" violeta, capas grandes, portão por faixa etária (3-5/6-8/9-12). v1 SEED = 5 títulos
  de domínio público VERIFICADOS por API: Gutenberg 30510 (Grimm), 16429 (Junqueiro), 45840
  (Pimentel) + acervo próprio `alice-pt.pdf`/`peter-pan-pt.pdf` (HTTP 200 conferido). Cresce
  pela mesma via curada. Camadas futuras (karaokê, gamificação, tipografia disléxica) pendentes.
- **Capas sem imagem:** novo `src/components/catalog-cover.tsx` (`CatalogCover`) desenha fallback
  TIPOGRÁFICO (gradiente roxo + título) no lugar do emoji 📘. Usado na Comunidade e no Kids.

## Decisões firmadas (ADR resumido)
- **Sem pirataria; sem CDL (aluguel de cópia digital = ilegal); não competir em catálogo
  licenciado** — diferencial é leitura ativa, não tamanho do acervo. NÃO REABRIR.
- Acervo próprio = traduções PT dos clássicos universais (Gutenberg só os tem em EN).

## Roadmap / próximos passos
1. ✅ INSERT em `curated_books` RODADO (2026-07-03) — livros no app; `select` confirmou
   **banco CORRETO** (pdf/epub certos). Bug do "aparece EPUB" era o placeholder de capa
   com texto fixo (corrigido — mostra formato real; e `inferFormat` blinda contra
   cadastro errado futuro). **Crash ao abrir PDF:** diagnóstico = renderer da WebView do
   conversor morria (OOM) com a injeção do base64 inteiro numa string só, e sem handler
   `onRenderProcessGone` o app caía junto. **CORRIGIDO (aguardando teste no aparelho):**
   injeção em pedaços de 512 KB + handlers `onRenderProcessGone`/`onContentProcessDidTerminate`
   em `pdf-extractor.tsx`. Peter Pan é muito ilustrado → conversão reflow sai pobre
   (esperado, §4.9 — candidato ao modo página fiel). Falta ainda: confirmar schema.sql
   inteiro (RLS follows/profiles/visibility).
2. Wikisource (API MediaWiki + jszip no device) p/ os 5 brasileiros que faltam em PT:
   Brás Cubas*, O Guarani, Policarpo Quaresma, O Primo Basílio, Os Maias.
   (*Brás Cubas já achado no Gutenberg #54829 pela grafia antiga — está na prateleira ENEM.)
3. Pré-traduzir títulos carro-chefe 1× e hospedar EPUB PT no acervo (leitura instantânea).
4. Produção: chave grátis do Google Books em `EXPO_PUBLIC_GOOGLE_BOOKS_KEY` (evita 429).
