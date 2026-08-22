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
    const debut = debutOf(results);
    const fast = !!st.fast;

    const layer = h('div.gfx');
    const core = h('div.gfx-core');
    const rays = h('div.gfx-rays');
    const ring = h('div.gfx-ring');
    const label = h('div.gfx-label');
    const hint = h('div.gfx-hint');
    layer.append(rays, ring, core, label, hint);
    document.body.appendChild(layer);

    /** @type {number[]} */
    const timers = [];
    let done = false;
    // 名乗りに入ったら飛ばさない (§6.7)。
    // 初めての1体が出た瞬間は、この演出そのものが見せ場なので、
    // 指が当たっただけで消えてしまうと取り返しがつかない。
    let skippable = true;

    const finish = () => {
      if (done) return;
      done = true;
      for (const t of timers) clearTimeout(t);
      layer.remove();
      running = null;
      onDone();
    };

    /** 名乗りへ飛ぶ。予約してある続きは全部捨てる */
    let jumpToDebut = null;

    /**
     * 触られたときの振る舞い。
     *
     * 名乗りが控えているときは **結果へは飛ばさず、名乗りへ飛ぶ**。
     * ここを素通しにすると、焦らしている最中に指が当たっただけで
     * 初めての1体の披露ごと消える。飛ばしたいのは溜めであって、
     * 見せ場ではない。
     */
    const onTap = () => {
      if (done) return;
      if (jumpToDebut) { jumpToDebut(); return; }
      if (skippable) finish();
    };
    running = onTap;
    layer.addEventListener('pointerdown', onTap);

    const at = (ms, fn) => timers.push(setTimeout(fn, fast ? Math.round(ms * 0.5) : ms));

    const tint = (rarity) => {
      layer.style.setProperty('--gfx-color', RPG.data.rarities[rarity].color);
    };

    // ── 色が決まるまで ──
    //
    // ── 溜めるのはレジェンドのときだけ ──
    // 最初はレアリティに応じて段を増やしていたが、ノーマルでも
    // 1.7秒待たされることになった。周回のたびにそれでは邪魔にしかならない。
    // **焦らす価値があるのは、上がるかもしれない相手だけ**なので、
    // 溜めはレジェンドに限る。それ以外は素直に色を出して弾けさせる。
    layer.style.setProperty('--gfx-color', '#ffffff');
    layer.classList.add('is-charging');

    const isTop = top === 'LEGEND';
    let t = isTop ? 700 : 420;

    if (!isTop) {
      // 上位でないときは一息で決める。
      at(t, () => {
        tint(top);
        layer.classList.add('is-tinted');
      });
      t += 260;
    } else {
      // レジェンドだけ、下の色から順に上がる。
      // 一段ごとに止めて、上がる直前に光を絞る。
      // 落ちたと思わせてから跳ね上げると、上がり幅が大きく感じる。
      ORDER.forEach((rarity, i) => {
        const last = i === ORDER.length - 1;
        const hold = i === 0 ? 260 : 300 + i * 190;
        t += hold;
        at(t, () => {
          layer.classList.add('is-hold');
          if (!last) layer.classList.add('is-dim');
        });

        t += last ? 420 : 260;
        at(t, () => {
          layer.classList.remove('is-hold', 'is-dim');
          tint(rarity);
          layer.classList.add('is-tinted');
          if (i > 0) {
            // 段が上がった手応え。CSSアニメを掛け直すため一度外す。
            layer.classList.remove('is-promoted');
            void layer.offsetWidth;
            layer.classList.add('is-promoted');
            if (!last) spawnSparks(layer, 6);
          }
        });
      });
    }

    // ── 弾ける ──
    t += isTop ? 520 : 240;
    at(t, () => {
      layer.classList.add('is-locked', 'is-burst');
      label.textContent = RPG.data.rarities[top].en || RPG.data.rarities[top].label;
      if (isTop) layer.classList.add('is-legend');
      if (isTop) spawnSparks(layer, 26);
      else if (top === 'SUPER_RARE') spawnSparks(layer, 12);
    });

    if (!debut) {
      // 飛ばせることを一度だけ伝える。押しどころを探させない。
      at(t + 250, () => { hint.textContent = 'タップで結果へ'; });
      at(t + (isTop ? 1200 : 650), finish);
      return;
    }

    // 名乗りが控えているときは、何が起きるかを先に言っておく。
    // 「飛ばせない」と後から知るより、飛ばす先が名乗りだと分かるほうがよい。
    at(600, () => { hint.textContent = 'タップで先へ'; });

    // ── 名乗り (§6.7) ──
    // ここから先は飛ばせない。
    const startDebut = () => {
      if (done || !jumpToDebut) return;
      jumpToDebut = null;
      // 予約してある途中経過を捨てる。飛んできた場合に
      // 後から「弾ける」が走ると、名乗りの上に重なる。
      for (const id of timers) clearTimeout(id);
      timers.length = 0;

      skippable = false;
      hint.textContent = '';
      // 飛んできた場合でも、色と弾けだけは見せてから名乗りへ移る。
      tint(top);
      layer.classList.remove('is-hold', 'is-dim');
      layer.classList.add('is-locked', 'is-burst', 'is-legend');
      label.textContent = RPG.data.rarities[top].en || RPG.data.rarities[top].label;

      timers.push(setTimeout(() => {
        layer.classList.add('is-debut');
        layer.appendChild(buildDebut(debut));
      }, fast ? 260 : 520));
      // 影から始めて、光が当たってから顔が見える。
      timers.push(setTimeout(() => {
        layer.classList.add('is-debut-lit');
      }, fast ? 760 : 1520));
      timers.push(setTimeout(finish, fast ? 3600 : 6200));
    };
    jumpToDebut = startDebut;

    at(t + 500, startDebut);
  }

  /**
   * 初獲得レジェンドの名乗り (§6.7)。
   *
   * 立ち絵を横から差し込み、名前と二つ名を重ねる。
   * 顔と名前が結び付いていないと、一覧に増えた1行でしかない。
   *
   * @param {any} p 引いた結果
   */
  function buildDebut(p) {
    const def = RPG.data.characters[p.id];
    const box = h('div.gfx-debut');

    // 斜めの帯。立ち絵の後ろを走らせて、視線を中央へ寄せる。
    box.appendChild(h('div.gfx-cutin'));
    box.appendChild(h('div.gfx-cutin.is-second'));

    // 影から始める。誰なのかを一拍おいて見せたい。
    // いきなり全部見えると、立ち絵が一覧の1枚と変わらなくなる。
    const art = h('div.gfx-standee');
    art.appendChild(RPG.widgets.standee(def));
    box.appendChild(art);

    // 光が横に走って、影を照らす
    box.appendChild(h('div.gfx-sweep'));

    box.appendChild(h('div.gfx-debut-text',
      h('span.gfx-debut-rare', { text: RPG.data.rarities[p.rarity].en || RPG.data.rarities[p.rarity].label }),
      h('b.gfx-debut-name', { text: RPG.state.charName(p.id) }),
      h('span.gfx-debut-title', { text: def.title || '' }),
      h('span.gfx-debut-new', { text: 'NEW' })
    ));
    return box;
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
  /**
   * 名乗りを出すべき結果を返す。無ければ null。
   * 判定そのものをテストから確かめられるように切り出してある。
   * @param {any[]} results
   */
  function debutOf(results) {
    return (results || []).find((/** @type {any} */ p) =>
      p.kind === 'new' && p.rarity === 'LEGEND') || null;
  }

  /**
   * 弾けるまでにかける時間 (§6.7)。
   *
   * レアリティが上がるほど段が増え、そのぶん焦らされる。
   * 画面を動かさずに確かめられるよう、計算だけを切り出してある。
   *
   * @param {string} top その引きの最高レアリティ
   * @returns {number} ミリ秒
   */
  function burstDelay(top) {
    if (top !== 'LEGEND') return 420 + 260 + 240;
    let t = 700;
    ORDER.forEach((_, i) => {
      const last = i === ORDER.length - 1;
      t += i === 0 ? 260 : 300 + i * 190;   // 溜め
      t += last ? 420 : 260;                // 色が乗る
    });
    return t + 520;
  }

  RPG.ui.gachafx = { play, skip, topRarity, debutOf, burstDelay };
})(window.RPG || (window.RPG = { data: {}, plugins: {}, ui: {} }));
