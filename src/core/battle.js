// @ts-check
/**
 * ターン制コマンド戦闘エンジン (§2.2 / §10.1)。
 *
 * ターン進行:
 *   パーティメンバー1..N が順にコマンド選択 → 行動実行
 *     ↓
 *   敵の行動（生存メンバーからランダムに対象選択）
 *     ↓
 *   ループ（全滅 or 敵撃破まで）
 *
 * 特殊なスキルロジックはこのファイルに書かない。すべて src/plugins/*.js に分離し、
 * ここは「プラグインに文脈(ctx)を渡して呼ぶ」ことしかしない (§9.1)。
 */
(function (RPG) {
  'use strict';

  /** 1ラウンドあたりの再行動の上限。無限ループを防ぐ */
  const MAX_EXTRA_ACTIONS = 3;

  /* ============================ 弱点コンボ (§10.6) ============================ */

  /**
   * 弱点を突き続けるとパーティ全体の火力が上がる仕組み。
   *
   * ── 何のためにあるか ──
   * オートAIは「今いちばん削れる技」しか選ばない。属性有利を維持したり、
   * デバフを入れてから殴ったりという段取りは組まない。
   * つまりこの仕組みは、手動で考えて戦う人だけが受け取れる報酬になっている。
   * （そのため autoplay.js は意図的にコンボを考慮しない）
   */
  const COMBO_MAX = 5;
  /** 1段あたりの上乗せ */
  const COMBO_STEP = 0.08;

  /**
   * コンボの上限。千変セットを着けている味方がいると伸びる (§7.7)。
   * @param {any} battle
   */
  function comboMax(battle) {
    let bonus = 0;
    for (const u of battle.party) {
      bonus = Math.max(bonus, (u.setEffects && u.setEffects.comboMaxBonus) || 0);
    }
    return COMBO_MAX + bonus;
  }

  /**
   * 今のコンボによる火力の上乗せ。
   * @param {any} battle
   */
  function comboPower(battle, attacker) {
    // 「連撃の呼吸」— 1段あたりの伸びを大きくする (§5.7)。
    // 段数を増やすのではなく単価を上げるので、上限に張り付いた後も効く。
    const step = COMBO_STEP + ((attacker && attacker.passives && attacker.passives.comboPower) || 0);
    return Math.min(comboMax(battle), battle.combo.count) * step;
  }

  /**
   * 攻撃の内容を見てコンボを増減する。
   *
   * 伸びる条件（どちらかを満たせばよい）:
   *   - 属性有利を突いた
   *   - 相手が既にデバフを受けている
   * 外すと1段だけ落ちる。0に戻さないのは、1手ミスしただけで台無しにしないため。
   *
   * @param {any} battle
   * @param {any} attacker
   * @param {any} defender
   * @param {any} skill
   */
  function updateCombo(battle, attacker, defender, skill) {
    if (!skill || skill.power <= 0) return;   // 補助技は増減の対象外

    const advantage = RPG.damage.elementMultiplier(skill.element, defender.element) > 1;
    const weakened = debuffsOn(defender).length > 0 || defender.defIgnoredTurns > 0;

    const p = attacker.passives || {};

    if (advantage || weakened) {
      // 「連鎖の心得」— 1手で複数段積む (§5.7)
      // 中技はコンボを繋ぐ役 (§5.8)。段の積み方そのものを上乗せする。
      const gain = 1 + (p.comboGain || 0) + (isMidPower(skill) ? (p.midPowerCombo || 0) : 0);
      if (battle.combo.count < comboMax(battle)) {
        battle.combo.count = Math.min(comboMax(battle), battle.combo.count + gain);
        battle.combo.best = Math.max(battle.combo.best, battle.combo.count);
        pushEvent(battle, { type: 'combo', count: battle.combo.count, power: comboPower(battle, attacker) });
      }
      battle.combo.reason = advantage ? '属性有利' : '弱体中';
    } else if (battle.combo.count > 0) {
      // 千変セットを着けていると、外してもコンボが落ちない (§7.7)
      const locked = battle.party.some((/** @type {any} */ u) =>
        u.alive && u.setEffects && u.setEffects.comboLock);
      // 「執念」— 一定確率で落ちるのを踏みとどまる (§5.7)
      const kept = p.comboKeep > 0 && RPG.rng.chance(p.comboKeep);
      if (!locked && !kept) {
        battle.combo.count--;
        pushEvent(battle, { type: 'combo', count: battle.combo.count, power: comboPower(battle, attacker) });
      }
    }
  }

  /* ======================== 闘技場のギミック (§17) ========================
   *
   * 闘技場は1戦で完結し、周回して稼ぐ場所ではない。
   * だから通常のフィールドに置いたら苦痛でしかない、
   * **特定のビルドを名指しで否定する** 仕掛けを置ける。
   *
   * ギミックが働くのは闘技場のボス本体だけ。取り巻きは普通に殴れる。
   */

  /**
   * 闘技場のボス本体か。
   * @param {any} battle @param {any} unit
   */
  function isArenaBoss(battle, unit) {
    return !!(battle.arena && unit && unit.arenaBoss);
  }

  /**
   * ギミックによってダメージが通るかを判定する (§17)。
   *
   * @param {any} battle @param {any} attacker @param {any} defender @param {any} skill @param {any} opts
   * @returns {{blocked: boolean, reason?: string, absorb?: boolean}}
   */
  function arenaGate(battle, attacker, defender, skill, opts) {
    if (!isArenaBoss(battle, defender)) return { blocked: false };
    const g = battle.arena.gimmicks || {};

    // 取り巻きが本体を庇う。1体でも立っていれば本体には通らない。
    if (g.guardedByAdds && livingEnemies(battle).some((/** @type {any} */ u) => !u.arenaBoss)) {
      return { blocked: true, reason: '衛士が守っている' };
    }

    // 全体攻撃は本体に届かない。単体で狙う順番を要求する。
    if (g.singleTargetOnly && opts && opts.multiTarget) {
      return { blocked: true, reason: '広い攻撃では届かない' };
    }

    // ラウンド内の初撃しか認識しない。手数ではなく一撃の重さを問う。
    if (g.firstHitOnly && battle.arena.hitsThisRound > 0) {
      return { blocked: true, reason: 'この者は一度きりしか見ない' };
    }

    // はじめのN発を数え終えるまで傷を負わない。重い一撃ほど無駄になる。
    if (g.hitAbsorb && battle.arena.hitsThisRound < g.hitAbsorb) {
      const left = g.hitAbsorb - battle.arena.hitsThisRound - 1;
      return { blocked: true, reason: `数えている（あと${Math.max(0, left)}）` };
    }

    return { blocked: false };
  }

  /**
   * ラウンドの変わり目にギミックの数え直しと、時間制限の裁きを行う (§17)。
   * @param {any} battle
   */
  function arenaRoundTick(battle) {
    if (!battle.arena) return;
    battle.arena.hitsThisRound = 0;

    const g = battle.arena.gimmicks || {};
    if (!g.enrageRound || battle.round < g.enrageRound) return;

    // 刻を告げる。あらゆる守りを貫くので、長期戦そのものが成立しない。
    const boss = battle.enemies.find((/** @type {any} */ u) => u.arenaBoss && u.alive);
    if (!boss) return;
    pushLog(battle, `${boss.name} が刻を告げた——`, 'defeat');
    for (const u of livingParty(battle)) {
      u.shield = 0;
      u.hp = 0;
      u.alive = false;
      pushEvent(battle, { type: 'down', key: u.key, side: u.side });
    }
    pushLog(battle, '裁きの前に、守りは意味を成さなかった', 'defeat');
  }

  /* ======================== クラス技の制限 (§12) ========================
   *
   * 「全体蘇生」「全体8割軽減」のような技は、無条件だと戦闘の組み立てを消す。
   * 鍵は2つとも **ラウンドを数えるだけ** で表現してあるので、
   * 新しいクラス技を足しても data/skills.js に readyRound / cooldown を
   * 書くだけで効く。エンジン側に手を入れる必要はない。
   */

  /**
   * その技が今このラウンドで使えるか。使えないなら理由を返す。
   * @param {any} battle
   * @param {any} actor
   * @param {string} skillId
   * @returns {{ ok: boolean, reason?: string, waitRounds?: number }}
   */
  function skillReady(battle, actor, skillId) {
    const skill = RPG.data.skills[skillId];
    if (!skill) return { ok: false, reason: '不明な技' };

    // 解禁ラウンド: 短期決戦ビルドでは撃てない、という差別化になる
    if (skill.readyRound && battle.round < skill.readyRound) {
      return {
        ok: false,
        reason: `${skill.readyRound}ラウンド目から`,
        waitRounds: skill.readyRound - battle.round,
      };
    }

    // クールタイム: 「いつ切るか」の判断を生む
    const until = (actor.cooldowns || {})[skillId] || 0;
    if (until > battle.round) {
      return { ok: false, reason: `あと${until - battle.round}ラウンド`, waitRounds: until - battle.round };
    }

    return { ok: true };
  }

  /**
   * 技を使った直後にクールタイムを記録する。
   * @param {any} battle @param {any} actor @param {string} skillId
   */
  function startCooldown(battle, actor, skillId) {
    const skill = RPG.data.skills[skillId];
    if (!skill || !skill.cooldown) return;
    if (!actor.cooldowns) actor.cooldowns = {};
    // 「次に使えるラウンド」を持つ。残り回数を毎ラウンド減らす方式より、
    // ウェーブをまたいでラウンドが1に戻ったときの扱いが素直になる。
    actor.cooldowns[skillId] = battle.round + skill.cooldown;
  }

  /* ======================== 状態異常 (§5.8) ======================== */

  /** 技を伴わない付与で makeContext に渡す器 */
  const EMPTY_SKILL = { name: '', power: 0, params: {} };

  /**
   * パッシブで「ついでに撒く」ときの強さ (§5.8)。
   * 技で撒くぶんより控えめにしてあるので、パッシブだけで異常ビルドは完成しない。
   * ratio の意味は種類ごとに違う（data/statuses.js を参照）。
   */
  const STATUS_ON_HIT_RATIO = {
    poison: 0.03,     // 最大HPの3%／ラウンド
    burn: 0.03,       // 攻撃するたびに最大HPの3%
    bleed: 0.10,      // 被弾ダメージの10%を上乗せ
    paralyze: 0.15,   // 15%の確率で行動不能
    freeze: 0.12,     // 被ダメージ +12%
    curse: 0.25,      // 回復量 -25%
  };

  /**
   * 異常の強さの上限 (§5.8)。
   *
   * 同じ異常は重ねずに上書きする決まりだが、それでも
   * 「呪詛の心得」や装備の上乗せで ratio 自体が伸びるので、頭を押さえておく。
   * 特に麻痺は、1.0 に達すると手番を永久に奪えてしまい戦闘が成立しない。
   */
  const STATUS_CAP = {
    poison: 0.5,      // 毎ラウンド最大HPの50%。これ以上は削りとして過剰
    burn: 0.5,
    bleed: 1.0,       // 被弾ダメージと同量まで
    paralyze: 0.75,   // 完全な行動不能は作らない。必ず動ける目が残る
    freeze: 1.0,      // 被ダメージ2倍まで
    curse: 1.0,       // 回復を完全に塞ぐところまでは許す
  };

  /**
   * 起爆 (§5.8) の調整値。
   *   RATE      … 残っている継続ダメージのうち、前借りできる割合
   *   PER_KIND  … 継続ダメージ以外の弱体1種につき、合計に乗る上乗せ
   *   MAX_TURNS … 前借りできる残りターン数の上限
   *   CEILING   … それでも残る極端な値を切る天井（対象の最大HPに対する割合）
   *
   * ── なぜ「率」なのか ──
   * 最初は天井だけで抑えようとしたが、実測すると **何も振っていない状態で既に
   * 天井に当たっていた**（毒6%×3 + 火傷5%×3 = 33% > 天井30%）。
   * つまり「毒の心得」に何レベル振っても起爆の値は1点も動かない。
   * 天井は極端な値を切る道具であって、常用域の調整には使えない。
   *
   * 率にすると、割合を伸ばす投資がそのまま起爆に乗る。
   * 同時に「残りの6割しか受け取れない」という損が、
   * 待たずに今もらうことと弱体を全部失うことの対価として表に出る。
   *
   * MAX_TURNS は別の穴を塞ぐためのもの。持続を伸ばす枝（呪詛の心得）が
   * 無ければ、伸ばしたターン数がそのまま威力になってしまう。
   */
  const DETONATE_RATE = 0.6;
  const DETONATE_PER_KIND = 0.25;
  const DETONATE_MAX_TURNS = 3;
  const DETONATE_CEILING = 0.35;

  /**
   * かかっている異常の強さを返す (§5.8)。
   *
   * 同じ種類は **重ねずに1つだけ** 持つ（addStatus が上書きする）ので、
   * ここでは最も強いものを拾えばよい。
   * 昔のセーブや外部からの差し込みで複数入っていても、
   * 合算せず最大値を採ることで青天井にならないようにしてある。
   *
   * @param {any} unit
   * @param {string} kind
   * @returns {number} ratio。かかっていなければ0
   */
  function statusRatio(unit, kind) {
    let top = 0;
    for (const e of (unit && unit.statusEffects) || []) {
      if (e.kind === kind && e.turns > 0) top = Math.max(top, e.ratio || 0);
    }
    const cap = STATUS_CAP[kind];
    return cap == null ? top : Math.min(cap, top);
  }

  /**
   * 異常を対象に載せる (§5.8)。
   *
   * **同じ種類は重ねない。** 既にかかっていれば、持続と強さのそれぞれ良いほうへ更新する。
   * 積み重ねを許すと、多段攻撃や伝染を持つ構成が同じ異常を何十個も積んでしまい、
   * 「麻痺の確率が680%」のような壊れ方をする。1つに保てばその余地が消える。
   *
   * 上書きでも撒き直す意味は残る——持続が伸び、より強い付与で塗り替えられるため。
   *
   * @param {any} battle @param {any} target @param {any} effect
   * @param {string} [message] ログに出す文言。省略時は既定の文言
   */
  function applyStatus(battle, target, effect, message) {
    // 同一判定は種類とラベルの両方で行う。
    // multi_debuff は「厄災」「呪詛」といった表示だけの弱体を
    // すべて kind:'weaken' で載せるので、種類だけで見ると全部1つに潰れてしまう。
    // 数値を持つ6種 (data/statuses.js) は種類とラベルが1対1なので、挙動は変わらない。
    const existing = (target.statusEffects || [])
      .find((/** @type {any} */ e) => e.kind === effect.kind && e.label === effect.label);

    if (existing) {
      existing.turns = Math.max(existing.turns, effect.turns);
      existing.ratio = Math.max(existing.ratio || 0, effect.ratio || 0);
    } else {
      target.statusEffects.push(effect);
    }

    pushLog(battle, message || `${target.name} は ${effect.label} 状態になった`, 'debuff');
    pushEvent(battle, { type: 'debuff', key: target.key, label: effect.label });
  }

  /**
   * 異常を1つ与える。ratio は「毒の心得」で伸び、持続は呪詛と精神耐性で増減する。
   * ctx.addStatus と同じ経路を通すため、実体はそちらに置いてある。
   * ここは「種類を指定して撒く」パッシブ用の入口。
   * @param {any} battle @param {any} actor @param {any} target
   * @param {string} kind @param {number} turns @param {number} ratio
   */
  function inflict(battle, actor, target, kind, turns, ratio) {
    const def = (RPG.data.statuses || {})[kind];
    if (!def || !target.alive) return;
    // makeContext は skill.params を読むので、技のない付与では空の器を渡す。
    makeContext(battle, actor, EMPTY_SKILL, [target])
      .addStatus(target, { kind, label: def.label, turns, ratio });
  }

  /**
   * デバフが実際に何ターン続くか (§5.6)。
   * 与える側の「呪詛」で延び、受ける側の「精神耐性」で縮む。0以下なら無効化。
   *
   * @param {any} attacker
   * @param {any} target
   * @param {number} base
   */
  /**
   * バフが実際に何ターン続くか (§5.8)。
   * デバフ側の debuffTurns と対になっていて、こちらは **受け手** の「持続の心得」で延びる。
   * @param {any} target 効果を受ける側
   * @param {number} base
   */
  function buffTurns(target, base) {
    const add = (target && target.passives && target.passives.buffDuration) || 0;
    return Math.floor((base || 0) + add);
  }

  function debuffTurns(attacker, target, base, kind) {
    // 「不動心」— 確率で丸ごとはねのける (§5.7)。持続を縮める耐性より上位の防ぎ方。
    const immune = (target && target.passives && target.passives.statusImmune) || 0;
    if (immune > 0 && RPG.rng.chance(immune)) return 0;

    const add = (attacker && attacker.passives && attacker.passives.debuffDuration) || 0;
    const resist = (target && target.passives && target.passives.debuffResist) || 0;
    // 種類を絞った耐性 (§5.8)。全部に効く「精神耐性」より1段あたりが大きい。
    const byKind = (target && target.passives && target.passives.statusResistKind) || {};
    const kindResist = (kind && byKind[kind]) || 0;
    return Math.floor((base || 0) + add - resist - kindResist);
  }

  /* ======================== 小技の使い道 (§4.3) ======================== */

  /**
   * 「小技」とみなす威力の上限。
   *
   * ── なぜこの仕組みが要るか ──
   * 強い技を1つ覚えると、それ以下の攻撃技は二度と選ばれなくなる。
   * 技を増やしても選択肢が増えず、ただのノイズになってしまう。
   * そこで「威力が低いこと自体が条件になる」効果をいくつか用意して、
   * 小技を抱えていることに意味を持たせる。
   */
  const LOW_POWER = 100;

  /** 大技のしきい値 (§5.8)。小技(100以下)との間に空白の帯を置いて、両取りを防ぐ。 */
  const HIGH_POWER = 200;

  /**
   * その技が小技か。補助技と回復は対象外。
   * @param {any} skill
   */
  function isLowPower(skill) {
    return !!skill && skill.power > 0 && skill.power <= LOW_POWER && isAttackSkill(skill);
  }

  /**
   * その技が大技か (§5.8)。小技のちょうど反対側で、間の帯にはどちらも乗らない。
   * 「小技を伸ばす」か「大技を伸ばす」かが排他の選択になるようにしてある。
   * @param {any} skill
   */
  function isHighPower(skill) {
    return !!skill && skill.power >= HIGH_POWER && isAttackSkill(skill);
  }

  /**
   * その技が中技か (§5.8)。
   *
   * ── なぜ帯を名指しするのか ──
   * 攻撃技89個のうち **44個がこの帯** にあるのに、この帯を伸ばす手段は
   * 1つも無かった。小技には5系統（連射・拡散・自動発動・底上げ）、
   * 大技には上限突破がある一方で、中技を選ぶ理由だけが存在しなかった。
   *
   * ここに火力を足しても住み分けにならないので、**効果の確実さ** を持たせる。
   *   小技 … 手数で押す
   *   中技 … 弱体を通し、コンボを繋ぐ
   *   大技 … 上限を破って一撃で沈める
   *
   * @param {any} skill
   */
  function isMidPower(skill) {
    return !!skill && skill.power > LOW_POWER && skill.power < HIGH_POWER && isAttackSkill(skill);
  }

  /**
   * 攻撃技か（バフ・回復を除く）。
   * @param {any} skill
   */
  function isAttackSkill(skill) {
    return !!skill && skill.power > 0 && skill.plugin !== 'heal' &&
      !['unique_buff', 'tag_buff', 'def_buff', 'reduction_buff'].includes(skill.plugin);
  }

  /**
   * その行動者が持っている小技のID一覧。
   * @param {any} actor
   */
  function lowPowerSkills(actor) {
    return (actor.skills || []).filter((/** @type {string} */ id) => isLowPower(RPG.data.skills[id]));
  }

  /**
   * 小技に乗る威力の上乗せ。ツリー・セット・ユニーク装備から集める。
   * @param {any} actor
   */
  function lowPowerBoost(actor) {
    const p = actor.passives || {};
    const fx = actor.setEffects || {};
    return (p.lowPowerBoost || 0) + (fx.lowPowerBoost || 0);
  }

  /**
   * 攻撃のあとに小技が自動で飛ぶ (§4.3)。
   * 「威力が低い技ほど自動発動の弾になる」ので、小技を抱える理由になる。
   *
   * @param {any} battle
   * @param {any} actor
   * @param {any[]} targets
   */
  function fireAutoLowSkill(battle, actor, targets) {
    const p = actor.passives || {};
    const fx = actor.setEffects || {};
    const rate = (p.autoLowSkill || 0) + (fx.autoLowSkill || 0);
    if (rate <= 0 || !actor.alive) return;
    if (!RPG.rng.chance(Math.min(1, rate))) return;

    const pool = lowPowerSkills(actor);
    if (pool.length === 0) return;
    const target = targets.find((/** @type {any} */ t) => t && t.alive) || livingEnemies(battle)[0];
    if (!target) return;

    const skill = RPG.data.skills[RPG.rng.pick(pool)];
    pushLog(battle, `${actor.name} の追撃 — ${skill.name}`, 'sub');
    applyDamage(battle, actor, target, skill, { isCounter: true, lowPower: true });
  }

  /* ============================ 装備セット (§7.7) ============================ */

  /**
   * 戦況を見て決まるセット効果を、ひとつの倍率にまとめる。
   *
   * ここに置いてあるのは「装備を見ただけでは決まらない」ものだけ。
   * 属性適応や復活HPのように組み立て時に決まるものは units.js が扱う。
   *
   * @param {any} battle
   * @param {any} attacker
   * @returns {number} 火力に掛ける倍率
   */
  function setPower(battle, attacker) {
    let mult = 1;
    const fx = attacker.setEffects || {};

    // 常世: 倒れている仲間1人につき強くなる
    if (fx.fallenPower) {
      const fallen = battle.party.filter((/** @type {any} */ u) => !u.alive).length;
      if (fallen > 0) mult *= 1 + fx.fallenPower * fallen;
    }

    // 刹那: ラウンドが進むほど落ちる
    if (fx.decayPerRound) {
      const past = Math.max(0, battle.round - 1);
      const floor = fx.decayFloor == null ? 0.5 : fx.decayFloor;
      mult *= Math.max(floor, 1 - fx.decayPerRound * past);
    }

    // 共鳴: 自分の火力を削る代わりに、味方を押し上げる
    if (fx.selfPower) mult *= 1 + fx.selfPower;
    for (const ally of battle.party) {
      if (ally === attacker || !ally.alive) continue;
      const allyFx = ally.setEffects || {};
      if (allyFx.allyPower) mult *= 1 + allyFx.allyPower;
    }

    // --- ここからはツリーのパッシブ (§5.6) ---
    // セット効果と同じく「戦況を見て決まる」ものなので、同じ場所でまとめる。
    const p = attacker.passives || {};

    // 群狼: 敵が多いほど強い
    if (p.foeCountPower) {
      mult *= 1 + p.foeCountPower * livingEnemies(battle).length;
    }
    // 一騎討ち: 敵が1体だけのとき強い（ボス特効と違い、雑魚を掃除した後にも効く）
    if (p.loneFoePower && livingEnemies(battle).length === 1) {
      mult *= 1 + p.loneFoePower;
    }
    // 連戦の熱: ウェーブを越えるごとに積み上がる
    if (p.waveStack) {
      mult *= 1 + p.waveStack * Math.max(0, (battle.wave || 1) - 1);
    }

    // --- ここから §5.7 で足した戦況パッシブ ---

    // ── 自傷を糧にする ──
    // 自分にかかっている弱体1つにつき火力が上がる。
    //
    // ここまで、自分にかかる弱体は **例外なく損** でしかなかった。
    // 符号を反転させると、敵の弱体攻撃がそのまま燃料に変わり、
    // 「引きが悪い」でしかなかった盤面が有利な盤面になる。
    // def_buff は弱体ではないので debuffsOn 側で除かれる。
    if (p.selfCursePower) {
      const own = debuffsOn(attacker).length;
      if (own > 0) mult *= 1 + p.selfCursePower * own;
    }

    // 長期戦の理: ラウンドを重ねるほど強い（刹那セットのちょうど裏返し）
    if (p.roundStack) {
      mult *= 1 + p.roundStack * Math.max(0, (battle.round || 1) - 1);
    }
    // 痛みの記憶: 被弾した回数だけ積み上がる。殴られ役の火力源。
    if (p.hitStack) {
      mult *= 1 + p.hitStack * (attacker.hitsTaken || 0);
    }

    const living = livingParty(battle);
    // 連帯: 生きている味方が多いほど強い（常世セットの逆。全員生存を狙う構成向け）
    if (p.partySizePower) mult *= 1 + p.partySizePower * living.length;
    // 孤高: 生き残りが自分だけのとき強い
    if (p.soloPower && living.length === 1) mult *= 1 + p.soloPower;

    // 属性で編成を縛ることへの見返り。パーティ全員ぶんを見る。
    if ((p.monoElementPower || p.rainbowPower) && living.length > 1) {
      const elements = living.map((/** @type {any} */ u) => u.element);
      const kinds = new Set(elements).size;
      if (p.monoElementPower && kinds === 1) mult *= 1 + p.monoElementPower;
      if (p.rainbowPower && kinds === elements.length) mult *= 1 + p.rainbowPower;
    }

    // 隊列: 前に置くほど火力が出る (§5.7)。並び順を選ぶ意味を作るための軸。
    if (p.frontPower) {
      const idx = battle.party.indexOf(attacker);
      const last = Math.max(1, battle.party.length - 1);
      mult *= 1 + p.frontPower * (1 - Math.max(0, idx) / last);
    }

    // --- §5.8 ---

    // 決戦の気迫: 最終ウェーブ（＝ボス戦）だけ強い。道中は素のまま。
    if (p.wavePower && battle.wave === battle.totalWaves) {
      mult *= 1 + p.wavePower;
    }
    // 一意専心 / 変幻自在: 同じ技を続けるか、撃ち分けるか (§5.8)。
    // どちらを取るかで手の選び方が変わるので、両方を厚くする意味は薄い。
    if (p.repeatPower) mult *= 1 + p.repeatPower * Math.max(0, (attacker.repeatCount || 1) - 1);
    if (p.varietyPower && attacker.switchedSkill) mult *= 1 + p.varietyPower;

    // 憤怒: 溜めた怒りは倍率ではなく固定値なので、ここでは扱わない
    return mult;
  }

  /**
   * 相手を見て決まる火力倍率 (§5.8)。
   *
   * setPower が「戦場を見る」のに対し、こちらは「今殴る相手を見る」。
   * damage.js は相手にかかっている異常の**種類**までは受け取らないので、
   * 種類ごとの特効はここで倍率にまとめてから渡す。
   *
   * @param {any} attacker
   * @param {any} defender
   * @returns {number} 倍率
   */
  function targetPower(attacker, defender) {
    const vs = (attacker.passives && attacker.passives.vsStatusPower) || {};
    let mult = 1;
    for (const kind of Object.keys(vs)) {
      if (vs[kind] > 0 && statusRatio(defender, kind) > 0) mult *= 1 + vs[kind];
    }

    // ── 標的指定（マーク）──
    // ここだけは **付けた本人ではなく、付けられた側に効果が乗っている**。
    // 他の火力補正は全部「殴る側が何を持っているか」で決まるので、
    // 一人の1手が他の味方の手を良くする、という形はこれが初めてになる。
    //
    // 印を付けた陣営だけが恩恵を受ける。敵が味方に印を付ければ、
    // 敵側が同じように束になって殴ってくる。仕組みは左右対称にしてある。
    const mark = defender.marked;
    if (mark && mark.turns > 0 && mark.side === attacker.side) mult *= 1 + mark.value;

    return mult;
  }

  /**
   * 戦況で決まる被ダメージ軽減 (§5.7)。
   * 装備やバフの恒常軽減とは別に、そのときの状況を見て足す。
   * @param {any} battle
   * @param {any} unit
   * @returns {number} 追加の軽減率
   */
  function situationalGuard(battle, unit) {
    const p = unit.passives || {};
    let guard = 0;

    // 窮鼠: HPが減っているほど硬くなる。背水と組ませて崩れにくくする。
    if (p.lowHpGuard && unit.maxHp > 0) {
      guard += p.lowHpGuard * (1 - unit.hp / unit.maxHp);
    }
    // 隊列: 後ろに置くほど硬い (§5.7)。前衛火力の frontPower とちょうど裏返し。
    if (p.backGuard && unit.side === 'party') {
      const idx = battle.party.indexOf(unit);
      const last = Math.max(1, battle.party.length - 1);
      guard += p.backGuard * (Math.max(0, idx) / last);
    }
    return guard;
  }

  /**
   * 残響の予約を1ラウンドぶん進め、期限が来たものを撃ち込む。
   * @param {any} battle
   */
  function resolveEchoes(battle) {
    if (!battle.echoes.length) return;
    /** @type {any[]} */
    const rest = [];
    for (const echo of battle.echoes) {
      echo.turns--;
      if (echo.turns > 0) { rest.push(echo); continue; }

      const target = battle.enemies.find((/** @type {any} */ e) => e.key === echo.targetKey && e.alive)
        || livingEnemies(battle)[0];
      if (!target || echo.amount <= 0) continue;

      const damage = Math.max(1, Math.floor(echo.amount));
      target.hp = Math.max(0, target.hp - damage);
      pushLog(battle, `残響が ${target.name} に ${damage.toLocaleString()} のダメージ`, 'damage');
      pushEvent(battle, { type: 'damage', key: target.key, amount: damage, tag: '残響' });
      if (target.hp === 0 && target.alive) {
        target.alive = false;
        pushLog(battle, `${target.name} を撃破した！`, 'defeat');
        pushEvent(battle, { type: 'down', key: target.key, side: target.side });
        battle.defeatedEnemies[target.id] = (battle.defeatedEnemies[target.id] || 0) + 1;
      }
    }
    battle.echoes = rest;
  }

  /**
   * スキルが要求する対象種別を返す。UI の対象選択に使う。
   * @param {any} skill
   * @returns {'enemy'|'ally'|'none'}
   */
  function targetKind(skill) {
    const plugin = skill.plugin ? RPG.plugins[skill.plugin] : null;
    if (plugin && plugin.targetKind) return plugin.targetKind(skill);
    return 'enemy';
  }

  /**
   * フィールドの敵レベルを決める (§10.8)。
   *
   * ふつうは data/fields.js の enemy_lv をそのまま使う。
   * `scaling` を持つフィールドだけ、**パーティの最高レベルに追随** させる。
   *
   * ── 床を張る理由 ──
   * 追随だけにすると序盤のパーティでも入れてしまい、
   * そこだけ回れば良いことになる。前の狩場が全部無意味になるので、
   * floor より下には決して下がらないようにしてある。
   *
   * @param {any} field @param {any[]} party
   * @returns {number}
   */
  function scaledEnemyLv(field, party) {
    const sc = field.scaling;
    if (!sc) return field.enemy_lv;
    let top = 0;
    for (const u of party || []) top = Math.max(top, u.level || 1);
    return Math.max(sc.floor, top + (sc.above || 0));
  }

  /**
   * 戦闘を開始する。
   * @param {{fieldId: string, waves: number, party: any[], bossFinale?: boolean, quest?: any}} config
   */
  function start(config) {
    const field = RPG.data.fields[config.fieldId];
    // 無いフィールドで呼ばれたら、ここで名指しして止める (§18)。
    //
    // 拡張コンテンツが外れると、保存されていたフィールドIDが宙に浮く。
    // そのまま進むと、ずっと先の `field.scaling` を読むところで
    // 「undefined の scaling が読めない」という、原因の見えない例外になる。
    // 落ちる場所と原因の場所を近づけておく。
    if (!field) {
      throw new Error(`フィールド ${config.fieldId} が見つかりません`
        + '（拡張コンテンツが外された可能性があります）');
    }
    const quest = config.quest || null;

    // ── id は自分で取りに行く ──
    // カタログの生データに id は無く、RPG.quest.def() が付けている。
    // 素の定義をそのまま渡されると questId が undefined のまま通る。
    // 呼び出し側の作法に頼らず、ここで引き当てておく。
    //
    // 引き当てられないこともある（テストが作る合成クエストなど）。
    // それは異常ではないので止めない。**種類の判定は questId ではなく
    // quest そのものの有無で行う**ので、id が無くても取り違えは起きない。
    let questId = quest ? quest.id : null;
    if (quest && !questId) {
      questId = Object.keys(RPG.data.quests || {})
        .find((/** @type {string} */ k) => RPG.data.quests[k] === quest) || null;
    }
    const rules = (quest && quest.rules) || {};

    /** @type {any} */
    const battle = {
      field,
      fieldId: config.fieldId,
      totalWaves: config.waves,
      // 最終ウェーブをボスにするか (§10.1)。未指定なら従来どおりボスを出す。
      bossFinale: config.bossFinale !== false,
      wave: 0,
      round: 1,
      party: config.party,
      enemies: [],
      actorIndex: 0,
      phase: 'command',
      finished: false,
      victory: false,
      log: [],
      // 演出用のイベント列。ログが「読むもの」なのに対し、こちらは「見せるもの」。
      // UI はここを読んでダメージ数字や被弾エフェクトを再生する。
      events: [],
      rewards: { gold: 0, exp: 0, boxes: /** @type {Record<string, number>} */ ({}) },
      // 手動で選んだ行動とオートに任せた行動の数。報酬の手動ボーナス判定に使う。
      inputs: { manual: 0, auto: 0 },
      // クエスト戦のときだけ入る。敵の強化と失敗条件をここから読む。
      quest: quest,
      questId,
      rules,
      // 敵レベルと強化倍率。クエストが指定していなければフィールドの既定値。
      enemyLv: quest && quest.enemyLv ? quest.enemyLv : scaledEnemyLv(field, config.party),
      enemyScale: quest && quest.enemyScale ? quest.enemyScale : 1,
      // 縛りを破ったときの理由。勝っても達成にならない。
      ruleBroken: /** @type {string|null} */ (null),
      // ウェーブをまたいだ通算ラウンド。round はウェーブごとに1に戻るため別に数える。
      totalRounds: 1,
      // 弱点コンボ (§10.6)。手動で段取りを組んだときだけ伸びる。
      combo: { count: 0, best: 0, reason: '' },
      // 残響セットが予約した遅延ダメージ (§7.7)
      echoes: /** @type {any[]} */ ([]),
      // 図鑑用の記録 (§13)。ここは数を数えるだけで、セーブには触らない。
      // 実際の書き込みは戦闘終了後に RPG.codex.record() が行う。
      encountered: /** @type {Record<string, number>} */ ({}),
      defeatedEnemies: /** @type {Record<string, number>} */ ({}),
    };

    // 演出でDOMと対応づけるための識別子。パーティは戦闘中ずっと固定。
    battle.party.forEach((/** @type {any} */ u, /** @type {number} */ i) => { u.key = 'p' + i; });

    // --- パッシブ: 開幕バフ（戦闘開始時に固有ユニークバフを得る）---
    for (const u of battle.party) {
      const opening = (u.passives && u.passives.openingBuff) || 0;
      if (opening > 0) {
        u.buffUnique.push({ value: opening, turns: 3, label: '開幕' });
        pushLog(battle, `${u.name} は気を高めている（開幕 +${Math.round(opening * 100)}%）`, 'buff');
      }

      // --- パッシブ: 開幕の障壁 (§5.7) ---
      // 回復役がいなくても最初の一発を受けきれるようにする。
      const startShield = (u.passives && u.passives.startShield) || 0;
      if (startShield > 0) {
        u.shield = (u.shield || 0) + Math.floor(u.maxHp * startShield);
        pushLog(battle, `${u.name} が ${u.shield.toLocaleString()} の障壁をまとった`, 'buff');
      }
    }

    nextWave(battle);
    return battle;
  }

  /**
   * 次のウェーブの敵を生成する。HPはパーティ側にそのまま引き継がれる (§10.1)。
   * @param {any} battle
   */
  function nextWave(battle) {
    battle.wave++;
    const field = battle.field;
    const isFinal = battle.wave === battle.totalWaves && battle.bossFinale;

    /** @type {any[]} */
    const enemies = [];
    // クエストは敵レベルと強化倍率を上書きできる (§10.3)
    const lv = battle.enemyLv;
    const scale = battle.enemyScale;
    if (isFinal) {
      // 最終ウェーブはボス。ステータス1.5倍扱い (§10.1)。
      enemies.push(RPG.units.buildEnemyUnit(field.boss, lv, true, 0, scale));
    } else {
      const count = RPG.rng.int(field.size[0], field.size[1]);
      for (let i = 0; i < count; i++) {
        enemies.push(RPG.units.buildEnemyUnit(RPG.rng.pick(field.pool), lv, false, i, scale));
      }
    }
    enemies.forEach((e, i) => { e.key = 'e' + i; });
    // 出会った敵を数えておく (§13 図鑑)
    for (const e of enemies) {
      battle.encountered[e.id] = (battle.encountered[e.id] || 0) + 1;
    }
    battle.enemies = enemies;
    battle.actorIndex = 0;
    battle.round = 1;
    battle.phase = 'command';

    // 「初手必中」の使用権をウェーブごとに配り直す (§5.7)。
    // 戦闘まるごとで1回だと連戦では価値が薄いので、ウェーブ単位にしている。
    for (const u of battle.party) {
      u.critShots = (u.passives && u.passives.firstHitCrit) || 0;
    }

    // --- パッシブ: 不撓（ウェーブが変わると倒れた仲間が起き上がる）(§5.8) ---
    // 「不死鳥の理」が1戦闘1回なのに対し、こちらはウェーブごとに効く。
    // 連戦を前提にした復帰手段なので、単発の高難度戦では働かない。
    if (battle.wave > 1) {
      for (const u of battle.party) {
        const wr = (u.passives && u.passives.waveRevive) || 0;
        if (u.alive || wr <= 0) continue;
        u.alive = true;
        u.hp = Math.max(1, Math.floor(u.maxHp * wr));
        pushLog(battle, `${u.name} が立ち上がった（HP ${u.hp.toLocaleString()}）`, 'buff');
        pushEvent(battle, { type: 'revive', key: u.key });
      }
    }

    // --- パッシブ: ウェーブ回復（連戦のたびに少し立て直す）---
    if (battle.wave > 1) {
      for (const u of battle.party) {
        const waveHeal = (u.passives && u.passives.waveHeal) || 0;
        if (!u.alive || waveHeal <= 0 || u.hp >= u.maxHp) continue;
        const heal = Math.max(1, Math.floor(u.maxHp * waveHeal));
        const before = u.hp;
        u.hp = Math.min(u.maxHp, u.hp + heal);
        pushLog(battle, `${u.name} は ${(u.hp - before).toLocaleString()} HP回復した（ウェーブ間）`, 'heal');
      }
    }

    pushLog(battle, `── ウェーブ ${battle.wave} / ${battle.totalWaves} ──`, 'wave');
    pushLog(battle, `${enemies.map((e) => e.name).join('、')} が現れた！`, 'info');
    pushEvent(battle, {
      type: 'wave',
      wave: battle.wave, total: battle.totalWaves,
      boss: isFinal,
      text: isFinal ? 'BOSS' : `WAVE ${battle.wave}`,
    });
    skipDeadActors(battle);
  }

  /**
   * @param {any} battle
   * @param {string} text
   * @param {string} [kind]
   */
  function pushLog(battle, text, kind) {
    battle.log.push({ text, kind: kind || 'info' });
  }

  /**
   * 演出用のイベントを積む。ここに積まれたものだけが画面上で動く。
   * @param {any} battle
   * @param {any} event
   */
  function pushEvent(battle, event) {
    battle.events.push(event);
  }

  /**
   * その効果が「弱体」かどうか (§5.8)。
   *
   * statusEffects には弱体だけでなく **def_buff（防御上昇）も同じ配列に入る**。
   * 種類を見ずに配列の長さだけで判定していたため、
   * 自分で防御を固めた敵が「弱体中」と見なされ、
   * 追い討ち・弱者狩り・コンボが不当に乗っていた。判定はここに集約する。
   *
   * @param {any} effect
   */
  function isDebuff(effect) {
    if (!effect || effect.turns <= 0) return false;
    return effect.kind !== 'def_buff';
  }

  /** 対象にかかっている弱体だけを取り出す。 @param {any} unit */
  function debuffsOn(unit) {
    return ((unit && unit.statusEffects) || []).filter(isDebuff);
  }

  /**
   * 起爆したら何点入るかを、盤面を変えずに計算する (§5.8)。
   *
   * オート戦闘の見積もりと実際の起爆で **同じ関数を通す**。
   * 別々に書くと、片方を直したときにもう片方が古い式のまま残り、
   * 「オートは撃たないのに手動なら強い技」ができあがる。
   *
   * @param {any} target
   * @returns {{ total: number, ticks: number, kinds: number }}
   */
  function detonationValue(target) {
    if (!target || !target.alive) return { total: 0, ticks: 0, kinds: 0 };
    const effects = debuffsOn(target);
    if (!effects.length) return { total: 0, ticks: 0, kinds: 0 };

    // 数値を持つ継続ダメージ（毒・火傷）だけが本体。
    // 出血は「受けたダメージの割合」なので、残りターンから額を出せない。
    // 麻痺・凍結・呪詛も同じで、これらは種類数のぶんだけ上乗せに回す。
    let total = 0;
    let ticks = 0;
    let others = 0;
    for (const e of effects) {
      if (e.kind !== 'poison' && e.kind !== 'burn') { others++; continue; }
      const cap = STATUS_CAP[e.kind];
      const ratio = cap == null ? (e.ratio || 0) : Math.min(cap, e.ratio || 0);
      // 前借りできるのは3ターンぶんまで。「呪詛の心得」で持続を伸ばした構成が、
      // 伸ばした回数ぶんそのまま起爆の威力になるのを止める。
      const turns = Math.min(DETONATE_MAX_TURNS, Math.max(0, e.turns || 0));
      total += target.maxHp * ratio * turns;
      ticks += turns;
    }

    // 残りぶんをそのまま渡すと、待つより起爆したほうが常に得になる。
    // 一部を捨てることで「今もらう」ことに値段が付く。
    total *= DETONATE_RATE;
    // 継続ダメージ以外の弱体は1種につき上乗せ。6種を撒き分ける構成への見返り。
    // こちらは消費しない（消すと「弱体中の敵に強い」枝を自分で止めてしまう）ので、
    // あくまで着火剤の扱い。天井があるので青天井にはならない。
    total *= 1 + DETONATE_PER_KIND * others;
    // 天井。最大HPの割合で殴る手なので、外すとHPの大きいボスほど大きく溶ける。
    total = Math.min(total, target.maxHp * DETONATE_CEILING);

    return { total, ticks, kinds: effects.length };
  }

  /**
   * 防御も属性も通さず、素の数値をそのままHPから引く (§5.8)。
   *
   * 毒の刻みと起爆で同じ経路を通すために切り出してある。
   * ダメージ計算式 (§3.2) を通さないのは、これらが「最大HPの割合」で
   * 決まる値であり、相手のDEFや属性で変わってはいけないため。
   *
   * @param {any} battle @param {any} unit @param {number} amount @param {string} text
   * @returns {number} 実際に減ったHP
   */
  function directDamage(battle, unit, amount, text) {
    if (!unit.alive || amount <= 0) return 0;
    const dealt = Math.min(unit.hp, Math.max(1, Math.floor(amount)));
    unit.hp -= dealt;
    pushLog(battle, text.replace('{n}', dealt.toLocaleString()), 'damage');
    pushEvent(battle, { type: 'damage', key: unit.key, amount: dealt });
    if (unit.hp === 0) {
      unit.alive = false;
      pushLog(battle, `${unit.name} は力尽きた`, 'defeat');
      pushEvent(battle, { type: 'down', key: unit.key, side: unit.side });
    }
    return dealt;
  }

  /**
   * 刻印が炸裂するまでに必要な数。技もパッシブもこの数を共有する。
   *
   * 5 から始めて 3 まで下げた。理由は下の addSigil に書いてある。
   */
  const SIGIL_THRESHOLD = 3;

  /**
   * 刻印を積み、溜まりきったら炸裂させる。
   *
   * ── なぜこれが要るか ──
   * 遅れて入るダメージは既に2種類あるが、どちらも **時間で進む**。
   *   毒   … ラウンドが終わるたびに1刻み
   *   残響 … Nターン後に炸裂
   * つまり待てば進むので、手数を増やしても早くはならない。
   * 刻印は **殴った回数で進む**。手数で押す構成が報われる道になる。
   *
   * ── 刻印は「殴った側」に溜まる ──
   * 最初は相手に積んでいた。素直な作りに見えたが、**一度も炸裂しなかった**。
   *
   * 味方4人が代わる代わる殴るので、1体の敵に同じキャラが3発当てる前に
   * その敵が死ぬ。実測すると Lv150 の一撃が約40,000、雑魚のHPはその数倍しかない。
   * 12戦して炸裂は0回だった。閾値を5から3に下げても足りない。
   * 敵に積むかぎり、**戦闘が短いこのゲームでは原理的に溜まらない**。
   *
   * そこで殴った側に積むことにした。誰を殴ったかに関係なく自分の手数で進むので、
   * 敵の入れ替わりで進捗が消えない。多段ヒットの技なら1回で複数進む。
   * 「手数で押すほど早く来る」という当初の狙いは、この形でようやく成立する。
   *
   * 炸裂の値を相手の最大HPの割合にしてあるのは毒と同じ理由で、
   * 相手が固くても大きくても目減りしないようにするため。
   *
   * @param {any} battle
   * @param {any} target 炸裂したときに殴られる相手
   * @param {any} attacker 刻印を溜めている側
   * @param {number} ratio 炸裂したとき、相手の最大HPの何割を入れるか
   * @param {number} [count] 一度に積む数
   */
  function addSigil(battle, target, attacker, ratio, count) {
    if (!target || !target.alive || ratio <= 0) return;
    attacker.sigils = (attacker.sigils || 0) + (count == null ? 1 : count);

    if (attacker.sigils < SIGIL_THRESHOLD) {
      pushLog(battle, `${attacker.name} の刻印（${attacker.sigils}/${SIGIL_THRESHOLD}）`, 'sub');
      return;
    }

    // 溜まりきったぶんだけ落とす。余りは次へ持ち越す。
    const bursts = Math.floor(attacker.sigils / SIGIL_THRESHOLD);
    attacker.sigils -= bursts * SIGIL_THRESHOLD;
    directDamage(battle, target, target.maxHp * ratio * bursts,
      `${attacker.name} の刻印が弾けた — {n} のダメージ`);
  }

  /**
   * この戦闘が何なのかを1か所で決める。
   *
   * ── なぜ関数にするか ──
   * 決着後の分岐が、UI（もう一度の行き先）と main.js（戻り先のタブ）に
   * 別々に書かれていた。どちらも tower と quest だけを並べていたので、
   * **闘技場が両方から漏れた**。
   * 闘技場は場所を持たず、器として先頭のフィールドを借りているだけなので、
   * 漏れると「通常の出撃」と見分けが付かず、
   * 再戦で始まりの草原が始まってしまう。
   *
   * 種類が増えるたびに2か所へ書き足す形をやめて、ここだけを直せば
   * 両方が追随するようにする。
   *
   * @param {any} battle
   * @returns {'tower'|'arena'|'quest'|'field'}
   */
  function kindOf(battle) {
    if (!battle) return 'field';
    if (battle.tower) return 'tower';
    if (battle.arena) return 'arena';
    // questId ではなく quest を見る。カタログ外の合成クエストには id が無く、
    // id で判定すると通常の出撃に化けるため。
    if (battle.quest) return 'quest';
    return 'field';
  }

  /** 生存している味方 */
  function livingParty(battle) {
    return battle.party.filter((/** @type {any} */ u) => u.alive);
  }

  /** 生存している敵 */
  function livingEnemies(battle) {
    return battle.enemies.filter((/** @type {any} */ u) => u.alive);
  }

  /**
   * 現在コマンド入力待ちのパーティメンバー。いなければ null。
   * @param {any} battle
   */
  function currentActor(battle) {
    if (battle.phase !== 'command') return null;
    return battle.party[battle.actorIndex] || null;
  }

  /**
   * 死亡しているメンバーを飛ばす。全員行動済みなら敵フェーズへ。
   * @param {any} battle
   */
  function skipDeadActors(battle) {
    while (battle.actorIndex < battle.party.length) {
      const unit = battle.party[battle.actorIndex];
      if (!unit.alive) { battle.actorIndex++; continue; }
      // フルバースト (§4.3) の反動で動けないあいだは飛ばす
      if (unit.stunnedRounds > 0) {
        unit.stunnedRounds--;
        pushLog(battle, `${unit.name} は反動で動けない（あと${unit.stunnedRounds}ラウンド）`, 'sub');
        battle.actorIndex++;
        continue;
      }
      break;
    }
  }

  /**
   * ダメージを適用する。ダメージ計算そのものは §3 の RPG.damage.calc に委譲する。
   * @param {any} battle
   * @param {any} attacker
   * @param {any} defender
   * @param {any} skill
   * @param {{powerScale?: number, ignoreDefense?: boolean, silent?: boolean}} [opts]
   */
  function applyDamage(battle, attacker, defender, skill, opts) {
    opts = opts || {};
    // 「防御崩し」は攻撃のたびに判定する
    const guardBreak = (attacker.passives && attacker.passives.guardBreak) || 0;
    const brokeGuard = guardBreak > 0 && RPG.rng.chance(guardBreak);
    // 技そのものが防御無視を持つ場合もある（暗殺者の「首刈り」など §12）
    const ignoreDefense = !!opts.ignoreDefense || defender.defIgnoredTurns > 0 || brokeGuard
      || !!(skill && skill.forceIgnoreDefense);

    // 「初手必中」— ウェーブ最初の攻撃を確定会心にする (§5.7)。
    // 使い切りなので、まとめて撃つ技よりも重い一撃に合わせたくなる。
    let forcedCrit = opts.crit;
    const firstHitCrit = (attacker.passives && attacker.passives.firstHitCrit) || 0;
    if (forcedCrit == null && firstHitCrit > 0 && (attacker.critShots || 0) > 0 && skill && skill.power > 0) {
      attacker.critShots--;
      forcedCrit = true;
    }

    // 溜め (§9.1)。次の攻撃1回だけに乗せて、その場で使い切る。
    //
    // 使い切りにするのは、乗ったまま残ると「溜めてから小技を連打する」のが
    // 最善手になり、溜める緊張感が消えるため。
    // 反撃や跳弾のような「おまけの一撃」には乗せない——
    // 1回の溜めが何発にも化けて、倍率が読めなくなる。
    let charge = null;
    if (attacker.charge && skill && skill.power > 0 && !opts.isCounter) {
      charge = attacker.charge;
      attacker.charge = null;
      pushLog(battle, `${attacker.name} の溜めが解き放たれた`, 'buff');
    }

    // 受ける側の状況で決まる軽減 (§5.7)。装備の恒常軽減とは別枠で足す。
    const attackerDefender = RPG.units.toDefender(defender);
    attackerDefender.reduction = Math.min(1,
      attackerDefender.reduction + situationalGuard(battle, defender)
      + ((defender.stance && defender.stance.reduction) || 0));

    const result = RPG.damage.calc({
      attacker: RPG.units.toAttacker(attacker),
      defender: attackerDefender,
      skill,
      options: {
        powerScale: opts.powerScale,
        ignoreDefense,
        crit: forcedCrit,
        firstRound: battle.round === 1,
        // 弱点コンボはパーティ側の攻撃にだけ乗る (§10.6)
        comboPower: attacker.side === 'party' ? comboPower(battle, attacker) : 0,
        // 装備セットのうち、戦況で決まるもの (§7.7) と、相手を見て決まるもの (§5.8)
        setPower: attacker.side === 'party'
          ? setPower(battle, attacker) * targetPower(attacker, defender)
          : targetPower(attacker, defender),
        // 小技だけを底上げする (§4.3)。強技には乗らないので置き換えは起きない。
        lowPowerBoost: isLowPower(skill) ? lowPowerBoost(attacker) : 0,
        // 闘技場「属性の否定」(§17)。相性を等倍に均す。
        // 適応・極意・貫通といった属性で解く道を丸ごと塞ぐのが狙いなので、
        // 攻撃側の補正が乗るより前に damage.js 側で潰す必要がある。
        elementNull: !!(battle.arena && isArenaBoss(battle, defender)
          && (battle.arena.gimmicks || {}).elementNull),
        // 大技だけを底上げする (§5.8)。小技側とは排他で、同じ技には両方乗らない。
        highPowerBoost: isHighPower(skill)
          ? ((attacker.situational && attacker.situational.highPowerBoost) || 0) : 0,
        // 破壊者の「終焉の一撃」だけがダメージ上限の外に出る (§12)。
        ignoreCap: !!(skill && skill.ignoreCap),
        // 溜め (§9.1)。威力・会心・上限突破の3つに同時に効く。
        chargeRatio: charge ? (charge.ratio || 1) : 1,
        chargeCrit: charge ? (charge.critRate || 0) : 0,
        chargeCapBreak: charge ? (charge.capBreak || 0) : 0,
      },
    });

    // --- 闘技場のギミック (§17) ---
    // 計算の後に判定する。演出上の数字は出さず、通らなかった理由だけを見せる。
    const gate = arenaGate(battle, attacker, defender, skill, opts);
    if (gate.blocked) {
      if (battle.arena) battle.arena.hitsThisRound++;
      if (!opts.silent) {
        pushLog(battle, `${defender.name} には通らない（${gate.reason}）`, 'sub');
      }
      pushEvent(battle, { type: 'blocked', key: defender.key, label: gate.reason });
      result.damage = 0;
      return result;
    }
    if (battle.arena && isArenaBoss(battle, defender)) battle.arena.hitsThisRound++;

    // 「虹を喰らう獣」— 有利属性の攻撃を回復として受ける (§17)。
    // 有利で殴るほど不利になるので、属性の常識がそのまま裏返る。
    // 判定は **素の属性表だけ** で行う (§17)。
    //
    // 実測した結果の倍率（result.breakdown.element）で見ると、
    // 全属性適応を取った編成ではあらゆる攻撃が「有利」と判定され、
    // 無属性で殴っても吸収されて逃げ道が消える（実測 0% 勝率）。
    // それは謎かけではなく理不尽なので、ビルドの補正を含まない
    // 攻撃属性 vs ボス属性の相性だけを見る。
    const rawAdvantage = isArenaBoss(battle, defender)
      && RPG.damage.elementMultiplier(skill.element, defender.element) > 1;

    if (rawAdvantage && (battle.arena.gimmicks || {}).elementAbsorb && result.damage > 0) {
      const healed = Math.min(defender.maxHp - defender.hp, result.damage);
      defender.hp += healed;
      if (!opts.silent) {
        pushLog(battle, `${defender.name} は有利属性を喰らって ${healed.toLocaleString()} 回復した`, 'heal');
      }
      result.damage = 0;
      return result;
    }

    // 闘技場のボスから受けるダメージには上限を設ける (§17)。
    //
    // 攻撃力を絞るだけでは足りない。技の威力倍率と属性有利が乗ると、
    // ATKを1/3にしても味方の最大HPの3倍が飛んでくる（実測 33,918 vs HP 11,899）。
    // それでは「ギミックを解く」以前に、何をしても1発で落ちる。
    //
    // 最大HPに対する割合で頭を押さえれば、装備やレベルが変わっても
    // 「痛いが耐えられる」関係が保たれる。何ラウンド持つかが読めるようになるので、
    // ギミックを解くことに意識を向けられる。
    if (battle.arena && attacker.arenaBoss && defender.side === 'party' && result.damage > 0) {
      const cap = battle.arena.maxHitRatio != null ? battle.arena.maxHitRatio : battle.arena.def.maxHitRatio;
      if (cap) {
        const limit = Math.max(1, Math.floor(defender.maxHp * cap));
        if (result.damage > limit) result.damage = limit;
      }
    }

    // 「凍結」— 受けるダメージが増える (§5.8)。
    // 自分の火力ではなく **場に置かれた敵の脆さ** なので、味方全員の攻撃に等しく乗る。
    const frozen = statusRatio(defender, 'freeze');
    if (frozen > 0 && result.damage > 0) {
      result.damage = Math.floor(result.damage * (1 + frozen));
    }

    // 「溢れる災禍」— 前の敵を倒したときの超過ダメージを、この一撃に上乗せする (§5.7)。
    // 過剰火力が無駄にならなくなるので、雑魚の掃除が一気に速くなる。
    if (attacker.carryDamage > 0 && skill && skill.power > 0) {
      const carried = Math.floor(attacker.carryDamage);
      result.damage += carried;
      attacker.carryDamage = 0;
      if (!opts.silent) {
        pushLog(battle, `持ち越した ${carried.toLocaleString()} が上乗せされた`, 'buff');
      }
    }

    // 憤怒: 溜めた怒りを次の一撃に上乗せして解き放つ (§7.7)
    const wrathFx = (attacker.setEffects || {}).wrathRelease;
    if (wrathFx && attacker.wrath > 0 && skill && skill.power > 0) {
      const burst = Math.floor(attacker.wrath);
      result.damage += burst;
      attacker.wrath = 0;
      pushLog(battle, `${attacker.name} の怒りが弾けた（+${burst.toLocaleString()}）`, 'buff');
      pushEvent(battle, { type: 'buff', key: attacker.key, label: '憤怒' });
    }

    // --- 会心まわりのパッシブ (§5.6) ---
    if (result.crit && attacker.side === 'party') {
      // 血の宴: 会心で与えたぶんの割合を吸う
      const critHeal = (attacker.passives && attacker.passives.critHeal) || 0;
      if (critHeal > 0 && attacker.alive) {
        const heal = Math.max(1, Math.floor(result.damage * critHeal));
        const before = attacker.hp;
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
        if (attacker.hp > before) {
          pushLog(battle, `${attacker.name} は ${(attacker.hp - before).toLocaleString()} HP吸収した`, 'heal');
        }
      }
      // 会心連鎖: 会心のたびに弱点コンボが余分に積まれる
      const critCombo = (attacker.passives && attacker.passives.critCombo) || 0;
      if (critCombo > 0 && battle.combo.count < comboMax(battle)) {
        battle.combo.count = Math.min(comboMax(battle), battle.combo.count + critCombo);
        battle.combo.best = Math.max(battle.combo.best, battle.combo.count);
        battle.combo.reason = '会心';
      }

      // 「熱狂」— 会心するほど会心しやすくなる (§5.8)。
      // 戦闘をまたいでは持ち越さないので、長期戦でだけ化ける。
      const critStack = (attacker.passives && attacker.passives.critStack) || 0;
      if (critStack > 0) {
        attacker.critBonus = Math.min(1, (attacker.critBonus || 0) + critStack);
      }

      // 「会心の余波」— 会心した一撃が他の敵にもこぼれる (§5.8)。
      // 波及（常時）と違って会心したときだけなので、会心特化ビルドの受け皿になる。
      const critSpread = (attacker.passives && attacker.passives.critSpread) || 0;
      if (critSpread > 0 && !opts.isSplash && defender.side === 'enemy') {
        const others = livingEnemies(battle).filter((/** @type {any} */ u) => u !== defender);
        for (const other of others) {
          const splash = Math.max(1, Math.floor(result.damage * critSpread));
          other.hp = Math.max(0, other.hp - splash);
          pushLog(battle, `会心の余波が ${other.name} に ${splash.toLocaleString()}`, 'sub');
          if (other.hp === 0) {
            other.alive = false;
            pushLog(battle, `${other.name} は力尽きた`, 'defeat');
            pushEvent(battle, { type: 'down', key: other.key, side: other.side });
          }
        }
      }
    }

    // 与えた結果を見てコンボを更新する。計算に使った値と食い違わないよう、必ず計算の後で。
    if (attacker.side === 'party') updateCombo(battle, attacker, defender, skill);

    // 「癒しの余剰」で張った障壁が先に削れる (§5.6)
    if (defender.shield > 0 && result.damage > 0) {
      const absorbed = Math.min(defender.shield, result.damage);
      defender.shield -= absorbed;
      result.damage -= absorbed;
      pushLog(battle, `${defender.name} の障壁が ${absorbed.toLocaleString()} を防いだ`, 'sub');
    }

    // 「庇う」— 味方が受けるダメージの一部を肩代わりする (§5.6)。
    // 前に出る役を作れるようにするための仕組み。
    if (defender.side === 'party' && result.damage > 0) {
      const guard = battle.party.find((/** @type {any} */ u) =>
        u !== defender && u.alive && u.passives && u.passives.guardAlly > 0);
      if (guard) {
        const share = Math.min(0.8, guard.passives.guardAlly);
        const taken = Math.floor(result.damage * share);
        if (taken > 0) {
          result.damage -= taken;
          guard.hp = Math.max(0, guard.hp - taken);
          pushLog(battle, `${guard.name} が ${defender.name} を庇った（${taken.toLocaleString()}）`, 'sub');
          if (guard.hp === 0) {
            guard.alive = false;
            pushLog(battle, `${guard.name} は力尽きた`, 'defeat');
            pushEvent(battle, { type: 'down', key: guard.key, side: guard.side });
          }
        }
      }
    }

    // 「痛みの分配」— 受けたダメージを味方全体で割って背負う (§5.8)。
    // 「庇う」が1人に寄せるのに対し、こちらは全員で薄く分ける。全体攻撃に強い。
    const share = (defender.passives && defender.passives.damageShare) || 0;
    if (share > 0 && defender.side === 'party' && result.damage > 0) {
      const others = livingParty(battle).filter((/** @type {any} */ u) => u !== defender);
      if (others.length > 0) {
        const moved = Math.floor(result.damage * share);
        const each = Math.floor(moved / others.length);
        if (each > 0) {
          result.damage -= each * others.length;
          // 先に「分け合った」と告げてから減らす。
          // 逆にすると、肩代わりで倒れた味方の訃報が理由より先に出てしまう。
          pushLog(battle, `痛みを分け合った（各 ${each.toLocaleString()}）`, 'sub');
          for (const ally of others) {
            ally.hp = Math.max(0, ally.hp - each);
            if (ally.hp === 0) {
              ally.alive = false;
              pushLog(battle, `${ally.name} は力尽きた`, 'defeat');
              pushEvent(battle, { type: 'down', key: ally.key, side: ally.side });
            }
          }
        }
      }
    }

    // 首刈り (§12 暗殺者) — HPが一定割合を切っている相手を、数字を通さずに落とす。
    //
    // 火力を伸ばして削り切るのは他のクラスにもできる。
    // 「HPバーが残っていても終わる」という規則の破り方は、ここにしか無い。
    // ボスには通さない。通すと、耐久を売りにした相手の設計が丸ごと無意味になる。
    const behead = skill && skill.executeBelow;
    if (behead && defender.alive && !defender.isBoss && !defender.arenaBoss
        && defender.hp > 0 && defender.hp <= defender.maxHp * behead) {
      result.damage = defender.hp;
      defender.hp = 0;
      defender.alive = false;
      if (!opts.silent) {
        pushLog(battle, `${defender.name} の首が落ちた`, 'defeat');
      }
      pushEvent(battle, { type: 'down', key: defender.key, side: defender.side });
      return result;
    }

    // 「不屈」— 致死ダメージをHP1で耐える（1戦闘に1回）
    const lastStand = (defender.passives && defender.passives.lastStand) || 0;
    if (result.damage >= defender.hp && defender.hp > 0 && !defender.stoodGround &&
        lastStand > 0 && RPG.rng.chance(lastStand)) {
      defender.stoodGround = true;
      defender.hp = 1;
      pushLog(battle, `${defender.name} は残りHP1で持ちこたえた！`, 'buff');
      pushEvent(battle, { type: 'buff', key: defender.key, label: '不屈' });
    } else {
      // 「溢れる災禍」— HPを超えたぶんを控えておく (§5.7)。控えるのは倒しきったときだけ。
      const carry = (attacker.passives && attacker.passives.overkillCarry) || 0;
      if (carry > 0 && result.damage > defender.hp && defender.hp > 0) {
        attacker.carryDamage = (attacker.carryDamage || 0) + (result.damage - defender.hp) * carry;
      }
      defender.hp = Math.max(0, defender.hp - result.damage);
    }
    if (defender.hp === 0) defender.alive = false;

    // 被弾の回数を数える。「痛みの記憶」の材料 (§5.7)。
    if (result.damage > 0) defender.hitsTaken = (defender.hitsTaken || 0) + 1;

    // 「出血」— 殴られるたびに傷口が開く (§5.8)。
    // 毒がラウンド単位なのに対し、こちらは被弾回数で効くので、多段技に刺さる。
    const bleeding = statusRatio(defender, 'bleed');
    if (bleeding > 0 && result.damage > 0 && defender.alive) {
      const extra = Math.max(1, Math.floor(result.damage * bleeding));
      defender.hp = Math.max(0, defender.hp - extra);
      pushLog(battle, `${defender.name} の傷口が開いた（${extra.toLocaleString()}）`, 'damage');
      if (defender.hp === 0) {
        defender.alive = false;
        pushLog(battle, `${defender.name} は力尽きた`, 'defeat');
        pushEvent(battle, { type: 'down', key: defender.key, side: defender.side });
      }
    }

    // --- 装備セット: 残響と憤怒の記録 (§7.7) ---
    // 残響: 味方が敵に与えたぶんを控えて、後のラウンドで撃ち込む
    {
      const echo = (attacker.setEffects || {}).echoRatio;
      if (echo && attacker.side === 'party' && defender.side === 'enemy' && result.damage > 0) {
        const delay = (attacker.setEffects || {}).echoDelay;
        if (delay) {
          battle.echoes.push({
            amount: result.damage * echo, turns: delay, targetKey: defender.key,
          });
        }
      }
    }
    // 憤怒: 味方が受けたぶんを怒りとして溜める
    {
      const wrath = (defender.setEffects || {}).wrathRatio;
      if (wrath && defender.side === 'party' && result.damage > 0) {
        defender.wrath = (defender.wrath || 0) + result.damage * wrath;
      }
    }

    pushEvent(battle, {
      type: 'damage',
      key: defender.key,
      from: attacker.key,
      amount: result.damage,
      crit: result.crit,
      element: result.breakdown.element,
      reduction: result.breakdown.reduction,
      execute: result.breakdown.execute,
      capped: result.breakdown.capped,
      counter: !!opts.isCounter,
    });

    if (!opts.silent) {
      const tags = [];
      if (result.crit) tags.push('会心！');
      if (result.breakdown.element > 1) tags.push('効果は抜群だ！');
      if (result.breakdown.element < 1) tags.push('効果はいまひとつ…');
      if (ignoreDefense) tags.push('防御無視');
      if (result.breakdown.execute > 1) tags.push('追い打ち');
      if (result.breakdown.reduction > 0) {
        tags.push(result.damage === 0 ? '完全防御！' : `軽減${Math.round(result.breakdown.reduction * 100)}%`);
      }
      if (result.breakdown.capped) tags.push('上限減衰');
      const suffix = tags.length ? `（${tags.join(' ')}）` : '';
      pushLog(
        battle,
        `${defender.name} に ${result.damage.toLocaleString()} ダメージ${suffix}`,
        result.crit ? 'crit' : 'damage'
      );
    }

    // --- 「鏡面」— 受けたダメージの割合をそのまま突き返す (§5.7) ---
    // 棘（相手の最大HP割合）と違い、殴られた重さがそのまま返るので大技ほど痛い。
    // ダメージ表示より後に置いてあるのは、ログが「殴られた → 返した」の順に読めるようにするため。
    const reflect = (defender.passives && defender.passives.reflect) || 0;
    if (reflect > 0 && result.damage > 0 && attacker.alive) {
      const back = Math.max(1, Math.floor(result.damage * reflect));
      attacker.hp = Math.max(0, attacker.hp - back);
      pushLog(battle, `${attacker.name} に ${back.toLocaleString()} が跳ね返った`, 'damage');
      pushEvent(battle, { type: 'damage', key: attacker.key, from: defender.key, amount: back });
      if (attacker.hp === 0) {
        attacker.alive = false;
        pushLog(battle, `${attacker.name} は力尽きた`, 'defeat');
        pushEvent(battle, { type: 'down', key: attacker.key, side: attacker.side });
      }
    }

    // --- パッシブ: 刻印（殴るたびに積み、溜まりきると弾ける）---
    // 判定を applyDamage に置いてあるので、多段ヒットは1撃ずつ数えられる。
    const sigil = (attacker.passives && attacker.passives.sigilBurst) || 0;
    if (sigil > 0 && result.damage > 0 && defender.alive) {
      addSigil(battle, defender, attacker, sigil);
    }

    // --- パッシブ: 吸命（与ダメージの一部をHPへ）---
    const lifesteal = (attacker.passives && attacker.passives.lifesteal) || 0;
    if (lifesteal > 0 && result.damage > 0 && attacker.alive && attacker.hp < attacker.maxHp) {
      // 「呪詛」は吸命も止める (§5.8)。回復手段をまとめて塞ぐのがこの異常の役割。
      const curse = Math.min(1, statusRatio(attacker, 'curse'));
      const healed = Math.max(1, Math.floor(result.damage * lifesteal * (1 - curse)));
      const before = attacker.hp;
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + healed);
      if (!opts.silent && attacker.hp > before) {
        pushLog(battle, `${attacker.name} は ${(attacker.hp - before).toLocaleString()} HPを吸収した`, 'heal');
      }
    }

    // --- パッシブ: 復活（1戦闘に1回だけ）---
    if (!defender.alive) {
      const reviveHp = (defender.passives && defender.passives.reviveHp) || 0;
      if (reviveHp > 0 && !defender.revived) {
        defender.revived = true;
        defender.alive = true;
        defender.hp = Math.max(1, Math.floor(defender.maxHp * reviveHp));
        pushLog(battle, `${defender.name} は倒れなかった！（HP ${defender.hp.toLocaleString()} で復帰）`, 'buff');
        pushEvent(battle, { type: 'revive', key: defender.key });
      } else {
        if (!opts.silent) pushLog(battle, `${defender.name} を撃破した！`, 'defeat');
        pushEvent(battle, { type: 'down', key: defender.key, side: defender.side });
        // 撃破数を数えておく (§13 図鑑)
        if (defender.side === 'enemy') {
          battle.defeatedEnemies[defender.id] = (battle.defeatedEnemies[defender.id] || 0) + 1;
        }

        // --- 撃破で誘発するパッシブ (§5.7) ---
        // 「戦場の糧」— 倒すたびに立て直せるので、殴り合いを続けやすくなる。
        const healKill = (attacker.passives && attacker.passives.healOnKill) || 0;
        if (healKill > 0 && attacker.alive && attacker.hp < attacker.maxHp) {
          const gain = Math.max(1, Math.floor(attacker.maxHp * healKill));
          const before = attacker.hp;
          attacker.hp = Math.min(attacker.maxHp, attacker.hp + gain);
          pushLog(battle, `${attacker.name} は ${(attacker.hp - before).toLocaleString()} HP回復した（撃破）`, 'heal');
        }
        // 「戦果の高揚」— 倒すたびに固有バフが乗る (§5.8)。
        // 開幕バフと同じ枠なので、雑魚を掃除しながらボス戦へ持ち込める。
        const onKill = (attacker.passives && attacker.passives.buffOnKill) || 0;
        if (onKill > 0 && attacker.alive) {
          attacker.buffUnique.push({ value: onKill, turns: buffTurns(attacker, 3), label: '戦果' });
          pushLog(battle, `${attacker.name} が勢いづいた（+${Math.round(onKill * 100)}%）`, 'buff');
          pushEvent(battle, { type: 'buff', key: attacker.key, label: '戦果' });
        }

        // 「連鎖する死」— 倒したらもう一度動ける。掃除が繋がると一方的になる。
        const killExtra = (attacker.passives && attacker.passives.killExtraAction) || 0;
        if (killExtra > 0 && attacker.alive && attacker.extraActions < MAX_EXTRA_ACTIONS &&
            RPG.rng.chance(killExtra)) {
          attacker.extraActions++;
          attacker.pendingExtra = true;
          pushLog(battle, `${attacker.name} は止まらない！`, 'buff');
          pushEvent(battle, { type: 'extra', key: attacker.key });
        }
      }
    }

    // --- パッシブ: 棘（被弾しただけで相手に固定割合のダメージ）---
    const thorns = (defender.passives && defender.passives.thorns) || 0;
    if (!opts.isCounter && thorns > 0 && attacker.alive && result.damage > 0) {
      const back = Math.max(1, Math.floor(attacker.maxHp * thorns));
      attacker.hp = Math.max(0, attacker.hp - back);
      pushLog(battle, `${attacker.name} は棘で ${back.toLocaleString()} のダメージ`, 'damage');
      pushEvent(battle, { type: 'damage', key: attacker.key, amount: back, crit: false, element: 1, reduction: 0, execute: 1 });
      if (attacker.hp === 0) {
        attacker.alive = false;
        pushLog(battle, `${attacker.name} は力尽きた`, 'defeat');
        pushEvent(battle, { type: 'down', key: attacker.key, side: attacker.side });
      }
    }

    // --- パッシブ: 反撃（反撃からは反撃しない）---
    // 迎撃の構え (§9.1)。確率ではなく必ず返す。
    // 構えている間だけなので、パッシブの反撃と食い合わない。
    if (!opts.isCounter && defender.stance && defender.alive && attacker.alive
        && result.damage > 0) {
      counterAttack(battle, defender, attacker, defender.stance.skillId);
    }

    const counterRate = (defender.passives && defender.passives.counterRate) || 0;
    if (!opts.isCounter && counterRate > 0 && defender.alive && attacker.alive && result.damage > 0) {
      if (RPG.rng.chance(counterRate)) {
        counterAttack(battle, defender, attacker);
      }
    }

    return result;
  }

  /**
   * 反撃。防御側が持つ攻撃技のうち最初のものを、控えめな威力で撃ち返す。
   * @param {any} battle
   * @param {any} defender 反撃する側
   * @param {any} attacker 反撃される側
   */
  function counterAttack(battle, defender, attacker, forcedSkillId) {
    // 構えが技を名指ししていればそれを使う (§9.1)。
    // 指定が無ければ、持っている中から殴れるものを拾う（従来どおり）。
    const skillId = (forcedSkillId && RPG.data.skills[forcedSkillId])
      ? forcedSkillId
      : defender.skills.find((/** @type {string} */ id) => {
        const s = RPG.data.skills[id];
        return s && s.power > 0 && s.plugin !== 'heal';
      });
    if (!skillId) return;

    const power = (defender.passives && defender.passives.counterPower) || 0.6;
    pushLog(battle, `${defender.name} の反撃！`, 'action');
    applyDamage(battle, defender, attacker, RPG.data.skills[skillId], {
      powerScale: power, isCounter: true,
    });

    // 「反撃の嵐」— 反撃が殴ってきた相手以外にも飛ぶ (§5.8)。
    // 反撃ビルドが「1対1でしか働かない」問題を解く枝。
    const all = (defender.passives && defender.passives.counterAll) || 0;
    if (all > 0 && defender.alive) {
      const others = (defender.side === 'party' ? livingEnemies(battle) : livingParty(battle))
        .filter((/** @type {any} */ u) => u !== attacker);
      for (const other of others) {
        applyDamage(battle, defender, other, RPG.data.skills[skillId], {
          powerScale: power * all, isCounter: true, silent: true,
        });
      }
    }
  }

  /**
   * プラグインに渡す実行文脈。ここに用意された操作だけでスキルは表現される。
   * @param {any} battle
   * @param {any} actor
   * @param {any} skill
   * @param {any[]} targets
   */
  function makeContext(battle, actor, skill, targets) {
    return {
      battle, actor, skill, targets,
      params: skill.params || {},

      /** @param {string} text @param {string} [kind] */
      log: (text, kind) => pushLog(battle, text, kind),

      /** @param {any} target @param {any} [opts] */
      damage: (target, opts) => applyDamage(battle, actor, target, skill,
        // 同時に2体以上を殴っているなら「広い攻撃」と見なす (§17)。
        // 闘技場の「単体でしか通らない」ボスがこれを見る。
        Object.assign({ multiTarget: targets.length > 1 }, opts || {})),

      /**
       * 別の技として殴る。フルバースト (§4.3) のように、
       * 手持ちの技を順に撃ち出すプラグインが使う。
       * @param {any} target @param {any} otherSkill @param {any} [opts]
       */
      damageWith: (target, otherSkill, opts) =>
        applyDamage(battle, actor, target, otherSkill, opts),

      /** @param {any} target @param {number} amount */
      heal: (target, amount) => {
        if (!target.alive) return 0;
        const before = target.hp;
        // 「癒しの手」— 自分が行う回復すべてを底上げする (§5.7)。
        const power = (actor.passives && actor.passives.healPower) || 0;
        // 「呪詛」— 受け手にかかっていると、そもそも癒えない (§5.8)。
        const cursed = Math.min(1, statusRatio(target, 'curse'));
        const want = Math.floor(amount * (1 + power) * (1 - cursed));
        target.hp = Math.min(target.maxHp, target.hp + want);
        const healed = target.hp - before;

        // 「癒しの余剰」— あふれたぶんをバリアに変える (§5.6)。
        // 満タンの相手に回復を撃つことが無駄でなくなる。
        const shield = (target.passives && target.passives.overhealShield) || 0;
        const spill = want - healed;
        if (shield > 0 && spill > 0) {
          const gain = Math.floor(spill * shield);
          if (gain > 0) {
            target.shield = (target.shield || 0) + gain;
            pushLog(battle, `${target.name} に ${gain.toLocaleString()} の障壁`, 'buff');
          }
        }

        pushLog(battle, `${target.name} のHPが ${healed.toLocaleString()} 回復した`, 'heal');
        pushEvent(battle, { type: 'heal', key: target.key, amount: healed });
        return healed;
      },

      /**
       * 固有ユニークバフ。すべて独立した別枠で乗算される (§3.2 ステップ3)。
       * @param {any} target @param {number} value @param {number} turns @param {string} label
       */
      addUniqueBuff: (target, value, turns, label) => {
        // 「持続の心得」で受け手側の持続が延びる (§5.8)
        target.buffUnique.push({ value, turns: buffTurns(target, turns), label });
        pushLog(battle, `${target.name} に ${label}（固有 +${Math.round(value * 100)}%）`, 'buff');
        pushEvent(battle, { type: 'buff', key: target.key, label });
      },

      /**
       * 共通バフ。同系統タグの装備補正に加算される (§3.2 ステップ3)。
       * @param {any} target @param {string} tag @param {number} value @param {number} turns @param {string} label
       */
      addTagBuff: (target, tag, value, turns, label) => {
        target.buffTags.push({ tag, value, turns: buffTurns(target, turns), label, matchType: null });
        pushLog(
          battle,
          `${target.name} に ${label}（[${RPG.damage.TAG_LABEL[tag]}] +${Math.round(value * 100)}%）`,
          'buff'
        );
        pushEvent(battle, { type: 'buff', key: target.key, label });
      },

      /**
       * 被ダメージ軽減バフ (§3.1-3)。複数の軽減手段は加算され、合計1.0で無敵になる。
       * @param {any} target @param {number} value @param {number} turns @param {string} label
       */
      addReductionBuff: (target, value, turns, label) => {
        target.buffReduction.push({ value, turns: buffTurns(target, turns), label });
        const total = RPG.units.totalReduction(target);
        pushLog(
          battle,
          `${target.name} の被ダメージ軽減 ${Math.round(total * 100)}%（${label}）` +
            (total >= 1 ? ' — 無敵！' : ''),
          'buff'
        );
        pushEvent(battle, { type: 'buff', key: target.key, label, shield: total >= 1 });
      },

      /** @param {any} target @param {number} value @param {number} turns @param {string} label */
      addDefBuff: (target, value, turns, label) => {
        target.defMultiplier = 1 + value;
        target.statusEffects.push({ kind: 'def_buff', turns: buffTurns(target, turns), label, value });
        pushLog(battle, `${target.name} の防御力が上昇（${label}）`, 'buff');
        pushEvent(battle, { type: 'buff', key: target.key, label });
      },

      /**
       * かかっている弱体を、残りターンぶんの継続ダメージに変えて叩き出す (§5.8)。
       *
       * ── なぜ必要か ──
       * 継続ダメージは1刻みが相手の最大HPの数%で、通常攻撃1発の3〜4割にあたる。
       * 数字としては悪くないのに、**戦闘が3〜5ラウンドで終わる**ため、
       * 撒いた毒が満期を迎える前に相手が死ぬか、こちらが押し切られる。
       * 「撒く1手」と「待つ数ラウンド」を払って、殴り続けるより遅い。
       *
       * そこで、残りターンぶんを前借りして一度に放出する手を用意した。
       * 遅さは「即座に受け取る代わりに弱体を全部失う」という取引に置き換わる。
       * 値は最大HPの割合なので、相手が固くても大きくても目減りしない。
       *
       * @param {any} target
       * @returns {{ dealt: number, ticks: number, kinds: number }}
       */
      detonate: (target) => {
        const v = detonationValue(target);
        if (v.total <= 0) return { dealt: 0, ticks: 0, kinds: v.kinds };

        // ── 消えるのは現金化した継続ダメージだけ ──
        // 最初は弱体を全部消していた。取引として筋は通っていたが、
        // 実測すると **起爆を撃つほど負けた**（12戦で勝8→勝5）。
        // 異常構成の火力は「弱体中の敵に強い」枝から出ているので、
        // 全部消すと自分の主力を自分で止めることになる。
        // 受け取ったぶんだけ失う形にすれば、取引は成立したまま矛盾が消える。
        target.statusEffects = (target.statusEffects || []).filter(
          (/** @type {any} */ e) => !(isDebuff(e) && (e.kind === 'poison' || e.kind === 'burn'))
        );

        const dealt = directDamage(battle, target, v.total,
          `${target.name} の弱体が一斉に弾けた — {n} のダメージ`);
        return { dealt, ticks: v.ticks, kinds: v.kinds };
      },

      /** @param {any} target @param {number} turns */
      setDefIgnore: (target, turns) => {
        const t = debuffTurns(actor, target, turns);
        if (t <= 0) {
          pushLog(battle, `${target.name} は弱体をはねのけた`, 'sub');
          return;
        }
        target.defIgnoredTurns = Math.max(target.defIgnoredTurns, t);
        pushLog(battle, `${target.name} の防御が崩された（${t}ターン）`, 'debuff');
        pushEvent(battle, { type: 'debuff', key: target.key, label: '防御崩壊' });
      },

      /** @param {any} target @param {any} effect */
      addStatus: (target, effect) => {
        const turns = debuffTurns(actor, target, effect.turns, effect.kind);
        if (turns <= 0) {
          pushLog(battle, `${target.name} は ${effect.label} をはねのけた`, 'sub');
          return;
        }
        // 「毒の心得」— 与える継続ダメージの割合を増やす (§5.6)
        const power = (actor.passives && actor.passives.statusPower) || 0;
        const applied = Object.assign({}, effect, { turns });
        if (power > 0 && applied.ratio) applied.ratio = applied.ratio * (1 + power);

        applyStatus(battle, target, applied);

        // 「疫病の広がり」— 撒いた弱体が隣へ伝染する (§5.7)。
        // 伝染からさらに伝染はしない（spread フラグで止める）。
        const spread = (actor.passives && actor.passives.debuffSpread) || 0;
        if (spread > 0 && !effect.spread) {
          const others = (actor.side === 'party' ? livingEnemies(battle) : livingParty(battle))
            .filter((/** @type {any} */ u) => u !== target);
          for (const other of others) {
            if (!RPG.rng.chance(spread)) continue;
            const t2 = debuffTurns(actor, other, effect.turns, effect.kind);
            if (t2 <= 0) continue;
            applyStatus(battle, other, Object.assign({}, applied, { turns: t2, spread: true }),
              `${applied.label} が ${other.name} にも広がった`);
          }
        }
      },

      /**
       * 自分から弱体を被る (§9.1)。
       *
       * addStatus を通さないのは、あちらが精神耐性で弾いてしまうから。
       * **進んで受けにいく弱体まではねのけられる**と、
       * 自傷を糧にする構成が耐性装備と噛み合わなくなり、
       * 「損を得に変える」という趣旨そのものが成立しなくなる。
       *
       * @param {string} kind @param {number} turns @param {number} ratio
       */
      selfStatus: (kind, turns, ratio) => {
        const def = (RPG.data.statuses || {})[kind];
        if (!def) return;
        applyStatus(battle, actor,
          { kind, label: def.label, turns, ratio },
          `${actor.name} は自ら ${def.label} を受け入れた`);
      },

      /**
       * 標的指定。付けた陣営の全員が、この相手に対して強くなる (§9.1)。
       * @param {any} target @param {number} value @param {number} turns @param {string} label
       */
      mark: (target, value, turns, label) => {
        // 重ねがけは強い方で上書きする。足すと2人で撃つだけで倍になり、
        // 「一人が印を付け、残りが殴る」という形が崩れる。
        const now = target.marked;
        if (now && now.side === actor.side && now.value >= value && now.turns >= turns) {
          pushLog(battle, `${target.name} の${label}は既に深い`, 'sub');
          return;
        }
        target.marked = {
          side: actor.side, value, turns: buffTurns(actor, turns), label,
        };
        pushLog(battle, `${target.name} に${label}（+${Math.round(value * 100)}%）`, 'debuff');
        pushEvent(battle, { type: 'debuff', key: target.key, label });
      },

      /**
       * 刻印を積む。溜まりきると弾ける (§9.1)。
       * @param {any} target @param {number} ratio @param {number} [count]
       */
      addSigil: (target, ratio, count) => addSigil(battle, target, actor, ratio, count),

      /**
       * 手番を前借りする。いまもう一度動ける代わりに、次のラウンドは動けない (§9.1)。
       *
       * 再行動 (extraActionRate) が **確率で得をする** のに対して、
       * こちらは **確定だが後で払う**。倒しきれるかどうかの読みを毎回迫る。
       *
       * @param {number} [rounds] 動けなくなるラウンド数
       */
      borrowTurn: (rounds) => {
        // ── 連打を止める ──
        // 権利そのものは「刻の号令」(§12) と同じ grantedExtra に乗せるが、
        // あちらは1ラウンドに1回配られるだけなのに対し、こちらは
        // **プレイヤーが好きなだけ撃てる**。素通しにすると、
        // 前借り → 追加行動 → また前借り、で手番が無限に増える。
        // 借金だけが増えて手番は増えない、という上限を入れておく。
        if (actor.extraActions >= MAX_EXTRA_ACTIONS) {
          pushLog(battle, `${actor.name} はこれ以上前借りできない`, 'sub');
          return;
        }
        actor.extraActions++;
        actor.grantedExtra = true;
        actor.stunnedRounds = (actor.stunnedRounds || 0) + (rounds == null ? 1 : rounds);
        pushLog(battle, `${actor.name} は次の手番を前借りした`, 'buff');
        pushEvent(battle, { type: 'extra', key: actor.key });
      },

      /** 行動者から見た味方 */
      allies: () => (actor.side === 'party' ? livingParty(battle) : livingEnemies(battle)),
      /** 行動者から見た敵 */
      foes: () => (actor.side === 'party' ? livingEnemies(battle) : livingParty(battle)),
    };
  }

  /**
   * スキルを実行する。プラグインが無ければ「単体に1回ダメージ」が既定動作。
   * @param {any} battle
   * @param {any} actor
   * @param {string} skillId
   * @param {any[]} targets
   */
  function executeSkill(battle, actor, skillId, targets) {
    const skill = RPG.data.skills[skillId];

    // 「一意専心」「変幻自在」の材料 (§5.8)。
    // 追撃や余波は executeSkill を通らないので、ここで数えれば
    // 「プレイヤーが選んだ手」だけが積み上がる。
    if (actor.lastSkillId === skillId) {
      actor.repeatCount = (actor.repeatCount || 1) + 1;
      actor.switchedSkill = false;
    } else {
      actor.repeatCount = 1;
      actor.switchedSkill = actor.lastSkillId != null;
    }
    actor.lastSkillId = skillId;

    pushLog(battle, `${actor.name} の ${skill.name}！`, 'action');
    pushEvent(battle, { type: 'action', key: actor.key, side: actor.side, skill: skill.name });

    const ctx = makeContext(battle, actor, skill, targets);
    const plugin = skill.plugin ? RPG.plugins[skill.plugin] : null;
    const attackSkill = isAttackSkill(skill);
    const low = isLowPower(skill);

    // --- 小技の全体化 (§4.3) ---
    // 威力の低い技だけが敵全体へ広がる。単体最大火力とは別の軸を作る。
    const p = actor.passives || {};
    const fx = actor.setEffects || {};
    const spread = (p.lowPowerSpread || 0) + (fx.lowPowerSpread || 0);
    // 「遍く波紋」(§5.7) は威力を問わず全部を広げる。上級の到達点なので条件を付けない。
    const spreadAll = (p.allSpread || 0) > 0 && attackSkill;
    if ((low && spread > 0 || spreadAll) && actor.side === 'party' && !plugin) {
      const all = livingEnemies(battle);
      if (all.length > targets.length) {
        pushLog(battle, `${skill.name} が広がった`, 'sub');
        targets = all;
        ctx.targets = all;
      }
    }

    const runOnce = () => {
      if (plugin) {
        plugin.execute(ctx);
      } else {
        for (const target of targets) {
          if (target.alive) ctx.damage(target);
        }
      }
    };

    runOnce();

    // --- 小技の多重発動 (§4.3) ---
    // 小技だけが余分に撃てる。1発が軽いぶん、回数で寄せるビルドになる。
    const repeat = (p.lowPowerRepeat || 0) + (fx.lowPowerRepeat || 0);
    if (low && repeat > 0) {
      for (let i = 0; i < repeat; i++) {
        if (!actor.alive) break;
        const alive = targets.filter((/** @type {any} */ t) => t.alive);
        if (alive.length === 0) break;
        pushLog(battle, `${actor.name} の追い打ち — ${skill.name}`, 'sub');
        ctx.targets = alive;
        runOnce();
      }
      ctx.targets = targets;
    }

    // --- パッシブ: 連撃（攻撃技だけがもう一度発動する）---
    const extraHits = (actor.passives && actor.passives.doubleHits) || 0;
    if (extraHits > 0 && attackSkill) {
      for (let i = 0; i < extraHits; i++) {
        if (!actor.alive) break;
        const alive = targets.filter((/** @type {any} */ t) => t.alive);
        if (alive.length === 0) break;
        pushLog(battle, `${actor.name} の連撃！`, 'sub');
        ctx.targets = alive;
        runOnce();
      }
      ctx.targets = targets;
    }

    // --- パッシブ: 連鎖（単体攻撃の余波が他の敵にも及ぶ）---
    const chain = (actor.passives && actor.passives.chain) || 0;
    if (chain > 0 && attackSkill && targets.length === 1) {
      // 「波及の心得」— 余波そのものの威力を上げる (§5.8)。
      // 波及の確率ではなく威力を伸ばすので、連鎖ビルドの伸びしろになる。
      const chainScale = chain * (1 + ((actor.passives && actor.passives.chainPower) || 0));
      const others = ctx.foes().filter((/** @type {any} */ e) => e !== targets[0] && e.alive);
      for (const other of others) {
        applyDamage(battle, actor, other, skill, { powerScale: chainScale, isCounter: true });
      }
    }

    // --- 「火傷」— 攻撃技を振るうたびに自分が焼ける (§5.8) ---
    // 毒と違って「動くと痛い」ので、多段や連射を積んだ相手ほど重くのしかかる。
    const burning = statusRatio(actor, 'burn');
    if (burning > 0 && attackSkill && actor.alive) {
      const burn = Math.max(1, Math.floor(actor.maxHp * burning));
      actor.hp = Math.max(0, actor.hp - burn);
      pushLog(battle, `${actor.name} は火傷で ${burn.toLocaleString()} のダメージ`, 'damage');
      if (actor.hp === 0) {
        actor.alive = false;
        pushLog(battle, `${actor.name} は力尽きた`, 'defeat');
        pushEvent(battle, { type: 'down', key: actor.key, side: actor.side });
      }
    }

    // --- 「毒手」— 攻撃したついでに毒を撒く (§5.7) ---
    // 状態異常を撒く技を持っていないキャラでも、追撃・弱体系のビルドに乗れるようにする。
    const onHit = (p.statusOnHit || 0) * (isMidPower(skill) ? 1 + ((p.midPowerStatus) || 0) : 1);
    if (onHit > 0 && attackSkill && actor.alive) {
      for (const target of targets) {
        if (!target.alive || !RPG.rng.chance(onHit)) continue;
        ctx.addStatus(target, { kind: 'poison', label: '毒', turns: 3, ratio: 0.03 });
      }
    }

    // --- 種類を指定して撒くパッシブ (§5.8) ---
    // 「毒手」が毒だけなのに対し、こちらは異常ごとに枝が分かれている。
    // どれを撒くかで、パーティ全体の削り方が変わる。
    const byKind = p.statusOnHitKind || {};
    if (attackSkill && actor.alive) {
      // 中技は弱体を通しやすい (§5.8)。付与率そのものに倍率をかける。
      // 火力で並ぶのではなく「確実に効かせる」ことを中技の役割にしてある。
      const midMul = isMidPower(skill) ? 1 + ((p.midPowerStatus) || 0) : 1;
      for (const kind of Object.keys(byKind)) {
        const rate = byKind[kind] * midMul;
        if (!(rate > 0)) continue;
        for (const target of targets) {
          if (!target.alive || !RPG.rng.chance(rate)) continue;
          inflict(battle, actor, target, kind, 3, STATUS_ON_HIT_RATIO[kind] || 0.03);
        }
      }
    }

    // --- 小技の自動発動 (§4.3) ---
    // 追撃は applyDamage を直接呼ぶので executeSkill には戻らない。無限連鎖はしない。
    if (attackSkill) fireAutoLowSkill(battle, actor, targets);
  }

  /**
   * パーティメンバーのコマンドを確定して行動させ、進行を1つ進める。
   * @param {any} battle
   * @param {string} skillId
   * @param {any[]} targets
   * @param {{auto?: boolean}} [opts] オート戦闘が選んだ行動なら auto:true。手動ボーナスの判定に使う。
   */
  function commandSkill(battle, skillId, targets, opts) {
    const actor = currentActor(battle);
    if (!actor || battle.finished) return;

    // クラス技の鍵 (§12)。UI 側でも押せないようにしてあるが、
    // 自動戦闘や外部から直接呼ばれても破れないよう、ここでも必ず確かめる。
    const ready = skillReady(battle, actor, skillId);
    if (!ready.ok) {
      pushLog(battle, `${RPG.data.skills[skillId].name} はまだ使えない（${ready.reason}）`, 'sub');
      // 手動なら選び直せばよいのでその場に留まる。
      // オートは同じ技を選び続けるので、ここで手番を進めないと戦闘が止まる。
      if (opts && opts.auto) {
        battle.actorIndex++;
        skipDeadActors(battle);
        if (battle.actorIndex >= battle.party.length) runEnemyPhase(battle);
      }
      return;
    }
    startCooldown(battle, actor, skillId);

    // 誰が選んだ行動なのかを数えておく (§10.1 手動ボーナス)
    if (opts && opts.auto) battle.inputs.auto++;
    else battle.inputs.manual++;

    // --- 「麻痺」— 行動そのものが飛ぶ (§5.8) ---
    // 数字を削るのではなく手番を奪うので、大技を抱えた相手ほど損が大きい。
    const numb = statusRatio(actor, 'paralyze');
    if (numb > 0 && RPG.rng.chance(numb)) {
      pushLog(battle, `${actor.name} は痺れて動けない！`, 'debuff');
      pushEvent(battle, { type: 'debuff', key: actor.key, label: '麻痺' });
      battle.actorIndex++;
      skipDeadActors(battle);
      if (battle.actorIndex >= battle.party.length) runEnemyPhase(battle);
      return;
    }

    executeSkill(battle, actor, skillId, targets);

    if (checkWaveCleared(battle)) return;

    // 「連鎖する死」で追加行動が確定している (§5.7)。
    // 発火は applyDamage 側なので、ここでは順番を進めないだけでよい。
    if (actor.pendingExtra) {
      actor.pendingExtra = false;
      if (actor.alive) return;
    }

    // 「刻の号令」で配られた追加行動 (§12)。
    // 権利は1人1つで、使うと消える。号令を重ねがけしても手番は増え続けない。
    if (actor.grantedExtra) {
      actor.grantedExtra = false;
      if (actor.alive) return;
    }

    // --- パッシブ: 奇襲（1ラウンド目だけ、もう一度動ける）(§5.6) ---
    const ambush = (actor.passives && actor.passives.ambush) || 0;
    if (ambush > 0 && battle.round === 1 && actor.alive && !actor.ambushed &&
        actor.extraActions < MAX_EXTRA_ACTIONS && RPG.rng.chance(ambush)) {
      actor.ambushed = true;
      actor.extraActions++;
      pushLog(battle, `${actor.name} の奇襲！`, 'buff');
      pushEvent(battle, { type: 'extra', key: actor.key });
      return;
    }

    // --- パッシブ: 再行動（同じラウンドで連続しすぎないよう上限を設ける）---
    const extraRate = (actor.passives && actor.passives.extraActionRate) || 0;
    if (extraRate > 0 && actor.alive && actor.extraActions < MAX_EXTRA_ACTIONS && RPG.rng.chance(extraRate)) {
      actor.extraActions++;
      pushLog(battle, `${actor.name} は続けて動いた！`, 'buff');
      pushEvent(battle, { type: 'extra', key: actor.key });
      return;   // 行動順を進めず、同じキャラがもう一度コマンドを選ぶ
    }

    battle.actorIndex++;
    skipDeadActors(battle);

    if (battle.actorIndex >= battle.party.length) {
      runEnemyPhase(battle);
    }
  }

  /**
   * 敵フェーズ。生存パーティメンバーからランダムにターゲットを選ぶ (§2.2)。
   * @param {any} battle
   */
  function runEnemyPhase(battle) {
    battle.phase = 'enemy';

    for (const enemy of battle.enemies) {
      if (!enemy.alive) continue;
      const alive = livingParty(battle);
      if (alive.length === 0) break;

      // 「麻痺」— 敵側もそのまま手番を落とす (§5.8)。
      // 敵は commandSkill を通らないので、判定をここにも置く必要がある。
      const numb = statusRatio(enemy, 'paralyze');
      if (numb > 0 && RPG.rng.chance(numb)) {
        pushLog(battle, `${enemy.name} は痺れて動けない！`, 'debuff');
        pushEvent(battle, { type: 'debuff', key: enemy.key, label: '麻痺' });
        continue;
      }

      // 闘技場のボスは複数回動く (§17)。
      //
      // 味方は4人が毎ラウンド殴るのに、ボスの手番は1回。
      // この非対称のままHPだけ増やすと、50ラウンドかけて削るだけの
      // 消耗戦になり、歯ごたえではなく作業になる（実測でそうなった）。
      // 手数を揃えることで、短いラウンド数のうちに緊張が生まれる。
      const acts = (battle.arena && enemy.arenaBoss)
        ? Math.max(1, (battle.arena.actionsPerRound != null
            ? battle.arena.actionsPerRound : battle.arena.def.actionsPerRound) || 1) : 1;

      for (let a = 0; a < acts; a++) {
        if (!enemy.alive) break;
        const stillAlive = livingParty(battle);
        if (stillAlive.length === 0) break;
        const skillId = RPG.rng.pick(enemy.skills);
        const skill = RPG.data.skills[skillId];
        const kind = targetKind(skill);
        const targets = kind === 'ally'
          ? [RPG.rng.pick(livingEnemies(battle))]
          : [RPG.rng.pick(stillAlive)];
        executeSkill(battle, enemy, skillId, targets);
      }
    }

    endOfRound(battle);
  }

  /**
   * ラウンド終了処理。継続ダメージの適用とバフ/デバフの経過。
   * @param {any} battle
   */
  function endOfRound(battle) {
    const all = battle.party.concat(battle.enemies);

    // 継続ダメージの解決。ラウンド終了時に減るのは毒だけで、
    // 火傷・出血・麻痺・凍結・呪詛はそれぞれ別のタイミングで効く (§5.8)。
    for (const unit of all) {
      if (!unit.alive) continue;
      // statusRatio 経由で引くことで、上限 (STATUS_CAP) が必ず効く。
      const poison = statusRatio(unit, 'poison');
      if (poison > 0) {
        directDamage(battle, unit, unit.maxHp * poison, `${unit.name} は毒で {n} のダメージ`);
      }
    }

    // 「障壁の再生」— ラウンドの終わりに障壁を張り直す (§5.8)。
    // 回復と違って上限を超えて積めるので、削りきられない硬さを作れる。
    for (const unit of all) {
      const regen = (unit.passives && unit.passives.shieldRegen) || 0;
      if (!unit.alive || regen <= 0) continue;
      const gain = Math.max(1, Math.floor(unit.maxHp * regen));
      unit.shield = (unit.shield || 0) + gain;
      pushLog(battle, `${unit.name} の障壁が ${gain.toLocaleString()} 再生した`, 'buff');
    }

    // パッシブ: 再生（ラウンド終了時に最大HPの割合で回復）
    for (const unit of all) {
      const regen = (unit.passives && unit.passives.regen) || 0;
      if (!unit.alive || regen <= 0 || unit.hp >= unit.maxHp) continue;
      const heal = Math.max(1, Math.floor(unit.maxHp * regen));
      const before = unit.hp;
      unit.hp = Math.min(unit.maxHp, unit.hp + heal);
      pushLog(battle, `${unit.name} は ${(unit.hp - before).toLocaleString()} HP回復した（再生）`, 'heal');
    }

    // 持続時間の経過
    for (const unit of all) {
      unit.buffUnique = tickAndFilter(unit.buffUnique);
      unit.buffTags = tickAndFilter(unit.buffTags);
      unit.buffReduction = tickAndFilter(unit.buffReduction);
      unit.statusEffects = tickAndFilter(unit.statusEffects);
      unit.extraActions = 0;
      if (!unit.statusEffects.some((/** @type {any} */ e) => e.kind === 'def_buff')) {
        unit.defMultiplier = 1;
      }
      if (unit.defIgnoredTurns > 0) unit.defIgnoredTurns--;
      // 標的指定も時間で消える。消えたら参照ごと落として、
      // turns 0 の印が残り続けないようにする。
      if (unit.marked) {
        unit.marked.turns--;
        if (unit.marked.turns <= 0) {
          pushLog(battle, `${unit.name} の${unit.marked.label}が消えた`, 'sub');
          unit.marked = null;
        }
      }
      // 迎撃の構えも時間で解ける (§9.1)
      if (unit.stance) {
        unit.stance.turns--;
        if (unit.stance.turns <= 0) {
          unit.stance = null;
          pushLog(battle, `${unit.name} は構えを解いた`, 'sub');
        }
      }
    }

    // 残響セットの予約を進める (§7.7)。ラウンドの終わりに炸裂させる。
    // 闘技場のギミックを数え直し、時間制限の裁きを下す (§17)
    arenaRoundTick(battle);

    resolveEchoes(battle);

    // クエストの「全員生存」はここで判定する。死者が出た時点で失敗にして、
    // 勝てない戦闘を最後まで見せられるのを避ける。
    if (battle.rules.allAlive && battle.party.some((/** @type {any} */ u) => !u.alive)) {
      failQuest(battle, '仲間が倒れた（全員生存の条件を満たせなかった）');
      return;
    }

    if (checkWaveCleared(battle)) return;

    if (livingParty(battle).length === 0) {
      battle.finished = true;
      battle.victory = false;
      battle.phase = 'result';
      pushLog(battle, 'パーティは全滅した…', 'defeat');
      pushEvent(battle, { type: 'wave', text: 'DEFEAT', result: true, lost: true });
      return;
    }

    // ラウンド制限。次のラウンドに入れないなら時間切れ。
    if (battle.rules.maxRounds && battle.totalRounds >= battle.rules.maxRounds) {
      failQuest(battle, `${battle.rules.maxRounds} ラウンド以内に決着がつかなかった`);
      return;
    }

    battle.round++;
    battle.totalRounds++;
    battle.actorIndex = 0;
    battle.phase = 'command';
    skipDeadActors(battle);
    if (battle.actorIndex >= battle.party.length) runEnemyPhase(battle);
  }

  /**
   * クエストの縛り条件を破って失敗させる。
   * @param {any} battle
   * @param {string} reason
   */
  function failQuest(battle, reason) {
    battle.ruleBroken = reason;
    battle.finished = true;
    battle.victory = false;
    battle.phase = 'result';
    pushLog(battle, `条件失敗: ${reason}`, 'defeat');
    pushEvent(battle, { type: 'wave', text: 'FAILED', result: true, lost: true });
  }

  /**
   * @param {any[]} list
   */
  function tickAndFilter(list) {
    return list
      // lasting が立っているものは経過しない (§12 呪術師「疫病の坩堝」)。
      // ウェーブが替われば敵ごと入れ替わるので、戦闘全体には残らない。
      .map((e) => (e.lasting ? e : Object.assign({}, e, { turns: e.turns - 1 })))
      .filter((e) => e.turns > 0);
  }

  /**
   * ウェーブがクリアされたか判定し、報酬を蓄積して次へ進める。
   * @param {any} battle
   * @returns {boolean} クリア判定が走ったら true
   */
  function checkWaveCleared(battle) {
    if (livingEnemies(battle).length > 0) return false;

    // 報酬はウェーブごとに蓄積し、全終了後にまとめて付与する (§10.1)
    for (const enemy of battle.enemies) {
      battle.rewards.gold += Math.floor(enemy.gold * battle.field.gold_mult);
      battle.rewards.exp += Math.floor(enemy.exp * (battle.field.exp_mult == null ? 1 : battle.field.exp_mult));
      // 戦闘中は「宝箱ID + 個数」のフラグ加算のみ (§2.2)
      for (const drop of enemy.drops) {
        if (RPG.rng.chance(drop.chance)) {
          battle.rewards.boxes[drop.box] = (battle.rewards.boxes[drop.box] || 0) + drop.count;
        }
      }
    }

    if (battle.wave >= battle.totalWaves) {
      battle.finished = true;
      battle.victory = true;
      battle.phase = 'result';
      pushLog(battle, '戦闘に勝利した！', 'victory');
      pushEvent(battle, { type: 'wave', text: 'VICTORY', result: true });
    } else {
      battle.phase = 'wave_clear';
      pushLog(battle, `ウェーブ ${battle.wave} 制圧。次の敵が迫る…`, 'wave');
    }
    return true;
  }

  /**
   * ウェーブクリア後、次のウェーブへ進む。
   * @param {any} battle
   */
  function advanceWave(battle) {
    if (battle.phase !== 'wave_clear') return;
    nextWave(battle);
  }

  /**
   * 敗走（撤退）。そこまでの報酬は保持される (§10.1)。
   * @param {any} battle
   */
  function retreat(battle) {
    battle.finished = true;
    battle.victory = false;
    battle.phase = 'result';
    pushLog(battle, '戦域から撤退した。', 'info');
  }

  RPG.battle = {
    start, commandSkill, advanceWave, retreat, failQuest,
    comboPower, comboMax, updateCombo, COMBO_MAX, COMBO_STEP,
    setPower, targetPower, resolveEchoes, skipDeadActors,
    LOW_POWER, HIGH_POWER, isLowPower, isMidPower, isHighPower, isAttackSkill, scaledEnemyLv,
    lowPowerSkills, lowPowerBoost,
    HIGH_POWER, isHighPower, statusRatio, inflict, debuffTurns, buffTurns,
    skillReady, startCooldown,
    arenaGate, arenaRoundTick, isArenaBoss,
    currentActor, livingParty, livingEnemies, targetKind,
    detonationValue, isDebuff, debuffsOn, kindOf,
    addSigil, SIGIL_THRESHOLD,
    executeSkill, applyDamage,
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
