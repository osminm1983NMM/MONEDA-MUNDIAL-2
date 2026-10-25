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
SIGNER_FIELD = re.compile(
    r"^(?P<label>Signer #\d+|V\d+(?:\.\d+)? Signer(?::| #\d+:))"
    r"\s+certificate (?P<field>DN|SHA-256 digest):\s*(?P<value>.+)$"
)
SIGNER_COUNT = re.compile(r"^Number of signers:\s*(\d+)$")


class SigningError(Exception):
    pass


def normalize_fingerprint(raw):
    value = (raw or "").strip().replace(":", "").lower()
    if not FINGERPRINT.fullmatch(value):
        raise SigningError("La huella SHA-256 permitida no tiene 64 dígitos hexadecimales.")
    return value


def parse_certificate_report(output):
    """Read old numbered and newer V2/V3 apksigner labels, failing closed.

    Multiple signature *schemes* can report the same certificate. Multiple
    distinct certificates or incomplete certificate records are rejected.
    Signature verification itself is enforced by apksigner's exit code upstream.
    """
    signers = {}
    reported_counts = []
    for raw_line in output.splitlines():
        line = raw_line.strip()
        count = SIGNER_COUNT.fullmatch(line)
        if count:
            reported_counts.append(int(count.group(1)))
        match = SIGNER_FIELD.fullmatch(line)
        if not match:
            continue
        label, field, value = match.group("label", "field", "value")
        value = normalize_fingerprint(value) if field == "SHA-256 digest" else value.strip()
        fields = signers.setdefault(label, {})
        if field in fields and fields[field] != value:
            raise SigningError("Certificados contradictorios para el mismo firmante.")
        fields[field] = value

    if reported_counts and (len(set(reported_counts)) != 1 or reported_counts[0] != 1):
        raise SigningError("La APK no reporta exactamente un firmante.")
    if not signers or any(set(fields) != {"DN", "SHA-256 digest"} for fields in signers.values()):
        raise SigningError("Se requiere un certificado completo e identificable.")
    signer_numbers_by_scheme = {}
    for label in signers:
        if label.startswith("Signer #"):
            scheme, signer_number = "legacy", int(label.split("#", 1)[1])
        else:
            scheme = label.split(" Signer", 1)[0]
            signer_number = int(label.rsplit("#", 1)[1].rstrip(":")) if "#" in label else 1
        signer_numbers_by_scheme.setdefault(scheme, set()).add(signer_number)
    if any(len(numbers) != 1 for numbers in signer_numbers_by_scheme.values()):
        raise SigningError("Una firma presenta múltiples firmantes.")
    fingerprints = {fields["SHA-256 digest"] for fields in signers.values()}
    names = {fields["DN"] for fields in signers.values()}
    if len(fingerprints) != 1 or len(names) != 1:
        raise SigningError("Se detectaron firmantes o certificados inconsistentes.")
    return fingerprints.pop(), names.pop()


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
