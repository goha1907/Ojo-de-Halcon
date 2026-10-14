import os
import unittest
from unittest import mock

from scraper import net


class ProxyTests(unittest.TestCase):
    def test_no_variable_means_direct(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertIsNone(net.proxy_url("migraciones"))
            self.assertIsNone(net.playwright_proxy("migraciones"))
            self.assertEqual(net.session("migraciones").proxies, {})

    def test_only_the_named_source_uses_the_proxy(self):
        env = {"MIGRACIONES_PROXY": "socks5h://127.0.0.1:1080"}
        with mock.patch.dict(os.environ, env, clear=True):
            self.assertEqual(net.proxy_url("migraciones"), "socks5h://127.0.0.1:1080")
            self.assertIsNone(net.proxy_url("renaper"))
            self.assertEqual(
                net.session("migraciones").proxies,
                {"http": "socks5h://127.0.0.1:1080", "https": "socks5h://127.0.0.1:1080"},
            )
            self.assertEqual(net.playwright_proxy("migraciones"), {"server": "socks5://127.0.0.1:1080"})

    def test_blank_value_is_ignored(self):
        with mock.patch.dict(os.environ, {"MIGRACIONES_PROXY": "  "}, clear=True):
            self.assertIsNone(net.proxy_url("migraciones"))


if __name__ == "__main__":
    unittest.main()
