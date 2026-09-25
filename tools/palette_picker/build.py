#!/usr/bin/env python3
"""Download five Commons photos per chosen palette name, and sample a five-slot palette."""

import json
import re
import shutil
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "dev" / "palette-candidates"
IMG = OUT / "img"
GALLERY = ROOT / "custom_components" / "circadian_scenes" / "frontend" / "gallery"
UA = "CircadianScenesPalettePreview/1.0 (https://github.com/etokheim/circadian_scenes; local review)"
TARGET = 5
JUNK = ("modis", "landsat", "locator map", "satellite")

SCENES = [
    ("daylight", "Reading lamp", "reading lamp on a desk by a window"),
    ("daylight", "Spring glass", "cherry blossom"),
    ("daylight", "Orchard morning", "foggy apple orchard"),
    ("daylight", "Crisp October", "autumn maple foliage daylight"),
    ("daylight", "The red tree", "red maple tree autumn landscape"),
    ("daylight", "Late apples", "apple orchard autumn"),
    ("daylight", "Rolling gold", "wheat field golden hour"),
    ("daylight", "Hazy meadow", "misty meadow morning"),
    ("daylight", "Milk sky", "overcast white sky open landscape"),
    ("daylight", "White kitchen", "bright white kitchen interior daylight"),
    ("daylight", "Linen noon", "sunlight through white curtains"),
    ("daylight", "High sails", "white sailboat blue sea"),
    ("daylight", "Greenhouse", "greenhouse interior plants glass"),
    ("daylight", "Snow noon", "snow field blue sky"),
    ("daylight", "The long table", "dining table sunlight"),
    ("cozy", "Golden hour", "golden hour living room interior"),
    ("cozy", "Honey light", "warm lamp interior"),
    ("cozy", "Dinner time", "dinner table warm lighting"),
    ("cozy", "Last of the sun", "sunset living room window"),
    ("cozy", "Red hills", "red rock hills sunset"),
    ("cozy", "African dusk", "savanna sunset acacia"),
    ("cozy", "Alpenglow", "mountain alpenglow"),
    ("cozy", "Palms at sunset", "palm trees sunset"),
    ("cozy", "Wood lamp", "table lamp cozy living room"),
    ("cozy", "Low flame", "candle flame dark"),
    ("cozy", "The second candle", "two candles dinner dark"),
    ("cozy", "Amber room", "amber warm interior lamp"),
    ("cozy", "Brass lamp", "brass lamp wooden table"),
    ("cozy", "After supper", "dining room after dinner warm light"),
    ("cozy", "Cabin window", "cabin interior night window lamp"),
    ("cozy", "Terracotta", "terracotta courtyard"),
    ("cozy", "Bakery bulbs", "bakery lights"),
    ("cozy", "Wool and brass", "wool sofa lamp brass interior"),
    ("cozy", "The late sitting", "armchair lamp evening interior"),
    ("cozy", "Lantern walk", "lantern path night warm"),
    ("cozy", "Copper evening", "copper lamps evening interior"),
    ("evening", "Rain on the avenue", "rain window city night lights"),
    ("evening", "Shop windows", "shop window night street"),
    ("evening", "Sodium lamp", "orange sodium street light night"),
    ("evening", "Blue hour", "blue hour city rooftops"),
    ("evening", "Wet cobbles", "wet cobblestone street night"),
    ("evening", "The dinner hour", "restaurant entrance night warm"),
    ("evening", "Train window", "train window sunset"),
    ("evening", "City balconies", "apartment balconies night city"),
    ("evening", "Velvet dusk", "city at dusk"),
    ("evening", "Window weather", "rain on window evening interior"),
    ("evening", "After the rain", "wet street after rain dusk reflections"),
    ("night", "One lamp", "single lamp dark bedroom"),
    ("night", "Moon on the floor", "moonlight wooden floor"),
    ("night", "Midnight kitchen", "dark kitchen at night"),
    ("night", "The lighthouse", "lighthouse at night"),
    ("night", "Snow and a window", "snowy street night lit window"),
    ("night", "Reading in bed", "reading in bed by lamp"),
    ("night", "Deep water", "dark sea night"),
    ("night", "Navy and brass", "dark blue room brass lamp"),
    ("night", "The last window", "dark hallway distant warm light"),
    ("night", "Insomnia", "bedroom lamp night"),
    ("night", "Quiet house", "desk lamp dark room"),
    ("night", "Starlight", "starry night sky landscape"),
    ("party", "Neon alley", "neon signs alley night"),
    ("party", "Wet neon", "neon reflection wet street"),
    ("party", "Disco fruit", "disco ball"),
    ("party", "Magenta hour", "nightclub lights"),
    ("party", "Cocktail pink", "cocktail bar"),
    ("party", "Electric garden", "garden string lights"),
    ("party", "String lights", "outdoor string lights night"),
    ("party", "Spotlight", "concert stage spotlight"),
    ("party", "Juice bar", "night market fruit colorful lights"),
    ("party", "Carnival wash", "carnival lights night"),
    ("party", "Club violet", "purple nightclub interior"),
    ("party", "Confetti", "confetti party"),
    ("romantic", "Two candles", "two candles dark room"),
    ("romantic", "Rose dusk", "red roses warm light"),
    ("romantic", "Wine dark", "wine candlelight"),
    ("romantic", "Blush and gold", "pink bedroom lamp"),
    ("romantic", "Silk lamp", "sheer curtain"),
    ("romantic", "Petal light", "candlelight flowers"),
    ("romantic", "A private room", "restaurant booth"),
    ("romantic", "The slow song", "dim dance floor"),
    ("romantic", "Warm shadow", "warm lamp dark corner"),
    ("romantic", "First dance", "dance floor spotlight"),
    ("sunrise", "The sky turns", "sunrise sky colors"),
    ("sunrise", "Peach curtain", "morning light curtains"),
    ("sunrise", "Cold pink", "beach sunrise pink sky"),
    ("sunrise", "Dawn kitchen", "kitchen window at dawn"),
    ("sunrise", "Fisher light", "fishing boat at dawn"),
    ("sunrise", "Pale gold", "frost grass sunrise"),
    ("sunrise", "Before coffee", "early morning window light"),
    ("sunrise", "The waking house", "house at sunrise"),
    ("sunrise", "Desert dawn", "desert dunes sunrise"),
    ("sunrise", "Horizon line", "sunrise horizon sea"),
    ("neon", "Neon rain", "neon rain night city"),
    ("neon", "Cyan room", "cyan neon"),
    ("neon", "Voltage", "electric blue neon night"),
    ("neon", "Aquarium night", "aquarium"),
    ("neon", "Signal violet", "violet neon"),
    ("neon", "Ice and magenta", "neon reflections"),
    ("neon", "Server glow", "server room"),
    ("neon", "Hologram", "blue neon"),
    ("neon", "Afterimage", "long exposure neon lights"),
    ("neon", "Magnesium", "sparkler"),
]

