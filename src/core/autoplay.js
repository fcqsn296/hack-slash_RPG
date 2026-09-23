// @ts-check
/**
 * オート戦闘の行動選択。
 *
 * 期待ダメージの見積もりには §3 のダメージ計算をそのまま使う。
 * 乱数とクリティカルは固定して呼ぶので、この関数は戦闘状態を一切変更しない。
 */
(function (RPG) {
  'use strict';

  /** 回復に回る味方HPの閾値 */
  const HEAL_THRESHOLD = 0.5;
  /** 全体回復に切り替える人数 */
  const HEAL_PARTY_COUNT = 2;

  /** バフ系のプラグイン */
  // オートが「張り直す対象」として見るバフ。
  //
  // ── reduction_buff が抜けていた ──
  // 被ダメージ軽減の技は8種あるのに、**オートでは一度も選ばれていなかった**。
  // 攻撃技でもなく（power 0）、回復でもなく、この一覧にも無いので、
  // どの分岐にも引っかからず手札の中で死んでいた。
  // テオドラの『万人の盾』やネヴィアの『絶えぬ灯』といった、
  // そのキャラの看板がまるごと使われない状態だった。
  //
  // 実測で見つけた: Lv120 の苛烈な条件でも、テオドラは
  // 不動の砦[def_buff] と 重斬 しか撃っていなかった。
  //
  // barrier（動かぬ壁・大盾の宣誓）はここに入れない。
  // 障壁は持続を持たず buffActive で「もう張ってある」が判定できないので、
  // 一覧に足すと**満タンの上から張り直して手番を捨てる**。
  // 専用の分岐（下の 2.4）で、削れた分と殴った場合を見てから張る。
  //
  // @知見: オートに技を届かせる修正は「選べるようにする」だけでは足りない。選ぶ価値があるかまで見る
  const BUFF_PLUGINS = ['unique_buff', 'tag_buff', 'def_buff', 'reduction_buff'];

  /**
   * 障壁を張り直す目安。残りがこの割合を下回ったら張り直す (§9.1)。
   *
   * **満タンに重ねると手番を捨てることになる。** 障壁は持続を持たないので
   * 上限で無駄になるわけではないが、その1手で殴れたぶんが消える。
   * 半分まで削れてから張り直すと、切れ目を作らずに手数も無駄にしない。
   *
   * 見るのは平均でなく**いちばん薄い者**。狙いが1人に集まる相では、
   * 平均だと剥がされた1人が3人の満タンに隠れて張り直しが走らない。
   */
  const SHIELD_REFRESH = 0.5;

  /**
   * 障壁を張り始めるパーティHPの目安 (§9.1)。
   * まだ誰も傷ついていないうちは、効くかどうか分からない手に1手を使わない。
   * 回復（0.5）より早く動く——障壁は減ってから足すものではなく、備えるもの。
   */
  const SHIELD_TRIGGER = 0.9;

  /**
   * 障壁が攻撃より優先されるのに要る倍率 (§9.1)。
   *
   * ── 時機を直すだけでは足りなかった ──
   * **使えるようにしただけでは弱くなる。** 実測（終わりなき回廊・Lv255・40戦）:
   *
   *   硬きを試す相  勝率 43% → 33%（素朴に張らせた場合）
   *   あまねく相    勝率 78% → 70%（無傷なら張らない、を足しても）
   *
   * 障壁そのものは薄くない。イルマの『動かぬ壁』は1人 13,168、
   * 4人ぶんでパーティ総HPの55%ある。**悪いのは誰が張るか**だった。
   * 検証用の土台のイルマは ATK 46,594 の殴り役で、彼女の1手が生む火力は
   * 配れる障壁より大きい。だから張るたびに損をする。
   *
   * 逆に、DEF を元に張る盾役（大盾の宣誓は DEF×2.5）なら攻撃は薄く、
   * 障壁のほうが価値が高い。**同じ技でも、持ち主によって正解が違う。**
   *
   * だから時機ではなく価値で比べる。その一手で殴れるはずだった量と、
   * 配れる障壁の総量を並べて、障壁がはっきり上回るときだけ張る。
   * 1.0 ちょうどにしないのは、殴れば敵が減って**次の被弾も減る**ぶん、
   * 攻撃のほうに見えない取り分があるため。
   *
   * @知見: 障壁は「使えるようにする」だけだと弱くなる。1手の火力と比べて勝つときだけ張る
   * @知見: 終盤では1手の火力が 93,722〜278,860、障壁は4人ぶんで 52,672。終盤では障壁は選ばれない
   * @知見: 障壁が効くのはツリーを振る前の帯（Lv70 素で勝率 3% → 17%）
   */
  const SHIELD_OVER_ATTACK = 1.3;

  /**
   * 「もう勝ちが見えている」と見なす敵HPの残り割合。
   * バフや障壁は、ここを下回ったら張っても使い切れない。
   */
  const OVERKILL_GUARD = 0.35;

  /**
   * 攻撃技かどうか。
   * @param {any} skill
   */
  function isAttack(skill) {
    return skill.power > 0 && skill.plugin !== 'heal' && !BUFF_PLUGINS.includes(skill.plugin);
  }

  /**
   * その技が既に効果を発揮しているか（同じバフの重ねがけを避ける）。
   * @param {any} actor
   * @param {any} skill
   */
  function buffActive(actor, skill) {
    const label = (skill.params && skill.params.label) || skill.name;
    const has = (/** @type {any[]} */ list) => (list || []).some((b) => b.label === label);
    // 軽減バフは buffReduction に積まれる（battle.js の addReductionBuff）。
    // ここを見ないと「もう張ってある」が判定できず、毎ターン張り直す。
    // 軽減技はクールダウンが持続+1なので実害は出にくいが、
    // **判定は仕組みで正しくしておく**。クールダウン頼みにすると、
    // 持続とCTの関係を将来変えたときに静かに壊れる。
    return has(actor.buffUnique) || has(actor.buffTags)
      || has(actor.statusEffects) || has(actor.buffReduction);
  }

  /**
   * 吸収を織り込んだ「相手のHPが実際に減る量」(§17)。
   *
   * ── なぜ要るのか ──
   * 「虹を喰らう獣」は有利属性の攻撃を回復として喰う。見積が素のダメージのままだと、
   * オートは**一番よく喰われる技を一番よく削れる技と見て**選び続ける。
   * 与えたぶんがそのまま回復に化けるので、味方が上限（maxHitRatio）で守られている
   * ぶんだけ戦闘が終わらない。実測で 3,800 ラウンド走っても決着しなかった。
   *
   * 吸収される技を負の点にすると、等倍や不利の技のほうが高い点を取る。
   * ボスの謳い文句である「等倍か不利で殴るという逆転の発想」に、オートも辿り着く。
   *
   * 満タンの相手には回復が乗らないので、そのときの吸収は 0 点（損も得もしない）。
   * 削った後に喰わせると自分の戦果を戻すことになるので、そこで初めて負になる。
   *
   * @param {number} raw 吸収を考えない見込みダメージ
   * @param {any} actor @param {any} target @param {any} skill @param {any} [battle]
   */
  function absorbed(raw, actor, target, skill, battle) {
    if (!battle || !RPG.battle || !RPG.battle.absorbRatio || raw <= 0) return raw;
    const ratio = RPG.battle.absorbRatio(battle, actor, target, skill);
    if (!(ratio > 0)) return raw;
    const eaten = raw * ratio;
    const healed = Math.min(Math.max(0, (target.maxHp || 0) - (target.hp || 0)), eaten);
    return (raw - eaten) - healed;
  }

  /**
   * 1回の攻撃で与えられる見込みダメージ。多段は回数分を合算する。
   *
   * `battle` を渡すと闘技場の仕掛け (§17) を織り込む。
   * 渡さない呼び出し（test/balance.js の素振り）は素のダメージのまま。
   * @param {any} actor
   * @param {any} target
   * @param {any} skill
   * @param {any} [battle]
   */
  function estimate(actor, target, skill, battle) {
    let hits = skill.plugin === 'multi_hit' ? (skill.params && skill.params.hits) || 1 : 1;
    // 生命代償はHPを払うほど威力が伸びるので、平均的な上乗せを見込む
    if (skill.plugin === 'hp_cost') {
      hits *= 1 + Math.min((skill.params && skill.params.maxBonus) || 4, 2.2);
    }
    // 「連撃」持ちは同じ技が複数回出る
    hits *= 1 + ((actor.passives && actor.passives.doubleHits) || 0);
    const result = RPG.damage.calc({
      attacker: RPG.units.toAttacker(actor),
      defender: RPG.units.toDefender(target),
      skill,
      options: {
        random: 1.0,
        crit: false,
        ignoreDefense: skill.plugin === 'def_ignore' || target.defIgnoredTurns > 0,
        // 闘技場「属性の否定」(§17)。相性が等倍に均される相手では、
        // 有利属性の技は見た目ほど通らない。見積にも同じ条件を渡さないと、
        // オートは「有利だから重い」と誤って読み、より通る等倍の技を取りこぼす。
        elementNull: !!(battle && RPG.battle.elementNulled(battle, target)),
        // 異相「○○を拒む相」(§22)。上とまったく同じ理由で、
        // 見積にも渡さないと否定されている属性の技を「有利だから重い」と誤読する。
        denyElement: (battle && battle.aspect && battle.aspect.effects.denyElement) || null,
      },
    });
    // 起爆 (§5.8) は、たまっている弱体ぶんが本体で、
    // 技そのものの威力は前座にすぎない。ここで足しておかないと
    // オートは威力70の弱い技としか見えず、永久に選ばない。
    // 実際に入る額と同じ関数を通す。
    if (skill.plugin === 'detonate') {
      return absorbed(result.damage * hits + RPG.battle.detonationValue(target).total,
        actor, target, skill, battle);
    }

    return absorbed(result.damage * hits, actor, target, skill, battle);
  }

  /**
   * 次の行動を決める。コマンド入力待ちでなければ null。
   * @param {any} battle
   * @returns {{skillId: string, targets: any[]}|null}
   */
  function chooseAction(battle) {
    const actor = RPG.battle.currentActor(battle);
    if (!actor) return null;

    const allies = RPG.battle.livingParty(battle);
    const foes = RPG.battle.livingEnemies(battle);
    if (foes.length === 0) return null;

    // ── 「皇帝」(§21) — 手番を味方に渡す ──
    //
    // **編成の並び順がそのまま優先順位。** 誰に渡すのが得かを考える仕組みは
    // 入れない（オートの判断を増やすと、どの札のせいで結果が変わったのか
    // 読めなくなる）。渡す相手は中核が選び、撃つ技は**受け手の既存の判断**で決める。
    //
    // 渡せる相手が一人もいなければ、この分岐に入らず本人が普通に動く。
    if (actor.passives && actor.passives.decree && !battle.decree) {
      const cands = RPG.battle.decreeTargets(battle, actor);
      if (cands.length > 0) {
        const to = cands[0];
        // 受け手の技は、受け手として chooseAction を回して決める。
        // **命令中の縛り（手番を生む技は選べない）を通すため、
        // battle.decree を立ててから呼ぶ。** 立てずに呼ぶと号令を選びうる。
        battle.decree = { byKey: actor.key, toKey: to.key };
        let inner = null;
        try { inner = chooseAction(battle); } finally { battle.decree = null; }
        if (inner) return { decreeTo: to.key, skillId: inner.skillId, targets: inner.targets };
      }
    }

    // 今このラウンドで撃てる技だけを候補にする (§12)。
    // 解禁前やクールタイム中の技を選ぶと commandSkill が空振りし、
    // 手番が進まないまま同じ技を選び続けて戦闘が止まってしまう。
    const skills = actor.skills
      .filter((/** @type {string} */ id) => RPG.battle.skillReady(battle, actor, id).ok)
      .map((/** @type {string} */ id) => ({ id, def: RPG.data.skills[id] }));

    // 全部が塞がっていることは通常ない（クラス技以外に鍵は付かない）。
    // 万一そうなっても、commandSkill 側が手番を進めてくれるので戦闘は止まらない。
    if (!skills.length) return { skillId: actor.skills[0], targets: [foes[0]] };

    // --- 1. 回復を優先する ---
    const heals = skills.filter((s) => s.def.plugin === 'heal');
    if (heals.length) {
      // 味方を回復できない者は、自分だけを候補にする (§5.14)。
      //
      // バフ側とまったく同じ罠。遮断された回復は相手のHPを動かさないので、
      // 「傷ついた味方がいる → 回復する → 治らない」を**毎ターン繰り返す**。
      // 手番が全部溶ける。実測で神官戦士の勝率が 99% → 88% まで落ちていた。
      const noAllyHeal = !!(actor.passives && actor.passives.noAllyHeal);
      const healable = noAllyHeal ? allies.filter((u) => u === actor) : allies;
      const hurt = healable
        .filter((u) => u.hp / u.maxHp < HEAL_THRESHOLD)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
      if (hurt.length) {
        const partyHeal = noAllyHeal
          ? null : heals.find((s) => s.def.params && s.def.params.party);
        if (hurt.length >= HEAL_PARTY_COUNT && partyHeal) {
          return { skillId: partyHeal.id, targets: [] };
        }
        const single = heals.find((s) => !(s.def.params && s.def.params.party)) || heals[0];
        const kind = RPG.battle.targetKind(single.def);
        return { skillId: single.id, targets: kind === 'none' ? [] : [hurt[0]] };
      }

      // ── 「節制」(§21) は、ここに判断を足さない ──
      //
      // **一度足して測り、外した。** 「蓄えるためだけに回復を撃つ」形にすると、
      // 回復と強化攻撃を交互に撃つことになる。
      //
      //   終わりなき回廊5ウェーブ・20試行
      //   HP×300   素 5.1ラウンド → 節制 7.3ラウンド
      //   HP×1000  素 5.3ラウンド → 節制 10.5ラウンド
      //
      // 2手（回復＋強化攻撃）で ×2 の一撃が1回なので、**通常攻撃2回と火力上は並ぶだけ**。
      // そのうえ回復の1手ぶん敵に余計な行動を与える。
      // 上限を +200% にしても 7.3ラウンドのまま改善しなかった——
      // **強化ぶんが過剰殺傷で捨てられる回が混ざる**ため。
      //
      // @知見: 「1手を溜めて次の一撃を倍にする」は、過剰殺傷で捨てられるぶん構造的に損になる
      //
      // なので節制は「必要で撃った回復のあふれだけが溜まる」札にしてある。
      // 溜めるための手番を使わないので害が無く、そのぶん利も控えめ。
      // ここに判断を戻すと、上の数字がそのまま再現する。
    }

    // --- 2. まだ効いていないバフを、戦闘が続きそうなときだけ張る ---
    const remaining = foes.reduce((s, e) => s + e.hp, 0);
    const totalMax = foes.reduce((s, e) => s + e.maxHp, 0);
    if (remaining > totalMax * OVERKILL_GUARD) {
      // 遮断されているバフは撃たない (§5.14)。
      //
      // 【極】旗手は「自分にかけたバフが自分に乗らない」。乗らないバフは
      // battle.js が積まないので buffActive が**永久に false を返し**、
      // オートが同じバフを毎ターン撃ち続けて手番を全部溶かす。
      // 実測では旗手を着けた支援の勝率が 97% → 89% まで落ちていた。
      // 自分を対象に取るバフだけが該当する（全体バフは targetKind が 'none'）。
      // 自分にしか乗らないバフか、味方にも配るバフかは **params.party** が決める
      // （buffs.js の resolveTargets が `params.party ? allies() : [actor]`）。
      // targetKind は unique_buff/tag_buff/def_buff のどれも常に 'none' を返すので、
      // そちらで判別しようとすると**一度も引っかからない**。実際それで外した。
      const noSelf = !!(actor.passives && actor.passives.noSelfBuff);
      const selfOnly = (/** @type {any} */ def) => !(def.params && def.params.party);
      const buff = skills.find((s) => BUFF_PLUGINS.includes(s.def.plugin)
        && !buffActive(actor, s.def)
        && !(noSelf && selfOnly(s.def)));
      if (buff) return { skillId: buff.id, targets: RPG.battle.targetKind(buff.def) === 'none' ? [] : [actor] };
    }

    // 障壁の分岐が「殴ったほうが得か」を見るので、ここで先に出しておく。
    const attacks = skills.filter((s) => isAttack(s.def));

    /**
     * その技が張る障壁の量 (§9.1)。barrier と guard_strike で式は同じ。
     * **厚みのパッシブを掛け忘れないこと**——効かせる側（battle.js の
     * grantShield）とずれると、積んだ盾役が一度も張らないという形で静かに死ぬ。
     * @param {any} def
     */
    const shieldAmountOf = (def) => {
      const p = def.params || {};
      const stat = p.scaling || def.scaling_stat || 'magi_power';
      const src = (actor.stats && actor.stats[stat]) || (stat === 'hp' ? actor.maxHp : 0);
      const power = (actor.passives && actor.passives.barrierPower) || 0;
      // 既定倍率はプラグインごとに違う（barrier は 1、guard_strike は 0.2）。
      // **どちらのプラグインの既定と同じ値にしておくこと。** ずれると
      // params.ratio を書き忘れた技だけ見積もりが実際と食い違う。
      const fallback = def.plugin === 'guard_strike' ? 0.2 : 1;
      return Math.max(1, Math.floor(src * (p.ratio || fallback) * (1 + power)));
    };

    // --- 2.4 障壁: HPの外側に積む守り (§9.1) ---
    //
    // ── なぜ専用の分岐が要るのか ──
    // barrier は BUFF_PLUGINS に入れられない。障壁は持続を持たず、
    // ラベルの付いたバフとして積まれないので `buffActive` が
    // **永久に false を返す**。一覧に足すだけだと、満タンの障壁の上から
    // クールタイムが明けるたびに張り直して手番を捨てる。
    //
    // 実測（終わりなき回廊・Lv255・10戦）では、イルマは『動かぬ壁』を
    // **一度も張らずに**素の『斬撃』を40回撃っていた。
    // reduction_buff のときとまったく同じ形で、看板技が手札の中で死んでいた。
    {
      const barriers = skills.filter((s) => s.def.plugin === 'barrier');
      if (barriers.length) {
        // 張る量は barrier.js と同じ式で見積もる（shieldAmountOf を共有）。
        // **ここがずれると「もう十分張ってある」の判定が実際の量と合わなくなる。**
        //
        // ⚠ 厚みのパッシブ (§9.1) を掛け忘れないこと。実際に踏んだ——
        // `barrier_power` を積み切った盾役（45% → 198%）でも
        // **一度も張らなかった**。素の量で見積もって「殴ったほうが得」と
        // 判断していたため。効かせる側（battle.js の grantShield）と
        // 見積もる側がずれると、こういう形で静かに死ぬ。
        const amountOf = shieldAmountOf;

        // 最後のウェーブで敵が残り少ないなら、張っても使い切れない。
        // ウェーブが残っているうちは張ってよい——障壁は持ち越せる。
        const lastBreath = battle.wave >= battle.totalWaves
          && remaining <= totalMax * OVERKILL_GUARD;

        // まだ無傷なら張らない。**ここが無いと、使えるようにしただけで弱くなる**
        // （硬きを試す相で勝率 43% → 33%）。理由は SHIELD_TRIGGER の項に書いた。
        //
        // ⚠ **生きている者だけで測らないこと。** 倒れた者を外すと、
        // 一撃で落とされる戦い（硬きを試す相など）では生き残りがいつも満タンで、
        // 傷が一切見えずゲートが永久に閉じたままになる。実際に踏んだ——
        // 勝率43%の戦いでイルマの手番の HP率が毎回 100% と出ていた。
        // 倒れた者を含めて数えれば、死は「HPが全部減った」として現れる。
        const roster = battle.party || allies;
        const partyHp = roster.reduce((/** @type {number} */ sum, /** @type {any} */ u) =>
          sum + Math.max(0, u.hp), 0);
        const partyMax = roster.reduce((/** @type {number} */ sum, /** @type {any} */ u) =>
          sum + u.maxHp, 0) || 1;
        const unhurt = partyHp >= partyMax * SHIELD_TRIGGER;

        // その1手で殴れるはずだった量。**これと比べないと、殴り役が
        // 自分の火力より薄い障壁を張って損をする**（SHIELD_OVER_ATTACK の項）。
        //
        // ⚠ ここでは**過剰ダメージを切らない**。攻撃の選択（下の 3）では
        // `min(dmg, target.hp)` で切っているが、同じものをここへ持ち込むと
        // **敵が弱いほど攻撃が安く見えて障壁が勝つ**。
        // 倒しきれば戦闘そのものが終わるのに、その価値が評価に入らないため。
        // 検査で実際に踏んだ——ATKを500倍にしても『動かぬ壁』を選んでいた。
        const attackValue = attacks.reduce((/** @type {number} */ max, /** @type {any} */ s) => {
          const wide = s.def.plugin === 'all_enemies'
            || (s.def.plugin === 'detonate' && s.def.params && s.def.params.all);
          if (wide) {
            const total = foes.reduce((/** @type {number} */ sum, /** @type {any} */ t) =>
              sum + estimate(actor, t, s.def, battle), 0);
            return Math.max(max, total);
          }
          return foes.reduce((/** @type {number} */ m, /** @type {any} */ t) =>
            Math.max(m, estimate(actor, t, s.def, battle)), max);
        }, 0);

        /**
         * 障壁が生む「火力の戻り」(§9.1)。
         *
         * ── なぜ耐久だけで測ってはいけないのか ──
         * `shield_power` を積んだ味方にとって、障壁はそのまま火力になる。
         * 耐久としての価値だけで測ると、**味方に張ってもらう前提のアタッカー**が
         * 成り立たない——張る側は「殴ったほうが得」と判断し続けるため。
         *
         * 戻りは次の一撃ぶんだけ数える。障壁は消えないので何発にも乗るが、
         * 何発ぶんと見るかは戦況しだいで、多く見積もるほど張りすぎる。
         *
         * @param {any[]} live 障壁を受け取る味方
         * @param {number} amount 1人あたりに張る量
         */
        const shieldReturn = (live, amount) => {
          const cap = (RPG.damage && RPG.damage.SHIELD_POWER_CAP) || 2;
          let sum = 0;
          for (const u of live) {
            const sp = (u.situational && u.situational.shieldPower) || 0;
            if (sp <= 0 || !u.maxHp) continue;
            const before = Math.min((u.shield || 0) / u.maxHp, cap);
            const after = Math.min(((u.shield || 0) + amount) / u.maxHp, cap);
            if (after <= before) continue;
            // その味方の一番よく通る一撃を土台にする
            const best = u.skills.filter((/** @type {string} */ id) => isAttack(RPG.data.skills[id]))
              .reduce((/** @type {number} */ m, /** @type {string} */ id) =>
                Math.max(m, estimate(u, foes[0], RPG.data.skills[id], battle)), 0);
            sum += best * sp * (after - before);
          }
          return sum;
        };

        const pick = (lastBreath || unhurt) ? null : barriers
          .map((s) => ({ s, amount: amountOf(s.def) }))
          // 複数持っていることがある（固有とクラス技）。厚いほうから見る。
          .sort((a, b) => b.amount - a.amount)
          .find(({ s, amount }) => {
            const party = !!(s.def.params && s.def.params.party);
            const live = (party ? allies : [actor]).filter((/** @type {any} */ u) => u.alive);
            if (!live.length) return false;
            // **平均でなく最小を見る。** 狙いが1人に集まる相では、
            // 剥がされた1人が3人の満タンに隠れて張り直しが走らない。
            const thinnest = live.reduce((/** @type {number} */ min, /** @type {any} */ u) =>
              Math.min(min, u.shield || 0), Infinity);
            if (thinnest >= amount * SHIELD_REFRESH) return false;
            // 配れる総量で比べる。全体に張るなら人数ぶんの価値がある。
            // そこへ**障壁が生む火力の戻り**を足す（下の shieldReturn）。
            return amount * live.length + shieldReturn(live, amount)
              >= attackValue * SHIELD_OVER_ATTACK;
          });

        if (pick) {
          const kind = RPG.battle.targetKind(pick.s.def);
          if (kind === 'none') return { skillId: pick.s.id, targets: [] };
          // 単体版は、いま一番削られている味方へ。
          // 障壁の残量でなくHPの割合で選ぶ——障壁が無いのは
          // 「まだ張っていない」だけのことがあり、危険度とは別。
          const target = allies.slice()
            .sort((/** @type {any} */ a, /** @type {any} */ b) =>
              a.hp / a.maxHp - b.hp / b.maxHp)[0] || actor;
          return { skillId: pick.s.id, targets: [target] };
        }
      }
    }

    // --- 2.5 号令: 味方全員にもう一度動く権利を配る (§12) ---
    //
    // ── なぜ要るのか ──
    // オートは `mass_extra` を**一度も選べていなかった**。
    // 攻撃技でもバフ系でもないので、どの分岐にも引っかからずに素通りしていた。
    //
    // 実データの支援（ミレーヌ）で測ると、長い戦いで1ラウンドに2回動きながら
    // **威力140の岩塊圧を33回**撃っていた。手番はあるのに使い道が無い状態で、
    // 本人の一番強い手——味方全員にもう一度動かせる技——が死んでいた。
    //
    // ── 撃ち続けにならないか ──
    // ならない。号令はクールタイム持ち（5〜6ラウンド）で、候補は上で
    // `skillReady` に絞ってある。配る権利も `grantedExtra` で1人1つ。
    //
    // ── バフより後に置く理由 ──
    // 先に配ると、味方はバフが乗る前に動いてしまう。
    // バフは持続が長く撃ち直さないので、1手ぶん待っても損はしない。
    {
      const others = allies.filter((/** @type {any} */ u) => u !== actor && u.alive);
      // 全員がもう権利を持っているなら配る意味がない
      const needy = others.filter((/** @type {any} */ u) => !u.grantedExtra);
      if (needy.length) {
        // 号令を複数持っていることがある（固有とクラス技）。
        // 並び順で拾うと弱いほうを撃ち続けるので、**強い順に選ぶ**。
        // クールタイムを戻すもの（味方の一番強い手をもう一度撃たせる）が最上位で、
        // 次にバフの厚いもの。
        const calls = skills.filter((s) => s.def.plugin === 'mass_extra')
          .sort((a, b) => {
            const reset = (/** @type {any} */ x) => ((x.def.params || {}).resetCooldowns ? 1 : 0);
            if (reset(b) !== reset(a)) return reset(b) - reset(a);
            return ((b.def.params || {}).buff || 0) - ((a.def.params || {}).buff || 0);
          });
        if (calls.length) {
          const pick = calls[0];
          // 単体版は「誰に渡すか」を選ぶ (§9.1)。
          // いちばん火力の出る味方に渡す。累撃型を抱えている編成なら
          // その1人へ集めるのが正しく、そうでなくても素直に強い相手になる。
          // 段を積んでいる相手（累撃）は、まだ上限に届いていないほど価値が高い。
          if (RPG.battle.targetKind(pick.def) === 'ally') {
            const score = (/** @type {any} */ u) => {
              const atk = Math.max(u.stats.atk || 0, u.stats.magi_power || 0);
              // 累撃型は渡すほど倍率が上がるので、上限までは優先して渡す
              const esc = (u.passives && u.passives.escalate > 1)
                && (u.escalateStack || 0) < 8 ? 2 : 1;
              return atk * esc;
            };
            const best = needy.slice().sort((a, b) => score(b) - score(a))[0];
            return { skillId: pick.id, targets: [best] };
          }
          return { skillId: pick.id, targets: [] };
        }
      }
    }

    // --- 3. 攻撃: 無駄撃ちを避けつつ、最も削れる組み合わせを選ぶ ---
    if (!attacks.length) {
      // 攻撃手段が無ければ持っている技のどれかを撃つ
      const any = skills[0];
      const kind = RPG.battle.targetKind(any.def);
      return { skillId: any.id, targets: kind === 'none' ? [] : [kind === 'ally' ? actor : foes[0]] };
    }

    let best = null;
    for (const s of attacks) {
      // 全体攻撃は敵全員に入るので、削れる量を合計して評価する。
      // 起爆の広域版も「全員を巻き込む技」なので同じ扱いにする。
      // 単体として見積もると1体ぶんの価値しか付かず、まず選ばれない。
      const wide = s.def.plugin === 'all_enemies'
        || (s.def.plugin === 'detonate' && s.def.params && s.def.params.all);
      if (wide) {
        const total = foes.reduce((sum, t) => sum + Math.min(estimate(actor, t, s.def, battle), t.hp), 0);
        if (!best || total > best.score) {
          best = { score: total, dmg: total, skillId: s.id, target: foes[0] };
        }
        continue;
      }
      // 張りながら殴る技 (§9.1) は、同じだけ削れるなら障壁のぶんだけ得。
      // ただし価値として数えるのは**火力に戻る分だけ**。
      // 素の障壁まで足すと、耐久が要らない場面でも張りながら殴る技が
      // 常に最良になり、選択肢が1つに潰れる（実測でそうなった）。
      //
      // @知見: 終盤は全技が過剰殺傷で同点になる。同点は切り詰める前の火力で割る
      // @知見: 支援の価値は「耐久として」でなく「味方の火力に戻る分」で測ると編成の分業が成立する
      const guardReturn = (/** @type {number} */ dmg) => {
        if (s.def.plugin !== 'guard_strike') return 0;
        const sp = (actor.situational && actor.situational.shieldPower) || 0;
        if (sp <= 0 || !actor.maxHp) return 0;
        const cap = (RPG.damage && RPG.damage.SHIELD_POWER_CAP) || 2;
        const have = (actor.shield || 0) / actor.maxHp;
        const after = Math.min(have + shieldAmountOf(s.def) / actor.maxHp, cap);
        return dmg * sp * Math.max(0, after - Math.min(have, cap));
      };
      /**
       * 染色 (§9.1) が生む「味方の火力の戻り」。
       *
       * ── なぜ火力で測るのか ──
       * 染色そのものは1ダメージも増やさない。増えるのは
       * **そのあと味方がその相手を殴るときの通り**。
       * 技の威力だけで測ると、威力90の弱い攻撃にしか見えず永久に選ばれない
       * （障壁で踏んだのとまったく同じ形）。
       *
       * 相性の倍率が何倍になるかは damage.matchup が知っているので、
       * 塗る前と塗った後を引き算すれば、そのまま「増える割合」になる。
       *
       * 戻りは**生きている味方1ラウンドぶん**を合計する。
       * 1人ぶんしか数えないと、実際の値打ちの1/4にしかならず永久に選ばれない
       * （実測で 0.2回／戦。手で染めれば 14.25R → 10.85R なのに）。
       *
       * 合計は**その相手の残りHPで頭打ち**にする。倒しきれる相手を染めても
       * 増えるのは過剰殺傷だけで、1手を捨てることになる。
       *
       * @知見: 支援技の値打ちは「そのあと味方の火力がいくら増えるか」で測る。威力で測ると永久に選ばれない
       * @知見: 戻りは味方1人でなく1ラウンドぶん合計する。1人ぶんだと実際の1/4にしかならない
       *
       * @param {any} target
       */
      const dyeReturn = (target) => {
        if (s.def.plugin !== 'dye') return 0;
        if (!RPG.damage.matchup || !RPG.damage.STRONG_AGAINST) return 0;
        const p = s.def.params || {};
        const mine = (actor.elementMods && actor.elementMods.convert) || actor.element;
        const to = p.element || (RPG.damage.STRONG_AGAINST[mine] || [])[0];
        if (!to || (target.dyed && target.dyed.element === to)) return 0;

        // 塗ったあとの相手を模した影を作る。**本物を書き換えないこと**——
        // 見積もりは戦闘状態を一切変えない約束になっている。
        const shadow = Object.create(target);
        shadow.dyed = { element: to, turns: p.turns || 2 };

        let gain = 0;
        for (const u of allies) {
          // **その味方が実際に撃つ技で相性を見る。**
          // 染色技そのものを渡すと、属性変換を積んでいない味方では
          // 染色技の属性（無）で判定してしまい、常に 0 になる。
          let bestSkill = null;
          let bestDmg = 0;
          for (const id of u.skills) {
            const def = RPG.data.skills[id];
            if (!isAttack(def)) continue;
            const d = Math.min(estimate(u, target, def, battle), target.hp);
            if (d > bestDmg) { bestDmg = d; bestSkill = def; }
          }
          if (!bestSkill) continue;
          const before = RPG.damage.matchup(u, bestSkill, target);
          const after = RPG.damage.matchup(u, bestSkill, shadow);
          if (after <= before) continue;
          gain += bestDmg * (after / before - 1);
        }
        return Math.min(gain, target.hp);
      };

      for (const target of foes) {
        const dmg = estimate(actor, target, s.def, battle);
        // 過剰ダメージは価値が無いので、実際に削れる量で評価する
        const score = Math.min(dmg, target.hp) + guardReturn(dmg) + dyeReturn(target);
        // ── 同点は「切り詰める前の火力」で割る ──
        // **これが無いと、全部が過剰殺傷になる終盤で技の並び順が勝敗を決める。**
        // 実際に踏んだ——見積もり 2,848,410 の城撃が 759,834 の覇王斬に
        // 負け続けていた。敵HP 278,860 で両方とも切り詰められて同点だったため。
        // 素の火力で割れば、次の硬い相手にも通る手が自然に残る。
        if (!best || score > best.score
            || (score === best.score && dmg > best.dmg)
            || (score === best.score && dmg === best.dmg && target.hp < best.target.hp)) {
          best = { score, dmg, skillId: s.id, target };
        }
      }
    }
    if (!best) return null;
    return { skillId: best.skillId, targets: [best.target] };
  }

  RPG.autoplay = { chooseAction, estimate, isAttack, buffActive };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
