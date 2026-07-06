"""Testes de storage: dedup por SHA256, incremental por URL e export catalog.json."""
import json

from harvester.models import BookRecord
from harvester.storage.db import Database
from harvester.storage.exporter import export_catalog


def _rec(sha: str, url: str, kids: bool = False) -> BookRecord:
    return BookRecord(url=url, fmt="pdf", source="t", sha256=sha, title="T", is_kids=kids)


def test_dedup_by_sha(tmp_path):
    db = Database(tmp_path / "d.sqlite")
    db.upsert(_rec("aaa", "http://x/1.pdf"))
    db.upsert(_rec("aaa", "http://x/2.pdf"))  # mesmo conteúdo, URL diferente → não duplica
    assert db.count() == 1
    assert db.has_sha("aaa")
    assert db.has_url("http://x/1.pdf")
    db.close()


def test_incremental_url(tmp_path):
    db = Database(tmp_path / "d.sqlite")
    db.upsert(_rec("bbb", "http://x/known.pdf"))
    assert db.has_url("http://x/known.pdf")
    assert not db.has_url("http://x/new.pdf")
    db.close()


def test_export_catalog_shape(tmp_path):
    db = Database(tmp_path / "d.sqlite")
    db.upsert(_rec("k1", "http://x/kid.pdf", kids=True))
    db.upsert(_rec("a1", "http://x/adult.pdf", kids=False))
    out = tmp_path / "catalog.json"
    n = export_catalog(db, out, base_url="https://cdn/x")
    assert n == 2
    data = json.loads(out.read_text("utf-8"))
    assert {"title", "epubUrl", "format", "language"} <= set(data[0].keys())

    # kids_only filtra
    kids_out = tmp_path / "kids.json"
    assert export_catalog(db, kids_out, kids_only=True) == 1
    db.close()
