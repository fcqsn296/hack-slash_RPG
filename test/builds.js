// @ts-check
/**
 * ビルドの多様性検証。
 *
 * 設計書 §1.2 は「自分だけの最強ビルド」を核に据え、§5.4 は
 * 万能型／特化型／無属性ゴリ押しを **並立する選択肢** として定義している。
 * それが本当に成立しているか（＝一強が無いか、特化型は場所を選ぶか）を
 * 実際の戦闘エンジンで測る。
 *
 * 比較の公平性:
 *   - 同じレベル・同じ限界突破
 *   - 同じ乱数シードで装備を鑑定するので、手に入る装備は全ビルド共通
 *   - 装備の選択は自動装備に任せる（プレイヤーが最適に組んだ状態を想定）
 *   - 消費SPを記録し、極端に偏っていないか確認できるようにする
 */
(function (RPG) {
  'use strict';

  /**
   * 比較するビルド。plan は投資したい順に並べたノードID。
   * ティアが未解放なら飛ばし、解放され次第また拾う。
   */
  const BUILDS = [
    {
      id: 'phys', name: '物理集中', kind: 'tag',
      desc: '[物理]系統だけに寄せる。同一タグ内は加算なので伸びは直線的',
      plan: ['tr_atk', 'tr_phys1', 'tr_crit', 'tr_phys2', 'tr_crit_dmg', 'tr_cap', 'tr_hp'],
    },
    {
      id: 'spread', name: '三系統分散', kind: 'tag',
      desc: '物理・魔術・遺物に散らす。異なるタグ同士は乗算 (§3.2)',
      plan: ['tr_atk', 'tr_phys1', 'tr_magi1', 'tr_reli1', 'tr_all_tag', 'tr_phys2', 'tr_magi2', 'tr_reli2'],
    },
    {
      id: 'crit', name: '会心特化', kind: 'offense',
      desc: 'クリティカル率と倍率、追い打ちに寄せる',
      plan: ['tr_atk', 'tr_phys1', 'tr_crit', 'tr_crit_dmg', 'tr_execute', 'tr_phys2', 'tr_cap'],
    },
    {
      id: 'adapt', name: '万能型', kind: 'element',
      desc: '§5.4 全属性適応。どのエリアでも安定するが火力を犠牲にする',
      plan: ['tr_atk', 'tr_phys1', 'tr_hp', 'tr_crit', 'tr_adapt', 'tr_phys2'],
    },
    {
      id: 'mastery', name: '光の特化型', kind: 'element',
      desc: '§5.4 ○○の極意。有利属性には強いが、それ以外では無力',
      plan: ['tr_atk', 'tr_phys1', 'tr_hp', 'tr_mastery_light', 'tr_crit', 'tr_phys2', 'tr_crit_dmg'],
    },
    {
      id: 'chaos', name: '無属性ゴリ押し', kind: 'element',
      desc: '§5.4 混沌の力。属性パズルを捨ててATK+50%で殴る',
      plan: ['tr_atk', 'tr_phys1', 'tr_hp', 'tr_crit', 'tr_chaos', 'tr_phys2'],
    },
    {
      id: 'tank', name: '生存特化', kind: 'defense',
      desc: '被ダメージ軽減と復活。落ちないことを優先する',
      plan: ['tr_hp', 'tr_def', 'tr_phys1', 'tr_guard', 'tr_regen', 'tr_fortress', 'tr_revive', 'tr_lifesteal'],
    },
    {
      id: 'skills', name: 'ツリー技型', kind: 'offense',
      desc: 'ツリーで覚えるアクティブ技に投資する (§5.1)',
      plan: ['tr_atk', 'tr_phys1', 'tr_grant_rally', 'tr_crit', 'tr_grant_triple', 'tr_grant_ruin', 'tr_grant_bastion'],
    },
    {
      id: 'balanced', name: 'バランス', kind: 'mixed',
      desc: '火力・生存・タグ分散をほどよく',
      plan: ['tr_atk', 'tr_hp', 'tr_phys1', 'tr_magi1', 'tr_crit', 'tr_guard', 'tr_phys2', 'tr_all_tag'],
    },
    {
      id: 'berserk', name: '背水型', kind: 'offense',
      desc: 'HPが減っているほど強くなる。吸命と再生で綱渡りする',
      plan: ['tr_atk', 'tr_phys1', 'tr_low_hp', 'tr_lifesteal', 'tr_crit', 'tr_phys2', 'tr_regen'],
    },
    {
      id: 'thorns', name: '棘反射型', kind: 'defense',
      desc: '殴られるほど相手が削れる。反撃と棘に全振り',
      plan: ['tr_hp', 'tr_def', 'tr_thorns', 'tr_counter', 'tr_guard', 'tr_thorns_hi', 'tr_last_stand', 'tr_fortress'],
    },
    {
      id: 'debuff', name: '呪詛型', kind: 'offense',
      desc: 'デバフを撒いてから追い討ちで殴る',
      plan: ['tr_atk', 'tr_magi1', 'tr_grant_hex', 'tr_debuff_amp', 'tr_guard_break', 'tr_magi2', 'tr_crit'],
    },
    {
      id: 'double', name: '双撃型', kind: 'offense',
      desc: 'ATKを犠牲に攻撃技を必ず2回発動させる',
      plan: ['tr_atk', 'tr_phys1', 'tr_crit', 'tr_phys2', 'tr_double', 'tr_crit_dmg'],
    },
    {
      id: 'burst', name: '先制型', kind: 'offense',
      desc: '開幕バフと奇襲で1ラウンド目に決着をつける',
      plan: ['tr_atk', 'tr_opening', 'tr_first_round', 'tr_phys1', 'tr_crit', 'tr_crit_dmg', 'tr_phys2'],
    },
    {
      id: 'sweep', name: '殲滅型', kind: 'offense',
      desc: '全体攻撃と波及で複数の敵をまとめて処理する',
      plan: ['tr_atk', 'tr_phys1', 'tr_grant_storm', 'tr_crit', 'tr_phys2', 'tr_chain'],
    },
  ];

  /** 比較に使うパーティ構成（全ビルド共通） */
  const PARTY = ['ch_hero', 'ch_rizel', 'ch_gald', 'ch_noa'];

  /**
   * どのビルドでも最優先で取る共通ノード。
   * 装備枠は3つで計13SPと安く、装備の数がそのまま増えるため、
   * 実際のプレイでは方針に関係なく全員が取る。ここを外すと比較が現実離れする。
   */
  const CORE = ['tr_slot_acc', 'tr_slot_armor', 'tr_slot_weapon'];

  /**
   * ビルドの狙いを振り切ったあとの余りSPを注ぐ先。
   * ここを揃えないと「SPを使い残したビルド」が不当に弱く見えてしまう。
   */
  const FALLBACK = [
    'tr_atk', 'tr_hp', 'tr_def', 'tr_phys1', 'tr_magi1', 'tr_reli1',
    'tr_crit', 'tr_phys2', 'tr_magi2', 'tr_reli2', 'tr_cap', 'tr_all_tag',
    'tr_regen', 'tr_lifesteal', 'tr_guard', 'tr_crit_dmg',
  ];

  /**
   * 指定した順序でツリーに振る。ティア解放待ちのノードは後の周回で拾う。
   * plan を振り切っても SP が余る場合は FALLBACK に流し、全ビルドの消費SPを揃える。
   * @param {any} charSave
   * @param {string[]} plan
   */
  function investPlan(charSave, plan) {
    const seen = {};
    const order = CORE.concat(plan, FALLBACK).filter((id) => {
      if (seen[id]) return false;
      seen[id] = true;
      return true;
    });
    let progressed = true;
    let guard = 0;
    while (progressed && guard++ < 200) {
      progressed = false;
      for (const nodeId of order) {
        while (RPG.tree.canInvest(charSave, nodeId).ok) {
          charSave.tree[nodeId] = (charSave.tree[nodeId] || 0) + 1;
          progressed = true;
        }
      }
    }
    return charSave;
  }

  /**
   * そのビルドのパーティを作る。装備は全ビルドで同じ乱数から鑑定する。
   * @param {any} build
   * @param {number} level
   * @param {number} limitBreak
   * @param {number} gearSeed
   */
  function makeParty(build, level, limitBreak, gearSeed) {
    return PARTY.map((id, i) => {
      const charSave = {
        id, level, limitBreak,
        tree: {}, equipped: { weapon: [], armor: [], accessory: [] },
      };
      investPlan(charSave, build.plan);

      // 装備はビルドに関わらず同じ品揃えから選ぶ（シードをキャラごとに固定）
      RPG.rng.seed(gearSeed + i * 1000);
      const plan = RPG.balance.GEAR_BY_LEVEL.find((g) => level <= g.upTo);
      /** @type {any[]} */
      const inventory = [];
      for (let n = 0; n < plan.rolls; n++) inventory.push(RPG.gear.identify(plan.box, n + 1));
      RPG.rng.seed(null);

      // 自動装備に任せる（プレイヤーが最適に組んだ状態を想定）
      const result = RPG.autoequip.optimize(charSave, inventory);
      charSave.equipped = result.equipped;

      return RPG.units.buildCharacterUnit(charSave, inventory);
    });
  }

  /**
   * そのビルドの消費SPと主な効果を要約する。
   * @param {any} build
   * @param {number} level
   * @param {number} limitBreak
   */
  function summarize(build, level, limitBreak) {
    const charSave = {
      id: 'ch_hero', level, limitBreak,
      tree: {}, equipped: { weapon: [], armor: [], accessory: [] },
    };
    investPlan(charSave, build.plan);
    const eff = RPG.tree.effects(charSave.tree);
    const totalSp = (level - 1) + limitBreak;
    return {
      spent: RPG.tree.spentSp(charSave.tree),
      totalSp,
      tagMult: RPG.damage.tagMultiplier(eff.tagBonuses, 'phys').multiplier,
      crit: eff.crit,
      critDamage: eff.critDamage,
      reduction: eff.reduction,
      skills: eff.skills.length,
      elementMods: eff.elementMods,
    };
  }

  /**
   * 基準敵に対する1ラウンドの期待ダメージ（パーティ合計）。
   * @param {any[]} party
   * @param {number} enemyLevel
   */
  function roundDamage(party, enemyLevel) {
    const dummy = RPG.balance.referenceDummy(enemyLevel);
    return party.reduce((sum, u) => {
      const best = RPG.balance.bestAttack(u, dummy);
      return sum + (best ? best.damage : 0);
    }, 0);
  }

  /**
   * ビルド × フィールドで実戦を回す。
   * @param {any} build
   * @param {string} fieldId
   * @param {{level: number, limitBreak: number, runs: number, seed: number}} cfg
   */
  function runField(build, fieldId, cfg) {
    const results = [];
    for (let i = 0; i < cfg.runs; i++) {
      const party = makeParty(build, cfg.level, cfg.limitBreak, cfg.seed + i);
      RPG.rng.seed(cfg.seed + i * 7919);

      const battle = RPG.battle.start({
        fieldId, waves: 5, party, bossFinale: true,
      });
      let guard = 0;
      while (!battle.finished && guard++ < 4000) {
        if (battle.phase === 'wave_clear') { RPG.battle.advanceWave(battle); continue; }
        const action = RPG.autoplay.chooseAction(battle);
        if (!action) break;
        RPG.battle.commandSkill(battle, action.skillId, action.targets, { auto: true });
      }
      RPG.rng.seed(null);

      const hpLeft = battle.party.reduce((s, /** @type {any} */ u) => s + u.hp, 0) /
        battle.party.reduce((s, /** @type {any} */ u) => s + u.maxHp, 0);
      results.push({ victory: battle.victory, rounds: battle.round, hpLeft });
    }

    const wins = results.filter((r) => r.victory);
    return {
      winRate: wins.length / results.length,
      rounds: wins.length ? wins.reduce((s, r) => s + r.rounds, 0) / wins.length : 0,
      hpLeft: wins.length ? wins.reduce((s, r) => s + r.hpLeft, 0) / wins.length : 0,
    };
  }

  /**
   * 全ビルド × 全フィールドを比較する。
   * @param {{level: number, limitBreak: number, fields: string[], runs: number, seed: number}} cfg
   * @param {(done: number, total: number, label: string) => void} [onProgress]
   */
  function compare(cfg, onProgress) {
    const rows = [];
    let done = 0;
    const total = BUILDS.length;

    // フィールドごとに、そこの推奨レベルで戦う。
    // 固定レベルにすると上位ビルドが全フィールドを蹂躙して差が出ない。
    const levelFor = (/** @type {string} */ fieldId) => RPG.data.fields[fieldId].rec_level;

    for (const build of BUILDS) {
      if (onProgress) onProgress(done, total, build.name);

      const specLevel = levelFor(cfg.fields[cfg.fields.length - 1]);
      const party = makeParty(build, specLevel, cfg.limitBreak, cfg.seed);
      const info = summarize(build, specLevel, cfg.limitBreak);

      /** @type {Record<string, any>} */
      const perField = {};
      for (const fieldId of cfg.fields) {
        perField[fieldId] = runField(build, fieldId, {
          level: levelFor(fieldId), limitBreak: cfg.limitBreak, runs: cfg.runs, seed: cfg.seed,
        });
      }

      const winRates = cfg.fields.map((f) => perField[f].winRate);
      rows.push({
        build,
        info,
        dps: roundDamage(party, specLevel),
        perField,
        avgWin: winRates.reduce((s, w) => s + w, 0) / winRates.length,
        minWin: Math.min.apply(null, winRates),
        maxWin: Math.max.apply(null, winRates),
      });
      done++;
    }

    if (onProgress) onProgress(total, total, '完了');
    return rows;
  }

  RPG.buildLab = {
    BUILDS, PARTY, CORE, FALLBACK,
    investPlan, makeParty, summarize, roundDamage, runField, compare,
  };
})(window.RPG);
