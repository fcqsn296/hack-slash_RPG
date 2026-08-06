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

  RPG.dom = { h, $, clear, replace };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
