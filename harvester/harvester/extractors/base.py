"""Extração de metadados/capa — despacho por formato."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ExtractResult:
    """Resultado da extração (campos vazios quando não disponíveis)."""

    title: str = ""
    author: str = ""
    language: str = ""
    publisher: str = ""
    description: str = ""
    pages: int = 0
    first_pages_text: str = ""  # texto das 1ªs páginas (alimenta a classificação/OCR)
    cover_bytes: Optional[bytes] = field(default=None, repr=False)


def extract(path: str, fmt: str) -> ExtractResult:
    """Extrai metadados/capa de um arquivo local, escolhendo o extractor pelo formato."""
    if fmt == "pdf":
        from harvester.extractors.pdf import extract_pdf

        return extract_pdf(path)
    if fmt == "epub":
        from harvester.extractors.epub import extract_epub

        return extract_epub(path)
    return ExtractResult()
