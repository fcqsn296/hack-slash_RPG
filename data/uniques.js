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

  // ── 中技帯 (§5.8) ──
  // 攻撃技89個のうち44個がこの帯にあるのに、支える装備が1つも無かった。
  uq_seeping_fang: {
    name: '浸食の牙', base: 'eq_relic_claw', color: '#9ad6a0',
    desc: '重すぎず軽すぎない一撃だけが、相手の芯まで届く。',
    stats: { atk: 140, magi_power: 140 },
    effects: { midPowerStatus: 0.8, statusPower: 0.25 },
    note: '中技の弱体付与率 +80%／継続ダメージ +25%',
  },

  uq_linking_chain: {
    name: '連環の鎖', base: 'eq_relic_core', color: '#7fc9ff',
    desc: '繋ぐことに徹する者の得物。自分では決めない。',
    stats: { hp: 900, def: 90 },
    effects: { midPowerCombo: 1, comboPower: 0.04 },
    note: '中技でコンボ +1段／コンボ1段あたりの伸び +4%',
  },

  // ── 大技と上限突破 (§3.2 ステップ8) ──
  // 終盤の大技は上限に潰されて中技の1.9倍しか出ていない。そこを抜けるための道。
  uq_breaking_dawn: {
    name: '破暁の一撃', base: 'eq_relic_claw', color: '#ff9a5c',
    desc: '限界の向こう側にしか用がない。届かぬうちは重いだけの鉄塊。',
    stats: { atk: 190 },
    effects: { capBreak: 0.45, highPowerBoost: 0.3 },
    note: 'ダメージ上限突破 +45%／大技の火力 +30%',
  },

  // ── 状態異常で盤面を作る (§5.6) ──
  uq_plague_seal: {
    name: '疫の封', base: 'eq_relic_seal', color: '#b58cff',
    desc: '削るのではない。相手が勝手に崩れていくのを待つ。',
    stats: { def: 110, hp: 700 },
    effects: { statusPower: 0.5, debuffDuration: 1 },
    note: '継続ダメージ +50%／与える弱体の持続 +1ターン',
  },

  // ── 手数で押す (§17 千葬の守り手の答え) ──
  uq_twin_moons: {
    name: '双月の環', base: 'eq_relic_core', color: '#c8d4e8',
    desc: '一度で足りぬなら二度。数を数える相手には、これしかない。',
    stats: { hp: 800, atk: 90 },
    effects: { doubleHits: 1 },
    note: '攻撃技が必ず2回発動する',
  },

  // ── 1体と向き合う (§17 闘技場の答え) ──
  uq_duelists_oath: {
    name: '一騎の誓い', base: 'eq_relic_mail', color: '#ffd08a',
    desc: '相手が一人なら、こちらも一人でよい。数を頼まぬ者の鎧。',
    stats: { def: 150, hp: 1100 },
    effects: { loneFoePower: 0.45, counterRate: 0.2 },
    note: '敵が1体のとき火力 +45%／反撃 20%',
  },

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
 *
 * 1.0 —— つまり **必ず出る**。
 *
 * 0.45 にしていた頃は、竜の宝箱との違いが体感できなかった。
 * 星辰は推奨Lv150のフィールドでしか手に入らない最上位の箱なのに、
 * 半分以上は「ただのレジェンド装備」が出るため、
 * 何個か開けても竜の宝箱と区別が付かない。
 *
 * 箱の種類そのものを差別化の軸にする:
 *   竜の宝箱   … 数値を伸ばす（系統タグ倍率つきの通常装備）
 *   星辰の宝箱 … 戦い方を変える（系統タグを持たないユニーク装備）
 *
 * これで「どちらを狙うか」が装備の方向性の選択になる。
 */
RPG.data.uniqueDropChance = 1.0;
