// @ts-check
/**
 * オート戦闘の行動選択。
 *
 * 期待ダメージの見積もりには §3 のダメージ計算をそのまま使う。
 * 乱数とクリティカルは固定して呼ぶので、この関数は戦闘状態を一切変更しない。
 */
(function (RPG) {
  'use strict';

  /** 回復に回る味方HPの閾値 */
  const HEAL_THRESHOLD = 0.5;
  /** 全体回復に切り替える人数 */
  const HEAL_PARTY_COUNT = 2;

  /** バフ系のプラグイン */
  const BUFF_PLUGINS = ['unique_buff', 'tag_buff', 'def_buff'];

  /**
   * 攻撃技かどうか。
   * @param {any} skill
   */
  function isAttack(skill) {
    return skill.power > 0 && skill.plugin !== 'heal' && !BUFF_PLUGINS.includes(skill.plugin);
  }

  /**
   * その技が既に効果を発揮しているか（同じバフの重ねがけを避ける）。
   * @param {any} actor
   * @param {any} skill
   */
  function buffActive(actor, skill) {
    const label = (skill.params && skill.params.label) || skill.name;
    const has = (/** @type {any[]} */ list) => list.some((b) => b.label === label);
    return has(actor.buffUnique) || has(actor.buffTags) || has(actor.statusEffects);
  }

  /**
   * 1回の攻撃で与えられる見込みダメージ。多段は回数分を合算する。
   * @param {any} actor
   * @param {any} target
   * @param {any} skill
   */
  function estimate(actor, target, skill) {
    let hits = skill.plugin === 'multi_hit' ? (skill.params && skill.params.hits) || 1 : 1;
    // 生命代償はHPを払うほど威力が伸びるので、平均的な上乗せを見込む
    if (skill.plugin === 'hp_cost') {
      hits *= 1 + Math.min((skill.params && skill.params.maxBonus) || 4, 2.2);
    }
    // 「連撃」持ちは同じ技が複数回出る
    hits *= 1 + ((actor.passives && actor.passives.doubleHits) || 0);
    const result = RPG.damage.calc({
      attacker: RPG.units.toAttacker(actor),
      defender: RPG.units.toDefender(target),
      skill,
      options: {
        random: 1.0,
        crit: false,
        ignoreDefense: skill.plugin === 'def_ignore' || target.defIgnoredTurns > 0,
      },
    });
    // 起爆 (§5.8) は、たまっている弱体ぶんが本体で、
    // 技そのものの威力は前座にすぎない。ここで足しておかないと
    // オートは威力70の弱い技としか見えず、永久に選ばない。
    // 実際に入る額と同じ関数を通す。
    if (skill.plugin === 'detonate') {
      return result.damage * hits + RPG.battle.detonationValue(target).total;
    }

    return result.damage * hits;
  }

  /**
   * 次の行動を決める。コマンド入力待ちでなければ null。
   * @param {any} battle
   * @returns {{skillId: string, targets: any[]}|null}
   */
  function chooseAction(battle) {
    const actor = RPG.battle.currentActor(battle);
    if (!actor) return null;

    const allies = RPG.battle.livingParty(battle);
    const foes = RPG.battle.livingEnemies(battle);
    if (foes.length === 0) return null;

    // 今このラウンドで撃てる技だけを候補にする (§12)。
    // 解禁前やクールタイム中の技を選ぶと commandSkill が空振りし、
    // 手番が進まないまま同じ技を選び続けて戦闘が止まってしまう。
    const skills = actor.skills
      .filter((/** @type {string} */ id) => RPG.battle.skillReady(battle, actor, id).ok)
      .map((/** @type {string} */ id) => ({ id, def: RPG.data.skills[id] }));

    // 全部が塞がっていることは通常ない（クラス技以外に鍵は付かない）。
    // 万一そうなっても、commandSkill 側が手番を進めてくれるので戦闘は止まらない。
    if (!skills.length) return { skillId: actor.skills[0], targets: [foes[0]] };

    // --- 1. 回復を優先する ---
    const heals = skills.filter((s) => s.def.plugin === 'heal');
    if (heals.length) {
      // 味方を回復できない者は、自分だけを候補にする (§5.14)。
      //
      // バフ側とまったく同じ罠。遮断された回復は相手のHPを動かさないので、
      // 「傷ついた味方がいる → 回復する → 治らない」を**毎ターン繰り返す**。
      // 手番が全部溶ける。実測で神官戦士の勝率が 99% → 88% まで落ちていた。
      const noAllyHeal = !!(actor.passives && actor.passives.noAllyHeal);
      const healable = noAllyHeal ? allies.filter((u) => u === actor) : allies;
      const hurt = healable
        .filter((u) => u.hp / u.maxHp < HEAL_THRESHOLD)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
      if (hurt.length) {
        const partyHeal = noAllyHeal
          ? null : heals.find((s) => s.def.params && s.def.params.party);
        if (hurt.length >= HEAL_PARTY_COUNT && partyHeal) {
          return { skillId: partyHeal.id, targets: [] };
        }
        const single = heals.find((s) => !(s.def.params && s.def.params.party)) || heals[0];
        const kind = RPG.battle.targetKind(single.def);
        return { skillId: single.id, targets: kind === 'none' ? [] : [hurt[0]] };
      }
    }

    // --- 2. まだ効いていないバフを、戦闘が続きそうなときだけ張る ---
    const remaining = foes.reduce((s, e) => s + e.hp, 0);
    const totalMax = foes.reduce((s, e) => s + e.maxHp, 0);
    if (remaining > totalMax * 0.35) {
      // 遮断されているバフは撃たない (§5.14)。
      //
      // 【極】旗手は「自分にかけたバフが自分に乗らない」。乗らないバフは
      // battle.js が積まないので buffActive が**永久に false を返し**、
      // オートが同じバフを毎ターン撃ち続けて手番を全部溶かす。
      // 実測では旗手を着けた支援の勝率が 97% → 89% まで落ちていた。
      // 自分を対象に取るバフだけが該当する（全体バフは targetKind が 'none'）。
      // 自分にしか乗らないバフか、味方にも配るバフかは **params.party** が決める
      // （buffs.js の resolveTargets が `params.party ? allies() : [actor]`）。
      // targetKind は unique_buff/tag_buff/def_buff のどれも常に 'none' を返すので、
      // そちらで判別しようとすると**一度も引っかからない**。実際それで外した。
      const noSelf = !!(actor.passives && actor.passives.noSelfBuff);
      const selfOnly = (/** @type {any} */ def) => !(def.params && def.params.party);
      const buff = skills.find((s) => BUFF_PLUGINS.includes(s.def.plugin)
        && !buffActive(actor, s.def)
        && !(noSelf && selfOnly(s.def)));
      if (buff) return { skillId: buff.id, targets: RPG.battle.targetKind(buff.def) === 'none' ? [] : [actor] };
    }

    // --- 3. 攻撃: 無駄撃ちを避けつつ、最も削れる組み合わせを選ぶ ---
    const attacks = skills.filter((s) => isAttack(s.def));
    if (!attacks.length) {
      // 攻撃手段が無ければ持っている技のどれかを撃つ
      const any = skills[0];
      const kind = RPG.battle.targetKind(any.def);
      return { skillId: any.id, targets: kind === 'none' ? [] : [kind === 'ally' ? actor : foes[0]] };
    }

    let best = null;
    for (const s of attacks) {
      // 全体攻撃は敵全員に入るので、削れる量を合計して評価する。
      // 起爆の広域版も「全員を巻き込む技」なので同じ扱いにする。
      // 単体として見積もると1体ぶんの価値しか付かず、まず選ばれない。
      const wide = s.def.plugin === 'all_enemies'
        || (s.def.plugin === 'detonate' && s.def.params && s.def.params.all);
      if (wide) {
        const total = foes.reduce((sum, t) => sum + Math.min(estimate(actor, t, s.def), t.hp), 0);
        if (!best || total > best.score) {
          best = { score: total, dmg: total, skillId: s.id, target: foes[0] };
        }
        continue;
      }
      for (const target of foes) {
        const dmg = estimate(actor, target, s.def);
        // 過剰ダメージは価値が無いので、実際に削れる量で評価する
        const score = Math.min(dmg, target.hp);
        if (!best || score > best.score ||
            (score === best.score && target.hp < best.target.hp)) {
          best = { score, dmg, skillId: s.id, target };
        }
      }
    }
    if (!best) return null;
    return { skillId: best.skillId, targets: [best.target] };
  }

  RPG.autoplay = { chooseAction, estimate, isAttack, buffActive };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
