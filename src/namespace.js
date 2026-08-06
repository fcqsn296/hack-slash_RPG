// @ts-check
/**
 * グローバル名前空間の初期化。
 * ビルド工程を持たないため、各ファイルは IIFE でこの RPG に自分を登録していく。
 *
 * RPG.data    — 外部データカタログ (§9.2)
 * RPG.plugins — スキルロジックのプラグイン (§9.1)
 */
window.RPG = window.RPG || { data: {}, plugins: {} };
