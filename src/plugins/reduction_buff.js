// @ts-check
/**
 * 被ダメージ軽減バフ (§3.1-3 / §9.1)。
 *
 * 装備・スキルツリー・このバフの軽減率は加算され、合計1.0に達すると
 * 被ダメージが0になる（＝無敵）。「複数の軽減手段を組み合わせて無敵を作る」ための一角。
 *
 * ── なぜクールダウンが要るのか ──
 * 切れる直前に撃ち直せば、1人で永久に無敵を維持できてしまう。
 * そこで **クールダウンを持続ターン数より1だけ長く** 取ってある。
 * 1人で回すと必ず1ラウンドの隙が空き、複数人で受け渡せば繋がる。
 *
 * 「4人で軽減技をリレーして、攻撃はできないがずっと無敵」は許容する。
 * 攻撃の手を全部捨てているので、相応の代償を払っている。
 * 固有で軽減技を持つキャラを使えば枠を1つ空けられ、
 * 攻撃役を混ぜられる——という編成の駆け引きが生まれる。
 *
 * 攻撃技にはクールダウンを入れていない。実測では、終盤の大技は
 * ダメージ上限に潰されて中技の1.9倍しか出ておらず、
 * そこに待ち時間を足すと選ぶ理由が消えるため (§3.2 ステップ8)。
 *
 * params: { value: number, turns: number, party: boolean, label: string }
 * skill.cooldown: 撃つと このラウンド数だけ使えない
 */
(function (RPG) {
  'use strict';
  RPG.plugins.reduction_buff = {
    id: 'reduction_buff',
    targetKind: () => 'none',
    /** @param {any} ctx */
    execute(ctx) {
      const targets = ctx.params.party ? ctx.allies() : [ctx.actor];
      for (const target of targets) {
        ctx.addReductionBuff(target, ctx.params.value, ctx.params.turns, ctx.params.label || '軽減');
      }
    },
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
