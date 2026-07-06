"""Logging estruturado e simples do Harvester."""
from __future__ import annotations

import logging
import sys


def get_logger(name: str = "harvester", level: int = logging.INFO) -> logging.Logger:
    """Logger com formato consistente (uma configuração por processo)."""
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger
    # Console do Windows costuma ser cp1252 → acentos/→ quebram o handler. Força UTF-8.
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:  # pragma: no cover - stdout sem reconfigure
        pass
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)-7s %(name)s: %(message)s", "%H:%M:%S"))
    logger.addHandler(handler)
    logger.setLevel(level)
    logger.propagate = False
    return logger
