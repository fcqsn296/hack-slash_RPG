// @ts-check
/**
 * エンドレスタワー (§10.7)。
 *
 * ── 実装の方針 ──
 * 戦闘そのものは既存のエンジンをそのまま使う。階ごとの敵の強さは、クエストが持っている
 * enemyLv / enemyScale の上書き機構を借りて表現する（同じ仕組みを2つ作らないため）。
 * このモジュールが持つのは「今どの階か」「HPをどれだけ持ち越しているか」だけ。
 *
 * ── 手動が有利になる理由 ──
 * HPが階をまたいで持ち越されるので、1階あたりの被害を抑えられるほど深く行ける。
 * 弱点コンボ (§10.6) を繋げば少ないラウンドで倒せて被害も減るが、オートAIは
 * 目先の最大ダメージしか見ないためコンボを組めない。速さではなく深さで差がつく。
 */
(function (RPG) {
  'use strict';

  /** セーブ側の記録。 */
  function store() {
    const s = RPG.state.get();
    if (!s.tower) s.tower = { best: 0, claimed: 0, run: null };
    if (s.tower.claimed == null) s.tower.claimed = 0;
    return s.tower;
  }

  /** 最高到達階。 */
  function best() {
    return store().best || 0;
  }

  /** 挑戦中の内容。挑戦していなければ null。 */
  function run() {
    return store().run || null;
  }

  /**
   * その階が属する階層帯。
   * @param {number} floor
   */
  function tierOf(floor) {
    const tiers = RPG.data.tower.tiers;
    let found = tiers[0];
    for (const t of tiers) if (floor >= t.from) found = t;
    return found;
  }

  /**
   * その階がボス階か。
   * @param {number} floor
   */
  function isBossFloor(floor) {
    return floor % RPG.data.tower.bossEvery === 0;
  }

  /**
   * その階の敵の強さ。
   * @param {number} floor
   * @returns {{fieldId: string, label: string, enemyLv: number, enemyScale: number, boss: boolean}}
   */
  function floorSpec(floor) {
    const cfg = RPG.data.tower;
    const tier = tierOf(floor);
    const boss = isBossFloor(floor);
    return {
      fieldId: tier.fieldId,
      label: tier.label,
      enemyLv: Math.max(1, Math.round(1 + floor * cfg.levelPerFloor)),
      enemyScale: +(1 + floor * cfg.scalePerFloor).toFixed(3) * (boss ? cfg.bossScale : 1),
      boss,
    };
  }

  /**
   * 戦闘エンジンへ渡す設定。クエストと同じ形にして機構を使い回す。
   *
   * id を持たせないのが要点で、こうしておくと finishBattle の
   * 「クエストの初回クリア報酬」の処理が走らない。
   * @param {number} floor
   */
  function battleConfig(floor) {
    const spec = floorSpec(floor);
    return {
      fieldId: spec.fieldId,
      waves: 1,
      bossFinale: spec.boss,
      quest: {
        name: `塔 ${floor}階（${spec.label}）`,
        fieldId: spec.fieldId,
        waves: 1,
        bossFinale: spec.boss,
        enemyLv: spec.enemyLv,
        enemyScale: spec.enemyScale,
        rules: {},
      },
      tower: { floor: floor, boss: spec.boss },
    };
  }

  /**
   * 途中から始められる階の一覧 (§10.7)。
   *
   * 一度登った深さまでは、階層帯の入口から再開できる。
   * 深いビルドを作るたびに1階から潜り直させるのは、ただの時間の浪費になるため。
   * 到達報酬は「最高到達階の更新時のみ」なので、飛ばした階の報酬は出ない。
   *
   * @returns {Array<{floor: number, label: string, reached: boolean}>}
   */
  function startPoints() {
    const b = best();
    const out = [{ floor: 1, label: RPG.data.tower.tiers[0].label, reached: true }];
    for (const tier of RPG.data.tower.tiers) {
      if (tier.from === 1) continue;
      out.push({ floor: tier.from, label: tier.label, reached: b >= tier.from });
    }
    // 最高到達階の続きからも始められる（帯の途中で止めた場合のため）
    if (b >= 1) {
      const next = b + 1;
      if (!out.some((p) => p.floor === next)) {
        out.push({ floor: next, label: `最高到達の続き`, reached: true });
      }
    }
    return out.sort((x, y) => x.floor - y.floor);
  }

  /**
   * その階から始められるか。到達したことのある深さまでしか選べない。
   * @param {number} floor
   */
  function canStartAt(floor) {
    if (floor <= 1) return true;
    return floor <= best() + 1;
  }

  /**
   * 挑戦を始める。
   * @param {number} [floor] 開始する階。省略すると1階から。
   * @returns {{ok: boolean, reason?: string}}
   */
  function start(floor) {
    // レベルで解禁する (§10.7)
    {
      const gate = canChallenge();
      if (!gate.ok) return { ok: false, reason: gate.reason || '' };
    }
    const s = RPG.state.get();
    if (s.party.length === 0) return { ok: false, reason: 'パーティが空です' };
    const from = Math.max(1, Math.floor(floor || 1));
    if (!canStartAt(from)) {
      return { ok: false, reason: `${from}階からは始められません（到達済みは ${best()}階まで）` };
    }
    const t = store();
    t.run = { floor: from, hp: {}, cleared: from - 1, startedAt: Date.now() };
    RPG.state.persist();
    return { ok: true };
  }

  /**
   * 挑戦をやめる。到達階の記録は残る。
   */
  function retire() {
    const t = store();
    const r = t.run;
    t.run = null;
    RPG.state.persist();
    return { ok: true, floor: r ? r.cleared : 0 };
  }

  /**
   * 今の階に挑む戦闘を組み立てる。HPは前の階から持ち越す。
   * @returns {any|null} battle
   */
  function enter() {
    const t = store();
    if (!t.run) return null;

    const party = RPG.state.partyUnits();
    // 前の階で減ったぶんを引き継ぐ。回復はボス階を越えたときだけ (§10.7)
    for (const unit of party) {
      const ratio = t.run.hp[unit.id];
      if (ratio == null) continue;
      unit.hp = Math.max(0, Math.min(unit.maxHp, Math.round(unit.maxHp * ratio)));
      unit.alive = unit.hp > 0;
    }
    // 全員倒れている状態では始められない（前の階で敗北しているはず）
    if (!party.some((/** @type {any} */ u) => u.alive)) return null;

    const cfg = battleConfig(t.run.floor);
    const battle = RPG.battle.start({
      fieldId: cfg.fieldId, waves: cfg.waves, party,
      bossFinale: cfg.bossFinale, quest: cfg.quest,
    });
    battle.tower = cfg.tower;
    return battle;
  }

  /**
   * 階のクリア／敗北を反映する。
   *
   * @param {any} battle
   * @returns {{cleared: boolean, floor: number, finished: boolean, healed: boolean,
   *            record: boolean, rewards: string[]}}
   */
  function resolve(battle) {
    const t = store();
    if (!t.run || !battle || !battle.tower) {
      return { cleared: false, floor: 0, finished: true, healed: false, record: false, rewards: [] };
    }

    const floor = battle.tower.floor;

    if (!battle.victory) {
      // 倒れたら終了。記録だけ残して撤収する。
      t.run = null;
      RPG.state.persist();
      return { cleared: false, floor, finished: true, healed: false, record: false, rewards: [] };
    }

    // HPを持ち越す
    /** @type {Record<string, number>} */
    const hp = {};
    for (const unit of battle.party) {
      hp[unit.id] = unit.alive ? unit.hp / unit.maxHp : 0;
    }

    // ボス階を越えたら少し立て直せる
    let healed = false;
    if (isBossFloor(floor)) {
      healed = true;
      for (const id of Object.keys(hp)) {
        // 倒れた仲間は起き上がらない。生きている者だけが回復する。
        if (hp[id] > 0) hp[id] = Math.min(1, hp[id] + RPG.data.tower.restHeal);
      }
    }

    t.run.hp = hp;
    t.run.cleared = floor;
    t.run.floor = floor + 1;

    // 最高到達階の更新時だけ報酬を出す
    const record = floor > (t.best || 0);
    const rewards = record ? claimTo(floor) : [];
    if (record) t.best = floor;

    RPG.state.persist();
    return { cleared: true, floor, finished: false, healed, record, rewards };
  }

  /**
   * まだ受け取っていない階までの到達報酬をまとめて渡す。
   *
   * @param {number} floor 到達した階
   * @returns {string[]} 受け取った内容の説明
   */
  function claimTo(floor) {
    const t = store();
    const cfg = RPG.data.tower.reward;
    /** @type {string[]} */
    const lines = [];

    let gold = 0;
    /** @type {Record<string, number>} */
    const boxes = {};

    for (let f = (t.claimed || 0) + 1; f <= floor; f++) {
      gold += cfg.goldPerFloor * f;
      if (f % cfg.boxEvery === 0) {
        const box = boxFor(f);
        boxes[box] = (boxes[box] || 0) + 1;
      }
      // 節目の報酬
      for (const m of RPG.data.tower.milestones) {
        if (m.floor !== f) continue;
        if (m.gold) gold += m.gold;
        for (const b of Object.keys(m.boxes || {})) boxes[b] = (boxes[b] || 0) + m.boxes[b];
        if (m.autoCharge) {
          const now = RPG.autolimit.grantMax(m.autoCharge);
          lines.push(`${f}階: オート回数の上限 +${m.autoCharge}（${now}）`);
        }
        if (m.equip) {
          const item = RPG.gear.forge(m.equip, RPG.state.nextUid());
          RPG.state.get().inventory.push(item);
          lines.push(`${f}階: ${item.name}`);
        }
      }
    }

    if (gold > 0) {
      RPG.state.addGold(gold);
      lines.unshift(`${gold.toLocaleString()} G`);
    }
    for (const b of Object.keys(boxes)) {
      RPG.state.addBox(b, boxes[b]);
      lines.push(`${RPG.data.boxes[b].name}×${boxes[b]}`);
    }

    t.claimed = Math.max(t.claimed || 0, floor);
    return lines;
  }

  /**
   * その階で出る宝箱。
   * @param {number} floor
   */
  function boxFor(floor) {
    let box = RPG.data.tower.reward.boxTiers[0].box;
    for (const t of RPG.data.tower.reward.boxTiers) if (floor >= t.from) box = t.box;
    return box;
  }

  /**
   * 次の節目。表示用。
   * @param {number} floor
   */
  function nextMilestone(floor) {
    return RPG.data.tower.milestones.find((m) => m.floor > floor) || null;
  }

  /**
   * 挑戦中の様子。
   */
  function status() {
    const t = store();
    if (!t.run) return { active: false, best: t.best || 0 };

    const spec = floorSpec(t.run.floor);
    const s = RPG.state.get();
    /** @type {Array<{id: string, name: string, ratio: number}>} */
    const party = s.party
      .filter((/** @type {string} */ id) => !!s.characters[id])
      .map((/** @type {string} */ id) => ({
        id,
        name: RPG.state.charName(id),
        ratio: t.run.hp[id] == null ? 1 : t.run.hp[id],
      }));

    return {
      active: true,
      best: t.best || 0,
      floor: t.run.floor,
      cleared: t.run.cleared || 0,
      spec,
      party,
      wiped: party.length > 0 && party.every((p) => p.ratio <= 0),
      nextMilestone: nextMilestone(t.run.cleared || 0),
    };
  }

  /**
   * 塔に挑めるか (§10.7)。闘技場と同じく**主人公のレベル**だけで見る。
   * 装備や編成で門前払いにすると、何を直せばいいのか分からなくなる。
   * @returns {{ok: boolean, reason?: string, need: number}}
   */
  function canChallenge() {
    const need = RPG.data.tower.unlockLevel || 0;
    const hero = RPG.state.get().characters.ch_hero;
    const level = hero ? hero.level : 1;
    if (level < need) {
      return { ok: false, need, reason: `主人公のレベル${need}から挑戦できる（現在 ${level}）` };
    }
    return { ok: true, need };
  }

  RPG.tower = {
    canChallenge,
    store, best, run, status,
    tierOf, isBossFloor, floorSpec, battleConfig, boxFor, nextMilestone,
    startPoints, canStartAt,
    start, retire, enter, resolve, claimTo,
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
