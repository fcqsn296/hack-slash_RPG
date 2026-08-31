// @ts-check
/**
 * クエストの解放判定・縛り条件の検証・初回クリア報酬 (§10.3)。
 *
 * 「出撃してよいか」の判定はすべてここに集約する。UIはここが返した理由を出すだけで、
 * 自前でルールを解釈しない。戦闘中の失敗判定（ラウンド超過・全員生存）は battle.js 側。
 */
(function (RPG) {
  'use strict';

  /**
   * クエスト定義を id 付きで取り出す。
   * @param {string} questId
   */
  function def(questId) {
    const q = RPG.data.quests[questId];
    if (!q) return null;
    // データ側に id を書かせず、参照時に貼る（enemies と同じやり方）
    return Object.assign({ id: questId }, q);
  }

  /** 全クエストを定義順に返す。 */
  function all() {
    return Object.keys(RPG.data.quests).map((id) => def(id));
  }

  /** 出撃先を持つ、通常のクエスト。 */
  function sorties() {
    return all().filter((q) => q.kind !== 'challenge');
  }

  /** 出撃先を持たない達成条件型のクエスト (§10.3-2)。 */
  function challenges() {
    return all().filter((q) => q.kind === 'challenge');
  }

  /**
   * 達成済みか。
   * @param {string} questId
   */
  function isCleared(questId) {
    const s = RPG.state.get();
    return !!(s.quests && s.quests[questId] && s.quests[questId].cleared);
  }

  /** パーティの最高レベル。解放条件の判定に使う。 */
  function partyTopLevel() {
    const s = RPG.state.get();
    let top = 1;
    for (const id of Object.keys(s.characters)) top = Math.max(top, s.characters[id].level);
    return top;
  }

  /**
   * 解放されているか。
   * @param {any} quest
   * @returns {{ok: boolean, reason?: string}}
   */
  function unlocked(quest) {
    const u = quest.unlock;
    if (!u) return { ok: true };
    if (u.quest && !isCleared(u.quest)) {
      const prev = RPG.data.quests[u.quest];
      return { ok: false, reason: `「${prev ? prev.name : u.quest}」を先に達成する必要がある` };
    }
    if (u.level && partyTopLevel() < u.level) {
      return { ok: false, reason: `Lv${u.level} 以上のキャラクターが必要` };
    }
    return { ok: true };
  }

  /**
   * 今の編成でこのクエストに出撃できるか。
   * 破っている縛りをすべて挙げて返す（1つ直すたびに出撃し直させないため）。
   *
   * @param {any} quest
   * @returns {{ok: boolean, reasons: string[]}}
   */
  function checkParty(quest) {
    const s = RPG.state.get();
    const rules = quest.rules || {};
    /** @type {string[]} */
    const reasons = [];

    const party = s.party.filter((/** @type {string} */ id) => !!s.characters[id]);
    if (party.length === 0) reasons.push('パーティが空です');

    if (rules.maxParty && party.length > rules.maxParty) {
      reasons.push(`出撃できるのは ${rules.maxParty} 人まで（現在 ${party.length} 人）`);
    }

    if (rules.maxLevel) {
      const over = party.filter((/** @type {string} */ id) => s.characters[id].level > rules.maxLevel);
      if (over.length) {
        reasons.push(`Lv${rules.maxLevel} 以下のみ出撃可（超過: ` +
          over.map((/** @type {string} */ id) => `${RPG.state.charName(id)} Lv${s.characters[id].level}`).join('、') + '）');
      }
    }

    if (rules.elements && rules.elements.length) {
      const labels = rules.elements.map((/** @type {string} */ e) => RPG.damage.ELEMENT_LABEL[e]).join('・');
      // 編成から外せないキャラ（主人公）は判定の対象外にする。
      // 選べない相手に縛りを課すと、属性が合わない時点で永久に達成不能になるため。
      // 「格上狩り」がレベル上限で詰んでいたのと同じ種類の問題。
      const bad = party.filter((/** @type {string} */ id) =>
        !RPG.data.characters[id].fixed &&
        !rules.elements.includes(RPG.data.characters[id].element));
      if (bad.length) {
        reasons.push(`${labels}属性のみ出撃可（対象外: ` +
          bad.map((/** @type {string} */ id) => RPG.state.charName(id)).join('、') + '）');
      }
    }

    return { ok: reasons.length === 0, reasons };
  }

  /**
   * 縛り条件を人が読める短い文にする。UIのチップ表示に使う。
   * @param {any} quest
   * @returns {string[]}
   */
  function ruleLabels(quest) {
    const r = quest.rules || {};
    /** @type {string[]} */
    const out = [];
    if (r.maxParty) out.push(`${r.maxParty}人以下`);
    if (r.maxLevel) out.push(`Lv${r.maxLevel}以下`);
    if (r.elements) out.push(r.elements.map((/** @type {string} */ e) => RPG.damage.ELEMENT_LABEL[e]).join('・') + '属性のみ');
    if (r.maxRounds) out.push(`${r.maxRounds}ラウンド以内`);
    if (r.allAlive) out.push('全員生存');
    if (r.noAuto) out.push('オート禁止');
    if (quest.enemyLv) out.push(`敵Lv${quest.enemyLv}`);
    if (quest.enemyScale && quest.enemyScale !== 1) out.push(`敵能力×${quest.enemyScale}`);
    return out;
  }

  /**
   * 報酬を人が読める文にする。
   * @param {any} quest
   * @returns {string[]}
   */
  function rewardLabels(quest) {
    const rw = quest.reward || {};
    /** @type {string[]} */
    const out = [];
    if (rw.gold) out.push(`${rw.gold.toLocaleString()} G`);
    if (rw.boxes) {
      for (const b of Object.keys(rw.boxes)) out.push(`${RPG.data.boxes[b].name}×${rw.boxes[b]}`);
    }
    if (rw.character) {
      const c = RPG.data.characters[rw.character];
      out.push(`${c ? c.name : rw.character}（${c ? RPG.data.rarities[c.rarity].label : ''}）`);
    }
    if (rw.equip) out.push(rw.equip.name);
    if (rw.autoCharge) out.push(`オート回数の上限 +${rw.autoCharge}`);
    return out;
  }

  /**
   * キャラクターを1体渡す。所持済みならガチャと同じ扱い（限界突破 → 完凸なら還元）。
   * @param {string} charId
   * @returns {{kind: 'new'|'limit_break'|'refund', limitBreak?: number, gold?: number}}
   */
  function grantCharacter(charId) {
    const s = RPG.state.get();
    const owned = s.characters[charId];
    if (!owned) {
      s.characters[charId] = RPG.state.createCharacter(charId);
      RPG.state.tryJoinParty(charId);
      return { kind: 'new' };
    }
    if (owned.limitBreak < RPG.data.gacha.maxLimitBreak) {
      owned.limitBreak++;
      return { kind: 'limit_break', limitBreak: owned.limitBreak };
    }
    const gold = RPG.data.rarities[RPG.data.characters[charId].rarity].refund;
    RPG.state.addGold(gold);
    return { kind: 'refund', gold };
  }

  /**
   * 報酬の種類。ここに無いキーは配られない。
   *
   * セーブには「どの種類を受け取ったか」を残す。クリア済みかどうかだけを持っていると、
   * 後から報酬を足したときに既存プレイヤーが永久に受け取れなくなるため。
   */
  const REWARD_KINDS = ['gold', 'boxes', 'equip', 'autoCharge', 'character'];

  /**
   * この仕組みを入れる前から存在していた報酬の種類。
   * 旧セーブのクリア済みクエストは「これらは受け取り済み」とみなす。
   * ここに載っていない種類（autoCharge など後から足したもの）は未受取として扱われ、
   * 次回の起動時に配られる。
   */
  const LEGACY_KINDS = ['gold', 'boxes', 'equip', 'character'];

  /**
   * そのクエストの記録。無ければ作る。
   * @param {string} questId
   */
  function record(questId) {
    const s = RPG.state.get();
    if (!s.quests) s.quests = {};
    if (!s.quests[questId]) s.quests[questId] = { cleared: false, clears: 0, paid: [] };
    const entry = s.quests[questId];
    if (!Array.isArray(entry.paid)) {
      // 旧セーブの補完。クリア済みなら当時あった種類だけを受け取り済みにする。
      entry.paid = entry.cleared ? LEGACY_KINDS.slice() : [];
    }
    return entry;
  }

  /**
   * まだ受け取っていない報酬の種類。
   * @param {any} quest
   * @param {any} entry
   * @returns {string[]}
   */
  function unpaidKinds(quest, entry) {
    const rw = quest.reward || {};
    return REWARD_KINDS.filter((kind) => rw[kind] && entry.paid.indexOf(kind) < 0);
  }

  /**
   * 指定した種類の報酬を配る。
   * @param {any} quest
   * @param {any} entry
   * @param {string[]} kinds
   * @returns {string[]} 受け取った内容
   */
  function payKinds(quest, entry, kinds) {
    const s = RPG.state.get();
    const rw = quest.reward || {};
    /** @type {string[]} */
    const lines = [];

    for (const kind of kinds) {
      if (kind === 'gold') {
        RPG.state.addGold(rw.gold);
        lines.push(`${rw.gold.toLocaleString()} G`);
      } else if (kind === 'boxes') {
        for (const boxId of Object.keys(rw.boxes)) {
          RPG.state.addBox(boxId, rw.boxes[boxId]);
          lines.push(`${RPG.data.boxes[boxId].name}×${rw.boxes[boxId]}`);
        }
      } else if (kind === 'equip') {
        const item = RPG.gear.forge(rw.equip, RPG.state.nextUid());
        s.inventory.push(item);
        lines.push(`${item.name}（専用装備）`);
      } else if (kind === 'autoCharge') {
        // 手動で縛りを越えた見返りに、オートを任せられる回数が増える (§10.5)
        const now = RPG.autolimit.grantMax(rw.autoCharge);
        lines.push(`オート回数の上限 +${rw.autoCharge}（${now}）`);
      } else if (kind === 'character') {
        const res = grantCharacter(rw.character);
        const name = RPG.state.charName(rw.character);
        if (res.kind === 'new') lines.push(`${name} が仲間になった`);
        else if (res.kind === 'limit_break') lines.push(`${name} が ${res.limitBreak}凸 になった`);
        else lines.push(`${name} は完凸済み → ${(res.gold || 0).toLocaleString()} G 還元`);
      }
      entry.paid.push(kind);
    }
    return lines;
  }

  /**
   * 初回クリア報酬を付与し、達成として記録する。
   * 2回目以降は、まだ受け取っていない種類があればそれだけを配る。
   *
   * @param {string} questId
   * @returns {{granted: boolean, lines: string[]}}
   */
  function complete(questId) {
    const quest = def(questId);
    if (!quest) return { granted: false, lines: [] };

    const entry = record(questId);
    const already = entry.cleared;
    entry.cleared = true;
    entry.clears = (entry.clears || 0) + 1;

    const kinds = unpaidKinds(quest, entry);
    const lines = payKinds(quest, entry, kinds);
    RPG.state.persist();

    return { granted: lines.length > 0, lines, firstClear: !already };
  }

  /**
   * その戦闘で相手にした敵の最高レベル。
   * クエストやタワーの上書きが効いていても、実際に出てきた敵から数える。
   * @param {any} battle
   */
  function topEnemyLevel(battle) {
    let top = 0;
    for (const e of battle.enemies || []) top = Math.max(top, e.level || 0);
    return Math.max(top, battle.enemyLv || 0);
  }

  /**
   * 達成条件型のクエストを判定する (§10.3-2)。
   *
   * 出撃先を問わないので、通常フィールドでも塔でも、勝った戦闘すべてが対象になる。
   * 「自分より何レベル上の相手に勝ったか」で測るため、レベルが上がっても
   * 達成不可能にならない（以前の maxLevel 縛りはここで詰んでいた）。
   *
   * @param {any} battle
   * @returns {Array<{questId: string, name: string, lines: string[]}>}
   */
  function evaluateChallenges(battle) {
    if (!battle || !battle.victory) return [];

    // 依頼は周回側の仕組み。物語の戦闘では数えない。
    //
    // `quests` は PROFILE_KEYS に無いので**両モードで同じ棚**を使っている。
    // そのため物語の戦闘で「格上狩り」が成立し、Lv4 のパーティが Lv22 の
    // 浅層へ降りた瞬間に **6,000 G ＋ 金の宝箱3 ＋ オート+5 が物語側の財布へ**
    // 入っていた（それまでの総収入 2,800 G が一撃で4倍）。
    // しかも周回側では「達成済み・受取済み」になり、二度と取れなくなる。
    //
    // 棚を分ける手もあるが、そうすると物語側にも依頼の報酬が生まれて
    // 章ごとの手応えが崩れる。物語は筋書きの側で難度を決める場所なので、
    // **数えないほうが正しい**。
    if (RPG.state.mode && RPG.state.mode() === 'story') return [];

    const partyTop = partyTopLevel();
    const enemyTop = topEnemyLevel(battle);
    const gap = enemyTop - partyTop;

    const out = [];
    for (const quest of challenges()) {
      if (isCleared(quest.id)) continue;
      if (!unlocked(quest).ok) continue;
      const cond = quest.condition || {};
      if (cond.levelGap != null && gap < cond.levelGap) continue;

      const res = complete(quest.id);
      if (res.lines.length) out.push({ questId: quest.id, name: quest.name, lines: res.lines });
    }
    return out;
  }

  /**
   * 達成条件型クエストの、いまの達成状況。表示用。
   * @param {any} quest
   */
  function challengeProgress(quest) {
    const cond = quest.condition || {};
    if (cond.levelGap == null) return null;
    const partyTop = partyTopLevel();
    return {
      need: cond.levelGap,
      partyTop,
      targetLevel: partyTop + cond.levelGap,
      text: `パーティ最高 Lv${partyTop} → Lv${partyTop + cond.levelGap} 以上の敵に勝つ`,
    };
  }

  /**
   * クリア済みなのに受け取っていない報酬をまとめて配る。
   *
   * アップデートで報酬を足したときの取りこぼしを防ぐための入口で、
   * 起動時に一度だけ呼ぶ。未クリアのクエストには一切触れない。
   *
   * @returns {Array<{questId: string, name: string, lines: string[]}>}
   */
  function claimPending() {
    const out = [];
    for (const quest of all()) {
      const s = RPG.state.get();
      const saved = s.quests && s.quests[quest.id];
      if (!saved || !saved.cleared) continue;      // 未クリアには配らない
      const entry = record(quest.id);
      const kinds = unpaidKinds(quest, entry);
      if (kinds.length === 0) continue;
      const lines = payKinds(quest, entry, kinds);
      if (lines.length) out.push({ questId: quest.id, name: quest.name, lines });
    }
    if (out.length) RPG.state.persist();
    return out;
  }

  RPG.quest = {
    def, all, sorties, challenges, isCleared, unlocked, checkParty, ruleLabels, rewardLabels,
    grantCharacter, complete, claimPending, partyTopLevel,
    evaluateChallenges, challengeProgress, topEnemyLevel,
    REWARD_KINDS, LEGACY_KINDS, record, unpaidKinds,
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
