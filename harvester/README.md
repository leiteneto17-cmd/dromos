# Dromos Harvester

Ferramenta **local** (roda no seu PC) que descobre livros de **domínio público** na internet,
extrai metadados + capa, classifica (com foco no acervo **infantil**) e gera um único
**`catalog.json`** — que é publicado no GitHub e consumido pelo app Dromos.

## Arquitetura (estática — sem servidor, sem API, sem custo)

```
Seu PC → Harvester (Python) → SQLite → catalog.json → GitHub (raw) → App Dromos (ETag)
```

- **Sem VPS / sem API / sem banco em produção.** O SQLite é só o estado LOCAL (incremental +
  deduplicação). O produto final é o `catalog.json`.
- Sempre que achar livros novos: `python update_catalog.py` → regenera `catalog.json` → `git push`.
- O app baixa o `catalog.json` **uma vez** e revalida por **ETag** (só re-baixa se mudou).

O app já lê esse formato: `src/services/curated-catalog.ts` (`CuratedEntry[]`). Basta apontar
`extra.catalogUrl` (em `app.json`) para o raw do GitHub.

## Pipeline

```
Source (plugin) → descoberta de arquivos (PDF/EPUB) → HTTP educado (robots/crawl-delay/retry/cache)
  → extração de metadados + capa → normalização → classificação (categoria + score infantil)
  → deduplicação (SHA256) → SQLite → export catalog.json
```

## Fontes (plugins) — `harvester/sources/`

Cada fonte implementa a mesma interface `SourcePlugin` (Clean Architecture: o pipeline não muda,
só o adaptador). Primeira fonte: **Archive Public Domain**. Futuras: Project Gutenberg, Standard
Ebooks, Wikisource, Internet Archive (só domínio público), Domínio Público Brasil.

> ⚠️ **Legalidade:** só ingerir obras **realmente em domínio público / CC**. Respeitar `robots.txt`,
> `crawl-delay`, rate limit. Nunca sobrecarregar o servidor. Ver `docs`/`CLAUDE.md §4.3`.

## Uso

```bash
cd harvester
python -m venv .venv && . .venv/Scripts/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                 # ajuste se quiser
python update_catalog.py --source archive_public_domain --limit 50
# saída: ./out/catalog.json  (+ capas em ./out/covers/)
```

Rode os testes (lógica pura, sem rede):

```bash
pip install pytest
pytest
```

## Estrutura

```
harvester/
  update_catalog.py        # CLI (orquestra o pipeline)
  harvester/
    config.py              # configuração via .env
    models.py              # BookRecord (modelo de domínio)
    sources/               # SourcePlugin + fontes (archive_public_domain, ...)
    crawler/http.py        # HTTP educado (robots, crawl-delay, retry, cache, ETag)
    extractors/            # PDF (PyMuPDF) e EPUB (ebooklib): metadados + capa
    classify/              # classificador de categoria + especialista infantil (score)
    thumbnailer/           # normaliza/salva as capas
    storage/               # SQLite (incremental + dedup) + exporter catalog.json
    utils/                 # logging, hashing (sha256), texto
  tests/                   # testes unitários (classificador, kids, dedup, exporter)
```

## Qualidade
SOLID · Clean Architecture · type hints · docstrings · logging estruturado · testes ·
tratamento de exceções · baixo acoplamento (fontes plugáveis) · config via `.env`.
