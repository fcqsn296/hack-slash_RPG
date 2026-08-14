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
        desc: 'クラス技「絶対防壁」を習得（3R目以降・CT5）',
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
        desc: 'クラス技「再臨の光」を習得（4R目以降・CT6）',
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
        desc: 'クラス技「終焉の一撃」を習得（3R目以降・CT4）',
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
        desc: 'クラス技「疫病の坩堝」を習得（2R目以降・CT4）',
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
        desc: 'クラス技「刻の号令」を習得（3R目以降・CT6）',
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
        desc: 'クラス技「首刈り」を習得（2R目以降・CT3）',
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
    ],
  },
};
