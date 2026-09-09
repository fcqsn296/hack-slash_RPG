// @ts-check
/**
 * 全体追加行動 (§12 / §9.1)。戦術家のクラス技。
 *
 * 味方全員に「このラウンドもう一度動ける」権利を配り、あわせて火力バフを乗せる。
 * 行動回数はそのまま総火力なので、クラス技のなかでも特に重い。
 * 撃った本人は既に手番を使っているぶん、実質1人ぶん損をする——
 * 「自分は殴らないが全体を押し上げる」という戦術家の役割そのものになっている。
 *
 * ── 単体版 (§9.1) ──
 * `params.single` を立てると、全員ではなく**選んだ味方1人**に配る。
 * 全体版が終盤のクラス技・固有技なのに対し、単体版はツリーの初級・中級に置ける。
 * 「誰に手番を渡すか」を選ぶぶん、配る先が1人でも役として立つ。
 *
 * `params.excludeSelf` を立てると自分には配れない。
 * これが無いと、支援役が自分に配り続けて手番を無限に増やせてしまう
 * （自分の分だけは `刻の前借り` のように代償のある形で取るべきもの）。
 *
 * params:
 *   buff        : number   乗せる固有バフの割合
 *   turns       : number   バフの持続
 *   resetCooldowns : boolean  味方全員のクールタイムを解除する (§12)
 *   single      : boolean  選んだ1人だけに配る
 *   excludeSelf : boolean  自分には配らない
 */
(function (RPG) {
  'use strict';
  RPG.plugins.mass_extra = {
    id: 'mass_extra',
    // 単体版だけ相手を選ぶ。全体版は選ばせない（対象が決まっているため）
    targetKind: (skill) => ((skill && skill.params && skill.params.single) ? 'ally' : 'none'),
    /** @param {any} ctx */
    execute(ctx) {
      const buff = ctx.params.buff || 0;
      const turns = ctx.params.turns || 2;

      // 配る相手。単体版は選ばれた1人、全体版は味方全員。
      // 単体版で対象が渡ってこなかったときは、自分以外の生存者から拾う
      // （オートが対象を決められなかった場合の保険）。
      let receivers = ctx.allies();
      if (ctx.params.single) {
        const picked = (ctx.targets || []).filter((/** @type {any} */ u) => u && u.alive);
        receivers = picked.length ? [picked[0]]
          : ctx.allies().filter((/** @type {any} */ u) => u !== ctx.actor && u.alive).slice(0, 1);
      }
      if (ctx.params.excludeSelf) {
        receivers = receivers.filter((/** @type {any} */ u) => u !== ctx.actor);
      }
      if (!receivers.length) {
        ctx.log('手番を渡せる相手がいない', 'sub');
        return;
      }

      let freed = 0;
      for (const ally of receivers) {
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
