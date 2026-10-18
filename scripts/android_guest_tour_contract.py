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
CRYPTO_ENTRY = ("conocer coin y digital", "explore coin and digital")
CRYPTO_TITLE = ("explorar coin y digital sin cuenta", "explore coin and digital without an account")
CRYPTO_WARNING = ("investigación solamente", "research only")
CRYPTO_BACK = ("volver al recorrido de moneda mundial", "back to the moneda mundial tour")
CRYPTO_NOT_ISSUED = ("no emitida", "not issued")
COIN_TRADE_ENTRY = ("simular compra y venta de coin", "explore hypothetical coin buying and selling")
COIN_TRADE_TITLE = ("simular compra o venta de coin", "explore hypothetical coin buying and selling")
COIN_TRADE_WARNING = ("no existen coin emitidas", "no coin tokens")
COIN_TRADE_BUY = ("comprar (simulación)", "buy (simulation)")
COIN_TRADE_SELL = ("vender (simulación)", "sell (simulation)")
COIN_TRADE_GROSS = ("valor bruto hipotético", "hypothetical gross value")
COIN_TRADE_BUY_TOTAL = ("costo total hipotético", "hypothetical buyer cost")
COIN_TRADE_SELL_NET = ("resultado hipotético del vendedor", "hypothetical seller proceeds")
COIN_TRADE_BLOCK = ("no se puede comprar, vender", "you cannot buy, sell")
COIN_TRADE_BACK = ("volver a coin y digital", "back to coin and digital")
READINESS_ENTRY = ("ver requisitos pendientes",)
READINESS_TITLE = ("preparación pública del proyecto",)
READINESS_WARNING = ("solo investigación", "sin fondos reales")
READINESS_ROUTE = ("estados unidos", "honduras")
READINESS_ZERO = ("países operativos: 0", "contratos financieros confirmados: 0")
READINESS_BACK = ("volver al recorrido de moneda mundial",)

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


def clickable_coordinates(xml_path, phrases, name):
    for n in nodes(xml_path):
        if n.get("clickable") != "true":
            continue
        if not any(term in strings(n) for term in phrases):
            continue
        match = BOUNDS.fullmatch(n.get("bounds", ""))
        if not match:
            continue
        x1,y1,x2,y2 = map(int, match.groups())
        if x2 > x1 and y2 > y1 and x1 >= 0 and y1 >= 0:
            return (x1+x2)//2, (y1+y2)//2
    raise ValueError("No se encontró botón visible para " + name)


def crypto_entry_coordinates(xml_path):
    return clickable_coordinates(xml_path, CRYPTO_ENTRY, "explorar Coin y Digital")


def crypto_back_coordinates(xml_path):
    return clickable_coordinates(xml_path, CRYPTO_BACK, "volver del detalle Coin/Digital")


def verify_crypto_preview(*xml_paths):
    combined = [n for path in xml_paths for n in nodes(path)]
    required = [
        ("cabecera Coin/Digital", CRYPTO_TITLE),
        ("advertencia criptográfica", CRYPTO_WARNING),
        ("Coin", ("moneda mundial coin",)),
        ("Digital", ("moneda mundial digital",)),
        ("sin emisión", CRYPTO_NOT_ISSUED),
        ("regreso al recorrido", CRYPTO_BACK),
    ]
    missing = [label for label, phrases in required
               if not contains_any(combined, phrases)]
    if missing:
        raise ValueError("Detalle público cripto incompleto: " + ", ".join(missing))


def coin_trade_entry_coordinates(xml_path):
    return clickable_coordinates(xml_path, COIN_TRADE_ENTRY, "abrir simulación de Coin")


def coin_trade_sell_coordinates(xml_path):
    return clickable_coordinates(xml_path, COIN_TRADE_SELL, "simular venta de Coin")


def coin_trade_back_coordinates(xml_path):
    return clickable_coordinates(xml_path, COIN_TRADE_BACK, "volver a Coin y Digital")


