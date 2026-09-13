# -*- coding: utf-8 -*-
"""
立ち絵を WebP に変換する。

変換そのものは imagekit/webp.py にある（他のプロジェクトでも使うため）。
ここに残っているのは **このリポジトリ固有の事情** だけ:
どのフォルダが対象か、元の PNG をどこへ退避するか、そのあと何をすべきか。

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

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import locate                                      # noqa: E402

try:
    locate.ensure()
except RuntimeError as e:
    print(e)
    sys.exit(1)

from imagekit import webp                          # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGETS = [os.path.join('assets', 'characters'), os.path.join('assets', 'enemies')]
MASTER = os.path.join(ROOT, 'assets_png_master')


def main(apply_changes):
    try:
        webp.require_pillow()
    except RuntimeError as e:
        print(e)
        return 1

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

    before, after = webp.estimate([p for _d, _n, p in jobs])

    print('対象 %d 枚' % len(jobs))
    print('  現在   %6.1f MB' % (before / 1024.0 / 1024.0))
    print('  WebP   %6.1f MB  (%.0f%%減)'
          % (after / 1024.0 / 1024.0, (1 - after / float(before)) * 100))

    if not apply_changes:
        print('\n確認のみ。実際に変換するには --apply を付けて実行してください。')
        return 0

    # 退避先の名前は「フォルダ__ファイル名」。assets/characters と
    # assets/enemies に同名があっても衝突しないようにするため。
    webp.convert_all([
        (p, os.path.join(MASTER, d.replace('/', '__') + '__' + n))
        for d, n, p in jobs
    ])

    print('\n変換しました: %d 枚' % len(jobs))
    print('  元の PNG は %s に移してあります（公開対象外）'
          % os.path.relpath(MASTER, ROOT))
    print('  ★ このあと build_precache.py と bump_cache_version.py を実行してください')
    return 0


if __name__ == '__main__':
    sys.exit(main('--apply' in sys.argv))
