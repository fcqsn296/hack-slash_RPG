// @ts-check
/**
 * バランス検証シミュレータ (§14.2)。
 *
 * 「序盤・中盤・終盤のダメージ曲線が設計意図通りか」「周回時間は妥当か」を
 * 実際の戦闘エンジンとオート戦闘を使って数値で確かめる。
 *
 * ゲーム本体には読み込まれない。test/balance.html と test/index.html からのみ使う。
 * セーブデータには一切触れない（charSave 相当のオブジェクトをその場で組み立てる）。
 */
(function (RPG) {
  'use strict';

  /**
   * プレイヤーがだいたいこう振るだろう、という投資の優先順位。
   * 上から順に、SPとティア解放が許す限り振っていく。
   */
  const PRIORITY = [
    // 三系統を平行に。**違う系統タグは掛け算になる**ので、
    // 1本に集中するより散らすほうが強い（実測 Lv20 で 2.50R 対 2.17R）。
    'tr_phys1', 'tr_magi1', 'tr_reli1',
    // 「1ラウンド目を厚くする」。序盤の戦闘は1〜4ラウンドで終わるので、
    // 1ラウンド目だけの効果が実質いつでも効く効果になる。
    // 合わせて7SP・初級だけで 1R目 ×1.90（実測 Lv20 で 1.04R）。
    'tr_first_round', 'tr_opening',
    // 初級を埋めて中級・上級を開ける
    'tr_atk', 'tr_magi', 'tr_hp', 'tr_def',
    // 上級の乗算。3SPあたり +19% で、初級の基礎（1SPで+5%）より効率がよい
    'tr_all_tag',
    'tr_phys2', 'tr_magi2', 'tr_reli2',
    'tr_crit', 'tr_crit_dmg',
    'tr_guard', 'tr_execute', 'tr_regen', 'tr_lifesteal',
    // 限界超越（上限突破）は最後。
    //
    // 与ダメージが上限（1発 500,000）に届いていないあいだは **1ダメージも増えない**。
    // Lv20 の与ダメージは2,000前後で、上限には250倍足りない。
    // 効いてくるのは装備とツリーを積み切って上限に張り付いてから (§3.2 ステップ8)。
    'tr_cap',
  ];

  /**
   * 明示した優先順位を使い切ったあと、**残ったSPを振る先**。
   *
   * ── なぜ必要か ──
   * ここが無かったために、**259SP のうち 135SP しか使わない**想定ビルドで
   * 全部の測定が回っていた（124SP・48%が余ったまま）。しかも列挙した20個のうち
   * 3個（`tr_slot_acc` / `tr_slot_armor` / `tr_slot_weapon`）は、
   * 装備枠がレベル開放へ変わったときに**消えたIDのまま残っていた**。
   *
   * 上の一覧は Lv1〜100 を見ていた頃のもので、その帯では SP が少なく
   * 使い切れないことが自然だった。測定の対象が Lv255 まで伸びたのに、
   * 一覧のほうが取り残された。**「振り切った人」を測っているつもりで、
   * 半分しか振っていない人を測っていた。**
   *
   * 個別に列挙し続けると同じことが再発するので、**残りは自動で埋める**。
   * data/skilltree.js の定義順に、振れるものへ順に振る。
   * 順序が定義順なので、実行するたびに同じ結果になる。
   */
  function remainingNodes() {
    return (RPG.data.skillTree || []).map((/** @type {any} */ n) => n.id)
      .filter((/** @type {string} */ id) => PRIORITY.indexOf(id) < 0);
  }

  /**
   * レベル帯ごとの想定装備。
   *
   * plus は装備の強化値 (§7.6)。ここを 0 のままにしていた頃は、実際に遊んでいる人より
   * 想定パーティが大幅に弱く、「Lv50では深淵に勝てない」と出ていた。
   * 実プレイでは強化・セット効果・弱点コンボが乗るので、その帯で普通に到達する強化値を入れる。
   */
  const GEAR_BY_LEVEL = [
    { upTo: 10, box: 'box_bronze', rolls: 6, plus: 0 },
    { upTo: 25, box: 'box_bronze', rolls: 16, plus: 2 },
    { upTo: 45, box: 'box_silver', rolls: 20, plus: 4 },
    { upTo: 70, box: 'box_gold', rolls: 24, plus: 6 },
    { upTo: 999, box: 'box_dragon', rolls: 30, plus: 9 },
  ];

  /**
   * @param {number} level
   */
  function gearPlanFor(level) {
    return GEAR_BY_LEVEL.find((g) => level <= g.upTo) || GEAR_BY_LEVEL[GEAR_BY_LEVEL.length - 1];
  }

  /**
   * 優先順位に沿ってスキルツリーに振る。
   * @param {any} charSave
   */
  function investTree(charSave, prefix) {
    let guard = 0;
    let progressed = true;
    // prefix は編成ごとの先振り (A2)。PRIORITY より前に置く。
    // 既定は空なので、渡さなければ従来とまったく同じ結果になる。
    const pre = prefix || [];
    const order = pre
      .concat(PRIORITY.filter((id) => pre.indexOf(id) < 0));
    while (progressed && guard++ < 500) {
      progressed = false;
      // 明示した順に振り、使い切れなかったぶんを定義順で埋める。
      for (const nodeId of order.concat(
        remainingNodes().filter((id) => order.indexOf(id) < 0))) {
        while (RPG.tree.canInvest(charSave, nodeId).ok) {
          charSave.tree[nodeId] = (charSave.tree[nodeId] || 0) + 1;
          progressed = true;
        }
      }
    }
    return charSave;
  }

  /**
   * 想定ビルドが実際に使ったSPを数える。検証テストが使う。
   * @param {any} charSave
   * @returns {number}
   */
  function spentSp(charSave) {
    let sp = 0;
    for (const node of RPG.data.skillTree || []) {
      const lv = (charSave.tree || {})[node.id] || 0;
      sp += lv * (node.cost || 1);
    }
    return sp;
  }

  /**
   * そのキャラ専用の装備を鑑定し、スロットごとに一番強いものを着ける。
   * @param {any} charSave
   * @param {string} boxId
   * @param {number} rolls
   * @param {{next: () => number}} uid
   */
  function equipBest(charSave, boxId, rolls, uid, plus) {
    /** @type {any[]} */
    const inventory = [];
    for (let i = 0; i < rolls; i++) {
      const item = RPG.gear.identify(boxId, uid.next());
      // 実プレイに合わせて強化値を乗せる (§7.6)
      if (plus) {
        item.plus = plus;
        RPG.enhance.applyPlus(item);
      }
      inventory.push(item);
    }

    const slots = RPG.units.slotCounts(charSave);
    charSave.equipped = { weapon: [], armor: [], accessory: [] };
    for (const slot of Object.keys(slots)) {
      const best = inventory
        .filter((it) => it.slot === slot)
        .sort((a, b) => RPG.gear.score(b) - RPG.gear.score(a))
        .slice(0, slots[slot]);
      charSave.equipped[slot] = best.map((it) => it.uid);
    }
    return inventory;
  }

  /**
   * そのレベル帯の「普通に育てたキャラ」を1体作る。
   * @param {string} charId
   * @param {number} level
   * @param {number} limitBreak
   * @param {{next: () => number}} uid
   */
  function makeUnit(charId, level, limitBreak, uid) {
    const charSave = {
      id: charId, level, limitBreak,
      tree: {}, equipped: { weapon: [], armor: [], accessory: [] },
    };
    investTree(charSave);
    const plan = gearPlanFor(level);
    const inventory = equipBest(charSave, plan.box, plan.rolls, uid, plan.plus);
    return RPG.units.buildCharacterUnit(charSave, inventory);
  }

  /** 連番のIDを配る小道具 */
  function uidSource() {
    let n = 1;
    return { next: () => n++ };
  }

  /**
   * 想定パーティを作る。
   * @param {number} level
   * @param {number} [limitBreak]
   */
  function makeParty(level, limitBreak) {
    const uid = uidSource();
    return ['ch_hero', 'ch_rizel', 'ch_gald', 'ch_noa']
      .map((id) => makeUnit(id, level, limitBreak || 0, uid));
  }

  /* ============================================================
     編成 (A2)
     ============================================================ */

  /**
   * 比較のために固定した終盤編成。
   *
   * ── なぜ固定するのか ──
   * 「終盤はどのフィールドも勝率100%・残HP95〜100%」で行き止まっていたのは、
   * **測っていたのが1編成だけ**だったから。勝敗と残HPは天井に張り付いていて、
   * そこから「編成を変える価値」は読み取れない。比べる相手が要る。
   *
   * ── 決め方 ──
   * - **主人公は全編成に入れる。** 外せない枠 (characters.ch_hero.fixed) なので、
   *   抜いた編成を作ると「実際には組めない編成」を測ることになる
   * - **支援編成は attack の1枠を置き換える。** 足すと枠の対価を払っていないぶん
   *   過大評価になる (CLAUDE.md §3)。plain と support は
   *   **ディアナ ↔ ソルヴェイグ の1人だけが違う**
   * - **ツリーの振り方は共通** (PRIORITY ＋ 定義順の穴埋め)。編成ごとに動かすのは
   *   「誰がいるか」「どのクラスに就くか」「先に振る枝」の3つだけ
   * - クラスは Lv30 から5レベルに1点。Lv255 で 51点
   *
   * prefix は PRIORITY より**前**に置かれる枝。
   * これが無いと、SPが 259（ツリー全体の8.4%）しかないぶん定義順の穴埋めが
   * 支配して、どの編成もほとんど同じツリーになってしまう。
   */
  const COMPOSITIONS = {
    plain: {
      label: '素直な攻撃',
      note: '搦手を使わず素の火力で殴る。比較の基準。',
      members: [
        { id: 'ch_hero', klass: 'cls_breaker' },
        { id: 'ch_lg_zero', klass: 'cls_breaker' },     // 双牙の剣鬼（多段・ATK倍率）
        { id: 'ch_lg_nefeli', klass: 'cls_breaker' },   // 一の太刀（安定・無属性）
        { id: 'ch_lg_diana', klass: 'cls_assassin' },   // 一撃の秤（会心）
      ],
    },
    element: {
      label: '属性特化（光）',
      note: '光で染めて弱点を突く。相性が噛み合うかで結果が動く。',
      members: [
        { id: 'ch_hero', klass: 'cls_breaker' },
        { id: 'ch_lg_aurora', klass: 'cls_breaker' },   // 双極の巫女（弱点狩り・属性補正）
        { id: 'ch_lg_lumen', klass: 'cls_breaker' },    // 天雷の審判者（連鎖・ボス特効）
        { id: 'ch_lg_noel', klass: 'cls_breaker' },     // 際を断つ者（中技）
      ],
      prefix: [
        'tr_mastery_light', 'tr_power_light', 'tr_crit_light',
        'tr_weak_hunter', 'tr_element_all', 'tr_mastery_all', 'tr_dual_light',
      ],
    },
    support: {
      label: '支援入り',
      note: 'plain のディアナをソルヴェイグへ置き換えたもの。**1枠だけ違う。**',
      members: [
        { id: 'ch_hero', klass: 'cls_breaker' },
        { id: 'ch_lg_zero', klass: 'cls_breaker' },
        { id: 'ch_lg_nefeli', klass: 'cls_breaker' },
        {
          id: 'ch_lg_solveig', klass: 'cls_mender',     // 護りを編む者（味方バフ・障壁・回復）
          prefix: ['tr_ally_buff_hi', 'tr_buff_shield_hi', 'tr_buff_heal_hi', 'tr_round_buff_hi'],
        },
      ],
    },

    /* ── 支援を1つの型で代表させない (C1) ──
     *
     * A2 の時点では「支援入り」1つしか無く、終盤で遅いという結果だけが出ていた。
     * だが支援と言っても仕事が違う。**バフで攻めを伸ばす**のと、
     * **削られたぶんを戻す**のと、**そもそも削られないようにする**のは別物で、
     * どれが効くかは「どれだけ削られるか」で変わる。
     * 1つにまとめると「支援は遅い」で終わってしまうので、3つに分ける。
     *
     * どれも plain の**ディアナ1枠だけ**を置き換えたもの。比べる相手を揃える。
     */
    heal: {
      label: '回復入り',
      note: 'plain のディアナをネヴィアへ置き換えたもの。削られたぶんを戻す型。',
      members: [
        { id: 'ch_hero', klass: 'cls_breaker' },
        { id: 'ch_lg_zero', klass: 'cls_breaker' },
        { id: 'ch_lg_nefeli', klass: 'cls_breaker' },
        {
          id: 'ch_lg_nevia', klass: 'cls_mender',       // 絶えぬ灯（再生・瀕死回復・ウェーブ回復）
          prefix: ['tr_regen_hi', 'tr_low_hp_heal_hi', 'tr_wave_heal', 'tr_heal_power_hi'],
        },
      ],
    },
    guard: {
      label: '防護入り',
      note: 'plain のディアナをテオドラへ置き換えたもの。削られないようにする型。',
      members: [
        { id: 'ch_hero', klass: 'cls_breaker' },
        { id: 'ch_lg_zero', klass: 'cls_breaker' },
        { id: 'ch_lg_nefeli', klass: 'cls_breaker' },
        {
          id: 'ch_lg_theodora', klass: 'cls_guardian',  // 万人の盾（庇う・肩代わり・反射）
          prefix: ['tr_guard_ally_hi', 'tr_damage_share', 'tr_back_guard', 'tr_shield_regen'],
        },
      ],
    },
  };

  /**
   * クラスに就いて、点を使い切るまで振る。
   *
   * ツリー側と同じ考え方で、クラスのノードを**定義順**に埋める。
   * 派生は3つのうち1つしか選べないので、最初に触った派生に固定される。
   * 定義順なので、何度実行しても同じ結果になる。
   *
   * @param {any} charSave
   * @param {string} [classId]
   */
  function investClass(charSave, classId) {
    if (!classId || !RPG.klass) return charSave;
    if (!RPG.klass.canTakeClass(charSave).ok) return charSave;
    charSave.klass = classId;
    charSave.klassTree = charSave.klassTree || {};
    const nodes = ((RPG.data.classes[classId] || {}).nodes || [])
      .map((/** @type {any} */ n) => n.id);
    let guard = 0;
    let progressed = true;
    while (progressed && guard++ < 200) {
      progressed = false;
      for (const nodeId of nodes) {
        while (RPG.klass.canInvest(charSave, nodeId).ok) {
          charSave.klassTree[nodeId] = (charSave.klassTree[nodeId] || 0) + 1;
          progressed = true;
        }
      }
    }
    return charSave;
  }

  /**
   * 編成の1人を作り、**使ったSP・クラス点・装備を記録して返す**。
   *
   * 「未装備のまま測っていた」「SPが半分余っていた」はどちらも実際に起きた事故で、
   * どちらも**結果の数字を眺めているだけでは気付けない**。だから作った側が内訳を出す。
   *
   * @param {{id: string, klass?: string, prefix?: string[]}} member
   * @param {number} level
   * @param {number} limitBreak
   * @param {{next: () => number}} uid
   * @param {string[]} [prefix] 編成ぜんぶに効く先振り
   */
  function makeMember(member, level, limitBreak, uid, prefix) {
    const charSave = {
      id: member.id, level, limitBreak,
      tree: {}, klassTree: {},
      equipped: { weapon: [], armor: [], accessory: [] },
    };
    investTree(charSave, member.prefix || prefix || []);
    investClass(charSave, member.klass);
    const plan = gearPlanFor(level);
    const inventory = equipBest(charSave, plan.box, plan.rolls, uid, plan.plus);
    const unit = RPG.units.buildCharacterUnit(charSave, inventory);

    const spBudget = (level - 1) + limitBreak;
    const spSpent = spentSp(charSave);
    /** @type {string[]} */
    const gear = [];
    for (const slot of Object.keys(charSave.equipped)) {
      for (const eqUid of charSave.equipped[slot]) {
        const it = inventory.find((/** @type {any} */ x) => x.uid === eqUid);
        if (it) gear.push(`${it.name || it.baseId}+${it.plus || 0}`);
      }
    }
    return {
      unit,
      detail: {
        id: member.id,
        name: RPG.data.characters[member.id].name,
        klass: member.klass ? RPG.data.classes[member.klass].name : '（未就任）',
        spSpent,
        spBudget,
        spLeft: spBudget - spSpent,
        classSpent: RPG.klass ? RPG.klass.spentPoints(charSave) : 0,
        classTotal: RPG.klass ? RPG.klass.totalPoints(charSave) : 0,
        gearCount: gear.length,
        gear: gear.join('、'),
        skills: (unit.skills || []).map((/** @type {string} */ k) =>
          (RPG.data.skills[k] || {}).name || k).join('、'),
      },
    };
  }

  /**
   * 名前のついた編成を組み立てる。
   * @param {string} name COMPOSITIONS のキー
   * @param {number} [level]
   * @param {number} [limitBreak]
   */
  function buildComposition(name, level, limitBreak, size) {
    const comp = COMPOSITIONS[name];
    if (!comp) throw new Error('知らない編成: ' + name);
    const lv = level == null ? RPG.data.maxLevelCap : level;
    const lb = limitBreak == null ? 5 : limitBreak;
    const uid = uidSource();
    // size は人数制限の依頼を測るため。**先頭から詰める**ので、
    // 外せない枠（主人公）が必ず残る。後ろから削ると組めない編成になる。
    const members = size == null ? comp.members : comp.members.slice(0, size);
    const built = members.map((m) => makeMember(m, lv, lb, uid, comp.prefix));
    return {
      name,
      label: comp.label,
      note: comp.note,
      level: lv,
      limitBreak: lb,
      party: built.map((b) => b.unit),
      members: built.map((b) => b.detail),
    };
  }

  /** 編成の名前を並べる。画面と検査が使う。 */
  function compositionNames() {
    return Object.keys(COMPOSITIONS);
  }

  /* ============================================================
     ダメージ曲線
     ============================================================ */

  /**
   * そのユニットが一番火力を出せる攻撃技を選ぶ。
   * @param {any} unit
   * @param {any} dummy
   */
  function bestAttack(unit, dummy) {
    let best = null;
    for (const id of unit.skills) {
      const skill = RPG.data.skills[id];
      if (!RPG.autoplay.isAttack(skill)) continue;
      const dmg = RPG.autoplay.estimate(unit, dummy, skill);
      if (!best || dmg > best.damage) best = { id, skill, damage: dmg };
    }
    return best;
  }

  /**
   * 同レベルの基準敵。フィールド構成に左右されない純粋なダメージ曲線を見るために使う。
   * @param {number} level
   */
  function referenceDummy(level) {
    const def = Math.floor(level * 9 + 25);
    const hp = Math.floor(400 + level * level * 2.2);
    return {
      name: '基準敵', level, element: 'none',
      stats: { hp, atk: 0, def, magi_power: 0 },
      maxHp: hp, hp, defMultiplier: 1, defIgnoredTurns: 0,
      baseReduction: 0, buffReduction: [], passives: {}, alive: true,
    };
  }

  /**
   * レベル帯ごとのダメージ曲線を出す。
   * @param {number[]} levels
   * @param {number} [samples]
   */
  function damageCurve(levels, samples) {
    const n = samples || 400;
    return levels.map((level) => {
      RPG.rng.seed(1000 + level);
      const unit = makeUnit('ch_hero', level, level >= 60 ? 3 : 0, uidSource());
      const dummy = referenceDummy(level);
      const pick = bestAttack(unit, dummy);

      let total = 0;
      let capped = 0;
      let critTotal = 0;
      for (let i = 0; i < n; i++) {
        const r = RPG.damage.calc({
          attacker: RPG.units.toAttacker(unit),
          defender: RPG.units.toDefender(dummy),
          skill: pick.skill,
          options: {},
        });
        total += r.damage;
        if (r.breakdown.capped) capped++;
        if (r.crit) critTotal++;
      }
      RPG.rng.seed(null);

      const tagInfo = RPG.damage.tagMultiplier(unit.baseTagBonuses, pick.skill.damage_type);
      return {
        level,
        skill: pick.skill.name,
        atk: unit.stats.atk,
        hp: unit.maxHp,
        tagMult: tagInfo.multiplier,
        critRate: unit.baseCritRate,
        avg: Math.round(total / n),
        cappedRate: capped / n,
        critObserved: critTotal / n,
        dummyHp: dummy.maxHp,
        hitsToKill: Math.ceil(dummy.maxHp / Math.max(1, total / n)),
      };
    });
  }

  /* ============================================================
     周回シミュレーション（実際の戦闘エンジンを回す）
     ============================================================ */

  /**
   * オート戦闘で1戦こなし、結果を返す。
   * @param {{fieldId: string, waves: number, bossFinale: boolean, level: number, limitBreak?: number}} cfg
   */
  function runBattle(cfg) {
    const party = makeParty(cfg.level, cfg.limitBreak);
    const battle = RPG.battle.start({
      fieldId: cfg.fieldId, waves: cfg.waves, party, bossFinale: cfg.bossFinale,
    });

    let commands = 0;
    let waveRoundMax = 0;
    let roundsFought = 0;
    let guard = 0;
    while (!battle.finished && guard++ < 4000) {
      if (battle.phase === 'wave_clear') {
        // ウェーブが終わるたびに、そのウェーブで戦ったラウンド数を足す
        roundsFought += battle.round;
        RPG.battle.advanceWave(battle);
        continue;
      }
      const action = RPG.autoplay.chooseAction(battle);
      if (!action) break;
      // シミュレータはオート戦闘そのものなので、手動ボーナスは付かない扱いにする
      RPG.battle.commandSkill(battle, action.skillId, action.targets, { auto: true });
      commands++;
      waveRoundMax = Math.max(waveRoundMax, battle.round);
    }
    roundsFought += battle.round;   // 最後のウェーブぶん

    const survivors = battle.party.filter((/** @type {any} */ u) => u.alive).length;
    const hpLeft = battle.party.reduce((/** @type {number} */ s, /** @type {any} */ u) => s + u.hp, 0) /
      battle.party.reduce((/** @type {number} */ s, /** @type {any} */ u) => s + u.maxHp, 0);

    return {
      victory: battle.victory,
      commands,
      // 1周に実際に戦ったラウンドの合計。**収益の分母はこれを使う。**
      //
      // ここは道具の側で外から数えた値。エンジンの battle.totalRounds とは
      // **一致するはず**で、検証テストがその一致を見張っている。
      // わざわざ二重に数えているのは、片方が壊れたときに気付くため。
      //
      // 以前は battle.round の最大値を「1周のラウンド数」として使っていた。
      // battle.round はウェーブごとに1へ戻るので、連戦（既定5ウェーブ）では
      // 1本ぶんしか数えず、ラウンド当たり収益が約3倍に見えていた。
      rounds: roundsFought,
      // エンジンが数えた合計。依頼の「Nラウンド以内」が見るのもこれ。
      totalRounds: battle.totalRounds,
      // 旧指標。ウェーブ1本ぶんの長さの最大値。過去の数字と突き合わせるときだけ使う
      waveRoundMax,
      gold: battle.rewards.gold,
      exp: battle.rewards.exp,
      boxes: Object.keys(battle.rewards.boxes)
        .reduce((s, k) => s + battle.rewards.boxes[k], 0),
      survivors, hpLeft,
      stuck: guard >= 4000,
    };
  }

  /**
   * 同じ条件を何度も回して平均を取る。
   * @param {{fieldId: string, waves: number, bossFinale: boolean, level: number, limitBreak?: number, runs?: number, seed?: number}} cfg
   */
  function simulate(cfg) {
    const runs = cfg.runs || 30;
    RPG.rng.seed(cfg.seed == null ? 777 : cfg.seed);

    const results = [];
    for (let i = 0; i < runs; i++) results.push(runBattle(cfg));
    RPG.rng.seed(null);

    const wins = results.filter((r) => r.victory);
    const avg = (/** @type {(r: any) => number} */ f, /** @type {any[]} */ set) =>
      set.length ? set.reduce((s, r) => s + f(r), 0) / set.length : 0;

    return {
      fieldId: cfg.fieldId,
      level: cfg.level,
      waves: cfg.waves,
      runs,
      winRate: wins.length / runs,
      rounds: avg((r) => r.rounds, wins),
      totalRounds: avg((r) => r.totalRounds, wins),
      waveRoundMax: avg((r) => r.waveRoundMax, wins),
      commands: avg((r) => r.commands, wins),
      gold: avg((r) => r.gold, wins),
      exp: avg((r) => r.exp, wins),
      boxes: avg((r) => r.boxes, wins),
      hpLeft: avg((r) => r.hpLeft, wins),
      survivors: avg((r) => r.survivors, wins),
      goldPerRound: wins.length ? avg((r) => r.gold, wins) / Math.max(1, avg((r) => r.rounds, wins)) : 0,
      stuck: results.filter((r) => r.stuck).length,
    };
  }

  /* ============================================================
     経済シミュレーション
     ============================================================ */

  /**
   * その宝箱から出る装備1個の平均売却額。
   * 実際に鑑定してみて平均を取る（レアリティ抽選込みの期待値になる）。
   * @param {string} boxId
   * @param {number} [samples]
   */
  function boxSellValue(boxId, samples) {
    const n = samples || 300;
    const uid = uidSource();
    let total = 0;
    RPG.rng.seed(4242);
    for (let i = 0; i < n; i++) {
      total += RPG.state.sellValue(RPG.gear.identify(boxId, uid.next()));
    }
    RPG.rng.seed(null);
    return total / n;
  }

  /**
   * 1周でどの宝箱が何個出るかを実測する。
   * simulate() は個数の合計しか返さないため、ここでは種類別に数え直す。
   * @param {{fieldId: string, waves: number, bossFinale: boolean, level: number, limitBreak?: number, runs?: number}} cfg
   */
  function boxYield(cfg) {
    const runs = cfg.runs || 30;
    RPG.rng.seed(31337);
    /** @type {Record<string, number>} */
    const totals = {};
    let wins = 0;
    for (let i = 0; i < runs; i++) {
      const party = makeParty(cfg.level, cfg.limitBreak);
      const battle = RPG.battle.start({
        fieldId: cfg.fieldId, waves: cfg.waves, party, bossFinale: cfg.bossFinale,
      });
      let guard = 0;
      while (!battle.finished && guard++ < 4000) {
        if (battle.phase === 'wave_clear') { RPG.battle.advanceWave(battle); continue; }
        const action = RPG.autoplay.chooseAction(battle);
        if (!action) break;
        RPG.battle.commandSkill(battle, action.skillId, action.targets, { auto: true });
      }
      if (!battle.victory) continue;
      wins++;
      for (const k of Object.keys(battle.rewards.boxes)) {
        totals[k] = (totals[k] || 0) + battle.rewards.boxes[k];
      }
    }
    RPG.rng.seed(null);
    /** @type {Record<string, number>} */
    const perRun = {};
    for (const k of Object.keys(totals)) perRun[k] = totals[k] / Math.max(1, wins);
    return perRun;
  }

  /**
   * フィールド1つぶんの経済指標。
   *
   * 「1周でいくら稼げて、何周でレベルが1上がるか」を出す。
   * 数字を眺めるだけで、金が余っているのか経験値が足りないのかが分かるようにするのが目的。
   *
   * @param {{fieldId: string, level: number, waves?: number, runs?: number, partySize?: number}} cfg
   */
  function economy(cfg) {
    const waves = cfg.waves || 5;
    const partySize = cfg.partySize || 4;
    const sim = simulate({
      fieldId: cfg.fieldId, waves, bossFinale: true,
      level: cfg.level, runs: cfg.runs || 24,
    });

    const boxes = boxYield({
      fieldId: cfg.fieldId, waves, bossFinale: true,
      level: cfg.level, runs: cfg.runs || 24,
    });

    let boxGold = 0;
    /** @type {string[]} */
    const boxParts = [];
    for (const boxId of Object.keys(boxes)) {
      const each = boxSellValue(boxId);
      boxGold += boxes[boxId] * each;
      boxParts.push(`${RPG.data.boxes[boxId].name}×${boxes[boxId].toFixed(1)}`);
    }

    // 実際にプレイヤーの手に渡る額（オート周回を想定＝手動ボーナスなし）
    const expEach = RPG.economy.expShare(sim.exp, partySize);
    const needed = RPG.units.expToNext(cfg.level);
    const totalGold = sim.gold + boxGold;

    return {
      fieldId: cfg.fieldId,
      name: RPG.data.fields[cfg.fieldId].name,
      level: cfg.level,
      winRate: sim.winRate,
      rounds: sim.rounds,
      directGold: sim.gold,
      boxGold,
      totalGold,
      // 直接ドロップが総収入の何割か。ハクスラとしては宝箱側が主であってほしい。
      directShare: totalGold > 0 ? sim.gold / totalGold : 0,
      // 時間あたりの実入り。宝箱の期待額を含むので、進む動機を見るのはこの値。
      totalPerRound: sim.rounds > 0 ? totalGold / sim.rounds : 0,
      boxDetail: boxParts.join('、'),
      exp: sim.exp,
      expEach,
      expNeeded: needed,
      runsPerLevel: expEach > 0 ? needed / expEach : Infinity,
      runsPerPull: totalGold > 0 ? RPG.data.gacha.cost / totalGold : Infinity,
      // 1レベル上げるあいだに何回ガチャが引けてしまうか。ここが大きいほど金が余っている。
      pullsPerLevel: totalGold > 0 && expEach > 0
        ? (needed / expEach) * (totalGold / RPG.data.gacha.cost)
        : Infinity,
    };
  }

  /**
   * 経済を測るときのレベル。
   * 推奨Lv1のフィールドをLv1で測ると「Lv1→2に必要な経験値60」が基準になり、
   * 「1周でレベルが上がる」という現実離れした値が出てしまう。実際にそこを周回している
   * 帯の下限としてLv5を床にする。
   * @param {string} fieldId
   */
  function economyLevel(fieldId) {
    return Math.max(5, RPG.data.fields[fieldId].rec_level);
  }

  /** 各フィールドを推奨レベルで測る */
  function economyTable() {
    return Object.keys(RPG.data.fields).map((fieldId) =>
      economy({ fieldId, level: economyLevel(fieldId) }));
  }

  /* ============================================================
     依頼込みの測定 (A2)
     ============================================================ */

  /**
   * 編成を組み立てるときの種。
   *
   * パーティの組み立ては装備の鑑定で乱数を使うので、**種を固定しないと
   * 走らせるたびに違う装備のパーティを測ることになる**。
   * 1試行ごとの種（戦闘用）とは別に持つ。
   * こうしておくと「編成の種 + 試行の種」の2つだけで1試行を単独で再現できる。
   */
  const PARTY_SEED = 90210;

  /**
   * 編成1つで1戦する。
   *
   * ── 依頼を「通常戦闘で代用」しない ──
   * 依頼の縛りは2箇所に分かれている。
   *   - 編成の縛り（人数・レベル・属性）… `RPG.quest.checkParty`
   *   - 戦闘中の縛り（ラウンド上限・全員生存）… `battle.js` が `quest` から読む
   * どちらか片方だけを通すと「依頼を測ったつもり」になるので、**両方通す**。
   * 前者は実際の出撃と同じ関数を呼ぶ（測定用に書き写さない）。
   *
   * @param {{composition: string, fieldId: string, waves?: number, bossFinale?: boolean,
   *          quest?: any, level?: number, limitBreak?: number, seed?: number}} cfg
   */
  function runComposition(cfg) {
    const waves = cfg.waves == null ? 5 : cfg.waves;
    const bossFinale = cfg.bossFinale !== false;

    // 編成は毎回同じ種で組み直す。戦闘でユニットが書き換わるので使い回せない。
    RPG.rng.seed(PARTY_SEED);
    const comp = buildComposition(cfg.composition, cfg.level, cfg.limitBreak, cfg.size);
    RPG.rng.seed(cfg.seed == null ? 4242 : cfg.seed);

    // 編成の縛り。実際の出撃と同じ関数で見る。
    // **読めていないなら黙って素通ししない。** 縛りを見ないまま
    // 「依頼を測った」と言えてしまうのがいちばん困る。
    if (cfg.quest && !(RPG.quest && RPG.quest.checkParty)) {
      throw new Error('RPG.quest が読めていない（依頼の縛りを判定できない）');
    }
    const roster = comp.members.map((m) => ({ id: m.id, level: comp.level }));
    const partyCheck = cfg.quest
      ? RPG.quest.checkParty(cfg.quest, roster)
      : { ok: true, reasons: [] };

    const battle = RPG.battle.start({
      fieldId: cfg.fieldId, waves, party: comp.party, bossFinale,
      quest: cfg.quest || null,
    });

    let commands = 0;
    let waveRoundMax = 0;
    let roundsFought = 0;
    let guard = 0;
    while (!battle.finished && guard++ < 4000) {
      if (battle.phase === 'wave_clear') {
        roundsFought += battle.round;
        RPG.battle.advanceWave(battle);
        continue;
      }
      const action = RPG.autoplay.chooseAction(battle);
      if (!action) break;
      RPG.battle.commandSkill(battle, action.skillId, action.targets, { auto: true });
      commands++;
      waveRoundMax = Math.max(waveRoundMax, battle.round);
    }
    roundsFought += battle.round;
    RPG.rng.seed(null);

    const survivors = battle.party.filter((/** @type {any} */ u) => u.alive).length;
    const hpLeft = battle.party.reduce((/** @type {number} */ a, /** @type {any} */ u) => a + u.hp, 0) /
      battle.party.reduce((/** @type {number} */ a, /** @type {any} */ u) => a + u.maxHp, 0);

    return {
      composition: cfg.composition,
      seed: cfg.seed == null ? 4242 : cfg.seed,
      partySeed: PARTY_SEED,
      // 編成の縛りを満たしているか。満たしていない編成の勝敗は意味を持たない
      partyOk: partyCheck.ok,
      partyReasons: partyCheck.reasons,
      // オート禁止の依頼をオートで測っても実態を映さない。黙って測らず旗を立てる
      autoAllowed: !(cfg.quest && cfg.quest.rules && cfg.quest.rules.noAuto),
      victory: battle.victory,
      ruleBroken: battle.ruleBroken || null,
      rounds: roundsFought,
      totalRounds: battle.totalRounds,
      waveRoundMax,
      commands,
      survivors,
      hpLeft,
      gold: battle.rewards.gold,
      exp: battle.rewards.exp,
      stuck: guard >= 4000,
    };
  }

  /** 中央値。平均だけだと、たまに出る長期戦に引きずられて実感とずれる。 */
  function median(nums) {
    if (!nums.length) return 0;
    const a = nums.slice().sort((x, y) => x - y);
    const h = Math.floor(a.length / 2);
    return a.length % 2 ? a[h] : (a[h - 1] + a[h]) / 2;
  }

  /**
   * 編成を何度も回して比べられる形にする。
   *
   * ── 平均だけを見ない ──
   * 勝率100%・残HP95%で張り付いている帯では、平均は動かない。
   * **中央値と散らばり**、そして「勝てなかった内訳」を分けて出す。
   * 「失敗」は3種類ある（負け／条件で失格／止まった）ので、混ぜない。
   *
   * ── 1試行を単独で再現できるようにする ──
   * 試行ごとに種を振り直す（seed + i）。records にその種が入っているので、
   * 気になる1回だけを runComposition で撃ち直せる。
   *
   * @param {{composition: string, fieldId: string, waves?: number, bossFinale?: boolean,
   *          quest?: any, level?: number, limitBreak?: number, runs?: number, seed?: number}} cfg
   */
  function simulateComposition(cfg) {
    const runs = cfg.runs || 30;
    const base = cfg.seed == null ? 4242 : cfg.seed;
    /** @type {any[]} */
    const records = [];
    for (let i = 0; i < runs; i++) {
      records.push(runComposition(Object.assign({}, cfg, { seed: base + i })));
    }

    const wins = records.filter((r) => r.victory);
    const avg = (/** @type {(r: any) => number} */ f, /** @type {any[]} */ set) =>
      (set.length ? set.reduce((a, r) => a + f(r), 0) / set.length : 0);
    const roundsOfWins = wins.map((r) => r.rounds);
    const spread = roundsOfWins.length
      ? Math.max.apply(null, roundsOfWins) - Math.min.apply(null, roundsOfWins) : 0;

    const first = records[0] || {};
    return {
      composition: cfg.composition,
      label: (COMPOSITIONS[cfg.composition] || {}).label || cfg.composition,
      fieldId: cfg.fieldId,
      quest: cfg.quest ? (cfg.quest.name || cfg.quest.id || '(無名の依頼)') : null,
      runs,
      seedFrom: base,
      seedTo: base + runs - 1,
      partySeed: PARTY_SEED,
      partyOk: first.partyOk !== false,
      partyReasons: first.partyReasons || [],
      autoAllowed: first.autoAllowed !== false,
      // 勝ったぶんだけの平均。負けを混ぜると「短いラウンドで負けた」が
      // 「速い」に化ける
      winRate: wins.length / runs,
      rounds: avg((r) => r.rounds, wins),
      roundsMedian: median(roundsOfWins),
      roundsSpread: spread,
      totalRounds: avg((r) => r.totalRounds, wins),
      commands: avg((r) => r.commands, wins),
      survivors: avg((r) => r.survivors, wins),
      hpLeft: avg((r) => r.hpLeft, wins),
      gold: avg((r) => r.gold, wins),
      exp: avg((r) => r.exp, wins),
      // 勝てなかった内訳。混ぜない
      lost: records.filter((r) => !r.victory && !r.ruleBroken && !r.stuck).length,
      failedRule: records.filter((r) => !!r.ruleBroken).length,
      stuck: records.filter((r) => r.stuck).length,
      records,
    };
  }


  RPG.balance = {
    PRIORITY, GEAR_BY_LEVEL, remainingNodes, spentSp,
    makeUnit, makeParty, investTree, investClass, equipBest, uidSource,
    referenceDummy, bestAttack, damageCurve, runBattle, simulate,
    boxSellValue, boxYield, economy, economyLevel, economyTable,
    COMPOSITIONS, compositionNames, buildComposition,
    runComposition, simulateComposition, PARTY_SEED,
  };
})(window.RPG);
