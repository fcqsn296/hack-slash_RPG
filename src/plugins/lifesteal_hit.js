// @ts-check
/**
 * 吸収攻撃 (§9.1)。
 * 与えたダメージの一部を自分のHPへ還元する。
 * パッシブの吸命とは別枠で、この技を撃ったときだけ発生する。
 * params: { ratio: number }
 */
(function (RPG) {
  'use strict';
  RPG.plugins.lifesteal_hit = {
    id: 'lifesteal_hit',
    targetKind: () => 'enemy',
    /** @param {any} ctx */
    execute(ctx) {
      const ratio = ctx.params.ratio || 0.3;
      let total = 0;
      for (const target of ctx.targets) {
        if (!target.alive) continue;
        total += ctx.damage(target).damage;
      }
      if (total > 0 && ctx.actor.alive && ctx.actor.hp < ctx.actor.maxHp) {
        ctx.heal(ctx.actor, total * ratio);
      }
    },
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
