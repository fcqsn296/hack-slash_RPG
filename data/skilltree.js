// スキルツリー (§5)
// 網の目型の前提条件は持たない。「累計投資レベルによるティア解放」だけで構成する (§5.1)。
// 全キャラクターがこの同一テンプレートを共有する (§5.2)。

/** ティア定義。解放条件は「対象ティア群への累計投資レベル」の比較演算だけで完結する。 */
RPG.data.skillTreeTiers = {
  basic: { label: '初級', order: 0, requiresLevels: 0,  countsFrom: [] },
  mid:   { label: '中級', order: 1, requiresLevels: 5,  countsFrom: ['basic'] },
  high:  { label: '上級', order: 2, requiresLevels: 10, countsFrom: ['basic', 'mid'] },
};

/** スキルリセットの費用 (§5.5)。キャラクターのレベルに比例する。 */
RPG.data.skillResetCostPerLevel = 150;

/**
 * 1レベルだけ払い戻すときの費用 (§5.5)。消費SP 1点あたり。
 *
 * 全部振り直すと 150G/SP 程度（レベル×150 ÷ 配られるSP）なので、
 * こちらはその倍以上に置いてある。**まとめてやり直すなら全体リセットのほうが安い**
 * という関係を保ちたい。1点だけ抜くのは精度への対価で、
 * 安くしすぎると全体リセットが存在意義を失う。
 */
RPG.data.skillRefundCostPerSp = 400;

/**
 * ビルドプリセットの枠 (§7.5-2)。
 *
 * ── なぜ要るのか ──
 * 装備は無料で3枠ぶん切り替えられるのに、ツリーとクラスは切り替える手段が
 * 「毎回お金を払って振り直す」しか無かった。実測すると Lv150 の1人で
 * 振り直し22,500 + 転職30,000 = 52,500G、4人パーティなら 210,000G。
 * 周回1周の収入が16,000〜17,000Gなので、**入れ替えに約13周、戻すのにまた13周**。
 * これでは誰も試さない。ガチャの天井(200,000G)とほぼ同額の値段が
 * 「ビルドを試す」ことに付いていた。
 *
 * ── どこで線を引くか ──
 * 枠を買うのが対価で、保存済みビルドへの切り替えは無料。
 * ただし **振り直しの費用はそのまま残す** ので、新しいビルドを作るのは今までどおり有料。
 * プリセットが無料にするのは「一度払って作ったビルドへ戻ること」だけで、
 * 2つ持つには2回払う必要がある。払った回数ぶんしか行き来できない。
 *
 * ゴールドの吸い先はガチャと鍛冶が無制限にあるので、
 * 振り直しの反復課金が減っても経済は緩まない。そちらへ流れるだけ。
 *
 * ── なぜアカウント単位なのか ──
 * キャラごとに買わせると、新しいキャラを迎えるたびに買い直しになり、
 * 「仲間が増えるほど損」という税になる。枠数は全キャラ共通で持つ。
 *
 * ── なぜ最初の3枠が無料なのか ──
 * 買う前に価値が分からないものは買われない。
 * 3枠を使い切って「もう1つ欲しい」と思った人だけが買う形にしてある。
 * 最初の有料枠(50,000G)が1人ぶんの転職費(30,000G)より少し高い程度なので、
 * 「1回振り直すより、枠を買って往復できるようにするほうが得か」で判断できる。
 */
RPG.data.presetFreeSlots = 3;
RPG.data.presetMaxSlots = 6;
/** 4枠目・5枠目・6枠目の値段。周回換算で約3周 / 9周 / 24周。 */
RPG.data.presetSlotCosts = [50000, 150000, 400000];

/**
 * 保存済みビルドへ切り替えるときの費用。振り直し費用に対する割合。
 *
 * 0 = 無料。強すぎた場合にここだけ上げれば、
 * 「戦闘ごとに最適ビルドへ替える」遊び方に値段を付けられる。
 * 0.2 なら Lv150 で 4,500G（通常の振り直し22,500Gの2割）。
 */
RPG.data.presetApplyCostRate = 0;

/**
 * ノード定義。
 * cost      : 1レベルあたりの消費SP
 * maxLevel  : 最大投資レベル
 * effects   : 1レベルあたりの効果。複数持てる。
 *   stat_pct      基礎ステータスの割合上昇
 *   tag_bonus     系統タグ倍率への加算 (§3.2 ステップ2)
 *   tag_all       [物理][魔術][遺物] すべてに同時加算（乗算で効くので伸びが大きい）
 *   crit          クリティカル率
 *   cap_break     ダメージ上限突破率 (§3.2 ステップ8)
 *   slot          装備スロット拡張 (§5.3)
 *   element_adapt 「全属性適応」(§5.4 万能型)
 *   element_mastery 「○○の極意」(§5.4 特化型)
 *   chaos         「混沌の力」(§5.4 無属性ゴリ押し)
 */
