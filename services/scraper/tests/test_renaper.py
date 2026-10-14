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
