"""PJN (scw.pjn.gov.ar) public consultation: party search and case parsing.

Stays in Python because the text captcha is solved with the `ddddocr` OCR.
"""

from __future__ import annotations

import base64
import re
import time

URL = "https://scw.pjn.gov.ar/scw/home.seam"
# The captcha widget is not served to a headless-looking browser.
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
CAPTCHA_ATTEMPTS = 10

_PARSE_ACTUACIONES_JS = r"""() => {
    const out = [];
    for (const table of document.querySelectorAll('table')) {
        const header = (table.innerText || '').toUpperCase();
        if (!header.includes('FECHA') || !header.includes('DETALLE')) continue;
        for (const tr of table.querySelectorAll('tr')) {
            const cells = Array.from(tr.querySelectorAll('td')).map((td) => (td.innerText || '').trim());
            if (cells.length < 4) continue;
            const dateIdx = cells.findIndex((c) => /\d{1,2}\/\d{1,2}\/\d{4}/.test(c));
            if (dateIdx < 0) continue;
            const fecha = cells[dateIdx].match(/\d{1,2}\/\d{1,2}\/\d{4}/)[0];
            const rest = cells.slice(dateIdx + 1);
            out.push({
                oficina: cells[dateIdx - 1] || '',
                fecha,
                tipo: rest[0] || '',
                detalle: rest[1] || rest[0] || '',
            });
        }
    }
    return out;
}"""

_PARSE_RESULTS_JS = r"""() => {
    const rows = [];
    for (const table of document.querySelectorAll('table')) {
        const head = (table.innerText || '').toUpperCase();
        if (!head.includes('EXPEDIENTE') || !head.includes('CAR')) continue;
        for (const tr of table.querySelectorAll('tr')) {
            const cells = Array.from(tr.querySelectorAll('td')).map((td) => (td.innerText || '').trim());
            if (cells.length < 4 || !/\d{3,6}\/\d{4}/.test(cells[0])) continue;
            rows.push({
                expediente: cells[0], dependencia: cells[1], caratula: cells[2],
                situacion: cells[3] || '', ultima_actuacion: cells[4] || '',
            });
        }
    }
    return rows;
}"""


class PjnError(RuntimeError):
    def __init__(self, code: str, message: str = ""):
        super().__init__(message or code)
        self.code = code


def one_line(value: str) -> str:
    text = re.sub(r"\s+", " ", (value or "").replace(" ", " ")).strip()
    return re.sub(r"^(Oficina|Tipo actuacion|Detalle)\s*:\s*", "", text, flags=re.I).strip()


def decode_b64_image(src: str) -> bytes:
    b64 = re.sub(r"\s+", "", src.split(",", 1)[1] if "," in src else src)
    return base64.b64decode(b64 + "=" * ((-len(b64)) % 4))


def field_from_body(body: str, label: str) -> str:
    pattern = rf"{re.escape(label)}\s*:?\s*\n(.+?)(?:\n[A-ZÁÉÍÓÚÑ][^\n]{{0,40}}:|\n\n|$)"
    match = re.search(pattern, body, re.I | re.S)
    return re.sub(r"\s+", " ", match.group(1).strip()) if match else ""


def captcha_solved(page) -> bool:
    try:
        return bool(page.locator("#captcha-response").input_value(timeout=3000))
    except Exception:
        return False


def wait_captcha_approved(page, timeout_s: float = 8.0) -> bool:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        if captcha_solved(page):
            return True
        try:
            body = page.inner_text("body").lower()
        except Exception:
            time.sleep(0.15)
            continue
        if "desafío aprobado" in body or "desafio aprobado" in body:
            return True
        time.sleep(0.15)
    return captcha_solved(page)


