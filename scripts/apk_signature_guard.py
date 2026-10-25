#!/usr/bin/env python3
"""Fail-closed APK signing gate for Moneda Mundial demo/release workflows.

An audit is informational and NEVER approves distribution. The distribution
gate requires an independently approved signing-certificate SHA-256 fingerprint.
No key material is read, created, or stored by this script.
"""

import argparse
import hashlib
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys


FINGERPRINT = re.compile(r"^[a-f0-9]{64}$")
SIGNER_DIGEST = re.compile(
    r"^Signer #(\d+) certificate SHA-256 digest: ([a-fA-F0-9:]+)$", re.MULTILINE
)
SIGNER_DN = re.compile(r"^Signer #(\d+) certificate DN: (.+)$", re.MULTILINE)


class SigningError(Exception):
    pass


def normalize_fingerprint(raw):
    value = (raw or "").strip().replace(":", "").lower()
    if not FINGERPRINT.fullmatch(value):
        raise SigningError("La huella SHA-256 permitida no tiene 64 dígitos hexadecimales.")
    return value


def parse_certificate_report(output):
    """Require one identifiable signer; apksigner exit status is checked upstream."""
    digest_matches = SIGNER_DIGEST.findall(output)
    dn_matches = SIGNER_DN.findall(output)
    if len(digest_matches) != 1 or len(dn_matches) != 1:
        raise SigningError("Se requiere exactamente un firmante identificable.")
    digest_num, digest_raw = digest_matches[0]
    dn_num, dn = dn_matches[0]
    if digest_num != dn_num:
        raise SigningError("No coincide la identidad del firmante con su huella.")
    return normalize_fingerprint(digest_raw), dn.strip()


def evaluate_signature(fingerprint, dn, purpose, approved_fingerprint=None):
    debug_certificate = bool(re.search(r"(?:^|,)\s*CN\s*=\s*Android Debug(?:,|$)", dn, re.I))
    if purpose == "audit":
        return (True, "SOLO DEMOSTRACIÓN: no autorizada para distribución.")
    if purpose != "distribution":
        raise SigningError("Propósito desconocido; se bloquea la operación.")
    if debug_certificate:
        return (False, "BLOQUEADO: certificado Android Debug detectado.")
    if not approved_fingerprint:
        return (False, "BLOQUEADO: falta huella aprobada en MWD_RELEASE_CERT_SHA256.")
    if fingerprint != normalize_fingerprint(approved_fingerprint):
        return (False, "BLOQUEADO: certificado distinto del aprobado.")
    return (True, "Firma coincidente con la huella aprobada; faltan las demás verificaciones de lanzamiento.")


def find_apksigner():
    executable = shutil.which("apksigner")
    if executable:
        return executable
    sdk_root = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT")
    if sdk_root:
        builds = Path(sdk_root, "build-tools")
        if builds.is_dir():
            candidates = [path / "apksigner" for path in builds.iterdir() if (path / "apksigner").is_file()]
            if candidates:
                def version(path):
                    return tuple(int(piece) for piece in re.findall(r"\d+", path.parent.name))
                return str(max(candidates, key=version))
    raise SigningError("No se encontró apksigner del Android SDK.")


def audit_apk(apk_path, purpose, approved_fingerprint=None, apksigner=None):
    if not apk_path.is_file() or apk_path.stat().st_size == 0:
        raise SigningError("La APK no existe o está vacía.")
    binary = apksigner or find_apksigner()
    result = subprocess.run(
        [binary, "verify", "--verbose", "--print-certs", str(apk_path)],
        capture_output=True, text=True, check=False, timeout=120,
    )
    if result.returncode != 0:
        raise SigningError("apksigner no pudo verificar la firma de la APK.")
    fingerprint, dn = parse_certificate_report(result.stdout)
    allowed, message = evaluate_signature(fingerprint, dn, purpose, approved_fingerprint)
    artifact_sha = hashlib.sha256(apk_path.read_bytes()).hexdigest()
    return allowed, message, fingerprint, artifact_sha


def main(argv=None):
    parser = argparse.ArgumentParser(description="Auditar la firma de APK Moneda Mundial.")
    parser.add_argument("apk", type=Path)
    parser.add_argument("--purpose", required=True, choices=["audit", "distribution"])
    args = parser.parse_args(argv)
    try:
        allowed, message, cert_sha, apk_sha = audit_apk(
            args.apk, args.purpose, os.environ.get("MWD_RELEASE_CERT_SHA256")
        )
    except (SigningError, OSError, subprocess.TimeoutExpired) as exc:
        print(f"BLOQUEADO: {exc}", file=sys.stderr)
        return 1
    print(f"APK SHA-256: {apk_sha}")
    print(f"Certificado SHA-256: {cert_sha}")
    print(message)
    return 0 if allowed else 1


if __name__ == "__main__":
    sys.exit(main())
