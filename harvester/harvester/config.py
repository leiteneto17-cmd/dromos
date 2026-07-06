"""Configuração do Harvester, carregada do ambiente (.env opcional).

Fonte única de parâmetros operacionais. Sem estado global mutável: `load_config()` devolve um
dataclass imutável que é injetado nos componentes (baixo acoplamento / testabilidade).
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

try:  # .env é opcional; sem a lib, usa só o ambiente/os padrões.
    from dotenv import load_dotenv

    load_dotenv()
except Exception:  # pragma: no cover - dependência opcional
    pass


def _f(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def _i(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def _b(name: str, default: bool) -> bool:
    v = os.getenv(name)
    if v is None:
        return default
    return v.strip().lower() in {"1", "true", "yes", "y", "on"}


@dataclass(frozen=True)
class Config:
    """Parâmetros operacionais imutáveis do Harvester."""

    user_agent: str = os.getenv(
        "HARVESTER_USER_AGENT", "DromosHarvester/0.1 (+https://github.com/dromos)"
    )
    crawl_delay: float = _f("HARVESTER_CRAWL_DELAY", 2.0)
    retries: int = _i("HARVESTER_RETRIES", 3)
    backoff: float = _f("HARVESTER_BACKOFF", 1.5)
    out_dir: Path = Path(os.getenv("HARVESTER_OUT_DIR", "./out"))
    db_path: Path = Path(os.getenv("HARVESTER_DB_PATH", "./out/harvester.sqlite"))
    http_cache: Path = Path(os.getenv("HARVESTER_HTTP_CACHE", "./out/http_cache"))
    kids_threshold: float = _f("HARVESTER_KIDS_THRESHOLD", 0.55)
    download_files: bool = _b("HARVESTER_DOWNLOAD_FILES", True)

    @property
    def covers_dir(self) -> Path:
        return self.out_dir / "covers"

    @property
    def catalog_path(self) -> Path:
        return self.out_dir / "catalog.json"

    def ensure_dirs(self) -> None:
        for d in (self.out_dir, self.covers_dir, self.http_cache, self.db_path.parent):
            d.mkdir(parents=True, exist_ok=True)


def load_config() -> Config:
    """Devolve a configuração efetiva (ambiente/.env com padrões)."""
    return Config()
