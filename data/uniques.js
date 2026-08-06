// ユニーク装備 (§7.8)
//
// ── 竜の宝箱との住み分け ──
// 竜の宝箱は「数値を伸ばす」ための箱。系統タグ倍率・クリティカル・上限突破が乗り、
// 素直に強くなる。星辰の宝箱から出るここの装備は **系統タグ倍率を一切持たない** 代わりに、
// ビルドの方向性そのものを変える固有効果を持つ。
//
// つまり「攻撃力を伸ばしたいなら竜」「戦い方を変えたいなら星辰」という選択になる。
// 素の数値では竜に負けるので、効果を活かせる構成でなければ着ける意味が無い。
//
// effects のキーは既存のパッシブ／セット効果と同じものを使う。
// 新しいキーを足すときは battle.js / units.js 側にも処理を書くこと。
RPG.data.uniqueEquips = {

  uq_myriad_edge: {
    name: '万手の刃', base: 'eq_relic_claw', color: '#8fd8ff',
    desc: '威力の低い技ほど鋭くなる。小技を並べた構成でしか本領を出さない。',
    stats: { atk: 150, magi_power: 150 },
    effects: { lowPowerBoost: 0.5, lowPowerRepeat: 1 },
    note: '小技 +50%／小技が1回多く発動',
  },

  uq_echo_shell: {
    name: '反響の外殻', base: 'eq_relic_mail', color: '#a8e0ff',
    desc: '受けた衝撃を蓄え、放つ。殴られる前提の構成で噛み合う。',
    stats: { def: 180, hp: 1400 },
    effects: { wrathRatio: 0.55, wrathRelease: true },
    note: '被弾の55%を怒りに変え、次の攻撃で解放',
  },

  uq_scatter_ring: {
    name: '拡散の環', base: 'eq_ring', color: '#7be0b5',
    desc: '狙いを定めることをやめた者の指輪。単体技という概念が消える。',
    stats: { atk: 120 },
    effects: { lowPowerSpread: 1, lowPowerBoost: 0.2 },
    note: '小技が敵全体に当たる／小技 +20%',
  },

  uq_hollow_crown: {
    name: '虚ろの王冠', base: 'eq_relic_seal', color: '#b58cff',
    desc: '倒れた者の数だけ重くなる冠。危うい編成ほど強い。',
    stats: { def: 110, hp: 900 },
    effects: { fallenPower: 0.5, reviveHp: 0.4 },
    note: '倒れた仲間1人につき火力+50%／HP40%で復活',
  },

  uq_first_strike: {
    name: '初手の理', base: 'eq_grimoire', color: '#ffd76a',
    desc: '最初の一撃だけに全てを賭ける書。長引けば意味を失う。',
    stats: { magi_power: 160 },
    effects: { firstRoundPower: 1.5, decayPerRound: 0.15, decayFloor: 0.4 },
    note: '1ラウンド目 +150%／以降1ラウンドごとに-15%（下限40%）',
  },

  uq_chain_reaction: {
    name: '連鎖の触媒', base: 'eq_amulet', color: '#ff9fd8',
    desc: '一撃が次の一撃を呼ぶ。手数が手数を生む。',
    stats: { magi_power: 130 },
    effects: { autoLowSkill: 0.6, lowPowerBoost: 0.25 },
    note: '攻撃後60%で小技が自動発動／小技 +25%',
  },

  uq_unbound_core: {
    name: '無縛の核', base: 'eq_relic_core', color: '#cfe3f0',
    desc: '属性という枠を外した核。苦手が無くなる代わりに、得意も無くなる。',
    stats: { hp: 1200 },
    effects: { elementAdapt: 1, comboLock: true },
    note: '属性不利を受けない／弱点コンボが落ちない',
  },
};

/**
 * 星辰の宝箱からユニーク装備が出る確率。
 * 外れたときは通常の装備が出る。
 */
RPG.data.uniqueDropChance = 0.45;
