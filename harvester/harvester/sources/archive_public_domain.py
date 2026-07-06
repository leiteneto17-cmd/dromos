"""Fonte: Archive Public Domain (https://archivepublicdomain.com).

Estratégia de descoberta (educada, sem sobrecarregar):
  1. varre páginas de listagem (`/`, e paginação `/page/N/`) atrás de links internos;
  2. coleta links diretos para arquivos `.pdf` / `.epub` (padrão `/files/AAAA/MM/nome.ext`);
  3. usa o texto do link/página como `title_hint` (ajuda a classificação).

⚠️ Só ingerir se a fonte declara domínio público. `robots.txt`/crawl-delay já são respeitados
pelo `PoliteClient`. `limit` corta cedo para não varrer o site inteiro numa rodada.
"""
from __future__ import annotations

import re
from collections.abc import Iterator
from urllib.parse import urljoin, urlparse

from harvester.models import DiscoveredFile
from harvester.sources.base import SourcePlugin
from harvester.utils.logging import get_logger

log = get_logger("harvester.archive")

BASE = "https://archivepublicdomain.com"
FILE_RE = re.compile(r"\.(pdf|epub)(\?|#|$)", re.IGNORECASE)
MAX_LISTING_PAGES = 40  # teto de segurança (paginação) por rodada


def _fmt_of(url: str) -> str | None:
    m = FILE_RE.search(url)
    return m.group(1).lower() if m else None


class ArchivePublicDomain(SourcePlugin):
    name = "archive_public_domain"
    label = "Archive Public Domain"

    def discover(self, limit: int | None = None) -> Iterator[DiscoveredFile]:
        try:
            from bs4 import BeautifulSoup  # import tardio: dep opcional só desta fonte
        except ImportError as e:  # pragma: no cover
            raise RuntimeError("Instale beautifulsoup4+lxml para usar esta fonte.") from e

        seen_files: set[str] = set()
        seen_pages: set[str] = set()
        count = 0

        # Fila de páginas de listagem: home + paginação.
        pages = [BASE + "/"] + [f"{BASE}/page/{n}/" for n in range(2, MAX_LISTING_PAGES + 1)]

        for page_url in pages:
            if limit is not None and count >= limit:
                return
            if page_url in seen_pages:
                continue
            seen_pages.add(page_url)
            try:
                if not self.client.allowed(page_url):
                    log.info("robots proíbe a listagem %s", page_url)
                    continue
                resp = self.client.get(page_url)
            except (PermissionError, RuntimeError) as e:
                log.warning("pulei %s: %s", page_url, e)
                continue
            if resp.status >= 400:
                continue

            soup = BeautifulSoup(resp.text, "lxml")
            found_any = False
            for a in soup.find_all("a", href=True):
                href = urljoin(page_url, a["href"])  # resolve relativo → absoluto
                if urlparse(href).netloc != urlparse(BASE).netloc:
                    continue
                fmt = _fmt_of(href)
                if not fmt or href in seen_files:
                    continue
                seen_files.add(href)
                found_any = True
                yield DiscoveredFile(
                    url=href,
                    fmt=fmt,
                    source=self.name,
                    title_hint=(a.get_text(" ", strip=True) or None),
                    page_url=page_url,
                )
                count += 1
                if limit is not None and count >= limit:
                    return

            # Se uma página de paginação não trouxe nada, provavelmente acabou.
            if not found_any and page_url != BASE + "/":
                log.info("sem arquivos em %s — encerrando paginação", page_url)
                break
