// @ts-check
/**
 * マップ探索 (§20)。
 *
 * ── 何を持ち、何を持たないか ──
 * ここは「どこに立っていて、次に何が起きるか」だけを決める。
 * 描画は src/ui/worldmap.js、戦闘は battle.js に任せる。
 * 分けておくと、図形で描いても本物のタイル画像を貼っても
 * このファイルは一切変わらない。
 *
 * ── 歩くのは主人公だけ ──
 * パーティは主人公が先頭に固定なので (§8.1)、代表として1人だけ歩かせる。
 * 仲間は戦闘のときに揃う。見下ろしの絵が1人ぶんで済む。
 *
 * 現在地はストーリー側のプロファイルにしか置かない。
 * ハクスラ側の周回とは完全に別のデータ (§20)。
 */
(function (RPG) {
  'use strict';

  /** @param {string} id */
  function def(id) {
    return RPG.data.maps[id];
  }

  /** いまの探索状態。まだ入っていなければ null */
  function current() {
    const p = RPG.state.storyProfile();
    return (p.progress && p.progress.map) || null;
  }

  /**
   * マップに入る。
   * @param {string} mapId
   * @param {{x: number, y: number}} [at] 入る位置。省略すると start
   */
  function enter(mapId, at) {
    const m = def(mapId);
    if (!m) throw new Error(`マップ ${mapId} が見つかりません`);
    const p = RPG.state.storyProfile();
    if (!p.progress) p.progress = { chapter: null, scene: 0, cleared: {}, flags: {} };
    // 「そのマップを見た」印 (§20.2)。
    // 物語のシーンは、探索が立てたフラグをそのまま読む。
    // 進行を別の数え方で持つと二重帳簿になってずれる。
    if (!p.progress.flags) p.progress.flags = {};
    p.progress.flags['saw_' + mapId] = true;

    const pos = at || m.start;
    p.progress.map = {
      id: mapId,
      x: pos.x, y: pos.y,
      // 向き。絵を差し替えるときに使う。いまは記号の向きに使う。
      dir: 'down',
      // エンカウントまでの歩数。入るたびに配り直す。
      steps: 0,
    };
    RPG.state.persist();
    return p.progress.map;
  }

  /**
   * そのマスのタイル種別。範囲外は壁として扱う。
   * @param {any} m @param {number} x @param {number} y
   */
  function tileAt(m, x, y) {
    const row = m.tiles[y];
    if (!row || x < 0 || x >= row.length) return RPG.data.tileKinds.wall;
    const kind = m.legend[row[x]];
    return RPG.data.tileKinds[kind] || RPG.data.tileKinds.wall;
  }

  /**
   * そのマスにあるイベント。
   * @param {any} m @param {number} x @param {number} y
   */
  function eventAt(m, x, y) {
    return (m.events || []).find((/** @type {any} */ e) => e.x === x && e.y === y) || null;
  }

  /** 済ませたイベントかどうか。flag を持つものだけが一度きりになる。 */
  function isDone(ev) {
    if (!ev || !ev.flag) return false;
    const p = RPG.state.storyProfile();
    return !!(p.progress.flags || {})[ev.flag];
  }

  /** @param {string} flag */
  function setFlag(flag) {
    const p = RPG.state.storyProfile();
    if (!p.progress.flags) p.progress.flags = {};
    p.progress.flags[flag] = true;
  }

  /**
   * 1マス動く。
   *
   * 戻り値で「何が起きたか」を全部返す。画面側はそれを見て描くだけにする。
   * ここで直接 UI を触ると、テストから動かせなくなる。
   *
   * @param {number} dx @param {number} dy
   * @returns {{ok: boolean, reason?: string, pos?: any, event?: any, encounter?: any}}
   */
  function move(dx, dy) {
    const pos = current();
    if (!pos) return { ok: false, reason: 'マップに入っていない' };
    const m = def(pos.id);
    if (!m) return { ok: false, reason: 'マップが見つからない' };

    // 向きは進めなくても変える。壁に向き直れないと操作が硬く感じる。
    pos.dir = dy < 0 ? 'up' : dy > 0 ? 'down' : dx < 0 ? 'left' : 'right';

    const nx = pos.x + dx;
    const ny = pos.y + dy;
    const tile = tileAt(m, nx, ny);
    if (!tile.walk) {
      RPG.state.persist();
      return { ok: false, reason: '進めない', pos };
    }

    pos.x = nx;
    pos.y = ny;
    pos.steps = (pos.steps || 0) + 1;

    // マスの上のイベントが先。宝箱を開けた瞬間に襲われると、
    // 何を拾ったのか分からないまま戦闘に入る。
    const ev = eventAt(m, nx, ny);
    if (ev && !isDone(ev)) {
      RPG.state.persist();
      return { ok: true, pos, event: ev };
    }

    // エンカウント。安全なタイル（道・階段）の上では起きない。
    const enc = m.encounter;
    if (enc && tile.encounter && RPG.rng.chance(enc.rate || 0.1)) {
      RPG.state.persist();
      return { ok: true, pos, encounter: enc };
    }

    RPG.state.persist();
    return { ok: true, pos };
  }

  /**
   * いま立っているマスのイベントを実行する。
   *
   * move() は「何があるか」を返すだけで、中身は動かさない。
   * 拾うか拾わないかを画面側が決められるようにしてある。
   *
   * @param {any} ev
   * @returns {{ok: boolean, kind?: string, text?: string, gained?: any, to?: any}}
   */
  function resolve(ev) {
    if (!ev) return { ok: false };
    if (isDone(ev)) return { ok: false };

    if (ev.kind === 'chest') {
      const gained = { gold: ev.gold || 0, boxes: ev.boxes || {} };
      if (gained.gold) RPG.state.addGold(gained.gold);
      for (const b of Object.keys(gained.boxes)) RPG.state.addBox(b, gained.boxes[b]);
      if (ev.flag) setFlag(ev.flag);
      RPG.state.persist();
      return { ok: true, kind: 'chest', gained };
    }

    if (ev.kind === 'exit') {
      enter(ev.to, ev.at);
      return { ok: true, kind: 'exit', to: ev.to };
    }

    if (ev.kind === 'join') {
      // 仲間が加わる (§20)。
      //
      // ストーリー側の仲間は **筋書きで加わる**。ガチャは引かせない。
      // 物語の途中で「引けなかったので出てこない」が起きると、
      // 話が成立しなくなる。
      const p = RPG.state.get();
      if (!p.characters[ev.who]) {
        p.characters[ev.who] = RPG.state.createCharacter(ev.who);
        // 主人公に置いていかれないよう、いまの先頭に合わせて出す。
        // Lv1 で加わると、そこから育て直しになって話に付いてこられない。
        const lead = p.characters.ch_hero;
        if (lead && lead.level > 1) p.characters[ev.who].level = lead.level;
      }
      if (p.party.indexOf(ev.who) < 0 && p.party.length < 4) p.party.push(ev.who);
      if (ev.flag) setFlag(ev.flag);
      RPG.state.persist();
      return { ok: true, kind: 'join', who: ev.who, text: ev.text };
    }

    if (ev.kind === 'talk') {
      // 会話は繰り返し読めるようにする。flag を持たせたときだけ一度きり。
      if (ev.flag) setFlag(ev.flag);
      RPG.state.persist();
      return { ok: true, kind: 'talk', text: ev.text, who: ev.who };
    }

    return { ok: false };
  }

  /**
   * いま立っているマスのイベント。
   *
   * 「調べる」は正面だけを見ていたが、それだと **足元のイベントに届かない**。
   * 仲間や会話は歩けるマスに置くので、乗ってしまうと二度と拾えなくなる。
   * 実際、第一章で仲間になるマスに乗ると詰んだ。
   */
  function here() {
    const pos = current();
    if (!pos) return null;
    return eventAt(def(pos.id), pos.x, pos.y);
  }

  /**
   * いま立っているマスの1つ先（向いている方向）にあるイベント。
   * 会話は「乗る」ではなく「向かって調べる」ほうが自然なので、
   * 画面側の決定ボタンからはこちらを引く。
   */
  function facing() {
    const pos = current();
    if (!pos) return null;
    const m = def(pos.id);
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[pos.dir] || [0, 1];
    return eventAt(m, pos.x + d[0], pos.y + d[1]);
  }

  RPG.worldmap = {
    def, current, enter, move, resolve, tileAt, eventAt, isDone, setFlag, facing, here,
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
