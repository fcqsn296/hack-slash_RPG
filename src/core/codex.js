// @ts-check
/**
 * 図鑑 (§13)。
 *
 * ── 設計方針: 図鑑そのもののデータは持たない ──
 * 図鑑用のカタログを別に作ると、キャラや敵を1体足すたびに2箇所を直すことになる。
 * ここでは項目を必ず `RPG.data.*` から導出し、セーブには「どこまで見たか」だけを持つ。
 * その結果、`data/characters.js` や `data/enemies.js` に1行足せば図鑑にも自動で並ぶ。
 *
 * セーブに残すもの:
 *   codex.enemies[敵ID] = { seen: 遭遇回数, killed: 撃破数 }
 *   codex.fields[フィールドID] = { visits: 出撃回数 }
 * キャラクターは「所持しているか」がそのまま解放条件なので、別途は持たない。
 */
(function (RPG) {
  'use strict';

  /**
   * 図鑑の区分。増やすときはここに1行足すだけでよい。
   *
   * `collect: false` の区分は集めるものではないので、収集率に数えない。
   * 用語集を数に入れると、読んでいなくても最初から埋まっている項目が
   * 収集率を押し上げてしまい、進み具合の目安として使えなくなる。
   */
  const SECTIONS = [
    { id: 'character', label: 'キャラクター', collect: true },
    { id: 'enemy', label: '敵', collect: true },
    { id: 'field', label: 'フィールド', collect: true },
    { id: 'system', label: '用語', collect: false },
    { id: 'story', label: '物語', collect: false },
  ];

  /** セーブ側の記録。 */
  function store() {
    const s = RPG.state.get();
    if (!s.codex) s.codex = { enemies: {}, fields: {} };
    if (!s.codex.enemies) s.codex.enemies = {};
    if (!s.codex.fields) s.codex.fields = {};
    return s.codex;
  }

  /**
   * 戦闘の記録を図鑑へ反映する。
   * 戦闘エンジンは数を数えるだけなので、セーブへの書き込みはここが担当する。
   * @param {any} battle
   */
  function record(battle) {
    if (!battle) return;
    const codex = store();
    for (const id of Object.keys(battle.encountered || {})) {
      const entry = codex.enemies[id] || (codex.enemies[id] = { seen: 0, killed: 0 });
      entry.seen += battle.encountered[id];
    }
    for (const id of Object.keys(battle.defeatedEnemies || {})) {
      const entry = codex.enemies[id] || (codex.enemies[id] = { seen: 0, killed: 0 });
      entry.killed += battle.defeatedEnemies[id];
    }
    // フィールドは「実際に出撃したか」で数える。
    // 敵の出現から逆算すると、同じ敵を使い回している別のフィールドまで解放されてしまう。
    if (battle.fieldId && RPG.data.fields[battle.fieldId]) {
      const f = codex.fields[battle.fieldId] || (codex.fields[battle.fieldId] = { visits: 0 });
      f.visits++;
    }
  }

  /**
   * 敵1体の記録。未遭遇なら seen: 0。
   * @param {string} enemyId
   */
  function enemyEntry(enemyId) {
    return store().enemies[enemyId] || { seen: 0, killed: 0 };
  }

  /** @param {string} enemyId */
  function enemySeen(enemyId) {
    return enemyEntry(enemyId).seen > 0;
  }

  /** @param {string} charId */
  function characterOwned(charId) {
    return !!RPG.state.get().characters[charId];
  }

  /**
   * そのフィールドの記録。
   * @param {string} fieldId
   */
  function fieldEntry(fieldId) {
    return store().fields[fieldId] || { visits: 0 };
  }

  /**
   * そのフィールドへ一度でも出撃したか。
   * @param {string} fieldId
   */
  function fieldSeen(fieldId) {
    return fieldEntry(fieldId).visits > 0;
  }

  /**
   * その敵が出現するフィールドの一覧。
   * fields.js を走査して求めるので、フィールドを足せば自動で反映される。
   * @param {string} enemyId
   * @returns {Array<{id: string, name: string, role: 'boss'|'normal'}>}
   */
  function enemyHabitats(enemyId) {
    const out = [];
    for (const fieldId of Object.keys(RPG.data.fields)) {
      const f = RPG.data.fields[fieldId];
      if (f.boss === enemyId) out.push({ id: fieldId, name: f.name, role: 'boss' });
      else if (f.pool.includes(enemyId)) out.push({ id: fieldId, name: f.name, role: 'normal' });
    }
    // クエストは既存フィールドを使い回すので、フィールド側にだけ載っていれば足りる
    return out;
  }

  /**
   * 区分ごとの収集率。
   * @param {string} section
   * @returns {{found: number, total: number}}
   */
  function progress(section) {
    if (section === 'character') {
      const ids = Object.keys(RPG.data.characters);
      return { found: ids.filter(characterOwned).length, total: ids.length };
    }
    if (section === 'enemy') {
      const ids = Object.keys(RPG.data.enemies);
      return { found: ids.filter(enemySeen).length, total: ids.length };
    }
    if (section === 'field') {
      const ids = Object.keys(RPG.data.fields);
      return { found: ids.filter(fieldSeen).length, total: ids.length };
    }
    return { found: 0, total: 0 };
  }

  /** 全区分を合わせた収集率。集めるものではない区分は数えない。 */
  function totalProgress() {
    let found = 0;
    let total = 0;
    for (const s of SECTIONS) {
      if (!s.collect) continue;
      const p = progress(s.id);
      found += p.found;
      total += p.total;
    }
    return { found, total, rate: total ? found / total : 0 };
  }

  /**
   * 敵のステータスを図鑑用に組み立てる。
   * 表示するレベルは、その敵が出るフィールドのうち一番低いものに合わせる。
   * @param {string} enemyId
   */
  function enemyPreview(enemyId) {
    const def = RPG.data.enemies[enemyId];
    const habitats = enemyHabitats(enemyId);
    const level = habitats.length
      ? Math.min.apply(null, habitats.map((hb) => RPG.data.fields[hb.id].enemy_lv))
      : 1;
    const unit = RPG.units.buildEnemyUnit(enemyId, level, !!def.boss, 0);
    return { def, level, unit, habitats };
  }

  /**
   * 用語を区分ごとにまとめて返す。
   * 並び順は `glossaryGroups` の宣言順＝読んでほしい順。
   * @returns {Array<{group: any, entries: Array<{id: string, def: any}>}>}
   */
  function glossaryByGroup() {
    const all = RPG.data.glossary || {};
    return (RPG.data.glossaryGroups || []).map((group) => ({
      group,
      entries: Object.keys(all)
        .filter((id) => all[id].group === group.id)
        .map((id) => ({ id, def: all[id] })),
    })).filter((g) => g.entries.length > 0);
  }

  RPG.codex = {
    SECTIONS,
    record, enemyEntry, enemySeen, characterOwned, fieldEntry, fieldSeen,
    enemyHabitats, enemyPreview, progress, totalProgress, glossaryByGroup,
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
