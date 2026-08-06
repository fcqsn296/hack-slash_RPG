# -*- coding: utf-8 -*-
"""
公開中の版を、動作を確認した時点へ巻き戻す (§16)。

    python tools/rollback.py                    # 戻せる先を一覧する
    python tools/rollback.py good-20260806-2312 # そこへ戻す（確認あり）

── なぜ git revert を使うのか ──
`git reset` で履歴を消して force push する方法もあるが、
**壊れた版が履歴から消えると「何が起きたか」も消える**。
revert なら「戻した」という事実が1つのコミットとして残り、
原因を後から追える。公開物を戻すのが目的なので、履歴は残す。

── CACHE_VERSION の扱い ──
巻き戻すと sw.js も古い版に戻り、CACHE_VERSION の番号が下がる。
すると利用者の端末に残っている新しい番号のキャッシュが消えず、
壊れた版がそのまま表示され続ける。
そこで巻き戻した **あとに必ず番号を進め直す**。ここまでこの中でやる。
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

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def git(*args):
    return subprocess.run(['git'] + list(args), cwd=ROOT,
                          capture_output=True, text=True, encoding='utf-8')


def show_targets():
    r = git('tag', '-l', 'good-*', '--sort=-creatordate')
    tags = [t for t in r.stdout.split('\n') if t.strip()]
    print('動作を確認した版（新しい順）:')
    if tags:
        for t in tags[:15]:
            info = git('log', '-1', '--format=%h %s', t)
            print('  %-22s %s' % (t, info.stdout.strip()[:70]))
    else:
        print('  （印がありません。python tools/mark_good.py で付けられます）')

    print('\n最近のコミット:')
    for line in git('log', '--oneline', '-8').stdout.strip().split('\n'):
        print('  ' + line)
    print('\n使い方:  python tools/rollback.py <印またはコミット>')


def main(argv):
    args = [a for a in argv[1:] if not a.startswith('--')]
    if not args:
        show_targets()
        return 0

    target = args[0]

    if git('status', '--porcelain').stdout.strip():
        print('★ コミットされていない変更があります。先に整理してください。')
        return 1

    check = git('rev-parse', '--verify', target + '^{commit}')
    if check.returncode != 0:
        print('そんな版はありません:', target)
        return 1
    sha = check.stdout.strip()[:8]

    head = git('log', '-1', '--format=%h %s').stdout.strip()
    dest = git('log', '-1', '--format=%h %s', target).stdout.strip()
    diff = git('diff', '--stat', target, 'HEAD').stdout.strip().split('\n')

    print('現在  : %s' % head)
    print('戻す先: %s (%s)' % (dest, target))
    print('\n打ち消される変更:')
    for line in diff[-6:]:
        if line.strip():
            print('  ' + line)

    ans = input('\nこの内容で巻き戻しますか？ [y/N]: ').strip().lower()
    if ans != 'y':
        print('やめました。')
        return 0

    # HEAD から target までを打ち消す1つのコミットを作る。履歴は消さない。
    r = git('revert', '--no-commit', '%s..HEAD' % sha)
    if r.returncode != 0:
        print('巻き戻せませんでした:', r.stderr.strip()[:200])
        git('revert', '--abort')
        return 1

    # 番号を下げたままにすると、端末に残った新しいキャッシュが消えない
    print('\nCACHE_VERSION を進め直します…')
    subprocess.call([sys.executable, os.path.join(ROOT, 'tools', 'bump_cache_version.py')])
    git('add', 'sw.js')

    msg = '%s の状態へ巻き戻す\n\n公開中の版に問題があったため戻した。\n履歴は残してあるので、原因は %s..%s を見れば追える。\n' % (
        target, sha, head.split()[0])
    c = git('commit', '-m', msg)
    if c.returncode != 0:
        print('コミットできませんでした:', c.stderr.strip()[:200])
        return 1

    print('\n巻き戻しました。次で公開に反映されます:')
    print('  git push')
    print('\n※ デプロイは7〜10分かかります。完了前に次の push をしないこと。')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
