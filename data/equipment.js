// 装備・宝箱カタログ (§7)
// 戦闘では「宝箱ID + 個数」だけを加算し、実際の装備は拠点の鑑定で生成する (§2.2 / §7.2)。

/**
 * 宝箱グレード。stat_mult が高いほど強い装備が出る。
 * グレード間の倍率は約2倍ずつに揃えてある（急に跳ねると成長が段差になるため）。
 */
RPG.data.boxes = {
  box_bronze: {
    name: '銅の宝箱', color: '#c98a5a', stat_mult: 1.0,
    rarity_weights: { COMMON: 70, RARE: 25, SUPER_RARE: 5, LEGEND: 0 },
  },
  box_silver: {
    name: '銀の宝箱', color: '#c6cdd6', stat_mult: 2.0,
    rarity_weights: { COMMON: 35, RARE: 45, SUPER_RARE: 18, LEGEND: 2 },
  },
  box_gold: {
    name: '金の宝箱', color: '#f0c14b', stat_mult: 4.0,
    rarity_weights: { COMMON: 5, RARE: 35, SUPER_RARE: 45, LEGEND: 15 },
  },
  box_dragon: {
    name: '竜の宝箱', color: '#ff7a4d', stat_mult: 7.5,
    rarity_weights: { COMMON: 0, RARE: 8, SUPER_RARE: 42, LEGEND: 50 },
  },
  // 竜より上位。ここからは「数値を伸ばす装備」ではなく、
  // ビルドの方向性を変えるユニーク装備 (§7.8) が主に出る。
  // 素の数値は竜と大差ないので、効果を活かせない構成なら竜のほうが強い。
  box_astral: {
    name: '星辰の宝箱', color: '#cfe3f0', stat_mult: 8.5,
    rarity_weights: { COMMON: 0, RARE: 0, SUPER_RARE: 25, LEGEND: 75 },
  },
};

/**
 * 道具 (§6.5)。装備とは別枠で、個数だけを数える。
 *
 * いまは「レベル上限を伸ばすもの」だけ。増やすときは、
 * ここに1行足して use() に効果を書けば、所持と使用のUIは共通で動く。
 */
RPG.data.items = {
  it_star_shard: {
    name: '星霜の欠片', color: '#9fd8ff', icon: '星',
    // 1個で上限がいくつ伸びるか
    levelCap: 10,
    desc: '使うと、全キャラクターのレベル上限が10上がる。何度でも使える。'
      + '鍛冶では、装備の副オプションを枠ごとに引き直す代金にもなる。',
    from: '闘技場の初回制覇と、ハードモードの戦利品',
  },
};

/** 装備レアリティごとの副オプション数と、主ステータスの倍率。 */
RPG.data.equipRarities = {
  COMMON:     { affixes: 1, main_mult: 1.00 },
  RARE:       { affixes: 2, main_mult: 1.25 },
  SUPER_RARE: { affixes: 3, main_mult: 1.60 },
  LEGEND:     { affixes: 4, main_mult: 2.10 },
};

/**
 * 装備ベース。slot は 'weapon' | 'armor' | 'accessory'。
 * tag は [物理]=phys / [魔術]=magi / [遺物]=reli の系統タグ (§7.3)。
 * main は Lv1 換算の主ステータス範囲（宝箱の stat_mult で拡大される）。
 */
