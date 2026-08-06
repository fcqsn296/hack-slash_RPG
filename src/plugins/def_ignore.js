// @ts-check
/**
 * 防御無視攻撃 (§3.2 ステップ4 / §9.1)。
 * この一撃は防御を0として計算し、さらに指定ターンの間その対象の防御を無効化する。
 * params: { turns: number }
 */
(function (RPG) {
  'use strict';
  RPG.plugins.def_ignore = {
    id: 'def_ignore',
    targetKind: () => 'enemy',
    /** @param {any} ctx */
    execute(ctx) {
      for (const target of ctx.targets) {
        if (!target.alive) continue;
        ctx.damage(target, { ignoreDefense: true });
        if (target.alive) ctx.setDefIgnore(target, ctx.params.turns || 1);
      }
    },
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
