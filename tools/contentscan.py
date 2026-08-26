# -*- coding: utf-8 -*-
"""data/ と content/ の両方から、キャラクターと敵の定義を拾う (§18)。

── なぜ共通にするのか ──
画像まわりのツールは3つあり（取り込み・生成・顔の検出）、どれも
「どのキャラがいて、どのファイルに書いてあるか」を知る必要がある。
それぞれが自前で走査していたので、拡張に対応させるには3か所を直すことになり、
**1か所直し忘れると「生成はできるのに取り込めない」** のような噛み合わない状態になる。

拾えるもの:
    scan_characters() → [{id, name, source, art_prompt}, …]
    scan_enemies()    → 同上
    source は定義が書いてあるファイルの絶対パス。
    顔の位置を書き戻すときに、拡張ファイルへ書き込むために使う。
"""

import io
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
CONTENT = os.path.join(ROOT, 'content')


def read(path):
    with io.open(path, encoding='utf-8') as f:
        return f.read()


def _content_files():
    """content/*.js のうち、実際に読み込まれるもの。`_` 始まりは下書き扱い。"""
    if not os.path.isdir(CONTENT):
        return []
    return [os.path.join(CONTENT, n) for n in sorted(os.listdir(CONTENT))
            if n.endswith('.js') and not n.startswith('_')]


def _entries_in_block(body, indent):
    """`  id: {` の並びから (id, name, 本文) を取り出す。

    入れ子の中の `name:` を拾わないよう、**行頭のインデントが指定と一致する**
    定義だけを見る。data/ は 2、content/ は add() の中なので 4。
    """
    pat = re.compile(r'^%s([A-Za-z_][A-Za-z0-9_]*):\s*\{' % (' ' * indent), re.MULTILINE)
    marks = list(pat.finditer(body))
    out = []
    for i, m in enumerate(marks):
        end = marks[i + 1].start() if i + 1 < len(marks) else len(body)
        chunk = body[m.start():end]
        nm = re.search(r"name:\s*'([^']*)'", chunk)
        out.append((m.group(1), nm.group(1) if nm else m.group(1), chunk))
    return out


def _core_block(text, assign_prefix):
    """`RPG.data.xxx = { … };` の中身を切り出す。"""
    if assign_prefix not in text:
        return ''
    body = text[text.index(assign_prefix):]
    end = re.search(r'^\};', body, re.MULTILINE)
    return body[:end.start()] if end else body


def _content_block(text, kind):
    """拡張ファイルから `kind: { … }` の中身を切り出す。

    `RPG.content.add('名前', { characters: { … } })` の形を想定している。
    入れ子の深さを数えて閉じ括弧を見つける。
    """
    m = re.search(r'^\s{2}%s:\s*\{' % re.escape(kind), text, re.MULTILINE)
    if not m:
        return ''
    depth = 0
    start = m.end() - 1
    for i in range(start, len(text)):
        if text[i] == '{':
            depth += 1
        elif text[i] == '}':
            depth -= 1
            if depth == 0:
                return text[start + 1:i]
    return ''


def _scan(core_file, core_assign, content_kinds):
    """コアと拡張の両方から定義を集める。"""
    found = []

    core_path = os.path.join(DATA, core_file)
    if os.path.exists(core_path):
        block = _core_block(read(core_path), core_assign)
        for cid, name, chunk in _entries_in_block(block, 2):
            found.append({'id': cid, 'name': name, 'source': core_path,
                          'chunk': chunk, 'pack': None})

    for path in _content_files():
        text = read(path)
        pack = re.search(r"RPG\.content\.add\(\s*'([^']*)'", text)
        pack_name = pack.group(1) if pack else os.path.basename(path)
        for kind in content_kinds:
            block = _content_block(text, kind)
            if not block:
                continue
            for cid, name, chunk in _entries_in_block(block, 4):
                found.append({'id': cid, 'name': name, 'source': path,
                              'chunk': chunk, 'pack': pack_name})

    return found


def scan_characters():
    return _scan('characters.js', 'RPG.data.characters', ['characters'])


def scan_enemies():
    """敵は content 側で enemies と bosses に分かれている。どちらも同じ扱い。"""
    return _scan('enemies.js', 'RPG.data.enemies', ['enemies', 'bosses'])


def art_prompt(entry):
    """定義の中に書かれた個別プロンプト。無ければ None。

    連結（'a' + 'b'）にも対応する。長い呪文を1行に押し込ませないため。
    """
    m = re.search(r"artPrompt:\s*((?:'[^']*'\s*\+?\s*)+)", entry['chunk'])
    if not m:
        return None
    joined = ''.join(re.findall(r"'([^']*)'", m.group(1)))
    return joined or None


def field_of(entry, key):
    """定義から単純な文字列項目を読む。element や hair を拾うのに使う。"""
    m = re.search(key + r":\s*'([^']*)'", entry['chunk'])
    return m.group(1) if m else None


def has_no_art(entry):
    """固有の絵を持たないと宣言されているか (§10.8)。

    終わりなき回廊の雑魚は出るたびに別の敵の姿を借りるので、自分の絵を持たない。
    生成の対象一覧から外さないと、作る必要のないものが毎回「未生成」に出続ける。
    """
    return 'noArt: true' in entry['chunk']


def is_boss(entry):
    return 'boss: true' in entry['chunk'] or entry['id'].startswith('bs_')


def summary():
    """人が読む用のひとこと。ツールの冒頭に出す。"""
    chars = scan_characters()
    foes = scan_enemies()
    ext_c = [c for c in chars if c['pack']]
    ext_e = [e for e in foes if e['pack']]
    line = 'キャラクター %d 体 / エネミー %d 体' % (len(chars), len(foes))
    if ext_c or ext_e:
        packs = sorted(set([c['pack'] for c in ext_c] + [e['pack'] for e in ext_e]))
        line += '（うち拡張 %d 体・%s）' % (len(ext_c) + len(ext_e), '、'.join(packs))
    return line


if __name__ == '__main__':
    print(summary())
    for e in scan_characters() + scan_enemies():
        where = e['pack'] or 'コア'
        print('  %-22s %-16s %s' % (e['id'], e['name'], where))
