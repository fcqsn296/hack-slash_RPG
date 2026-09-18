// @ts-check
/**
 * 染色 — 敵の属性を塗り替える (§9.1)。
 *
 * ── なぜ要るのか ──
 * 攻撃側の属性操作は**すでにツリーが埋め尽くしている**。
 *
 *   element_convert  自分の全攻撃を1属性に固定する
 *   dual_element     2属性で判定して良い方を取る
 *   element_adapt    不利を等倍まで引き上げる
 *   element_mastery  特定属性の有利倍率を伸ばす
 *   element_pierce   不利属性の目減りを減らす
 *
 * 一方で、**受け側の属性に触る手段が1つも無かった**。ここが構造的に空いている。
 * 属性特化ビルドは「刺さらないフィールド」で腐るという弱点を抱えているが、
 * 染色があればその弱点を**連れて行く仲間で補える**。
 *
 * ── 塗るのは「受ける側の属性」だけ ──
 * **ここを両方向にすると調整が破綻する。**
 * 敵の属性は、こちらの攻撃の通り方と、こちらが受ける被害の両方を決めている。
 * 両方を塗ると有利不利が二重に動き、1手の価値が場面によって跳ね上がる。
 *
 * だから染色が変えるのは「その相手を殴るときの相性」だけ。
 * 敵の攻撃は塗る前の属性のまま飛んでくる。
 * 闘技場の elementNull が相性を一方向にだけ均しているのと同じ立ち位置。
 *
 * ── 単体・短ターンにする理由 ──
 * 全体化すると属性特化がそのまま万能になる。単体で短く保つことで、
 * 「どの1体をいつ染めるか」という判断が残る。
 *
 * ── 既定は「自分の属性が食う色」 ──
 * **ここを取り違えると効果が逆になる。** 一度「撃った本人の属性」にしていて、
 * 火のパーティが相手を火に染めていた。火で火を殴っても有利は取れない。
 * 実測でボス戦が 14.25R → 15.20R と、染めたほうが遅くなっていた。
 *
 * 染めたいのは **自分が有利を取れる側の色**。火なら風へ染める。
 * `STRONG_AGAINST` を引けば一意に決まるので、技ごとに書かせない。
 *
 * params: {
 *   element : string   塗る属性。省略すると**本人の属性が有利を取れる色**になる
 *   turns   : number   持続ターン
 * }
 */
(function (RPG) {
  'use strict';
  RPG.plugins.dye = {
    id: 'dye',
    targetKind: () => 'enemy',
    /** @param {any} ctx */
    execute(ctx) {
      const p = ctx.params || {};
      const turns = p.turns || 2;

      for (const target of ctx.targets) {
        if (!target.alive) continue;
        // 先に殴ってから染める。倒しきれたなら染める意味がない（mark と同じ順）。
        if (ctx.skill.power > 0) ctx.damage(target);
        if (!target.alive) continue;

        // 省略時は「自分の属性が食う色」。自分の属性そのものにすると、
        // 火で火を殴る形になって**有利どころか何も起きない**（実際に踏んだ）。
        const mine = (ctx.actor.elementMods && ctx.actor.elementMods.convert)
          || ctx.actor.element;
        const prey = (RPG.damage.STRONG_AGAINST[mine] || [])[0];
        const element = p.element || prey;
        if (!element) {
          // 無属性には食う相手がいない。染める先が決まらないので何もしない。
          ctx.log(`${ctx.actor.name} には染める色が無い`, 'sub');
          continue;
        }
        const label = RPG.damage.ELEMENT_LABEL[element] || element;
        if (RPG.battle.dye(target, element, turns, ctx.actor)) {
          ctx.log(`${target.name} が ${label} に染まった`, 'debuff');
        } else {
          ctx.log(`${target.name} は既に ${label} に染まっている`, 'sub');
        }
      }
    },
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
