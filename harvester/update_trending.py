#!/usr/bin/env python
"""Gera out/trending.json a partir da curadoria manual (trending.json na raiz).

Fluxo semanal (decisão 2026-07-10 — "Em alta no Brasil" REAL, sem inventar dado):
  1. Editar `harvester/trending.json` à mão consultando PublishNews / Veja / #BookTokBrasil.
  2. Rodar `python update_trending.py` — valida, enriquece com capa/link do Google Books
     (melhor esforço; sem rede, sai sem capa) e escreve `out/trending.json` com `rank`.
  3. Commitar/push — o app lê a URL pública (raw do GitHub ou Supabase Storage) e a seção
     "Em alta no Brasil" da Comunidade troca SEM release.

Sem chave de API: usa a quota keyless do Google Books (8 títulos/semana passa fácil).
"""
from __future__ import annotations

import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "trending.json"
OUT = ROOT / "out" / "trending.json"

# Chave OPCIONAL do Google Books (a quota keyless devolve 429 fácil). Aceita a mesma
# chave do app: GOOGLE_BOOKS_KEY ou EXPO_PUBLIC_GOOGLE_BOOKS_KEY no ambiente/.env.
GB_KEY = os.environ.get("GOOGLE_BOOKS_KEY") or os.environ.get("EXPO_PUBLIC_GOOGLE_BOOKS_KEY") or ""
GB_URL = "https://www.googleapis.com/books/v1/volumes?q={q}&country=BR&maxResults=1"
OL_URL = "https://openlibrary.org/search.json?title={t}&author={a}&limit=1&fields=cover_i"


def _https(u: str | None) -> str | None:
    return u.replace("http://", "https://") if u else None


def _get(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "DromosHarvester/1.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)


def enrich(title: str, author: str) -> dict:
    """Capa + link de compra/preview — melhor esforço, nunca falha.
    1º Google Books (capa + infoLink com botões de compra no BR; precisa de chave p/ não
    tomar 429); 2º Open Library só para a capa (sem chave). Sem nada → o app usa o
    fallback tipográfico e a busca da Amazon BR no toque."""
    q = urllib.parse.quote(f'intitle:"{title}" inauthor:"{author}"')
    try:
        url = GB_URL.format(q=q) + (f"&key={GB_KEY}" if GB_KEY else "")
        data = _get(url)
        item = (data.get("items") or [{}])[0]
        info = item.get("volumeInfo") or {}
        links = info.get("imageLinks") or {}
        cover = _https(links.get("thumbnail") or links.get("smallThumbnail"))
        if cover or info:
            return {"coverUrl": cover, "infoUrl": _https(info.get("infoLink"))}
    except Exception:
        pass
    try:  # fallback: capa do Open Library
        data = _get(OL_URL.format(t=urllib.parse.quote(title), a=urllib.parse.quote(author)))
        cover_i = (data.get("docs") or [{}])[0].get("cover_i")
        if cover_i:
            return {"coverUrl": f"https://covers.openlibrary.org/b/id/{cover_i}-M.jpg", "infoUrl": None}
    except Exception:
        pass
    return {"coverUrl": None, "infoUrl": None}


def main() -> int:
    raw = json.loads(SRC.read_text(encoding="utf-8"))
    items = raw.get("items") or []
    out: list[dict] = []
    for i, it in enumerate(items):
        title = (it.get("title") or "").strip()
        author = (it.get("author") or "").strip()
        if not title or not author:
            print(f"[AVISO] item {i} sem title/author — pulado", file=sys.stderr)
            continue
        extra = enrich(title, author)
        out.append(
            {
                "rank": len(out) + 1,
                "title": title,
                "author": author,
                "source": (it.get("source") or "").strip() or None,
                "coverUrl": it.get("coverUrl") or extra["coverUrl"],
                # buyUrl manual vence; senão o infoLink do Google Books; senão o app
                # cai na busca da Amazon BR na hora do toque.
                "buyUrl": it.get("buyUrl") or extra["infoUrl"],
            }
        )
        # ASCII no console (o cmd do Windows usa cp1252 e engasga com emoji).
        print(f"  #{len(out)} {title} - {author} {'[capa ok]' if out[-1]['coverUrl'] else '[sem capa]'}")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {"updated": raw.get("updated"), "items": out}
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"ok: {len(out)} itens -> {OUT}")
    return 0 if out else 1


if __name__ == "__main__":
    sys.exit(main())
