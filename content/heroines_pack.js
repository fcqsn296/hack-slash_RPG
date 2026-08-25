// @ts-check
/**
 * 拡張コンテンツ: 六姫の協奏曲 (heroines_pack)
 *
 * 6人の美少女キャラクター（セレナ、カグラ、エレナ、ルーナ、フィリア、ミレーヌ）と
 * それぞれの固有技を追加するパック。
 */
RPG.content.add('六姫の協奏曲', {

  // ── 技 ──────────────────────────────────────────
  skills: {
    // 【セレナ固有】被ダメ軽減バフ
    sk_hr_zephyr_shield: {
      name: '風神の障壁',
      kind: 'active',
      plugin: 'reduction_buff',
      scaling_stat: 'atk',
      damage_type: 'phys',
      element: 'wind',
      power: 0,
      crit_rate: 0,
      cooldown: 4,
      params: { value: 0.15, turns: 3, label: '風の護り', party: true },
      desc: '風の障壁を展開し、3ターンの間味方全体の被ダメージを15%軽減する。',
    },
    // 【カグラ固有】火傷付与
    sk_hr_flame_dance: {
      name: '紅蓮華扇',
      kind: 'active',
      plugin: 'status',
      scaling_stat: 'atk',
      damage_type: 'phys',
      element: 'fire',
      power: 130,
      crit_rate: 0.08,
      params: { status: 'burn', turns: 3, ratio: 0.08 },
      desc: '華麗な火炎の舞で敵を斬り刻み、3ターンの間「火傷（攻撃時8%ダメージ）」を付与する。',
    },
    // 【エレナ固有】全体凍結付与
    sk_hr_frost_starlight: {
      name: '星霜の零式',
      kind: 'active',
      plugin: 'status',
      scaling_stat: 'magi_power',
      damage_type: 'magi',
      element: 'water',
      power: 140,
      crit_rate: 0.05,
      params: { status: 'freeze', turns: 3, ratio: 0.20, all: true },
      desc: '絶対零度の星霜魔導を敵全体に展開し、3ターンの間「凍結（被ダメージ+20%）」を付与する。',
    },
    // 【ルーナ固有】状態異常起爆（デトネーター）
    sk_hr_eclipse_detonate: {
      name: 'エクリプス・バースト',
      kind: 'active',
      plugin: 'detonate',
      scaling_stat: 'atk',
      damage_type: 'phys',
      element: 'dark',
      power: 120,
      crit_rate: 0.08,
      params: { all: true },
      desc: '月蝕の刃で敵全体を薙ぎ払い、付与されている毒・火傷の残りダメージをすべて即座に起爆する。',
    },
    // 【フィリア固有】被弾報復カウンター
    sk_hr_sacred_vengeance: {
      name: '受難の光聖剣',
      kind: 'active',
      plugin: 'vengeance',
      scaling_stat: 'atk',
      damage_type: 'phys',
      element: 'light',
      power: 180,
      crit_rate: 0.10,
      params: { perHit: 0.35, maxBonus: 5.0 },
      desc: '受けてきた痛みを光の刃に宿して放つ。戦闘中の被弾回数に応じて威力が最大6倍まで上昇する。',
    },
    // 【ミレーヌ固有】全体追加行動・突撃号令
    sk_hr_grand_tactics: {
      name: '戦術交響曲・突撃',
      kind: 'active',
      plugin: 'mass_extra',
      scaling_stat: 'magi_power',
      damage_type: 'magi',
      element: 'earth',
      power: 0,
      crit_rate: 0,
      cooldown: 5,
      params: { buff: 0.20, turns: 1, resetCooldowns: false },
      desc: 'タクトを一閃して指揮を執り、味方全員に火力+20%のバフと即座の「追加行動」を付与する。',
    },
  },

  // ── キャラクター ────────────────────────────────
  characters: {
    ch_hr_serena: {
      name: 'セレナ',
      title: '深碧の風守り',
      rarity: 'LEGEND',
      element: 'wind',
      base:   { hp: 750, atk: 90, def: 55, magi_power: 60 },
      growth: { hp: 50, atk: 6.2, def: 3.8, magi_power: 4.0 },
      unique_skills: ['sk_hr_zephyr_shield'],
      common_skills: ['sk_gale_edge', 'sk_double_strike', 'sk_focus'],
      // 纏った風が、突かれた弱点を受け流す。
      //
      // 味方を庇う系（guardAlly / damageShare / backGuard）はテオドラの領分で、
      // 同じ鍵を持たせても battle.js は**先に見つけた1人しか庇わせない**ので、
      // 並べると片方が黙って働かなくなる。守りの方向をずらしてある。
      situational: {
        weakGuard: 0.35,
      },
      color: '#52a67d',
      accent: '#1b3827',
      glyph: '風',
      art: {
        // 立ち絵から自動計測（tools/detect_faces.py）。調整は test/art.html から。
        face: { x: 0.5325, y: 0.1097, size: 0.3645 },
        gender: 'female',
        hair: 'ponytail',
        expression: 'gentle',
        accessory: 'circlet',
        hairColor: '#52a67d',
        hairLight: '#88d9ae',
        hairDark: '#2b6348',
        eye: '#44b89d',
        eyeLight: '#a2f2df',
        outfit: '#1f382b',
        outfitLight: '#2f5944',
        outfitTrim: '#d4af37',
        accentColor: '#52a67d',
      },
      artPrompt: 'emerald green high ponytail, gentle green eyes, silver light armor with dark green mantle, gold circlet, gentle determined smile',
    },

    ch_hr_kagura: {
      name: 'カグラ',
      title: '紅蓮の舞姫',
      rarity: 'LEGEND',
      element: 'fire',
      base:   { hp: 640, atk: 125, def: 42, magi_power: 95 },
      growth: { hp: 44, atk: 8.6, def: 2.8, magi_power: 6.5 },
      unique_skills: ['sk_hr_flame_dance'],
      common_skills: ['sk_fire_bolt', 'sk_slash', 'sk_armor_break'],
      // 舞うたびに焼く。ルーナの vsStatusPower（火傷中の敵への火力）とは別で、
      // こちらは火傷そのものを撒く側。組ませると噛み合う。
      passives: {
        statusOnHitKind: { burn: 0.30 },
      },
      color: '#e8453c',
      accent: '#3d1210',
      glyph: '舞',
      art: {
        // 立ち絵から自動計測（tools/detect_faces.py）。調整は test/art.html から。
        face: { x: 0.5252, y: 0.1135, size: 0.3578 },
        gender: 'female',
        hair: 'hime',
        expression: 'smug',
        accessory: 'hairpin',
        hairColor: '#221e22',
        hairLight: '#543d48',
        hairDark: '#120f12',
        eye: '#e8453c',
        eyeLight: '#ffa89e',
        outfit: '#821e24',
        outfitLight: '#b8323a',
        outfitTrim: '#f5d77f',
        accentColor: '#e8453c',
      },
      artPrompt: 'black hime cut with red gradient tips, sharp crimson eyes, ornamental red and gold dancer kimono, floral hairpin, smug confident smirk',
    },

    ch_hr_elena: {
      name: 'エレナ',
      title: '宵星の魔導技師',
      rarity: 'LEGEND',
      element: 'water',
      base:   { hp: 720, atk: 65, def: 46, magi_power: 145 },
      growth: { hp: 48, atk: 3.5, def: 3.1, magi_power: 11.2 },
      unique_skills: ['sk_hr_frost_starlight'],
      common_skills: ['sk_aqua_lance', 'sk_magic_blade', 'sk_mind_bash'],
      passives: {
        vsStatusPower: { freeze: 0.35 },
        extraActionRate: 0.15,
      },
      color: '#64d8cb',
      accent: '#152b30',
      glyph: '零',
      art: {
        // 立ち絵から自動計測（tools/detect_faces.py）。調整は test/art.html から。
        face: { x: 0.4892, y: 0.1385, size: 0.3391 },
        gender: 'female',
        hair: 'wavy',
        expression: 'cool',
        accessory: 'visor',
        hairColor: '#a8c7e8',
        hairLight: '#e0f0ff',
        hairDark: '#5c7b9e',
        eye: '#7d6be8',
        eyeLight: '#c2b8ff',
        outfit: '#1e2538',
        outfitLight: '#2f3c5c',
        outfitTrim: '#64d8cb',
        accentColor: '#64d8cb',
      },
      artPrompt: 'pale blue long wavy hair, violet eyes, futuristic mage coat with glowing teal trim, holographic visor over forehead, cool aloof expression',
      desc: '【特殊】凍結中の敵への与ダメージ+35%。15%の確率で追加行動。敵全体に凍結を撒きつつ優位を握る。',
    },

    ch_hr_luna: {
      name: 'ルーナ',
      title: '月蝕の断罪者',
      rarity: 'LEGEND',
      element: 'dark',
      base:   { hp: 700, atk: 155, def: 50, magi_power: 70 },
      growth: { hp: 46, atk: 11.6, def: 3.2, magi_power: 4.8 },
      unique_skills: ['sk_hr_eclipse_detonate'],
      common_skills: ['sk_poison_fang', 'sk_slash', 'sk_focus'],
      passives: {
        vsStatusPower: { poison: 0.35, burn: 0.35 },
        buffOnKill: 0.20,
      },
      color: '#a37cd8',
      accent: '#251a38',
      glyph: '蝕',
      art: {
        // 立ち絵から自動計測（tools/detect_faces.py）。調整は test/art.html から。
        face: { x: 0.5517, y: 0.1117, size: 0.3584 },
        gender: 'female',
        hair: 'twin',
        expression: 'smug',
        accessory: 'circlet',
        hairColor: '#e0d8f0',
        hairLight: '#f4f0fc',
        hairDark: '#8a7ea0',
        eye: '#d64265',
        eyeLight: '#ffa0b8',
        outfit: '#251c33',
        outfitLight: '#3a2d4f',
        outfitTrim: '#a37cd8',
        accentColor: '#d64265',
      },
      artPrompt: 'silver-white twin tails, crimson eyes, gothic dark lolita dress with crescent moon ornament, black circlet, confident smirk',
      desc: '【特殊】毒・火傷中の敵への与ダメージ+35%。敵を倒すたびに固有バフ+20%。全体起爆技で瞬時に勝負を決める。',
    },

    ch_hr_philia: {
      name: 'フィリア',
      title: '受難の聖剣士',
      rarity: 'LEGEND',
      element: 'light',
      base:   { hp: 850, atk: 130, def: 45, magi_power: 40 },
      growth: { hp: 56, atk: 8.8, def: 2.8, magi_power: 2.5 },
      unique_skills: ['sk_hr_sacred_vengeance'],
      common_skills: ['sk_slash', 'sk_heavy_slash', 'sk_armor_break'],
      situational: {
        lowHpPower: 0.40,
      },
      passives: {
        capBreak: 0.25,
      },
      color: '#f5c842',
      accent: '#42320a',
      glyph: '受',
      art: {
      // 手で指定。自動計測は頭上の光輪を顔と誤検出する（§game-art-pipeline）。
      // ここを消すと tools/detect_faces.py が上書きしてしまう。
      face: { x: 0.504, y: 0.178, size: 0.29 },
        gender: 'female',
        hair: 'bob',
        expression: 'fierce',
        accessory: 'halo',
        hairColor: '#f7d879',
        hairLight: '#fff0b8',
        hairDark: '#9c8030',
        eye: '#e08a28',
        eyeLight: '#ffd48f',
        outfit: '#2e2838',
        outfitLight: '#4a405c',
        outfitTrim: '#f5c842',
        accentColor: '#f5c842',
      },
      artPrompt: 'golden-blonde bob cut hair, bright amber eyes, white and gold holy knight armor with crimson ribbons, glowing halo, fierce determined expression',
      desc: '【特殊】HPが減っているほど火力上昇（最大+40%）。ダメージ上限を25%突破。被弾を溜めて特大の報復を放つ。',
    },

    ch_hr_mylene: {
      name: 'ミレーヌ',
      title: '響律の戦術指揮官',
      rarity: 'LEGEND',
      element: 'earth',
      base:   { hp: 740, atk: 70, def: 62, magi_power: 140 },
      growth: { hp: 50, atk: 4.0, def: 4.2, magi_power: 10.8 },
      unique_skills: ['sk_hr_grand_tactics'],
      common_skills: ['sk_stone_press', 'sk_mind_bash', 'sk_focus'],
      passives: {
        extraActionRate: 0.20,
        buffDuration: 1,
      },
      color: '#82995b',
      accent: '#263016',
      glyph: '律',
      art: {
        // 立ち絵から自動計測（tools/detect_faces.py）。調整は test/art.html から。
        face: { x: 0.524, y: 0.1263, size: 0.3507 },
        gender: 'female',
        hair: 'long',
        expression: 'cool',
        accessory: 'hairpin',
        hairColor: '#303b54',
        hairLight: '#556385',
        hairDark: '#161c2b',
        eye: '#a468d6',
        eyeLight: '#debbf7',
        outfit: '#252922',
        outfitLight: '#3f4539',
        outfitTrim: '#a2bd71',
        accentColor: '#a2bd71',
      },
      artPrompt: 'dark navy-blue long straight hair, sharp amethyst eyes, elegant military commander uniform with gold epaulets and long cape, silver tactical hairpin, calm commanding expression',
      desc: '【特殊】20%の確率で追加行動。付与するバフの持続+1ターン。味方全員に追加行動と火力バフを号令する。',
    },
  },
});
