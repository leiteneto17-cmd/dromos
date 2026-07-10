"""Testes do update_trending.py — valida a curadoria manual e a geração do out/trending.json."""
import json
from pathlib import Path

import update_trending


def test_fonte_manual_valida():
    """O trending.json da raiz precisa ser válido: items com title+author."""
    raw = json.loads(update_trending.SRC.read_text(encoding="utf-8"))
    items = raw.get("items")
    assert isinstance(items, list) and len(items) > 0
    for it in items:
        assert it.get("title"), f"item sem title: {it}"
        assert it.get("author"), f"item sem author: {it}"


def test_gera_saida_com_rank(monkeypatch, tmp_path: Path):
    """Gera out/trending.json com rank sequencial, sem depender de rede."""
    monkeypatch.setattr(update_trending, "enrich", lambda t, a: {"coverUrl": None, "infoUrl": None})
    monkeypatch.setattr(update_trending, "OUT", tmp_path / "trending.json")
    assert update_trending.main() == 0
    data = json.loads((tmp_path / "trending.json").read_text(encoding="utf-8"))
    ranks = [it["rank"] for it in data["items"]]
    assert ranks == list(range(1, len(ranks) + 1))
    assert all(it["title"] and it["author"] for it in data["items"])
