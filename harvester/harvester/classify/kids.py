"""Classificador ESPECIALISTA em literatura INFANTIL (o foco do acervo Dromos Kids).

Em vez de um sim/não frágil, calcula um SCORE (0..1) somando evidências de várias fontes
(URL, nome do arquivo, título/autor, descrição, primeiras páginas) com pesos. Reduz falsos
positivos: uma única pista fraca não classifica; o acúmulo de pistas, sim.
"""
from __future__ import annotations

from dataclasses import dataclass

from harvester.utils.text import normalize

# Palavras/expressões que indicam conteúdo infantil (sem acento, minúsculo).
KEYWORDS = [
    "infantil",
    "infancia",
    "para criancas",
    "para a infancia",
    "conto de fadas",
    "contos de fadas",
    "fabula",
    "fabulas",
    "era uma vez",
    "livro ilustrado",
    "historias infantis",
    "historia infantil",
    "para colorir",
    "conto infantil",
]

# Personagens/obras conhecidas (forte evidência quando aparecem no título).
CHARACTERS = [
    "narizinho",
    "emilia",
    "pedrinho",
    "picapau amarelo",
    "sitio do picapau",
    "peter rabbit",
    "peter pan",
    "pinoquio",
    "chapeuzinho",
    "branca de neve",
    "cinderela",
    "joao e maria",
    "gato de botas",
    "patinho feio",
    "os tres porquinhos",
    "alice no pais",
]

# Autores fortemente associados ao infantil (domínio público).
AUTHORS = ["monteiro lobato", "irmaos grimm", "hans christian andersen", "charles perrault", "esopo"]

# Sinais NEGATIVOS: reduzem o score (evita marcar adulto como infantil).
NEGATIVE = ["erotico", "erotica", "violencia", "manual", "tecnico", "tese", "doutorado", "codigo penal"]


@dataclass
class KidsSignals:
    """Textos de entrada por origem (cada um com um peso diferente)."""

    url: str = ""
    filename: str = ""
    title: str = ""
    author: str = ""
    description: str = ""
    first_pages: str = ""


# Peso de cada campo (o título vale mais que a descrição, que vale mais que as páginas).
FIELD_WEIGHTS = {
    "title": 0.40,
    "author": 0.30,
    "url": 0.15,
    "filename": 0.15,
    "description": 0.25,
    "first_pages": 0.20,
}


def _hits(text: str) -> float:
    """Evidência bruta de um texto: personagens/autores pesam mais que keywords genéricas."""
    t = normalize(text)
    if not t:
        return 0.0
    score = 0.0
    for kw in KEYWORDS:
        if kw in t:
            score += 0.5
    for ch in CHARACTERS:
        if ch in t:
            score += 1.0
    for au in AUTHORS:
        if au in t:
            score += 1.0
    return score


def _negative(text: str) -> float:
    t = normalize(text)
    return sum(0.6 for n in NEGATIVE if n in t)


def kids_score(sig: KidsSignals) -> float:
    """Score 0..1 de "quão infantil" é a obra, combinando evidências ponderadas.

    Calibragem: UMA evidência forte no título (personagem conhecido, peso 0.40) + o autor
    (0.30) já passam do limiar padrão (0.55). Cada campo satura em 2 acertos para não deixar
    um único campo dominar. Sinais negativos derrubam o score (evita falso positivo).
    """
    positive = 0.0
    for field_name, weight in FIELD_WEIGHTS.items():
        raw = _hits(getattr(sig, field_name, "") or "")
        positive += min(raw, 2.0) * weight

    negative = _negative(sig.description) + _negative(sig.title) + _negative(sig.first_pages)

    # `positive` já vive numa escala ~0..1 para casos típicos (título+autor ≈ 0.7); clamp cobre o resto.
    score = positive - negative
    return max(0.0, min(1.0, score))


def is_kids(sig: KidsSignals, threshold: float) -> bool:
    """Decisão final (acima do limiar configurável)."""
    return kids_score(sig) >= threshold
