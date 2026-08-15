// @ts-check
/**
 * コンボの締め (§9.1)。
 *
 * 積んだ弱点コンボを全部使い切って、一撃に変える。
 *
 * ── なぜ「締め」が要るのか ──
 * コンボは段数に応じて全員の火力を底上げするが、上限が近い。
 * 積み切った後は、それ以上積んでも意味が無く、
 * **手数で押す構成には「ここで勝つ」という瞬間が無かった**。
 * 使い切る手を1つ置くと、積む作業に終着点ができる。
 *
 * コンボはパーティ共有の資源なので、これを撃つと **味方全員の底上げも消える**。
 * そこが値段になっている。撃つ順番（他の全員が殴った後か、前か）が
 * そのまま判断になる。
 *
 * params: {
 *   perCombo : number  1段あたりの威力上乗せ（0.3 なら 1段 +30%）
 *   maxRatio : number  上乗せの上限（5.0 なら最大6倍）
 *   consume  : boolean 段数を0に戻すか。既定は true
 * }
 */
(function (RPG) {
  'use strict';
  RPG.plugins.combo_finish = {
    id: 'combo_finish',
    targetKind: () => 'enemy',
    /** @param {any} ctx */
    execute(ctx) {
      const p = ctx.params;
      const per = p.perCombo || 0.25;
      const max = p.maxRatio == null ? 4 : p.maxRatio;
      const consume = p.consume !== false;

      // 段数は上限を超えて溜まらないので、そのまま読んでよい。
      const count = Math.min(
        RPG.battle.comboMax(ctx.battle),
        (ctx.battle.combo && ctx.battle.combo.count) || 0
      );
      const bonus = Math.min(max, count * per);
      const scale = 1 + bonus;

      if (count > 0) {
        ctx.log(`コンボ ${count} 段を解き放つ（威力 ×${scale.toFixed(2)}）`, 'buff');
      } else {
        ctx.log('コンボが無いので、ただの一撃になった', 'sub');
      }

      for (const target of ctx.targets) {
        if (!target.alive) continue;
        ctx.damage(target, { powerScale: scale });
      }

      // 使い切る。ここを消し忘れると「積みっぱなしで毎ターン最大倍率」になる。
      if (consume && ctx.battle.combo) {
        ctx.battle.combo.count = 0;
        ctx.battle.combo.reason = '解き放った';
      }
    },
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
