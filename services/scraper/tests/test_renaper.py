import unittest

from scraper import renaper

RAW = {
    "data": {
        "descripcion_ultimo_estado": "Embalado",
        "fecha_ultimo_estado": "2026-10-20",
        "tramitesUI": [
            {
                "estado_label": "CORREO",
                "historico": [
                    {"FechaCambio": "2026-10-11", "EstadoMotivo": "Verificado", "estado": ""},
                    {"fecha": "2026-10-21", "evento": "Admitido", "estado": "EN VIAJE", "planta": "CABA"},
                ],
            }
        ],
    }
}


class RenaperTests(unittest.TestCase):
    def test_postal_stages_stay_in_the_renaper_card(self):
        parsed = renaper.parse_renaper(RAW)
        steps = renaper.combined_steps(parsed)
        self.assertEqual([s["title"] for s in steps], ["Verificado", "Admitido"])
        self.assertIn("CABA", steps[1]["detail"])

    def test_header_carries_the_status_used_for_the_final_rule(self):
        self.assertEqual(renaper.parse_renaper(RAW)["header"]["status"], "Embalado")


if __name__ == "__main__":
    unittest.main()


class CorreoFormsTest(unittest.TestCase):
    def test_trámite_forms_are_padded_to_twelve(self):
        self.assertEqual(renaper.correo_id("ondng", "755824304"), "000755824304")
        self.assertEqual(renaper.correo_id("onpa", "123456"), "000000123456")

    def test_coded_forms_need_seven_to_nine_digits(self):
        self.assertEqual(renaper.correo_id("ondnp", "123456789"), "123456789")
        for bad in ("123456", "1234567890", "12345678A"):
            with self.assertRaises(renaper.SourceError):
                renaper.correo_id("ondnc", bad)

    def test_international_code_shape(self):
        self.assertEqual(renaper.correo_id("oidn", "AB123456789CD"), "AB123456789CD")
        with self.assertRaises(renaper.SourceError):
            renaper.correo_id("oidn", "123456789")

    def test_parcel_codes_are_alphanumeric(self):
        self.assertEqual(renaper.correo_id("mercadolibre", "ABC123xyz"), "ABC123xyz")
        with self.assertRaises(renaper.SourceError):
            renaper.correo_id("ecommerce", "AB-12")

    def test_unknown_form_is_rejected(self):
        with self.assertRaises(renaper.SourceError):
            renaper.fetch_correo("123456789", action="nope")
