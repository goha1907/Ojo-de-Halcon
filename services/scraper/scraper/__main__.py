"""CLI used by the Node worker; prints exactly one JSON document to stdout.

    python -m scraper renaper --number 755824304
    python -m scraper correo --number 755824304
    python -m scraper dnm-dni --number 1129912025        # birth date: env SCRAPER_BIRTH_DATE (DD/MM/YYYY)
    python -m scraper dnm-citizenship --number 2275808    # same
    python -m scraper pjn-party --jurisdiction 4 --name MEDVEDEV
    python -m scraper pjn-case --jurisdiction 4 --number 7900 --year 2026 [--header-only]
"""

from __future__ import annotations

import argparse
import json
import sys

import os

from . import migraciones, pjn, renaper


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="scraper")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("renaper").add_argument("--number", required=True)
    sub.add_parser("correo").add_argument("--number", required=True)
    sub.add_parser("dnm-dni").add_argument("--number", required=True)
    sub.add_parser("dnm-citizenship").add_argument("--number", required=True)
    party = sub.add_parser("pjn-party")
    party.add_argument("--jurisdiction", required=True)
    party.add_argument("--name", required=True)
    case = sub.add_parser("pjn-case")
    case.add_argument("--jurisdiction", required=True)
    case.add_argument("--number", type=int, required=True)
    case.add_argument("--year", type=int, required=True)
    case.add_argument("--header-only", action="store_true")
    return parser


def run(args: argparse.Namespace) -> dict:
    if args.command in ("dnm-dni", "dnm-citizenship"):  # plain HTTP; the birth date never goes in argv
        kind = "dni" if args.command == "dnm-dni" else "citizenship"
        birth = os.environ.get("SCRAPER_BIRTH_DATE", "")
        return {"ok": True, **migraciones.status(kind, args.number, birth)}
    if args.command == "correo":  # plain HTTP, no browser needed
        return {"ok": True, **renaper.correo_status(args.number)}

    from playwright.sync_api import sync_playwright

    with sync_playwright() as playwright:
        if args.command == "renaper":
            return {"ok": True, **renaper.renaper_status(args.number, playwright)}
        import ddddocr

        ocr = ddddocr.DdddOcr(show_ad=False)
        browser, page = pjn.open_home(playwright)
        try:
            if args.command == "pjn-party":
                return {"ok": True, "results": pjn.search_party(page, ocr, args.jurisdiction, args.name)}
            pjn.open_case(page, ocr, args.jurisdiction, args.number, args.year)
            result = {"ok": True, "header": pjn.case_header(page)}
            if not args.header_only:
                result["actuaciones"] = pjn.all_actuaciones(page)
            return result
        finally:
            browser.close()


def main() -> int:
    args = build_parser().parse_args()
    try:
        out = run(args)
    except (pjn.PjnError, renaper.SourceError) as exc:
        code = getattr(exc, "code", None) or str(exc)
        out = {"ok": False, "error": code}
    except Exception as exc:  # network/browser failures must come back as JSON
        out = {"ok": False, "error": "failed", "message": str(exc)[:300]}
    sys.stdout.write(json.dumps(out, ensure_ascii=False) + "\n")
    return 0 if out.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
