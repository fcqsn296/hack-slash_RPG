// クエストカタログ (§10.3)
// クエストの追加はこのファイルへの追記のみで完了する。
//
// ── 何のためにあるか ──
// 通常のフィールド周回はオートで回せる「作業」でよい。そのぶんクエストは、
//   1. 縛りを付けて「考えて手動で戦う」ことを要求するもの
//   2. 推奨レベルを大幅に超えるか、噛み合ったビルドでないと押し切れないもの
// の2種類に絞り、初回クリアにだけ強い報酬を置いている。
// 2回目以降の報酬は通常戦闘と同じなので、周回の金策にはならない。
//
// kind
//   'challenge' を指定すると出撃先を持たない達成条件型になる。どの戦闘で満たしてもよい。
//   condition.levelGap : 敵レベルがパーティ最高レベル + この値 以上の戦闘に勝つ
//
// rules（縛り条件。全て省略可）
//   maxLevel  : 出撃できるキャラのレベル上限
//   maxParty  : 出撃人数の上限
//   elements  : 出撃できるキャラの属性（配列）
//   maxRounds : 通算ラウンドの上限。超えたら失敗
//   allAlive  : true なら誰か倒れた時点で失敗
//   noAuto    : true ならオート戦闘を禁止
//
// enemyLv / enemyScale
//   敵のレベルと能力倍率の上書き。報酬には効かない（倍率で稼げてしまうため）。
//
// unlock（解放条件。省略なら最初から挑戦できる）
//   level : パーティ最高レベル
//   quest : 先に達成しておくクエストID
//
// reward（初回クリアのみ）
//   gold / boxes / character / equip / autoCharge（オート回数の上限を永続的に増やす）
RPG.data.quests = {

  /* =================== 0. 属性で縛るもの (§10.3-3) ===================
   *
   * `elements` は最初から用意してあったのに、**一度も使っていなかった**。
   * 属性は装備とツリーの両方に軸があるのに、それを名指しで問う場所が無い。
   *
   * 単色で組むと相性事故が確定するフィールドを選んである。
   * 「全属性適応」や「属性貫通」を積んでいれば抜けられる、という形。
   */
  q_mono_flame: {
    name: '緋一色',
    desc: '火属性のキャラだけで灼獄竜の巣を抜ける。相手も火なので、'
      + '相性で押せない。属性を扱う枝を持っているかが問われる。',
    fieldId: 'fl_nest', waves: 5, bossFinale: true,
    // 実測で 100%・2.2R と縛りが機能していなかったので、敵を引き上げてある。
    enemyLv: 95,
    rules: { elements: ['fire'], noAuto: true },
    unlock: { level: 50 },
    reward: {
      gold: 8000,
      boxes: { box_gold: 2 },
      equip: {
        base: 'eq_relic_claw', rarity: 'LEGEND', name: '緋一の爪',
        stats: { atk: 120, magi_power: 120 },
        tagBonuses: [{ tag: 'reli', value: 0.24 }],
        critRate: 0.07,
      },
    },
  },

  q_mono_tide: {
    name: '蒼一色',
    desc: '水属性のキャラだけで忘却の遺構へ。普段は使わない顔ぶれが揃っているか。'
      + '控えを育てていた人だけが通れる。',
    fieldId: 'fl_ruins', waves: 5, bossFinale: true,
    enemyLv: 125,
    rules: { elements: ['water'], noAuto: true },
    unlock: { level: 75 },
    reward: {
      gold: 14000,
      boxes: { box_dragon: 1 },
      autoCharge: 3,
    },
  },

  /* =================== 終盤帯の縛り (§10.3) ===================
   *
   * 縛りつきのクエストが推奨80までで止まっていた。
   * 上限まで育てた人が手動で挑む場所が無いので、上の帯にも置く。
   */
  q_silent_ashfall: {
    name: '沈黙の灰燼',
    desc: '灰燼の果てを、オートに頼らず15ラウンド以内で抜ける。'
      + '6ラウンドしかない。手数で押すか、一撃で畳むかを決めてから入ること。',
    fieldId: 'fl_ashfall', waves: 5, bossFinale: true,
    // 15ラウンドでは一度も引っかからなかった（実測4.2R）。
    rules: { maxRounds: 6, noAuto: true },
    unlock: { level: 110 },
    reward: {
      gold: 30000,
      boxes: { box_dragon: 2 },
      autoCharge: 5,
    },
  },

  q_unbroken_origin: {
    name: '不倒の陣',
    desc: '創世の残響を、ひとりも倒れずに抜ける。'
      + '削られてから立て直すのでは間に合わない。倒れない形を先に作ること。',
    fieldId: 'fl_origin', waves: 5, bossFinale: true,
    rules: { allAlive: true },
    unlock: { level: 150 },
    reward: {
      gold: 60000,
      boxes: { box_astral: 1 },
      equip: {
        base: 'eq_relic_mail', rarity: 'LEGEND', name: '不倒の陣衣',
        stats: { hp: 1400, def: 150 },
        tagBonuses: [{ tag: 'reli', value: 0.26 }],
        reduction: 0.1,
      },
    },
  },

  q_lone_abyss: {
    name: '独りの遺構',
    desc: '忘却の遺構へ、誰も連れずに入る。'
      + '庇う者も、癒す者もいない。30ラウンドで決めきること。',
    // 終焉の深淵では単騎の達成率が0%だった。忘却の遺構まで下げてある。
    // 5連戦だと単騎で66ラウンドかかった。数を減らして、長さではなく密度で問う。
    fieldId: 'fl_ruins', waves: 3, bossFinale: true,
    rules: { maxParty: 1, maxRounds: 30, noAuto: true },
    unlock: { quest: 'q_solo_plain', level: 80 },
    reward: {
      gold: 40000,
      boxes: { box_dragon: 2 },
      autoCharge: 5,
    },
  },

  q_endless_vigil: {
    name: '終わらぬ見張り',
    desc: '終わりなき回廊を、10ラウンド以内で抜ける。'
      + '相手はこちらの練度に合わせて上がってくるので、'
      + '育てるだけでは縮まらない。10ラウンドで決めること。',
    fieldId: 'fl_endless', waves: 5, bossFinale: true,
    // 20ラウンドでは一度も引っかからなかった（実測8.4R）。
    rules: { maxRounds: 10 },
    unlock: { level: 200 },
    reward: {
      gold: 100000,
      boxes: { box_astral: 2 },
      autoCharge: 6,
    },
  },

  /* =================== 1. 手動で考えることを要求するもの =================== */

  q_solo_plain: {
    name: '独りきりの試練',
    desc: '仲間を連れずに草原を踏破する。手数が無いぶん、技の選び方がそのまま結果になる。',
    fieldId: 'fl_plain', waves: 5, bossFinale: true,
    rules: { maxParty: 1, noAuto: true },
    reward: {
      gold: 3000,
      equip: {
        base: 'eq_longsword', rarity: 'SUPER_RARE', name: '孤影の長剣',
        stats: { atk: 46 },
        tagBonuses: [{ tag: 'phys', value: 0.22 }],
        critRate: 0.06,
      },
    },
  },

  // 出撃先を持たない「達成条件型」(§10.3-2)。
  // 以前は「Lv10以下で廃坑へ」という縛りだったが、主人公は編成から外せないため
  // 主人公のレベルが10を超えた時点で永久に達成不可能になっていた。
  // 自分との相対レベルで測る形に変えて、塔でも高難度フィールドでも達成できるようにしている。
  q_underdog: {
    name: '格上狩り',
    kind: 'challenge',
    desc: 'パーティの最高レベルより 12 以上高い敵に勝つ。場所は問わない。' +
      'フィールドでも塔でも、格上に届いた時点で達成となる。',
    condition: { levelGap: 12 },
    reward: {
      gold: 6000,
      boxes: { box_gold: 3 },
      autoCharge: 5,
    },
  },

  q_underdog_deep: {
    name: '無謀の証明',
    kind: 'challenge',
    desc: 'パーティの最高レベルより 30 以上高い敵に勝つ。ビルドが噛み合っていなければ届かない。',
    condition: { levelGap: 30 },
    unlock: { quest: 'q_underdog' },
    reward: {
      gold: 30000,
      boxes: { box_dragon: 2 },
      autoCharge: 10,
    },
  },

  q_flawless_nest: {
    name: '無傷の証明',
    desc: '灼獄竜の巣を、ひとりも倒れずに抜ける。回復と軽減の使いどころが問われる。',
    fieldId: 'fl_nest', waves: 5, bossFinale: true,
    unlock: { level: 25 },
    rules: { allAlive: true, noAuto: true },
    reward: {
      gold: 12000,
      autoCharge: 5,
      equip: {
        base: 'eq_relic_mail', rarity: 'LEGEND', name: '不倒の鎖帷子',
        stats: { def: 92, hp: 640 },
        tagBonuses: [{ tag: 'reli', value: 0.20 }],
        reduction: 0.09,
      },
    },
  },

  q_azure_oath: {
    name: '蒼の誓い',
    desc: '水属性の者だけで火の巣へ挑む。属性有利を正面から使わせる試練。' +
      '（編成から外せない主人公は縛りの対象外）',
    fieldId: 'fl_nest', waves: 5, bossFinale: true,
    unlock: { level: 28 },
    rules: { elements: ['water'], noAuto: true },
    reward: {
      gold: 15000,
      boxes: { box_dragon: 1 },
      equip: {
        base: 'eq_rod', rarity: 'LEGEND', name: '碧潮のロッド',
        stats: { magi_power: 118 },
        tagBonuses: [{ tag: 'magi', value: 0.26 }],
        critRate: 0.05, capBreak: 0.08,
      },
    },
  },

  q_blitz_ruins: {
    name: '電光石火',
    desc: '遺構の番人を10ラウンド以内に沈める。持久戦ビルドでは間に合わない。',
    fieldId: 'fl_ruins', waves: 3, bossFinale: true,
    unlock: { level: 45 },
    rules: { maxRounds: 10, noAuto: true },
    reward: {
      gold: 25000,
      autoCharge: 10,
      equip: {
        base: 'eq_ring', rarity: 'LEGEND', name: '疾走の闘輪',
        stats: { atk: 88 },
        tagBonuses: [{ tag: 'phys', value: 0.18, matchType: 'phys' }],
        critRate: 0.11, capBreak: 0.10,
      },
    },
  },

  /* =================== 2. 純粋に格上へ挑むもの =================== */

  // レジェンドを配るクエストは早い段階に置く (§10.3)。
  // 終盤に置くと、達成できる頃にはガチャで引き当てている可能性が高く、
  // 「クエストでレジェンドを手に入れて使い始める」という導線として働かないため。
  // 難度はレベルではなく敵の強化倍率で作る。
  q_trial_aegis: {
    name: '不落の楯姫',
    desc: '廃坑の奥に、崩れぬ守りを持つ者がいる。推奨レベルのままでは硬すぎるが、' +
      '属性と防御無視を噛み合わせれば早い段階でも届く。',
    fieldId: 'fl_mine', waves: 3, bossFinale: true,
    enemyLv: 20, enemyScale: 1.3,
    unlock: { level: 10 },
    reward: {
      gold: 8000,
      character: 'ch_lg_aegis',
    },
  },

  q_trial_lumen: {
    name: '天雷の審判',
    desc: '灼獄の空に裁きの雷が落ちる。火力が足りなければ、削りきる前に焼き払われる。',
    fieldId: 'fl_nest', waves: 3, bossFinale: true,
    enemyLv: 45, enemyScale: 1.3,
    unlock: { level: 25, quest: 'q_trial_aegis' },
    reward: {
      gold: 24000,
      boxes: { box_dragon: 1 },
      character: 'ch_lg_lumen',
    },
  },

  q_beyond_end: {
    name: '終焉の先',
    desc: '限界突破と装備を極めた者だけが立てる場所。この先に置かれた武器は他のどれとも違う。',
    fieldId: 'fl_abyss', waves: 5, bossFinale: true,
    enemyLv: 130, enemyScale: 1.9,
    unlock: { level: 95, quest: 'q_trial_lumen' },
    rules: { maxRounds: 40 },
    reward: {
      gold: 150000,
      boxes: { box_dragon: 5 },
      equip: {
        base: 'eq_relic_claw', rarity: 'LEGEND', name: '終焉を裂く爪',
        stats: { atk: 240, magi_power: 240 },
        tagBonuses: [
          { tag: 'phys', value: 0.24 },
          { tag: 'magi', value: 0.24 },
          { tag: 'reli', value: 0.24 },
        ],
        critRate: 0.14, capBreak: 0.22,
      },
    },
  },
};
