from __future__ import annotations

import argparse
import http.server
import os
import socketserver
import subprocess
import sys
import webbrowser
from functools import partial
from pathlib import Path


PORT = 4571


class LocalThreadingTCPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def open_browser(url: str) -> None:
    print("[me-and-my-gf] Opening local site...")
    if os.name == "nt":
        try:
            subprocess.Popen(["cmd", "/c", "start", "", "msedge", "--inprivate", url])
            return
        except OSError:
            pass
    webbrowser.open(url)


def create_server(directory: Path, port: int) -> LocalThreadingTCPServer:
    handler = partial(http.server.SimpleHTTPRequestHandler, directory=str(directory))
    return LocalThreadingTCPServer(("127.0.0.1", port), handler)


def serve(directory: Path, port: int, should_open: bool) -> None:
    server = create_server(directory, port)
    with server:
        url = f"http://localhost:{port}/index.html"
        print(f"[me-and-my-gf] Serving {directory} at {url}")
        if should_open:
            open_browser(url)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\n[me-and-my-gf] Server stopped.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve me-and-my-gf locally.")
    parser.add_argument("--port", type=int, default=PORT, help="Local HTTP port.")
    parser.add_argument("--no-open", action="store_true", help="Do not open browser.")
    parser.add_argument("--check", action="store_true", help="Validate paths and exit.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    project_root = Path(__file__).resolve().parent
    index_file = project_root / "index.html"
    manifest_file = project_root / "manifest.json"

    if args.check:
        if not index_file.exists():
            print("[me-and-my-gf] index.html not found.", file=sys.stderr)
            return 1
        if not manifest_file.exists():
            print("[me-and-my-gf] manifest.json not found.", file=sys.stderr)
            return 1
        import json

        manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
        missing = []
        for f in manifest.get("files") or []:
            path = project_root / str(f.get("path") or "")
            if not path.is_file():
                missing.append(str(f.get("path")))
        if missing:
            print("[me-and-my-gf] missing files:", ", ".join(missing), file=sys.stderr)
            return 1
        print("[me-and-my-gf] check passed.")
        return 0

    if not index_file.exists():
        print("[me-and-my-gf] index.html not found.", file=sys.stderr)
        return 1

    try:
        serve(project_root, args.port, should_open=not args.no_open)
        return 0
    except OSError as error:
        print(f"[me-and-my-gf] Failed to start server: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
