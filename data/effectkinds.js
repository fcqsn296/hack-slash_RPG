// 効果種別の登録簿 (§5.8 / §7.8)
//
// ── なぜこれが要るか ──
// 効果の情報が3か所に散っていて、**過去に2回ずれた**。
//   tree.js の switch        … 実装
//   units.js の3つのKEYS配列  … ユニーク装備からの流し先（手書きだった）
//   docs の効果キー表         … 手順書（手書きだった）
//
// ずれると「一覧にはあるのに効かない」という、一番たちの悪い壊れ方をする。
// 実際 critPierce と debuffAmp を passives に置いて、長いあいだ死んでいた。
//
// ここを唯一の出どころにして、units.js の配列はここから組み立てる。
//
// ── 各項目の意味 ──
//   to     ツリー/クラスから振ったとき、値がユニットのどこへ入るか
//   shape  レベルの重ね方
//            add    … value×レベルで加算（ほとんどがこれ）
//            max    … 高いほうを採る。上位ノードが下位を置き換えるためのもの。
//                     **加算ではないが、レベルぶんは伸びる**（value×レベルで比べる）。
//                     ここを e.value で比べると、同じノードを重ねても伸びなくなる。
//            levels … レベル数そのものを足す
//            keyed  … 属性や種類ごとの表に入れる
//   needs  この種別に必須の追加フィールド。無いと静かに既定値へ落ちる
//   opt    省略できるが、書かないと既定値のままになるフィールド
//   key    ユニットに書き込まれるプロパティ名。ビルド画面の要約がこれを読む
//   label  画面に出す言葉。無いと要約に載らず、**振ったのに見えない**
//   fmt    数値の見せ方（pct=%／turn=ターン／num=個／lvl=回／keyed=種類ごと／flag=有無）
//   uniq   ユニーク装備の effects で使うキー名（camelCase）。null は装備からは持てない
//   route  そのキーをユニーク装備から流すときの行き先
//            passives    unit.passives へ加算
//            situational unit.situational へ加算（**passives に入れても届かない**）
//            unit        ユニットの素の値（damage.js が直接読む）
//            build       組み立て時に個別処理
//            setEffects  battle.js が p.x + fx.x で読むのでそのまま残す
RPG.data.effectKinds = {
  all_spread: { to: 'passives', shape: 'add', uniq: null, key: 'allSpread', label: '攻撃が全体に広がる', fmt: 'flag' },
  ambush: { to: 'passives', shape: 'add', uniq: 'ambush', route: 'passives', key: 'ambush', label: '奇襲（1R目に再行動）', fmt: 'pct' },
  atk_to_def: { to: 'passives', shape: 'add', uniq: null, key: 'atkToDef', label: 'ATKをDEFへ上乗せ', fmt: 'pct' },
  auto_low_skill: { to: 'passives', shape: 'add', uniq: 'autoLowSkill', route: 'setEffects', key: 'autoLowSkill', label: '小技が自動で出る', fmt: 'pct' },
  back_guard: { to: 'passives', shape: 'add', uniq: null, key: 'backGuard', label: '後列ほど硬い', fmt: 'pct' },
  boss_guard: { to: 'situational', shape: 'add', uniq: null, key: 'bossGuard', label: 'ボスから受けるダメージ減', fmt: 'pct' },
  boss_slayer: { to: 'situational', shape: 'add', uniq: 'bossSlayer', route: 'situational', key: 'bossSlayer', label: 'ボスへの火力', fmt: 'pct' },
  buff_duration: { to: 'passives', shape: 'add', uniq: null, key: 'buffDuration', label: '受けるバフの持続', fmt: 'turn' },
  buff_power: { to: 'passives', shape: 'add', uniq: 'buffPower', route: 'passives', key: 'buffPower', label: '自分がかけるバフの効果量', fmt: 'pct' },
  buff_extend: { to: 'passives', shape: 'add', uniq: 'buffExtend', route: 'passives', key: 'buffExtend', label: '自分がかけるバフの持続', fmt: 'turn' },
  self_buff_power: { to: 'passives', shape: 'add', uniq: 'selfBuffPower', route: 'passives', key: 'selfBuffPower', label: '自分にかけるバフだけ効果量', fmt: 'pct' },
  ally_buff_power: { to: 'passives', shape: 'add', uniq: 'allyBuffPower', route: 'passives', key: 'allyBuffPower', label: '味方にかけるバフだけ効果量', fmt: 'pct' },
  // ── 遮断フラグ (§5.14) ──
  // 支援の【極】の代償側。負の値では組めないので独立した種別にしてある
  // （buffAmount は power<=0 のとき素の値を返すため、負値は打ち消しにならない。
  //   heal_power を下げる手も heal_to_power 経由で神官戦士の火力を消してしまう）。
  // uniq は持たせない。同名の soloBuff が effectKeysSetOnly（装備セット専用）に
  // 既にあり、ユニーク装備のキーとして両方を登録すると経路が食い違う。
  // battle.js は fx.soloBuff と p.soloBuff の両方を見るので、ツリー側はこれで届く。
  // バフ効果量の上限そのものを押し上げる (§5.14)。
  // 上限(BUFF_POWER_CAP=1.0)は「全部足せば全部乗る」を止めるために置いてある。
  // 【極】は代償を払って**その天井を破る**場所なので、ここでだけ上限を動かす。
  // これが無いと、既に上限へ張り付いた支援ビルドには +140% が1ミリも効かない。
  buff_cap: { to: 'passives', shape: 'add', uniq: 'buffCapBonus', route: 'passives', key: 'buffCapBonus', label: 'バフ効果量の上限', fmt: 'pct' },
  solo_buff: { to: 'passives', shape: 'add', uniq: null, route: 'passives', key: 'soloBuff', label: '味方へのバフが通らなくなる', fmt: 'pct' },
  self_buff_lock: { to: 'passives', shape: 'add', uniq: 'noSelfBuff', route: 'passives', key: 'noSelfBuff', label: '自分へのバフが通らなくなる', fmt: 'pct' },
  ally_heal_lock: { to: 'passives', shape: 'add', uniq: 'noAllyHeal', route: 'passives', key: 'noAllyHeal', label: '味方を回復できなくなる', fmt: 'pct' },
  support_stack: { to: 'passives', shape: 'add', uniq: 'supportStack', route: 'passives', key: 'supportStack', label: '支援するほど自分のバフが強くなる', fmt: 'pct' },
  // 障壁を配る口は5つある（技・開幕の備え・毎ラウンドの張り直し・あふれた回復・バフ付与）。
  // これは**その全部に効く**。片方だけに効かせると、どれを伸ばすか考える前に
  // 「どの口から出た障壁か」を覚える羽目になる。
  barrier_power: { to: 'passives', shape: 'add', uniq: 'barrierPower', route: 'passives', key: 'barrierPower', label: '張る障壁の厚み', fmt: 'pct' },
  // 障壁を火力へ変える口 (§9.1)。**障壁が耐久にしか効かない構造そのものへの手当て。**
  // 味方に張ってもらう前提のアタッカーも、これがあって初めて成り立つ。
  shield_power: { to: 'situational', shape: 'add', uniq: 'shieldPower', route: 'situational', key: 'shieldPower', label: '障壁を火力に変える', fmt: 'pct' },
  buff_shield: { to: 'passives', shape: 'add', uniq: 'buffShield', route: 'passives', key: 'buffShield', label: 'バフをかけた相手に障壁', fmt: 'pct' },
  buff_heal: { to: 'passives', shape: 'add', uniq: 'buffHeal', route: 'passives', key: 'buffHeal', label: 'バフをかけた相手を回復', fmt: 'pct' },
  cleanse: { to: 'passives', shape: 'add', uniq: 'cleanse', route: 'passives', key: 'cleanse', label: '回復時に弱体を1つ解く', fmt: 'pct' },
  triage: { to: 'passives', shape: 'add', uniq: 'triage', route: 'passives', key: 'triage', label: '瀕死の相手ほど回復量', fmt: 'pct' },
  heal_spread: { to: 'passives', shape: 'add', uniq: 'healSpread', route: 'passives', key: 'healSpread', label: '回復が他の味方へも及ぶ', fmt: 'pct' },
  heal_buff: { to: 'passives', shape: 'add', uniq: 'healBuff', route: 'passives', key: 'healBuff', label: '回復した相手に固有バフ', fmt: 'pct' },
  low_hp_heal: { to: 'passives', shape: 'add', uniq: 'lowHpHeal', route: 'passives', key: 'lowHpHeal', label: 'ラウンド終了時に瀕死の味方を回復', fmt: 'pct' },
  smite: { to: 'passives', shape: 'add', uniq: 'smite', route: 'passives', key: 'smite', label: '回復した量の一部が敵へ', fmt: 'pct' },
  heal_to_power: { to: 'passives', shape: 'add', uniq: 'healToPower', route: 'passives', key: 'healToPower', label: '回復量の伸びが火力にも乗る', fmt: 'pct' },
  round_buff: { to: 'passives', shape: 'add', uniq: 'roundBuff', route: 'passives', key: 'roundBuff', label: 'ラウンド開始時に味方全体へ固有バフ', fmt: 'pct' },
  taunt: { to: 'passives', shape: 'add', uniq: 'taunt', route: 'passives', key: 'taunt', label: '狙われやすさ', fmt: 'pct' },
  stealth: { to: 'passives', shape: 'add', uniq: 'stealth', route: 'passives', key: 'stealth', label: '狙われにくさ', fmt: 'pct' },
  buff_on_kill: { to: 'passives', shape: 'add', uniq: null, key: 'buffOnKill', label: '撃破時に固有バフ', fmt: 'pct' },
  cap_break: { to: 'build', shape: 'add', uniq: 'capBreak', route: 'unit' },
  chain: { to: 'passives', shape: 'add', uniq: 'chain', route: 'passives', key: 'chain', label: '別の敵へ連鎖', fmt: 'pct' },
  chain_power: { to: 'passives', shape: 'add', uniq: 'chainPower', route: 'passives', key: 'chainPower', label: '連鎖の威力', fmt: 'pct' },
  chaos: { to: 'build', shape: 'special', uniq: null },
  combo_gain: { to: 'passives', shape: 'add', uniq: 'comboGain', route: 'passives', key: 'comboGain', label: 'コンボの積み', fmt: 'pct' },
  combo_keep: { to: 'passives', shape: 'add', uniq: null, key: 'comboKeep', label: 'コンボが減らない', fmt: 'pct' },
  combo_power: { to: 'passives', shape: 'add', uniq: 'comboPower', route: 'passives', key: 'comboPower', label: 'コンボ1段の威力', fmt: 'pct' },
  combo_start: { to: 'passives', shape: 'add', uniq: 'comboStart', route: 'passives', key: 'comboStart', label: '開幕のコンボ', fmt: 'num' },
  combo_spend_power: { to: 'passives', shape: 'add', uniq: 'comboSpendPower', route: 'passives', key: 'comboSpendPower', label: '消費1段あたりの効き', fmt: 'pct' },
  combo_threshold: { to: 'passives', shape: 'add', uniq: 'comboThreshold', route: 'passives', key: 'comboThreshold', label: '必要な段が減る', fmt: 'num' },
  combo_refund: { to: 'passives', shape: 'add', uniq: 'comboRefund', route: 'passives', key: 'comboRefund', label: '消費した段が戻る', fmt: 'pct' },
  combo_max: { to: 'passives', shape: 'add', uniq: 'comboMaxUp', route: 'passives', key: 'comboMaxUp', label: 'コンボの上限', fmt: 'num' },
  counter: { to: 'passives', shape: 'add', opt: ["power"], uniq: 'counterRate', route: 'passives', key: 'counterRate', label: '反撃', fmt: 'pct' },
  counter_all: { to: 'passives', shape: 'add', uniq: null, key: 'counterAll', label: '反撃が全体に及ぶ', fmt: 'pct' },
  counter_power: { to: 'passives', shape: 'add', uniq: null, key: 'counterPower', label: '反撃の威力', fmt: 'pct' },
  crit: { to: 'build', shape: 'add', uniq: 'critRate', route: 'unit' },
  crit_combo: { to: 'passives', shape: 'add', uniq: null, key: 'critCombo', label: '会心でコンボ追加', fmt: 'num' },
  crit_damage: { to: 'build', shape: 'add', uniq: 'critDamage', route: 'unit' },
  crit_overflow: { to: 'passives', shape: 'add', uniq: 'critOverflow', route: 'passives', key: 'critOverflow', label: '会心率の余りが会心ダメージへ', fmt: 'pct' },
  crit_execute: { to: 'situational', shape: 'add', uniq: null, key: 'critExecute', label: '瀕死の相手に会心しやすい', fmt: 'pct' },
  crit_heal: { to: 'passives', shape: 'add', uniq: null, key: 'critHeal', label: '回復が会心する', fmt: 'pct' },
  crit_pierce: { to: 'situational', shape: 'add', uniq: 'critPierce', route: 'situational', key: 'critPierce', label: '会心時に防御を無視', fmt: 'pct' },
  crit_spread: { to: 'passives', shape: 'add', uniq: null, key: 'critSpread', label: '会心が他の敵へこぼれる', fmt: 'pct' },
  crit_stack: { to: 'passives', shape: 'add', uniq: null, key: 'critStack', label: '会心するほど会心率上昇', fmt: 'pct' },
  damage_share: { to: 'passives', shape: 'add', uniq: null, key: 'damageShare', label: '被害を味方で分ける', fmt: 'pct' },
  debuff_amp: { to: 'situational', shape: 'add', uniq: 'debuffAmp', route: 'situational', key: 'debuffAmp', label: '弱体中の相手への火力', fmt: 'pct' },
  debuff_duration: { to: 'passives', shape: 'add', uniq: 'debuffDuration', route: 'passives', key: 'debuffDuration', label: '与える弱体の持続', fmt: 'turn' },
  debuff_resist: { to: 'passives', shape: 'add', uniq: null, key: 'debuffResist', label: '受ける弱体の持続を短縮', fmt: 'pct' },
  debuff_spread: { to: 'passives', shape: 'add', uniq: 'debuffSpread', route: 'passives', key: 'debuffSpread', label: '弱体が隣へ伝染', fmt: 'pct' },
  def_to_atk: { to: 'passives', shape: 'add', uniq: null, key: 'defToAtk', label: 'DEFをATKへ上乗せ', fmt: 'pct' },
  double_hits: { to: 'passives', shape: 'add', uniq: 'doubleHits', route: 'passives', key: 'doubleHits', label: '同じ技がもう一度', fmt: 'pct' },
  // 値は「1回ごとに何倍になるか」。多段（double_hits）を殺すので同時には持てない。
  // 上限は battle.js の ESCALATE_CAP（×128）。
  escalate: { to: 'passives', shape: 'max', uniq: null, key: 'escalate', label: '撃つたびに前回の倍（多段は出ない）', fmt: 'num' },
  dual_element: { to: 'build', shape: 'special', needs: ["element"], uniq: null },
  element_adapt: { to: 'build', shape: 'add', uniq: 'elementAdapt', route: 'build' },
  element_convert: { to: 'build', shape: 'special', needs: ["element"], uniq: null },
  element_crit: { to: 'build', shape: 'keyed', needs: ["element"], uniq: null },
  element_mastery: { to: 'build', shape: 'keyed', needs: ["element"], uniq: null },
  element_pierce: { to: 'build', shape: 'add', uniq: null },
  element_power: { to: 'build', shape: 'keyed', needs: ["element"], uniq: null },
  element_resist: { to: 'build', shape: 'keyed', needs: ["element"], uniq: null },
  // ── 新しい5軸 (§5.9) ──
  // どれも既存キーの数値違いではなく、いま読む口が無い場所。
  evade: { to: 'passives', shape: 'add', uniq: 'evade', route: 'passives', key: 'evade', label: '攻撃を回避', fmt: 'pct' },
  focus_power: { to: 'passives', shape: 'add', uniq: 'focusPower', route: 'passives', key: 'focusPower', label: '同じ相手を狙い続けるほど火力', fmt: 'pct' },
  relay_power: { to: 'passives', shape: 'add', uniq: 'relayPower', route: 'passives', key: 'relayPower', label: '違う系統で継ぐと火力', fmt: 'pct' },
  mend_power: { to: 'passives', shape: 'add', uniq: 'mendPower', route: 'passives', key: 'mendPower', label: '受けた回復量だけ火力', fmt: 'pct' },
  cooldown_cut: { to: 'passives', shape: 'add', uniq: 'cooldownCut', route: 'passives', key: 'cooldownCut', label: 'クラス技の待ち時間短縮', fmt: 'turn' },
  execute: { to: 'build', shape: 'add', uniq: 'execute', route: 'unit' },
  extra_action: { to: 'passives', shape: 'add', uniq: 'extraActionRate', route: 'passives', key: 'extraActionRate', label: '再行動', fmt: 'pct' },
  first_hit_crit: { to: 'passives', shape: 'levels', uniq: null, key: 'firstHitCrit', label: 'ウェーブ最初の攻撃が確定会心', fmt: 'lvl' },
  first_round_power: { to: 'situational', shape: 'add', uniq: 'firstRoundPower', route: 'situational', key: 'firstRoundPower', label: '1ラウンド目の火力', fmt: 'pct' },
  foe_count_power: { to: 'passives', shape: 'add', uniq: null, key: 'foeCountPower', label: '敵1体につき火力', fmt: 'pct' },
  front_power: { to: 'passives', shape: 'add', uniq: null, key: 'frontPower', label: '前列ほど火力', fmt: 'pct' },
  full_hp_foe_power: { to: 'situational', shape: 'add', uniq: null, key: 'fullHpFoePower', label: '満タンの相手への火力', fmt: 'pct' },
  grant_skill: { to: 'build', shape: 'special', needs: ["skill"], uniq: null },
  guard_ally: { to: 'passives', shape: 'add', uniq: 'guardAlly', route: 'passives', key: 'guardAlly', label: '味方の被害を肩代わり', fmt: 'pct' },
  guard_break: { to: 'passives', shape: 'add', uniq: null, key: 'guardBreak', label: '防御を無視して攻撃', fmt: 'pct' },

  // アルカナ (§21) の利。**装備を通り抜けて最終ダメージに掛かる。**
  //
  // stat_pct（素のステータスへの%）ではいけない。装備は平坦加算で後から乗るので、
  // 育った環境では素の比率が小さく、効きがほとんど消える。
  // 実測: 実プレイのエンドビルドは ATK 27,434 のうち素が 2,543（**装備が9割**）。
  // stat_pct +60% を乗せても +5.6% にしかならなかった。
  // テスト用の雛形ビルドは素の比率が高いので、そこでは効いて見えてしまう。
  // @知見: stat_pct は装備の平坦加算より前に掛かるので、育った環境では効きが消える
  always_power: { to: 'situational', shape: 'add', uniq: null, key: 'alwaysPower', label: '与えるダメージ', fmt: 'pct' },

  // ── アルカナ (§21) が使う3種 ──
  // どれも「代償」か「規則の書き換え」で、積み上げる類のものではない。
  // そのため fmt は flag（有無）で、レベルで伸びる想定を持たない。

  // 「力」の代償。**受ける側**の旗。自分が殴られるとき防御軽減が働かなくなる。
  // guard_break（攻める側が確率で無視する）の裏返しにあたる。
  defense_null: { to: 'passives', shape: 'max', uniq: null, key: 'defenseNull', label: '防御が無視される', fmt: 'flag' },

  // 「吊るされた男」の代償。毎ラウンド手番を1つ失う。
  // **停止ではなく負債**。再行動・号令・段の出口で返済できる（§21）。
  // ── 戦車 (§21) ──
  // turn_debt の対。**確率ではなく確定**で手番が1つ増える。
  // extra_action（確率の再行動）とは別物で、guard_break に対する
  // defense_null と同じ「確率の版が既にあるところへ確定の版を置く」関係。
  turn_gift: { to: 'passives', shape: 'add', uniq: null, key: 'turnGift', label: '毎ラウンド手番が1つ増える', fmt: 'num' },
  // 守りの効果が丸ごと働かなくなる旗 (§21)。
  //
  // **defense_null と取り違えないこと。** 防御の層は2つあり、消す先が違う。
  //   defense_null … DEF由来の層（1 - DEF/(DEF+c)）だけを消す
  //   ward_null    … reduction・障壁・庇う/肩代わり のほうを消す
  // 両方あって初めて「守りを全部捨てる」になる。
  ward_null: { to: 'passives', shape: 'max', uniq: null, key: 'wardNull', label: '守りの効果が働かない', fmt: 'flag' },
  // ── 立ち上がる回数 (§21)「戦車」──
  // 倒れても、この回数までは起き上がる。**止まり方を覚えなかった、の実装。**
  //
  // ── なぜ回数なのか ──
  // 守りへの投資が1つも効かない相手が存在する。
  //   ・軽減/障壁/庇い … ward_null が消す（定義上）
  //   ・HP            … 闘技場は被害上限が最大HPの割合なので比例して伸びる。
  //                     実測でHPを25倍にしても落ちるラウンドが 3.7R で不動だった
  //   ・狙いを逸らす   … draw_fire が塞ぐ
  // 投資できる先が残らないので、代償が「敵が動いたら死ぬ」だけの段差になる。
  // 回数なら目盛りが置ける。**1回がおよそ1.1ラウンドを買う**（実測）。
  //
  // ── 立ち上がるHPは効かない ──
  // 25/35/50/75% を振って結果が完全に同一だった。起き上がった先で次の1発が
  // 必ず致死なので、何%で戻っても次までの猶予が変わらない。数字は読みやすさで決めた。
  rise_count: { to: 'passives', shape: 'max', uniq: null, key: 'riseCount', label: '倒れても立ち上がる回数', fmt: 'num' },

  // 敵の狙いを必ず引き受ける旗 (§21)。taunt（狙われやすさの重み）の確定版。
  //
  // **ward_null とセットで初めて代償になる。** 守りが無いだけでは、
  // 撃たれない場面で何も払わずに済んでしまう（実測でそうなった）。
  draw_fire: { to: 'passives', shape: 'max', uniq: null, key: 'drawFire', label: '敵の攻撃を必ず自分が受ける', fmt: 'flag' },
  // ── 節制 (§21)「節制」──
  // 自分の回復技であふれたぶん（過剰回復）を蓄え、次の攻撃1行動を強化する。
  // 値は交換の係数。「対象の最大HP100%ぶんの過剰回復につき、攻撃を +値」。
  //
  // ── なぜ回復量そのものを使わないのか ──
  // 回復は数千、攻撃は数百万以上に伸びる。固定倍率で交換すると桁が合わない。
  // **対象の最大HPに対する割合**へ直してから交換するので、育ちに関わらず釣り合う。
  //
  // ── 蓄えられる回復を絞る理由 ──
  // 攻撃のHP吸収は最小段階でも与ダメージの2%ある。100万ダメージなら2万回復で、
  // これを蓄積に入れると**強化攻撃が次の強化を用意する輪**になる。
  // だから `plugin === 'heal'`（純粋な回復技）だけを数える。
  // 吸収・攻撃付随・再生・他者からの回復は入らない。
  temperance: { to: 'passives', shape: 'add', uniq: null, key: 'temperance', label: '過剰回復を次の攻撃へ', fmt: 'pct' },

  // ── 裁き (§21)「正義」──
  // 攻撃する前に、対象の敵から最強の攻撃を1回受ける。耐えれば、その一撃の上限を (1 + 値) 倍に広げる。
  //
  // 値が 0 より大きいことが「応撃を受ける」旗も兼ねる。利と害が同じ旗から出るので、
  // 利だけを持って害を持たない状態が作れない。
  // 上限は cap_break に足さず掛ける（節制と同じ理由。足すと上限突破を積んだビルドほど薄まる）。
  justice: { to: 'passives', shape: 'add', uniq: null, key: 'justice', label: '裁きを耐えた一撃の上限', fmt: 'pct' },

  // ── 幻傷 (§21)「月」──
  // 自分の攻撃は敵のHPを削らず、幻傷を刻む。仲間の攻撃がその敵に当たると幻傷が開き、
  // 刻んだ時点の値のダメージが通る。値は「敵1体・1ラウンドに開ける回数」。
  //
  // 値が 0 より大きいことが「自分では削れない」旗も兼ねる（利と害が同じ旗から出る）。
  // ── 分与 (§21)「女帝」──
  // SPで取ったツリーのパッシブのうち規則表 (RPG.arcana.EMPRESS_SHARE) にあるものを、
  // 自分は半分にし、同じ半分を他の味方それぞれへ分ける。旗で、値は 1 しか取らない。
  // 実際の半減・共有は units.js（ツリーの層）と state.partyUnits（配る）で行う。
  empress: { to: 'passives', shape: 'max', uniq: null, key: 'empress', label: '分与（ツリーのパッシブを半分ずつ分ける）', fmt: 'flag' },

  // ── 儀式 (§21)「教皇」──
  // 自分の通常手番で共有できる攻撃技を使うと、隊列で後ろにいて通常手番が残っている仲間全員が
  // 同じ技をそれぞれの能力で撃つ。加わった仲間はその通常手番を使い切る（利と害が同じ旗から出る）。
  ritual: { to: 'passives', shape: 'max', uniq: null, key: 'ritual', label: '儀式（仲間も同じ技を撃つ）', fmt: 'flag' },

  // ── 輪 (§21)「運命の輪」──
  // 物理 → 魔術 → 遺物 の順に攻撃すると、当てた敵へ 防御崩壊・標的・凍結。一周で味方全員の
  // 次の攻撃1行動の上限を引き上げる（値はその倍率。正義と同じ「削られた値を引き上げる」式）。
  // 順に反した攻撃は違反として数え、敵フェーズの直前に現在HPを 0.5^違反 倍にする。
  // 値が 0 より大きいことが違反を数える旗も兼ねる（利と害が同じ旗から出る）。
  wheel: { to: 'passives', shape: 'add', uniq: null, key: 'wheel', label: '輪の一周で味方の次の一撃の上限', fmt: 'pct' },

  moon: { to: 'passives', shape: 'add', uniq: null, key: 'moon', label: '幻傷を開ける回数（敵1体・1ラウンド）', fmt: 'lvl' },

  // ── 絆 (§21)「恋人」──
  // 同じ札（恋人）を持つ味方1人につき火力が上がる。
  bond_power: { to: 'passives', shape: 'add', uniq: null, key: 'bondPower', label: '同じ札を持つ味方1人につき火力', fmt: 'pct' },

  // 受けた被害を、同じ札を持つ味方と分け合う。
  //
  // ── なぜ「倒れたら自分も倒れる」にしなかったか ──
  // 味方が倒れる頻度は実測で 周回 0.00人／相つき 0.25人／闘技場 3.00人。
  // 連鎖死にすると「まったく効かない」か「全滅」かの二択になり、中間が無い。
  // **分配なら目盛りが連続になる**——総量は変わらず散るので、
  // 「誰かを守る」戦術が効かなくなる代わり、集中砲火では落ちにくくなる。
  //
  // 既存の `damage_share`（守護者が 0.35 で持つ）と同じ仕組みだが、
  // 分ける相手が**同じ札を持つ者だけ**に絞られる。
  // `ward_null`（戦車）で無効化されるのも同じ——戦車は痛みを分け合えない。
  bond_share: { to: 'passives', shape: 'add', uniq: null, key: 'bondShare', label: '同じ札を持つ味方と被害を分ける', fmt: 'pct' },

  // ── 勅命 (§21)「皇帝」──
  // 自分の手番を、味方1人の即時行動に置き換える。
  // 命令できる味方がいるあいだ、本人の技は使えない（利と害が同じ旗から出る）。
  //
  // ── 手番が戻る輪を作らないこと ──
  // 命令による行動からは再行動を生まない。生むと 受け手 → 皇帝 → 受け手 … と
  // 手番が無限に増える。**生んでから取り消すのではなく、生む前に止める**
  // （取り消す形にすると、受け手の残り回数や取得済みの権利を巻き戻すことになる）。
  // 号令・前借り・蘇生+行動は、そもそも命令で選ばせない（grantsTurn）。
  //
  // ── 皇帝は複数いてよい ──
  // 他の皇帝へは命令できないので、皇帝どうしで回し合う形は生まれない。
  // 3人が1人のアタッカーへ集中する編成は組めるが、**渡す側は柔軟な行動
  // （バフ・デバフ・回復・固有の再行動技）を丸ごと失う**のが代償になる。
  decree: { to: 'passives', shape: 'max', uniq: null, key: 'decree', label: '手番を味方に渡す', fmt: 'flag' },

  // ── 系統の書き換え (§21)「魔術師」──
  // すべての技を魔術系統として扱う。**物理・遺物としては扱われない。**
  //
  // ── なぜ「としても」ではなく「として」なのか ──
  // 系統タグ倍率はこのゲーム最大の乗算で、実測 ×7.4〜×21.8（タグ17本）。
  // 「魔術としても扱う」（両方に乗る）だと +16%〜+153% の丸儲けになり、
  // **装備しだいで効き方が10倍違う**札になる。
  // 置き換えなら変換になり、主人公 −38% ／ ミレーヌ +69% と向きが分かれる——
  // **装備を組み替えること自体が代償**として働く。
  as_magi: { to: 'situational', shape: 'max', uniq: null, key: 'asMagi', label: 'すべての技が魔術系統になる', fmt: 'flag' },

  // 魔術の技で攻撃するたび、味方全員へ薄い障壁と回復を配る (§21 魔術師)。
  //
  // **起動役が居ない仕掛けを起こすための札。** 次の3つは、配る相手が居ないと死に枠になる:
  //   shield_power  障壁を火力に変える
  //   mend_power    受けた回復量だけ火力
  //   buff_shield / buff_heal / heal_buff の連鎖
  weave_gift: { to: 'passives', shape: 'add', uniq: 'weaveGift', route: 'passives', key: 'weaveGift', label: '魔術で攻撃するたび味方へ障壁と回復', fmt: 'pct' },

  // 同じ技を続けて使えない (§21 魔術師)。
  //
  // **数値ではなく構造を削る代償。** 実測で、数値を削る代償はエンドビルドに
  // ほぼ全部吸収される（回復もバフも止めて 8.0R → 7.8R）。
  // 「最大火力の技を連打する」という組み立てそのものを禁じる。
  no_repeat: { to: 'passives', shape: 'max', uniq: null, key: 'noRepeat', label: '同じ技を続けて使えない', fmt: 'flag' },

  // ── 終止符 (§21)「死」──
  // 値は「終止符までに行動できる回数」。それまでは**どんな一撃も HP1 で耐え**、
  // その回数を使い切った瞬間に必ず倒れる（回復も復活も効かない）。
  //
  // ── なぜ「回数」なのか ──
  // **エンドビルドは、たいていの代償を吸収してしまう。** 実測で、
  // 他者からの回復もバフも止めて 8.0R → 7.8R しか動かなかった。
  // 耐久・支援・HPはどれも装備と育成で埋められるが、**回数は埋められない**。
  //
  // ── 8 である理由 ──
  // 実測した主人公の行動回数: 周回 5.7回 ／ 相つき周回 3.3回 ／ 闘技場ハード 11.7回。
  // 8 はその境目で、**周回では一度も訪れず、闘技場では必ず訪れる**。
  // 13（札の番号）にすると 11.7 を超えてどこでも発動しない。
  final_count: { to: 'passives', shape: 'max', uniq: null, key: 'finalCount', label: '終止符までの行動回数', fmt: 'num' },

  // 終止符が近いほど鋭くなる。1行動ごとに背水（low_hp_power）へ加算する。
  //
  // **HP1 に張り付く利と噛み合っている。** 背水は「減っているほど」効くので、
  // 必ず HP1 で耐える＝常に最大で乗る。機構が1つで済む。
  // 周回では一度も殴られないので HP が満タンのまま＝何も乗らない。
  // 利も害も高難度でだけ働く、という狙いどおりの形になる。
  doom_power: { to: 'passives', shape: 'add', uniq: null, key: 'doomPower', label: '終止符が近いほど火力', fmt: 'pct' },

  // ── 縛り (§21)「吊るされた男」の代償 ──
  // 自分が常に麻痺している扱いにする。値はそのまま「動けない確率」。
  //
  // **turn_debt（返済できる負債）と turn_stride（2回に1回）の置き換え。**
  // どちらも捨てた理由は同じで、**目盛りが無いこと**だった。
  //   負債 … 返済の口が extra_action しかなく、戦術家を選ぶのがほぼ唯一の解になる
  //   刻み … `ticks % stride !== 1` なので 2 の次は 3。「3回に2回」が作れない
  // 実測でも刻みは段差になった——等倍では代償ゼロ、HP×35 で勝率 100%→0%。
  // 麻痺は比率なので、いくらでも細かく置ける（詳細は docs/作業ログ/吊るされた男の代償.md）。
  //
  // **状態異常として貼らずに、statusRatio の下限として持つ。**
  // 貼ると解除技で自分の代償を外せてしまい、ウェーブごとの貼り直しも要る。
  // 下限なら1箇所で済み、敵が撒いた麻痺とは max で合流する（二重に効かない）。
  //
  // **麻痺はクールダウンを進めてから飛ばす** (battle.js の commandSkill)。
  // 大技を抱えているほど損が大きいという意図的な作りなので、
  // 名目の比率より重く効く。数字を決めるときは必ず実測すること。
  self_bind: { to: 'passives', shape: 'max', uniq: null, key: 'selfBind', label: '自分が動けない確率', fmt: 'pct' },

  turn_debt: { to: 'passives', shape: 'add', uniq: null, key: 'turnDebt', label: '毎ラウンド手番を1つ失う', fmt: 'num' },

  // 「吊るされた男」の利。会心判定を振らずに必ず会心にする。
  // crit（確率を足す）と違い、確率の上限や会心率への投資と無関係に成立する。
  always_crit: { to: 'passives', shape: 'max', uniq: null, key: 'alwaysCrit', label: '攻撃は必ず会心', fmt: 'flag' },
  heal_on_kill: { to: 'passives', shape: 'add', uniq: 'healOnKill', route: 'passives', key: 'healOnKill', label: '撃破時に回復', fmt: 'pct' },
  heal_power: { to: 'passives', shape: 'add', uniq: 'healPower', route: 'passives', key: 'healPower', label: '与える回復量', fmt: 'pct' },
  high_hp_power: { to: 'situational', shape: 'add', uniq: null, key: 'highHpPower', label: 'HPが高いほど火力', fmt: 'pct' },
  // 大技だけの上限突破 (§5.16)。
  //
  // 終盤は上限(50万×(1+cap_break))が全部の技を同じ高さに押し込めるので、
  // **威力180と威力520の最終ダメージがほぼ同じ**になっていた（実測 1.68M 対 1.81M、差7%）。
  // 威力2.9倍の差が消えるので、大技を選ぶ意味が終盤で無くなる。
  //
  // 上限突破は「上限が削っていたぶん」しか取り戻せず、素の計算値を超えては伸びない。
  // つまり青天井にはならない。大技だけに配れば、帯の identity が終盤まで残る。
  high_power_cap: { to: 'situational', shape: 'add', uniq: 'highPowerCap', route: 'situational', key: 'highPowerCap', label: '大技のダメージ上限突破', fmt: 'pct' },
  high_power_boost: { to: 'situational', shape: 'add', uniq: 'highPowerBoost', route: 'situational', key: 'highPowerBoost', label: '大技の火力', fmt: 'pct' },
  hit_stack: { to: 'passives', shape: 'add', uniq: null, key: 'hitStack', label: '被弾するほど火力', fmt: 'pct' },
  hp_to_atk: { to: 'passives', shape: 'add', uniq: null, key: 'hpToAtk', label: '最大HPをATKへ上乗せ', fmt: 'pct' },
  hp_to_def: { to: 'passives', shape: 'add', uniq: 'hpToDef', route: 'passives', key: 'hpToDef', label: '最大HPをDEFへ上乗せ', fmt: 'pct' },
  kill_extra_action: { to: 'passives', shape: 'add', uniq: null, key: 'killExtraAction', label: '撃破時に再行動', fmt: 'pct' },
  last_stand: { to: 'passives', shape: 'max', uniq: null, key: 'lastStand', label: '致死をHP1で耐える', fmt: 'pct' },
  lifesteal: { to: 'passives', shape: 'add', uniq: null, key: 'lifesteal', label: '吸命', fmt: 'pct' },
  lone_foe_power: { to: 'passives', shape: 'add', uniq: 'loneFoePower', route: 'passives', key: 'loneFoePower', label: '敵が1体のときの火力', fmt: 'pct' },
  low_hp_guard: { to: 'passives', shape: 'add', uniq: null, key: 'lowHpGuard', label: '瀕死ほど硬い', fmt: 'pct' },
  low_hp_power: { to: 'situational', shape: 'add', uniq: null, key: 'lowHpPower', label: '瀕死ほど火力', fmt: 'pct' },
  low_power_boost: { to: 'passives', shape: 'add', uniq: 'lowPowerBoost', route: 'setEffects', key: 'lowPowerBoost', label: '小技の火力', fmt: 'pct' },
  low_power_repeat: { to: 'passives', shape: 'add', uniq: 'lowPowerRepeat', route: 'setEffects', key: 'lowPowerRepeat', label: '小技が繰り返す', fmt: 'pct' },
  low_power_spread: { to: 'passives', shape: 'add', uniq: 'lowPowerSpread', route: 'setEffects', key: 'lowPowerSpread', label: '小技が全体に広がる', fmt: 'pct' },
  mid_power_boost: { to: 'situational', shape: 'add', uniq: 'midPowerBoost', route: 'situational', key: 'midPowerBoost', label: '中技の火力', fmt: 'pct' },
  mid_power_cap: { to: 'situational', shape: 'add', uniq: 'midPowerCap', route: 'situational', key: 'midPowerCap', label: '中技のダメージ上限突破', fmt: 'pct' },
  mid_power_combo: { to: 'passives', shape: 'add', uniq: 'midPowerCombo', route: 'passives', key: 'midPowerCombo', label: '中技でコンボが多く積む', fmt: 'pct' },
  mid_power_crit: { to: 'passives', shape: 'add', uniq: 'midPowerCrit', route: 'passives', key: 'midPowerCrit', label: '中技の会心率', fmt: 'pct' },
  mid_power_status: { to: 'passives', shape: 'add', uniq: 'midPowerStatus', route: 'passives', key: 'midPowerStatus', label: '中技で弱体が付きやすい', fmt: 'pct' },
  mono_element_power: { to: 'passives', shape: 'add', uniq: null, key: 'monoElementPower', label: '単一属性で揃えた火力', fmt: 'pct' },
  neutral_power: { to: 'situational', shape: 'add', uniq: null, key: 'neutralPower', label: '等倍相手への火力', fmt: 'pct' },
  opening_buff: { to: 'passives', shape: 'add', uniq: null, key: 'openingBuff', label: '開幕の固有バフ', fmt: 'pct' },
  overheal_shield: { to: 'passives', shape: 'add', uniq: 'overhealShield', route: 'passives', key: 'overhealShield', label: 'あふれた回復が障壁に', fmt: 'pct' },
  overkill_carry: { to: 'passives', shape: 'add', uniq: null, key: 'overkillCarry', label: '超過ダメージを持ち越す', fmt: 'pct' },
  party_size_power: { to: 'passives', shape: 'add', uniq: null, key: 'partySizePower', label: '味方1人につき火力', fmt: 'pct' },
  // uniq を持たせるとユニーク装備・セット効果からも使えるようになる（effectRoutes 経由）。
  // 『七色の杖』(§7.8) がこの2つを使うので開けた。route は passives——
  // battle.js の powerScale は attacker.passives からしか読まないので、
  // setEffects 側にも足すと二重には**ならない**代わりに、passives へ合流させないと届かない。
  rainbow_power: { to: 'passives', shape: 'add', uniq: 'rainbowPower', route: 'passives', key: 'rainbowPower', label: '属性を散らした火力', fmt: 'pct' },
  reduction: { to: 'build', shape: 'add', uniq: null },
  reflect: { to: 'passives', shape: 'add', uniq: 'reflect', route: 'passives', key: 'reflect', label: '受けたダメージを反射', fmt: 'pct' },
  regen: { to: 'passives', shape: 'add', uniq: null, key: 'regen', label: '毎ラウンド回復', fmt: 'pct' },
  repeat_power: { to: 'passives', shape: 'add', uniq: null, key: 'repeatPower', label: '同じ技を続けるほど火力', fmt: 'pct' },
  revive: { to: 'passives', shape: 'max', uniq: 'reviveHp', route: 'build', key: 'reviveHp', label: '復活時のHP', fmt: 'pct' },
  round_stack: { to: 'passives', shape: 'add', uniq: null, key: 'roundStack', label: 'ラウンドごとに火力', fmt: 'pct' },
  self_curse_power: { to: 'passives', shape: 'add', uniq: 'selfCursePower', route: 'passives', key: 'selfCursePower', label: '自分の弱体1つにつき火力', fmt: 'pct' },
  shield_regen: { to: 'passives', shape: 'add', uniq: 'shieldRegen', route: 'passives', key: 'shieldRegen', label: '毎ラウンド障壁を張り直す', fmt: 'pct' },
  sigil_burst: { to: 'passives', shape: 'add', uniq: 'sigilBurst', route: 'passives', key: 'sigilBurst', label: '刻印の炸裂', fmt: 'pct' },
  solo_power: { to: 'passives', shape: 'add', uniq: 'soloPower', route: 'passives', key: 'soloPower', label: '単騎のときの火力', fmt: 'pct' },
  stable_damage: { to: 'passives', shape: 'add', uniq: null, key: 'stableDamage', label: 'ダメージの振れ幅を抑える', fmt: 'pct' },
  start_shield: { to: 'passives', shape: 'add', uniq: null, key: 'startShield', label: '開幕の障壁', fmt: 'pct' },
  stat_cost: { to: 'build', shape: 'keyed', needs: ["stat"], uniq: null },
  stat_pct: { to: 'build', shape: 'keyed', needs: ["stat"], uniq: null },
  status_immune: { to: 'passives', shape: 'add', uniq: null, key: 'statusImmune', label: '弱体をはねのける', fmt: 'pct' },
  status_on_hit: { to: 'passives', shape: 'add', uniq: null, key: 'statusOnHit', label: '攻撃時に弱体を付与', fmt: 'pct' },
  status_on_hit_kind: { to: 'passives', shape: 'keyed', needs: ["status"], uniq: null, key: 'statusOnHitKind', label: '攻撃時に特定の弱体を付与', fmt: 'keyed' },
  status_power: { to: 'passives', shape: 'add', uniq: 'statusPower', route: 'passives', key: 'statusPower', label: '与える継続ダメージ', fmt: 'pct' },
  status_resist_kind: { to: 'passives', shape: 'keyed', needs: ["status"], uniq: null, key: 'statusResistKind', label: '特定の弱体に耐性', fmt: 'keyed' },
  tag_all: { to: 'build', shape: 'add', uniq: null },
  tag_bonus: { to: 'build', shape: 'keyed', needs: ["tag"], uniq: null },
  tag_crit: { to: 'build', shape: 'keyed', needs: ["tag"], uniq: null },
  tag_pierce: { to: 'build', shape: 'keyed', needs: ["tag"], uniq: null },
  thorns: { to: 'passives', shape: 'add', uniq: null, key: 'thorns', label: '被弾時に相手の最大HPを削る', fmt: 'pct' },
  variety_power: { to: 'passives', shape: 'add', uniq: 'varietyPower', route: 'passives', key: 'varietyPower', label: '技を変えると火力', fmt: 'pct' },
  vs_status_power: { to: 'passives', shape: 'keyed', needs: ["status"], uniq: null, key: 'vsStatusPower', label: '弱体中の敵への火力', fmt: 'keyed' },
  wave_heal: { to: 'passives', shape: 'add', uniq: null, key: 'waveHeal', label: 'ウェーブ移行時に回復', fmt: 'pct' },
  wave_power: { to: 'passives', shape: 'add', uniq: null, key: 'wavePower', label: '最終ウェーブの火力', fmt: 'pct' },
  wave_revive: { to: 'passives', shape: 'max', uniq: null, key: 'waveRevive', label: 'ウェーブ移行時に復活', fmt: 'pct' },
  wave_stack: { to: 'passives', shape: 'add', uniq: null, key: 'waveStack', label: 'ウェーブごとに火力', fmt: 'pct' },
  weak_guard: { to: 'situational', shape: 'add', uniq: null, key: 'weakGuard', label: '不利属性で受ける被害を軽減', fmt: 'pct' },
  weak_hunter: { to: 'situational', shape: 'add', uniq: null, key: 'weakHunter', label: '有利を取れたときの火力', fmt: 'pct' },
};

