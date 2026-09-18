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
        // 張る量は barrier.js と同じ式で見積もる。
        // **ここがずれると「もう十分張ってある」の判定が実際の量と合わなくなる。**
        const amountOf = (/** @type {any} */ def) => {
          const p = def.params || {};
          const stat = p.scaling || def.scaling_stat || 'magi_power';
          const source = (actor.stats && actor.stats[stat])
            || (stat === 'hp' ? actor.maxHp : 0);
          return Math.max(1, Math.floor(source * (p.ratio || 1)));
        };

        // 最後のウェーブで敵が残り少ないなら、張っても使い切れない。
        // ウェーブが残っているうちは張ってよい——障壁は持ち越せる。
        const lastBreath = battle.wave >= battle.totalWaves
          && remaining <= totalMax * OVERKILL_GUARD;

        // まだ無傷なら張らない。**ここが無いと、使えるようにしただけで弱くなる**
        // （硬きを試す相で勝率 43% → 33%）。理由は SHIELD_TRIGGER の項に書いた。
        const partyHp = allies.reduce((/** @type {number} */ sum, /** @type {any} */ u) =>
          sum + Math.max(0, u.hp), 0);
        const partyMax = allies.reduce((/** @type {number} */ sum, /** @type {any} */ u) =>
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
            return amount * live.length >= attackValue * SHIELD_OVER_ATTACK;
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
      for (const target of foes) {
        const dmg = estimate(actor, target, s.def, battle);
        // 過剰ダメージは価値が無いので、実際に削れる量で評価する
        const score = Math.min(dmg, target.hp);
        if (!best || score > best.score ||
            (score === best.score && target.hp < best.target.hp)) {
          best = { score, dmg, skillId: s.id, target };
        }
      }
    }
    if (!best) return null;
    return { skillId: best.skillId, targets: [best.target] };
  }

  RPG.autoplay = { chooseAction, estimate, isAttack, buffActive };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
