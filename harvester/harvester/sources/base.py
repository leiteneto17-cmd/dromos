"""Contrato de uma FONTE (SourcePlugin) — o coração da extensibilidade.

Adicionar uma biblioteca pública nova = implementar esta interface. O pipeline
(update_catalog) não muda: só descobre `DiscoveredFile`s de um `SourcePlugin` diferente.
"""
from __future__ import annotations

import abc
from collections.abc import Iterator

from harvester.crawler.http import PoliteClient
from harvester.models import DiscoveredFile


class SourcePlugin(abc.ABC):
    """Adaptador de uma fonte de livros de domínio público."""

    #: identificador estável usado no CLI e no registro (ex.: 'archive_public_domain').
    name: str = "base"
    #: rótulo humano.
    label: str = "Base"

    def __init__(self, client: PoliteClient):
        self.client = client

    @abc.abstractmethod
    def discover(self, limit: int | None = None) -> Iterator[DiscoveredFile]:
        """Itera arquivos candidatos (PDF/EPUB) da fonte, respeitando o `limit`.

        DEVE usar `self.client` (que já respeita robots/crawl-delay). NÃO baixa o arquivo
        inteiro aqui — só descobre a URL e pistas; a extração é etapa separada.
        """
        raise NotImplementedError
