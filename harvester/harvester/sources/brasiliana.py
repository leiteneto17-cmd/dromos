"""Fonte: Biblioteca Brasiliana Guita e José Mindlin (USP) — ESQUELETO.

Acervo clássico brasileiro digitalizado (forte em PT). Tem OPDS/estrutura parcial. Abordagem:
consumir o feed/catálogo (quando disponível) ou navegar as coleções, coletando os PDFs de
domínio público. Muitos itens são fac-símiles (PDF só imagem) → marcar para OCR premium no app
(§4.9). Deferido nesta v1.
"""
from __future__ import annotations

from collections.abc import Iterator

from harvester.models import DiscoveredFile
from harvester.sources.base import SourcePlugin
from harvester.utils.logging import get_logger

log = get_logger("harvester.brasiliana")


class Brasiliana(SourcePlugin):
    name = "brasiliana"
    label = "Brasiliana USP"

    def discover(self, limit: int | None = None) -> Iterator[DiscoveredFile]:
        log.warning("fonte '%s' ainda não implementada (ver docstring). Nada a coletar.", self.name)
        return iter(())
