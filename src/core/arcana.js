// @ts-check
/**
 * アルカナ (§21)。キャラクター1人につき1枚だけ持てる、第三の効果層。
 *
 * ── なぜ klass.js と別なのか ──
 * クラスはポイントを振って育てる層で、`klassTree` という投資先を持つ。
 * アルカナは投資しない。**就いているかどうかだけ**で、伸びも枝分かれも無い。
 * 同じファイルに同居させると「振れないクラス」という説明の要る存在になる。
 *
 * ── 効果語彙は共通 ──
 * ツリー・クラスと同じ効果種別をそのまま使う。`units.js` が3つを合流させるので、
 * 以降の組み立ては出どころを区別しなくてよい。
 * 新しいアルカナを足すときも `data/arcana.js` に1つ書くだけで効く。
 */
(function (RPG) {
  'use strict';

  /** @param {string} id */
  function def(id) {
    return (RPG.data.arcana && RPG.data.arcana[id]) || null;
  }

  /** 選べるアルカナの一覧。 */
  function all() {
    const src = RPG.data.arcana || {};
    return Object.keys(src).map((id) => Object.assign({ id }, src[id]));
  }

  /**
   * 効果をユニットへ流せる形にして返す。就いていなければ null。
   *
   * ツリーの畳み込みをそのまま借りる。アルカナは投資しないので、
   * 「必ずレベル1で取っている仮想ノード」1枚として渡す（klass.js の素質と同じ手）。
   *
   * @param {any} charSave
   */
  function effects(charSave) {
    const d = charSave && charSave.arcana ? def(charSave.arcana) : null;
    if (!d) return null;
    return RPG.tree.effectsOf(
      [{ id: '__arcana', tier: 'basic', cost: 0, maxLevel: 1, effects: d.effects || [] }],
      { __arcana: 1 }
    );
  }

  /**
   * ビルド画面と図鑑で出す要約。**利と害を必ず両方返す。**
   * 片方だけ出すと、選ぶ前に代償が見えない。
   * @param {any} charSave
   */
  function summary(charSave) {
    const id = charSave && charSave.arcana;
    const d = id ? def(id) : null;
    if (!d) return null;
    return {
      id, name: d.name, reading: d.reading, color: d.color, icon: d.icon,
      boon: d.boon, bane: d.bane, flavor: d.flavor, desc: d.desc,
    };
  }

  /**
   * そのキャラにアルカナを就ける。`null` で外す。
   *
   * クラスと違って費用も条件も置いていない。**付け替えを妨げない**のは、
   * 代償が常時効いている以上、試して合わなければ戻せるべきだから。
   * （クラスは投資先が消えるので転職に費用がある。アルカナは投資しない）
   *
   * @param {any} charSave @param {string | null} id
   * @returns {boolean} 就けられたか
   */
  function assign(charSave, id) {
    if (!charSave) return false;
    if (id == null) { delete charSave.arcana; return true; }
    if (!def(id)) return false;
    charSave.arcana = id;
    return true;
  }

  RPG.arcana = { def, all, effects, summary, assign };
})(window.RPG);
