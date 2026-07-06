"""Fonte: Standard Ebooks (standardebooks.org) — ESQUELETO.

EPUBs de altíssima qualidade (domínio público, tipografia impecável), porém em INGLÊS e com
pouco infantil. Abordagem: consumir o feed OPDS (`/opds` / `/feeds`) — catálogo XML estável —
e coletar os EPUBs. Bom para clássicos adultos em EN; baixa prioridade para o foco PT/infantil.
Deferido nesta v1.
"""
from __future__ import annotations

from collections.abc import Iterator

from harvester.models import DiscoveredFile
from harvester.sources.base import SourcePlugin
from harvester.utils.logging import get_logger

log = get_logger("harvester.standard_ebooks")


class StandardEbooks(SourcePlugin):
    name = "standard_ebooks"
    label = "Standard Ebooks"

    def discover(self, limit: int | None = None) -> Iterator[DiscoveredFile]:
        log.warning("fonte '%s' ainda não implementada (ver docstring). Nada a coletar.", self.name)
        return iter(())
