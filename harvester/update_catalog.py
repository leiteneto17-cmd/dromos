#!/usr/bin/env python
"""CLI do Dromos Harvester — roda o pipeline e (re)gera o catalog.json.

Exemplos:
    python update_catalog.py --source archive_public_domain --limit 50
    python update_catalog.py --list-sources
    python update_catalog.py --source archive_public_domain --kids-only --base-url \
        https://raw.githubusercontent.com/seu-usuario/dromos/main/harvester/out
"""
from __future__ import annotations

import argparse
import sys

from harvester.config import load_config
from harvester.crawler.http import PoliteClient
from harvester.pipeline import run
from harvester.sources import available_sources, get_source
from harvester.storage.db import Database
from harvester.storage.exporter import export_catalog
from harvester.utils.logging import get_logger

log = get_logger("harvester")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Dromos Harvester — gera catalog.json de domínio público.")
    p.add_argument("--source", help="fonte a coletar (ex.: archive_public_domain)")
    p.add_argument("--limit", type=int, default=None, help="máximo de arquivos novos nesta rodada")
    p.add_argument("--languages", default="pt", help="idioma (fontes que suportam, ex.: gutenberg)")
    p.add_argument("--topic", default=None, help="assunto/bookshelf (ex.: children) — se a fonte suportar")
    p.add_argument("--base-url", default="", help="URL pública base p/ as capas (ex.: raw do GitHub)")
    p.add_argument("--kids-only", action="store_true", help="exporta só o acervo infantil")
    p.add_argument("--no-export", action="store_true", help="só coleta; não (re)gera o catalog.json")
    p.add_argument("--list-sources", action="store_true", help="lista as fontes disponíveis e sai")
    args = p.parse_args(argv)

    if args.list_sources:
        print("Fontes disponíveis:", ", ".join(available_sources()))
        return 0

    if not args.source:
        p.error("informe --source (ou use --list-sources)")

    cfg = load_config()
    cfg.ensure_dirs()

    try:
        source_cls = get_source(args.source)
    except KeyError as e:
        log.error(str(e))
        return 2

    client = PoliteClient(cfg)
    db = Database(cfg.db_path)
    try:
        source_kwargs: dict = {"languages": args.languages}
        if args.topic:
            source_kwargs["topic"] = args.topic
        source = source_cls(client, **source_kwargs)
        run(source, cfg, client, db, limit=args.limit)
        if not args.no_export:
            n = export_catalog(
                db,
                cfg.catalog_path,
                base_url=args.base_url,
                kids_only=True if args.kids_only else None,
            )
            log.info("total no catálogo: %d (banco: %d livros)", n, db.count())
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
