// @ts-check
/**
 * マップ探索の画面 (§20)。
 *
 * ── 描き方について ──
 * タイルは CSS Grid で1マス1要素。いまは色で塗り分けているだけだが、
 * 本物のタイル画像を用意したら `background-image` を足すだけで済む。
 * **マップの形式も worldmap.js も変えなくてよい。**
 *
 * 主人公の駒は顔アイコンを流用する。歩くのは1人だけなので (§20)、
 * 見下ろしのスプライトを描き起こさなくても成立する。
 */
(function (RPG) {
  'use strict';
  const h = RPG.dom.h;
  const W = RPG.widgets;

  /** @type {HTMLElement|null} */
  let root = null;
  /** @type {((e: KeyboardEvent) => void)|null} */
  let keyHandler = null;

  /** いま出している吹き出し。null なら何も出ていない */
  let message = null;

  function mount(el) {
    root = el;
    bindKeys();
    render();
  }

  function unmount() {
    if (keyHandler) window.removeEventListener('keydown', keyHandler);
    keyHandler = null;
    root = null;
  }

  /** 矢印キーとWASDで歩く。スマホ用のボタンは画面側に置く。 */
  function bindKeys() {
    if (keyHandler) window.removeEventListener('keydown', keyHandler);
    keyHandler = (e) => {
      if (!root) return;
      const map = {
        ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
        w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
      };
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); interact(); return; }
      const d = map[e.key];
      if (!d) return;
      e.preventDefault();
      step(d[0], d[1]);
    };
    window.addEventListener('keydown', keyHandler);
  }

  /**
   * 1歩進める。
   * 戦闘に入る場合はここで画面を明け渡すので、描き直さない。
   */
  function step(dx, dy) {
    // 吹き出しが出ているあいだは動かない。読み飛ばしを防ぐ。
    if (message) { message = null; render(); return; }

    const r = RPG.worldmap.move(dx, dy);
    if (r.encounter) { RPG.app.startStoryBattle(r.encounter); return; }
    if (r.event) {
      // 乗った瞬間に起きるもの（宝箱・出口）はその場で解決する。
      // 会話だけは「調べる」で読む形にして、通りすがりに流れないようにする。
      if (r.event.kind !== 'talk' && r.event.kind !== 'join') fire(r.event);
    }
    render();
  }

  /** 決定ボタン。向いている先を調べる。 */
  function interact() {
    if (message) { message = null; render(); return; }
    const ev = RPG.worldmap.facing();
    if (ev) fire(ev);
    render();
  }

  /** @param {any} ev */
  function fire(ev) {
    const res = RPG.worldmap.resolve(ev);
    if (!res.ok) return;
    if (res.kind === 'chest') {
      const parts = [];
      if (res.gained.gold) parts.push(`${res.gained.gold.toLocaleString()} G`);
      for (const b of Object.keys(res.gained.boxes || {})) {
        parts.push(`${RPG.data.boxes[b].name}×${res.gained.boxes[b]}`);
      }
      message = { text: parts.join('、') + ' を手に入れた。' };
      RPG.app.refreshTopbar();
    } else if (res.kind === 'talk') {
      message = { text: res.text, who: res.who };
    } else if (res.kind === 'join') {
      const name = RPG.state.charName(res.who);
      message = { text: `${res.text}

── ${name} が仲間になった。`, who: res.who };
      RPG.app.refreshTopbar();
    }
    // exit は enter() が現在地を変えているので、描き直すだけでよい
  }

  function render() {
    if (!root) return;
    const pos = RPG.worldmap.current();
    if (!pos) { root.replaceChildren(h('p', { text: 'マップに入っていません' })); return; }
    const m = RPG.worldmap.def(pos.id);

    const cells = [];
    for (let y = 0; y < m.tiles.length; y++) {
      for (let x = 0; x < m.tiles[y].length; x++) {
        const t = RPG.worldmap.tileAt(m, x, y);
        const ev = RPG.worldmap.eventAt(m, x, y);
        const done = ev && RPG.worldmap.isDone(ev);
        const cell = h('div.wm-cell', { style: `--tile: ${t.color}` });
        // 済ませたものは印を消す。開けた宝箱がいつまでも光っていると
        // 「まだ何かある」と誤解させる。
        if (ev && !done) cell.classList.add('is-event', 'ev-' + ev.kind);
        if (x === pos.x && y === pos.y) cell.classList.add('is-here');
        cells.push(cell);
      }
    }

    const hero = RPG.state.get().characters.ch_hero;
    const grid = h('div.wm-grid', {
      style: `--cols: ${m.tiles[0].length}; --rows: ${m.tiles.length}`,
    }, ...cells);

    // 駒は grid の上に重ねる。マス自体を書き換えるより、
    // 移動のたびに1要素だけ動かすほうが素直。
    const marker = h('div.wm-hero', {
      style: `--x: ${pos.x}; --y: ${pos.y}`,
    }, W.portrait(hero ? RPG.data.characters.ch_hero : null, 'sm'));
    grid.appendChild(marker);

    // replaceChildren は Node 以外を **文字列にして** 差し込む。
    // null をそのまま渡すと画面に「null」と出る。実際に出た。
    // h() は子の null を捨ててくれるが、ここは h() を通っていない。
    const parts = [
      h('div.wm-head',
        h('h2', { text: m.name }),
        h('p.hint.hint-sm', { text: m.desc || '' }),
        h('p.hint.hint-sm', {
          text: m.encounter ? '草の上では敵が出る。道と階段は安全。' : 'ここでは敵は出ない。',
        })
      ),
      h('div.wm-viewport', grid),
      message ? h('div.wm-message',
        message.who ? W.portrait(RPG.data.characters[message.who], 'sm') : null,
        h('p', { text: message.text }),
        W.button('閉じる', () => { message = null; render(); }, { variant: 'ghost' })
      ) : null,
      h('div.wm-pad',
        h('div'), padBtn('↑', 0, -1), h('div'),
        padBtn('←', -1, 0),
        W.button('調べる', interact, { variant: 'primary' }),
        padBtn('→', 1, 0),
        h('div'), padBtn('↓', 0, 1), h('div')
      ),
      h('div.wm-actions',
        W.button('拠点へ戻る', () => RPG.app.showBase(), { variant: 'ghost' })
      ),
    ];
    root.replaceChildren(...parts.filter((n) => !!n));
  }

  function padBtn(label, dx, dy) {
    return W.button(label, () => step(dx, dy), { variant: 'ghost' });
  }

  RPG.ui.worldmap = { mount, unmount, render };
})(window.RPG || (window.RPG = { data: {}, plugins: {}, ui: {} }));
