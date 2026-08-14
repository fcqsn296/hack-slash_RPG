// @ts-check
/**
 * 【見本】拡張コンテンツの書き方 (§18)。
 *
 * このファイルは `_` で始まるので **読み込まれません**。
 * 書き方を確かめるための見本として置いてあります。
 * 実際に足すときは `_` を外した名前で新しいファイルを作ってください
 * （例: content/yoiyami.js）。このファイルは書き換えないこと。
 *
 * 決まりの全文は docs/拡張コンテンツの作り方.md にあります。
 */
RPG.content.add('見本パック', {

  // ── 技 ──────────────────────────────────────────
  // ID は sk_ で始める。plugin は src/plugins/ にあるものだけ使える。
  skills: {
    sk_ex_moonfall: {
      name: '月墜とし', kind: 'active', plugin: 'multi_hit',
      scaling_stat: 'atk', damage_type: 'phys', element: 'dark',
      power: 70, crit_rate: 0.08,
      params: { hits: 3 },
      desc: '闇属性の3連撃。1発あたりの威力は低いが、会心が乗りやすい。',
    },
  },

  // ── キャラクター ────────────────────────────────
  // ID は ch_ で始める。unique_skills / common_skills は
  // コアか、この拡張の中にある技IDしか書けない（無いIDを書くと取り込まれない）。
  characters: {
    ch_ex_luna: {
      name: 'ルナ', title: '月影の狩人', rarity: 'SUPER_RARE', element: 'dark',
      base: { hp: 700, atk: 120, def: 48, magi_power: 70 },
      growth: { hp: 48, atk: 8.4, def: 3.1, magi_power: 5.0 },
      unique_skills: ['sk_ex_moonfall'],
      common_skills: ['sk_slash'],
      color: '#8f7fd8', accent: '#1d1730', glyph: '月',
      // art は **全項目を埋める**。1つでも欠けると、立ち絵を用意する前の
      // 代用SVGで色が抜けたまま表示される。項目の意味は
      // docs/拡張コンテンツの作り方.md の「アートの指定」を参照。
      art: {
        gender: 'female', hair: 'long', expression: 'cool', accessory: 'circlet',
        hairColor: '#c9b6f2', hairLight: '#e8ddff', hairDark: '#6a5a90',
        eye: '#8f7fd8', eyeLight: '#d8ccff',
        outfit: '#2a2340', outfitLight: '#3d3358', outfitTrim: '#c9b6f2',
        accentColor: '#8f7fd8',
        // face は立ち絵を入れたあと tools/detect_faces.py が自動で書き込む。
        // 先に手で書く必要はない。
      },
      // 生成プロンプトはここに書く。tools/novelai_gen.py がそのまま読む。
      artPrompt: 'silver-purple long hair, violet eyes, dark hunter coat, '
        + 'crescent moon circlet, calm confident expression',
    },
  },

  // ── ユニーク装備 ────────────────────────────────
  // ID は uq_ で始める。base はコアの equipBases にあるIDを指す。
  //
  // effects に書けるキーは決まっている（RPG.units.UNIQUE_EFFECT_KEYS）。
  // 一覧に無いキーは装備しても **何も起きない** ——エラーも警告も出ないので、
  // 一番気付きにくい事故になる。取り込みの検査で弾くようにしてある。
  // 使えるキーの全文は docs/拡張コンテンツの作り方.md にある。
  uniques: {
    uq_ex_moonveil: {
      name: '月帳', base: 'eq_relic_mail', color: '#8f7fd8',
      desc: '月の光でできた薄い帳。自分より先に、隣の者を包む。',
      stats: { def: 120, hp: 700 },
      effects: { guardAlly: 0.2, hpToDef: 0.05 },
      note: '味方をかばう +20% ／ 最大HPの5%をDEFへ',
    },
  },

  // ── スキルツリーのノード ────────────────────────
  // ID は tr_ で始める。tier は basic / mid / high のどれか。
  // effects の kind は既にコアが解釈できるものだけ使える（新しい種別は足せない）。
  treeNodes: [
    {
      id: 'tr_ex_moonlight', tier: 'mid', name: '月光の心得', cost: 3, maxLevel: 4,
      // 遺物は 'reli'。'relic' と書いても どの装備とも一致せず、
      // 倍率が1のまま黙って終わる（実際にここで書き間違えた）。
      effects: [{ kind: 'tag_bonus', tag: 'reli', value: 0.12 }],
      desc: '[遺物]系統の倍率 +12%',
    },
  ],
});
