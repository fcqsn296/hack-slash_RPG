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
    if (message) { dismiss(); return; }

    const r = RPG.worldmap.move(dx, dy);
    if (r.encounter) { RPG.app.startStoryBattle(r.encounter); return; }
    if (r.event) {
      // 乗った瞬間に起きるもの（宝箱・出口）はその場で解決する。
      // 会話だけは「調べる」で読む形にして、通りすがりに流れないようにする。
      // 会話と加入だけは「調べる」で読む形にして、通りすがりに流れないようにする。
      // 戦いと場面転換は乗った時点で起きてよい（避けて通れると話が進まない）。
      if (r.event.kind !== 'talk' && r.event.kind !== 'join') {
        fire(r.event);
        // 戦闘に入ったならこの画面はもう無い
        if (r.event.kind === 'battle') return;
      }
    }
    // 出口で別のマップへ移ると「見た」印が立つ。そこで挟まるシーンがある。
    if (!message && afterEvent()) return;
    render();
  }

  /** 決定ボタン。向いている先を調べる。 */
  function interact() {
    if (message) { dismiss(); return; }
    // 足元が先。乗ったまま調べられないと、歩けるマスに置いたイベントが拾えない。
    const under = RPG.worldmap.here();
    const ev = (under && !RPG.worldmap.isDone(under)) ? under : RPG.worldmap.facing();
    if (ev) fire(ev);
    // 吹き出しが出たなら、それを読み終えるまでシーンは挟まない。
    // 先に挟むと「仲間になった」の一言が飲み込まれて消える。
    if (!message && afterEvent()) return;
    render();
  }

  /**
   * 吹き出しを閉じる。
   *
   * 閉じた直後が、章のシーンを挟む場所 (§20.2)。
   * 仲間が加わった／宝箱を開けたことでフラグが立ち、
   * その結果として再生できるようになったシーンがここで流れる。
   */
  function dismiss() {
    // 閉じたあとに続きがある吹き出し（戦闘の紹介文など）。
    // 先に取り出してから message を空にする——then の中で画面を
    // 明け渡すことがあるので、後始末を残したまま渡さない。
    const then = message && message.then;
    message = null;
    if (then) { then(); return; }
    if (afterEvent()) return;
    render();
  }

  /**
   * 溜まったシーンがあれば画面を明け渡す。
   * @returns {boolean} 明け渡したなら true（呼び出し側は描き直さないこと）
   */
  function afterEvent() {
    return !!(RPG.app.playPendingScene && RPG.app.playPendingScene());
  }

  /** @param {any} ev */
  function fire(ev) {
    const res = RPG.worldmap.resolve(ev);
    if (!res.ok) return;
    if (res.kind === 'battle') {
      // 紹介文があるなら、先に見せてから戦わせる。
      // data/maps.js には書いてあったのに `res.text` を捨てていて、
      // マスに乗るといきなり戦闘が始まっていた（書いた文章が死んでいた）。
      if (res.text && !message) {
        message = { who: null, text: res.text, then: () => {
          RPG.app.startStoryBattle(res.enc, { mapFlag: res.flag });
        } };
        render();
        return;
      }
      // 決まった相手との戦い。ここで画面を明け渡すので描き直さない。
      RPG.app.startStoryBattle(res.enc, { mapFlag: res.flag });
      return;
    }
    if (res.kind === 'scene') return;   // 印が立つだけ。本編は afterEvent が拾う
    if (res.kind === 'chest') {
      const parts = [];
      if (res.gained.gold) parts.push(`${res.gained.gold.toLocaleString()} G`);
      for (const b of Object.keys(res.gained.boxes || {})) {
        parts.push(`${RPG.data.boxes[b].name}×${res.gained.boxes[b]}`);
      }
      // 名前の付いた装備は最後に、鑑定が要らないことを添えて出す。
      // 宝箱と並べて書くと、どちらも「開けてのお楽しみ」に見えてしまう。
      const eq = res.gained.equip;
      let text = parts.length ? parts.join('、') + ' を手に入れた。' : '';
      if (eq) {
        text += (text ? '\n\n' : '')
          + `「${eq.name}」を手に入れた。\n${describeEquip(eq)}`;
      }
      message = { text };
      RPG.app.refreshTopbar();
    } else if (res.kind === 'talk') {
      message = echoesNextScene(res.text) ? null : { text: res.text, who: res.who };
    } else if (res.kind === 'join') {
      const name = RPG.state.charName(res.who);
      RPG.app.refreshTopbar();
      const joined = `── ${name} が仲間になった。`;
      message = echoesNextScene(res.text)
        ? { text: joined, who: res.who }
        : { text: `${res.text}\n\n${joined}`, who: res.who };
    }
    // exit は enter() が現在地を変えているので、描き直すだけでよい
  }

  /**
   * このマスの文章が、直後に始まるシーンと同じことを言っているか。
   *
   * ── なぜ「pending があるか」で判定してはいけないか ──
   * 最初そう書いたら、**重複していない台詞まで消えた**。
   * リゼルの加入の一言と長老の一言は、たまたま直後にシーンが挟まるだけで
   * 中身は別だった。飛ばすかどうかは「続きがあるか」ではなく
   * **同じことを言っているか**で決めないと、書いた文章が黙って落ちる。
   *
   * 突き合わせは、記号と空白を落とした先頭の一文で行う。
   * 完全一致にすると「——一つだけ、まだ薄く光っている。」と
   * 「——一つだけ、まだ光の残っている箱があった。」を別物と見てしまう。
   *
   * @param {string} text
   * @returns {boolean}
   */
  function echoesNextScene(text) {
    const scene = RPG.story.pending();
    if (!scene || !text) return false;
    const first = (scene.lines && scene.lines[0] && scene.lines[0].text) || '';
    /** @param {string} s */
    const head = (s) => s.replace(/[\s—――…。、「」『』]/g, '').slice(0, 12);
    const a = head(text);
    const b = head(first);
    if (!a || !b) return false;
    return a.startsWith(b.slice(0, 8)) || b.startsWith(a.slice(0, 8));
  }

  /**
   * どこで敵が出るかの案内文を、**そのマップに実際にあるマス**から作る。
   *
   * 固定文で「草の上では敵が出る。道と階段は安全。」と書いていたが、
   * 封絶の浅層には草が1マスも無く、敵が出るのは床だった。
   * 案内が嘘になっていて、床が安全に見える。
   *
   * マスの種類は `encounter` を自分で宣言しているので、そこから引けば
   * マップが増えても文章を書き直さなくて済む。
   *
   * @param {any} m
   */
  function encounterHint(m) {
    if (!m.encounter) return 'ここでは敵は出ない。';
    const kinds = RPG.data.tileKinds || {};
    // 実際に置かれているマスの種類だけを見る。legend に書いてあっても
    // 1マスも使われていない種類を数えると、また嘘の案内になる。
    /** @type {Set<string>} */
    const used = new Set();
    for (const row of m.tiles || []) {
      for (const ch of row) {
        const kind = (m.legend || {})[ch];
        if (kind && kinds[kind] && kinds[kind].walk) used.add(kind);
      }
    }
    /** @param {boolean} want */
    const labels = (want) => [...used]
      .filter((k) => !!kinds[k].encounter === want)
      .map((k) => kinds[k].label);

    const risky = labels(true);
    const safe = labels(false);
    if (!risky.length) return 'ここでは敵は出ない。';
    return `${risky.join('と')}の上では敵が出る。`
      + (safe.length ? `${safe.join('と')}は安全。` : '');
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
          text: encounterHint(m),
        })
      ),
      h('div.wm-viewport', grid),
      message ? h('div.wm-message',
        message.who ? W.portrait(RPG.data.characters[message.who], 'sm') : null,
        h('p', { text: message.text }),
        W.button('閉じる', dismiss, { variant: 'ghost' })
      ) : null,
      h('div.wm-pad',
        h('div'), padBtn('↑', 0, -1), h('div'),
        padBtn('←', -1, 0),
        W.button('調べる', interact, { variant: 'primary' }),
        padBtn('→', 1, 0),
        h('div'), padBtn('↓', 0, 1), h('div')
      ),
      h('div.wm-actions',
        // 拠点はストーリー側のまま開く。装備や育成をいじってから探索へ戻れる。
        // モードごと抜けるのは拠点側の「ハクスラへ戻る」から。
        W.button('拠点へ戻る', () => RPG.app.showBase(), { variant: 'ghost' }),
        h('span.hint.hint-sm', { text: chapterLabel() })
      ),
    ];
    root.replaceChildren(...parts.filter((n) => !!n));

    // 駒を見える位置へ寄せる。
    //
    // 横20マスのマップ（灰の野・集落・封絶の浅層）は、狭い画面だと
    // 地図が横スクロール領域になる。**スクロールが駒を追わない**ので、
    // 東へ歩くと自分が枠の外へ出たまま、どこにいるか分からず歩くことになる。
    // 実測では x=17 で駒の左端 520px に対しビューポートの右端が 501px だった。
    //
    // 縦も同じ理屈で寄せておく。今のマップは縦が収まっているが、
    // 増えたときに同じことが起きる。
    const view = root.querySelector('.wm-viewport');
    const pawn = root.querySelector('.wm-hero');
    if (view instanceof HTMLElement && pawn instanceof HTMLElement) {
      const cx = pawn.offsetLeft + pawn.offsetWidth / 2 - view.clientWidth / 2;
      const cy = pawn.offsetTop + pawn.offsetHeight / 2 - view.clientHeight / 2;
      view.scrollLeft = Math.max(0, Math.min(cx, view.scrollWidth - view.clientWidth));
      view.scrollTop = Math.max(0, Math.min(cy, view.scrollHeight - view.clientHeight));
    }
  }

  /**
   * 拾った装備の中身を1行で。
   * 「手に入れた」だけだと、強いのかどうか分からないまま話が進む。
   * @param {any} it
   */
  function describeEquip(it) {
    const parts = [];
    for (const k of Object.keys(it.stats || {})) {
      if (it.stats[k]) parts.push(`${RPG.units.STAT_LABEL[k] || k} +${it.stats[k]}`);
    }
    for (const b of it.tagBonuses || []) {
      parts.push(`[${RPG.damage.TAG_LABEL[b.tag]}] +${Math.round(b.value * 100)}%`);
    }
    if (it.critRate) parts.push(`会心 +${Math.round(it.critRate * 100)}%`);
    if (it.reduction) parts.push(`被ダメ軽減 +${Math.round(it.reduction * 100)}%`);
    if (it.capBreak) parts.push(`上限突破 +${Math.round(it.capBreak * 100)}%`);
    return parts.join(' ／ ');
  }

  /** いま何章のどこなのか。歩いているあいだ見失わないよう足元に出す。 */
  function chapterLabel() {
    const st = RPG.story && RPG.story.status();
    if (!st) return '';
    return `${st.chapter.name}（${st.done} / ${st.total}）`;
  }

  function padBtn(label, dx, dy) {
    return W.button(label, () => step(dx, dy), { variant: 'ghost' });
  }

  RPG.ui.worldmap = { mount, unmount, render };
})(window.RPG || (window.RPG = { data: {}, plugins: {}, ui: {} }));
