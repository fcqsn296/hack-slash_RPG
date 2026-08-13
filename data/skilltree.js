// スキルツリー (§5)
// 網の目型の前提条件は持たない。「累計投資レベルによるティア解放」だけで構成する (§5.1)。
// 全キャラクターがこの同一テンプレートを共有する (§5.2)。

/** ティア定義。解放条件は「対象ティア群への累計投資レベル」の比較演算だけで完結する。 */
RPG.data.skillTreeTiers = {
  basic: { label: '初級', order: 0, requiresLevels: 0,  countsFrom: [] },
  mid:   { label: '中級', order: 1, requiresLevels: 5,  countsFrom: ['basic'] },
  high:  { label: '上級', order: 2, requiresLevels: 10, countsFrom: ['basic', 'mid'] },
};

/** スキルリセットの費用 (§5.5)。キャラクターのレベルに比例する。 */
RPG.data.skillResetCostPerLevel = 150;

/**
 * ノード定義。
 * cost      : 1レベルあたりの消費SP
 * maxLevel  : 最大投資レベル
 * effects   : 1レベルあたりの効果。複数持てる。
 *   stat_pct      基礎ステータスの割合上昇
 *   tag_bonus     系統タグ倍率への加算 (§3.2 ステップ2)
 *   tag_all       [物理][魔術][遺物] すべてに同時加算（乗算で効くので伸びが大きい）
 *   crit          クリティカル率
 *   cap_break     ダメージ上限突破率 (§3.2 ステップ8)
 *   slot          装備スロット拡張 (§5.3)
 *   element_adapt 「全属性適応」(§5.4 万能型)
 *   element_mastery 「○○の極意」(§5.4 特化型)
 *   chaos         「混沌の力」(§5.4 無属性ゴリ押し)
 */
