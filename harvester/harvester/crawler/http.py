"""Cliente HTTP EDUCADO — a regra número 1: nunca sobrecarregar o servidor.

Responsabilidades:
  - respeitar `robots.txt` (allow/deny + crawl-delay);
  - impor um atraso mínimo por HOST entre requisições;
  - repetir com backoff em falhas transitórias;
  - cache em disco com ETag/Last-Modified (revalida em vez de re-baixar).
"""
from __future__ import annotations

import hashlib
import json
import time
import urllib.robotparser as robotparser
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import requests

from harvester.config import Config
from harvester.utils.logging import get_logger

log = get_logger("harvester.http")


@dataclass
class Response:
    url: str
    status: int
    content: bytes
    headers: dict
    from_cache: bool = False

    @property
    def text(self) -> str:
        return self.content.decode("utf-8", errors="replace")


class PoliteClient:
    """HTTP com robots.txt + rate-limit por host + retries + cache ETag."""

    def __init__(self, config: Config):
        self.cfg = config
        self.session = requests.Session()
        self.session.headers["User-Agent"] = config.user_agent
        self._robots: dict[str, Optional[robotparser.RobotFileParser]] = {}
        self._last_hit: dict[str, float] = {}
        config.http_cache.mkdir(parents=True, exist_ok=True)

    # ---------------- robots.txt ----------------
    def _robot(self, url: str) -> Optional[robotparser.RobotFileParser]:
        host = urlparse(url).netloc
        if host in self._robots:
            return self._robots[host]
        rp = robotparser.RobotFileParser()
        robots_url = f"{urlparse(url).scheme}://{host}/robots.txt"
        try:
            resp = self.session.get(robots_url, timeout=15)
            if resp.status_code == 200:
                rp.parse(resp.text.splitlines())
            else:
                rp = None  # sem robots => permitido, mas seguimos com o delay padrão
        except requests.RequestException:
            rp = None
        self._robots[host] = rp
        return rp

    def allowed(self, url: str) -> bool:
        rp = self._robot(url)
        if rp is None:
            return True
        return rp.can_fetch(self.cfg.user_agent, url)

    def _host_delay(self, url: str) -> float:
        rp = self._robot(url)
        cd = None
        if rp is not None:
            try:
                cd = rp.crawl_delay(self.cfg.user_agent)
            except Exception:  # pragma: no cover
                cd = None
        return max(self.cfg.crawl_delay, float(cd or 0))

    def _throttle(self, url: str) -> None:
        host = urlparse(url).netloc
        wait = self._host_delay(url)
        last = self._last_hit.get(host, 0.0)
        elapsed = time.time() - last
        if elapsed < wait:
            time.sleep(wait - elapsed)
        self._last_hit[host] = time.time()

    # ---------------- cache ----------------
    def _cache_paths(self, url: str) -> tuple[Path, Path]:
        key = hashlib.sha256(url.encode()).hexdigest()[:24]
        return self.cfg.http_cache / f"{key}.bin", self.cfg.http_cache / f"{key}.meta.json"

    # ---------------- GET ----------------
    def get(self, url: str, revalidate: bool = True) -> Response:
        """GET educado com cache ETag. Levanta `PermissionError` se robots proibir."""
        if not self.allowed(url):
            raise PermissionError(f"robots.txt proíbe: {url}")

        body_path, meta_path = self._cache_paths(url)
        headers: dict = {}
        cached_meta: dict = {}
        if revalidate and meta_path.exists() and body_path.exists():
            try:
                cached_meta = json.loads(meta_path.read_text("utf-8"))
                if cached_meta.get("etag"):
                    headers["If-None-Match"] = cached_meta["etag"]
                if cached_meta.get("last_modified"):
                    headers["If-Modified-Since"] = cached_meta["last_modified"]
            except (OSError, json.JSONDecodeError):
                cached_meta = {}

        last_err: Optional[Exception] = None
        for attempt in range(self.cfg.retries):
            self._throttle(url)
            try:
                resp = self.session.get(url, headers=headers, timeout=30)
                if resp.status_code == 304 and body_path.exists():
                    log.info("304 (cache) %s", url)
                    return Response(url, 200, body_path.read_bytes(), cached_meta.get("headers", {}), True)
                resp.raise_for_status()
                # grava cache
                try:
                    body_path.write_bytes(resp.content)
                    meta_path.write_text(
                        json.dumps(
                            {
                                "etag": resp.headers.get("ETag"),
                                "last_modified": resp.headers.get("Last-Modified"),
                                "headers": dict(resp.headers),
                            }
                        ),
                        "utf-8",
                    )
                except OSError:
                    pass
                return Response(url, resp.status_code, resp.content, dict(resp.headers))
            except requests.RequestException as e:
                last_err = e
                sleep = self.cfg.backoff * (2**attempt)
                log.warning("falha (%s/%s) %s — retry em %.1fs: %s", attempt + 1, self.cfg.retries, url, sleep, e)
                time.sleep(sleep)
        raise RuntimeError(f"GET falhou após {self.cfg.retries} tentativas: {url}") from last_err
