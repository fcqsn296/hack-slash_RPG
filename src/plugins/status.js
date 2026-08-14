// @ts-check
/**
 * 状態異常の付与 (§5.8 / §9.1)。
 *
 * 既存の poison プラグインは毒だけを扱うが、こちらは data/statuses.js に
 * 載っている異常ならどれでも撒ける汎用版。新しい異常を足しても、
 * このファイルを触らずに params を書くだけで技が作れる。
 *
 * params:
 *   status   : string    付与する異常の種類（statuses  と排他）
 *   statuses : string[]  複数まとめて付与する場合
 *   turns    : number    持続ターン（呪詛・精神耐性でここから増減する）
 *   ratio    : number    強さ。意味は種類ごとに違う（data/statuses.js 参照）
 *   all      : boolean   true なら敵全体が対象
 */
(function (RPG) {
  'use strict';
  RPG.plugins.status = {
    id: 'status',
    /** @param {any} skill */
    targetKind: (skill) => (skill && skill.params && skill.params.all ? 'none' : 'enemy'),
    /** @param {any} ctx */
    execute(ctx) {
      const p = ctx.params;
      const kinds = p.statuses || [p.status];
      const targets = p.all ? ctx.foes() : ctx.targets;

      for (const target of targets) {
        if (!target.alive) continue;
        // 先にダメージを入れてから異常を乗せる。
        // 撃破できたなら異常を付ける意味がないので、生きているときだけ付与する。
        ctx.damage(target);
        if (!target.alive) continue;

        for (const kind of kinds) {
          const def = (RPG.data.statuses || {})[kind];
          if (!def) continue;
          ctx.addStatus(target, {
            kind, label: def.label, turns: p.turns || 3, ratio: p.ratio || 0.05,
            // 経過しない弱体 (§12 呪術師)。撒く技の側で明示したときだけ立つ。
            lasting: !!p.lasting,
          });
        }
      }
    },
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
