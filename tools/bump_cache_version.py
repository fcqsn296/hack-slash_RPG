# -*- coding: utf-8 -*-
"""
sw.js の CACHE_VERSION を1つ上げ、事前キャッシュの合計サイズを表示する。

ファイルを変更したら必ずこれを実行する。上げ忘れると、
利用者の端末に古い版が残り続ける（キャッシュ優先で配っているため）。

使い方:
    python tools/bump_cache_version.py
"""
from __future__ import print_function, unicode_literals

import sys as _sys
# Windows の既定コンソールは cp932 で、コミットメッセージに含まれる
# ダッシュや記号で落ちる。出力だけ UTF-8 に寄せておく。
try:
    _sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    _sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SW = os.path.join(ROOT, 'sw.js')


def main():
    src = io.open(SW, encoding='utf-8').read()

    block = src.split('const PRECACHE')[1].split('];')[0]
    urls = re.findall(r"'(\./[^']+)'", block)

    total = 0
    missing = []
    for u in urls:
        if u == './':
            continue
        p = os.path.join(ROOT, u[2:].replace('/', os.sep))
        if os.path.exists(p):
            total += os.path.getsize(p)
        else:
            missing.append(u)

    print('事前キャッシュ %d 件 / 合計 %.1f MB' % (len(urls), total / 1024.0 / 1024.0))
    if missing:
        print('  ★ 存在しない参照が %d 件あります:' % len(missing))
        for m in missing[:10]:
            print('    ', m)
        print('  build_precache.py を実行し直してください。')
    else:
        print('  存在しない参照: なし')

    m = re.search(r"CACHE_VERSION = 'v(\d+)'", src)
    if not m:
        print('CACHE_VERSION が見つかりません')
        return 1
    nxt = int(m.group(1)) + 1
    src = src.replace(m.group(0), "CACHE_VERSION = 'v%d'" % nxt, 1)
    io.open(SW, 'w', encoding='utf-8').write(src)
    print("CACHE_VERSION: v%s → v%d" % (m.group(1), nxt))
    return 0


if __name__ == '__main__':
    sys.exit(main())
