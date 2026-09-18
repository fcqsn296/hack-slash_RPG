// @ts-check
/**
 * 異相 (§22)。既存フィールドに条件を重ねて、同じ場所を別の戦いにする。
 *
 * ここは「どの相がどのフィールドで選べるか」と「その相が何を否定するか」を
 * 答えるだけの層。効かせる場所は battle.js と damage.js が持つ。
 *
 * ── 名前 ──
 * `battle.phase` は手番の局面で使われているので、こちらは `battle.aspect`。
 */
(function (RPG) {
  'use strict';

  /** @param {string} id */
  function def(id) {
    return (RPG.data.aspects && RPG.data.aspects[id]) || null;
  }

  /** 全部の相。 */
  function all() {
    const src = RPG.data.aspects || {};
    return Object.keys(src).map((id) => Object.assign({ id }, src[id]));
  }

  /**
   * そのフィールドで選べる相。
   * @param {string} fieldId
   */
  function forField(fieldId) {
    return all().filter((a) => (a.fields || []).indexOf(fieldId) >= 0);
  }

  /**
   * 選べるようになる条件 (§22)。
   *
   * ── なぜフィールドの踏破を条件にするのか ──
   * 相は「その場所を組み替えて遊ぶ」ためのものなので、
   * **素の状態で一度抜けている**ことが前提。抜ける前に相を選べると、
   * 「難しいほうから入って詰まる」入口になる。
   *
   * 判定は図鑑の記録を読む。別に持つと二重帳簿になる。
 *
 * @知見: `codex.fieldSeen` は「出撃したか」であって「抜けたか」ではない。
 * 負けても visits は進むので、抜けたかはボスの killed で見る。
 *
 * ⚠ 最初に `RPG.codex.seen('field', id)` と書いていたが、
 * そんな関数は存在しない。手前の `if (!RPG.codex.seen) return true` が
 * それを飲んでしまい、**解放条件が常に真**になっていた。
 * 無い関数を見たときの既定は「通す」でなく「閉じる」にする。
   *
   * @param {string} fieldId
   */
  function unlocked(fieldId) {
    const f = RPG.data.fields[fieldId];
    if (!f || !f.boss) return false;
    if (!RPG.codex || !RPG.codex.enemyEntry) return false;
    return RPG.codex.enemyEntry(f.boss).killed > 0;
  }

  /**
   * 戦闘へ載せる形。`battle.start({ aspectId })` から呼ばれる。
   * @param {string | null | undefined} id
   */
  function resolve(id) {
    const d = id ? def(id) : null;
    if (!d) return null;
    return { id, def: d, effects: d.effects || {} };
  }

  /**
   * この攻撃属性が、いまの相で否定されているか。
   *
   * **オートも同じ判定を読む必要がある。** 読まないと、否定されている属性の技を
   * 「よく通る技」と見積もって選び、実際には等倍でしか入らない
   * （闘技場の elementNull で同じ事故が起きている）。
   *
   * @param {any} battle @param {string} attackElement
   */
  function denies(battle, attackElement) {
    const a = battle && battle.aspect;
    if (!a || !attackElement) return false;
    return a.effects.denyElement === attackElement;
  }

  /**
   * 報酬の上乗せ。相を選んでいなければ 1。
   *
   * ── なぜ必要なのか ──
   * **当初「報酬は変えない」で作っていたが、これは設計の誤りだった。**
   * 依頼書 §8 の誺理を当てれば、難しくて実入りが同じ選択肢は
   * 選ばれないだけで、置いてあることに意味がなくなる。
   *
   * @知見: 相の報酬倍率は「勝てる編成でのラウンド数が素の何倍か」から逆算している
   * @知見: 報酬を勝率で校正すると、ビルドが強くなるほど上乗せが過大になる（向きが逆立ちする）
   * @知見: 勝率は10試行だと20〜30ポイント揺れる。ラウンド数は60試行で安定する
   *
   * @param {string | null | undefined} id
   */
  function rewardMult(id) {
    const d = id ? def(id) : null;
    if (!d || !d.rewardMult) return 1;
    return d.rewardMult;
  }

  /**
   * 宝箱の上乗せ。ゴールドと同率。
   *
   * ── 一度半分にして、測って戻した ──
   * 最初は `1 + (m-1)/2` にしていた。理屈は「宝箱は効きが長い」——
   * 装備になり、強さになり、次の周回が速くなるのだから、
   * ゴールドと同じ倍率をかけるのは均等でないと考えた。
   *
   * **測ったら持たなかった。** 1ラウンドあたりの宝箱が
   * 硬きを試す相で **0.99 倍**、あまねく相で 1.09 倍。
   * 半分にした上乗せが、増えたラウンドと勝率の損に食われて消える。
   *
   * しかも終盤の実入りの主役は**装備の売却益**なので、
   * 宝箱が増えないと上乗せそのものが穿しになる。
   * 「効きすぎないか」の心配より、実測のほうを採った。
   *
   * @知見: 報酬の上乗せを宝箱とゴールドで別率にすると、宝箱側はラウンド増に食われて消える
   *
   * @param {string | null | undefined} id
   */
  function boxMult(id) {
    return rewardMult(id);
  }

  /** 画面に出す短い説明。 */
  function summary(id) {
    const d = def(id);
    if (!d) return null;
    return {
      id, name: d.name, reading: d.reading, color: d.color, icon: d.icon,
      effect: d.effect, flavor: d.flavor, desc: d.desc,
      rewardMult: rewardMult(id), boxMult: boxMult(id),
    };
  }

  RPG.aspect = { def, all, forField, unlocked, resolve, denies, summary, rewardMult, boxMult };
})(window.RPG);
