#!/usr/bin/env python3
"""Verifica solo vistas Android ficticias del Historial, sin autenticar usuarios."""
import re
import sys
import xml.etree.ElementTree as ET

BOUNDS = re.compile(r"^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$")
BUTTONS = {
    "history-entry": ("vista previa del historial", "history preview"),
    "incoming-entry": ("entradas", "incoming"),
    "merchant-entry": ("comercios", "merchants"),
    "receipt-entry": ("ver comprobante", "view receipt"),
    "history-back": ("volver al recorrido de moneda mundial", "back to moneda mundial tour"),
}


def read_nodes(path):
    return [node.attrib for node in ET.parse(path).iter("node")]


def label(node):
    return ((node.get("text") or "") + " " + (node.get("content-desc") or "")).lower()


def any_phrase(nodes, phrases):
    return any(any(phrase in label(node) for phrase in phrases) for node in nodes)


def locate(nodes, phrases):
    for node in nodes:
        if node.get("clickable") != "true" or not any(p in label(node) for p in phrases):
            continue
        match = BOUNDS.fullmatch(node.get("bounds", ""))
        if match is None:
            continue
        x1, y1, x2, y2 = (int(x) for x in match.groups())
        if x2 <= x1 or y2 <= y1:
            continue
        return (x1+x2)//2, (y1+y2)//2
    raise ValueError("El botón solicitado no está visible y accesible")


def verify(mode, nodes):
    common = [
        ("datos inventados", ("datos inventados", "invented data")),
        ("cabecera", ("tu actividad", "your activity")),
        ("moneda ficticia", ("mwd",)),
        ("advertencia", ("solo demostración", "demo only")),
    ]
    checks = {
        "overview": common + [
            ("filtro entradas", ("entradas", "incoming")),
            ("filtro salidas", ("salidas", "outgoing")),
            ("filtro comercios", ("comercios", "merchants")),
            ("suma de entradas inventadas", ("+126.90",)),
            ("suma de salidas inventadas", ("−57.00", "-57.00")),
        ],
        "incoming": [
            ("dos entradas", ("2 movimientos visibles", "2 visible transactions")),
            ("entrada principal", ("+120.50",)),
            ("entrada de comercio", ("+6.40",)),
        ],
        "merchant": [
            ("dos movimientos de comercio", ("2 movimientos visibles", "2 visible transactions")),
            ("salida de comercio", ("-12.75", "−12.75")),
            ("entrada de comercio", ("+6.40",)),
        ],
        "receipt": [
            ("comprobante ficticio", ("comprobante ficticio", "fictional receipt")),
            ("no dinero real", ("sin dinero real", "no real money")),
            ("referencia", ("referencia:", "reference:")),
        ],
    }[mode]
    missing = [name for name, phrases in checks if not any_phrase(nodes, phrases)]
    if mode == "receipt" and any_phrase(nodes, ("compartir comprobante ficticio", "share demo receipt")):
        missing.append("el invitado no debe compartir recibos")
    if missing:
        raise ValueError("Pantalla Historial incompleta: " + ", ".join(missing))


def main(argv):
    if len(argv) < 3:
        raise ValueError("Uso: script.py ACCION xml [xml...] ")
    action = argv[1]
    if action in BUTTONS:
        if len(argv) != 3:
            raise ValueError("Localizar requiere un XML de la pantalla actual")
        print(*locate(read_nodes(argv[2]), BUTTONS[action]))
    elif action in ("overview", "incoming", "merchant", "receipt"):
        if len(argv) < 4:
            raise ValueError("Verificar requiere XML actuales superior e inferior")
        ns = [node for path in argv[2:] for node in read_nodes(path)]
        verify(action, ns)
        print("OK: " + action + " verificado con datos ficticios en Android")
    else:
        raise ValueError("Acción de historial desconocida")


if __name__ == "__main__":
    try:
        main(sys.argv)
    except (ValueError, ET.ParseError, OSError) as exc:
        print("ERROR: " + str(exc), file=sys.stderr)
        sys.exit(1)
