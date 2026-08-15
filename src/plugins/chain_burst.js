// @ts-check
/**
 * 連鎖跳弾 (§9.1)。
 *
 * 敵から敵へ跳ねながら殴る。単体技と全体技のあいだを埋める。
 *
 * ── なぜ中間が要るのか ──
 * 単体技は敵が3体並ぶと1/3しか削れず、全体技は1体しかいないと威力が低いだけ。
 * どちらも「敵が2〜3体」という一番多い場面で噛み合わない。
 * 跳弾はそこに山が来る。
 *
 * ── 「連鎖の心得」との違い ──
 * パッシブの chain は、単体技を撃ったときに **おまけで** 隣へ飛ぶ。
 * こちらは跳ぶことが技の本体で、回数と減衰を技側で決められる。
 *
 * params: {
 *   chains : number  最大の跳弾回数（1発目を含む）
 *   decay  : number  1回跳ぶごとに落ちる割合。0.1 なら 1.0 → 0.9 → 0.81 …
 *   bonus  : number  decay の逆。跳ぶほど伸びる。両方書いたら decay を優先
 * }
 *
 * 敵が足りなければ、同じ相手へ跳び返る。1体しかいないときに
 * 空振りにすると「敵が減ると弱くなる技」になり、掃除の終盤で腐る。
 */
(function (RPG) {
  'use strict';
  RPG.plugins.chain_burst = {
    id: 'chain_burst',
    targetKind: () => 'enemy',
    /** @param {any} ctx */
    execute(ctx) {
      const chains = Math.max(1, ctx.params.chains || 3);
      const decay = ctx.params.decay;
      const bonus = ctx.params.bonus || 0;

      let current = ctx.targets[0];
      if (!current) return;

      let scale = 1;
      for (let i = 0; i < chains; i++) {
        const foes = ctx.foes();
        if (!foes.length) break;

        // 倒れていたら別の相手へ跳ぶ。過剰ダメージで途中終了しない。
        if (!current || !current.alive) current = foes[0];

        if (i > 0) ctx.log(`${i + 1}段目 → ${current.name}`, 'sub');
        ctx.damage(current, { powerScale: scale });

        scale *= decay != null ? (1 - decay) : (1 + bonus);

        // 次の跳び先。まだ立っている別の敵を選ぶ。
        const rest = ctx.foes().filter((/** @type {any} */ u) => u !== current);
        current = rest.length ? RPG.rng.pick(rest) : ctx.foes()[0];
      }
    },
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
