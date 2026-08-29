# -*- coding: utf-8 -*-
"""物語の文章だけを取り出して、書き直して、戻す。

    python tools/story_text.py --export    文章を1枚のテキストへ書き出す
    （テキストを好きなエディタで直す）
    python tools/story_text.py --import    直した文章をデータへ戻す
    python tools/story_text.py --check     戻す前に、何が変わるかだけ見る
    python tools/story_text.py --verify    往復して元に戻ることを確かめる

── なぜ往復にするのか ──
台詞を書くのはエディタのほうがやりやすい。かといって data/story.js を直接
開くと、`when` や `then` や旗の設定が同じ画面に混ざっていて、書くことに
集中できないうえ、構造を壊す事故が起きる。

**文章だけを抜いて、文章だけを戻す。** 構造には一切触れない。

── 章やマップを足したときに道具を直さなくてよい理由 ──
対象のファイルを固定の一覧で持たない。`RPG.data.story` か `RPG.data.maps`
を含む .js を毎回探し直す。中の章・場面・事象も、その場で数え直す。
だから**物語を足せば、そのぶんが自動で差し替えの対象になる**。
"""
import argparse
import glob
import io
import os
import re
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_OUT = os.path.join(ROOT, 'docs', '物語の文章.txt')

# 文字列リテラル。連結（'a' + 'b'）も1つとして拾う。
STR = r"'(?:[^'\\]|\\.)*'"
CONCAT = r"(?:" + STR + r"\s*\+\s*)*" + STR

# 1行に収める本文の長さ。元のファイルが連結で書かれているのは
# 1行が長くなりすぎないためなので、戻すときも同じ見た目を保つ。
WRAP = 58


def read(path):
    with io.open(path, encoding='utf-8') as f:
        return f.read()


def write(path, text):
    with io.open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(text)


def unquote(raw):
    """連結された文字列リテラルを1つの本文へ戻す。"""
    out = []
    for p in re.findall(STR, raw):
        out.append(p[1:-1].replace("\\'", "'").replace('\\\\', '\\'))
    return ''.join(out)


def quote(text, indent):
    """本文をJSの文字列リテラルへ。長ければ句点で折って連結にする。"""
    esc = text.replace('\\', '\\\\').replace("'", "\\'")
    if len(esc) <= WRAP:
        return "'" + esc + "'"
    chunks, cur = [], ''
    for piece in re.split('(?<=。)', esc):
        if not piece:
            continue
        if cur and len(cur) + len(piece) > WRAP:
            chunks.append(cur)
            cur = piece
        else:
            cur += piece
    if cur:
        chunks.append(cur)
    if len(chunks) == 1:
        return "'" + esc + "'"
    pad = ' ' * (indent + 2)
    return ('\n' + pad + '+ ').join("'" + c + "'" for c in chunks)


def source_files():
    """文章を持っているファイルを毎回探し直す。

    固定の一覧にすると、章やマップを足すたびに**道具の側も直す**ことになる。
    そこを忘れると「書き出したのに一部が出てこない」という形で静かに漏れる。
    """
    found = []
    for pat in ('data/*.js', 'content/*.js'):
        for path in sorted(glob.glob(os.path.join(ROOT, pat))):
            txt = read(path)
            if 'RPG.data.story' in txt or 'RPG.data.maps' in txt:
                found.append(path)
    return found


