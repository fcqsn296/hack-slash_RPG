// クラス (§12)
//
// ── スキルツリーとの役割分担 ──
// スキルツリー (§5) は「浅く広く、少しずつ積む」場所で、SPはレベルごとに1つ配られる。
// クラスはその逆で、**5レベルに1ポイントしか配られない代わりに1つ1つが重い**。
// 1キャラ1クラス専任なので、選んだ瞬間にそのキャラの役割が決まる。
//
// ── クラス技に必ず制限が付く理由 ──
// 「全体蘇生」「全体8割軽減」のような技は、無条件だと戦闘の組み立てを消してしまう。
// そこで2つの鍵をかけている:
//   readyRound … 指定ラウンドに入るまで撃てない（短期決戦ビルドでは使えない）
//   cooldown   … 撃つと指定ラウンド使えない（いつ切るかの判断が生まれる）
// どちらもラウンドを数えるだけなので、オート戦闘では活かしきれない。
// 手動で戦う理由をもう一段作る仕掛けでもある (§10.6 と同じ狙い)。
//
// nodes の effects は スキルツリーと同じ効果種別をそのまま使う。
// 新しいクラスを足すときも、ここに1つ書けば tree.js の集約がそのまま働く。

RPG.data.classPointsPerLevel = 5;   // 何レベルごとに1ポイント配るか
RPG.data.classChangeCost = 30000;   // 転職（＝クラスポイントの振り直し）にかかるゴールド

/**
 * クラスポイントを1点だけ戻すときの費用 (§12)。
 * 全部戻すと 15,000G で、上限レベルなら約 300G/点。
 * ツリー側と同じ考えで、1点だけ抜くほうを割高にしてある。
 */
RPG.data.classRefundCostPerPoint = 800;

