// @ts-check
/**
 * 立ち絵から顔アイコンを自動で切り抜く (§1.3)。
 *
 * 切り抜きは「画像を canvas で加工して別画像を作る」のではなく、
 * 正方形の枠の中で <img> を拡大・移動させるCSS方式で行う。
 * こうすると file:// で直接開いた場合でも確実に動き、画質も元のまま保たれる。
 *
 * 顔の位置は次の優先順位で決まる:
 *   1. data/characters.js の art.face（手動指定）
 *   2. ピクセル解析による自動検出（http:// で開いたときのみ可能）
 *   3. artConfig.defaultFace（全身の立ち絵で頭部がだいたい収まる既定値）
 *
 * 「切り抜いた画像ファイルが欲しい」場合は exportIcon() でPNGを書き出せる。
 * test/art.html にボタンを用意してある。
 */
(function (RPG) {
  'use strict';

  const STORAGE_KEY = 'hakusura-rpg/facecrop';

  /** 解析結果のメモリキャッシュ { 画像パス: {x, y, size} } */
  /** @type {Record<string, any>} */
  let detected = {};

  /** 解析中の重複起動を防ぐ */
  /** @type {Record<string, Promise<any>>} */
  const inflight = {};

  /**
   * @typedef {Object} FaceRect 画像サイズに対する割合で表した正方形の切り抜き範囲
   * @property {number} x    中心のX（画像の幅に対する割合 0〜1）
   * @property {number} y    中心のY（画像の高さに対する割合 0〜1）
   * @property {number} size 一辺の長さ（画像の幅に対する割合 0〜1）
   */

  function loadCache() {
    if (!RPG.data.artConfig.cacheDetection) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) detected = JSON.parse(raw) || {};
    } catch (e) {
      detected = {};
    }
  }

  function saveCache() {
    if (!RPG.data.artConfig.cacheDetection) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(detected));
    } catch (e) {
      /* 保存できなくても動作に支障はない */
    }
  }

  /** 解析結果を捨てて再検出させる。立ち絵を差し替えたときに使う。 */
  function clearCache() {
    detected = {};
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* noop */ }
  }

  /**
   * 現時点で分かっている切り抜き範囲を同期的に返す。
   * 検出がまだなら既定値を返し、検出は裏で走らせる。
   * @param {any} art キャラクターの art 定義
   * @param {string|null} src 立ち絵のパス
   * @returns {FaceRect}
   */
  function rectFor(art, src) {
    if (art && art.face) return normalize(art.face);
    if (src && detected[src]) return detected[src];
    return normalize(RPG.data.artConfig.defaultFace);
  }

  /**
   * @param {FaceRect} r
   * @returns {FaceRect}
   */
  function normalize(r) {
    return {
      x: clamp(r.x, 0, 1),
      y: clamp(r.y, 0, 1),
      size: clamp(r.size, 0.05, 1),
    };
  }

  /** @param {number} v @param {number} lo @param {number} hi */
  function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
  }

  /**
   * 立ち絵を解析して顔の位置を推定する。
   *
   * 手順:
   *   1. 縮小してピクセルを読む
   *   2. 四隅の色から背景を推定し、被写体のマスクを作る（透過画像なら透明度で判定）
   *   3. 被写体の外接矩形を求める
   *   4. その上端から一定割合の帯を「頭部」とみなす
   *   5. 帯の中の被写体の重心を中心にして正方形を切り出す
   *
   * @param {HTMLImageElement} img 読み込み済みの画像
   * @returns {FaceRect|null} 解析できなければ null
   */
  function detectFromImage(img) {
    const W = 200;
    const H = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * W));

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, W, H);

    let data;
    try {
      data = ctx.getImageData(0, 0, W, H).data;
    } catch (e) {
      // file:// で開いた場合など、ピクセルを読めない状況。既定値に任せる。
      return null;
    }

    /** @param {number} x @param {number} y */
    const at = (x, y) => (y * W + x) * 4;

    // --- 背景の推定 ---
    let alphaSum = 0;
    const corners = [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3]];
    let br = 0, bg = 0, bb = 0;
    for (const [cx, cy] of corners) {
      const i = at(cx, cy);
      br += data[i]; bg += data[i + 1]; bb += data[i + 2];
      alphaSum += data[i + 3];
    }
    br /= 4; bg /= 4; bb /= 4;
    const transparentBg = alphaSum / 4 < 24;

    /** 被写体のピクセルか判定する */
    const isSubject = (/** @type {number} */ i) => {
      if (data[i + 3] < 40) return false;
      if (transparentBg) return true;
      const d = Math.abs(data[i] - br) + Math.abs(data[i + 1] - bg) + Math.abs(data[i + 2] - bb);
      return d > 60;
    };

    // --- 行・列ごとの被写体ピクセル数 ---
    const rows = new Int32Array(H);
    const cols = new Int32Array(W);
    let total = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (isSubject(at(x, y))) { rows[y]++; cols[x]++; total++; }
      }
    }
    // 被写体がほとんど無い（＝背景推定に失敗した）場合は諦める
    if (total < W * H * 0.02) return null;

    const rowMin = Math.max(1, Math.round(W * 0.012));
    const colMin = Math.max(1, Math.round(H * 0.012));

    let top = 0; while (top < H && rows[top] < rowMin) top++;
    let bottom = H - 1; while (bottom > top && rows[bottom] < rowMin) bottom--;
    let left = 0; while (left < W && cols[left] < colMin) left++;
    let right = W - 1; while (right > left && cols[right] < colMin) right--;

    const subjectH = bottom - top + 1;
    const subjectW = right - left + 1;
    if (subjectH < 8 || subjectW < 8) return null;

    // --- 頭部の帯 ---
    // 全身なら上から約22%、バストアップならもっと大きく取る必要があるので、
    // 被写体の縦横比から帯の割合を調整する。
    const aspect = subjectH / subjectW;
    const bandRatio = aspect > 2.2 ? 0.22 : aspect > 1.5 ? 0.30 : 0.46;
    const bandH = Math.max(6, Math.round(subjectH * bandRatio));
    const bandBottom = Math.min(bottom, top + bandH);

    // --- 帯の中での重心と横幅 ---
    let sumX = 0, count = 0, headLeft = W, headRight = 0;
    for (let y = top; y <= bandBottom; y++) {
      for (let x = left; x <= right; x++) {
        if (isSubject(at(x, y))) {
          sumX += x; count++;
          if (x < headLeft) headLeft = x;
          if (x > headRight) headRight = x;
        }
      }
    }
    if (count === 0) return null;

    const centerX = sumX / count;
    const headW = headRight - headLeft + 1;

    // 頭がしっかり収まり、かつ余白が空きすぎない正方形を作る。
    // 中心は帯のやや下寄りにして、顎から肩が少し入るバストアップ構図にする。
    const side = clamp(Math.max(headW * 1.35, bandH * 1.15), 8, Math.min(W, H));
    const centerY = top + bandH * 0.52;

    // 画像からはみ出さないよう中心を寄せる
    const cx = clamp(centerX, side / 2, W - side / 2);
    const cy = clamp(centerY, side / 2, H - side / 2);

    return normalize({ x: cx / W, y: cy / H, size: side / W });
  }

  /**
   * 立ち絵を読み込んで顔位置を検出する。結果はキャッシュされる。
   * @param {string} src
   * @returns {Promise<FaceRect|null>}
   */
  function detect(src) {
    if (!RPG.data.artConfig.autoDetectFace) return Promise.resolve(null);
    if (detected[src]) return Promise.resolve(detected[src]);
    if (inflight[src]) return inflight[src];

    const p = new Promise((resolve) => {
      const img = new Image();
      // 同一オリジンでもCORS属性を付けておくと、将来CDN配信にしたときも解析できる
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        let rect = null;
        try { rect = detectFromImage(img); } catch (e) { rect = null; }
        if (rect) { detected[src] = rect; saveCache(); }
        resolve(rect);
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });

    inflight[src] = p;
    return p;
  }

  /**
   * 正方形の枠に対して、顔が中心に来るよう <img> の拡大率と位置をCSSで設定する。
   *
   * 枠の一辺を S とすると、切り抜き正方形（元画像上の一辺 s px）が S に一致するよう
   * 画像全体を S/s 倍に拡大し、顔の中心が枠の中心に来るようずらす。
   * 枠は正方形なので、% 指定はすべて S を基準に解決される。
   *
   * @param {HTMLImageElement} img
   * @param {FaceRect} rect
   * @param {{width: number, height: number}} [natural] 画像の実寸。無ければ設定値を使う
   */
  function applyRect(img, rect, natural) {
    const size = natural && natural.width
      ? natural
      : RPG.data.artConfig.standeeSize;
    const aspect = size.height / size.width; // 高さ / 幅

    // rect.size は「幅に対する割合」なので、幅方向の倍率はそのまま 1 / size
    const scale = 1 / rect.size;
    img.style.position = 'absolute';
    img.style.width = (scale * 100) + '%';
    img.style.height = 'auto';
    img.style.left = (50 - (rect.x * scale) * 100) + '%';
    // Y は高さ基準なので、幅基準の座標系に変換してから同じ倍率をかける
    img.style.top = (50 - (rect.y * aspect * scale) * 100) + '%';
    img.style.maxWidth = 'none';
  }

  /**
   * 顔アイコンをPNGとして書き出す。静的な画像ファイルとして持ちたい場合に使う。
   * @param {string} src 立ち絵のパス
   * @param {FaceRect} rect
   * @param {number} [outSize] 出力する一辺のピクセル数
   * @returns {Promise<Blob|null>}
   */
  function exportIcon(src, rect, outSize) {
    const side = outSize || 512;
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const s = rect.size * img.naturalWidth;
          const sx = rect.x * img.naturalWidth - s / 2;
          const sy = rect.y * img.naturalHeight - s / 2;

          const canvas = document.createElement('canvas');
          canvas.width = side;
          canvas.height = side;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(null);
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, sx, sy, s, s, 0, 0, side, side);
          canvas.toBlob((blob) => resolve(blob), 'image/png');
        } catch (e) {
          resolve(null); // canvas が汚染されている（file:// で開いた等）
        }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  loadCache();

  RPG.faceCrop = {
    rectFor, detect, detectFromImage, applyRect, exportIcon,
    clearCache, normalize,
    get cache() { return detected; },
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
