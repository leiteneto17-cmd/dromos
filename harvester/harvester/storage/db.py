"""Estado LOCAL em SQLite: incremental (o que já vimos) + deduplicação (por SHA256 e URL).

Não é banco de produção — é só a memória do Harvester entre rodadas. O produto é o catalog.json.
"""
from __future__ import annotations

import sqlite3
from contextlib import closing
from pathlib import Path

from harvester.models import BookRecord

SCHEMA = """
create table if not exists books (
  sha256      text primary key,
  url         text not null,
  fmt         text not null,
  source      text not null,
  size        integer default 0,
  title       text default '',
  author      text default '',
  language    text default 'pt',
  publisher   text default '',
  description text default '',
  pages       integer default 0,
  category    text default 'Outros',
  kids_score  real default 0,
  is_kids     integer default 0,
  cover_path  text default '',
  discovered_at text
);
create index if not exists books_url_idx on books(url);
create index if not exists books_kids_idx on books(is_kids);
"""


class Database:
    """Wrapper fino sobre o SQLite com upsert idempotente por SHA256."""

    def __init__(self, path: Path):
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(path))
        self.conn.row_factory = sqlite3.Row
        with closing(self.conn.cursor()) as cur:
            cur.executescript(SCHEMA)
        self.conn.commit()

    # -------- incremental --------
    def has_url(self, url: str) -> bool:
        cur = self.conn.execute("select 1 from books where url = ? limit 1", (url,))
        return cur.fetchone() is not None

    def has_sha(self, sha256: str) -> bool:
        cur = self.conn.execute("select 1 from books where sha256 = ? limit 1", (sha256,))
        return cur.fetchone() is not None

    # -------- upsert --------
    def upsert(self, b: BookRecord) -> None:
        """Insere/atualiza por SHA256 (dedup de conteúdo — mesmo arquivo em URLs diferentes)."""
        self.conn.execute(
            """
            insert into books (sha256,url,fmt,source,size,title,author,language,publisher,
                               description,pages,category,kids_score,is_kids,cover_path,discovered_at)
            values (:sha256,:url,:fmt,:source,:size,:title,:author,:language,:publisher,
                    :description,:pages,:category,:kids_score,:is_kids,:cover_path,:discovered_at)
            on conflict(sha256) do update set
              title=excluded.title, author=excluded.author, language=excluded.language,
              publisher=excluded.publisher, description=excluded.description, pages=excluded.pages,
              category=excluded.category, kids_score=excluded.kids_score, is_kids=excluded.is_kids,
              cover_path=excluded.cover_path
            """,
            {**b.to_dict(), "is_kids": int(b.is_kids)},
        )
        self.conn.commit()

    def all_books(self) -> list[BookRecord]:
        cur = self.conn.execute("select * from books order by is_kids desc, title asc")
        out: list[BookRecord] = []
        for row in cur.fetchall():
            d = dict(row)
            d["is_kids"] = bool(d["is_kids"])
            out.append(BookRecord(**d))
        return out

    def count(self) -> int:
        return int(self.conn.execute("select count(*) from books").fetchone()[0])

    def close(self) -> None:
        self.conn.close()
