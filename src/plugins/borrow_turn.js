// @ts-check
/**
 * 手番の前借り (§9.1)。
 *
 * ── 何が新しいのか ──
 * 行動順そのものは戦闘前にプレイヤーが並び替えられるので、
 * 順番を入れ替えるだけの効果には価値が無い。
 *
 * これは順番ではなく **時間の借金** を作る。
 * いますぐもう一度動ける代わりに、次のラウンドは動けない。
 *
 * 再行動 (extraActionRate) が「確率で得をする」のに対して、
 * こちらは「確定だが後で払う」。
 * 今のラウンドで倒しきれるかどうかの読みを、撃つたびに迫ることになる。
 *
 * params: {
 *   rounds: number,     動けなくなるラウンド数
 *   powerScale: number, この一撃自体の威力倍率
 * }
 */
(function (RPG) {
  'use strict';
  RPG.plugins.borrow_turn = {
    id: 'borrow_turn',
    targetKind: () => 'enemy',
    /** @param {any} ctx */
    execute(ctx) {
      const scale = ctx.params.powerScale || 1;

      for (const target of ctx.targets) {
        if (target.alive) ctx.damage(target, { powerScale: scale });
      }

      // 敵を倒しきってウェーブが終わったなら、借金だけ残しても意味がない。
      // 生きている相手がいるときだけ前借りする。
      if (ctx.foes().length === 0) {
        ctx.log('前借りする相手がいない', 'sub');
        return;
      }
      ctx.borrowTurn(ctx.params.rounds || 1);
    },
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
