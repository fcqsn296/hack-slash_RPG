# -*- coding: utf-8 -*-
"""
sw.js の事前キャッシュ一覧を index.html から生成する。

── なぜ生成するのか ──
Service Worker がページを支配するのは「2回目の読み込み」から。
そのため一覧を持たないと、初回訪問ではJSもデータも1つも貯まらず、
ホーム画面に追加してすぐ圏外へ行くと何も起動しない。

一覧を手で書くとファイルを足すたびに必ず漏れるので、
index.html が実際に読み込んでいるものをそのまま拾う。

使い方:
    python tools/build_precache.py

ファイルを追加・削除したら、これを実行してから
sw.js の CACHE_VERSION を1つ上げること。
"""
from __future__ import unicode_literals
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 一覧に必ず入れるもの（index.html からは参照されていない）
EXTRA = [
    './',
    './index.html',
    './manifest.webmanifest',
    './assets/pwa/icon-192.png',
    './assets/pwa/icon-512.png',
    './assets/pwa/icon-maskable-192.png',
    './assets/pwa/icon-maskable-512.png',
    './assets/pwa/apple-touch-icon.png',
]

# 事前に貯めないもの。
# 検証ページは遊ぶのに要らず、キャラ立ち絵は重いので初回に落とさない。
SKIP_PREFIX = ('test/', 'tools/', 'raw_image/', 'enemies_image/')


def collect():
    """index.html が読み込んでいるローカルファイルを列挙する。"""
    with io.open(os.path.join(ROOT, 'index.html'), encoding='utf-8') as f:
        html = f.read()

    urls = []
    urls += re.findall(r'<script[^>]+src="([^"]+)"', html)
    urls += re.findall(r'<link[^>]+href="([^"]+)"', html)

    out = []
    for u in urls:
        # 外部URLとデータURIは対象外
        if u.startswith(('http://', 'https://', '//', 'data:')):
            continue
        u = u.lstrip('./')
        if u.startswith(SKIP_PREFIX):
            continue
        if not os.path.exists(os.path.join(ROOT, u.replace('/', os.sep))):
            sys.stderr.write('警告: 見つからない参照 %s\n' % u)
            continue
        out.append('./' + u)

    # 画像はどれも JS が実行時に組み立てるので、HTML からは辿れない。
    # フォルダを直接なめて拾う。
    #
    # キャラ・敵の立ち絵まで含めると 40MB を超えるが、初回にまとめて落とす方針。
    # 実行時キャッシュに任せると「圏外で初めて引いたキャラの絵が出ない」ことになり、
    # 外出先で遊ぶという目的と噛み合わないため。
    for sub in ('ui', 'characters', 'enemies', 'pwa'):
        d = os.path.join(ROOT, 'assets', sub)
        if not os.path.isdir(d):
            continue
        for name in sorted(os.listdir(d)):
            if name.lower().endswith(('.svg', '.png')):
                out.append('./assets/%s/%s' % (sub, name))

    # 重複を消しつつ順番は保つ
    seen = set()
    result = []
    for u in EXTRA + out:
        if u not in seen:
            seen.add(u)
            result.append(u)
    return result


def write(urls):
    path = os.path.join(ROOT, 'sw.js')
    with io.open(path, encoding='utf-8') as f:
        src = f.read()

    body = ',\n'.join('  %s' % ("'%s'" % u) for u in urls)
    block = 'const PRECACHE = [\n%s,\n];' % body

    new, n = re.subn(r'const PRECACHE = \[[\s\S]*?\n\];', block, src, count=1)
    if n != 1:
        sys.stderr.write('sw.js に PRECACHE の配列が見つからない\n')
        return 1

    with io.open(path, 'w', encoding='utf-8') as f:
        f.write(new)
    print('sw.js を更新した: %d ファイル' % len(urls))
    print('  ★ sw.js の CACHE_VERSION を上げるのを忘れずに')
    return 0


if __name__ == '__main__':
    sys.exit(write(collect()))
