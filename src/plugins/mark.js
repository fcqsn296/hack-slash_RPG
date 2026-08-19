// @ts-check
/**
 * 標的指定（マーク）(§9.1)。
 *
 * ── 何が新しいのか ──
 * これまでの火力補正は、例外なく **殴る側が何を持っているか** で決まっていた。
 * 支援役にできることは回復・バフ・弱体のどれかで、いずれも「味方に何かする」形。
 *
 * マークは印を **敵に置く**。付けた本人ではなく、その相手を殴る味方全員が強くなる。
 * 一人の1手が他の味方の手を良くする、という形はこれが初めてになる。
 * おかげで、火力を持たない支援キャラでも火力に貢献できる。
 *
 * 効果は targetPower() が読む。付けた陣営だけが恩恵を受けるので、
 * 敵が味方に印を付ければ、敵側が束になって殴ってくる形になる。
 *
 * params: {
 *   value: number,  印の付いた相手への火力上昇（0.3 = +30%）
 *   turns: number,  持続ターン
 *   label: string,  ログとUIに出す名前
 *   all: boolean,   true なら敵全体に付ける（value は下げること）
 * }
 */
(function (RPG) {
  'use strict';
  RPG.plugins.mark = {
    id: 'mark',
    /** @param {any} skill */
    targetKind: (skill) => (skill && skill.params && skill.params.all ? 'none' : 'enemy'),
    /** @param {any} ctx */
    execute(ctx) {
      const p = ctx.params;
      const label = p.label || '刻印';
      const targets = p.all ? ctx.foes() : ctx.targets;

      for (const target of targets) {
        if (!target.alive) continue;
        // 先に殴ってから印を付ける。倒しきれたなら印に意味がない。
        if (ctx.skill.power > 0) ctx.damage(target);
        if (!target.alive) continue;
        ctx.mark(target, p.value || 0.3, p.turns || 2, label);
      }
    },
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
