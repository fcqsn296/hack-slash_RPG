# -*- coding: utf-8 -*-
"""
公開する画像から、埋め込みメタデータを取り除く。

PNG チャンクの読み書きは imagekit/pngmeta.py にある（他のプロジェクトでも使うため）。
ここに残っているのは **このリポジトリ固有の事情** だけ:
どのフォルダが公開対象か、控えをどこへ置くか。

── なぜ必要か ──
NovelAI が出力した PNG には tEXt/iTXt チャンクが付いていて、
そこには **生成プロンプト全文・シード・モデル名・署名(signed_hash)** が入っている。
画像を配ると、この文字列もそのまま配られる。

取り除く前に `tools/image_metadata_backup.json` へ全部書き出すので、
シードやプロンプトを後から見返すことはできる。
このバックアップは .gitignore で公開対象から外してある。

使い方:
    python tools/strip_png_metadata.py            # 確認だけ（何も書き換えない）
    python tools/strip_png_metadata.py --apply    # 実際に除去する

対象は assets/ 以下だけ。raw_image/ と enemies_image/ は
作業用の原本なので **絶対に触らない**（公開対象からも外してある）。
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

from imagekit import pngmeta                       # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 公開されるのはここだけ。原本のあるフォルダは対象外。
TARGET_DIRS = [os.path.join('assets', 'characters'), os.path.join('assets', 'enemies')]

BACKUP = os.path.join(ROOT, 'tools', 'image_metadata_backup.json')


def main(apply_changes):
    targets = []
    for d in TARGET_DIRS:
        full = os.path.join(ROOT, d)
        if not os.path.isdir(full):
            continue
        for name in sorted(os.listdir(full)):
            if name.lower().endswith('.png'):
                targets.append((d.replace(os.sep, '/') + '/' + name,
                                os.path.join(full, name)))

    total, found, unreadable = pngmeta.scan(targets)
    for p in unreadable:
        print('  読めない PNG（そのまま）:', os.path.relpath(p, ROOT))

    # チャンク数は表示のために数える。scan は「何が入っていたか」だけを返す。
    dirty = []
    total_dropped = 0
    for rel, path in targets:
        if rel not in found:
            continue
        chunks = pngmeta.read_chunks(path) or []
        n = len([1 for t, _d in chunks if t in pngmeta.DROP])
        dirty.append((rel, path, n))
        total_dropped += n

    print('対象 %d 枚 / メタデータ有り %d 枚 / 除去するチャンク %d 個'
          % (total, len(dirty), total_dropped))

    # 何が消えるのかを一覧で見せる（気づかずに情報を失わないように）
    keys = set()
    for m in found.values():
        keys.update(m.keys())
    if keys:
        print('  含まれていた項目:', ', '.join(sorted(keys)))

    if not apply_changes:
        print('\n確認のみ。実際に除去するには --apply を付けて実行してください。')
        return 0

    # 控えは必ず **追記**。上書きにすると、2回目以降の実行（＝画像を追加したとき）に
    # 前回ぶんの記録が消えてしまう。除去は元に戻せない。
    info = pngmeta.backup_metadata(BACKUP, found)
    if info['broken_backup_renamed']:
        print('  既存の控えを読めませんでした。名前を変えて退避しました。')
    print('  退避先: %s（%d 件）' % (os.path.relpath(BACKUP, ROOT), info['total']))

    for rel, path, _n in dirty:
        pngmeta.strip(path)
    print('除去しました: %d 枚' % len(dirty))
    return 0


if __name__ == '__main__':
    sys.exit(main('--apply' in sys.argv))
