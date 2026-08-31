# -*- coding: utf-8 -*-
"""実装の数を数える。世界設定文書の付録を書き直すときに使う。

── なぜこの道具が要るのか ──
付録は手で書いてあったため、実装が育つあいだ取り残された。
「フィールド8・仲間41人」と書いてあったが、実際は12・60人だった。
差が生まれた時点では誰も気付かず、別の作業でその数字を前提にして
初めて食い違いが出た。

数字を文章に書いたら実装と突き合わせる、というのは CLAUDE.md §8 の作法だが、
付録はその対象から漏れていた。**手で数え直せば同じことが起きる**ので、
数える側を道具にした。

    python tools/count_content.py

出力をそのまま docs/灰銀の継承者 世界設定素案2.md の付録へ貼る。
"""
import collections
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(name):
    return io.open(os.path.join(ROOT, 'data', name), encoding='utf-8').read()


def count(text, pattern):
    return len(re.findall(pattern, text))


def slice_array(text, marker):
    """`marker` から、対応する `]` までを切り出す。

    末尾まで取ると、後ろに並んでいる別の配列まで数えてしまう。
    実際、塔の階層帯が 7 のところを 11 と数えた。
    """
    start = text.find(marker)
    if start < 0:
        return ''
    depth = 0
    for i in range(start + len(marker) - 1, len(text)):
        if text[i] == '[':
            depth += 1
        elif text[i] == ']':
            depth -= 1
            if depth == 0:
                return text[start:i]
    return text[start:]


def main():
    ch = read('characters.js')
    chars = re.findall(r"\n  (ch_\w+): \{(.*?)\n  \},", ch, re.S)
    rarity = collections.Counter()
    for _id, body in chars:
        m = re.search(r"rarity: '(\w+)'", body)
        if m:
            rarity[m.group(1)] += 1

    en = read('enemies.js')
    enemies = re.findall(r"\n  ((?:em|bs)_\w+): \{(.*?)\n  \},", en, re.S)
    bosses = sum(1 for _i, b in enemies if 'boss: true' in b)
    elems = collections.Counter()
    for _id, body in enemies:
        m = re.search(r"element: '(\w+)'", body)
        if m:
            elems[m.group(1)] += 1
    JP = {'none': '無', 'dark': '闇', 'fire': '火', 'earth': '土',
          'light': '光', 'wind': '風', 'water': '水'}

    eq = read('equipment.js')
    bases = eq[eq.find('RPG.data.equipBases'):eq.find('RPG.data.affixes')]
    tower = read('tower.js')
    # 対応する `]` まで。ファイル末尾まで取ると、後ろにある宝物の
    # `{ from: ... }` まで数えて 7 が 11 になった。
    tiers = slice_array(tower, 'tiers: [')

    print('- 仲間 %d人（レアリティ LEGEND %d／SUPER_RARE %d／RARE %d／COMMON %d）'
          % (len(chars), rarity['LEGEND'], rarity['SUPER_RARE'],
             rarity['RARE'], rarity['COMMON']))
    print('- 敵 %d種（うちボス %d種）＋ 闘技場ボス %d体'
          % (len(enemies), bosses, count(read('arena.js'), r"id: 'ar_\w+'")))
    print('- 敵の属性分布 ' + '／'.join(
        '%s%d' % (JP.get(k, k), v) for k, v in elems.most_common()))
    print('- 技 %d、状態異常 %d種、クラス %d種、系統タグ 3、属性 7'
          % (count(read('skills.js'), r'\n  (sk_\w+): \{'),
             count(read('statuses.js'), r'\n  (\w+): \{'),
             count(read('classes.js'), r'\n  (cls_\w+): \{')))
    print('- スキルツリー %dノード、装備ベース %d、副オプション %d、'
          '装備セット %d、ユニーク %d'
          % (count(read('skilltree.js'), r"id: 'tr_\w+'"),
             count(bases, r'\n  (eq_\w+):'),
             count(eq, r"id: '(af_\w+)'"),
             count(read('equipsets.js'), r'\n  (\w+): \{'),
             count(read('uniques.js'), r'\n  (\w+): \{')))
    print('- フィールド %d、塔の階層帯 %d、依頼 %d、宝箱 %d段階'
          % (count(read('fields.js'), r'\n  (fl_\w+): \{'),
             count(tiers, r'\{ *from:'),
             count(read('quests.js'), r'\n  (q_\w+): \{'),
             count(eq, r'\n  (box_\w+): \{')))
    print('- 物語 %d章、地図 %d枚'
          % (count(read('story.js'), r"id: 'ch\d+',"),
             count(read('maps.js'), r'\n  (mp_\w+): \{')))
    print('- ガチャ 1回1,000G、天井200回、限界突破 最大5')
    print('- レベル上限 初期150 →（道具で）255')


def check():
    """付録が実装と食い違っていないか見る。ずれていたら終了コード1。

    貼り直しを忘れても気付けるようにするための口。
    公開前の点検（tools/publish_check.py）から呼んでいる。
    """
    doc = os.path.join(ROOT, 'docs', '灰銀の継承者 世界設定素案2.md')
    if not os.path.exists(doc):
        print('世界設定文書が見つかりません:', doc)
        return 1
    text = io.open(doc, encoding='utf-8').read()
    head = '## 付録：実装の数字'
    if head not in text:
        print('付録の見出しが見つかりません')
        return 1
    body = text[text.find(head):]

    import io as _io
    buf = _io.StringIO()
    sys_stdout = sys.stdout
    sys.stdout = buf
    try:
        main()
    finally:
        sys.stdout = sys_stdout

    missing = [ln for ln in buf.getvalue().strip().split('\n')
               if ln.strip() and ln.strip() not in body]
    if missing:
        print('付録が実装と食い違っています。以下の行が見当たりません:')
        for ln in missing:
            print('  ' + ln)
        print('\n  python tools/count_content.py の出力を付録へ貼り直してください。')
        return 1
    print('付録は実装と一致しています。')
    return 0


if __name__ == '__main__':
    if '--check' in sys.argv:
        raise SystemExit(check())
    main()
