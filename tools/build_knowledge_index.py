# -*- coding: utf-8 -*-
"""
知見の索引を作り直す。

── なぜ要るか ──
知見と失敗の記録が**分散している**。コードのコメント（8,700行）、作業ログ（60件）、
docs 直下の文書（10件）に散っていて、探し方を知らないと見つからない。
結果として **同じ失敗を踏み、同じ測定をやり直す** ことが繰り返し起きた。実例:

  ・上限減衰で威力%が薄まる件は docs/作業ログ/大技の上限突破.md に既にあったが、
    一から測り直した
  ・「敵の全能力×10は失敗だった」は data/quests.js の q_endless_vigil の
    コメントに書いてあったが、同じ検討をやり直した
  ・passives と situational の取り違えは CLAUDE.md §2 が警告しているが、踏んだ

── なぜ「統合」ではなく「索引」なのか ──
コメントは**説明する対象のすぐ隣にある**ことに価値がある。1つの文書へ集めると、
コードを読んでいる人の目に入らなくなる。だから中身は動かさず、在り処だけを集める。

── なぜ手書きの索引にしないのか ──
**手で維持する一覧は必ずずれる。** このリポジトリは同じ失敗を3回している——
effectkinds.js の手書き配列、publish_check.py のフォルダ一覧、units.js の KEYS 配列。
どれも「一覧にあるのに効かない」「一覧に無いのに公開される」という形で壊れた。

そこで、知見を書いた場所に **@知見** の印を1行付け、索引はここで生成する。
印は書いている本人がその場で付けるので漏れにくく、索引は常に実体と一致する。

    // @知見: 終盤では cap_break が唯一の実効ある火力（威力%は上限で1/5に薄まる）

使い方:
    python tools/build_knowledge_index.py           作り直す
    python tools/build_knowledge_index.py --check    ずれていないか見るだけ
"""
from __future__ import print_function, unicode_literals

import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'docs', '知見の索引.md')
LOG_DIR = os.path.join(ROOT, 'docs', '作業ログ')

#: 印を探す場所。ここを増やすときは、公開対象かどうかも併せて確かめること。
SCAN_DIRS = [
    os.path.join('src', 'core'), os.path.join('src', 'ui'), os.path.join('src', 'plugins'),
    'data', 'test', 'tools',
]

#: 手書きの部分。生成で上書きしないよう、この印のあいだを保存して書き戻す。
HAND_BEGIN = '<!-- 手書きここから（生成で上書きしません） -->'
HAND_END = '<!-- 手書きここまで -->'

DEFAULT_HAND = """### 上限とダメージ

- **威力%を足しても終盤は効かない** → `data/arcana.js`（力の項）、`docs/作業ログ/大技の上限突破.md`
- **上限を無視できるのは破壊者の「終焉の一撃」だけ** → `src/core/damage.js` の `applyCap` 付近
- **ツリー技「黄昏」は上限減衰を受ける**（旧名「終焉」。紛らわしくて改名した） → `data/skills.js` の `sk_tree_ragnarok`

### 効果を足すとき

- **5ファイル7箇所。1つ漏らすと静かに無効になる** → `CLAUDE.md` §2
- **passives / situational / 素の値 の取り違えは警告が出ない** → `data/effectkinds.js` の冒頭
- **damage.js へ届けるには toAttacker / toDefender にも書く** → `src/core/units.js`

### 測るとき

- **勝率は終盤で天井に張り付く。手数で見る** → `test/builds.js` の `compare`
- **テスト用の雛形ビルドは実プレイの6.7分の1の火力** → `data/arcana.js` の冒頭
- **damage.calc を直接呼ぶと battle.js の上乗せが抜ける** → 累撃・大技の底上げ・持ち越しなど
- **敵を厚くするならHPだけ。全能力×10は一撃死の二択になる** → `data/quests.js` の `q_endless_vigil`

### 戦闘の長さ

- **推奨レベルの戦闘は1.0〜3.5ラウンドで終わる。** ラウンドを跨ぐ代償は周回では無料になる
  → `data/arcana.js` の冒頭
- **1ラウンド目を別に書かないと、1周で終わる戦闘では一度も起きない**
  → `src/core/battle.js` の `roundStartBuffs` 付近（号令と手番の負債で2回踏んだ）

### 触ると壊れるもの

- **テストページを実行中に再読み込みしない**（セーブの控えがページ変数にある） → `CLAUDE.md` §6
- **闘技場のハードは「攻略不能に見えてよい」場所** → `data/arena.js`
- **オートは弱点コンボを見ない**（手動の報酬として意図的） → `src/core/battle.js` §10.6
"""


def scan_marks():
    """@知見 の印を集める。返り値は (相対パス, 行番号, 本文) の列。"""
    out = []
    for d in SCAN_DIRS:
        full = os.path.join(ROOT, d)
        if not os.path.isdir(full):
            continue
        for name in sorted(os.listdir(full)):
            if not name.endswith(('.js', '.py', '.html')):
                continue
            path = os.path.join(full, name)
            # **自分自身は数えない。** この道具の説明文と生成コードに
            # 印の見本が書いてあるので、素通しにすると見本が3件混ざる（実際混ざった）。
            if os.path.abspath(path) == os.path.abspath(__file__):
                continue
            try:
                lines = io.open(path, encoding='utf-8').read().split('\n')
            except Exception:
                continue
            for i, line in enumerate(lines, 1):
                m = re.search(r'@知見[:：]\s*(.+?)\s*$', line)
                if m:
                    rel = os.path.relpath(path, ROOT).replace(os.sep, '/')
                    out.append((rel, i, m.group(1).strip()))
    return out


