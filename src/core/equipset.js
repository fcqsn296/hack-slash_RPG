// @ts-check
/**
 * 装備セットの集計 (§7.7)。
 *
 * 「何個着けているか」を数えて、発動している効果を1つの表にまとめるだけの層。
 * 効果そのものの適用は、性質ごとに置き場所を分けている。
 *
 *   units.js  … ユニット組み立て時に効くもの（属性適応・復活HP）
 *   battle.js … 戦況を見るもの（残響・憤怒・仲間の生死・ラウンド経過・味方への付与）
 *   damage.js … 受け取った倍率を掛けるだけ（純関数のまま保つ）
 *
 * ここは集計だけを担当し、戦闘の状態には触らない。
 */
(function (RPG) {
  'use strict';

  /**
   * 装備一覧からセットの所持数を数える。
   * @param {any[]} items
   * @returns {Record<string, number>}
   */
  function countPieces(items) {
    /** @type {Record<string, number>} */
    const counts = {};
    for (const item of items || []) {
      if (!item || !item.setId) continue;
      if (!RPG.data.equipSets[item.setId]) continue;   // 消えたセットIDは無視する
      counts[item.setId] = (counts[item.setId] || 0) + 1;
    }
    return counts;
  }

  /**
   * 発動している段階を返す。
   * @param {Record<string, number>} counts
   * @returns {Array<{setId: string, set: any, pieces: number, tier: any}>}
   */
  function activeTiers(counts) {
    const out = [];
    for (const setId of Object.keys(counts)) {
      const set = RPG.data.equipSets[setId];
      const pieces = counts[setId];
      for (const tier of set.bonuses) {
        if (pieces >= tier.pieces) out.push({ setId, set, pieces, tier });
      }
    }
    return out;
  }

  /**
   * 効果をひとつの表に畳み込む。
   *
   * 同じキーが複数の段階から来たときは、後から発動した強いほうで上書きする
   * （2セットの 25% と 4セットの 45% が足されて 70% にならないように）。
   * bonuses は必ず pieces の小さい順に並べておくこと。
   *
   * @param {any[]} items
   * @returns {{counts: Record<string, number>, active: any[], effects: Record<string, any>}}
   */
  function resolve(items) {
    const counts = countPieces(items);
    const active = activeTiers(counts);
    /** @type {Record<string, any>} */
    const effects = {};

    // pieces の小さい順に適用する。同じキーは後勝ち。
    active.slice().sort((a, b) => a.tier.pieces - b.tier.pieces).forEach((entry) => {
      for (const key of Object.keys(entry.tier.effects)) {
        effects[key] = entry.tier.effects[key];
      }
    });

    // ユニーク装備の固有効果 (§7.8) も同じ表に合流させる。
    // 戦闘側は「どこから来た効果か」を気にせず読めるようにしておく。
    // 数値は足し合わせ、真偽値は立っていれば立てる。
    /** @type {any[]} */
    const uniques = [];
    for (const item of items || []) {
      if (!item || !item.uniqueEffects) continue;
      uniques.push(item);
      for (const key of Object.keys(item.uniqueEffects)) {
        const value = item.uniqueEffects[key];
        if (typeof value === 'number') effects[key] = (effects[key] || 0) + value;
        else effects[key] = effects[key] || value;
      }
    }

    return { counts, active, effects, uniques };
  }

  /**
   * 表示用の一行説明。
   * @param {any[]} items
   * @returns {string[]}
   */
  function labels(items) {
    return resolve(items).active.map((e) => `${e.set.name}(${e.tier.pieces}) ${e.tier.label}`);
  }

  /**
   * そのセットの、あと何個で次の段階かを返す。装備画面の案内に使う。
   * @param {string} setId
   * @param {number} pieces
   */
  function nextTier(setId, pieces) {
    const set = RPG.data.equipSets[setId];
    if (!set) return null;
    return set.bonuses.find((/** @type {any} */ b) => b.pieces > pieces) || null;
  }

  /**
   * 鑑定のときにセットを抽選する。
   * @param {string} boxId
   * @returns {string|null}
   */
  function rollSet(boxId) {
    const chance = (RPG.data.equipSetChance || {})[boxId] || 0;
    if (chance <= 0) return null;
    if (!RPG.rng.chance(chance)) return null;
    return RPG.rng.pick(Object.keys(RPG.data.equipSets));
  }

  RPG.equipset = { countPieces, activeTiers, resolve, labels, nextTier, rollSet };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
