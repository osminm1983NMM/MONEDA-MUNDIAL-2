#!/usr/bin/env python3
"""Comprueba idioma de la pantalla Android usando XML de accesibilidad (sin OCR).

Nunca toca login, cuentas, PIN, saldos ni rutas de dinero real. Solo encuentra
los botones de idioma visibles cuyo content-desc coincide exactamente.
"""
import re
import sys
import xml.etree.ElementTree as ET

PACKAGE = "com.monedamundial.demo"
BOUNDS = re.compile(r"^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$")
LABELS = {"es": "Español", "en": "English"}
REQUIRED = {
    "es": ("SOLO DEMOSTRACIÓN • SIN DINERO REAL",
           "Accede a Moneda Mundial"),
    "en": ("DEMO ONLY • NO REAL MONEY",
           "Welcome to Moneda Mundial"),
}


def nodes_from_xml(xml_text):
    root = ET.fromstring(xml_text)
    return [node.attrib for node in root.iter("node")]


def _on_screen_bounds(node):
    match = BOUNDS.fullmatch(node.get("bounds", ""))
    if not match:
        return None
    x1, y1, x2, y2 = map(int, match.groups())
    if not (0 <= x1 < x2 <= 5000 and 0 <= y1 < y2 <= 6000):
        return None
    return (x1 + x2) // 2, (y1 + y2) // 2


def button_coordinates(xml_text, language):
    if language not in LABELS:
        return None
    options = []
    for node in nodes_from_xml(xml_text):
        if (node.get("package") == PACKAGE
                and node.get("class") == "android.widget.Button"
                and node.get("content-desc") == LABELS[language]
                and node.get("clickable") == "true"
                and node.get("enabled") == "true"):
            center = _on_screen_bounds(node)
            if center is not None:
                options.append(center)
    return options[0] if len(options) == 1 else None


def visible_language(xml_text, language):
    if language not in REQUIRED:
        return False
    nodes = [n for n in nodes_from_xml(xml_text)
             if n.get("package") == PACKAGE]
    texts = set()
    for node in nodes:
        for attr in ("text", "content-desc"):
            value = (node.get(attr) or "").strip()
            if value:
                texts.add(value)
    # Controles presentes en una misma pantalla. No se permiten mensajes
    # cruzados entre idiomas ni el simple icono de la app como evidencia.
    logo = any("MONEDA MUNDIAL" in value for value in texts)
    warning, login = REQUIRED[language]
    return logo and warning in texts and login in texts


def main(args):
    if len(args) != 4 or args[1] not in {"coords", "verify"}:
        raise ValueError("Uso: android_demo_locale_ui.py coords|verify es|en ui.xml")
    command, language, path = args[1:]
    if language not in LABELS:
        raise ValueError("Idioma no permitido")
    with open(path, encoding="utf-8") as file:
        xml = file.read()
    if command == "coords":
        value = button_coordinates(xml, language)
        if value is None:
            raise ValueError("Botón de idioma no único, inválido o no visible")
        print(*value)
    elif not visible_language(xml, language):
        raise ValueError("No coinciden título, aviso SIN DINERO REAL y acceso")
    else:
        print("PASS: interfaz inicial", language)


if __name__ == "__main__":
    try:
        main(sys.argv)
    except (OSError, ValueError, ET.ParseError) as error:
        print("ERROR:", error, file=sys.stderr)
        sys.exit(1)
