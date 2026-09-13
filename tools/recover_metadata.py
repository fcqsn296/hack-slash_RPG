# -*- coding: utf-8 -*-
"""
退避してある元画像から、生成メタデータを控えへ回収する。

チャンクの読み取りと控えへの追記は imagekit/pngmeta.py にある。
ここに残っているのは **このリポジトリ固有の事情** だけ:
退避フォルダの場所と、そこでのファイル名の付け方。

── なぜ要るのか ──
背景を透過させる処理は Pillow で画像を保存し直すため、
PNG のテキストチャンク（プロンプト・シード・署名）が黙って消える。
つまり「透過 → メタデータ除去」の順で作業すると、
除去ツールが走る頃には既に消えていて、控えが取れない。

幸い assets_backup_cutout/ に透過前の画像が残っているので、
そこから拾い直して控えに追記する。

使い方:
    python tools/recover_metadata.py
"""
from __future__ import print_function, unicode_literals

import glob
import io
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import locate                                      # noqa: E402

try:
    locate.ensure()
except RuntimeError as e:
    print(e)
    sys.exit(1)

from imagekit import pngmeta                       # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKUP_JSON = os.path.join(ROOT, 'tools', 'image_metadata_backup.json')
ORIGINALS = os.path.join(ROOT, 'assets_backup_cutout')


def main():
    if not os.path.isdir(ORIGINALS):
        print('退避フォルダがありません:', os.path.relpath(ORIGINALS, ROOT))
        return 1

    existing = {}
    if os.path.exists(BACKUP_JSON):
        try:
            with io.open(BACKUP_JSON, encoding='utf-8') as f:
                existing = json.load(f)
        except Exception:
            existing = {}          # 壊れていれば backup_metadata が退避してくれる
    before = len(existing)

    # 退避時のファイル名は "assets__characters__ch_x.png" の形
    pairs = [(os.path.basename(p).replace('__', '/'), p)
             for p in sorted(glob.glob(os.path.join(ORIGINALS, '*.png')))]
    # **既にある控えは上書きしない。** 透過前の画像のほうが情報が多いとは限らず、
    # 除去時に拾った控えを古い退避画像で潰すと、新しいぶんが失われる。
    pairs = [(rel, p) for rel, p in pairs if rel not in existing]

    _total, found, _unreadable = pngmeta.scan(pairs)
    info = pngmeta.backup_metadata(BACKUP_JSON, found)
    if info['broken_backup_renamed']:
        print('  既存の控えを読めませんでした。名前を変えて退避しました。')

    with io.open(BACKUP_JSON, encoding='utf-8') as f:
        backup = json.load(f)
    with_prompt = sum(1 for m in backup.values() if 'Comment' in m or 'Description' in m)
    print('控え %d 件 → %d 件（新たに回収 %d 件）' % (before, len(backup), len(found)))
    print('プロンプト／シードを保持しているもの: %d 件' % with_prompt)
    return 0


if __name__ == '__main__':
    sys.exit(main())
