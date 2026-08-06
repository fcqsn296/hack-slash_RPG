// @ts-check
/**
 * 報酬の経済まわり (§10.1 の拡張)。
 *
 * ここは純関数だけを置く。セーブにもDOMにも触らない。
 *
 * ── なぜこのモジュールが要るか ──
 * 元の実装は「ゴールドは人数割りしない／経験値だけ人数割りする」という非対称性を持っていた。
 * その結果、周回するほどゴールドだけが余り、レベルはいつまでも上がらない状態になっていた。
 * 報酬の決定をこの1ファイルに集約して、両者を同じ土俵で調整できるようにする。
 */
(function (RPG) {
  'use strict';

  /**
   * 経験値の人数割りの緩さ。
   * 0 なら完全山分け（4人で1/4）、1 なら人数に関係なく全額。
   * パーティを組むこと自体が育成の足枷になるのを避けたいので、緩めに取る。
   */
  const EXP_SPLIT_SOFTNESS = 0.7;

  /**
   * 全ての行動を自分で選んで勝ったときの上乗せ。
   * 「オートを罰する」のではなく「手動を優遇する」形にしてある。
   */
  const MANUAL_BONUS = { gold: 0.5, exp: 0.5 };

  /**
   * 経験値の分配。
   *
   * 分母は 1 + (人数-1) × (1 - softness)。
   * softness=0.7 のとき4人パーティの分母は 1.9 なので、1人あたり全体の約53%を受け取る。
   * （旧実装は 1/4 = 25%）
   *
   * @param {number} total パーティ全体で得た経験値
   * @param {number} partySize
   * @returns {number} 1人あたりの経験値
   */
  function expShare(total, partySize) {
    const n = Math.max(1, Math.floor(partySize));
    const divisor = 1 + (n - 1) * (1 - EXP_SPLIT_SOFTNESS);
    return Math.ceil(total / divisor);
  }

  /**
   * その戦闘が「全て手動」だったか。
   * オートに一度でも任せたらボーナスは付かない。判定を単純にして抜け道を作らないため。
   * @param {any} battle
   */
  function wasManual(battle) {
    if (!battle || !battle.inputs) return false;
    return battle.inputs.auto === 0 && battle.inputs.manual > 0;
  }

  /**
   * 戦闘結果から実際に付与する報酬を確定する。
   * battle.rewards（ウェーブごとに素の値を積んだもの）は書き換えない。
   *
   * @param {any} battle
   * @param {{partySize: number}} opts
   * @returns {{gold: number, exp: number, expEach: number, boxes: Record<string, number>,
   *            manual: boolean, bonus: number}}
   */
  function payout(battle, opts) {
    const base = battle.rewards;
    const manual = wasManual(battle);
    const goldRate = 1 + (manual ? MANUAL_BONUS.gold : 0);
    const expRate = 1 + (manual ? MANUAL_BONUS.exp : 0);

    const gold = Math.floor(base.gold * goldRate);
    const exp = Math.floor(base.exp * expRate);

    return {
      gold,
      exp,
      expEach: expShare(exp, opts.partySize),
      boxes: base.boxes,
      manual,
      // 表示用。手動なら 0.5（＝+50%）
      bonus: manual ? MANUAL_BONUS.gold : 0,
    };
  }

  RPG.economy = {
    EXP_SPLIT_SOFTNESS, MANUAL_BONUS,
    expShare, wasManual, payout,
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
