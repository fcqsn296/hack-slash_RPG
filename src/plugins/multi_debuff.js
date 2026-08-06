// @ts-check
/**
 * 多重デバフ (§9.1)。
 * 一度に複数の弱体化を叩き込む。「追撃（デバフ中の敵に威力上昇）」との相性が良い。
 *
 * params: {
 *   turns: number,        効果ターン数
 *   defIgnore: boolean,   防御を崩す
 *   poison: number,       毒の割合（0なら付与しない）
 *   statuses: string[],   追加で付ける状態異常のラベル
 * }
 */
(function (RPG) {
  'use strict';
  RPG.plugins.multi_debuff = {
    id: 'multi_debuff',
    targetKind: () => 'enemy',
    /** @param {any} ctx */
    execute(ctx) {
      const turns = ctx.params.turns || 3;
      for (const target of ctx.targets) {
        if (!target.alive) continue;

        if (ctx.skill.power > 0) ctx.damage(target);
        if (!target.alive) continue;

        if (ctx.params.defIgnore) ctx.setDefIgnore(target, turns);
        if (ctx.params.poison) {
          ctx.addStatus(target, { kind: 'poison', label: '毒', turns, ratio: ctx.params.poison });
        }
        for (const label of ctx.params.statuses || []) {
          ctx.addStatus(target, { kind: 'weaken', label, turns });
        }
      }
    },
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
