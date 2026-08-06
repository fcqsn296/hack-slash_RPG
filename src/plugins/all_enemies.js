// @ts-check
/**
 * 全体攻撃 (§9.1)。
 * 生存している敵すべてを巻き込む。単体技より威力は控えめ。
 * params: { hits?: number }  指定すれば全体に多段
 */
(function (RPG) {
  'use strict';
  RPG.plugins.all_enemies = {
    id: 'all_enemies',
    // 全員が対象なので選択は不要
    targetKind: () => 'none',
    /** @param {any} ctx */
    execute(ctx) {
      const hits = ctx.params.hits || 1;
      for (let i = 0; i < hits; i++) {
        const foes = ctx.foes();
        if (foes.length === 0) break;
        if (hits > 1) ctx.log(`${i + 1}波目`, 'sub');
        for (const target of foes) {
          if (target.alive) ctx.damage(target);
        }
      }
    },
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
