// @ts-check
/**
 * 装備の生成（鑑定）と評価 (§7)。
 *
 * 戦闘では宝箱IDと個数しか動かない。実際にランダム能力値を持つ装備が生まれるのは
 * 拠点でこの identify() が呼ばれた瞬間だけ (§2.2 / §7.2)。
 */
(function (RPG) {
  'use strict';

  /**
   * 系統タグ補正・クリティカル・上限突破は平坦ステータスほど急激には伸ばさない。
   *
   * 係数を大きくすると、レベルではなく宝箱のグレードで強さが決まってしまう。
   * バランス検証（test/balance.html）で、0.22 だと竜の宝箱の系統タグ倍率が
   * ×35 まで跳ね上がり、Lv60→80 で火力が ×9.85 になる段差が出たため 0.10 に下げた。
   */
  function softScale(statMult) {
    return 1 + (statMult - 1) * 0.10;
  }

  /**
   * 副オプション1つぶんの生の値を引く。
   * 'stat' だけ整数で、それ以外は割合の実数（緩やかな拡大を通す）。
   * @param {any} affix
   * @param {any} box
   */
  function rollAffixValue(affix, box) {
    if (affix.kind === 'stat') {
      return Math.max(1, Math.floor(RPG.rng.float(affix.range[0], affix.range[1]) * box.stat_mult));
    }
    return RPG.rng.float(affix.range[0], affix.range[1]) * softScale(box.stat_mult);
  }

  /**
   * 表示用の1行。
   * @param {any} affix
   * @param {number} v
   */
  function affixLine(affix, v) {
    return affix.kind === 'stat'
      ? { label: affix.name, value: '+' + v }
      : { label: affix.name, value: '+' + (v * 100).toFixed(1) + '%' };
  }

  /** @param {string} id */
  function affixById(id) {
    return RPG.data.affixes.find((/** @type {any} */ a) => a.id === id) || null;
  }

  /**
   * その装備が引いた副オプションを {id, v} の並びで返す。
   *
   * 再抽選 (§7.9) は「どの枠が何を引いたか」を知る必要があるが、
   * この記録を持たない装備が既存のセーブに入っている。副オプションの名前は
   * 一意なので affixLines から引き当てられる。**値は表示文字列から読まない**
   * （割合系は小数1桁に丸めてあるので、戻すと目減りする）。装備側に残っている
   * 正確な値のほうから取り戻す。
   *
   * @param {any} item
   * @returns {Array<{id: string, v: number}>}
   */
  function affixRollsOf(item) {
    if (item.affixRolls) {
      return item.affixRolls.map((/** @type {any} */ r) => ({ id: r.id, v: r.v }));
    }
    /** @type {Array<{id: string, v: number}>} */
    const rolls = [];
    for (const line of item.affixLines || []) {
      const affix = RPG.data.affixes.find((/** @type {any} */ a) => a.name === line.label);
      if (!affix) continue;
      let v = 0;
      if (affix.kind === 'stat') {
        v = parseInt(String(line.value).replace('+', ''), 10) || 0;
      } else if (affix.kind === 'tag_bonus') {
        const hit = (item.tagBonuses || []).find((/** @type {any} */ t) => t.tag === affix.tag
          && (t.matchType || null) === (affix.match_type || null));
        v = hit ? hit.value : 0;
      } else if (affix.kind === 'crit') v = item.critRate || 0;
      else if (affix.kind === 'cap_break') v = item.capBreak || 0;
      else if (affix.kind === 'reduction') v = item.reduction || 0;
      rolls.push({ id: affix.id, v });
    }
    return rolls;
  }

  /**
   * 主ステータスだけを取り出す。強化ぶんと副オプションぶんを除いた素の値。
   * @param {any} item
   */
  function mainStatsOf(item) {
    if (item.mainStats) return Object.assign({}, item.mainStats);
    // baseStats は強化前の控え。無ければ強化されていないので stats がそのまま素。
    /** @type {Record<string, number>} */
    const main = Object.assign({}, item.baseStats || item.stats);
    for (const r of affixRollsOf(item)) {
      const affix = affixById(r.id);
      if (!affix || affix.kind !== 'stat') continue;
      if (main[affix.stat] === undefined) continue;
      main[affix.stat] -= r.v;
      // その装備の主ステータスに無い種類だったなら、引くと 0 以下になる
      if (main[affix.stat] <= 0) delete main[affix.stat];
    }
    return main;
  }

  /**
   * 副オプションの並びを装備へ反映し直す。派生する値は全部作り直す。
   *
   * 強化ぶんは乗せない。控え（baseStats）を捨てるので、呼び出し側が
   * enhance.applyPlus を通して積み直すこと。
   *
   * @param {any} item
   * @param {Array<{id: string, v: number}>} rolls
   */
  function applyAffixRolls(item, rolls) {
    const main = mainStatsOf(item);
    /** @type {Record<string, number>} */
    const stats = Object.assign({}, main);
    /** @type {Array<{tag: string, value: number, matchType: string|null}>} */
    const tagBonuses = [];
    /** @type {Array<{label: string, value: string}>} */
    const affixLines = [];
    let critRate = 0;
    let capBreak = 0;
    let reduction = 0;
    for (const r of rolls) {
      const affix = affixById(r.id);
      if (!affix) continue;
      if (affix.kind === 'stat') stats[affix.stat] = (stats[affix.stat] || 0) + r.v;
      else if (affix.kind === 'tag_bonus') {
        tagBonuses.push({ tag: affix.tag, value: r.v, matchType: affix.match_type || null });
      } else if (affix.kind === 'crit') critRate += r.v;
      else if (affix.kind === 'cap_break') capBreak += r.v;
      else if (affix.kind === 'reduction') reduction += r.v;
      affixLines.push(affixLine(affix, r.v));
    }
    item.mainStats = main;
    item.affixRolls = rolls.map((r) => ({ id: r.id, v: r.v }));
    item.stats = stats;
    item.tagBonuses = tagBonuses;
    item.critRate = critRate;
    item.capBreak = capBreak;
    item.reduction = reduction;
    item.affixLines = affixLines;
    delete item.baseStats;
    return item;
  }

  /**
   * 宝箱を1つ開封し、装備を1つ生成する。
   *
   * @param {string} boxId
   * @param {number} uid 一意なID
   * @param {{baseId?: string, rarityId?: string, setId?: string|null}} [pin]
   *   厳選（リロール）で使う。同じ部位・レアリティ・セットのまま振り直したいときに固定する。
   *   setId に null を渡すと「セット無し」を固定できる（未指定との区別）。
   * @returns {any} 装備インスタンス
   */
  function identify(boxId, uid, pin) {
    const box = RPG.data.boxes[boxId];
    if (!box) throw new Error('未知の宝箱ID: ' + boxId);
    pin = pin || {};

    // 星辰の宝箱からはユニーク装備が出ることがある (§7.8)。
    // 系統タグ倍率を持たない代わりに、戦い方を変える固有効果を持つ。
    if (!pin.baseId && boxId === 'box_astral' && RPG.data.uniqueEquips &&
        RPG.rng.chance(RPG.data.uniqueDropChance || 0)) {
      return rollUnique(uid, boxId);
    }

    const rarityId = pin.rarityId || /** @type {string} */ (RPG.rng.weighted(box.rarity_weights));
    const rarity = RPG.data.equipRarities[rarityId];

    const baseIds = Object.keys(RPG.data.equipBases);
    const baseId = pin.baseId || RPG.rng.pick(baseIds);
    const base = RPG.data.equipBases[baseId];

    const flatScale = box.stat_mult * rarity.main_mult;
    const soft = softScale(box.stat_mult);

    // 主ステータスは部位で決まる。副オプションと分けて控えておくと、
    // 再抽選 (§7.9) のときに副オプションぶんだけを差し替えられる。
    /** @type {Record<string, number>} */
    const mainStats = {};
    for (const key of Object.keys(base.main)) {
      const [lo, hi] = base.main[key];
      mainStats[key] = Math.max(1, Math.floor(RPG.rng.float(lo, hi) * flatScale));
    }

    // 副オプションを重複なしで抽選する
    const pool = RPG.data.affixes.slice();
    const count = Math.min(rarity.affixes, pool.length);
    /** @type {Array<{id: string, v: number}>} */
    const rolls = [];
    for (let i = 0; i < count; i++) {
      const affix = RPG.rng.weighted(pool);
      pool.splice(pool.indexOf(affix), 1);
      rolls.push({ id: affix.id, v: rollAffixValue(affix, box) });
    }

    const prefix = RPG.rng.pick(RPG.data.equipPrefixes[rarityId]);

    // 装備セット (§7.7)。厳選では元のセットを引き継ぐので pin で固定できる。
    // equipset.js を読んでいないページ（道具類）でも鑑定だけは動くようにしておく。
    const setId = pin.setId !== undefined ? pin.setId
      : (RPG.equipset ? RPG.equipset.rollSet(boxId) : null);
    const set = setId ? RPG.data.equipSets[setId] : null;

    const item = {
      uid,
      base: baseId,
      // セット装備は名前でそれと分かるようにする（並べたときに探しやすい）
      name: set ? `${set.name}の${base.name}` : prefix + base.name,
      slot: base.slot,
      tag: base.tag,
      rarity: rarityId,
      mainStats,
      boxId,
      setId: setId || null,
    };
    // stats / tagBonuses / critRate / capBreak / reduction / affixLines は
    // 副オプションの並びから作られる。生成も再抽選も同じ関数を通す。
    return applyAffixRolls(item, rolls);
  }

  /**
   * ユニーク装備を1つ抽選して作る (§7.8)。
   *
   * 系統タグ倍率・クリティカル・上限突破は一切付けない。
   * 「数値で勝ちたいなら竜の宝箱」という住み分けを崩さないため。
   *
   * @param {number} uid
   * @param {string} boxId
   */
  function rollUnique(uid, boxId) {
    const id = RPG.rng.pick(Object.keys(RPG.data.uniqueEquips));
    const def = RPG.data.uniqueEquips[id];
    const base = RPG.data.equipBases[def.base];

    /** @type {Record<string, number>} */
    const stats = {};
    // 個体差は付ける。同じユニークでも厳選する意味を残すため。
    for (const key of Object.keys(def.stats)) {
      stats[key] = Math.max(1, Math.floor(def.stats[key] * RPG.rng.float(0.85, 1.15)));
    }

    return {
      uid,
      base: def.base,
      name: def.name,
      slot: base.slot,
      tag: base.tag,
      rarity: 'LEGEND',
      stats,
      tagBonuses: [],
      critRate: 0,
      capBreak: 0,
      reduction: 0,
      affixLines: [{ label: '固有効果', value: def.note }],
      boxId,
      setId: null,
      // ユニーク装備の目印。効果はここから読む。
      uniqueId: id,
      uniqueEffects: Object.assign({}, def.effects),
      locked: true,
    };
  }

  /**
   * 性能を固定した装備を1つ作る（クエストの初回クリア報酬用）。
   *
   * identify() と違い乱数を一切使わない。同じ仕様からは常に同じ性能が出るので、
   * 「クエストで手に入る専用装備」を確実に配れる。
   *
   * @param {{base: string, rarity: string, name: string,
   *          stats?: Record<string, number>,
   *          tagBonuses?: Array<{tag: string, value: number, matchType?: string|null}>,
   *          critRate?: number, capBreak?: number, reduction?: number}} spec
   * @param {number} uid
   * @returns {any} 装備インスタンス
   */
  function forge(spec, uid) {
    const base = RPG.data.equipBases[spec.base];
    if (!base) throw new Error('未知の装備ベース: ' + spec.base);

    const stats = Object.assign({}, spec.stats || {});
    const tagBonuses = (spec.tagBonuses || []).map((b) => ({
      tag: b.tag, value: b.value, matchType: b.matchType || null,
    }));
    const critRate = spec.critRate || 0;
    const capBreak = spec.capBreak || 0;
    const reduction = spec.reduction || 0;

    /** @type {Array<{label: string, value: string}>} */
    const affixLines = [];
    for (const b of tagBonuses) {
      affixLines.push({
        label: '[' + RPG.damage.TAG_LABEL[b.tag] + ']系統' +
          (b.matchType ? `(${RPG.damage.TAG_LABEL[b.matchType]}技限定)` : ''),
        value: '+' + (b.value * 100).toFixed(1) + '%',
      });
    }
    if (critRate) affixLines.push({ label: 'クリティカル率', value: '+' + (critRate * 100).toFixed(1) + '%' });
    if (capBreak) affixLines.push({ label: 'ダメージ上限突破', value: '+' + (capBreak * 100).toFixed(1) + '%' });
    if (reduction) affixLines.push({ label: '被ダメージ軽減', value: '+' + (reduction * 100).toFixed(1) + '%' });

    return {
      uid,
      base: spec.base,
      name: spec.name,
      slot: base.slot,
      tag: base.tag,
      rarity: spec.rarity,
      stats,
      tagBonuses,
      critRate,
      capBreak,
      reduction,
      affixLines,
      boxId: null,
      // 報酬装備は誤って一括売却しないよう最初からロックしておく
      locked: true,
      unique: true,
    };
  }

  /**
   * 装備のおおまかな強さ。インベントリの並び替えにのみ使う。
   * @param {any} item
   */
  function score(item) {
    let s = 0;
    for (const key of Object.keys(item.stats)) {
      s += item.stats[key] * (key === 'hp' ? 0.25 : 1);
    }
    for (const b of item.tagBonuses) s += b.value * 400;
    s += item.critRate * 500;
    s += item.capBreak * 600;
    s += (item.reduction || 0) * 900;
    return Math.round(s);
  }

  /**
   * 装備の系統タグ（[物理]など）を含む1行サマリを返す。
   * @param {any} item
   */
  function summary(item) {
    const parts = [];
    for (const key of Object.keys(item.stats)) {
      parts.push(RPG.units.STAT_LABEL[key] + '+' + item.stats[key]);
    }
    return parts.join(' / ');
  }

  /** レアリティの強い順。並べ替えで使う */
  const RARITY_ORDER = ['COMMON', 'RARE', 'SUPER_RARE', 'LEGEND'];
  /** 部位の並び */
  const SLOT_ORDER = ['weapon', 'armor', 'accessory'];

  /**
   * 装備の並べ替え (§7.4)。
   *
   * ── なぜ項目ごとに並べられる必要があるのか ──
   * 「強い順」は全部を1つの点数に潰すので、**特定の数値だけを探せない**。
   * 所持数は周回で数千に達するので、「DEFがいちばん高いものを1つ」を
   * 目で探すのは現実的でない。
   *
   * 画面ではなくここに置いてあるのは、表示上限で切られる前の
   * 並びそのものを検査できるようにするため。
   */
  const SORTS = [
    { id: 'power', label: '強い順' },
    { id: 'new', label: '新着順' },
    { id: 'rarity', label: 'レアリティ順' },
    { id: 'slot', label: '部位順' },
    { id: 'stat:hp', label: 'HP順' },
    { id: 'stat:atk', label: 'ATK順' },
    { id: 'stat:def', label: 'DEF順' },
    { id: 'stat:magi_power', label: '魔力順' },
    { id: 'crit', label: '会心率順' },
    { id: 'capBreak', label: '上限突破順' },
    { id: 'reduction', label: '被ダメ軽減順' },
    { id: 'tag', label: '系統倍率順' },
  ];

  /**
   * 装備1つから、並べ替えに使う数値を取り出す。
   * 持っていない項目は 0。持たない装備を弾かずに後ろへ回すため。
   * @param {any} item @param {string} key
   */
  function sortValue(item, key) {
    if (!item) return 0;
    if (key.indexOf('stat:') === 0) return (item.stats || {})[key.slice(5)] || 0;
    if (key === 'crit') return item.critRate || 0;
    if (key === 'capBreak') return item.capBreak || 0;
    if (key === 'reduction') return item.reduction || 0;
    // 系統倍率は複数行を持つので合計で見る。
    // 最大値だと「小さいのを2つ」が沈み、合計のほうが実感に近い。
    if (key === 'tag') {
      return (item.tagBonuses || [])
        .reduce((/** @type {number} */ a, /** @type {any} */ b) => a + (b.value || 0), 0);
    }
    return 0;
  }

  /**
   * 絞り込んでから並べ替える。
   *
   * @param {any[]} inventory
   * @param {{sort: string, slot?: string|null, tag?: string|null,
   *          rarity?: string|null, set?: string|null,
   *          onlyUnequipped?: boolean}} view
   * @param {Record<number, string>} [owner] 装備している人 { uid: 名前 }
   */
  function arrange(inventory, view, owner) {
    let list = (inventory || []).slice();
    const own = owner || {};

    if (view.slot) list = list.filter((it) => it.slot === view.slot);
    if (view.tag) list = list.filter((it) => it.tag === view.tag);
    if (view.rarity) list = list.filter((it) => it.rarity === view.rarity);

    // セット・ユニークで絞る (§7.7 / §7.8)。
    //
    // ── なぜ「セット無し」も選べるようにするか ──
    // セットは同じものを2個・4個と揃えて初めて効く。
    // 「あと1個足りない」を探すのが主な用途なので、揃えたいセットを
    // 選べる必要がある。逆に、売る候補を探すときは
    // **セットに属していないもの** を見たい。どちらも要る。
    //
    // ── ユニークをここに含める理由 ──
    // ユニークはセットを持たないので、そのままだと「セット無し」に
    // 埋もれて取り出せない。しかも系統タグも会心も持たないぶん
    // 素の点数が低く、**強い順で上位120個に1つも入らなかった**（実測 0/40）。
    // 絞り込めなければ、持っているのに一生見つけられない。
    // 名指しで選べるようにもする。「巨躯断ちを探す」が主な用途なので。
    if (view.set === 'none') list = list.filter((it) => !it.setId && !it.uniqueId);
    else if (view.set === 'unique') list = list.filter((it) => !!it.uniqueId);
    else if (view.set && view.set.indexOf('uq:') === 0) {
      const want = view.set.slice(3);
      list = list.filter((it) => it.uniqueId === want);
    } else if (view.set) list = list.filter((it) => it.setId === view.set);

    if (view.onlyUnequipped) list = list.filter((it) => !own[it.uid]);

    const byScore = (/** @type {any} */ a, /** @type {any} */ b) => score(b) - score(a);

    if (view.sort === 'new') {
      list.sort((a, b) => b.uid - a.uid);
    } else if (view.sort === 'rarity') {
      list.sort((a, b) =>
        RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity) || byScore(a, b));
    } else if (view.sort === 'slot') {
      list.sort((a, b) =>
        SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot) || byScore(a, b));
    } else if (view.sort && view.sort !== 'power') {
      // 同じ値なら総合点で決める。並びが毎回変わると探しにくい。
      list.sort((a, b) =>
        sortValue(b, view.sort) - sortValue(a, view.sort) || byScore(a, b));
    } else {
      list.sort(byScore);
    }
    return list;
  }

  RPG.gear = {
    SORTS, sortValue, arrange, identify, forge, rollUnique, score, summary,
    rollAffixValue, affixById, affixRollsOf, mainStatsOf, applyAffixRolls };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
