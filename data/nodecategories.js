// スキルツリーの分類 (§5.9)
//
// ── なぜ効果種別から引くのか ──
// ノード1つ1つに category を書くと、ノードを足すたびに書き忘れが起きる。
// ここでは **効果種別 → 分類** の対応だけを持ち、ノード側には何も書かせない。
// 新しいノードは、使っている効果種別から自動で正しい棚に入る。
//
// 新しい効果種別を足したときは、下の kinds にその名前を1つ加えるだけでよい。
// どこにも載っていない種別は「その他」に集まるので、取りこぼしても画面からは消えない。
RPG.data.nodeCategories = [
  {
    id: 'stat', label: '基礎ステータス', icon: 'stat',
    desc: 'HP・攻撃・防御・魔力そのものを伸ばす。どのビルドでも腐らない土台。',
    kinds: ['stat_pct'],
  },
  {
    id: 'tag', label: '系統タグ', icon: 'tag',
    desc: '[物理][魔術][遺物] の枠。異なるタグ同士は乗算されるので、散らすほど伸びが大きい。',
    kinds: ['tag_bonus', 'tag_all', 'tag_crit', 'tag_pierce'],
  },
  {
    id: 'element', label: '属性戦略', icon: 'element',
    desc: '属性相性との付き合い方。無視する・塗り替える・突き詰めるの3方向がある。',
    kinds: [
      'element_adapt', 'element_mastery', 'chaos', 'element_convert', 'element_pierce',
      'dual_element', 'element_power', 'element_resist', 'element_crit',
      'weak_hunter', 'neutral_power', 'weak_guard',
    ],
  },
  {
    id: 'crit', label: '会心', icon: 'crit',
    desc: 'クリティカルを軸にする枝。率・倍率・会心したときの追加効果に分かれる。',
    kinds: [
      'crit', 'crit_damage', 'crit_stack', 'crit_spread', 'crit_execute',
      'crit_heal', 'crit_combo', 'crit_pierce', 'first_hit_crit',
    ],
  },
  {
    id: 'combo', label: '弱点コンボ', icon: 'combo',
    desc: 'コンボは手動戦闘でしか積めない。ここを厚くするほど、手で戦う見返りが大きくなる。',
    kinds: ['combo_gain', 'combo_keep', 'combo_power'],
  },
  {
    id: 'status', label: '状態異常', icon: 'status',
    desc: '撒く・耐える・突く。6種の異常はそれぞれ効くタイミングが違う。',
    kinds: [
      'status_power', 'status_on_hit', 'status_on_hit_kind', 'status_immune',
      'status_resist_kind', 'vs_status_power', 'debuff_duration', 'debuff_resist',
      'debuff_spread',
    ],
  },
  {
    id: 'defense', label: '生存・防御', icon: 'shield',
    desc: '倒れないための枝。軽減・障壁・復活・肩代わりを組み合わせて無敵に近づける。',
    kinds: [
      'reduction', 'revive', 'last_stand', 'regen', 'wave_heal', 'thorns',
      'guard_ally', 'overheal_shield', 'start_shield', 'shield_regen',
      'low_hp_guard', 'damage_share', 'wave_revive', 'back_guard',
      'boss_guard', 'reflect', 'heal_power', 'heal_on_kill', 'lifesteal',
    ],
  },
  {
    id: 'action', label: '攻撃の挙動', icon: 'action',
    desc: '殴り方そのものを書き換える枝。回数・対象・防御の抜き方が変わる。',
    kinds: [
      'double_hits', 'chain', 'chain_power', 'extra_action', 'ambush',
      'kill_extra_action', 'all_spread', 'guard_break', 'execute',
      'counter', 'counter_all', 'counter_power', 'overkill_carry',
    ],
  },
  {
    id: 'power_band', label: '小技と大技', icon: 'band',
    desc: '威力帯を選ぶ枝。小技側と大技側は帯が重ならないので、両取りはできない。',
    kinds: [
      'low_power_boost', 'auto_low_skill', 'low_power_spread', 'low_power_repeat',
      'high_power_boost', 'repeat_power', 'variety_power',
    ],
  },
  {
    id: 'situation', label: '戦況', icon: 'situation',
    desc: 'そのときの盤面を火力に変える枝。HP・人数・ラウンド・隊列など条件はさまざま。',
    kinds: [
      'low_hp_power', 'high_hp_power', 'boss_slayer', 'first_round_power',
      'foe_count_power', 'lone_foe_power', 'wave_stack', 'round_stack',
      'hit_stack', 'party_size_power', 'solo_power', 'mono_element_power',
      'rainbow_power', 'front_power', 'wave_power', 'full_hp_foe_power',
      'debuff_amp',
    ],
  },
  {
    id: 'convert', label: '変換・特殊', icon: 'convert',
    desc: 'ステータスを別の役へ回したり、ルールそのものを緩めたりする枝。',
    kinds: [
      'hp_to_atk', 'def_to_atk', 'atk_to_def', 'stable_damage', 'cap_break',
      'slot', 'opening_buff', 'buff_duration', 'buff_on_kill',
    ],
  },
  {
    id: 'skill', label: '習得技', icon: 'skill',
    desc: 'アクティブ技を覚える。覚えた技はそのまま戦闘コマンドに並ぶ。',
    kinds: ['grant_skill'],
  },
];

/** どの分類にも載っていない効果種別の受け皿。取りこぼしても画面から消えないようにする。 */
RPG.data.nodeCategoryFallback = {
  id: 'other', label: 'その他', icon: 'convert',
  desc: 'まだ分類されていないノード。',
};
