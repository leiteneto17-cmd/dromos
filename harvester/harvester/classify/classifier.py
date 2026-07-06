"""Classificador de CATEGORIA (Infantil, Juvenil, Fábulas, Romance, História, Ciência,
Filosofia, Biografia, Técnico, Contos, Outros).

Score por categoria a partir de palavras-chave em título/descrição/URL. O especialista
infantil (classify.kids) entra com peso alto e também define a flag `is_kids`.
"""
from __future__ import annotations

from harvester.classify.kids import KidsSignals, is_kids, kids_score
from harvester.models import BookRecord
from harvester.utils.text import normalize

# Palavras-chave por categoria (sem acento). Ordem importa só para desempate estável.
CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "Infantil": ["infantil", "infancia", "era uma vez", "livro ilustrado"],
    "Fábulas": ["fabula", "fabulas", "esopo", "la fontaine"],
    "Contos": ["conto", "contos", "novela"],
    "Juvenil": ["juvenil", "aventura", "jovem"],
    "Romance": ["romance", "amor", "paixao"],
    "História": ["historia", "guerra", "imperio", "brasil colonia", "revolucao"],
    "Ciência": ["ciencia", "fisica", "quimica", "biologia", "astronomia", "matematica"],
    "Filosofia": ["filosofia", "etica", "metafisica", "socrates", "platao"],
    "Biografia": ["biografia", "memorias", "vida de", "autobiografia"],
    "Técnico": ["manual", "tecnico", "engenharia", "programacao", "direito", "medicina"],
}


def _category_scores(text: str) -> dict[str, float]:
    t = normalize(text)
    scores: dict[str, float] = {}
    for cat, kws in CATEGORY_KEYWORDS.items():
        scores[cat] = float(sum(1 for kw in kws if kw in t))
    return scores


def classify(book: BookRecord, first_pages: str, kids_threshold: float) -> BookRecord:
    """Preenche `category`, `kids_score` e `is_kids` no registro (in-place) e o devolve."""
    sig = KidsSignals(
        url=book.url,
        filename=book.url.rsplit("/", 1)[-1],
        title=book.title,
        author=book.author,
        description=book.description,
        first_pages=first_pages,
    )
    book.kids_score = round(kids_score(sig), 3)
    book.is_kids = is_kids(sig, kids_threshold)

    blob = " ".join([book.title, book.description, book.url, first_pages[:2000]])
    scores = _category_scores(blob)
    # Infantil ganha um empurrão pelo especialista (evita cair em "Contos" genérico).
    scores["Infantil"] = scores.get("Infantil", 0.0) + book.kids_score * 3.0

    best_cat, best = "Outros", 0.0
    for cat, sc in scores.items():
        if sc > best:
            best_cat, best = cat, sc
    book.category = best_cat if best > 0 else "Outros"
    if book.is_kids and book.category not in {"Infantil", "Fábulas", "Contos"}:
        book.category = "Infantil"
    return book
