// @ts-check
/**
 * 闘技場 (§17)。
 *
 * ── 塔との違い ──
 * 塔 (§10.7) は「連戦を戦い抜く」場所で、HPを持ち越しながらどこまで潜れるかを問う。
 * 闘技場は逆に **1体（＋取り巻き）と1戦だけ** 戦う。回復の余裕も立て直しもない。
 *
 * ── ここにだけ悪辣な仕掛けを置ける理由 ──
 * 周回して稼ぐ場所ではないので、通常のフィールドに置いたら苦痛でしかない
 * 「特定のビルドを名指しで否定する」ギミックを置ける。
 * 属性で解く道を塞ぎ、全体攻撃を無効にし、手数を数え、時間を区切る。
 *
 * 戦闘そのものは既存のエンジンをそのまま使う。
 * このモジュールが持つのは「どのボスに挑むか」と「記録」だけ。
 */
(function (RPG) {
  'use strict';

  /** セーブ側の記録 { ボスID: { cleared, bestRound } } */
  function store() {
    const s = RPG.state.get();
    if (!s.arena) s.arena = {};
    return s.arena;
  }

  /** 定義の一覧 */
  function bosses() {
    return RPG.data.arena.bosses;
  }

  /** @param {string} id */
  function boss(id) {
    return bosses().find((/** @type {any} */ b) => b.id === id) || null;
  }

  /**
   * 挑戦できるか。主人公のレベルだけで見る。
   * 装備や編成で門前払いにすると、何を直せばいいのか分からなくなるため。
   * @returns {{ok: boolean, reason?: string}}
   */
  function canChallenge() {
    const need = RPG.data.arena.unlockLevel;
    const hero = RPG.state.get().characters.ch_hero;
    if (!hero || hero.level < need) {
      return { ok: false, reason: `主人公のレベル${need}から挑戦できる（現在 ${hero ? hero.level : 1}）` };
    }
    return { ok: true };
  }

  /** @param {string} id */
  function record(id) {
    return store()[id] || null;
  }

  /** 攻略済みの数 */
  function clearedCount() {
    return bosses().filter((/** @type {any} */ b) => (store()[b.id] || {}).cleared).length;
  }

  /**
   * ギミックを人が読める形にする。挑む前に何が起きるか分かるようにするため。
   * 「知らないまま negated されて負ける」のは理不尽であって難しさではない。
   * @param {any} def
   * @returns {string[]}
   */
  function gimmickLines(def) {
    const g = def.gimmicks || {};
    const out = [];
    if (g.elementNull) out.push('属性相性が常に等倍になる（適応・極意・貫通が効かない）');
    if (g.elementAbsorb) out.push('有利属性の攻撃を回復として吸収する');
    if (g.guardedByAdds) out.push('取り巻きが生きている間、本体に一切ダメージが通らない');
    if (g.singleTargetOnly) out.push('全体攻撃は本体に届かない（単体攻撃のみ）');
    if (g.firstHitOnly) out.push('1ラウンドにつき、最初の一撃しかダメージが通らない');
    if (g.hitAbsorb) out.push(`1ラウンドにつき、最初の${g.hitAbsorb}発は無効化される`);
    if (g.enrageRound) out.push(`${g.enrageRound}ラウンド目にパーティ全滅級の一撃が飛ぶ`);
    return out;
  }

  /**
   * 闘技場の戦闘を開始する。
   * @param {string} id
   * @returns {any} battle
   */
  function start(id) {
    const def = boss(id);
    if (!def) throw new Error('未知の闘技場ボス: ' + id);

    // 戦闘の器は既存のものを流用する。ウェーブは1つだけ。
    const battle = RPG.battle.start({
      fieldId: firstFieldId(),
      waves: 1,
      party: RPG.state.partyUnits(),
      bossFinale: false,
    });

    // 出てくる敵を丸ごと差し替える
    /** @type {any[]} */
    const enemies = [];
    const main = RPG.units.buildEnemyUnit(def.enemyId, def.lv, true, 0, def.scale);
    main.name = def.name;
    main.arenaBoss = true;

    // 攻撃力そのものは触らない。
    // 1発の重さは battle.js が maxHitRatio（最大HPに対する割合）で頭を押さえる。
    // 攻撃力を絞る方式では、技の威力倍率と属性有利に貫かれて一撃死が残るため。
    enemies.push(main);

    for (const add of def.adds || []) {
      for (let i = 0; i < add.count; i++) {
        enemies.push(RPG.units.buildEnemyUnit(add.enemyId, add.lv, false, enemies.length, add.scale));
      }
    }
    enemies.forEach((e, i) => { e.key = 'e' + i; });
    battle.enemies = enemies;

    // ギミックの状態。hitsThisRound はラウンドごとに数え直す。
    battle.arena = { id: def.id, def, gimmicks: def.gimmicks || {}, hitsThisRound: 0 };
    battle.totalWaves = 1;
    battle.wave = 1;
    battle.actorIndex = 0;
    battle.round = 1;
    battle.phase = 'command';

    battle.log.length = 0;
    battle.log.push({ text: `── ${def.name} ──`, kind: 'wave' });
    battle.log.push({ text: def.desc, kind: 'info' });
    for (const line of gimmickLines(def)) {
      battle.log.push({ text: '【特殊】' + line, kind: 'debuff' });
    }

    return battle;
  }

  /** 闘技場は場所を持たないが、戦闘の器がフィールドを要求するので先頭を借りる。 */
  function firstFieldId() {
    return Object.keys(RPG.data.fields)[0];
  }

  /**
   * 決着を記録する。報酬はまだ置いていないので、記録だけを残す。
   * @param {any} battle
   * @returns {{first: boolean, best: boolean}|null}
   */
  function finish(battle) {
    if (!battle.arena || !battle.finished || !battle.victory) return null;
    const st = store();
    const id = battle.arena.id;
    const prev = st[id] || { cleared: false, bestRound: null };
    const rounds = battle.totalRounds;

    const first = !prev.cleared;
    const best = prev.bestRound == null || rounds < prev.bestRound;

    st[id] = {
      cleared: true,
      bestRound: best ? rounds : prev.bestRound,
      clears: (prev.clears || 0) + 1,
    };
    RPG.state.persist();
    return { first, best };
  }

  RPG.arena = {
    bosses, boss, canChallenge, record, clearedCount,
    gimmickLines, start, finish,
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
