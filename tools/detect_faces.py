# -*- coding: utf-8 -*-
"""
立ち絵から顔アイコンの切り抜き位置を求める。

── 考え方 ──
全身の立ち絵は、上から「頭 → 首 → 肩」と並ぶ。
横幅を上から順に見ていくと、頭でいったん広がり、**首でくびれ**、肩でまた広がる。
このくびれを見つければ、頭だけを切り出せる。

既存の自動検出（src/ui/facecrop.js）は色の差で被写体を探していて、
淡い色のキャラクターだと背景と区別できず失敗していた
（ch_lg_ember / ch_lg_iris は size=1.0、つまり全体を返していた）。
背景を透過させた今はアルファ値でくっきり分かれるので、こちらのほうが確実。

出力は data/characters.js にそのまま貼れる形。

使い方:
    python tools/detect_faces.py              # 一覧を表示するだけ
    python tools/detect_faces.py --write      # characters.js の face を書き換える
    python tools/detect_faces.py --sheet      # 切り抜き結果を1枚の画像にして確認
"""
from __future__ import print_function, unicode_literals

import io
import os
import re
import sys

try:
    from PIL import Image
except ImportError:
    print('Pillow が必要です:  pip install Pillow')
    sys.exit(1)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHAR_DIR = os.path.join(ROOT, 'assets', 'characters')
import contentscan

CHAR_JS = os.path.join(ROOT, 'data', 'characters.js')

# 全身の高さに対する頭の高さの割合。アニメ調の全身立ち絵はおおむね6〜7頭身。
HEAD_RATIO = 0.145
# 頭の高さに対して、切り抜く正方形をどれだけ大きく取るか。
# 1.0 だと顔が枠いっぱいで窮屈なので、少し余白を持たせる。
HEAD_MARGIN = 1.75
# 大きさの上下限。ここを外れたら測り損ねているとみなす。
# 手で指定されている既存の12体が 0.319〜0.415 に収まっているので、それに合わせた。
SIZE_MIN = 0.28
SIZE_MAX = 0.46
# 被写体とみなすアルファ値
ALPHA_MIN = 40
# 各行で「被写体がある」とみなす最低ピクセル数（ノイズよけ）
ROW_MIN = 3


def _profile(px, w, h):
    """行ごとの (左端, 右端, 個数) を返す。"""
    prof = []
    for y in range(h):
        left, right, n = None, None, 0
        for x in range(w):
            if px[x, y][3] >= ALPHA_MIN:
                if left is None:
                    left = x
                right = x
                n += 1
        prof.append((left, right, n))
    return prof


