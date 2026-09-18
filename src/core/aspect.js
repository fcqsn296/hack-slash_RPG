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

  /** 画面に出す短い説明。 */
  function summary(id) {
    const d = def(id);
    if (!d) return null;
    return {
      id, name: d.name, reading: d.reading, color: d.color, icon: d.icon,
      effect: d.effect, flavor: d.flavor, desc: d.desc,
    };
  }

  RPG.aspect = { def, all, forField, unlocked, resolve, denies, summary };
})(window.RPG);
