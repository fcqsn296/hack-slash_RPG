// @ts-check
/**
 * 毒（継続ダメージ）(§9.1)。
 * 攻撃を1回行ったあと、対象に毒を付与する。毒の解決はラウンド終了時に戦闘エンジンが行う。
 * params: { turns: number, ratio: number }  ratio は対象の最大HPに対する割合
 */
(function (RPG) {
  'use strict';
  RPG.plugins.poison = {
    id: 'poison',
    targetKind: () => 'enemy',
    /** @param {any} ctx */
    execute(ctx) {
      for (const target of ctx.targets) {
        if (!target.alive) continue;
        ctx.damage(target);
        if (target.alive) {
          ctx.addStatus(target, {
            kind: 'poison',
            label: '毒',
            turns: ctx.params.turns || 3,
            ratio: ctx.params.ratio || 0.05,
          });
        }
      }
    },
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
