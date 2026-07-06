"""Fontes plugáveis. `get_source(name)` resolve o plugin pelo nome (registro simples)."""
from __future__ import annotations

from harvester.sources.archive_public_domain import ArchivePublicDomain
from harvester.sources.base import SourcePlugin
from harvester.sources.brasiliana import Brasiliana
from harvester.sources.dominio_publico import DominioPublico
from harvester.sources.gutenberg import Gutenberg
from harvester.sources.internet_archive import InternetArchive
from harvester.sources.standard_ebooks import StandardEbooks

# Conector-por-fonte (estratégia confirmada pelo usuário 2026-07-06). Prontas: gutenberg.
# Esqueletos (implementar quando priorizar PT/infantil): dominio_publico, brasiliana, ...
_REGISTRY: dict[str, type[SourcePlugin]] = {
    Gutenberg.name: Gutenberg,
    DominioPublico.name: DominioPublico,
    Brasiliana.name: Brasiliana,
    InternetArchive.name: InternetArchive,
    StandardEbooks.name: StandardEbooks,
    ArchivePublicDomain.name: ArchivePublicDomain,
}


def get_source(name: str) -> type[SourcePlugin]:
    if name not in _REGISTRY:
        raise KeyError(f"fonte desconhecida: {name}. Disponíveis: {', '.join(_REGISTRY)}")
    return _REGISTRY[name]


def available_sources() -> list[str]:
    return sorted(_REGISTRY)
