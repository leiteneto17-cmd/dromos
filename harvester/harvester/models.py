"""Modelos de domínio do Harvester.

`BookRecord` é a entidade central que atravessa todo o pipeline (descoberta → extração →
classificação → storage → export). Campos opcionais são preenchidos por etapas diferentes.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def source_cover_url(source: str, file_url: str) -> Optional[str]:
    """Deriva a URL da capa direto na fonte, sem baixar (cover_mode='source').

    Gutenberg: a capa é determinística pelo ID do ebook, presente no epubUrl
    (ex.: .../ebooks/16429.epub3.images → .../cache/epub/16429/pg16429.cover.medium.jpg).
    É o mesmo padrão que o SEED do app já usa. Retorna None se não der pra derivar.
    """
    if source == "gutenberg":
        import re

        m = re.search(r"/ebooks/(\d+)", file_url) or re.search(r"/epub/(\d+)", file_url)
        if m:
            gid = m.group(1)
            return f"https://www.gutenberg.org/cache/epub/{gid}/pg{gid}.cover.medium.jpg"
    return None


@dataclass
class DiscoveredFile:
    """Um arquivo candidato achado por uma fonte (antes de extrair/validar)."""

    url: str
    fmt: str  # 'pdf' | 'epub'
    source: str
    title_hint: Optional[str] = None  # texto do link/página (ajuda a classificação)
    page_url: Optional[str] = None  # página onde o link foi achado


@dataclass
class BookRecord:
    """Livro normalizado, pronto para o catálogo. `sha256` é a identidade (dedup)."""

    # Identidade / arquivo
    url: str
    fmt: str  # 'pdf' | 'epub'
    source: str
    sha256: str = ""
    size: int = 0

    # Metadados
    title: str = ""
    author: str = ""
    language: str = "pt"
    publisher: str = ""
    description: str = ""
    pages: int = 0

    # Classificação
    category: str = "Outros"
    kids_score: float = 0.0
    is_kids: bool = False

    # Capa (caminho local relativo à saída, ex.: covers/<sha>.jpg)
    cover_path: str = ""

    # Proveniência
    discovered_at: str = field(default_factory=_now_iso)

    def to_dict(self) -> dict:
        return asdict(self)

    def to_catalog_entry(self, base_url: str = "", cover_mode: str = "local") -> dict:
        """Converte para o formato que o app consome (`CuratedEntry` em curated-catalog.ts).

        `epubUrl` é a URL do ARQUIVO (mesmo para PDF — o app trata `format`). Capa por `cover_mode`:
          - 'source': deriva a URL da PRÓPRIA fonte (Gutenberg: .../cache/epub/<id>/pg<id>.cover.medium.jpg).
            Não pesa no repo e é o que o SEED do app já usa. Cai p/ 'local' se não der pra derivar.
          - 'local' (default): usa a capa baixada (base_url + cover_path), ou o caminho relativo.
        """
        cover = ""
        if cover_mode == "source":
            cover = source_cover_url(self.source, self.url) or ""
        if not cover and self.cover_path:
            cover = f"{base_url.rstrip('/')}/{self.cover_path}" if base_url else self.cover_path
        return {
            "title": self.title or "Sem título",
            "author": self.author or "",
            "language": self.language or "pt",
            "epubUrl": self.url,
            "coverUrl": cover or None,
            "format": self.fmt,
            # extras (o app ignora chaves desconhecidas):
            "category": self.category,
            "isKids": self.is_kids,
            "pages": self.pages or None,
            "source": self.source,
        }
