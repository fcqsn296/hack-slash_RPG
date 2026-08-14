// @ts-check
/**
 * 拡張コンテンツの取り込みを締める (§18)。
 *
 * ── なぜ1行のためにファイルを分けるのか ──
 * content/*.js は「読み込まれた順に add() を呼ぶ」だけの素直なファイルにしたい。
 * 最後の1つに締めの処理を書かせると、**足す順番を変えただけで壊れる**。
 * かといって content.js の末尾では、まだ拡張が1つも読まれていない。
 *
 * script タグの順序がそのまま実行順になるので、
 * 「拡張より後・データを使うコアより前」に置ける小さなファイルを1つ用意した。
 * index.html の並びは tools/sync_content.py が管理する。
 */
(function (RPG) {
  'use strict';
  if (RPG.content && !RPG.content.sealed) {
    RPG.content.sealed = true;
    RPG.content.result = RPG.content.seal();
  }
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
