// @ts-check
/**
 * 極小の DOM ヘルパー。フレームワークは使わない。
 */
(function (RPG) {
  'use strict';

  /**
   * 要素を作る。
   * @param {string} tag 'div.card.is-active' のようにクラスを付けられる
   * @param {Record<string, any>|null} [attrs]
   * @param {...(Node|string|null|undefined|Array<Node|string>)} children
   * @returns {HTMLElement}
   */
  function h(tag, attrs, ...children) {
    const parts = tag.split('.');
    const el = document.createElement(parts[0]);
    for (let i = 1; i < parts.length; i++) el.classList.add(parts[i]);

    // 属性を省略して子要素から書き始められるようにする。
    // 配列・Node・文字列が来たら、それは属性ではなく最初の子。
    if (Array.isArray(attrs) || attrs instanceof Node || typeof attrs === 'string') {
      children.unshift(/** @type {any} */ (attrs));
      attrs = null;
    }

    if (attrs) {
      for (const key of Object.keys(attrs)) {
        const value = attrs[key];
        if (value == null || value === false) continue;
        if (key === 'style' && typeof value === 'object') {
          Object.assign(el.style, value);
        } else if (key.startsWith('on') && typeof value === 'function') {
          el.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (key === 'text') {
          el.textContent = String(value);
        } else if (key === 'html') {
          el.innerHTML = String(value);
        } else {
          el.setAttribute(key, String(value));
        }
      }
    }

    for (const child of children.flat()) {
      if (child == null || child === false) continue;
      el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return el;
  }

  /**
   * @param {string} selector
   * @returns {HTMLElement}
   */
  function $(selector) {
    const el = document.querySelector(selector);
    if (!el) throw new Error('要素が見つかりません: ' + selector);
    return /** @type {HTMLElement} */ (el);
  }

  /** @param {HTMLElement} el */
  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
    return el;
  }

  /**
   * @param {HTMLElement} el
   * @param {...(Node|null|undefined)} children
   */
  function replace(el, ...children) {
    clear(el);
    for (const child of children) if (child) el.appendChild(child);
    return el;
  }

  /**
   * 画面の端からのスワイプで、板を引き出す (§15)。
   *
   * ── なぜここに置くのか ──
   * もとはビルド画面のキャラ一覧だけが持っていた。戦闘でも同じ所作が要るので、
   * **判定だけを切り出した**。写すと、どちらかを直したときにもう片方が古いまま残る。
   *
   * ── 縦スクロールを邪魔しないこと ──
   * 指が最初に動いた向きで判定して、縦のほうが大きければ**その指は捨てる**。
   * ここを見ないと、一覧を縦に送るつもりの指が板を開いてしまう。
   *
   * 途中経過は追わない。しきい値を越えた時点で開閉を伝え、板の動きは
   * CSS の transition に任せる。指で板を追わせると、戻す途中で指を離した
   * ときの扱いを自分で書くことになる。
   *
   * @param {object} o
   * @param {() => boolean} o.enabled その画面・その幅で効かせるか
   * @param {() => boolean} o.isOpen  いま開いているか
   * @param {() => void} o.open
   * @param {() => void} o.close
   * @param {number} [o.edge] 端と見なす幅。既定28pxは親指の腹で狙える幅。
   *   広げると板の中で横に払う操作まで拾う
   * @param {number} [o.threshold] 開閉を決める移動量。既定60px
   */
  function edgeSwipe(o) {
    if (typeof document === 'undefined') return;
    let x0 = 0, y0 = 0, fromEdge = false, axis = '', tracking = false;
    const edge = o.edge == null ? 28 : o.edge;
    const need = o.threshold == null ? 60 : o.threshold;

    document.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1 || !o.enabled()) { tracking = false; return; }
      const t = e.touches[0];
      x0 = t.clientX; y0 = t.clientY; axis = '';
      fromEdge = x0 <= edge;
      tracking = fromEdge || o.isOpen();
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!tracking || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - x0;
      const dy = t.clientY - y0;
      if (!axis) {
        // 12px 動くまでは向きを決めない。決め打ちが早いと誤判定する
        if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
        axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (axis === 'y') { tracking = false; return; }
      }
      if (!o.isOpen() && fromEdge && dx > need) { tracking = false; o.open(); }
      else if (o.isOpen() && dx < -need) { tracking = false; o.close(); }
    }, { passive: true });

    document.addEventListener('touchend', () => { tracking = false; }, { passive: true });
  }

  RPG.dom = { h, $, clear, replace, edgeSwipe };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
