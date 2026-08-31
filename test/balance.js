// @ts-check
/**
 * バランス検証シミュレータ (§14.2)。
 *
 * 「序盤・中盤・終盤のダメージ曲線が設計意図通りか」「周回時間は妥当か」を
 * 実際の戦闘エンジンとオート戦闘を使って数値で確かめる。
 *
 * ゲーム本体には読み込まれない。test/balance.html と test/index.html からのみ使う。
 * セーブデータには一切触れない（charSave 相当のオブジェクトをその場で組み立てる）。
 */
(function (RPG) {
  'use strict';

  /**
   * プレイヤーがだいたいこう振るだろう、という投資の優先順位。
   * 上から順に、SPとティア解放が許す限り振っていく。
   */
  const PRIORITY = [
    // 三系統を平行に。**違う系統タグは掛け算になる**ので、
    // 1本に集中するより散らすほうが強い（実測 Lv20 で 2.50R 対 2.17R）。
    'tr_phys1', 'tr_magi1', 'tr_reli1',
    // 「1ラウンド目を厚くする」。序盤の戦闘は1〜4ラウンドで終わるので、
    // 1ラウンド目だけの効果が実質いつでも効く効果になる。
    // 合わせて7SP・初級だけで 1R目 ×1.90（実測 Lv20 で 1.04R）。
    'tr_first_round', 'tr_opening',
    // 初級を埋めて中級・上級を開ける
    'tr_atk', 'tr_magi', 'tr_hp', 'tr_def',
    // 上級の乗算。3SPあたり +19% で、初級の基礎（1SPで+5%）より効率がよい
    'tr_all_tag',
    'tr_phys2', 'tr_magi2', 'tr_reli2',
    'tr_crit', 'tr_crit_dmg',
    'tr_guard', 'tr_execute', 'tr_regen', 'tr_lifesteal',
    // 限界超越（上限突破）は最後。
    //
    // 与ダメージが上限（1発 500,000）に届いていないあいだは **1ダメージも増えない**。
    // Lv20 の与ダメージは2,000前後で、上限には250倍足りない。
    // 効いてくるのは装備とツリーを積み切って上限に張り付いてから (§3.2 ステップ8)。
    'tr_cap',
  ];

  /**
   * 明示した優先順位を使い切ったあと、**残ったSPを振る先**。
   *
   * ── なぜ必要か ──
   * ここが無かったために、**259SP のうち 135SP しか使わない**想定ビルドで
   * 全部の測定が回っていた（124SP・48%が余ったまま）。しかも列挙した20個のうち
   * 3個（`tr_slot_acc` / `tr_slot_armor` / `tr_slot_weapon`）は、
   * 装備枠がレベル開放へ変わったときに**消えたIDのまま残っていた**。
   *
   * 上の一覧は Lv1〜100 を見ていた頃のもので、その帯では SP が少なく
   * 使い切れないことが自然だった。測定の対象が Lv255 まで伸びたのに、
   * 一覧のほうが取り残された。**「振り切った人」を測っているつもりで、
   * 半分しか振っていない人を測っていた。**
   *
   * 個別に列挙し続けると同じことが再発するので、**残りは自動で埋める**。
   * data/skilltree.js の定義順に、振れるものへ順に振る。
   * 順序が定義順なので、実行するたびに同じ結果になる。
   */
  function remainingNodes() {
    return (RPG.data.skillTree || []).map((/** @type {any} */ n) => n.id)
      .filter((/** @type {string} */ id) => PRIORITY.indexOf(id) < 0);
  }

  /**
   * レベル帯ごとの想定装備。
   *
   * plus は装備の強化値 (§7.6)。ここを 0 のままにしていた頃は、実際に遊んでいる人より
   * 想定パーティが大幅に弱く、「Lv50では深淵に勝てない」と出ていた。
   * 実プレイでは強化・セット効果・弱点コンボが乗るので、その帯で普通に到達する強化値を入れる。
   */
  const GEAR_BY_LEVEL = [
    { upTo: 10, box: 'box_bronze', rolls: 6, plus: 0 },
    { upTo: 25, box: 'box_bronze', rolls: 16, plus: 2 },
    { upTo: 45, box: 'box_silver', rolls: 20, plus: 4 },
    { upTo: 70, box: 'box_gold', rolls: 24, plus: 6 },
    { upTo: 999, box: 'box_dragon', rolls: 30, plus: 9 },
  ];

  /**
   * @param {number} level
   */
  function gearPlanFor(level) {
    return GEAR_BY_LEVEL.find((g) => level <= g.upTo) || GEAR_BY_LEVEL[GEAR_BY_LEVEL.length - 1];
  }

  /**
   * 優先順位に沿ってスキルツリーに振る。
   * @param {any} charSave
   */
  function investTree(charSave) {
    let guard = 0;
    let progressed = true;
    while (progressed && guard++ < 500) {
      progressed = false;
      // 明示した順に振り、使い切れなかったぶんを定義順で埋める。
      for (const nodeId of PRIORITY.concat(remainingNodes())) {
        while (RPG.tree.canInvest(charSave, nodeId).ok) {
          charSave.tree[nodeId] = (charSave.tree[nodeId] || 0) + 1;
          progressed = true;
        }
      }
    }
    return charSave;
  }

  /**
   * 想定ビルドが実際に使ったSPを数える。検証テストが使う。
   * @param {any} charSave
   * @returns {number}
   */
  function spentSp(charSave) {
    let sp = 0;
    for (const node of RPG.data.skillTree || []) {
      const lv = (charSave.tree || {})[node.id] || 0;
      sp += lv * (node.cost || 1);
    }
    return sp;
  }

  /**
   * そのキャラ専用の装備を鑑定し、スロットごとに一番強いものを着ける。
   * @param {any} charSave
   * @param {string} boxId
   * @param {number} rolls
   * @param {{next: () => number}} uid
   */
  function equipBest(charSave, boxId, rolls, uid, plus) {
    /** @type {any[]} */
    const inventory = [];
    for (let i = 0; i < rolls; i++) {
      const item = RPG.gear.identify(boxId, uid.next());
      // 実プレイに合わせて強化値を乗せる (§7.6)
      if (plus) {
        item.plus = plus;
        RPG.enhance.applyPlus(item);
      }
      inventory.push(item);
    }

    const slots = RPG.units.slotCounts(charSave);
    charSave.equipped = { weapon: [], armor: [], accessory: [] };
    for (const slot of Object.keys(slots)) {
      const best = inventory
        .filter((it) => it.slot === slot)
        .sort((a, b) => RPG.gear.score(b) - RPG.gear.score(a))
        .slice(0, slots[slot]);
      charSave.equipped[slot] = best.map((it) => it.uid);
    }
    return inventory;
  }

  /**
   * そのレベル帯の「普通に育てたキャラ」を1体作る。
   * @param {string} charId
   * @param {number} level
   * @param {number} limitBreak
   * @param {{next: () => number}} uid
   */
  function makeUnit(charId, level, limitBreak, uid) {
    const charSave = {
      id: charId, level, limitBreak,
      tree: {}, equipped: { weapon: [], armor: [], accessory: [] },
    };
    investTree(charSave);
    const plan = gearPlanFor(level);
    const inventory = equipBest(charSave, plan.box, plan.rolls, uid, plan.plus);
    return RPG.units.buildCharacterUnit(charSave, inventory);
  }

  /** 連番のIDを配る小道具 */
  function uidSource() {
    let n = 1;
    return { next: () => n++ };
  }

  /**
   * 想定パーティを作る。
   * @param {number} level
   * @param {number} [limitBreak]
   */
  function makeParty(level, limitBreak) {
    const uid = uidSource();
    return ['ch_hero', 'ch_rizel', 'ch_gald', 'ch_noa']
      .map((id) => makeUnit(id, level, limitBreak || 0, uid));
  }

  /* ============================================================
     ダメージ曲線
     ============================================================ */

  /**
   * そのユニットが一番火力を出せる攻撃技を選ぶ。
   * @param {any} unit
   * @param {any} dummy
   */
  function bestAttack(unit, dummy) {
    let best = null;
    for (const id of unit.skills) {
      const skill = RPG.data.skills[id];
      if (!RPG.autoplay.isAttack(skill)) continue;
      const dmg = RPG.autoplay.estimate(unit, dummy, skill);
      if (!best || dmg > best.damage) best = { id, skill, damage: dmg };
    }
    return best;
  }

  /**
   * 同レベルの基準敵。フィールド構成に左右されない純粋なダメージ曲線を見るために使う。
   * @param {number} level
   */
  function referenceDummy(level) {
    const def = Math.floor(level * 9 + 25);
    const hp = Math.floor(400 + level * level * 2.2);
    return {
      name: '基準敵', level, element: 'none',
      stats: { hp, atk: 0, def, magi_power: 0 },
      maxHp: hp, hp, defMultiplier: 1, defIgnoredTurns: 0,
      baseReduction: 0, buffReduction: [], passives: {}, alive: true,
    };
  }

  /**
   * レベル帯ごとのダメージ曲線を出す。
   * @param {number[]} levels
   * @param {number} [samples]
   */
  function damageCurve(levels, samples) {
    const n = samples || 400;
    return levels.map((level) => {
      RPG.rng.seed(1000 + level);
      const unit = makeUnit('ch_hero', level, level >= 60 ? 3 : 0, uidSource());
      const dummy = referenceDummy(level);
      const pick = bestAttack(unit, dummy);

      let total = 0;
      let capped = 0;
      let critTotal = 0;
      for (let i = 0; i < n; i++) {
        const r = RPG.damage.calc({
          attacker: RPG.units.toAttacker(unit),
          defender: RPG.units.toDefender(dummy),
          skill: pick.skill,
          options: {},
        });
        total += r.damage;
        if (r.breakdown.capped) capped++;
        if (r.crit) critTotal++;
      }
      RPG.rng.seed(null);

      const tagInfo = RPG.damage.tagMultiplier(unit.baseTagBonuses, pick.skill.damage_type);
      return {
        level,
        skill: pick.skill.name,
        atk: unit.stats.atk,
        hp: unit.maxHp,
        tagMult: tagInfo.multiplier,
        critRate: unit.baseCritRate,
        avg: Math.round(total / n),
        cappedRate: capped / n,
        critObserved: critTotal / n,
        dummyHp: dummy.maxHp,
        hitsToKill: Math.ceil(dummy.maxHp / Math.max(1, total / n)),
      };
    });
  }

  /* ============================================================
     周回シミュレーション（実際の戦闘エンジンを回す）
     ============================================================ */

  /**
   * オート戦闘で1戦こなし、結果を返す。
   * @param {{fieldId: string, waves: number, bossFinale: boolean, level: number, limitBreak?: number}} cfg
   */
  function runBattle(cfg) {
    const party = makeParty(cfg.level, cfg.limitBreak);
    const battle = RPG.battle.start({
      fieldId: cfg.fieldId, waves: cfg.waves, party, bossFinale: cfg.bossFinale,
    });

    let commands = 0;
    let rounds = 0;
    let guard = 0;
    while (!battle.finished && guard++ < 4000) {
      if (battle.phase === 'wave_clear') { RPG.battle.advanceWave(battle); continue; }
      const action = RPG.autoplay.chooseAction(battle);
      if (!action) break;
      // シミュレータはオート戦闘そのものなので、手動ボーナスは付かない扱いにする
      RPG.battle.commandSkill(battle, action.skillId, action.targets, { auto: true });
      commands++;
      rounds = Math.max(rounds, battle.round);
    }

    const survivors = battle.party.filter((/** @type {any} */ u) => u.alive).length;
    const hpLeft = battle.party.reduce((/** @type {number} */ s, /** @type {any} */ u) => s + u.hp, 0) /
      battle.party.reduce((/** @type {number} */ s, /** @type {any} */ u) => s + u.maxHp, 0);

    return {
      victory: battle.victory,
      commands, rounds,
      gold: battle.rewards.gold,
      exp: battle.rewards.exp,
      boxes: Object.keys(battle.rewards.boxes)
        .reduce((s, k) => s + battle.rewards.boxes[k], 0),
      survivors, hpLeft,
      stuck: guard >= 4000,
    };
  }

  /**
   * 同じ条件を何度も回して平均を取る。
   * @param {{fieldId: string, waves: number, bossFinale: boolean, level: number, limitBreak?: number, runs?: number, seed?: number}} cfg
   */
  function simulate(cfg) {
    const runs = cfg.runs || 30;
    RPG.rng.seed(cfg.seed == null ? 777 : cfg.seed);

    const results = [];
    for (let i = 0; i < runs; i++) results.push(runBattle(cfg));
    RPG.rng.seed(null);

    const wins = results.filter((r) => r.victory);
    const avg = (/** @type {(r: any) => number} */ f, /** @type {any[]} */ set) =>
      set.length ? set.reduce((s, r) => s + f(r), 0) / set.length : 0;

    return {
      fieldId: cfg.fieldId,
      level: cfg.level,
      waves: cfg.waves,
      runs,
      winRate: wins.length / runs,
      rounds: avg((r) => r.rounds, wins),
      commands: avg((r) => r.commands, wins),
      gold: avg((r) => r.gold, wins),
      exp: avg((r) => r.exp, wins),
      boxes: avg((r) => r.boxes, wins),
      hpLeft: avg((r) => r.hpLeft, wins),
      survivors: avg((r) => r.survivors, wins),
      goldPerRound: wins.length ? avg((r) => r.gold, wins) / Math.max(1, avg((r) => r.rounds, wins)) : 0,
      stuck: results.filter((r) => r.stuck).length,
    };
  }

  /* ============================================================
     経済シミュレーション
     ============================================================ */

  /**
   * その宝箱から出る装備1個の平均売却額。
   * 実際に鑑定してみて平均を取る（レアリティ抽選込みの期待値になる）。
   * @param {string} boxId
   * @param {number} [samples]
   */
  function boxSellValue(boxId, samples) {
    const n = samples || 300;
    const uid = uidSource();
    let total = 0;
    RPG.rng.seed(4242);
    for (let i = 0; i < n; i++) {
      total += RPG.state.sellValue(RPG.gear.identify(boxId, uid.next()));
    }
    RPG.rng.seed(null);
    return total / n;
  }

  /**
   * 1周でどの宝箱が何個出るかを実測する。
   * simulate() は個数の合計しか返さないため、ここでは種類別に数え直す。
   * @param {{fieldId: string, waves: number, bossFinale: boolean, level: number, limitBreak?: number, runs?: number}} cfg
   */
  function boxYield(cfg) {
    const runs = cfg.runs || 30;
    RPG.rng.seed(31337);
    /** @type {Record<string, number>} */
    const totals = {};
    let wins = 0;
    for (let i = 0; i < runs; i++) {
      const party = makeParty(cfg.level, cfg.limitBreak);
      const battle = RPG.battle.start({
        fieldId: cfg.fieldId, waves: cfg.waves, party, bossFinale: cfg.bossFinale,
      });
      let guard = 0;
      while (!battle.finished && guard++ < 4000) {
        if (battle.phase === 'wave_clear') { RPG.battle.advanceWave(battle); continue; }
        const action = RPG.autoplay.chooseAction(battle);
        if (!action) break;
        RPG.battle.commandSkill(battle, action.skillId, action.targets, { auto: true });
      }
      if (!battle.victory) continue;
      wins++;
      for (const k of Object.keys(battle.rewards.boxes)) {
        totals[k] = (totals[k] || 0) + battle.rewards.boxes[k];
      }
    }
    RPG.rng.seed(null);
    /** @type {Record<string, number>} */
    const perRun = {};
    for (const k of Object.keys(totals)) perRun[k] = totals[k] / Math.max(1, wins);
    return perRun;
  }

  /**
   * フィールド1つぶんの経済指標。
   *
   * 「1周でいくら稼げて、何周でレベルが1上がるか」を出す。
   * 数字を眺めるだけで、金が余っているのか経験値が足りないのかが分かるようにするのが目的。
   *
   * @param {{fieldId: string, level: number, waves?: number, runs?: number, partySize?: number}} cfg
   */
  function economy(cfg) {
    const waves = cfg.waves || 5;
    const partySize = cfg.partySize || 4;
    const sim = simulate({
      fieldId: cfg.fieldId, waves, bossFinale: true,
      level: cfg.level, runs: cfg.runs || 24,
    });

    const boxes = boxYield({
      fieldId: cfg.fieldId, waves, bossFinale: true,
      level: cfg.level, runs: cfg.runs || 24,
    });

    let boxGold = 0;
    /** @type {string[]} */
    const boxParts = [];
    for (const boxId of Object.keys(boxes)) {
      const each = boxSellValue(boxId);
      boxGold += boxes[boxId] * each;
      boxParts.push(`${RPG.data.boxes[boxId].name}×${boxes[boxId].toFixed(1)}`);
    }

    // 実際にプレイヤーの手に渡る額（オート周回を想定＝手動ボーナスなし）
    const expEach = RPG.economy.expShare(sim.exp, partySize);
    const needed = RPG.units.expToNext(cfg.level);
    const totalGold = sim.gold + boxGold;

    return {
      fieldId: cfg.fieldId,
      name: RPG.data.fields[cfg.fieldId].name,
      level: cfg.level,
      winRate: sim.winRate,
      rounds: sim.rounds,
      directGold: sim.gold,
      boxGold,
      totalGold,
      // 直接ドロップが総収入の何割か。ハクスラとしては宝箱側が主であってほしい。
      directShare: totalGold > 0 ? sim.gold / totalGold : 0,
      // 時間あたりの実入り。宝箱の期待額を含むので、進む動機を見るのはこの値。
      totalPerRound: sim.rounds > 0 ? totalGold / sim.rounds : 0,
      boxDetail: boxParts.join('、'),
      exp: sim.exp,
      expEach,
      expNeeded: needed,
      runsPerLevel: expEach > 0 ? needed / expEach : Infinity,
      runsPerPull: totalGold > 0 ? RPG.data.gacha.cost / totalGold : Infinity,
      // 1レベル上げるあいだに何回ガチャが引けてしまうか。ここが大きいほど金が余っている。
      pullsPerLevel: totalGold > 0 && expEach > 0
        ? (needed / expEach) * (totalGold / RPG.data.gacha.cost)
        : Infinity,
    };
  }

  /**
   * 経済を測るときのレベル。
   * 推奨Lv1のフィールドをLv1で測ると「Lv1→2に必要な経験値60」が基準になり、
   * 「1周でレベルが上がる」という現実離れした値が出てしまう。実際にそこを周回している
   * 帯の下限としてLv5を床にする。
   * @param {string} fieldId
   */
  function economyLevel(fieldId) {
    return Math.max(5, RPG.data.fields[fieldId].rec_level);
  }

  /** 各フィールドを推奨レベルで測る */
  function economyTable() {
    return Object.keys(RPG.data.fields).map((fieldId) =>
      economy({ fieldId, level: economyLevel(fieldId) }));
  }

  RPG.balance = {
    PRIORITY, GEAR_BY_LEVEL, remainingNodes, spentSp,
    makeUnit, makeParty, investTree, equipBest, uidSource,
    referenceDummy, bestAttack, damageCurve, runBattle, simulate,
    boxSellValue, boxYield, economy, economyLevel, economyTable,
  };
})(window.RPG);
