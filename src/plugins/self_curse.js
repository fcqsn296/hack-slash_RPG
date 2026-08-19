// @ts-check
/**
 * 自傷を糧にする一撃 (§9.1)。
 *
 * ── 何が新しいのか ──
 * ここまで、自分にかかる弱体は **例外なく損** でしかなかった。
 * 毒を受ければ削られ、呪詛を受ければ立て直せなくなる。それだけだった。
 *
 * この技は自分から弱体を被る。パッシブ `selfCursePower` と組ませると、
 * 自分にかかっている弱体の数がそのまま火力になる。
 * 符号が反転するので、**敵の弱体攻撃がこちらの燃料に変わる**。
 * 引きが悪いだけだった盤面が、有利な盤面になる。
 *
 * 呪詛（回復とHP吸収が減る）を自分に乗せると回復に頼れなくなるので、
 * 火力と引き換えに立て直しを捨てる、という取引が成立する。
 *
 * params: {
 *   statuses: string[], 自分に乗せる異常の種類
 *   turns: number,      持続ターン
 *   ratio: number,      強さ（意味は種類ごとに違う。data/statuses.js 参照）
 * }
 */
(function (RPG) {
  'use strict';
  RPG.plugins.self_curse = {
    id: 'self_curse',
    targetKind: () => 'enemy',
    /** @param {any} ctx */
    execute(ctx) {
      const p = ctx.params;
      const kinds = p.statuses || [p.status || 'curse'];

      // 先に自分を蝕む。そうしないと、この一撃自身が糧を受け取れない。
      for (const kind of kinds) {
        ctx.selfStatus(kind, p.turns || 3, p.ratio || 0.05);
      }

      for (const target of ctx.targets) {
        if (target.alive) ctx.damage(target);
      }
    },
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
