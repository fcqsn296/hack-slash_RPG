// @ts-check
/**
 * 生命代償の一撃 (§9.1)。
 *
 * 自分のHPを支払い、支払った量に応じて威力が跳ね上がる。
 * 「背水（HPが低いほど強い）」や「吸命」と組み合わせると噛み合う。
 *
 * params: {
 *   costRatio: number,  支払う現在HPの割合
 *   perHp: number,      支払ったHP1につき上乗せする威力（%）
 *   maxBonus: number,   威力の上乗せ上限（倍率）
 * }
 */
(function (RPG) {
  'use strict';
  RPG.plugins.hp_cost = {
    id: 'hp_cost',
    targetKind: () => 'enemy',
    /** @param {any} ctx */
    execute(ctx) {
      const costRatio = ctx.params.costRatio || 0.3;
      // 自滅しないよう、必ずHPは1残す
      const cost = Math.max(1, Math.min(ctx.actor.hp - 1, Math.floor(ctx.actor.hp * costRatio)));
      if (cost <= 0) {
        ctx.log(`${ctx.actor.name} は代償を払えなかった`, 'info');
        return;
      }

      ctx.actor.hp -= cost;
      ctx.log(`${ctx.actor.name} は ${cost.toLocaleString()} HPを代償に捧げた`, 'debuff');

      // 支払ったHPが多いほど威力が伸びる（上限あり）
      const perHp = ctx.params.perHp || 0.0015;
      const bonus = Math.min(ctx.params.maxBonus || 4, cost * perHp);

      for (const target of ctx.targets) {
        if (target.alive) ctx.damage(target, { powerScale: 1 + bonus });
      }
    },
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
