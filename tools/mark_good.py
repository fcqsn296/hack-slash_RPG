# -*- coding: utf-8 -*-
"""
今の状態を「動作を確認した版」として印を付ける (§16)。

巻き戻したいとき、いちばん困るのは
**どこまで戻せば動くのかが分からない** ことなので、
確認できた時点に git のタグを打っておく。

    python tools/mark_good.py            # 印を付ける
    python tools/mark_good.py --list     # 付いている印を見る

タグは good-YYYYMMDD-HHMM の形で、push もする。
"""
from __future__ import print_function, unicode_literals

import sys as _sys
# Windows の既定コンソールは cp932 で、コミットメッセージに含まれる
# ダッシュや記号で落ちる。出力だけ UTF-8 に寄せておく。
try:
    _sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    _sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

import os
import subprocess
import sys
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def git(*args):
    return subprocess.run(['git'] + list(args), cwd=ROOT,
                          capture_output=True, text=True, encoding='utf-8')


def show_list():
    r = git('tag', '-l', 'good-*', '--sort=-creatordate')
    tags = [t for t in r.stdout.split('\n') if t.strip()]
    if not tags:
        print('まだ印はありません。')
        return 0
    print('動作を確認した版（新しい順）:')
    for t in tags[:15]:
        info = git('log', '-1', '--format=%h %s', t)
        print('  %-22s %s' % (t, info.stdout.strip()[:70]))
    print('\n戻すときは:')
    print('  python tools/rollback.py %s' % tags[0])
    return 0


def main(argv):
    if '--list' in argv:
        return show_list()

    dirty = git('status', '--porcelain').stdout.strip()
    if dirty:
        print('★ コミットされていない変更があります。先に commit してください。')
        for line in dirty.split('\n')[:8]:
            print('   ', line)
        return 1

    tag = 'good-' + datetime.now().strftime('%Y%m%d-%H%M')
    head = git('log', '-1', '--format=%h %s').stdout.strip()

    r = git('tag', '-a', tag, '-m', '動作を確認した版')
    if r.returncode != 0:
        print('タグを付けられませんでした:', r.stderr.strip())
        return 1

    print('印を付けました: %s' % tag)
    print('  → %s' % head)

    p = git('push', 'origin', tag)
    if p.returncode == 0:
        print('  GitHub にも送りました。')
    else:
        print('  ★ push できませんでした（手元には残っています）:', p.stderr.strip()[:120])
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
