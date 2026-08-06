// @ts-check
/**
 * 多段ヒット (§9.1)。
 * params: { hits: number }
 * 各ヒットは独立にクリティカル判定・ランダム係数を引く。
 */
(function (RPG) {
  'use strict';
  RPG.plugins.multi_hit = {
    id: 'multi_hit',
    /** @param {any} skill */
    targetKind: (skill) => 'enemy',
    /** @param {any} ctx */
    execute(ctx) {
      const hits = ctx.params.hits || 2;
      for (let i = 0; i < hits; i++) {
        const target = ctx.targets.find((/** @type {any} */ t) => t.alive) || ctx.foes()[0];
        if (!target) break;
        ctx.log(`${i + 1}撃目`, 'sub');
        ctx.damage(target);
      }
    },
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
