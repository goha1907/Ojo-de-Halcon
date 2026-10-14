import unittest

from scraper import migraciones
from scraper.renaper import SourceError

DNI = {
    "error": "",
    "data": [
        {"DESCRIPCION": "13/10/2025: EXPEDIENTE GENERADO", "RESUELTO": "t"},
        {"DESCRIPCION": "29/07/2026: DISPOSICIÓN DE RESIDENCIA", "RESUELTO": "t"},
        {"DESCRIPCION": "ENTREGA DE DNI", "RESUELTO": "f"},
    ],
    "datos_persona": {
        "apellidos": "PEREZ",
        "nombres": "ANA",
        "estado": "RESUELTO",
        "delegacion": "ENTRE RIOS",
        "nro_disposicion": "86089",
        "fecha_disposicion": "29/07/2026",
        "nro_expediente": "1129912025",
    },
}
CITIZENSHIP = {
    "error": "",
    "data": [
        {"DESCRIPCION": "06/10/2025: INICIO DE SOLICITUD DE CIUDADANÍA"},
        {"DESCRIPCION": "14/10/2026: TRÁMITE EN PROCESO DE REVISIÓN"},
    ],
    "datos_persona": {"nacionalidad": "RUSA", "exp_sadex": "50003732026"},
}


class ParseTests(unittest.TestCase):
    def test_dni_steps_header_and_upcoming_step(self):
        out = migraciones.parse("dni", DNI)
        self.assertEqual([s["date"] for s in out["steps"]], ["2025-10-13", "2026-07-29"])
        self.assertEqual(out["header"]["status"], "DISPOSICIÓN DE RESIDENCIA")
        self.assertEqual(out["header"]["statusDate"], "2026-07-29")
        self.assertEqual(out["header"]["next"], "ENTREGA DE DNI")
        self.assertEqual(out["header"]["disposition"], "86089 · 2026-07-29")
        self.assertEqual(out["header"]["office"], "ENTRE RIOS")
        # RESUELTO closes the file
        self.assertTrue(out["finished"])
        self.assertEqual(out["holder"], "PEREZ ANA")

    def test_open_file_is_not_finished(self):
        raw = {**DNI, "datos_persona": {**DNI["datos_persona"], "estado": "EN TRAMITE"}}
        self.assertFalse(migraciones.parse("dni", raw)["finished"])

    def test_citizenship_has_no_resolved_flag(self):
        out = migraciones.parse("citizenship", CITIZENSHIP)
        self.assertEqual(len(out["steps"]), 2)
        self.assertEqual(out["header"]["status"], "TRÁMITE EN PROCESO DE REVISIÓN")
        self.assertEqual(out["header"]["nationality"], "RUSA")
        self.assertEqual(out["header"]["next"], "")
        self.assertFalse(out["finished"])

    def test_rejected_query_is_a_mismatch(self):
        with self.assertRaises(SourceError) as ctx:
            migraciones.parse("dni", {"error": "Algún dato no coincide", "data": []})
        self.assertEqual(str(ctx.exception), "mismatch")

    def test_inputs_are_validated_before_any_request(self):
        for args in (("dni", "abc", "05/03/1990"), ("dni", "1129912025", "5/3/1990"), ("nope", "1", "05/03/1990")):
            with self.assertRaises(SourceError):
                migraciones.fetch(*args)


if __name__ == "__main__":
    unittest.main()
