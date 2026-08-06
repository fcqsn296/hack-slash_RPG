# -*- coding: utf-8 -*-
"""
立ち絵の背景を透過させる。

── なぜ「白を消す」ではないのか ──
単純に白いピクセルを消すと、白髪・白い服・光の表現まで一緒に消える。
ここでは **画像の外周と繋がっている領域だけ** を塗りつぶしで辿って消す。
キャラクターの内側にある白は外周と繋がっていないので、必ず残る。

── 2段目を自動でやらない理由 ──
背景が「白い枠 ＋ 内側に色の付いた板」という二重構造の絵がまれにある。
1段目で白枠を消したあと、もう一度塗りつぶせば板も消せる——のだが、
**これを自動でやると被写体を食う**。

実測した例:
  ch_lg_ignis   … 2段目でシアンの背景板 22.4% を除去（正しい）
  em_null_weaver … 2段目でキャラの黒い衣装 11.1% を除去（誤り）

背景板か衣装かを面積や形で見分けようとしたが、
外接矩形の充填率は 42.8% 対 15.4%、幅の比率は 100% 対 94.8% と
安全に切れる差が無かった。1枚のために危うい推測を自動化するより、
**必要な画像だけ明示して指定する** ほうが確実。

使い方:
    python tools/cutout_background.py                    # 確認だけ
    python tools/cutout_background.py --apply            # 1段階で透過
    python tools/cutout_background.py --apply --deep ch_lg_ignis.png
                                                         # 指定した絵だけ2段階

--apply のときは assets_backup_cutout/ に元の画像を残す。
"""
from __future__ import print_function, unicode_literals

import os
import shutil
import sys
from collections import deque

try:
    from PIL import Image
except ImportError:
    print('Pillow が必要です:  pip install Pillow')
    sys.exit(1)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGETS = [os.path.join('assets', 'characters'), os.path.join('assets', 'enemies')]
BACKUP_DIR = os.path.join(ROOT, 'assets_backup_cutout')

# 背景とみなす色の許容差（R+G+B の差の合計）
TOL = 32
# 2段目を実行してよい最小面積。これ未満なら、背景板ではなく被写体の一部とみなす。
# なお2段目は --deep で名指しした画像でしか動かない（上の説明を参照）。
SECOND_PASS_MIN = 0.10
# 1段目でこれ未満しか消えないなら、背景の推定に失敗している可能性が高い
SUSPICIOUS_LOW = 0.10


def _flood(px, w, h, seeds, tol):
    """seeds と似た色を、繋がっている範囲だけ塗り広げる。

    基準色は seeds の **最頻色** から取る。平均にすると、
    2段目の種（背景の板とキャラの輪郭が混ざる）で
    「どちらでもない中間色」になり、何も塗れなくなる。
    """
    if not seeds:
        return bytearray(w * h), None, 0

    buckets = {}
    for x, y in seeds:
        c = px[x, y]
        if c[3] == 0:
            continue
        k = (c[0] // 16, c[1] // 16, c[2] // 16)
        buckets.setdefault(k, []).append(c)
    if not buckets:
        return bytearray(w * h), None, 0

    sample = max(buckets.values(), key=len)
    br, bg, bb = [sum(c[i] for c in sample) / len(sample) for i in range(3)]

    # 種は基準色に近いものだけに絞る。関係ない場所から広がるのを防ぐ。
    seeds = [(x, y) for x, y in seeds
             if abs(px[x, y][0] - br) + abs(px[x, y][1] - bg) + abs(px[x, y][2] - bb) <= tol]
    if not seeds:
        return bytearray(w * h), None, 0

    seen = bytearray(w * h)
    q = deque(seeds)
    while q:
        x, y = q.popleft()
        i = y * w + x
        if seen[i]:
            continue
        c = px[x, y]
        if c[3] == 0:
            continue
        if abs(c[0] - br) + abs(c[1] - bg) + abs(c[2] - bb) > tol:
            continue
        seen[i] = 1
        if x > 0:      q.append((x - 1, y))
        if x < w - 1:  q.append((x + 1, y))
        if y > 0:      q.append((x, y - 1))
        if y < h - 1:  q.append((x, y + 1))
    return seen, (round(br), round(bg), round(bb)), sum(seen)


def _border_seeds(px, w, h):
    out = []
    for x in range(w):
        for y in (0, h - 1):
            if px[x, y][3] > 0:
                out.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if px[x, y][3] > 0:
                out.append((x, y))
    return out


def _edge_seeds(px, w, h, inset=5):
    """透明部分の縁から、内側へ inset px 入った位置を種として集める。

    縁そのものを種にしてはいけない。
    背景の境目にはアンチエイリアスの中間色が輪になって残っていて、
    そこを基準色にすると「白でもシアンでもない色」を追いかけることになり、
    本来消したい面に届かない。数ピクセル内側なら、面の素の色が拾える。
    """
    out = []
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if px[x, y][3] == 0:
                continue
            dx = dy = 0
            if px[x - 1, y][3] == 0:   dx = 1
            elif px[x + 1, y][3] == 0: dx = -1
            elif px[x, y - 1][3] == 0: dy = 1
            elif px[x, y + 1][3] == 0: dy = -1
            else:
                continue
            nx, ny = x + dx * inset, y + dy * inset
            if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] > 0:
                out.append((nx, ny))
    return out


