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

  /**
   * ハードモードの上乗せ。
   *
   * ── 耐久を積んでも効かない ──
   * 実測で、能力倍率を20倍にしても勝率は100%のまま、
   * 決着が 3.4 → 5.0 ラウンドに延びるだけだった。
   * 1発の被害に上限を置いてあるので、**パーティが死なない** のが理由。
   *
   * 効くのは手数と、その1発の重さ。ハードではそこを動かす。
   */
  const HARD_SCALE = 6;
  /** 1ラウンドの行動回数への上乗せ。 */
  const HARD_ACTIONS = 2;
  /**
   * 取り巻きにかける倍率。本体より控えめにしてある。
   *
   * 取り巻きは「本体へ届くまでの関門」であって、削り合いの相手ではない。
   * 本体と同じ6倍にしたら、庇うボス（三重の守護者・闘技場の主）だけが
   * 勝率0%になった。時間の関門が、そのまま壁になっていた。
   */
  const HARD_ADD_SCALE = 2;
  /**
   * 1発で受ける被害の上限にかける倍率。
   *
   * ここは **崖** になっている。1.5 にすると「刹那の巨兵」だけが
   * 勝率0%へ落ちた。あのボスは初撃しか通らないので戦闘が長引き、
   * そのぶん被害が積み上がって、少し重くしただけで生き残れなくなる。
   * 1.25 まで戻すと 0% → 88% へ跳ね返る。
   * 手数（HARD_ACTIONS）のほうが、どのボスでも素直に効く。
   */
  const HARD_HIT_RATIO = 1.25;

  /** ハードモードで戦利品が出る確率。 */
  const HARD_DROP_RATE = 0.2;

  /** 上限を伸ばす道具のID。 */
  const CAP_ITEM = 'it_star_shard';

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
  function start(id, opts) {
    const def = boss(id);
    if (!def) throw new Error('未知の闘技場ボス: ' + id);
    const hard = !!(opts && opts.hard);

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
    // ハードモードは **敵のレベルを、いまのレベル上限に合わせる** (§17)。
    //
    // 固定値にすると、上限を伸ばした人にとってすぐ作業になる。
    // 上限に追随させておけば、伸ばすほど相手も伸びるので、
    // 「上限を上げる → もっと強い相手に挑める」が途切れない。
    const lv = hard ? Math.max(def.lv, RPG.state.levelCap()) : def.lv;
    const scale = hard ? def.scale * HARD_SCALE : def.scale;

    const main = RPG.units.buildEnemyUnit(def.enemyId, lv, true, 0, scale);
    main.name = def.name + (hard ? '（ハード）' : '');
    main.arenaBoss = true;

    // 攻撃力そのものは触らない。
    // 1発の重さは battle.js が maxHitRatio（最大HPに対する割合）で頭を押さえる。
    // 攻撃力を絞る方式では、技の威力倍率と属性有利に貫かれて一撃死が残るため。
    enemies.push(main);

    for (const add of def.adds || []) {
      for (let i = 0; i < add.count; i++) {
        enemies.push(RPG.units.buildEnemyUnit(
          add.enemyId, hard ? Math.max(add.lv, lv - 10) : add.lv,
          false, enemies.length, hard ? add.scale * HARD_ADD_SCALE : add.scale));
      }
    }
    enemies.forEach((e, i) => { e.key = 'e' + i; });
    battle.enemies = enemies;

    // ギミックの状態。hitsThisRound はラウンドごとに数え直す。
    battle.arena = {
      id: def.id, def, hard, gimmicks: def.gimmicks || {}, hitsThisRound: 0,
      // 実効値。ハードはここで上書きし、battle.js はこちらを見る。
      actionsPerRound: (def.actionsPerRound || 1) + (hard ? HARD_ACTIONS : 0),
      maxHitRatio: Math.min(0.95, def.maxHitRatio * (hard ? HARD_HIT_RATIO : 1)),
    };
    battle.totalWaves = 1;
    battle.wave = 1;
    battle.actorIndex = 0;
    battle.round = 1;
    battle.phase = 'command';

    battle.log.length = 0;
    battle.log.push({ text: `── ${def.name}${hard ? '（ハード）' : ''} ──`, kind: 'wave' });
    if (hard) {
      battle.log.push({ text: `敵のレベルは現在の上限 ${lv} に合わせられている`, kind: 'debuff' });
    }
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
    const hard = !!battle.arena.hard;
    const prev = st[id] || { cleared: false, bestRound: null };
    const rounds = battle.totalRounds;

    const first = hard ? !prev.hardCleared : !prev.cleared;
    const best = prev.bestRound == null || rounds < prev.bestRound;

    st[id] = Object.assign({}, prev, {
      cleared: prev.cleared || !hard,
      hardCleared: prev.hardCleared || hard,
      bestRound: best ? rounds : prev.bestRound,
      clears: (prev.clears || 0) + 1,
    });

    // ── 報酬 (§17) ──
    //
    // 通常は **初回制覇のときだけ**。周回して稼ぐ場所ではないので、
    // 何度倒しても出るようにすると、結局いちばん楽なボスを回すだけになる。
    //
    // ハードは倒すたびに抽選する。こちらは相手がレベル上限に追随するので、
    // 「楽な相手を回す」が成立しない。通う理由をここに置いてある。
    let shards = 0;
    if (!hard && first) shards = 1;
    if (hard && RPG.rng.chance(HARD_DROP_RATE)) shards = 1;
    if (shards > 0) RPG.state.addItem(CAP_ITEM, shards);

    RPG.state.persist();
    return { first, best, hard, shards };
  }

  /**
   * ハードに挑めるか。通常を先に制覇していること。
   * 順番を強制しないと、仕掛けを理解しないまま殴られて終わる。
   * @param {string} id
   */
  function canChallengeHard(id) {
    const r = record(id);
    if (!r || !r.cleared) return { ok: false, reason: 'まず通常を制覇すること' };
    return { ok: true };
  }

  RPG.arena = {
    bosses, boss, canChallenge, record, clearedCount,
    gimmickLines, start, finish, canChallengeHard,
    HARD_SCALE, HARD_ADD_SCALE, HARD_ACTIONS, HARD_HIT_RATIO, HARD_DROP_RATE, CAP_ITEM,
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
