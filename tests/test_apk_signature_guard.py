"""Isolated signing-gate tests: no actual APK, SDK, or signing secrets needed."""

import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import subprocess


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "apk_signature_guard.py"
SPEC = importlib.util.spec_from_file_location("apk_signature_guard", SCRIPT)
guard = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(guard)

DEBUG = "a" * 64
RELEASE = "b" * 64


def apksigner_output(digest=DEBUG, dn="CN=Android Debug, OU=Android, O=Unknown"):
    return ("Verifies\nVerified using v2 scheme (APK Signature Scheme v2): true\n"
            f"Signer #1 certificate DN: {dn}\n"
            f"Signer #1 certificate SHA-256 digest: {digest}\n")


class SigningGateTests(unittest.TestCase):
    def test_debug_audit_is_informational_only(self):
        fp, dn = guard.parse_certificate_report(apksigner_output())
        allowed, notice = guard.evaluate_signature(fp, dn, "audit")
        self.assertTrue(allowed)
        self.assertIn("no autorizada", notice)

    def test_debug_never_passes_distribution_even_with_allowlist(self):
        self.assertFalse(guard.evaluate_signature(DEBUG, "CN=Android Debug, O=Unknown", "distribution", DEBUG)[0])

    def test_no_allowlist_blocks_release(self):
        self.assertFalse(guard.evaluate_signature(RELEASE, "CN=Moneda Mundial", "distribution")[0])

    def test_mismatched_allowlist_blocks_release(self):
        self.assertFalse(guard.evaluate_signature(RELEASE, "CN=Moneda Mundial", "distribution", DEBUG)[0])

    def test_matching_approved_non_debug_certificate_passes_gate_only(self):
        allowed, notice = guard.evaluate_signature(RELEASE, "CN=Moneda Mundial", "distribution", RELEASE)
        self.assertTrue(allowed)
        self.assertIn("faltan", notice)

    def test_rejects_malformed_or_multiple_signers(self):
        with self.assertRaises(guard.SigningError):
            guard.parse_certificate_report("Signer #1 certificate DN: CN=Example")
        with self.assertRaises(guard.SigningError):
            guard.parse_certificate_report(apksigner_output() + apksigner_output().replace("#1", "#2"))

    def test_rejects_forged_short_digest(self):
        with self.assertRaises(guard.SigningError):
            guard.parse_certificate_report(apksigner_output(digest="a123"))

    def test_verification_failure_blocks_even_demo(self):
        with tempfile.TemporaryDirectory() as folder:
            apk = Path(folder, "demo.apk")
            apk.write_bytes(b"fixture-not-an-apk")
            with patch.object(guard.subprocess, "run", return_value=subprocess.CompletedProcess([], 1, "", "error")):
                with self.assertRaises(guard.SigningError):
                    guard.audit_apk(apk, "audit", apksigner="apksigner")

    def test_verified_test_output_runs_full_gate(self):
        with tempfile.TemporaryDirectory() as folder:
            apk = Path(folder, "demo.apk")
            apk.write_bytes(b"fixture-not-an-apk")
            fake = subprocess.CompletedProcess([], 0, apksigner_output(), "")
            with patch.object(guard.subprocess, "run", return_value=fake):
                allowed, message, fp, apk_sha = guard.audit_apk(apk, "distribution", RELEASE, "apksigner")
            self.assertFalse(allowed)
            self.assertEqual(fp, DEBUG)
            self.assertEqual(len(apk_sha), 64)


if __name__ == "__main__":
    unittest.main()