RPG.data.equipBases = {
  eq_longsword:  { name: 'ロングソード',   slot: 'weapon',    tag: 'phys', main: { atk: [14, 22] } },
  eq_greataxe:   { name: 'グレートアクス', slot: 'weapon',    tag: 'phys', main: { atk: [18, 28] } },
  eq_rod:        { name: '魔導のロッド',   slot: 'weapon',    tag: 'magi', main: { magi_power: [15, 24] } },
  eq_grimoire:   { name: '禁書の写本',     slot: 'weapon',    tag: 'magi', main: { magi_power: [18, 27] } },
  eq_relic_claw: { name: '遺跡の爪',       slot: 'weapon',    tag: 'reli', main: { atk: [10, 16], magi_power: [10, 16] } },

  eq_plate:      { name: 'プレートメイル', slot: 'armor',     tag: 'phys', main: { def: [12, 20], hp: [40, 70] } },
  eq_robe:       { name: '術士のローブ',   slot: 'armor',     tag: 'magi', main: { def: [6, 11], magi_power: [8, 14] } },
  eq_relic_mail: { name: '古代の鎖帷子',   slot: 'armor',     tag: 'reli', main: { def: [9, 15], hp: [30, 55] } },

  eq_ring:       { name: '闘士の指輪',     slot: 'accessory', tag: 'phys', main: { atk: [7, 12] } },
  eq_amulet:     { name: '賢者の護符',     slot: 'accessory', tag: 'magi', main: { magi_power: [7, 12] } },
  eq_relic_core: { name: '遺物のコア',     slot: 'accessory', tag: 'reli', main: { hp: [25, 45] } },
  eq_relic_seal: { name: '封印の紋章',     slot: 'accessory', tag: 'reli', main: { def: [5, 9] } },
};

/**
 * 副オプション（アフィックス）のプール。
 * kind:
 *   'stat'      → 平坦なステータス加算。宝箱の stat_mult でそのまま拡大。
 *   'tag_bonus' → 系統タグ倍率への加算 (§3.2 ステップ2)。拡大は緩やか。
 *   'crit'      → クリティカル率加算。
 *   'cap_break' → ダメージ上限突破率 (§3.2 ステップ8)。
 * match_type を持つものは、スキルの damage_type が一致したときだけ乗る。
 */
RPG.data.affixes = [
  { id: 'af_atk',   name: '攻撃力',   kind: 'stat', stat: 'atk',        range: [6, 13],  weight: 12 },
  { id: 'af_magi',  name: '魔力',     kind: 'stat', stat: 'magi_power', range: [6, 13],  weight: 12 },
  { id: 'af_def',   name: '防御力',   kind: 'stat', stat: 'def',        range: [5, 11],  weight: 10 },
  { id: 'af_hp',    name: '最大HP',   kind: 'stat', stat: 'hp',         range: [30, 65], weight: 10 },

  { id: 'af_tag_phys', name: '[物理]系統', kind: 'tag_bonus', tag: 'phys', range: [0.06, 0.18], weight: 8 },
  { id: 'af_tag_magi', name: '[魔術]系統', kind: 'tag_bonus', tag: 'magi', range: [0.06, 0.18], weight: 8 },
  { id: 'af_tag_reli', name: '[遺物]系統', kind: 'tag_bonus', tag: 'reli', range: [0.06, 0.18], weight: 8 },

  { id: 'af_tag_phys_only', name: '[物理]系統(物理技限定)', kind: 'tag_bonus', tag: 'phys', match_type: 'phys', range: [0.14, 0.32], weight: 4 },
  { id: 'af_tag_magi_only', name: '[魔術]系統(魔術技限定)', kind: 'tag_bonus', tag: 'magi', match_type: 'magi', range: [0.14, 0.32], weight: 4 },

  { id: 'af_crit',      name: 'クリティカル率', kind: 'crit',      range: [0.02, 0.07], weight: 6 },
  { id: 'af_cap_break', name: 'ダメージ上限突破', kind: 'cap_break', range: [0.04, 0.12], weight: 3 },
  // 被ダメージ軽減 (§3.1-3)。スキルツリーの軽減と加算され、合計100%で無敵になる。
  { id: 'af_reduction', name: '被ダメージ軽減', kind: 'reduction', range: [0.02, 0.06], weight: 4 },
];

/** 装備名に付く接頭辞。演出用のフレーバーで、性能には影響しない。 */
RPG.data.equipPrefixes = {
  COMMON:     ['粗製の', '使い古した', '無銘の'],
  RARE:       ['鍛えられた', '銀装の', '風纏う'],
  SUPER_RARE: ['業火の', '深淵の', '雷霆の', '星霜の'],
  LEGEND:     ['覇王の', '終焉の', '天穹の'],
};
