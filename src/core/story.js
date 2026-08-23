// @ts-check
/**
 * 物語の進行 (§20.2)。
 *
 * ── 何を持ち、何を持たないか ──
 * ここは「次にどのシーンを再生すべきか」だけを決める。
 * 文章の見せ方は src/ui/story.js、歩く処理は worldmap.js に任せる。
 *
 * ── 進行を数え直さない ──
 * マップのイベントが既にフラグを立てている (§20)。
 * 話の進行を別の数え方で持つと二重帳簿になり、必ずどこかでずれる。
 * ここはそのフラグを読むだけで、独自の進行度は **再生済みのシーンID** しか持たない。
 *
 * 進行はストーリー側のプロファイルにしか置かない (§20)。
 */
(function (RPG) {
  'use strict';

  /** 進行の入れ物。欠けているキーは補って返す。 */
  function progress() {
    const p = RPG.state.storyProfile();
    if (!p.progress) p.progress = {};
    const g = p.progress;
    if (!g.flags) g.flags = {};
    if (!g.cleared) g.cleared = {};
    // 再生済みのシーン。並び順ではなくIDで覚えるので、
    // 後からシーンを差し込んでも既存のセーブがずれない。
    if (!g.scenes) g.scenes = {};
    if (g.chapter === undefined) g.chapter = null;
    return g;
  }

  /** 章の一覧。 */
  function chapters() {
    return (RPG.data.story && RPG.data.story.chapters) || [];
  }

  /** @param {string} id */
  function chapterDef(id) {
    return chapters().filter((/** @type {any} */ c) => c.id === id)[0] || null;
  }

  /** いま進めている章。まだ始めていなければ null。 */
  function current() {
    return chapterDef(progress().chapter);
  }

  /**
   * 物語を始める（または続きに入る）。
   *
   * 既に始めていれば何もしない。最初から数え直すと、
   * 拠点から入り直すたびに冒頭のシーンが流れることになる。
   */
  function start() {
    const g = progress();
    if (!g.chapter) {
      const first = chapters()[0];
      if (!first) return null;
      g.chapter = first.id;
      RPG.state.storyProfile().started = true;
      RPG.state.persist();
    }
    return current();
  }

  /**
   * その条件が今そろっているか。
   * @param {any} when
   */
  function satisfied(when) {
    if (!when) return true;                 // 条件なし＝章に入った時点
    const flags = progress().flags || {};
    if (when.flag) return !!flags[when.flag];
    if (when.flags) return when.flags.every((/** @type {string} */ f) => !!flags[f]);
    return true;
  }

  /** @param {any} scene */
  function played(scene) {
    return !!progress().scenes[scene.id];
  }

  /**
   * いま再生すべきシーン。無ければ null。
   *
   * 章の中を頭から見て、**まだ再生しておらず条件がそろっている**最初のものを返す。
   * 条件で引くので、探索の順序は縛らない。寄り道してから戻っても同じところで挟まる。
   */
  function pending() {
    const c = current();
    if (!c) return null;
    for (const sc of c.scenes || []) {
      if (played(sc)) continue;
      if (satisfied(sc.when)) return sc;
    }
    return null;
  }

  /**
   * シーンを再生済みにして、後始末（then）を実行する。
   *
   * 画面側は文章を出し切ってからこれを呼ぶ。
   * 先に呼ぶと、読んでいる途中で次のマップへ飛ばされる。
   *
   * @param {any} scene
   * @returns {{ ok: boolean, enterMap?: string, cleared?: string, nextChapter?: string }}
   */
  function finish(scene) {
    if (!scene) return { ok: false };
    const g = progress();
    g.scenes[scene.id] = true;

    /** @type {any} */
    const out = { ok: true };
    const then = scene.then || {};
    if (then.flag) g.flags[then.flag] = true;
    if (then.enterMap) out.enterMap = then.enterMap;

    if (then.clear) {
      const c = current();
      if (c) {
        g.cleared[c.id] = true;
        out.cleared = c.id;
        // 次の章があれば進める。無ければ「ここまで」を示すために null に戻さず、
        // クリア済みの章に留めておく（続きが増えたときに自然に繋がる）。
        const list = chapters();
        const idx = list.findIndex((/** @type {any} */ x) => x.id === c.id);
        const next = list[idx + 1];
        if (next) { g.chapter = next.id; out.nextChapter = next.id; }
      }
    }
    RPG.state.persist();
    return out;
  }

  /** その章を終えているか。 @param {string} id */
  function isCleared(id) {
    return !!progress().cleared[id];
  }

  /**
   * 章の進み具合。拠点の入口に出す。
   * @returns {{ chapter: any, done: number, total: number, cleared: boolean }|null}
   */
  function status() {
    const c = current();
    if (!c) return null;
    const list = c.scenes || [];
    return {
      chapter: c,
      done: list.filter(played).length,
      total: list.length,
      cleared: isCleared(c.id),
    };
  }

  /**
   * 読み返し用の一覧 (§20.6)。
   *
   * ── なぜ「見た場面」しか出さないのか ──
   * 全部並べると、まだ読んでいない章のシーン名から先が透ける。
   * 章そのものは、1つでも読み終えていれば見出しを出す。
   * どこまで来たかが分かるほうが、続きを探しやすい。
   *
   * @returns {Array<{chapter: any, cleared: boolean, scenes: Array<{scene: any, played: boolean}>, done: number, total: number}>}
   */
  function log() {
    return chapters().map((c) => {
      const list = (c.scenes || []).map((sc) => ({ scene: sc, played: played(sc) }));
      return {
        chapter: c,
        cleared: isCleared(c.id),
        scenes: list.filter((x) => x.played),
        done: list.filter((x) => x.played).length,
        total: list.length,
      };
    }).filter((x) => x.done > 0);
  }

  RPG.story = {
    progress, chapters, chapterDef, current, start,
    satisfied, played, pending, finish, isCleared, status, log,
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
