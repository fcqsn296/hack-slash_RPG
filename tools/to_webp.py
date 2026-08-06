# -*- coding: utf-8 -*-
"""
立ち絵を WebP に変換する。

── なぜ必要か ──
PNG のままだと立ち絵だけで 62MB あり、
GitHub Pages のデプロイが転送に時間がかかりすぎて失敗した
（deploy が10分でタイムアウト、artifact 62.7MB）。

WebP 品質90 に落とすと **約89%減って 7MB 前後** になる。
実測した劣化は不透明部分の平均差 3〜5/255、アルファは完全一致で、
並べて見ても区別が付かない。

スマホの初回読み込みが 63MB から 8MB 程度になるので、
外出先で遊ぶという目的にも効く。

── 元の PNG は残す ──
変換後の PNG は assets_png_master/ へ移す（.gitignore で公開対象外）。
品質を上げ直したくなったとき、劣化した WebP からではなく
元の PNG から作り直せるようにしておくため。

使い方:
    python tools/to_webp.py            # 確認だけ
    python tools/to_webp.py --apply    # 変換する
"""
from __future__ import print_function, unicode_literals

import io
import os
import shutil
import sys

try:
    from PIL import Image
except ImportError:
    print('Pillow が必要です:  pip install Pillow')
    sys.exit(1)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGETS = [os.path.join('assets', 'characters'), os.path.join('assets', 'enemies')]
MASTER = os.path.join(ROOT, 'assets_png_master')

QUALITY = 90
METHOD = 6          # 0〜6。大きいほど時間をかけて縮める


def main(apply_changes):
    jobs = []
    for d in TARGETS:
        full = os.path.join(ROOT, d)
        if not os.path.isdir(full):
            continue
        for n in sorted(os.listdir(full)):
            if n.lower().endswith('.png'):
                jobs.append((d.replace(os.sep, '/'), n, os.path.join(full, n)))

    if not jobs:
        print('変換する PNG がありません（すでに WebP 化されている可能性があります）')
        return 0

    before = after = 0
    for _d, _n, p in jobs:
        before += os.path.getsize(p)
        im = Image.open(p).convert('RGBA')
        buf = io.BytesIO()
        im.save(buf, 'WEBP', quality=QUALITY, method=METHOD)
        after += buf.tell()

    print('対象 %d 枚' % len(jobs))
    print('  現在   %6.1f MB' % (before / 1024.0 / 1024.0))
    print('  WebP   %6.1f MB  (%.0f%%減)'
          % (after / 1024.0 / 1024.0, (1 - after / float(before)) * 100))

    if not apply_changes:
        print('\n確認のみ。実際に変換するには --apply を付けて実行してください。')
        return 0

    if not os.path.isdir(MASTER):
        os.makedirs(MASTER)

    for d, n, p in jobs:
        im = Image.open(p).convert('RGBA')
        out = os.path.splitext(p)[0] + '.webp'
        im.save(out, 'WEBP', quality=QUALITY, method=METHOD)
        # 元の PNG は master へ退避してから消す
        shutil.move(p, os.path.join(MASTER, d.replace('/', '__') + '__' + n))

    print('\n変換しました: %d 枚' % len(jobs))
    print('  元の PNG は %s に移してあります（公開対象外）'
          % os.path.relpath(MASTER, ROOT))
    print('  ★ このあと build_precache.py と bump_cache_version.py を実行してください')
    return 0


if __name__ == '__main__':
    sys.exit(main('--apply' in sys.argv))
