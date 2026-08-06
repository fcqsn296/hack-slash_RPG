# -*- coding: utf-8 -*-
"""
公開する画像から、埋め込みメタデータを取り除く。

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

import io
import json
import os
import struct
import sys
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 公開されるのはここだけ。原本のあるフォルダは対象外。
TARGET_DIRS = [os.path.join('assets', 'characters'), os.path.join('assets', 'enemies')]

BACKUP = os.path.join(ROOT, 'tools', 'image_metadata_backup.json')

# 残してよいチャンク。画像として表示するのに要るものだけ。
# 色や透過の情報を落とすと見た目が変わるので、テキスト系だけを狙って捨てる。
DROP = {b'tEXt', b'iTXt', b'zTXt', b'eXIf'}

PNG_SIG = b'\x89PNG\r\n\x1a\n'


def read_chunks(path):
    """(type, data) の列を返す。壊れていれば None。"""
    with open(path, 'rb') as f:
        if f.read(8) != PNG_SIG:
            return None
        out = []
        while True:
            hdr = f.read(8)
            if len(hdr) < 8:
                return None
            ln, typ = struct.unpack('>I4s', hdr)
            data = f.read(ln)
            f.read(4)                     # CRC は捨てて後で計算し直す
            out.append((typ, data))
            if typ == b'IEND':
                return out


def decode_text(typ, data):
    """テキストチャンクを (キー, 値) にする。読めなければ None。"""
    try:
        if typ == b'zTXt':
            key, rest = data.split(b'\x00', 1)
            try:
                val = zlib.decompress(rest[1:])
            except Exception:
                val = rest
        elif typ == b'iTXt':
            parts = data.split(b'\x00', 5)
            key, val = parts[0], parts[-1]
        else:
            key, val = data.split(b'\x00', 1)
        return key.decode('utf-8', 'replace'), val.decode('utf-8', 'replace')
    except Exception:
        return None


def write_png(path, chunks):
    buf = io.BytesIO()
    buf.write(PNG_SIG)
    for typ, data in chunks:
        buf.write(struct.pack('>I', len(data)))
        buf.write(typ)
        buf.write(data)
        buf.write(struct.pack('>I', zlib.crc32(typ + data) & 0xFFFFFFFF))
    with open(path, 'wb') as f:
        f.write(buf.getvalue())


def main(apply_changes):
    targets = []
    for d in TARGET_DIRS:
        full = os.path.join(ROOT, d)
        if not os.path.isdir(full):
            continue
        for name in sorted(os.listdir(full)):
            if name.lower().endswith('.png'):
                targets.append((d.replace(os.sep, '/') + '/' + name, os.path.join(full, name)))

    # 既にある控えを読んでから足す。
    # 上書きにすると、2回目以降の実行（＝画像を追加したとき）に
    # 前回ぶんの記録が消えてしまう。除去は元に戻せないので、ここは必ず追記。
    backup = {}
    if os.path.exists(BACKUP):
        try:
            with io.open(BACKUP, encoding='utf-8') as f:
                backup = json.load(f)
        except Exception:
            print('  既存の控えを読めませんでした。名前を変えて退避します。')
            os.rename(BACKUP, BACKUP + '.broken')
            backup = {}

    dirty = []
    total_dropped = 0

    for rel, path in targets:
        chunks = read_chunks(path)
        if chunks is None:
            print('  読めない PNG（そのまま）:', rel)
            continue

        keep, dropped = [], []
        for typ, data in chunks:
            if typ in DROP:
                dropped.append((typ, data))
            else:
                keep.append((typ, data))

        if not dropped:
            continue

        meta = {}
        for typ, data in dropped:
            kv = decode_text(typ, data)
            if kv:
                meta[kv[0]] = kv[1]
            else:
                meta.setdefault('_binary', []).append(typ.decode('ascii', 'replace'))
        backup[rel] = meta
        dirty.append((rel, path, keep, len(dropped)))
        total_dropped += len(dropped)

    print('対象 %d 枚 / メタデータ有り %d 枚 / 除去するチャンク %d 個'
          % (len(targets), len(dirty), total_dropped))

    # 何が消えるのかを一覧で見せる（気づかずに情報を失わないように）
    keys = set()
    for m in backup.values():
        keys.update(m.keys())
    if keys:
        print('  含まれていた項目:', ', '.join(sorted(keys)))

    if not apply_changes:
        print('\n確認のみ。実際に除去するには --apply を付けて実行してください。')
        return 0

    with io.open(BACKUP, 'w', encoding='utf-8') as f:
        f.write(json.dumps(backup, ensure_ascii=False, indent=2))
    print('  退避先:', os.path.relpath(BACKUP, ROOT))

    for rel, path, keep, n in dirty:
        write_png(path, keep)
    print('除去しました: %d 枚' % len(dirty))
    return 0


if __name__ == '__main__':
    sys.exit(main('--apply' in sys.argv))
