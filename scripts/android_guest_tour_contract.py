#!/usr/bin/env python3
"""Read-only checker for Android's accessibility XML in Moneda Mundial DEMO.

Does not accept credentials, call a financial API or move any funds.
"""
import re
import sys
import xml.etree.ElementTree as ET

BOUNDS = re.compile(r"^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$")
TOUR_ENTRY = ("explore without an account", "conocer la aplicación sin cuenta",
              "conocer sin cuenta")
TOUR_TITLE = ("explore moneda mundial", "conoce moneda mundial")
TOUR_WARNING = ("demo only", "demostración")
TOUR_BACK = ("back to sign in", "volver a iniciar sesión")
TRANSFER = ("international transfers", "transferencias internacionales")
COIN = ("digital and coin", "digital y coin")
LOGIN = ("sign in to moneda mundial", "accede a moneda mundial",
         "iniciar sesión", "create demo account", "crear cuenta de prueba")


def nodes(xml_path):
    tree = ET.parse(xml_path)
    return [n.attrib for n in tree.iter("node")]


def strings(node):
    return ((node.get("text") or "") + " " + (node.get("content-desc") or "")).lower()


def contains_any(nodes_list, phrases):
    return any(any(p in strings(n) for p in phrases) for n in nodes_list)


def entry_coordinates(xml_path):
    for node in nodes(xml_path):
        if not any(term in strings(node) for term in TOUR_ENTRY):
            continue
        # Prefer accessible, clickable button rather than its TextView child.
        if node.get("clickable") != "true":
            continue
        match = BOUNDS.fullmatch(node.get("bounds", ""))
        if not match:
            continue
        x1, y1, x2, y2 = map(int, match.groups())
        if x2 <= x1 or y2 <= y1 or x1 < 0 or y1 < 0:
            continue
        return (x1 + x2) // 2, (y1 + y2) // 2
    raise ValueError("No se encontró botón DEMO accesible y pulsable")


def verify_tour(*xml_paths):
    # ScrollView can expose only visible children in each UI snapshot.
    # Validate the tour across both top and bottom screenshots, not just one.
    ns = [node for path in xml_paths for node in nodes(path)]
    missing = []
    for name, phrases in [
        ("cabecera", TOUR_TITLE),
        ("advertencia dinero real", TOUR_WARNING),
        ("transferencias", TRANSFER),
        ("Coin/Digital", COIN),
        ("regreso", TOUR_BACK),
    ]:
        if not contains_any(ns, phrases):
            missing.append(name)
    if missing:
        raise ValueError("Recorrido sin contenidos o controles: " + ", ".join(missing))


def return_button_coordinates(xml_path):
    for n in nodes(xml_path):
        if n.get("clickable") != "true":
            continue
        if not any(term in strings(n) for term in TOUR_BACK):
            continue
        match = BOUNDS.fullmatch(n.get("bounds", ""))
        if not match:
            continue
        x1,y1,x2,y2 = map(int, match.groups())
        if x2>x1 and y2>y1 and x1>=0 and y1>=0:
            return (x1+x2)//2,(y1+y2)//2
    raise ValueError("No se encontró botón visible para volver al inicio")


def verify_return(xml_path):
    ns = nodes(xml_path)
    if not contains_any(ns, ("moneda mundial",)):
        raise ValueError("No se volvió a la pantalla MONEDA MUNDIAL")
    if not contains_any(ns, LOGIN):
        raise ValueError("No se ve el inicio de sesión tras volver")
    if not contains_any(ns, TOUR_ENTRY):
        raise ValueError("No se ve la opción pública DEMO tras volver")


def main(argv):
    if len(argv)<3 or argv[1] not in ("locate", "tour", "return", "return-button"):
        raise ValueError("Uso: helper.py locate|tour|return|return-button ui.xml [bottom.xml]")
    action, path = argv[1:3]
    if action == "tour":
        if len(argv)<4:
            raise ValueError("Verificación tour requiere capturas superior e inferior")
        verify_tour(*argv[2:])
        print("OK: recorrido de demostración visible en pantallas superior e inferior")
    elif len(argv)!=3:
        raise ValueError("Acción requiere un solo XML")
    elif action == "locate":
        x, y = entry_coordinates(path)
        print(f"{x} {y}")
    elif action == "return-button":
        x, y = return_button_coordinates(path)
        print(f"{x} {y}")
    else:
        verify_return(path)
        print("OK: volvió al inicio sin autenticación")


if __name__ == "__main__":
    try:
        main(sys.argv)
    except (ValueError, ET.ParseError, OSError) as e:
        print("ERROR: " + str(e), file=sys.stderr)
        sys.exit(1)
