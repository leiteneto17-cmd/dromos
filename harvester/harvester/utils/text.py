"""Utilidades de texto (normalização para busca/classificação)."""
from __future__ import annotations

import re
import unicodedata


def strip_accents(s: str) -> str:
    """Remove acentos (para casar palavras-chave de forma robusta)."""
    nfkd = unicodedata.normalize("NFD", s)
    return "".join(c for c in nfkd if unicodedata.category(c) != "Mn")


def normalize(s: str) -> str:
    """Minúsculo, sem acento, espaços colapsados — para matching de keywords."""
    s = strip_accents(s or "").lower()
    return re.sub(r"\s+", " ", s).strip()


def guess_language(text: str, default: str = "pt") -> str:
    """Heurística leve de idioma PT vs EN por stopwords (sem dependência pesada)."""
    t = normalize(text)
    if not t:
        return default
    pt = sum(t.count(w) for w in (" de ", " que ", " os ", " uma ", " com ", " nao ", " para "))
    en = sum(t.count(w) for w in (" the ", " and ", " of ", " to ", " with ", " for ", " that "))
    if pt == en:
        return default
    return "pt" if pt > en else "en"