SEEDS = {
    "Wood lamp": GALLERY / "wool.jpg",
    "Low flame": GALLERY / "candle.jpg",
    "Rain on the avenue": GALLERY / "rain.jpg",
    "Blue hour": GALLERY / "blue-hour.jpg",
}


def slug(name):
    text = name.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=45) as response:
        return response.read()


def meta_value(meta, key):
    value = (meta or {}).get(key)
    if isinstance(value, dict):
        return value.get("value") or ""
    return value or ""


def search(query, skip_titles, offset=0):
    params = {
        "action": "query",
        "format": "json",
        "generator": "search",
        "gsrsearch": f"{query} filetype:bitmap",
        "gsrnamespace": "6",
        "gsrlimit": "20",
        "gsroffset": str(offset),
        "prop": "imageinfo",
        "iiprop": "url|mime|extmetadata",
        "iiurlwidth": "720",
    }
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)
    data = json.loads(fetch(url))
    pages = (data.get("query") or {}).get("pages") or {}
    if isinstance(pages, dict):
        pages = list(pages.values())
    pages = [page for page in pages if isinstance(page, dict)]
    pages.sort(key=lambda page: page.get("index", 99))
    found = []
    for page in pages:
        title = page.get("title") or ""
        if any(word in title.lower() for word in JUNK):
            continue
        if title in skip_titles:
            continue
        infos = page.get("imageinfo") or []
        if not infos or not isinstance(infos[0], dict):
            continue
        info = infos[0]
        meta = info.get("extmetadata") if isinstance(info.get("extmetadata"), dict) else {}
        license_name = meta_value(meta, "LicenseShortName")
        low = license_name.lower()
        if any(bad in low for bad in ("nc", "nd")):
            continue
        if not any(ok in low for ok in ("cc", "public", "pd")):
            continue
        if info.get("mime") not in ("image/jpeg", "image/png", "image/webp"):
            continue
        thumb = info.get("thumburl") or info.get("url")
        if not thumb:
            continue
        found.append({
            "title": title,
            "thumb": thumb,
            "license": license_name,
            "page": "https://commons.wikimedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_")),
        })
        if len(found) >= TARGET:
            break
    return found


