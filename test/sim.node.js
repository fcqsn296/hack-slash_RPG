// @ts-nocheck
/**
 * 測定の土台（node 専用）。**ブラウザからは読まない。**
 *
 * ── なぜ要るのか ──
 * バランスを測るたびに使い捨てのスクリプトを書いていた。1周で52本・3,239行になり、
 * どれも「セーブを読む → 編成を作る → 戦闘を回す → 中央値を出す」の書き直しだった。
 *
 * それ以上に問題だったのは、**同じ罠を何度も踏んだこと**。1日で5回、
 * 「実行は正しいのに結論が間違い」を出した。原因は全部この道具の外にあった:
 *
 *   1. `randomRange: 0` と書いても乱数が止まらない（正しくは `random`）
 *   2. 耐久を切り離すとき、HPを **行動を選んだ後** に戻していた
 *   3. `enemyScale` は ATK にも掛かる（HPだけ上げたいなら表で書く）
 *   4. ツリーを振り切ってから次へ進むと、上級ノードが解放前に黙って落ちる
 *   5. 状態異常の割合は **読むたびに** STATUS_CAP で丸められる
 *
 * ここに閉じ込めておけば、次からは踏まない。
 *
 * 使い方:
 *   const sim = require('./test/sim.node.js');
 *   sim.load();
 *   sim.useSave('_scratch/save.json', ['ch_hero']);
 *   const r = sim.repeat(16, (seed) => sim.run({ questId: 'q_endless_vigil', seed }));
 *   console.log(sim.fmt(r));
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

/** @type {any} 読み込んだゲームの入れ物 */
let ctx = null;

/**
 * ゲーム本体を node へ読み込む。
 *
 * 読む一覧は test/index.html から引く。手で並べると必ず古くなる
 * （検証テスト側で「本体が読む JS が全部あるか」を見ているのと同じ理由）。
 *
 * @param {{patch?: Record<string,string>}} [opts]
 *   patch は「このファイルだけ別のものを読む」実験用。
 *   例: { 'src/core/battle.js': '_scratch/patched/battle.js' }
 *   実験が終わったら **必ず消すこと**。古い挙動を測り続けることになる。
 */
function load(opts) {
  const html = fs.readFileSync(path.join(ROOT, 'test/index.html'), 'utf8');
  const srcs = [...html.matchAll(/src="([^"]+\.js)"/g)].map((m) => m[1])
    .filter((s) => !/tests\.js$/.test(s) && !/^https?:/.test(s));
  const store = {};
  ctx = {
    console, Math, JSON, Date, window: null,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      get length() { return Object.keys(store).length; },
      key: (i) => Object.keys(store)[i],
    },
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const s of srcs) {
    const rel = s.replace(/^\.\.\//, '');
    const patched = opts && opts.patch && opts.patch[rel];
    const file = patched ? path.resolve(ROOT, patched) : path.join(ROOT, 'test', s);
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: rel });
  }
  return ctx.RPG;
}

/** 読み込み済みの RPG。まだなら読み込む。 */
function RPG() {
  if (!ctx) load();
  return ctx.RPG;
}

/**
 * セーブを読ませる。編成を渡すと、その並びで自動装備まで済ませる。
 *
 * **装備は「1つを1人だけ」** なので、複数人を測るときは配り直しが要る。
 * 手で分けようとすると、2人目以降が素手になって「分業は弱い」という
 * 誤った結論が出る。
 *
 * @param {string|object} save ファイルパス、または game オブジェクト
 * @param {string[]} [partyIds]
 * @param {(chars:any, save:any) => void} [mutate] キャラを弄る（ツリーの差し替えなど）
 * @returns {any[]} 組み上がったユニット
 */
function useSave(save, partyIds, mutate) {
  const R = RPG();
  let game = save;
  if (typeof save === 'string') {
    const j = JSON.parse(fs.readFileSync(path.resolve(ROOT, save), 'utf8'));
    game = j.game || j;              // 書き出しは {format, fileVersion, game} で包まれている
  }
  const s = JSON.parse(JSON.stringify(game));
  if (partyIds) s.party = partyIds.slice();
  if (mutate) mutate(s.characters, s);
  ctx.localStorage.setItem(R.state.STORAGE_KEY, JSON.stringify(s));
  R.state.load();
  if (partyIds && partyIds.length > 1) R.autoequip.forParty({ keepLocked: false });
  return R.state.partyUnits();
}

