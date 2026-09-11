# 連番 PNG を1枚のスプライトシート（WebP）にまとめる。
#
# 白で描いた絵を CSS のマスクとして使うので、**アルファだけが意味を持つ**。
# 色は var(--fx) が塗る。
#
#   python tools/fx/pack.py            3系統すべて
#   python tools/fx/pack.py phys       1系統だけ
import glob, os, re, sys
from PIL import Image

SRC = '_scratch/fx'
KINDS = ('phys', 'magi', 'reli')

def pack(kind):
    files = sorted(f for f in glob.glob(os.path.join(SRC, kind + '_*.png'))
                   if re.search(r'_\d\d\.png$', f))
    if not files:
        print('%s: コマが見つかりません（%s）' % (kind, SRC)); return False
    ims = [Image.open(f).convert('RGBA') for f in files]
    w, h = ims[0].size
    if any(im.size != (w, h) for im in ims):
        print('%s: コマの大きさが揃っていません' % kind); return False

    sheet = Image.new('RGBA', (w * len(ims), h), (0, 0, 0, 0))
    for i, im in enumerate(ims):
        sheet.paste(im, (i * w, 0))
    out = 'assets/ui/fx-%s.webp' % kind
    sheet.save(out, 'WEBP', quality=90, method=6)

    print('%-5s %2dコマ %dx%d -> %s (%s bytes)  CSS: %dpx %dpx / steps(%d)'
          % (kind, len(ims), sheet.width, sheet.height, out,
             format(os.path.getsize(out), ','), sheet.width, h, len(ims)))
    # 空のコマは「途中で消える」として現れるので知らせる
    empty = [i for i, im in enumerate(ims) if im.split()[3].getextrema()[1] < 8]
    if empty:
        print('      ほぼ空のコマ: %s（先頭と末尾なら意図どおり）' % empty)
    return True

def main():
    kinds = sys.argv[1:] or list(KINDS)
    ok = all(pack(k) for k in kinds)
    return 0 if ok else 1

if __name__ == '__main__':
    sys.exit(main())
