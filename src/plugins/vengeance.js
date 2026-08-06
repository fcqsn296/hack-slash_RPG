// @ts-check
/**
 * 報復 (§5.8 / §9.1)。
 *
 * 被弾した回数がそのまま威力になる。「痛みの記憶」(§5.7) や「鏡面」と同じく、
 * **殴られることを前提にしたビルド**の切り札として置いてある。
 * 開幕は最弱で、長引くほど重くなる。
 *
 * params:
 *   perHit   : number  被弾1回あたりの威力上乗せ（0.35 = +35%）
 *   maxBonus : number  上乗せの上限（5 なら最大6倍）
 */
(function (RPG) {
  'use strict';
  RPG.plugins.vengeance = {
    id: 'vengeance',
    targetKind: () => 'enemy',
    /** @param {any} ctx */
    execute(ctx) {
      const perHit = ctx.params.perHit || 0.3;
      const maxBonus = ctx.params.maxBonus || 5;
      const bonus = Math.min(maxBonus, (ctx.actor.hitsTaken || 0) * perHit);

      if (bonus > 0) {
        ctx.log(`これまでの痛みが乗る（×${(1 + bonus).toFixed(1)}）`, 'buff');
      }
      for (const target of ctx.targets) {
        if (target.alive) ctx.damage(target, { powerScale: 1 + bonus });
      }
    },
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
