// @ts-check
/**
 * 迎撃の構え (§9.1)。
 *
 * 数ラウンドのあいだ、殴られるたびに必ず反撃する。
 *
 * ── パッシブの反撃との違い ──
 * 「返す刃」（counterRate）は確率で、着けっぱなしの常時効果。
 * こちらは自分で構える手番を払う代わりに **必ず返る**。
 * 殴られる回数が読める場面——敵が多い、全体攻撃が来ると分かっている——
 * でだけ強い、という形にしてある。
 *
 * 防御で耐える道 (§5.8) との噛み合いが要点で、
 * 硬さは「耐える」ためのものだったが、これがあると「返す」ための資源になる。
 *
 * params: {
 *   turns       : number  構えが続くラウンド数
 *   reduction   : number  構えている間の被ダメージ軽減
 *   counterSkill: string  反撃に使う技ID。省略すると手持ちから拾う
 * }
 */
(function (RPG) {
  'use strict';
  RPG.plugins.counter_stance = {
    id: 'counter_stance',
    targetKind: () => 'none',
    /** @param {any} ctx */
    execute(ctx) {
      const p = ctx.params;
      const turns = p.turns || 2;

      // 反撃技が実在するかをここで見る。
      // 無いIDのまま構えると、殴られても何も起きない技になる。
      let skillId = p.counterSkill || null;
      if (skillId && !RPG.data.skills[skillId]) {
        ctx.log(`反撃技 ${skillId} が見つからないので、手持ちから選ぶ`, 'sub');
        skillId = null;
      }

      ctx.actor.stance = {
        // 自分の手番の終わりに1つ減るので、ここは指定どおりでよい
        turns,
        reduction: p.reduction || 0,
        skillId,
      };

      const guard = p.reduction
        ? `被ダメージ -${Math.round(p.reduction * 100)}%` : '';
      ctx.log(`${ctx.actor.name} が迎撃の構えを取った（${turns}ラウンド`
        + (guard ? ' / ' + guard : '') + '）', 'buff');
    },
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
