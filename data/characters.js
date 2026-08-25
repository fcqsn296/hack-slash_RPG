// キャラクターカタログ (§8, §9.2)
// スキルは ID 参照（リレーショナル方式）。ここに追記するだけでキャラが増える。
//
// base   : Lv1 時点のステータス
// growth : 1レベルごとの上昇量（Lv N のステータス = base + growth * (N - 1)）
// color / accent : アートの背景グラデーションに使う色
// glyph  : アートを描けない場合のフォールバック表示
//
// art : キャラクターアートの生成パラメータ (§1.3)。src/ui/art.js がこれを読んでSVGを組み立てる。
//   gender     'male' | 'female'  … 主人公のみ男性、他は全員美少女で統一
//   hair       'long' | 'twin' | 'bob' | 'ponytail' | 'hime' | 'wavy' | 'crop'
//   accessory  'ribbon' | 'halo' | 'horn' | 'visor' | 'hairpin' | 'circlet' | 'none'
//   expression 'calm' | 'gentle' | 'fierce' | 'cool' | 'smug'
//   image / standeeImage … 本番イラストを用意した場合はここにパスを入れる。
//                          指定があればSVG生成より優先される（コード変更不要）。
RPG.data.characters = {
  ch_hero: {
    // fixed: true のキャラはガチャの排出プールに入らない (§8.1 主人公は固定配置)
    fixed: true,
    // 主人公の名前はプレイヤーが自由に入力する。これは初期値 (§8.1)
    defaultName: 'アルト',
    nameEditable: true,
    // 【無属性】灰でも虹でも銀でもない、どの理にも属さない管理者 (§19)。
    //
    // ここはキャラクター側の属性、つまり **受ける側の相性** を決める。
    // 攻める側は技ごとの element を見るので、固有技（覇王斬・聖癒の光）は
    // 光のまま残してある。銀が光を返した結果として刃が光を帯びる、という筋。
    //
    // 光のままだと闇属性の攻撃を1.5倍で受けていた。闇は敵28種のうち7種で最多。
    // 無属性にすると、その弱点だけが消える（実測 6,620 → 4,413）。
    // 与えるダメージは技側なので変わらない。
    name: 'アルト', title: '灰銀の継承者', rarity: 'LEGEND', element: 'none',
    base: { hp: 900, atk: 130, def: 65, magi_power: 100 },
    growth: { hp: 62, atk: 9.5, def: 4.2, magi_power: 7.0 },
    // §8.1 主人公のみ「攻撃系＋回復系」の2つの固有技を持つ
    unique_skills: ['sk_hero_slash', 'sk_hero_heal'],
    common_skills: ['sk_slash', 'sk_magic_blade', 'sk_focus'],
    // 【特殊】主人公だけは限界突破できず、その分ボーナスSPも得られない (§6.3/§6.5)。
    // 代わりに「凸で伸びない代わりに、育てるほど伸びる」形の固有パッシブで差を埋める。
    //   mirrorStat  … 攻撃力と魔力の高い方に、低い方を揃える。
    //                 物理と魔術を両方使える主人公だけが活かせる (§8.1)
    //   levelPower  … レベル×0.5% の火力上昇。Lv100 で +50%
    passives: { mirrorStat: 1, levelPower: 0.005 },
    color: '#f2c66a', accent: '#3b2f14', glyph: '継',
    art: {
      // 立ち絵から自動計測（tools/detect_faces.py）。調整は test/art.html から。
      face: { x: 0.5084, y: 0.1123, size: 0.3639 },
      gender: 'male', hair: 'crop', expression: 'cool', accessory: 'none',
      hairColor: '#c9ccd6', hairLight: '#eef1f6', hairDark: '#6d7381',
      eye: '#e8b23c', eyeLight: '#ffe08a',
      outfit: '#232a3a', outfitLight: '#39435c', outfitTrim: '#e8c06a',
      accentColor: '#e8c06a',
    },
    desc: '【特殊】限界突破できない代わりに、攻撃力と魔力が高い方に揃い、' +
      'レベルが上がるほど火力が伸びる。物理も魔術も担える万能型。',
  },
  ch_rizel: {
    name: 'リゼル', title: '緋炎の術師', rarity: 'SUPER_RARE', element: 'fire',
    base: { hp: 620, atk: 60, def: 38, magi_power: 145 },
    growth: { hp: 40, atk: 3.0, def: 2.4, magi_power: 11.0 },
    unique_skills: ['sk_rizel_surge'],
    common_skills: ['sk_fire_bolt', 'sk_stone_press', 'sk_mind_bash'],
    color: '#ee684a', accent: '#48251d', glyph: '緋',
    art: {
      // 立ち絵から切り出す顔の範囲（画像サイズに対する割合）
      face: { x: 0.4712, y: 0.1317, size: 0.3185 },
      gender: 'female', hair: 'twin', expression: 'smug', accessory: 'ribbon',
      hairColor: '#f0503f', hairLight: '#ff8a72', hairDark: '#8c2018',
      eye: '#ffb648', eyeLight: '#ffe6a8',
      outfit: '#3a1218', outfitLight: '#5e2028', outfitTrim: '#ffb648',
      accentColor: '#ffb648',
    },
    desc: '純粋な魔力アタッカー。火属性で風の敵を焼き払う。',
  },
  ch_gald: {
    name: 'シャルロッテ', title: '巌盾の守護者', rarity: 'RARE', element: 'earth',
    base: { hp: 1150, atk: 95, def: 110, magi_power: 45 },
    growth: { hp: 82, atk: 6.0, def: 7.5, magi_power: 2.5 },
    unique_skills: ['sk_gald_bulwark'],
    common_skills: ['sk_heavy_slash', 'sk_armor_break', 'sk_phys_roar'],
    color: '#e5e4dd', accent: '#464543', glyph: '巌',
    art: {
      // 立ち絵から切り出す顔の範囲（画像サイズに対する割合）
      face: { x: 0.5096, y: 0.1153, size: 0.3185 },
      gender: 'female', hair: 'ponytail', expression: 'calm', accessory: 'circlet',
      hairColor: '#d8b477', hairLight: '#f2d9a8', hairDark: '#846030',
      eye: '#7ad19a', eyeLight: '#c4f0d6',
      outfit: '#4a4038', outfitLight: '#6b5c4e', outfitTrim: '#d8b477',
      accentColor: '#e8d4a0',
    },
    desc: '高HP・高DEFの前衛。破鎧撃で敵の防御を無効化できる。',
  },
  ch_shiki: {
    name: 'シキ', title: '疾風の刃', rarity: 'SUPER_RARE', element: 'wind',
    base: { hp: 660, atk: 140, def: 42, magi_power: 55 },
    growth: { hp: 44, atk: 10.5, def: 2.8, magi_power: 3.0 },
    unique_skills: ['sk_shiki_flurry'],
    common_skills: ['sk_double_strike', 'sk_gale_edge', 'sk_poison_fang'],
    color: '#91c7de', accent: '#2f3d43', glyph: '疾',
    art: {
      // 立ち絵から切り出す顔の範囲（画像サイズに対する割合）
      face: { x: 0.4736, y: 0.1252, size: 0.3185 },
      gender: 'female', hair: 'bob', expression: 'fierce', accessory: 'hairpin',
      hairColor: '#4ecfae', hairLight: '#8ff0d8', hairDark: '#166b58',
      eye: '#ffe066', eyeLight: '#fff4b8',
      outfit: '#12332e', outfitLight: '#1f5049', outfitTrim: '#4ecfae',
      accentColor: '#a8f5e0',
    },
    desc: '多段ヒット型。クリティカルと[物理]系統補正が噛み合う。',
  },
  ch_noa: {
    name: 'ノア', title: '静水の癒し手', rarity: 'RARE', element: 'water',
    base: { hp: 720, atk: 55, def: 52, magi_power: 120 },
    growth: { hp: 48, atk: 2.8, def: 3.4, magi_power: 9.0 },
    unique_skills: ['sk_noa_tide'],
    common_skills: ['sk_heal_light', 'sk_aqua_lance', 'sk_fire_bolt'],
    color: '#6aade2', accent: '#253745', glyph: '静',
    art: {
      // 立ち絵から切り出す顔の範囲（画像サイズに対する割合）
      face: { x: 0.5457, y: 0.1633, size: 0.4147 },
      gender: 'female', hair: 'long', expression: 'gentle', accessory: 'halo',
      hairColor: '#6aa8ee', hairLight: '#a8d2ff', hairDark: '#264a80',
      eye: '#7fe4e0', eyeLight: '#c8f7f5',
      outfit: '#1b3558', outfitLight: '#2c5285', outfitTrim: '#bfe4ff',
      accentColor: '#cfe9ff',
    },
    desc: '回復役。水属性なので火のフィールドで腐らない。',
  },
  ch_vell: {
    name: 'ヴェル', title: '宵闇の使徒', rarity: 'SUPER_RARE', element: 'dark',
    base: { hp: 700, atk: 118, def: 48, magi_power: 118 },
    growth: { hp: 46, atk: 8.0, def: 3.0, magi_power: 8.0 },
    unique_skills: ['sk_poison_fang'],
    common_skills: ['sk_magic_blade', 'sk_mind_bash', 'sk_focus'],
    color: '#be8df2', accent: '#3c2f49', glyph: '宵',
    art: {
      // 立ち絵から切り出す顔の範囲（画像サイズに対する割合）
      face: { x: 0.4928, y: 0.1482, size: 0.3185 },
      gender: 'female', hair: 'wavy', expression: 'smug', accessory: 'horn',
      hairColor: '#a578f0', hairLight: '#d0b0ff', hairDark: '#4a2a86',
      eye: '#ff7ac4', eyeLight: '#ffc0e4',
      outfit: '#2a1848', outfitLight: '#432a6e', outfitTrim: '#c9a0ff',
      accentColor: '#d8b8ff',
    },
    desc: 'ATK/魔力の両方が高く、あべこべビルドの実験に向く。',
  },
  ch_astra: {
    name: 'アストラ', title: '零式の遺構兵装', rarity: 'LEGEND', element: 'none',
    base: { hp: 880, atk: 150, def: 70, magi_power: 80 },
    growth: { hp: 58, atk: 11.5, def: 4.5, magi_power: 5.0 },
    unique_skills: ['sk_astra_zero'],
    common_skills: ['sk_heavy_slash', 'sk_focus', 'sk_armor_break'],
    // 【特殊】ラウンド頭から全開。開幕バフを持ち、1ラウンド目の火力が跳ね上がる
    passives: { openingBuff: 0.35 },
    situational: { firstRoundPower: 0.5 },
    color: '#e0ecf0', accent: '#454849', glyph: '零',
    art: {
      // 立ち絵から切り出す顔の範囲（画像サイズに対する割合）
      face: { x: 0.5288, y: 0.191, size: 0.3185 },
      gender: 'female', hair: 'hime', expression: 'cool', accessory: 'visor',
      hairColor: '#e4e9f2', hairLight: '#ffffff', hairDark: '#8d97a8',
      eye: '#57e0ff', eyeLight: '#b8f2ff',
      outfit: '#2b323e', outfitLight: '#454e5e', outfitTrim: '#57e0ff',
      accentColor: '#57e0ff',
    },
    desc: '【特殊】開幕から固有バフ+35%、1ラウンド目の与ダメージ+50%。短期決戦で最も強い。',
  },
  ch_ryn: {
    name: 'リン', title: '常闇の呪術師', rarity: 'SUPER_RARE', element: 'dark',
    base: { hp: 640, atk: 62, def: 40, magi_power: 138 },
    growth: { hp: 42, atk: 3.2, def: 2.5, magi_power: 10.5 },
    unique_skills: ['sk_ryn_veil'],
    common_skills: ['sk_fire_bolt', 'sk_poison_fang', 'sk_magic_blade'],
    color: '#745c9b', accent: '#251e2f', glyph: '帳',
    art: {
      // 立ち絵から切り出す顔の範囲（画像サイズに対する割合）
      face: { x: 0.5409, y: 0.2028, size: 0.4147 },
      gender: 'female', hair: 'long', expression: 'cool', accessory: 'circlet',
      hairColor: '#6b5aa8', hairLight: '#9c8ad0', hairDark: '#2e2352',
      eye: '#c8a2ff', eyeLight: '#e8d8ff',
      outfit: '#241a40', outfitLight: '#3a2b62', outfitTrim: '#a88fe0',
      accentColor: '#c0a8f0',
    },
    desc: '防御無視の闇魔法使い。高DEFの敵を溶かす。',
  },
  ch_selen: {
    name: 'セレン', title: '聖堂の射手', rarity: 'RARE', element: 'light',
    base: { hp: 660, atk: 70, def: 44, magi_power: 118 },
    growth: { hp: 44, atk: 4.0, def: 2.8, magi_power: 8.8 },
    unique_skills: ['sk_selen_ray'],
    common_skills: ['sk_heal_light', 'sk_gale_edge', 'sk_fire_bolt'],
    color: '#fde0e4', accent: '#4d4546', glyph: '聖',
    art: {
      // 立ち絵から切り出す顔の範囲（画像サイズに対する割合）
      face: { x: 0.4904, y: 0.1762, size: 0.3185 },
      gender: 'female', hair: 'ponytail', expression: 'gentle', accessory: 'halo',
      hairColor: '#f2d488', hairLight: '#fff0bc', hairDark: '#9c7a2a',
      eye: '#8fc8ff', eyeLight: '#d0eaff',
      outfit: '#f4efe2', outfitLight: '#ffffff', outfitTrim: '#e0b850',
      accentColor: '#ffd76a',
    },
    desc: '光属性の魔法アタッカー。闇のフィールドで真価を発揮する。',
  },
  ch_gow: {
    name: 'クレハ', title: '金剛の拳士', rarity: 'RARE', element: 'none',
    base: { hp: 980, atk: 108, def: 82, magi_power: 40 },
    growth: { hp: 70, atk: 7.5, def: 5.8, magi_power: 2.2 },
    unique_skills: ['sk_gow_roar'],
    common_skills: ['sk_heavy_slash', 'sk_double_strike', 'sk_slash'],
    color: '#937877', accent: '#2c2525', glyph: '剛',
    art: {
      // 立ち絵から切り出す顔の範囲（画像サイズに対する割合）
      face: { x: 0.4952, y: 0.1391, size: 0.4067 },
      gender: 'female', hair: 'bob', expression: 'fierce', accessory: 'hairpin',
      hairColor: '#8c5a3c', hairLight: '#c08862', hairDark: '#4a2c1c',
      eye: '#ff9a4a', eyeLight: '#ffd0a0',
      outfit: '#5c3a28', outfitLight: '#7d5238', outfitTrim: '#e8b070',
      accentColor: '#ffc890',
    },
    desc: '[遺物]系統バフの供給役。異なるタグを乗算で伸ばす起点になる。',
  },
  ch_bran: {
    name: 'ブランカ', title: '辺境の傭兵', rarity: 'COMMON', element: 'earth',
    base: { hp: 800, atk: 92, def: 58, magi_power: 30 },
    growth: { hp: 55, atk: 6.5, def: 3.8, magi_power: 1.8 },
    unique_skills: ['sk_bran_smash'],
    common_skills: ['sk_slash', 'sk_heavy_slash', 'sk_stone_press'],
    color: '#b2ab94', accent: '#36342e', glyph: '傭',
    art: {
      // 立ち絵から切り出す顔の範囲（画像サイズに対する割合）
      face: { x: 0.5192, y: 0.1419, size: 0.4147 },
      gender: 'female', hair: 'ponytail', expression: 'calm', accessory: 'none',
      hairColor: '#b09a6a', hairLight: '#d8c69a', hairDark: '#5e4e2c',
      eye: '#8ab060', eyeLight: '#c6e0a0',
      outfit: '#4c4636', outfitLight: '#6b634c', outfitTrim: '#b09a6a',
      accentColor: '#c8b488',
    },
    desc: '素直な物理アタッカー。序盤の頭数として頼れる。',
  },
  ch_mia: {
    name: 'ミア', title: '水路の見習い', rarity: 'COMMON', element: 'water',
    base: { hp: 580, atk: 44, def: 36, magi_power: 100 },
    growth: { hp: 38, atk: 2.2, def: 2.2, magi_power: 7.5 },
    unique_skills: ['sk_mia_splash'],
    common_skills: ['sk_heal_light', 'sk_aqua_lance', 'sk_fire_bolt'],
    color: '#a4e3f8', accent: '#35464b', glyph: '水',
    art: {
      // 立ち絵から切り出す顔の範囲（画像サイズに対する割合）
      face: { x: 0.524, y: 0.1548, size: 0.3185 },
      gender: 'female', hair: 'twin', expression: 'gentle', accessory: 'ribbon',
      hairColor: '#7cc4e0', hairLight: '#b4e4f4', hairDark: '#2e6a84',
      eye: '#5fd0c8', eyeLight: '#b0f0ea',
      outfit: '#1f4658', outfitLight: '#316a80', outfitTrim: '#a8e0f0',
      accentColor: '#b8ecff',
    },
    desc: '見習いの水魔法使い。回復も撃てる万能枠。',
  },
  ch_tor: {
    name: 'ヒノ', title: '火場の斥候', rarity: 'COMMON', element: 'fire',
    base: { hp: 620, atk: 100, def: 40, magi_power: 35 },
    growth: { hp: 40, atk: 7.2, def: 2.4, magi_power: 2.0 },
    unique_skills: ['sk_tor_flame'],
    common_skills: ['sk_gale_edge', 'sk_double_strike', 'sk_slash'],
    color: '#e1724f', accent: '#44271e', glyph: '斥',
    art: {
      // 立ち絵から切り出す顔の範囲（画像サイズに対する割合）
      face: { x: 0.4832, y: 0.1169, size: 0.3185 },
      gender: 'female', hair: 'bob', expression: 'smug', accessory: 'hairpin',
      hairColor: '#f08046', hairLight: '#ffb082', hairDark: '#8a3c18',
      eye: '#ffd24a', eyeLight: '#fff0ac',
      outfit: '#4a2a1c', outfitLight: '#6b3f2a', outfitTrim: '#ffb082',
      accentColor: '#ffc490',
    },
    desc: '火属性の手数役。風属性のフィールドで刺さる。',
  },
  /* ===== 属性ごとに2人ずつ揃えるための追加（風・光・無）===== */
  ch_kaze: {
    name: 'カザネ', title: '疾風の舞手', rarity: 'RARE', element: 'wind',
    base: { hp: 640, atk: 126, def: 40, magi_power: 48 },
    growth: { hp: 42, atk: 9.4, def: 2.6, magi_power: 2.8 },
    unique_skills: ['sk_kaze_dance'],
    common_skills: ['sk_gale_edge', 'sk_double_strike', 'sk_slash'],
    color: '#8ce0c8', accent: '#1a4a40', glyph: '舞',
    art: {
      // 立ち絵から自動計測（tools/detect_faces.py）。調整は test/art.html から。
      face: { x: 0.5072, y: 0.1032, size: 0.3642 },
      gender: 'female', hair: 'ponytail', expression: 'smug', accessory: 'ribbon',
      hairColor: '#6ad8b8', hairLight: '#a8f0dc', hairDark: '#237060',
      eye: '#ffe066', eyeLight: '#fff4b8',
      outfit: '#17403a', outfitLight: '#255c52', outfitTrim: '#8ce0c8',
      accentColor: '#a8f5e0',
    },
    desc: '多段の風アタッカー。クリティカル系のツリーと噛み合う。',
  },
  ch_hikari: {
    name: 'ヒカリ', title: '灯守の巫女', rarity: 'COMMON', element: 'light',
    base: { hp: 700, atk: 48, def: 50, magi_power: 104 },
    growth: { hp: 46, atk: 2.4, def: 3.2, magi_power: 7.8 },
    unique_skills: ['sk_hikari_veil'],
    common_skills: ['sk_heal_light', 'sk_fire_bolt', 'sk_aqua_lance'],
    color: '#ffeab8', accent: '#5c4a20', glyph: '灯',
    art: {
      // 立ち絵から自動計測（tools/detect_faces.py）。調整は test/art.html から。
      face: { x: 0.47, y: 0.1119, size: 0.3574 },
      gender: 'female', hair: 'long', expression: 'gentle', accessory: 'halo',
      hairColor: '#f4dc9a', hairLight: '#fff2c8', hairDark: '#9c8038',
      eye: '#9ad8ff', eyeLight: '#d4efff',
      outfit: '#f0ead8', outfitLight: '#ffffff', outfitTrim: '#d8b45c',
      accentColor: '#ffdc8a',
    },
    desc: '軽減バフを配る支援役。無敵ビルドの土台を早期に作れる。',
  },
  ch_mu: {
    name: 'ムゥ', title: '無銘の拳', rarity: 'COMMON', element: 'none',
    base: { hp: 880, atk: 96, def: 68, magi_power: 34 },
    growth: { hp: 62, atk: 6.8, def: 4.6, magi_power: 2.0 },
    unique_skills: ['sk_mu_impact'],
    common_skills: ['sk_heavy_slash', 'sk_slash', 'sk_focus'],
    color: '#c8c4bc', accent: '#3c3a34', glyph: '無',
    art: {
      // 立ち絵から自動計測（tools/detect_faces.py）。調整は test/art.html から。
      face: { x: 0.512, y: 0.1352, size: 0.3431 },
      gender: 'female', hair: 'bob', expression: 'calm', accessory: 'none',
      hairColor: '#b8b4ac', hairLight: '#dcd8d0', hairDark: '#63605a',
      eye: '#8ab0a0', eyeLight: '#c4e0d4',
      outfit: '#4a4842', outfitLight: '#68655d', outfitTrim: '#c8c4bc',
      accentColor: '#dcd8d0',
    },
    desc: '無属性の物理アタッカー。属性事故が無く、どこでも腐らない。',
  },

  /* ===== レジェンド（特殊パッシブ・特殊技を持つ）===== */
  ch_lg_zero: {
    name: 'ゼロ', title: '双牙の剣鬼', rarity: 'LEGEND', element: 'none',
    base: { hp: 860, atk: 168, def: 66, magi_power: 50 },
    growth: { hp: 56, atk: 12.6, def: 4.2, magi_power: 3.0 },
    unique_skills: ['sk_lg_twin_edge'],
    common_skills: ['sk_heavy_slash', 'sk_focus', 'sk_armor_break'],
    // 【特殊】攻撃力が半減する代わりに、攻撃技が必ず2回発動する
    passives: { atkScale: 0.5, doubleHits: 1 },
    color: '#dfe6f0', accent: '#33394a', glyph: '双',
    art: {
      // 立ち絵から自動計測（tools/detect_faces.py）。調整は test/art.html から。
      face: { x: 0.4856, y: 0.111, size: 0.3574 },
      gender: 'female', hair: 'hime', expression: 'cool', accessory: 'hairpin',
      hairColor: '#c8ccd8', hairLight: '#f0f3f8', hairDark: '#6e7482',
      eye: '#ff6b6b', eyeLight: '#ffc0c0',
      outfit: '#2a303c', outfitLight: '#454c5c', outfitTrim: '#c8ccd8',
      accentColor: '#ff8a8a',
    },
    desc: '【特殊】ATKが半分になる代わりに、攻撃技が必ず2回発動する。多段強化と噛み合う。',
  },
  ch_lg_aegis: {
    name: 'イージス', title: '不落の楯姫', rarity: 'LEGEND', element: 'earth',
    base: { hp: 1320, atk: 104, def: 128, magi_power: 52 },
    growth: { hp: 94, atk: 6.6, def: 8.8, magi_power: 3.0 },
    unique_skills: ['sk_lg_retribution'],
    common_skills: ['sk_heavy_slash', 'sk_phys_roar', 'sk_armor_break'],
    // 【特殊】常時反撃＋棘＋不屈。殴られるほど強い
    passives: { counterRate: 0.75, counterPower: 1.6, thorns: 0.04, lastStand: 0.5 },
    color: '#e0c48c', accent: '#4a3c1c', glyph: '楯',
    art: {
      // 立ち絵から自動計測（tools/detect_faces.py）。調整は test/art.html から。
      face: { x: 0.4868, y: 0.132, size: 0.3428 },
      gender: 'female', hair: 'ponytail', expression: 'fierce', accessory: 'circlet',
      hairColor: '#e0c48c', hairLight: '#f8e4b8', hairDark: '#8a6c30',
      eye: '#7ad19a', eyeLight: '#c4f0d6',
      outfit: '#54483a', outfitLight: '#756450', outfitTrim: '#e0c48c',
      accentColor: '#f2dca8',
    },
    desc: '【特殊】75%で威力160%の反撃。被弾で棘ダメージ、致死も50%で耐える。',
  },
  ch_lg_nox: {
    name: 'ノクス', title: '厄災の呪詛官', rarity: 'LEGEND', element: 'dark',
    base: { hp: 720, atk: 66, def: 46, magi_power: 156 },
    growth: { hp: 46, atk: 3.4, def: 2.8, magi_power: 11.8 },
    unique_skills: ['sk_lg_calamity'],
    common_skills: ['sk_poison_fang', 'sk_magic_blade', 'sk_ryn_veil'],
    // 【特殊】デバフ中の敵を殴るほど伸びる。攻撃は必ず防御を崩す
    situational: { debuffAmp: 0.55 },
    passives: { guardBreak: 0.35 },
    color: '#a878e8', accent: '#2c1a4a', glyph: '厄',
    art: {
      // 立ち絵から自動計測（tools/detect_faces.py）。調整は test/art.html から。
      face: { x: 0.5228, y: 0.1023, size: 0.3684 },
      gender: 'female', hair: 'wavy', expression: 'smug', accessory: 'horn',
      hairColor: '#9068e0', hairLight: '#c4a4ff', hairDark: '#3e2470',
      eye: '#7bffcf', eyeLight: '#c8fff0',
      outfit: '#281844', outfitLight: '#412a68', outfitTrim: '#c0a0ff',
      accentColor: '#d0b4ff',
    },
    desc: '【特殊】デバフ中の敵への与ダメージ+55%、35%で防御無視。自前で全部盛りのデバフを撒ける。',
  },
  ch_lg_ignis: {
    name: 'イグニス', title: '血盟の焔剣', rarity: 'LEGEND', element: 'fire',
    base: { hp: 940, atk: 158, def: 58, magi_power: 62 },
    growth: { hp: 64, atk: 11.8, def: 3.6, magi_power: 3.6 },
    unique_skills: ['sk_lg_bloodpact'],
    common_skills: ['sk_tor_flame', 'sk_focus', 'sk_heavy_slash'],
    // 【特殊】HPが減っているほど強く、与ダメージの一部を吸って戻す
    situational: { lowHpPower: 0.9 },
    passives: { lifesteal: 0.18 },
    color: '#ff7a4d', accent: '#4a1a0c', glyph: '焔',
    art: {
      // 立ち絵から自動計測（tools/detect_faces.py）。調整は test/art.html から。
      face: { x: 0.5132, y: 0.097, size: 0.3706 },
      gender: 'female', hair: 'twin', expression: 'fierce', accessory: 'hairpin',
      hairColor: '#ff6a3c', hairLight: '#ffa478', hairDark: '#8c2c10',
      eye: '#ffd24a', eyeLight: '#fff0ac',
      outfit: '#40160c', outfitLight: '#6a2814', outfitTrim: '#ffa478',
      accentColor: '#ffc490',
    },
    desc: '【特殊】HPが減っているほど威力上昇（最大+90%）。与ダメージの18%を吸収して立て直す。',
  },
  ch_lg_lumen: {
    name: 'ルーメン', title: '天雷の審判者', rarity: 'LEGEND', element: 'light',
    base: { hp: 780, atk: 72, def: 58, magi_power: 168 },
    growth: { hp: 50, atk: 3.8, def: 3.6, magi_power: 12.6 },
    unique_skills: ['sk_lg_deluge'],
    common_skills: ['sk_selen_ray', 'sk_heal_light', 'sk_fire_bolt'],
    // 【特殊】単体攻撃が他の敵にも波及し、ボスに強い
    situational: { bossSlayer: 0.4 },
    passives: { chain: 0.35 },
    color: '#ffe27a', accent: '#5c4a14', glyph: '雷',
    art: {
      // 立ち絵から自動計測（tools/detect_faces.py）。調整は test/art.html から。
      face: { x: 0.5012, y: 0.1041, size: 0.3678 },
      gender: 'female', hair: 'hime', expression: 'cool', accessory: 'halo',
      hairColor: '#ffe27a', hairLight: '#fff6c4', hairDark: '#9c7c1c',
      eye: '#8fd8ff', eyeLight: '#d0f0ff',
      outfit: '#3c3418', outfitLight: '#5e5228', outfitTrim: '#ffe27a',
      accentColor: '#fff0a8',
    },
    desc: '【特殊】単体攻撃が他の敵へ威力35%で波及。ボスへの与ダメージ+40%。',
  },

  /* ==================================================================
   * レジェンド 第2陣 (§8.2)
   *
   * ── 設計の方針 ──
   * 「強いレジェンド」を並べるのではなく、§5.6〜§5.8 と §12 で足した
   * 仕組みのそれぞれに **顔を与える** 形にしてある。
   * 状態異常6種・弱点コンボ・隊列・小技／大技・会心の余波・双極・
   * 一意専心／変幻自在 …… どれも「そのキャラでしか気持ちよく回らない」軸を1つ持つ。
   *
   * これは数字を配るためではなく、**プレイヤーがビルドの入口を見つけるため**の配置。
   * 引いたキャラの固有パッシブが、そのままスキルツリーの振り先を示す作りになっている。
   * ================================================================== */

  ch_lg_frisia: {
    name: 'フリーシア', title: '氷結の女王', rarity: 'LEGEND', element: 'water',
    base: { hp: 760, atk: 62, def: 54, magi_power: 162 },
    growth: { hp: 48, atk: 3.2, def: 3.4, magi_power: 12.2 },
    unique_skills: ['sk_lg_absolute_zero'],
    common_skills: ['sk_noa_tide', 'sk_magic_blade', 'sk_mind_bash'],
    // 【特殊】凍結を撒く役。凍結は「相手の脆さ」なので、
    // 自分の火力ではなくパーティ全員の火力に化ける (§5.8)。
    passives: {
      statusOnHitKind: { freeze: 0.35 },
      vsStatusPower: { freeze: 0.45 },
      statusPower: 0.30,
    },
    color: '#8fd8ff', accent: '#183a52', glyph: '氷',
    art: {
      // 立ち絵から自動計測（tools/detect_faces.py）。調整は test/art.html から。
      face: { x: 0.5192, y: 0.1376, size: 0.3391 },
      gender: 'female', hair: 'hime', expression: 'cool', accessory: 'circlet',
      hairColor: '#bfeaff', hairLight: '#eafaff', hairDark: '#5a8ea8',
      eye: '#7fd6ff', eyeLight: '#d4f2ff',
      outfit: '#1c3444', outfitLight: '#2e5068', outfitTrim: '#bfeaff',
      accentColor: '#dff4ff',
    },
    desc: '【特殊】攻撃時35%で凍結を付与。凍結中の敵への火力+45%。' +
      '凍結は味方全員の与ダメージを増やすので、パーティ全体の火力役になる。',
  },

  ch_lg_ember: {
    name: 'エンバー', title: '業火の踊り子', rarity: 'LEGEND', element: 'fire',
    base: { hp: 700, atk: 118, def: 46, magi_power: 118 },
    growth: { hp: 44, atk: 8.2, def: 2.8, magi_power: 8.2 },
    unique_skills: ['sk_lg_pyre'],
    common_skills: ['sk_fire_bolt', 'sk_slash', 'sk_focus'],
    // 【特殊】火傷は「相手が動くと痛い」異常。手数で撒いて焼き続ける (§5.8 / §4.3)。
    passives: {
      statusOnHitKind: { burn: 0.40 },
      vsStatusPower: { burn: 0.40 },
      lowPowerRepeat: 1,
      lowPowerBoost: 0.35,
    },
    color: '#ff8a4c', accent: '#4c2010', glyph: '焔',
    art: {
      // 立ち絵から自動計測（tools/detect_faces.py）。調整は test/art.html から。
      face: { x: 0.488, y: 0.1062, size: 0.3614 },
      gender: 'female', hair: 'twin', expression: 'smug', accessory: 'hairpin',
      hairColor: '#ff8a4c', hairLight: '#ffc08a', hairDark: '#a03c10',
      eye: '#ffd24c', eyeLight: '#fff0b0',
      outfit: '#3c1a10', outfitLight: '#5e2c18', outfitTrim: '#ff8a4c',
      accentColor: '#ffb884',
    },
    desc: '【特殊】攻撃時40%で火傷を付与し、火傷中の敵への火力+40%。' +
      '小技が1回多く発動し威力も+35%。手数で焼き続ける構成。',
  },

  ch_lg_carmina: {
    name: 'カルミナ', title: '紅涙の処刑人', rarity: 'LEGEND', element: 'dark',
    base: { hp: 820, atk: 150, def: 58, magi_power: 60 },
    growth: { hp: 54, atk: 10.4, def: 3.4, magi_power: 3.2 },
    unique_skills: ['sk_lg_exsanguinate'],
    common_skills: ['sk_poison_fang', 'sk_heavy_slash', 'sk_armor_break'],
    // 【特殊】出血は「被弾のたびに開く」異常。多段攻撃と噛み合う (§5.8)。
    // 攻撃力を落とす代わりに常に2回殴るので、出血が2回誘発する。
    passives: {
      statusOnHitKind: { bleed: 0.45 },
      vsStatusPower: { bleed: 0.35 },
      doubleHits: 1,
      atkScale: 0.72,
    },
    color: '#ff5c7a', accent: '#4a1424', glyph: '涙',
    art: {
      // 立ち絵から自動計測（tools/detect_faces.py）。調整は test/art.html から。
      face: { x: 0.488, y: 0.1245, size: 0.3388 },
      gender: 'female', hair: 'long', expression: 'cool', accessory: 'none',
      hairColor: '#c8324c', hairLight: '#ff7a94', hairDark: '#6c1024',
      eye: '#ff9cb4', eyeLight: '#ffd8e2',
      outfit: '#2c1018', outfitLight: '#4a1c2a', outfitTrim: '#ff5c7a',
      accentColor: '#ff8fa6',
    },
    desc: '【特殊】ATKが72%になる代わりに攻撃技が必ず2回発動。' +
      '攻撃時45%で出血を付与し、出血中の敵への火力+35%。多段が出血を何度も誘発する。',
  },

  ch_lg_mireille: {
    name: 'ミレイユ', title: '静寂の縛鎖', rarity: 'LEGEND', element: 'wind',
    base: { hp: 740, atk: 68, def: 52, magi_power: 158 },
    growth: { hp: 46, atk: 3.6, def: 3.2, magi_power: 11.8 },
    unique_skills: ['sk_lg_silence'],
    common_skills: ['sk_kaze_dance', 'sk_mind_bash', 'sk_ryn_veil'],
    // 【特殊】麻痺は数字を削らず手番を奪う。大技を抱えた相手に最も刺さる (§5.8)。
    passives: {
      statusOnHitKind: { paralyze: 0.22 },
      debuffDuration: 1,
      debuffSpread: 0.30,
    },
    color: '#a8f0d8', accent: '#164438', glyph: '鎖',
    art: {
      // 立ち絵から自動計測（tools/detect_faces.py）。調整は test/art.html から。
      face: { x: 0.4964, y: 0.1517, size: 0.3263 },
      gender: 'female', hair: 'wavy', expression: 'calm', accessory: 'visor',
      hairColor: '#a8f0d8', hairLight: '#dcfff2', hairDark: '#4c9080',
      eye: '#c8b4ff', eyeLight: '#e8dcff',
      outfit: '#1a3830', outfitLight: '#2c5a4c', outfitTrim: '#a8f0d8',
      accentColor: '#ccfaea',
    },
    desc: '【特殊】攻撃時22%で麻痺を付与。与える弱体の持続+1ターン、' +
      '30%で他の敵にも伝染する。敵の手番そのものを削り取る。',
  },

  ch_lg_serafina: {
    name: 'セラフィナ', title: '呪縛の聖女', rarity: 'LEGEND', element: 'light',
    base: { hp: 800, atk: 60, def: 60, magi_power: 154 },
    growth: { hp: 52, atk: 3.0, def: 3.8, magi_power: 11.4 },
    unique_skills: ['sk_lg_anathema'],
    common_skills: ['sk_heal_light', 'sk_selen_ray', 'sk_hikari_veil'],
    // 【特殊】呪詛で相手の立て直しを塞ぎながら、自分は回復役もこなす (§5.8)。
    passives: {
      statusOnHitKind: { curse: 0.50 },
      vsStatusPower: { curse: 0.50 },
      healPower: 0.35,
      overhealShield: 0.30,
    },
    color: '#e8d4ff', accent: '#3a2a54', glyph: '呪',
    art: {
      // 立ち絵から自動計測（tools/detect_faces.py）。調整は test/art.html から。
      face: { x: 0.5252, y: 0.1128, size: 0.3529 },
      gender: 'female', hair: 'long', expression: 'gentle', accessory: 'halo',
      hairColor: '#e8d4ff', hairLight: '#f8f0ff', hairDark: '#8a70b0',
      eye: '#ffe08a', eyeLight: '#fff4c8',
      outfit: '#2e2444', outfitLight: '#483a66', outfitTrim: '#e8d4ff',
      accentColor: '#f4e8ff',
    },
    desc: '【特殊】攻撃時50%で呪詛を付与し、呪詛中の敵への火力+50%。' +
      '自分の回復量+35%、あふれた回復の30%は障壁になる。攻めながら支える。',
  },

  ch_lg_viola: {
    name: 'ヴィオラ', title: '連撃の舞姫', rarity: 'LEGEND', element: 'wind',
    base: { hp: 780, atk: 138, def: 54, magi_power: 72 },
    growth: { hp: 50, atk: 9.6, def: 3.2, magi_power: 4.0 },
    unique_skills: ['sk_lg_crescendo'],
    common_skills: ['sk_kaze_dance', 'sk_slash', 'sk_fire_bolt'],
    // 【特殊】弱点コンボ (§10.6) はオートでは積みにくい。
    // このキャラは「手で戦うほど強い」を体で示す役割を持つ (§5.7)。
    passives: {
      comboGain: 1,
      comboKeep: 0.50,
      comboPower: 0.04,
      critCombo: 1,
    },
    color: '#b8ffc8', accent: '#1c4a2a', glyph: '舞',
    art: {
      // 立ち絵から自動計測（tools/detect_faces.py）。調整は test/art.html から。
      face: { x: 0.5, y: 0.1172, size: 0.351 },
      gender: 'female', hair: 'ponytail', expression: 'gentle', accessory: 'ribbon',
      hairColor: '#8ce8a8', hairLight: '#ccffdc', hairDark: '#3c8a54',
      eye: '#ffb0d8', eyeLight: '#ffe0f0',
      outfit: '#1c3c28', outfitLight: '#2e6042', outfitTrim: '#8ce8a8',
      accentColor: '#b8ffc8',
    },
    desc: '【特殊】弱点コンボが1手で2段積み、外しても50%で落ちない。' +
      '1段あたりの倍率+4%、会心でも1段積む。手動戦闘の火力役。',
  },

  ch_lg_alvina: {
    name: 'アルヴィナ', title: '先陣の白槍', rarity: 'LEGEND', element: 'earth',
    base: { hp: 900, atk: 152, def: 88, magi_power: 54 },
    growth: { hp: 62, atk: 10.6, def: 5.8, magi_power: 3.0 },
    unique_skills: ['sk_lg_vanguard'],
    common_skills: ['sk_heavy_slash', 'sk_armor_break', 'sk_phys_roar'],
    // 【特殊】隊列の先頭に置くことが前提のキャラ (§5.7)。
    // 1ラウンド目に全部を寄せているので、長引かせると弱い。
    passives: {
      frontPower: 0.50,
      ambush: 0.50,
      firstHitCrit: 1,
    },
    situational: { firstRoundPower: 0.40 },
    color: '#f0f0e0', accent: '#4a4638', glyph: '槍',
    art: {
      // 立ち絵から自動計測（tools/detect_faces.py）。調整は test/art.html から。
      face: { x: 0.5337, y: 0.1228, size: 0.3437 },
      gender: 'female', hair: 'ponytail', expression: 'fierce', accessory: 'circlet',
      hairColor: '#f0ecd8', hairLight: '#fffdf0', hairDark: '#98927c',
      eye: '#8ce8a8', eyeLight: '#ccffdc',
      outfit: '#3c4438', outfitLight: '#5a6454', outfitTrim: '#f0ecd8',
      accentColor: '#fffbe8',
    },
    desc: '【特殊】隊列の先頭で火力+50%、1ラウンド目は+40%。' +
      '50%で開幕に追加行動し、ウェーブ最初の攻撃は確定会心。先手で決める構成。',
  },

  ch_lg_theodora: {
    name: 'テオドラ', title: '万人の盾', rarity: 'LEGEND', element: 'earth',
    base: { hp: 1420, atk: 92, def: 140, magi_power: 68 },
    growth: { hp: 102, atk: 5.4, def: 9.6, magi_power: 4.0 },
    unique_skills: ['sk_lg_bastion'],
    common_skills: ['sk_gald_bulwark', 'sk_heavy_slash', 'sk_heal_light'],
    // 【特殊】守護者クラス (§12) と同じ方向を、キャラ側から補強する。
    // 後衛に置くほど硬く、味方の被害を引き受けて跳ね返す。
    passives: {
      guardAlly: 0.45,
      damageShare: 0.25,
      backGuard: 0.40,
      shieldRegen: 0.06,
      reflect: 0.20,
    },
    color: '#7fb3ff', accent: '#1c3050', glyph: '盾',
    art: {
      // 立ち絵から自動計測（tools/detect_faces.py）。調整は test/art.html から。
      face: { x: 0.5264, y: 0.1191, size: 0.3541 },
      gender: 'female', hair: 'bob', expression: 'calm', accessory: 'visor',
      hairColor: '#9cbce8', hairLight: '#d4e4ff', hairDark: '#4c6a98',
      eye: '#ffd88c', eyeLight: '#fff0c8',
      outfit: '#243850', outfitLight: '#3c5878', outfitTrim: '#9cbce8',
      accentColor: '#c8dcff',
    },
    desc: '【特殊】味方の被ダメージ45%を肩代わりし、自分が受けた25%は全員で分ける。' +
      '後衛で被ダメ-40%、毎ラウンド障壁を張り、受けた20%を跳ね返す。',
  },

  ch_lg_licorice: {
    name: 'リコリス', title: '千手の射手', rarity: 'LEGEND', element: 'none',
    base: { hp: 720, atk: 128, def: 50, magi_power: 96 },
    growth: { hp: 46, atk: 8.8, def: 3.0, magi_power: 6.4 },
    unique_skills: ['sk_lg_thousand_needles'],
    common_skills: ['sk_slash', 'sk_mu_impact', 'sk_focus'],
    // 【特殊】小技だけを伸ばす仕組み (§4.3) の完成形。
    // 大技を1本も持たないので、低威力の技が主力として成立する。
    passives: {
      lowPowerBoost: 0.90,
      lowPowerSpread: 1,
      lowPowerRepeat: 2,
      autoLowSkill: 0.50,
    },
    color: '#d8d8e8', accent: '#38384a', glyph: '針',
    art: {
      // 立ち絵から自動計測（tools/detect_faces.py）。調整は test/art.html から。
      face: { x: 0.5096, y: 0.136, size: 0.3391 },
      gender: 'female', hair: 'twin', expression: 'cool', accessory: 'hairpin',
      hairColor: '#c8c8dc', hairLight: '#f0f0fa', hairDark: '#6c6c84',
      eye: '#a8ffd8', eyeLight: '#dcfff0',
      outfit: '#2c2c3c', outfitLight: '#484860', outfitTrim: '#c8c8dc',
      accentColor: '#e8e8f4',
    },
    desc: '【特殊】小技の威力+90%、敵全体に拡散し、2回追加発動。' +
      '攻撃後50%で小技が自動で飛ぶ。低威力の技だけで戦い切る構成。',
  },

  ch_lg_valkyria: {
    name: 'ヴァルキュリア', title: '世界断ちの巨剣', rarity: 'LEGEND', element: 'fire',
    base: { hp: 880, atk: 168, def: 66, magi_power: 52 },
    growth: { hp: 58, atk: 11.8, def: 3.8, magi_power: 3.0 },
    unique_skills: ['sk_lg_worldbreaker'],
    common_skills: ['sk_heavy_slash', 'sk_fire_bolt', 'sk_focus'],
    // 【特殊】リコリスのちょうど反対側。大技だけを伸ばす (§5.8)。
    // 帯が重ならないので、この2人は同じ装備・同じツリーを取り合わない。
    situational: { highPowerBoost: 0.55 },
    passives: {
      overkillCarry: 0.50,
      guardBreak: 0.25,
    },
    color: '#ff6a3c', accent: '#4c1808', glyph: '断',
    art: {
      // 立ち絵から自動計測（tools/detect_faces.py）。調整は test/art.html から。
      face: { x: 0.4868, y: 0.1452, size: 0.3382 },
      gender: 'female', hair: 'long', expression: 'fierce', accessory: 'horn',
      hairColor: '#ff7a4c', hairLight: '#ffb894', hairDark: '#9c3410',
      eye: '#ffe04c', eyeLight: '#fff8b0',
      outfit: '#401810', outfitLight: '#682c1c', outfitTrim: '#ff7a4c',
      accentColor: '#ffa878',
    },
    desc: '【特殊】威力200%以上の技の火力+55%。25%で防御を無視し、' +
      '倒したときの超過ダメージ50%を次の一撃へ持ち越す。一撃に全てを寄せる構成。',
  },

  ch_lg_chantal: {
    name: 'シャンタル', title: '紅月の舞踏', rarity: 'LEGEND', element: 'dark',
    base: { hp: 760, atk: 146, def: 52, magi_power: 66 },
    growth: { hp: 48, atk: 10.2, def: 3.0, magi_power: 3.6 },
    unique_skills: ['sk_lg_bloodmoon'],
    common_skills: ['sk_slash', 'sk_poison_fang', 'sk_focus'],
    // 【特殊】会心に全部を寄せる。単体技でも会心すれば全体に及ぶので、
    // 「単体特化なのに掃除もできる」という歪みが売り (§5.8)。
    passives: {
      critSpread: 0.35,
      critStack: 0.08,
      critHeal: 0.15,
    },
    situational: { critPierce: 0.60, critExecute: 0.50 },
    color: '#ff7ab0', accent: '#3c1030', glyph: '月',
    art: {
      // 立ち絵から自動計測（tools/detect_faces.py）。調整は test/art.html から。
      face: { x: 0.4928, y: 0.1273, size: 0.3501 },
      gender: 'female', hair: 'wavy', expression: 'smug', accessory: 'ribbon',
      hairColor: '#e85c9c', hairLight: '#ffa8cc', hairDark: '#8a1c58',
      eye: '#ffe08a', eyeLight: '#fff4c8',
      outfit: '#301028', outfitLight: '#4c1c40', outfitTrim: '#e85c9c',
      accentColor: '#ff9cc8',
    },
    desc: '【特殊】会心時に与ダメージの35%が敵全体へ及び、会心のたびに会心率+8%。' +
      '会心で防御を60%無視し、追い打ちの効きが+50%。会心すれば全部が繋がる。',
  },

  ch_lg_aurora: {
    name: 'オーロラ', title: '双極の巫女', rarity: 'LEGEND', element: 'light',
    base: { hp: 780, atk: 64, def: 56, magi_power: 160 },
    growth: { hp: 50, atk: 3.2, def: 3.4, magi_power: 12.0 },
    unique_skills: ['sk_lg_eclipse_prayer'],
    common_skills: ['sk_selen_ray', 'sk_ryn_veil', 'sk_magic_blade'],
    // 【特殊】光と闇の両方で相性を見る (§5.7)。
    // 属性を固定する「誓い」系とは別の解き方で、相手に合わせて勝手に良いほうが選ばれる。
    elementMods: { dual: 'dark' },
    situational: { weakHunter: 0.45 },
    color: '#c8b4ff', accent: '#2a2054', glyph: '双',
    art: {
      // 立ち絵から自動計測（tools/detect_faces.py）。調整は test/art.html から。
      face: { x: 0.5096, y: 0.1251, size: 0.3446 },
      gender: 'female', hair: 'hime', expression: 'calm', accessory: 'halo',
      hairColor: '#c8b4ff', hairLight: '#e8dcff', hairDark: '#6c54a8',
      eye: '#8cf0d8', eyeLight: '#d0fff0',
      outfit: '#241c48', outfitLight: '#3c3068', outfitTrim: '#c8b4ff',
      accentColor: '#ded0ff',
    },
    desc: '【特殊】攻撃を光と闇の両方で相性判定し、良かったほうを採用する。' +
      '素で属性有利を取れたとき火力+45%。どのフィールドでも弱点を突ける。',
  },

  ch_lg_nefeli: {
    name: 'ネフェリ', title: '一の太刀', rarity: 'LEGEND', element: 'none',
    base: { hp: 820, atk: 158, def: 62, magi_power: 58 },
    growth: { hp: 52, atk: 11.0, def: 3.6, magi_power: 3.2 },
    unique_skills: ['sk_lg_singular'],
    common_skills: ['sk_slash', 'sk_heavy_slash', 'sk_focus'],
    // 【特殊】同じ技を振り続けることが正解になる (§5.8)。
    // 振れ幅も潰してあるので、計算通りに削り切るタイプ。
    passives: {
      repeatPower: 0.25,
      stableDamage: 0.70,
      neutralPower: 0.30,
    },
    color: '#b0b8c8', accent: '#2c3240', glyph: '一',
    art: {
      // 立ち絵から自動計測（tools/detect_faces.py）。調整は test/art.html から。
      face: { x: 0.4868, y: 0.1292, size: 0.3489 },
      gender: 'female', hair: 'bob', expression: 'cool', accessory: 'none',
      hairColor: '#98a4b8', hairLight: '#d4dce8', hairDark: '#4c5464',
      eye: '#ff9c7a', eyeLight: '#ffd4c4',
      outfit: '#282e3a', outfitLight: '#424a5c', outfitTrim: '#98a4b8',
      accentColor: '#c4ccd8',
    },
    desc: '【特殊】同じ技を続けるたびに火力+25%（技を変えると1に戻る）。' +
      'ダメージの下振れを70%抑え、属性等倍のとき火力+30%。狙った数字を出す構成。',
  },

  ch_lg_iris: {
    name: 'イリス', title: '万華の魔女', rarity: 'LEGEND', element: 'water',
    base: { hp: 740, atk: 66, def: 52, magi_power: 156 },
    growth: { hp: 48, atk: 3.4, def: 3.2, magi_power: 11.6 },
    unique_skills: ['sk_lg_kaleidoscope'],
    common_skills: ['sk_noa_tide', 'sk_fire_bolt', 'sk_mind_bash', 'sk_magic_blade'],
    // 【特殊】ネフェリのちょうど反対側。技を撃ち分けるほど強い (§5.8)。
    // 手数が増えるパッシブと合わせて、毎ターン違う技を選ぶ形になる。
    passives: {
      varietyPower: 0.35,
      extraActionRate: 0.15,
      buffOnKill: 0.15,
    },
    color: '#7ae8ff', accent: '#154450', glyph: '華',
    art: {
      // 立ち絵から自動計測（tools/detect_faces.py）。調整は test/art.html から。
      face: { x: 0.518, y: 0.164, size: 0.3346 },
      gender: 'female', hair: 'twin', expression: 'smug', accessory: 'hairpin',
      hairColor: '#7ae8ff', hairLight: '#c8f8ff', hairDark: '#2c8098',
      eye: '#ffb0e8', eyeLight: '#ffdcf4',
      outfit: '#183c48', outfitLight: '#286070', outfitTrim: '#7ae8ff',
      accentColor: '#b4f4ff',
    },
    desc: '【特殊】直前と違う技を使うと火力+35%。15%で追加行動し、' +
      '敵を倒すたびに固有バフ+15%。技を4本持ち、毎ターン撃ち分けて戦う。',
  },

  // ── 支援の3人 (§5.9) ────────────────────────────
  //
  // ツリーには支援の枝が29ノード337SPぶんあるのに、**撒く側の効果を持つ
  // レジェンドが1人もいなかった**。ミレーヌの buffDuration（自分が受ける側）と
  // アストラの openingBuff だけで、buffPower / allyBuffPower / roundBuff /
  // buffShield などは誰も持っていない。【極】旗手まで用意した軸に顔がいない。
  //
  // 3人で役割を分けてある。同じ「支援」でも触り心地が違う:
  //   リタニア   … 手番を使わずに効く（撃たなくても仕事をする）
  //   ヴェスタ   … 撃つと大きい（天井そのものを上げる）
  //   ソルヴェイグ … 撃つと固くなる（支援と耐久の橋渡し）
  //
  // 固有技はどれも unique_buff / tag_buff。この2つだけが buffAmount と
  // afterBuff を通るので、支援パッシブが看板技に乗る（skills.js の注記参照）。
  ch_lg_litania: {
    name: 'リタニア', title: '絶えざる連禱', rarity: 'LEGEND', element: 'light',
    base: { hp: 800, atk: 58, def: 60, magi_power: 120 },
    growth: { hp: 56, atk: 3.2, def: 4.2, magi_power: 9.2 },
    unique_skills: ['sk_lg_litany'],
    common_skills: ['sk_heal_light', 'sk_selen_ray', 'sk_focus'],
    // 【支援】号令はラウンドの頭に勝手に配られる。**手番を使わない**ので、
    // かける側の効果量は乗らない決まりになっている (§5.12)。
    // そのぶん「置いておくだけで効く」枠として成立させてある。
    passives: {
      roundBuff: 0.10,
      buffExtend: 1,
    },
    color: '#ffe9a8', accent: '#4a3c14', glyph: '禱',
    art: {
      // 立ち絵がまだ無いので既定値。生成したら detect_faces.py で測り直すこと。
      face: { x: 0.5, y: 0.11, size: 0.36 },
      gender: 'female', hair: 'long', expression: 'gentle', accessory: 'halo',
      hairColor: '#f2e2b4', hairLight: '#fff8dc', hairDark: '#a89058',
      eye: '#ffd166', eyeLight: '#fff0c0',
      outfit: '#3c3418', outfitLight: '#5e5228', outfitTrim: '#ffe9a8',
      accentColor: '#ffd166',
    },
    artPrompt: 'pale gold long hair, warm amber eyes, white and gold liturgical robe, ' +
      'floating halo of light, hands clasped in prayer, serene gentle smile',
    desc: '【支援】ラウンド開始時、味方全体に固有バフ+10%（手番を使わない）。' +
      '自分がかけるバフの持続が+1ターン。撃たなくても働き続ける。',
  },

  ch_lg_vesta: {
    name: 'ヴェスタ', title: '万雷の触れ役', rarity: 'LEGEND', element: 'wind',
    base: { hp: 700, atk: 66, def: 48, magi_power: 145 },
    growth: { hp: 48, atk: 3.8, def: 3.4, magi_power: 10.4 },
    unique_skills: ['sk_lg_thunder_herald'],
    common_skills: ['sk_gale_edge', 'sk_mind_bash', 'sk_focus'],
    // 【支援】バフの効果量には天井がある（BUFF_POWER_CAP = 1.0）。
    // buffCapBonus はその天井そのものを押し上げる唯一の鍵で、
    // 積み上げた buffPower を捨てずに済むのはこの人だけ。
    passives: {
      buffPower: 0.35,
      buffCapBonus: 0.50,
    },
    color: '#b8f0d8', accent: '#16443a', glyph: '雷',
    art: {
      // 立ち絵がまだ無いので既定値。生成したら detect_faces.py で測り直すこと。
      face: { x: 0.5, y: 0.11, size: 0.36 },
      gender: 'female', hair: 'ponytail', expression: 'fierce', accessory: 'circlet',
      hairColor: '#9fe8c8', hairLight: '#d8fff0', hairDark: '#3e8870',
      eye: '#7ef0ff', eyeLight: '#c8faff',
      outfit: '#1c4038', outfitLight: '#2e6454', outfitTrim: '#b8f0d8',
      accentColor: '#7ef0ff',
    },
    artPrompt: 'mint green high ponytail streaming upward, bright cyan eyes, ' +
      'herald tabard with silver trim, wind-swept sash, war horn at her hip, fierce grin',
    desc: '【支援】自分がかけるバフの効果量+35%。さらにバフ効果量の上限を+50%して、' +
      '積み上げたぶんを捨てずに済む。撃つバフがいちばん大きい。',
  },

  ch_lg_solveig: {
    name: 'ソルヴェイグ', title: '護りを編む者', rarity: 'LEGEND', element: 'water',
    base: { hp: 860, atk: 60, def: 72, magi_power: 108 },
    growth: { hp: 60, atk: 3.3, def: 5.0, magi_power: 8.4 },
    unique_skills: ['sk_lg_ward_weave'],
    common_skills: ['sk_heal_light', 'sk_noa_tide', 'sk_focus'],
    // 【支援】バフをかけた相手に障壁と回復がついてくる (afterBuff)。
    // 撒くほど陣形が固くなるので、回復役を1枠減らせる。
    passives: {
      allyBuffPower: 0.35,
      buffShield: 0.12,
      buffHeal: 0.10,
    },
    color: '#8ec4ff', accent: '#16304e', glyph: '織',
    art: {
      // 立ち絵がまだ無いので既定値。生成したら detect_faces.py で測り直すこと。
      face: { x: 0.5, y: 0.11, size: 0.36 },
      gender: 'female', hair: 'wavy', expression: 'calm', accessory: 'ribbon',
      hairColor: '#7fa8e0', hairLight: '#c0dcff', hairDark: '#3a5c88',
      eye: '#a8d8ff', eyeLight: '#dcf0ff',
      outfit: '#1e3450', outfitLight: '#32526f', outfitTrim: '#8ec4ff',
      accentColor: '#a8d8ff',
    },
    artPrompt: 'deep blue wavy hair with pale ribbon, calm light blue eyes, ' +
      'layered weaver robe with woven blue threads, spindle and shimmering thread in hand, ' +
      'quiet composed expression',
    desc: '【支援】味方にかけるバフの効果量+35%。バフをかけた相手に最大HPの12%の障壁と' +
      '10%の回復がつく。撒くほど陣形が固くなる。',
  },

  // ── 会心の3人 (§5.8) ────────────────────────────
  //
  // 会心の枝は27ノード230SPあるが、埋まっていたのは**会心が起きた後**の
  // 広がりだけだった（シャンタルが波及・連鎖・貫通・追撃、ヴィオラがコンボ、
  // アルヴィナが確定会心）。肝心の **率そのもの・倍率そのもの・
  // 100%を超えた余りの行き先（極点）** は誰も持っていない。
  //
  // 3人でその3つを分けてある:
  //   ヴェルナ … 率を満たして、あふれたぶんを倍率へ流す（極点の器）
  //   ディアナ … 一撃の重さそのもの
  //   サヤ     … 中技を刻んで会心を稼ぐ（中技帯の穴も埋める）
  //
  // critRate と critDamage は passives ではなく**ユニットの素の値**なので、
  // units.js が innate から橋渡ししている。あちらを消すとここが黙って効かなくなる。
  ch_lg_verna: {
    name: 'ヴェルナ', title: '零れる極点', rarity: 'LEGEND', element: 'fire',
    base: { hp: 700, atk: 150, def: 50, magi_power: 60 },
    growth: { hp: 46, atk: 12.2, def: 3.2, magi_power: 3.6 },
    unique_skills: ['sk_lg_zenith_arrow'],
    common_skills: ['sk_fire_bolt', 'sk_double_strike', 'sk_focus'],
    // 【会心】素で55%。固有技は確定会心なので、素の55%がまるごと
    // 100%超過ぶんになり、極点が即座に働く（§3.2 ステップ6：技の会心率は
    // attacker.critRate と足し算される）。
    passives: {
      critRate: 0.55,
      critOverflow: 0.35,
    },
    color: '#ff9d5c', accent: '#4a2210', glyph: '極',
    art: {
      // 立ち絵がまだ無いので既定値。生成したら detect_faces.py で測り直すこと。
      face: { x: 0.5, y: 0.11, size: 0.36 },
      gender: 'female', hair: 'ponytail', expression: 'cool', accessory: 'visor',
      hairColor: '#ff9d5c', hairLight: '#ffd0a8', hairDark: '#a04d1c',
      eye: '#ffe066', eyeLight: '#fff4b8',
      outfit: '#3a1c10', outfitLight: '#5e3018', outfitTrim: '#ff9d5c',
      accentColor: '#ffc47a',
    },
    artPrompt: 'burning orange high ponytail, sharp golden eyes behind a slim marksman visor, ' +
      'fitted ember-red archer coat, longbow of glowing embers, calm focused aim',
    desc: '【会心】会心率+55%。100%を超えたぶんの35%が会心倍率へ回る。' +
      '固有技は確定会心なので、積んだ率がまるごと倍率に化ける。',
  },

  ch_lg_diana: {
    name: 'ディアナ', title: '一撃の秤', rarity: 'LEGEND', element: 'dark',
    base: { hp: 660, atk: 158, def: 46, magi_power: 58 },
    growth: { hp: 44, atk: 12.6, def: 3.0, magi_power: 3.4 },
    unique_skills: ['sk_lg_ruin_scale'],
    common_skills: ['sk_heavy_slash', 'sk_armor_break', 'sk_focus'],
    // 【会心】倍率そのもの。素の会心倍率 1.5 が 2.35 になる。
    // ツリーの「痛打」を満額(0.75)積んだのとほぼ同じぶんを最初から持つ。
    passives: {
      critRate: 0.20,
      critDamage: 0.85,
    },
    color: '#c58cff', accent: '#2c1740', glyph: '秤',
    art: {
      // 立ち絵がまだ無いので既定値。生成したら detect_faces.py で測り直すこと。
      face: { x: 0.5, y: 0.11, size: 0.36 },
      gender: 'female', hair: 'long', expression: 'cool', accessory: 'none',
      hairColor: '#b07ce8', hairLight: '#e0c0ff', hairDark: '#5a3080',
      eye: '#e8b0ff', eyeLight: '#f8e0ff',
      outfit: '#241436', outfitLight: '#3c2450', outfitTrim: '#c58cff',
      accentColor: '#e8b0ff',
    },
    artPrompt: 'long violet hair falling straight, pale lavender eyes, ' +
      'dark executioner coat with silver chain, enormous single-edged greatsword held low, ' +
      'unblinking cold stare',
    desc: '【会心】会心倍率+0.85（1.5倍 → 2.35倍）。会心率+20%。' +
      '当たれば重い、一撃の質に全部を寄せた型。',
  },

  ch_lg_saya: {
    name: 'サヤ', title: '刻みの技巧', rarity: 'LEGEND', element: 'earth',
    base: { hp: 720, atk: 142, def: 56, magi_power: 66 },
    growth: { hp: 48, atk: 11.0, def: 3.6, magi_power: 4.0 },
    unique_skills: ['sk_lg_kizami'],
    common_skills: ['sk_double_strike', 'sk_stone_press', 'sk_focus'],
    // 【会心】中技だけに乗る会心率 (§5.8)。ツリーの「技巧」満額(0.30)より大きい。
    // 固有技は1発ずつが中技帯に収まるので、2回とも高い確率で会心する。
    passives: {
      midPowerCrit: 0.40,
      critRate: 0.15,
    },
    color: '#d8c39a', accent: '#3a3020', glyph: '刻',
    art: {
      // 立ち絵がまだ無いので既定値。生成したら detect_faces.py で測り直すこと。
      face: { x: 0.5, y: 0.11, size: 0.36 },
      gender: 'female', hair: 'bob', expression: 'calm', accessory: 'hairpin',
      hairColor: '#4a3f34', hairLight: '#7a6a58', hairDark: '#241d16',
      eye: '#d8c39a', eyeLight: '#f4e8cc',
      outfit: '#2e2a20', outfitLight: '#4a4434', outfitTrim: '#d8c39a',
      accentColor: '#e8d8b0',
    },
    artPrompt: 'dark brown short bob with wooden hairpin, calm sand-gold eyes, ' +
      'earth-toned short kimono over practical leggings, two slim blades reversed in her hands, ' +
      'quiet unhurried stance',
    desc: '【会心】中技の会心率+40%（中技にだけ乗る）。会心率+15%。' +
      '固有技は1発ずつが中技帯に収まる、刻んで当てる型。',
  },
};

