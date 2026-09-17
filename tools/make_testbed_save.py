# -*- coding: utf-8 -*-
"""
検証用のセーブ（全員 Lv255・レベル調整つき）を作る。

── 何のためにあるか ──
難度を測る土台。**1つのセーブで全レベル帯を試せる**ようにしてある。
`peak` を 255 にしてあるので、`RPG.state.setLevel` で好きなレベルまで
無料で下げて戻せる（§6.7）。Lv150 の関門を測りたければ下げればよい。

── なぜこれが要ったか ──
難度を決めるとき、手元にあったのは2つの極端な点だけだった。

  実プレイのセーブ … 作者が効率よく組んでいるので自明に抜けてしまう
  テストの雛形     … 実プレイの15%しか火力が無く、何も抜けられない

この2点の間が測れず、**Lv255でも勝率10%しかない関門**を作りかけた。
`docs/強いビルドの組み方.md` §7.0 の処方で組めば実データの83%まで届くので、
それを全員に配ったものを土台として持つ。

── 中身 ──
  ・66人すべて Lv255 / peak 255（レベル調整が開いている）
  ・ツリーは全員 §7.0 の処方（248SP）
  ・クラスは6種を順に配る（全クラスを覛うため）
  ・装備は在庫から自動装備で重複なく配る（66人×6枠＝396個）
  ・限界突破は**元のまま**。盛ると「0凸の実データ」と比べられなくなる

使い方:
    python tools/make_testbed_save.py <元セーブ.json> <出力.json>

ツリーと装備の割り当てはゲーム側のロジック（`investPlan` / `autoequip`）が
決めるので、**ブラウザで計算した結果をこの中の表として持っている**。
処方を変えたら、その表も作り直すこと（手順は docs/測定エージェントの手順.md）。
"""
from __future__ import print_function, unicode_literals

import io
import json
import os
import sys

# ── §7.0 の処方で Lv255 まで振った結果（全員同一・248SP）──
# test/builds.js の REFERENCE.plan を investPlan に通して得たもの。
TREE = {
    "tr_all_tag": 3, "tr_atk": 5, "tr_atk_to_def": 4, "tr_atk_to_def_mid": 4,
    "tr_cap": 12, "tr_crit": 5, "tr_crit_dmg": 5, "tr_def": 5,
    "tr_def_fortress": 5, "tr_def_to_atk": 4, "tr_def_to_atk_hi": 3,
    "tr_def_to_atk_mid": 4, "tr_def_wall": 5, "tr_double": 1, "tr_guard": 5,
    "tr_high_cap": 5, "tr_hp": 5, "tr_lifesteal": 5, "tr_magi1": 4,
    "tr_magi2": 5, "tr_phys1": 4, "tr_phys2": 5, "tr_regen": 5,
    "tr_reli1": 4, "tr_reli2": 5,
}

#: 「キャラID|クラス|武器|防具|装飾」。uid は '.' 区切り。
#: autoequip.optimize に在庫を渡して得た割り当てで、**uid の重複は無い**。
ASSIGN_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                           'testbed_assign.txt')


def main(src, dst):
    with io.open(src, encoding='utf-8') as f:
        raw = json.load(f)
    game = raw.get('game', raw)

    with io.open(ASSIGN_PATH, encoding='utf-8') as f:
        rows = [ln.strip() for ln in f if ln.strip() and not ln.startswith('#')]

    def uids(text):
        return [int(x) for x in text.split('.') if x]

    seen = set()
    touched = 0
    for row in rows:
        cid, klass, w, a, acc = row.split('|')
        c = game['characters'].get(cid)
        if c is None:
            print('  居ないキャラを飛ばした:', cid)
            continue
        c['level'] = 255
        c['exp'] = 0
        # peak を 255 にすることが要点。ここが低いと setLevel で戻れない (§6.7)
        c['peak'] = 255
        c['tree'] = dict(TREE)
        c['klass'] = klass
        c['klassTree'] = {}
        c['arcana'] = c.get('arcana', None)
        c['equipped'] = {'weapon': uids(w), 'armor': uids(a), 'accessory': uids(acc)}
        for slot in c['equipped']:
            for u in c['equipped'][slot]:
                if u in seen:
                    raise SystemExit('装備 uid が重複している: %d（%s）' % (u, cid))
                seen.add(u)
        touched += 1

    # 在庫に無い uid を装備していないか。**ここを見ないと画面で装備が消える。**
    have = set(it['uid'] for it in game.get('inventory', []))
    missing = [u for u in seen if u not in have]
    if missing:
        raise SystemExit('在庫に無い装備を割り当てている: %s' % missing[:8])

    # 検証の土台なので、詰まって進めない状態にはしない
    game['gold'] = max(game.get('gold', 0), 5000000)

    out = {'format': raw.get('format', 'hakusura-rpg-save'),
           'fileVersion': raw.get('fileVersion', 1),
           'exportedAt': raw.get('exportedAt'),
           'game': game} if 'game' in raw else game

    with io.open(dst, 'w', encoding='utf-8') as f:
        f.write(json.dumps(out, ensure_ascii=False))
    print('%s を書き出した' % dst)
    print('  Lv255 にしたキャラ %d 人 / 使った装備 %d 個 / 在庫 %d 個'
          % (touched, len(seen), len(have)))
    return 0


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    sys.exit(main(sys.argv[1], sys.argv[2]))
