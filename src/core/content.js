// @ts-check
/**
 * 拡張コンテンツの取り込み (§18)。
 *
 * ── なぜ別の仕組みが要るのか ──
 * キャラや装備を足すだけなら data/*.js に追記すれば済む。だが
 * **その追記を人以外に任せると、既存の定義を壊した事故が混ざったまま気付けない。**
 * 差分を見ても「足した行」と「壊した行」が同じファイルの中で混ざるので、
 * 何が原因で崩れたのかが後から追えなくなる。
 *
 * そこで、追加分は content/ 以下の別ファイルに置き、ここで重ねる形にした。
 *   ・コアの data/*.js には一切触らない → 壊れたら拡張ファイルを外すだけで戻る
 *   ・どの項目がどのファイル由来かを覚えておく → 事故の出どころが即分かる
 *   ・重ねる前に検査する → 参照切れや ID の衝突を、遊ぶ前に止める
 *
 * ── 使い方 ──
 * content/ に置いたファイルが、読み込まれた順に add() を呼ぶ。
 *
 *   RPG.content.add('宵闇の使者', {
 *     skills: { … }, characters: { … }, uniques: { … },
 *   });
 *
 * すべて読み終えたら seal() が1度だけ走り、検査してから RPG.data.* へ流し込む。
 * seal() は src/core/content-seal.js が呼ぶ（読み込み順の都合で別ファイルにしてある）。
 */
