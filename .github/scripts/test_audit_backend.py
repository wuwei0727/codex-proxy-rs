"""The SQLite exception must never hide an active vulnerable dependency."""

import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location(
    "audit_backend", Path(__file__).with_name("audit-backend.py")
)
audit_backend = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit_backend)


class AuditArgumentsTests(unittest.TestCase):
    def test_unused_sqlite_has_only_the_specific_exception(self):
        self.assertEqual(
            audit_backend.audit_arguments("gateway-store v0.1.0\nsqlx v0.9.0 (*)\n"),
            ["cargo-audit", "audit", "--file", "backend/Cargo.lock",
             "--ignore", "RUSTSEC-2026-0459"],
        )

    def test_active_sqlite_is_not_exempt(self):
        self.assertNotIn(
            "--ignore", audit_backend.audit_arguments("gateway-store v0.1.0\nlibsqlite3-sys v0.37.0 (*)\n")
        )

    def test_missing_resolution_fails_closed(self):
        with self.assertRaises(ValueError):
            audit_backend.audit_arguments("\n")


if __name__ == "__main__":
    unittest.main()
