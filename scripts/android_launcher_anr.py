#!/usr/bin/env python3
"""Inspect visible Android UI; only classify a Pixel Launcher ANR for recovery."""
import re
import sys
import xml.etree.ElementTree as ET

BOUNDS = re.compile(r"^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$")


def inspect_ui(xml_text):
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return "unknown", None
    nodes = [n.attrib for n in root.iter("node")]
    titles = [(n.get("text") or "").strip() for n in nodes
              if n.get("resource-id") == "android:id/alertTitle"]
    anr_titles = [t for t in titles if re.search(r"isn.t responding|is not responding|no responde|no está respondiendo", t, re.I)]
    if not anr_titles:
        return "none", None
    if len(anr_titles) != 1 or not re.match(r"^Pixel Launcher (?:isn.t responding|is not responding|no responde|no está respondiendo)$", anr_titles[0], re.I):
        return "other_anr", None
    close_nodes = [n for n in nodes if n.get("resource-id") == "android:id/aerr_close"
                   and n.get("clickable") == "true" and n.get("package") == "android"]
    if len(close_nodes) != 1:
        return "unknown", None
    match = BOUNDS.fullmatch(close_nodes[0].get("bounds", ""))
    if not match:
        return "unknown", None
    x1, y1, x2, y2 = map(int, match.groups())
    if not (0 <= x1 < x2 <= 10000 and 0 <= y1 < y2 <= 10000):
        return "unknown", None
    return "launcher_anr", ((x1 + x2) // 2, (y1 + y2) // 2)


def main(args):
    if len(args) != 3 or args[1] not in {"classify", "close-coordinates"}:
        raise ValueError("Usage: android_launcher_anr.py classify|close-coordinates ui.xml")
    with open(args[2], encoding="utf-8") as file:
        state, coords = inspect_ui(file.read())
    if args[1] == "classify":
        print(state)
        return
    if state != "launcher_anr" or coords is None:
        raise ValueError("Cannot close an ANR other than Pixel Launcher")
    print(*coords)


if __name__ == "__main__":
    try:
        main(sys.argv)
    except (OSError, ValueError) as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
