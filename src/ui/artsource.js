// @ts-check
/**
 * アート画像の探索 (§1.3 / §9.2)。
 *
 * assets/characters/ に「キャラクターID.png」を置くだけで自動的に読み込まれる。
 * データファイルを編集する必要はない。明示的にパスを書きたい場合は
 * data/characters.js の art.standeeImage / art.image が優先される。
 */
(function (RPG) {
  'use strict';

  /** 探索結果のキャッシュ { キー: Promise<パス|null> } */
  /** @type {Record<string, Promise<string|null>>} */
  const resolved = {};

  // 定義オブジェクトから自分のIDを引けるようにしておく。
  // （UIには定義がそのまま渡ってくる場面があるため）
  for (const id of Object.keys(RPG.data.characters)) {
    RPG.data.characters[id].id = id;
  }
  for (const id of Object.keys(RPG.data.enemies)) {
    RPG.data.enemies[id].id = id;
  }

  /**
   * 画像が実際に読み込めるか順に試し、最初に成功したパスを返す。
   * @param {string[]} candidates
   * @returns {Promise<string|null>}
   */
  function probe(candidates) {
    return new Promise((resolve) => {
      let i = 0;
      const tryNext = () => {
        if (i >= candidates.length) return resolve(null);
        const src = candidates[i++];
        const img = new Image();
        img.onload = () => resolve(src);
        img.onerror = tryNext;
        img.src = src;
      };
      tryNext();
    });
  }

  /**
   * 立ち絵の候補パス一覧。
   * @param {any} c キャラクター定義または戦闘ユニット
   * @returns {string[]}
   */
  function standeeCandidates(c) {
    const art = c.art || {};
    if (art.standeeImage) return [art.standeeImage];

    const cfg = RPG.data.artConfig;
    if (!cfg.autoDiscover || !c.id) return [];
    return cfg.extensions.map((/** @type {string} */ ext) => (cfg.basePath || '') + cfg.dir + c.id + ext);
  }

  /**
   * 顔アイコンの候補パス一覧。
   * 用意されていなければ空配列を返し、立ち絵からの自動切り抜きに任せる。
   * @param {any} c
   * @returns {string[]}
   */
  function iconCandidates(c) {
    const art = c.art || {};
    if (art.image) return [art.image];

    const cfg = RPG.data.artConfig;
    if (!cfg.autoDiscover || !c.id || !cfg.iconDir) return [];
    return cfg.extensions.map((/** @type {string} */ ext) => (cfg.basePath || '') + cfg.iconDir + c.id + ext);
  }

  /**
   * 敵の立ち絵の候補パス一覧。
   * 味方と違い顔の切り抜きは行わないので、画像をそのまま置けばよい。
   * @param {any} e 敵の定義または戦闘ユニット
   * @returns {string[]}
   */
  function enemyCandidates(e) {
    if (e.art && e.art.image) return [e.art.image];

    const cfg = RPG.data.artConfig;
    if (!cfg.autoDiscover || !e.id || !cfg.enemyDir) return [];
    return cfg.extensions.map((/** @type {string} */ ext) => (cfg.basePath || '') + cfg.enemyDir + e.id + ext);
  }

  /**
   * 敵の立ち絵のパスを解決する。無ければ null（紋様タイルにフォールバック）。
   * @param {any} e
   * @returns {Promise<string|null>}
   */
  function enemy(e) {
    const key = 'enemy:' + (e.id || '?');
    if (!resolved[key]) resolved[key] = probe(enemyCandidates(e));
    return resolved[key];
  }

  /**
   * 立ち絵のパスを解決する。存在しなければ null（SVG生成にフォールバック）。
   * @param {any} c
   * @returns {Promise<string|null>}
   */
  function standee(c) {
    const key = 'standee:' + (c.id || (c.art && c.art.standeeImage) || '?');
    if (!resolved[key]) resolved[key] = probe(standeeCandidates(c));
    return resolved[key];
  }

  /**
   * 顔アイコンのパスを解決する。用意されていなければ null。
   * @param {any} c
   * @returns {Promise<string|null>}
   */
  function icon(c) {
    const key = 'icon:' + (c.id || (c.art && c.art.image) || '?');
    if (!resolved[key]) resolved[key] = probe(iconCandidates(c));
    return resolved[key];
  }

  /**
   * 背景のパスを解決する (§1.3)。
   *
   * フィールドと画面で置き場所を分けず、同じフォルダに接頭辞で置く。
   * フォルダを増やすと「どっちに入れるんだったか」を毎回考えることになる。
   *
   * @param {string} key 'fl_plain' や 'screen-gacha'
   * @returns {Promise<string|null>}
   */
  function backdrop(key) {
    const cacheKey = 'bg:' + key;
    if (!resolved[cacheKey]) {
      const cfg = RPG.data.artConfig;
      const dir = cfg.backdropDir;
      resolved[cacheKey] = (!cfg.autoDiscover || !dir || !key)
        ? Promise.resolve(null)
        : probe(cfg.extensions.map((/** @type {string} */ ext) => (cfg.basePath || '') + dir + key + ext));
    }
    return resolved[cacheKey];
  }

  /** 探索結果を捨てる。画像を追加した直後に再読み込みさせたいときに使う。 */
  function clearCache() {
    for (const k of Object.keys(resolved)) delete resolved[k];
  }

  RPG.artSource = {
    standee, icon, enemy, backdrop, probe,
    standeeCandidates, iconCandidates, enemyCandidates, clearCache,
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
