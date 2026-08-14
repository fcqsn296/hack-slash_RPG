// @ts-check
/**
 * ダメージ計算エンジン (§3)。
 *
 * このモジュールは純粋関数だけで構成され、戦闘UIやゲーム状態に一切依存しない。
 * §11 の検証テストケースは test/index.html からこの calc() を直接叩いて検証する。
 *
 * 計算フロー (§3.2):
 *   基礎ダメ × 系統タグ倍率 × ユニークバフ倍率 × 被ダメ倍率 × 属性倍率 × クリティカル倍率 × ランダム係数
 *   → ダメージ上限の減衰処理 → 整数化
 */
(function (RPG) {
  'use strict';

  /**
   * 防御定数の係数: C = レベル × PER_LEVEL + BASE (§3.2 ステップ4)
   *
   * ── なぜ 100 から 40 へ下げたか ──
   * 実測すると、防御は後半で無意味になるのではなく **最初から効いていなかった**。
   * C はレベル×100 で伸びるのに、装備込みの DEF はレベルあたり約4しか伸びず、
   * 25倍の速度差で分母に埋もれていた。
   *
   *   係数100  Lv50 8.7% / Lv150 5.7% / Lv255 5.1%（素のDEF）
   *   係数40   Lv50 17%  / Lv150 13%  / Lv255 11%
   *
   * 40 にしたのは、既存のバランスを大きく動かさずに「素の防御にも
   * わずかに意味がある」水準へ戻すため。ここを 20 まで下げると
   * 敵の攻撃が一律に2〜4割軽くなり、調整済みの手応えが全部動く。
   *
   * **防御で耐えるビルドは、この係数ではなく DEF を盛る側で成立させる。**
   * 特化したときだけ届く梃子を用意してある (§5.8)。
   */
  const DEF_CONST_PER_LEVEL = 40;
  const DEF_CONST_BASE = 500;

  /** ダメージ上限のベース値と、超過分の残存率 (§3.2 ステップ8) */
  const BASE_DAMAGE_CAP = 500000;
  const CAP_OVERFLOW_RATE = 0.1;

  /** クリティカル倍率 (§3.2 ステップ6) */
  const CRIT_MULTIPLIER = 1.5;

  /** ランダム揺らぎの範囲 (§3.2 ステップ7) */
  const RANDOM_MIN = 0.85;
  const RANDOM_MAX = 1.15;

  /** 属性相性の倍率 (§3.2 ステップ5) */
  const ADVANTAGE = 1.5;
  const DISADVANTAGE = 0.5;
  const NEUTRAL = 1.0;

  /**
   * 「属性貫通」を全振りしたときに、不利属性の相手へ乗る特効。
   * 貫通が「全属性適応」の下位互換にならないようにするための差別化 (§5.4)。
   */
  const PIERCE_BONUS = 0.6;

  /**
   * 有利方向の定義。
   * 4すくみ: 火→風→土→水→火 / 光と闇は相互に有利 / 無属性はすべて等倍。
   * @type {Record<string, string[]>}
   */
  const STRONG_AGAINST = {
    fire:  ['wind'],
    wind:  ['earth'],
    earth: ['water'],
    water: ['fire'],
    light: ['dark'],
    dark:  ['light'],
    none:  [],
  };

  /** 属性の表示名 */
  const ELEMENT_LABEL = {
    none: '無', fire: '火', water: '水', wind: '風',
    earth: '土', light: '光', dark: '闇',
  };

  /** 系統タグの表示名 (§3.2 ステップ2) */
  const TAG_LABEL = { phys: '物理', magi: '魔術', reli: '遺物' };

  /** 系統タグの識別子一覧 */
  const TAGS = ['phys', 'magi', 'reli'];

  /**
   * @typedef {Object} TagBonus
   * @property {'phys'|'magi'|'reli'} tag  どの系統タグの枠に加算するか
   * @property {number} value             加算値（0.2 = +20%）
   * @property {('phys'|'magi'|'reli')|null} [matchType]
   *   指定した場合、スキルの damage_type が一致したときのみ適用される。
   *   null/未指定なら常に適用（設計書§3.2の基本挙動）。
   */

  /**
   * @typedef {Object} Attacker
   * @property {number} level
   * @property {{atk: number, magi_power: number}} stats
   * @property {string} element                 キャラクターの属性
   * @property {TagBonus[]} [tagBonuses]        装備・パッシブ・共通バフの系統タグ補正
   * @property {number[]} [uniqueBuffs]         固有ユニークバフの増加率（それぞれ独立乗算）
   * @property {number} [capBreak]              ダメージ上限突破率（0.2 = 上限1.2倍）
   * @property {number} [critRate]              装備等によるクリティカル率加算
   * @property {number} [critDamage]            クリティカル倍率への加算（0.5 なら 1.5 → 2.0）
   * @property {number} [execute]               追い打ち。相手のHPが減っているほど威力が上がる
   * @property {number} [hpRatio]               自分の残HP割合。背水の計算に使う
   * @property {number} [lowHpPower]            背水。自分のHPが減っているほど威力が上がる
   * @property {number} [highHpPower]           万全。自分のHPが満タンに近いほど威力が上がる
   * @property {number} [bossSlayer]            ボス特効。相手がボスのとき威力が上がる
   * @property {number} [debuffAmp]             追撃。相手がデバフ状態のとき威力が上がる
   * @property {number} [firstRoundPower]       先制。1ラウンド目の威力が上がる
   * @property {number} [stableDamage]          安定。ランダム揺らぎの幅を狭める (§5.6)
   * @property {number} [weakHunter]            弱点狩り。素で有利を取れたときに伸びる (§5.7)
   * @property {number} [neutralPower]          等倍のときに伸びる。無属性ビルドの受け皿 (§5.7)
   * @property {number} [critPierce]            会心のときだけ防御を無視する割合 (§5.7)
   * @property {number} [critExecute]           会心したときだけ追い打ちが強くなる (§5.8)
   * @property {number} [fullHpFoePower]        HPが減っていない敵への火力 (§5.8)
   * @property {boolean} [isBoss]               自分がボスか。相手の「巨獣への備え」判定に使う (§5.8)
   * @property {number} [levelPower]            レベルで伸びる火力（主人公専用 §8.1）
   * @property {ElementMods} [elementMods]      スキルツリーの属性戦略パターン (§5.4)
   */

  /**
   * 属性戦略パターン (§5.4)。スキルツリーのノードから組み立てられる。
   * @typedef {Object} ElementMods
   * @property {number} [adapt]   「全属性適応」の段階。1で不利を等倍に無効化、2で全攻撃を有利化
   * @property {Record<string, number>} [mastery] 「○○の極意」。有利時の倍率を属性ごとに上書き
   * @property {boolean} [chaos]  「混沌の力」。攻撃属性を無属性に固定する
   * @property {string} [convert] 「属性変換」。攻撃属性を指定した属性に固定する (§5.6)
   * @property {number} [pierce]  「属性貫通」。不利を等倍へ寄せ、不利な相手への特効が乗る
   * @property {string} [dual]    「双極」。この属性でも相性を判定し、有利なほうを採る (§5.7)
   * @property {Record<string, number>} [power]
   *   属性ごとの威力上乗せ。相性倍率とは別枠で、等倍・不利の相手にも乗る (§5.7)
   * @property {Record<string, number>} [resist]
   *   受ける側が持つ、攻撃属性ごとの被ダメージ軽減 (§5.7)
   * @property {Record<string, number>} [crit]     属性ごとのクリティカル率加算 (§5.8)
   * @property {Record<string, number>} [tagCrit]  系統タグごとのクリティカル率加算 (§5.8)
   * @property {Record<string, number>} [tagPierce] 系統タグごとの防御無視 (§5.8)
   */

  /**
   * @typedef {Object} Defender
   * @property {number} level
   * @property {number} def
   * @property {string} element
   * @property {number} [reduction]  被ダメージ軽減率。合計1.0で被ダメージ0＝無敵 (§3.1-3)
   * @property {number} [hpRatio]    残りHPの割合。追い打ちの計算に使う。未指定なら満タン扱い
   * @property {boolean} [isBoss]    ボスかどうか。ボス特効の判定に使う
   * @property {number} [debuffs]    かかっているデバフの数。追撃の判定に使う
   * @property {number} [weakGuard]  弱点を突かれたときに被害を減らす割合 (§5.7)
   * @property {ElementMods} [elementMods] 受ける側の属性補正。resist だけを見る (§5.7)
   * @property {number} [bossGuard]  ボスから受けるダメージを減らす割合 (§5.8)
   */

  /**
   * @typedef {Object} Skill
   * @property {number} power                   威力倍率（100 = 等倍）
   * @property {'atk'|'magi_power'} scaling_stat
   * @property {'phys'|'magi'|'reli'} damage_type
   * @property {string} [element]               未指定なら攻撃側キャラの属性を使う
   * @property {number} [crit_rate]
   */

  /**
   * @typedef {Object} CalcOptions
   * @property {number} [random]        ランダム係数を固定する（テスト用）。未指定なら 0.85〜1.15
   * @property {boolean} [crit]         クリティカルを強制する/させない（テスト用）
   * @property {boolean} [ignoreDefense] 防御無視 (§3.2 ステップ4)
   * @property {number} [powerScale]    多段ヒット等でスキル威力をさらに補正する係数
   * @property {boolean} [firstRound]   1ラウンド目か（先制パッシブの判定に使う）
   * @property {number} [comboPower]    弱点コンボの上乗せ (§10.6)。battle.js が積み上げを管理する
   * @property {number} [setPower]      装備セットの倍率 (§7.7)。battle.js が戦況を見てまとめる
   * @property {number} [lowPowerBoost] 小技だけの底上げ (§4.3)
   * @property {number} [highPowerBoost] 大技だけの底上げ (§5.8)
   * @property {boolean} [elementNull] 属性相性を常に等倍に均す。闘技場のギミック (§17)
   */

  /**
   * 属性相性倍率を返す (§3.2 ステップ5)。
   * @param {string} attackElement
   * @param {string} defendElement
   * @returns {number} 1.5 / 1.0 / 0.5
   */
  function elementMultiplier(attackElement, defendElement) {
    if (attackElement === 'none' || defendElement === 'none') return NEUTRAL;
    if ((STRONG_AGAINST[attackElement] || []).includes(defendElement)) return ADVANTAGE;
    if ((STRONG_AGAINST[defendElement] || []).includes(attackElement)) return DISADVANTAGE;
    return NEUTRAL;
  }

  /**
   * 系統タグ倍率を返す (§3.2 ステップ2)。
   *
   * 核心ルール: 同一タグ内は加算、異なるタグ同士は乗算。
   *   系統タグ倍率 = (1 + 物理合計) × (1 + 魔術合計) × (1 + 遺物合計)
   *
   * @param {TagBonus[]} bonuses
   * @param {'phys'|'magi'|'reli'} damageType スキルのダメージタイプ（match_type 判定に使う）
   * @returns {{ multiplier: number, sums: Record<string, number> }}
   */
  function tagMultiplier(bonuses, damageType) {
    /** @type {Record<string, number>} */
    const sums = { phys: 0, magi: 0, reli: 0 };
    for (const b of bonuses || []) {
      if (!b || !(b.tag in sums)) continue;
      // match_type 付きの補正は、スキルの damage_type が一致したときだけ乗る。
      if (b.matchType && b.matchType !== damageType) continue;
      sums[b.tag] += b.value;
    }
    const multiplier = TAGS.reduce((m, tag) => m * (1 + sums[tag]), 1);
    return { multiplier, sums };
  }

  /**
   * 固有ユニークバフ倍率を返す (§3.2 ステップ3)。
   * すべて独立した別枠で乗算される: Π(1 + 各固有バフ増加率)
   * @param {number[]} values
   * @returns {number}
   */
  function uniqueMultiplier(values) {
    return (values || []).reduce((m, v) => m * (1 + v), 1);
  }

  /**
   * 除算型の被ダメージ倍率を返す (§3.2 ステップ4)。
   *   C = 被攻撃側レベル × 100 + 500
   *   軽減率 = DEF / (DEF + C)
   *   被ダメ倍率 = 1 - 軽減率
   * @param {number} def
   * @param {number} defenderLevel
   * @returns {number}
   */
  function defenseMultiplier(def, defenderLevel) {
    if (def <= 0) return 1;
    const c = defenderLevel * DEF_CONST_PER_LEVEL + DEF_CONST_BASE;
    return 1 - def / (def + c);
  }

  /**
   * ダメージ上限の減衰処理 (§3.2 ステップ8)。
   * 上限を超えた分は10%まで減衰させ、ボスの瞬殺を防ぐ。
   * @param {number} raw 暫定ダメージ
   * @param {number} capBreak 上限突破率
   * @returns {number}
   */
  function applyCap(raw, capBreak) {
    const cap = BASE_DAMAGE_CAP * (1 + (capBreak || 0));
    if (raw <= cap) return raw;
    return cap + (raw - cap) * CAP_OVERFLOW_RATE;
  }

  /**
   * ダメージを計算する。戻り値には検証用の内訳を含む。
   * @param {{attacker: Attacker, defender: Defender, skill: Skill, options?: CalcOptions}} params
   * @returns {{
   *   damage: number, raw: number, crit: boolean,
   *   breakdown: {
   *     base: number, tag: number, tagSums: Record<string, number>, unique: number,
   *     defense: number, element: number, critical: number, random: number, capped: boolean
   *   }
   * }}
   */
  function calc(params) {
    const { attacker, defender, skill } = params;
    const options = params.options || {};

    // --- ステップ1: 基礎ダメージ ---
    const statValue = attacker.stats[skill.scaling_stat] || 0;
    const power = (skill.power / 100) * (options.powerScale == null ? 1 : options.powerScale);
    const base = statValue * power;

    // --- ステップ2 + 3(共通バフ): 系統タグ倍率 ---
    const tag = tagMultiplier(attacker.tagBonuses || [], skill.damage_type);

    // --- ステップ3(固有): ユニークバフ倍率 ---
    const unique = uniqueMultiplier(attacker.uniqueBuffs || []);

    // --- ステップ4: 防御軽減 ---
    let defense = options.ignoreDefense ? 1 : defenseMultiplier(defender.def, defender.level);
    // 系統ごとの貫通 (§5.8)。「防御崩し」が確率なのに対し、こちらは確定で少しずつ抜く。
    const preMods = attacker.elementMods || {};
    const tagPierce = (preMods.tagPierce && preMods.tagPierce[skill.damage_type]) || 0;
    if (tagPierce > 0 && !options.ignoreDefense) {
      defense += (1 - defense) * Math.min(1, tagPierce);
    }

    // --- ステップ5: 属性相性（スキルツリーの属性戦略を反映 §5.4）---
    const mods = attacker.elementMods || {};
    // 「混沌の力」は属性パズルを放棄し、すべての攻撃を無属性に固定する
    // 「混沌の力」は無属性へ、「属性変換」は指定した属性へ、攻撃を固定する (§5.6)
    const attackElement = mods.chaos ? 'none'
      : (mods.convert || skill.element || attacker.element);
    // 素の相性。貫通の判定は「適応で塗り替えられる前の相性」で行う。
    // 「双極」— もう1つの属性でも相性を見て、良かったほうを素の相性として扱う (§5.7)。
    // 属性を固定する変換系と違い、相手に合わせて勝手に良いほうが選ばれる。
    const rawElement = mods.dual
      ? Math.max(
        elementMultiplier(attackElement, defender.element),
        elementMultiplier(mods.dual, defender.element)
      )
      : elementMultiplier(attackElement, defender.element);
    let element = rawElement;
    // 「全属性適応」— 段階1で不利を無効化、段階2で全攻撃を有利扱いにする。
    // 無属性どうしのような素で等倍の組み合わせにも効く（段階2なら 1.0 → 1.5）。
    if (mods.adapt >= 2) element = Math.max(element, ADVANTAGE);
    else if (mods.adapt >= 1) element = Math.max(element, NEUTRAL);
    // 「○○の極意」— 有利が成立しているときだけ、その属性の有利倍率を引き上げる。
    // 適応で有利になった攻撃にも乗るので、適応2＋極意は意図的に重なる。
    if (element > 1 && mods.mastery && mods.mastery[attackElement]) {
      element = mods.mastery[attackElement];
    }
    // 「属性貫通」— 不利属性の相手にだけ働く。
    //
    // 不利倍率を等倍側へ寄せるだけでは「全属性適応」の下位互換にしかならないため、
    // 寄せたうえで **不利な相手にこそ強くなる** 特効を乗せている。
    // 適応が「どこでも腐らない」万能なのに対し、貫通は「苦手を狩り場に変える」尖り方をする。
    if (rawElement < 1 && mods.pierce) {
      const rate = Math.min(1, mods.pierce);
      element = Math.max(element, DISADVANTAGE + (NEUTRAL - DISADVANTAGE) * rate);
      element *= 1 + PIERCE_BONUS * rate;
    }
    // 「○○の心得」— 属性ごとの威力上乗せ (§5.7)。
    // 相性倍率とは別枠なので、等倍・不利の相手にも乗る。極意が「有利をより有利に」
    // するのに対し、こちらは「その属性で殴り続ける」ビルドを底上げする。
    if (mods.power && mods.power[attackElement]) element *= 1 + mods.power[attackElement];
    // 受ける側の属性耐性 (§5.7)。
    const dMods = defender.elementMods || {};
    if (dMods.resist && dMods.resist[attackElement]) {
      element *= Math.max(0, 1 - Math.min(0.9, dMods.resist[attackElement]));
    }
    // 「弱点耐性」— 弱点を突かれたときだけ、そのぶんを削り取る (§5.7)。
    if (rawElement > 1 && defender.weakGuard) {
      element *= Math.max(0, 1 - Math.min(0.9, defender.weakGuard));
    }

    // 闘技場の「属性の否定」(§17)。
    // ここまでで積み上げた属性まわりを最後に均す。
    // 適応・極意・貫通・双極・心得・耐性が、まとめて意味を失う。
    // 計算の流れは分岐させず、結果だけを1.0で塗り替えることで、
    // 本流に手を入れたときにここだけ取り残される事故を避けている。
    if (options.elementNull) element = NEUTRAL;

    // --- ステップ6: クリティカル ---
    // 属性・系統ごとのクリティカル率 (§5.8)。
    // 「一点集中」が全部乗せなのに対し、こちらは的を絞るぶん1段あたりが大きい。
    const critRate = (skill.crit_rate || 0) + (attacker.critRate || 0)
      + ((mods.crit && mods.crit[attackElement]) || 0)
      + ((mods.tagCrit && mods.tagCrit[skill.damage_type]) || 0);
    const crit = options.crit == null ? RPG.rng.chance(critRate) : options.crit;
    const critical = crit ? CRIT_MULTIPLIER + (attacker.critDamage || 0) : 1;
    // 「会心貫通」— 会心したときだけ防御を抜く (§5.7)。
    // 乱数を引いた後に判定しているので、乱数の消費順は会心貫通の有無で変わらない。
    if (crit && attacker.critPierce && !options.ignoreDefense) {
      defense += (1 - defense) * Math.min(1, attacker.critPierce);
    }

    // --- ステップ7: ランダム揺らぎ ---
    // 「安定」は揺らぎの幅を中央へ寄せる (§5.6)。1.0 で完全に揺らがなくなる。
    let random = options.random == null ? RPG.rng.float(RANDOM_MIN, RANDOM_MAX) : options.random;
    const stable = Math.min(1, attacker.stableDamage || 0);
    if (stable > 0 && options.random == null) {
      const mid = (RANDOM_MIN + RANDOM_MAX) / 2;
      random = mid + (random - mid) * (1 - stable);
    }

    // --- 追加ステップA: 追い打ち（相手のHPが減っているほど威力が上がる）---
    // 未設定なら 1.0 のまま。§3.2 の基本計算には影響しない。
    const hpRatio = defender.hpRatio == null ? 1 : Math.max(0, Math.min(1, defender.hpRatio));
    // 「会心の追い打ち」— 会心したときだけ追い打ちの効きが増す (§5.8)。
    const executeRate = (attacker.execute || 0) * (1 + (crit ? (attacker.critExecute || 0) : 0));
    const execute = 1 + executeRate * (1 - hpRatio);

    // --- 追加ステップA2: 状況に応じた特殊パッシブ ---
    // どれも未設定なら 1.0 のまま。条件が噛み合ったときだけ乗る。
    const selfHp = attacker.hpRatio == null ? 1 : Math.max(0, Math.min(1, attacker.hpRatio));
    let situational = 1;
    // 背水: 自分のHPが減っているほど強い
    if (attacker.lowHpPower) situational *= 1 + attacker.lowHpPower * (1 - selfHp);
    // 万全: 自分のHPが満タンに近いほど強い
    if (attacker.highHpPower) situational *= 1 + attacker.highHpPower * selfHp;
    // ボス特効
    if (attacker.bossSlayer && defender.isBoss) situational *= 1 + attacker.bossSlayer;
    // 追撃: 相手が弱っている（デバフ状態）ときに伸びる
    if (attacker.debuffAmp && (defender.debuffs || 0) > 0) situational *= 1 + attacker.debuffAmp;
    // 先制: 1ラウンド目だけ強い
    if (attacker.firstRoundPower && options.firstRound) situational *= 1 + attacker.firstRoundPower;
    // 弱点狩り: 素で有利を取れたときだけ伸びる (§5.7)。
    // 「全属性適応」で有利に塗り替えた攻撃には乗らないので、両取りにはならない。
    if (attacker.weakHunter && rawElement > 1) situational *= 1 + attacker.weakHunter;
    // 等倍の心得: 相性が動かない相手に強い。無属性ビルドと混沌の受け皿 (§5.7)。
    if (attacker.neutralPower && rawElement === NEUTRAL) situational *= 1 + attacker.neutralPower;
    // 弱点コンボ (§10.6)。積み上げの管理は battle.js が持ち、ここは倍率を受け取るだけ。
    if (options.comboPower) situational *= 1 + options.comboPower;
    // 装備セット (§7.7)。戦況を見て決まるぶんは battle.js が倍率にまとめて渡す。
    if (options.setPower != null) situational *= options.setPower;
    // 【主人公専用】レベルで伸びる火力 (§8.1)。凸が無いぶんを育成量で埋める。
    if (attacker.levelPower) situational *= 1 + attacker.levelPower * (attacker.level || 1);
    // 小技だけの底上げ (§4.3)。強技に乗らないので、上位技への置き換えは起きない。
    if (options.lowPowerBoost) situational *= 1 + options.lowPowerBoost;
    // 大技だけの底上げ (§5.8)。小技側とちょうど対になっていて、両取りはできない。
    if (options.highPowerBoost) situational *= 1 + options.highPowerBoost;
    // 「不意打ち」— まだ削られていない相手に強い。追い打ちのちょうど裏返し (§5.8)。
    if (attacker.fullHpFoePower) situational *= 1 + attacker.fullHpFoePower * hpRatio;
    // 「巨獣への備え」— ボスから受けるダメージを減らす (§5.8)。受ける側の値を見る。
    if (defender.bossGuard && attacker.isBoss) {
      situational *= Math.max(0, 1 - Math.min(0.9, defender.bossGuard));
    }

    // --- 追加ステップB: 被ダメージ軽減 (§3.1-3 無敵化の構築) ---
    // 複数の軽減手段は加算され、合計1.0に達すると被ダメージが0になる。
    const reduction = Math.max(0, Math.min(1, defender.reduction || 0));
    const taken = 1 - reduction;

    // --- 統合 ---
    const raw = base * tag.multiplier * unique * defense * element * critical * random
      * execute * situational * taken;

    // --- ステップ8: ダメージ上限（減衰処理） ---
    const capped = applyCap(raw, attacker.capBreak || 0);

    return {
      // 軽減が100%に達したときだけ0を許し、それ以外は最低1ダメージを保証する
      damage: taken <= 0 ? 0 : Math.max(1, Math.floor(capped)),
      raw,
      crit,
      breakdown: {
        base, tag: tag.multiplier, tagSums: tag.sums, unique,
        defense, element, critical, random, execute, situational, taken, reduction,
        capped: capped < raw,
      },
    };
  }

  RPG.damage = {
    calc,
    elementMultiplier,
    tagMultiplier,
    uniqueMultiplier,
    defenseMultiplier,
    applyCap,
    ELEMENT_LABEL,
    TAG_LABEL,
    TAGS,
    STRONG_AGAINST,
    constants: {
      DEF_CONST_PER_LEVEL, DEF_CONST_BASE, BASE_DAMAGE_CAP,
      CAP_OVERFLOW_RATE, CRIT_MULTIPLIER, RANDOM_MIN, RANDOM_MAX,
    },
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
