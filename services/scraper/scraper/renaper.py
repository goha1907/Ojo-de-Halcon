"""RENAPER (mitramite.renaper.gob.ar) and Correo Argentino DNI tracking.

Two independent sources: a person may wait for the DNI at RENAPER only, at the
post office only, or both. RENAPER's page issues a reCAPTCHA v3 token itself, so
the same fetch runs from a Playwright page. The Correo site (form `ondng`, type
DNI) is a plain POST.
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
    office = data.get("oficina_remitente") or {}
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
            "office": office.get("descripcion", ""),
            "officeAddress": str(office.get("domicilio") or ""),
            "stage": ui.get("texto_front") or ui.get("descripcion", ""),
            "stageText": plain(ui.get("texto_cuerpo", "")),
            "previous": str(data.get("descripcion_anteultimo_estado") or ""),
            "previousDate": str(data.get("fecha_anteultimo_estado") or ""),
            "takenDate": str(data.get("fecha_toma") or ""),
            "class": str(data.get("clase_tramite") or ""),
            "pickup": str(data.get("tipo_retiro") or ""),
            "description": str(data.get("descripcion_tramite") or ""),
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


def _delivered(steps: list[dict]) -> bool:
    return any("entregad" in f"{s['title']} {s['detail']}".lower() for s in steps)


def combined_steps(parsed: dict) -> list[dict]:
    """RENAPER stages followed by the postal ones its answer carries (the post office part)."""
    return list(parsed["renaper_steps"]) + list(parsed["postal_steps"])


def renaper_status(number: str, playwright) -> dict:
    """RENAPER card: header and every stage, including the postal movement RENAPER reports.

    The postal stages stay in this card, so following a card to the door needs one case, not two.
    Whether the case is over is decided by its status (see FINAL_STATUSES in the shared config),
    not by the hand-over to the post office.
    """
    parsed = parse_renaper(fetch_renaper(number, playwright))
    if parsed is None:
        raise SourceError("not_found")
    return {
        "found": True,
        "header": parsed["header"],
        "steps": combined_steps(parsed),
        "finished": False,
    }


def correo_status(number: str) -> dict:
    """Correo tab: stages of the DNI shipment from the post office site (ondng form)."""
    steps = fetch_correo(number)
    if not steps:
        raise SourceError("not_found")
    return {"found": True, "header": {}, "steps": steps, "finished": _delivered(steps)}
