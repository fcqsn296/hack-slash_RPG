// @ts-check
/**
 * 起爆 (§9.1)。
 *
 * 対象にかかっている弱体をすべて消し飛ばし、
 * 継続ダメージの **残りターンぶん** を一度に叩き出す。
 *
 * 継続ダメージは1刻みが相手の最大HPの数%あり、数字としては弱くない。
 * 弱いのは速さのほうで、戦闘が3〜5ラウンドで終わるため満期まで待てない。
 * この技は、その待ち時間を「弱体を全部失う」という代償に置き換える。
 *
 * params: {
 *   all: boolean   … 敵全体を起爆する（威力は下げてある）
 * }
 */
(function (RPG) {
  'use strict';
  RPG.plugins.detonate = {
    id: 'detonate',
    /** @param {any} skill */
    targetKind: (skill) => (skill && skill.params && skill.params.all ? 'none' : 'enemy'),
    /** @param {any} ctx */
    execute(ctx) {
      let hit = 0;
      const targets = ctx.params.all ? ctx.foes() : ctx.targets;
      for (const target of targets) {
        if (!target.alive) continue;

        // 先に殴る。起爆だけの技にすると、弱体が乗っていない相手に撃ったとき
        // コマンドが完全な空振りになる。
        if (ctx.skill.power > 0) ctx.damage(target);
        if (!target.alive) continue;

        const r = ctx.detonate(target);
        if (r.dealt > 0) hit++;
      }
      if (hit === 0) ctx.log('弾けるものが無かった', 'sub');
    },
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
