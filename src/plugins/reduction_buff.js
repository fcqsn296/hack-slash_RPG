// @ts-check
/**
 * 被ダメージ軽減バフ (§3.1-3 / §9.1)。
 *
 * 装備・スキルツリー・このバフの軽減率は加算され、合計1.0に達すると
 * 被ダメージが0になる（＝無敵）。「複数の軽減手段を組み合わせて無敵を作る」ための一角。
 *
 * params: { value: number, turns: number, party: boolean, label: string }
 */
(function (RPG) {
  'use strict';
  RPG.plugins.reduction_buff = {
    id: 'reduction_buff',
    targetKind: () => 'none',
    /** @param {any} ctx */
    execute(ctx) {
      const targets = ctx.params.party ? ctx.allies() : [ctx.actor];
      for (const target of targets) {
        ctx.addReductionBuff(target, ctx.params.value, ctx.params.turns, ctx.params.label || '軽減');
      }
    },
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