def verify_coin_trade_preview(*xml_paths, side="buy"):
    if side not in ("buy", "sell"):
        raise ValueError("Dirección de compra/venta inválida")
    ns = [n for path in xml_paths for n in nodes(path)]
    required = [
        ("cabecera simulación Coin", COIN_TRADE_TITLE),
        ("sin emisión ni precios oficiales", COIN_TRADE_WARNING),
        ("opción comprar", COIN_TRADE_BUY),
        ("opción vender", COIN_TRADE_SELL),
        ("valor bruto ficticio", COIN_TRADE_GROSS),
        ("operación prohibida", COIN_TRADE_BLOCK),
        ("regreso Coin Digital", COIN_TRADE_BACK),
        ("resultado ilustrativo", COIN_TRADE_BUY_TOTAL if side == "buy" else COIN_TRADE_SELL_NET),
    ]
    missing = [label for label, phrases in required
               if not contains_any(ns, phrases)]
    if missing:
        raise ValueError("Simulación pública Coin incompleta: " + ", ".join(missing))


def readiness_entry_coordinates(xml_path):
    return clickable_coordinates(xml_path, READINESS_ENTRY, "ver preparación financiera")


def readiness_back_coordinates(xml_path):
    return clickable_coordinates(xml_path, READINESS_BACK, "volver de requisitos")


def verify_readiness_preview(*xml_paths):
    ns = [n for path in xml_paths for n in nodes(path)]
    for label, phrases in [
        ("cabecera de preparación", READINESS_TITLE),
        ("advertencia de investigación", READINESS_WARNING),
        ("ruta de estudio", READINESS_ROUTE),
        ("operatividad nula", READINESS_ZERO),
        ("regreso al recorrido", READINESS_BACK),
    ]:
        if not contains_any(ns, phrases):
            raise ValueError("Falta información pública obligatoria: " + label)


def verify_return(xml_path):
    ns = nodes(xml_path)
    if not contains_any(ns, ("moneda mundial",)):
        raise ValueError("No se volvió a la pantalla MONEDA MUNDIAL")
    if not contains_any(ns, LOGIN):
        raise ValueError("No se ve el inicio de sesión tras volver")
    if not contains_any(ns, TOUR_ENTRY):
        raise ValueError("No se ve la opción pública DEMO tras volver")


def main(argv):
    if len(argv)<3 or argv[1] not in (
        "locate", "tour", "return", "return-button",
        "crypto-entry", "crypto", "crypto-back",
        "coin-trade-entry", "coin-trade-buy", "coin-trade-sell", "coin-trade-sell-entry", "coin-trade-back",
        "readiness-entry", "readiness", "readiness-back"):

        raise ValueError("Uso: helper.py locate|tour|return|return-button|crypto-entry|crypto|crypto-back|readiness-entry|readiness|readiness-back ui.xml [bottom.xml]")
    action, path = argv[1:3]
    if action == "tour":
        if len(argv)<4:
            raise ValueError("Verificación tour requiere capturas superior e inferior")
        verify_tour(*argv[2:])
        print("OK: recorrido de demostración visible en pantallas superior e inferior")
    elif action == "crypto":
        if len(argv)<4:
            raise ValueError("Verificación cripto requiere capturas superior e inferior")
        verify_crypto_preview(*argv[2:])
        print("OK: Coin y Digital visibles sólo como investigación pública")
    elif action in ("coin-trade-buy", "coin-trade-sell"):
        if len(argv)<4:
            raise ValueError("Simulador Coin requiere capturas superior e inferior")
        verify_coin_trade_preview(*argv[2:], side="buy" if action == "coin-trade-buy" else "sell")
        print("OK: compra/venta pública de Coin solo como escenario hipotético")
    elif action == "readiness":
        if len(argv)<4:
            raise ValueError("Verificación de preparación requiere capturas superior e inferior")
        verify_readiness_preview(*argv[2:])
        print("OK: vista pública de preparación y controles legales visibles")
    elif len(argv)!=3:
        raise ValueError("Acción requiere un solo XML")
    elif action == "crypto-entry":
        x, y = crypto_entry_coordinates(path)
        print(f"{x} {y}")
    elif action == "crypto-back":
        x, y = crypto_back_coordinates(path)
        print(f"{x} {y}")
    elif action == "coin-trade-entry":
        x, y = coin_trade_entry_coordinates(path)
        print(f"{x} {y}")
    elif action == "coin-trade-sell-entry":
        x, y = coin_trade_sell_coordinates(path)
        print(f"{x} {y}")
    elif action == "coin-trade-back":
        x, y = coin_trade_back_coordinates(path)
        print(f"{x} {y}")
    elif action == "readiness-entry":
        x, y = readiness_entry_coordinates(path)
        print(f"{x} {y}")
    elif action == "readiness-back":
        x, y = readiness_back_coordinates(path)
        print(f"{x} {y}")
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
