#!/usr/bin/env python3
"""Identifica ANR de launcher del emulador sin confundirlo con un ANR de la app.

Solo usa archivos locales de CI, no dispositivos de usuarios ni datos privados.
Fallar cerrado cuando UI/dumpsys se contradicen. El historial de LAST ANR
NO significa que el diálogo siga abierto.
"""
import re
import sys
import xml.etree.ElementTree as ET

APP="com.monedamundial.app"
LAUNCHER="com.google.android.apps.nexuslauncher"
CURRENT=re.compile(r"^\s*mCurrentFocus=Window\{[^\n]*?Application Not Responding: ([A-Za-z0-9._]+)\}",re.M)
BOUNDS=re.compile(r"^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$")


def classify(xml_text,window_text):
    focus=CURRENT.findall(window_text)
    # Hay algunas secciones duplicadas en dumpsys: no permitir dos diagnósticos.
    if len(set(focus))>1:
        return "other_anr"
    try:
        root=ET.fromstring(xml_text)
    except ET.ParseError:
        return "other_anr"
    nodes=[n.attrib for n in root.iter("node")]
    close=[n for n in nodes if n.get("resource-id")=="android:id/aerr_close"]
    titles=[(n.get("text") or "").lower() for n in nodes if n.get("resource-id")=="android:id/alertTitle"]
    has_dialog=bool(close) and any("respond" in title or "responde" in title for title in titles)
    if focus:
        package=focus[-1]
        if package==LAUNCHER and has_dialog and any("launcher" in title for title in titles):
            return "launcher_anr"
        if package==APP:
            return "app_anr"
        return "other_anr"
    # No inferir el estado activo de WINDOW MANAGER LAST ANR histórico.
    if has_dialog or any("respond" in title or "responde" in title for title in titles):
        return "other_anr"
    return "none"


def launcher_close_coordinates(xml_text,window_text):
    if classify(xml_text,window_text)!="launcher_anr":
        raise ValueError("No se autorizó cerrar un ANR de otra aplicación")
    root=ET.fromstring(xml_text)
    for node in root.iter("node"):
        if node.get("resource-id")!="android:id/aerr_close" or node.get("clickable")!="true":
            continue
        bounds=BOUNDS.fullmatch(node.get("bounds",""))
        if not bounds:
            continue
        x1,y1,x2,y2=map(int,bounds.groups())
        if x1>=0 and y1>=0 and x2>x1 and y2>y1:
            return ((x1+x2)//2,(y1+y2)//2)
    raise ValueError("El botón del launcher no está accesible de forma segura")


def main(argv):
    if len(argv)!=4 or argv[1] not in ("classify","launcher-close-coordinates"):
        raise ValueError("Uso: android_anr_triage.py classify|launcher-close-coordinates ui.xml window.txt")
    with open(argv[2],encoding="utf-8") as f:
        xml=f.read()
    with open(argv[3],encoding="utf-8") as f:
        window=f.read()
    if argv[1]=="classify":
        print(classify(xml,window))
    else:
        x,y=launcher_close_coordinates(xml,window)
        print(f"{x} {y}")


if __name__=="__main__":
    try:
        main(sys.argv)
    except (OSError,ValueError) as error:
        print("ERROR: "+str(error),file=sys.stderr)
        sys.exit(1)
