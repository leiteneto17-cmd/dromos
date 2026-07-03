# ACERVO — Status (aba Explorar + fontes de livros)
*Atualizado: 2026-07-03*

## Estado atual
- **Fontes vivas:** Project Gutenberg (funciona). **Fontes mortas/bloqueadas:** Standard
  Ebooks, ws-export (Anubis), Archive.org — ver [[acervo-fontes]].
- Google Books integrado no Explorar (selo 🔎) — **download NÃO validado** (429 por IP em
  dev; downloadLink pode exigir auth/redirect → se vier HTML, descartar/fallback).
- Comunidade/Explorar anti-rolagem: carrosséis horizontais, chips contextuais, sugestões
  de busca (commit `9eca41e`, aprovado).
- **Acervo curado próprio:** tabela `curated_books` no schema.sql + bucket `acervo` no
  Storage (formato em `src/services/curated-catalog.ts`). 4 PDFs traduzidos prontos em
  `docs/datasets-livros-traducao/`. **Bucket + upload + inserts AINDA NÃO FEITOS.**

## Decisões firmadas (ADR resumido)
- **Sem pirataria; sem CDL (aluguel de cópia digital = ilegal); não competir em catálogo
  licenciado** — diferencial é leitura ativa, não tamanho do acervo. NÃO REABRIR.
- Acervo próprio = traduções PT dos clássicos universais (Gutenberg só os tem em EN).

## Roadmap / próximos passos
1. **Deploy:** reaplicar `supabase/schema.sql` (RLS follows/profiles/visibility +
   `curated_books`) → criar bucket público `acervo` → subir os 4 PDFs → inserts.
2. Wikisource (API MediaWiki + jszip no device) p/ os 5 brasileiros que faltam em PT:
   Brás Cubas*, O Guarani, Policarpo Quaresma, O Primo Basílio, Os Maias.
   (*Brás Cubas já achado no Gutenberg #54829 pela grafia antiga — está na prateleira ENEM.)
3. Pré-traduzir títulos carro-chefe 1× e hospedar EPUB PT no acervo (leitura instantânea).
4. Produção: chave grátis do Google Books em `EXPO_PUBLIC_GOOGLE_BOOKS_KEY` (evita 429).