/**
 * レベルの上限。
 *
 * ── なぜ要るのか ──
 * 上限が無いと、レベルを上げ続けるだけでSPが無限に増え、
 * 最終的にスキルツリーを全部取れてしまう。そうなるとビルドは
 * 「何を選ぶか」ではなく「どれだけ回したか」になり、
 * 選択そのものが消える。
 *
 * ── なぜ150なのか ──
 * 最終フィールド「創世の残響」の推奨レベルが150で、
 * ここが「用意した内容を一通り相手にできる」地点になる。
 * このときのSPは 149 ＋ 凸5 = 154 で、ツリー全体 714 のうち **21.6%**。
 * 5回ぶんの別々のビルドが作れるだけの幅が残る。
 */
RPG.data.maxLevel = 150;

/**
 * レベル上限そのものの天井 (§6.5)。
 *
 * 150 は旧文明が引いた安全線で、星霜の欠片で外せる。
 * 255 は**世界の側の線**で、外せない（docs/灰銀の継承者 世界設定素案2.md §6.5）。
 *
 * 実装上もここが要る。天井が無いと欠片を使うほど上限が伸び続け、
 * **クラスポイントが際限なく余る**。クラスツリーは Lv255 の51点で
 * 7割取れる量に合わせてあるので、その前提が崩れる。
 */
RPG.data.maxLevelCap = 255;

/** レアリティ表示定義（色・ラベル・ガチャ還元額など） */
// label は一覧や絞り込みで使う短い表記。
// en はガチャ演出で大きく出すときの表記 (§6.7)。
// 演出で「レジェンド」とカタカナを大書きすると野暮ったくなるので、
// そこだけ筆記体の英語にする。一覧では日本語のほうが探しやすい。
RPG.data.rarities = {
  COMMON:      { label: 'ノーマル',   en: 'Common',    color: '#9aa3ad', refund: 250 },
  RARE:        { label: 'レア',       en: 'Rare',      color: '#5fa8ff', refund: 500 },
  SUPER_RARE:  { label: 'Sレア',      en: 'Super Rare', color: '#c07bff', refund: 750 },
  LEGEND:      { label: 'レジェンド', en: 'Legend',    color: '#ffc75f', refund: 1000 },
};
