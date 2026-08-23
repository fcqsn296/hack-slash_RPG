// @ts-check
/**
 * シーンの再生 (§20.2)。
 *
 * ── なぜマップの吹き出しと分けるのか ──
 * マップ上の会話は「歩いている途中の一言」で、閉じればすぐ探索に戻る。
 * 章のシーンは複数行を順に読ませるもので、読み終わるまで探索へ戻さない。
 * 同じ吹き出しで兼ねると、途中で歩けてしまって台詞が飛ぶ。
 *
 * ── 送りだけで戻れないのはなぜか ──
 * 戻れるようにすると「どこまで読んだか」を別に持つことになる。
 * 読み返しは後から章の一覧に付けるほうが素直なので、ここは一方通行にしてある。
 */
(function (RPG) {
  'use strict';
  const h = RPG.dom.h;
  const W = RPG.widgets;

  /** @type {HTMLElement|null} */
  let root = null;
  /** @type {any} */
  let scene = null;
  let index = 0;
  /** @type {(() => void)|null} */
  let onDone = null;
  /** @type {((e: KeyboardEvent) => void)|null} */
  let keyHandler = null;

  /**
   * シーンを再生する。読み終わったら done を呼ぶ。
   * @param {HTMLElement} el
   * @param {any} sc
   * @param {() => void} done
   */
  function play(el, sc, done) {
    root = el;
    scene = sc;
    index = 0;
    onDone = done;
    bindKeys();
    render();
  }

  function close() {
    if (keyHandler) window.removeEventListener('keydown', keyHandler);
    keyHandler = null;
    root = null;
    scene = null;
    onDone = null;
  }

  function bindKeys() {
    if (keyHandler) window.removeEventListener('keydown', keyHandler);
    keyHandler = (e) => {
      if (!root) return;
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', keyHandler);
  }

  /** 1行送る。最後まで来たら終わる。 */
  function next() {
    if (!scene) return;
    if (index < scene.lines.length - 1) { index++; render(); return; }
    const done = onDone;
    close();
    if (done) done();
  }

  /** 残りをまとめて読む。既読でなくても飛ばせるようにしてある。 */
  function skip() {
    const done = onDone;
    close();
    if (done) done();
  }

  function render() {
    if (!root || !scene) return;
    const line = scene.lines[index];
    const who = line.who ? RPG.data.characters[line.who] : null;
    const last = index >= scene.lines.length - 1;

    root.replaceChildren(
      h('div.scene',
        h('div.scene-stage',
          // 話し手の立ち絵。地の文のときは何も置かない。
          who ? h('div.scene-portrait', W.portrait(who, 'lg')) : null,
          h('div.scene-box' + (who ? '' : '.is-narration'),
            who ? h('span.scene-who', {
              text: line.who === 'ch_hero' ? RPG.state.charName('ch_hero') : who.name,
            }) : null,
            h('p.scene-text', { text: line.text })
          )
        ),
        h('div.scene-foot',
          h('span.scene-count', { text: `${index + 1} / ${scene.lines.length}` }),
          h('div.scene-btns',
            // 送りが主。飛ばしは目立たせない。
            last ? null : W.button('とばす', skip, { variant: 'ghost' }),
            W.button(last ? '閉じる' : '次へ', next, { variant: 'primary' })
          )
        ),
        h('p.hint.hint-sm.scene-hint', { text: 'Enter / スペース でも進みます。' })
      )
    );
  }

  RPG.ui.story = { play, close, render };
})(window.RPG || (window.RPG = { data: {}, plugins: {}, ui: {} }));
