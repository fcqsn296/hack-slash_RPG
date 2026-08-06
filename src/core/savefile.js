// @ts-check
/**
 * セーブデータの書き出し・読み込み・自動バックアップ。
 *
 * localStorage はブラウザの設定変更やサイトデータの削除で簡単に消えるため、
 * 周回で積み上げたものを外に出せる手段を用意する。
 *
 * 読み込みは必ず validate() を通す。壊れたデータや別ゲームのJSONで
 * 既存のセーブを上書きしないことを最優先にしている。
 */
(function (RPG) {
  'use strict';

  /** 書き出すファイルの識別子。他のJSONを誤って読み込まないための目印。 */
  const FORMAT = 'hakusura-rpg-save';
  /** 書き出しフォーマット自体のバージョン（ゲームのセーブ版数とは別物） */
  const FILE_VERSION = 1;

  const BACKUP_KEY = 'hakusura-rpg/backups';
  const MAX_BACKUPS = 5;
  /** 起動時バックアップの間隔。短時間に何度も開いても増えないようにする。 */
  const BOOT_BACKUP_INTERVAL = 30 * 60 * 1000;

  /**
   * 書き出し用のオブジェクトを作る。
   * @returns {any}
   */
  function envelope() {
    return {
      format: FORMAT,
      fileVersion: FILE_VERSION,
      exportedAt: new Date().toISOString(),
      game: RPG.state.get(),
    };
  }

  /** 書き出し用のJSON文字列 */
  function toText() {
    return JSON.stringify(envelope(), null, 2);
  }

  /**
   * 読み込もうとしている内容が使えるか確かめる。
   * @param {any} raw 文字列でもオブジェクトでも受ける
   * @returns {{ok: boolean, reason?: string, save?: any}}
   */
  function validate(raw) {
    /** @type {any} */
    let obj = raw;
    if (typeof raw === 'string') {
      const text = raw.trim();
      if (!text) return { ok: false, reason: '内容が空です' };
      try {
        obj = JSON.parse(text);
      } catch (e) {
        return { ok: false, reason: 'JSONとして読めません。ファイルが壊れている可能性があります' };
      }
    }
    if (!obj || typeof obj !== 'object') return { ok: false, reason: '内容がデータの形をしていません' };

    // 素のセーブデータを直接渡された場合も受け付ける
    const game = obj.format === FORMAT ? obj.game : (obj.characters ? obj : null);
    if (!game) {
      return { ok: false, reason: 'このゲームのセーブデータではありません' };
    }
    if (game.version !== RPG.state.SAVE_VERSION) {
      return {
        ok: false,
        reason: `セーブ形式が違います（このゲームは v${RPG.state.SAVE_VERSION} / ファイルは v${game.version}）`,
      };
    }
    if (!game.characters || typeof game.characters !== 'object') {
      return { ok: false, reason: 'キャラクター情報がありません' };
    }
    if (!game.characters.ch_hero) {
      return { ok: false, reason: '主人公のデータがありません' };
    }
    if (!Array.isArray(game.inventory)) return { ok: false, reason: '所持装備の形式が不正です' };
    if (!Array.isArray(game.party)) return { ok: false, reason: 'パーティ編成の形式が不正です' };
    if (typeof game.gold !== 'number' || !isFinite(game.gold) || game.gold < 0) {
      return { ok: false, reason: '所持ゴールドの値が不正です' };
    }

    // 知らないキャラクターIDが混ざっていると描画時に落ちるので弾く
    const unknown = Object.keys(game.characters).filter((id) => !RPG.data.characters[id]);
    if (unknown.length) {
      return { ok: false, reason: `未知のキャラクターが含まれています（${unknown.slice(0, 3).join(', ')}）` };
    }

    return { ok: true, save: game };
  }

  /**
   * 退避されたセーブを、版の違いを承知のうえで読み直す (§16)。
   *
   * validate() は「版が違う」を理由に必ず弾く。ファイルの取り違えを防ぐには
   * それでよいのだが、**救済ではその判定が邪魔になる**。
   * 退避されるのはまさに「版が合わなくて読めなかった」中身だからで、
   * 通常の検証を通すと、退避した原因と同じ理由で復元も拒否されてしまう。
   *
   * そこでここでは版だけを現行に読み替え、migrate() で欠けている項目を埋めてから、
   * **中身の妥当性は通常どおり検証する**。壊れたデータを無条件に受け入れるわけではない。
   *
   * @param {string|any} raw
   * @returns {{ok: boolean, save?: any, reason?: string, coerced?: boolean}}
   */
  function validateRescued(raw) {
    // まずは素直に通るか試す。通るならそれが一番安全。
    const plain = validate(raw);
    if (plain.ok) return plain;

    /** @type {any} */
    let obj = raw;
    if (typeof raw === 'string') {
      try {
        obj = JSON.parse(raw.trim());
      } catch (e) {
        return { ok: false, reason: 'JSONとして読めません。ファイルが壊れている可能性があります' };
      }
    }
    const game = obj && (obj.format === FORMAT ? obj.game : (obj.characters ? obj : null));
    if (!game) return { ok: false, reason: 'このゲームのセーブデータではありません' };

    const from = game.version;
    // 版を現行に読み替えたうえで、欠けている項目を埋める
    const copy = JSON.parse(JSON.stringify(game));
    copy.version = RPG.state.SAVE_VERSION;
    let migrated;
    try {
      migrated = RPG.state.migrate(copy);
    } catch (e) {
      return { ok: false, reason: '現在の形式へ読み替えられませんでした: ' + (e && e.message) };
    }

    const check = validate(migrated);
    if (!check.ok) return check;
    return { ok: true, save: check.save, coerced: from !== RPG.state.SAVE_VERSION };
  }

  /**
   * セーブの中身を一行で要約する。読み込み前の確認に使う。
   * @param {any} game
   */
  function summarize(game) {
    const chars = Object.keys(game.characters).length;
    const hero = (game.customNames && game.customNames.ch_hero) || 'アルト';
    const maxLevel = Object.keys(game.characters)
      .reduce((m, id) => Math.max(m, game.characters[id].level), 0);
    const stats = game.stats || {};
    return `主人公「${hero}」／ ${chars}体（最高Lv${maxLevel}）／ ` +
      `${(game.gold || 0).toLocaleString()} G ／ 装備${game.inventory.length}個 ／ ` +
      `${stats.wins || 0}勝 ${stats.battles || 0}戦`;
  }

  /* ============================================================
     ファイルへの書き出し
     ============================================================ */

  /** ファイル名に使う日時 */
  function stamp() {
    const d = new Date();
    const p = (/** @type {number} */ n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  }

  /**
   * セーブデータをJSONファイルとしてダウンロードする。
   * @returns {string} 書き出したファイル名
   */
  function download() {
    const name = `hakusura-rpg-save-${stamp()}.json`;
    const blob = new Blob([toText()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    return name;
  }

  /**
   * ファイルを読み込んで文字列にする。
   * @param {File} file
   * @returns {Promise<string>}
   */
  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('ファイルを読み取れませんでした'));
      reader.readAsText(file);
    });
  }

  /* ============================================================
     読み込み
     ============================================================ */

  /**
   * 検証を通ったら現在のセーブを差し替える。差し替え前に必ずバックアップを取る。
   * @param {any} raw
   * @returns {{ok: boolean, reason?: string, summary?: string}}
   */
  function importFrom(raw) {
    const result = validate(raw);
    if (!result.ok) return { ok: false, reason: result.reason };

    backup('読み込み前');
    RPG.state.replaceSave(result.save);
    return { ok: true, summary: summarize(result.save) };
  }

  /* ============================================================
     自動バックアップ
     ============================================================ */

  /** @returns {any[]} */
  function listBackups() {
    try {
      const raw = localStorage.getItem(BACKUP_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * 現在のセーブを控えとして残す。古いものから捨てて MAX_BACKUPS 世代を保つ。
   * @param {string} reason 何をする直前の控えか
   * @returns {boolean} 保存できたか
   */
  function backup(reason) {
    const list = listBackups();
    list.unshift({
      at: new Date().toISOString(),
      reason,
      summary: summarize(RPG.state.get()),
      game: JSON.parse(JSON.stringify(RPG.state.get())),
    });

    // 容量に収まるまで古い世代を落としながら試す
    let trimmed = list.slice(0, MAX_BACKUPS);
    while (trimmed.length > 0) {
      try {
        localStorage.setItem(BACKUP_KEY, JSON.stringify(trimmed));
        return true;
      } catch (e) {
        trimmed = trimmed.slice(0, trimmed.length - 1);
      }
    }
    return false;
  }

  /**
   * 起動時の控え。短時間に何度も開いても増えないよう間隔を空ける。
   */
  function backupOnBoot() {
    const list = listBackups();
    const last = list.find((b) => b.reason === '自動');
    if (last && Date.now() - new Date(last.at).getTime() < BOOT_BACKUP_INTERVAL) return false;
    return backup('自動');
  }

  /**
   * 控えから戻す。戻す直前の状態も控えに残すので、やり直しがきく。
   * @param {number} index
   * @returns {{ok: boolean, reason?: string, summary?: string}}
   */
  function restoreBackup(index) {
    const list = listBackups();
    const entry = list[index];
    if (!entry) return { ok: false, reason: 'その控えは見つかりません' };

    const result = validate(entry.game);
    if (!result.ok) return { ok: false, reason: '控えが壊れています: ' + result.reason };

    backup('復元前');
    RPG.state.replaceSave(result.save);
    return { ok: true, summary: summarize(result.save) };
  }

  /** 控えをすべて捨てる */
  function clearBackups() {
    try { localStorage.removeItem(BACKUP_KEY); } catch (e) { /* noop */ }
  }

  RPG.savefile = {
    FORMAT, FILE_VERSION, MAX_BACKUPS,
    envelope, toText, validate, summarize,
    download, readFile, importFrom,
    backup, backupOnBoot, listBackups, restoreBackup, clearBackups,
    validateRescued,
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
