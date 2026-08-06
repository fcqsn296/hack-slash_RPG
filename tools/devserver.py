"""開発用の静的サーバー。

python -m http.server だとブラウザがJSを強くキャッシュしてしまい、
コードを直しても反映されないことがある。このサーバーはキャッシュを無効にする
ヘッダを返すので、リロードすれば常に最新が読まれる。

使い方:
    python tools/devserver.py [ポート番号]
"""
import sys
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123


class NoCacheHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # 404 だけ出す。立ち絵の探索で出る 404 は正常な動作なので黙らせる。
        if args and str(args[1]) != "404":
            super().log_message(fmt, *args)


if __name__ == "__main__":
    print("http://localhost:%d/ で配信中（キャッシュ無効）" % PORT)
    print("ルート:", ROOT)
    ThreadingHTTPServer(("127.0.0.1", PORT), NoCacheHandler).serve_forever()
