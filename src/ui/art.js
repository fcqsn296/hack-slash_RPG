// @ts-check
/**
 * キャラクターアート生成 (§1.3)。
 *
 * ラスター画像を持たずに、データで指定されたパラメータからアニメ調のSVGを組み立てる。
 * 髪型・瞳・衣装・アクセサリを data/characters.js の art フィールドで宣言するだけで
 * 見た目が変わるので、キャラ追加時にこのファイルを触る必要はない。
 *
 * 本番のイラストを用意した場合は art.image / art.standeeImage にパスを入れれば
 * そちらが優先される。コード変更は不要 (§15.2④)。
 */
(function (RPG) {
  'use strict';

  /** グラデーションIDの衝突を避けるための連番 */
  let uid = 0;

  const DEFAULT_SKIN = '#f7ddc9';
  const SKIN_SHADE = '#e0b89e';

  /* ============================================================
     髪型 — back（頭の後ろ）と front（前髪）に分けて描く
     ============================================================ */

  /** @type {Record<string, {back: (c: any) => string, front: (c: any) => string}>} */
  const HAIR = {
    // ロング：顔の両脇を長い毛束が縁取る
    long: {
      back: () => `
        <path d="M22 52 C20 24 33 10 50 10 C67 10 80 24 78 52 L80 108 L66 108 C71 82 69 60 67 50 L33 50 C31 60 29 82 34 108 L20 108 Z" fill="url(#hairG)"/>
        <path d="M33 50 L67 50 C69 60 71 82 66 108 L34 108 C29 82 31 60 33 50 Z" fill="url(#hairG)" opacity="0.55"/>`,
      front: () => `
        <path d="M28 44 C28 22 37 13 50 13 C63 13 72 22 72 44 C69 31 62 25 55 24 C57 30 55 34 52 36 C48 30 40 30 34 36 C31 38 29 41 28 44 Z" fill="url(#hairG)"/>`,
    },
    // ツインテール：左右に大きな毛束
    twin: {
      back: () => `
        <path d="M25 50 C23 25 34 11 50 11 C66 11 77 25 75 50 L75 60 L70 52 L30 52 L25 60 Z" fill="url(#hairG)"/>
        <path d="M24 44 C10 50 8 74 14 100 C20 104 27 100 26 92 C22 74 26 58 30 50 Z" fill="url(#hairG)"/>
        <path d="M76 44 C90 50 92 74 86 100 C80 104 73 100 74 92 C78 74 74 58 70 50 Z" fill="url(#hairG)"/>`,
      front: () => `
        <path d="M28 44 C28 22 37 13 50 13 C63 13 72 22 72 44 C68 30 60 24 50 24 C40 24 32 30 28 44 Z" fill="url(#hairG)"/>
        <path d="M50 24 C46 30 44 36 44 42 C40 36 38 30 39 24 Z" fill="url(#hairD)" opacity="0.5"/>`,
    },
    // ショートボブ：内巻きの短髪
    bob: {
      back: () => `
        <path d="M26 50 C24 26 35 12 50 12 C65 12 76 26 74 50 L76 72 C70 62 68 56 67 50 L33 50 C32 56 30 62 24 72 Z" fill="url(#hairG)"/>`,
      front: () => `
        <path d="M27 46 C27 22 37 13 50 13 C63 13 73 22 73 46 C70 32 64 26 56 25 C58 32 54 37 50 38 C46 33 40 31 34 34 C31 36 28 41 27 46 Z" fill="url(#hairG)"/>`,
    },
    // ポニーテール：片側に高い尾
    ponytail: {
      back: () => `
        <path d="M26 50 C24 26 35 12 50 12 C65 12 76 26 74 50 L74 58 L68 50 L32 50 L26 58 Z" fill="url(#hairG)"/>
        <path d="M72 24 C88 26 96 44 92 68 C90 80 84 88 78 88 C82 74 84 56 78 42 C76 34 74 28 72 24 Z" fill="url(#hairG)"/>`,
      front: () => `
        <path d="M28 44 C28 22 37 13 50 13 C63 13 72 22 72 44 C68 30 58 24 46 26 C42 28 34 32 28 44 Z" fill="url(#hairG)"/>`,
    },
    // 姫カット：まっすぐな前髪と長い横の毛束
    hime: {
      back: () => `
        <path d="M23 52 C21 24 34 10 50 10 C66 10 79 24 77 52 L79 106 L67 106 C71 80 69 58 67 50 L33 50 C31 58 29 80 33 106 L21 106 Z" fill="url(#hairG)"/>`,
      front: () => `
        <path d="M27 42 C27 20 37 12 50 12 C63 12 73 20 73 42 L73 30 C66 25 58 23 50 23 C42 23 34 25 27 30 Z" fill="url(#hairG)"/>
        <path d="M27 28 L34 28 L34 52 C31 46 28 38 27 28 Z" fill="url(#hairG)"/>
        <path d="M73 28 L66 28 L66 52 C69 46 72 38 73 28 Z" fill="url(#hairG)"/>`,
    },
    // ウェーブ：波打つ長髪
    wavy: {
      back: () => `
        <path d="M22 54 C20 26 33 11 50 11 C67 11 80 26 78 54 C82 70 76 82 80 108 L64 108 C70 88 64 72 68 50 L32 50 C36 72 30 88 36 108 L20 108 C24 82 18 70 22 54 Z" fill="url(#hairG)"/>`,
      front: () => `
        <path d="M28 46 C28 22 37 13 50 13 C63 13 72 22 72 46 C70 34 64 27 57 25 C60 33 54 39 49 37 C44 32 36 32 31 38 C29 40 28 43 28 46 Z" fill="url(#hairG)"/>`,
    },
    // 短髪（主人公用）：シャープな毛流れ
    crop: {
      back: () => `
        <path d="M27 48 C25 26 36 13 50 13 C64 13 75 26 73 48 L73 56 L67 48 L33 48 L27 56 Z" fill="url(#hairG)"/>`,
      front: () => `
        <path d="M27 44 C27 22 37 12 50 12 C63 12 73 22 73 44 C71 34 68 28 63 25 L55 33 L58 24 L46 31 L48 23 C38 25 30 32 27 44 Z" fill="url(#hairG)"/>`,
    },
  };

  /* ============================================================
     アクセサリ
     ============================================================ */

  /** @type {Record<string, (c: any) => string>} */
  const ACCESSORY = {
    ribbon: (c) => `
      <g transform="translate(70 22) rotate(12)">
        <path d="M0 0 L-11 -6 L-11 7 Z" fill="${c.art.accentColor}"/>
        <path d="M0 0 L11 -6 L11 7 Z" fill="${c.art.accentColor}"/>
        <circle cx="0" cy="0" r="3.2" fill="${c.art.accentColor}" stroke="rgba(0,0,0,0.25)"/>
      </g>`,
    halo: (c) => `
      <ellipse cx="50" cy="6" rx="16" ry="4.4" fill="none" stroke="${c.art.accentColor}" stroke-width="2.6" opacity="0.95"/>`,
    horn: (c) => `
      <path d="M32 20 C28 12 27 6 30 2 C34 7 37 13 38 19 Z" fill="${c.art.accentColor}"/>
      <path d="M68 20 C72 12 73 6 70 2 C66 7 63 13 62 19 Z" fill="${c.art.accentColor}"/>`,
    visor: (c) => `
      <path d="M28 42 L72 42 L70 50 L30 50 Z" fill="${c.art.accentColor}" opacity="0.85"/>
      <path d="M28 42 L72 42 L71.5 44 L28.5 44 Z" fill="#fff" opacity="0.5"/>`,
    hairpin: (c) => `
      <g transform="translate(31 28) rotate(-18)">
        <rect x="-7" y="-1.6" width="14" height="3.2" rx="1.6" fill="${c.art.accentColor}"/>
        <circle cx="7" cy="0" r="2.4" fill="${c.art.accentColor}"/>
      </g>`,
    circlet: (c) => `
      <path d="M31 30 C38 24 62 24 69 30" fill="none" stroke="${c.art.accentColor}" stroke-width="2.2"/>
      <path d="M50 24 l3.4 5.4 -3.4 3 -3.4 -3 Z" fill="${c.art.accentColor}"/>`,
    none: () => '',
  };

  /* ============================================================
     表情
     ============================================================ */

  /** @type {Record<string, {brow: string, mouth: string}>} */
  const EXPRESSION = {
    calm:   { brow: 'M36 37 C39 35 43 35 46 36 M54 36 C57 35 61 35 64 37', mouth: 'M47 59 C49 61 51 61 53 59' },
    gentle: { brow: 'M36 38 C39 35 43 35 46 37 M54 37 C57 35 61 35 64 38', mouth: 'M46 58 C49 62 51 62 54 58' },
    fierce: { brow: 'M36 34 C39 35 43 36 46 38 M54 38 C57 36 61 35 64 34', mouth: 'M46 59 L54 59' },
    cool:   { brow: 'M36 36 L46 37 M54 37 L64 36', mouth: 'M47 59 L53 58' },
    smug:   { brow: 'M36 37 C39 34 43 35 46 37 M54 36 C57 35 61 36 64 38', mouth: 'M46 58 C49 62 52 60 54 57' },
  };

  /* ============================================================
     組み立て
     ============================================================ */

  /**
   * 顔のパーツ（目・眉・口）を描く。
   * @param {any} c
   * @param {boolean} male
   */
  function face(c, male) {
    const skin = c.art.skin || DEFAULT_SKIN;
    const eyeRy = male ? 4.8 : 6.4;
    const eyeRx = male ? 4.6 : 5.4;
    const expr = EXPRESSION[c.art.expression] || EXPRESSION.calm;
    const headPath = male
      ? 'M31 43 C31 28 39 20 50 20 C61 20 69 28 69 43 C69 56 61 69 50 69 C39 69 31 56 31 43 Z'
      : 'M32 43 C32 29 39 21 50 21 C61 21 68 29 68 43 C68 57 60 70 50 70 C40 70 32 57 32 43 Z';

    /** @param {number} cx */
    const eye = (cx) => `
      <ellipse cx="${cx}" cy="46" rx="${eyeRx}" ry="${eyeRy}" fill="#fff"/>
      <ellipse cx="${cx}" cy="46.5" rx="${eyeRx * 0.78}" ry="${eyeRy * 0.86}" fill="url(#eyeG)"/>
      <circle cx="${cx}" cy="46.8" r="${eyeRx * 0.36}" fill="#1a1420"/>
      <circle cx="${cx - eyeRx * 0.34}" cy="${44.4}" r="${eyeRx * 0.30}" fill="#fff" opacity="0.95"/>
      <circle cx="${cx + eyeRx * 0.30}" cy="${48.6}" r="${eyeRx * 0.16}" fill="#fff" opacity="0.6"/>
      <path d="M${cx - eyeRx - 0.6} ${46 - eyeRy * 0.7} C${cx - eyeRx * 0.4} ${46 - eyeRy - 1.4} ${cx + eyeRx * 0.6} ${46 - eyeRy - 1} ${cx + eyeRx + 0.4} ${46 - eyeRy * 0.55}"
            fill="none" stroke="#2b2233" stroke-width="${male ? 1.5 : 2}" stroke-linecap="round"/>`;

    return `
      <path d="${headPath}" fill="${skin}"/>
      <path d="M32 44 C34 56 40 66 50 68 C60 66 66 56 68 44 C68 58 60 70 50 70 C40 70 32 58 32 44 Z" fill="${SKIN_SHADE}" opacity="0.35"/>
      <ellipse cx="30.5" cy="46" rx="2.6" ry="4" fill="${skin}"/>
      <ellipse cx="69.5" cy="46" rx="2.6" ry="4" fill="${skin}"/>
      ${male ? '' : `<ellipse cx="38" cy="54" rx="4" ry="2.2" fill="#ff9aa2" opacity="0.35"/>
                     <ellipse cx="62" cy="54" rx="4" ry="2.2" fill="#ff9aa2" opacity="0.35"/>`}
      ${eye(41)}
      ${eye(59)}
      <path d="${expr.brow}" fill="none" stroke="url(#hairD)" stroke-width="1.7" stroke-linecap="round"/>
      <path d="M50 52 l1.2 2.2 -1.4 0.5" fill="none" stroke="${SKIN_SHADE}" stroke-width="0.9" stroke-linecap="round" opacity="0.8"/>
      <path d="${expr.mouth}" fill="none" stroke="#c06a72" stroke-width="1.4" stroke-linecap="round"/>`;
  }

  /**
   * 首と肩（衣装）。
   * @param {any} c
   * @param {boolean} male
   */
  function bust(c, male) {
    const skin = c.art.skin || DEFAULT_SKIN;
    const shoulder = male
      ? 'M14 112 C16 90 30 78 50 78 C70 78 84 90 86 112 Z'
      : 'M18 112 C20 92 32 80 50 80 C68 80 80 92 82 112 Z';
    return `
      <path d="M44 64 h12 v12 h-12 Z" fill="${skin}"/>
      <path d="M44 68 h12 v6 c-4 3 -8 3 -12 0 Z" fill="${SKIN_SHADE}" opacity="0.5"/>
      <path d="${shoulder}" fill="url(#outfitG)"/>
      <path d="M40 79 L50 92 L60 79 L56 78 L50 86 L44 78 Z" fill="${c.art.outfitTrim}"/>
      <path d="M${male ? 14 : 18} 112 C${male ? 16 : 20} 96 26 86 34 82 L38 90 C30 94 24 102 22 112 Z" fill="${c.art.outfitTrim}" opacity="0.55"/>
      <path d="M${male ? 86 : 82} 112 C${male ? 84 : 80} 96 74 86 66 82 L62 90 C70 94 76 102 78 112 Z" fill="${c.art.outfitTrim}" opacity="0.55"/>`;
  }

  /**
   * 髪のリムライト。頭頂に沿った光の帯で、平坦なベタ塗りに立体感を足す。
   * @param {any} c
   */
  function rimLight(c) {
    return `
      <path d="M32 34 C36 22 44 17 50 17 C56 17 64 22 68 34"
            fill="none" stroke="${c.art.hairLight || '#ffffff'}" stroke-width="2.6"
            stroke-linecap="round" opacity="0.55"/>
      <path d="M38 26 C42 21 48 20 52 21"
            fill="none" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" opacity="0.4"/>`;
  }

  /**
   * SVGの定義（グラデーション）。
   * @param {any} c
   * @param {string} id
   */
  function defs(c, id) {
    const a = c.art;
    return `
      <defs>
        <radialGradient id="bg-${id}" cx="32%" cy="22%" r="88%">
          <stop offset="0%" stop-color="${c.color}"/>
          <stop offset="100%" stop-color="${c.accent || '#12151c'}"/>
        </radialGradient>
        <linearGradient id="hairG-${id}" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stop-color="${a.hairLight || a.hairColor}"/>
          <stop offset="60%" stop-color="${a.hairColor}"/>
          <stop offset="100%" stop-color="${a.hairDark}"/>
        </linearGradient>
        <linearGradient id="hairD-${id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${a.hairDark}"/>
          <stop offset="100%" stop-color="${a.hairDark}"/>
        </linearGradient>
        <linearGradient id="eyeG-${id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${a.eyeLight || a.eye}"/>
          <stop offset="100%" stop-color="${a.eye}"/>
        </linearGradient>
        <linearGradient id="outfitG-${id}" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stop-color="${a.outfitLight || a.outfit}"/>
          <stop offset="100%" stop-color="${a.outfit}"/>
        </linearGradient>
      </defs>`;
  }

  /**
   * バストアップのアイコンSVGを返す (§1.3 アイコンはバストアップ構図)。
   * @param {any} c キャラクター定義
   * @returns {string}
   */
  function iconSvg(c) {
    if (!c.art) return '';
    const id = 'a' + (uid++);
    const male = c.art.gender === 'male';
    const hair = HAIR[c.art.hair] || HAIR.long;
    const accessory = ACCESSORY[c.art.accessory || 'none'] || ACCESSORY.none;

    // グラデーション参照をこのSVG固有のIDへ差し替える
    const localize = (/** @type {string} */ s) =>
      s.replace(/url\(#(hairG|hairD|eyeG|outfitG)\)/g, (_, g) => `url(#${g}-${id})`);

    return `<svg viewBox="0 0 100 112" xmlns="http://www.w3.org/2000/svg" class="art-svg" aria-hidden="true">
      ${defs(c, id)}
      <rect width="100" height="112" fill="url(#bg-${id})"/>
      <circle cx="50" cy="46" r="40" fill="#fff" opacity="0.07"/>
      ${localize(hair.back(c))}
      ${localize(bust(c, male))}
      ${localize(face(c, male))}
      ${localize(hair.front(c))}
      ${rimLight(c)}
      ${localize(accessory(c))}
    </svg>`;
  }

  /**
   * 立ち絵（半身）SVGを返す (§1.3 立ち絵は動的なポーズ)。
   * アイコンより引きの構図で、腰から上と武器のシルエットを描く。
   * @param {any} c
   * @returns {string}
   */
  function standeeSvg(c) {
    if (!c.art) return '';
    const id = 'b' + (uid++);
    const male = c.art.gender === 'male';
    const hair = HAIR[c.art.hair] || HAIR.long;
    const accessory = ACCESSORY[c.art.accessory || 'none'] || ACCESSORY.none;
    const skin = c.art.skin || DEFAULT_SKIN;
    const localize = (/** @type {string} */ s) =>
      s.replace(/url\(#(hairG|hairD|eyeG|outfitG)\)/g, (_, g) => `url(#${g}-${id})`);

    return `<svg viewBox="0 0 100 150" xmlns="http://www.w3.org/2000/svg" class="art-svg" aria-hidden="true">
      ${defs(c, id)}
      <rect width="100" height="150" fill="url(#bg-${id})"/>
      <circle cx="50" cy="52" r="46" fill="#fff" opacity="0.06"/>
      <!-- 背後に構えた得物のシルエット -->
      <g opacity="0.85" transform="rotate(-20 50 92)">
        <rect x="80" y="34" width="3.6" height="86" rx="1.8" fill="${c.art.accentColor}" opacity="0.7"/>
        <path d="M81.8 24 l7 12 -7 9 -7 -9 Z" fill="${c.art.accentColor}" opacity="0.8"/>
      </g>
      ${localize(hair.back(c))}

      <!-- 首 -->
      <path d="M44 64 h12 v12 h-12 Z" fill="${skin}"/>
      <path d="M44 68 h12 v6 c-4 3 -8 3 -12 0 Z" fill="${SKIN_SHADE}" opacity="0.5"/>

      <!-- 胴（腰にかけて広がるシルエット） -->
      <path d="M${male ? 30 : 32} 150
               C${male ? 30 : 32} 116 33 92 50 78
               C67 92 ${male ? 70 : 68} 116 ${male ? 70 : 68} 150 Z" fill="url(#outfitG-${id})"/>
      <path d="M40 80 L50 97 L60 80 L56 78 L50 90 L44 78 Z" fill="${c.art.outfitTrim}"/>

      <!-- 腕（肩から手までひと続きに描き、袖口で手に繋げる） -->
      <path d="M35 83 C25 92 20 106 19 121 C18.4 127 26.6 128 27 122 C28 109 32 99 39 93 Z" fill="url(#outfitG-${id})"/>
      <path d="M65 83 C75 92 80 106 81 121 C81.6 127 73.4 128 73 122 C72 109 68 99 61 93 Z" fill="url(#outfitG-${id})"/>
      <path d="M18.6 119 h9 v4 h-9 Z" fill="${c.art.outfitTrim}"/>
      <path d="M72.4 119 h9 v4 h-9 Z" fill="${c.art.outfitTrim}"/>
      <path d="M19 123 C19 130 27 130 27 123 C27 121 19 121 19 123 Z" fill="${skin}"/>
      <path d="M73 123 C73 130 81 130 81 123 C81 121 73 121 73 123 Z" fill="${skin}"/>

      <!-- 腰のベルト -->
      <path d="M33 116 C40 120 60 120 67 116 L67 123 C60 127 40 127 33 123 Z" fill="${c.art.accentColor}" opacity="0.85"/>
      <circle cx="50" cy="120" r="3.2" fill="${c.art.outfit}" stroke="${c.art.accentColor}" stroke-width="1"/>

      ${localize(face(c, male))}
      ${localize(hair.front(c))}
      ${rimLight(c)}
      ${localize(accessory(c))}
    </svg>`;
  }

  RPG.art = { iconSvg, standeeSvg, HAIR, ACCESSORY, EXPRESSION };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
