// @ts-check
/**
 * 異相 (§22)。既存フィールドに条件を重ねて、同じ場所を別の戦いにする。
 *
 * ここは「どの相がどのフィールドで選べるか」と「その相が何を否定するか」を
 * 答えるだけの層。効かせる場所は battle.js と damage.js が持つ。
 *
 * ── 名前 ──
 * `battle.phase` は手番の局面で使われているので、こちらは `battle.aspect`。
 */
(function (RPG) {
  'use strict';

  /** @param {string} id */
  function def(id) {
    return (RPG.data.aspects && RPG.data.aspects[id]) || null;
  }

  /** 全部の相。 */
  function all() {
    const src = RPG.data.aspects || {};
    return Object.keys(src).map((id) => Object.assign({ id }, src[id]));
  }

  /**
   * そのフィールドで選べる相。
   * @param {string} fieldId
   */
  function forField(fieldId) {
    return all().filter((a) => (a.fields || []).indexOf(fieldId) >= 0);
  }

  /**
   * 選べるようになる条件 (§22)。
   *
   * ── なぜフィールドの踏破を条件にするのか ──
   * 相は「その場所を組み替えて遊ぶ」ためのものなので、
   * **素の状態で一度抜けている**ことが前提。抜ける前に相を選べると、
   * 「難しいほうから入って詰まる」入口になる。
   *
   * 判定は図鑑の記録を読む。別に持つと二重帳簿になる。
 *
 * @知見: `codex.fieldSeen` は「出撃したか」であって「抜けたか」ではない。
 * 負けても visits は進むので、抜けたかはボスの killed で見る。
 *
 * ⚠ 最初に `RPG.codex.seen('field', id)` と書いていたが、
 * そんな関数は存在しない。手前の `if (!RPG.codex.seen) return true` が
 * それを飲んでしまい、**解放条件が常に真**になっていた。
 * 無い関数を見たときの既定は「通す」でなく「閉じる」にする。
   *
   * @param {string} fieldId
   */
  function unlocked(fieldId) {
    const f = RPG.data.fields[fieldId];
    if (!f || !f.boss) return false;
    if (!RPG.codex || !RPG.codex.enemyEntry) return false;
    return RPG.codex.enemyEntry(f.boss).killed > 0;
  }

  /** 軸の一覧と見出し。**1軸につき1つだけ選べる。** */
  const AXES = [
    { id: 'element', label: '属性' },
    { id: 'tempo', label: '手番' },
    { id: 'aim', label: '狙い' },
  ];

  /**
   * 相を重ねる (§22)。
   *
   * ── なぜ軸を分けているのか ──
   * **ここを分けないと二重取りが起きる。**
   * 最初はあまねく・弱きを選ぶ・硬きを試すの3つが
   * `enemyFirst` を内蔵していた。そのまま重ねられると、
   * 「先を取る相」を足しても**何も起きないのに報酬だけ乗る**。
   *
   * 狙い方も同士では成立しない。弱い者と硬い者を同時に狙うことはできず、
   * 全体攻撃はそもそも狙いを消すので、`targetRule` が黙って死んだ旗になる。
   * 属性の否定も 1 属性しか均せないので排他。
   *
   * だから **1軸につき1つ**とし、軸同士は直交させてある。
   * 重なったときは**後に渡されたほうを残す**（画面で選び直した順）。
   *
   * @param {Array<string>} ids
   */
  function pickOnePerAxis(ids) {
    /** @type {Record<string, string>} */
    const byAxis = {};
    /** @type {string[]} */
    const free = [];
    for (const id of ids || []) {
      const d = def(id);
      if (!d) continue;
      if (d.axis) byAxis[d.axis] = id;
      else if (free.indexOf(id) < 0) free.push(id);
    }
    return AXES.map((a) => byAxis[a.id]).filter(Boolean).concat(free);
  }

  /**
   * 相を選んだことそのものへの上乗せ。**何つ重ねても一度だけ。**
   *
   * 各相の `rewardMult` は「この基本分＋その相のラウンド対価」になっている。
   */
  const BASE_PREMIUM = 0.30;

  /**
   * 2つ目以降の相ひ1つにつき足す分。
   *
   * **風味でなく、重なったときに増える手番のぶん。**
   * 安い相は単体ではラウンド対価がほぼゼロだが（先を取る相は比 1.01）、
   * 高い相に重なると増える——硬きを試す相単体の 9.03R に対し、
   * 闇＋先制を足すと 9.52R（約 +5%）。
   *
   * これを払わないと、重なったときだけ効率が 1.22〜1.23 倍まで落ち、
   * **重ねると損をする**形になる。
   */
  const STACK_PREMIUM = 0.05;

  /**
   * 報酬の上乗せ。相を選んでいなければ 1。
   *
   * ── なぜ必要なのか ──
   * **当初「報酬は変えない」で作っていたが、これは設計の誤りだった。**
   * 依頼書 §8 の誺理を当てれば、難しくて実入りが同じ選択肢は
   * 選ばれないだけで、置いてあることに意味がなくなる。
   *
   * ── 重なったときの式 ──
   *   1 + BASE_PREMIUM + Σ(mᵢ - 1 - BASE_PREMIUM) + STACK_PREMIUM × (n - 1)
   *
   * 掛け算にしない。掛け算だと伸び方が加速して
   * 「全部乗せで回せるビルドだけが正解」になる。
   *
   * **基本分を相ごとに払わないのが要点。** 一度そうしていて、
   * 重なったときに過払いになった（実測、終わりなき回廊・Lv255・60試行）。
   *
   * 測った効率（1ラウンドあたりのゴールド、素 = 1.00）。狙いは 1.30。
   *
   *   組み合わせ                   素朴な加算   基本分を一度だけ   ＋重ね分
   *   硬きを試す だけ                1.30         1.30              1.30
   *   闇＋硬きを試す              1.50         1.30              1.33
   *   闇＋先制＋硬きを試す        1.61         1.23              1.29
   *   闇＋先制＋あまねく          —            1.22              1.28
   *   闇＋先制＋弱きを選ぶ        1.89         1.29              1.39
   *
   * 闇を拒む相は三系統分散のビルドにはラウンド対価がゼロなのに、
   * 素朴に足すと +30% もらえていた。それが過払いの正体。
   *
   * @知見: 相の報酬倍率は「勝てる編成でのラウンド数が素の何倍か」から逆算している
   * @知見: 報酬を勝率で校正すると、ビルドが強くなるほど上乗せが過大になる（向きが逆立ちする）
   * @知見: 勝率は10試行だと 20〜30 ポイント揺れる。ラウンド数は60試行で安定する
   * @知見: 重なった上乗せは基本分を一度だけ払う。相ごとに払うと安い相を足すだけで得をする
   *
   * @param {string | null | undefined | Array<string>} id
   */
  function rewardMult(id) {
    const ids = pickOnePerAxis(Array.isArray(id) ? id : (id ? [id] : []));
    if (ids.length === 0) return 1;
    let sum = 0;
    for (const one of ids) {
      const d = def(one);
      if (!d || !d.rewardMult) continue;
      // その相のラウンド対価だけを取り出す。下を切っておく——
      // 基本分より安い相を置いたときに**合計を減らさない**ため。
      sum += Math.max(0, d.rewardMult - 1 - BASE_PREMIUM);
    }
    return 1 + BASE_PREMIUM + sum + STACK_PREMIUM * (ids.length - 1);
  }

  /**
   * 宝箱の上乗せ。ゴールドと同率。
   *
   * ── 一度半分にして、測って戻した ──
   * 最初は `1 + (m-1)/2` にしていた。理屈は「宝箱は効きが長い」——
   * 装備になり、強さになり、次の周回が速くなるのだから、
   * ゴールドと同じ倍率をかけるのは均等でないと考えた。
   *
   * **測ったら持たなかった。** 1ラウンドあたりの宝箱が
   * 硬きを試す相で **0.99 倍**、あまねく相で 1.09 倍。
   * 半分にした上乗せが、増えたラウンドと勝率の損に食われて消える。
   *
   * しかも終盤の実入りの主役は**装備の売却益**なので、
   * 宝箱が増えないと上乗せそのものが薄まる。
   *
   * @知見: 報酬の上乗せを宝箱とゴールドで別率にすると、宝箱側はラウンド増に食われて消える
   *
   * @param {string | null | undefined | Array<string>} id
   */
  function boxMult(id) {
    return rewardMult(id);
  }

  /**
   * 戦闘へ載せる形。`battle.start({ aspectId })` から呼ばれる。
   *
   * 複数渡されたら畳んで1つに見せる。読む側（battle.js / damage.js）は
   * **ひとつの `effects` を読むだけ**でよいままにしておく。
   *
   * @param {string | null | undefined | Array<string>} id
   */
  function resolve(id) {
    const ids = pickOnePerAxis(Array.isArray(id) ? id : (id ? [id] : []));
    if (ids.length === 0) return null;
    /** @type {Record<string, any>} */
    const effects = {};
    /** @type {any[]} */
    const defs = [];
    // 敵の倍率も加算で畳む（1 + Σ(s-1)）。
    // 掛け算にすると ×2 と ×5 で ×10 になり、
    // 実測で 1.2R 全滅の一撃死の二択になると分かっている。
    let scaleSum = 0;
    /** @type {Record<string, number>} */
    const scale = {};
    for (const one of ids) {
      const d = def(one);
      if (!d) continue;
      defs.push(Object.assign({ id: one }, d));
      Object.assign(effects, d.effects || {});
      for (const k of Object.keys(d.enemyScale || {})) {
        scale[k] = (scale[k] || 1) + (d.enemyScale[k] - 1);
        scaleSum++;
      }
    }
    return {
      id: ids.length === 1 ? ids[0] : ids.join('+'),
      ids,
      // 1つなら従来と同じ。読む側を変えないすみ。
      def: ids.length === 1 ? defs[0] : combinedDef(defs),
      defs,
      effects,
      enemyScale: scaleSum > 0 ? scale : null,
    };
  }

  /**
   * 重なったときの見た目。**実体のない相を作っているのでなく、
   * 画面とログが 1 つの def を読む前提を崩さないための包み。**
   * @param {any[]} defs
   */
  function combinedDef(defs) {
    return {
      name: defs.map((d) => d.name).join('＋'),
      color: defs[defs.length - 1].color,
      icon: defs[defs.length - 1].icon,
      effect: defs.map((d) => d.effect).join(' ／ '),
      flavor: defs[0].flavor,
      desc: defs.map((d) => d.desc).join(''),
      fields: defs[0].fields,
    };
  }

  /**
   * この攻撃属性が、いまの相で否定されているか。
   *
   * **オートも同じ判定を読む必要がある。** 読まないと、否定されている属性の技を
   * 「よく通る技」と見積もって選び、実際には等倍でしか入らない
   * （闘技場の elementNull で同じ事故が起きている）。
   *
   * @param {any} battle @param {string} attackElement
   */
  function denies(battle, attackElement) {
    const a = battle && battle.aspect;
    if (!a || !attackElement) return false;
    return a.effects.denyElement === attackElement;
  }

  /** 画面に出す短い説明。 */
  function summary(id) {
    const d = def(id);
    if (!d) return null;
    return {
      id, name: d.name, reading: d.reading, color: d.color, icon: d.icon,
      effect: d.effect, flavor: d.flavor, desc: d.desc,
      rewardMult: rewardMult(id), boxMult: boxMult(id),
    };
  }

  RPG.aspect = { AXES, BASE_PREMIUM, STACK_PREMIUM, def, all, forField, unlocked, resolve, denies, summary,
    rewardMult, boxMult, pickOnePerAxis };
})(window.RPG);