/**
 * ツリーへ振る。**1段ずつ、毎回先頭から見直す。**
 *
 * 順位の上から振り切ってから次へ進むと、上級ノードは初級＋中級の投資量が
 * 足りるまで解放されないので、**解放される前にSPを使い切られて黙って落ちる**。
 * 実際それで「双撃の理がどの型でも0段」になり、
 * 「大技は手数を足しても弱い」という誤った結論が出かけた。
 *
 * @param {any} charSave 破壊的に変更する
 * @param {string[]} [priority] 先に取りたいノードID
 * @param {{ban?: string[]}} [opts] ban: 絶対に取らないノード（型を切り分けるとき）
 */
function invest(charSave, priority, opts) {
  const R = RPG();
  const ban = (opts && opts.ban) || [];
  charSave.tree = charSave.tree || {};
  let guard = 0;
  while (guard++ < 3000) {
    const pool = (priority || []).concat(R.data.skillTree.map((n) => n.id));
    const next = pool.find((id) => ban.indexOf(id) < 0 && R.tree.canInvest(charSave, id).ok);
    if (!next) break;
    charSave.tree[next] = (charSave.tree[next] || 0) + 1;
  }
  return charSave;
}

/**
 * 戦闘を1回回す。
 *
 * @param {object} o
 * @param {string} [o.questId]   指定すると依頼の規則と倍率をそのまま使う（推奨）
 * @param {string} [o.fieldId]
 * @param {number} [o.waves]
 * @param {boolean} [o.bossFinale]
 * @param {any[]} [o.party]      省略すると state の編成
 * @param {number|object} [o.enemyScale]
 *   数値なら全能力、表なら部分指定。**数値は ATK にも掛かる。**
 *   終わらぬ見張りを全能力×10にしたとき、敵の1発が味方の最大HPの478%になり
 *   「一度でも動かれたら死ぬ」二択になった。耐久を測るなら { hp: N } を使う。
 * @param {number} [o.seed]
 * @param {boolean} [o.immortal] 耐久を切り離す（火力だけを見たいとき）
 * @param {number} [o.maxRounds] 強制的に打ち切る（決着しない条件を測るとき）
 * @param {(b:any, actor:any) => void} [o.onAction] 各行動の直後
 * @param {(b:any) => void} [o.onWave] ウェーブ開始直後（敵を弄るならここ）
 */
function run(o) {
  const R = RPG();
  const quest = o.questId ? R.data.quests[o.questId] : null;
  if (o.questId && !quest) throw new Error('未知の依頼: ' + o.questId);
  const cfg = {
    fieldId: o.fieldId || (quest && quest.fieldId),
    waves: o.waves || (quest && quest.waves) || 1,
    bossFinale: o.bossFinale != null ? o.bossFinale : (quest ? quest.bossFinale !== false : true),
    party: (o.party || R.state.partyUnits()).map((u) => JSON.parse(JSON.stringify(u))),
    seed: o.seed,
  };
  if (quest) cfg.quest = quest;
  if (o.enemyScale != null) cfg.enemyScale = o.enemyScale;
  const b = R.battle.start(cfg);

  const foeHp = () => b.enemies.reduce((s, e) => s + Math.max(0, e.hp), 0);
  if (o.onWave) o.onWave(b);
  let guard = 0;
  let minHp = 1;
  let dealt = 0;
  let prevFoe = foeHp();
  const downed = new Set();

  while (!b.finished && guard++ < 9000) {
    if (o.maxRounds && b.totalRounds > o.maxRounds) break;
    if (b.phase === 'wave_clear') {
      R.battle.advanceWave(b);
      if (o.onWave) o.onWave(b);
      prevFoe = foeHp();
      continue;
    }
    // ── 耐久を切り離すなら、**行動を選ぶ前に**戻す ──
    // 後に戻すと、最大HPが低いビルドほどオートが防御的な技を選び、
    // 「HPの代償が火力を下げた」ように見える（実際に一度そう誤読した）。
    if (o.immortal) for (const p of b.party) { p.hp = p.maxHp; p.alive = true; }

    const actor = R.battle.currentActor ? R.battle.currentActor(b) : null;
    const a = R.autoplay.chooseAction(b);
    if (!a) break;
    R.battle.commandSkill(b, a.skillId, a.targets, { auto: true });

    const now = foeHp();
    if (now < prevFoe) dealt += prevFoe - now;
    prevFoe = now;
    if (o.onAction) o.onAction(b, actor);

    const tot = b.party.reduce((s, p) => s + p.maxHp, 0);
    const cur = b.party.reduce((s, p) => s + Math.max(0, p.hp), 0);
    if (tot) minHp = Math.min(minHp, cur / tot);
    for (const p of b.party) if (!p.alive) downed.add(p.key);
    if (!b.party.some((p) => p.alive)) break;
  }

  const tot = b.party.reduce((s, p) => s + p.maxHp, 0);
  const cur = b.party.reduce((s, p) => s + Math.max(0, p.hp), 0);
  return {
    win: !!b.victory,
    finished: !!b.finished,
    rounds: b.totalRounds,
    minHp,
    hpLeft: tot ? cur / tot : 0,
    downed: downed.size,
    dealt,
    stuck: guard >= 9000,
    battle: b,
  };
}

