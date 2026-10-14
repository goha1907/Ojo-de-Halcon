"""RENAPER (mitramite.renaper.gob.ar) and Correo Argentino DNI tracking.

RENAPER's page issues a reCAPTCHA v3 token itself; we run the same fetch from a
Playwright page. The Correo site is a plain POST. One RENAPER answer also holds
the postal movement, which is used when the Correo site does not know the
shipment yet.
"""

from __future__ import annotations

import html
import json
import re
import urllib.parse
import urllib.request

RENAPER_URL = "https://mitramite.renaper.gob.ar/"
SITE_KEY = "6Ld2mMAbAAAAAM9grHC4aJ6pJT1TtvUz04q4Fvjs"
ACTION = "submit_tramite"
CORREO_ENDPOINT = (
    "https://www.correoargentino.com.ar/sites/all/modules/custom/ca_forms/api/wsFacade.php"
)
CORREO_REFERER = "https://www.correoargentino.com.ar/formularios/ondng"
CORREO_NOT_FOUND = "no se encontraron resultados"

_FETCH_JS = """async ([num, siteKey, action]) => {
  const token = await new Promise((ok, no) =>
    grecaptcha.ready(() => grecaptcha.execute(siteKey, { action }).then(ok, no)));
  const fd = new FormData();
  fd.append('tramite', num);
  fd.append('token', token);
  fd.append('action', action);
  const r = await fetch('busqueda.php', { method: 'POST', body: fd });
  return { status: r.status, text: await r.text() };
}"""


class SourceError(RuntimeError):
    pass


def digits(number: str, width: int) -> str:
    cleaned = re.sub(r"\D", "", str(number))
    if not 1 <= len(cleaned) <= width:
        raise SourceError("bad_number")
    return cleaned.zfill(width)


def plain(markup: str) -> str:
    text = re.sub(r"<(br|/p|/div|/li)[^>]*>", " ", markup or "", flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def fetch_renaper(number: str, playwright) -> dict:
    num = digits(number, 11)
    browser = playwright.chromium.launch(headless=True)
    try:
        page = browser.new_context(locale="es-AR").new_page()
        page.goto(RENAPER_URL, wait_until="load", timeout=45_000)
        page.wait_for_function("typeof grecaptcha !== 'undefined'", timeout=15_000)
        res = page.evaluate(_FETCH_JS, [num, SITE_KEY, ACTION])
    finally:
        browser.close()
    if res["status"] != 200:
        raise SourceError(f"http_{res['status']}")
    return json.loads(res["text"])


def parse_renaper(raw: dict) -> dict | None:
    """busqueda.php answer -> {header, steps (RENAPER only), postal steps}."""
    data = raw.get("data")
    if not data:
        return None
    ui = (data.get("tramitesUI") or [{}])[0] or {}
    history = ui.get("historico") or data.get("historico") or []
    renaper_steps, postal_steps = [], []
    for item in history:
        if not isinstance(item, dict):
            continue
        step = {
            "date": item.get("FechaCambio") or item.get("fecha", ""),
            "title": plain(item.get("EstadoMotivo", "")) or item.get("evento", ""),
            "detail": item.get("estado", ""),
        }
        if item.get("planta"):
            step["detail"] = " · ".join(x for x in (item["planta"], step["detail"]) if x)
            postal_steps.append(step)
        else:
            renaper_steps.append(step)
    if not renaper_steps:
        # no history yet: fall back to the previous and current states
        for prefix in ("anteultimo", "ultimo"):
            title = data.get(f"descripcion_{prefix}_estado")
            if title:
                renaper_steps.append({
                    "date": data.get(f"fecha_{prefix}_estado", ""),
                    "title": title,
                    "detail": "",
                })
    delivered = any(
        str(h.get("estado", "")).strip().upper() == "ENTREGADO" for h in history if isinstance(h, dict)
    )
    return {
        "header": {
            "status": data.get("descripcion_ultimo_estado", ""),
            "statusDate": data.get("fecha_ultimo_estado", ""),
            "type": data.get("tipo_tramite", ""),
            "office": (data.get("oficina_remitente") or {}).get("descripcion", ""),
            "stage": ui.get("texto_front") or ui.get("descripcion", ""),
        },
        "renaper_steps": renaper_steps,
        "postal_steps": postal_steps,
        "in_correo": (ui.get("estado_label", "").upper() == "CORREO") or bool(postal_steps),
        "delivered": delivered,
    }


def fetch_correo(number: str, timeout: float = 25.0) -> list[dict] | None:
    body = urllib.parse.urlencode({"action": "ondng", "id": digits(number, 12)}).encode()
    request = urllib.request.Request(
        CORREO_ENDPOINT,
        data=body,
        headers={
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": CORREO_REFERER,
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        fragment = response.read().decode("utf-8", "replace").replace("﻿", "")
    if CORREO_NOT_FOUND in fragment.lower():
        return None
    steps = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", fragment, flags=re.S | re.I):
        cells = [
            re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", c))).strip()
            for c in re.findall(r"<td[^>]*>(.*?)</td>", tr, flags=re.S | re.I)
        ]
        cells = [c for c in cells if c]
        if cells:
            steps.append({
                "date": cells[0],
                "title": cells[-1] if len(cells) > 1 else cells[0],
                "detail": " · ".join(cells[1:-1]),
            })
    return steps


def tramite(number: str, playwright) -> dict:
    """One trámite number -> both tabs: RENAPER steps and postal steps."""
    parsed = parse_renaper(fetch_renaper(number, playwright))
    try:
        correo_steps = fetch_correo(number)
    except Exception:  # the postal site may be down; RENAPER data still helps
        correo_steps = None
    if parsed is None and correo_steps is None:
        raise SourceError("not_found")
    postal = correo_steps if correo_steps else (parsed or {}).get("postal_steps", [])
    delivered = bool(parsed and parsed["delivered"]) or any(
        "entregad" in f"{s['title']} {s['detail']}".lower() for s in postal
    )
    return {
        "renaper": {
            "found": parsed is not None,
            "header": parsed["header"] if parsed else {},
            "steps": parsed["renaper_steps"] if parsed else [],
            "finished": bool(parsed and (parsed["in_correo"] or delivered)),
        },
        "correo": {
            "found": bool(postal),
            "header": {},
            "steps": postal,
            "finished": delivered,
        },
    }
