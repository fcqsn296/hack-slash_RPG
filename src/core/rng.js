// @ts-check
/**
 * 乱数ユーティリティ。
 * 戦闘・鑑定はすべてこのモジュール経由で乱数を引く。シード指定できるため、
 * テスト時は乱数を固定して検証できる (§11 / §14.2)。
 */
(function (RPG) {
  'use strict';

  /**
   * mulberry32 — 32bit シード可能な高速PRNG。
   * @param {number} seed
   * @returns {() => number} 0以上1未満の乱数を返す関数
   */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** @type {() => number} 既定の乱数源（実プレイ用） */
  let source = Math.random;

  const Rng = {
    /**
     * 乱数源を差し替える。seed を渡すと決定的な系列になる。
     * @param {number|null} seed null で Math.random に戻す
     */
    seed(seed) {
      source = seed === null ? Math.random : mulberry32(seed);
    },

    /** @returns {number} 0以上1未満 */
    next() {
      return source();
    },

    /**
     * min以上max以下の実数
     * @param {number} min
     * @param {number} max
     */
    float(min, max) {
      return min + source() * (max - min);
    },

    /**
     * min以上max以下の整数
     * @param {number} min
     * @param {number} max
     */
    int(min, max) {
      return Math.floor(min + source() * (max - min + 1));
    },

    /**
     * 確率 p で true
     * @param {number} p
     */
    chance(p) {
      return source() < p;
    },

    /**
     * 配列から一様に1つ選ぶ
     * @template T
     * @param {T[]} arr
     * @returns {T}
     */
    pick(arr) {
      return arr[Math.floor(source() * arr.length)];
    },

    /**
     * 重み付き抽選。
     * @param {Record<string, number>|Array<{weight?: number}>} weights
     * @returns {any} オブジェクトならキー、配列なら要素
     */
    weighted(weights) {
      if (Array.isArray(weights)) {
        const total = weights.reduce((s, w) => s + (w.weight || 0), 0);
        let r = source() * total;
        for (const item of weights) {
          r -= item.weight || 0;
          if (r <= 0) return item;
        }
        return weights[weights.length - 1];
      }
      const keys = Object.keys(weights);
      const total = keys.reduce((s, k) => s + weights[k], 0);
      let r = source() * total;
      for (const k of keys) {
        r -= weights[k];
        if (r <= 0) return k;
      }
      return keys[keys.length - 1];
    },
  };

  RPG.rng = Rng;
  RPG.mulberry32 = mulberry32;
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
