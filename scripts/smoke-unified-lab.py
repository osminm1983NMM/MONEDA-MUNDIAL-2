#!/usr/bin/env python3
"""Offline UI smoke test; use only a disposable Android emulator, never a phone."""
import argparse
import hashlib
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

PACKAGE = "com.monedamundial.unifiedlab"
DEMO = "DEMO · Créditos ficticios MWD"
FINANCIAL = "LAB financiero · Consultas de solo lectura"
WARNING = "MONEDA MUNDIAL · LAB UNIFICADO · SIN DINERO REAL"

def run(serial, *args, timeout=45):
    return subprocess.check_output(["adb", "-s", serial, *args], timeout=timeout, text=True).strip()

def ui(serial):
    run(serial, "shell", "uiautomator", "dump", "/sdcard/mwd-unified-smoke.xml")
    root = ET.fromstring(run(serial, "shell", "cat", "/sdcard/mwd-unified-smoke.xml"))
    return [n for n in root.iter("node") if n.get("package") == PACKAGE]

def has(nodes, text):
    return any(text in (n.get("text", "") + " " + n.get("content-desc", "")) for n in nodes)

def wait_ui(serial, required, forbidden=(), seconds=100):
    until = time.monotonic() + seconds
    while time.monotonic() < until:
        try:
            nodes = ui(serial)
            if all(has(nodes, s) for s in required) and not any(has(nodes, s) for s in forbidden):
                return nodes
        except (ET.ParseError, subprocess.SubprocessError):
            pass
        time.sleep(2)
    raise RuntimeError("UI did not reach expected isolated state: " + ", ".join(required))

def tap(serial, nodes, text):
    for n in nodes:
        if text in (n.get("text", ""), n.get("content-desc", "")):
            m = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", n.get("bounds", ""))
            if m:
                x1, y1, x2, y2 = map(int, m.groups())
                if x2 > x1 and y2 > y1:
                    run(serial, "shell", "input", "tap", str((x1+x2)//2), str((y1+y2)//2))
                    return
    raise RuntimeError("Mode button not found")

def start(serial):
    run(serial, "shell", "am", "force-stop", PACKAGE)
    run(serial, "shell", "am", "start", "-W", "-n", PACKAGE + "/.MainActivity")
    return wait_ui(serial, [WARNING, DEMO, FINANCIAL])

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--serial", required=True)
    p.add_argument("--artifact", type=Path, required=True)
    p.add_argument("--revision", required=True)
    args = p.parse_args()
    if not re.fullmatch(r"emulator-\d+", args.serial) or not re.fullmatch(r"[a-f0-9]{40}", args.revision):
        raise SystemExit("Disposable emulator and exact build revision required")
    serial = args.serial
    apk = args.artifact / "MonedaMundial-LAB-Unificado.apk"
    if (args.artifact / "revision.txt").read_text().strip() != args.revision:
        raise RuntimeError("Revision mismatch")
    expected = (args.artifact / "SHA256SUMS").read_text().strip().split()
    if len(expected) != 2 or expected[1] != apk.name or not re.fullmatch(r"[a-f0-9]{64}", expected[0]):
        raise RuntimeError("Invalid checksum manifest")
    with apk.open("rb") as stream:
        if hashlib.file_digest(stream, "sha256").hexdigest() != expected[0]:
            raise RuntimeError("APK digest mismatch")
    if run(serial, "shell", "getprop", "ro.kernel.qemu") != "1":
        raise RuntimeError("Refusing non-emulator target")
    if run(serial, "shell", "getprop", "sys.boot_completed") != "1":
        raise RuntimeError("Emulator not booted")
    if PACKAGE in run(serial, "shell", "pm", "list", "packages", PACKAGE).split("package:"):
        raise RuntimeError("Use a fresh emulator without prior LAB data")
    run(serial, "shell", "input", "keyevent", "82")
    run(serial, "shell", "wm", "size", "1080x2400")
    run(serial, "shell", "wm", "density", "360")
    run(serial, "install", str(apk), timeout=180)
    try:
        nodes = start(serial)
        tap(serial, nodes, DEMO)
        wait_ui(serial, [WARNING, "SOLO DEMOSTRACIÓN", "Iniciar sesión"], [DEMO, FINANCIAL])
        nodes = start(serial)
        tap(serial, nodes, FINANCIAL)
        wait_ui(serial, [WARNING, "Moneda Mundial | LAB Financiero", "Correo de la cuenta de laboratorio"], [DEMO, FINANCIAL, "SOLO DEMOSTRACIÓN"])
        start(serial)
        print("PASS: both mode entry screens and selector reset after force-stop")
    finally:
        run(serial, "shell", "am", "force-stop", PACKAGE)

if __name__ == "__main__":
    main()
