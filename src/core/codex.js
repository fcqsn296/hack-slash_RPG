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
    // 記録 (§13.2)。物語を進めると増える世界の説明。
    //
    // ── なぜ収集率に数えないのか ──
    // 記録は**物語モードでしか手に入らない**。数に入れると、周回しか遊んでいない人の
    // 図鑑の達成率が、この区分を足した日に下がる。既にある数字の意味を変えないため、
    // 区分の中だけで「3 / 8」と数える。
    { id: 'record', label: '記録', collect: false },
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
    // 記録は収集率(totalProgress)には数えないが、区分の中では数える。
    if (section === 'record') {
      const ids = Object.keys(RPG.data.records || {});
      return { found: ids.filter(recordHeld).length, total: ids.length };
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
   * 記録を手に入れているか (§13.2)。
   *
   * ── セーブに何も足さない ──
   * 物語の進行から導出する。図鑑の設計方針（このファイルの冒頭）どおり、
   * 持つのは「どこまで見たか」だけにする。
   *
   * 進行は `save.story.progress` にあり、`storyProfile()` はモードを問わず
   * そこを返すので、**周回側からも同じ判定ができる**。
   * 物語で拾ったものを周回で読み返せるのは、これが理由。
   *
   * @param {string} id
   * @returns {boolean}
   */
  function recordHeld(id) {
    const def = (RPG.data.records || {})[id];
    if (!def || !def.when) return false;
    const p = RPG.state.storyProfile();
    const g = (p && p.progress) || {};
    const w = def.when;
    if (w.flag) return !!(g.flags && g.flags[w.flag]);
    if (w.scene) return !!(g.scenes && g.scenes[w.scene]);
    if (w.chapter) return !!(g.cleared && g.cleared[w.chapter]);
    return false;
  }

  /**
   * 記録の一覧。宣言順＝手に入る順に並べる。
   * まだ手に入っていないものも器だけ返す（一覧側で伏せる）。
   * @returns {Array<{id: string, def: any, held: boolean}>}
   */
  function records() {
    const all = RPG.data.records || {};
    return Object.keys(all).map((id) => ({ id, def: all[id], held: recordHeld(id) }));
  }

  /**
   * 記録の関連項目を、飛び先ごとに解いて返す。
   * `see` には敵ID（em_/bs_）と用語ID（gl_）が混ざる。
   * @param {any} def
   * @returns {Array<{kind: string, id: string, label: string}>}
   */
  function recordLinks(def) {
    /** @type {Array<{kind: string, id: string, label: string}>} */
    const out = [];
    for (const sid of def.see || []) {
      const enemy = (RPG.data.enemies || {})[sid];
      if (enemy) { out.push({ kind: 'enemy', id: sid, label: enemy.name }); continue; }
      const term = (RPG.data.glossary || {})[sid];
      if (term) out.push({ kind: 'system', id: sid, label: term.term });
    }
    return out;
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
    recordHeld, records, recordLinks,
    record, enemyEntry, enemySeen, characterOwned, fieldEntry, fieldSeen,
    enemyHabitats, enemyPreview, progress, totalProgress, glossaryByGroup,
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
