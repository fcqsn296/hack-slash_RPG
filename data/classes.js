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
        id: 'gd_oath', name: '【技】大盾の宣誓', cost: 5, maxLevel: 1,
        effects: [{ kind: 'grant_skill', skill: 'sk_cls_bulwark', value: 1 }],
        desc: 'クラス技「大盾の宣誓」を習得。味方全員にDEF依存の障壁を張る（2R目以降・CT4）',
      },
      {
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
        id: 'md_rebirth', name: '【技】再臨の光', cost: 4, maxLevel: 1,
        effects: [{ kind: 'grant_skill', skill: 'sk_cls_rebirth', value: 1 }],
        desc: 'クラス技「再臨の光」を習得。倒れた味方を全快で起こし、その場でもう一度動かす（4R目以降・CT6）',
      },
      {
        // ── 極点 (§12) ──
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
        id: 'md_downpour', name: '【技】星霜の慈雨', cost: 5, maxLevel: 1,
        effects: [{ kind: 'grant_skill', skill: 'sk_cls_downpour', value: 1 }],
        desc: 'クラス技「星霜の慈雨」を習得。味方全員を大きく回復する（2R目以降・CT3）',
      },
      {
        // 絶えぬ灯が「自分が立ち続ける」道なら、こちらは「代わりに背負う」道。
        // どちらも取ると火力が消えるので、片方を選ぶことになる。
        id: 'md_martyr', name: '【極】身代わりの誓い', cost: 8, maxLevel: 1,
        effects: [
          { kind: 'guard_ally', value: 0.4 },
          { kind: 'overheal_shield', value: 0.6 },
          { kind: 'stat_pct', stat: 'hp', value: 0.5 },
          { kind: 'stat_pct', stat: 'def', value: -0.5 },
        ],
        desc: '味方の被害を40%肩代わり、超過回復の60%が障壁に、最大HP +50%。ただし DEF -50%',
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
        id: 'bk_ruin', name: '【技】終焉の一撃', cost: 4, maxLevel: 1,
        effects: [{ kind: 'grant_skill', skill: 'sk_cls_ruin', value: 1 }],
        desc: 'クラス技「終焉の一撃」を習得。確定会心。ダメージ上限の減衰を受けない唯一の技（3R目以降・CT4）',
      },
      {
        // ── 極点 (§12) ──
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
        id: 'bk_quake', name: '【技】天壌崩し', cost: 5, maxLevel: 1,
        effects: [{ kind: 'grant_skill', skill: 'sk_cls_cataclysm', value: 1 }],
        desc: 'クラス技「天壌崩し」を習得。敵全体に威力340%（3R目以降・CT4）',
      },
      {
        // 一撃必倒が単体へ寄せる道なら、こちらは数へ寄せる道。
        id: 'bk_swarm', name: '【極】皆殺しの理', cost: 7, maxLevel: 1,
        effects: [
          { kind: 'foe_count_power', value: 0.18 },
          { kind: 'overkill_carry', value: 0.5 },
          { kind: 'stat_pct', stat: 'def', value: -0.5 },
        ],
        desc: '敵1体につき火力 +18%、倒したときの超過ダメージを50%持ち越す。ただし DEF -50%',
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
        id: 'hx_crucible', name: '【技】疫病の坩堝', cost: 4, maxLevel: 1,
        effects: [{ kind: 'grant_skill', skill: 'sk_cls_crucible', value: 1 }],
        desc: 'クラス技「疫病の坩堝」を習得。撒いた6種の弱体が時間で消えない（2R目以降・CT4）',
      },
      {
        // ── 極点 (§12) ──
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
        id: 'hx_feast', name: '【技】腐爛の宴', cost: 5, maxLevel: 1,
        effects: [{ kind: 'grant_skill', skill: 'sk_cls_blight', value: 1 }],
        desc: 'クラス技「腐爛の宴」を習得。敵全体の毒と火傷をまとめて叩き出す（2R目以降・CT3）',
      },
      {
        // 万疫の主が「撒いたものを重くする」道なら、こちらは「自分ごと沈める」道。
        id: 'hx_martyr', name: '【極】自壊の術式', cost: 7, maxLevel: 1,
        effects: [
          { kind: 'self_curse_power', value: 0.3 },
          { kind: 'debuff_amp', value: 0.4 },
          { kind: 'stat_pct', stat: 'hp', value: -0.45 },
        ],
        desc: '自分の弱体1つにつき火力 +30%、弱体中の敵への火力 +40%。ただし最大HP -45%',
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
        id: 'tc_command', name: '【技】刻の号令', cost: 4, maxLevel: 1,
        effects: [{ kind: 'grant_skill', skill: 'sk_cls_command', value: 1 }],
        desc: 'クラス技「刻の号令」を習得。全員に追加行動。さらに仲間の待ち時間をすべて解除（3R目以降・CT6）',
      },
      {
        // ── 極点 (§12) ──
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
        id: 'tc_deadeye', name: '【技】総員狙撃', cost: 5, maxLevel: 1,
        effects: [{ kind: 'grant_skill', skill: 'sk_cls_deadeye', value: 1 }],
        desc: 'クラス技「総員狙撃」を習得。敵全体に照準を付け、味方全員の火力を上げる（2R目以降・CT4）',
      },
      {
        // 刻の支配が「手番を増やす」道なら、こちらは「1手を重くする」道。
        id: 'tc_oracle', name: '【極】戦機を読む', cost: 8, maxLevel: 1,
        effects: [
          { kind: 'first_hit_crit', value: 2 },
          { kind: 'wave_power', value: 0.5 },
          { kind: 'round_stack', value: 0.12 },
          { kind: 'stat_pct', stat: 'hp', value: -0.4 },
        ],
        desc: 'ウェーブごとに確定会心2回、ボス戦の火力 +50%、ラウンドごとに +12%。ただし最大HP -40%',
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
        id: 'as_behead', name: '【技】首刈り', cost: 4, maxLevel: 1,
        effects: [{ kind: 'grant_skill', skill: 'sk_cls_behead', value: 1 }],
        desc: 'クラス技「首刈り」を習得。HP3割以下の相手を、残量にかかわらず落とす（ボスを除く／2R目以降・CT3）',
      },
      {
        // ── 極点 (§12) ──
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
        id: 'as_step', name: '【技】影渡り', cost: 5, maxLevel: 1,
        effects: [{ kind: 'grant_skill', skill: 'sk_cls_shadowstep', value: 1 }],
        desc: 'クラス技「影渡り」を習得。もう一度動ける代わりに次のラウンドを失う（2R目以降・CT3）',
      },
      {
        // 必殺の理が「1発を重くする」道なら、こちらは「手数で機会を増やす」道。
        id: 'as_shadow', name: '【極】影法師', cost: 7, maxLevel: 1,
        effects: [
          { kind: 'double_hits', value: 0.35 },
          { kind: 'ambush', value: 0.4 },
          { kind: 'crit_spread', value: 0.2 },
          { kind: 'stat_pct', stat: 'hp', value: -0.45 },
        ],
        desc: '35%で技がもう一度出る、1R目に40%で再行動、会心が20%こぼれる。ただし最大HP -45%',
      },
    ],
  },
};