def detect(path):
    im = Image.open(path).convert('RGBA')
    w, h = im.size
    px = im.load()
    prof = _profile(px, w, h)

    rows = [y for y in range(h) if prof[y][2] >= ROW_MIN]
    if not rows:
        return None
    top, bottom = rows[0], rows[-1]
    body = bottom - top
    if body < 40:
        return None

    # 首は「頭のてっぺんから体の35%以内」にあるはず。
    # その範囲で幅が最も細くなる行を探す。
    limit = min(bottom, top + int(body * 0.35))
    widths = []
    for y in range(top, limit):
        l, r, n = prof[y]
        widths.append((r - l + 1) if l is not None else 0)
    if not widths:
        return None

    # てっぺん付近の細い部分（アホ毛・角）は無視したいので、
    # いったん最大幅の位置（＝頭か肩の一番広い所）を見つけてから、その後のくびれを探す。
    peak = max(range(len(widths)), key=lambda i: widths[i])
    tail = widths[peak:]
    if len(tail) < 5:
        neck_rel = len(widths) - 1
    else:
        neck_rel = peak + min(range(len(tail)), key=lambda i: tail[i])

    neck = top + neck_rel

    # 頭のてっぺんから首までが、全身に対して不自然な長さなら測り損ねている。
    # 冠・光輪・長い角があると「一番広い所」が肩まで下がり、
    # 首をそこに見つけてしまって顔がフレームから外れる（実測: aurora / ryn）。
    # そういうときは比率から当たりを付け直す。
    if neck - top < body * 0.05 or neck - top > body * 0.24:
        neck = top + int(body * 0.17)

    # 大きさは頭の **幅** ではなく、全身の高さから比率で決める。
    # 幅は髪の広がり・角・翼・武器で簡単に倍近くまで膨らみ、
    # 実測でも size が 0.32〜1.00 まで散らばって使いものにならなかった。
    # 全身に対する頭の割合はどの絵でもほぼ一定なので、こちらのほうが安定する。
    head_h = body * HEAD_RATIO

    # 顔は首のすぐ上にある。頭のてっぺん（＝髪や角の先）から測ると
    # 顔がフレームの下に寄ってしまうので、首から上へ測り直す。
    face_top = max(top, neck - head_h)
    cy = (face_top + neck) / 2.0

    # 横位置は「顔のある帯」に含まれるピクセルの **中央値** を採る。
    # 両端の中点だと、片側にだけ伸びる髪・尾・武器に中心を引っ張られる
    # （実測: mireille / viola で顔が枠の外に出た）。
    # 中央値なら、細い張り出しがあっても頭の塊のほうに寄る。
    band_lo, band_hi = int(face_top), int(neck)
    hx = [x for y in range(band_lo, max(band_hi, band_lo + 2))
          for x in range(w) if px[x, y][3] >= ALPHA_MIN]
    if not hx:
        return None
    hx.sort()
    cx = hx[len(hx) // 2]

    size = head_h * HEAD_MARGIN / float(w)
    size = max(SIZE_MIN, min(SIZE_MAX, size))
    return {
        'x': round(cx / w, 4),
        'y': round(cy / h, 4),
        'size': round(size, 4),
        '_neck': neck, '_top': top, '_head_h': int(head_h),
    }


def existing_faces():
    """手で書かれている face を拾う。コアと拡張 (§18) の両方を見る。"""
    out = {}
    for entry in contentscan.scan_characters():
        fm = re.search(r'face:\s*\{\s*x:\s*([\d.]+),\s*y:\s*([\d.]+),\s*size:\s*([\d.]+)',
                       entry['chunk'])
        if fm:
            out[entry['id']] = dict(x=float(fm.group(1)), y=float(fm.group(2)),
                                    size=float(fm.group(3)))
    return out


def write_faces(results):
    """art: { の直後に face を差し込む。既にある場合は置き換える。

    ── 書き込み先 ──
    そのキャラを定義しているファイルへ書く。拡張 (§18) のキャラなら
    content/ のほうへ書き込む。data/characters.js へ書いてしまうと、
    **拡張はコアを書き換えない** という約束が、絵を入れた瞬間に破れる。

    インデントも定義元に合わせる。コアは 6、拡張は add() の中なので 8。
    """
    entries = {e['id']: e for e in contentscan.scan_characters()}

    # 同じファイルへの書き込みをまとめる（1ファイルずつ読み書きする）
    by_file = {}
    for cid in results:
        entry = entries.get(cid)
        if not entry:
            continue
        by_file.setdefault(entry['source'], []).append(cid)

    written = 0
    for path, ids in by_file.items():
        s = io.open(path, encoding='utf-8').read()
        # 拡張は add() の中にあるぶん、1段深い
        is_core = os.path.dirname(path).endswith('data')
        pad = ' ' * (6 if is_core else 8)
        head = ' ' * (2 if is_core else 4)
        close = '\n' + ' ' * (4 if is_core else 6) + '},'

        for cid in ids:
            r = results[cid]
            m = re.search(r'(\n%s%s:\s*\{)' % (head, re.escape(cid)), s)
            if not m:
                continue
            art = s.find('art: {', m.end())
            if art < 0:
                continue
            line = ('\n%s// 立ち絵から自動計測（tools/detect_faces.py）。'
                    '調整は test/art.html から。\n'
                    '%sface: { x: %s, y: %s, size: %s },'
                    % (pad, pad, r['x'], r['y'], r['size']))
            seg_end = s.find(close, art)
            if seg_end < 0:
                continue
            seg = s[art:seg_end]
            seg_new = re.sub(r'\n\s*//[^\n]*\n\s*face:\s*\{[^}]*\},', '', seg)
            seg_new = re.sub(r'\n\s*face:\s*\{[^}]*\},', '', seg_new)
            seg_new = seg_new.replace('art: {', 'art: {' + line, 1)
            s = s[:art] + seg_new + s[seg_end:]
            written += 1

        io.open(path, 'w', encoding='utf-8').write(s)
    return written


def sheet(results, path):
    """切り抜き結果を並べた確認用の画像を作る。"""
    cell = 132
    cols = 6
    rows = (len(results) + cols - 1) // cols
    BG = (20, 24, 33)
    out = Image.new('RGB', (cell * cols, cell * rows), BG)
    for i, (cid, r) in enumerate(sorted(results.items())):
        src = os.path.join(CHAR_DIR, cid + '.png')
        if not os.path.exists(src):
            continue
        im = Image.open(src).convert('RGBA')
        w, h = im.size
        side = max(8, int(r['size'] * w))
        left = int(r['x'] * w - side / 2.0)
        top = int(r['y'] * h - side / 2.0)
        crop = im.crop((left, top, left + side, top + side))
        crop = crop.resize((cell - 8, cell - 8), Image.LANCZOS)
        tile = Image.new('RGBA', (cell - 8, cell - 8), BG + (255,))
        tile.alpha_composite(crop)
        out.paste(tile.convert('RGB'), ((i % cols) * cell + 4, (i // cols) * cell + 4))
    out.save(path)
    return path


def main(argv):
    files = sorted(f for f in os.listdir(CHAR_DIR) if f.endswith('.png'))
    manual = existing_faces()

    results = {}
    failed = []
    for f in files:
        cid = os.path.splitext(f)[0]
        r = detect(os.path.join(CHAR_DIR, f))
        if not r:
            failed.append(cid)
            continue
        results[cid] = r

    print('立ち絵 %d 枚 / 計測できた %d 枚' % (len(files), len(results)))
    if failed:
        print('  計測できず:', ', '.join(failed))

    print('\n%-20s %-24s %s' % ('キャラ', '自動計測', '既存の手動指定'))
    for cid in sorted(results):
        r = results[cid]
        cur = manual.get(cid)
        cur_s = ('x=%.3f y=%.3f size=%.3f' % (cur['x'], cur['y'], cur['size'])) if cur else '—'
        print('%-20s x=%.3f y=%.3f size=%.3f   %s'
              % (cid, r['x'], r['y'], r['size'], cur_s))

    if '--sheet' in argv:
        p = sheet(results, os.path.join(ROOT, 'face_sheet.png'))
        print('\n確認用の一覧画像:', os.path.relpath(p, ROOT))

    if '--write' in argv:
        # 手動指定があるものは触らない（作者が意図して決めた値のため）
        target = {k: v for k, v in results.items() if k not in manual}
        n = write_faces(target)
        print('\ncharacters.js に face を書き込みました: %d 体（手動指定の %d 体は変更なし）'
              % (n, len(manual)))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
