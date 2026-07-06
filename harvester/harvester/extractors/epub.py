"""Extração de EPUB via ebooklib: título, autor, idioma, editora, descrição e capa."""
from __future__ import annotations

from harvester.extractors.base import ExtractResult
from harvester.utils.logging import get_logger

log = get_logger("harvester.epub")


def _meta(book, name: str) -> str:
    try:
        items = book.get_metadata("DC", name)
        return (items[0][0] or "").strip() if items else ""
    except Exception:  # pragma: no cover
        return ""


def extract_epub(path: str) -> ExtractResult:
    try:
        from ebooklib import epub, ITEM_COVER, ITEM_IMAGE, ITEM_DOCUMENT
    except ImportError as e:  # pragma: no cover
        raise RuntimeError("Instale ebooklib (pip install ebooklib) para extrair EPUB.") from e

    res = ExtractResult()
    try:
        book = epub.read_epub(path)
    except Exception as e:
        log.warning("EPUB ilegível %s: %s", path, e)
        return res

    res.title = _meta(book, "title")
    res.author = _meta(book, "creator")
    res.language = _meta(book, "language")[:2].lower()
    res.publisher = _meta(book, "publisher")
    res.description = _meta(book, "description")

    # Capa: item ITEM_COVER; senão a 1ª imagem chamada "cover".
    try:
        covers = list(book.get_items_of_type(ITEM_COVER))
        if not covers:
            covers = [i for i in book.get_items_of_type(ITEM_IMAGE) if "cover" in (i.get_name() or "").lower()]
        if covers:
            res.cover_bytes = covers[0].get_content()
    except Exception:  # pragma: no cover
        pass

    # Texto das 1ªs seções (classificação): concatena até ~4000 chars.
    try:
        from bs4 import BeautifulSoup

        chunks: list[str] = []
        for item in book.get_items_of_type(ITEM_DOCUMENT):
            txt = BeautifulSoup(item.get_content(), "lxml").get_text(" ", strip=True)
            if txt:
                chunks.append(txt)
            if sum(len(c) for c in chunks) > 4000:
                break
        res.first_pages_text = " ".join(chunks)[:4000]
    except Exception:  # pragma: no cover
        pass
    return res
