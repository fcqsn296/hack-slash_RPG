// @ts-check
/**
 * 画像取り込みの判定ロジック（DOMに触らない純関数のみ）。
 *
 * tools/import.html（画面）と test/index.html（検証テスト）の両方から読む。
 * ここに個別のIDを書かないこと。取り込み先は必ず引数で渡された data から作る。
 */
(function (RPG) {
  'use strict';

  /**
   * 取り込み先の一覧をデータカタログから組み立てる。
   *
   * @param {Array<{kind: string, label: string, catalog: Record<string, any>, dir: string}>} groups
   * @returns {Array<{id: string, name: string, kind: string, dir: string, glyph: string}>}
   */
  function buildTargets(groups) {
    /** @type {any[]} */
    let out = [];
    for (const g of groups) {
      out = out.concat(Object.keys(g.catalog).map((id) => ({
        id,
        name: g.catalog[id].name || id,
        kind: g.kind,
        dir: g.dir,
        glyph: g.catalog[id].glyph || (g.catalog[id].name || '?').slice(0, 1),
      })));
    }
    return out;
  }

  /**
   * ファイル名から取り込み先を推測する。
   *
   * ID の完全一致を最優先し、次に「IDを含む」→「名前を含む」の順に見る。
   * 部分一致どうしでは長いものを勝たせる。IDは接頭辞（ch_ / em_ / bs_）が
   * 共通なので、短いIDが別のIDの一部に埋もれて誤爆するのを防ぐため。
   *
   * @param {string} filename
   * @param {Array<{id: string, name: string}>} targets
   * @returns {any|null}
   */
  function guessTarget(filename, targets) {
    const base = String(filename).replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
    const lower = base.toLowerCase();

    const exact = targets.find((t) => t.id.toLowerCase() === lower);
    if (exact) return exact;

    const byId = targets
      .filter((t) => lower.includes(t.id.toLowerCase()))
      .sort((a, b) => b.id.length - a.id.length)[0];
    if (byId) return byId;

    const byName = targets
      .filter((t) => t.name && base.includes(t.name))
      .sort((a, b) => b.name.length - a.name.length)[0];
    return byName || null;
  }

  /**
   * 保存するファイル名。
   *
   * 読み込み側（artSource）が探す拡張子ならそのまま使い、未対応の形式なら
   * 探索順の先頭（通常は .png）として置く。
   *
   * @param {{id: string}} target
   * @param {string} sourceName 元のファイル名
   * @param {{extensions: string[]}} cfg
   */
  function outputName(target, sourceName, cfg) {
    const m = /\.[^.]+$/.exec(String(sourceName || ''));
    const ext = m ? m[0].toLowerCase() : '';
    return target.id + (cfg.extensions.includes(ext) ? ext : cfg.extensions[0]);
  }

  /**
   * 選んだフォルダから辿るべき階層名の並び。
   *
   * 利用者がプロジェクト直下（hakusura-rpg）を選んでも assets を選んでも
   * 同じ場所に着地させたい。選んだフォルダ名が先頭の階層と一致したら読み飛ばす。
   *
   * @param {string} rootName 選ばれたフォルダの名前
   * @param {string} path 'assets/characters/' のような相対パス
   * @returns {string[]}
   */
  function dirSegments(rootName, path) {
    const parts = String(path).split('/').filter(Boolean);
    if (parts.length && rootName === parts[0]) return parts.slice(1);
    return parts;
  }

  /**
   * サイズが推奨と違うときの注意書き。合っていれば null。
   * @param {number} w
   * @param {number} h
   * @param {{width: number, height: number}} size
   */
  function sizeWarning(w, h, size) {
    if (!w || !h) return null;
    if (w === size.width && h === size.height) return null;
    return `${w}×${h}（推奨 ${size.width}×${size.height}）`;
  }

  RPG.importCore = { buildTargets, guessTarget, outputName, dirSegments, sizeWarning };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