(function (RPG) {
  'use strict';

  /**
   * 拡張が足せるカタログと、その決まり。
   *
   *   target   … RPG.data のどこへ重ねるか
   *   idPrefix … IDの頭。種類ごとに分けておくと、参照先を取り違えたときに一目で分かる
   *   required … 必須の項目。欠けていたら取り込まない
   *   refs     … 他のカタログを参照する項目。存在しないIDを指していたら止める
   *   list     … 配列で持つカタログ（ツリーのノードなど）は true
   */
  const KINDS = {
    skills: {
      target: 'skills', idPrefix: 'sk_',
      required: ['name', 'kind'],
      refs: {},
    },
    characters: {
      target: 'characters', idPrefix: 'ch_',
      required: ['name', 'rarity', 'element', 'base', 'growth'],
      refs: { unique_skills: 'skills', common_skills: 'skills' },
    },
    enemies: {
      target: 'enemies', idPrefix: 'em_',
      required: ['name', 'element'],
      refs: {},
    },
    bosses: {
      target: 'enemies', idPrefix: 'bs_',
      required: ['name', 'element'],
      refs: {},
    },
    uniques: {
      target: 'uniqueEquips', idPrefix: 'uq_',
      required: ['name', 'base', 'desc'],
      refs: { base: 'equipBases' },
    },
    treeNodes: {
      target: 'skillTree', idPrefix: 'tr_', list: true,
      required: ['name', 'tier', 'cost', 'maxLevel', 'effects', 'desc'],
      refs: {},
    },
    fields: {
      target: 'fields', idPrefix: 'fl_',
      required: ['name', 'rec_level', 'enemy_lv', 'size', 'pool', 'boss',
        'gold_mult', 'exp_mult', 'desc'],
      // 敵を置く場所なので、置く敵が実在するかを必ず見る。
      // ここが抜けると「入ったのに戦闘が始まらないフィールド」ができる。
      refs: { pool: 'enemies', boss: 'enemies' },
    },
  };

  /** 読み込まれた拡張。{ pack, kind, id } の記録も兼ねる。 */
  const packs = [];
  /** @type {Record<string, string>} ID → それを定義した拡張の名前 */
  const owners = {};
  /** @type {string[]} 取り込みを断った理由 */
  const problems = [];
  let sealed = false;

  /**
   * 拡張を1つ登録する。ここでは溜めるだけで、まだ RPG.data には触らない。
   *
   * 検査を seal() まで遅らせているのは、**拡張どうしの参照を許すため**。
   * 後から読まれる拡張のスキルを先の拡張が参照することがあるので、
   * 揃う前に検査すると、順番を変えただけで通ったり落ちたりする。
   *
   * @param {string} name 拡張の名前。エラー表示に出るので、人が読める名前を付ける
   * @param {Record<string, any>} payload カタログ名 → 中身
   */
  function add(name, payload) {
    if (sealed) {
      problems.push(`「${name}」は取り込みが終わったあとに読み込まれた（content/ の外から呼ばれている）`);
      return;
    }
    packs.push({ name, payload: payload || {} });
  }

  /** @param {any} v @returns {boolean} 中身のある値か（0 と false は「ある」扱い） */
  function present(v) {
    if (v == null) return false;
    if (typeof v === 'string') return v.length > 0;
    if (Array.isArray(v)) return true;
    return true;
  }

  /**
   * 1件ぶんの定義を検査する。問題があれば理由の配列を返す。
   * @param {string} packName @param {string} kind @param {string} id @param {any} entry
   * @param {Record<string, Set<string>>} known 検査時点で存在が確定しているID
   */
  function inspect(packName, kind, id, entry, known) {
    const rule = KINDS[kind];
    const out = [];
    const where = `「${packName}」の ${kind}.${id}`;

    if (!entry || typeof entry !== 'object') {
      out.push(`${where}: 中身がオブジェクトではない`);
      return out;
    }

    // IDの頭を揃える。取り違えたときに一目で分かるようにするための決まり。
    if (rule.idPrefix && id.indexOf(rule.idPrefix) !== 0) {
      out.push(`${where}: IDは "${rule.idPrefix}" で始める`);
    }

    for (const key of rule.required) {
      if (!present(entry[key])) out.push(`${where}: 必須の "${key}" が無い`);
    }

    // ユニークの効果キー。読み口の無いキーは装備しても **何も起きない**。
    // エラーも警告も出ないので、書いた側は効いているつもりで先へ進んでしまう。
    // 一番起きやすく、一番気付きにくい事故なのでここで止める。
    if (kind === 'uniques' && entry.effects) {
      const allowed = (RPG.units && RPG.units.UNIQUE_EFFECT_KEYS) || null;
      if (allowed) {
        for (const key of Object.keys(entry.effects)) {
          if (allowed.indexOf(key) < 0) {
            out.push(`${where}: 効果 "${key}" は読み口が無く、装備しても何も起きない`);
          }
        }
      }
    }

    // ツリーの効果種別。こちらも同じで、未対応の kind は黙って捨てられる。
    if (kind === 'treeNodes' && Array.isArray(entry.effects)) {
      for (const e of entry.effects) {
        if (!e || !e.kind) { out.push(`${where}: effects に kind の無い項目がある`); continue; }
        if (RPG.tree && RPG.tree.KNOWN_EFFECT_KINDS
            && RPG.tree.KNOWN_EFFECT_KINDS.indexOf(e.kind) < 0) {
          out.push(`${where}: 効果種別 "${e.kind}" はコアが解釈できない`);
        }
        // 系統タグの綴り。遺物は "reli" で、"relic" と書いても
        // どの装備とも一致せず、倍率が1のまま黙って終わる。
        // 実際に見本で書き間違えた。
        if (e.tag && RPG.damage.TAG_LABEL && !(e.tag in RPG.damage.TAG_LABEL)) {
          out.push(`${where}: 系統タグ "${e.tag}" は無い`
            + `（使えるのは ${Object.keys(RPG.damage.TAG_LABEL).join(', ')}）`);
        }
      }
    }

    // フィールド固有の検査。
    if (kind === 'fields') {
      const size = entry.size;
      if (!Array.isArray(size) || size.length !== 2
          || !(size[0] >= 1) || !(size[1] >= size[0])) {
        out.push(`${where}: size は [最小, 最大] の2要素で、1以上・最小<=最大にする`);
      }
      if (Array.isArray(entry.pool) && entry.pool.length === 0) {
        out.push(`${where}: pool が空。通常ウェーブに出す敵が1体も無い`);
      }
      // 敵レベルが推奨レベルから極端に離れていると、勝てないか手応えが無いかになる。
      // 幅は広めに取ってあり、止めたいのは桁を間違えた場合だけ。
      if (entry.rec_level > 0 && entry.enemy_lv > 0) {
        const ratio = entry.enemy_lv / entry.rec_level;
        if (ratio < 0.5 || ratio > 3) {
          out.push(`${where}: enemy_lv ${entry.enemy_lv} が rec_level ${entry.rec_level} と釣り合わない`);
        }
      }
    }

    // 属性。綴りを間違えると相性表に載らず、常に等倍になる。
    if (entry.element && RPG.damage.ELEMENT_LABEL
        && !(entry.element in RPG.damage.ELEMENT_LABEL)) {
      out.push(`${where}: 属性 "${entry.element}" は無い`
        + `（使えるのは ${Object.keys(RPG.damage.ELEMENT_LABEL).join(', ')}）`);
    }

    // 技の挙動。無いプラグインを指すと、撃っても何も起きない技になる。
    if (kind === 'skills' && entry.plugin && !RPG.plugins[entry.plugin]) {
      out.push(`${where}: plugin "${entry.plugin}" は無い`
        + `（使えるのは ${Object.keys(RPG.plugins).join(', ')}）`);
    }

    // 参照切れ。ここを通すと、遊んでいる最中に undefined を触って落ちる。
    for (const key of Object.keys(rule.refs || {})) {
      const targetKind = rule.refs[key];
      const value = entry[key];
      if (value == null) continue;
      const ids = Array.isArray(value) ? value : [value];
      for (const ref of ids) {
        if (!known[targetKind] || !known[targetKind].has(ref)) {
          out.push(`${where}: "${key}" が指す ${ref} が見つからない`);
        }
      }
    }

    return out;
  }

  /**
   * 溜めた拡張を検査して RPG.data へ重ねる。
   *
   * **1つでも問題があれば、その拡張は丸ごと取り込まない。**
   * 半分だけ入ると、参照切れのまま遊べてしまい、
   * 落ちる場所と原因の場所が離れて追えなくなる。
   * 他の拡張は巻き込まない——1つの事故で全部が消えると原因の切り分けができない。
   */
  function seal() {
    if (sealed) return report();
    sealed = true;

    // 検査に使うID集合。コアにあるものから始めて、拡張ぶんを足していく。
    /** @type {Record<string, Set<string>>} */
    const known = {};
    const catalogs = ['skills', 'characters', 'enemies', 'uniqueEquips', 'equipBases', 'fields'];
    for (const c of catalogs) known[c] = new Set(Object.keys(RPG.data[c] || {}));
    known.skillTree = new Set((RPG.data.skillTree || []).map((/** @type {any} */ n) => n.id));

    // 1周目: これから増えるIDを先に集める。拡張どうしの参照を通すため。
    for (const pack of packs) {
      for (const kind of Object.keys(pack.payload)) {
        const rule = KINDS[kind];
        if (!rule) continue;
        const bag = pack.payload[kind];
        const ids = rule.list
          ? (bag || []).map((/** @type {any} */ n) => n.id)
          : Object.keys(bag || {});
        for (const id of ids) if (id) known[rule.target].add(id);
      }
    }

    // 2周目: 検査して、問題の無い拡張だけ重ねる。
    for (const pack of packs) {
      const kinds = Object.keys(pack.payload);
      const unknown = kinds.filter((k) => !KINDS[k]);
      const found = [];

      // 知らない種別は「書いたのに何も起きない」で終わる。
      // 警告だけ出して通すと、拡張を書いた側は反映されたと思い込むので、
      // 綴り違いに気付かないまま先へ進んでしまう。取り込み自体を止める。
      for (const u of unknown) {
        found.push(`「${pack.name}」: 知らない種別 "${u}"（使えるのは ${Object.keys(KINDS).join(', ')}）`);
      }

      for (const kind of kinds) {
        const rule = KINDS[kind];
        if (!rule) continue;
        const bag = pack.payload[kind];
        const entries = rule.list
          ? (bag || []).map((/** @type {any} */ n) => [n.id, n])
          : Object.keys(bag || {}).map((id) => [id, bag[id]]);

        for (const pair of entries) {
          const id = pair[0];
          const entry = pair[1];
          if (!id) { found.push(`「${pack.name}」の ${kind}: id の無い項目がある`); continue; }

          // 上書きは許さない。コアの調整を拡張が黙って差し替えると、
          // バランスを測り直したときに「直したはずの値」が効いていない事態になる。
          const isCore = coreHas(rule, id);
          if (isCore) {
            found.push(`「${pack.name}」の ${kind}.${id}: 既にコアにある。上書きはできない`);
            continue;
          }
          if (owners[id] && owners[id] !== pack.name) {
            found.push(`「${pack.name}」の ${kind}.${id}: 「${owners[id]}」と ID がぶつかっている`);
            continue;
          }

          found.push.apply(found, inspect(pack.name, kind, id, entry, known));
        }
      }

      if (found.length) {
        problems.push(`「${pack.name}」は取り込まなかった（${found.length}件）`);
        problems.push.apply(problems, found.map((f) => '　　' + f));
        pack.rejected = true;
        continue;
      }

      // 検査を通ったので流し込む
      for (const kind of kinds) {
        const rule = KINDS[kind];
        if (!rule) continue;
        const bag = pack.payload[kind];
        if (rule.list) {
          RPG.data[rule.target] = (RPG.data[rule.target] || []).concat(bag || []);
          for (const n of bag || []) owners[n.id] = pack.name;
        } else {
          RPG.data[rule.target] = RPG.data[rule.target] || {};
          for (const id of Object.keys(bag || {})) {
            RPG.data[rule.target][id] = bag[id];
            owners[id] = pack.name;
          }
        }
      }
      pack.rejected = false;
    }

    return report();
  }

  /**
   * コアに既にあるIDか。
   * seal() の1周目で known に拡張ぶんも足してしまうので、
   * 「元からあったか」は別に覚えておく必要がある。
   * @param {any} rule @param {string} id
   */
  const coreIds = {};
  function coreHas(rule, id) {
    if (!coreIds[rule.target]) {
      coreIds[rule.target] = rule.list
        ? new Set((coreSnapshot[rule.target] || []).map((/** @type {any} */ n) => n.id))
        : new Set(Object.keys(coreSnapshot[rule.target] || {}));
    }
    return coreIds[rule.target].has(id);
  }

  /**
   * 拡張を重ねる前の姿。seal() の最初に控える。
   * @type {Record<string, any>}
   */
  const coreSnapshot = {};
  function snapshot() {
    for (const kind of Object.keys(KINDS)) {
      const t = KINDS[kind].target;
      if (t in coreSnapshot) continue;
      coreSnapshot[t] = KINDS[kind].list
        ? (RPG.data[t] || []).slice()
        : Object.assign({}, RPG.data[t] || {});
    }
  }

  /** 取り込み結果。問題があればコンソールにも出す。 */
  function report() {
    const loaded = packs.filter((p) => !p.rejected).map((p) => p.name);
    const rejected = packs.filter((p) => p.rejected).map((p) => p.name);
    if (problems.length) {
      // 黙って落とすと、拡張を書いた側が「反映されない」としか分からない。
      console.warn('[拡張コンテンツ] 取り込めなかったものがあります:\n' + problems.join('\n'));
    }
    return { loaded, rejected, problems: problems.slice(), owners: Object.assign({}, owners) };
  }

  /** どの拡張が入れたIDか。不具合を追うときの入口。 @param {string} id */
  function ownerOf(id) {
    return owners[id] || null;
  }

  RPG.content = {
    add,
    seal: () => { snapshot(); return seal(); },
    report,
    ownerOf,
    KINDS,
    /** テスト用。取り込み状態を巻き戻す。 */
    _reset: () => {
      packs.length = 0;
      problems.length = 0;
      for (const k of Object.keys(owners)) delete owners[k];
      for (const k of Object.keys(coreIds)) delete coreIds[k];
      sealed = false;
    },
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