RPG.data.classes = {

  cls_guardian: {
    name: '守護者', color: '#7fb3ff', icon: 'stat-def',
    flavor: '盾は、後ろに誰かがいて初めて意味を持つ。',
    desc: '味方の被害を引き受ける役。単体では何も生み出さないが、' +
      '後衛が生き延びる時間をそのまま火力に変える。',
    // クラスに就いているだけで得られる素質。ポイントを振らなくても効く。
    innate: [
      { kind: 'stat_pct', stat: 'hp', value: 0.15 },
      { kind: 'stat_pct', stat: 'def', value: 0.20 },
    ],
    innateDesc: '最大HP +15% / DEF +20%',
    /* ── 派生 (§12) ──
       3つのうち1つしか選べない。片方に振ると他の2つは封じられる。
       乗り換えるには振り戻すか転職する。 */
    branches: {
      br_gd_fortress: { name: '城塞', desc: '動かない壁になる。攻めを捨て、抜かせないことに全部を使う。' },
      br_gd_undying: { name: '不倒', desc: '倒れないことに賭ける。一度きりの粘りを何重にも重ねる。' },
      br_gd_asura: { name: '修羅', desc: '受けた痛みをそのまま返す。殴られるほど手数が増える。' },
    },
    nodes: [
      {
        id: 'gd_guard', name: '盾の誓い', cost: 1, maxLevel: 3,
        effects: [{ kind: 'guard_ally', value: 0.10 }],
        desc: '味方が受けるダメージの10%を肩代わりする',
      },
      {
        id: 'gd_share', name: '衆の護り', cost: 1, maxLevel: 3,
        effects: [{ kind: 'damage_share', value: 0.10 }],
        desc: '自分が受けたダメージの10%を味方全員で分ける',
      },
      {
        id: 'gd_shield', name: '不断の壁', cost: 2, maxLevel: 3,
        effects: [{ kind: 'shield_regen', value: 0.05 }],
        desc: 'ラウンド終了時に最大HPの5%ぶんの障壁を張り直す',
      },
      {
        id: 'gd_convert', name: '鉄血の構え', cost: 2, maxLevel: 3,
        effects: [{ kind: 'def_to_atk', value: 0.30 }],
        desc: 'DEFの30%をATKと魔力に上乗せ（硬さがそのまま火力になる）',
      },
      {
        id: 'gd_mirror', name: '返す盾', cost: 2, maxLevel: 3,
        effects: [{ kind: 'reflect', value: 0.10 }],
        desc: '受けたダメージの10%をそのまま相手へ返す',
      },
      {
        branch: 'br_gd_fortress',
        id: 'gd_aegis', name: '【技】絶対防壁', cost: 4, maxLevel: 1,
        effects: [{ kind: 'grant_skill', skill: 'sk_cls_aegis', value: 1 }],
        desc: 'クラス技「絶対防壁」を習得。1ターンのあいだ、味方全体が何を受けてもダメージ0（3R目以降・CT5）',
      },
      {
        // ── 極点 (§12) ──
        // 上限を伸ばすとクラスポイントが余る。Lv240 で48点あるのに、
        // 全部取っても28〜39点しか要らなかった。行き先を作る。
        //
        // どれも **代償のある強い効果** にしてある。ポイントが余るからと
        // 素直な上積みを置くと、ただの数値インフレになるため。
        branch: 'br_gd_fortress',
        id: 'gd_bastion', name: '【極】不動の城塞', cost: 6, maxLevel: 1,
        effects: [
          { kind: 'damage_share', value: 0.35 },
          { kind: 'stat_pct', stat: 'def', value: 0.6 },
          { kind: 'stat_pct', stat: 'atk', value: -0.5 },
        ],
        desc: '味方の被害を追加で35%肩代わりし DEF +60%。ただし ATK -50%',
      },
      /* ── ここから先は、上限を伸ばしてから触る帯 (§12) ──
         Lv255 で配られるのは51点。全部で73点かかるので、
         **7割しか取れない**。何を諦めるかを選ぶ場所にしてある。 */
      {
        id: 'gd_thorns', name: '棘の鎧', cost: 2, maxLevel: 3,
        effects: [{ kind: 'thorns', value: 0.02 }],
        desc: '被弾するたび、相手の最大HPの2%を削り返す',
      },
      {
        id: 'gd_brink', name: '死線の踏ん張り', cost: 2, maxLevel: 3,
        effects: [{ kind: 'low_hp_guard', value: 0.10 }],
        desc: 'HPが減っているほど硬くなる（瀕死で被ダメージ -10%）',
      },
      {
        id: 'gd_ready', name: '開戦の備え', cost: 2, maxLevel: 3,
        effects: [{ kind: 'start_shield', value: 0.08 }],
        desc: '戦闘開始時、最大HPの8%ぶんの障壁を張った状態で始まる',
      },
      {
        // 鉄血の構え（DEF→火力）とは別の変換路。両方は取り切れないので、
        // 「硬さで殴る」か「重さで殴る」かを選ぶことになる。
        id: 'gd_bulk', name: '巨躯の膂力', cost: 3, maxLevel: 3,
        effects: [{ kind: 'hp_to_atk', value: 0.04 }],
        desc: '最大HPの4%をATKと魔力に上乗せ',
      },
      {
        branch: 'br_gd_undying',
        id: 'gd_oath', name: '【技】大盾の宣誓', cost: 5, maxLevel: 1,
        effects: [{ kind: 'grant_skill', skill: 'sk_cls_bulwark', value: 1 }],
        desc: 'クラス技「大盾の宣誓」を習得。味方全員にDEF依存の障壁を張る（2R目以降・CT4）',
      },
      {
        branch: 'br_gd_undying',
        id: 'gd_undying', name: '【極】不倒', cost: 7, maxLevel: 1,
        effects: [
          { kind: 'last_stand', value: 0.6 },
          { kind: 'revive', value: 0.5 },
          { kind: 'reduction', value: 0.15 },
          // 代償は必ず「そのクラスが痛い所」に置く。
          // 魔力だけを削っても守護者はほとんど困らないので、
          // 鉄血の構え（DEF→ATKと魔力）で作った火力ごと落とす。
          { kind: 'stat_pct', stat: 'atk', value: -0.45 },
          { kind: 'stat_pct', stat: 'magi_power', value: -0.45 },
        ],
        desc: '致死を60%で耐え、倒れてもHP50%で1度だけ復帰、被ダメージ -15%。' +
          'ただし ATK と魔力 -45%',
      },
      /* ── 派生: 城塞 ── 動かない壁になる。攻めを捨て、抜かせないことに全部を使う。 */
      {
        branch: 'br_gd_fortress',
        id: 'gd_f_thick', name: '城壁の厚み', cost: 2, maxLevel: 3,
        effects: [{ kind: 'reduction', value: 0.04 }],
        desc: '被ダメージ軽減 +4%',
      },
      {
        branch: 'br_gd_fortress',
        id: 'gd_f_layer', name: '重ね盾', cost: 2, maxLevel: 3,
        effects: [{ kind: 'shield_regen', value: 0.04 }],
        desc: 'ラウンド終了時に最大HPの4%ぶんの障壁を張り直す',
      },
      {
        branch: 'br_gd_fortress',
        id: 'gd_f_boss', name: '大敵への備え', cost: 2, maxLevel: 3,
        effects: [{ kind: 'boss_guard', value: 0.10 }],
        desc: 'ボスから受けるダメージ -10%',
      },
      {
        branch: 'br_gd_fortress',
        id: 'gd_f_rear', name: '後詰めの采配', cost: 2, maxLevel: 3,
        effects: [{ kind: 'back_guard', value: 0.06 }],
        desc: '隊列の後ろにいるほど硬くなる（1人につき被ダメージ -6%）',
      },
      /* ── 派生: 不倒 ── 倒れないことに賭ける。一度きりの粘りを何重にも重ねる。 */
      {
        branch: 'br_gd_undying',
        id: 'gd_u_low', name: '窮地の膂力', cost: 2, maxLevel: 4,
        effects: [{ kind: 'low_hp_power', value: 0.12 }],
        desc: 'HPが減っているほど火力が上がる（瀕死で +12%）',
      },
      {
        branch: 'br_gd_undying',
        id: 'gd_u_regen', name: '不屈の再生', cost: 2, maxLevel: 3,
        effects: [{ kind: 'regen', value: 0.03 }],
        desc: 'ラウンド終了時に最大HPの3%を回復',
      },
      {
        branch: 'br_gd_undying',
        id: 'gd_u_wave', name: '幕間の立ち直り', cost: 4, maxLevel: 1,
        effects: [{ kind: 'wave_revive', value: 0.5 }],
        desc: 'ウェーブが変わるとき、倒れていてもHP50%で立ち上がる',
      },
      {
        branch: 'br_gd_undying',
        id: 'gd_u_stand', name: '死中に活', cost: 4, maxLevel: 1,
        effects: [{ kind: 'last_stand', value: 0.4 }],
        desc: '致死ダメージを40%の確率でHP1で耐える（1戦闘に1回）',
      },
      /* ── 派生: 修羅 ── 受けた痛みをそのまま返す。殴られるほど手数が増える。 */
      {
        branch: 'br_gd_asura',
        id: 'gd_a_stance', name: '【技】報復の構え', cost: 5, maxLevel: 1,
        effects: [{ kind: 'grant_skill', skill: 'sk_cls_retribution', value: 1 }],
        desc: 'クラス技「報復の構え」を習得。3ラウンド被ダメージ半減、殴られるたび必ず反撃（2R目以降・CT4）',
      },
      {
        branch: 'br_gd_asura',
        id: 'gd_a_counter', name: '反撃の型', cost: 2, maxLevel: 3,
        effects: [{ kind: 'counter', value: 0.12, power: 0.8 }],
        desc: '被弾時 12%の確率で威力80%の反撃',
      },
      {
        branch: 'br_gd_asura',
        id: 'gd_a_power', name: '返報', cost: 2, maxLevel: 3,
        effects: [{ kind: 'counter_power', value: 0.20 }],
        desc: '反撃の威力 +20%',
      },
      {
        branch: 'br_gd_asura',
        id: 'gd_a_all', name: '総反撃', cost: 3, maxLevel: 2,
        effects: [{ kind: 'counter_all', value: 0.25 }],
        desc: '反撃が25%の確率で敵全体に及ぶ',
      },
      {
        branch: 'br_gd_asura',
        id: 'gd_a_thorn', name: '鉄条の肌', cost: 2, maxLevel: 2,
        effects: [{ kind: 'thorns', value: 0.02 }],
        desc: '被弾するたび、相手の最大HPの2%を削り返す',
      },
      {
        branch: 'br_gd_asura',
        id: 'gd_a_wrath', name: '【極】血の裁定', cost: 7, maxLevel: 1,
        effects: [{ kind: 'reflect', value: 0.45 },
          { kind: 'counter', value: 0.5, power: 1.2 },
          { kind: 'stat_pct', stat: 'def', value: -0.4 }],
        desc: '受けたダメージの45%を返し、50%の確率で威力120%の反撃。ただし DEF -40%',
      },
    ],
  },

  cls_mender: {
    name: '癒し手', color: '#8ce8b4', icon: 'st-regen',
    flavor: '倒れた者を数に戻せるなら、それは最大の火力だ。',
    desc: '立て直しの役。倒れた仲間を戻せるので、' +
      '「全滅寸前から巻き返す」という勝ち筋そのものを作れる。',
    innate: [
      { kind: 'heal_power', value: 0.25 },
      { kind: 'stat_pct', stat: 'magi_power', value: 0.10 },
    ],
    innateDesc: '自分が行う回復量 +25% / 魔力 +10%',
    /* ── 派生 (§12) ──
       3つのうち1つしか選べない。片方に振ると他の2つは封じられる。
       乗り換えるには振り戻すか転職する。 */
    branches: {
      br_md_rebirth: { name: '復活', desc: '倒れてからが本番。全滅寸前を勝ち筋に変える。' },
      br_md_devotion: { name: '献身', desc: '味方の痛みを引き受ける。前に出る癒し手。' },
      br_md_crusade: { name: '聖戦', desc: '癒しを攻めに変える。回復量そのものが火力になる道。' },
    },
    nodes: [
      {
        id: 'md_heal', name: '慈愛', cost: 1, maxLevel: 3,
        effects: [{ kind: 'heal_power', value: 0.15 }],
        desc: '自分が行う回復量 +15%',
      },
      {
        id: 'md_overheal', name: '溢れる恵み', cost: 1, maxLevel: 3,
        effects: [{ kind: 'overheal_shield', value: 0.25 }],
        desc: '回復の超過分の25%が障壁に変わる（満タンの相手に撃っても無駄にならない）',
      },
      {
        id: 'md_regen', name: '生命の巡り', cost: 2, maxLevel: 3,
        effects: [{ kind: 'regen', value: 0.03 }],
        desc: 'ラウンド終了時に最大HPの3%を回復',
      },
      {
        id: 'md_wave', name: '不撓の祈り', cost: 2, maxLevel: 2,
        effects: [{ kind: 'wave_revive', value: 0.35 }],
        desc: 'ウェーブが変わるとき、倒れていてもHP35%で立ち上がる',
      },
      {
        id: 'md_ward', name: '加護', cost: 2, maxLevel: 3,
        effects: [{ kind: 'status_immune', value: 0.12 }],
        desc: '弱体を12%の確率で丸ごとはねのける',
      },
      {
        id: 'md_share', name: '分かち合い', cost: 2, maxLevel: 2,
        effects: [{ kind: 'damage_share', value: 0.10 }],
        desc: '自分が受けたダメージの10%を味方全員で分ける',
      },
      {
        branch: 'br_md_rebirth',
        id: 'md_rebirth', name: '【技】再臨の光', cost: 4, maxLevel: 1,
        effects: [{ kind: 'grant_skill', skill: 'sk_cls_rebirth', value: 1 }],
        desc: 'クラス技「再臨の光」を習得。倒れた味方を全快で起こし、その場でもう一度動かす（4R目以降・CT6）',
      },
      {
        // ── 極点 (§12) ──
        branch: 'br_md_rebirth',
        id: 'md_eternal', name: '【極】絶えぬ灯', cost: 6, maxLevel: 1,
        effects: [
          { kind: 'regen', value: 0.08 },
          { kind: 'heal_power', value: 0.5 },
          { kind: 'stat_pct', stat: 'atk', value: -0.4 },
        ],
        desc: '毎ラウンド最大HPの8%回復、回復量 +50%。ただし ATK -40%',
      },
      /* ── 上限を伸ばしてから触る帯 (§12)。全部で73点かかる ── */
      {
        id: 'md_crit_heal', name: '慈悲の冴え', cost: 2, maxLevel: 3,
        effects: [{ kind: 'crit_heal', value: 0.12 }],
        desc: '回復が12%の確率で会心し、量が跳ね上がる',
      },
      {
        id: 'md_wave_heal', name: '幕間の癒し', cost: 2, maxLevel: 3,
        effects: [{ kind: 'wave_heal', value: 0.12 }],
        desc: 'ウェーブが変わるとき、味方全員が最大HPの12%回復する',
      },
      {
        id: 'md_reap', name: '弔いの恵み', cost: 2, maxLevel: 3,
        effects: [{ kind: 'heal_on_kill', value: 0.05 }],
        desc: '敵を倒すたび、味方全員が最大HPの5%回復する',
      },
      {
        id: 'md_clarity', name: '澄んだ心', cost: 2, maxLevel: 3,
        effects: [{ kind: 'debuff_resist', value: 0.15 }],
        desc: '自分が受ける弱体の持続を15%短くする',
      },
      {
        branch: 'br_md_devotion',
        id: 'md_downpour', name: '【技】星霜の慈雨', cost: 5, maxLevel: 1,
        effects: [{ kind: 'grant_skill', skill: 'sk_cls_downpour', value: 1 }],
        desc: 'クラス技「星霜の慈雨」を習得。味方全員を大きく回復する（2R目以降・CT3）',
      },
      {
        // 絶えぬ灯が「自分が立ち続ける」道なら、こちらは「代わりに背負う」道。
        // どちらも取ると火力が消えるので、片方を選ぶことになる。
        branch: 'br_md_devotion',
        id: 'md_martyr', name: '【極】身代わりの誓い', cost: 8, maxLevel: 1,
        effects: [
          { kind: 'guard_ally', value: 0.4 },
          { kind: 'overheal_shield', value: 0.6 },
          { kind: 'stat_pct', stat: 'hp', value: 0.5 },
          { kind: 'stat_pct', stat: 'def', value: -0.5 },
        ],
        desc: '味方の被害を40%肩代わり、超過回復の60%が障壁に、最大HP +50%。ただし DEF -50%',
      },
      /* ── 派生: 復活 ── 倒れてからが本番。全滅寸前を勝ち筋に変える。 */
      {
        branch: 'br_md_rebirth',
        id: 'md_r_wave', name: '蘇りの祈り', cost: 4, maxLevel: 1,
        effects: [{ kind: 'wave_revive', value: 0.6 }],
        desc: 'ウェーブが変わるとき、倒れていてもHP60%で立ち上がる',
      },
      {
        branch: 'br_md_rebirth',
        id: 'md_r_self', name: '己が身の灯', cost: 5, maxLevel: 1,
        effects: [{ kind: 'revive', value: 0.5 }],
        desc: '自分が倒れても、HP50%で1度だけ起き上がる',
      },
      {
        branch: 'br_md_rebirth',
        id: 'md_r_stand', name: '命綱', cost: 4, maxLevel: 1,
        effects: [{ kind: 'last_stand', value: 0.35 }],
        desc: '致死ダメージを35%の確率でHP1で耐える（1戦闘に1回）',
      },
      {
        branch: 'br_md_rebirth',
        id: 'md_r_heal', name: '大いなる慈愛', cost: 2, maxLevel: 3,
        effects: [{ kind: 'heal_power', value: 0.15 }],
        desc: '自分が行う回復量 +15%',
      },
      {
        branch: 'br_md_rebirth',
        id: 'md_r_regen', name: '絶えぬ脈', cost: 2, maxLevel: 3,
        effects: [{ kind: 'regen', value: 0.03 }],
        desc: 'ラウンド終了時に最大HPの3%を回復',
      },
      /* ── 派生: 献身 ── 味方の痛みを引き受ける。前に出る癒し手。 */
      {
        branch: 'br_md_devotion',
        id: 'md_d_guard', name: '庇う手', cost: 2, maxLevel: 3,
        effects: [{ kind: 'guard_ally', value: 0.10 }],
        desc: '味方が受けるダメージの10%を肩代わりする',
      },
      {
        branch: 'br_md_devotion',
        id: 'md_d_shield', name: '包む障壁', cost: 2, maxLevel: 3,
        effects: [{ kind: 'overheal_shield', value: 0.20 }],
        desc: '回復の超過分の20%が障壁に変わる',
      },
      {
        branch: 'br_md_devotion',
        id: 'md_d_hp', name: '受け皿', cost: 2, maxLevel: 3,
        effects: [{ kind: 'stat_pct', stat: 'hp', value: 0.12 }],
        desc: '最大HP +12%',
      },
      {
        branch: 'br_md_devotion',
        id: 'md_d_guardpct', name: '受け流しの心得', cost: 2, maxLevel: 2,
        effects: [{ kind: 'reduction', value: 0.05 }],
        desc: '被ダメージ軽減 +5%',
      },
      /* ── 派生: 聖戦 ── 癒しを攻めに変える。回復量そのものが火力になる道。 */
      {
        branch: 'br_md_crusade',
        id: 'md_c_skill', name: '【技】裁きの祈り', cost: 5, maxLevel: 1,
        effects: [{ kind: 'grant_skill', skill: 'sk_cls_crusade', value: 1 }],
        desc: 'クラス技「裁きの祈り」を習得。与えたダメージと同じだけ自分が回復する（2R目以降・CT3）',
      },
      {
        branch: 'br_md_crusade',
        id: 'md_c_steal', name: '奪う祈り', cost: 2, maxLevel: 3,
        effects: [{ kind: 'lifesteal', value: 0.08 }],
        desc: '与えたダメージの8%をHPに還元する',
      },
      {
        branch: 'br_md_crusade',
        id: 'md_c_kill', name: '弔いの糧', cost: 2, maxLevel: 3,
        effects: [{ kind: 'heal_on_kill', value: 0.05 }],
        desc: '敵を倒すたび、味方全員が最大HPの5%回復する',
      },
      {
        branch: 'br_md_crusade',
        id: 'md_c_crit', name: '聖なる冴え', cost: 2, maxLevel: 3,
        effects: [{ kind: 'crit_heal', value: 0.12 }],
        desc: '回復が12%の確率で会心し、量が跳ね上がる',
      },
      {
        branch: 'br_md_crusade',
        id: 'md_c_light', name: '裁きの威', cost: 2, maxLevel: 3,
        effects: [{ kind: 'element_power', element: 'light', value: 0.12 }],
        desc: '光属性の火力 +12%',
      },
      {
        branch: 'br_md_crusade',
        id: 'md_c_zeal', name: '【極】聖戦の誓い', cost: 7, maxLevel: 1,
        effects: [{ kind: 'lifesteal', value: 0.35 },
          { kind: 'stat_pct', stat: 'magi_power', value: 0.6 },
          { kind: 'heal_power', value: -0.5 }],
        desc: '与ダメージの35%を吸収、魔力 +60%。ただし自分が行う回復量 -50%',
      },
    ],
  },

  cls_breaker: {
    name: '破壊者', color: '#ff8a5c', icon: 'stat-atk',
    flavor: '硬い？　ならば硬さごと壊せばいい。',
    desc: '一撃の重さに全部を寄せる役。手数も生存も捨てるかわりに、' +
      '硬い相手を正面から割り切る。',
    innate: [
      { kind: 'stat_pct', stat: 'atk', value: 0.18 },
      { kind: 'high_power_boost', value: 0.15 },
    ],
    innateDesc: 'ATK +18% / 威力200%以上の技の火力 +15%',
    /* ── 派生 (§12) ──
       3つのうち1つしか選べない。片方に振ると他の2つは封じられる。
       乗り換えるには振り戻すか転職する。 */
    branches: {
      br_bk_apex: { name: '極撃', desc: '単体を貫く。上限の壁を殴り抜くことに全部を寄せる。' },
      br_bk_swarm: { name: '殲滅', desc: '数を薙ぐ。1体ずつ落とすより、まとめて崩すほうが速い。' },
      br_bk_frenzy: { name: '狂奔', desc: '自らを削って撃つ。減ったHPがそのまま威力になる。' },
    },
    nodes: [
      {
        id: 'bk_high', name: '覇の心得', cost: 1, maxLevel: 3,
        effects: [{ kind: 'high_power_boost', value: 0.12 }],
        desc: '威力200%以上の技の火力 +12%',
      },
      {
        // ツリーの「限界超越」と合わせて +192% に届く量を持たせる。
        // そこが、威力620%の大技が上限に潰されなくなる地点 (§3.2 ステップ8)。
        // クラスポイントは Lv150 で30点なので、8点はその過半。
        // 「大技で殴る」を選ぶと他を諦めることになる、という重さにしてある。
        id: 'bk_cap', name: '限界の先へ', cost: 2, maxLevel: 8,
        effects: [{ kind: 'cap_break', value: 0.12 }],
        desc: 'ダメージ上限突破 +12%',
      },
      {
        id: 'bk_break', name: '防御砕き', cost: 2, maxLevel: 3,
        effects: [{ kind: 'guard_break', value: 0.12 }],
        desc: '攻撃時 12%の確率で防御を無視する',
      },
      {
        id: 'bk_carry', name: '奔流', cost: 2, maxLevel: 2,
        effects: [{ kind: 'overkill_carry', value: 0.30 }],
        desc: '敵を倒したときの超過ダメージの30%を次の一撃へ持ち越す',
      },
      {
        id: 'bk_exec', name: '止めの一撃', cost: 2, maxLevel: 3,
        effects: [{ kind: 'execute', value: 0.20 }],
        desc: '相手のHPが減っているほど威力上昇（瀕死で +20%）',
      },
      {
        branch: 'br_bk_apex',
        id: 'bk_ruin', name: '【技】終焉の一撃', cost: 4, maxLevel: 1,
        effects: [{ kind: 'grant_skill', skill: 'sk_cls_ruin', value: 1 }],
        desc: 'クラス技「終焉の一撃」を習得。確定会心。ダメージ上限の減衰を受けない唯一の技（3R目以降・CT4）',
      },
      {
        // ── 極点 (§12) ──
        branch: 'br_bk_apex',
        id: 'bk_apex', name: '【極】一撃必倒', cost: 6, maxLevel: 1,
        effects: [
          { kind: 'high_power_boost', value: 0.8 },
          { kind: 'cap_break', value: 0.6 },
          { kind: 'stat_pct', stat: 'hp', value: -0.5 },
        ],
        desc: '大技の火力 +80%、上限突破 +60%。ただし最大HP -50%',
      },
      /* ── 上限を伸ばしてから触る帯 (§12)。全部で73点かかる ── */
      {
        id: 'bk_stable', name: '揺るがぬ刃', cost: 2, maxLevel: 3,
        effects: [{ kind: 'stable_damage', value: 0.15 }],
        desc: 'ダメージの振れ幅が15%小さくなる（大技の下振れを潰す）',
      },
      {
        id: 'bk_boss', name: '巨敵狩り', cost: 2, maxLevel: 3,
        effects: [{ kind: 'boss_slayer', value: 0.10 }],
        desc: 'ボスへの火力 +10%',
      },
      {
        id: 'bk_first', name: '先手必倒', cost: 2, maxLevel: 2,
        effects: [{ kind: 'first_round_power', value: 0.15 }],
        desc: '1ラウンド目の火力 +15%',
      },
      {
        branch: 'br_bk_swarm',
        id: 'bk_quake', name: '【技】天壌崩し', cost: 5, maxLevel: 1,
        effects: [{ kind: 'grant_skill', skill: 'sk_cls_cataclysm', value: 1 }],
        desc: 'クラス技「天壌崩し」を習得。敵全体に威力340%（3R目以降・CT4）',
      },
      {
        // 一撃必倒が単体へ寄せる道なら、こちらは数へ寄せる道。
        branch: 'br_bk_swarm',
        id: 'bk_swarm', name: '【極】皆殺しの理', cost: 7, maxLevel: 1,
        effects: [
          { kind: 'foe_count_power', value: 0.18 },
          { kind: 'overkill_carry', value: 0.5 },
          { kind: 'stat_pct', stat: 'def', value: -0.5 },
        ],
        desc: '敵1体につき火力 +18%、倒したときの超過ダメージを50%持ち越す。ただし DEF -50%',
      },
      /* ── 派生: 極撃 ── 単体を貫く。上限の壁を殴り抜くことに全部を寄せる。 */
      {
        branch: 'br_bk_apex',
        id: 'bk_x_cap', name: '限界の彼方', cost: 2, maxLevel: 5,
        effects: [{ kind: 'cap_break', value: 0.10 }],
        desc: 'ダメージ上限突破 +10%',
      },
      {
        branch: 'br_bk_apex',
        id: 'bk_x_high', name: '極めの一撃', cost: 2, maxLevel: 3,
        effects: [{ kind: 'high_power_boost', value: 0.12 }],
        desc: '威力200%以上の技の火力 +12%',
      },
      {
        branch: 'br_bk_apex',
        id: 'bk_x_lone', name: '一騎討ち', cost: 2, maxLevel: 3,
        effects: [{ kind: 'lone_foe_power', value: 0.12 }],
        desc: '敵が1体だけのときの火力 +12%',
      },
      {
        branch: 'br_bk_apex',
        id: 'bk_x_stable', name: '狂いなき刃', cost: 2, maxLevel: 1,
        effects: [{ kind: 'stable_damage', value: 0.15 }],
        desc: 'ダメージの振れ幅が15%小さくなる',
      },
      /* ── 派生: 殲滅 ── 数を薙ぐ。1体ずつ落とすより、まとめて崩すほうが速い。 */
      {
        branch: 'br_bk_swarm',
        id: 'bk_s_count', name: '群れを喰らう', cost: 2, maxLevel: 3,
        effects: [{ kind: 'foe_count_power', value: 0.06 }],
        desc: '生きている敵1体につき火力 +6%',
      },
      {
        branch: 'br_bk_swarm',
        id: 'bk_s_carry', name: '奔流を継ぐ', cost: 2, maxLevel: 3,
        effects: [{ kind: 'overkill_carry', value: 0.20 }],
        desc: '敵を倒したときの超過ダメージの20%を次の一撃へ持ち越す',
      },
      {
        branch: 'br_bk_swarm',
        id: 'bk_s_kill', name: '止まらぬ進撃', cost: 2, maxLevel: 3,
        effects: [{ kind: 'kill_extra_action', value: 0.10 }],
        desc: '敵を倒したとき 10%の確率でもう一度動ける',
      },
      {
        branch: 'br_bk_swarm',
        id: 'bk_s_chain', name: '薙ぎ払い', cost: 2, maxLevel: 2,
        effects: [{ kind: 'chain', value: 0.12 }],
        desc: '攻撃が12%の確率で別の敵へ連鎖する',
      },
      {
        branch: 'br_bk_swarm',
        id: 'bk_s_wave', name: '連戦の熱', cost: 2, maxLevel: 1,
        effects: [{ kind: 'wave_stack', value: 0.10 }],
        desc: 'ウェーブを越えるごとに火力 +10%',
      },
      /* ── 派生: 狂奔 ── 自らを削って撃つ。減ったHPがそのまま威力になる。 */
      {
        branch: 'br_bk_frenzy',
        id: 'bk_z_skill', name: '【技】血狂い', cost: 5, maxLevel: 1,
        effects: [{ kind: 'grant_skill', skill: 'sk_cls_frenzy', value: 1 }],
        desc: 'クラス技「血狂い」を習得。現在HPの半分を支払い、支払った量ぶん威力が跳ね上がる（2R目以降・CT3）',
      },
      {
        branch: 'br_bk_frenzy',
        id: 'bk_z_low', name: '背水', cost: 2, maxLevel: 4,
        effects: [{ kind: 'low_hp_power', value: 0.12 }],
        desc: 'HPが減っているほど火力が上がる（瀕死で +12%）',
      },
      {
        branch: 'br_bk_frenzy',
        id: 'bk_z_curse', name: '痛みを糧に', cost: 3, maxLevel: 2,
        effects: [{ kind: 'self_curse_power', value: 0.12 }],
        desc: '自分にかかっている弱体1つにつき火力 +12%',
      },
      {
        branch: 'br_bk_frenzy',
        id: 'bk_z_steal', name: '喰らう刃', cost: 2, maxLevel: 3,
        effects: [{ kind: 'lifesteal', value: 0.08 }],
        desc: '与えたダメージの8%をHPに還元する',
      },
      {
        branch: 'br_bk_frenzy',
        id: 'bk_z_rage', name: '【極】狂血', cost: 7, maxLevel: 1,
        effects: [{ kind: 'low_hp_power', value: 0.9 },
          { kind: 'lifesteal', value: 0.25 },
          { kind: 'reduction', value: -0.3 }],
        desc: 'HPが減っているほど火力が伸びる（瀕死で +90%）、与ダメージの25%を吸収。ただし被ダメージ +30%',
      },
    ],
  },

  cls_hexer: {
    name: '呪術師', color: '#c58cff', icon: 'st-poison',
    flavor: '削るのではない。壊れるように仕向けるのだ。',
    desc: '状態異常で盤面を作る役。自分の火力は控えめだが、' +
      '撒いた異常が味方全員の火力に化ける。',
    innate: [
      { kind: 'status_power', value: 0.30 },
      { kind: 'debuff_duration', value: 1 },
    ],
    innateDesc: '与える継続ダメージ +30% / 与える弱体の持続 +1ターン',
    /* ── 派生 (§12) ──
       3つのうち1つしか選べない。片方に振ると他の2つは封じられる。
       乗り換えるには振り戻すか転職する。 */
    branches: {
      br_hx_plague: { name: '疫病', desc: '撒いて腐らせる。盤面全部に病を行き渡らせる道。' },
      br_hx_ruin: { name: '自壊', desc: '我が身を贄にする。呪いを浴びるほど強くなる。' },
      br_hx_sigil: { name: '呪印', desc: '時間ではなく回数で削る。殴った数がそのまま呪いになる。' },
    },
    nodes: [
      {
        id: 'hx_spread', name: '疫の伝播', cost: 1, maxLevel: 3,
        effects: [{ kind: 'debuff_spread', value: 0.18 }],
        desc: '与えた弱体が18%の確率で他の敵にも広がる',
      },
      {
        id: 'hx_vs', name: '弱者狩り', cost: 1, maxLevel: 3,
        effects: [{ kind: 'vs_status_power', status: 'all', value: 0.07 }],
        desc: '弱体にかかった敵への火力 +7%（種類ごとに重なる）',
      },
      {
        id: 'hx_hit', name: '触れれば病む', cost: 2, maxLevel: 3,
        effects: [{ kind: 'status_on_hit_kind', status: 'all', value: 0.05 }],
        desc: '攻撃時 5%の確率で全種類の弱体をそれぞれ付与',
      },
      {
        id: 'hx_freeze', name: '凍てつく呪い', cost: 2, maxLevel: 2,
        effects: [{ kind: 'status_on_hit_kind', status: 'freeze', value: 0.15 }],
        desc: '攻撃時 15%の確率で凍結を付与（味方全員の火力が上がる）',
      },
      {
        id: 'hx_power', name: '深化する毒', cost: 2, maxLevel: 3,
        effects: [{ kind: 'status_power', value: 0.20 }],
        desc: '自分が与える継続ダメージの割合 +20%',
      },
      {
        id: 'hx_len', name: '長き呪い', cost: 2, maxLevel: 2,
        effects: [{ kind: 'debuff_duration', value: 1 }],
        desc: '自分が与える弱体の持続 +1ターン',
      },
      {
        branch: 'br_hx_plague',
        id: 'hx_crucible', name: '【技】疫病の坩堝', cost: 4, maxLevel: 1,
        effects: [{ kind: 'grant_skill', skill: 'sk_cls_crucible', value: 1 }],
        desc: 'クラス技「疫病の坩堝」を習得。撒いた6種の弱体が時間で消えない（2R目以降・CT4）',
      },
      {
        // ── 極点 (§12) ──
        branch: 'br_hx_plague',
        id: 'hx_plague', name: '【極】万疫の主', cost: 6, maxLevel: 1,
        effects: [
          { kind: 'status_power', value: 1.2 },
          { kind: 'vs_status_power', status: 'all', value: 0.25 },
          { kind: 'stat_pct', stat: 'atk', value: -0.35 },
        ],
        desc: '継続ダメージ +120%、弱体中の敵への火力 +25%。ただし ATK -35%',
      },
      /* ── 上限を伸ばしてから触る帯 (§12)。全部で74点かかる ── */
      {
        id: 'hx_amp', name: '病巣を抉る', cost: 2, maxLevel: 3,
        effects: [{ kind: 'debuff_amp', value: 0.10 }],
        desc: '弱体がかかっている相手への火力 +10%',
      },
      {
        // 刻印は「殴った回数」で進む (§9.1)。時間で進む毒とは別の時計なので、
        // 撒いて待つ構成に、殴って進む軸が1本増える。
        id: 'hx_sigil', name: '呪印を刻む', cost: 2, maxLevel: 4,
        effects: [{ kind: 'sigil_burst', value: 0.02 }],
        desc: '攻撃するたび刻印が1つ積み、3つで弾けて相手の最大HPの2%が入る',
      },
      {
        // 自分にかかった弱体を糧にする (§9.1)。
        // 呪術師は弱体を撒く側だが、被る側に回ると火力に変わる。
        id: 'hx_selfcurse', name: '我が身も贄に', cost: 3, maxLevel: 2,
        effects: [{ kind: 'self_curse_power', value: 0.12 }],
        desc: '自分にかかっている弱体1つにつき火力 +12%',
      },
      {
        id: 'hx_chain', name: '伝う呪い', cost: 2, maxLevel: 3,
        effects: [{ kind: 'chain', value: 0.12 }],
        desc: '攻撃が12%の確率で別の敵へ連鎖する',
      },
      {
        branch: 'br_hx_ruin',
        id: 'hx_feast', name: '【技】腐爛の宴', cost: 5, maxLevel: 1,
        effects: [{ kind: 'grant_skill', skill: 'sk_cls_blight', value: 1 }],
        desc: 'クラス技「腐爛の宴」を習得。敵全体の毒と火傷をまとめて叩き出す（2R目以降・CT3）',
      },
      {
        // 万疫の主が「撒いたものを重くする」道なら、こちらは「自分ごと沈める」道。
        branch: 'br_hx_ruin',
        id: 'hx_martyr', name: '【極】自壊の術式', cost: 7, maxLevel: 1,
        effects: [
          { kind: 'self_curse_power', value: 0.3 },
          { kind: 'debuff_amp', value: 0.4 },
          { kind: 'stat_pct', stat: 'hp', value: -0.45 },
        ],
        desc: '自分の弱体1つにつき火力 +30%、弱体中の敵への火力 +40%。ただし最大HP -45%',
      },
      /* ── 派生: 疫病 ── 撒いて腐らせる。盤面全部に病を行き渡らせる道。 */
      {
        branch: 'br_hx_plague',
        id: 'hx_p_spread', name: '広がる病', cost: 2, maxLevel: 3,
        effects: [{ kind: 'debuff_spread', value: 0.15 }],
        desc: '与えた弱体が15%の確率で他の敵にも広がる',
      },
      {
        branch: 'br_hx_plague',
        id: 'hx_p_power', name: '煮詰まる毒', cost: 2, maxLevel: 3,
        effects: [{ kind: 'status_power', value: 0.20 }],
        desc: '自分が与える継続ダメージの割合 +20%',
      },
      {
        branch: 'br_hx_plague',
        id: 'hx_p_len', name: '消えぬ呪い', cost: 2, maxLevel: 2,
        effects: [{ kind: 'debuff_duration', value: 1 }],
        desc: '自分が与える弱体の持続 +1ターン',
      },
      {
        branch: 'br_hx_plague',
        id: 'hx_p_hit', name: '触れれば病む', cost: 2, maxLevel: 3,
        effects: [{ kind: 'status_on_hit_kind', status: 'all', value: 0.04 }],
        desc: '攻撃時 4%の確率で全種類の弱体をそれぞれ付与',
      },
      {
        branch: 'br_hx_plague',
        id: 'hx_p_all', name: '遍く波紋', cost: 3, maxLevel: 1,
        effects: [{ kind: 'all_spread', value: 1 }],
        desc: '攻撃技が威力を問わず敵全体へ広がる',
      },
      /* ── 派生: 自壊 ── 我が身を贄にする。呪いを浴びるほど強くなる。 */
      {
        branch: 'br_hx_ruin',
        id: 'hx_r_curse', name: '贄の理', cost: 3, maxLevel: 3,
        effects: [{ kind: 'self_curse_power', value: 0.12 }],
        desc: '自分にかかっている弱体1つにつき火力 +12%',
      },
      {
        branch: 'br_hx_ruin',
        id: 'hx_r_low', name: '爛れた矜持', cost: 2, maxLevel: 3,
        effects: [{ kind: 'low_hp_power', value: 0.10 }],
        desc: 'HPが減っているほど火力が上がる（瀕死で +10%）',
      },
      {
        branch: 'br_hx_ruin',
        id: 'hx_r_steal', name: '啜る呪い', cost: 2, maxLevel: 2,
        effects: [{ kind: 'lifesteal', value: 0.08 }],
        desc: '与えたダメージの8%をHPに還元する',
      },
      {
        branch: 'br_hx_ruin',
        id: 'hx_r_amp', name: '傷を抉る', cost: 2, maxLevel: 2,
        effects: [{ kind: 'debuff_amp', value: 0.10 }],
        desc: '弱体がかかっている相手への火力 +10%',
      },
      /* ── 派生: 呪印 ── 時間ではなく回数で削る。殴った数がそのまま呪いになる。 */
      {
        branch: 'br_hx_sigil',
        id: 'hx_g_skill', name: '【技】呪印乱舞', cost: 5, maxLevel: 1,
        effects: [{ kind: 'grant_skill', skill: 'sk_cls_sigilstorm', value: 1 }],
        desc: 'クラス技「呪印乱舞」を習得。刻印を3つまとめて刻み、その場で必ず1回弾ける（2R目以降・CT2）',
      },
      {
        branch: 'br_hx_sigil',
        id: 'hx_g_sigil', name: '深く刻む', cost: 2, maxLevel: 4,
        effects: [{ kind: 'sigil_burst', value: 0.025 }],
        desc: '攻撃するたび刻印が1つ積み、3つで弾けて相手の最大HPの2.5%が入る',
      },
      {
        branch: 'br_hx_sigil',
        id: 'hx_g_chain', name: '伝う呪印', cost: 2, maxLevel: 3,
        effects: [{ kind: 'chain', value: 0.12 }],
        desc: '攻撃が12%の確率で別の敵へ連鎖する',
      },
      {
        branch: 'br_hx_sigil',
        id: 'hx_g_cpower', name: '連鎖の重み', cost: 2, maxLevel: 2,
        effects: [{ kind: 'chain_power', value: 0.20 }],
        desc: '連鎖したときの威力 +20%',
      },
      {
        branch: 'br_hx_sigil',
        id: 'hx_g_double', name: '二の太刀', cost: 3, maxLevel: 1,
        effects: [{ kind: 'double_hits', value: 0.12 }],
        desc: '12%の確率で同じ技がもう一度出る',
      },
      {
        branch: 'br_hx_sigil',
        id: 'hx_g_mark', name: '【極】万象呪印', cost: 7, maxLevel: 1,
        effects: [{ kind: 'sigil_burst', value: 0.06 },
          { kind: 'double_hits', value: 0.3 },
          { kind: 'stat_pct', stat: 'magi_power', value: -0.35 }],
        desc: '刻印の炸裂が相手の最大HPの6%に、30%で技がもう一度出る。ただし魔力 -35%',
      },
    ],
  },

  cls_tactician: {
    name: '戦術家', color: '#ffd76a', icon: 'st-buff',
    flavor: '一手の差が、すべての差になる。',
    desc: '手番を操る役。自分は殴らないが、味方の行動回数を増やして' +
      'パーティ全体の総火力を押し上げる。',
    innate: [
      { kind: 'opening_buff', value: 0.20 },
      { kind: 'buff_duration', value: 1 },
    ],
    innateDesc: '戦闘開始時に固有バフ +20% / 自分が受けるバフの持続 +1ターン',
    /* ── 派生 (§12) ──
       3つのうち1つしか選べない。片方に振ると他の2つは封じられる。
       乗り換えるには振り戻すか転職する。 */
    branches: {
      br_tc_command: { name: '号令', desc: '手番を配る。自分は殴らず、味方の行動回数を増やす。' },
      br_tc_aim: { name: '照準', desc: '1手を重くする。手番は増やさず、当たる一発を厚くする。' },
      br_tc_array: { name: '布陣', desc: '戦う前に勝ちを作る。隊列と仕込みで初撃を最大化する。' },
    },
    nodes: [
      {
        id: 'tc_extra', name: '刹那の読み', cost: 2, maxLevel: 3,
        effects: [{ kind: 'extra_action', value: 0.08 }],
        desc: '行動後 8%の確率でもう一度動ける',
      },
      {
        id: 'tc_kill', name: '流れを掴む', cost: 1, maxLevel: 3,
        effects: [{ kind: 'kill_extra_action', value: 0.10 }],
        desc: '敵を倒したとき 10%の確率でもう一度動ける',
      },
      {
        id: 'tc_buff', name: '采配', cost: 1, maxLevel: 3,
        effects: [{ kind: 'buff_on_kill', value: 0.10 }],
        desc: '敵を倒すたびに固有バフ +10%（3ターン）',
      },
      {
        id: 'tc_first', name: '初手の妙', cost: 2, maxLevel: 2,
        effects: [{ kind: 'first_hit_crit', value: 1 }],
        desc: 'ウェーブごとに、最初の攻撃1回が確定で会心になる',
      },
      {
        id: 'tc_wave', name: '決戦の采配', cost: 2, maxLevel: 3,
        effects: [{ kind: 'wave_power', value: 0.10 }],
        desc: '最終ウェーブ（ボス戦）での火力 +10%',
      },
      {
        id: 'tc_len', name: '長引く号令', cost: 2, maxLevel: 2,
        effects: [{ kind: 'buff_duration', value: 1 }],
        desc: '自分が受けるバフの持続 +1ターン',
      },
      {
        branch: 'br_tc_command',
        id: 'tc_command', name: '【技】刻の号令', cost: 4, maxLevel: 1,
        effects: [{ kind: 'grant_skill', skill: 'sk_cls_command', value: 1 }],
        desc: 'クラス技「刻の号令」を習得。全員に追加行動。さらに仲間の待ち時間をすべて解除（3R目以降・CT6）',
      },
      {
        // ── 極点 (§12) ──
        branch: 'br_tc_command',
        id: 'tc_tempo', name: '【極】刻の支配', cost: 6, maxLevel: 1,
        effects: [
          { kind: 'extra_action', value: 0.35 },
          { kind: 'buff_duration', value: 2 },
          { kind: 'stat_pct', stat: 'atk', value: -0.45 },
        ],
        desc: '35%で再行動、味方バフの持続 +2ターン。ただし ATK -45%',
      },
      /* ── 上限を伸ばしてから触る帯 (§12)。全部で73点かかる ── */
      {
        id: 'tc_ambush', name: '先制の呼吸', cost: 2, maxLevel: 3,
        effects: [{ kind: 'ambush', value: 0.12 }],
        desc: '1ラウンド目に12%の確率でもう一度動ける',
      },
      {
        id: 'tc_round', name: '長期戦の読み', cost: 2, maxLevel: 3,
        effects: [{ kind: 'round_stack', value: 0.05 }],
        desc: 'ラウンドを重ねるごとに火力 +5%',
      },
      {
        id: 'tc_party', name: '連携の妙', cost: 2, maxLevel: 3,
        effects: [{ kind: 'party_size_power', value: 0.05 }],
        desc: '生きている味方1人につき火力 +5%',
      },
      {
        id: 'tc_variety', name: '変幻の指揮', cost: 2, maxLevel: 3,
        effects: [{ kind: 'variety_power', value: 0.08 }],
        desc: '前と違う技を使うと火力 +8%（同じ技を振り続けると乗らない）',
      },
      {
        branch: 'br_tc_aim',
        id: 'tc_deadeye', name: '【技】総員狙撃', cost: 5, maxLevel: 1,
        effects: [{ kind: 'grant_skill', skill: 'sk_cls_deadeye', value: 1 }],
        desc: 'クラス技「総員狙撃」を習得。敵全体に照準を付け、味方全員の火力を上げる（2R目以降・CT4）',
      },
      {
        // 刻の支配が「手番を増やす」道なら、こちらは「1手を重くする」道。
        branch: 'br_tc_aim',
        id: 'tc_oracle', name: '【極】戦機を読む', cost: 8, maxLevel: 1,
        effects: [
          { kind: 'first_hit_crit', value: 2 },
          { kind: 'wave_power', value: 0.5 },
          { kind: 'round_stack', value: 0.12 },
          { kind: 'stat_pct', stat: 'hp', value: -0.4 },
        ],
        desc: 'ウェーブごとに確定会心2回、ボス戦の火力 +50%、ラウンドごとに +12%。ただし最大HP -40%',
      },
      /* ── 派生: 号令 ── 手番を配る。自分は殴らず、味方の行動回数を増やす。 */
      {
        branch: 'br_tc_command',
        id: 'tc_c_extra', name: '刹那の重ね', cost: 2, maxLevel: 3,
        effects: [{ kind: 'extra_action', value: 0.07 }],
        desc: '行動後 7%の確率でもう一度動ける',
      },
      {
        branch: 'br_tc_command',
        id: 'tc_c_kill', name: '流れを継ぐ', cost: 2, maxLevel: 3,
        effects: [{ kind: 'kill_extra_action', value: 0.10 }],
        desc: '敵を倒したとき 10%の確率でもう一度動ける',
      },
      {
        branch: 'br_tc_command',
        id: 'tc_c_ambush', name: '先手の呼吸', cost: 2, maxLevel: 3,
        effects: [{ kind: 'ambush', value: 0.10 }],
        desc: '1ラウンド目に10%の確率でもう一度動ける',
      },
      {
        branch: 'br_tc_command',
        id: 'tc_c_party', name: '連携の要', cost: 2, maxLevel: 3,
        effects: [{ kind: 'party_size_power', value: 0.05 }],
        desc: '生きている味方1人につき火力 +5%',
      },
      {
        branch: 'br_tc_command',
        id: 'tc_c_len', name: '長引く号令', cost: 2, maxLevel: 2,
        effects: [{ kind: 'buff_duration', value: 1 }],
        desc: '自分が受けるバフの持続 +1ターン',
      },
      /* ── 派生: 照準 ── 1手を重くする。手番は増やさず、当たる一発を厚くする。 */
      {
        branch: 'br_tc_aim',
        id: 'tc_a_wave', name: '決戦の采配', cost: 2, maxLevel: 3,
        effects: [{ kind: 'wave_power', value: 0.10 }],
        desc: '最終ウェーブ（ボス戦）での火力 +10%',
      },
      {
        branch: 'br_tc_aim',
        id: 'tc_a_crit', name: '見極め', cost: 2, maxLevel: 3,
        effects: [{ kind: 'crit', value: 0.05 }],
        desc: 'クリティカル率 +5%',
      },
      {
        branch: 'br_tc_aim',
        id: 'tc_a_boss', name: '大物狙い', cost: 2, maxLevel: 3,
        effects: [{ kind: 'boss_slayer', value: 0.10 }],
        desc: 'ボスへの火力 +10%',
      },
      {
        branch: 'br_tc_aim',
        id: 'tc_a_variety', name: '手を変える', cost: 2, maxLevel: 2,
        effects: [{ kind: 'variety_power', value: 0.08 }],
        desc: '前と違う技を使うと火力 +8%',
      },
      /* ── 派生: 布陣 ── 戦う前に勝ちを作る。隊列と仕込みで初撃を最大化する。 */
      {
        branch: 'br_tc_array',
        id: 'tc_f_skill', name: '【技】陣立て', cost: 5, maxLevel: 1,
        effects: [{ kind: 'grant_skill', skill: 'sk_cls_formation', value: 1 }],
        desc: 'クラス技「陣立て」を習得。味方全員に3ターンの固有バフ +60%（2R目以降・CT4）',
      },
      {
        branch: 'br_tc_array',
        id: 'tc_f_open', name: '開幕の気勢', cost: 2, maxLevel: 3,
        effects: [{ kind: 'opening_buff', value: 0.12 }],
        desc: '戦闘開始時に固有バフ +12%',
      },
      {
        branch: 'br_tc_array',
        id: 'tc_f_first', name: '初手の重み', cost: 2, maxLevel: 3,
        effects: [{ kind: 'first_round_power', value: 0.15 }],
        desc: '1ラウンド目の火力 +15%',
      },
      {
        branch: 'br_tc_array',
        id: 'tc_f_front', name: '前衛の型', cost: 2, maxLevel: 3,
        effects: [{ kind: 'front_power', value: 0.06 }],
        desc: '隊列の前にいるほど火力が上がる（1人につき +6%）',
      },
      {
        branch: 'br_tc_array',
        id: 'tc_f_shield', name: '布陣の備え', cost: 2, maxLevel: 2,
        effects: [{ kind: 'start_shield', value: 0.08 }],
        desc: '戦闘開始時、最大HPの8%ぶんの障壁を張った状態で始まる',
      },
      {
        branch: 'br_tc_array',
        id: 'tc_f_master', name: '【極】完全布陣', cost: 8, maxLevel: 1,
        effects: [{ kind: 'first_round_power', value: 0.9 },
          { kind: 'opening_buff', value: 0.5 },
          { kind: 'start_shield', value: 0.3 },
          { kind: 'round_stack', value: -0.08 }],
        desc: '1ラウンド目の火力 +90%、開幕バフ +50%、開幕障壁 +30%。ただしラウンドごとに火力 -8%',
      },
    ],
  },

  cls_assassin: {
    name: '暗殺者', color: '#ff5c7a', icon: 'crit',
    flavor: '二度斬る必要はない。一度で足りる場所を斬るからだ。',
    desc: '会心に全部を寄せる役。数字の振れ幅は大きいが、' +
      '噛み合ったときの単体火力はどのクラスにも出せない。',
    innate: [
      { kind: 'crit', value: 0.15 },
      { kind: 'crit_damage', value: 0.25 },
    ],
    innateDesc: 'クリティカル率 +15% / クリティカル倍率 +0.25',
    /* ── 派生 (§12) ──
       3つのうち1つしか選べない。片方に振ると他の2つは封じられる。
       乗り換えるには振り戻すか転職する。 */
    branches: {
      br_as_lethal: { name: '必殺', desc: '一撃に賭ける。会心の一発ですべてを決める。' },
      br_as_shadow: { name: '影', desc: '手数で刻む。1発の重さより、振る回数を増やす。' },
      br_as_hunter: { name: '狩人', desc: '弱った獲物を確実に仕留める。硬い相手ほど価値が出る。' },
    },
    nodes: [
      {
        id: 'as_crit', name: '急所の見切り', cost: 1, maxLevel: 3,
        effects: [{ kind: 'crit', value: 0.06 }],
        desc: 'クリティカル率 +6%',
      },
      {
        id: 'as_pierce', name: '会心貫通', cost: 1, maxLevel: 3,
        effects: [{ kind: 'crit_pierce', value: 0.25 }],
        desc: '会心したとき 防御を25%ぶん無視する',
      },
      {
        id: 'as_stack', name: '狂騒', cost: 2, maxLevel: 3,
        effects: [{ kind: 'crit_stack', value: 0.06 }],
        desc: '会心するたびにクリティカル率 +6%（戦闘が終わると戻る）',
      },
      {
        id: 'as_exec', name: '首を狙う', cost: 2, maxLevel: 3,
        effects: [{ kind: 'execute', value: 0.25 }],
        desc: '相手のHPが減っているほど威力上昇（瀕死で +25%）',
      },
      {
        id: 'as_spread', name: '返り血', cost: 2, maxLevel: 3,
        effects: [{ kind: 'crit_spread', value: 0.15 }],
        desc: '会心したとき、与ダメージの15%が他の敵全員にも及ぶ',
      },
      {
        branch: 'br_as_lethal',
        id: 'as_behead', name: '【技】首刈り', cost: 4, maxLevel: 1,
        effects: [{ kind: 'grant_skill', skill: 'sk_cls_behead', value: 1 }],
        desc: 'クラス技「首刈り」を習得。HP3割以下の相手を、残量にかかわらず落とす（ボスを除く／2R目以降・CT3）',
      },
      {
        // ── 極点 (§12) ──
        branch: 'br_as_lethal',
        id: 'as_lethal', name: '【極】必殺の理', cost: 6, maxLevel: 1,
        effects: [
          { kind: 'crit', value: 0.5 },
          { kind: 'crit_damage', value: 1.2 },
          { kind: 'stat_pct', stat: 'def', value: -0.6 },
        ],
        desc: 'クリティカル率 +50%、倍率 +1.2。ただし DEF -60%',
      },
      /* ── 上限を伸ばしてから触る帯 (§12)。全部で73点かかる ── */
      {
        id: 'as_combo', name: '連刃', cost: 2, maxLevel: 3,
        effects: [{ kind: 'crit_combo', value: 1 }],
        desc: '会心するたびにコンボが1段多く積む',
      },
      {
        id: 'as_double', name: '双撃', cost: 3, maxLevel: 3,
        effects: [{ kind: 'double_hits', value: 0.10 }],
        desc: '10%の確率で同じ技がもう一度出る',
      },
      {
        id: 'as_lone', name: '一対一', cost: 2, maxLevel: 3,
        effects: [{ kind: 'lone_foe_power', value: 0.12 }],
        desc: '敵が1体だけのときの火力 +12%',
      },
      {
        id: 'as_crit_exec', name: '断頭の理', cost: 2, maxLevel: 3,
        effects: [{ kind: 'crit_execute', value: 0.15 }],
        desc: '相手のHPが減っているほど会心しやすくなる（瀕死で +15%）',
      },
      {
        branch: 'br_as_shadow',
        id: 'as_step', name: '【技】影渡り', cost: 5, maxLevel: 1,
        effects: [{ kind: 'grant_skill', skill: 'sk_cls_shadowstep', value: 1 }],
        desc: 'クラス技「影渡り」を習得。もう一度動ける代わりに次のラウンドを失う（2R目以降・CT3）',
      },
      {
        // 必殺の理が「1発を重くする」道なら、こちらは「手数で機会を増やす」道。
        branch: 'br_as_shadow',
        id: 'as_shadow', name: '【極】影法師', cost: 7, maxLevel: 1,
        effects: [
          { kind: 'double_hits', value: 0.35 },
          { kind: 'ambush', value: 0.4 },
          { kind: 'crit_spread', value: 0.2 },
          { kind: 'stat_pct', stat: 'hp', value: -0.45 },
        ],
        desc: '35%で技がもう一度出る、1R目に40%で再行動、会心が20%こぼれる。ただし最大HP -45%',
      },
      /* ── 派生: 必殺 ── 一撃に賭ける。会心の一発ですべてを決める。 */
      {
        branch: 'br_as_lethal',
        id: 'as_l_crit', name: '極みの見切り', cost: 2, maxLevel: 3,
        effects: [{ kind: 'crit', value: 0.06 }],
        desc: 'クリティカル率 +6%',
      },
      {
        branch: 'br_as_lethal',
        id: 'as_l_dmg', name: '痛打の極み', cost: 2, maxLevel: 3,
        effects: [{ kind: 'crit_damage', value: 0.15 }],
        desc: 'クリティカル倍率 +0.15',
      },
      {
        branch: 'br_as_lethal',
        id: 'as_l_pierce', name: '深く刺す', cost: 2, maxLevel: 3,
        effects: [{ kind: 'crit_pierce', value: 0.20 }],
        desc: '会心したとき 防御を20%ぶん無視する',
      },
      {
        branch: 'br_as_lethal',
        id: 'as_l_first', name: '初撃必中', cost: 3, maxLevel: 2,
        effects: [{ kind: 'first_hit_crit', value: 1 }],
        desc: 'ウェーブごとに、最初の攻撃1回が確定で会心になる',
      },
      /* ── 派生: 影 ── 手数で刻む。1発の重さより、振る回数を増やす。 */
      {
        branch: 'br_as_shadow',
        id: 'as_s_double', name: '二刀の理', cost: 3, maxLevel: 3,
        effects: [{ kind: 'double_hits', value: 0.10 }],
        desc: '10%の確率で同じ技がもう一度出る',
      },
      {
        branch: 'br_as_shadow',
        id: 'as_s_stack', name: '刻むほど冴える', cost: 2, maxLevel: 3,
        effects: [{ kind: 'hit_stack', value: 0.04 }],
        desc: '攻撃を当てるたび、その戦闘中の火力 +4%',
      },
      {
        branch: 'br_as_shadow',
        id: 'as_s_ambush', name: '影踏み', cost: 2, maxLevel: 3,
        effects: [{ kind: 'ambush', value: 0.10 }],
        desc: '1ラウンド目に10%の確率でもう一度動ける',
      },
      {
        branch: 'br_as_shadow',
        id: 'as_s_spread', name: '返り血', cost: 2, maxLevel: 2,
        effects: [{ kind: 'crit_spread', value: 0.12 }],
        desc: '会心したとき、与ダメージの12%が他の敵全員にも及ぶ',
      },
      /* ── 派生: 狩人 ── 弱った獲物を確実に仕留める。硬い相手ほど価値が出る。 */
      {
        branch: 'br_as_hunter',
        id: 'as_h_skill', name: '【技】仕留めの一矢', cost: 5, maxLevel: 1,
        effects: [{ kind: 'grant_skill', skill: 'sk_cls_hunt', value: 1 }],
        desc: 'クラス技「仕留めの一矢」を習得。防御無視の一撃。3ターン相手の防御を0にする（2R目以降・CT3）',
      },
      {
        branch: 'br_as_hunter',
        id: 'as_h_exec', name: '狩りの作法', cost: 2, maxLevel: 3,
        effects: [{ kind: 'execute', value: 0.20 }],
        desc: '相手のHPが減っているほど威力上昇（瀕死で +20%）',
      },
      {
        branch: 'br_as_hunter',
        id: 'as_h_boss', name: '巨獣狩り', cost: 2, maxLevel: 3,
        effects: [{ kind: 'boss_slayer', value: 0.12 }],
        desc: 'ボスへの火力 +12%',
      },
      {
        branch: 'br_as_hunter',
        id: 'as_h_break', name: '鎧通し', cost: 2, maxLevel: 3,
        effects: [{ kind: 'guard_break', value: 0.10 }],
        desc: '攻撃時 10%の確率で防御を無視する',
      },
      {
        branch: 'br_as_hunter',
        id: 'as_h_weak', name: '手負いを追う', cost: 2, maxLevel: 2,
        effects: [{ kind: 'crit_execute', value: 0.15 }],
        desc: '相手のHPが減っているほど会心しやすくなる（瀕死で +15%）',
      },
      {
        branch: 'br_as_hunter',
        id: 'as_h_apex', name: '【極】終の狩人', cost: 7, maxLevel: 1,
        effects: [{ kind: 'execute', value: 0.8 },
          { kind: 'boss_slayer', value: 0.35 },
          { kind: 'full_hp_foe_power', value: -0.4 }],
        desc: '相手が削れているほど火力が伸び（瀕死で +80%）、ボスへの火力 +35%。ただし満タンの相手への火力 -40%',
      },
    ],
  },
};
