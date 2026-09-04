// スキルツリーの分類 (§5.9)
//
// ── なぜ効果種別から引くのか ──
// ノード1つ1つに category を書くと、ノードを足すたびに書き忘れが起きる。
// ここでは **効果種別 → 分類** の対応だけを持ち、ノード側には何も書かせない。
// 新しいノードは、使っている効果種別から自動で正しい棚に入る。
//
// 新しい効果種別を足したときは、下の kinds にその名前を1つ加えるだけでよい。
// どこにも載っていない種別は「その他」に集まるので、取りこぼしても画面からは消えない。
//
// ── terms は何か ──
// ビルド画面の検索にかかる言葉。分類に属するノードは、名前や説明文に
// その語が無くても、ここに書いた語で引ける。
// 「クリティカル率」で会心の枝が丸ごと出てほしいのに、効果種別 crit /
// crit_damage には label が無く（route が unit なので登録簿に表示名を持たない）、
// ノードの説明文も「会心」としか書いていない、という取りこぼしを埋めるためのもの。
// 語は増やしてよい。増やしても既存の検索結果は狭まらない。
RPG.data.nodeCategories = [
  {
    id: 'stat', label: '基礎ステータス', icon: 'stat',
    terms: ['ステータス', 'HP', '体力', '攻撃力', '防御力', '魔力', 'ATK', 'DEF', 'atk', 'def', 'hp'],
    desc: 'HP・攻撃・防御・魔力そのものを伸ばす。どのビルドでも腐らない土台。',
    kinds: ['stat_pct'],
  },
  {
    id: 'tag', label: '系統タグ', icon: 'tag',
    terms: ['系統タグ', '物理', '魔術', '遺物', 'タグ'],
    desc: '[物理][魔術][遺物] の枠。異なるタグ同士は乗算されるので、散らすほど伸びが大きい。',
    kinds: ['tag_bonus', 'tag_all', 'tag_crit', 'tag_pierce'],
  },
  {
    id: 'element', label: '属性戦略', icon: 'element',
    terms: ['属性', '火', '水', '風', '土', '光', '闇', '無属性', '相性', '弱点'],
    desc: '属性相性との付き合い方。無視する・塗り替える・突き詰めるの3方向がある。',
    kinds: [
      'element_adapt', 'element_mastery', 'chaos', 'element_convert', 'element_pierce',
      'dual_element', 'element_power', 'element_resist', 'element_crit',
      'weak_hunter', 'neutral_power', 'weak_guard',
    ],
  },
  {
    id: 'crit', label: '会心', icon: 'crit',
    terms: ['会心', 'クリティカル', 'クリティカル率', 'クリティカルダメージ', '会心率', '会心倍率', 'crit'],
    desc: 'クリティカルを軸にする枝。率・倍率・会心したときの追加効果に分かれる。',
    kinds: [
      'crit', 'crit_damage', 'crit_stack', 'crit_spread', 'crit_execute',
      'crit_overflow',
      'crit_heal', 'crit_combo', 'crit_pierce', 'first_hit_crit',
    ],
  },
  {
    id: 'combo', label: '弱点コンボ', icon: 'combo',
    terms: ['コンボ', '弱点', '連携'],
    desc: 'コンボは手動戦闘でしか積めない。ここを厚くするほど、手で戦う見返りが大きくなる。',
    kinds: ['combo_gain', 'combo_keep', 'combo_power', 'combo_start', 'combo_spend_power'],
  },
  {
    id: 'status', label: '状態異常', icon: 'status',
    terms: ['状態異常', 'デバフ', '毒', '火傷', '凍結', '麻痺', '呪い', '出血', '継続ダメージ'],
    desc: '撒く・耐える・突く。6種の異常はそれぞれ効くタイミングが違う。',
    kinds: [
      'status_power', 'status_on_hit', 'status_on_hit_kind', 'status_immune',
      'status_resist_kind', 'vs_status_power', 'debuff_duration', 'debuff_resist',
      'debuff_spread',
      // 自分にかかった弱体を糧にする枝も、扱う対象は同じ「異常」なのでここ。
      // 耐性を積む枝とちょうど反対を向くので、並べて見えたほうが選びやすい。
      'self_curse_power',
      // 刻印は毒と同じ「遅れて入るダメージ」だが、時間ではなく回数で進む。
      'sigil_burst',
    ],
  },
  {
    id: 'defense', label: '生存・防御', icon: 'shield',
    terms: ['防御', '生存', '耐久', '軽減', '回復', 'ヒール', 'バリア', '反射', '棘', 'タンク', '狙われやすさ'],
    desc: '倒れないための枝。軽減・障壁・復活・肩代わりを組み合わせて無敵に近づける。',
    kinds: [
      'reduction', 'revive', 'last_stand', 'regen', 'wave_heal', 'thorns',
      'guard_ally', 'overheal_shield', 'start_shield', 'shield_regen',
      'low_hp_guard', 'damage_share', 'wave_revive', 'back_guard',
      'boss_guard', 'reflect', 'heal_power', 'ally_heal_lock', 'heal_on_kill', 'lifesteal',
      // 狙い (§5.9)。「受けない」ではなく「受けに行く」枝だが、
      // 反撃・棘・庇うと組ませて初めて意味が出るので、生存の側に並べる。
      'taunt', 'stealth',
      // 支援の枝 (§5.10)。専任のヒーラーがSPを使い切れるようにするための追加。
      'cleanse', 'triage', 'heal_spread', 'heal_buff', 'low_hp_heal',
      // 回復を攻めに向ける枝 (§5.11)。生存の枝から派生するので隣に置く。
      'smite', 'heal_to_power',
      // 回避は軽減と並べる。同じ「受けない」ための枝だが、
      // 割合で減らすのではなく丸ごと通さないので効き方が裏返る。
      'evade',
    ],
  },
  {
    id: 'action', label: '攻撃の挙動', icon: 'action',
    terms: ['行動回数', '手数', '連撃', '追撃', '再行動', '多段', 'ヒット数'],
    desc: '殴り方そのものを書き換える枝。回数・対象・防御の抜き方が変わる。',
    kinds: [
      'double_hits', 'chain', 'chain_power', 'extra_action', 'ambush',
      'kill_extra_action', 'all_spread', 'guard_break', 'execute',
      'counter', 'counter_all', 'counter_power', 'overkill_carry',
    ],
  },
  {
    id: 'power_band', label: '威力帯', icon: 'band',
    terms: ['威力帯', '小技', '中技', '大技', 'ダメージ上限', '上限突破'],
    desc: '威力帯を選ぶ枝。3つの帯は重ならないので、どれかに寄せることになる。'
      + '小技は手数、中技は効果を通す役、大技は上限を破って一撃で沈める役。',
    kinds: [
      'low_power_boost', 'auto_low_skill', 'low_power_spread', 'low_power_repeat',
      'mid_power_status', 'mid_power_boost', 'mid_power_cap', 'mid_power_combo', 'mid_power_crit',
      'high_power_boost', 'high_power_cap', 'repeat_power', 'variety_power',
    ],
  },
  {
    id: 'situation', label: '戦況', icon: 'situation',
    terms: ['戦況', 'ラウンド', '初回', '瀕死', '人数', '状況'],
    desc: 'そのときの盤面を火力に変える枝。HP・人数・ラウンド・隊列など条件はさまざま。',
    kinds: [
      'low_hp_power', 'high_hp_power', 'boss_slayer', 'first_round_power',
      'foe_count_power', 'lone_foe_power', 'wave_stack', 'round_stack',
      'hit_stack', 'party_size_power', 'solo_power', 'mono_element_power',
      'rainbow_power', 'front_power', 'wave_power', 'full_hp_foe_power',
      'debuff_amp',
      // 執着は「同じ相手を狙い続けたか」、連携は「直前に動いた味方」、
      // 恩返しは「回復を受けた回数」を火力に変える。どれも盤面を見る枝。
      'focus_power', 'relay_power', 'mend_power',
    ],
  },
  {
    id: 'convert', label: '変換・特殊', icon: 'convert',
    terms: ['変換', '特殊', '吸収', '転換'],
    desc: 'ステータスを別の役へ回したり、ルールそのものを緩めたりする枝。',
    kinds: [
      // クラス技の待ち時間を縮める。ルールを緩める側なのでここ。
      'cooldown_cut',
      'hp_to_atk', 'def_to_atk', 'atk_to_def', 'hp_to_def', 'stable_damage', 'cap_break',
      'opening_buff', 'buff_duration', 'buff_on_kill',
      // かける側のバフ強化 (§5.9 / §5.10)。受け手の buff_duration と並べる。
      'buff_power', 'buff_extend', 'support_stack', 'buff_shield', 'buff_heal', 'round_buff',
      // 対象による分岐 (§5.12)。自分に厚く／味方に厚く、の排他。
      'self_buff_power', 'solo_buff', 'self_buff_lock', 'buff_cap', 'ally_buff_power',
    ],
  },
  {
    id: 'skill', label: '習得技', icon: 'skill',
    terms: ['習得技', 'アクティブ', 'スキル', '技'],
    desc: 'アクティブ技を覚える。覚えた技はそのまま戦闘コマンドに並ぶ。',
    kinds: ['grant_skill'],
  },
];

/** どの分類にも載っていない効果種別の受け皿。取りこぼしても画面から消えないようにする。 */
RPG.data.nodeCategoryFallback = {
  id: 'other', label: 'その他', icon: 'convert',
    terms: ['その他'],
  desc: 'まだ分類されていないノード。',
};
