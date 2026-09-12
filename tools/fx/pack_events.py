# イベントの印6種を 3x2 のアトラス（マスク用・白）にまとめて WebP へ。
#
# 白で描いてあるので、色は CSS 側（--ev）が塗る。
# 並びは chest / exit / talk ／ join / battle / scene。
# **CSS の mask-position と揃えること**（ずれると別の印が出る）。
import os, sys
from PIL import Image

SRC = '_scratch/tiles'
OUT = 'assets/map/events.webp'
KINDS = ('chest', 'exit', 'talk', 'join', 'battle', 'scene')

def main():
    ims = []
    for k in KINDS:
        p = os.path.join(SRC, 'ev_%s.png' % k)
        if not os.path.exists(p):
            print('%s がありません' % p); return 1
        ims.append(Image.open(p).convert('RGBA'))
    w, h = ims[0].size
    if any(im.size != (w, h) for im in ims):
        print('大きさが揃っていません'); return 1

    sheet = Image.new('RGBA', (w * 3, h * 2), (0, 0, 0, 0))
    for i, im in enumerate(ims):
        sheet.paste(im, ((i % 3) * w, (i // 3) * h))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    sheet.save(OUT, 'WEBP', quality=92, method=6)
    print('%dx%d -> %s (%s bytes)' % (sheet.width, sheet.height, OUT,
                                      format(os.path.getsize(OUT), ',')))
    print('CSS: mask-size 300%% 200%% / 位置は ' + ' '.join(
        '%s=(%d%%,%d%%)' % (k, (i % 3) * 50, (i // 3) * 100) for i, k in enumerate(KINDS)))
    # 白のまま（マスク用）であることを確かめる。色が入っていると CSS 側で塗れない
    rgb = sheet.convert('RGB').getcolors(maxcolors=1 << 24) or []
    tinted = [c for n, c in rgb if c != (0, 0, 0) and (max(c) - min(c)) > 12]
    if tinted:
        print('★ 白以外の色が入っています（マスクには使えません）:', tinted[:3])
    return 0

if __name__ == '__main__':
    sys.exit(main())
