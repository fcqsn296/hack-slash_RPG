// @ts-check
/**
 * 自動装備。
 *
 * 「強さ」の判断に汎用スコアは使わない。装備候補を実際に着せたユニットを組み立て、
 * §3 のダメージ計算で期待火力を測って比較する。
 * こうすると、魔力参照のキャラには魔術装備が、回復役には魔力装備が自然に選ばれ、
 * §3.2 の「異なる系統タグは乗算」も評価に含まれる（分散したほうがスコアが伸びる）。
 */
(function (RPG) {
  'use strict';

  /** 1スロットあたりの候補数。増やすほど精度が上がるが計算量も増える。 */
  const CANDIDATES_PER_SLOT = 10;
  /** 入れ替え改善の試行上限 */
  const MAX_PASSES = 6;

  /** 回復量は同じ数値の火力より少し価値が高いとみなす */
  const HEAL_WEIGHT = 1.2;
  /** 生存力をどれくらい重く見るか（0で火力のみ、1で同等） */
  const SURVIVAL_EXPONENT = 0.30;

  const SLOTS = ['weapon', 'armor', 'accessory'];

  /**
   * 評価用の基準敵。フィールド構成に左右されないよう、レベル相応の防御だけを持たせる。
   * @param {number} level
   */
  function referenceDefender(level) {
    return { level, def: Math.floor(level * 9 + 25), element: 'none' };
  }

  /**
   * 攻撃技か（バフ・回復を除く）。
   * @param {any} skill
   */
  function isAttack(skill) {
    return skill.power > 0 && skill.plugin !== 'heal' &&
      !['unique_buff', 'tag_buff', 'def_buff', 'reduction_buff'].includes(skill.plugin);
  }

  /**
   * その装備構成でのキャラクターの総合力。
   * 火力（または回復量）に、生存力を控えめに掛け合わせる。
   * @param {any} charSave
   * @param {any[]} inventory
   * @param {any} equipped
   * @returns {number}
   */
  function loadoutScore(charSave, inventory, equipped) {
    const trial = Object.assign({}, charSave, { equipped });
    const unit = RPG.units.buildCharacterUnit(trial, inventory);
    const defender = referenceDefender(charSave.level);

    let offense = 0;
    let support = 0;
    for (const id of unit.skills) {
      const skill = RPG.data.skills[id];
      if (skill.plugin === 'heal') {
        support = Math.max(support, (unit.stats[skill.scaling_stat] || 0) * (skill.power / 100));
        continue;
      }
      if (!isAttack(skill)) continue;
      const hits = skill.plugin === 'multi_hit' ? (skill.params && skill.params.hits) || 1 : 1;
      const r = RPG.damage.calc({
        attacker: RPG.units.toAttacker(unit),
        defender,
        skill,
        options: { random: 1.0, crit: false },
      });
      offense = Math.max(offense, r.damage * hits);
    }

    const value = Math.max(offense, support * HEAL_WEIGHT);

    // 生存力: 最大HPを、防御による軽減と被ダメージ軽減で割り増しした「実効HP」
    const c = charSave.level * 100 + 500;
    const defMult = 1 + unit.stats.def / (unit.stats.def + c);
    const reduction = Math.min(0.95, unit.baseReduction || 0);
    const effectiveHp = unit.maxHp * defMult / (1 - reduction);

    return value * Math.pow(effectiveHp, SURVIVAL_EXPONENT);
  }

  /**
   * 候補を絞り込むための軽い目安。全組み合わせを評価すると重いので、
   * まずこの値で上位だけ残す。
   * @param {any} item
   */
  function quickScore(item) {
    let s = 0;
    for (const key of Object.keys(item.stats)) {
      s += item.stats[key] * (key === 'hp' ? 0.25 : 1);
    }
    for (const b of item.tagBonuses) s += b.value * 500;
    s += (item.critRate || 0) * 600;
    s += (item.capBreak || 0) * 500;
    s += (item.reduction || 0) * 900;
    return s;
  }

  /**
   * そのキャラクターに一番良い装備構成を探す。
   *
   * @param {any} charSave
   * @param {any[]} inventory 選べる装備（他キャラが着けているものは呼び出し側で除いておく）
   * @param {{keepLocked?: boolean}} [opts] keepLocked のとき、ロック中の装備は外さない
   * @returns {{equipped: any, score: number, changed: number}}
   */
  function optimize(charSave, inventory, opts) {
    opts = opts || {};
    const slots = RPG.units.slotCounts(charSave);
    const current = charSave.equipped || { weapon: [], armor: [], accessory: [] };

    /** ロックされていて今着けている装備は固定枠として残す */
    /** @type {Record<string, number[]>} */
    const pinned = { weapon: [], armor: [], accessory: [] };
    if (opts.keepLocked) {
      for (const slot of SLOTS) {
        for (const uid of current[slot] || []) {
          const item = inventory.find((it) => it.uid === uid);
          if (item && item.locked) pinned[slot].push(uid);
        }
      }
    }

    // スロットごとの候補（固定枠のぶんだけ空きが減る）
    /** @type {Record<string, any[]>} */
    const pool = {};
    for (const slot of SLOTS) {
      pool[slot] = inventory
        .filter((it) => it.slot === slot && !pinned[slot].includes(it.uid))
        .sort((a, b) => quickScore(b) - quickScore(a))
        .slice(0, CANDIDATES_PER_SLOT);
    }

    /** 目安スコアの高い順に埋めた初期構成 */
    /** @type {Record<string, number[]>} */
    const equipped = { weapon: [], armor: [], accessory: [] };
    for (const slot of SLOTS) {
      const free = Math.max(0, slots[slot] - pinned[slot].length);
      equipped[slot] = pinned[slot].concat(pool[slot].slice(0, free).map((it) => it.uid));
    }

    let best = loadoutScore(charSave, inventory, equipped);

    // 1箇所ずつ入れ替えて、良くなるなら採用する（改善が止まるまで繰り返す）
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      let improved = false;

      for (const slot of SLOTS) {
        const free = slots[slot] - pinned[slot].length;
        for (let i = pinned[slot].length; i < pinned[slot].length + free; i++) {
          for (const candidate of pool[slot]) {
            if (equipped[slot].includes(candidate.uid)) continue;

            const trial = {
              weapon: equipped.weapon.slice(),
              armor: equipped.armor.slice(),
              accessory: equipped.accessory.slice(),
            };
            trial[slot][i] = candidate.uid;

            const score = loadoutScore(charSave, inventory, trial);
            if (score > best + 1e-9) {
              best = score;
              equipped[slot] = trial[slot];
              improved = true;
            }
          }
        }
      }

      if (!improved) break;
    }

    // 何箇所変わったか
    let changed = 0;
    for (const slot of SLOTS) {
      const before = (current[slot] || []).slice().sort();
      const after = equipped[slot].slice().sort();
      if (before.join(',') !== after.join(',')) {
        changed += Math.max(before.length, after.length);
      }
    }

    return { equipped, score: best, changed };
  }

  /**
   * 1人分を自動装備する。他のキャラクターが着けている装備には手を触れない。
   * @param {string} charId
   * @param {{keepLocked?: boolean}} [opts]
   * @returns {{changed: number, before: number, after: number}}
   */
  function forCharacter(charId, opts) {
    const save = RPG.state.get();
    const charSave = save.characters[charId];

    // 他キャラが着けているものは選べない
    /** @type {Set<number>} */
    const taken = new Set();
    for (const id of Object.keys(save.characters)) {
      if (id === charId) continue;
      const c = save.characters[id];
      for (const slot of SLOTS) for (const uid of c.equipped[slot] || []) taken.add(uid);
    }
    const pool = save.inventory.filter((/** @type {any} */ it) => !taken.has(it.uid));

    const before = loadoutScore(charSave, save.inventory, charSave.equipped);
    const result = optimize(charSave, pool, opts);
    RPG.state.setLoadout(charId, result.equipped);

    return { changed: result.changed, before, after: result.score };
  }

  /**
   * パーティ全員を順に自動装備する。先頭のキャラから良い装備を取っていく。
   * @param {{keepLocked?: boolean}} [opts]
   * @returns {{changed: number, perCharacter: Array<{id: string, changed: number}>}}
   */
  function forParty(opts) {
    const save = RPG.state.get();
    /** @type {Set<number>} */
    const used = new Set();

    // パーティ外のキャラが着けているものは触らない
    for (const id of Object.keys(save.characters)) {
      if (save.party.includes(id)) continue;
      const c = save.characters[id];
      for (const slot of SLOTS) for (const uid of c.equipped[slot] || []) used.add(uid);
    }

    let changed = 0;
    /** @type {Array<{id: string, changed: number}>} */
    const perCharacter = [];

    for (const charId of save.party) {
      const charSave = save.characters[charId];
      const pool = save.inventory.filter((/** @type {any} */ it) => !used.has(it.uid));
      const result = optimize(charSave, pool, opts);
      RPG.state.setLoadout(charId, result.equipped);

      for (const slot of SLOTS) for (const uid of result.equipped[slot]) used.add(uid);
      changed += result.changed;
      perCharacter.push({ id: charId, changed: result.changed });
    }

    return { changed, perCharacter };
  }

  RPG.autoequip = {
    optimize, forCharacter, forParty, loadoutScore, quickScore, referenceDefender,
    CANDIDATES_PER_SLOT,
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
