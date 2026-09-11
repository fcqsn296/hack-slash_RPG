# 連番 PNG を1枚のスプライトシート（WebP）にまとめる。
#
# 白で描いた絵を CSS のマスクとして使うので、**アルファだけが意味を持つ**。
# 色は var(--fx) が塗る。
import glob, os, re, sys
from PIL import Image

SRC = '_scratch/fx'
OUT = 'assets/ui/fx-cut.webp'

def main():
    files = sorted(f for f in glob.glob(os.path.join(SRC, 'cut_*.png'))
                   if re.search(r'cut_\d\d\.png$', f))
    if not files:
        print('コマが見つかりません:', SRC); return 1
    ims = [Image.open(f).convert('RGBA') for f in files]
    w, h = ims[0].size
    if any(im.size != (w, h) for im in ims):
        print('コマの大きさが揃っていません'); return 1

    sheet = Image.new('RGBA', (w * len(ims), h), (0, 0, 0, 0))
    for i, im in enumerate(ims):
        sheet.paste(im, (i * w, 0))
    sheet.save(OUT, 'WEBP', quality=90, method=6)

    print('%d コマ / %dx%d → %s (%d bytes)'
          % (len(ims), sheet.width, sheet.height, OUT, os.path.getsize(OUT)))
    print('CSS 側の指定: %dpx %dpx / steps(%d)' % (sheet.width, h, len(ims)))
    # 空のコマがあると「途中で消える」ので知らせる
    empty = [i for i, im in enumerate(ims) if im.split()[3].getextrema()[1] < 8]
    if empty:
        print('★ ほぼ空のコマ:', empty)
    return 0

if __name__ == '__main__':
    sys.exit(main())
