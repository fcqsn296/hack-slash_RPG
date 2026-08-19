// @ts-check
/**
 * 刻印を刻む一撃 (§9.1)。
 *
 * ── 何が新しいのか ──
 * 遅れて入るダメージは既に2種類あるが、どちらも **時間で進む**。
 *   毒   … ラウンドが終わるたびに1刻み
 *   残響 … Nターン後に炸裂
 * つまり待てば進むので、手数を増やしても早くはならない。
 *
 * 刻印は **殴った回数で進む**。溜まりきると弾ける。
 * 多段ヒットや小技連打が、1発の軽さをそのままにして報われる道になる。
 *
 * 起爆 (detonate) が「既にある毒を現金化する」のに対して、
 * こちらは「何も無いところに積む」ので役割が被らない。
 *
 * params: {
 *   ratio: number,  炸裂したとき、相手の最大HPの何割を入れるか
 *   count: number,  この技1回で積む数
 * }
 */
(function (RPG) {
  'use strict';
  RPG.plugins.sigil_strike = {
    id: 'sigil_strike',
    targetKind: () => 'enemy',
    /** @param {any} ctx */
    execute(ctx) {
      const ratio = ctx.params.ratio || 0.06;
      const count = ctx.params.count || 2;

      for (const target of ctx.targets) {
        if (!target.alive) continue;
        ctx.damage(target);
        if (!target.alive) continue;
        ctx.addSigil(target, ratio, count);
      }
    },
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
