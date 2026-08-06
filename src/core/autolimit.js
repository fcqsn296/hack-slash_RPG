// @ts-check
/**
 * オート戦闘の回数制限 (§10.5)。
 *
 * ── なぜオート専用なのか ──
 * 実測すると、高速オートは1周（5連戦）を約3.6秒でこなす。派遣が1周12分なので
 * 200倍の効率になり、時間で縛ったはずの周回がまるごと迂回されていた。
 *
 * ただし全体スタミナ制はこのゲームに合わない。買い切りで遊ぶ作りなのに、
 * 手動で遊びたい人まで待たされるのは本末転倒になる。
 * そこで **手動は無制限のまま、オートだけが回数を消費する** 形にした。
 *
 *   手動   … 消費なし。自分で操作するぶん時間がかかるので、それ自体が上限になる
 *   オート … 1戦闘につき1回消費。実時間で回復する
 *   派遣   … 消費なし。その代わり1周12分かかる
 *
 * これで「同じコストなら手動のほうが得（手動ボーナス +50%）」が初めて成立する。
 * 上限はクエスト報酬などで永続的に増やせるので、遊ぶほど楽になる。
 *
 * セーブに持つのは「残量」と「最後に回復を計算した時刻」だけ。
 * 進行は実時間から求めるので、タブを閉じていても回復する。
 */
(function (RPG) {
  'use strict';

  /** 初期の上限 */
  const BASE_MAX = 20;
  /** 1回復にかかる実時間（ミリ秒） */
  const REGEN_MS = 8 * 60 * 1000;
  /** 上限をどこまで伸ばせるか */
  const MAX_CAP = 60;

  /** 既定値。migrate と createNewSave の両方から使う。 */
  function defaults() {
    return {
      charges: BASE_MAX,
      /** クエスト報酬などで増えた上限の上乗せぶん */
      bonusMax: 0,
      /** 最後に回復量を計算した時刻 */
      checkedAt: Date.now(),
    };
  }

  function store() {
    const s = RPG.state.get();
    if (!s.autoLimit) s.autoLimit = defaults();
    return s.autoLimit;
  }

  /** 現在の上限。 */
  function max() {
    return Math.min(MAX_CAP, BASE_MAX + (store().bonusMax || 0));
  }

  /**
   * 経過時間ぶんの回復を反映する。
   * 参照のたびに呼ばれるので、余った端数の時間は次回に持ち越す。
   */
  function refresh() {
    const a = store();
    const now = Date.now();
    // 端末の時計が巻き戻された場合は、基準を今に寄せるだけで回復させない
    if (now < a.checkedAt) { a.checkedAt = now; return a; }

    const cap = max();
    if (a.charges >= cap) { a.checkedAt = now; return a; }

    const gained = Math.floor((now - a.checkedAt) / REGEN_MS);
    if (gained > 0) {
      a.charges = Math.min(cap, a.charges + gained);
      a.checkedAt += gained * REGEN_MS;
      if (a.charges >= cap) a.checkedAt = now;
    }
    return a;
  }

  /** 残量。 */
  function charges() {
    return refresh().charges;
  }

  /** 次の1回復までの残り時間（ミリ秒）。満タンなら 0。 */
  function nextRegenMs() {
    const a = refresh();
    if (a.charges >= max()) return 0;
    return Math.max(0, REGEN_MS - (Date.now() - a.checkedAt));
  }

  /** オートを使えるか。 */
  function canAuto() {
    return charges() > 0;
  }

  /**
   * 1回消費する。足りなければ false。
   * @returns {boolean}
   */
  function spend() {
    const a = refresh();
    if (a.charges <= 0) return false;
    a.charges--;
    RPG.state.persist();
    return true;
  }

  /**
   * 上限を永続的に増やす（クエスト報酬など）。増やしたぶんは残量にも足す。
   * @param {number} amount
   * @returns {number} 増えた後の上限
   */
  function grantMax(amount) {
    const a = refresh();
    const before = max();
    a.bonusMax = (a.bonusMax || 0) + amount;
    const after = max();
    a.charges = Math.min(after, a.charges + Math.max(0, after - before));
    RPG.state.persist();
    return after;
  }

  /**
   * 残量を回復させる（消耗品や報酬用）。
   * @param {number} amount
   */
  function refill(amount) {
    const a = refresh();
    a.charges = Math.min(max(), a.charges + amount);
    RPG.state.persist();
    return a.charges;
  }

  /** 表示用のまとめ。 */
  function status() {
    return {
      charges: charges(),
      max: max(),
      nextMs: nextRegenMs(),
      full: charges() >= max(),
    };
  }

  RPG.autolimit = {
    BASE_MAX, REGEN_MS, MAX_CAP,
    defaults, max, charges, nextRegenMs, canAuto, spend, grantMax, refill, status, refresh,
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
