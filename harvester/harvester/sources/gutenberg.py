"""Fonte: Project Gutenberg via API **Gutendex** (https://gutendex.com).

100% domínio público, JSON limpo (título/autor/idioma/capa/URL do EPUB). Diferente de um
crawler de HTML: consultamos a API paginada e emitimos um `DiscoveredFile` por livro com EPUB.
Padrão em PT (o acervo Dromos é PT-BR); dá para passar `languages`/`topic` no construtor.
"""
from __future__ import annotations

import json
from collections.abc import Iterator

from harvester.models import DiscoveredFile
from harvester.sources.base import SourcePlugin
from harvester.utils.logging import get_logger

log = get_logger("harvester.gutenberg")

API = "https://gutendex.com/books"
MAX_PAGES = 50  # teto de segurança por rodada


def _pick_epub(formats: dict) -> str | None:
    direct = formats.get("application/epub+zip")
    if direct:
        return direct
    for k, v in formats.items():
        if k.startswith("application/epub"):
            return v
    return None


class Gutenberg(SourcePlugin):
    name = "gutenberg"
    label = "Project Gutenberg"

    #: preset "infantil": subjects do Gutenberg que rendem acervo INFANTIL (o foco do Dromos Kids).
    KIDS_TOPICS = ["children", "juvenile", "fairy tales", "fables"]

    def __init__(self, client, languages: str = "pt", topic: str | None = None):
        super().__init__(client)
        self.languages = languages
        # `topic` aceita LISTA separada por vírgula (ex.: "children,fairy tales"); o preset
        # especial "kids" expande para KIDS_TOPICS. Sem topic → acervo geral (sort popular).
        if topic and topic.strip().lower() == "kids":
            self.topics: list[str | None] = list(self.KIDS_TOPICS)
        elif topic:
            self.topics = [t.strip() for t in topic.split(",") if t.strip()]
        else:
            self.topics = [None]

    def _page_url(self, page: int, topic: str | None) -> str:
        params = [f"languages={self.languages}", f"page={page}", "sort=popular"]
        if topic:
            params.append(f"topic={topic}")
        return f"{API}?{'&'.join(params)}"

    def discover(self, limit: int | None = None) -> Iterator[DiscoveredFile]:
        count = 0
        seen: set[str] = set()  # dedup entre subjects (um livro pode estar em vários)
        for topic in self.topics:
            for page in range(1, MAX_PAGES + 1):
                if limit is not None and count >= limit:
                    return
                url = self._page_url(page, topic)
                try:
                    resp = self.client.get(url, revalidate=False)
                except (PermissionError, RuntimeError) as e:
                    log.warning("Gutendex falhou %s: %s", url, e)
                    break
                try:
                    data = json.loads(resp.text)
                except json.JSONDecodeError:
                    log.warning("resposta não-JSON da Gutendex (%s)", url)
                    break

                results = data.get("results") or []
                if not results:
                    break
                for b in results:
                    epub = _pick_epub(b.get("formats") or {})
                    if not epub or epub in seen:
                        continue
                    seen.add(epub)
                    authors = ", ".join(a.get("name", "") for a in (b.get("authors") or []))
                    title = b.get("title") or ""
                    yield DiscoveredFile(
                        url=epub,
                        fmt="epub",
                        source=self.name,
                        title_hint=f"{title} — {authors}".strip(" —"),
                        page_url=url,
                    )
                    count += 1
                    if limit is not None and count >= limit:
                        return
                if not data.get("next"):
                    break
