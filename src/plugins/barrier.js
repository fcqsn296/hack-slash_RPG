// @ts-check
/**
 * 魔力障壁 (§9.1)。
 *
 * ── なぜ回復と別に要るのか ──
 * 回復はHPの上限で頭打ちになる。満タンの相手に撃つと丸ごと無駄になり、
 * 「HPが減っているほど強い」構成に至っては、癒すほど本人が弱くなる。
 * 障壁はHPの外側に積むので、どちらの問題も起きない。
 *
 * 削られ方は既に戦闘エンジンが持っている（HPより先に障壁が減る）。
 * ここでやるのは「張る」ところだけ。
 *
 * params: {
 *   ratio   : number   参照ステータスに対する倍率
 *   scaling : string   'magi_power' | 'hp' | 'def' | 'atk'。省略時は技の scaling_stat
 *   party   : boolean  true なら味方全体
 * }
 *
 * 持続ターンは持たない。既にある障壁（癒しの余剰・障壁の再生・開幕の守り）が
 * どれも時間で消えない作りなので、ここだけ消えると説明がつかなくなる。
 * 強すぎるときは技側の cooldown で抑える。
 */
(function (RPG) {
  'use strict';
  RPG.plugins.barrier = {
    id: 'barrier',
    /** @param {any} skill */
    targetKind: (skill) => (skill && skill.params && skill.params.party ? 'none' : 'ally'),
    /** @param {any} ctx */
    execute(ctx) {
      const p = ctx.params;
      const stat = p.scaling || ctx.skill.scaling_stat || 'magi_power';
      const ratio = p.ratio || 1;

      // 張る側の数値で決まる。受け手の数値だと、硬い者ほど硬くなって
      // 「守る役」を用意する意味が薄れる。
      const source = (ctx.actor.stats && ctx.actor.stats[stat])
        || (stat === 'hp' ? ctx.actor.maxHp : 0);
      const amount = Math.max(1, Math.floor(source * ratio));

      const targets = p.party ? ctx.allies() : ctx.targets;
      for (const t of targets) {
        if (!t.alive) continue;
        t.shield = (t.shield || 0) + amount;
        ctx.log(`${t.name} に ${amount.toLocaleString()} の障壁`, 'buff');
      }
    },
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
