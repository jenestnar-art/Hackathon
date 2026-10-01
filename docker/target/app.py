"""PixelForge —— 有漏洞的图片处理服务（仅供 CTF 靶机使用）"""
import json
import os
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKUP_DIR = os.path.join(BASE_DIR, "backup")

LANDING = """<!doctype html>
<html lang="zh">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PixelForge 图片实验室</title>
</head>
<body style="font-family:system-ui,sans-serif;background:#0f1514;color:#e8f1ee;padding:40px">
  <h1 style="color:#d7ff68">PixelForge</h1>
  <p>公司内部图片处理平台。公开站点只提供品牌介绍。</p>
  <p style="color:#7f918b">需要批量处理图片？内部转换服务由运维团队维护。</p>
  <!-- ops: /api/convert?file=... 仍监听在 8080，尚未加白名单 -->
</body>
</html>
"""

ROBOTS = "User-agent: *\nDisallow: /backup\nDisallow: /debug\n"


def shell(cmd: str) -> dict:
    try:
        proc = subprocess.run(
            cmd,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=20,
        )
        return {
            "ok": proc.returncode == 0,
            "output": proc.stdout.decode("utf-8", "replace"),
        }
    except subprocess.TimeoutExpired:
        return {"ok": False, "output": "request timed out (shell may still be running)"}


def read(path: str) -> str:
    with open(path, "r", encoding="utf-8", errors="replace") as handle:
        return handle.read()


class PublicHandler(BaseHTTPRequestHandler):
    server_version = "PixelForge/1.0"

    def _send(self, status: int, body: str, content_type: str = "text/html; charset=utf-8"):
        data = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):  # noqa: N802 - http.server API
        path = urlparse(self.path).path

        if path == "/":
            return self._send(200, LANDING)
        if path == "/robots.txt":
            return self._send(200, ROBOTS, "text/plain; charset=utf-8")
        if path == "/debug":
            return self._send(
                200,
                json.dumps({"status": "ok", "note": "convert endpoint accepts a file parameter"}) + "\n",
                "application/json",
            )
        if path == "/backup":
            files = sorted(os.listdir(BACKUP_DIR))
            listing = "\n".join(f'<li><a href="/backup/{name}">{name}</a></li>' for name in files)
            return self._send(200, f"<h1>backup</h1><ul>{listing}</ul>")
        if path.startswith("/backup/"):
            name = os.path.basename(path)
            target = os.path.join(BACKUP_DIR, name)
            if os.path.isfile(target):
                return self._send(200, read(target), "text/plain; charset=utf-8")
            return self._send(404, "not found", "text/plain; charset=utf-8")

        return self._send(404, "not found", "text/plain; charset=utf-8")

    def log_message(self, *args):  # noqa: ANN002 - quiet logs
        return


class ApiHandler(BaseHTTPRequestHandler):
    server_version = "PixelForge-API/1.0"

    def _send_json(self, status: int, payload: dict):
        data = (json.dumps(payload) + "\n").encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):  # noqa: N802 - http.server API
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/":
            return self._send_json(200, {"service": "PixelForge internal API"})
        if path == "/api/health":
            return self._send_json(200, {"status": "ok"})
        if path == "/api/convert":
            query = parse_qs(parsed.query)
            file_name = query.get("file", [""])[0]
            if not file_name:
                return self._send_json(400, {"error": "file parameter required"})

            # 故意未转义用户输入：文件名直接拼进 shell 命令
            cmd = f"convert {file_name} -resize 50% /tmp/out.png"
            result = shell(cmd)
            return self._send_json(200 if result["ok"] else 500, result)

        return self._send_json(404, {"error": "not found"})

    def log_message(self, *args):  # noqa: ANN002 - quiet logs
        return


def serve(port: int, handler):
    server = ThreadingHTTPServer(("0.0.0.0", port), handler)
    print(f"[pixelforge] listening on :{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    import threading

    public = threading.Thread(target=serve, args=(8000, PublicHandler), daemon=True)
    api = threading.Thread(target=serve, args=(8080, ApiHandler), daemon=True)
    public.start()
    api.start()
    print("[pixelforge] started public:8000 api:8080", flush=True)

    while True:
        try:
            public.join(timeout=3600)
            api.join(timeout=3600)
            break
        except KeyboardInterrupt:
            break
