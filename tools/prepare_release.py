# -*- coding: utf-8 -*-
"""
公開前の準備をまとめて実行する。

画像を足したり差し替えたりしたあとは、決まった順番で5つの処理が要る。
1つでも飛ばすと、プロンプトが漏れたり、端末に古い絵が残ったりする。
順番にも意味があるので、手で並べずここから流す。

    python tools/prepare_release.py            # 確認のみ（何も書き換えない）
    python tools/prepare_release.py --apply    # 実際に処理する

順番と理由:
  1. 背景の透過        … 先にやる。Pillow で保存し直すとメタデータが消えるため
  2. 顔アイコンの計測  … 透過後のアルファを使うので、1 の後でないと精度が出ない
  3. メタデータ除去    … 1 で取りこぼした分の最終確認
  4. 事前キャッシュ更新… ファイルが増減したときのため
  5. 版数を上げる      … 忘れると利用者の端末に古い版が残り続ける
  6. 総点検            … 公開して困るものが残っていないか
"""
from __future__ import print_function, unicode_literals

import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable


def run(title, script, args=()):
    print('\n' + '=' * 60)
    print('  ' + title)
    print('=' * 60)
    code = subprocess.call([PY, os.path.join(HERE, script)] + list(args))
    if code != 0:
        print('  → 終了コード %d' % code)
    return code


def main(apply_changes):
    apply_arg = ['--apply'] if apply_changes else []

    steps = [
        ('1/6  背景の透過', 'cutout_background.py', apply_arg),
        ('2/6  顔アイコンの位置を計測', 'detect_faces.py',
         (['--write'] if apply_changes else ['--sheet'])),
        ('3/6  生成メタデータの除去', 'strip_png_metadata.py', apply_arg),
    ]
    for title, script, args in steps:
        run(title, script, args)

    if not apply_changes:
        print('\n' + '=' * 60)
        print('  確認のみで終了しました。')
        print('  実際に処理するには --apply を付けて実行してください。')
        print('  顔の切り抜きは face_sheet.png を目で見てから進めること。')
        print('=' * 60)
        return 0

    run('4/7  事前キャッシュ一覧の作り直し', 'build_precache.py')
    run('5/7  CACHE_VERSION を上げる', 'bump_cache_version.py')
    code = run('6/7  公開前の総点検', 'publish_check.py')

    print('\n' + '=' * 60)
    print('  7/7  動作の確認（ここは自動化できていません）')
    print('=' * 60)
    print("""
  ここまでのチェックは「情報が漏れていないか」「容量は妥当か」だけです。
  ★ ゲームが壊れていないかは見ていません。

  公開前に、開発サーバーを起動して必ず確認してください:

    1. http://localhost:8124/test/index.html   すべて合格か
    2. http://localhost:8124/index.html        起動して戦闘が回るか

  検証ページは Service Worker のキャッシュ対象から外してあるので、
  直した内容がそのまま反映されます。

  確認できたら、巻き戻し先の目印を付けておくと後で楽です:

    python tools/mark_good.py
""")
    if code != 0:
        print('  ★ 総点検で指摘があります。上の出力を確認してください。')
    print('=' * 60)
    return code


if __name__ == '__main__':
    sys.exit(main('--apply' in sys.argv))
