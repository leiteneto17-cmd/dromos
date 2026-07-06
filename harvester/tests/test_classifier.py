"""Testes do classificador de categoria."""
from harvester.classify.classifier import classify
from harvester.models import BookRecord


def _book(title: str, desc: str = "") -> BookRecord:
    return BookRecord(url=f"http://x/{title}.epub", fmt="epub", source="t", title=title, description=desc)


def test_kids_book_becomes_infantil():
    b = classify(_book("Narizinho", "monteiro lobato historia infantil"), "era uma vez", 0.55)
    assert b.is_kids
    assert b.category == "Infantil"


def test_science_category():
    b = classify(_book("Introdução à Física", "astronomia e matematica"), "", 0.55)
    assert b.category in {"Ciência", "Técnico"}


def test_default_outros():
    b = classify(_book("Um título qualquer", "texto neutro"), "", 0.55)
    assert b.category == "Outros"
    assert not b.is_kids
