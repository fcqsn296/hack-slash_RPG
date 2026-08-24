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
  // 星辰の宝箱はユニーク装備 (§7.8) が主役なので、セットは出さない。
  box_astral: 0,
};