/**
 * ツリーに対応する種別を持たない、**装備セット専用**の効果キー (§7.7)。
 *
 * これらは battle.js が `p.x + fx.x` の形で setEffects から直接読む。
 * passives へ流すと二重に効くので、組み立て時は触らない。
 */
RPG.data.effectKeysSetOnly = {
  selfPower: { route: 'setEffects', desc: '自分の火力（共鳴セットの代償側）' },
  fallenPower: { route: 'setEffects', desc: '倒れた味方1人につき強くなる' },
  decayPerRound: { route: 'setEffects', desc: 'ラウンドごとに火力が落ちる' },
  decayFloor: { route: 'setEffects', desc: '落ちきる下限' },
  wrathRatio: { route: 'setEffects', desc: '受けたダメージを怒りへ変える割合' },
  wrathRelease: { route: 'setEffects', desc: '溜めた怒りを解き放つ' },
  comboLock: { route: 'setEffects', desc: '積んだコンボが減らなくなる' },
  soloBuff: { route: 'setEffects', desc: '味方にかけたバフが効かなくなる（孤影セットの代償側）' },
  smiteAll: { route: 'setEffects', desc: '癒しの余波が敵全体へ飛ぶ' },
};

/**
 * ユニーク装備・装備セットの effects に書けるキー → 行き先 の対応表。
 * 上の2つから組み立てる。units.js がこれを見て流し先を決める。
 */
RPG.data.effectRoutes = (function () {
  /** @type {Record<string, string>} */
  const out = {};
  for (const kind of Object.keys(RPG.data.effectKinds)) {
    const d = RPG.data.effectKinds[kind];
    if (d.uniq) out[d.uniq] = d.route;
  }
  for (const key of Object.keys(RPG.data.effectKeysSetOnly)) {
    out[key] = RPG.data.effectKeysSetOnly[key].route;
  }
  return out;
})();
