// @ts-check
/**
 * スキルツリー (§5) のロジック。
 *
 * 前提条件の判定は「対象ティア群への累計投資レベルの比較」だけで完結する。
 * ノード間の依存グラフを持たないので、バグの入り込む余地が小さい (§5.1)。
 */
(function (RPG) {
  'use strict';

  /** 属性の一覧。element: 'all' を展開するのに使う。 */
  const ELEMENTS = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];

  /** 系統タグの一覧。tag: 'all' を展開するのに使う。 */
  const TAGS = ['phys', 'magi', 'reli'];

  /** 状態異常の一覧。status: 'all' を展開するのに使う (§5.8)。 */
  const STATUS_KINDS = ['poison', 'burn', 'bleed', 'paralyze', 'freeze', 'curse'];

  /** @returns {any[]} */
  function nodes() {
    return RPG.data.skillTree;
  }

  /**
   * @param {string} nodeId
   * @returns {any}
   */
  function node(nodeId) {
    return nodes().find((n) => n.id === nodeId);
  }

  /**
   * ノードの分類を返す (§5.9)。
   *
   * 判定は **最初の効果種別** を優先する。ノードの effects は
   * 「そのノードを名乗る効果」を先頭に書く決まりなので、
   * `chaos + stat_pct` のような複合ノードでも「属性戦略」に正しく入る。
   * 先頭で決まらなければ残りの効果を順に見て、どれも該当しなければ「その他」。
   *
   * @param {any} node
   * @returns {any} 分類定義
   */
  function category(node) {
    const cats = RPG.data.nodeCategories || [];
    const kinds = (node.effects || []).map((/** @type {any} */ e) => e.kind);

    for (const kind of kinds) {
      const hit = cats.find((/** @type {any} */ c) => c.kinds.includes(kind));
      if (hit) return hit;
    }
    return RPG.data.nodeCategoryFallback;
  }

  /**
   * ティア内をさらに分類ごとにまとめる (§5.9)。
   * 252ノードを1つのグリッドに並べると探せないので、画面はこの単位で畳む。
   *
   * @param {string} tier
   * @param {(node: any) => boolean} [filter] 通ったノードだけを残す
   * @returns {Array<{cat: any, nodes: any[]}>}
   */
  function byCategory(tier, filter) {
    /** @type {Map<string, {cat: any, nodes: any[]}>} */
    const map = new Map();
    for (const n of nodes()) {
      if (n.tier !== tier) continue;
      if (filter && !filter(n)) continue;
      const cat = category(n);
      if (!map.has(cat.id)) map.set(cat.id, { cat, nodes: [] });
      map.get(cat.id).nodes.push(n);
    }
    // カタログの並び順を保つ。定義順がそのまま画面の並びになる。
    const order = (RPG.data.nodeCategories || []).map((/** @type {any} */ c) => c.id);
    return [...map.values()].sort((a, b) => {
      const ia = order.indexOf(a.cat.id);
      const ib = order.indexOf(b.cat.id);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });
  }

  /**
   * ティアごとにノードをまとめる。
   * @returns {Array<{tier: string, label: string, nodes: any[]}>}
   */
  function grouped() {
    const tiers = RPG.data.skillTreeTiers;
    return Object.keys(tiers)
      .sort((a, b) => tiers[a].order - tiers[b].order)
      .map((tier) => ({
        tier,
        label: tiers[tier].label,
        nodes: nodes().filter((n) => n.tier === tier),
      }));
  }

  /**
   * 指定したティア群への累計投資レベル数。
   * @param {Record<string, number>} tree
   * @param {string[]} tiers
   */
  function investedLevels(tree, tiers) {
    let total = 0;
    for (const id of Object.keys(tree || {})) {
      const n = node(id);
      if (n && tiers.includes(n.tier)) total += tree[id];
    }
    return total;
  }

  /**
   * ティアが解放されているか (§5.1)。
   * @param {Record<string, number>} tree
   * @param {string} tier
   */
  function tierUnlocked(tree, tier) {
    const def = RPG.data.skillTreeTiers[tier];
    if (!def || def.requiresLevels === 0) return true;
    return investedLevels(tree, def.countsFrom) >= def.requiresLevels;
  }

  /**
   * ティア解放まであと何レベル必要か。0なら解放済み。
   * @param {Record<string, number>} tree
   * @param {string} tier
   */
  function tierRemaining(tree, tier) {
    const def = RPG.data.skillTreeTiers[tier];
    if (!def || def.requiresLevels === 0) return 0;
    return Math.max(0, def.requiresLevels - investedLevels(tree, def.countsFrom));
  }

  /**
   * 消費済みSP。
   * @param {Record<string, number>} tree
   */
  function spentSp(tree) {
    let total = 0;
    for (const id of Object.keys(tree || {})) {
      const n = node(id);
      if (n) total += tree[id] * n.cost;
    }
    return total;
  }

  /**
   * ノードに1レベル投資できるか。できない場合は理由を返す。
   * @param {any} charSave
   * @param {string} nodeId
   * @returns {{ ok: boolean, reason?: string }}
   */
  function canInvest(charSave, nodeId) {
    const n = node(nodeId);
    if (!n) return { ok: false, reason: '不明なノード' };

    const tree = charSave.tree || {};
    const current = tree[nodeId] || 0;
    if (current >= n.maxLevel) return { ok: false, reason: '最大レベル' };

    if (!tierUnlocked(tree, n.tier)) {
      const need = tierRemaining(tree, n.tier);
      const from = RPG.data.skillTreeTiers[n.tier].countsFrom
        .map((/** @type {string} */ t) => RPG.data.skillTreeTiers[t].label)
        .join('＋');
      return { ok: false, reason: `${from}に あと${need}レベル 投資が必要` };
    }

    const available = (charSave.level - 1) + charSave.limitBreak - spentSp(tree);
    if (available < n.cost) return { ok: false, reason: `SPが${n.cost - available}足りない` };

    return { ok: true };
  }

  /**
   * ノードから1レベル戻せるか (§5.5)。
   *
   * ── なぜ判定が要るか ──
   * 中級は初級に5レベル、上級は初級＋中級に10レベル入っていることが条件。
   * 初級から抜くと、その条件を満たさなくなった上位ノードが
   * 「投資済みだが解放されていない」状態で残る。効果は生きたまま
   * 画面には錠前が出る、という説明のつかない盤面になる。
   *
   * 抜いた後の姿で全ノードを見直し、破綻するなら断る。
   * 上から順に外せば必ず抜けるので、行き止まりにはならない。
   *
   * @param {any} charSave
   * @param {string} nodeId
   * @returns {{ ok: boolean, reason?: string, cost?: number }}
   */
  function canRefund(charSave, nodeId) {
    const n = node(nodeId);
    if (!n) return { ok: false, reason: '不明なノード' };

    const tree = charSave.tree || {};
    const current = tree[nodeId] || 0;
    if (current <= 0) return { ok: false, reason: 'まだ振っていない' };

    // 1レベル抜いた後の姿を作って、条件が崩れないか確かめる
    const after = Object.assign({}, tree);
    if (current === 1) delete after[nodeId];
    else after[nodeId] = current - 1;

    for (const id of Object.keys(after)) {
      const other = node(id);
      if (!other || after[id] <= 0) continue;
      if (!tierUnlocked(after, other.tier)) {
        const label = RPG.data.skillTreeTiers[other.tier].label;
        return { ok: false, reason: `${label}の「${other.name}」が解放条件を割る。先にそちらを戻す` };
      }
    }

    return { ok: true, cost: refundCost(n) };
  }

  /**
   * 1レベル戻すのにかかるゴールド (§5.5)。
   * @param {any} n ノード定義
   */
  function refundCost(n) {
    return (n.cost || 1) * (RPG.data.skillRefundCostPerSp || 0);
  }

  /**
   * ツリーの投資内容を、ユニット構築で使える形の効果に畳み込む。
   * @param {Record<string, number>} tree
   */
  function effects(tree) {
    /** @type {any[]} */
    const defs = [];
    for (const id of Object.keys(tree || {})) {
      const n = node(id);
      if (n) defs.push(n);
    }
    return effectsOf(defs, tree || {});
  }

  /**
   * effectsOf が解釈できる効果種別の全体 (§18)。
   *
   * ここに無い kind は **黙って捨てられる**。効果は乗らないのに
   * ノードは画面に出るので、書いた側からは「効いていない」としか見えない。
   * 拡張コンテンツの検査 (src/core/content.js) がこの一覧を見る。
   *
   * 中身は下の switch から機械的に写したもの。ずれると検査が意味を失うので、
   * test/tests.js が tree.js を読み直して突き合わせている。
   */
  const KNOWN_EFFECT_KINDS = [
    'all_spread', 'ambush', 'atk_to_def', 'auto_low_skill', 'back_guard', 'boss_guard',
    'boss_slayer', 'buff_duration', 'buff_on_kill', 'cap_break', 'chain', 'chain_power',
    'chaos', 'combo_gain', 'combo_keep', 'combo_power', 'cooldown_cut',
    'counter', 'counter_all',
    'counter_power', 'crit', 'crit_combo', 'crit_damage', 'crit_execute', 'crit_heal',
    'crit_pierce', 'crit_spread', 'crit_stack', 'damage_share', 'debuff_amp',
    'debuff_duration', 'debuff_resist', 'debuff_spread', 'def_to_atk', 'double_hits',
    'dual_element', 'element_adapt', 'element_convert', 'element_crit', 'element_mastery',
    'element_pierce', 'element_power', 'element_resist', 'evade', 'execute', 'extra_action',
    'first_hit_crit', 'first_round_power', 'foe_count_power', 'focus_power',
    'front_power',
    'full_hp_foe_power', 'grant_skill', 'guard_ally', 'guard_break', 'heal_on_kill',
    'heal_power', 'high_hp_power', 'high_power_boost', 'hit_stack', 'hp_to_atk',
    'hp_to_def', 'kill_extra_action', 'last_stand', 'lifesteal', 'lone_foe_power',
    'low_hp_guard', 'low_hp_power', 'low_power_boost', 'low_power_repeat',
    'low_power_spread', 'mend_power', 'mid_power_combo', 'mid_power_status',
    'mono_element_power',
    'neutral_power', 'opening_buff', 'overheal_shield', 'overkill_carry',
    'party_size_power', 'rainbow_power', 'reduction', 'reflect', 'regen',
    'relay_power', 'repeat_power',
    'revive', 'round_stack', 'shield_regen', 'slot', 'solo_power', 'stable_damage',
    'start_shield', 'stat_pct', 'status_immune', 'status_on_hit', 'status_on_hit_kind',
    'self_curse_power', 'sigil_burst',
    'status_power', 'status_resist_kind', 'tag_all', 'tag_bonus', 'tag_crit', 'tag_pierce',
    'thorns', 'variety_power', 'vs_status_power', 'wave_heal', 'wave_power', 'wave_revive',
    'wave_stack', 'weak_guard', 'weak_hunter'
  ];

  /**
   * ノード定義と投資レベルを受け取って効果を畳み込む (§5 / §12)。
   *
   * effects() から切り出してあるのは、クラス (§12) が
   * **同じ効果種別を別のノード表で使う** ため。
   * 集約のルールを1か所に保てるので、効果種別を足したときに
   * ツリーとクラスで挙動がずれることがない。
   *
   * @param {any[]} defs 効果を持つノードの配列
   * @param {Record<string, number>} levels ノードID → 投資レベル
   */
  function effectsOf(defs, levels) {
    /** @type {Record<string, number>} */
    const statPct = { hp: 0, atk: 0, def: 0, magi_power: 0 };
    /** @type {Array<{tag: string, value: number, matchType: null}>} */
    const tagBonuses = [];
    /** @type {Record<string, number>} */
    const slots = { weapon: 0, armor: 0, accessory: 0 };
    /** @type {Record<string, number>} */
    const mastery = {};
    /** @type {string[]} ツリーで習得したアクティブ技 (§5.1) */
    const skills = [];
    /** 戦闘中に効くパッシブ。戦闘エンジンが参照する */
    const passives = {
      lifesteal: 0,        // 与ダメージのうちHPに還元される割合
      regen: 0,            // ラウンド終了時に回復する最大HPの割合
      counterRate: 0,      // 被弾時に反撃する確率
      counterPower: 0,     // 反撃の威力倍率
      reviveHp: 0,         // 戦闘不能時に復活するHPの割合（1戦闘1回）
      extraActionRate: 0,  // 行動後にもう一度動ける確率
      evade: 0,            // 攻撃を丸ごと避ける確率
      focusPower: 0,       // 同じ相手を続けて殴るほど上がる火力
      relayPower: 0,       // 直前に動いた味方と違う系統で攻めたときの火力
      mendPower: 0,        // 回復を受けた回数だけ上がる火力
      cooldownCut: 0,      // クラス技のクールタイム短縮（ラウンド）
      selfCursePower: 0,   // 自分にかかっている弱体1つにつき上がる火力
      sigilBurst: 0,       // 殴るたびに刻印が積み、溜まると弾ける（最大HP割合）
      thorns: 0,           // 被弾時に相手の最大HPの割合で反射
      lastStand: 0,        // 致死ダメージをHP1で耐える確率（1戦闘1回）
      waveHeal: 0,         // ウェーブ開始時に回復する最大HPの割合
      chain: 0,            // 単体攻撃が他の敵にも及ぶ割合
      guardBreak: 0,       // 攻撃時に防御を無視する確率
      doubleHits: 0,       // 攻撃技の追加発動回数
      atkScale: 1,         // ATKへの倍率（二回攻撃の代償など）
      openingBuff: 0,      // 戦闘開始時に得る固有バフ
      // 小技の使い道 (§4.3)。威力100%以下の技だけに効く。
      // 中技の役割 (§5.8)。火力ではなく「効果を通す」側で伸ばす。
      midPowerStatus: 0,   // 中技で攻撃したときの弱体付与率への倍率
      midPowerCombo: 0,    // 中技で弱点コンボを積む段数への上乗せ
      lowPowerBoost: 0,    // 小技の威力への上乗せ
      autoLowSkill: 0,     // 攻撃後に小技が自動で飛ぶ確率
      lowPowerSpread: 0,   // 小技が敵全体に当たるようになる
      lowPowerRepeat: 0,   // 小技の追加発動回数
      // 状態異常まわり (§5.6)
      statusPower: 0,      // 自分が与える継続ダメージの割合を増やす
      debuffDuration: 0,   // 自分が与えるデバフの持続を延ばす
      debuffResist: 0,     // 自分が受けるデバフの持続を縮める
      // 会心まわり
      critHeal: 0,         // 会心時に与ダメージの割合でHPを回復
      critCombo: 0,        // 会心時に弱点コンボを追加で積む
      // 戦況まわり（battle.js が倍率にまとめる）
      foeCountPower: 0,    // 敵1体につき火力上昇
      loneFoePower: 0,     // 敵が1体だけのときの火力上昇
      waveStack: 0,        // ウェーブを越えるごとに蓄積する火力
      // 生存まわり
      overhealShield: 0,   // 回復の超過分をバリアに変える割合
      guardAlly: 0,        // 味方が受けるダメージを肩代わりする割合
      hpToAtk: 0,          // 最大HPの一部を攻撃力と魔力に上乗せ
      hpToDef: 0,          // 最大HPの一部をDEFに上乗せ（防御で耐える道 §5.8）
      // 安定性
      stableDamage: 0,     // ダメージの下振れを縮める
      ambush: 0,           // 1ラウンド目に追加行動する確率
      // --- 弱点コンボまわり (§5.7)。手動戦闘を押し上げる軸 ---
      comboGain: 0,        // 弱点を突いたときに追加で積まれる段数
      comboKeep: 0,        // 外したときにコンボが落ちにくくなる確率
      comboPower: 0,       // コンボ1段あたりの倍率への上乗せ
      // --- 回復・防護 ---
      healPower: 0,        // 自分が行う回復量の上乗せ
      healOnKill: 0,       // 敵を倒したときに回復する最大HPの割合
      startShield: 0,      // 戦闘開始時に張る障壁（最大HPの割合）
      statusImmune: 0,     // 弱体をはねのける確率（1.0で無効）
      lowHpGuard: 0,       // HPが減っているときに乗る被ダメージ軽減
      reflect: 0,          // 受けたダメージのうち相手へ跳ね返す割合
      // --- 隊列 (§5.7)。並び順を選ぶ意味を作る ---
      frontPower: 0,       // 前に並んでいるほど上がる火力
      backGuard: 0,        // 後ろに並んでいるほど上がる被ダメージ軽減
      // --- 戦況の蓄積 ---
      roundStack: 0,       // ラウンドを重ねるごとに積み上がる火力
      hitStack: 0,         // 被弾するごとに積み上がる火力
      partySizePower: 0,   // 生存している味方1人につき上がる火力
      soloPower: 0,        // 生存が自分だけのときの火力
      monoElementPower: 0, // パーティ全員が同じ属性のときの火力
      rainbowPower: 0,     // パーティの属性が全員バラバラのときの火力
      // --- 攻撃の挙動 ---
      firstHitCrit: 0,     // ウェーブ最初の攻撃を確定会心にする段数
      overkillCarry: 0,    // 敵を倒した超過ダメージを次の一撃へ持ち越す割合
      statusOnHit: 0,      // 攻撃時に毒を撒く確率
      killExtraAction: 0,  // 敵を倒したときにもう一度動ける確率
      debuffSpread: 0,     // 与えた弱体が他の敵へ広がる確率
      allSpread: 0,        // 単体攻撃技がすべて全体化する
      // --- 状態異常の運用 (§5.8) ---
      /** @type {Record<string, number>} 種類ごとの「攻撃時に撒く確率」 */
      statusOnHitKind: {},
      /** @type {Record<string, number>} 種類ごとの「その異常にかかった敵への火力」 */
      vsStatusPower: {},
      /** @type {Record<string, number>} 種類ごとの「受けたときの持続短縮」 */
      statusResistKind: {},
      // --- 会心の広がり (§5.8) ---
      critStack: 0,        // 会心するたびに上がる会心率（戦闘中だけ積む）
      critSpread: 0,       // 会心したとき他の敵へ及ぶ余波の割合
      // --- 反撃・波及 (§5.8) ---
      counterAll: 0,       // 反撃が敵全体に及ぶ
      chainPower: 0,       // 波及の威力への上乗せ
      // --- バフの扱い (§5.8) ---
      buffDuration: 0,     // 自分が受けるバフの持続を延ばすターン数
      buffOnKill: 0,       // 敵を倒したときに得る固有バフ
      shieldRegen: 0,      // ラウンド終了時に張り直す障壁（最大HPの割合）
      // --- 技の使い分け (§5.8) ---
      repeatPower: 0,      // 同じ技を続けるほど上がる火力
      varietyPower: 0,     // 直前と違う技を使ったときの火力
      // --- 生存・戦況 (§5.8) ---
      damageShare: 0,      // 受けたダメージを味方全体で分け合う割合
      waveRevive: 0,       // ウェーブ開始時に復活するHPの割合
      wavePower: 0,        // 最終ウェーブ（ボス戦）での火力
    };
    /** ダメージ計算に渡す状況依存の補正 */
    const situational = {
      lowHpPower: 0, highHpPower: 0, bossSlayer: 0, debuffAmp: 0, firstRoundPower: 0,
      // 属性の噛み合いで決まるもの (§5.7)。damage.js が素の相性を見て判定する。
      weakHunter: 0,          // 有利を取れたときに伸びる
      neutralPower: 0,        // 等倍のときに伸びる（無属性ビルドの受け皿）
      weakGuard: 0,           // 弱点を突かれたときの被害を減らす
      critPierce: 0,          // 会心のときだけ防御を無視する割合
      // §5.8
      highPowerBoost: 0,      // 威力の大きい技だけを底上げする
      critExecute: 0,         // 会心したときだけ追い打ちが強くなる
      fullHpFoePower: 0,      // HPが減っていない敵への火力（追い打ちの裏返し）
      bossGuard: 0,           // ボスから受けるダメージを減らす
    };
    /** @type {Record<string, number>} 属性ごとのクリティカル率加算 */
    const elementCrit = {};
    /** @type {Record<string, number>} 系統タグごとのクリティカル率加算 */
    const tagCrit = {};
    /** @type {Record<string, number>} 系統タグごとの防御無視 */
    const tagPierce = {};
    /** @type {Record<string, number>} 属性ごとの威力上乗せ（相性倍率とは別枠） */
    const elementPower = {};
    /** @type {Record<string, number>} 属性ごとの被ダメージ軽減 */
    const elementResist = {};
    /** @type {string|null} 「双極」— もう1つの属性でも相性判定し、有利なほうを採る */
    let dualElement = null;
    let crit = 0;
    let critDamage = 0;
    let capBreak = 0;
    let execute = 0;
    let reduction = 0;
    let adapt = 0;
    let pierce = 0;
    let chaos = false;
    let convert = null;   // 全攻撃を固定する属性 (§5.6)

    /** @type {Record<string, number>} タグごとに合算してから1本にまとめる */
    const tagSums = { phys: 0, magi: 0, reli: 0 };

    /**
     * 「高いほうを採る」種別の畳み込み (§5.8)。
     *
     * ── なぜ Math.max なのか ──
     * 復活・致死耐えは **1戦闘に1回** しか起きない。足し算にすると
     * 低位ノードを重ねるだけで確率が1を超え、段階を作った意味が消える。
     * 同じ効果の上位ノードを取ったら、下位を「置き換える」のが正しい。
     *
     * ── ただし e.value ではなく amount を渡すこと ──
     * e.value を渡していたせいで、**同じノードを重ねても伸びなかった**。
     * 2段目以降のSPは払えるのに何も起きない状態が、
     * 不撓(6SP) 不屈の魂(8SP) 輪廻(6SP) 不撓の祈り(2CP) の4つに残っていた。
     * amount は value×レベルなので、これで段数が効くようになる。
     *
     * 確率とHP割合なので1で頭打ちにする。
     *
     * @param {number} cur @param {number} next
     */
    const capped = (cur, next) => Math.min(1, Math.max(cur, next));

    for (const n of defs) {
      const level = levels[n.id];
      if (!level) continue;

      for (const e of n.effects) {
        const amount = e.value * level;
        switch (e.kind) {
          case 'stat_pct': statPct[e.stat] += amount; break;
          case 'tag_bonus': tagSums[e.tag] += amount; break;
          case 'tag_all':
            tagSums.phys += amount; tagSums.magi += amount; tagSums.reli += amount;
            break;
          case 'crit': crit += amount; break;
          case 'crit_damage': critDamage += amount; break;
          case 'cap_break': capBreak += amount; break;
          case 'execute': execute += amount; break;
          case 'reduction': reduction += amount; break;
          case 'lifesteal': passives.lifesteal += amount; break;
          case 'regen': passives.regen += amount; break;
          case 'counter':
            passives.counterRate += amount;
            passives.counterPower = Math.max(passives.counterPower, e.power || 0.6);
            break;
          case 'revive': passives.reviveHp = capped(passives.reviveHp, amount); break;
          case 'extra_action': passives.extraActionRate += amount; break;
          case 'thorns': passives.thorns += amount; break;
          case 'double_hits': passives.doubleHits += amount; break;
          case 'last_stand': passives.lastStand = capped(passives.lastStand, amount); break;
          case 'wave_heal': passives.waveHeal += amount; break;
          case 'chain': passives.chain += amount; break;
          case 'guard_break': passives.guardBreak += amount; break;
          case 'opening_buff': passives.openingBuff += amount; break;
          // 状況依存の補正
          case 'low_hp_power': situational.lowHpPower += amount; break;
          case 'high_hp_power': situational.highHpPower += amount; break;
          case 'boss_slayer': situational.bossSlayer += amount; break;
          case 'debuff_amp': situational.debuffAmp += amount; break;
          case 'first_round_power': situational.firstRoundPower += amount; break;
          case 'element_pierce': pierce += amount; break;
          // 中技の使い道 (§5.8)
          case 'mid_power_status': passives.midPowerStatus += amount; break;
          case 'mid_power_combo': passives.midPowerCombo += amount; break;
          // 小技の使い道 (§4.3)
          case 'low_power_boost': passives.lowPowerBoost += amount; break;
          case 'auto_low_skill': passives.autoLowSkill += amount; break;
          case 'low_power_spread': passives.lowPowerSpread += amount; break;
          case 'low_power_repeat': passives.lowPowerRepeat += amount; break;
          // 状態異常・会心・戦況・生存・安定性 (§5.6)
          case 'status_power': passives.statusPower += amount; break;
          case 'self_curse_power': passives.selfCursePower += amount; break;
          case 'evade': passives.evade += amount; break;
          case 'focus_power': passives.focusPower += amount; break;
          case 'relay_power': passives.relayPower += amount; break;
          case 'mend_power': passives.mendPower += amount; break;
          case 'cooldown_cut': passives.cooldownCut += amount; break;
          case 'sigil_burst': passives.sigilBurst += amount; break;
          case 'debuff_duration': passives.debuffDuration += amount; break;
          case 'debuff_resist': passives.debuffResist += amount; break;
          case 'crit_heal': passives.critHeal += amount; break;
          case 'crit_combo': passives.critCombo += amount; break;
          case 'foe_count_power': passives.foeCountPower += amount; break;
          case 'lone_foe_power': passives.loneFoePower += amount; break;
          case 'wave_stack': passives.waveStack += amount; break;
          case 'overheal_shield': passives.overhealShield += amount; break;
          case 'guard_ally': passives.guardAlly += amount; break;
          case 'hp_to_atk': passives.hpToAtk += amount; break;
          case 'hp_to_def': passives.hpToDef += amount; break;
          case 'stable_damage': passives.stableDamage += amount; break;
          case 'ambush': passives.ambush += amount; break;
          case 'element_convert': convert = e.element; break;
          // --- 弱点コンボ・回復・隊列・戦況 (§5.7) ---
          case 'combo_gain': passives.comboGain += amount; break;
          case 'combo_keep': passives.comboKeep += amount; break;
          case 'combo_power': passives.comboPower += amount; break;
          case 'heal_power': passives.healPower += amount; break;
          case 'heal_on_kill': passives.healOnKill += amount; break;
          case 'start_shield': passives.startShield += amount; break;
          case 'status_immune': passives.statusImmune += amount; break;
          case 'low_hp_guard': passives.lowHpGuard += amount; break;
          case 'reflect': passives.reflect += amount; break;
          case 'front_power': passives.frontPower += amount; break;
          case 'back_guard': passives.backGuard += amount; break;
          case 'round_stack': passives.roundStack += amount; break;
          case 'hit_stack': passives.hitStack += amount; break;
          case 'party_size_power': passives.partySizePower += amount; break;
          case 'solo_power': passives.soloPower += amount; break;
          case 'mono_element_power': passives.monoElementPower += amount; break;
          case 'rainbow_power': passives.rainbowPower += amount; break;
          case 'first_hit_crit': passives.firstHitCrit += level; break;
          case 'overkill_carry': passives.overkillCarry += amount; break;
          case 'status_on_hit': passives.statusOnHit += amount; break;
          case 'kill_extra_action': passives.killExtraAction += amount; break;
          case 'debuff_spread': passives.debuffSpread += amount; break;
          case 'all_spread': passives.allSpread += amount; break;
          // --- 属性の噛み合い (§5.7) ---
          case 'weak_hunter': situational.weakHunter += amount; break;
          case 'neutral_power': situational.neutralPower += amount; break;
          case 'weak_guard': situational.weakGuard += amount; break;
          case 'crit_pierce': situational.critPierce += amount; break;
          case 'element_power':
            // element: 'all' なら全属性まとめて。属性を絞るほど1段あたりが大きい。
            for (const el of (e.element === 'all' ? ELEMENTS : [e.element])) {
              elementPower[el] = (elementPower[el] || 0) + amount;
            }
            break;
          case 'element_resist':
            for (const el of (e.element === 'all' ? ELEMENTS : [e.element])) {
              elementResist[el] = (elementResist[el] || 0) + amount;
            }
            break;
          case 'dual_element': dualElement = e.element; break;
          // --- 状態異常の運用 (§5.8) ---
          // kind: 'all' なら全種類まとめて。1種に絞るほど1段あたりが大きい。
          case 'status_on_hit_kind':
            for (const k of (e.status === 'all' ? STATUS_KINDS : [e.status])) {
              passives.statusOnHitKind[k] = Math.min(1, (passives.statusOnHitKind[k] || 0) + amount);
            }
            break;
          case 'vs_status_power':
            for (const k of (e.status === 'all' ? STATUS_KINDS : [e.status])) {
              passives.vsStatusPower[k] = (passives.vsStatusPower[k] || 0) + amount;
            }
            break;
          case 'status_resist_kind':
            for (const k of (e.status === 'all' ? STATUS_KINDS : [e.status])) {
              passives.statusResistKind[k] = (passives.statusResistKind[k] || 0) + amount;
            }
            break;
          // --- 会心・反撃・波及 (§5.8) ---
          case 'crit_stack': passives.critStack += amount; break;
          case 'crit_spread': passives.critSpread += amount; break;
          case 'crit_execute': situational.critExecute += amount; break;
          case 'counter_power': passives.counterPower += amount; break;
          case 'counter_all': passives.counterAll += amount; break;
          case 'chain_power': passives.chainPower += amount; break;
          // --- バフ・障壁 (§5.8) ---
          case 'buff_duration': passives.buffDuration += amount; break;
          case 'buff_on_kill': passives.buffOnKill += amount; break;
          case 'shield_regen': passives.shieldRegen += amount; break;
          // --- 技の使い分け (§5.8) ---
          case 'repeat_power': passives.repeatPower += amount; break;
          case 'variety_power': passives.varietyPower += amount; break;
          case 'high_power_boost': situational.highPowerBoost += amount; break;
          // --- 生存・戦況 (§5.8) ---
          case 'damage_share': passives.damageShare += amount; break;
          case 'wave_revive': passives.waveRevive = capped(passives.waveRevive, amount); break;
          case 'wave_power': passives.wavePower += amount; break;
          case 'full_hp_foe_power': situational.fullHpFoePower += amount; break;
          case 'boss_guard': situational.bossGuard += amount; break;
          // --- ステータス変換 (§5.8) ---
          case 'def_to_atk': passives.defToAtk = (passives.defToAtk || 0) + amount; break;
          case 'atk_to_def': passives.atkToDef = (passives.atkToDef || 0) + amount; break;
          // --- 属性・系統ごとの会心と貫通 (§5.8) ---
          case 'element_crit':
            for (const el of (e.element === 'all' ? ELEMENTS : [e.element])) {
              elementCrit[el] = (elementCrit[el] || 0) + amount;
            }
            break;
          case 'tag_crit':
            for (const tg of (e.tag === 'all' ? TAGS : [e.tag])) {
              tagCrit[tg] = (tagCrit[tg] || 0) + amount;
            }
            break;
          case 'tag_pierce':
            for (const tg of (e.tag === 'all' ? TAGS : [e.tag])) {
              tagPierce[tg] = Math.min(1, (tagPierce[tg] || 0) + amount);
            }
            break;
          // ツリーで習得するアクティブ技。レベルは1固定で、重複しても1つだけ入る (§5.1)
          case 'grant_skill':
            if (!skills.includes(e.skill)) skills.push(e.skill);
            break;
          case 'slot': slots[e.slot] += amount; break;
          case 'element_adapt': adapt += amount; break;
          case 'element_mastery':
            // 有利倍率 1.5 を起点に、極意の投資量ぶん引き上げる。
            // element: 'all' は「万象の極意」— 薄く全属性に配る (§5.8)。
            for (const el of (e.element === 'all' ? ELEMENTS : [e.element])) {
              mastery[el] = Math.max(mastery[el] || 0, 1.5) + amount;
            }
            break;
          case 'chaos': chaos = true; break;
          default: break;
        }
      }
    }

    for (const tag of ['phys', 'magi', 'reli']) {
      if (tagSums[tag] !== 0) tagBonuses.push({ tag, value: tagSums[tag], matchType: null });
    }

    /** @type {any} */
    const elementMods = {};
    if (adapt > 0) elementMods.adapt = adapt;
    if (chaos) elementMods.chaos = true;
    if (convert) elementMods.convert = convert;
    if (pierce > 0) elementMods.pierce = Math.min(1, pierce);
    if (Object.keys(mastery).length) elementMods.mastery = mastery;
    if (dualElement) elementMods.dual = dualElement;
    if (Object.keys(elementPower).length) elementMods.power = elementPower;
    if (Object.keys(elementResist).length) elementMods.resist = elementResist;
    if (Object.keys(elementCrit).length) elementMods.crit = elementCrit;
    if (Object.keys(tagCrit).length) elementMods.tagCrit = tagCrit;
    if (Object.keys(tagPierce).length) elementMods.tagPierce = tagPierce;

    // 軽減は合計1.0（＝無敵）を上限にする (§3.1-3)
    reduction = Math.min(1, reduction);
    // 再行動が無限に続かないよう上限を設ける
    passives.extraActionRate = Math.min(0.5, passives.extraActionRate);

    // 連鎖・防御無視・耐えは確率なので上限を設ける
    passives.chain = Math.min(1, passives.chain);
    passives.guardBreak = Math.min(1, passives.guardBreak);
    passives.lastStand = Math.min(1, passives.lastStand);

    // 確率もの・軽減ものは上限を設ける (§5.7)。
    // 特に「跳ね返し」は無限ループの温床なので、必ず1未満に抑える。
    passives.statusImmune = Math.min(1, passives.statusImmune);
    passives.comboKeep = Math.min(1, passives.comboKeep);
    passives.reflect = Math.min(0.9, passives.reflect);
    passives.lowHpGuard = Math.min(0.8, passives.lowHpGuard);
    passives.backGuard = Math.min(0.8, passives.backGuard);
    passives.statusOnHit = Math.min(1, passives.statusOnHit);
    passives.killExtraAction = Math.min(0.6, passives.killExtraAction);
    passives.debuffSpread = Math.min(1, passives.debuffSpread);
    passives.overkillCarry = Math.min(1, passives.overkillCarry);
    // §5.8 のぶん。分け合い・波及・余波は連鎖しやすいので必ず頭を押さえる。
    passives.damageShare = Math.min(0.8, passives.damageShare);
    passives.critSpread = Math.min(1, passives.critSpread);
    passives.counterAll = Math.min(1, passives.counterAll);

    return {
      statPct, tagBonuses, slots, crit, critDamage, capBreak,
      execute, reduction, skills, passives, situational, elementMods,
    };
  }

  /**
   * effects() の戻り値どうしを合流させる (§12)。
   *
   * スキルツリーとクラスは同じ効果種別を使うので、どちらも同じ形の結果を返す。
   * ここで足し方の決まりを1か所にまとめておけば、
   * 「ツリーでは加算なのにクラスでは上書き」といったズレが起きない。
   *
   * 足し方は3種類しかない:
   *   加算   … ほとんどの数値
   *   最大値 … 復活・不屈のような「1回だけ」の効果
   *   乗算   … atkScale（代償の倍率）
   *
   * @param {any} base 土台（破壊的に変更しない）
   * @param {any} add 合流させるもの。null なら base をそのまま返す
   */
  function mergeEffects(base, add) {
    if (!add) return base;

    /** 「1回だけ」系は足さずに強いほうを採る */
    const MAX_KEYS = ['reviveHp', 'lastStand', 'waveRevive'];

    const out = {
      statPct: Object.assign({}, base.statPct),
      tagBonuses: base.tagBonuses.concat(add.tagBonuses),
      slots: Object.assign({}, base.slots),
      crit: base.crit + add.crit,
      critDamage: base.critDamage + add.critDamage,
      capBreak: base.capBreak + add.capBreak,
      execute: base.execute + add.execute,
      reduction: Math.min(1, base.reduction + add.reduction),
      skills: base.skills.slice(),
      passives: Object.assign({}, base.passives),
      situational: Object.assign({}, base.situational),
      elementMods: Object.assign({}, base.elementMods),
    };

    for (const k of Object.keys(add.statPct)) {
      out.statPct[k] = (out.statPct[k] || 0) + add.statPct[k];
    }
    for (const k of Object.keys(add.slots)) {
      out.slots[k] = (out.slots[k] || 0) + add.slots[k];
    }
    for (const id of add.skills) {
      if (!out.skills.includes(id)) out.skills.push(id);
    }

    for (const k of Object.keys(add.passives)) {
      const v = add.passives[k];
      if (k === 'atkScale') {
        out.passives.atkScale = (out.passives.atkScale == null ? 1 : out.passives.atkScale) * v;
      } else if (MAX_KEYS.includes(k)) {
        out.passives[k] = Math.max(out.passives[k] || 0, v);
      } else if (v && typeof v === 'object') {
        // statusOnHitKind のような「種類 → 値」の表は、キーごとに足す
        const merged = Object.assign({}, out.passives[k]);
        for (const kk of Object.keys(v)) merged[kk] = (merged[kk] || 0) + v[kk];
        out.passives[k] = merged;
      } else {
        out.passives[k] = (out.passives[k] || 0) + v;
      }
    }

    for (const k of Object.keys(add.situational)) {
      out.situational[k] = (out.situational[k] || 0) + add.situational[k];
    }

    for (const k of Object.keys(add.elementMods)) {
      const v = add.elementMods[k];
      if (v && typeof v === 'object') {
        const merged = Object.assign({}, out.elementMods[k]);
        for (const kk of Object.keys(v)) merged[kk] = (merged[kk] || 0) + v[kk];
        out.elementMods[k] = merged;
      } else if (typeof v === 'number') {
        out.elementMods[k] = (out.elementMods[k] || 0) + v;
      } else {
        // adapt の boolean や convert の文字列は、後から来たほうを採る
        out.elementMods[k] = v;
      }
    }

    return out;
  }

  /**
   * 振り直しの費用 (§5.5)。キャラクターのレベルに比例する。
   * @param {number} level
   */
  function resetCost(level) {
    return level * RPG.data.skillResetCostPerLevel;
  }

  RPG.tree = {
    nodes, node, grouped, category, byCategory,
    investedLevels, tierUnlocked, tierRemaining,
    spentSp, canInvest, canRefund, effects, effectsOf, mergeEffects, resetCost, refundCost,
    KNOWN_EFFECT_KINDS,
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