/**
 * 同じ条件を n 回回して中央値でまとめる。
 *
 * **勝率よりラウンド数のほうが安定する**（CLAUDE.md §3）ので両方返す。
 * ただし決着ラウンドは分散が大きい——72R帯で±20R ぶれ、火力に関わる値が
 * 完全に同一の2条件が 54R と 73R になったことがある。
 * 差が小さいときは `dealt`（与ダメージ合計）のほうが安定する。
 *
 * @param {number} n
 * @param {(seed:number, i:number) => any} fn
 * @param {{seed?:number, step?:number}} [opts]
 */
function repeat(n, fn, opts) {
  const seed0 = (opts && opts.seed) != null ? opts.seed : 3000;
  const step = (opts && opts.step) || 251;
  const rows = [];
  for (let i = 0; i < n; i++) rows.push(fn(seed0 + i * step, i));
  const med = (list) => {
    const x = list.slice().sort((a, b) => a - b);
    return x.length ? x[x.length >> 1] : null;
  };
  const wins = rows.filter((r) => r.win);
  return {
    n,
    win: wins.length,
    rounds: med(wins.map((r) => r.rounds)),
    minHp: med(rows.map((r) => r.minHp)),
    hpLeft: med(rows.map((r) => r.hpLeft)),
    downed: rows.reduce((s, r) => s + r.downed, 0) / n,
    dealt: med(rows.map((r) => r.dealt)),
    stuck: rows.filter((r) => r.stuck).length,
    rows,
  };
}

/** repeat の結果を1行にする。 */
function fmt(r) {
  return '突破 ' + String(r.win + '/' + r.n).padStart(6)
    + (r.rounds != null ? ' 中央 ' + String(r.rounds + 'R').padStart(4) : '   ——  ')
    + ' 倒れた/戦 ' + r.downed.toFixed(1)
    + ' 最低HP ' + String((r.minHp * 100).toFixed(0) + '%').padStart(5)
    + (r.stuck ? '  ★決着せず ' + r.stuck + '件' : '');
}

/**
 * ダメージ計算を直接叩く。
 *
 * **乱数を止めるのは `random`。** `randomRange` という名前は damage.js に無く、
 * 書いても黙って無視されて 0.92〜0.93 の揺れが乗る。
 * それで「52%の軽減が58%効いている」と誤読し、検査を1つ落とした。
 * ここでは既定で `random: 1` を入れ、間違った名前が来たら止める。
 */
function calc(arg) {
  const R = RPG();
  if (arg.options && 'randomRange' in arg.options) {
    throw new Error('randomRange は damage.js に存在しません。乱数を止めるなら random: 1 を使ってください');
  }
  const options = Object.assign({ crit: false, random: 1 }, arg.options || {});
  return R.damage.calc(Object.assign({}, arg, { options }));
}

/**
 * 状態異常の割合の上限。
 *
 * `battle.statusRatio` は **読むたびに** ここで丸める。何%載せても上限止まりで、
 * 火傷を 6% と 10% で測って同じ値が出たことがある（どちらも 3.5% に丸められていた）。
 * 載せる前に確かめること。
 */
function statusCap(kind) { return RPG().battle.STATUS_CAP[kind]; }

/** 表を整えて出す。head は見出しの配列、rows はセルの配列の配列。 */
function table(head, rows) {
  const w = head.map((h, i) => Math.max(
    String(h).length, ...rows.map((r) => String(r[i]).length)
  ));
  const line = (cells) => cells.map((c, i) => String(c).padEnd(w[i])).join('  ');
  console.log(line(head));
  for (const r of rows) console.log(line(r));
}

module.exports = {
  load, RPG, useSave, invest, run, repeat, fmt, calc, statusCap, table,
  get ctx() { return ctx; },
};
