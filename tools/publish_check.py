# -*- coding: utf-8 -*-
"""
公開前の最終確認。

.gitignore で除外されるものを飛ばしたうえで、
「公開されると困るものが残っていないか」をまとめて調べる。

    python tools/publish_check.py

チェックする内容:
  1. PNG に生成メタデータ（プロンプト・シード・署名）が残っていないか
  2. 立ち絵の背景が透過されているか
  3. 画風の参考にした商業作品名が本文に残っていないか
  4. APIキーらしき文字列・メールアドレス・利用者名・絶対パスが混ざっていないか
  5. 公開されるファイル数と容量
"""
from __future__ import print_function, unicode_literals

import io
import os
import re
import struct
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# git が使えないときの保険。ふだんは .gitignore を直接 git に聞く。
#
# ── なぜ git に聞くのか ──
# ここを手で並べていた頃、.gitignore に除外を足しても
# この一覧が古いままになり、食い違いが出た。
# 過剰報告で済むうちはよいが、**逆向きが危ない**。
# この一覧にあるが .gitignore に無いフォルダは、
# 実際には公開されるのに点検を素通りする。
# 公開対象を決めているのは git なので、git に聞くのが正しい。
SKIP_DIRS = {
    'raw_image', 'enemies_image', '__pycache__',
    'assets_backup_cutout', 'assets_png_master',
    '.git', '.claude', '.vscode', '.idea',
}
SKIP_FILES = {
    'artprompts.js', 'ASSIGNMENTS.md', 'image_metadata_backup.json',
}

TEXT_EXT = ('.js', '.html', '.css', '.md', '.py', '.json', '.webmanifest', '.bat')

# 画風の参考にした商業作品名。公開物には残さない。
BRANDS = re.compile(r'zenless|zone zero', re.I)

SECRET = re.compile(r'pst-[A-Za-z0-9_-]{12,}')
EMAIL = re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')
WINPATH = re.compile(r'[A-Za-z]:\\Users\\[^\s"\'\\]+')
USER = re.compile(r'fcqsn', re.I)

PNG_SIG = b'\x89PNG\r\n\x1a\n'


def git_files():
    """git が公開対象とみなすファイル。追跡済み＋未追跡（除外を除く）。

    これが「push したら公開されるもの」そのものなので、
    点検の対象もこれに合わせる。
    """
    import subprocess
    try:
        out = subprocess.run(
            ['git', 'ls-files', '--cached', '--others', '--exclude-standard'],
            cwd=ROOT, capture_output=True, text=True, encoding='utf-8', timeout=30)
    except (OSError, subprocess.SubprocessError):
        return None
    if out.returncode != 0:
        return None
    names = [n.strip() for n in out.stdout.splitlines() if n.strip()]
    return [os.path.join(ROOT, n.replace('/', os.sep)) for n in names] or None


def walk():
    tracked = git_files()
    if tracked is not None:
        for path in tracked:
            if os.path.basename(path) in SKIP_FILES:
                continue
            if os.path.isfile(path):
                yield path
        return

    # git が使えない場合の保険。フォルダ名の一覧で歩く。
    print('※ git に問い合わせられないため、フォルダ名の一覧で点検します')
    for root, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            if f in SKIP_FILES:
                continue
            yield os.path.join(root, f)


def png_flags(path):
    """(メタデータ有無, 背景が不透明か) を返す。"""
    has_meta = False
    with open(path, 'rb') as fh:
        if fh.read(8) != PNG_SIG:
            return False, False
        while True:
            h = fh.read(8)
            if len(h) < 8:
                break
            ln, typ = struct.unpack('>I4s', h)
            fh.read(ln)
            fh.read(4)
            if typ in (b'tEXt', b'iTXt', b'zTXt', b'eXIf'):
                has_meta = True
            if typ == b'IEND':
                break
    return has_meta, False


def main():
    meta, opaque, brand, secret, email, winpath, user = [], [], [], [], [], [], []
    total = 0
    count = 0

    try:
        from PIL import Image
        pil = True
    except ImportError:
        pil = False

    for p in walk():
        rel = os.path.relpath(p, ROOT).replace(os.sep, '/')
        count += 1
        try:
            total += os.path.getsize(p)
        except OSError:
            pass

        low = p.lower()
        if low.endswith(('.png', '.webp')):
            # メタデータ検査は PNG の構造を読むので PNG のときだけ
            if low.endswith('.png'):
                has_meta, _ = png_flags(p)
                if has_meta:
                    meta.append(rel)
            # 立ち絵だけ透過を見る（アイコンは不透明でよい）
            if pil and ('/characters/' in rel or '/enemies/' in rel):
                a = Image.open(p).convert('RGBA')
                w, h = a.size
                cs = [a.getpixel((2, 2)), a.getpixel((w - 3, 2)),
                      a.getpixel((2, h - 3)), a.getpixel((w - 3, h - 3))]
                if sum(c[3] for c in cs) / 4 > 24:
                    opaque.append(rel)
            continue

        if not low.endswith(TEXT_EXT):
            continue
        try:
            s = io.open(p, encoding='utf-8', errors='replace').read()
        except Exception:
            continue
        # .gitignore と このファイル自身は、説明のため名前を書いてあるので除外
        if rel in ('.gitignore', 'tools/publish_check.py'):
            continue
        if BRANDS.search(s):
            brand.append(rel)
        if SECRET.search(s):
            secret.append(rel)
        for m in EMAIL.findall(s):
            email.append('%s (%s)' % (rel, m))
        if WINPATH.search(s):
            winpath.append(rel)
        if USER.search(s):
            user.append(rel)

    def show(title, items, ok='なし'):
        mark = 'OK ' if not items else '★  '
        print('%s%s: %s' % (mark, title, ok if not items else '%d 件' % len(items)))
        for i in items[:8]:
            print('      ', i)
        if len(items) > 8:
            print('       …他 %d 件' % (len(items) - 8))

    print('公開対象 %d ファイル / 合計 %.1f MB\n' % (count, total / 1024.0 / 1024.0))
    show('PNGに残った生成メタデータ', meta)
    show('背景が透過されていない立ち絵', opaque)
    show('商業作品名の残存', brand)
    show('APIキーらしき文字列', secret)
    show('メールアドレス', email)
    show('Windows絶対パス', winpath)
    show('利用者名', user)

    # 世界設定文書の付録が実装から取り残されていないか。
    #
    # 一度「フィールド8・仲間41人」のまま放置され、実際は12・60人だった。
    # 別の作業でその数字を前提にして初めて食い違いが出たので、
    # 公開のたびに突き合わせる。
    stale = False
    try:
        import count_content
        stale = count_content.check() != 0
    except Exception as exc:
        print('付録の突き合わせを実行できませんでした:', exc)

    ng = (meta or opaque or brand or secret or email or winpath or user
          or stale)
    print('\n判定:', '要確認' if ng else 'すべて問題なし')
    return 1 if ng else 0


if __name__ == '__main__':
    sys.exit(main())
