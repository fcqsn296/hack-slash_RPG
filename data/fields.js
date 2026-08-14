// フィールドカタログ (§10.2)
// フィールドの追加はこのファイルへの追記のみで完了する。
//
// pool     : 通常ウェーブで出現する敵IDのプール（ランダム抽選）
// boss     : 最終ウェーブに出現する敵ID
// enemy_lv : 出現する敵のレベル
// size     : 1ウェーブあたりの敵の数 [最小, 最大]
//
// ── gold_mult / exp_mult の決め方（test/balance.html の「4. 経済バランス」で実測）──
// gold_mult は「このフィールドは金持ち」というフレーバー値ではなく、純粋な調整つまみ。
// 敵から直接落ちるゴールドが、宝箱を鑑定して売った期待額のおよそ 2/3 に収まるよう校正してある。
// （直接ドロップが主収入になると「拾って鑑定して売る」というハクスラの動機が消えるため）
// そのため値は単調増加しない。プレイヤーから見て意味があるのは1周の総収入で、そちらは単調に増える。
RPG.data.fields = {
  fl_plain: {
    name: '始まりの草原', rec_level: 1, enemy_lv: 3, size: [1, 2],
    pool: ['em_slime', 'em_wolf', 'em_ember_bat'],
    boss: 'bs_gnaw_king',
    gold_mult: 1.0, exp_mult: 1.0,
    bg: ['#1d3a2e', '#0d1a17'],
    desc: '最初の狩場。無属性の技だけでも十分に戦える。',
  },
  fl_mine: {
    name: '崩れた廃坑', rec_level: 12, enemy_lv: 14, size: [2, 3],
    pool: ['em_golem', 'em_wisp', 'em_gale_hawk'],
    boss: 'bs_mine_tyrant',
    gold_mult: 0.80, exp_mult: 1.0,
    bg: ['#33283f', '#140f1c'],
    desc: '硬いゴーレムが並ぶ。防御無視の「破鎧撃」が刺さる。',
  },
  fl_nest: {
    name: '灼獄竜の巣', rec_level: 28, enemy_lv: 32, size: [2, 3],
    pool: ['em_drake', 'em_dark_knight', 'em_golem'],
    boss: 'bs_flame_wyrm',
    gold_mult: 0.90, exp_mult: 1.2,
    bg: ['#4a2118', '#1c0b07'],
    desc: '火属性の巣窟。水属性で挑めば有利、風属性だと焼かれる。',
  },
  fl_ruins: {
    name: '忘却の遺構', rec_level: 50, enemy_lv: 55, size: [2, 3],
    pool: ['em_sentinel', 'em_frost_maiden', 'em_thunder_beast', 'em_ash_revenant'],
    boss: 'bs_ruin_keeper',
    gold_mult: 0.92, exp_mult: 1.28,
    bg: ['#243040', '#0d1119'],
    desc: '無属性の番人が守る遺構。属性が通りにくく、素の火力とビルドが問われる。',
  },
  fl_abyss: {
    name: '終焉の深淵', rec_level: 80, enemy_lv: 90, size: [2, 3],
    pool: ['em_void_titan', 'em_solar_seraph', 'em_abyss_serpent'],
    boss: 'bs_end_dragon',
    gold_mult: 0.48, exp_mult: 1.22,
    bg: ['#2a1c3e', '#0b0713'],
    desc: '最果て。竜の宝箱が安定して手に入るが、生半可なビルドでは一撃で溶ける。',
  },

  // ── ここから先は「深淵を越えた人」のための狩り場 ──
  // 装備の強化 (§7.6) とセット効果 (§7.7) が乗ると、Lv80前後で深淵が作業になってしまう。
  // その先を用意して、育てた分だけ挑む場所が増えるようにしている。
  fl_ashfall: {
    name: '灰燼の果て', rec_level: 110, enemy_lv: 125, size: [2, 3],
    pool: ['em_cinder_queen', 'em_glass_sentinel', 'em_hollow_choir'],
    boss: 'bs_ashen_monarch',
    gold_mult: 0.35, exp_mult: 0.55, postGacha: true,
    bg: ['#3a2018', '#120806'],
    desc: '燃え尽きた世界の縁。属性が入り乱れ、単一属性のビルドでは押し切れない。',
  },
  fl_origin: {
    name: '創世の残響', rec_level: 150, enemy_lv: 170, size: [2, 3],
    pool: ['em_first_flame', 'em_null_weaver', 'em_world_root'],
    boss: 'bs_genesis_echo',
    gold_mult: 0.26, exp_mult: 0.42, postGacha: true,
    bg: ['#1b2338', '#07090f'],
    desc: '世界が始まった場所の余韻。ここまで来ると、強化と厳選を詰めていなければ削りきれない。',
  },

  /**
   * 終わりのない狩場 (§10.8)。
   *
   * ── なぜ必要か ──
   * レベル上限を伸ばせるようにしたのに、その先の周回先が
   * 「創世の残響」しか無かった。上限を上げても行き先が増えない。
   *
   * ── なぜレベルに追随させるのか ──
   * 固定の敵レベルにすると、上限を伸ばすたびに作り直すことになる。
   * パーティの水準に合わせて敵も上がる形にすれば、一度置けば済む。
   *
   * ── なぜ下限200なのか ──
   * 追随だけにすると序盤から入れてしまい、**ここだけ回れば良い**ことになる。
   * 前の狩場が全部無意味になるので、床を張って終盤専用にしてある。
   * 創世の残響（推奨150）を越えた先、という位置。
   */
  fl_endless: {
    name: '終わりなき回廊', rec_level: 200, enemy_lv: 200, size: [2, 3],
    pool: ['em_first_flame', 'em_null_weaver', 'em_world_root'],
    boss: 'bs_genesis_echo',
    gold_mult: 0.22, exp_mult: 0.36, postGacha: true,
    bg: ['#241a2e', '#0a0710'],
    /**
     * 敵のレベルをパーティに追随させる (§10.8)。
     *   floor  … これより下がらない。序盤から入れないための床
     *   above  … パーティの最高レベルより、これだけ上を出す
     */
    scaling: { floor: 200, above: 15 },
    desc: '出口の無い回廊。相手はこちらの練度に合わせて強くなり、'
      + '置いていくことができない。上限を伸ばした先の周回先。',
  },
};

/**
 * 連戦（ウェーブ制）の選択肢 (§10.1)。
 * bossFinale が true のとき、最終ウェーブがボス（ステータス1.5倍）になる。
 * 慣らし用の単発だけはボスを出さず、通常の敵と戦えるようにしてある。
 */
RPG.data.waveModes = [
  { waves: 1,  label: '腕試し (1戦)',  note: '通常の敵1組のみ',        bossFinale: false },
  { waves: 5,  label: '連戦 (5戦)',    note: '最終戦はボス／HP引き継ぎ', bossFinale: true },
  { waves: 10, label: '長期戦 (10戦)', note: '最終戦はボス／HP引き継ぎ', bossFinale: true },
];

/** 最終ウェーブのボス補正 (§10.1) */
RPG.data.bossStatMultiplier = 1.5;
