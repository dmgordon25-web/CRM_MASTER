#!/usr/bin/env python3
"""Development static file server with /__log endpoint."""
from __future__ import annotations

import argparse
import contextlib
import http.server
import json
import os
import socketserver
import sys
import time
from typing import Any

LOG_MAX_BYTES = 1024 * 1024


def logs_dir() -> str:
    base = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA")
    if not base:
        base = os.path.dirname(os.path.abspath(__file__))
    target = os.path.join(base, "CRM", "logs")
    try:
        os.makedirs(target, exist_ok=True)
    except OSError:
        pass
    return target


QUIET_MODE = bool(os.environ.get("CRM_QUIET_LOG"))


class RequestHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = http.server.SimpleHTTPRequestHandler.extensions_map.copy()
    extensions_map.update(
        {
            ".js": "application/javascript",
            ".mjs": "application/javascript",
            ".cjs": "application/javascript",
            ".css": "text/css",
            ".map": "application/json",
            ".MAP": "application/json",
        }
    )
    extensions_map[".JS"] = extensions_map[".js"]
    extensions_map[".MJS"] = extensions_map[".mjs"]
    extensions_map[".CJS"] = extensions_map[".cjs"]
    extensions_map[".CSS"] = extensions_map[".css"]

    def __init__(self, *args: Any, directory: str, **kwargs: Any) -> None:
        super().__init__(*args, directory=directory, **kwargs)

    def end_headers(self) -> None:  # noqa: D401 - inherited docs are fine
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A003 - match base signature
        sys.stdout.write("[py-serve] " + (format % args) + "\n")

    def do_OPTIONS(self) -> None:  # noqa: D401 - method override
        if self.path == "/__log":
            self.send_response(204)
            self._send_cors_headers()
            self.end_headers()
            return
        self.send_error(405, "Method Not Allowed")

    def do_POST(self) -> None:  # noqa: D401 - method override
        if self.path != "/__log":
            self.send_error(404, "Not Found")
            return

        body_bytes = self._read_body()
        if body_bytes is None:
            return  # response already sent

        try:
            text = body_bytes.decode("utf-8")
        except UnicodeDecodeError:
            self._send_error_response(400, "Invalid encoding")
            return

        payload: Any
        if not text.strip():
            payload = {}
        else:
            try:
                payload = json.loads(text)
            except json.JSONDecodeError:
                self._send_error_response(400, "Invalid JSON")
                return

        if QUIET_MODE:
            self.send_response(204)
            self._send_cors_headers()
            self.end_headers()
            return

        entry = json.dumps(
            {
                "t": int(time.time() * 1000),
                "ip": self.client_address[0] if self.client_address else None,
                "body": payload,
            },
            ensure_ascii=False,
        )

        try:
            directory = logs_dir()
            with open(os.path.join(directory, "frontend.log"), "a", encoding="utf-8") as handle:
                handle.write(entry + "\n")
        except OSError:
            self._send_error_response(500, "Failed to write log")
            return

        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def _read_body(self) -> bytes | None:
        remaining = LOG_MAX_BYTES + 1
        body = bytearray()
        while remaining > 0:
            chunk = self.rfile.read(min(remaining, 65536))
            if not chunk:
                break
            body.extend(chunk)
            remaining -= len(chunk)
            if len(body) > LOG_MAX_BYTES:
                self._send_error_response(413, "Payload Too Large")
                return None
        return bytes(body)

    def _send_cors_headers(self) -> None:
        origin = self.headers.get("Origin")
        if not origin:
            host = self.headers.get("Host")
            if host:
                origin = f"http://{host}"
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Vary", "Origin")

    def _send_error_response(self, status: int, message: str) -> None:
        self.send_response(status)
        self._send_cors_headers()
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        with contextlib.suppress(Exception):
            self.wfile.write(message.encode("utf-8"))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="CRM dev static server")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--root", type=str, default=os.getcwd())
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    directory = os.path.abspath(args.root)
    if not os.path.isdir(directory):
        raise SystemExit(f"Root directory does not exist: {directory}")

    handler = lambda *h_args, **h_kwargs: RequestHandler(  # noqa: E731 - simple factory
        *h_args, directory=directory, **h_kwargs,
    )

    class ThreadingServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
        daemon_threads = True
        allow_reuse_address = True

    with ThreadingServer(("127.0.0.1", args.port), handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
