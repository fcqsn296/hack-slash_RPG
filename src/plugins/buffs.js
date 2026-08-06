// @ts-check
/**
 * バフ系プラグイン (§3.2 ステップ3 / §9.1)。
 *
 * unique_buff : 固有ユニークバフ。すべて独立した別枠で乗算される。
 * tag_buff    : 共通バフ。同系統タグの装備補正に加算される。
 * def_buff    : 防御力そのものを倍化する。
 */
(function (RPG) {
  'use strict';

  /**
   * 対象（自分だけ / 味方全体）を解決する。
   * @param {any} ctx
   */
  function resolveTargets(ctx) {
    return ctx.params.party ? ctx.allies() : [ctx.actor];
  }

  RPG.plugins.unique_buff = {
    id: 'unique_buff',
    targetKind: () => 'none',
    /** @param {any} ctx */
    execute(ctx) {
      for (const target of resolveTargets(ctx)) {
        ctx.addUniqueBuff(target, ctx.params.value, ctx.params.turns, ctx.params.label || '固有バフ');
      }
    },
  };

  RPG.plugins.tag_buff = {
    id: 'tag_buff',
    targetKind: () => 'none',
    /** @param {any} ctx */
    execute(ctx) {
      for (const target of resolveTargets(ctx)) {
        ctx.addTagBuff(target, ctx.params.tag, ctx.params.value, ctx.params.turns, ctx.params.label || '共通バフ');
      }
    },
  };

  RPG.plugins.def_buff = {
    id: 'def_buff',
    targetKind: () => 'none',
    /** @param {any} ctx */
    execute(ctx) {
      for (const target of resolveTargets(ctx)) {
        ctx.addDefBuff(target, ctx.params.value, ctx.params.turns, ctx.params.label || '防御強化');
      }
    },
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
