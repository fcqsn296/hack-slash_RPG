// @ts-check
/**
 * 装備の強化と厳選 (§7.6)。
 *
 * ── 何を解決するために作ったか ──
 * 終盤になるとゴールドの使い道が振り直ししか無く、いくら稼いでも余っていた
 * （ガチャの需要は 20体 × 完凸5 = 120回で打ち止めになるため）。
 * ここは **レベルではなく装備の等級に比例して伸びるゴールドの使い道** であり、
 * 同時に「拾った不要装備を素材として食わせる」というハクスラ本来の循環を作る。
 *
 * ── 2つの操作 ──
 *   強化   … +1〜+10。ゴールドと素材（不要装備）を払い、平坦ステータスを伸ばす
 *   厳選   … 副オプションを振り直す。ゴールドのみ。部位とレアリティは変わらない
 *
 * 失敗判定は入れていない。乱数はドロップと厳選だけで足りていて、
 * 払ったぶんが消える体験まで足すと時間の無駄が増えるだけになる。
 */
(function (RPG) {
  'use strict';

  /** 強化の上限 */
  const MAX_PLUS = 10;

  /**
   * 1段階ごとに平坦ステータスへ乗る割合。+10 で 1.6倍になる。
   *
   * 系統タグ倍率・クリティカル・上限突破・軽減はあえて伸ばさない。
   * §3.2 のダメージ曲線はこれらの値を前提に調整してあり、ここを伸ばすと
   * 「宝箱のグレードで強さが決まる」状態に逆戻りするため（gear.js の softScale 参照）。
   */
  const STAT_PER_PLUS = 0.06;

  /** 素材にしたときの価値。強化に必要な素材ポイントもこの単位で数える。 */
  const MATERIAL_VALUE = { COMMON: 1, RARE: 2, SUPER_RARE: 4, LEGEND: 8 };

  /** コストのレアリティ係数 */
  const COST_BY_RARITY = { COMMON: 1, RARE: 1.5, SUPER_RARE: 2.5, LEGEND: 4 };

  /** 強化費用の基準額 */
  const ENHANCE_BASE_GOLD = 60;
  /** 厳選費用の基準額 */
  const REROLL_BASE_GOLD = 120;

  /**
   * その装備の等級係数。宝箱のグレードが高いほど強化は高くつく。
   * 報酬装備（boxId が無い）は最上位の宝箱と同じ扱いにする。
   * @param {any} item
   */
  function grade(item) {
    const box = item.boxId ? RPG.data.boxes[item.boxId] : null;
    if (box) return box.stat_mult;
    let best = 1;
    for (const id of Object.keys(RPG.data.boxes)) best = Math.max(best, RPG.data.boxes[id].stat_mult);
    return best;
  }

  /** @param {any} item */
  function plusOf(item) {
    return item.plus || 0;
  }

  /**
   * 素材にしたときのポイント。強化済みのものを食わせると多めに返る。
   * @param {any} item
   */
  function materialValue(item) {
    return (MATERIAL_VALUE[item.rarity] || 1) * (1 + plusOf(item));
  }

  /**
   * 次の1段階に必要なもの。
   * @param {any} item
   * @returns {{gold: number, points: number, next: number}|null} 上限なら null
   */
  function enhanceCost(item) {
    const plus = plusOf(item);
    if (plus >= MAX_PLUS) return null;
    const step = plus + 1;
    return {
      next: step,
      // 段階が上がるほど急に高くなる。終盤ほど大きなゴールドの受け皿になるように。
      gold: Math.round(ENHANCE_BASE_GOLD * grade(item) * (COST_BY_RARITY[item.rarity] || 1) *
        Math.pow(step, 1.6)),
      points: step,
    };
  }

  /**
   * 厳選（副オプションの振り直し）の費用。
   * @param {any} item
   */
  function rerollCost(item) {
    return Math.round(REROLL_BASE_GOLD * grade(item) * (COST_BY_RARITY[item.rarity] || 1) *
      (1 + plusOf(item) * 0.5));
  }

  /**
   * 強化値を平坦ステータスへ反映する。
   * 元の値は baseStats に控えておき、常にそこから計算し直す（誤差が積もらないように）。
   * @param {any} item
   */
  function applyPlus(item) {
    if (!item.baseStats) item.baseStats = Object.assign({}, item.stats);
    const rate = 1 + plusOf(item) * STAT_PER_PLUS;
    /** @type {Record<string, number>} */
    const next = {};
    for (const key of Object.keys(item.baseStats)) {
      next[key] = Math.max(1, Math.floor(item.baseStats[key] * rate));
    }
    item.stats = next;
    return item;
  }

  /**
   * 素材として使えるか。強化する本体・装備中・ロック中は選べない。
   * @param {any} item
   * @param {number} targetUid
   */
  function usableAsMaterial(item, targetUid) {
    if (item.uid === targetUid) return false;
    if (item.locked) return false;
    if (RPG.state.isEquipped(item.uid)) return false;
    return true;
  }

  /**
   * 素材の候補。弱いものから並べる（強いものを誤って食わせないため）。
   * @param {number} targetUid
   */
  function materialCandidates(targetUid) {
    return RPG.state.get().inventory
      .filter((/** @type {any} */ it) => usableAsMaterial(it, targetUid))
      .sort((/** @type {any} */ a, /** @type {any} */ b) => RPG.gear.score(a) - RPG.gear.score(b));
  }

  /**
   * 必要ポイントを満たす最小限の素材を、弱いものから選ぶ。
   * @param {number} targetUid
   * @param {number} points
   * @returns {{items: any[], total: number, enough: boolean}}
   */
  function autoPickMaterials(targetUid, points) {
    const picked = [];
    let total = 0;
    for (const it of materialCandidates(targetUid)) {
      if (total >= points) break;
      picked.push(it);
      total += materialValue(it);
    }
    return { items: picked, total, enough: total >= points };
  }

  /**
   * 強化する。
   * @param {number} uid 強化する装備
   * @param {number[]} materialUids 素材にする装備
   * @returns {{ok: boolean, reason?: string, plus?: number, spent?: {gold: number, points: number}}}
   */
  function enhance(uid, materialUids) {
    const s = RPG.state.get();
    const item = s.inventory.find((/** @type {any} */ it) => it.uid === uid);
    if (!item) return { ok: false, reason: '装備が見つかりません' };

    const cost = enhanceCost(item);
    if (!cost) return { ok: false, reason: `すでに +${MAX_PLUS} です` };
    if (s.gold < cost.gold) {
      return { ok: false, reason: `ゴールドが ${(cost.gold - s.gold).toLocaleString()} 足りません` };
    }

    const materials = [];
    for (const muid of materialUids || []) {
      const m = s.inventory.find((/** @type {any} */ it) => it.uid === muid);
      if (!m) return { ok: false, reason: '素材が見つかりません' };
      if (!usableAsMaterial(m, uid)) {
        return { ok: false, reason: `${m.name} は素材にできません（装備中またはロック中）` };
      }
      materials.push(m);
    }

    const points = materials.reduce((t, m) => t + materialValue(m), 0);
    if (points < cost.points) {
      return { ok: false, reason: `素材が ${cost.points - points} ポイント足りません` };
    }

    // ここから先は失敗しない
    RPG.state.addGold(-cost.gold);
    const eaten = new Set(materials.map((m) => m.uid));
    s.inventory = s.inventory.filter((/** @type {any} */ it) => !eaten.has(it.uid));

    item.plus = plusOf(item) + 1;
    applyPlus(item);
    RPG.state.persist();

    return { ok: true, plus: item.plus, spent: { gold: cost.gold, points } };
  }

  /**
   * 厳選する。部位とレアリティは変えず、性能だけを振り直す。
   *
   * 強化値と名前とロック状態は引き継ぐ。強化を積んだ装備を安心して厳選できるようにするため。
   *
   * @param {number} uid
   * @returns {{ok: boolean, reason?: string, before?: number, after?: number, item?: any}}
   */
  function reroll(uid) {
    const s = RPG.state.get();
    const index = s.inventory.findIndex((/** @type {any} */ it) => it.uid === uid);
    if (index < 0) return { ok: false, reason: '装備が見つかりません' };
    const item = s.inventory[index];

    if (item.unique) return { ok: false, reason: 'クエスト報酬の専用装備は厳選できません' };
    if (!item.boxId) return { ok: false, reason: 'この装備は厳選できません' };

    const cost = rerollCost(item);
    if (s.gold < cost) {
      return { ok: false, reason: `ゴールドが ${(cost - s.gold).toLocaleString()} 足りません` };
    }

    const before = RPG.gear.score(item);
    RPG.state.addGold(-cost);

    const rolled = RPG.gear.identify(item.boxId, item.uid, {
      baseId: item.base, rarityId: item.rarity,
      // セットは引き継ぐ。厳選でセットが外れると揃えた意味が消えてしまう。
      setId: item.setId || null,
    });
    // 引き継ぐもの: 強化値・ロック・名前（名前が変わると別物に見えてしまう）
    rolled.plus = plusOf(item);
    rolled.locked = !!item.locked;
    rolled.name = item.name;
    applyPlus(rolled);

    s.inventory[index] = rolled;
    RPG.state.persist();

    return { ok: true, before, after: RPG.gear.score(rolled), item: rolled };
  }

  /**
   * 表示用に、その装備の強化状況をまとめる。
   * @param {any} item
   */
  function info(item) {
    const cost = enhanceCost(item);
    return {
      plus: plusOf(item),
      max: MAX_PLUS,
      atMax: plusOf(item) >= MAX_PLUS,
      cost,
      rerollGold: rerollCost(item),
      // いま何倍になっているか
      rate: 1 + plusOf(item) * STAT_PER_PLUS,
    };
  }

  RPG.enhance = {
    MAX_PLUS, STAT_PER_PLUS, MATERIAL_VALUE, COST_BY_RARITY,
    grade, plusOf, materialValue, enhanceCost, rerollCost, applyPlus,
    usableAsMaterial, materialCandidates, autoPickMaterials,
    enhance, reroll, info,
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
