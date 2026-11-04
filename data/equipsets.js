// 装備セット (§7.7)
//
// ── 設計の方針 ──
// 「攻撃力+10%」のような数値だけのセットは作らない。それは既存の副オプションで足りている。
// ここに置くのは **戦い方そのものが変わるもの** だけにする。具体的には
//   - 弱点コンボ (§10.6) の挙動を書き換える
//   - ラウンドの進み方や、仲間の生死といった「戦況」を火力に変える
//   - 大きな代償と引き換えに大きな見返りを得る
// のいずれかに当てはまるものだけを載せている。
//
// 部位は問わない。同じセットの装備を何個着けているかだけを数える。
// スロットは最大6（武器2・防具2・装飾2）なので、2セットは早期から、4セットは
// スキルツリーでスロットを広げてから狙う形になる。
//
// effects のキーは src/core/equipset.js と battle.js が解釈する。
// 新しいキーを足すときは、そちらにも処理を書くこと。
RPG.data.equipSets = {

  // ── 狙い (§5.9) ──
  // 反撃・棘・庇うは「殴られてから」効くのに、殴られるかどうかを選べなかった。
  // 敵の的付けを寄せることで、その一群が初めて噛み合う。
  set_bulwark: {
    name: '衆目', color: '#e0b45c',
    flavor: '前へ出る者がいなければ、隊列はただの列である。',
    desc: '敵の狙いを自分へ寄せる。反撃・棘と組ませて、集めた攻撃を手数に変える。',
    bonuses: [
      {
        pieces: 2,
        label: '狙われやすさ +90%',
        effects: { taunt: 0.9 },
      },
      {
        pieces: 4,
        label: '狙われやすさ +180%／反撃率 +25%／反撃が敵全体に及ぶ',
        effects: { taunt: 1.8, counterRate: 0.25, counterAll: true },
      },
    ],
  },

  // ── バフ役の分岐 (§5.12) ──
  set_banner: {
    name: '万軍', color: '#7fc9ff',
    flavor: '旗は振る者のためではなく、見る者のために在る。',
    desc: '味方へかけるバフだけが伸びる。自分は素のまま、隊列を押し上げる役。',
    bonuses: [
      {
        pieces: 2,
        label: '味方にかけるバフの効果量 +60%',
        effects: { allyBuffPower: 0.6 },
      },
      {
        pieces: 4,
        // 号令はツリー側にもあるので、セットでも配ると二重になる (§5.12)。
        // 実測でバフ役が 6.2R → 4.4R、戦闘不能が11→2まで落ちて支配的になった。
        // セットは「味方へ厚く配る」一点に絞り、号令はツリーの側だけに残す。
        label: '味方へのバフ +70%／かけるバフの持続 +1／味方へのバフが1ターン長く残る',
        effects: { allyBuffPower: 0.7, buffExtend: 2 },
      },
    ],
  },

  set_solitude: {
    name: '孤影', color: '#c58cff',
    flavor: '誰も助けに来ないのなら、誰も助けなくてよい。',
    desc: '自分へのバフだけが濃くなる。代わりに、味方へかけたバフは一切通らなくなる。',
    bonuses: [
      {
        pieces: 2,
        label: '自分にかけるバフの効果量 +80%',
        effects: { selfBuffPower: 0.8 },
      },
      {
        pieces: 4,
        // 「大きな代償と引き換えに大きな見返り」の枠 (§7.7)。
        label: '自分へのバフ +170%／ただし味方へかけたバフは効かなくなる',
        effects: { selfBuffPower: 1.7, soloBuff: true },
      },
    ],
  },

  // ── 回復の反転 (§5.11) ──
  set_stigma: {
    name: '聖痕', color: '#ffd98a',
    flavor: '癒しは、癒されぬものを焼く。',
    desc: '癒した量が敵へ返る。回復し続けることがそのまま攻撃になる。',
    bonuses: [
      {
        pieces: 2,
        label: '回復した量の 45% が敵1体へ',
        effects: { smite: 0.45 },
      },
      {
        pieces: 4,
        label: '回復した量の 85% が **敵全体** へ／瀕死の相手への回復量 +50%',
        effects: { smite: 0.85, smiteAll: true, triage: 0.5 },
      },
    ],
  },

  set_echo: {
    name: '残響', color: '#8fd8ff',
    flavor: '打ち込んだ音は、遅れて還ってくる。',
    desc: '与えたダメージが遅れてもう一度届く。長く戦うほど積み上がる。',
    bonuses: [
      {
        pieces: 2,
        label: '与えたダメージの 25% を記録する',
        effects: { echoRatio: 0.25 },
      },
      {
        pieces: 4,
        label: '記録は 45% になり、2ラウンド後にまとめて敵へ撃ち込まれる',
        effects: { echoRatio: 0.45, echoDelay: 2 },
      },
    ],
  },

  set_wrath: {
    name: '憤怒', color: '#ff7a5c',
    flavor: '受けた痛みは、そのまま返すためにある。',
    desc: '被弾するほど怒りが溜まり、次の一撃に上乗せされる。殴られる前提のビルド向け。',
    bonuses: [
      {
        pieces: 2,
        label: '被弾したダメージの 35% を怒りとして溜める',
        effects: { wrathRatio: 0.35 },
      },
      {
        pieces: 4,
        label: '怒りは 70% になり、次の攻撃で全て解き放たれる',
        effects: { wrathRatio: 0.70, wrathRelease: true },
      },
    ],
  },

  set_adapt: {
    name: '千変', color: '#7be0b5',
    flavor: '形を持たぬものに、弱点は無い。',
    desc: '属性事故が消え、弱点コンボが途切れなくなる。コンボ主体の手動戦闘と噛み合う。',
    bonuses: [
      {
        pieces: 2,
        label: '属性不利を受けなくなる',
        effects: { elementAdapt: 1 },
      },
      {
        pieces: 4,
        label: '弱点コンボが外しても落ちず、上限が +3 される',
        effects: { comboLock: true, comboMaxBonus: 3 },
      },
    ],
  },

  set_blitz: {
    name: '刹那', color: '#ffd76a',
    flavor: '長引けば負ける。ならば長引かせない。',
    desc: '開幕が極端に強く、ラウンドが進むほど弱くなる。短期決戦の縛りクエストと相性がよい。',
    bonuses: [
      {
        pieces: 2,
        label: '1ラウンド目の火力 +80%',
        effects: { firstRoundPower: 0.8 },
      },
      {
        pieces: 4,
        label: '1ラウンド目 +180%。以降は1ラウンドごとに 12% ずつ落ちる（下限 50%）',
        effects: { firstRoundPower: 1.8, decayPerRound: 0.12, decayFloor: 0.5 },
      },
    ],
  },

  set_undying: {
    name: '常世', color: '#b58cff',
    flavor: '倒れた者の重さが、残る者の刃を沈める。',
    desc: '仲間が倒れるほど強くなる。全滅寸前がもっとも強い、危うい構成。',
    bonuses: [
      {
        pieces: 2,
        label: '戦闘不能から HP35% で復活する（1戦闘に1回）',
        effects: { reviveHp: 0.35 },
      },
      {
        pieces: 4,
        label: '倒れている仲間1人につき火力 +40%',
        effects: { fallenPower: 0.4 },
      },
    ],
  },

  set_resonance: {
    name: '共鳴', color: '#ff9fd8',
    flavor: '前に出ぬことでしか届かぬ力がある。',
    desc: '自分の火力を削って仲間全員を押し上げる。単騎では無意味で、編成込みで考える必要がある。',
    bonuses: [
      {
        pieces: 2,
        label: '自分以外の味方全員の火力 +12%',
        effects: { allyPower: 0.12 },
      },
      {
        pieces: 4,
        label: '自分の火力が半分になる代わりに、味方全員の火力 +45%',
        effects: { allyPower: 0.45, selfPower: -0.5 },
      },
    ],
  },

  // ── ビルドの軸ごとのセット（2026-11、ユーザー方針「セット効果を大量に」）──
  // 10種しか無く、ツリーで厚くした軸（最終ウェーブ・ラウンドごと・執着・弱点コンボ・守り・
  // 呼び戻し・状態異常・耐性・大技・中技）に対応するセットが無かった。
  // 方針（数値だけのセットは作らない）に合わせ、どれも**条件つき**の伸びで、4点で性格が一段変わる。
  // セットは全種から均等に抽選されるので、種類が増えるほど特定のセットは揃いにくくなる
  // （竜の宝箱で特定セットの4点は、10種のとき平均約105箱 → 20種で約210箱の見込み）。
  //
  // 実測（REFERENCE 4人・Lv255、着けている装備のうち4つに同じセットを付け、数値は同じのまま比較、seed固定）:
  //   回廊のボス HP×100 を倒すまでのラウンド（中央）。セット無し 12R
  //     既存: 残響 9R／共鳴 10R／千変 11R
  //     新規: 蝕み 8R／決戦 9R／中庸 9R／持久 10R／一念 10R／連撃 11R／天裂き 11R
  //   蝕みは毒（最大HPの割合）が厚い相手ほど効くので最も速い。HP×30 なら他と同じ3R
  //   守り（還らぬ位相、seed固定24回）:
  //     不落（攻撃専念の1人）10/24→15/24／還し（呼び戻しを振っていない支援役）21/24→24/24／
  //     祓い（4人とも・蝕む相）4/24→19/24
  set_decisive: {
    name: '決戦', color: '#e8c26a',
    flavor: '最後の一戦のために、それまでの全てを温存する。',
    desc: '最終ウェーブ（ボス戦）でだけ牙を剥く。短いボス戦で先に立つ型。',
    bonuses: [
      { pieces: 2, label: '最終ウェーブの火力 +30%', effects: { wavePower: 0.30 } },
      { pieces: 4, label: '最終ウェーブの火力 +70%／ボスへの火力 +20%', effects: { wavePower: 0.70, bossSlayer: 0.20 } },
    ],
  },

  set_enduring: {
    name: '持久', color: '#a8d8a0',
    flavor: '長い夜ほど、灯は強く燃える。',
    desc: 'ラウンドを重ねるほど強くなる。長いボス戦・塔・還らぬ位相の型。',
    bonuses: [
      { pieces: 2, label: 'ラウンドが1つ進むごとに火力 +6%', effects: { roundStack: 0.06 } },
      { pieces: 4, label: 'ラウンドごとに火力 +12%／ラウンド終了時、瀕死の味方を最大HPの4%回復', effects: { roundStack: 0.12, lowHpHeal: 0.04 } },
    ],
  },

  set_fixation: {
    name: '一念', color: '#c0c8d8',
    flavor: '一度狙ったら、倒れるまで目を離さない。',
    desc: '同じ相手を殴り続けるほど重くなる。ボスとの一騎打ちの型。',
    bonuses: [
      { pieces: 2, label: '同じ相手を続けて殴るたびに火力 +8%', effects: { focusPower: 0.08 } },
      { pieces: 4, label: '同じ相手を続けて殴るたびに火力 +16%／会心が守りを25%貫く', effects: { focusPower: 0.16, critPierce: 0.25 } },
    ],
  },

  set_cadence: {
    name: '連撃', color: '#d9905a',
    flavor: '一撃ごとに刃が鳴る。鳴りが重なるほど深く入る。',
    desc: '弱点コンボの1段を重くする。弱点を突き続ける編成の型。',
    bonuses: [
      { pieces: 2, label: 'コンボ1段あたりの倍率 +4%', effects: { comboPower: 0.04 } },
      { pieces: 4, label: 'コンボ1段あたりの倍率 +8%／弱点を突いたときのコンボ +1段', effects: { comboPower: 0.08, comboGain: 1 } },
    ],
  },

  set_rampart: {
    name: '不落', color: '#9aa8b8',
    flavor: '後ろに誰かがいる限り、退く理由は無い。',
    desc: '敵の狙いを引き受け、味方の傷を肩代わりする。守り役の型。',
    bonuses: [
      { pieces: 2, label: '狙われやすさ +60%／味方の被ダメの15%を肩代わり', effects: { taunt: 0.6, guardAlly: 0.15 } },
      { pieces: 4, label: '狙われやすさ +100%／肩代わり35%／毎ラウンド最大HPの6%の障壁', effects: { taunt: 1.0, guardAlly: 0.35, shieldRegen: 0.06 } },
    ],
  },

  set_homeward: {
    name: '還し', color: '#b8d8e8',
    flavor: '倒れた者の帰り道は、立っている者が照らす。',
    desc: '立っている限り、倒れた味方を戦いの合間に起こす。回復役の型。',
    bonuses: [
      { pieces: 2, label: '戦いの合間に倒れた味方をHP20%で起こす', effects: { rallyRevive: 0.20 } },
      { pieces: 4, label: '戦いの合間に倒れた味方をHP50%で起こす／回復量 +30%', effects: { rallyRevive: 0.50, healPower: 0.30 } },
    ],
  },

  set_blight: {
    name: '蝕み', color: '#7fbf5a',
    flavor: '傷口に残るものが、本当の傷になる。',
    desc: '殴るたびに毒を残し、弱った相手を重く叩く。状態異常の型。',
    bonuses: [
      { pieces: 2, label: '攻撃時 25%で毒を付与', effects: { statusOnHit: 0.25 } },
      // 最初は 毒50%・弱体中+30%・継続+30% で、既存で最強の残響（HP×100 のボスを9R）を超えて8Rだった。
      // 毒40%・継続+20% でもまだ8R。弱体中の火力のほうが効いていたので、そちらも下げた
      { pieces: 4, label: '攻撃時 35%で毒／弱体中の相手への火力 +20%／与える継続ダメージ +20%', effects: { statusOnHit: 0.35, debuffAmp: 0.20, statusPower: 0.20 } },
    ],
  },

  set_warding: {
    name: '祓い', color: '#c9d4e0',
    flavor: '纏わりつくものは、肌に届く前に剥がす。',
    desc: '受ける弱体を短くし、はねのけ、解く。蝕む相への答えの型。',
    bonuses: [
      { pieces: 2, label: '受ける弱体の持続 -1ターン', effects: { debuffResist: 1 } },
      { pieces: 4, label: '受ける弱体の持続 -2ターン／25%ではねのける／回復時に30%で弱体を解く', effects: { debuffResist: 2, statusImmune: 0.25, cleanse: 0.30 } },
    ],
  },

  set_skyrend: {
    name: '天裂き', color: '#c87850',
    flavor: '一振りで空を割る。小さく振る使い方は考えられていない。',
    desc: '威力200以上の大技を伸ばし、上限まで押し上げる。大技の型。',
    bonuses: [
      { pieces: 2, label: '大技（威力200以上）の火力 +20%', effects: { highPowerBoost: 0.20 } },
      { pieces: 4, label: '大技の火力 +30%／大技のダメージ上限 +150%', effects: { highPowerBoost: 0.30, highPowerCap: 1.50 } },
    ],
  },

  set_median: {
    name: '中庸', color: '#a8c8a0',
    flavor: '大きすぎず、小さすぎず。ちょうどの重さで振るう。',
    desc: '威力101〜199の中技を伸ばす。中技の型。',
    bonuses: [
      { pieces: 2, label: '中技（威力101〜199）の火力 +25%', effects: { midPowerBoost: 0.25 } },
      { pieces: 4, label: '中技の火力 +50%／中技のダメージ上限 +100%', effects: { midPowerBoost: 0.50, midPowerCap: 1.00 } },
    ],
  },
};

/**
 * セット装備が出る確率。宝箱のグレードが高いほど出やすい。
 * 銅の宝箱からは出ないので、序盤に狙う対象にはならない。
 */
RPG.data.equipSetChance = {
  box_bronze: 0,
  box_silver: 0.10,
  box_gold: 0.22,
  box_dragon: 0.38,
  // 竜の色違い。出る率は竜と同じで、どのセットが出やすいかだけが違う（data/equipment.js）
  box_dragon_offense: 0.38,
  box_dragon_guard: 0.38,
  box_dragon_rhythm: 0.38,
  box_dragon_heresy: 0.38,
  // 星辰の宝箱はユニーク装備 (§7.8) が主役なので、セットは出さない。
  box_astral: 0,
};
