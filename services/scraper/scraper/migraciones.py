"""Migraciones (DNM) consultation: DNI residence resolution and citizenship procedure.

The public pages are thin shells around one JSON endpoint, `api/ajax_consulta_tramite.php`
(POST `data=<json>`): the file/order number plus the holder's birth date as `DD/MM/YYYY`.
No browser or captcha is needed. The answer carries the full list of steps and the person's
data. Reaches the site through `MIGRACIONES_PROXY` when the network cannot (see `net.py`).
"""

from __future__ import annotations

import json
import re

from . import net
from .renaper import SourceError

BASE = "https://www.migraciones.gob.ar/accesible"
SOURCE = "migraciones"
USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36"

# kind -> (page directory, name of the number field in the request)
KINDS = {
    "dni": ("consultaTramitePrecaria", "nro_expediente"),
    "citizenship": ("consultaTramiteCiudadania", "id_orden"),
}

_BIRTH = re.compile(r"^\d{2}/\d{2}/\d{4}$")
_STEP = re.compile(r"^(\d{2})/(\d{2})/(\d{4}):\s*(.*)$")


def _iso(day_month_year: str) -> str:
    match = re.match(r"^(\d{2})/(\d{2})/(\d{4})$", day_month_year or "")
    return f"{match[3]}-{match[2]}-{match[1]}" if match else (day_month_year or "")


def fetch(kind: str, number: str, birth_date: str) -> dict:
    """Raw JSON answer of the consultation endpoint."""
    if kind not in KINDS:
        raise SourceError("bad_kind")
    digits = re.sub(r"\D", "", str(number))
    if not 1 <= len(digits) <= 12:
        raise SourceError("bad_number")
    if not _BIRTH.match(birth_date or ""):
        raise SourceError("bad_birth_date")
    directory, field = KINDS[kind]
    page = f"{BASE}/{directory}"
    response = net.session(SOURCE).post(
        f"{page}/api/ajax_consulta_tramite.php",
        data={"data": json.dumps({field: digits, "fecha_nac": birth_date})},
        headers={"User-Agent": USER_AGENT, "X-Requested-With": "XMLHttpRequest", "Referer": f"{page}/"},
        timeout=40,
    )
    if response.status_code != 200:
        raise SourceError(f"http_{response.status_code}")
    try:
        return json.loads(response.content.decode("utf-8", "replace"))
    except ValueError as exc:
        raise SourceError("bad_output") from exc


def _steps(rows: list[dict]) -> tuple[list[dict], str]:
    """Resolved steps (oldest first) and the title of the first unresolved one, if any."""
    done: list[dict] = []
    upcoming = ""
    for row in rows or []:
        text = (row.get("DESCRIPCION") or "").strip()
        match = _STEP.match(text)
        date, title = (f"{match[3]}-{match[2]}-{match[1]}", match[4]) if match else ("", text)
        # the citizenship answer has no RESUELTO flag: every listed step already happened
        if row.get("RESUELTO", "t") == "t":
            done.append({"date": date, "title": title, "detail": ""})
        elif not upcoming:
            upcoming = title
    return done, upcoming


def parse(kind: str, raw: dict) -> dict:
    """Answer -> {found, header, steps, finished}.

    A rejected query means the number and the birth date do not belong together
    ("mismatch"); the source gives no way to tell which one is wrong.
    """
    error = str(raw.get("error") or "").strip()
    if error and error != "-1":
        raise SourceError("mismatch")
    person = raw.get("datos_persona") or {}
    steps, upcoming = _steps(raw.get("data") or [])
    last = steps[-1] if steps else {"date": "", "title": ""}
    header = {"status": last["title"], "statusDate": last["date"], "next": upcoming}
    if kind == "dni":
        disposition = " · ".join(
            x for x in (person.get("nro_disposicion"), _iso(person.get("fecha_disposicion", ""))) if x
        )
        header.update(
            {
                "state": person.get("estado") or "",
                "office": person.get("delegacion") or "",
                "disposition": disposition,
                "expediente": str(person.get("nro_expediente") or ""),
            }
        )
    else:
        header.update(
            {
                "nationality": person.get("nacionalidad") or "",
                "expediente": str(person.get("exp_sadex") or ""),
            }
        )
    holder = " ".join(x for x in (person.get("apellidos"), person.get("nombres")) if x)
    # `holder` is shown once, when the user confirms the case is theirs; it is not stored
    # a resolved DNI file is over: the slot is freed. (Citizenship has no known final status yet.)
    finished = kind == "dni" and str(person.get("estado") or "").strip().upper() == "RESUELTO"
    return {"found": True, "header": header, "steps": steps, "finished": finished, "holder": holder}


def status(kind: str, number: str, birth_date: str) -> dict:
    return parse(kind, fetch(kind, number, birth_date))
