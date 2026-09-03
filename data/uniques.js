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

  // ── 狙い (§5.9) ──
  // 反撃・棘・庇うは「殴られてから」効くのに、殴られるかどうかを選べなかった。
  uq_public_eye: {
    name: '衆目の甲', base: 'eq_relic_mail', color: '#e0b45c',
    desc: '目立つために作られた鎧。守るためではなく、引き受けるために。',
    stats: { hp: 1100, def: 120 },
    effects: { taunt: 0.7, counterRate: 0.18 },
    note: '狙われやすさ +70%／反撃率 +18%',
  },

  uq_soundless: {
    name: '無音の外套', base: 'eq_robe', color: '#6b7a90',
    desc: '在ることを主張しない布。誰も、そこに人がいると思わない。',
    stats: { magi_power: 175, hp: 480 },
    effects: { stealth: 0.55, evade: 0.08 },
    note: '狙われにくさ -55%／回避 +8%',
  },

  // ── バフ役の分岐 (§5.12) ──
  uq_war_banner: {
    name: '万軍の旗印', base: 'eq_relic_core', color: '#7fc9ff',
    desc: '掲げた者には何も起きない。見上げた者の足だけが速くなる。',
    stats: { hp: 760, magi_power: 130 },
    effects: { allyBuffPower: 0.65, buffExtend: 1 },
    note: '味方にかけるバフの効果量 +65%／かけるバフの持続 +1ターン',
  },

  uq_lone_crown: {
    name: '孤高の冠', base: 'eq_relic_seal', color: '#c58cff',
    desc: '戴く頭は一つでよい。分け与えるための造りではない。',
    stats: { atk: 150, magi_power: 150 },
    effects: { selfBuffPower: 0.55, supportStack: 0.05 },
    note: '自分にかけるバフの効果量 +55%／バフをかけるたび +5%',
  },

  // ── 回復を攻めに向ける (§5.11) ──
  uq_searing_seal: {
    name: '灼身の聖印', base: 'eq_relic_claw', color: '#ffd98a',
    desc: '癒しと裁きは、同じ光の裏表でしかない。',
    stats: { magi_power: 200 },
    effects: { smite: 0.5, triage: 0.4 },
    note: '回復した量の 50% が敵へ／瀕死の相手への回復量 +40%',
  },

  uq_prayer_edge: {
    name: '祈刃', base: 'eq_relic_claw', color: '#9ad6a0',
    desc: '祈りの文句を刃に彫った者がいた。両方に効くように、と。',
    stats: { atk: 165, magi_power: 165 },
    effects: { healToPower: 0.22, mendPower: 0.15 },
    note: '「与える回復量」の伸びの 22% ぶん火力／受けた回復量による火力 +15%',
  },

  // ── 支援の枝 (§5.10) ──
  uq_cleansing_cup: {
    name: '濯ぎの杯', base: 'eq_relic_core', color: '#8fd8ff',
    desc: '汚れを落とすためだけの器。攻めの役には一切立たない。',
    stats: { hp: 900, magi_power: 120 },
    effects: { cleanse: 0.45, healPower: 0.3 },
    note: '回復時 45% で弱体を1つ解く／与える回復量 +30%',
  },

  uq_tide_ring: {
    name: '波紋の環', base: 'eq_amulet', color: '#7be0b5',
    desc: '一滴が池を渡る。狙った先だけが濡れるわけではない。',
    stats: { magi_power: 185, hp: 520 },
    effects: { healSpread: 0.5, lowHpHeal: 0.05 },
    note: '回復が他の味方へ 50% 及ぶ／ラウンド終了時、瀕死の味方を 5% 回復',
  },

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

  // ── 防御で耐える道 (§5.8) ──
  // ツリーだけで完結させると、装備の選択が関与しなくなる。
  // ここを着けて初めて7割カットに手が届く、という位置に置いてある。
  uq_bulwark_heart: {
    name: '不落の心臓', base: 'eq_relic_mail', color: '#8fb0d8',
    desc: '守りを極めた者だけが意味を持てる。攻める者が着けても重いだけ。',
    stats: { def: 260, hp: 1600 },
    effects: { hpToDef: 0.10, guardAlly: 0.2 },
    note: '最大HPの10%をDEFへ／味方をかばう +20%',
  },

  // ── 空いていた軸を埋める5種 (§7.8) ──
  //
  // 既存の14種を並べたところ、ユニーク装備が1つも無い軸が4つあった。
  //   会心・追加行動・支援（回復と障壁）・弱体の広がり
  // 会心には専用ビルドまであるのに、着ける装備が無い状態だった。
  // 以下はその穴を埋めるもので、既存と役割が重ならないよう選んである。

  uq_piercing_gaze: {
    name: '見透かしの眼', base: 'eq_amulet', color: '#ffd76a',
    desc: '急所だけが見える。狙って当てるのではなく、当たる場所が分かる。',
    stats: { magi_power: 150, atk: 150 },
    // 会心の軸。率ではなく「刺さり方」を強くするので、
    // 率を稼ぐツリーと足し算ではなく掛け算になる。
    effects: { critDamage: 0.5, critPierce: 0.35 },
    note: '会心倍率 +0.5 ／ 会心時に防御を35%無視',
  },

  uq_stolen_moment: {
    name: '盗まれた刻', base: 'eq_relic_core', color: '#9be8d8',
    desc: '一拍だけ、世界が待ってくれる。返す当てはない。',
    stats: { atk: 120, magi_power: 120 },
    // 手番の軸。行動回数はそのまま総火力なので、率は低めに置いてある。
    // ambush は1ラウンド目だけなので、確率を高くしても壊れない。
    effects: { extraActionRate: 0.12, ambush: 0.4 },
    note: '再行動 12% ／ 1ラウンド目の奇襲 40%',
  },

  uq_mending_vow: {
    name: '癒しの誓約', base: 'eq_relic_seal', color: '#8ce8b4',
    desc: '治すのではなく、壊れる先に置いておく。',
    stats: { hp: 1200, def: 90 },
    // 支援の軸。回復を強くするだけだと満タンの相手に無駄になるので、
    // あふれを障壁に変える枝とセットにして、撃ち先を選ばなくてよくする。
    effects: { healPower: 0.4, overhealShield: 0.6 },
    note: '回復量 +40% ／ あふれた回復の60%を障壁に',
  },

  uq_creeping_bloom: {
    name: '這い寄る花', base: 'eq_relic_claw', color: '#c58cff',
    desc: '一輪から始まる。気づいたときには畑になっている。',
    stats: { magi_power: 180 },
    // 弱体を「広げて活かす」軸。撒く強さ（statusPower）は既存が持っているので、
    // こちらは伝染と、弱体中の相手への上乗せに寄せてある。
    effects: { debuffSpread: 0.35, debuffAmp: 0.25 },
    note: '弱体が隣へ伝染 35% ／ 弱体中の相手への火力 +25%',
  },

  uq_giantslayer: {
    name: '巨躯断ち', base: 'eq_greataxe', color: '#ff8a5c',
    desc: '大きいものほど、断つ場所が分かりやすい。',
    stats: { atk: 200 },
    // 状況の軸。ボス戦だけで効くぶん、数字は大きめに置ける。
    // execute は相手が削れているほど伸びるので、長期戦のボスと噛み合う。
    effects: { bossSlayer: 0.35, execute: 0.5 },
    note: 'ボスへの火力 +35% ／ 相手が削れているほど火力が伸びる',
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

  // ── 物理のベースだけ空いていた2枠を埋める (作業ログ「ユニーク装備の偏りを直す」) ──
  //
  // 27種のうち20種(74%)が遺物ベースに集中し、物理は2種(7%)しかなかった。
  // ベース単位で数え直すと、実際に0だったのは eq_plate（物理防具）と
  // eq_longsword（物理武器）と eq_rod（魔術武器）の3つ。
  // 魔術は他に4種あるので薄いとまでは言えず、物理の2つだけを埋める。
  //
  // どちらも既存27種が使っていない効果キーを選び、役割が重ならないようにした。
  uq_returning_wall: {
    name: '返照の鎧', base: 'eq_plate', color: '#d4a373',
    desc: '殴られてなお立つ。押し返すためだけに鍛えられた、無骨な板金の鎧。',
    stats: { def: 190, hp: 1350 },
    // reflect は既存27種のどれも使っていなかった軸（棘・反射の型はwrathで代用されていた）。
    // 数値は tr_reflect(mid,8%×4)/tr_reflect_hi(high,15%×3)のツリー投資の
    // 一部を肩代わりする程度に置いた。shieldRegen も既存未使用で、tr_shield_regen系
    // （2.5〜4.5%×4）を1段上回る程度。防具の対価（タグ喪失）に見合う「殴られても崩れない」枠。
    effects: { reflect: 0.18, shieldRegen: 0.06 },
    note: '受けたダメージの18%を反射／ラウンド終了時に最大HPの6%の障壁',
  },

  uq_wandering_edge: {
    name: '渡り刃', base: 'eq_longsword', color: '#b0413e',
    desc: '振り抜いた先に、次の敵がいる。止まるということを知らない剣。',
    stats: { atk: 190 },
    // chain / chainPower も既存27種のどれも使っていなかった軸。単体技の威力の一部を
    // 他の敵全員へ流す（ツリー『波及』『波及の心得』の一部を肩代わりする程度の値）。
    // 単体特化ではなく多数の敵と戦う場面で効く、既存の多段勢（双月の環／万手の刃）とは
    // 違う「1体を叩いた余波で他も削る」型。
    effects: { chain: 0.22, chainPower: 0.35 },
    note: '単体攻撃の余波が他の敵へ威力22%で及ぶ／その余波の威力 +35%',
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