def sample_palette(path):
    image = Image.open(path).convert("RGB")
    image = image.resize((50, 30))
    width, height = image.size
    slots = []
    for index in range(5):
        x0 = int(index * width / 5)
        x1 = int((index + 1) * width / 5)
        pixels = [image.getpixel((x, y)) for y in range(height) for x in range(x0, x1)]
        red = sum(pixel[0] for pixel in pixels) / len(pixels)
        green = sum(pixel[1] for pixel in pixels) / len(pixels)
        blue = sum(pixel[2] for pixel in pixels) / len(pixels)
        hue, sat, val = rgb_to_hsv(red, green, blue)
        slots.append({"hs": [round(hue), round(sat * 100)], "b": round(val * 255)})
    return slots


def rgb_to_hsv(red, green, blue):
    red, green, blue = red / 255, green / 255, blue / 255
    high = max(red, green, blue)
    low = min(red, green, blue)
    delta = high - low
    val = high
    sat = 0 if high == 0 else delta / high
    if delta == 0:
        hue = 0
    elif high == red:
        hue = (60 * ((green - blue) / delta)) % 360
    elif high == green:
        hue = 60 * ((blue - red) / delta) + 120
    else:
        hue = 60 * ((red - green) / delta) + 240
    return hue, sat, val


def load_scenes():
    path = OUT / "scenes.json"
    if not path.exists():
        return []
    return json.loads(path.read_text())


def save_scenes(scenes):
    OUT.mkdir(parents=True, exist_ok=True)
    IMG.mkdir(parents=True, exist_ok=True)
    (OUT / "scenes.json").write_text(json.dumps(scenes, indent=2))


def choices_block():
    path = OUT / "choices.json"
    if not path.exists():
        return {"selected": {}, "rejected": {}}
    data = json.loads(path.read_text())
    return {"selected": data.get("selected") or {}, "rejected": data.get("rejected") or {}}


def known_photos():
    """Photos already downloaded for this review, keyed by scene name."""
    path = OUT / "manifest.json"
    rows = json.loads(path.read_text()) if path.exists() else []
    by_name = {}
    alias = {"Blue hour roofs": "Blue hour"}
    for row in rows:
        label = alias.get(row.get("label"), row.get("label"))
        file_name = row.get("file")
        if not label or not file_name:
            continue
        src = OUT / file_name
        if not src.exists():
            continue
        by_name.setdefault(label, []).append(row)
    wheat = OUT / "01-wheat-field.jpg"
    if wheat.exists():
        by_name.setdefault("Rolling gold", []).append({
            "title": "File:Sunset-over-the-wheat-field-featured.jpg",
            "license": "CC BY 4.0",
            "page": "https://commons.wikimedia.org/wiki/File:Sunset-over-the-wheat-field-featured.jpg",
            "file": "01-wheat-field.jpg",
        })
    return by_name


