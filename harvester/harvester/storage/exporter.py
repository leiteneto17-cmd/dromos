"""Export do SQLite → catalog.json (formato que o app Dromos consome).

O app (`src/services/curated-catalog.ts`) lê um array de `CuratedEntry`. Este exporter produz
exatamente esse formato. `base_url` (opcional) prefixa as capas locais para a URL pública
(ex.: raw do GitHub) — assim `coverUrl` já vem apontando para onde o app vai buscar.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from harvester.storage.db import Database
from harvester.utils.logging import get_logger

log = get_logger("harvester.export")


def export_catalog(db: Database, out_path: Path, base_url: str = "", kids_only: Optional[bool] = None) -> int:
    """Escreve o catalog.json e devolve quantas entradas exportou.

    `kids_only=True` gera um catálogo só do acervo infantil (útil para o Dromos Kids).
    """
    books = db.all_books()
    if kids_only is True:
        books = [b for b in books if b.is_kids]
    elif kids_only is False:
        books = [b for b in books if not b.is_kids]

    entries = [b.to_catalog_entry(base_url=base_url) for b in books]
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(entries, ensure_ascii=False, indent=2), "utf-8")
    log.info("catalog.json: %d entradas -> %s", len(entries), out_path)
    return len(entries)
