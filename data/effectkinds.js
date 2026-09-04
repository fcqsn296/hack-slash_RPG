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
  rainbow_power: { to: 'passives', shape: 'add', uniq: null, key: 'rainbowPower', label: '属性を散らした火力', fmt: 'pct' },
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
  variety_power: { to: 'passives', shape: 'add', uniq: null, key: 'varietyPower', label: '技を変えると火力', fmt: 'pct' },
  vs_status_power: { to: 'passives', shape: 'keyed', needs: ["status"], uniq: null, key: 'vsStatusPower', label: '弱体中の敵への火力', fmt: 'keyed' },
  wave_heal: { to: 'passives', shape: 'add', uniq: null, key: 'waveHeal', label: 'ウェーブ移行時に回復', fmt: 'pct' },
  wave_power: { to: 'passives', shape: 'add', uniq: null, key: 'wavePower', label: '最終ウェーブの火力', fmt: 'pct' },
  wave_revive: { to: 'passives', shape: 'max', uniq: null, key: 'waveRevive', label: 'ウェーブ移行時に復活', fmt: 'pct' },
  wave_stack: { to: 'passives', shape: 'add', uniq: null, key: 'waveStack', label: 'ウェーブごとに火力', fmt: 'pct' },
  weak_guard: { to: 'situational', shape: 'add', uniq: null, key: 'weakGuard', label: '不利属性で受ける被害を軽減', fmt: 'pct' },
  weak_hunter: { to: 'situational', shape: 'add', uniq: null, key: 'weakHunter', label: '不利属性でも通す', fmt: 'pct' },
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
