"""Per-source network egress.

Some sources cannot be reached from every network (Migraciones answers nothing to part of
the address space). A source can therefore be sent through a proxy by setting
`<SOURCE>_PROXY` (e.g. `MIGRACIONES_PROXY=socks5h://127.0.0.1:1080`); sources without the
variable go out directly, so a proxy never carries more traffic than it has to.
"""

from __future__ import annotations

import os

import requests


def proxy_url(source: str) -> str | None:
    """Proxy URL configured for `source` (`MIGRACIONES` -> `MIGRACIONES_PROXY`), or None."""
    value = os.environ.get(f"{source.upper()}_PROXY", "").strip()
    return value or None


def playwright_proxy(source: str) -> dict[str, str] | None:
    """`proxy=` argument of Playwright's `launch`/`new_context` for `source`."""
    url = proxy_url(source)
    if url is None:
        return None
    # Chromium takes SOCKS hosts without the remote-DNS suffix ("socks5h" is a requests notion)
    return {"server": url.replace("socks5h://", "socks5://", 1)}


def session(source: str) -> requests.Session:
    """A `requests` session that goes through the source's proxy, if one is configured."""
    http = requests.Session()
    url = proxy_url(source)
    if url is not None:
        http.proxies = {"http": url, "https": url}
    return http