def cutout(path, deep=False):
    """透過させた画像と、経過を返す。既に透過済みなら (None, ...)。

    deep=True のときだけ2段目を試す。既定では1段階しか行わない。
    """
    im = Image.open(path).convert('RGBA')
    w, h = im.size
    px = im.load()

    corners = [px[2, 2], px[w - 3, 2], px[2, h - 3], px[w - 3, h - 3]]
    if sum(c[3] for c in corners) / 4 <= 24:
        return None, 0.0, []              # もう透過されている

    steps = []
    total = 0
    for stage in range(2 if deep else 1):
        seeds = _border_seeds(px, w, h) if stage == 0 else _edge_seeds(px, w, h)
        if not seeds:
            break
        seen, color, n = _flood(px, w, h, seeds, TOL)
        ratio = n / float(w * h)
        if stage > 0 and ratio < SECOND_PASS_MIN:
            break
        if n == 0:
            break
        for y in range(h):
            row = y * w
            for x in range(w):
                if seen[row + x]:
                    r, g, b, _a = px[x, y]
                    px[x, y] = (r, g, b, 0)
        total += n
        steps.append((color, round(ratio * 100, 1)))
    return im, total / float(w * h), steps


def main(apply_changes, deep_names):
    files = []
    for d in TARGETS:
        full = os.path.join(ROOT, d)
        if os.path.isdir(full):
            for n in sorted(os.listdir(full)):
                if n.lower().endswith('.png'):
                    files.append((d.replace(os.sep, '/') + '/' + n, os.path.join(full, n)))

    todo, skipped, warn = [], 0, []
    for rel, path in files:
        deep = os.path.basename(rel) in deep_names
        im, ratio, steps = cutout(path, deep=deep)
        if im is None:
            skipped += 1
            continue
        todo.append((rel, path, im, ratio, steps))
        if ratio < SUSPICIOUS_LOW:
            warn.append((rel, ratio, steps))

    print('画像 %d 枚 / 透過済み %d 枚 / 処理対象 %d 枚' % (len(files), skipped, len(todo)))
    if todo:
        rr = [t[3] for t in todo]
        print('  除去割合  平均 %.1f%% / 最小 %.1f%% / 最大 %.1f%%'
              % (sum(rr) / len(rr) * 100, min(rr) * 100, max(rr) * 100))
    unknown = deep_names - set(os.path.basename(r) for r, _p in files)
    if unknown:
        print('  ★ --deep に指定された名前が見つかりません: %s' % ', '.join(sorted(unknown)))
    multi = [t for t in todo if len(t[4]) > 1]
    if multi:
        print('  2段階で処理したもの（--deep 指定）:')
        for rel, _p, _im, ratio, steps in multi:
            print('    %-34s %s' % (rel, steps))
    if warn:
        print('  ★ 除去が少なく、背景の推定に失敗した可能性:')
        for rel, ratio, steps in warn:
            print('    %-34s %.1f%% %s' % (rel, ratio * 100, steps))

    if not apply_changes:
        print('\n確認のみ。実際に書き換えるには --apply を付けて実行してください。')
        return 0
    if not todo:
        print('\n処理するものはありません。')
        return 0

    if not os.path.isdir(BACKUP_DIR):
        os.makedirs(BACKUP_DIR)
    for rel, path, im, _r, _s in todo:
        dst = os.path.join(BACKUP_DIR, rel.replace('/', '__'))
        if not os.path.exists(dst):
            shutil.copy2(path, dst)
        im.save(path)
    print('\n透過しました: %d 枚（元の画像は %s に控えてあります）'
          % (len(todo), os.path.relpath(BACKUP_DIR, ROOT)))

    # Pillow で保存し直すと PNG のテキストチャンクが黙って消える。
    # プロンプトとシードはここで退避画像から拾っておかないと、
    # 後で strip_png_metadata.py を走らせても「もう何も入っていない」状態になる。
    print('生成メタデータを控えへ回収します…')
    try:
        recover = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'recover_metadata.py')
        import subprocess
        subprocess.call([sys.executable, recover])
    except Exception as e:
        print('  回収に失敗しました（手動で tools/recover_metadata.py を実行してください）:', e)
    return 0


def _parse_deep(argv):
    """--deep a.png,b.png / --deep a.png b.png のどちらでも受ける。"""
    names = set()
    if '--deep' not in argv:
        return names
    for a in argv[argv.index('--deep') + 1:]:
        if a.startswith('--'):
            break
        names.update(n.strip() for n in a.split(',') if n.strip())
    return names


if __name__ == '__main__':
    sys.exit(main('--apply' in sys.argv, _parse_deep(sys.argv)))
