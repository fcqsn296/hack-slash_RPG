// @ts-check
/**
 * 病禍の拡散 (§9.1)。
 *
 * 殴った相手にかかっている弱体を、残りの敵全員へ写す。
 *
 * ── 「疫病の広がり」との違い ──
 * パッシブの「疫病の広がり」は、**撒いた瞬間に確率で隣へ飛ぶ**。
 * こちらは既にかかっているものを後からまとめて写す。
 * 順番が逆なので、噛み合う相手が違う:
 *   ・広がり … 撒く技を撃つたびに少しずつ広がる。全体化は運任せ
 *   ・拡散   … 1体に丁寧に盛ってから、確実に全体へ配る
 * 6種を撒き分ける構成や、起爆 (§5.8) で刈り取る構成の前段になる。
 *
 * params: {
 *   turns : number  写したあとの持続。省略時は元の残りターンを引き継ぐ
 * }
 */
(function (RPG) {
  'use strict';
  RPG.plugins.pandemic = {
    id: 'pandemic',
    targetKind: () => 'enemy',
    /** @param {any} ctx */
    execute(ctx) {
      for (const target of ctx.targets) {
        if (!target.alive) continue;
        if (ctx.skill.power > 0) ctx.damage(target);
        if (!target.alive) continue;

        // 写す前に控える。addStatus は相手の statusEffects を触るので、
        // 走査しながら配ると自分が足したものまで拾ってしまう。
        const carried = RPG.battle.debuffsOn(target)
          .map((/** @type {any} */ e) => Object.assign({}, e));
        if (!carried.length) {
          ctx.log('写すものが無かった', 'sub');
          continue;
        }

        const others = ctx.foes().filter((/** @type {any} */ u) => u !== target && u.alive);
        if (!others.length) continue;

        let count = 0;
        for (const other of others) {
          for (const e of carried) {
            ctx.addStatus(other, {
              kind: e.kind,
              label: e.label,
              turns: ctx.params.turns || e.turns,
              ratio: e.ratio,
              // 写したものが更に伝染すると、1手で盤面が埋まってしまう
              spread: true,
              lasting: e.lasting,
            });
            count++;
          }
        }
        ctx.log(`${target.name} の病が ${others.length} 体へ広がった（${count}件）`, 'debuff');
      }
    },
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
