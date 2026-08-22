// マップ (§20)
//
// ── 歩くのは主人公だけ ──
// パーティは常に主人公が先頭に固定されているので (§8.1)、
// **主人公1人を代表として歩かせる**。仲間は戦闘のときだけ現れる。
// 見下ろしのスプライトが1人ぶんで済むので、絵の負担が桁で変わる。
//
// tiles は1文字1マスの文字列。legend でその文字の意味を引く。
// 図形で描いても本物のタイル画像を貼っても、この形式は変わらない。
//
// events は「そのマスに乗ったとき」に起きること。
//   talk  … 会話（who は data/characters.js のID。顔アイコンを出す）
//   chest … 一度きりの入手。flag に立てた印で開封済みを覚える
//   exit  … 別のマップへ移る
//   scene … 章のシーンを再生する（後で作る）

/** タイルの性質。walk が false なら踏み込めない。 */
// 色は「歩けるか」が一目で分かることを最優先にしてある。
// 最初は暗い色で揃えていたら、壁と床が地続きに見えて地図が読めなかった。
// 歩けるマスは明るく、歩けないマスは沈める。
RPG.data.tileKinds = {
  floor: { label: '床',   walk: true,  encounter: true,  color: '#6d7385' },
  grass: { label: '草',   walk: true,  encounter: true,  color: '#4c7a55' },
  road:  { label: '道',   walk: true,  encounter: false, color: '#9c8a63' },
  wall:  { label: '壁',   walk: false, encounter: false, color: '#14161c' },
  water: { label: '水',   walk: false, encounter: false, color: '#1d4b6a' },
  stair: { label: '階段', walk: true,  encounter: false, color: '#d8b45a' },
};

RPG.data.maps = {
  mp_forge: {
    name: '灰銀の炉',
    desc: '目覚めた場所。まだ外の様子は分からない。',
    // 道（road）は安全地帯。拠点の中で敵に襲われないようにする。
    tiles: [
      '##############',
      '#....##......#',
      '#....##......#',
      '#............#',
      '####..####..##',
      '#......=.....#',
      '#............#',
      '#..~~~..####.#',
      '#..~~~..#....>',
      '#.......#....#',
      '##############',
    ],
    legend: {
      '#': 'wall', '.': 'floor', '~': 'water', '=': 'road', '>': 'stair',
    },
    start: { x: 2, y: 2 },
    // この中では戦闘が起きない。最初の場所で殴られると説明が入らない。
    encounter: null,
    events: [
      { x: 5, y: 5, kind: 'talk', who: 'ch_rizel',
        text: 'ここが灰銀の炉。……あなた、本当に目を覚ましたのね。' },
      { x: 11, y: 2, kind: 'chest', flag: 'forge_chest_1',
        gold: 300, boxes: { box_bronze: 2 } },
      { x: 13, y: 8, kind: 'exit', to: 'mp_ashfield', at: { x: 1, y: 5 } },
    ],
  },

  mp_ashfield: {
    name: '灰の野',
    desc: '炉の外。灰がまだ降っている。',
    tiles: [
      '####################',
      '#,,,,,,,,,,,,,,,,,,#',
      '#,,,####,,,,,,####,#',
      '#,,,#..#,,,,,,#..#,#',
      '#,,,####,,,,,,####,#',
      '<,,,,,,,,,,,,,,,,,,#',
      '#,,,,,,,,~~~~,,,,,,#',
      '#,,####,,~~~~,,###,#',
      '#,,#..#,,,,,,,#.#,,#',
      '####################',
    ],
    legend: {
      '#': 'wall', ',': 'grass', '.': 'floor', '~': 'water', '<': 'stair',
    },
    start: { x: 1, y: 5 },
    // 草の上でだけ敵が出る。rate は1歩あたりの確率。
    encounter: { fieldId: 'fl_plain', waves: 2, bossFinale: false, rate: 0.12 },
    events: [
      { x: 1, y: 5, kind: 'exit', to: 'mp_forge', at: { x: 12, y: 8 } },
      { x: 5, y: 3, kind: 'chest', flag: 'ash_chest_1', gold: 500 },
      { x: 17, y: 8, kind: 'chest', flag: 'ash_chest_2', boxes: { box_silver: 1 } },
    ],
  },
};