def scan(path):
    """そのファイルの中の差し替え対象を、出てくる順に拾う。

    返すのは { key, label, text, start, end } の並び。
    start/end は元のファイル上の位置。戻すときはそこだけを差し替える。
    """
    txt = read(path)
    marks = []

    for m in re.finditer(r"^  (mp_\w+): \{", txt, re.M):
        marks.append((m.start(), 'map', m.group(1), m))
    for m in re.finditer(r"id: '(\w+)'", txt):
        v = m.group(1)
        if re.match(r'^ch\d+$', v):
            marks.append((m.start(), 'chapter', v, m))
        elif v.startswith('ch'):
            marks.append((m.start(), 'scene', v, m))
    for m in re.finditer(r"\{ who: (?:null|'(\w+)'), text: (" + CONCAT + r")", txt):
        marks.append((m.start(), 'line', None, m))
    for m in re.finditer(r"^\s*name: (" + STR + r"),", txt, re.M):
        marks.append((m.start(), 'name', None, m))
    for m in re.finditer(r"^\s*lead: (" + STR + r"),", txt, re.M):
        marks.append((m.start(), 'lead', None, m))
    # マップの事象文。台詞（who を伴うもの）は上で拾っているので除く。
    for m in re.finditer(r"text: (" + CONCAT + r")", txt):
        head = txt[max(0, m.start() - 30):m.start()]
        if re.search(r"who: (?:null|'\w+'), $", head):
            continue
        marks.append((m.start(), 'event', None, m))

    marks.sort(key=lambda x: x[0])

    slots = []
    chapter = scene = mapid = None
    line_no = 0
    ev_no = 0
    for pos, kind, val, m in marks:
        if kind == 'chapter':
            chapter, scene, line_no = val, None, 0
        elif kind == 'scene':
            scene, line_no = val, 0
        elif kind == 'map':
            mapid, ev_no = val, 0
        elif kind == 'name':
            owner = mapid or chapter
            if owner:
                slots.append(dict(key=owner + '.name', label='名前',
                                  text=unquote(m.group(1)),
                                  start=m.start(1), end=m.end(1)))
        elif kind == 'lead':
            if chapter:
                slots.append(dict(key=chapter + '.lead', label='章の導入',
                                  text=unquote(m.group(1)),
                                  start=m.start(1), end=m.end(1)))
        elif kind == 'line':
            slots.append(dict(key='%s.%d' % (scene or '?', line_no),
                              label=m.group(1) or '地の文',
                              text=unquote(m.group(2)),
                              start=m.start(2), end=m.end(2)))
            line_no += 1
        elif kind == 'event':
            ev_no += 1
            slots.append(dict(key='%s.ev%d' % (mapid or '?', ev_no), label='場の説明',
                              text=unquote(m.group(1)),
                              start=m.start(1), end=m.end(1)))
    return txt, slots


def collect():
    return [(p,) + scan(p) for p in source_files()]


def export(out_path):
    data = collect()
    lines = [
        '# 物語の文章。ここを直して `python tools/story_text.py --import` で戻します。',
        '#',
        '# ・行頭の [鍵] は消さないでください。戻す場所の目印です。',
        '# ・# で始まる行と空行は読み飛ばします。話者は目印として出しているだけです。',
        '# ・**文章の差し替えだけ**を行います。行を足したり消したりはできません。',
        '#   場面や台詞そのものを増やすときは data/story.js を直に触ってください。',
        '# ・戻す前に --check で差分を見られます。',
        '',
    ]
    total = 0
    for path, _txt, slots in data:
        rel = os.path.relpath(path, ROOT).replace('\\', '/')
        lines += ['', '=' * 58, '== ' + rel, '=' * 58]
        last = None
        for s in slots:
            head = s['key'].split('.')[0]
            if head != last:
                lines += ['', '--- %s ---' % head]
                last = head
            lines.append('# %s' % s['label'])
            lines.append('[%s] %s' % (s['key'], s['text']))
            total += 1
    write(out_path, '\n'.join(lines) + '\n')
    print('書き出しました: %s' % os.path.relpath(out_path, ROOT).replace('\\', '/'))
    print('  対象 %d 件 / ファイル %d 個' % (total, len(data)))
    for path, _t, slots in data:
        print('    %-24s %3d 件' % (
            os.path.relpath(path, ROOT).replace('\\', '/'), len(slots)))
    return 0


def load_edits(in_path):
    edits = {}
    for raw in read(in_path).split('\n'):
        m = re.match(r'^\[([\w.]+)\] ?(.*)$', raw)
        if m:
            edits[m.group(1)] = m.group(2).rstrip('\r')
    return edits


