"""Normaliza e salva as capas (bytes → JPEG redimensionado em out/covers/<sha>.jpg)."""
from __future__ import annotations

import io
from pathlib import Path
from typing import Optional

from harvester.utils.logging import get_logger

log = get_logger("harvester.thumbs")

MAX_W = 480  # largura máxima da capa (leve para o app)


def save_cover(cover_bytes: Optional[bytes], sha256: str, covers_dir: Path) -> str:
    """Salva a capa como JPEG e devolve o caminho relativo (covers/<sha>.jpg) ou "" se falhar."""
    if not cover_bytes:
        return ""
    try:
        from PIL import Image
    except ImportError:  # pragma: no cover - sem Pillow, grava os bytes crus
        out = covers_dir / f"{sha256}.img"
        out.write_bytes(cover_bytes)
        return f"covers/{out.name}"

    try:
        img = Image.open(io.BytesIO(cover_bytes)).convert("RGB")
        if img.width > MAX_W:
            h = round(img.height * (MAX_W / img.width))
            img = img.resize((MAX_W, h), Image.LANCZOS)
        out = covers_dir / f"{sha256}.jpg"
        img.save(out, "JPEG", quality=82, optimize=True)
        return f"covers/{out.name}"
    except Exception as e:
        log.warning("capa inválida (%s): %s", sha256[:8], e)
        return ""
