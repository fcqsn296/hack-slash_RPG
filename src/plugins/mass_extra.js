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
 *   buff        : number   乗せる固有バフの割合
 *   turns       : number   バフの持続
 *   resetCooldowns : boolean  味方全員のクールタイムを解除する (§12)
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

      let freed = 0;
      for (const ally of ctx.allies()) {
        // 行動順を戻す仕組みは battle.js の extraActions に相乗りする。
        // 上限を無視すると号令を撃つたびに手番が増え続けるので、権利は1つだけ配る。
        ally.grantedExtra = true;
        if (buff > 0) ctx.addUniqueBuff(ally, buff, turns, '号令');

        // 「刻が巻き戻る」を字義どおりにする (§12)。
        // 追加行動を配るだけでは、既に切ってしまったクラス技は戻らない。
        // 待ち時間まで巻き戻して初めて、戦術家は
        // 「自分は殴らないが、他人の一番強い手をもう一度撃たせる」役になる。
        // 自分のぶんは戻さない——号令自体を撃ち直せると際限が無くなる。
        if (ctx.params.resetCooldowns && ally !== ctx.actor) {
          const held = Object.keys(ally.cooldowns || {});
          if (held.length) {
            ally.cooldowns = {};
            freed += held.length;
          }
        }
      }
      ctx.log('刻が巻き戻る——全員がもう一度動ける！', 'buff');
      if (freed > 0) ctx.log(`待ち時間が巻き戻された（${freed}手）`, 'buff');
    },
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
