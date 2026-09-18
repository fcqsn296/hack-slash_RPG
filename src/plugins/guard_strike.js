// @ts-check
/**
 * 張りながら殴る (§9.1)。
 *
 * ── なぜ「攻撃」と「障壁」を1つの技にするのか ──
 * 障壁は火力に一切つながらないので、張る手番はそのまま殴らない手番になる。
 * 終盤では1手の火力が 653,104 に達するのに対し、198% まで積んだ
 * 4人ぶんの障壁でも 231,768 しかなく、**張るという選択が成立しない**。
 *
 * 1つの手番で両方を済ませられれば、その対価が消える。
 * 割合を控えめにしても、殴りながら積めること自体に価値が出る。
 *
 * `shield_power`（障壁を火力へ変える）と組み合わせると、
 * 張る → 火力が上がる → さらに張る、という往復ができる。
 * 上限は damage.js の SHIELD_POWER_CAP が止める。
 *
 * params: {
 *   ratio   : number   障壁の量。参照ステータスに対する倍率
 *   scaling : string   'magi_power' | 'hp' | 'def' | 'atk'。省略時は技の scaling_stat
 *   party   : boolean  true なら味方全体に張る（既定は自分だけ）
 * }
 *
 * 障壁の量は **barrier と同じく張る側の数値**で決まる。受け手の数値だと、
 * 硬い者ほど硬くなって守る役を用意する意味が薄れる。
 * 厚みのパッシブは battle.js の grantShield が掛けるので、ここでは掛けない。
 */
(function (RPG) {
  'use strict';
  RPG.plugins.guard_strike = {
    id: 'guard_strike',
    targetKind: () => 'enemy',
    /** @param {any} ctx */
    execute(ctx) {
      const p = ctx.params || {};

      // 先に殴る。**順番に意味がある**——後から張ると、
      // その一撃には自分の障壁が乗らない（shield_power は攻撃時の障壁を読む）。
      // 「殴ってから固める」ほうが、張り直しの判断とも噛み合う。
      for (const target of ctx.targets) {
        if (!target.alive) continue;
        ctx.damage(target);
      }

      const stat = p.scaling || ctx.skill.scaling_stat || 'magi_power';
      const source = (ctx.actor.stats && ctx.actor.stats[stat])
        || (stat === 'hp' ? ctx.actor.maxHp : 0);
      const amount = Math.max(1, Math.floor(source * (p.ratio || 0.2)));

      const targets = p.party ? ctx.allies() : [ctx.actor];
      for (const t of targets) {
        if (!t.alive) continue;
        const gain = RPG.battle.grantShield(t, amount, ctx.actor);
        ctx.log(`${t.name} に ${gain.toLocaleString()} の障壁`, 'buff');
      }
    },
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
