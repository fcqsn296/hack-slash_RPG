# -*- coding: utf-8 -*-
"""生成した背景を、画面に敷ける形へ整える。

── なぜ専用の道具にするのか ──
立ち絵とは要求が違う。立ち絵は透過して切り抜くが、背景は
**上に膜をかぶせて暗く落とす** ので、そのぶん圧縮を効かせられる。
毎回この判断を思い出すより、設定ごと道具にしておくほうが確実。

実測（832px幅・灰燼の果ての絵で比較）:
    品質88 → 141 KB / 元との平均差 1.82
    品質72 →  68 KB / 元との平均差 2.65   ← これを採用
    品質68 →  36 KB / 元との平均差 3.22（幅624）

膜は最大で 88% の暗転がかかるため、平均差 2.65 は目で追えない。
18画面ぶん置いても合計 1.2MB 程度に収まる。

使い方:
    python tools/make_backdrop.py <元画像> <置き先ID>

    置き先IDの付け方（assets/bg/ に置かれる）:
      フィールド … fl_ashfall      出撃・戦闘の背景になる
      画面       … screen-gacha    そのタブの背景になる

    python tools/make_backdrop.py --list    いま置かれている背景を一覧
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "bg")

# 立ち絵と同じ縦横比。表示側は cover で切るので、これより大きくしても効かない
WIDTH = 832
QUALITY = 72

# 明るさの上限。上位2%の画素の輝度がここを超えていたら、超えたぶんだけ全体を落とす。
#
# ── なぜ画像の側で揃えるのか ──
# 絵ごとに明るさがばらつくと、そのぶん CSS 側で膜を濃くするしかなくなる。
# 濃くすれば全部の絵が沈むので、明るい1枚のために全体が犠牲になる。
# 入口で揃えておけば、表示側は1つの設定で済む。
#
# 実測: 17枚のうち15枚が、この処理なしでは補助文字のコントラストが
# 3.0〜3.4:1 まで落ちていた（基準は 4.5:1）。
TARGET_TOP = 0.24

# 上位何%の画素で見るか。数点の光源まで抑えると絵が死ぬので、少し余裕を見る。
TOP_PERCENTILE = 98


def die(msg):
    print(msg)
    sys.exit(1)


def listing():
    if not os.path.isdir(OUT_DIR):
        print("assets/bg/ はまだありません。")
        return
    names = sorted(f for f in os.listdir(OUT_DIR) if f.lower().endswith(".webp"))
    if not names:
        print("背景はまだ1枚もありません。")
        return
    total = 0
    for n in names:
        size = os.path.getsize(os.path.join(OUT_DIR, n))
        total += size
        print("  %-28s %5d KB" % (n, size // 1024))
    print("  " + "-" * 36)
    print("  %-28s %5d KB" % ("合計 %d 枚" % len(names), total // 1024))


def luminance(px):
    return (0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2]) / 255.0


def normalize(im):
    """上位 TOP_PERCENTILE% の輝度を見て、明るすぎる絵を落とす倍率を求める。

    戻り値: (処理前の輝度, 処理後の輝度, 掛ける倍率)
    """
    small = im.resize((104, int(104 * im.height / im.width)))
    vals = sorted(luminance(p) for p in small.getdata())
    idx = min(len(vals) - 1, int(len(vals) * TOP_PERCENTILE / 100))
    top = vals[idx]
    if top <= TARGET_TOP:
        return top, top, 1.0
    factor = TARGET_TOP / top
    return top, TARGET_TOP, factor


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    if "--list" in sys.argv:
        listing()
        return
    if len(args) != 2:
        die(__doc__)

    src, key = args
    if not os.path.isfile(src):
        die("元画像が見つかりません: " + src)

    try:
        from PIL import Image
    except ImportError:
        die("Pillow が要ります:  python -m pip install pillow")

    im = Image.open(src).convert("RGB")
    h = int(round(WIDTH * im.height / im.width))
    im = im.resize((WIDTH, h), Image.LANCZOS)

    before, after, factor = normalize(im)
    if factor < 1.0:
        im = Image.eval(im, lambda v: int(round(v * factor)))

    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, key + ".webp")
    im.save(out, "WEBP", quality=QUALITY)

    print("置きました: assets/bg/%s.webp  (%d×%d / %d KB)"
          % (key, WIDTH, h, os.path.getsize(out) // 1024))
    if factor < 1.0:
        print("  明るさを %.2f 倍に落としました（上位%d%%の輝度 %.3f → %.3f）"
              % (factor, TOP_PERCENTILE, before, after))
    else:
        print("  明るさはそのまま（上位%d%%の輝度 %.3f）" % (TOP_PERCENTILE, before))
    print("データの編集は要りません。画面を開き直せば反映されます。")


if __name__ == "__main__":
    main()
