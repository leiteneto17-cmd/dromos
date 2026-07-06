"""Fontes plugáveis. `get_source(name)` resolve o plugin pelo nome (registro simples)."""
from __future__ import annotations

from harvester.sources.archive_public_domain import ArchivePublicDomain
from harvester.sources.base import SourcePlugin
from harvester.sources.gutenberg import Gutenberg

_REGISTRY: dict[str, type[SourcePlugin]] = {
    ArchivePublicDomain.name: ArchivePublicDomain,
    Gutenberg.name: Gutenberg,
}


def get_source(name: str) -> type[SourcePlugin]:
    if name not in _REGISTRY:
        raise KeyError(f"fonte desconhecida: {name}. Disponíveis: {', '.join(_REGISTRY)}")
    return _REGISTRY[name]


def available_sources() -> list[str]:
    return sorted(_REGISTRY)