def solve_captcha(page, ocr) -> bool:
    if captcha_solved(page):
        return True
    try:
        page.locator('iframe[name="captcha-frame"]').wait_for(timeout=15_000)
    except Exception:
        return False
    time.sleep(0.4)
    frame = page.frame_locator('iframe[name="captcha-frame"]')
    for _ in range(CAPTCHA_ATTEMPTS):
        button = frame.get_by_role("button", name=re.compile(r"VER DESAF", re.I))
        if button.count() and button.first.is_visible():
            button.first.click()
            time.sleep(0.7)
        if captcha_solved(page):
            return True
        image = frame.locator(".text-challenge-image img")
        try:
            image.wait_for(state="visible", timeout=4000)
        except Exception:
            continue
        src = image.get_attribute("src") or ""
        if "base64" not in src:
            continue
        digits = re.sub(r"\D", "", ocr.classification(decode_b64_image(src)))
        if len(digits) != 4:
            continue
        frame.locator('input[type="text"]').fill(digits)
        time.sleep(0.2)
        frame.get_by_role("button", name=re.compile(r"ACEPTAR", re.I)).click()
        if wait_captcha_approved(page):
            return True
    return False


def open_home(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_context(user_agent=USER_AGENT, locale="es-AR").new_page()
    page.goto(URL, wait_until="domcontentloaded", timeout=30_000)
    page.locator("#formPublica\\:numero").wait_for(state="visible", timeout=20_000)
    return browser, page


def open_case(page, ocr, jurisdiction: str, number: int, year: int) -> None:
    page.select_option("#formPublica\\:camaraNumAni", value=jurisdiction)
    page.fill("#formPublica\\:numero", str(number))
    page.fill("#formPublica\\:anio", str(year))
    if not solve_captcha(page, ocr):
        raise PjnError("captcha", "captcha was not solved")
    page.click("#formPublica\\:buscarPorNumeroButton")
    page.wait_for_function(
        """() => { const t = ((document.body && document.body.innerText) || '').toLowerCase();
            return t.includes('inexistente') || t.includes('datos generales')
                || t.includes('carátula') || t.includes('caratula') || t.includes('expediente:'); }""",
        timeout=25_000,
    )
    body = page.inner_text("body").lower()
    if "inexistente" in body:
        raise PjnError("not_found", "case does not exist")
    if "datos generales" not in body and "expediente:" not in body:
        raise PjnError("unexpected_page", "unexpected page after search")


def case_header(page) -> dict:
    body = page.inner_text("body")
    return {
        "expediente": field_from_body(body, "Expediente"),
        "dependencia": field_from_body(body, "Dependencia"),
        "sit_actual": field_from_body(body, "Sit. Actual"),
        "caratula": field_from_body(body, "Carátula") or field_from_body(body, "Caratula"),
    }


def all_actuaciones(page) -> list[dict]:
    tab = page.get_by_role("tab", name=re.compile(r"Actuaciones", re.I))
    if tab.count():
        tab.first.click()
        time.sleep(0.4)
    last = page.evaluate(
        r"""() => { const n = []; document.querySelectorAll('a').forEach((a) => {
            const t = (a.textContent || '').trim(); if (/^\d+$/.test(t)) n.push(parseInt(t, 10)); });
            return n.length ? Math.max(...n) : 1; }"""
    )
    collected: list[dict] = []
    for page_num in range(1, int(last) + 1):
        if page_num > 1:
            page.evaluate(
                """(target) => { for (const a of document.querySelectorAll('a')) {
                    if ((a.textContent || '').trim() === String(target)) { a.click(); return; } } }""",
                page_num,
            )
            page.wait_for_function(
                """(target) => { const el = document.querySelector('ul.pagination li.active');
                    return !!el && (el.textContent || '').trim() === String(target); }""",
                arg=page_num,
                timeout=20_000,
            )
            time.sleep(0.3)
        collected.extend(page.evaluate(_PARSE_ACTUACIONES_JS))
    cleaned = [{k: one_line(v) for k, v in row.items()} for row in collected]
    # site lists newest first; return oldest first with a stable `orden`
    cleaned.reverse()
    for index, row in enumerate(cleaned, start=1):
        row["orden"] = index
    return cleaned
