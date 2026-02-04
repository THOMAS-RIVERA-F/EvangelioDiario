import json
import os
from datetime import date, timedelta

from gtts import gTTS

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
HINRY_PATH = os.path.join(BASE_DIR, "data", "hinry_master_2026.json")
LECTURAS_PATH = os.path.join(BASE_DIR, "data", "lecturas_2026.json")
OUT_DIR = os.path.join(BASE_DIR, "audio_preview")
PLACEHOLDER = "hinry debe pensarlo"


def format_iso(d: date) -> str:
    return d.strftime("%Y-%m-%d")


def build_hinry_text(day: dict) -> str:
    hinry = day.get("hinry", {})
    if isinstance(hinry, dict) and hinry.get("text"):
        text = hinry.get("text")
        return "" if text == PLACEHOLDER else text
    parts = []
    for key in ("contexto", "explicacion"):
        value = hinry.get(key) or []
        if isinstance(value, list):
            parts.append(" ".join(value))
    if hinry.get("mensaje_central"):
        parts.append(hinry.get("mensaje_central"))
    agradecimiento = hinry.get("agradecimiento") or []
    if isinstance(agradecimiento, list) and agradecimiento:
        parts.append("Gracias por: " + ", ".join(agradecimiento) + ".")
    if hinry.get("cierre"):
        parts.append(hinry.get("cierre"))
    return "\n\n".join([p for p in parts if p])


def build_lecturas_text(day: dict) -> str:
    sets = day.get("reading_sets") or []
    parts = []
    for s in sets:
        for r in s.get("readings", []):
            rtype = r.get("type", "")
            ref = r.get("reference", "")
            verses = r.get("verses") or []
            vtext = " ".join(
                [
                    (f"{v.get('number')} " if v.get("number") else "") + v.get("text", "")
                    for v in verses
                ]
            )
            parts.append(f"{rtype} {ref}. {vtext}")
    return "\n\n".join([p for p in parts if p])


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)

    with open(HINRY_PATH, "r", encoding="utf-8") as f:
        hinry_data = json.load(f)
    with open(LECTURAS_PATH, "r", encoding="utf-8") as f:
        lecturas_data = json.load(f)

    h_days = {d["date"]: d for d in hinry_data.get("days", []) if "date" in d}
    l_days = {d["date"]: d for d in lecturas_data.get("days", []) if "date" in d}

    local_today = date.today()
    local_yesterday = local_today - timedelta(days=1)

    for label, d in [("hoy", local_today), ("ayer", local_yesterday)]:
        key = format_iso(d)
        day = h_days.get(key)
        if not day:
            print(f"No hinry data for {key}")
            continue
        text = build_hinry_text(day)
        if not text:
            print(f"Empty hinry text for {key}")
            continue
        out_path = os.path.join(OUT_DIR, f"hinry_{label}_{key}.mp3")
        gTTS(text=text, lang="es").save(out_path)
        print("saved", out_path)

    lt_key = format_iso(local_today)
    lt_day = l_days.get(lt_key)
    if lt_day:
        ltext = build_lecturas_text(lt_day)
        if ltext:
            out_path = os.path.join(OUT_DIR, f"lecturas_hoy_{lt_key}.mp3")
            gTTS(text=ltext, lang="es").save(out_path)
            print("saved", out_path)
        else:
            print("lecturas text empty")
    else:
        print(f"No lecturas for {lt_key}")

    for name in sorted(os.listdir(OUT_DIR)):
        path = os.path.join(OUT_DIR, name)
        size = os.path.getsize(path)
        print(f"{name}: {size/1024:.1f} KB")


if __name__ == "__main__":
    main()
