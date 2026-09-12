# タイルの連番 PNG を「2x2 の4通り」1枚にまとめて WebP へ。
#
# 同じ種類のマスが並ぶと機械的に見えるので、マスの位置から4通りのどれかを選ぶ。
# CSS 側は background-size: 200% 200% と background-position で1枚を選ぶ。
import glob, os, sys
from PIL import Image

SRC = '_scratch/tiles'
DST = 'assets/map'
KINDS = ('floor', 'grass', 'road', 'wall', 'water', 'stair')

def pack(kind):
    files = [os.path.join(SRC, '%s_%d.png' % (kind, v)) for v in range(4)]
    miss = [f for f in files if not os.path.exists(f)]
    if miss:
        print('%s: コマが足りません %s' % (kind, [os.path.basename(f) for f in miss]))
        return False
    ims = [Image.open(f).convert('RGBA') for f in files]
    w, h = ims[0].size
    sheet = Image.new('RGBA', (w * 2, h * 2), (0, 0, 0, 0))
    # 並びは左上→右上→左下→右下。CSS の --v と揃えること
    for i, im in enumerate(ims):
        sheet.paste(im, ((i % 2) * w, (i // 2) * h))
    os.makedirs(DST, exist_ok=True)
    out = os.path.join(DST, 'tile-%s.webp' % kind)
    sheet.save(out, 'WEBP', quality=88, method=6)
    print('%-6s %dx%d -> %s (%s bytes)' % (kind, sheet.width, sheet.height, out,
                                           format(os.path.getsize(out), ',')))
    return True

def main():
    kinds = sys.argv[1:] or list(KINDS)
    ok = all(pack(k) for k in kinds)
    total = sum(os.path.getsize(os.path.join(DST, 'tile-%s.webp' % k))
                for k in kinds if os.path.exists(os.path.join(DST, 'tile-%s.webp' % k)))
    print('合計 %s bytes' % format(total, ','))
    return 0 if ok else 1

if __name__ == '__main__':
    sys.exit(main())
