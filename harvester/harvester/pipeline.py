"""Orquestração do pipeline: descoberta → download → dedup → extração → classificação →
storage. Mantém baixo acoplamento — recebe as dependências prontas (Config, Client, DB).
"""
from __future__ import annotations

import tempfile
from pathlib import Path

from harvester.classify.classifier import classify
from harvester.config import Config
from harvester.crawler.http import PoliteClient
from harvester.extractors.base import extract
from harvester.models import BookRecord, DiscoveredFile
from harvester.sources.base import SourcePlugin
from harvester.storage.db import Database
from harvester.thumbnailer.thumbs import save_cover
from harvester.utils.hashing import sha256_bytes
from harvester.utils.logging import get_logger
from harvester.utils.text import guess_language

log = get_logger("harvester.pipeline")


class Stats:
    """Observabilidade simples: contadores da rodada."""

    def __init__(self) -> None:
        self.discovered = 0
        self.skipped_known = 0
        self.duplicates = 0
        self.failed = 0
        self.ingested = 0
        self.kids = 0

    def __str__(self) -> str:
        return (
            f"descobertos={self.discovered} novos={self.ingested} infantis={self.kids} "
            f"já-vistos={self.skipped_known} duplicados={self.duplicates} falhas={self.failed}"
        )


def _process_one(df: DiscoveredFile, cfg: Config, client: PoliteClient, db: Database, stats: Stats) -> None:
    if db.has_url(df.url):
        stats.skipped_known += 1
        return
    try:
        resp = client.get(df.url, revalidate=False)  # arquivo binário: sem ETag round-trip
    except (PermissionError, RuntimeError) as e:
        log.warning("download falhou %s: %s", df.url, e)
        stats.failed += 1
        return

    data = resp.content
    sha = sha256_bytes(data)
    if db.has_sha(sha):
        stats.duplicates += 1
        return

    book = BookRecord(url=df.url, fmt=df.fmt, source=df.source, sha256=sha, size=len(data))
    if df.title_hint:
        book.title = df.title_hint.strip()

    # Extrai metadados/capa de um arquivo temporário (extractors trabalham em disco).
    first_pages = ""
    if cfg.download_files:
        with tempfile.NamedTemporaryFile(suffix=f".{df.fmt}", delete=False) as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        try:
            ex = extract(tmp_path, df.fmt)
            book.title = ex.title or book.title or Path(df.url).stem.replace("-", " ").strip()
            book.author = ex.author or book.author
            book.publisher = ex.publisher
            book.description = ex.description
            book.pages = ex.pages
            book.language = (ex.language or guess_language(ex.first_pages_text) or "pt")[:2]
            first_pages = ex.first_pages_text
            book.cover_path = save_cover(ex.cover_bytes, sha, cfg.covers_dir)
        except Exception as e:  # extração é best-effort; segue com o que tiver
            log.warning("extração falhou %s: %s", df.url, e)
        finally:
            Path(tmp_path).unlink(missing_ok=True)
    else:
        book.title = book.title or Path(df.url).stem.replace("-", " ").strip()

    classify(book, first_pages, cfg.kids_threshold)
    db.upsert(book)
    stats.ingested += 1
    if book.is_kids:
        stats.kids += 1
    log.info("+ %s [%s%s]", book.title[:60], book.category, " · KIDS" if book.is_kids else "")


def run(source: SourcePlugin, cfg: Config, client: PoliteClient, db: Database, limit: int | None = None) -> Stats:
    """Executa uma rodada de ingestão para uma fonte e devolve as estatísticas."""
    stats = Stats()
    for df in source.discover(limit=limit):
        stats.discovered += 1
        _process_one(df, cfg, client, db, stats)
    log.info("rodada concluída: %s", stats)
    return stats
