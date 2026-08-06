// エンドレスタワー (§10.7)
//
// ── 何のためにあるか ──
// オートは1周3.6秒でこなせてしまうため、通常フィールドは「作業」に寄る。
// タワーはその受け皿で、**手動でしか深く行けない場所**として作ってある。
//   - HPが階をまたいで持ち越される。回復は決まった階でしか起きない
//   - 倒れたら終了。そこまでの到達階が記録になる
//   - 弱点コンボ (§10.6) を繋げられるかで到達階が変わる。オートAIはコンボを組めない
//
// 階層の追加は tiers への追記だけで済む。上限は無く、最後の帯が延々と続く。
RPG.data.tower = {
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
  ],
};