def scan_logs():
    """作業ログの表題・日付・きっかけの1行目を集める。"""
    out = []
    if not os.path.isdir(LOG_DIR):
        return out
    for name in sorted(os.listdir(LOG_DIR)):
        if not name.endswith('.md'):
            continue
        text = io.open(os.path.join(LOG_DIR, name), encoding='utf-8').read()
        title = (re.search(r'^#\s+(.+?)\s*$', text, re.M) or [None, name[:-3]])[1]
        date = ''
        md = re.search(r'\*\*(?:日付|開始)\*\*[:：]\s*([\d\-/]+)', text)
        if md:
            date = md.group(1)
        # 「きっかけ」「何を変えるか」直後の最初の中身のある行
        lead = ''
        ms = re.search(r'^##\s+(?:きっかけ|何を変えるか|なぜ).*?\n+(.+?)\s*$', text, re.M | re.S)
        if ms:
            for ln in ms.group(1).split('\n'):
                ln = ln.strip()
                if ln and not ln.startswith(('#', '|', '```')):
                    lead = ln
                    break
        out.append((name, title, date, lead))
    return out


def render():
    marks = scan_marks()
    logs = scan_logs()

    hand = DEFAULT_HAND
    if os.path.exists(OUT):
        old = io.open(OUT, encoding='utf-8').read()
        m = re.search(re.escape(HAND_BEGIN) + r'\n(.*?)' + re.escape(HAND_END), old, re.S)
        if m:
            hand = m.group(1)

    L = []
    L.append('# 知見の索引')
    L.append('')
    L.append('**この文書は `python tools/build_knowledge_index.py` が作り直します。**')
    L.append('手書きの節だけは保存されるので、そこは直接編集してよい。')
    L.append('')
    L.append('知見と失敗の記録は**あちこちに散っている**。コメントは説明する対象の隣に')
    L.append('あるべきなので、中身は動かさない。ここに集めるのは**在り処だけ**。')
    L.append('')
    L.append('新しく知見を書いたら、その場所に印を1行足すこと。索引は生成されるので、')
    L.append('この文書を手で直す必要はない。')
    L.append('')
    L.append('```js')
    L.append('// @知見: 終盤では cap_break が唯一の実効ある火力（威力%は上限で1/5に薄まる）')
    L.append('```')
    L.append('')
    L.append('---')
    L.append('')
    L.append('## こういう問いには、ここを読む')
    L.append('')
    L.append(HAND_BEGIN)
    L.append(hand.rstrip('\n'))
    L.append(HAND_END)
    L.append('')
    L.append('---')
    L.append('')
    L.append('## 印の付いた知見（%d 件）' % len(marks))
    L.append('')
    if marks:
        L.append('| 知見 | 在り処 |')
        L.append('|---|---|')
        for rel, line, text in marks:
            L.append('| %s | `%s:%d` |' % (text.replace('|', '\\|'), rel, line))
    else:
        L.append('まだ1つも付いていない。知見を書いたら `// @知見:` を足すこと。')
    L.append('')
    L.append('---')
    L.append('')
    L.append('## 作業ログ（%d 件）' % len(logs))
    L.append('')
    L.append('**何を測ったか・何が駄目だったかは、ほぼここに書いてある。**')
    L.append('同じことを測り直す前に、まず表題を眺めること。')
    L.append('')
    L.append('| 日付 | 表題 | きっかけ |')
    L.append('|---|---|---|')
    for name, title, date, lead in sorted(logs, key=lambda x: (x[2] or '', x[1]), reverse=True):
        lead = (lead or '')[:64].replace('|', '\\|')
        L.append('| %s | [%s](作業ログ/%s) | %s |' % (date or '—', title, name, lead))
    L.append('')
    return '\n'.join(L) + '\n'


def main(check_only):
    text = render()
    old = io.open(OUT, encoding='utf-8').read() if os.path.exists(OUT) else ''
    marks = len(scan_marks())
    logs = len(scan_logs())
    if check_only:
        if old == text:
            print('知見の索引は最新です（印 %d 件 / 作業ログ %d 件）' % (marks, logs))
            return 0
        print('知見の索引が古くなっています。')
        print('  python tools/build_knowledge_index.py を実行してください。')
        return 1
    d = os.path.dirname(OUT)
    if d and not os.path.isdir(d):
        os.makedirs(d)
    io.open(OUT, 'w', encoding='utf-8').write(text)
    print('%s を書き直しました（印 %d 件 / 作業ログ %d 件）'
          % (os.path.relpath(OUT, ROOT), marks, logs))
    return 0


if __name__ == '__main__':
    sys.exit(main('--check' in sys.argv))
