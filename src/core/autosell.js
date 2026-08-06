// @ts-check
/**
 * 装備の自動売却ルール (§7.4)。
 *
 * 鑑定の数が増えると、インベントリの掃除そのものが作業になる。ここでは
 * 「明らかに要らないもの」だけを機械的に落とし、判断が要るものは必ず残す。
 *
 * ── 誤爆させないための3段構え ──
 *   1. ロック中と装備中は常に対象外（RPG.state.sellMany が最終的にも弾く）
 *   2. 「更新候補は残す」— パーティの誰かの装備を上回るものは、条件に合っても売らない
 *   3. 実行前に必ず件数と金額を見せる
 *
 * このモジュールは判定だけを持ち、売却そのものは RPG.state.sellMany に任せる。
 */
(function (RPG) {
  'use strict';

  const SLOTS = ['weapon', 'armor', 'accessory'];

  /** 自動売却設定の初期値。既定では「粗悪品だけ」「更新候補は残す」。 */
  function defaultRules() {
    return {
      /** 鑑定した瞬間に自動で適用するか */
      auto: false,
      /** 売却対象にするレアリティ */
      rarities: { COMMON: true, RARE: false, SUPER_RARE: false, LEGEND: false },
      /** このスコア未満なら売る。0 なら条件として使わない */
      minScore: 0,
      /** パーティの誰かの装備より強いものは売らない */
      protectUpgrades: true,
    };
  }

  /** 現在の設定。 */
  function rules() {
    const s = RPG.state.get();
    if (!s.autoSell) s.autoSell = defaultRules();
    return s.autoSell;
  }

  /**
   * @param {Partial<ReturnType<typeof defaultRules>>} patch
   */
  function updateRules(patch) {
    Object.assign(rules(), patch);
    RPG.state.persist();
    return rules();
  }

  /**
   * 部位ごとの「これを上回れば誰かの更新になる」スコア。
   *
   * パーティの誰か1人でもその部位に空きがあるなら、その部位は何でも更新候補になる
   * ので -Infinity（＝全部保護）を返す。
   *
   * @returns {Record<string, number>}
   */
  function upgradeBar() {
    const s = RPG.state.get();
    /** @type {Record<string, number>} */
    const bar = {};
    const party = s.party.filter((/** @type {string} */ id) => !!s.characters[id]);

    for (const slot of SLOTS) {
      // 編成が空なら判断材料が無いので全部保護する
      if (party.length === 0) { bar[slot] = -Infinity; continue; }

      let weakest = Infinity;
      for (const charId of party) {
        const c = s.characters[charId];
        const capacity = RPG.units.slotCounts(c)[slot];
        const uids = c.equipped[slot] || [];
        if (uids.length < capacity) { weakest = -Infinity; break; }
        for (const uid of uids) {
          const item = s.inventory.find((/** @type {any} */ it) => it.uid === uid);
          if (!item) { weakest = -Infinity; break; }
          weakest = Math.min(weakest, RPG.gear.score(item));
        }
        if (weakest === -Infinity) break;
      }
      bar[slot] = weakest;
    }
    return bar;
  }

  /**
   * その装備がルールの売却対象か。
   * @param {any} item
   * @param {Record<string, number>} bar upgradeBar() の結果
   * @param {any} [cfg] 省略時は現在の設定
   * @returns {{sell: boolean, reason: string}}
   */
  function judge(item, bar, cfg) {
    const r = cfg || rules();
    if (item.locked) return { sell: false, reason: 'ロック中' };
    if (RPG.state.isEquipped(item.uid)) return { sell: false, reason: '装備中' };

    const score = RPG.gear.score(item);
    const byRarity = !!(r.rarities && r.rarities[item.rarity]);
    const byScore = r.minScore > 0 && score < r.minScore;
    if (!byRarity && !byScore) return { sell: false, reason: '条件に合わない' };

    if (r.protectUpgrades && score > (bar[item.slot] == null ? -Infinity : bar[item.slot])) {
      return { sell: false, reason: '更新候補（誰かの装備より強い）' };
    }

    return {
      sell: true,
      reason: byRarity ? `${RPG.data.rarities[item.rarity].label}` : `スコア ${score} < ${r.minScore}`,
    };
  }

  /**
   * 売却対象を洗い出す。売らずに一覧と合計額だけを返す。
   * @param {any[]} [inventory] 省略時は所持品全体
   * @returns {{items: any[], gold: number, protectedCount: number}}
   */
  function candidates(inventory) {
    const s = RPG.state.get();
    const list = inventory || s.inventory;
    const bar = upgradeBar();
    const cfg = rules();

    const items = [];
    let gold = 0;
    let protectedCount = 0;
    for (const item of list) {
      const verdict = judge(item, bar, cfg);
      if (verdict.sell) {
        items.push(item);
        gold += RPG.state.sellValue(item);
      } else if (verdict.reason === '更新候補（誰かの装備より強い）') {
        protectedCount++;
      }
    }
    return { items, gold, protectedCount };
  }

  /**
   * ルールに合う装備をまとめて売却する。
   * @param {any[]} [inventory] 対象を絞りたい場合に渡す（鑑定直後の分だけ等）
   * @returns {{count: number, gold: number, protectedCount: number}}
   */
  function run(inventory) {
    const found = candidates(inventory);
    if (found.items.length === 0) {
      return { count: 0, gold: 0, protectedCount: found.protectedCount };
    }
    const result = RPG.state.sellMany(found.items.map((it) => it.uid));
    return { count: result.count, gold: result.gold, protectedCount: found.protectedCount };
  }

  RPG.autosell = {
    SLOTS, defaultRules, rules, updateRules,
    upgradeBar, judge, candidates, run,
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
