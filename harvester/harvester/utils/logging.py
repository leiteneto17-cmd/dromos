"""Logging estruturado e simples do Harvester."""
from __future__ import annotations

import logging
import sys


def get_logger(name: str = "harvester", level: int = logging.INFO) -> logging.Logger:
    """Logger com formato consistente (uma configuração por processo)."""
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)-7s %(name)s: %(message)s", "%H:%M:%S"))
    logger.addHandler(handler)
    logger.setLevel(level)
    logger.propagate = False
    return logger
