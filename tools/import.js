// @ts-check
/**
 * 画像の取り込みツール。
 *
 * ── 拡張への追従について ──
 * 取り込み先の一覧は `RPG.data.characters` と `RPG.data.enemies` をそのまま走査して作る。
 * 保存先フォルダとファイル名の規則も `RPG.data.artConfig` から読む。
 * そのため data/ にキャラや敵を1体足せば、このツールにも自動で枠が増える。
 * ここに個別のIDを書き込まないこと。
 *
 * 判定ロジック（名前からの推測・保存名・階層の解決）は tools/importcore.js にあり、
 * 検証テストからも同じものを読んでいる。このファイルは画面と書き込みだけを持つ。
 *
 * 書き込みは File System Access API（Chrome / Edge）を使う。
 * 使えないブラウザでは、正しい名前を付けたファイルのダウンロードにフォールバックする。
 */
(function (RPG) {
  'use strict';

  const cfg = RPG.data.artConfig;
  const SIZE = cfg.standeeSize;
  const $ = (/** @type {string} */ sel) => /** @type {HTMLElement} */ (document.querySelector(sel));

  /** File System Access API が使えるか */
  const CAN_WRITE = typeof window.showDirectoryPicker === 'function';

  /** @type {any} 選択された保存先フォルダ */
  let rootHandle = null;

  /**
   * 取り込み先の定義。
   * @typedef {Object} Target
   * @property {string} id
   * @property {string} name
   * @property {string} kind      'character' | 'enemy'
   * @property {string} dir       artConfig から引いた保存先（basePath を含まない）
   * @property {string} glyph
   * @property {string|null} existing 既にある画像のパス
   * @property {File|null} pending    これから書き込むファイル
   * @property {string|null} pendingUrl
   * @property {string|null} warn     サイズ違いなどの注意書き
   */

  /** @type {Target[]} */
  let targets = [];

  /** @type {Array<{file: File, url: string}>} 割り当て先が決まっていない画像 */
  let tray = [];

  /* ============================================================
     取り込み先の一覧をデータから組み立てる
     ============================================================ */

  const SECTIONS = [
    { kind: 'character', label: 'キャラクター', dir: cfg.dir },
    { kind: 'enemy', label: 'エネミー', dir: cfg.enemyDir },
  ];

  /** 取り込み先をデータから作り直す。 */
  function collectTargets() {
    const groups = SECTIONS.map((s) => Object.assign({}, s, {
      catalog: s.kind === 'character' ? RPG.data.characters : RPG.data.enemies,
    }));
    targets = RPG.importCore.buildTargets(groups).map((t) => Object.assign(t, {
      existing: null, pending: null, pendingUrl: null, warn: null,
    }));
  }

  /** 既にある画像を探す。artSource と同じ規則で当たりを取る。 */
  function probeExisting() {
    return Promise.all(targets.map((t) => {
      const candidates = cfg.extensions.map((/** @type {string} */ ext) =>
        (cfg.basePath || '') + t.dir + t.id + ext);
      return RPG.artSource.probe(candidates).then((path) => { t.existing = path; });
    }));
  }

  /* ============================================================
     ファイルの受け取りと自動割り当て
     ============================================================ */

  /**
   * 画像の実サイズを測る。
   * @param {File} file
   * @returns {Promise<{w: number, h: number, url: string}>}
   */
  function measure(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight, url });
      img.onerror = () => resolve({ w: 0, h: 0, url });
      img.src = url;
    });
  }

  /**
   * ファイル名から取り込み先を推測する。
   * @param {string} filename
   * @returns {Target|null}
   */
  function guessTarget(filename) {
    return RPG.importCore.guessTarget(filename, targets);
  }

  /**
   * @param {Target} t
   * @param {File} file
   */
  async function assign(t, file) {
    const { w, h, url } = await measure(file);
    if (t.pendingUrl) URL.revokeObjectURL(t.pendingUrl);
    t.pending = file;
    t.pendingUrl = url;
    t.warn = RPG.importCore.sizeWarning(w, h, SIZE);
  }

  /**
   * まとめて受け取る。行き先が決まらなかったものはトレイへ回す。
   * @param {FileList|File[]} files
   */
  async function accept(files) {
    for (const file of Array.from(files)) {
      if (!/^image\//.test(file.type)) continue;
      const guess = guessTarget(file.name);
      if (guess) await assign(guess, file);
      else tray.push({ file, url: URL.createObjectURL(file) });
    }
    render();
  }

  /* ============================================================
     書き込み
     ============================================================ */

  /**
   * パスを辿ってフォルダを取り出す。無ければ作る。
   * どの階層を辿るかの判断は importCore.dirSegments が持つ。
   * @param {any} root
   * @param {string} path 'assets/characters/' のような相対パス
   */
  async function ensureDir(root, path) {
    let dir = root;
    for (const name of RPG.importCore.dirSegments(root.name, path)) {
      dir = await dir.getDirectoryHandle(name, { create: true });
    }
    return dir;
  }

  /**
   * 保存するファイル名。
   * @param {Target} t
   */
  function outputName(t) {
    return RPG.importCore.outputName(t, t.pending ? t.pending.name : '', cfg);
  }

  async function writeAll() {
    const queue = targets.filter((t) => t.pending);
    if (queue.length === 0) return;

    if (!rootHandle) {
      // フォルダに書けない環境では、正しい名前を付けて1つずつダウンロードさせる
      for (const t of queue) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(/** @type {File} */ (t.pending));
        a.download = outputName(t);
        document.body.appendChild(a);
        a.click();
        a.remove();
        await new Promise((r) => setTimeout(r, 120));   // 連続ダウンロードの取りこぼし対策
      }
      alert(
        `${queue.length} 個のファイルを正しい名前でダウンロードしました。\n\n` +
        SECTIONS.map((s) => `${s.label} → ${s.dir}`).join('\n') +
        '\n\nそれぞれのフォルダへ移動してください。'
      );
      clearPending();
      return;
    }

    let ok = 0;
    /** @type {string[]} */
    const failed = [];
    for (const t of queue) {
      try {
        const dir = await ensureDir(rootHandle, t.dir);
        const fh = await dir.getFileHandle(outputName(t), { create: true });
        const w = await fh.createWritable();
        await w.write(/** @type {File} */ (t.pending));
        await w.close();
        ok++;
      } catch (e) {
        failed.push(`${t.id}: ${e && e.message ? e.message : e}`);
      }
    }

    clearPending();
    RPG.artSource.clearCache();
    await probeExisting();
    render();

    alert(failed.length
      ? `${ok} 個を書き込みました。\n\n失敗:\n${failed.join('\n')}`
      : `${ok} 個を書き込みました。ゲーム画面を再読み込みすると反映されます。`);
  }

  function clearPending() {
    for (const t of targets) {
      if (t.pendingUrl) URL.revokeObjectURL(t.pendingUrl);
      t.pending = null;
      t.pendingUrl = null;
      t.warn = null;
    }
  }

  /* ============================================================
     描画
     ============================================================ */

  function matchesFilter(/** @type {Target} */ t) {
    const q = /** @type {HTMLInputElement} */ ($('#q')).value.trim().toLowerCase();
    const onlyMissing = /** @type {HTMLInputElement} */ ($('#only-missing')).checked;
    if (onlyMissing && t.existing && !t.pending) return false;
    if (!q) return true;
    return t.id.toLowerCase().includes(q) || (t.name || '').toLowerCase().includes(q);
  }

  /** @param {Target} t */
  function card(t) {
    const el = document.createElement('div');
    el.className = 'card' + (t.pending ? ' is-pending' : (t.existing ? ' has-image' : ''));

    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    const src = t.pendingUrl || t.existing;
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      thumb.appendChild(img);
    } else {
      const g = document.createElement('span');
      g.className = 'glyph';
      g.textContent = t.glyph;
      thumb.appendChild(g);
    }
    if (t.pending) {
      const b = document.createElement('span');
      b.className = 'badge new';
      b.textContent = '差し替え';
      thumb.appendChild(b);
    } else if (t.existing) {
      const b = document.createElement('span');
      b.className = 'badge ok';
      b.textContent = '設定済み';
      thumb.appendChild(b);
    }
    el.appendChild(thumb);

    const nm = document.createElement('div');
    nm.className = 'nm';
    nm.textContent = t.name;
    el.appendChild(nm);

    const fn = document.createElement('div');
    fn.className = 'fn';
    fn.textContent = t.dir + (t.pending ? outputName(t) : t.id + '.png');
    el.appendChild(fn);

    if (t.warn) {
      const w = document.createElement('div');
      w.className = 'warn';
      w.textContent = 'サイズ ' + t.warn;
      el.appendChild(w);
    }

    const acts = document.createElement('div');
    acts.className = 'acts';

    const pick = document.createElement('button');
    pick.className = 'btn btn-ghost';
    pick.innerHTML = '<span class="btn-label">' + (t.pending ? '選び直す' : '画像を選ぶ') + '</span>';
    pick.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.addEventListener('change', async () => {
        if (input.files && input.files[0]) {
          await assign(t, input.files[0]);
          render();
        }
      });
      input.click();
    });
    acts.appendChild(pick);

    if (t.pending) {
      const cancel = document.createElement('button');
      cancel.className = 'btn btn-ghost';
      cancel.innerHTML = '<span class="btn-label">取消</span>';
      cancel.addEventListener('click', () => {
        if (t.pendingUrl) URL.revokeObjectURL(t.pendingUrl);
        t.pending = null;
        t.pendingUrl = null;
        t.warn = null;
        render();
      });
      acts.appendChild(cancel);
    }

    el.appendChild(acts);
    return el;
  }

  function renderSections() {
    const box = $('#sections');
    box.innerHTML = '';
    for (const s of SECTIONS) {
      const list = targets.filter((t) => t.kind === s.kind);
      const shown = list.filter(matchesFilter);
      const done = list.filter((t) => t.existing || t.pending).length;

      const head = document.createElement('h2');
      head.textContent = `${s.label}（${done} / ${list.length}）`;
      box.appendChild(head);

      if (shown.length === 0) {
        const p = document.createElement('p');
        p.className = 'lead';
        p.textContent = '条件に合う項目がありません。';
        box.appendChild(p);
        continue;
      }
      const grid = document.createElement('div');
      grid.className = 'grid';
      for (const t of shown) grid.appendChild(card(t));
      box.appendChild(grid);
    }
  }

  function renderTray() {
    const panel = $('#tray-panel');
    const box = $('#tray');
    panel.hidden = tray.length === 0;
    $('#tray-count').textContent = `${tray.length} 個`;
    box.innerHTML = '';

    tray.forEach((entry, index) => {
      const row = document.createElement('div');
      row.className = 'tray-item';

      const img = document.createElement('img');
      img.src = entry.url;
      img.alt = '';
      row.appendChild(img);

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = entry.file.name;
      row.appendChild(name);

      const sel = document.createElement('select');
      sel.innerHTML = '<option value="">割り当て先を選ぶ…</option>' +
        SECTIONS.map((s) =>
          '<optgroup label="' + s.label + '">' +
          targets.filter((t) => t.kind === s.kind)
            .map((t) => `<option value="${t.id}">${t.name}（${t.id}）${t.existing ? ' ※設定済み' : ''}</option>`)
            .join('') +
          '</optgroup>').join('');
      sel.addEventListener('change', async () => {
        const t = targets.find((x) => x.id === sel.value);
        if (!t) return;
        await assign(t, entry.file);
        URL.revokeObjectURL(entry.url);
        tray.splice(index, 1);
        render();
      });
      row.appendChild(sel);

      const del = document.createElement('button');
      del.className = 'btn btn-ghost';
      del.innerHTML = '<span class="btn-label">破棄</span>';
      del.addEventListener('click', () => {
        URL.revokeObjectURL(entry.url);
        tray.splice(index, 1);
        render();
      });
      row.appendChild(del);

      box.appendChild(row);
    });
  }

  function render() {
    const pending = targets.filter((t) => t.pending);
    const have = targets.filter((t) => t.existing).length;
    $('#summary').textContent = `画像あり ${have} / ${targets.length}`;

    const bar = $('#applybar');
    bar.classList.toggle('is-idle', pending.length === 0);
    const overwrite = pending.filter((t) => t.existing).length;
    $('#apply-info').textContent =
      `${pending.length} 個を書き込みます` +
      (overwrite ? `（うち ${overwrite} 個は上書き）` : '') +
      (rootHandle ? '' : '（フォルダ未接続のためダウンロードになります）');

    renderTray();
    renderSections();
  }

  /* ============================================================
     組み立て
     ============================================================ */

  function setupDirPicker() {
    const note = $('#dir-note');
    const state = $('#dir-state');
    const btn = /** @type {HTMLButtonElement} */ ($('#pick-dir'));

    if (!CAN_WRITE) {
      btn.disabled = true;
      state.textContent = 'このブラウザでは直接書き込めません';
      note.textContent =
        'Chrome または Edge で開くとフォルダへ直接書き込めます。' +
        'それ以外のブラウザでは、正しい名前を付けたファイルのダウンロードになります。';
      return;
    }

    note.textContent =
      `プロジェクトの hakusura-rpg フォルダ（または assets フォルダ）を選んでください。` +
      `保存先は artConfig から決まります: ${SECTIONS.map((s) => s.dir).join(' / ')}`;

    btn.addEventListener('click', async () => {
      try {
        rootHandle = await window.showDirectoryPicker({ mode: 'readwrite', id: 'hakusura-assets' });
        state.textContent = '接続済み: ' + rootHandle.name;
        state.classList.remove('is-off');
        state.innerHTML = '接続済み: <b>' + rootHandle.name + '</b>';
        render();
      } catch (e) {
        // 利用者が選択を取り消しただけなので黙って戻る
      }
    });
  }

  function setupDropZone() {
    const drop = $('#drop');
    drop.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.addEventListener('change', () => { if (input.files) accept(input.files); });
      input.click();
    });
    for (const type of ['dragenter', 'dragover']) {
      drop.addEventListener(type, (e) => { e.preventDefault(); drop.classList.add('is-over'); });
    }
    for (const type of ['dragleave', 'drop']) {
      drop.addEventListener(type, () => drop.classList.remove('is-over'));
    }
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      const dt = /** @type {DragEvent} */ (e).dataTransfer;
      if (dt && dt.files) accept(dt.files);
    });
    $('#drop-note').textContent =
      `推奨サイズ ${SIZE.width}×${SIZE.height}。` +
      'ファイル名にIDか名前が含まれていれば自動で割り当てます。';
  }

  function setupControls() {
    $('#q').addEventListener('input', render);
    $('#only-missing').addEventListener('change', render);
    $('#apply').addEventListener('click', writeAll);
    $('#reset').addEventListener('click', () => { clearPending(); render(); });
    $('#tray-clear').addEventListener('click', () => {
      for (const e of tray) URL.revokeObjectURL(e.url);
      tray = [];
      render();
    });
  }

  collectTargets();
  setupDirPicker();
  setupDropZone();
  setupControls();
  render();
  probeExisting().then(render);

  // テストから触れるように公開する
  RPG.importTool = {
    get targets() { return targets; },
    get tray() { return tray; },
    SECTIONS, collectTargets, guessTarget, outputName, ensureDir, accept, assign,
  };
})(window.RPG);