RPG.data.skillTree = [
  /* ======================= 初級 ======================= */
  {
    id: 'tr_atk', tier: 'basic', name: '攻撃鍛錬', cost: 1, maxLevel: 5,
    effects: [{ kind: 'stat_pct', stat: 'atk', value: 0.04 }],
    desc: 'ATK +4%',
  },
  {
    id: 'tr_magi', tier: 'basic', name: '魔力研鑽', cost: 1, maxLevel: 5,
    effects: [{ kind: 'stat_pct', stat: 'magi_power', value: 0.04 }],
    desc: '魔力 +4%',
  },
  {
    id: 'tr_hp', tier: 'basic', name: '体力増強', cost: 1, maxLevel: 5,
    effects: [{ kind: 'stat_pct', stat: 'hp', value: 0.05 }],
    desc: '最大HP +5%',
  },

  /* ── HPを積む道 (§5.15) ──
   *
   * ── なぜ足りなかったか ──
   * 被ダメージ軽減は 71% ぶんを4ノード41SPで積めるのに、
   * **HP割合を上げる枝は「体力増強」1つ（+25% / 5SP）しか無かった**。
   * 実測すると、素・軽減型・HP変換型のどれもHPが 15,933 で**まったく同じ**になる。
   * 硬さの道が「軽減」の一本しかなく、耐久の作り分けが成立していなかった。
   *
   * ── なぜHPなのか ──
   * 受け皿は既に揃っている。鉄の壁(hp_to_def +0.45)・剛力の理(hp_to_atk +0.12)・
   * 命を刃に(hp_to_atk +0.08)・泰然(high_hp_power +0.45)。
   * **変換先はあるのに変換元を盛れない**状態だった。ここを開けると、
   *   - 反射型が軽減を積まずに耐えられる（軽減は反射量を削るので相性が悪い）
   *   - HP依存のアタッカーという軸が成立する
   * の2つが同時に立ち上がる。
   *
   * 刻みは軽減の梯子（受け流し10SP → 鉄壁不動9SP）に合わせてある。
   */
  {
    id: 'tr_hp_mid', tier: 'mid', name: '巨躯', cost: 2, maxLevel: 5,
    effects: [{ kind: 'stat_pct', stat: 'hp', value: 0.06 }],
    desc: '最大HP +6%',
  },
  {
    id: 'tr_hp_hi', tier: 'high', name: '不倒の躯', cost: 3, maxLevel: 4,
    effects: [{ kind: 'stat_pct', stat: 'hp', value: 0.1 }],
    desc: '最大HP +10%',
  },
  /* ===== 防御で耐える道 (§5.8) =====
   *
   * ── なぜ用意するのか ──
   * 実測すると、素のDEFは Lv255 でも 1,385 しかなく、軽減は5%前後だった。
   * 7割カットに届くには 24,967 が要る。**18倍足りない。**
   *
   * 防御定数を下げるだけでは、敵の攻撃が一律に軽くなって既存のバランスが動く。
   * そこで係数は控えめ（100→40）に留め、**特化したときだけ届く梃子** を置く。
   *
   * 下の3つは掛け算で重なる。全部積んで初めて実用になる重さにしてあり、
   * 片手間に取っても意味が無い。
   */
  {
    id: 'tr_def_wall', tier: 'mid', name: '城壁の心得', cost: 3, maxLevel: 5,
    effects: [{ kind: 'stat_pct', stat: 'def', value: 0.35 }],
    desc: 'DEF +35%（防御で耐える道の入口）',
  },
  {
    id: 'tr_def_fortress', tier: 'high', name: '不落の理', cost: 5, maxLevel: 5,
    effects: [{ kind: 'stat_pct', stat: 'def', value: 0.85 }],
    desc: 'DEF +85%。ここまで積んで、ようやく防御が火力に並ぶ',
  },
  {
    // HPをDEFへ回す。HPは母数が大きいので、変換率が低くても効く。
    // 「命を刃に」の防御版。耐久に寄せた装備がそのままDEFに化ける。
    id: 'tr_hp_to_def', tier: 'high', name: '肉の壁', cost: 4, maxLevel: 5,
    effects: [{ kind: 'hp_to_def', value: 0.09 }],
    desc: '最大HPの 9% をDEFに上乗せする',
  },

  {
    id: 'tr_def', tier: 'basic', name: '防御訓練', cost: 1, maxLevel: 5,
    effects: [{ kind: 'stat_pct', stat: 'def', value: 0.05 }],
    desc: 'DEF +5%',
  },
  {
    id: 'tr_phys1', tier: 'basic', name: '物理の基礎', cost: 1, maxLevel: 4,
    effects: [{ kind: 'tag_bonus', tag: 'phys', value: 0.05 }],
    desc: '[物理]系統 +5%',
  },
  {
    id: 'tr_magi1', tier: 'basic', name: '魔術の基礎', cost: 1, maxLevel: 4,
    effects: [{ kind: 'tag_bonus', tag: 'magi', value: 0.05 }],
    desc: '[魔術]系統 +5%',
  },
  {
    id: 'tr_reli1', tier: 'basic', name: '遺物の基礎', cost: 1, maxLevel: 4,
    effects: [{ kind: 'tag_bonus', tag: 'reli', value: 0.05 }],
    desc: '[遺物]系統 +5%',
  },
  {
    id: 'tr_slot_acc', tier: 'basic', name: '装飾の心得', cost: 3, maxLevel: 1,
    effects: [{ kind: 'slot', slot: 'accessory', value: 1 }],
    desc: 'アクセサリー枠 最大2',
  },
  {
    id: 'tr_regen', tier: 'basic', name: '治癒の心得', cost: 1, maxLevel: 5,
    effects: [{ kind: 'regen', value: 0.015 }],
    desc: 'ラウンド終了時に最大HPの1.5%を回復',
  },
  {
    id: 'tr_lifesteal', tier: 'basic', name: '吸命', cost: 1, maxLevel: 5,
    effects: [{ kind: 'lifesteal', value: 0.02 }],
    desc: '与えたダメージの2%をHPへ還元',
  },
  {
    id: 'tr_grant_rally', tier: 'basic', name: '鼓舞の号令', cost: 2, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_rally', value: 1 }],
    desc: 'アクティブ技「鼓舞の号令」を習得（全体に固有バフ+40%）',
  },
  {
    id: 'tr_opening', tier: 'basic', name: '先手の気構え', cost: 1, maxLevel: 3,
    effects: [{ kind: 'opening_buff', value: 0.12 }],
    effectDesc: '戦闘開始時に固有バフ',
    desc: '戦闘開始時、3ターンの間 固有ユニークバフ+12%',
  },
  {
    id: 'tr_first_round', tier: 'basic', name: '奇襲', cost: 1, maxLevel: 4,
    effects: [{ kind: 'first_round_power', value: 0.10 }],
    desc: '1ラウンド目の与ダメージ +10%',
  },
  {
    id: 'tr_wave_heal', tier: 'basic', name: '息継ぎ', cost: 1, maxLevel: 4,
    effects: [{ kind: 'wave_heal', value: 0.04 }],
    desc: '次のウェーブに進むとき 最大HPの4%回復',
  },
  {
    // 返すのは **相手の** 最大HPの割合。説明が「自分の最大HP」になっていて
    // 実装と食い違っており、弱く見積もられていた（実測 1,334 対 12,306）。
    //
    // 割合で削るので、硬い相手ほど効く。ただし1発では通常攻撃に遠く及ばない。
    // 殴られる回数で稼ぐ性質なので、1発あたりを上げるより
    // 「被弾が多いほど積み上がる」形に寄せてある。
    id: 'tr_thorns', tier: 'basic', name: '棘の外皮', cost: 1, maxLevel: 4,
    effects: [{ kind: 'thorns', value: 0.035 }],
    desc: '被弾するたび、相手の最大HPの3.5%のダメージ（硬い相手ほど効く）',
  },

  /* ======================= 中級 ======================= */
  {
    id: 'tr_phys2', tier: 'mid', name: '物理の練達', cost: 2, maxLevel: 5,
    effects: [{ kind: 'tag_bonus', tag: 'phys', value: 0.08 }],
    desc: '[物理]系統 +8%',
  },
  {
    id: 'tr_magi2', tier: 'mid', name: '魔術の練達', cost: 2, maxLevel: 5,
    effects: [{ kind: 'tag_bonus', tag: 'magi', value: 0.08 }],
    desc: '[魔術]系統 +8%',
  },
  {
    id: 'tr_reli2', tier: 'mid', name: '遺物の練達', cost: 2, maxLevel: 5,
    effects: [{ kind: 'tag_bonus', tag: 'reli', value: 0.08 }],
    desc: '[遺物]系統 +8%',
  },
  {
    id: 'tr_crit', tier: 'mid', name: '一点集中', cost: 1, maxLevel: 5,
    effects: [{ kind: 'crit', value: 0.03 }],
    desc: 'クリティカル率 +3%',
  },
  {
    id: 'tr_slot_armor', tier: 'mid', name: '重装の心得', cost: 4, maxLevel: 1,
    effects: [{ kind: 'slot', slot: 'armor', value: 1 }],
    desc: '防具枠 最大2',
  },
  {
    id: 'tr_crit_dmg', tier: 'mid', name: '痛打', cost: 2, maxLevel: 5,
    effects: [{ kind: 'crit_damage', value: 0.15 }],
    desc: 'クリティカル倍率 +0.15（1.5倍 → 最大2.25倍）',
  },
  {
    // 中技に無条件で効く唯一の支援 (§5.8)。
    // この帯の他の2つ（弱体・コンボ）は「属性有利か弱体中」を要求するので、
    // 相手を選ばずに効くものが1つも無かった。
    // 会心はそこを埋めると同時に、crit_combo → 弱点コンボへの着火点になる。
    id: 'tr_mid_crit', tier: 'mid', name: '技巧', cost: 2, maxLevel: 5,
    effects: [{ kind: 'mid_power_crit', value: 0.06 }],
    desc: '中技のクリティカル率 +6%',
  },
  {
    // 会心率の行き場 (§5.8)。
    // 100%を超えたぶんはそれまで捨てられていた。とくに元から会心率1.00の技
    // （終焉の一撃・二閃）では、会心率の投資がまるごと無駄になっていた。
    id: 'tr_crit_overflow', tier: 'high', name: '極点', cost: 3, maxLevel: 3,
    effects: [{ kind: 'crit_overflow', value: 0.25 }],
    desc: '会心率が100%を超えたぶん×25% をクリティカル倍率へ上乗せ',
  },
  {
    id: 'tr_execute', tier: 'mid', name: '追い打ち', cost: 2, maxLevel: 5,
    effects: [{ kind: 'execute', value: 0.12 }],
    desc: '相手のHPが減っているほど威力上昇（瀕死時 最大+60%）',
  },
  {
    id: 'tr_guard', tier: 'mid', name: '受け流し', cost: 2, maxLevel: 5,
    effects: [{ kind: 'reduction', value: 0.04 }],
    desc: '被ダメージ軽減 +4%',
  },
  {
    id: 'tr_counter', tier: 'mid', name: '反撃の構え', cost: 2, maxLevel: 3,
    effects: [{ kind: 'counter', value: 0.15, power: 0.7 }],
    desc: '被弾時 15% の確率で威力70%の反撃',
  },
  {
    id: 'tr_grant_triple', tier: 'mid', name: '連撃の型', cost: 3, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_triple', value: 1 }],
    desc: 'アクティブ技「三連の型」を習得（威力65%×3回）',
  },
  /* 新しい軸の技を配る枝 (§9.1)。
     効果そのものは戦闘エンジン側にあるので、ここは入口を開けるだけ。 */
  {
    id: 'tr_grant_mark', tier: 'mid', name: '狙いの型', cost: 3, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_focus_fire', value: 1 }],
    desc: 'アクティブ技「狙い撃ちの号」を習得（味方全員のその敵への火力 +35%）',
  },
  {
    id: 'tr_grant_mark_all', tier: 'high', name: '狩りの采配', cost: 5, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_hunters_call', value: 1 }],
    desc: 'アクティブ技「狩りの合図」を習得（敵全体に照準 +18%）',
  },
  {
    id: 'tr_grant_sigil', tier: 'mid', name: '刻印の型', cost: 3, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_sigil_edge', value: 1 }],
    desc: 'アクティブ技「刻印刃」を習得（刻印を2つ刻む）',
  },
  {
    id: 'tr_grant_tempo', tier: 'high', name: '前借りの型', cost: 4, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_stolen_tempo', value: 1 }],
    desc: 'アクティブ技「刻の前借り」を習得（もう一度動く代わりに次を失う）',
  },
  {
    id: 'tr_grant_rot', tier: 'high', name: '腐蝕の型', cost: 4, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_embrace_the_rot', value: 1 }],
    desc: 'アクティブ技「腐蝕の受容」を習得（自分に毒と呪詛を受け入れて殴る）',
  },
  {
    id: 'tr_grant_drain', tier: 'mid', name: '奪命の術', cost: 3, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_drain', value: 1 }],
    desc: 'アクティブ技「生命奪取」を習得（与ダメージの40%を吸収）',
  },
  {
    id: 'tr_low_hp', tier: 'mid', name: '背水', cost: 2, maxLevel: 5,
    effects: [{ kind: 'low_hp_power', value: 0.16 }],
    desc: '自分のHPが減っているほど威力上昇（瀕死時 最大+80%）',
  },
  {
    id: 'tr_high_hp', tier: 'mid', name: '万全', cost: 2, maxLevel: 5,
    effects: [{ kind: 'high_hp_power', value: 0.09 }],
    desc: '自分のHPが多いほど威力上昇（満タン時 最大+45%）',
  },
  {
    id: 'tr_boss_slayer', tier: 'mid', name: '巨獣狩り', cost: 2, maxLevel: 5,
    effects: [{ kind: 'boss_slayer', value: 0.10 }],
    desc: 'ボスへの与ダメージ +10%',
  },
  {
    id: 'tr_debuff_amp', tier: 'mid', name: '追い討ち', cost: 2, maxLevel: 5,
    effects: [{ kind: 'debuff_amp', value: 0.10 }],
    desc: '状態異常や防御崩壊を受けている敵への与ダメージ +10%',
  },
  {
    id: 'tr_guard_break', tier: 'mid', name: '防御崩し', cost: 2, maxLevel: 4,
    effects: [{ kind: 'guard_break', value: 0.09 }],
    desc: '攻撃するたび 9% の確率で相手の防御を無視する',
  },
  {
    id: 'tr_pierce', tier: 'mid', name: '属性貫通', cost: 2, maxLevel: 4,
    effects: [{ kind: 'element_pierce', value: 0.25 }],
    desc: '不利属性の0.5倍を等倍側へ寄せ、さらに不利な相手への威力を上げる' +
      '（Lv4で不利を完全に無効化し、その相手に1.6倍）',
  },
  {
    id: 'tr_grant_storm', tier: 'mid', name: '嵐の型', cost: 3, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_storm', value: 1 }],
    desc: 'アクティブ技「乱れ撃ち」を習得（敵全体に威力90%）',
  },
  {
    id: 'tr_grant_hex', tier: 'mid', name: '呪詛の心得', cost: 3, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_hex', value: 1 }],
    desc: 'アクティブ技「万呪」を習得（防御崩壊＋毒＋弱体をまとめて付与）',
  },
  // 特化型: 有利属性の倍率を 1.5 → 2.5 まで引き上げる (§5.4)
  {
    id: 'tr_mastery_fire', tier: 'mid', name: '火の極意', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_mastery', element: 'fire', value: 0.2 }],
    desc: '火属性で有利なとき 1.5倍 → +0.2倍（全属性適応Lv2で有利になった攻撃にも乗る）',
  },
  {
    id: 'tr_mastery_water', tier: 'mid', name: '水の極意', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_mastery', element: 'water', value: 0.2 }],
    desc: '水属性で有利なとき 1.5倍 → +0.2倍（全属性適応Lv2で有利になった攻撃にも乗る）',
  },
  {
    id: 'tr_mastery_wind', tier: 'mid', name: '風の極意', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_mastery', element: 'wind', value: 0.2 }],
    desc: '風属性で有利なとき 1.5倍 → +0.2倍（全属性適応Lv2で有利になった攻撃にも乗る）',
  },
  {
    id: 'tr_mastery_earth', tier: 'mid', name: '土の極意', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_mastery', element: 'earth', value: 0.2 }],
    desc: '土属性で有利なとき 1.5倍 → +0.2倍（全属性適応Lv2で有利になった攻撃にも乗る）',
  },
  {
    id: 'tr_mastery_light', tier: 'mid', name: '光の極意', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_mastery', element: 'light', value: 0.2 }],
    desc: '光属性で有利なとき 1.5倍 → +0.2倍（全属性適応Lv2で有利になった攻撃にも乗る）',
  },
  {
    id: 'tr_mastery_dark', tier: 'mid', name: '闇の極意', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_mastery', element: 'dark', value: 0.2 }],
    desc: '闇属性で有利なとき 1.5倍 → +0.2倍（全属性適応Lv2で有利になった攻撃にも乗る）',
  },

  /* ======================= 上級 ======================= */
  {
    id: 'tr_all_tag', tier: 'high', name: '三系統掌握', cost: 3, maxLevel: 3,
    effects: [{ kind: 'tag_all', value: 0.06 }],
    desc: '[物理][魔術][遺物] すべて +6%（異タグは乗算されるため伸びが大きい）',
  },
  {
    // 上限突破は「大技を選ぶ理由」そのもの (§3.2 ステップ8)。
    //
    // 実測: 最大強化のビルドで威力620%の技は素で 1,241,220 出るが、
    // 上限50万に潰されて 574,684 まで落ちる。中技150%との差が
    // 威力どおりの4.1倍から **1.90倍** まで縮み、大技を撃つ意味が消える。
    // 突破を +192% まで積むと素の値がそのまま通り、4.10倍が戻る。
    // それ以上は伸びない（既に上限を抜けているため）ので、
    // ツリー側で +96%、クラス側で +96% を上限として、合わせて到達できるようにした。
    id: 'tr_cap', tier: 'high', name: '限界超越', cost: 2, maxLevel: 12,
    effects: [{ kind: 'cap_break', value: 0.08 }],
    desc: 'ダメージ上限突破 +8%（大技ほど恩恵が大きい）',
  },
  {
    id: 'tr_slot_weapon', tier: 'high', name: '二刀の極致', cost: 6, maxLevel: 1,
    effects: [{ kind: 'slot', slot: 'weapon', value: 1 }],
    desc: '武器枠 最大2（実質二刀流）',
  },
  /* ===== 状態異常・支援の入口 (§5.6) ===== */
  {
    id: 'tr_status_power', tier: 'basic', name: '毒の心得', cost: 2, maxLevel: 5,
    effects: [{ kind: 'status_power', value: 0.2 }],
    desc: '自分が与える継続ダメージの割合 +20%',
  },
  /* 自分にかかる弱体の符号を反転させる枝。
     ここまで自傷は損でしかなかったので、耐性を積む道とは正面から反対を向く。 */
  {
    id: 'tr_self_curse', tier: 'mid', name: '業を背負う', cost: 4, maxLevel: 4,
    effects: [{ kind: 'self_curse_power', value: 0.10 }],
    desc: '自分にかかっている弱体1つにつき火力 +10%',
  },
  /* 殴った回数で進む遅延ダメージ。毒（時間で進む）とは溜まり方が違う。 */
  {
    id: 'tr_sigil', tier: 'mid', name: '刻印を刻む', cost: 3, maxLevel: 4,
    effects: [{ kind: 'sigil_burst', value: 0.025 }],
    desc: '攻撃するたび刻印が1つ積み、3つで弾けて相手の最大HPの2.5%が入る',
  },
  /* ── 新しい5軸 (§5.9) ──
     どれも「読む口が無かった場所」に作ったもの。
     既存の枝の数値違いにならないよう、効き方が裏返るものを選んである。 */
  {
    // 軽減が割合で減らすのに対し、これは丸ごと通さない。
    // 1発が重い相手ほど効き、手数で押す相手には薄い。
    id: 'tr_evade', tier: 'mid', name: '見切り', cost: 3, maxLevel: 4,
    effects: [{ kind: 'evade', value: 0.05 }],
    desc: '攻撃を5%の確率で丸ごと回避する',
  },
  {
    // 「同じ技」でも「違う技」でもなく **同じ相手** を見る。
    // 的を替えないことに価値が付くので、全体攻撃とは反対を向く。
    id: 'tr_focus', tier: 'mid', name: '執着', cost: 2, maxLevel: 4,
    effects: [{ kind: 'focus_power', value: 0.08 }],
    desc: '同じ相手を続けて狙うほど火力が上がる（1回続けるごとに +8%）',
  },
  {
    // 他の味方が何をしたかを見る、初めての効果。
    // 編成と行動順そのものが火力になる。
    id: 'tr_relay', tier: 'mid', name: '継ぎ手', cost: 3, maxLevel: 3,
    effects: [{ kind: 'relay_power', value: 0.10 }],
    desc: '直前に動いた味方と違う系統で攻めると火力 +10%',
  },
  {
    // 回復が「穴埋め」から「攻めの下ごしらえ」に変わる。
    id: 'tr_mend_power', tier: 'mid', name: '恩返し', cost: 2, maxLevel: 4,
    effects: [{ kind: 'mend_power', value: 0.15 }],
    desc: '受けた回復の量だけ火力が上がる（最大HPと同じだけ受けて +15%）',
  },
  {
    // クラス技は CT で撃てる回数が決まる。1縮むと1戦の手が1つ増える。
    id: 'tr_cooldown', tier: 'high', name: '巡りを早める', cost: 5, maxLevel: 2,
    effects: [{ kind: 'cooldown_cut', value: 1 }],
    desc: 'クラス技のクールタイムが1ラウンド短くなる',
  },
  {
    id: 'tr_debuff_len', tier: 'basic', name: '呪詛の心得', cost: 3, maxLevel: 2,
    effects: [{ kind: 'debuff_duration', value: 1 }],
    desc: '自分が与えるデバフの持続 +1ターン',
  },
  {
    id: 'tr_debuff_resist', tier: 'basic', name: '精神耐性', cost: 2, maxLevel: 3,
    effects: [{ kind: 'debuff_resist', value: 1 }],
    desc: '自分が受けるデバフの持続 -1ターン（0以下なら無効化）',
  },
  {
    id: 'tr_stable', tier: 'basic', name: '据わった腕', cost: 2, maxLevel: 4,
    effects: [{ kind: 'stable_damage', value: 0.25 }],
    desc: 'ダメージの揺らぎを25%狭める（Lv4で完全に安定）',
  },
  {
    id: 'tr_foe_count', tier: 'basic', name: '群狼の理', cost: 3, maxLevel: 3,
    effects: [{ kind: 'foe_count_power', value: 0.06 }],
    desc: '生きている敵1体につき威力 +6%',
  },
  {
    id: 'tr_lone_foe', tier: 'basic', name: '一騎討ち', cost: 3, maxLevel: 3,
    effects: [{ kind: 'lone_foe_power', value: 0.15 }],
    desc: '敵が1体だけのとき威力 +15%',
  },
  {
    id: 'tr_ambush', tier: 'basic', name: '奇襲の心得', cost: 3, maxLevel: 3,
    effects: [{ kind: 'ambush', value: 0.2 }],
    desc: '1ラウンド目に 20% の確率でもう一度行動する',
  },
  {
    id: 'tr_crit_heal', tier: 'basic', name: '血の宴', cost: 2, maxLevel: 4,
    effects: [{ kind: 'crit_heal', value: 0.08 }],
    desc: '会心で与えたダメージの 8% を吸収する',
  },
  {
    id: 'tr_grant_pierce_shot', tier: 'basic', name: '貫きの型', cost: 3, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_pierce_shot', value: 1 }],
    desc: 'アクティブ技「穿孔弾」を習得（威力80%・防御無視の小技）',
  },
  {
    id: 'tr_grant_bastion_cry', tier: 'basic', name: '守りの型', cost: 3, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_bastion_cry', value: 1 }],
    desc: 'アクティブ技「守りの号令」を習得（味方全体の被ダメージを軽減）',
  },
  /* ===== 戦況を読む中級 (§5.6) ===== */
  {
    id: 'tr_wave_stack', tier: 'mid', name: '連戦の熱', cost: 4, maxLevel: 3,
    effects: [{ kind: 'wave_stack', value: 0.08 }],
    desc: 'ウェーブを越えるごとに威力 +8%（連戦ほど強い）',
  },
  {
    id: 'tr_overheal', tier: 'mid', name: '癒しの余剰', cost: 3, maxLevel: 3,
    effects: [{ kind: 'overheal_shield', value: 0.4 }],
    desc: '回復のあふれたぶんの 40% が障壁になる',
  },
  {
    id: 'tr_guard_ally', tier: 'mid', name: '盾となる者', cost: 4, maxLevel: 3,
    effects: [{ kind: 'guard_ally', value: 0.15 }],
    desc: '味方が受けるダメージの 15% を肩代わりする',
  },
  {
    // 実測（Lv240・竜箱300個）: HP 16,675 / DEF 1,361 で、HPはDEFの12.3倍ある。
    // そのため 20% の変換でも +3,335 になり、「守りを刃に」の 60%変換（+817）より
    // 4倍強い。**HPスケールが弱いのではなく、弱いのは棘のほうだった。**
    // ここは触らない。
    id: 'tr_hp_to_atk', tier: 'mid', name: '命を刃に', cost: 4, maxLevel: 4,
    effects: [{ kind: 'hp_to_atk', value: 0.02 }],
    desc: '最大HPの 2% を攻撃力と魔力に上乗せする',
  },
  {
    id: 'tr_crit_combo', tier: 'mid', name: '会心連鎖', cost: 4, maxLevel: 2,
    effects: [{ kind: 'crit_combo', value: 1 }],
    desc: '会心のたびに弱点コンボが1段多く積まれる',
  },
  {
    id: 'tr_convert_fire', tier: 'mid', name: '紅蓮の誓い', cost: 4, maxLevel: 1,
    effects: [{ kind: 'element_convert', element: 'fire' }],
    desc: 'すべての攻撃が火属性になる（極意と噛み合わせる用）',
  },
  {
    id: 'tr_convert_water', tier: 'mid', name: '蒼海の誓い', cost: 4, maxLevel: 1,
    effects: [{ kind: 'element_convert', element: 'water' }],
    desc: 'すべての攻撃が水属性になる',
  },
  {
    id: 'tr_convert_wind', tier: 'mid', name: '疾風の誓い', cost: 4, maxLevel: 1,
    effects: [{ kind: 'element_convert', element: 'wind' }],
    desc: 'すべての攻撃が風属性になる',
  },
  {
    id: 'tr_convert_earth', tier: 'mid', name: '大地の誓い', cost: 4, maxLevel: 1,
    effects: [{ kind: 'element_convert', element: 'earth' }],
    desc: 'すべての攻撃が土属性になる',
  },
  {
    id: 'tr_grant_venom', tier: 'mid', name: '毒撒きの型', cost: 4, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_venom', value: 1 }],
    desc: 'アクティブ技「腐蝕の霧」を習得（敵全体に毒）',
  },
  // 継続ダメージは1刻みが最大HPの数%で、通常攻撃の3〜4割にあたる。
  // 数字は悪くないのに、戦闘が3〜5ラウンドで終わるので満期まで待てない。
  // この2つは「待つ」を「弱体を全部失う」に置き換える出口 (§5.8)。
  {
    id: 'tr_grant_detonate', tier: 'mid', name: '起爆の型', cost: 4, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_detonate', value: 1 }],
    desc: 'アクティブ技「疫斃」を習得（弱体を消して残りターンぶんを即座に与える）',
  },
  {
    id: 'tr_grant_plague_burst', tier: 'high', name: '広域起爆の型', cost: 5, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_plague_burst', value: 1 }],
    desc: 'アクティブ技「疫斃・広域」を習得（敵全体を起爆）',
  },
  {
    id: 'tr_grant_bulwark', tier: 'mid', name: '城塞の型', cost: 4, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_bulwark', value: 1 }],
    desc: 'アクティブ技「城塞」を習得（自分の防御を大きく上げる）',
  },
  {
    id: 'tr_grant_snipe', tier: 'mid', name: '狙撃の型', cost: 4, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_snipe', value: 1 }],
    desc: 'アクティブ技「狙撃」を習得（会心率の非常に高い単体攻撃）',
  },
  /* ===== 極端に振る上級 (§5.6) ===== */
  {
    id: 'tr_convert_light', tier: 'high', name: '聖光の誓い', cost: 5, maxLevel: 1,
    effects: [{ kind: 'element_convert', element: 'light' }],
    desc: 'すべての攻撃が光属性になる',
  },
  {
    id: 'tr_convert_dark', tier: 'high', name: '深淵の誓い', cost: 5, maxLevel: 1,
    effects: [{ kind: 'element_convert', element: 'dark' }],
    desc: 'すべての攻撃が闇属性になる',
  },
  {
    id: 'tr_hp_to_atk_hi', tier: 'high', name: '血肉の理', cost: 6, maxLevel: 3,
    effects: [{ kind: 'hp_to_atk', value: 0.04 }],
    desc: '最大HPの 4% を攻撃力と魔力に上乗せする',
  },
  {
    id: 'tr_wave_stack_hi', tier: 'high', name: '不滅の勢い', cost: 6, maxLevel: 2,
    effects: [{ kind: 'wave_stack', value: 0.15 }],
    desc: 'ウェーブを越えるごとに威力 +15%',
  },
  {
    id: 'tr_taunt_hi', tier: 'high', name: '一身に受ける', cost: 6, maxLevel: 2,
    effects: [{ kind: 'taunt', value: 0.8 },
              { kind: 'counter', value: 0.15 }],
    // 狙いを極めた先に反撃を置く。集めた攻撃がそのまま手数に変わる。
    desc: '狙われやすさ +80%／反撃率 +15%。集めた攻撃を撃ち返す構えの終点',
  },
  {
    id: 'tr_smite_hi', tier: 'high', name: '審判', cost: 5, maxLevel: 3,
    effects: [{ kind: 'smite', value: 0.22 }],
    desc: '回復したとき、その量の 22% が敵1体へダメージになる',
  },
  {
    id: 'tr_heal_to_power_hi', tier: 'high', name: '神官戦士の理', cost: 6, maxLevel: 3,
    effects: [{ kind: 'heal_to_power', value: 0.05 },
              { kind: 'lifesteal', value: 0.03 }],
    desc: '「与える回復量」の伸びの 5% ぶん火力／吸命 +3%',
  },
  {
    id: 'tr_mend_hi', tier: 'high', name: '報恩', cost: 5, maxLevel: 3,
    effects: [{ kind: 'mend_power', value: 0.2 }],
    desc: '受けた回復量による火力 +20%。再生でも吸命でも積める',
  },
  {
    id: 'tr_heal_power_hi', tier: 'high', name: '大慈', cost: 5, maxLevel: 3,
    effects: [{ kind: 'heal_power', value: 0.18 }],
    desc: '自分が行う回復量 +18%',
  },
  {
    id: 'tr_regen_hi', tier: 'high', name: '命脈', cost: 4, maxLevel: 4,
    effects: [{ kind: 'regen', value: 0.03 }],
    desc: '毎ラウンド、最大HPの 3% 回復する',
  },
  {
    id: 'tr_low_hp_heal_hi', tier: 'high', name: '瀬戸際の腕', cost: 5, maxLevel: 3,
    effects: [{ kind: 'low_hp_heal', value: 0.06 }],
    desc: 'ラウンド終了時、HPが半分を切った味方を最大HPの 6% 回復する',
  },
  {
    id: 'tr_round_buff_hi', tier: 'high', name: '不断の号令', cost: 6, maxLevel: 3,
    effects: [{ kind: 'round_buff', value: 0.05 }],
    desc: 'ラウンド開始時、味方全体に固有バフ +5%（1ターン）',
  },
  {
    id: 'tr_buff_shield_hi', tier: 'high', name: '不壊の言葉', cost: 5, maxLevel: 3,
    effects: [{ kind: 'buff_shield', value: 0.08 }],
    desc: 'バフをかけた相手に、その相手の最大HPの 8% の障壁',
  },
  {
    id: 'tr_buff_heal_hi', tier: 'high', name: '熱を分かつ', cost: 5, maxLevel: 3,
    effects: [{ kind: 'buff_heal', value: 0.06 }],
    desc: 'バフをかけた相手を、その相手の最大HPの 6% 回復する',
  },
  {
    id: 'tr_triage_hi', tier: 'high', name: '瀬戸際', cost: 5, maxLevel: 3,
    effects: [{ kind: 'triage', value: 0.35 },
              { kind: 'crit_heal', value: 0.08 }],
    desc: '瀕死の相手への回復量 +35%／回復の会心率 +8%',
  },
  {
    id: 'tr_cleanse_hi', tier: 'high', name: '清明', cost: 5, maxLevel: 2,
    effects: [{ kind: 'cleanse', value: 0.4 },
              { kind: 'debuff_resist', value: 1 }],
    desc: '回復したとき 40% で弱体を1つ解く／受ける弱体の持続 -1ターン',
  },
  {
    id: 'tr_heal_buff_hi', tier: 'high', name: '祝祭', cost: 5, maxLevel: 3,
    effects: [{ kind: 'heal_buff', value: 0.18 }],
    desc: '回復した相手に固有バフ +18%（2ターン）',
  },
  {
    id: 'tr_support_stack_hi', tier: 'high', name: '万雷の連なり', cost: 5, maxLevel: 3,
    effects: [{ kind: 'support_stack', value: 0.06 }],
    desc: 'バフをかけるたび、自分がかけるバフの効果量 +6%（その戦闘のあいだ）',
  },
  {
    id: 'tr_self_buff_hi', tier: 'high', name: '一人の軍', cost: 6, maxLevel: 3,
    effects: [{ kind: 'self_buff_power', value: 0.14 }],
    desc: '自分にかけるバフの効果量 +14%',
  },
  {
    id: 'tr_ally_buff_hi', tier: 'high', name: '万軍の旗', cost: 6, maxLevel: 3,
    effects: [{ kind: 'ally_buff_power', value: 0.28 }],
    desc: '味方にかけるバフの効果量 +28%',
  },
  {
    id: 'tr_opening_hi', tier: 'high', name: '開戦の号砲', cost: 5, maxLevel: 3,
    effects: [{ kind: 'opening_buff', value: 0.14 }],
    // 時間軸の対比 (§5.12)。開幕から持っている型と、重ねて伸ばす型。
    // 短い戦闘なら前者、長引くなら後者が勝つ。
    desc: '戦闘開始時から固有バフ +14% を持って始まる',
  },
  {
    id: 'tr_buff_kill_hi', tier: 'high', name: '連戦の勢い', cost: 5, maxLevel: 3,
    effects: [{ kind: 'buff_on_kill', value: 0.12 }],
    desc: '敵を倒すたびに固有バフ +12%',
  },
  {
    id: 'tr_buff_extend_hi', tier: 'high', name: '不朽の号令', cost: 6, maxLevel: 2,
    effects: [{ kind: 'buff_extend', value: 1 },
              { kind: 'buff_power', value: 0.1 }],
    desc: '自分がかけるバフの持続 +1ターン／効果量 +10%',
  },
  {
    id: 'tr_buff_power_hi', tier: 'high', name: '万雷の号令', cost: 5, maxLevel: 3,
    effects: [{ kind: 'buff_power', value: 0.2 }],
    desc: '自分がかけるバフの効果量 +20%',
  },
  {
    id: 'tr_guard_ally_hi', tier: 'high', name: '不動の盾', cost: 6, maxLevel: 2,
    effects: [{ kind: 'guard_ally', value: 0.2 }],
    desc: '味方が受けるダメージの 20% を肩代わりする',
  },
  {
    id: 'tr_grant_judgment', tier: 'high', name: '裁きの型', cost: 7, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_judgment', value: 1 }],
    desc: 'アクティブ技「断罪」を習得（HPが減った敵ほど大ダメージ）',
  },
  {
    id: 'tr_grant_sanctuary', tier: 'high', name: '聖域の型', cost: 7, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_sanctuary', value: 1 }],
    desc: 'アクティブ技「聖域」を習得（味方全体を大きく回復し障壁を張る）',
  },
  // 小技の使い道 (§4.3)。
  // 強い技を1つ覚えると下位の攻撃技が死に技になるので、
  // 「威力が低いこと自体が条件になる」効果をここに集めている。
  // ── 中技の使い道 (§5.8) ──
  //
  // 攻撃技89個のうち **44個** が威力101〜199%の帯にあるのに、
  // この帯を伸ばす手段が1つも無かった。小技には5系統、大技には
  // 上限突破がある一方で、いちばん数の多い帯だけが素通りされていた。
  //
  // ここに火力を足しても住み分けにならない（結局どちらかの下位互換になる）ので、
  // **効果を通す側** を持たせた。弱体を確実に入れ、コンボを繋ぐのが中技の仕事。
  {
    id: 'tr_mid_status', tier: 'mid', name: '浸透の心得', cost: 2, maxLevel: 5,
    effects: [{ kind: 'mid_power_status', value: 0.4 }],
    desc: '威力101〜199%の技で攻撃したとき、弱体の付与率 +40%（重い技にも軽い技にも乗らない）',
  },
  {
    id: 'tr_mid_combo', tier: 'high', name: '連環の理', cost: 3, maxLevel: 3,
    effects: [{ kind: 'mid_power_combo', value: 1 }],
    desc: '威力101〜199%の技で弱点コンボを積むとき、段数 +1（繋ぎ役に徹する編成が成立する）',
  },
  {
    id: 'tr_low_boost', tier: 'basic', name: '手数の心得', cost: 2, maxLevel: 5,
    effects: [{ kind: 'low_power_boost', value: 0.12 }],
    desc: '威力100%以下の技の威力 +12%（強い技には乗らない）',
  },
  {
    id: 'tr_low_auto', tier: 'mid', name: '追撃の型', cost: 3, maxLevel: 4,
    effects: [{ kind: 'auto_low_skill', value: 0.18 }],
    desc: '攻撃したあと 18% の確率で、持っている威力100%以下の技が自動で飛ぶ',
  },
  {
    id: 'tr_low_spread', tier: 'mid', name: '拡散の型', cost: 4, maxLevel: 1,
    effects: [{ kind: 'low_power_spread', value: 1 }],
    desc: '威力100%以下の単体技が敵全体に当たるようになる',
  },
  {
    id: 'tr_low_repeat', tier: 'high', name: '連射の極致', cost: 5, maxLevel: 2,
    effects: [{ kind: 'low_power_repeat', value: 1 }],
    desc: '威力100%以下の技が1回多く発動する',
  },
  {
    id: 'tr_grant_burst', tier: 'high', name: '全弾解放の理', cost: 6, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_burst', value: 1 }],
    desc: 'アクティブ技「全弾解放」を習得（全攻撃技を同時発動、反動で数ラウンド行動不能）',
  },
  // 万能型: どのエリアでも安定周回できるが、他の火力を犠牲にする (§5.4)
  {
    id: 'tr_adapt', tier: 'high', name: '全属性適応', cost: 5, maxLevel: 2,
    effects: [{ kind: 'element_adapt', value: 1 }],
    desc: 'Lv1: 不利属性を等倍に無効化 ／ Lv2: 全攻撃を有利1.5倍として扱う' +
      '（無属性どうしの等倍にも効く。「○○の極意」とも重なる）',
  },
  {
    id: 'tr_fortress', tier: 'high', name: '金剛不壊', cost: 3, maxLevel: 3,
    effects: [{ kind: 'reduction', value: 0.08 }],
    desc: '被ダメージ軽減 +8%（他の軽減と合計100%で無敵）',
  },
  {
    id: 'tr_extra', tier: 'high', name: '刹那の見切り', cost: 4, maxLevel: 3,
    effects: [{ kind: 'extra_action', value: 0.08 }],
    desc: '行動後 8% の確率でもう一度行動できる',
  },
  {
    id: 'tr_revive', tier: 'high', name: '不死鳥の理', cost: 6, maxLevel: 1,
    effects: [{ kind: 'revive', value: 0.5 }],
    desc: '戦闘不能になっても1戦闘に1度だけ、HP50%で復帰する',
  },
  {
    id: 'tr_grant_ruin', tier: 'high', name: '渾天の極み', cost: 5, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_ruin', value: 1 }],
    desc: 'アクティブ技「渾天撃」を習得（[遺物]無属性・威力320%）',
  },
  {
    id: 'tr_grant_bastion', tier: 'high', name: '不動の構え', cost: 5, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_bastion', value: 1 }],
    desc: 'アクティブ技「不動明王」を習得（全体の被ダメージを3ターン40%軽減）',
  },
  {
    id: 'tr_double', tier: 'high', name: '双撃の理', cost: 8, maxLevel: 1,
    effects: [
      { kind: 'double_hits', value: 1 },
      { kind: 'stat_pct', stat: 'atk', value: -0.30 },
    ],
    desc: '攻撃技が必ず2回発動する。ただしATK -30%',
  },
  {
    id: 'tr_chain', tier: 'high', name: '波及', cost: 4, maxLevel: 3,
    effects: [{ kind: 'chain', value: 0.13 }],
    desc: '単体攻撃の余波が他の敵にも威力13%で及ぶ',
  },
  {
    id: 'tr_last_stand', tier: 'high', name: '不屈', cost: 5, maxLevel: 1,
    effects: [{ kind: 'last_stand', value: 0.6 }],
    desc: '致死ダメージを60%の確率でHP1で耐える（1戦闘に1回）',
  },
  {
    id: 'tr_thorns_hi', tier: 'high', name: '鉄条の鎧', cost: 3, maxLevel: 3,
    effects: [{ kind: 'thorns', value: 0.05 }],
    desc: '被弾するたび、相手の最大HPの5%のダメージ',
  },
  {
    id: 'tr_grant_sacrifice', tier: 'high', name: '生命代償', cost: 5, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_sacrifice', value: 1 }],
    desc: 'アクティブ技「命賭けの一撃」を習得（HPを支払い、支払った量ぶん威力が跳ね上がる）',
  },
  // 無属性ゴリ押し: 属性パズルを無視して暴力で解決する (§5.4)
  {
    id: 'tr_chaos', tier: 'high', name: '混沌の力', cost: 5, maxLevel: 1,
    effects: [
      { kind: 'chaos', value: 1 },
      { kind: 'stat_pct', stat: 'atk', value: 0.5 },
    ],
    desc: '全攻撃を無属性に固定し、ATK +50%',
  },

  /* ===================================================================
   * §5.7 拡張分
   *
   * 初級を「浅く広く選べる場所」にするのが狙い。
   * 属性ごと・隊列ごと・戦況ごとに小さな枝を並べてあるので、
   * 序盤から自分の戦い方に合う方向へ寄せられる。
   * =================================================================== */

  /* ===== 属性ごとの心得 (§5.7) =====
   * 「極意」(中級) が有利倍率そのものを引き上げるのに対し、
   * こちらは相性と無関係な別枠の上乗せ。等倍・不利の相手にも乗るので、
   * 「この属性で殴り続ける」ビルドの土台になる。 */
  {
    id: 'tr_power_fire', tier: 'basic', name: '紅蓮の心得', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_power', element: 'fire', value: 0.05 }],
    desc: '火属性の攻撃 威力+5%（属性相性とは別枠）',
  },
  {
    id: 'tr_power_water', tier: 'basic', name: '蒼波の心得', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_power', element: 'water', value: 0.05 }],
    desc: '水属性の攻撃 威力+5%（属性相性とは別枠）',
  },
  {
    id: 'tr_power_wind', tier: 'basic', name: '疾風の心得', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_power', element: 'wind', value: 0.05 }],
    desc: '風属性の攻撃 威力+5%（属性相性とは別枠）',
  },
  {
    id: 'tr_power_earth', tier: 'basic', name: '岩塊の心得', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_power', element: 'earth', value: 0.05 }],
    desc: '土属性の攻撃 威力+5%（属性相性とは別枠）',
  },
  {
    id: 'tr_power_light', tier: 'basic', name: '聖光の心得', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_power', element: 'light', value: 0.05 }],
    desc: '光属性の攻撃 威力+5%（属性相性とは別枠）',
  },
  {
    id: 'tr_power_dark', tier: 'basic', name: '常闇の心得', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_power', element: 'dark', value: 0.05 }],
    desc: '闇属性の攻撃 威力+5%（属性相性とは別枠）',
  },

  /* ===== 属性ごとの護り (§5.7) =====
   * 攻めの心得とちょうど対になる防御側の枝。
   * 苦手な属性が出るフィールドに合わせて振り直す使い方を想定している。 */
  {
    id: 'tr_resist_fire', tier: 'basic', name: '炎への備え', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_resist', element: 'fire', value: 0.04 }],
    desc: '火属性で受けるダメージ -4%',
  },
  {
    id: 'tr_resist_water', tier: 'basic', name: '水への備え', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_resist', element: 'water', value: 0.04 }],
    desc: '水属性で受けるダメージ -4%',
  },
  {
    id: 'tr_resist_wind', tier: 'basic', name: '風への備え', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_resist', element: 'wind', value: 0.04 }],
    desc: '風属性で受けるダメージ -4%',
  },
  {
    id: 'tr_resist_earth', tier: 'basic', name: '土への備え', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_resist', element: 'earth', value: 0.04 }],
    desc: '土属性で受けるダメージ -4%',
  },
  {
    id: 'tr_resist_light', tier: 'basic', name: '光への備え', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_resist', element: 'light', value: 0.04 }],
    desc: '光属性で受けるダメージ -4%',
  },
  {
    id: 'tr_resist_dark', tier: 'basic', name: '闇への備え', cost: 1, maxLevel: 5,
    effects: [{ kind: 'element_resist', element: 'dark', value: 0.04 }],
    desc: '闇属性で受けるダメージ -4%',
  },

  /* ===== 弱点コンボを伸ばす (§5.7) =====
   * 弱点コンボ (§10.6) は手動戦闘でしか積めない。
   * ここを厚くすることが、そのまま「手で戦う理由」になる。 */
  {
    id: 'tr_combo_gain', tier: 'basic', name: '連鎖の心得', cost: 3, maxLevel: 2,
    effects: [{ kind: 'combo_gain', value: 1 }],
    desc: '弱点を突いたときのコンボ加算 +1段',
  },
  {
    id: 'tr_combo_keep', tier: 'basic', name: '執念', cost: 2, maxLevel: 3,
    effects: [{ kind: 'combo_keep', value: 0.2 }],
    desc: 'コンボが落ちるのを20%の確率で踏みとどまる',
  },
  {
    id: 'tr_combo_power', tier: 'basic', name: '連撃の呼吸', cost: 2, maxLevel: 4,
    effects: [{ kind: 'combo_power', value: 0.015 }],
    desc: 'コンボ1段あたりの倍率 +1.5%（上限に張り付いた後も効く）',
  },

  /* ===== 回復と防護 (§5.7) ===== */
  {
    id: 'tr_smite', tier: 'basic', name: '灼ける慈悲', cost: 2, maxLevel: 4,
    effects: [{ kind: 'smite', value: 0.12 }],
    // 回復役の手番は、敵から見れば何も起きていない手番だった。
    desc: '回復したとき、その量の 12% が敵1体へダメージになる',
  },
  {
    id: 'tr_heal_to_power', tier: 'basic', name: '祈りの刃', cost: 2, maxLevel: 4,
    effects: [{ kind: 'heal_to_power', value: 0.04 }],
    // 「回復に振ると殴れなくなる」という二択を消すための枝。
    //
    // 値が小さいのは、これが **回復量への投資と掛け算になる** ため (§5.11)。
    // 素で 1.68 まで積めた版は healPower 1.76 と掛かって火力+296%になり、
    // 支援枠を1つ使ってなお勝率100%（攻撃4人は80%）だった。
    desc: '「与える回復量」の伸びの 4% ぶん、自分の火力も上がる',
  },
  {
    id: 'tr_support_stack_b', tier: 'basic', name: '重ねる言葉', cost: 2, maxLevel: 4,
    effects: [{ kind: 'support_stack', value: 0.03 }],
    desc: 'バフをかけるたび、自分がかけるバフの効果量 +3%（その戦闘のあいだ）',
  },
  {
    id: 'tr_triage', tier: 'basic', name: '分別', cost: 2, maxLevel: 5,
    effects: [{ kind: 'triage', value: 0.2 }],
    // 追い打ちのちょうど回復版 (§5.10)。
    desc: '相手が瀕死なほど回復量が伸びる（最大 +20%／レベル）',
  },
  {
    id: 'tr_cleanse', tier: 'basic', name: '浄めの手', cost: 2, maxLevel: 4,
    effects: [{ kind: 'cleanse', value: 0.2 }],
    // 味方の弱体を取り除く手段は今まで1つも無かった。
    // 呪詛は回復そのものを止めるので、解けないと立て直しが利かない。
    desc: '回復したとき 20% で相手の弱体を1つ解く。呪詛を自力で外せるようになる',
  },
  {
    id: 'tr_heal_spread', tier: 'basic', name: '癒しの波紋', cost: 2, maxLevel: 4,
    effects: [{ kind: 'heal_spread', value: 0.15 }],
    desc: '単体回復が他の味方にも 15% の量で及ぶ（攻撃側の「連鎖」の回復版）',
  },
  {
    id: 'tr_buff_extend', tier: 'basic', name: '長く響く声', cost: 2, maxLevel: 3,
    effects: [{ kind: 'buff_extend', value: 1 }],
    desc: '自分がかけるバフの持続 +1ターン（受け手側の「持続の心得」とは別枠）',
  },
  {
    id: 'tr_buff_shield', tier: 'basic', name: '護りの言葉', cost: 2, maxLevel: 4,
    effects: [{ kind: 'buff_shield', value: 0.05 }],
    desc: 'バフをかけた相手に、その相手の最大HPの 5% の障壁',
  },
  {
    id: 'tr_heal_power', tier: 'basic', name: '癒しの手', cost: 1, maxLevel: 5,
    effects: [{ kind: 'heal_power', value: 0.1 }],
    desc: '自分が行う回復量 +10%',
  },
  {
    id: 'tr_heal_kill', tier: 'basic', name: '戦場の糧', cost: 1, maxLevel: 5,
    effects: [{ kind: 'heal_on_kill', value: 0.03 }],
    desc: '敵を倒すたびに最大HPの3%を回復',
  },
  {
    id: 'tr_start_shield', tier: 'basic', name: '開幕の備え', cost: 1, maxLevel: 5,
    effects: [{ kind: 'start_shield', value: 0.04 }],
    desc: '戦闘開始時に最大HPの4%ぶんの障壁をまとう',
  },
  {
    id: 'tr_status_immune', tier: 'basic', name: '気丈', cost: 2, maxLevel: 4,
    effects: [{ kind: 'status_immune', value: 0.08 }],
    desc: '弱体を8%の確率で丸ごとはねのける',
  },

  /* ===== 隊列 (§5.7) =====
   * 編成画面の並び順に意味を持たせるための枝。
   * 前に置けば火力、後ろに置けば硬さ。同じキャラでも置き場所で役割が変わる。 */
  {
    id: 'tr_front_power', tier: 'basic', name: '先陣の誇り', cost: 2, maxLevel: 5,
    effects: [{ kind: 'front_power', value: 0.06 }],
    desc: '隊列が前にいるほど火力上昇（先頭で +6%、最後尾では効かない）',
  },
  {
    id: 'tr_back_guard', tier: 'basic', name: '後衛の心得', cost: 1, maxLevel: 5,
    effects: [{ kind: 'back_guard', value: 0.05 }],
    desc: '隊列が後ろにいるほど被ダメージ軽減（最後尾で -5%、先頭では効かない）',
  },

  /* ===== 戦況で積み上がる (§5.7) ===== */
  {
    id: 'tr_round_stack', tier: 'basic', name: '長期戦の理', cost: 2, maxLevel: 4,
    effects: [{ kind: 'round_stack', value: 0.05 }],
    desc: 'ラウンドが1つ進むごとに火力 +5%（刹那セットのちょうど裏返し）',
  },
  {
    id: 'tr_hit_stack', tier: 'basic', name: '痛みの記憶', cost: 2, maxLevel: 4,
    effects: [{ kind: 'hit_stack', value: 0.04 }],
    desc: '被弾するたびに火力 +4%（殴られ役の火力源）',
  },
  {
    id: 'tr_party_size', tier: 'basic', name: '連帯', cost: 2, maxLevel: 4,
    effects: [{ kind: 'party_size_power', value: 0.04 }],
    desc: '生きている味方1人につき火力 +4%（常世セットとは逆の発想）',
  },
  {
    id: 'tr_solo', tier: 'basic', name: '孤高', cost: 2, maxLevel: 3,
    effects: [{ kind: 'solo_power', value: 0.15 }],
    desc: '生き残りが自分だけのとき火力 +15%',
  },

  /* ===== 属性の噛み合い (§5.7) =====
   * 「有利を取れたとき」「等倍のとき」「突かれたとき」に分けてある。
   * どこを厚くするかで、属性パズルへの向き合い方が変わる。 */
  {
    id: 'tr_weak_hunter', tier: 'basic', name: '弱点狩り', cost: 2, maxLevel: 5,
    effects: [{ kind: 'weak_hunter', value: 0.08 }],
    desc: '素で属性有利を取れたとき 火力+8%（適応で有利化した攻撃には乗らない）',
  },
  {
    id: 'tr_neutral', tier: 'basic', name: '等倍の心得', cost: 1, maxLevel: 5,
    effects: [{ kind: 'neutral_power', value: 0.08 }],
    desc: '属性相性が等倍のとき 火力+8%（無属性ビルドと「混沌の力」の受け皿）',
  },
  {
    id: 'tr_weak_guard', tier: 'basic', name: '弱点耐性', cost: 1, maxLevel: 4,
    effects: [{ kind: 'weak_guard', value: 0.08 }],
    desc: '弱点を突かれたときの被ダメージ -8%',
  },

  /* ===== 初級で覚える技 (§5.7) ===== */
  {
    id: 'tr_grant_needle', tier: 'basic', name: '刺突の型', cost: 2, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_needle', value: 1 }],
    desc: 'アクティブ技「刺突」を習得（威力70%の小技。拡散・連射のパッシブが乗る）',
  },
  {
    id: 'tr_grant_spark', tier: 'basic', name: '火花の型', cost: 2, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_spark', value: 1 }],
    desc: 'アクティブ技「火花」を習得（威力60%の火属性小技）',
  },

  /* ===================================================================
   * 中級 — 初級で選んだ方向を「戦術」に変える段
   * =================================================================== */
  {
    id: 'tr_mono_element', tier: 'mid', name: '同色の絆', cost: 3, maxLevel: 4,
    effects: [{ kind: 'mono_element_power', value: 0.1 }],
    desc: 'パーティ全員が同じ属性のとき 火力+10%',
  },
  {
    id: 'tr_rainbow', tier: 'mid', name: '五色の陣', cost: 3, maxLevel: 4,
    effects: [{ kind: 'rainbow_power', value: 0.1 }],
    desc: 'パーティの属性が全員バラバラのとき 火力+10%',
  },
  {
    id: 'tr_crit_pierce', tier: 'mid', name: '会心貫通', cost: 3, maxLevel: 5,
    effects: [{ kind: 'crit_pierce', value: 0.2 }],
    desc: '会心したとき 防御を20%ぶん無視する',
  },
  {
    id: 'tr_first_hit_crit', tier: 'mid', name: '初手必中', cost: 4, maxLevel: 2,
    effects: [{ kind: 'first_hit_crit', value: 1 }],
    desc: 'ウェーブごとに、最初の攻撃1回が確定で会心になる',
  },
  {
    id: 'tr_overkill', tier: 'mid', name: '溢れる災禍', cost: 3, maxLevel: 4,
    effects: [{ kind: 'overkill_carry', value: 0.15 }],
    desc: '敵を倒したときの超過ダメージの15%を、次の一撃に上乗せする',
  },
  {
    id: 'tr_status_hit', tier: 'mid', name: '毒手', cost: 2, maxLevel: 4,
    effects: [{ kind: 'status_on_hit', value: 0.1 }],
    desc: '攻撃時 10%の確率で毒を付与する（状態異常技を持たなくても弱体ビルドに乗れる）',
  },
  {
    id: 'tr_kill_extra', tier: 'mid', name: '連鎖する死', cost: 4, maxLevel: 4,
    effects: [{ kind: 'kill_extra_action', value: 0.08 }],
    desc: '敵を倒したとき 8%の確率でもう一度行動できる',
  },
  {
    id: 'tr_low_hp_guard', tier: 'mid', name: '窮鼠', cost: 2, maxLevel: 4,
    effects: [{ kind: 'low_hp_guard', value: 0.1 }],
    desc: 'HPが減っているほど被ダメージ軽減（瀕死で -10%）。「背水」と組ませて崩れにくくする',
  },
  {
    id: 'tr_reflect', tier: 'mid', name: '鏡面', cost: 3, maxLevel: 4,
    effects: [{ kind: 'reflect', value: 0.08 }],
    desc: '受けたダメージの8%をそのまま相手へ返す（棘と違い、大技ほど返る）',
  },
  {
    id: 'tr_debuff_spread', tier: 'mid', name: '疫病の広がり', cost: 3, maxLevel: 4,
    effects: [{ kind: 'debuff_spread', value: 0.15 }],
    desc: '与えた弱体が 15%の確率で他の敵にも広がる',
  },
  {
    // 特化型は 0.050/SP。3SP だと 0.040/SP で効率も上限も負けていた。
    id: 'tr_element_all', tier: 'mid', name: '万象の心得', cost: 2, maxLevel: 5,
    effects: [{ kind: 'element_power', element: 'all', value: 0.02 }],
    desc: '全属性の攻撃 威力+2%（1属性に絞る「心得」より効率は悪いが腐らない）',
  },
  {
    id: 'tr_resist_all', tier: 'mid', name: '万象の護り', cost: 2, maxLevel: 5,
    effects: [{ kind: 'element_resist', element: 'all', value: 0.02 }],
    desc: '全属性で受けるダメージ -2%',
  },
  {
    id: 'tr_round_stack_mid', tier: 'mid', name: '不屈の持久', cost: 3, maxLevel: 4,
    effects: [{ kind: 'round_stack', value: 0.08 }],
    desc: 'ラウンドが1つ進むごとに火力 +8%',
  },
  {
    id: 'tr_hit_stack_mid', tier: 'mid', name: '怨嗟の蓄積', cost: 3, maxLevel: 4,
    effects: [{ kind: 'hit_stack', value: 0.07 }],
    desc: '被弾するたびに火力 +7%',
  },
  {
    id: 'tr_solo_mid', tier: 'mid', name: '独り立つ者', cost: 3, maxLevel: 3,
    effects: [{ kind: 'solo_power', value: 0.25 }],
    desc: '生き残りが自分だけのとき 火力+25%',
  },
  {
    id: 'tr_combo_power_mid', tier: 'mid', name: '連撃の極致', cost: 3, maxLevel: 4,
    effects: [{ kind: 'combo_power', value: 0.025 }],
    desc: 'コンボ1段あたりの倍率 +2.5%',
  },
  {
    id: 'tr_smite_mid', tier: 'mid', name: '裁きの光', cost: 3, maxLevel: 4,
    effects: [{ kind: 'smite', value: 0.16 }],
    desc: '回復したとき、その量の 16% が敵1体へダメージになる',
  },
  {
    id: 'tr_heal_to_power_mid', tier: 'mid', name: '聖別', cost: 3, maxLevel: 4,
    effects: [{ kind: 'heal_to_power', value: 0.05 }],
    desc: '「与える回復量」の伸びの 5% ぶん、自分の火力も上がる',
  },
  {
    id: 'tr_regen_mid', tier: 'mid', name: '不断の生', cost: 3, maxLevel: 4,
    effects: [{ kind: 'regen', value: 0.02 },
              { kind: 'mend_power', value: 0.08 }],
    // 再生も「恩返し」に載るようになったので、耐えるほど殴れる (§5.11)。
    desc: '毎ラウンド最大HPの 2% 回復／受けた回復量による火力 +8%',
  },
  {
    id: 'tr_low_hp_heal', tier: 'mid', name: '危急の手', cost: 3, maxLevel: 4,
    effects: [{ kind: 'low_hp_heal', value: 0.04 }],
    // 回復役の手番は1つしかないので、削られる相手が2人以上いると必ず取りこぼす。
    desc: 'ラウンド終了時、HPが半分を切った味方を最大HPの 4% 回復する',
  },
  {
    id: 'tr_round_buff', tier: 'mid', name: '絶えぬ号令', cost: 4, maxLevel: 4,
    effects: [{ kind: 'round_buff', value: 0.04 }],
    // 値を抑えてあるのは「かける側の効果量」が最大+188%まで乗るため (§5.10)。
    // 素で 0.51 まで積めた版は、掛け合わせて **恒常+147%** になり、
    // 行動を使わずに全体の火力が2.5倍近くなった（実測でラウンド数が半分）。
    desc: 'ラウンド開始時、味方全体に固有バフ +4%（1ターン）。かける側の強化も乗る',
  },
  {
    id: 'tr_wave_heal_mid', tier: 'mid', name: '息長', cost: 3, maxLevel: 4,
    effects: [{ kind: 'wave_heal', value: 0.08 }],
    desc: 'ウェーブが変わるとき、味方全体が最大HPの 8% 回復する',
  },
  {
    id: 'tr_buff_shield_mid', tier: 'mid', name: '堅き言葉', cost: 3, maxLevel: 4,
    effects: [{ kind: 'buff_shield', value: 0.06 }],
    desc: 'バフをかけた相手に、その相手の最大HPの 6% の障壁',
  },
  {
    id: 'tr_buff_len_hi_mid', tier: 'mid', name: '遠鳴り', cost: 4, maxLevel: 3,
    effects: [{ kind: 'buff_duration', value: 1 }],
    desc: '自分が受けるバフの持続 +1ターン',
  },
  {
    id: 'tr_cleanse_mid', tier: 'mid', name: '祓いの祈り', cost: 3, maxLevel: 4,
    effects: [{ kind: 'cleanse', value: 0.25 }],
    desc: '回復したとき 25% で相手の弱体を1つ解く',
  },
  {
    id: 'tr_heal_buff', tier: 'mid', name: '癒しの祝福', cost: 3, maxLevel: 4,
    effects: [{ kind: 'heal_buff', value: 0.12 }],
    // 回復役が殴らずに火力へ寄与する道。撃つ手番を使わずに乗る。
    desc: '回復した相手に固有バフ +12%（2ターン）',
  },
  {
    id: 'tr_heal_spread_mid', tier: 'mid', name: '広がる波紋', cost: 3, maxLevel: 4,
    effects: [{ kind: 'heal_spread', value: 0.2 }],
    desc: '単体回復が他の味方にも 20% の量で及ぶ',
  },
  {
    id: 'tr_support_stack', tier: 'mid', name: '重ねる声', cost: 3, maxLevel: 4,
    effects: [{ kind: 'support_stack', value: 0.04 }],
    // 戦闘のあいだだけ積み上がるので、長引くほど後半のバフが効く。
    desc: 'バフをかけるたび、自分がかけるバフの効果量 +4%（その戦闘のあいだ）',
  },
  {
    id: 'tr_buff_heal', tier: 'mid', name: '励ましの熱', cost: 3, maxLevel: 4,
    effects: [{ kind: 'buff_heal', value: 0.04 }],
    desc: 'バフをかけた相手を、その相手の最大HPの 4% 回復する',
  },
  {
    id: 'tr_heal_power_mid', tier: 'mid', name: '大癒', cost: 2, maxLevel: 4,
    effects: [{ kind: 'heal_power', value: 0.18 }],
    desc: '自分が行う回復量 +18%',
  },
  {
    id: 'tr_start_shield_mid', tier: 'mid', name: '鉄壁の備え', cost: 2, maxLevel: 4,
    effects: [{ kind: 'start_shield', value: 0.07 }],
    desc: '戦闘開始時に最大HPの7%ぶんの障壁をまとう',
  },
  {
    id: 'tr_grant_lance', tier: 'mid', name: '穿つ型', cost: 3, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_lance', value: 1 }],
    desc: 'アクティブ技「烈槍」を習得（威力220%＋防御崩し2ターン）',
  },
  {
    id: 'tr_grant_frost', tier: 'mid', name: '凍える型', cost: 3, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_frost', value: 1 }],
    desc: 'アクティブ技「氷結の枷」を習得（防御崩壊と凍結を同時付与）',
  },
  {
    id: 'tr_grant_chain_bolt', tier: 'mid', name: '連雷の型', cost: 3, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_chain_bolt', value: 1 }],
    desc: 'アクティブ技「連雷」を習得（威力90%の全体攻撃。小技扱いなので連射が乗る）',
  },
  {
    id: 'tr_grant_mend', tier: 'mid', name: '治癒の型', cost: 3, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_mend', value: 1 }],
    desc: 'アクティブ技「再生の陣」を習得（味方全体を回復）',
  },

  /* ===================================================================
   * 上級 — ルールそのものを書き換える段
   * =================================================================== */
  {
    id: 'tr_dual_light', tier: 'high', name: '双極・聖', cost: 6, maxLevel: 1,
    effects: [{ kind: 'dual_element', element: 'light' }],
    desc: '攻撃を光属性でも相性判定し、良かったほうを採る（属性を固定する「誓い」とは別の解き方）',
  },
  {
    id: 'tr_dual_dark', tier: 'high', name: '双極・冥', cost: 6, maxLevel: 1,
    effects: [{ kind: 'dual_element', element: 'dark' }],
    desc: '攻撃を闇属性でも相性判定し、良かったほうを採る',
  },
  {
    id: 'tr_all_spread', tier: 'high', name: '遍く波紋', cost: 8, maxLevel: 1,
    effects: [{ kind: 'all_spread', value: 1 }],
    desc: '単体攻撃技がすべて敵全体に当たるようになる（威力の条件なし）',
  },
  {
    id: 'tr_overkill_hi', tier: 'high', name: '災禍の奔流', cost: 5, maxLevel: 3,
    effects: [{ kind: 'overkill_carry', value: 0.3 }],
    desc: '敵を倒したときの超過ダメージの30%を、次の一撃に上乗せする',
  },
  {
    id: 'tr_reflect_hi', tier: 'high', name: '鏡面の理', cost: 5, maxLevel: 3,
    effects: [{ kind: 'reflect', value: 0.15 }],
    desc: '受けたダメージの15%をそのまま相手へ返す',
  },
  {
    id: 'tr_kill_extra_hi', tier: 'high', name: '屍山血河', cost: 6, maxLevel: 3,
    effects: [{ kind: 'kill_extra_action', value: 0.15 }],
    desc: '敵を倒したとき 15%の確率でもう一度行動できる',
  },
  {
    id: 'tr_status_immune_hi', tier: 'high', name: '不動心', cost: 5, maxLevel: 3,
    effects: [{ kind: 'status_immune', value: 0.2 }],
    desc: '弱体を20%の確率で丸ごとはねのける',
  },
  {
    id: 'tr_grant_eclipse', tier: 'high', name: '蝕の型', cost: 5, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_eclipse', value: 1 }],
    desc: 'アクティブ技「日蝕」を習得（威力380%の全体攻撃）',
  },
  {
    id: 'tr_grant_gaia', tier: 'high', name: '大地の型', cost: 5, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_gaia', value: 1 }],
    desc: 'アクティブ技「地衝」を習得（威力420%・会心率18%の単体攻撃）',
  },
  {
    id: 'tr_grant_aegis', tier: 'high', name: '不落の型', cost: 5, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_aegis', value: 1 }],
    desc: 'アクティブ技「不落の誓い」を習得（味方全体の被ダメージを3ターン35%軽減）',
  },

  /* ===================================================================
   * §5.8 拡張分
   *
   * 中心にあるのは状態異常 (data/statuses.js)。
   * 6種類それぞれ効くタイミングが違うので、「どれを撒くか」がそのまま
   * パーティの削り方の選択になる。耐性・特効・付与の3ファミリーで展開してある。
   * =================================================================== */

  /* ===== 異常への耐性 (§5.8) =====
   * 持続を縮める。全部に効く「精神耐性」より、1種に絞るぶん1段が大きい。 */
  {
    id: 'tr_res_poison', tier: 'basic', name: '解毒の心得', cost: 1, maxLevel: 3,
    effects: [{ kind: 'status_resist_kind', status: 'poison', value: 1 }],
    desc: '自分が受ける毒の持続 -1ターン',
  },
  {
    id: 'tr_res_burn', tier: 'basic', name: '鎮火の心得', cost: 1, maxLevel: 3,
    effects: [{ kind: 'status_resist_kind', status: 'burn', value: 1 }],
    desc: '自分が受ける火傷の持続 -1ターン',
  },
  {
    id: 'tr_res_bleed', tier: 'basic', name: '止血の心得', cost: 1, maxLevel: 3,
    effects: [{ kind: 'status_resist_kind', status: 'bleed', value: 1 }],
    desc: '自分が受ける出血の持続 -1ターン',
  },
  {
    id: 'tr_res_paralyze', tier: 'basic', name: '解痺の心得', cost: 1, maxLevel: 3,
    effects: [{ kind: 'status_resist_kind', status: 'paralyze', value: 1 }],
    desc: '自分が受ける麻痺の持続 -1ターン',
  },
  {
    id: 'tr_res_freeze', tier: 'basic', name: '融解の心得', cost: 1, maxLevel: 3,
    effects: [{ kind: 'status_resist_kind', status: 'freeze', value: 1 }],
    desc: '自分が受ける凍結の持続 -1ターン',
  },
  {
    id: 'tr_res_curse', tier: 'basic', name: '祓いの心得', cost: 1, maxLevel: 3,
    effects: [{ kind: 'status_resist_kind', status: 'curse', value: 1 }],
    desc: '自分が受ける呪詛の持続 -1ターン',
  },

  /* ===== 異常への特効 (§5.8) =====
   * 「追い討ち」が異常の種類を問わないのに対し、こちらは種類を当てにいく。
   * 自分で撒くか、味方に撒いてもらうかで組み方が変わる。 */
  {
    id: 'tr_vs_poison', tier: 'basic', name: '毒喰らい', cost: 2, maxLevel: 4,
    effects: [{ kind: 'vs_status_power', status: 'poison', value: 0.07 }],
    desc: '毒にかかった敵への火力 +7%',
  },
  {
    id: 'tr_vs_burn', tier: 'basic', name: '灰均し', cost: 2, maxLevel: 4,
    effects: [{ kind: 'vs_status_power', status: 'burn', value: 0.07 }],
    desc: '火傷している敵への火力 +7%',
  },
  {
    id: 'tr_vs_bleed', tier: 'basic', name: '血の匂い', cost: 2, maxLevel: 4,
    effects: [{ kind: 'vs_status_power', status: 'bleed', value: 0.07 }],
    desc: '出血している敵への火力 +7%',
  },
  {
    id: 'tr_vs_paralyze', tier: 'basic', name: '好機', cost: 2, maxLevel: 4,
    effects: [{ kind: 'vs_status_power', status: 'paralyze', value: 0.07 }],
    desc: '麻痺している敵への火力 +7%',
  },
  {
    id: 'tr_vs_freeze', tier: 'basic', name: '砕氷', cost: 2, maxLevel: 4,
    effects: [{ kind: 'vs_status_power', status: 'freeze', value: 0.07 }],
    desc: '凍結している敵への火力 +7%',
  },
  {
    id: 'tr_vs_curse', tier: 'basic', name: '呪縛狩り', cost: 2, maxLevel: 4,
    effects: [{ kind: 'vs_status_power', status: 'curse', value: 0.07 }],
    desc: '呪詛にかかった敵への火力 +7%',
  },

  /* ===== 異常をついでに撒く (§5.8) =====
   * 撒く技を持っていなくても異常ビルドに乗れるようにする入口。
   * 強さは技で撒くぶんより控えめなので、これだけでは完成しない。 */
  {
    id: 'tr_hit_burn', tier: 'basic', name: '火だるま', cost: 2, maxLevel: 4,
    effects: [{ kind: 'status_on_hit_kind', status: 'burn', value: 0.08 }],
    desc: '攻撃時 8%の確率で火傷を付与（攻撃するたびに相手が焼ける）',
  },
  {
    id: 'tr_hit_bleed', tier: 'basic', name: '裂傷の心得', cost: 2, maxLevel: 4,
    effects: [{ kind: 'status_on_hit_kind', status: 'bleed', value: 0.08 }],
    desc: '攻撃時 8%の確率で出血を付与（相手が被弾するたびに傷が開く）',
  },
  {
    id: 'tr_hit_paralyze', tier: 'basic', name: '痺れの心得', cost: 2, maxLevel: 4,
    effects: [{ kind: 'status_on_hit_kind', status: 'paralyze', value: 0.06 }],
    desc: '攻撃時 6%の確率で麻痺を付与（相手の手番を奪う）',
  },
  {
    id: 'tr_hit_freeze', tier: 'basic', name: '凍える心得', cost: 2, maxLevel: 4,
    effects: [{ kind: 'status_on_hit_kind', status: 'freeze', value: 0.08 }],
    desc: '攻撃時 8%の確率で凍結を付与（味方全員の火力が上がる）',
  },
  {
    id: 'tr_hit_curse', tier: 'basic', name: '呪いの心得', cost: 2, maxLevel: 4,
    effects: [{ kind: 'status_on_hit_kind', status: 'curse', value: 0.08 }],
    desc: '攻撃時 8%の確率で呪詛を付与（相手の立て直しを止める）',
  },

  /* ===== 属性ごとの刃 (§5.8) =====
   * 会心率を属性で絞る。「一点集中」が全部乗せなので、そちらより1段が大きい。 */
  {
    id: 'tr_crit_fire', tier: 'basic', name: '紅蓮の刃', cost: 1, maxLevel: 4,
    effects: [{ kind: 'element_crit', element: 'fire', value: 0.05 }],
    desc: '火属性の攻撃 クリティカル率 +5%',
  },
  {
    id: 'tr_crit_water', tier: 'basic', name: '蒼波の刃', cost: 1, maxLevel: 4,
    effects: [{ kind: 'element_crit', element: 'water', value: 0.05 }],
    desc: '水属性の攻撃 クリティカル率 +5%',
  },
  {
    id: 'tr_crit_wind', tier: 'basic', name: '疾風の刃', cost: 1, maxLevel: 4,
    effects: [{ kind: 'element_crit', element: 'wind', value: 0.05 }],
    desc: '風属性の攻撃 クリティカル率 +5%',
  },
  {
    id: 'tr_crit_earth', tier: 'basic', name: '岩塊の刃', cost: 1, maxLevel: 4,
    effects: [{ kind: 'element_crit', element: 'earth', value: 0.05 }],
    desc: '土属性の攻撃 クリティカル率 +5%',
  },
  {
    id: 'tr_crit_light', tier: 'basic', name: '聖光の刃', cost: 1, maxLevel: 4,
    effects: [{ kind: 'element_crit', element: 'light', value: 0.05 }],
    desc: '光属性の攻撃 クリティカル率 +5%',
  },
  {
    id: 'tr_crit_dark', tier: 'basic', name: '常闇の刃', cost: 1, maxLevel: 4,
    effects: [{ kind: 'element_crit', element: 'dark', value: 0.05 }],
    desc: '闇属性の攻撃 クリティカル率 +5%',
  },

  /* ===== 系統ごとの冴え (§5.8) ===== */
  {
    id: 'tr_crit_phys', tier: 'basic', name: '武の冴え', cost: 1, maxLevel: 4,
    effects: [{ kind: 'tag_crit', tag: 'phys', value: 0.05 }],
    desc: '[物理]技のクリティカル率 +5%',
  },
  {
    id: 'tr_crit_magi', tier: 'basic', name: '術の冴え', cost: 1, maxLevel: 4,
    effects: [{ kind: 'tag_crit', tag: 'magi', value: 0.05 }],
    desc: '[魔術]技のクリティカル率 +5%',
  },
  {
    id: 'tr_crit_reli', tier: 'basic', name: '理の冴え', cost: 1, maxLevel: 4,
    effects: [{ kind: 'tag_crit', tag: 'reli', value: 0.05 }],
    desc: '[遺物]技のクリティカル率 +5%',
  },

  /* ===== ステータスの付け替え (§5.8) =====
   * 「命を刃に」の兄弟。どのステータスを何に化けさせるかで装備の選び方が変わる。 */
  {
    id: 'tr_def_to_atk', tier: 'basic', name: '守りを刃に', cost: 2, maxLevel: 4,
    effects: [{ kind: 'def_to_atk', value: 0.15 }],
    desc: 'DEFの15%をATKと魔力に上乗せ（防具で殴るビルド）',
  },
  {
    id: 'tr_atk_to_def', tier: 'basic', name: '攻めを盾に', cost: 2, maxLevel: 4,
    effects: [{ kind: 'atk_to_def', value: 0.15 }],
    desc: 'ATKの15%をDEFに上乗せ（武器で耐えるビルド）',
  },

  /* ===== バフと障壁の扱い (§5.8) ===== */
  {
    id: 'tr_self_buff', tier: 'basic', name: '独り立ち', cost: 2, maxLevel: 4,
    effects: [{ kind: 'self_buff_power', value: 0.08 }],
    // 対象による分岐 (§5.12)。1回のバフは自分か味方かのどちらかにしかかからないので、
    // 両方に振ると、どちらの場面でも半分が遊ぶ。小技と大技の関係と同じ。
    desc: '自分にかけるバフの効果量 +8%（味方へのぶんには乗らない）',
  },
  {
    id: 'tr_ally_buff', tier: 'basic', name: '献身', cost: 2, maxLevel: 4,
    effects: [{ kind: 'ally_buff_power', value: 0.15 }],
    desc: '味方にかけるバフの効果量 +15%（自分へのぶんには乗らない）',
  },
  {
    id: 'tr_buff_power', tier: 'basic', name: '励ましの声', cost: 2, maxLevel: 4,
    effects: [{ kind: 'buff_power', value: 0.09 }],
    // 弱体には「与える量」も「与える持続」もあったのに、
    // バフ側は **受け手の持続** しか無かった (§5.9)。かける側の伸びしろ。
    desc: '自分がかけるバフの効果量 +9%（受け手側の「持続の心得」とは別枠）',
  },
  {
    id: 'tr_taunt', tier: 'basic', name: '名乗り', cost: 2, maxLevel: 3,
    effects: [{ kind: 'taunt', value: 0.4 }],
    // 敵は一様ランダムに殴る相手を選ぶので、盾役でも4分の1しか狙われない (§5.9)。
    desc: '敵に狙われやすくなる +40%。反撃・棘・庇うなど「殴られてから」の効果と噛み合う',
  },
  {
    id: 'tr_stealth', tier: 'basic', name: '気配殺し', cost: 2, maxLevel: 3,
    effects: [{ kind: 'stealth', value: 0.25 }],
    desc: '敵に狙われにくくなる -25%。ただし0にはならない（全体攻撃も避けられない）',
  },
  {
    id: 'tr_buff_len', tier: 'basic', name: '持続の心得', cost: 2, maxLevel: 3,
    effects: [{ kind: 'buff_duration', value: 1 }],
    desc: '自分が受けるバフの持続 +1ターン',
  },
  {
    id: 'tr_buff_kill', tier: 'basic', name: '戦果の高揚', cost: 2, maxLevel: 4,
    effects: [{ kind: 'buff_on_kill', value: 0.06 }],
    desc: '敵を倒すたびに固有バフ +6%（3ターン）',
  },
  {
    id: 'tr_shield_regen', tier: 'basic', name: '障壁の再生', cost: 2, maxLevel: 4,
    effects: [{ kind: 'shield_regen', value: 0.025 }],
    desc: 'ラウンド終了時に最大HPの2.5%ぶんの障壁を張り直す',
  },

  /* ===== 手の選び方 (§5.8) =====
   * 同じ技を続けるか、撃ち分けるか。どちらかに寄せる枝で、両取りには向かない。 */
  {
    id: 'tr_repeat', tier: 'basic', name: '一意専心', cost: 2, maxLevel: 4,
    effects: [{ kind: 'repeat_power', value: 0.07 }],
    desc: '同じ技を続けるたびに火力 +7%（技を変えると1に戻る）',
  },
  {
    id: 'tr_variety', tier: 'basic', name: '変幻自在', cost: 2, maxLevel: 4,
    effects: [{ kind: 'variety_power', value: 0.08 }],
    desc: '直前と違う技を使ったとき 火力+8%',
  },
  {
    id: 'tr_high_boost', tier: 'basic', name: '大技の心得', cost: 2, maxLevel: 4,
    effects: [{ kind: 'high_power_boost', value: 0.06 }],
    desc: '威力200%以上の技の火力 +6%（小技の底上げとは重ならない）',
  },

  /* ===== 会心・反撃・波及の枝 (§5.8) ===== */
  {
    id: 'tr_crit_stack', tier: 'basic', name: '熱狂', cost: 2, maxLevel: 4,
    effects: [{ kind: 'crit_stack', value: 0.03 }],
    desc: '会心するたびにクリティカル率 +3%（戦闘が終わると戻る）',
  },
  {
    id: 'tr_crit_exec', tier: 'basic', name: '会心の追い打ち', cost: 2, maxLevel: 4,
    effects: [{ kind: 'crit_execute', value: 0.2 }],
    desc: '会心したときの追い打ちの効き +20%',
  },
  {
    id: 'tr_counter_power', tier: 'basic', name: '反撃の心得', cost: 2, maxLevel: 4,
    effects: [{ kind: 'counter_power', value: 0.1 }],
    desc: '反撃の威力 +10%',
  },
  {
    id: 'tr_chain_power', tier: 'basic', name: '波及の心得', cost: 2, maxLevel: 4,
    effects: [{ kind: 'chain_power', value: 0.12 }],
    desc: '波及の余波の威力 +12%',
  },

  /* ===== 戦況の読み (§5.8) ===== */
  {
    id: 'tr_boss_guard', tier: 'basic', name: '巨獣への備え', cost: 2, maxLevel: 4,
    effects: [{ kind: 'boss_guard', value: 0.05 }],
    desc: 'ボスから受けるダメージ -5%',
  },
  {
    id: 'tr_full_hp_foe', tier: 'basic', name: '不意打ち', cost: 2, maxLevel: 4,
    effects: [{ kind: 'full_hp_foe_power', value: 0.08 }],
    desc: 'HPが減っていない敵への火力 +8%（追い打ちのちょうど裏返し）',
  },
  {
    id: 'tr_wave_power', tier: 'basic', name: '大詰めの気迫', cost: 2, maxLevel: 4,
    effects: [{ kind: 'wave_power', value: 0.07 }],
    desc: '最終ウェーブ（ボス戦）での火力 +7%',
  },
  {
    id: 'tr_damage_share', tier: 'basic', name: '痛みの分配', cost: 2, maxLevel: 4,
    effects: [{ kind: 'damage_share', value: 0.08 }],
    desc: '受けたダメージの8%を味方全員で分けて背負う（全体攻撃に強い）',
  },
  {
    id: 'tr_wave_revive', tier: 'basic', name: '不撓', cost: 3, maxLevel: 3,
    effects: [{ kind: 'wave_revive', value: 0.15 }],
    desc: 'ウェーブが変わるとき、倒れていてもHP15%で立ち上がる',
  },

  /* ===== 初級で覚える技 (§5.8) ===== */
  {
    id: 'tr_grant_ember', tier: 'basic', name: '焼き付けの型', cost: 2, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_ember', value: 1 }],
    desc: 'アクティブ技「燻り」を習得（火傷を付与する小技）',
  },
  {
    id: 'tr_grant_gash', tier: 'basic', name: '切り裂きの型', cost: 2, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_gash', value: 1 }],
    desc: 'アクティブ技「抉り」を習得（出血を付与する小技）',
  },
  {
    id: 'tr_grant_curse', tier: 'basic', name: '呪縛の型', cost: 2, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_curse', value: 1 }],
    desc: 'アクティブ技「呪縛」を習得（呪詛を付与し、回復を止める）',
  },

  /* ===================================================================
   * 中級 (§5.8)
   * =================================================================== */
  {
    id: 'tr_vs_poison_mid', tier: 'mid', name: '毒の見極め', cost: 3, maxLevel: 4,
    effects: [{ kind: 'vs_status_power', status: 'poison', value: 0.12 }],
    desc: '毒にかかった敵への火力 +12%',
  },
  {
    id: 'tr_vs_burn_mid', tier: 'mid', name: '業火の見極め', cost: 3, maxLevel: 4,
    effects: [{ kind: 'vs_status_power', status: 'burn', value: 0.12 }],
    desc: '火傷している敵への火力 +12%',
  },
  {
    id: 'tr_vs_bleed_mid', tier: 'mid', name: '流血の見極め', cost: 3, maxLevel: 4,
    effects: [{ kind: 'vs_status_power', status: 'bleed', value: 0.12 }],
    desc: '出血している敵への火力 +12%',
  },
  {
    id: 'tr_vs_paralyze_mid', tier: 'mid', name: '硬直の見極め', cost: 3, maxLevel: 4,
    effects: [{ kind: 'vs_status_power', status: 'paralyze', value: 0.12 }],
    desc: '麻痺している敵への火力 +12%',
  },
  {
    id: 'tr_vs_freeze_mid', tier: 'mid', name: '氷解の見極め', cost: 3, maxLevel: 4,
    effects: [{ kind: 'vs_status_power', status: 'freeze', value: 0.12 }],
    desc: '凍結している敵への火力 +12%',
  },
  {
    id: 'tr_hit_burn_mid', tier: 'mid', name: '業火の伝播', cost: 3, maxLevel: 4,
    effects: [{ kind: 'status_on_hit_kind', status: 'burn', value: 0.14 }],
    desc: '攻撃時 14%の確率で火傷を付与',
  },
  {
    id: 'tr_hit_bleed_mid', tier: 'mid', name: '流血の伝播', cost: 3, maxLevel: 4,
    effects: [{ kind: 'status_on_hit_kind', status: 'bleed', value: 0.14 }],
    desc: '攻撃時 14%の確率で出血を付与',
  },
  {
    id: 'tr_hit_paralyze_mid', tier: 'mid', name: '硬直の伝播', cost: 4, maxLevel: 4,
    effects: [{ kind: 'status_on_hit_kind', status: 'paralyze', value: 0.10 }],
    desc: '攻撃時 10%の確率で麻痺を付与',
  },
  {
    id: 'tr_hit_freeze_mid', tier: 'mid', name: '氷結の伝播', cost: 3, maxLevel: 4,
    effects: [{ kind: 'status_on_hit_kind', status: 'freeze', value: 0.14 }],
    desc: '攻撃時 14%の確率で凍結を付与',
  },
  {
    id: 'tr_hit_curse_mid', tier: 'mid', name: '呪詛の伝播', cost: 3, maxLevel: 4,
    effects: [{ kind: 'status_on_hit_kind', status: 'curse', value: 0.14 }],
    desc: '攻撃時 14%の確率で呪詛を付与',
  },

  /* ===== 系統ごとの貫通 (§5.8) =====
   * 「防御崩し」が確率で全部抜くのに対し、こちらは確定で少しずつ抜く。 */
  {
    id: 'tr_pierce_phys', tier: 'mid', name: '武の徹し', cost: 3, maxLevel: 4,
    effects: [{ kind: 'tag_pierce', tag: 'phys', value: 0.06 }],
    desc: '[物理]技が防御を6%ぶん無視する',
  },
  {
    id: 'tr_pierce_magi', tier: 'mid', name: '術の徹し', cost: 3, maxLevel: 4,
    effects: [{ kind: 'tag_pierce', tag: 'magi', value: 0.06 }],
    desc: '[魔術]技が防御を6%ぶん無視する',
  },
  {
    id: 'tr_pierce_reli', tier: 'mid', name: '理の徹し', cost: 3, maxLevel: 4,
    effects: [{ kind: 'tag_pierce', tag: 'reli', value: 0.06 }],
    desc: '[遺物]技が防御を6%ぶん無視する',
  },

  /* ===== 中級の単発 (§5.8) ===== */
  {
    id: 'tr_crit_spread', tier: 'mid', name: '会心の余波', cost: 4, maxLevel: 4,
    effects: [{ kind: 'crit_spread', value: 0.12 }],
    desc: '会心したとき、与ダメージの12%が他の敵全員にも及ぶ',
  },
  {
    id: 'tr_counter_all', tier: 'mid', name: '反撃の嵐', cost: 4, maxLevel: 3,
    effects: [{ kind: 'counter_all', value: 0.25 }],
    desc: '反撃が、殴ってきた相手以外にも25%の威力で飛ぶ',
  },
  {
    id: 'tr_def_to_atk_mid', tier: 'mid', name: '鉄血', cost: 3, maxLevel: 4,
    effects: [{ kind: 'def_to_atk', value: 0.25 }],
    desc: 'DEFの25%をATKと魔力に上乗せ',
  },
  {
    id: 'tr_atk_to_def_mid', tier: 'mid', name: '剛体', cost: 3, maxLevel: 4,
    effects: [{ kind: 'atk_to_def', value: 0.25 }],
    desc: 'ATKの25%をDEFに上乗せ',
  },
  {
    id: 'tr_self_buff_mid', tier: 'mid', name: '孤高の構え', cost: 3, maxLevel: 4,
    effects: [{ kind: 'self_buff_power', value: 0.1 }],
    desc: '自分にかけるバフの効果量 +10%。自分で撒いて自分で殴る形',
  },
  {
    id: 'tr_ally_buff_mid', tier: 'mid', name: '旗手', cost: 3, maxLevel: 4,
    effects: [{ kind: 'ally_buff_power', value: 0.2 }],
    desc: '味方にかけるバフの効果量 +20%。全体バフを撒く役の中核',
  },
  {
    id: 'tr_opening_mid', tier: 'mid', name: '先陣の気勢', cost: 3, maxLevel: 4,
    effects: [{ kind: 'opening_buff', value: 0.1 }],
    desc: '戦闘開始時から固有バフ +10% を持って始まる',
  },
  {
    id: 'tr_buff_power_mid', tier: 'mid', name: '鼓舞の才', cost: 3, maxLevel: 4,
    effects: [{ kind: 'buff_power', value: 0.11 }],
    desc: '自分がかけるバフの効果量 +11%。全体バフを撒く役ほど効く',
  },
  {
    id: 'tr_taunt_mid', tier: 'mid', name: '矢面', cost: 4, maxLevel: 3,
    effects: [{ kind: 'taunt', value: 0.5 },
              { kind: 'reduction', value: 0.04 }],
    // 狙いを集めるだけでは溶けるので、耐える側も少し付ける。
    desc: '狙われやすさ +50%／被ダメージ軽減 +4%',
  },
  {
    id: 'tr_buff_len_mid', tier: 'mid', name: '長息', cost: 3, maxLevel: 3,
    effects: [{ kind: 'buff_duration', value: 1 }],
    desc: '自分が受けるバフの持続 +1ターン',
  },
  {
    id: 'tr_buff_kill_mid', tier: 'mid', name: '連勝の勢い', cost: 3, maxLevel: 4,
    effects: [{ kind: 'buff_on_kill', value: 0.11 }],
    desc: '敵を倒すたびに固有バフ +11%（3ターン）',
  },
  {
    id: 'tr_shield_regen_mid', tier: 'mid', name: '不断の障壁', cost: 3, maxLevel: 4,
    effects: [{ kind: 'shield_regen', value: 0.045 }],
    desc: 'ラウンド終了時に最大HPの4.5%ぶんの障壁を張り直す',
  },
  {
    id: 'tr_repeat_mid', tier: 'mid', name: '一心不乱', cost: 3, maxLevel: 4,
    effects: [{ kind: 'repeat_power', value: 0.12 }],
    desc: '同じ技を続けるたびに火力 +12%',
  },
  {
    id: 'tr_variety_mid', tier: 'mid', name: '千手', cost: 3, maxLevel: 4,
    effects: [{ kind: 'variety_power', value: 0.13 }],
    desc: '直前と違う技を使ったとき 火力+13%',
  },
  {
    id: 'tr_high_boost_mid', tier: 'mid', name: '大技の極意', cost: 3, maxLevel: 4,
    effects: [{ kind: 'high_power_boost', value: 0.11 }],
    desc: '威力200%以上の技の火力 +11%',
  },
  {
    id: 'tr_crit_stack_mid', tier: 'mid', name: '狂騒', cost: 3, maxLevel: 4,
    effects: [{ kind: 'crit_stack', value: 0.05 }],
    desc: '会心するたびにクリティカル率 +5%',
  },
  {
    id: 'tr_crit_exec_mid', tier: 'mid', name: '会心の追撃', cost: 3, maxLevel: 4,
    effects: [{ kind: 'crit_execute', value: 0.35 }],
    desc: '会心したときの追い打ちの効き +35%',
  },
  {
    id: 'tr_chain_power_mid', tier: 'mid', name: '大波及', cost: 3, maxLevel: 4,
    effects: [{ kind: 'chain_power', value: 0.2 }],
    desc: '波及の余波の威力 +20%',
  },
  {
    id: 'tr_counter_power_mid', tier: 'mid', name: '反撃の極意', cost: 3, maxLevel: 4,
    effects: [{ kind: 'counter_power', value: 0.18 }],
    desc: '反撃の威力 +18%',
  },
  {
    id: 'tr_boss_guard_mid', tier: 'mid', name: '巨獣殺しの構え', cost: 3, maxLevel: 4,
    effects: [{ kind: 'boss_guard', value: 0.08 }],
    desc: 'ボスから受けるダメージ -8%',
  },
  {
    id: 'tr_full_hp_foe_mid', tier: 'mid', name: '先制打', cost: 3, maxLevel: 4,
    effects: [{ kind: 'full_hp_foe_power', value: 0.13 }],
    desc: 'HPが減っていない敵への火力 +13%',
  },
  {
    id: 'tr_wave_power_mid', tier: 'mid', name: '決戦の気迫', cost: 3, maxLevel: 4,
    effects: [{ kind: 'wave_power', value: 0.12 }],
    desc: '最終ウェーブ（ボス戦）での火力 +12%',
  },
  {
    id: 'tr_damage_share_mid', tier: 'mid', name: '絆の盾', cost: 3, maxLevel: 4,
    effects: [{ kind: 'damage_share', value: 0.12 }],
    desc: '受けたダメージの12%を味方全員で分けて背負う',
  },
  {
    id: 'tr_wave_revive_mid', tier: 'mid', name: '不屈の魂', cost: 4, maxLevel: 3,
    effects: [{ kind: 'wave_revive', value: 0.3 }],
    desc: 'ウェーブが変わるとき、倒れていてもHP30%で立ち上がる',
  },
  {
    id: 'tr_res_all', tier: 'mid', name: '万象の胆力', cost: 3, maxLevel: 2,
    effects: [{ kind: 'status_resist_kind', status: 'all', value: 1 }],
    desc: '全種類の弱体の持続 -1ターン',
  },
  {
    id: 'tr_grant_shatter', tier: 'mid', name: '砕きの型', cost: 3, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_shatter', value: 1 }],
    desc: 'アクティブ技「氷砕」を習得（凍結を付与し、凍結中の敵に強い大技）',
  },
  {
    id: 'tr_grant_numb', tier: 'mid', name: '痺れの型', cost: 3, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_numb', value: 1 }],
    desc: 'アクティブ技「雷縛」を習得（麻痺を付与する全体技）',
  },
  {
    id: 'tr_grant_plague', tier: 'mid', name: '疫の型', cost: 4, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_plague', value: 1 }],
    desc: 'アクティブ技「万病」を習得（毒・火傷・出血をまとめて付与）',
  },
  {
    id: 'tr_grant_smash', tier: 'mid', name: '渾身の型', cost: 3, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_smash', value: 1 }],
    desc: 'アクティブ技「渾身撃」を習得（威力280%。大技の底上げが乗る）',
  },

  /* ===================================================================
   * 上級 (§5.8)
   * =================================================================== */
  {
    // 特化型（火の極意など）は 0.200/SP。こちらが 6SP だと 0.100/SP で、
    // 効率も上限（+0.30 対 +1.00）も負けていて選ぶ理由が消えていた。
    // 効率を揃え、差は「上限が低いかわりに1ノードで済む」だけにする。
    id: 'tr_mastery_all', tier: 'high', name: '万象の極意', cost: 3, maxLevel: 3,
    effects: [{ kind: 'element_mastery', element: 'all', value: 0.1 }],
    desc: '全属性の有利倍率 +0.1（1.5 → 最大1.8）',
  },
  {
    id: 'tr_crit_spread_hi', tier: 'high', name: '会心の連鎖', cost: 5, maxLevel: 3,
    effects: [{ kind: 'crit_spread', value: 0.22 }],
    desc: '会心したとき、与ダメージの22%が他の敵全員にも及ぶ',
  },
  {
    id: 'tr_counter_all_hi', tier: 'high', name: '反撃の理', cost: 5, maxLevel: 2,
    effects: [{ kind: 'counter_all', value: 0.4 }],
    desc: '反撃が、殴ってきた相手以外にも40%の威力で飛ぶ',
  },
  {
    id: 'tr_repeat_hi', tier: 'high', name: '究極の一手', cost: 5, maxLevel: 3,
    effects: [{ kind: 'repeat_power', value: 0.2 }],
    desc: '同じ技を続けるたびに火力 +20%',
  },
  {
    id: 'tr_variety_hi', tier: 'high', name: '万華の理', cost: 5, maxLevel: 3,
    effects: [{ kind: 'variety_power', value: 0.22 }],
    desc: '直前と違う技を使ったとき 火力+22%',
  },
  {
    id: 'tr_high_boost_hi', tier: 'high', name: '覇道', cost: 5, maxLevel: 3,
    effects: [{ kind: 'high_power_boost', value: 0.2 }],
    desc: '威力200%以上の技の火力 +20%',
  },
  {
    // 大技だけの上限突破 (§5.16)。
    //
    // 終盤は上限が全部の技を同じ高さに押し込めるので、
    // 威力180と威力520の最終ダメージがほぼ同じになっていた（実測 1.68M 対 1.81M）。
    // 大技帯に火力を足しても上限で消えるため、覇道までの投資が終盤で報われない。
    //
    // 上限突破は「上限が削っていたぶん」しか取り戻せず、素の計算値を超えては伸びない。
    // 青天井にならないので、大技だけに大きく配ってよい。
    id: 'tr_high_cap', tier: 'high', name: '極大', cost: 4, maxLevel: 5,
    effects: [{ kind: 'high_power_cap', value: 0.6 }],
    desc: '大技（威力200以上）のダメージ上限 +60%（他の技には乗らない）',
  },
  {
    id: 'tr_crit_stack_hi', tier: 'high', name: '熱狂の極致', cost: 5, maxLevel: 3,
    effects: [{ kind: 'crit_stack', value: 0.08 }],
    desc: '会心するたびにクリティカル率 +8%',
  },
  {
    id: 'tr_damage_share_hi', tier: 'high', name: '一蓮托生', cost: 5, maxLevel: 3,
    effects: [{ kind: 'damage_share', value: 0.18 }],
    desc: '受けたダメージの18%を味方全員で分けて背負う',
  },
  {
    id: 'tr_wave_revive_hi', tier: 'high', name: '輪廻', cost: 6, maxLevel: 2,
    effects: [{ kind: 'wave_revive', value: 0.6 }],
    desc: 'ウェーブが変わるとき、倒れていてもHP60%で立ち上がる',
  },
  {
    // 元は 8SP × 3段（1段あたり6%）だった。SPあたりの効率は特化型より
    // 良かった（0.045 対 0.040）が、**1段が重すぎた**。総予算154SPのうち
    // 5%を一括で払って見返りが確率6%では、踏み切る判断ができない。
    // 総額（24SP）と到達点はほぼ据え置きに、刻みを細かくして
    // 「少しだけ試す」を選べるようにした。
    id: 'tr_hit_all_status', tier: 'high', name: '万病の理', cost: 3, maxLevel: 8,
    effects: [{ kind: 'status_on_hit_kind', status: 'all', value: 0.03 }],
    desc: '攻撃時 3%の確率で、6種類すべての弱体をそれぞれ判定して付与する',
  },
  {
    id: 'tr_vs_all_status', tier: 'high', name: '弱者狩り', cost: 6, maxLevel: 3,
    effects: [{ kind: 'vs_status_power', status: 'all', value: 0.08 }],
    desc: '弱体にかかった敵への火力 +8%（種類ごとに重なる）',
  },
  {
    id: 'tr_def_to_atk_hi', tier: 'high', name: '鉄血の理', cost: 5, maxLevel: 3,
    effects: [{ kind: 'def_to_atk', value: 0.4 }],
    desc: 'DEFの40%をATKと魔力に上乗せ',
  },
  {
    id: 'tr_grant_ragnarok', tier: 'high', name: '終焉の型', cost: 6, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_ragnarok', value: 1 }],
    desc: 'アクティブ技「終焉」を習得（威力520%。大技ビルドの到達点）',
  },
  {
    id: 'tr_grant_glacier', tier: 'high', name: '氷河の型', cost: 5, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_glacier', value: 1 }],
    desc: 'アクティブ技「氷河期」を習得（全体に凍結を付与し、味方全員の火力を上げる）',
  },
  {
    id: 'tr_grant_purge', tier: 'high', name: '浄化の型', cost: 5, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_purge', value: 1 }],
    desc: 'アクティブ技「浄化」を習得（味方全体を回復し、障壁を張る）',
  },
  {
    id: 'tr_grant_vengeance', tier: 'high', name: '報復の型', cost: 5, maxLevel: 1,
    effects: [{ kind: 'grant_skill', skill: 'sk_tree_vengeance', value: 1 }],
    desc: 'アクティブ技「報復」を習得（被弾回数が多いほど威力が伸びる）',
  },

  /* ======================= 極 (§5.13) =======================
   *
   * ── なぜ要るのか ──
   * ツリー全体は322ノード2819SPあり、上限258では **9%しか取れない**。
   * 絶対量は余っていない。ところが上級帯だけは事情が違って、
   * **1つのビルドに要るものが全部収まってしまう**。
   * 実測では 大技+会心フルが215SPで、上級を5つ取ってなお43SP余った。
   * つまり上級帯で取捨選択が起きていない。
   *
   * ── なぜ排他ではなく代償にしたのか ──
   * 「AかBか」を仕組みで縛ると、既に両方振ってあるセーブを壊す。
   * 代償つきの選択肢を**足す**だけなら、既存の振り方は1つも動かない。
   * 取るか取らないかを本人が決める形になる。
   *
   * ── 作法（クラスの極点 §12 と同じ）──
   *   - 代償は必ず「そのビルドが痛い所」に置く。関係ない数値を削っても選択にならない
   *   - 素直な上積みを置かない。ポイントの行き先を作るだけなら数値インフレでしかない
   *   - どれも maxLevel 1。段階的に積むものではなく、**振り切るかどうか**の一点
   *
   * 仕組みは足していない。`stat_pct` の負値と、
   * `low/high_power_boost` が `situational *= 1 + 値` で負値を素通しすることで成り立つ。
   */
  {
    // 会心に全部賭ける。外したときの軽さが代償。
    // crit_stack・極点・痛打を積んでいないと、素の火力が落ちただけで終わる。
    id: 'tr_x_flash', tier: 'high', name: '【極】一閃', cost: 10, maxLevel: 1,
    effects: [
      // 会心率は配らない。**倍率だけ**を渡す。
      // 率を配ると、会心を一度も振っていないビルドにも効いてしまい、
      // 「素直な上積み」になる（実測で会心なしビルドに +47〜51% 出た）。
      // 倍率だけなら、会心する回数が少ない者には代償だけが残る。
      { kind: 'crit_damage', value: 1.3 },
      // 代償は名目ではなく**実効**で決める。
      // stat_pct は素のステータスにしか掛からず、終盤は装備がATKの2/3を占める。
      // 実測では名目 -25% がダメージ -8.6% にしかならなかった。
      // 名目 -0.7 でおよそ実効 -24%。表示と体感を合わせるため desc には実効を書く。
      { kind: 'stat_pct', stat: 'atk', value: -0.7 },
      { kind: 'stat_pct', stat: 'magi_power', value: -0.7 },
    ],
    desc: '会心倍率 +1.3。ただし素のATKと魔力 -70%（装備ぶんは減らないので、実際の火力は約 -25%）',
  },
  {
    // 大技以外を捨てる。繋ぎに中技や小技を撃つ回りが効かなくなる。
    // 代償にHPを置いたのは、大技ビルドが低頻度で殴る=殴られる回数が多いため。
    id: 'tr_x_crush', tier: 'high', name: '【極】剛撃', cost: 10, maxLevel: 1,
    effects: [
      { kind: 'high_power_boost', value: 0.9 },
      { kind: 'low_power_boost', value: -0.7 },
      { kind: 'stat_pct', stat: 'hp', value: -0.3 },
    ],
    desc: '大技の火力 +90%。ただし小技の火力 -70%、最大HP -30%',
  },
  {
    // 手数に全部賭ける。大技が死ぬので、一撃で沈める道が閉じる。
    id: 'tr_x_flurry', tier: 'high', name: '【極】乱撃', cost: 10, maxLevel: 1,
    effects: [
      { kind: 'low_power_boost', value: 1.1 },
      { kind: 'low_power_spread', value: 0.5 },
      { kind: 'high_power_boost', value: -0.8 },
    ],
    desc: '小技の火力 +110%、小技が50%で敵全体に及ぶ。ただし大技の火力 -80%',
  },
  {
    // 安定側の極 (§5.13)。一閃のちょうど裏返しで、会心を丸ごと捨てる。
    //
    // 振れ幅は 0.85〜1.15 で平均は動かないので、**安定だけでは弱い**。
    // 硬さと合わせて「大きく負けない」ことに全部を使う形にしてある。
    // 会心を一度も振っていないビルドには素直な上積みになるが、
    // それは会心の枝を丸ごと諦めた対価なので取引として成立している。
    id: 'tr_x_mirror', tier: 'high', name: '【極】明鏡', cost: 10, maxLevel: 1,
    effects: [
      { kind: 'stable_damage', value: 1 },
      { kind: 'reduction', value: 0.15 },
      { kind: 'stat_pct', stat: 'def', value: 0.4 },
      { kind: 'crit', value: -1 },
    ],
    desc: 'ダメージの振れ幅が消え、被ダメージ -15%、DEF +40%。ただし会心率 -100%',
  },

  /* ── 支援・回復の【極】 (§5.14) ──
   *
   * 攻撃側と違い、**下位ロールごとに1つずつ**置いてある。
   * 1枚にまとめると必ずどれかが割を食う。純ヒーラーに効く代償は
   * 神官戦士を締め出し、神官戦士が払える代償は純ヒーラーには無料になる。
   *
   * 「与ダメージ上限を削る」は採らなかった。上限は500,000で、
   * 純ヒーラーは一生その線に触れないので支払いにならない。
   * 効く強さまで下げると神官戦士と反転が締め出される。中間が無い。
   *
   * 代償は遮断フラグで作ってある。負の値では組めない
   * （buffAmount は power<=0 で素の値を返し、heal_power を下げると
   *   heal_to_power 経由で神官戦士の火力まで消える）。
   */
  {
    // 純ヒーラー。癒しに全部を注ぐので、自分の身が保たない。
    // 代償に遮断を使っていないのは、この役の通貨が「生き残って撒き続けること」だから。
    id: 'tr_x_devotion', tier: 'high', name: '【極】献身', cost: 10, maxLevel: 1,
    effects: [
      { kind: 'heal_power', value: 1.1 },
      { kind: 'heal_spread', value: 0.45 },
      { kind: 'triage', value: 0.6 },
      { kind: 'stat_pct', stat: 'hp', value: -0.35 },
      { kind: 'stat_pct', stat: 'atk', value: -0.9 },
    ],
    desc: '与える回復量 +110%、回復が他の味方へ45%及ぶ、瀕死への回復 +60%。'
      + 'ただし素の最大HP -35%、素のATK -90%',
  },
  {
    // 神官戦士。自分で立ち続けるが、隊列の回復役は務まらなくなる。
    id: 'tr_x_solitary', tier: 'high', name: '【極】独行', cost: 10, maxLevel: 1,
    effects: [
      { kind: 'heal_to_power', value: 0.35 },
      { kind: 'regen', value: 0.07 },
      { kind: 'mend_power', value: 0.5 },
      { kind: 'ally_heal_lock', value: 1 },
    ],
    desc: '「与える回復量」の伸びの35%が火力に乗り、毎ラウンド最大HPの7%回復、'
      + '受けた回復量ぶん火力 +50%。ただし味方を一切回復できなくなる',
  },
  {
    // 反転。自分を癒した余波だけで敵を焼く。味方には一滴も回らない。
    id: 'tr_x_stigma', tier: 'high', name: '【極】灼身', cost: 10, maxLevel: 1,
    effects: [
      { kind: 'smite', value: 0.9 },
      { kind: 'heal_power', value: 0.6 },
      { kind: 'ally_heal_lock', value: 1 },
    ],
    desc: '回復した量の90%が敵へ、与える回復量 +60%。'
      + 'ただし味方を一切回復できなくなる（自分を癒した余波だけが敵へ飛ぶ）',
  },
  {
    // 万軍。旗を振る者には何も起きない。
    id: 'tr_x_banner', tier: 'high', name: '【極】旗手', cost: 10, maxLevel: 1,
    effects: [
      { kind: 'buff_cap', value: 1 },
      { kind: 'ally_buff_power', value: 1.4 },
      { kind: 'buff_extend', value: 2 },
      { kind: 'self_buff_lock', value: 1 },
    ],
    desc: 'バフ効果量の上限 +100%、味方にかけるバフの効果量 +140%、持続 +2ターン。'
      + 'ただし自分でかけたバフは自分に乗らなくなる（味方からのバフは受けられる）',
  },
  {
    // 孤影。戴く頭は一つでよい。
    id: 'tr_x_sovereign', tier: 'high', name: '【極】独尊', cost: 10, maxLevel: 1,
    effects: [
      { kind: 'buff_cap', value: 1 },
      { kind: 'self_buff_power', value: 1.6 },
      { kind: 'support_stack', value: 0.12 },
      { kind: 'solo_buff', value: 1 },
    ],
    desc: 'バフ効果量の上限 +100%、自分にかけるバフの効果量 +160%、バフをかけるたび +12%。'
      + 'ただし自分がかけたバフは味方に一切通らなくなる',
  },
];
