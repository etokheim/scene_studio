#!/usr/bin/env python3
"""Serve the palette picker and store choices beside the photos."""

import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = Path(__file__).resolve().parents[2] / "dev" / "palette-candidates"


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        name = path.split("?", 1)[0]
        if name in ("/", "/picker.html"):
            return str(ROOT / "picker.html")
        if name == "/picker.js":
            return str(ROOT / "picker.js")
        if name.startswith("/img/") or name in ("/scenes.json", "/choices.json"):
            return str(DATA / name.lstrip("/"))
        return str(ROOT / "picker.html")

    def do_GET(self):
        if self.path.split("?", 1)[0] == "/choices.json" and not (DATA / "choices.json").exists():
            body = b'{"selected":{},"rejected":{},"feedback":{}}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def do_POST(self):
        if self.path.split("?", 1)[0] != "/api/choices":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length)
        DATA.mkdir(parents=True, exist_ok=True)
        (DATA / "choices.json").write_bytes(raw)
        self.send_response(204)
        self.end_headers()


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8766), Handler)
    print("http://127.0.0.1:8766/")
    server.serve_forever()
