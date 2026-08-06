// @ts-check
/**
 * 全体蘇生 (§12 / §9.1)。癒し手のクラス技。
 *
 * 倒れた味方を全員起こし、生きている味方も回復する。
 * 無条件だと「全滅しない保険」になってしまうので、
 * 技側の readyRound / cooldown で必ず縛りをかけること (data/skills.js)。
 *
 * params:
 *   hp        : number  蘇生時のHP割合
 *   healRatio : number  生存者への回復量（魔力に対する倍率）
 */
(function (RPG) {
  'use strict';
  RPG.plugins.mass_revive = {
    id: 'mass_revive',
    targetKind: () => 'none',
    /** @param {any} ctx */
    execute(ctx) {
      const hpRatio = ctx.params.hp || 0.5;
      const healRatio = ctx.params.healRatio || 0;
      let raised = 0;

      for (const ally of ctx.battle.party) {
        if (ally.alive) continue;
        ally.alive = true;
        ally.hp = Math.max(1, Math.floor(ally.maxHp * hpRatio));
        // 復活の権利は使い切っていない扱いに戻さない。
        // ここで revived を触ると「不死鳥の理」と合わせて無限に立ち上がってしまう。
        raised++;
        ctx.log(`${ally.name} が光に包まれて起き上がった（HP ${ally.hp.toLocaleString()}）`, 'buff');
      }

      if (healRatio > 0) {
        const amount = Math.floor((ctx.actor.stats.magi_power || 0) * healRatio);
        for (const ally of ctx.allies()) ctx.heal(ally, amount);
      }

      if (raised === 0) ctx.log('倒れている者はいなかった', 'sub');
    },
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
