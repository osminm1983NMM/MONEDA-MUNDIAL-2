#!/usr/bin/env python3
"""Verifica procedencia mostrada por Android sin iniciar sesión ni usar OCR.

Exige botón de diagnóstico accesible y etiqueta explícita SIN DINERO REAL.
Los IDs proceden del workflow que compiló esa MISMA APK.
"""
import re
import sys
import xml.etree.ElementTree as ET

PACKAGE = "com.monedamundial.demo"
BOUNDS = re.compile(r"^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$")
SHA = re.compile(r"^[a-f0-9]{40}$")
RUN = re.compile(r"^[1-9][0-9]{0,19}$")
BUTTONS = ("View build info (DEMO)", "Ver información de versión (DEMO)")


def diag_button_coordinates(xml_text):
    nodes = ET.fromstring(xml_text).iter("node")
    matches = []
    for element in nodes:
        n = element.attrib
        if n.get("package") != PACKAGE or n.get("class") != "android.widget.Button"                 or n.get("content-desc") not in BUTTONS or n.get("clickable") != "true"                 or n.get("enabled") != "true":
            continue
        m = BOUNDS.fullmatch(n.get("bounds", ""))
        if not m:
            continue
        x1, y1, x2, y2 = map(int, m.groups())
        if 0 <= x1 < x2 <= 5000 and 0 <= y1 < y2 <= 6000:
            matches.append(((x1 + x2) // 2, (y1 + y2) // 2))
    return matches[0] if len(matches) == 1 else None


def diagnostic_matches(xml_text, expected_sha, expected_run):
    if not (SHA.fullmatch(expected_sha) and RUN.fullmatch(expected_run)):
        return False
    texts = {
        (node.attrib.get("text") or "").strip()
        for node in ET.fromstring(xml_text).iter("node")
        if node.attrib.get("package") == PACKAGE
    }
    heading = "App diagnostics (DEMO)" in texts or "Diagnóstico de aplicación (DEMO)" in texts
    safety = "DEMO ONLY — NO REAL MONEY" in texts or "SOLO DEMOSTRACIÓN — SIN DINERO REAL" in texts
    version = any(text.startswith(("Version: 2.0.0", "Versión: 2.0.0")) for text in texts)
    return (heading and safety and version and
            f"Git commit: {expected_sha}" in texts and
            f"GitHub Actions: {expected_run}" in texts)


def main(args):
    if len(args) < 3:
        raise ValueError("Usage: android_demo_build_ui.py coords ui.xml | verify ui.xml sha run")
    mode = args[1]
    if mode == "coords" and len(args) == 3:
        with open(args[2], encoding="utf-8") as fp:
            result = diag_button_coordinates(fp.read())
        if result is None:
            raise ValueError("No hay exactamente un botón de diagnóstico visible")
        print(*result)
    elif mode == "verify" and len(args) == 5:
        with open(args[2], encoding="utf-8") as fp:
            if not diagnostic_matches(fp.read(), args[3], args[4]):
                raise ValueError("La versión visible no coincide con el commit/run de esta APK o falta aviso DEMO")
        print("PASS: versión, commit, run y aviso de fondos ficticios visibles")
    else:
        raise ValueError("Argumentos incorrectos")


if __name__ == "__main__":
    try:
        main(sys.argv)
    except (ValueError, ET.ParseError, OSError) as err:
        print("ERROR:", err, file=sys.stderr)
        sys.exit(1)
