// @ts-check
/**
 * 全体追加行動 (§12 / §9.1)。戦術家のクラス技。
 *
 * 味方全員に「このラウンドもう一度動ける」権利を配り、あわせて火力バフを乗せる。
 * 行動回数はそのまま総火力なので、クラス技のなかでも特に重い。
 * 撃った本人は既に手番を使っているぶん、実質1人ぶん損をする——
 * 「自分は殴らないが全体を押し上げる」という戦術家の役割そのものになっている。
 *
 * params:
 *   buff  : number  乗せる固有バフの割合
 *   turns : number  バフの持続
 */
(function (RPG) {
  'use strict';
  RPG.plugins.mass_extra = {
    id: 'mass_extra',
    targetKind: () => 'none',
    /** @param {any} ctx */
    execute(ctx) {
      const buff = ctx.params.buff || 0;
      const turns = ctx.params.turns || 2;

      for (const ally of ctx.allies()) {
        // 行動順を戻す仕組みは battle.js の extraActions に相乗りする。
        // 上限を無視すると号令を撃つたびに手番が増え続けるので、権利は1つだけ配る。
        ally.grantedExtra = true;
        if (buff > 0) ctx.addUniqueBuff(ally, buff, turns, '号令');
      }
      ctx.log('刻が巻き戻る——全員がもう一度動ける！', 'buff');
    },
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
