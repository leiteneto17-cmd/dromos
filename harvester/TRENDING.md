# "Em alta no Brasil" 🇧🇷 — rotina semanal

A seção **Em alta no Brasil** da aba Comunidade é curadoria **manual**, atualizada por você
uma vez por semana. Não há servidor: o app lê um `trending.json` hospedado no **raw do GitHub**
e troca a lista **sem republicar o app**.

> Por que manual? Best-sellers têm copyright — aqui só circulam **metadados** (título, autor,
> capa, link de compra), nunca o arquivo (CLAUDE.md §4.3). E não existe API legal de "mais
> vendidos no Brasil"; a fonte real são rankings editoriais + redes. Ver `docs/IDEIAS-FUTURAS.md`.

## Passo a passo (≈5 min/semana)

**1. Edite a curadoria** — `harvester/trending.json`, campo `items`:
```json
{ "title": "Nome do Livro", "author": "Autor", "source": "PublishNews" }
```
Consulte e escolha ~8 títulos em:
- **PublishNews** — ranking oficial de vendas do mercado editorial BR
- **Lista da Veja** / portais literários
- **#BookTokBrasil** / **#Bookstagram** — o que está viralizando
`source` é só o rótulo "via ..." que aparece no app. `buyUrl` é opcional (sem ele o app
manda pra busca da Amazon BR no toque).

**2. Gere o arquivo final** (valida, baixa capa, numera o rank):
```bash
cd harvester
.venv/Scripts/python.exe update_trending.py
```
Capas melhores com a chave do Google Books (opcional):
```bash
GOOGLE_BOOKS_KEY=suachave .venv/Scripts/python.exe update_trending.py
```
Sem a chave, cai no Open Library (cobre menos títulos BR). Capa faltando → o app usa o
fallback tipográfico, sem quebrar.

**3. Publique:**
```bash
cd ..
git add harvester/trending.json harvester/out/trending.json
git commit -m "trending: semana de DD/MM"
git push
```

Pronto. O app mostra a lista nova **ao reiniciar** (ele cacheia o JSON por sessão — feche e
reabra para ver na hora).

## Como o app acha o arquivo

`app.json` → `extra.trendingUrl` aponta para o raw do GitHub:
```
https://raw.githubusercontent.com/leiteneto17-cmd/dromos/main/harvester/out/trending.json
```
Se esvaziar essa URL, o app cai sozinho no fallback **"Em alta no mundo 🌍"** (Open Library
global). Nada quebra se o trending sumir.

## Notas

- **`out/` é ignorado pelo git**, MENOS o `trending.json` (exceção em `harvester/.gitignore`).
  Só ele é versionado — o `catalog.json`, o sqlite e as capas geradas NÃO sobem.
- **Não coloque nada sensível** no `trending.json`: o repositório é **público**, o arquivo é
  lido por qualquer um. Só metadados de livro, que é o objetivo.
- O `update_trending.py` só faz leitura de APIs públicas (Google Books / Open Library) — não
  usa nem grava segredo nenhum.
