"""Testes do classificador infantil (score por evidências)."""
from harvester.classify.kids import KidsSignals, is_kids, kids_score


def test_strong_kids_by_character_and_author():
    sig = KidsSignals(title="Narizinho Arrebitado", author="Monteiro Lobato")
    assert kids_score(sig) > 0.5
    assert is_kids(sig, 0.55)


def test_fairy_tale_keyword():
    sig = KidsSignals(title="Contos de Fadas", description="era uma vez uma princesa")
    assert kids_score(sig) > 0.3


def test_adult_technical_is_not_kids():
    sig = KidsSignals(title="Manual de Direito Penal", description="tratado tecnico")
    assert not is_kids(sig, 0.55)
    assert kids_score(sig) < 0.3


def test_negative_signal_reduces_score():
    weak = KidsSignals(title="Contos", description="conteudo erotico e violencia")
    assert kids_score(weak) < 0.3


def test_score_is_bounded():
    sig = KidsSignals(
        title="Peter Pan e Chapeuzinho", author="Irmaos Grimm", description="livro ilustrado infantil"
    )
    s = kids_score(sig)
    assert 0.0 <= s <= 1.0
