// @ts-check
/**
 * 画面をまたいで使う共通パーツ。
 *
 * キャラクターアートは未実装のため、ここではキャラ固有色＋紋様のプレースホルダーを描く。
 * 実際のアイコン画像を用意したら portrait() だけを差し替えればよい。
 */
(function (RPG) {
  'use strict';
  const { h } = RPG.dom;

  const ELEMENT_COLOR = {
    none: '#9aa3ad', fire: '#ff7a5c', water: '#5fa8ff', wind: '#5fe0bc',
    earth: '#d2a862', light: '#ffd76a', dark: '#b58cff',
  };

  /**
   * アイコン（CC0の単色SVGをマスクとして使い、currentColor で塗る）。
   * 素材ファイルには手を触れないので、差し替えはファイルの置き換えだけで済む。
   *
   * @param {string} name assets/ui/ 内のファイル名（拡張子なし）
   * @param {{size?: string, color?: string}} [opts]
   */
  function icon(name, opts) {
    opts = opts || {};
    const cfg = RPG.data.artConfig;
    const url = (cfg.basePath || '') + (cfg.uiDir || 'assets/ui/') + name + '.svg';
    const el = h('span.icn', { 'aria-hidden': 'true', 'data-icon': name });
    el.style.webkitMaskImage = 'url("' + url + '")';
    el.style.maskImage = 'url("' + url + '")';
    if (opts.size) el.style.fontSize = opts.size;
    if (opts.color) el.style.color = opts.color;
    return el;
  }

  /** 属性 → アイコン名 */
  const ELEMENT_ICON = {
    none: 'elem-none', fire: 'elem-fire', water: 'elem-water', wind: 'elem-wind',
    earth: 'elem-earth', light: 'elem-light', dark: 'elem-dark',
  };

  /** 系統タグ → アイコン名 */
  const TAG_ICON = { phys: 'tag-phys', magi: 'tag-magi', reli: 'tag-reli' };

  /** ステータス → アイコン名 */
  const STAT_ICON = { hp: 'stat-hp', atk: 'stat-atk', def: 'stat-def', magi_power: 'stat-magi' };

  /** 装備スロット → アイコン名 */
  const SLOT_ICON = { weapon: 'slot-weapon', armor: 'tab-gear', accessory: 'slot-accessory' };

  /**
   * 属性バッジ
   * @param {string} element
   */
  function elementChip(element) {
    return h('span.chip.chip-element', {
      style: { color: ELEMENT_COLOR[element], borderColor: ELEMENT_COLOR[element] + '66' },
    },
      icon(ELEMENT_ICON[element]),
      h('span', { text: RPG.damage.ELEMENT_LABEL[element] })
    );
  }

  /**
   * レアリティバッジ
   * @param {string} rarity
   */
  function rarityChip(rarity) {
    const r = RPG.data.rarities[rarity];
    return h('span.chip.chip-rarity', {
      style: { color: r.color, borderColor: r.color + '66' },
      text: r.label,
    });
  }

  /**
   * 系統タグバッジ
   * @param {string} tag
   */
  function tagChip(tag) {
    return h('span.chip.chip-tag', { 'data-tag': tag },
      icon(TAG_ICON[tag]),
      h('span', { text: '[' + RPG.damage.TAG_LABEL[tag] + ']' })
    );
  }

  /**
   * キャラ／敵の顔グラフィック (§1.3)。
   *
   * 優先順位:
   *   1. art.image に本番イラストのパスがあればそれを表示
   *   2. art があれば src/ui/art.js でアニメ調SVGを生成
   *   3. どちらも無ければ（敵など）紋様のプレースホルダー
   *
   * @param {any} src キャラクター定義または戦闘ユニット
   * @param {string} [size] 'sm' | 'md' | 'lg'
   */
  function portrait(src, size) {
    const accent = src.accent || '#101318';
    const el = h('div.portrait.portrait-' + (size || 'md'), {
      style: {
        background: `radial-gradient(circle at 30% 25%, ${src.color}, ${accent} 72%)`,
        boxShadow: `0 0 0 1px ${src.color}55, 0 8px 24px -10px ${src.color}aa`,
      },
    });

    // まず即座に描けるもの（生成SVG or 紋様）を入れておき、
    // 画像が見つかったら差し替える。読み込み失敗時に壊れた画像が出ることがない。
    if (src.art) {
      // 生成したマークアップは全てこちらの管理下にあり、外部入力は含まれない
      el.insertAdjacentHTML('afterbegin', RPG.art.iconSvg(src));
    } else {
      el.appendChild(h('span.portrait-glyph', { text: src.glyph }));
    }

    el.appendChild(h('span.portrait-element', {
      style: { background: ELEMENT_COLOR[src.element] },
      text: RPG.damage.ELEMENT_LABEL[src.element],
    }));

    if (src.art) attachIcon(el, src);
    return el;
  }

  /**
   * 顔アイコン画像を非同期で流し込む。
   * 専用のアイコン画像があればそれを、無ければ立ち絵から顔を切り抜いて使う。
   * @param {HTMLElement} el
   * @param {any} src
   */
  function attachIcon(el, src) {
    RPG.artSource.icon(src).then((iconPath) => {
      if (iconPath) {
        swapIn(el, h('img.portrait-img', { src: iconPath, alt: '' }));
        return;
      }
      // 専用アイコンが無いので立ち絵から切り抜く
      return RPG.artSource.standee(src).then((standeePath) => {
        if (!standeePath) return;
        const img = /** @type {HTMLImageElement} */ (h('img.portrait-img.is-cropped', { src: standeePath, alt: '' }));

        /** 現在分かっている範囲で位置を合わせる */
        const place = () => RPG.faceCrop.applyRect(
          img,
          RPG.faceCrop.rectFor(src.art, standeePath),
          { width: img.naturalWidth, height: img.naturalHeight }
        );

        img.addEventListener('load', place);
        place();
        swapIn(el, img);

        // 顔の自動検出が終わったら位置を微調整する
        if (!src.art.face) {
          RPG.faceCrop.detect(standeePath).then((rect) => {
            if (rect && img.isConnected) {
              RPG.faceCrop.applyRect(img, rect, { width: img.naturalWidth, height: img.naturalHeight });
            }
          });
        }
      });
    });
  }

  /**
   * 生成SVG／紋様を実画像に差し替える。
   * @param {HTMLElement} el
   * @param {HTMLElement} node
   */
  function swapIn(el, node) {
    const placeholder = el.querySelector('.art-svg, .portrait-glyph');
    el.insertBefore(node, el.firstChild);
    if (placeholder) placeholder.remove();
  }

  /**
   * 立ち絵（全身）。キャラクター詳細で使う (§1.3)。
   * 画像が無い場合は生成SVGの半身構図で代替する。
   * @param {any} src
   */
  function standee(src) {
    const el = h('div.standee');

    if (src.art) {
      el.insertAdjacentHTML('afterbegin', RPG.art.standeeSvg(src));
    } else {
      return portrait(src, 'lg');
    }

    el.appendChild(h('span.portrait-element', {
      style: { background: ELEMENT_COLOR[src.element] },
      text: RPG.damage.ELEMENT_LABEL[src.element],
    }));

    RPG.artSource.standee(src).then((path) => {
      if (!path) return;
      const img = h('img.standee-img', { src: path, alt: '' });
      const placeholder = el.querySelector('.art-svg');
      el.insertBefore(img, el.firstChild);
      if (placeholder) placeholder.remove();
      el.classList.add('has-image');
    });

    return el;
  }

  /**
   * HPバー。
   * prevHp を渡すと、直前のHPから今のHPまで遅れて追いかける帯（ゴースト）を出す。
   * 一瞬で減る本体バーの後ろで削れ幅が見えるので、どれだけ入ったか把握しやすい。
   * @param {number} hp
   * @param {number} maxHp
   * @param {string} [color]
   * @param {number} [prevHp]
   */
  function hpBar(hp, maxHp, color, prevHp) {
    const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
    const hue = pct > 50 ? '#4ee08a' : pct > 22 ? '#ffc75f' : '#ff6b6b';

    const bar = h('div.hpbar');
    if (prevHp != null && prevHp > hp) {
      const prevPct = Math.max(0, Math.min(100, (prevHp / maxHp) * 100));
      const ghost = h('div.hpbar-ghost', { style: { width: prevPct + '%' } });
      bar.appendChild(ghost);
      // 次のフレームで縮め始める（いきなり最終値にすると遷移が起きない）
      requestAnimationFrame(() => { ghost.style.width = pct + '%'; });
    }
    bar.appendChild(h('div.hpbar-fill', { style: { width: pct + '%', background: color || hue } }));
    bar.appendChild(h('span.hpbar-text', { text: `${Math.ceil(hp).toLocaleString()} / ${maxHp.toLocaleString()}` }));
    return bar;
  }

  /**
   * 装備カード
   * @param {any} item
   * @param {{compact?: boolean, onClick?: (e: Event) => void, selected?: boolean, equippedBy?: string}} [opts]
   */
  function itemCard(item, opts) {
    opts = opts || {};
    const r = RPG.data.rarities[item.rarity];
    const statLines = Object.keys(item.stats).map((k) =>
      h('div.item-stat', h('span', { text: RPG.units.STAT_LABEL[k] }), h('b', { text: '+' + item.stats[k] }))
    );
    const affixLines = item.affixLines.map((/** @type {any} */ a) =>
      h('div.item-affix', h('span', { text: a.label }), h('b', { text: a.value }))
    );

    return h('div.item-card' + (opts.selected ? '.is-selected' : ''), {
      style: { borderColor: r.color + '55' },
      onClick: opts.onClick,
      role: opts.onClick ? 'button' : null,
      tabindex: opts.onClick ? '0' : null,
      onKeydown: opts.onClick
        ? (/** @type {KeyboardEvent} */ e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onClick(e); } }
        : null,
    },
      h('div.item-head',
        h('span.item-name', { style: { color: r.color }, text: item.name }),
        item.plus ? h('span.item-plus', { text: '+' + item.plus }) : null,
        tagChip(item.tag)
      ),
      h('div.item-sub',
        h('span', { text: RPG.units.SLOT_LABEL[item.slot] }),
        rarityChip(item.rarity),
        // 装備セット (§7.7)。揃えると効果が出るので、一目で分かるようにする
        item.setId && RPG.data.equipSets[item.setId]
          ? h('span.item-set', {
              style: { color: RPG.data.equipSets[item.setId].color },
              text: RPG.data.equipSets[item.setId].name + 'セット',
            })
          : null,
        // ユニーク装備 (§7.8)。系統タグを持たない代わりに固有効果を持つ
        item.uniqueId && RPG.data.uniqueEquips[item.uniqueId]
          ? h('span.item-unique', {
              style: { color: RPG.data.uniqueEquips[item.uniqueId].color },
              text: 'ユニーク',
            })
          : null,
        opts.equippedBy ? h('span.item-equipped', { text: '装備中: ' + opts.equippedBy }) : null,
        opts.locked ? h('span.item-locked', { text: '🔒 ロック' }) : null
      ),
      h('div.item-stats', statLines),
      affixLines.length ? h('div.item-affixes', affixLines) : null
    );
  }

  /**
   * ボタン
   * @param {string} label
   * @param {(e: Event) => void} onClick
   * @param {{variant?: string, disabled?: boolean, sub?: string, title?: string}} [opts]
   */
  function button(label, onClick, opts) {
    opts = opts || {};
    return h('button.btn' + (opts.variant ? '.btn-' + opts.variant : ''), {
      onClick, disabled: opts.disabled ? 'disabled' : null, title: opts.title || null,
    },
      h('span.btn-label', { text: label }),
      opts.sub ? h('span.btn-sub', { text: opts.sub }) : null
    );
  }

  /**
   * セクション見出し
   * @param {string} title
   * @param {string} [sub]
   */
  function heading(title, sub) {
    return h('div.heading',
      h('h2', { text: title }),
      sub ? h('p', { text: sub }) : null
    );
  }

  /**
   * 敵の立ち絵 (§1.3)。
   *
   * 味方と違い、顔の切り抜きは一切しない。生成した画像（832×1216 想定）を
   * そのままの構図で表示する。画像が無ければ紋様タイルで代替する。
   *
   * @param {any} src 敵の定義または戦闘ユニット
   * @param {{boss?: boolean}} [opts]
   */
  function enemyArt(src, opts) {
    opts = opts || {};
    const accent = src.accent || '#101318';
    const el = h('div.enemy-art' + (opts.boss ? '.is-boss' : ''), {
      style: {
        background: `radial-gradient(circle at 50% 30%, ${src.color}33, ${accent} 78%)`,
      },
    });

    // 画像が来るまでは紋様を出しておき、届いたら差し替える
    el.appendChild(h('span.enemy-glyph', { text: src.glyph }));
    el.appendChild(h('span.portrait-element', {
      style: { background: ELEMENT_COLOR[src.element] },
      text: RPG.damage.ELEMENT_LABEL[src.element],
    }));

    RPG.artSource.enemy(src).then((path) => {
      if (!path || !el.isConnected) return;
      const img = h('img.enemy-img', { src: path, alt: '' });
      el.insertBefore(img, el.firstChild);
      const glyph = el.querySelector('.enemy-glyph');
      if (glyph) glyph.remove();
      el.classList.add('has-image');
    });

    return el;
  }

  /**
   * 立ち絵を原寸で見せる拡大表示 (§13)。
   *
   * 一覧や詳細では枠に合わせて切り抜いているが、せっかく 832×1216 で描いたものなので
   * ここでは一切切らずに全体を出す。画面より大きい場合だけ縮める（object-fit: contain）。
   *
   * @param {any} src キャラクター定義 / 敵定義 / 戦闘ユニット
   * @param {{kind?: 'character'|'enemy', caption?: string}} [opts]
   */
  function artLightbox(src, opts) {
    opts = opts || {};
    const kind = opts.kind || (src.side === 'enemy' || RPG.data.enemies[src.id] ? 'enemy' : 'character');

    const stage = h('div.lightbox-stage');
    const info = h('span.lightbox-info', { text: '読み込み中…' });
    const overlay = h('div.lightbox', { role: 'dialog', 'aria-modal': 'true' },
      h('div.lightbox-bar',
        h('span.lightbox-title', { text: opts.caption || src.name || '' }),
        info,
        button('閉じる', () => close(), { variant: 'ghost' })
      ),
      stage
    );

    function close() {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
    }
    /** @param {KeyboardEvent} e */
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    }
    overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target === stage) close(); });
    document.addEventListener('keydown', onKey);

    const resolve = kind === 'enemy' ? RPG.artSource.enemy(src) : RPG.artSource.standee(src);
    resolve.then((path) => {
      if (!overlay.isConnected) return;
      if (!path) {
        // 画像が無いキャラは生成SVGを大きく出す。何も出ないより分かりやすい。
        info.textContent = '立ち絵は未設定（生成イラストを表示しています）';
        const box = h('div.lightbox-svg');
        box.insertAdjacentHTML('afterbegin', RPG.art.standeeSvg(src));
        stage.appendChild(box);
        return;
      }
      const img = h('img.lightbox-img', { src: path, alt: '' });
      img.addEventListener('load', () => {
        info.textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
      });
      stage.appendChild(img);
    });

    document.body.appendChild(overlay);
    return overlay;
  }

  RPG.widgets = {
    elementChip, rarityChip, tagChip, portrait, standee, enemyArt, artLightbox,
    hpBar, itemCard, button, heading, ELEMENT_COLOR,
    icon, ELEMENT_ICON, TAG_ICON, STAT_ICON, SLOT_ICON,
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
