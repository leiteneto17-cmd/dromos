"""Hashing para deduplicação (SHA256 do conteúdo do arquivo)."""
from __future__ import annotations

import hashlib


def sha256_bytes(data: bytes) -> str:
    """SHA256 hex de um blob em memória."""
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: str, chunk: int = 1 << 20) -> str:
    """SHA256 hex de um arquivo, lendo em blocos (não carrega tudo na RAM)."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(chunk), b""):
            h.update(block)
    return h.hexdigest()
