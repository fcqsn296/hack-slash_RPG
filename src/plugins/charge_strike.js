// @ts-check
/**
 * 溜め (§9.1)。
 *
 * その手番は殴らず、次の1発を大きくする。
 *
 * ── 何と釣り合っているか ──
 * 手番を1つ捨てるので、次の一撃が2倍でようやく損得なし。
 * それより上に置いて初めて選ぶ理由が生まれるが、
 * 上げすぎると「常に溜めてから撃つ」のが最善手になり、
 * 手番のやりくりという判断そのものが消える。
 *
 * 噛み合う相手がはっきりしている:
 *   ・追加行動（刻の号令 §12）… 溜めた直後にもう一度動ける
 *   ・上限突破 … 溜めた一撃は上限に当たりやすいので、突破の価値が跳ね上がる
 *   ・弱点コンボ … 段を積んでから解き放つ
 *
 * params: {
 *   ratio    : number  次の攻撃の威力倍率
 *   critRate : number  次の攻撃の会心率に足す（省略可）
 *   capBreak : number  次の攻撃の上限突破に足す（省略可）
 *   turns    : number  何ラウンド持つか。省略時は使うまで消えない
 * }
 *
 * 消費は battle.js 側。攻撃1回で使い切り、反撃や跳弾には乗らない。
 */
(function (RPG) {
  'use strict';
  RPG.plugins.charge_strike = {
    id: 'charge_strike',
    targetKind: () => 'none',
    /** @param {any} ctx */
    execute(ctx) {
      const p = ctx.params;
      const ratio = p.ratio || 2;

      // 重ねがけは許さない。2回溜めれば2倍の2倍、という積み方ができると
      // 「敵を無視して溜め続ける」が成立してしまう。
      if (ctx.actor.charge) {
        ctx.log(`${ctx.actor.name} は既に溜めている`, 'sub');
        return;
      }

      ctx.actor.charge = {
        ratio,
        critRate: p.critRate || 0,
        capBreak: p.capBreak || 0,
      };

      const parts = [`威力 ×${ratio}`];
      if (p.critRate) parts.push(`会心 +${Math.round(p.critRate * 100)}%`);
      if (p.capBreak) parts.push(`上限突破 +${Math.round(p.capBreak * 100)}%`);
      ctx.log(`${ctx.actor.name} が力を溜めた（次の一撃: ${parts.join(' / ')}）`, 'buff');
    },
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
