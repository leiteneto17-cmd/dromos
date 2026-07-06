"""Extração de PDF via PyMuPDF (import: fitz): metadados, texto das 1ªs páginas e miniatura."""
from __future__ import annotations

from harvester.extractors.base import ExtractResult
from harvester.utils.logging import get_logger

log = get_logger("harvester.pdf")

FIRST_PAGES = 3  # páginas lidas p/ classificação
THUMB_ZOOM = 1.2  # renderização da capa (1ª página)


def extract_pdf(path: str) -> ExtractResult:
    try:
        import fitz  # PyMuPDF
    except ImportError as e:  # pragma: no cover
        raise RuntimeError("Instale PyMuPDF (pip install PyMuPDF) para extrair PDF.") from e

    res = ExtractResult()
    try:
        doc = fitz.open(path)
    except Exception as e:  # arquivo corrompido / não-PDF real
        log.warning("PDF ilegível %s: %s", path, e)
        return res

    try:
        meta = doc.metadata or {}
        res.title = (meta.get("title") or "").strip()
        res.author = (meta.get("author") or "").strip()
        res.pages = doc.page_count

        texts = []
        for i in range(min(FIRST_PAGES, doc.page_count)):
            try:
                texts.append(doc.load_page(i).get_text("text"))
            except Exception:  # pragma: no cover
                continue
        res.first_pages_text = "\n".join(texts).strip()

        # Miniatura = 1ª página renderizada em PNG.
        if doc.page_count:
            try:
                pix = doc.load_page(0).get_pixmap(matrix=fitz.Matrix(THUMB_ZOOM, THUMB_ZOOM))
                res.cover_bytes = pix.tobytes("png")
            except Exception:  # pragma: no cover
                pass
    finally:
        doc.close()
    return res
