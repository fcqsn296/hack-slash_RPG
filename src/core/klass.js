// @ts-check
/**
 * クラス (§12) のロジック。
 *
 * `class` は予約語なので、モジュール名もファイル名も klass で通している。
 *
 * スキルツリー (§5) と違ってティア解放の概念は無い。
 * 「1キャラ1クラス専任」「ポイントが少ない」の2点だけで重さを担保しているので、
 * ここは投資できるかの判定と、効果の畳み込みだけを持つ。
 */
(function (RPG) {
  'use strict';

  /** @param {string} classId @returns {any} */
  function def(classId) {
    return RPG.data.classes[classId];
  }

  /** すべてのクラス定義を配列で返す */
  function all() {
    return Object.keys(RPG.data.classes).map((id) =>
      Object.assign({ id }, RPG.data.classes[id]));
  }

  /**
   * クラスのノード定義を引く。
   * @param {string} classId
   * @param {string} nodeId
   */
  function node(classId, nodeId) {
    const d = def(classId);
    if (!d) return null;
    return d.nodes.find((/** @type {any} */ n) => n.id === nodeId) || null;
  }

  /**
   * 配られるクラスポイントの総数 (§12)。
   * スキルポイントが「レベル-1 + 凸」なのに対し、こちらは数レベルに1つ。
   * @param {any} charSave
   */
  function totalPoints(charSave) {
    const per = RPG.data.classPointsPerLevel || 5;
    return Math.floor(charSave.level / per);
  }

  /**
   * 使用済みのクラスポイント。
   * @param {any} charSave
   */
  function spentPoints(charSave) {
    const classId = charSave.klass;
    const invested = charSave.klassTree || {};
    if (!classId || !def(classId)) return 0;

    let total = 0;
    for (const id of Object.keys(invested)) {
      const n = node(classId, id);
      if (n) total += invested[id] * n.cost;
    }
    return total;
  }

  /** @param {any} charSave */
  function availablePoints(charSave) {
    return totalPoints(charSave) - spentPoints(charSave);
  }

  /**
   * ノードに1レベル投資できるか。できないなら理由を返す。
   * @param {any} charSave
   * @param {string} nodeId
   * @returns {{ ok: boolean, reason?: string }}
   */
  function canInvest(charSave, nodeId) {
    if (!charSave.klass) return { ok: false, reason: 'クラスに就いていない' };
    const n = node(charSave.klass, nodeId);
    if (!n) return { ok: false, reason: '不明なノード' };

    const current = (charSave.klassTree || {})[nodeId] || 0;
    if (current >= n.maxLevel) return { ok: false, reason: '最大レベル' };

    const left = availablePoints(charSave);
    if (left < n.cost) return { ok: false, reason: `クラスポイントが${n.cost - left}足りない` };

    return { ok: true };
  }

  /**
   * クラス由来の効果を、スキルツリーと同じ形に畳み込む。
   *
   * 効果種別はツリーと共通なので、集約そのものは tree.effects に任せる。
   * ここでやるのは「素質＋投資したノード」を、tree.effects が読める
   * `{ ノードID: レベル }` + 仮想ノードの形に組み替えることだけ。
   *
   * @param {any} charSave
   * @returns {any} tree.effects と同じ形
   */
  function effects(charSave) {
    const classId = charSave && charSave.klass;
    const d = classId ? def(classId) : null;
    if (!d) return null;

    // tree.effects はノード定義を RPG.data.skillTree から引く作りなので、
    // クラスのノードをそのまま渡せない。効果の配列を直接畳めるよう、
    // 一時的にノード表を差し替えて呼ぶ。
    const invested = charSave.klassTree || {};
    /** @type {any[]} */
    const virtual = [];
    /** @type {Record<string, number>} */
    const levels = {};

    // 素質は「必ずレベル1で取っている仮想ノード」として扱う。
    virtual.push({ id: '__innate', tier: 'basic', cost: 0, maxLevel: 1, effects: d.innate || [] });
    levels.__innate = 1;

    for (const n of d.nodes) {
      const lv = invested[n.id] || 0;
      if (lv <= 0) continue;
      virtual.push(n);
      levels[n.id] = lv;
    }

    return RPG.tree.effectsOf(virtual, levels);
  }

  /**
   * クラスを説明するための短い要約。ビルド画面と図鑑で使う。
   * @param {any} charSave
   */
  function summary(charSave) {
    const d = charSave && charSave.klass ? def(charSave.klass) : null;
    if (!d) return null;
    return {
      name: d.name,
      color: d.color,
      innateDesc: d.innateDesc,
      spent: spentPoints(charSave),
      total: totalPoints(charSave),
      available: availablePoints(charSave),
    };
  }

  RPG.klass = {
    def, all, node, totalPoints, spentPoints, availablePoints,
    canInvest, effects, summary,
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
