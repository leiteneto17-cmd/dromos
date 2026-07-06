"""Fonte: Internet Archive (archive.org) — ESQUELETO.

TEM API (`advancedsearch.php`) com EPUB/PDF. Abordagem: `q=mediatype:texts AND format:EPUB`,
EXCLUINDO as coleções de empréstimo (`inlibrary`/`printdisabled`, que têm DRM), ordenando por
downloads. ⚠️ CUIDADO (já observado no app, ver [[acervo-fontes]]): mesmo fora do empréstimo, a
busca crua traz PIRATARIA e conteúdo OFENSIVO — só habilitar com um filtro CURADO (coleções de
domínio público confiáveis). Por isso fica deferido nesta v1.
"""
from __future__ import annotations

from collections.abc import Iterator

from harvester.models import DiscoveredFile
from harvester.sources.base import SourcePlugin
from harvester.utils.logging import get_logger

log = get_logger("harvester.internet_archive")


class InternetArchive(SourcePlugin):
    name = "internet_archive"
    label = "Internet Archive"

    def discover(self, limit: int | None = None) -> Iterator[DiscoveredFile]:
        log.warning("fonte '%s' ainda não implementada (ver docstring — exige curadoria). Nada a coletar.", self.name)
        return iter(())
