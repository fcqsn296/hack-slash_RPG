# -*- coding: utf-8 -*-
"""
立ち絵の背景を透過させる。

塗りつぶしの処理そのものは imagekit/cutout.py にある（他のプロジェクトでも使うため）。
ここに残っているのは **このリポジトリ固有の事情** だけ:
どのフォルダが対象か、元の画像をどこへ控えるか、
そのあとメタデータを回収し直すこと。

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

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import locate                                      # noqa: E402

try:
    locate.ensure()
except RuntimeError as e:
    print(e)
    sys.exit(1)

from imagekit import cutout as ck                  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGETS = [os.path.join('assets', 'characters'), os.path.join('assets', 'enemies')]
BACKUP_DIR = os.path.join(ROOT, 'assets_backup_cutout')


def main(apply_changes, deep_names):
    try:
        ck.require_pillow()
    except RuntimeError as e:
        print(e)
        return 1

    files = []
    for d in TARGETS:
        full = os.path.join(ROOT, d)
        if os.path.isdir(full):
            for n in sorted(os.listdir(full)):
                if n.lower().endswith('.png'):
                    files.append((d.replace(os.sep, '/') + '/' + n,
                                  os.path.join(full, n)))

    todo, skipped, warn = [], 0, []
    for rel, path in files:
        deep = os.path.basename(rel) in deep_names
        im, ratio, steps = ck.cutout(path, deep=deep)
        if im is None:
            skipped += 1
            continue
        todo.append((rel, path, im, ratio, steps))
        if ratio < ck.SUSPICIOUS_LOW:
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

    # imagekit 側は書き込まない（原本を勝手に潰さないため）。保存はここで決める。
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