def image_from_file(scene_id, src, title, license_name, page):
    IMG.mkdir(parents=True, exist_ok=True)
    dest = IMG / f"{scene_id}-{slug(title)[:40]}{src.suffix.lower()}"
    if not dest.exists():
        shutil.copy(src, dest)
    return {
        "id": slug(title)[:80],
        "title": title,
        "file": f"img/{dest.name}",
        "license": license_name,
        "page": page,
        "palette": sample_palette(dest),
    }


def open_count(scene, dropped):
    return len([img for img in scene["images"] if img["id"] not in dropped])


def main():
    # Local chooser only. The shipping gallery stays until a picture is picked.
    previous = {scene["id"]: scene for scene in load_scenes()}
    picked = choices_block()
    rejected = picked["rejected"]
    selected = picked["selected"]
    known = known_photos()
    scenes = []
    for group, name, _query in SCENES:
        scene_id = slug(name)
        scene = previous.get(scene_id) or {"id": scene_id, "group": group.title(), "name": name, "images": []}
        scene["group"] = group.title()
        scene["name"] = name
        scene["images"] = [
            img for img in (scene.get("images") or [])
            if not any(word in (img.get("title") or "").lower() for word in JUNK)
        ]
        titles = {img.get("title") for img in scene["images"]}
        for row in known.get(name, []):
            title = row.get("title") or row["file"]
            if title in titles:
                continue
            src = OUT / row["file"]
            scene["images"].append(image_from_file(
                scene_id, src, title, row.get("license") or "", row.get("page") or "",
            ))
            titles.add(title)
        seed = SEEDS.get(name)
        seed_title = f"seed:{name}"
        if seed and seed.exists() and seed_title not in titles:
            scene["images"].append(image_from_file(
                scene_id, seed, seed_title, "already in the app", "",
            ))
        scenes.append(scene)
    save_scenes(scenes)
    for group, name, query in SCENES:
        scene = next(item for item in scenes if item["name"] == name)
        dropped = set(rejected.get(scene["id"]) or [])
        if selected.get(scene["id"]):
            print(f"{name}: picked")
            continue
        if open_count(scene, dropped) >= TARGET:
            print(f"{name}: {open_count(scene, dropped)}")
            continue
        queries = [(query, 0), (query, 20), (query, 40)]
        for text, offset in queries:
            if open_count(scene, dropped) >= TARGET:
                break
            titles = {img.get("title") for img in scene["images"]}
            try:
                hits = search(text, titles, offset)
            except Exception as err:
                print("ERR", name, err)
                if "429" in str(err):
                    time.sleep(12)
                hits = []
            time.sleep(1.05)
            for hit in hits:
                if open_count(scene, dropped) >= TARGET:
                    break
                if hit["title"] in titles:
                    continue
                ext = ".png" if hit["thumb"].lower().split("?")[0].endswith(".png") else ".jpg"
                dest = IMG / f"{scene['id']}-{len(scene['images'])}{ext}"
                try:
                    raw = fetch(hit["thumb"])
                except Exception as err:
                    print("DL", name, err)
                    continue
                if len(raw) < 4000:
                    continue
                dest.write_bytes(raw)
                scene["images"].append({
                    "id": slug(hit["title"])[:80],
                    "title": hit["title"],
                    "file": f"img/{dest.name}",
                    "license": hit["license"],
                    "page": hit["page"],
                    "palette": sample_palette(dest),
                })
                titles.add(hit["title"])
                print("OK", name, open_count(scene, dropped))
                time.sleep(0.2)
        save_scenes(scenes)
        print(f"{name}: {open_count(scene, dropped)}")
    print("scenes", len(scenes))


if __name__ == "__main__":
    main()
