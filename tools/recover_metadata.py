# -*- coding: utf-8 -*-
"""
退避してある元画像から、生成メタデータを控えへ回収する。

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
import struct
import sys
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKUP_JSON = os.path.join(ROOT, 'tools', 'image_metadata_backup.json')
ORIGINALS = os.path.join(ROOT, 'assets_backup_cutout')

PNG_SIG = b'\x89PNG\r\n\x1a\n'


def text_chunks(path):
    out = {}
    with open(path, 'rb') as f:
        if f.read(8) != PNG_SIG:
            return out
        while True:
            hdr = f.read(8)
            if len(hdr) < 8:
                break
            ln, typ = struct.unpack('>I4s', hdr)
            data = f.read(ln)
            f.read(4)
            if typ in (b'tEXt', b'iTXt', b'zTXt'):
                try:
                    if typ == b'zTXt':
                        k, rest = data.split(b'\x00', 1)
                        try:
                            v = zlib.decompress(rest[1:])
                        except Exception:
                            v = rest
                    elif typ == b'iTXt':
                        parts = data.split(b'\x00', 5)
                        k, v = parts[0], parts[-1]
                    else:
                        k, v = data.split(b'\x00', 1)
                    out[k.decode('utf-8', 'replace')] = v.decode('utf-8', 'replace')
                except Exception:
                    pass
            if typ == b'IEND':
                break
    return out


def main():
    if not os.path.isdir(ORIGINALS):
        print('退避フォルダがありません:', os.path.relpath(ORIGINALS, ROOT))
        return 1

    backup = {}
    if os.path.exists(BACKUP_JSON):
        with io.open(BACKUP_JSON, encoding='utf-8') as f:
            backup = json.load(f)

    before = len(backup)
    added = 0
    for p in sorted(glob.glob(os.path.join(ORIGINALS, '*.png'))):
        meta = text_chunks(p)
        if not meta:
            continue
        # 退避時のファイル名は "assets__characters__ch_x.png" の形
        rel = os.path.basename(p).replace('__', '/')
        if rel not in backup:
            backup[rel] = meta
            added += 1

    with io.open(BACKUP_JSON, 'w', encoding='utf-8') as f:
        f.write(json.dumps(backup, ensure_ascii=False, indent=2))

    with_prompt = sum(1 for m in backup.values() if 'Comment' in m or 'Description' in m)
    print('控え %d 件 → %d 件（新たに回収 %d 件）' % (before, len(backup), added))
    print('プロンプト／シードを保持しているもの: %d 件' % with_prompt)
    return 0


if __name__ == '__main__':
    sys.exit(main())
