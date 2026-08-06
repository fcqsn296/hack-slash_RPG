// @ts-check
/**
 * フルバースト (§4.3)。
 *
 * 持っている攻撃技を **すべて** 同時に叩き込み、その代償に撃った本数ぶんの
 * ラウンド行動できなくなる。
 *
 * ── 何のためにあるか ──
 * 強い技を覚えると、それ以下の攻撃技は二度と選ばれなくなる。
 * この技は「持っている技の本数」がそのまま威力になるので、
 * 弱い技を抱えていること自体が価値に変わる。
 */
(function (RPG) {
  'use strict';

  /** 自分自身（フルバースト）は撃ち出す対象に含めない */
  function isFirable(skill, selfId) {
    if (!skill || skill.id === selfId) return false;
    if (skill.plugin === 'full_burst') return false;
    return skill.power > 0 && skill.plugin !== 'heal' &&
      !['unique_buff', 'tag_buff', 'def_buff', 'reduction_buff'].includes(skill.plugin);
  }

  RPG.plugins.full_burst = {
    /**
     * @param {any} ctx
     */
    execute(ctx) {
      const actor = ctx.actor;
      const params = ctx.skill.params || {};
      const ratio = params.ratio == null ? 0.6 : params.ratio;

      // 撃ち出す技を集める。順番は覚えた順のままにして、結果が読めるようにする。
      const fired = (actor.skills || [])
        .map((/** @type {string} */ id) => Object.assign({ id }, RPG.data.skills[id]))
        .filter((/** @type {any} */ s) => isFirable(s, ctx.skill.id));

      if (fired.length === 0) {
        ctx.log(`${actor.name} には撃ち出せる技が無い`);
        return;
      }

      const target = ctx.targets[0] || ctx.foes()[0];
      if (!target) return;

      ctx.log(`${actor.name} は ${fired.length} つの技を同時に放った！`);
      for (const skill of fired) {
        if (!actor.alive) break;
        const aim = target.alive ? target : ctx.foes()[0];
        if (!aim) break;
        // 1発ごとの威力は落とす。本数で稼ぐ技なので、単発の強さでは勝てないようにする。
        ctx.damageWith(aim, skill, { powerScale: ratio });
      }

      // 代償: 撃った本数ぶん行動できない
      const rounds = Math.max(1, Math.min(fired.length, params.maxStun == null ? 4 : params.maxStun));
      actor.stunnedRounds = (actor.stunnedRounds || 0) + rounds;
      ctx.log(`${actor.name} は反動で ${rounds} ラウンド動けない`);
    },
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