def apply(in_path, dry):
    if not os.path.exists(in_path):
        print('見つかりません: %s' % os.path.relpath(in_path, ROOT))
        print('先に --export してください。')
        return 1
    edits = load_edits(in_path)
    data = collect()
    keys_now = [s['key'] for _p, _t, slots in data for s in slots]

    # 鍵が食い違ったら書かない。書き出し以降にデータ側が変わっていると、
    # 位置がずれて**別の台詞を上書きする**。黙って壊すより断るほうがよい。
    missing = [k for k in keys_now if k not in edits]
    extra = [k for k in edits if k not in keys_now]
    if missing or extra:
        print('鍵が食い違っています。書き出し以降にデータ側が変わった可能性があります。')
        if missing:
            print('  テキストに無い: %s%s' % (
                ', '.join(missing[:6]), ' …' if len(missing) > 6 else ''))
        if extra:
            print('  データに無い:   %s%s' % (
                ', '.join(extra[:6]), ' …' if len(extra) > 6 else ''))
        print('--export で取り直してから編集し直してください。')
        return 1

    changed = 0
    for path, txt, slots in data:
        hits = [s for s in slots if edits[s['key']] != s['text']]
        if not hits:
            continue
        rel = os.path.relpath(path, ROOT).replace('\\', '/')
        # 後ろから差し替える。前から書くと、次の位置がずれる。
        for s in sorted(hits, key=lambda x: -x['start']):
            # 折り返しの字下げは **その行の頭** に合わせる。
            # 文字列が始まる桁に合わせると `text: ` のぶんだけ深くなり、
            # 元のファイルと見た目が揃わない。
            head = txt.rfind('\n', 0, s['start']) + 1
            prefix = txt[head:s['start']]
            indent = len(prefix) - len(prefix.lstrip())
            txt = txt[:s['start']] + quote(edits[s['key']], indent) + txt[s['end']:]
            changed += 1
            print('  %s [%s]' % (rel, s['key']))
            print('    前: %s' % s['text'][:56])
            print('    後: %s' % edits[s['key']][:56])
        if not dry:
            write(path, txt)

    if changed == 0:
        print('変更はありません。')
    elif dry:
        print('')
        print('%d 件が変わります（--check なので書いていません）。' % changed)
    else:
        print('')
        print('%d 件を書き戻しました。' % changed)
        print('test/index.html を開いて全件合格を確かめてください。')
    return 0


def verify():
    """書き出して、何も直さずに戻したとき、1バイトも動かないこと。

    往復で形が変わる道具は、書いた本人以外は怖くて使えない。
    """
    before = {p: t for p, t, _s in collect()}
    fd, tmp = tempfile.mkstemp(suffix='.txt')
    os.close(fd)
    try:
        export(tmp)
        print('')
        rc = apply(tmp, dry=False)
        after = {p: read(p) for p in before}
        bad = [p for p in before if before[p] != after[p]]
        if rc or bad:
            for p in bad:
                write(p, before[p])
            print('')
            print('往復で中身が変わりました: %s' % ', '.join(
                os.path.relpath(p, ROOT) for p in bad))
            print('（元に戻しました）')
            return 1
        print('')
        print('往復しても1バイトも変わりません。')
        return 0
    finally:
        os.remove(tmp)


def main():
    ap = argparse.ArgumentParser(description='物語の文章を書き出して戻す')
    ap.add_argument('--export', action='store_true', help='文章をテキストへ書き出す')
    ap.add_argument('--import', dest='imp', action='store_true', help='テキストをデータへ戻す')
    ap.add_argument('--check', action='store_true', help='戻さずに差分だけ見る')
    ap.add_argument('--verify', action='store_true', help='往復して元に戻ることを確かめる')
    ap.add_argument('--file', default=DEFAULT_OUT, help='やり取りに使うテキスト')
    a = ap.parse_args()
    if a.verify:
        return verify()
    if a.export:
        return export(a.file)
    if a.imp or a.check:
        return apply(a.file, dry=a.check)
    ap.print_help()
    return 0


if __name__ == '__main__':
    sys.exit(main())
