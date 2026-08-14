# -*- coding: utf-8 -*-
"""content/ に置いた拡張ファイルを、各HTMLの読み込みリストへ反映する (§18)。

── なぜ要るのか ──
拡張を足すたびに index.html と3つのテストページへ script タグを手で書き足すと、
書き忘れが必ず起きる。しかも症状は「拡張が反映されない」ではなく
**「本編では動くのにテストだけ落ちる」** のような、原因の見えにくい形で出る。

このツールは content/*.js を並べ直して、4つのHTMLの決まった区間を書き換える。
書き換えるのは印で挟んだ区間だけで、他の行には触らない。

使い方:
    python tools/sync_content.py            # 差分を見るだけ
    python tools/sync_content.py --apply    # 実際に書き換える

読み込む順番:
    ファイル名の昇順。拡張どうしの参照は seal() の時点で解決するので、
    順番に依存しない。並びを固定するのは差分を読みやすくするためだけ。
"""

import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, 'content')

#: 書き換える対象と、そこから見た相対パスの頭
PAGES = [
    ('index.html', ''),
    (os.path.join('test', 'index.html'), '../'),
    (os.path.join('test', 'balance.html'), '../'),
    (os.path.join('test', 'builds.html'), '../'),
]

BEGIN = '<!-- 拡張コンテンツ (§18) — tools/sync_content.py が書き換える。手で編集しない -->'
END = '<!-- /拡張コンテンツ -->'

# 締めの1行は別の場所へ入れる。理由は下の build_seal を参照。
SEAL_BEGIN = '<!-- 拡張コンテンツの締め (§18) — tools/sync_content.py が書き換える -->'
SEAL_END = '<!-- /拡張コンテンツの締め -->'


def read(path):
    with io.open(path, encoding='utf-8') as f:
        return f.read()


def write(path, text):
    with io.open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)


def content_files():
    """content/*.js を名前順に返す。`_` で始まるものは下書き扱いで読み込まない。"""
    if not os.path.isdir(CONTENT):
        return []
    names = [n for n in os.listdir(CONTENT)
             if n.endswith('.js') and not n.startswith('_')]
    return sorted(names)


def build_block(prefix, names):
    """拡張の読み込みを組み立てる。データカタログの直後に入る。

      content.js     … add() の受け口。拡張より前に無いと呼べない
      拡張ファイル群 … 名前順
    """
    lines = [BEGIN, '<script src="%ssrc/core/content.js"></script>' % prefix]
    for n in names:
        lines.append('<script src="%scontent/%s"></script>' % (prefix, n))
    lines.append(END)
    return '\n'.join(lines)


def build_seal(prefix):
    """締めを組み立てる。データを使うコアの **後ろ** に入る。

    ── なぜ拡張本体と離すのか ──
    締めの処理は、取り込む前に中身を検査する。その検査が
    RPG.units（ユニーク装備の効果キー一覧）と RPG.tree（効果種別の一覧）を見る。
    拡張の直後に置くと、それらがまだ読み込まれておらず、
    **検査が丸ごと素通りする**。しかも素通りしたことは表に出ない。

    データを使うコアは読み込み時に RPG.data を触らない（確認済み）ので、
    後ろへ回しても遅すぎることはない。
    """
    return '\n'.join([
        SEAL_BEGIN,
        '<script src="%ssrc/core/content-seal.js"></script>' % prefix,
        SEAL_END,
    ])


def locate_anchor(text):
    """既に区間があればその範囲、無ければ差し込み位置を返す。

    差し込み位置は「データカタログの最後の行の直後」。
    拡張はコアのデータを参照するので、それより前だと参照先がまだ無い。
    """
    b = text.find(BEGIN)
    if b >= 0:
        e = text.find(END, b)
        if e >= 0:
            return ('replace', b, e + len(END))

    # data/*.js の最後の script タグを探す
    last = None
    for m in re.finditer(r'^<script src="(?:\.\./)?data/[^"]+\.js"></script>$', text, re.MULTILINE):
        last = m
    if not last:
        return (None, -1, -1)
    return ('insert', last.end(), last.end())


def locate_seal(text):
    """締めを入れる位置。既にあればその範囲を返す。

    入れ先は「データを使うコアのうち、いちばん後ろの読み込み行の直後」。
    units.js と tree.js より後であればよいので、その2つを含む塊の末尾を狙う。
    """
    b = text.find(SEAL_BEGIN)
    if b >= 0:
        e = text.find(SEAL_END, b)
        if e >= 0:
            return ('replace', b, e + len(SEAL_END))

    # 検査に必要な2つを含む、最後の core 読み込み行を探す
    need = ['src/core/units.js', 'src/core/tree.js']
    if not all(('"%s"' % n) in text or ('"../%s"' % n) in text for n in need):
        return (None, -1, -1)

    last = None
    for m in re.finditer(r'^<script src="(?:\.\./)?src/core/[^"]+\.js"></script>$', text, re.MULTILINE):
        last = m
    if not last:
        return (None, -1, -1)
    return ('insert', last.end(), last.end())


def sync(page, prefix, names, apply_changes):
    path = os.path.join(ROOT, page)
    if not os.path.exists(path):
        return '見つからない: %s' % page

    text = read(path)
    original = text

    mode, start, end = locate_anchor(text)
    if mode is None:
        return 'データカタログの読み込み行が見つからない: %s' % page
    block = build_block(prefix, names)
    text = (text[:start] + block + text[end:]) if mode == 'replace' \
        else (text[:start] + '\n\n' + block + text[end:])

    smode, sstart, send = locate_seal(text)
    if smode is None:
        return 'コアの読み込み行が見つからない: %s' % page
    seal = build_seal(prefix)
    text = (text[:sstart] + seal + text[send:]) if smode == 'replace' \
        else (text[:sstart] + '\n\n' + seal + text[send:])

    if text == original:
        return '変更なし: %s' % page
    if apply_changes:
        write(path, text)
        return '更新: %s（拡張 %d 件）' % (page, len(names))
    return '要更新: %s（拡張 %d 件）' % (page, len(names))


def main(argv):
    apply_changes = '--apply' in argv

    if not os.path.isdir(CONTENT):
        os.makedirs(CONTENT)
        print('content/ を作りました。ここに拡張ファイルを置いてください。')

    names = content_files()
    if names:
        print('拡張ファイル %d 件:' % len(names))
        for n in names:
            print('  ', n)
    else:
        print('拡張ファイルはありません（content/ が空）。')
        print('読み込みの枠だけ用意します。')

    print()
    changed = False
    for page, prefix in PAGES:
        line = sync(page, prefix, names, apply_changes)
        print(' ', line)
        if line.startswith('要更新') or line.startswith('更新'):
            changed = True

    print()
    if not apply_changes and changed:
        print('反映するには --apply を付けて実行してください。')
        return 1
    if apply_changes and changed:
        print('反映しました。事前キャッシュも作り直してください:')
        print('  python tools/build_precache.py')
        print('  python tools/bump_cache_version.py')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
