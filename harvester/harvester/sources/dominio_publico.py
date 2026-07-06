"""Fonte: Domínio Público (portal do MEC, dominiopublico.gov.br) — ESQUELETO.

Forte em PT + infantil (Monteiro Lobato etc.), mas SEM API limpa: é um portal ASP.NET antigo
com busca por formulário (POST) e paginação instável. Abordagem recomendada quando for
implementar: reproduzir a busca (`/pesquisa/PesquisaObraForm.do`) filtrando categoria/idioma,
seguir os resultados até a página da obra e pegar o link do arquivo (PDF/EPUB). Respeitar
robots/crawl-delay (o `PoliteClient` já cuida) e limitar por rodada. Deferido nesta v1.
"""
from __future__ import annotations

from collections.abc import Iterator

from harvester.models import DiscoveredFile
from harvester.sources.base import SourcePlugin
from harvester.utils.logging import get_logger

log = get_logger("harvester.dominio_publico")


class DominioPublico(SourcePlugin):
    name = "dominio_publico"
    label = "Domínio Público (MEC)"

    def discover(self, limit: int | None = None) -> Iterator[DiscoveredFile]:
        log.warning("fonte '%s' ainda não implementada (ver docstring). Nada a coletar.", self.name)
        return iter(())
