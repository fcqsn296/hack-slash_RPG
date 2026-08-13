// @ts-check
/**
 * ガチャ・自動限界突破・ゴールド還元 (§6)。
 *
 * 経済循環の核:
 *   ガチャ → 新規獲得 or 自動限界突破(+SP) or 完凸後のゴールド還元
 * 被りが常に何かに変換されるので、無駄引きが発生しない。
 */
(function (RPG) {
  'use strict';

  /**
   * レアリティごとの排出候補。主人公など fixed: true のキャラは除外される (§8.1)。
   * @returns {Record<string, string[]>}
   */
  function poolByRarity() {
    /** @type {Record<string, string[]>} */
    const pool = {};
    for (const id of Object.keys(RPG.data.characters)) {
      const def = RPG.data.characters[id];
      if (def.fixed) continue;
      (pool[def.rarity] = pool[def.rarity] || []).push(id);
    }
    return pool;
  }

  /**
   * 排出候補が存在するレアリティだけに重みを絞る。
   * 候補ゼロのレアリティに当たって抽選が壊れるのを防ぐ。
   * @returns {Record<string, number>}
   */
  function effectiveWeights() {
    const pool = poolByRarity();
    /** @type {Record<string, number>} */
    const weights = {};
    for (const rarity of Object.keys(RPG.data.gacha.rarityWeights)) {
      if (pool[rarity] && pool[rarity].length > 0) {
        weights[rarity] = RPG.data.gacha.rarityWeights[rarity];
      }
    }
    return weights;
  }

  /**
   * キャラクターを1体抽選する。所持状況は見ない純粋な抽選。
   * @returns {{ id: string, rarity: string }}
   */
  function roll() {
    const pool = poolByRarity();
    const rarity = /** @type {string} */ (RPG.rng.weighted(effectiveWeights()));
    return { id: RPG.rng.pick(pool[rarity]), rarity };
  }

  /**
   * @typedef {Object} PullResult
   * @property {string} id
   * @property {string} rarity
   * @property {'new'|'limit_break'|'refund'} kind
   * @property {number} [limitBreak] 限界突破後の凸数
   * @property {number} [gold]       還元されたゴールド
   */

  /**
   * ガチャを1回引く。ゴールドは呼び出し側で既に支払われている前提。
   * @returns {PullResult}
   */
  function pullOnce() {
    const save = RPG.state.get();
    const { id, rarity } = roll();
    const owned = save.characters[id];

    // 未所持 → 新規獲得
    if (!owned) {
      save.characters[id] = RPG.state.createCharacter(id);
      return { id, rarity, kind: 'new' };
    }

    // 所持済み かつ 未完凸 → 自動限界突破 (§6.3)
    if (owned.limitBreak < RPG.data.gacha.maxLimitBreak) {
      owned.limitBreak++;
      // 限界突破1段階ごとにボーナスSP+1。SPは §6.5 の式で復元されるので保存不要。
      return { id, rarity, kind: 'limit_break', limitBreak: owned.limitBreak };
    }

    // 完凸済み → レアリティに応じたゴールド還元 (§6.4)
    const gold = RPG.data.rarities[rarity].refund;
    RPG.state.addGold(gold);
    return { id, rarity, kind: 'refund', gold };
  }

  /**
   * ガチャを count 回引く。ゴールドが足りなければ引ける回数だけ引く。
   * @param {number} count
   * @returns {{ results: PullResult[], spent: number, shortage: boolean }}
   */
  function pull(count) {
    const save = RPG.state.get();
    const cost = RPG.data.gacha.cost;

    const affordable = Math.min(count, Math.floor(save.gold / cost));
    /** @type {PullResult[]} */
    const results = [];

    for (let i = 0; i < affordable; i++) {
      RPG.state.addGold(-cost);
      results.push(pullOnce());
    }

    // 天井 (§6.6)。引いた回数だけ貯まる。
    // 交換しても余りは残るので、貯めた努力が消えることはない。
    if (affordable > 0) save.gachaPoints = (save.gachaPoints || 0) + affordable;

    if (results.length > 0) RPG.state.persist();
    return { results, spent: affordable * cost, shortage: affordable < count };
  }

  /**
   * 天井の状況 (§6.6)。
   * @returns {{points: number, need: number, ready: number, toNext: number}}
   */
  function pity() {
    const points = RPG.state.get().gachaPoints || 0;
    const need = RPG.data.gacha.pityPerExchange;
    return {
      points,
      need,
      // いま何体ぶん交換できるか
      ready: Math.floor(points / need),
      // 次の1体まであと何回引けばよいか
      toNext: need - (points % need),
    };
  }

  /** 交換できるキャラクターの一覧。ガチャの排出対象と同じ。 */
  function exchangeable() {
    /** @type {string[]} */
    const ids = [];
    for (const id of Object.keys(RPG.data.characters)) {
      if (RPG.data.characters[id].fixed) continue;
      ids.push(id);
    }
    return ids;
  }

  /**
   * 天井ポイントでキャラクターと交換する (§6.6)。
   *
   * 所持済みの相手を選んだ場合は限界突破に回る。引いたときと同じ扱いにしてある。
   * 「持っているから選べない」にすると、凸を進めたい人の逃げ道が無くなる。
   *
   * @param {string} charId
   * @returns {{ok: boolean, reason?: string, kind?: string, limitBreak?: number}}
   */
  function exchange(charId) {
    const def = RPG.data.characters[charId];
    if (!def || def.fixed) return { ok: false, reason: '交換できない相手' };

    const save = RPG.state.get();
    const need = RPG.data.gacha.pityPerExchange;
    if ((save.gachaPoints || 0) < need) {
      return { ok: false, reason: `${need - (save.gachaPoints || 0)} ポイント足りない` };
    }

    const owned = save.characters[charId];
    /** @type {any} */
    let res;
    if (!owned) {
      save.characters[charId] = RPG.state.createCharacter(charId);
      res = { ok: true, kind: 'new' };
    } else if (owned.limitBreak < RPG.data.gacha.maxLimitBreak) {
      owned.limitBreak++;
      res = { ok: true, kind: 'limit_break', limitBreak: owned.limitBreak };
    } else {
      // 完凸済みを選んだときだけは断る。何も起きないのにポイントだけ減るのは事故。
      return { ok: false, reason: 'すでに完凸している' };
    }

    save.gachaPoints -= need;
    RPG.state.persist();
    return res;
  }

  RPG.gacha = { pull, pullOnce, roll, poolByRarity, effectiveWeights, pity, exchange, exchangeable };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
