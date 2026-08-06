// @ts-check
/**
 * 回復 (§9.1)。
 * 回復量は「参照ステータス × 威力倍率」で求める。属性相性や防御は関与しない。
 * params: { party: boolean }  true なら味方全体
 */
(function (RPG) {
  'use strict';
  RPG.plugins.heal = {
    id: 'heal',
    /** @param {any} skill */
    targetKind: (skill) => (skill.params && skill.params.party ? 'none' : 'ally'),
    /** @param {any} ctx */
    execute(ctx) {
      const stat = ctx.actor.stats[ctx.skill.scaling_stat] || 0;
      const amount = stat * (ctx.skill.power / 100);
      const targets = ctx.params.party ? ctx.allies() : ctx.targets;
      for (const target of targets) {
        if (target.alive) ctx.heal(target, amount);
      }
    },
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
