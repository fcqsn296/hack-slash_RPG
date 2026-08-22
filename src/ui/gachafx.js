// @ts-check
/**
 * ガチャの演出 (§6.7)。
 *
 * ── 何をしているか ──
 * 引いた結果は一瞬で確定しているが、**それをすぐ見せない**。
 * 光が育ち、色が決まり、1枚ずつめくれる。この「決まるまでの間」が
 * 引く楽しさの正体なので、そこに時間を使う。
 *
 * ── 色は先に見せて、最後まで隠す ──
 * 光の色はその引きの **最高レアリティ** を映す。ただし演出の途中で
 * 一段上へ化けることがある（昇格）。最初から答えが見えていると
 * めくる意味が無くなり、かといって完全に無地だと何も期待できない。
 *
 * ── 必ず飛ばせる ──
 * 10連を何度も回す遊びなので、毎回同じ演出を見せられるのは苦痛になる。
 * 画面のどこを触っても即座に結果へ飛ぶ。設定で丸ごと切ることもできる。
 */
(function (RPG) {
  'use strict';
  const h = RPG.dom.h;

  const ORDER = ['COMMON', 'RARE', 'SUPER_RARE', 'LEGEND'];

  /** いま流れている演出。飛ばすときに使う */
  let running = null;

  /** レアリティの強さを数値で */
  function rank(r) {
    const i = ORDER.indexOf(r);
    return i < 0 ? 0 : i;
  }

  /** その引きでいちばん強いレアリティ */
  function topRarity(results) {
    let best = 'COMMON';
    for (const p of results) if (rank(p.rarity) > rank(best)) best = p.rarity;
    return best;
  }

  /**
   * 演出を流す。終わったら onDone を呼ぶ。
   *
   * @param {any[]} results 引いた結果
   * @param {() => void} onDone
   */
  function play(results, onDone) {
    // 設定で切っていれば何もしない。周回する人のための逃げ道 (§6.7)。
    const st = RPG.state.get().settings || {};
    if (st.gachaFx === false || !results.length) { onDone(); return; }

    const top = topRarity(results);
    const color = RPG.data.rarities[top].color;
    const fast = !!st.fast;

    const layer = h('div.gfx');
    const core = h('div.gfx-core');
    const rays = h('div.gfx-rays');
    const ring = h('div.gfx-ring');
    const label = h('div.gfx-label');
    layer.append(rays, ring, core, label);
    // 触ったら飛ばす。押しどころを探させない。
    layer.addEventListener('pointerdown', () => finish());
    document.body.appendChild(layer);

    /** @type {number[]} */
    const timers = [];
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      for (const t of timers) clearTimeout(t);
      layer.remove();
      running = null;
      onDone();
    };
    running = finish;

    const at = (ms, fn) => timers.push(setTimeout(fn, fast ? Math.round(ms * 0.45) : ms));

    // ── 1. 光が育つ ──
    // 最初は白。まだ何色になるか分からない、という時間を作る。
    layer.style.setProperty('--gfx-color', '#ffffff');
    layer.classList.add('is-charging');

    // ── 2. 色が決まる ──
    // 一段下の色を先に見せてから上げると、上がった瞬間に跳ねる。
    // 最高が COMMON のときは昇格しない（嘘にならないように）。
    const teaseAt = rank(top) > 0 ? ORDER[rank(top) - 1] : top;
    at(520, () => {
      layer.style.setProperty('--gfx-color', RPG.data.rarities[teaseAt].color);
      layer.classList.add('is-tinted');
    });

    at(1000, () => {
      layer.style.setProperty('--gfx-color', color);
      if (teaseAt !== top) layer.classList.add('is-promoted');
      layer.classList.add('is-locked');
      label.textContent = RPG.data.rarities[top].label;
    });

    // ── 3. 弾ける ──
    // レジェンドだけは長く、強く。ここを他と同じにすると、
    // 出たときの手応えが消える。
    const isTop = top === 'LEGEND';
    at(1240, () => {
      layer.classList.add('is-burst');
      if (isTop) layer.classList.add('is-legend');
      if (isTop) spawnSparks(layer, 26);
      else if (top === 'SUPER_RARE') spawnSparks(layer, 12);
    });

    at(isTop ? 2200 : 1750, finish);
  }

  /**
   * 火花を撒く。数と向きだけ変えて、あとはCSSに任せる。
   * @param {HTMLElement} layer @param {number} n
   */
  function spawnSparks(layer, n) {
    for (let i = 0; i < n; i++) {
      const a = (360 / n) * i + (Math.random() * 20 - 10);
      const d = 120 + Math.random() * 180;
      layer.appendChild(h('span.gfx-spark', {
        style: `--a: ${a}deg; --d: ${d}px; --delay: ${Math.random() * 0.18}s`,
      }));
    }
  }

  /** 流れている演出があれば飛ばす */
  function skip() {
    if (running) running();
  }

  // RPG.ui は base.js が用意するが、こちらが先に読まれることがある
  // （テストページは base.js を読み込まない）。無ければ自分で作る。
  RPG.ui = RPG.ui || {};
  RPG.ui.gachafx = { play, skip, topRarity };
})(window.RPG || (window.RPG = { data: {}, plugins: {}, ui: {} }));
