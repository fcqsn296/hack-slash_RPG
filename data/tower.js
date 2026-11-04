// エンドレスタワー (§10.7)
//
// ── 何のためにあるか ──
// オートは1周3.6秒でこなせてしまうため、通常フィールドは「作業」に寄る。
// タワーはその受け皿で、**手動でしか深く行けない場所**として作ってある。
//   - HPが階をまたいで持ち越される。回復は決まった階でしか起きない
//   - 倒れたら終了。そこまでの到達階が記録になる
//   - 弱点コンボ (§10.6) を繋げられるかで到達階が変わる。オートAIはコンボを組めない
//
// ── 訂正 (2026-11): オートでも深く登れる ──
// 「手動でしか深く行けない」と書いていたが、終盤のビルドならオートで120〜150階台まで届く。
// そして**届く階が組み方で分かれる**（下の milestones の注記）。手動の腕と同じくらい、
// オート用にパーティを組む腕が出る場所になっている。
//
// 階層の追加は tiers への追記だけで済む。上限は無く、最後の帯が延々と続く。
RPG.data.tower = {
  /**
   * 挑めるようになる主人公のレベル (§10.7)。
   *
   * 塔はHPが階をまたいで持ち越される。回復手段も編成も整わないうちに入ると、
   * 数階で倒れて「記録が残るだけ」になる。クラスが開いた次の段に置いてある。
   */
  unlockLevel: 40,

  /** 何階ごとにボスが出るか */
  bossEvery: 5,

  /** ボス階を越えたときに回復する割合（最大HPに対して） */
  restHeal: 0.35,

  /** 1階あたり敵レベルがいくつ上がるか */
  levelPerFloor: 1.7,

  /** 1階あたり敵の能力倍率がいくつ上がるか（加算） */
  scalePerFloor: 0.035,

  /** ボス階の追加倍率 */
  bossScale: 1.25,

  /**
   * 階層帯。floor がこの from 以上のとき、この帯の敵が出る。
   * 敵のプールは既存フィールドから借りるので、フィールドを増やせばここも増やせる。
   */
  tiers: [
    { from: 1,  fieldId: 'fl_plain', label: '外郭' },
    { from: 11, fieldId: 'fl_mine',  label: '坑道層' },
    { from: 26, fieldId: 'fl_nest',  label: '灼熱層' },
    { from: 46, fieldId: 'fl_ruins', label: '遺構層' },
    { from: 71, fieldId: 'fl_abyss', label: '深淵層' },
    { from: 101, fieldId: 'fl_ashfall', label: '灰燼層' },
    { from: 141, fieldId: 'fl_origin', label: '創世層' },
  ],

  /**
   * 到達報酬。**最高到達階を更新したときにだけ**出る。
   * 周回して稼ぐ場所にしないための決まりで、クエストの初回クリア報酬と同じ考え方。
   */
  reward: {
    /** 1階あたりのゴールド（階数に比例して伸びる） */
    goldPerFloor: 240,
    /** 何階ごとに宝箱が出るか */
    boxEvery: 5,
    /** 深さに応じて出る宝箱。floor がこの from 以上なら、この宝箱になる */
    boxTiers: [
      { from: 1,  box: 'box_silver' },
      { from: 21, box: 'box_gold' },
      { from: 51, box: 'box_dragon' },
      { from: 101, box: 'box_astral' },
    ],
  },

  /**
   * 節目の追加報酬。到達したときに1度だけ。
   * 追記するだけで増やせる。
   */
  milestones: [
    { floor: 10, autoCharge: 5 },
    { floor: 25, autoCharge: 5, boxes: { box_dragon: 2 } },
    {
      floor: 40,
      equip: {
        base: 'eq_relic_seal', rarity: 'LEGEND', name: '登頂者の紋章',
        stats: { def: 96, hp: 520 },
        tagBonuses: [{ tag: 'reli', value: 0.22 }],
        critRate: 0.06, reduction: 0.05,
      },
    },
    { floor: 50, autoCharge: 10, boxes: { box_dragon: 3 } },
    {
      floor: 75,
      equip: {
        base: 'eq_grimoire', rarity: 'LEGEND', name: '塔頂の写本',
        stats: { magi_power: 232 },
        tagBonuses: [{ tag: 'magi', value: 0.28 }],
        critRate: 0.10, capBreak: 0.16,
      },
    },
    { floor: 100, autoCharge: 10, boxes: { box_dragon: 8 } },

    // ── 100階より先 (2026-11) ──
    // 節目が100階で尽きていて、その先は毎階のゴールドと5階ごとの宝箱しか無かった。
    // だが塔は、オートのままで**組み方が到達階に出る**場所になっている
    // （REFERENCE の型・Lv255・101階から、seed固定8回の中央値）:
    //   攻撃専念 124階   既定(軽減20%) 133階   守り役1＋攻撃専念3 153階（最大157）
    // 周回フィールドを触らずに「どこまで登れるか」で張り合える。その目標を置く。
    // 125階は組み方を問わず届く手前、150階は守りを組んだパーティの線、
    // 175・200階は REFERENCE より強い実プレイ（実データは REFERENCE の約1.2倍）の伸びしろ。
    //
    // 装備は竜の LEGEND の上位1割（スコア750〜870）に並ぶ強さにしてある（125階 754・175階 834）。
    // 系統タグを3系統に散らしてあるのは、散らすほど強いこのゲームの規則に乗せるため。
    // 星霜の欠片は闘技場でしか手に入らず、上限解放と再抽選で取り合いになっていた。
    // オート回数の上限は配らない。報酬の合計が頭打ち（100）を既に使い切っている（検証テストが見ている）。
    { floor: 110, boxes: { box_astral: 3 } },
    {
      floor: 125,
      equip: {
        base: 'eq_longsword', rarity: 'LEGEND', name: '天頂の剣',
        stats: { atk: 360 },
        tagBonuses: [{ tag: 'phys', value: 0.30 }, { tag: 'magi', value: 0.18 }, { tag: 'reli', value: 0.18 }],
        critRate: 0.08, capBreak: 0.15,
      },
    },
    { floor: 150, items: { it_star_shard: 2 }, boxes: { box_astral: 3 } },
    {
      floor: 175,
      equip: {
        base: 'eq_plate', rarity: 'LEGEND', name: '不落の天蓋',
        stats: { def: 230, hp: 1350 },
        tagBonuses: [{ tag: 'phys', value: 0.22 }, { tag: 'reli', value: 0.22 }],
        reduction: 0.10,
      },
    },
    { floor: 200, items: { it_star_shard: 3 }, boxes: { box_astral: 8 } },
  ],
};