RPG.data.skillTree = [
  /* ======================= 初級 ======================= */
  {
    id: 'tr_atk', tier: 'basic', name: '攻撃鍛錬', cost: 1, maxLevel: 5,
    effects: [{ kind: 'stat_pct', stat: 'atk', value: 0.04 }],
    desc: 'ATK +4%',
  },
  {
    id: 'tr_magi', tier: 'basic', name: '魔力研鑽', cost: 1, maxLevel: 5,
    effects: [{ kind: 'stat_pct', stat: 'magi_power', value: 0.04 }],
    desc: '魔力 +4%',
  },
  {
    id: 'tr_hp', tier: 'basic', name: '体力増強', cost: 1, maxLevel: 5,
    effects: [{ kind: 'stat_pct', stat: 'hp', value: 0.05 }],
    desc: '最大HP +5%',
  },
  {
    id: 'tr_def', tier: 'basic', name: '防御訓練', cost: 1, maxLevel: 5,
    effects: [{ kind: 'stat_pct', stat: 'def', value: 0.05 }],
    desc: 'DEF +5%',
  },
  {
    id: 'tr_phys1', tier: 'basic', name: '物理の基礎', cost: 1, maxLevel: 4,
    effects: [{ kind: 'tag_bonus', tag: 'phys', value: 0.05 }],
    desc: '[物理]系統 +5%',
  },
  {
    id: 'tr_magi1', tier: 'basic', name: '魔術の基礎', cost: 1, maxLevel: 4,
    effects: [{ kind: 'tag_bonus', tag: 'magi', value: 0.05 }],
    desc: '[魔術]系統 +5%',
  },
  {
    id: 'tr_reli1', tier: 'basic', name: '遺物の基礎', cost: 1, maxLevel: 4,
    effects: [{ kind: 'tag_bonus', tag: 'reli', value: 0.05 }],
    desc: '[遺物]系統 +5%',
  },
  {
    id: 'tr_slot_acc', tier: 'basic', name: '装飾の心得', cost: 3, maxLevel: 1,
    effects: [{ kind: 'slot', slot: 'accessory', value: 1 }],
    desc: 'アクセサリー枠 最大2',
  },
  {
    id: 'tr_regen', tier: 'basic', name: '治癒の心得', cost: 1, maxLevel: 5,
    effects: [{ kind: 'regen', value: 0.015 }],
    desc: 'ラウンド終了時に最大HPの1.5%を回復',
  },
  {
    id: 'tr_lifesteal', tier: 'basic', name: '吸命', cost: 1, maxLevel: 5,
    effects: [{ kind: 'lifesteal', value: 0.02 }],
    desc: '与えたダメージの2%をHPへ還元',
  },
  {
    id: 'tr_grant_rally', tier: 'basic', name: '鼓舞の号令', cost: 2, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_rally', value: 1 }],
    desc: 'アクティブ技「鼓舞の号令」を習得（全体に固有バフ+40%）',
  },
  {
    id: 'tr_opening', tier: 'basic', name: '先手の気構え', cost: 1, maxLevel: 3,
    effects: [{ kind: 'opening_buff', value: 0.12 }],
    effectDesc: '戦闘開始時に固有バフ',
    desc: '戦闘開始時、3ターンの間 固有ユニークバフ+12%',
  },
  {
    id: 'tr_first_round', tier: 'basic', name: '奇襲', cost: 1, maxLevel: 4,
    effects: [{ kind: 'first_round_power', value: 0.10 }],
    desc: '1ラウンド目の与ダメージ +10%',
  },
  {
    id: 'tr_wave_heal', tier: 'basic', name: '息継ぎ', cost: 1, maxLevel: 4,
    effects: [{ kind: 'wave_heal', value: 0.04 }],
    desc: '次のウェーブに進むとき 最大HPの4%回復',
  },
  {
    id: 'tr_thorns', tier: 'basic', name: '棘の外皮', cost: 1, maxLevel: 4,
    effects: [{ kind: 'thorns', value: 0.02 }],
    desc: '被弾するたび、相手に自分の最大HPの2%のダメージ',
  },

  /* ======================= 中級 ======================= */
  {
    id: 'tr_phys2', tier: 'mid', name: '物理の練達', cost: 2, maxLevel: 5,
    effects: [{ kind: 'tag_bonus', tag: 'phys', value: 0.08 }],
    desc: '[物理]系統 +8%',
  },
  {
    id: 'tr_magi2', tier: 'mid', name: '魔術の練達', cost: 2, maxLevel: 5,
    effects: [{ kind: 'tag_bonus', tag: 'magi', value: 0.08 }],
    desc: '[魔術]系統 +8%',
  },
  {
    id: 'tr_reli2', tier: 'mid', name: '遺物の練達', cost: 2, maxLevel: 5,
    effects: [{ kind: 'tag_bonus', tag: 'reli', value: 0.08 }],
    desc: '[遺物]系統 +8%',
  },
  {
    id: 'tr_crit', tier: 'mid', name: '一点集中', cost: 1, maxLevel: 5,
    effects: [{ kind: 'crit', value: 0.03 }],
    desc: 'クリティカル率 +3%',
  },
  {
    id: 'tr_slot_armor', tier: 'mid', name: '重装の心得', cost: 4, maxLevel: 1,
    effects: [{ kind: 'slot', slot: 'armor', value: 1 }],
    desc: '防具枠 最大2',
  },
  {
    id: 'tr_crit_dmg', tier: 'mid', name: '痛打', cost: 2, maxLevel: 5,
    effects: [{ kind: 'crit_damage', value: 0.15 }],
    desc: 'クリティカル倍率 +0.15（1.5倍 → 最大2.25倍）',
  },
  {
    id: 'tr_execute', tier: 'mid', name: '追い打ち', cost: 2, maxLevel: 5,
    effects: [{ kind: 'execute', value: 0.12 }],
    desc: '相手のHPが減っているほど威力上昇（瀕死時 最大+60%）',
  },
  {
    id: 'tr_guard', tier: 'mid', name: '受け流し', cost: 2, maxLevel: 5,
    effects: [{ kind: 'reduction', value: 0.04 }],
    desc: '被ダメージ軽減 +4%',
  },
  {
    id: 'tr_counter', tier: 'mid', name: '反撃の構え', cost: 2, maxLevel: 3,
    effects: [{ kind: 'counter', value: 0.15, power: 0.7 }],
    desc: '被弾時 15% の確率で威力70%の反撃',
  },
  {
    id: 'tr_grant_triple', tier: 'mid', name: '連撃の型', cost: 3, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_triple', value: 1 }],
    desc: 'アクティブ技「三連の型」を習得（威力65%×3回）',
  },
  {
    id: 'tr_grant_drain', tier: 'mid', name: '奪命の術', cost: 3, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_drain', value: 1 }],
    desc: 'アクティブ技「生命奪取」を習得（与ダメージの40%を吸収）',
  },
  {
    id: 'tr_low_hp', tier: 'mid', name: '背水', cost: 2, maxLevel: 5,
    effects: [{ kind: 'low_hp_power', value: 0.16 }],
    desc: '自分のHPが減っているほど威力上昇（瀕死時 最大+80%）',
  },
  {
    id: 'tr_high_hp', tier: 'mid', name: '万全', cost: 2, maxLevel: 5,
    effects: [{ kind: 'high_hp_power', value: 0.09 }],
    desc: '自分のHPが多いほど威力上昇（満タン時 最大+45%）',
  },
  {
    id: 'tr_boss_slayer', tier: 'mid', name: '巨獣狩り', cost: 2, maxLevel: 5,
    effects: [{ kind: 'boss_slayer', value: 0.10 }],
    desc: 'ボスへの与ダメージ +10%',
  },
  {
    id: 'tr_debuff_amp', tier: 'mid', name: '追い討ち', cost: 2, maxLevel: 5,
    effects: [{ kind: 'debuff_amp', value: 0.10 }],
    desc: '状態異常や防御崩壊を受けている敵への与ダメージ +10%',
  },
  {
    id: 'tr_guard_break', tier: 'mid', name: '防御崩し', cost: 2, maxLevel: 4,
    effects: [{ kind: 'guard_break', value: 0.09 }],
    desc: '攻撃するたび 9% の確率で相手の防御を無視する',
  },
  {
    id: 'tr_pierce', tier: 'mid', name: '属性貫通', cost: 2, maxLevel: 4,
    effects: [{ kind: 'element_pierce', value: 0.25 }],
    desc: '不利属性の0.5倍を等倍側へ寄せ、さらに不利な相手への威力を上げる' +
      '（Lv4で不利を完全に無効化し、その相手に1.6倍）',
  },
  {
    id: 'tr_grant_storm', tier: 'mid', name: '嵐の型', cost: 3, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_storm', value: 1 }],
    desc: 'アクティブ技「乱れ撃ち」を習得（敵全体に威力90%）',
  },
  {
    id: 'tr_grant_hex', tier: 'mid', name: '呪詛の心得', cost: 3, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_hex', value: 1 }],
    desc: 'アクティブ技「万呪」を習得（防御崩壊＋毒＋弱体をまとめて付与）',
  },
  // 特化型: 有利属性の倍率を 1.5 → 2.5 まで引き上げる (§5.4)
  {
    id: 'tr_mastery_fire', tier: 'mid', name: '火の極意', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_mastery', element: 'fire', value: 0.2 }],
    desc: '火属性で有利なとき 1.5倍 → +0.2倍（全属性適応Lv2で有利になった攻撃にも乗る）',
  },
  {
    id: 'tr_mastery_water', tier: 'mid', name: '水の極意', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_mastery', element: 'water', value: 0.2 }],
    desc: '水属性で有利なとき 1.5倍 → +0.2倍（全属性適応Lv2で有利になった攻撃にも乗る）',
  },
  {
    id: 'tr_mastery_wind', tier: 'mid', name: '風の極意', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_mastery', element: 'wind', value: 0.2 }],
    desc: '風属性で有利なとき 1.5倍 → +0.2倍（全属性適応Lv2で有利になった攻撃にも乗る）',
  },
  {
    id: 'tr_mastery_earth', tier: 'mid', name: '土の極意', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_mastery', element: 'earth', value: 0.2 }],
    desc: '土属性で有利なとき 1.5倍 → +0.2倍（全属性適応Lv2で有利になった攻撃にも乗る）',
  },
  {
    id: 'tr_mastery_light', tier: 'mid', name: '光の極意', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_mastery', element: 'light', value: 0.2 }],
    desc: '光属性で有利なとき 1.5倍 → +0.2倍（全属性適応Lv2で有利になった攻撃にも乗る）',
  },
  {
    id: 'tr_mastery_dark', tier: 'mid', name: '闇の極意', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_mastery', element: 'dark', value: 0.2 }],
    desc: '闇属性で有利なとき 1.5倍 → +0.2倍（全属性適応Lv2で有利になった攻撃にも乗る）',
  },

  /* ======================= 上級 ======================= */
  {
    id: 'tr_all_tag', tier: 'high', name: '三系統掌握', cost: 3, maxLevel: 3,
    effects: [{ kind: 'tag_all', value: 0.06 }],
    desc: '[物理][魔術][遺物] すべて +6%（異タグは乗算されるため伸びが大きい）',
  },
  {
    // 上限突破は「大技を選ぶ理由」そのもの (§3.2 ステップ8)。
    //
    // 実測: 最大強化のビルドで威力620%の技は素で 1,241,220 出るが、
    // 上限50万に潰されて 574,684 まで落ちる。中技150%との差が
    // 威力どおりの4.1倍から **1.90倍** まで縮み、大技を撃つ意味が消える。
    // 突破を +192% まで積むと素の値がそのまま通り、4.10倍が戻る。
    // それ以上は伸びない（既に上限を抜けているため）ので、
    // ツリー側で +96%、クラス側で +96% を上限として、合わせて到達できるようにした。
    id: 'tr_cap', tier: 'high', name: '限界超越', cost: 2, maxLevel: 12,
    effects: [{ kind: 'cap_break', value: 0.08 }],
    desc: 'ダメージ上限突破 +8%（大技ほど恩恵が大きい）',
  },
  {
    id: 'tr_slot_weapon', tier: 'high', name: '二刀の極致', cost: 6, maxLevel: 1,
    effects: [{ kind: 'slot', slot: 'weapon', value: 1 }],
    desc: '武器枠 最大2（実質二刀流）',
  },
  /* ===== 状態異常・支援の入口 (§5.6) ===== */
  {
    id: 'tr_status_power', tier: 'basic', name: '毒の心得', cost: 2, maxLevel: 5,
    effects: [{ kind: 'status_power', value: 0.2 }],
    desc: '自分が与える継続ダメージの割合 +20%',
  },
  {
    id: 'tr_debuff_len', tier: 'basic', name: '呪詛の心得', cost: 3, maxLevel: 2,
    effects: [{ kind: 'debuff_duration', value: 1 }],
    desc: '自分が与えるデバフの持続 +1ターン',
  },
  {
    id: 'tr_debuff_resist', tier: 'basic', name: '精神耐性', cost: 2, maxLevel: 3,
    effects: [{ kind: 'debuff_resist', value: 1 }],
    desc: '自分が受けるデバフの持続 -1ターン（0以下なら無効化）',
  },
  {
    id: 'tr_stable', tier: 'basic', name: '据わった腕', cost: 2, maxLevel: 4,
    effects: [{ kind: 'stable_damage', value: 0.25 }],
    desc: 'ダメージの揺らぎを25%狭める（Lv4で完全に安定）',
  },
  {
    id: 'tr_foe_count', tier: 'basic', name: '群狼の理', cost: 3, maxLevel: 3,
    effects: [{ kind: 'foe_count_power', value: 0.06 }],
    desc: '生きている敵1体につき威力 +6%',
  },
  {
    id: 'tr_lone_foe', tier: 'basic', name: '一騎討ち', cost: 3, maxLevel: 3,
    effects: [{ kind: 'lone_foe_power', value: 0.15 }],
    desc: '敵が1体だけのとき威力 +15%',
  },
  {
    id: 'tr_ambush', tier: 'basic', name: '奇襲の心得', cost: 3, maxLevel: 3,
    effects: [{ kind: 'ambush', value: 0.2 }],
    desc: '1ラウンド目に 20% の確率でもう一度行動する',
  },
  {
    id: 'tr_crit_heal', tier: 'basic', name: '血の宴', cost: 2, maxLevel: 4,
    effects: [{ kind: 'crit_heal', value: 0.08 }],
    desc: '会心で与えたダメージの 8% を吸収する',
  },
  {
    id: 'tr_grant_pierce_shot', tier: 'basic', name: '貫きの型', cost: 3, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_pierce_shot', value: 1 }],
    desc: 'アクティブ技「穿孔弾」を習得（威力80%・防御無視の小技）',
  },
  {
    id: 'tr_grant_bastion_cry', tier: 'basic', name: '守りの型', cost: 3, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_bastion_cry', value: 1 }],
    desc: 'アクティブ技「守りの号令」を習得（味方全体の被ダメージを軽減）',
  },
  /* ===== 戦況を読む中級 (§5.6) ===== */
  {
    id: 'tr_wave_stack', tier: 'mid', name: '連戦の熱', cost: 4, maxLevel: 3,
    effects: [{ kind: 'wave_stack', value: 0.08 }],
    desc: 'ウェーブを越えるごとに威力 +8%（連戦ほど強い）',
  },
  {
    id: 'tr_overheal', tier: 'mid', name: '癒しの余剰', cost: 3, maxLevel: 3,
    effects: [{ kind: 'overheal_shield', value: 0.4 }],
    desc: '回復のあふれたぶんの 40% が障壁になる',
  },
  {
    id: 'tr_guard_ally', tier: 'mid', name: '盾となる者', cost: 4, maxLevel: 3,
    effects: [{ kind: 'guard_ally', value: 0.15 }],
    desc: '味方が受けるダメージの 15% を肩代わりする',
  },
  {
    id: 'tr_hp_to_atk', tier: 'mid', name: '命を刃に', cost: 4, maxLevel: 4,
    effects: [{ kind: 'hp_to_atk', value: 0.02 }],
    desc: '最大HPの 2% を攻撃力と魔力に上乗せする',
  },
  {
    id: 'tr_crit_combo', tier: 'mid', name: '会心連鎖', cost: 4, maxLevel: 2,
    effects: [{ kind: 'crit_combo', value: 1 }],
    desc: '会心のたびに弱点コンボが1段多く積まれる',
  },
  {
    id: 'tr_convert_fire', tier: 'mid', name: '紅蓮の誓い', cost: 4, maxLevel: 1,
    effects: [{ kind: 'element_convert', element: 'fire' }],
    desc: 'すべての攻撃が火属性になる（極意と噛み合わせる用）',
  },
  {
    id: 'tr_convert_water', tier: 'mid', name: '蒼海の誓い', cost: 4, maxLevel: 1,
    effects: [{ kind: 'element_convert', element: 'water' }],
    desc: 'すべての攻撃が水属性になる',
  },
  {
    id: 'tr_convert_wind', tier: 'mid', name: '疾風の誓い', cost: 4, maxLevel: 1,
    effects: [{ kind: 'element_convert', element: 'wind' }],
    desc: 'すべての攻撃が風属性になる',
  },
  {
    id: 'tr_convert_earth', tier: 'mid', name: '大地の誓い', cost: 4, maxLevel: 1,
    effects: [{ kind: 'element_convert', element: 'earth' }],
    desc: 'すべての攻撃が土属性になる',
  },
  {
    id: 'tr_grant_venom', tier: 'mid', name: '毒撒きの型', cost: 4, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_venom', value: 1 }],
    desc: 'アクティブ技「腐蝕の霧」を習得（敵全体に毒）',
  },
  {
    id: 'tr_grant_bulwark', tier: 'mid', name: '城塞の型', cost: 4, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_bulwark', value: 1 }],
    desc: 'アクティブ技「城塞」を習得（自分の防御を大きく上げる）',
  },
  {
    id: 'tr_grant_snipe', tier: 'mid', name: '狙撃の型', cost: 4, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_snipe', value: 1 }],
    desc: 'アクティブ技「狙撃」を習得（会心率の非常に高い単体攻撃）',
  },
  /* ===== 極端に振る上級 (§5.6) ===== */
  {
    id: 'tr_convert_light', tier: 'high', name: '聖光の誓い', cost: 5, maxLevel: 1,
    effects: [{ kind: 'element_convert', element: 'light' }],
    desc: 'すべての攻撃が光属性になる',
  },
  {
    id: 'tr_convert_dark', tier: 'high', name: '深淵の誓い', cost: 5, maxLevel: 1,
    effects: [{ kind: 'element_convert', element: 'dark' }],
    desc: 'すべての攻撃が闇属性になる',
  },
  {
    id: 'tr_hp_to_atk_hi', tier: 'high', name: '血肉の理', cost: 6, maxLevel: 3,
    effects: [{ kind: 'hp_to_atk', value: 0.04 }],
    desc: '最大HPの 4% を攻撃力と魔力に上乗せする',
  },
  {
    id: 'tr_wave_stack_hi', tier: 'high', name: '不滅の勢い', cost: 6, maxLevel: 2,
    effects: [{ kind: 'wave_stack', value: 0.15 }],
    desc: 'ウェーブを越えるごとに威力 +15%',
  },
  {
    id: 'tr_guard_ally_hi', tier: 'high', name: '不動の盾', cost: 6, maxLevel: 2,
    effects: [{ kind: 'guard_ally', value: 0.2 }],
    desc: '味方が受けるダメージの 20% を肩代わりする',
  },
  {
    id: 'tr_grant_judgment', tier: 'high', name: '裁きの型', cost: 7, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_judgment', value: 1 }],
    desc: 'アクティブ技「断罪」を習得（HPが減った敵ほど大ダメージ）',
  },
  {
    id: 'tr_grant_sanctuary', tier: 'high', name: '聖域の型', cost: 7, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_sanctuary', value: 1 }],
    desc: 'アクティブ技「聖域」を習得（味方全体を大きく回復し障壁を張る）',
  },
  // 小技の使い道 (§4.3)。
  // 強い技を1つ覚えると下位の攻撃技が死に技になるので、
  // 「威力が低いこと自体が条件になる」効果をここに集めている。
  {
    id: 'tr_low_boost', tier: 'basic', name: '手数の心得', cost: 2, maxLevel: 5,
    effects: [{ kind: 'low_power_boost', value: 0.12 }],
    desc: '威力100%以下の技の威力 +12%（強い技には乗らない）',
  },
  {
    id: 'tr_low_auto', tier: 'mid', name: '追撃の型', cost: 3, maxLevel: 4,
    effects: [{ kind: 'auto_low_skill', value: 0.18 }],
    desc: '攻撃したあと 18% の確率で、持っている威力100%以下の技が自動で飛ぶ',
  },
  {
    id: 'tr_low_spread', tier: 'mid', name: '拡散の型', cost: 4, maxLevel: 1,
    effects: [{ kind: 'low_power_spread', value: 1 }],
    desc: '威力100%以下の単体技が敵全体に当たるようになる',
  },
  {
    id: 'tr_low_repeat', tier: 'high', name: '連射の極致', cost: 5, maxLevel: 2,
    effects: [{ kind: 'low_power_repeat', value: 1 }],
    desc: '威力100%以下の技が1回多く発動する',
  },
  {
    id: 'tr_grant_burst', tier: 'high', name: '全弾解放の理', cost: 6, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_burst', value: 1 }],
    desc: 'アクティブ技「全弾解放」を習得（全攻撃技を同時発動、反動で数ラウンド行動不能）',
  },
  // 万能型: どのエリアでも安定周回できるが、他の火力を犠牲にする (§5.4)
  {
    id: 'tr_adapt', tier: 'high', name: '全属性適応', cost: 5, maxLevel: 2,
    effects: [{ kind: 'element_adapt', value: 1 }],
    desc: 'Lv1: 不利属性を等倍に無効化 ／ Lv2: 全攻撃を有利1.5倍として扱う' +
      '（無属性どうしの等倍にも効く。「○○の極意」とも重なる）',
  },
  {
    id: 'tr_fortress', tier: 'high', name: '金剛不壊', cost: 3, maxLevel: 3,
    effects: [{ kind: 'reduction', value: 0.08 }],
    desc: '被ダメージ軽減 +8%（他の軽減と合計100%で無敵）',
  },
  {
    id: 'tr_extra', tier: 'high', name: '刹那の見切り', cost: 4, maxLevel: 3,
    effects: [{ kind: 'extra_action', value: 0.08 }],
    desc: '行動後 8% の確率でもう一度行動できる',
  },
  {
    id: 'tr_revive', tier: 'high', name: '不死鳥の理', cost: 6, maxLevel: 1,
    effects: [{ kind: 'revive', value: 0.5 }],
    desc: '戦闘不能になっても1戦闘に1度だけ、HP50%で復帰する',
  },
  {
    id: 'tr_grant_ruin', tier: 'high', name: '渾天の極み', cost: 5, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_ruin', value: 1 }],
    desc: 'アクティブ技「渾天撃」を習得（[遺物]無属性・威力320%）',
  },
  {
    id: 'tr_grant_bastion', tier: 'high', name: '不動の構え', cost: 5, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_bastion', value: 1 }],
    desc: 'アクティブ技「不動明王」を習得（全体の被ダメージを3ターン40%軽減）',
  },
  {
    id: 'tr_double', tier: 'high', name: '双撃の理', cost: 8, maxLevel: 1,
    effects: [
      { kind: 'double_hits', value: 1 },
      { kind: 'stat_pct', stat: 'atk', value: -0.30 },
    ],
    desc: '攻撃技が必ず2回発動する。ただしATK -30%',
  },
  {
    id: 'tr_chain', tier: 'high', name: '波及', cost: 4, maxLevel: 3,
    effects: [{ kind: 'chain', value: 0.13 }],
    desc: '単体攻撃の余波が他の敵にも威力13%で及ぶ',
  },
  {
    id: 'tr_last_stand', tier: 'high', name: '不屈', cost: 5, maxLevel: 1,
    effects: [{ kind: 'last_stand', value: 0.6 }],
    desc: '致死ダメージを60%の確率でHP1で耐える（1戦闘に1回）',
  },
  {
    id: 'tr_thorns_hi', tier: 'high', name: '鉄条の鎧', cost: 3, maxLevel: 3,
    effects: [{ kind: 'thorns', value: 0.05 }],
    desc: '被弾するたび、相手に自分の最大HPの5%のダメージ',
  },
  {
    id: 'tr_grant_sacrifice', tier: 'high', name: '生命代償', cost: 5, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_sacrifice', value: 1 }],
    desc: 'アクティブ技「命賭けの一撃」を習得（HPを支払い、支払った量ぶん威力が跳ね上がる）',
  },
  // 無属性ゴリ押し: 属性パズルを無視して暴力で解決する (§5.4)
  {
    id: 'tr_chaos', tier: 'high', name: '混沌の力', cost: 5, maxLevel: 1,
    effects: [
      { kind: 'chaos', value: 1 },
      { kind: 'stat_pct', stat: 'atk', value: 0.5 },
    ],
    desc: '全攻撃を無属性に固定し、ATK +50%',
  },

  /* ===================================================================
   * §5.7 拡張分
   *
   * 初級を「浅く広く選べる場所」にするのが狙い。
   * 属性ごと・隊列ごと・戦況ごとに小さな枝を並べてあるので、
   * 序盤から自分の戦い方に合う方向へ寄せられる。
   * =================================================================== */

  /* ===== 属性ごとの心得 (§5.7) =====
   * 「極意」(中級) が有利倍率そのものを引き上げるのに対し、
   * こちらは相性と無関係な別枠の上乗せ。等倍・不利の相手にも乗るので、
   * 「この属性で殴り続ける」ビルドの土台になる。 */
  {
    id: 'tr_power_fire', tier: 'basic', name: '紅蓮の心得', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_power', element: 'fire', value: 0.05 }],
    desc: '火属性の攻撃 威力+5%（属性相性とは別枠）',
  },
  {
    id: 'tr_power_water', tier: 'basic', name: '蒼波の心得', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_power', element: 'water', value: 0.05 }],
    desc: '水属性の攻撃 威力+5%（属性相性とは別枠）',
  },
  {
    id: 'tr_power_wind', tier: 'basic', name: '疾風の心得', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_power', element: 'wind', value: 0.05 }],
    desc: '風属性の攻撃 威力+5%（属性相性とは別枠）',
  },
  {
    id: 'tr_power_earth', tier: 'basic', name: '岩塊の心得', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_power', element: 'earth', value: 0.05 }],
    desc: '土属性の攻撃 威力+5%（属性相性とは別枠）',
  },
  {
    id: 'tr_power_light', tier: 'basic', name: '聖光の心得', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_power', element: 'light', value: 0.05 }],
    desc: '光属性の攻撃 威力+5%（属性相性とは別枠）',
  },
  {
    id: 'tr_power_dark', tier: 'basic', name: '常闇の心得', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_power', element: 'dark', value: 0.05 }],
    desc: '闇属性の攻撃 威力+5%（属性相性とは別枠）',
  },

  /* ===== 属性ごとの護り (§5.7) =====
   * 攻めの心得とちょうど対になる防御側の枝。
   * 苦手な属性が出るフィールドに合わせて振り直す使い方を想定している。 */
  {
    id: 'tr_resist_fire', tier: 'basic', name: '炎への備え', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_resist', element: 'fire', value: 0.04 }],
    desc: '火属性で受けるダメージ -4%',
  },
  {
    id: 'tr_resist_water', tier: 'basic', name: '水への備え', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_resist', element: 'water', value: 0.04 }],
    desc: '水属性で受けるダメージ -4%',
  },
  {
    id: 'tr_resist_wind', tier: 'basic', name: '風への備え', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_resist', element: 'wind', value: 0.04 }],
    desc: '風属性で受けるダメージ -4%',
  },
  {
    id: 'tr_resist_earth', tier: 'basic', name: '土への備え', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_resist', element: 'earth', value: 0.04 }],
    desc: '土属性で受けるダメージ -4%',
  },
  {
    id: 'tr_resist_light', tier: 'basic', name: '光への備え', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_resist', element: 'light', value: 0.04 }],
    desc: '光属性で受けるダメージ -4%',
  },
  {
    id: 'tr_resist_dark', tier: 'basic', name: '闇への備え', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_resist', element: 'dark', value: 0.04 }],
    desc: '闇属性で受けるダメージ -4%',
  },

  /* ===== 弱点コンボを伸ばす (§5.7) =====
   * 弱点コンボ (§10.6) は手動戦闘でしか積めない。
   * ここを厚くすることが、そのまま「手で戦う理由」になる。 */
  {
    id: 'tr_combo_gain', tier: 'basic', name: '連鎖の心得', cost: 3, maxLevel: 2,
    effects: [{ kind: 'combo_gain', value: 1 }],
    desc: '弱点を突いたときのコンボ加算 +1段',
  },
  {
    id: 'tr_combo_keep', tier: 'basic', name: '執念', cost: 2, maxLevel: 3,
    effects: [{ kind: 'combo_keep', value: 0.2 }],
    desc: 'コンボが落ちるのを20%の確率で踏みとどまる',
  },
  {
    id: 'tr_combo_power', tier: 'basic', name: '連撃の呼吸', cost: 2, maxLevel: 4,
    effects: [{ kind: 'combo_power', value: 0.015 }],
    desc: 'コンボ1段あたりの倍率 +1.5%（上限に張り付いた後も効く）',
  },

  /* ===== 回復と防護 (§5.7) ===== */
  {
    id: 'tr_heal_power', tier: 'basic', name: '癒しの手', cost: 1, maxLevel: 5,
    effects: [{ kind: 'heal_power', value: 0.1 }],
    desc: '自分が行う回復量 +10%',
  },
  {
    id: 'tr_heal_kill', tier: 'basic', name: '戦場の糧', cost: 1, maxLevel: 5,
    effects: [{ kind: 'heal_on_kill', value: 0.03 }],
    desc: '敵を倒すたびに最大HPの3%を回復',
  },
  {
    id: 'tr_start_shield', tier: 'basic', name: '開幕の備え', cost: 1, maxLevel: 5,
    effects: [{ kind: 'start_shield', value: 0.04 }],
    desc: '戦闘開始時に最大HPの4%ぶんの障壁をまとう',
  },
  {
    id: 'tr_status_immune', tier: 'basic', name: '気丈', cost: 2, maxLevel: 4,
    effects: [{ kind: 'status_immune', value: 0.08 }],
    desc: '弱体を8%の確率で丸ごとはねのける',
  },

  /* ===== 隊列 (§5.7) =====
   * 編成画面の並び順に意味を持たせるための枝。
   * 前に置けば火力、後ろに置けば硬さ。同じキャラでも置き場所で役割が変わる。 */
  {
    id: 'tr_front_power', tier: 'basic', name: '先陣の誇り', cost: 2, maxLevel: 5,
    effects: [{ kind: 'front_power', value: 0.06 }],
    desc: '隊列が前にいるほど火力上昇（先頭で +6%、最後尾では効かない）',
  },
  {
    id: 'tr_back_guard', tier: 'basic', name: '後衛の心得', cost: 1, maxLevel: 5,
    effects: [{ kind: 'back_guard', value: 0.05 }],
    desc: '隊列が後ろにいるほど被ダメージ軽減（最後尾で -5%、先頭では効かない）',
  },

  /* ===== 戦況で積み上がる (§5.7) ===== */
  {
    id: 'tr_round_stack', tier: 'basic', name: '長期戦の理', cost: 2, maxLevel: 4,
    effects: [{ kind: 'round_stack', value: 0.05 }],
    desc: 'ラウンドが1つ進むごとに火力 +5%（刹那セットのちょうど裏返し）',
  },
  {
    id: 'tr_hit_stack', tier: 'basic', name: '痛みの記憶', cost: 2, maxLevel: 4,
    effects: [{ kind: 'hit_stack', value: 0.04 }],
    desc: '被弾するたびに火力 +4%（殴られ役の火力源）',
  },
  {
    id: 'tr_party_size', tier: 'basic', name: '連帯', cost: 2, maxLevel: 4,
    effects: [{ kind: 'party_size_power', value: 0.04 }],
    desc: '生きている味方1人につき火力 +4%（常世セットとは逆の発想）',
  },
  {
    id: 'tr_solo', tier: 'basic', name: '孤高', cost: 2, maxLevel: 3,
    effects: [{ kind: 'solo_power', value: 0.15 }],
    desc: '生き残りが自分だけのとき火力 +15%',
  },

  /* ===== 属性の噛み合い (§5.7) =====
   * 「有利を取れたとき」「等倍のとき」「突かれたとき」に分けてある。
   * どこを厚くするかで、属性パズルへの向き合い方が変わる。 */
  {
    id: 'tr_weak_hunter', tier: 'basic', name: '弱点狩り', cost: 2, maxLevel: 5,
    effects: [{ kind: 'weak_hunter', value: 0.08 }],
    desc: '素で属性有利を取れたとき 火力+8%（適応で有利化した攻撃には乗らない）',
  },
  {
    id: 'tr_neutral', tier: 'basic', name: '等倍の心得', cost: 1, maxLevel: 5,
    effects: [{ kind: 'neutral_power', value: 0.08 }],
    desc: '属性相性が等倍のとき 火力+8%（無属性ビルドと「混沌の力」の受け皿）',
  },
  {
    id: 'tr_weak_guard', tier: 'basic', name: '弱点耐性', cost: 1, maxLevel: 4,
    effects: [{ kind: 'weak_guard', value: 0.08 }],
    desc: '弱点を突かれたときの被ダメージ -8%',
  },

  /* ===== 初級で覚える技 (§5.7) ===== */
  {
    id: 'tr_grant_needle', tier: 'basic', name: '刺突の型', cost: 2, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_needle', value: 1 }],
    desc: 'アクティブ技「刺突」を習得（威力70%の小技。拡散・連射のパッシブが乗る）',
  },
  {
    id: 'tr_grant_spark', tier: 'basic', name: '火花の型', cost: 2, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_spark', value: 1 }],
    desc: 'アクティブ技「火花」を習得（威力60%の火属性小技）',
  },

  /* ===================================================================
   * 中級 — 初級で選んだ方向を「戦術」に変える段
   * =================================================================== */
  {
    id: 'tr_mono_element', tier: 'mid', name: '同色の絆', cost: 3, maxLevel: 4,
    effects: [{ kind: 'mono_element_power', value: 0.1 }],
    desc: 'パーティ全員が同じ属性のとき 火力+10%',
  },
  {
    id: 'tr_rainbow', tier: 'mid', name: '五色の陣', cost: 3, maxLevel: 4,
    effects: [{ kind: 'rainbow_power', value: 0.1 }],
    desc: 'パーティの属性が全員バラバラのとき 火力+10%',
  },
  {
    id: 'tr_crit_pierce', tier: 'mid', name: '会心貫通', cost: 3, maxLevel: 5,
    effects: [{ kind: 'crit_pierce', value: 0.2 }],
    desc: '会心したとき 防御を20%ぶん無視する',
  },
  {
    id: 'tr_first_hit_crit', tier: 'mid', name: '初手必中', cost: 4, maxLevel: 2,
    effects: [{ kind: 'first_hit_crit', value: 1 }],
    desc: 'ウェーブごとに、最初の攻撃1回が確定で会心になる',
  },
  {
    id: 'tr_overkill', tier: 'mid', name: '溢れる災禍', cost: 3, maxLevel: 4,
    effects: [{ kind: 'overkill_carry', value: 0.15 }],
    desc: '敵を倒したときの超過ダメージの15%を、次の一撃に上乗せする',
  },
  {
    id: 'tr_status_hit', tier: 'mid', name: '毒手', cost: 2, maxLevel: 4,
    effects: [{ kind: 'status_on_hit', value: 0.1 }],
    desc: '攻撃時 10%の確率で毒を付与する（状態異常技を持たなくても弱体ビルドに乗れる）',
  },
  {
    id: 'tr_kill_extra', tier: 'mid', name: '連鎖する死', cost: 4, maxLevel: 4,
    effects: [{ kind: 'kill_extra_action', value: 0.08 }],
    desc: '敵を倒したとき 8%の確率でもう一度行動できる',
  },
  {
    id: 'tr_low_hp_guard', tier: 'mid', name: '窮鼠', cost: 2, maxLevel: 4,
    effects: [{ kind: 'low_hp_guard', value: 0.1 }],
    desc: 'HPが減っているほど被ダメージ軽減（瀕死で -10%）。「背水」と組ませて崩れにくくする',
  },
  {
    id: 'tr_reflect', tier: 'mid', name: '鏡面', cost: 3, maxLevel: 4,
    effects: [{ kind: 'reflect', value: 0.08 }],
    desc: '受けたダメージの8%をそのまま相手へ返す（棘と違い、大技ほど返る）',
  },
  {
    id: 'tr_debuff_spread', tier: 'mid', name: '疫病の広がり', cost: 3, maxLevel: 4,
    effects: [{ kind: 'debuff_spread', value: 0.15 }],
    desc: '与えた弱体が 15%の確率で他の敵にも広がる',
  },
  {
    id: 'tr_element_all', tier: 'mid', name: '万象の心得', cost: 3, maxLevel: 5,
    effects: [{ kind: 'element_power', element: 'all', value: 0.02 }],
    desc: '全属性の攻撃 威力+2%（1属性に絞る「心得」より効率は悪いが腐らない）',
  },
  {
    id: 'tr_resist_all', tier: 'mid', name: '万象の護り', cost: 2, maxLevel: 5,
    effects: [{ kind: 'element_resist', element: 'all', value: 0.02 }],
    desc: '全属性で受けるダメージ -2%',
  },
  {
    id: 'tr_round_stack_mid', tier: 'mid', name: '不屈の持久', cost: 3, maxLevel: 4,
    effects: [{ kind: 'round_stack', value: 0.08 }],
    desc: 'ラウンドが1つ進むごとに火力 +8%',
  },
  {
    id: 'tr_hit_stack_mid', tier: 'mid', name: '怨嗟の蓄積', cost: 3, maxLevel: 4,
    effects: [{ kind: 'hit_stack', value: 0.07 }],
    desc: '被弾するたびに火力 +7%',
  },
  {
    id: 'tr_solo_mid', tier: 'mid', name: '独り立つ者', cost: 3, maxLevel: 3,
    effects: [{ kind: 'solo_power', value: 0.25 }],
    desc: '生き残りが自分だけのとき 火力+25%',
  },
  {
    id: 'tr_combo_power_mid', tier: 'mid', name: '連撃の極致', cost: 3, maxLevel: 4,
    effects: [{ kind: 'combo_power', value: 0.025 }],
    desc: 'コンボ1段あたりの倍率 +2.5%',
  },
  {
    id: 'tr_heal_power_mid', tier: 'mid', name: '大癒', cost: 2, maxLevel: 4,
    effects: [{ kind: 'heal_power', value: 0.18 }],
    desc: '自分が行う回復量 +18%',
  },
  {
    id: 'tr_start_shield_mid', tier: 'mid', name: '鉄壁の備え', cost: 2, maxLevel: 4,
    effects: [{ kind: 'start_shield', value: 0.07 }],
    desc: '戦闘開始時に最大HPの7%ぶんの障壁をまとう',
  },
  {
    id: 'tr_grant_lance', tier: 'mid', name: '穿つ型', cost: 3, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_lance', value: 1 }],
    desc: 'アクティブ技「烈槍」を習得（威力220%＋防御崩し2ターン）',
  },
  {
    id: 'tr_grant_frost', tier: 'mid', name: '凍える型', cost: 3, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_frost', value: 1 }],
    desc: 'アクティブ技「氷結の枷」を習得（防御崩壊と凍結を同時付与）',
  },
  {
    id: 'tr_grant_chain_bolt', tier: 'mid', name: '連雷の型', cost: 3, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_chain_bolt', value: 1 }],
    desc: 'アクティブ技「連雷」を習得（威力90%の全体攻撃。小技扱いなので連射が乗る）',
  },
  {
    id: 'tr_grant_mend', tier: 'mid', name: '治癒の型', cost: 3, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_mend', value: 1 }],
    desc: 'アクティブ技「再生の陣」を習得（味方全体を回復）',
  },

  /* ===================================================================
   * 上級 — ルールそのものを書き換える段
   * =================================================================== */
  {
    id: 'tr_dual_light', tier: 'high', name: '双極・聖', cost: 6, maxLevel: 1,
    effects: [{ kind: 'dual_element', element: 'light' }],
    desc: '攻撃を光属性でも相性判定し、良かったほうを採る（属性を固定する「誓い」とは別の解き方）',
  },
  {
    id: 'tr_dual_dark', tier: 'high', name: '双極・冥', cost: 6, maxLevel: 1,
    effects: [{ kind: 'dual_element', element: 'dark' }],
    desc: '攻撃を闇属性でも相性判定し、良かったほうを採る',
  },
  {
    id: 'tr_all_spread', tier: 'high', name: '遍く波紋', cost: 8, maxLevel: 1,
    effects: [{ kind: 'all_spread', value: 1 }],
    desc: '単体攻撃技がすべて敵全体に当たるようになる（威力の条件なし）',
  },
  {
    id: 'tr_overkill_hi', tier: 'high', name: '災禍の奔流', cost: 5, maxLevel: 3,
    effects: [{ kind: 'overkill_carry', value: 0.3 }],
    desc: '敵を倒したときの超過ダメージの30%を、次の一撃に上乗せする',
  },
  {
    id: 'tr_reflect_hi', tier: 'high', name: '鏡面の理', cost: 5, maxLevel: 3,
    effects: [{ kind: 'reflect', value: 0.15 }],
    desc: '受けたダメージの15%をそのまま相手へ返す',
  },
  {
    id: 'tr_kill_extra_hi', tier: 'high', name: '屍山血河', cost: 6, maxLevel: 3,
    effects: [{ kind: 'kill_extra_action', value: 0.15 }],
    desc: '敵を倒したとき 15%の確率でもう一度行動できる',
  },
  {
    id: 'tr_status_immune_hi', tier: 'high', name: '不動心', cost: 5, maxLevel: 3,
    effects: [{ kind: 'status_immune', value: 0.2 }],
    desc: '弱体を20%の確率で丸ごとはねのける',
  },
  {
    id: 'tr_grant_eclipse', tier: 'high', name: '蝕の型', cost: 5, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_eclipse', value: 1 }],
    desc: 'アクティブ技「日蝕」を習得（威力380%の全体攻撃）',
  },
  {
    id: 'tr_grant_gaia', tier: 'high', name: '大地の型', cost: 5, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_gaia', value: 1 }],
    desc: 'アクティブ技「地衝」を習得（威力420%・会心率18%の単体攻撃）',
  },
  {
    id: 'tr_grant_aegis', tier: 'high', name: '不落の型', cost: 5, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_aegis', value: 1 }],
    desc: 'アクティブ技「不落の誓い」を習得（味方全体の被ダメージを3ターン35%軽減）',
  },

  /* ===================================================================
   * §5.8 拡張分
   *
   * 中心にあるのは状態異常 (data/statuses.js)。
   * 6種類それぞれ効くタイミングが違うので、「どれを撒くか」がそのまま
   * パーティの削り方の選択になる。耐性・特効・付与の3ファミリーで展開してある。
   * =================================================================== */

  /* ===== 異常への耐性 (§5.8) =====
   * 持続を縮める。全部に効く「精神耐性」より、1種に絞るぶん1段が大きい。 */
  {
    id: 'tr_res_poison', tier: 'basic', name: '解毒の心得', cost: 1, maxLevel: 3,
    effects: [{ kind: 'status_resist_kind', status: 'poison', value: 1 }],
    desc: '自分が受ける毒の持続 -1ターン',
  },
  {
    id: 'tr_res_burn', tier: 'basic', name: '鎮火の心得', cost: 1, maxLevel: 3,
    effects: [{ kind: 'status_resist_kind', status: 'burn', value: 1 }],
    desc: '自分が受ける火傷の持続 -1ターン',
  },
  {
    id: 'tr_res_bleed', tier: 'basic', name: '止血の心得', cost: 1, maxLevel: 3,
    effects: [{ kind: 'status_resist_kind', status: 'bleed', value: 1 }],
    desc: '自分が受ける出血の持続 -1ターン',
  },
  {
    id: 'tr_res_paralyze', tier: 'basic', name: '解痺の心得', cost: 1, maxLevel: 3,
    effects: [{ kind: 'status_resist_kind', status: 'paralyze', value: 1 }],
    desc: '自分が受ける麻痺の持続 -1ターン',
  },
  {
    id: 'tr_res_freeze', tier: 'basic', name: '融解の心得', cost: 1, maxLevel: 3,
    effects: [{ kind: 'status_resist_kind', status: 'freeze', value: 1 }],
    desc: '自分が受ける凍結の持続 -1ターン',
  },
  {
    id: 'tr_res_curse', tier: 'basic', name: '祓いの心得', cost: 1, maxLevel: 3,
    effects: [{ kind: 'status_resist_kind', status: 'curse', value: 1 }],
    desc: '自分が受ける呪詛の持続 -1ターン',
  },

  /* ===== 異常への特効 (§5.8) =====
   * 「追い討ち」が異常の種類を問わないのに対し、こちらは種類を当てにいく。
   * 自分で撒くか、味方に撒いてもらうかで組み方が変わる。 */
  {
    id: 'tr_vs_poison', tier: 'basic', name: '毒喰らい', cost: 2, maxLevel: 4,
    effects: [{ kind: 'vs_status_power', status: 'poison', value: 0.07 }],
    desc: '毒にかかった敵への火力 +7%',
  },
  {
    id: 'tr_vs_burn', tier: 'basic', name: '灰均し', cost: 2, maxLevel: 4,
    effects: [{ kind: 'vs_status_power', status: 'burn', value: 0.07 }],
    desc: '火傷している敵への火力 +7%',
  },
  {
    id: 'tr_vs_bleed', tier: 'basic', name: '血の匂い', cost: 2, maxLevel: 4,
    effects: [{ kind: 'vs_status_power', status: 'bleed', value: 0.07 }],
    desc: '出血している敵への火力 +7%',
  },
  {
    id: 'tr_vs_paralyze', tier: 'basic', name: '好機', cost: 2, maxLevel: 4,
    effects: [{ kind: 'vs_status_power', status: 'paralyze', value: 0.07 }],
    desc: '麻痺している敵への火力 +7%',
  },
  {
    id: 'tr_vs_freeze', tier: 'basic', name: '砕氷', cost: 2, maxLevel: 4,
    effects: [{ kind: 'vs_status_power', status: 'freeze', value: 0.07 }],
    desc: '凍結している敵への火力 +7%',
  },
  {
    id: 'tr_vs_curse', tier: 'basic', name: '呪縛狩り', cost: 2, maxLevel: 4,
    effects: [{ kind: 'vs_status_power', status: 'curse', value: 0.07 }],
    desc: '呪詛にかかった敵への火力 +7%',
  },

  /* ===== 異常をついでに撒く (§5.8) =====
   * 撒く技を持っていなくても異常ビルドに乗れるようにする入口。
   * 強さは技で撒くぶんより控えめなので、これだけでは完成しない。 */
  {
    id: 'tr_hit_burn', tier: 'basic', name: '火だるま', cost: 2, maxLevel: 4,
    effects: [{ kind: 'status_on_hit_kind', status: 'burn', value: 0.08 }],
    desc: '攻撃時 8%の確率で火傷を付与（攻撃するたびに相手が焼ける）',
  },
  {
    id: 'tr_hit_bleed', tier: 'basic', name: '裂傷の心得', cost: 2, maxLevel: 4,
    effects: [{ kind: 'status_on_hit_kind', status: 'bleed', value: 0.08 }],
    desc: '攻撃時 8%の確率で出血を付与（相手が被弾するたびに傷が開く）',
  },
  {
    id: 'tr_hit_paralyze', tier: 'basic', name: '痺れの心得', cost: 2, maxLevel: 4,
    effects: [{ kind: 'status_on_hit_kind', status: 'paralyze', value: 0.06 }],
    desc: '攻撃時 6%の確率で麻痺を付与（相手の手番を奪う）',
  },
  {
    id: 'tr_hit_freeze', tier: 'basic', name: '凍える心得', cost: 2, maxLevel: 4,
    effects: [{ kind: 'status_on_hit_kind', status: 'freeze', value: 0.08 }],
    desc: '攻撃時 8%の確率で凍結を付与（味方全員の火力が上がる）',
  },
  {
    id: 'tr_hit_curse', tier: 'basic', name: '呪いの心得', cost: 2, maxLevel: 4,
    effects: [{ kind: 'status_on_hit_kind', status: 'curse', value: 0.08 }],
    desc: '攻撃時 8%の確率で呪詛を付与（相手の立て直しを止める）',
  },

  /* ===== 属性ごとの刃 (§5.8) =====
   * 会心率を属性で絞る。「一点集中」が全部乗せなので、そちらより1段が大きい。 */
  {
    id: 'tr_crit_fire', tier: 'basic', name: '紅蓮の刃', cost: 1, maxLevel: 4,
    effects: [{ kind: 'element_crit', element: 'fire', value: 0.05 }],
    desc: '火属性の攻撃 クリティカル率 +5%',
  },
  {
    id: 'tr_crit_water', tier: 'basic', name: '蒼波の刃', cost: 1, maxLevel: 4,
    effects: [{ kind: 'element_crit', element: 'water', value: 0.05 }],
    desc: '水属性の攻撃 クリティカル率 +5%',
  },
  {
    id: 'tr_crit_wind', tier: 'basic', name: '疾風の刃', cost: 1, maxLevel: 4,
    effects: [{ kind: 'element_crit', element: 'wind', value: 0.05 }],
    desc: '風属性の攻撃 クリティカル率 +5%',
  },
  {
    id: 'tr_crit_earth', tier: 'basic', name: '岩塊の刃', cost: 1, maxLevel: 4,
    effects: [{ kind: 'element_crit', element: 'earth', value: 0.05 }],
    desc: '土属性の攻撃 クリティカル率 +5%',
  },
  {
    id: 'tr_crit_light', tier: 'basic', name: '聖光の刃', cost: 1, maxLevel: 4,
    effects: [{ kind: 'element_crit', element: 'light', value: 0.05 }],
    desc: '光属性の攻撃 クリティカル率 +5%',
  },
  {
    id: 'tr_crit_dark', tier: 'basic', name: '常闇の刃', cost: 1, maxLevel: 4,
    effects: [{ kind: 'element_crit', element: 'dark', value: 0.05 }],
    desc: '闇属性の攻撃 クリティカル率 +5%',
  },

  /* ===== 系統ごとの冴え (§5.8) ===== */
  {
    id: 'tr_crit_phys', tier: 'basic', name: '武の冴え', cost: 1, maxLevel: 4,
    effects: [{ kind: 'tag_crit', tag: 'phys', value: 0.05 }],
    desc: '[物理]技のクリティカル率 +5%',
  },
  {
    id: 'tr_crit_magi', tier: 'basic', name: '術の冴え', cost: 1, maxLevel: 4,
    effects: [{ kind: 'tag_crit', tag: 'magi', value: 0.05 }],
    desc: '[魔術]技のクリティカル率 +5%',
  },
  {
    id: 'tr_crit_reli', tier: 'basic', name: '理の冴え', cost: 1, maxLevel: 4,
    effects: [{ kind: 'tag_crit', tag: 'reli', value: 0.05 }],
    desc: '[遺物]技のクリティカル率 +5%',
  },

  /* ===== ステータスの付け替え (§5.8) =====
   * 「命を刃に」の兄弟。どのステータスを何に化けさせるかで装備の選び方が変わる。 */
  {
    id: 'tr_def_to_atk', tier: 'basic', name: '守りを刃に', cost: 2, maxLevel: 4,
    effects: [{ kind: 'def_to_atk', value: 0.15 }],
    desc: 'DEFの15%をATKと魔力に上乗せ（防具で殴るビルド）',
  },
  {
    id: 'tr_atk_to_def', tier: 'basic', name: '攻めを盾に', cost: 2, maxLevel: 4,
    effects: [{ kind: 'atk_to_def', value: 0.15 }],
    desc: 'ATKの15%をDEFに上乗せ（武器で耐えるビルド）',
  },

  /* ===== バフと障壁の扱い (§5.8) ===== */
  {
    id: 'tr_buff_len', tier: 'basic', name: '持続の心得', cost: 2, maxLevel: 3,
    effects: [{ kind: 'buff_duration', value: 1 }],
    desc: '自分が受けるバフの持続 +1ターン',
  },
  {
    id: 'tr_buff_kill', tier: 'basic', name: '戦果の高揚', cost: 2, maxLevel: 4,
    effects: [{ kind: 'buff_on_kill', value: 0.06 }],
    desc: '敵を倒すたびに固有バフ +6%（3ターン）',
  },
  {
    id: 'tr_shield_regen', tier: 'basic', name: '障壁の再生', cost: 2, maxLevel: 4,
    effects: [{ kind: 'shield_regen', value: 0.025 }],
    desc: 'ラウンド終了時に最大HPの2.5%ぶんの障壁を張り直す',
  },

  /* ===== 手の選び方 (§5.8) =====
   * 同じ技を続けるか、撃ち分けるか。どちらかに寄せる枝で、両取りには向かない。 */
  {
    id: 'tr_repeat', tier: 'basic', name: '一意専心', cost: 2, maxLevel: 4,
    effects: [{ kind: 'repeat_power', value: 0.07 }],
    desc: '同じ技を続けるたびに火力 +7%（技を変えると1に戻る）',
  },
  {
    id: 'tr_variety', tier: 'basic', name: '変幻自在', cost: 2, maxLevel: 4,
    effects: [{ kind: 'variety_power', value: 0.08 }],
    desc: '直前と違う技を使ったとき 火力+8%',
  },
  {
    id: 'tr_high_boost', tier: 'basic', name: '大技の心得', cost: 2, maxLevel: 4,
    effects: [{ kind: 'high_power_boost', value: 0.06 }],
    desc: '威力200%以上の技の火力 +6%（小技の底上げとは重ならない）',
  },

  /* ===== 会心・反撃・波及の枝 (§5.8) ===== */
  {
    id: 'tr_crit_stack', tier: 'basic', name: '熱狂', cost: 2, maxLevel: 4,
    effects: [{ kind: 'crit_stack', value: 0.03 }],
    desc: '会心するたびにクリティカル率 +3%（戦闘が終わると戻る）',
  },
  {
    id: 'tr_crit_exec', tier: 'basic', name: '会心の追い打ち', cost: 2, maxLevel: 4,
    effects: [{ kind: 'crit_execute', value: 0.2 }],
    desc: '会心したときの追い打ちの効き +20%',
  },
  {
    id: 'tr_counter_power', tier: 'basic', name: '反撃の心得', cost: 2, maxLevel: 4,
    effects: [{ kind: 'counter_power', value: 0.1 }],
    desc: '反撃の威力 +10%',
  },
  {
    id: 'tr_chain_power', tier: 'basic', name: '波及の心得', cost: 2, maxLevel: 4,
    effects: [{ kind: 'chain_power', value: 0.12 }],
    desc: '波及の余波の威力 +12%',
  },

  /* ===== 戦況の読み (§5.8) ===== */
  {
    id: 'tr_boss_guard', tier: 'basic', name: '巨獣への備え', cost: 2, maxLevel: 4,
    effects: [{ kind: 'boss_guard', value: 0.05 }],
    desc: 'ボスから受けるダメージ -5%',
  },
  {
    id: 'tr_full_hp_foe', tier: 'basic', name: '不意打ち', cost: 2, maxLevel: 4,
    effects: [{ kind: 'full_hp_foe_power', value: 0.08 }],
    desc: 'HPが減っていない敵への火力 +8%（追い打ちのちょうど裏返し）',
  },
  {
    id: 'tr_wave_power', tier: 'basic', name: '大詰めの気迫', cost: 2, maxLevel: 4,
    effects: [{ kind: 'wave_power', value: 0.07 }],
    desc: '最終ウェーブ（ボス戦）での火力 +7%',
  },
  {
    id: 'tr_damage_share', tier: 'basic', name: '痛みの分配', cost: 2, maxLevel: 4,
    effects: [{ kind: 'damage_share', value: 0.08 }],
    desc: '受けたダメージの8%を味方全員で分けて背負う（全体攻撃に強い）',
  },
  {
    id: 'tr_wave_revive', tier: 'basic', name: '不撓', cost: 3, maxLevel: 3,
    effects: [{ kind: 'wave_revive', value: 0.15 }],
    desc: 'ウェーブが変わるとき、倒れていてもHP15%で立ち上がる',
  },

  /* ===== 初級で覚える技 (§5.8) ===== */
  {
    id: 'tr_grant_ember', tier: 'basic', name: '焼き付けの型', cost: 2, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_ember', value: 1 }],
    desc: 'アクティブ技「燻り」を習得（火傷を付与する小技）',
  },
  {
    id: 'tr_grant_gash', tier: 'basic', name: '切り裂きの型', cost: 2, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_gash', value: 1 }],
    desc: 'アクティブ技「抉り」を習得（出血を付与する小技）',
  },
  {
    id: 'tr_grant_curse', tier: 'basic', name: '呪縛の型', cost: 2, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_curse', value: 1 }],
    desc: 'アクティブ技「呪縛」を習得（呪詛を付与し、回復を止める）',
  },

  /* ===================================================================
   * 中級 (§5.8)
   * =================================================================== */
  {
    id: 'tr_vs_poison_mid', tier: 'mid', name: '毒の見極め', cost: 3, maxLevel: 4,
    effects: [{ kind: 'vs_status_power', status: 'poison', value: 0.12 }],
    desc: '毒にかかった敵への火力 +12%',
  },
  {
    id: 'tr_vs_burn_mid', tier: 'mid', name: '業火の見極め', cost: 3, maxLevel: 4,
    effects: [{ kind: 'vs_status_power', status: 'burn', value: 0.12 }],
    desc: '火傷している敵への火力 +12%',
  },
  {
    id: 'tr_vs_bleed_mid', tier: 'mid', name: '流血の見極め', cost: 3, maxLevel: 4,
    effects: [{ kind: 'vs_status_power', status: 'bleed', value: 0.12 }],
    desc: '出血している敵への火力 +12%',
  },
  {
    id: 'tr_vs_paralyze_mid', tier: 'mid', name: '硬直の見極め', cost: 3, maxLevel: 4,
    effects: [{ kind: 'vs_status_power', status: 'paralyze', value: 0.12 }],
    desc: '麻痺している敵への火力 +12%',
  },
  {
    id: 'tr_vs_freeze_mid', tier: 'mid', name: '氷解の見極め', cost: 3, maxLevel: 4,
    effects: [{ kind: 'vs_status_power', status: 'freeze', value: 0.12 }],
    desc: '凍結している敵への火力 +12%',
  },
  {
    id: 'tr_hit_burn_mid', tier: 'mid', name: '業火の伝播', cost: 3, maxLevel: 4,
    effects: [{ kind: 'status_on_hit_kind', status: 'burn', value: 0.14 }],
    desc: '攻撃時 14%の確率で火傷を付与',
  },
  {
    id: 'tr_hit_bleed_mid', tier: 'mid', name: '流血の伝播', cost: 3, maxLevel: 4,
    effects: [{ kind: 'status_on_hit_kind', status: 'bleed', value: 0.14 }],
    desc: '攻撃時 14%の確率で出血を付与',
  },
  {
    id: 'tr_hit_paralyze_mid', tier: 'mid', name: '硬直の伝播', cost: 4, maxLevel: 4,
    effects: [{ kind: 'status_on_hit_kind', status: 'paralyze', value: 0.10 }],
    desc: '攻撃時 10%の確率で麻痺を付与',
  },
  {
    id: 'tr_hit_freeze_mid', tier: 'mid', name: '氷結の伝播', cost: 3, maxLevel: 4,
    effects: [{ kind: 'status_on_hit_kind', status: 'freeze', value: 0.14 }],
    desc: '攻撃時 14%の確率で凍結を付与',
  },
  {
    id: 'tr_hit_curse_mid', tier: 'mid', name: '呪詛の伝播', cost: 3, maxLevel: 4,
    effects: [{ kind: 'status_on_hit_kind', status: 'curse', value: 0.14 }],
    desc: '攻撃時 14%の確率で呪詛を付与',
  },

  /* ===== 系統ごとの貫通 (§5.8) =====
   * 「防御崩し」が確率で全部抜くのに対し、こちらは確定で少しずつ抜く。 */
  {
    id: 'tr_pierce_phys', tier: 'mid', name: '武の徹し', cost: 3, maxLevel: 4,
    effects: [{ kind: 'tag_pierce', tag: 'phys', value: 0.06 }],
    desc: '[物理]技が防御を6%ぶん無視する',
  },
  {
    id: 'tr_pierce_magi', tier: 'mid', name: '術の徹し', cost: 3, maxLevel: 4,
    effects: [{ kind: 'tag_pierce', tag: 'magi', value: 0.06 }],
    desc: '[魔術]技が防御を6%ぶん無視する',
  },
  {
    id: 'tr_pierce_reli', tier: 'mid', name: '理の徹し', cost: 3, maxLevel: 4,
    effects: [{ kind: 'tag_pierce', tag: 'reli', value: 0.06 }],
    desc: '[遺物]技が防御を6%ぶん無視する',
  },

  /* ===== 中級の単発 (§5.8) ===== */
  {
    id: 'tr_crit_spread', tier: 'mid', name: '会心の余波', cost: 4, maxLevel: 4,
    effects: [{ kind: 'crit_spread', value: 0.12 }],
    desc: '会心したとき、与ダメージの12%が他の敵全員にも及ぶ',
  },
  {
    id: 'tr_counter_all', tier: 'mid', name: '反撃の嵐', cost: 4, maxLevel: 3,
    effects: [{ kind: 'counter_all', value: 0.25 }],
    desc: '反撃が、殴ってきた相手以外にも25%の威力で飛ぶ',
  },
  {
    id: 'tr_def_to_atk_mid', tier: 'mid', name: '鉄血', cost: 3, maxLevel: 4,
    effects: [{ kind: 'def_to_atk', value: 0.25 }],
    desc: 'DEFの25%をATKと魔力に上乗せ',
  },
  {
    id: 'tr_atk_to_def_mid', tier: 'mid', name: '剛体', cost: 3, maxLevel: 4,
    effects: [{ kind: 'atk_to_def', value: 0.25 }],
    desc: 'ATKの25%をDEFに上乗せ',
  },
  {
    id: 'tr_buff_len_mid', tier: 'mid', name: '長息', cost: 3, maxLevel: 3,
    effects: [{ kind: 'buff_duration', value: 1 }],
    desc: '自分が受けるバフの持続 +1ターン',
  },
  {
    id: 'tr_buff_kill_mid', tier: 'mid', name: '連勝の勢い', cost: 3, maxLevel: 4,
    effects: [{ kind: 'buff_on_kill', value: 0.11 }],
    desc: '敵を倒すたびに固有バフ +11%（3ターン）',
  },
  {
    id: 'tr_shield_regen_mid', tier: 'mid', name: '不断の障壁', cost: 3, maxLevel: 4,
    effects: [{ kind: 'shield_regen', value: 0.045 }],
    desc: 'ラウンド終了時に最大HPの4.5%ぶんの障壁を張り直す',
  },
  {
    id: 'tr_repeat_mid', tier: 'mid', name: '一心不乱', cost: 3, maxLevel: 4,
    effects: [{ kind: 'repeat_power', value: 0.12 }],
    desc: '同じ技を続けるたびに火力 +12%',
  },
  {
    id: 'tr_variety_mid', tier: 'mid', name: '千手', cost: 3, maxLevel: 4,
    effects: [{ kind: 'variety_power', value: 0.13 }],
    desc: '直前と違う技を使ったとき 火力+13%',
  },
  {
    id: 'tr_high_boost_mid', tier: 'mid', name: '大技の極意', cost: 3, maxLevel: 4,
    effects: [{ kind: 'high_power_boost', value: 0.11 }],
    desc: '威力200%以上の技の火力 +11%',
  },
  {
    id: 'tr_crit_stack_mid', tier: 'mid', name: '狂騒', cost: 3, maxLevel: 4,
    effects: [{ kind: 'crit_stack', value: 0.05 }],
    desc: '会心するたびにクリティカル率 +5%',
  },
  {
    id: 'tr_crit_exec_mid', tier: 'mid', name: '会心の追撃', cost: 3, maxLevel: 4,
    effects: [{ kind: 'crit_execute', value: 0.35 }],
    desc: '会心したときの追い打ちの効き +35%',
  },
  {
    id: 'tr_chain_power_mid', tier: 'mid', name: '大波及', cost: 3, maxLevel: 4,
    effects: [{ kind: 'chain_power', value: 0.2 }],
    desc: '波及の余波の威力 +20%',
  },
  {
    id: 'tr_counter_power_mid', tier: 'mid', name: '反撃の極意', cost: 3, maxLevel: 4,
    effects: [{ kind: 'counter_power', value: 0.18 }],
    desc: '反撃の威力 +18%',
  },
  {
    id: 'tr_boss_guard_mid', tier: 'mid', name: '巨獣殺しの構え', cost: 3, maxLevel: 4,
    effects: [{ kind: 'boss_guard', value: 0.08 }],
    desc: 'ボスから受けるダメージ -8%',
  },
  {
    id: 'tr_full_hp_foe_mid', tier: 'mid', name: '先制打', cost: 3, maxLevel: 4,
    effects: [{ kind: 'full_hp_foe_power', value: 0.13 }],
    desc: 'HPが減っていない敵への火力 +13%',
  },
  {
    id: 'tr_wave_power_mid', tier: 'mid', name: '決戦の気迫', cost: 3, maxLevel: 4,
    effects: [{ kind: 'wave_power', value: 0.12 }],
    desc: '最終ウェーブ（ボス戦）での火力 +12%',
  },
  {
    id: 'tr_damage_share_mid', tier: 'mid', name: '絆の盾', cost: 3, maxLevel: 4,
    effects: [{ kind: 'damage_share', value: 0.12 }],
    desc: '受けたダメージの12%を味方全員で分けて背負う',
  },
  {
    id: 'tr_wave_revive_mid', tier: 'mid', name: '不屈の魂', cost: 4, maxLevel: 3,
    effects: [{ kind: 'wave_revive', value: 0.3 }],
    desc: 'ウェーブが変わるとき、倒れていてもHP30%で立ち上がる',
  },
  {
    id: 'tr_res_all', tier: 'mid', name: '万象の胆力', cost: 3, maxLevel: 2,
    effects: [{ kind: 'status_resist_kind', status: 'all', value: 1 }],
    desc: '全種類の弱体の持続 -1ターン',
  },
  {
    id: 'tr_grant_shatter', tier: 'mid', name: '砕きの型', cost: 3, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_shatter', value: 1 }],
    desc: 'アクティブ技「氷砕」を習得（凍結を付与し、凍結中の敵に強い大技）',
  },
  {
    id: 'tr_grant_numb', tier: 'mid', name: '痺れの型', cost: 3, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_numb', value: 1 }],
    desc: 'アクティブ技「雷縛」を習得（麻痺を付与する全体技）',
  },
  {
    id: 'tr_grant_plague', tier: 'mid', name: '疫の型', cost: 4, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_plague', value: 1 }],
    desc: 'アクティブ技「万病」を習得（毒・火傷・出血をまとめて付与）',
  },
  {
    id: 'tr_grant_smash', tier: 'mid', name: '渾身の型', cost: 3, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_smash', value: 1 }],
    desc: 'アクティブ技「渾身撃」を習得（威力280%。大技の底上げが乗る）',
  },

  /* ===================================================================
   * 上級 (§5.8)
   * =================================================================== */
  {
    id: 'tr_mastery_all', tier: 'high', name: '万象の極意', cost: 6, maxLevel: 3,
    effects: [{ kind: 'element_mastery', element: 'all', value: 0.1 }],
    desc: '全属性の有利倍率 +0.1（1.5 → 最大1.8）',
  },
  {
    id: 'tr_crit_spread_hi', tier: 'high', name: '会心の連鎖', cost: 5, maxLevel: 3,
    effects: [{ kind: 'crit_spread', value: 0.22 }],
    desc: '会心したとき、与ダメージの22%が他の敵全員にも及ぶ',
  },
  {
    id: 'tr_counter_all_hi', tier: 'high', name: '反撃の理', cost: 5, maxLevel: 2,
    effects: [{ kind: 'counter_all', value: 0.4 }],
    desc: '反撃が、殴ってきた相手以外にも40%の威力で飛ぶ',
  },
  {
    id: 'tr_repeat_hi', tier: 'high', name: '究極の一手', cost: 5, maxLevel: 3,
    effects: [{ kind: 'repeat_power', value: 0.2 }],
    desc: '同じ技を続けるたびに火力 +20%',
  },
  {
    id: 'tr_variety_hi', tier: 'high', name: '万華の理', cost: 5, maxLevel: 3,
    effects: [{ kind: 'variety_power', value: 0.22 }],
    desc: '直前と違う技を使ったとき 火力+22%',
  },
  {
    id: 'tr_high_boost_hi', tier: 'high', name: '覇道', cost: 5, maxLevel: 3,
    effects: [{ kind: 'high_power_boost', value: 0.2 }],
    desc: '威力200%以上の技の火力 +20%',
  },
  {
    id: 'tr_crit_stack_hi', tier: 'high', name: '熱狂の極致', cost: 5, maxLevel: 3,
    effects: [{ kind: 'crit_stack', value: 0.08 }],
    desc: '会心するたびにクリティカル率 +8%',
  },
  {
    id: 'tr_damage_share_hi', tier: 'high', name: '一蓮托生', cost: 5, maxLevel: 3,
    effects: [{ kind: 'damage_share', value: 0.18 }],
    desc: '受けたダメージの18%を味方全員で分けて背負う',
  },
  {
    id: 'tr_wave_revive_hi', tier: 'high', name: '輪廻', cost: 6, maxLevel: 2,
    effects: [{ kind: 'wave_revive', value: 0.6 }],
    desc: 'ウェーブが変わるとき、倒れていてもHP60%で立ち上がる',
  },
  {
    id: 'tr_hit_all_status', tier: 'high', name: '万病の理', cost: 8, maxLevel: 3,
    effects: [{ kind: 'status_on_hit_kind', status: 'all', value: 0.06 }],
    desc: '攻撃時 6%の確率で**全種類**の弱体をそれぞれ付与する',
  },
  {
    id: 'tr_vs_all_status', tier: 'high', name: '弱者狩り', cost: 6, maxLevel: 3,
    effects: [{ kind: 'vs_status_power', status: 'all', value: 0.08 }],
    desc: '弱体にかかった敵への火力 +8%（種類ごとに重なる）',
  },
  {
    id: 'tr_def_to_atk_hi', tier: 'high', name: '鉄血の理', cost: 5, maxLevel: 3,
    effects: [{ kind: 'def_to_atk', value: 0.4 }],
    desc: 'DEFの40%をATKと魔力に上乗せ',
  },
  {
    id: 'tr_grant_ragnarok', tier: 'high', name: '終焉の型', cost: 6, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_ragnarok', value: 1 }],
    desc: 'アクティブ技「終焉」を習得（威力520%。大技ビルドの到達点）',
  },
  {
    id: 'tr_grant_glacier', tier: 'high', name: '氷河の型', cost: 5, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_glacier', value: 1 }],
    desc: 'アクティブ技「氷河期」を習得（全体に凍結を付与し、味方全員の火力を上げる）',
  },
  {
    id: 'tr_grant_purge', tier: 'high', name: '浄化の型', cost: 5, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_purge', value: 1 }],
    desc: 'アクティブ技「浄化」を習得（味方全体を回復し、障壁を張る）',
  },
  {
    id: 'tr_grant_vengeance', tier: 'high', name: '報復の型', cost: 5, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_vengeance', value: 1 }],
    desc: 'アクティブ技「報復」を習得（被弾回数が多いほど威力が伸びる）',
  },
];
