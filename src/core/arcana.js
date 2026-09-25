// @ts-check
/**
 * アルカナ (§21)。キャラクター1人につき1枚だけ持てる、第三の効果層。
 *
 * ── なぜ klass.js と別なのか ──
 * クラスはポイントを振って育てる層で、`klassTree` という投資先を持つ。
 * アルカナは投資しない。**就いているかどうかだけ**で、伸びも枝分かれも無い。
 * 同じファイルに同居させると「振れないクラス」という説明の要る存在になる。
 *
 * ── 効果語彙は共通 ──
 * ツリー・クラスと同じ効果種別をそのまま使う。`units.js` が3つを合流させるので、
 * 以降の組み立ては出どころを区別しなくてよい。
 * 新しいアルカナを足すときも `data/arcana.js` に1つ書くだけで効く。
 */
(function (RPG) {
  'use strict';

  /** @param {string} id */
  function def(id) {
    return (RPG.data.arcana && RPG.data.arcana[id]) || null;
  }

  /** 選べるアルカナの一覧。 */
  function all() {
    const src = RPG.data.arcana || {};
    return Object.keys(src).map((id) => Object.assign({ id }, src[id]));
  }

  /**
   * そのアルカナが解放されているか (§21)。
   *
   * ── なぜ依頼で解放するのか ──
   * レベルで配るとただ待つだけになる。アルカナは1枚ごとに戦い方が変わるので、
   * **その戦い方が要る場所を越えたら手に入る**のが筋が通る。
   * 依頼を1枚ずつ紐付けてあるので、解放そのものが目標になる。
   *
   * 達成の記録は依頼側にしかない。ここで別に数えると二重帳簿になってずれる。
   *
   * @param {string} id
   */
  function isUnlocked(id) {
    const d = def(id);
    if (!d) return false;
    const u = d.unlock;
    if (!u) return true;                       // 条件が無ければ最初から使える
    if (u.quest) {
      return !!(RPG.quest && RPG.quest.isCleared && RPG.quest.isCleared(u.quest));
    }
    return true;
  }

  /** 解放の条件を、まだ満たしていない人へ見せる文。 */
  function lockReason(id) {
    const d = def(id);
    if (!d || !d.unlock || isUnlocked(id)) return null;
    if (d.unlock.quest) {
      const q = RPG.data.quests && RPG.data.quests[d.unlock.quest];
      return '依頼「' + ((q && q.name) || d.unlock.quest) + '」を達成すると開く';
    }
    return '未解放';
  }

  /**
   * 効果をユニットへ流せる形にして返す。就いていなければ null。
   *
   * ツリーの畳み込みをそのまま借りる。アルカナは投資しないので、
   * 「必ずレベル1で取っている仮想ノード」1枚として渡す（klass.js の素質と同じ手）。
   *
   * @param {any} charSave
   */
  function effects(charSave) {
    const d = charSave && charSave.arcana ? def(charSave.arcana) : null;
    if (!d) return null;
    return RPG.tree.effectsOf(
      [{ id: '__arcana', tier: 'basic', cost: 0, maxLevel: 1, effects: d.effects || [] }],
      { __arcana: 1 }
    );
  }

  /**
   * ビルド画面と図鑑で出す要約。**利と害を必ず両方返す。**
   * 片方だけ出すと、選ぶ前に代償が見えない。
   * @param {any} charSave
   */
  function summary(charSave) {
    const id = charSave && charSave.arcana;
    const d = id ? def(id) : null;
    if (!d) return null;
    return {
      id, name: d.name, reading: d.reading, color: d.color, icon: d.icon,
      boon: d.boon, bane: d.bane, flavor: d.flavor, desc: d.desc,
    };
  }

  /**
   * そのキャラにアルカナを就ける。`null` で外す。
   *
   * クラスと違って費用も条件も置いていない。**付け替えを妨げない**のは、
   * 代償が常時効いている以上、試して合わなければ戻せるべきだから。
   * （クラスは投資先が消えるので転職に費用がある。アルカナは投資しない）
   *
   * @param {any} charSave @param {string | null} id
   * @returns {boolean} 就けられたか
   */
  function assign(charSave, id) {
    if (!charSave) return false;
    // **delete ではなく null を入れる。** createCharacter が arcana: null で
    // 作るので、外したときも同じ形に戻さないと「作った形」と「外した形」が
    // ずれる（書き出し→読み込みの往復が一致しなくなる・§7）。
    if (id == null) { charSave.arcana = null; return true; }
    if (!def(id)) return false;
    if (!isUnlocked(id)) return false;
    charSave.arcana = id;
    return true;
  }

  /* ================== 女帝 (§21) — ツリーのパッシブを分け与える ================== */

  /**
   * 共有する passives のキーと、半分にするやり方。**ここに無いキーは共有も半減もしない。**
   *
   * 登録簿から機械的に拾わないのは、将来の新しい効果が審査なしで共有されないようにするため
   * （docs/女帝の実装案.md「対象を明示した規則表」）。分類は表示形式ではなく実際の用途による。
   *
   *   half      割合・確率・加算係数。値の半分
   *   floor     回数・段数・ターン。半分にして切り捨て（1 → 0、2 → 1、3 → 1）
   *   keyedHalf / keyedFloor  種類ごとの表。要素ごとに上の規則
   *
   * 入れていないもの（共有も半減もしない）:
   *   倍率   escalate・atkScale・counterPower（反撃の威力倍率）
   *   有無・規則変更  allSpread・lowPowerSpread・soloBuff・noSelfBuff・noAllyHeal など
   *   「1回だけ」系（max で合成）  lastStand・reviveHp・waveRevive。半分を配ると
   *     復活できなかった者に復活そのものを配ることになる
   *   上限そのものを動かす  buffCapBonus
   *   アルカナ固有  bond*・weaveGift・doomPower・selfBind ほか（ツリーでは取れない）
   */
  const EMPRESS_SHARE = {
    ambush: 'half', atkToDef: 'half', autoLowSkill: 'half', backGuard: 'half',
    buffPower: 'half', selfBuffPower: 'half', allyBuffPower: 'half', supportStack: 'half',
    barrierPower: 'half', buffShield: 'half', buffHeal: 'half', cleanse: 'half', triage: 'half',
    healSpread: 'half', healBuff: 'half', lowHpHeal: 'half', smite: 'half', healToPower: 'half',
    roundBuff: 'half', taunt: 'half', stealth: 'half', buffOnKill: 'half', chain: 'half',
    chainPower: 'half', comboKeep: 'half', comboPower: 'half', comboSpendPower: 'half',
    comboRefund: 'half', counterRate: 'half', counterAll: 'half', critOverflow: 'half',
    critHeal: 'half', critSpread: 'half', critStack: 'half', damageShare: 'half',
    debuffSpread: 'half', defToAtk: 'half', evade: 'half', focusPower: 'half', relayPower: 'half',
    mendPower: 'half', extraActionRate: 'half', foeCountPower: 'half', frontPower: 'half',
    guardAlly: 'half', guardBreak: 'half', healOnKill: 'half', healPower: 'half', hitStack: 'half',
    hpToAtk: 'half', hpToDef: 'half', killExtraAction: 'half', lifesteal: 'half',
    loneFoePower: 'half', lowHpGuard: 'half', lowPowerBoost: 'half', midPowerCrit: 'half',
    midPowerStatus: 'half', monoElementPower: 'half', openingBuff: 'half', overhealShield: 'half',
    overkillCarry: 'half', partySizePower: 'half', rainbowPower: 'half', reflect: 'half',
    regen: 'half', repeatPower: 'half', roundStack: 'half', selfCursePower: 'half',
    shieldRegen: 'half', sigilBurst: 'half', soloPower: 'half', stableDamage: 'half',
    startShield: 'half', statusImmune: 'half', statusOnHit: 'half', statusPower: 'half',
    thorns: 'half', varietyPower: 'half', waveHeal: 'half', wavePower: 'half', waveStack: 'half',
    // 回数・段数・ターン（表示が pct でも実際は回数のもの: doubleHits・lowPowerRepeat・comboGain・midPowerCombo・debuffResist）
    buffDuration: 'floor', buffExtend: 'floor', comboGain: 'floor', comboStart: 'floor',
    comboThreshold: 'floor', comboMaxUp: 'floor', critCombo: 'floor', debuffDuration: 'floor',
    debuffResist: 'floor', doubleHits: 'floor', cooldownCut: 'floor', firstHitCrit: 'floor',
    lowPowerRepeat: 'floor', midPowerCombo: 'floor',
    // 種類ごとの表
    statusOnHitKind: 'keyedHalf', vsStatusPower: 'keyedHalf', statusResistKind: 'keyedFloor',
  };

  /** @param {string} rule @param {number} v */
  function halve(rule, v) {
    if (!(typeof v === 'number') || !v) return 0;
    return rule === 'floor' || rule === 'keyedFloor' ? Math.trunc(v / 2) : v / 2;
  }

  /** この育成が女帝の札を持つか。 @param {any} charSave */
  function isEmpress(charSave) {
    const d = charSave && charSave.arcana ? def(charSave.arcana) : null;
    return !!(d && (d.effects || []).some((/** @type {any} */ e) => e.kind === 'empress' && e.value > 0));
  }

  /**
   * 女帝のツリーの passives から「分ける値」を作る。
   * **同じキーは集計済み**（effectsOf がノードを合算したあと）の値から半分にする。
   * ノードごとに半分にして切り捨てると、1回＋1回が 0＋0 になる。
   * @param {any} treePassives RPG.tree.effects(...).passives（上限を掛けた後）
   * @returns {Record<string, any>}
   */
  function empressShare(treePassives) {
    /** @type {Record<string, any>} */
    const out = {};
    for (const key of Object.keys(EMPRESS_SHARE)) {
      const rule = EMPRESS_SHARE[key];
      const v = treePassives[key];
      if (rule === 'keyedHalf' || rule === 'keyedFloor') {
        if (!v || typeof v !== 'object') continue;
        /** @type {Record<string, number>} */
        const table = {};
        for (const k of Object.keys(v)) {
          const h = halve(rule, v[k]);
          if (h) table[k] = h;
        }
        if (Object.keys(table).length) out[key] = table;
      } else {
        const h = halve(rule, v);
        if (h) out[key] = h;
      }
    }
    return out;
  }

  /**
   * 女帝本人のツリーの passives を、分ける値と**同じ値**に置き換える（半分の自分）。
   * 分ける値と自分の値を同じ元から作るので、1/4 にはならない。
   * 規則表に無いキーは触らない。
   * @param {any} treePassives 破壊的に変更する
   */
  function empressSelf(treePassives) {
    for (const key of Object.keys(EMPRESS_SHARE)) {
      const rule = EMPRESS_SHARE[key];
      const v = treePassives[key];
      if (v == null) continue;
      if (rule === 'keyedHalf' || rule === 'keyedFloor') {
        if (!v || typeof v !== 'object') continue;
        /** @type {Record<string, number>} */
        const table = {};
        for (const k of Object.keys(v)) table[k] = halve(rule, v[k]);
        treePassives[key] = table;
      } else if (typeof v === 'number') {
        treePassives[key] = halve(rule, v);
      }
    }
    return treePassives;
  }

  /**
   * 受け手のツリーの passives に、女帝から受け取った値を足す（種類ごとの表は要素ごと）。
   * このあと RPG.tree.capPassives でツリーぶんの上限を掛け直すこと。
   * @param {any} treePassives 破壊的に変更する @param {Record<string, any>} share
   */
  function addShare(treePassives, share) {
    for (const key of Object.keys(share)) {
      const v = share[key];
      if (v && typeof v === 'object') {
        const merged = Object.assign({}, treePassives[key]);
        for (const k of Object.keys(v)) merged[k] = (merged[k] || 0) + v[k];
        treePassives[key] = merged;
      } else {
        treePassives[key] = (treePassives[key] || 0) + v;
      }
    }
    return treePassives;
  }

  /**
   * 複数の女帝から受け取る分を1つにまとめる。**同じ効果は足さず、一番大きい値だけ**を採る。
   *
   * @知見: 女帝の強さは能力の変換（DEF→ATK など）の共有で決まる。複数を足すと主人公へ積み上がる
   *
   * ── 足さない理由（ユーザー判断）──
   * 終盤の補助役は DEF→ATK の変換を 2.8 持つ。女帝にするとその半分 +1.4 が主人公へ入り、
   * 2人いれば +2.8 と積み上がる。倒せないボスの6ラウンド総与ダメで
   *   足し合わせ  女帝1人 257B ／ 2人 459B（札なし 157B の2.9倍。主人公の札とも重なる）
   *   最大を採る  女帝1人 257B ／ 2人 335B ／ 3人 331B   ← 採用
   *   変換を分けない  1人 163B ／ 3人 196B（弱い補助の札になる）
   * 種類ごとの表は要素ごとに最大。受け取った分は受け手のツリーの層へ入り、再配布されない。
   * @param {Record<string, any>[]} shares
   * @returns {Record<string, any>}
   */
  function combineShares(shares) {
    /** @type {Record<string, any>} */
    const out = {};
    for (const sh of shares || []) {
      for (const k of Object.keys(sh)) {
        const v = sh[k];
        if (v && typeof v === 'object') {
          const t = Object.assign({}, out[k]);
          for (const kk of Object.keys(v)) t[kk] = Math.max(t[kk] || 0, v[kk]);
          out[k] = t;
        } else {
          out[k] = Math.max(out[k] || 0, v);
        }
      }
    }
    return out;
  }

  /**
   * 画面に出す、女帝が分けるもの（ビルド画面）。**取っても配れないもの**も並べる。
   *
   * shared … 他の味方それぞれへ渡る値（=自分に残る値）
   * zeroed … 規則表にあるが、半分で0になって配れないもの（回数1など）
   * kept   … 取ってあるが分けない（倍率・有無・一度きり）。自分には満額で残る
   * @param {any} charSave
   * @returns {{shared: {label: string, value: number, fmt: string, sub?: string}[],
   *   zeroed: {label: string, value: number, fmt: string}[], kept: string[]}}
   */
  function empressPreview(charSave) {
    const reg = RPG.data.effectKinds || {};
    /** @type {Record<string, any>} */
    const byKey = {};
    for (const kind of Object.keys(reg)) if (reg[kind].key && reg[kind].to === 'passives') byKey[reg[kind].key] = reg[kind];
    const src = RPG.tree.effects((charSave && charSave.tree) || {}).passives;
    const base = RPG.tree.effects({}).passives;
    const share = empressShare(src);
    /** @type {any[]} */ const shared = [];
    /** @type {any[]} */ const zeroed = [];
    /** @type {string[]} */ const kept = [];
    for (const key of Object.keys(src)) {
      const v = src[key];
      const d = byKey[key] || { label: key, fmt: 'pct' };
      const isSet = v && (typeof v === 'object' ? Object.keys(v).some((k) => v[k]) : v !== base[key]);
      if (!isSet || key === 'atkScale') continue;
      const rule = EMPRESS_SHARE[key];
      if (!rule) { kept.push(d.label); continue; }
      const fmt = rule === 'floor' ? 'count' : 'pct';
      if (typeof v === 'object') {
        for (const k of Object.keys(v)) {
          if (!v[k]) continue;
          const name = (RPG.data.statuses && RPG.data.statuses[k]) ? RPG.data.statuses[k].label : k;
          const got = share[key] && share[key][k];
          const kfmt = rule === 'keyedFloor' ? 'count' : 'pct';
          if (got) shared.push({ label: d.label, sub: name, value: got, fmt: kfmt });
          else zeroed.push({ label: `${d.label}（${name}）`, value: v[k], fmt: kfmt });
        }
      } else if (share[key]) shared.push({ label: d.label, value: share[key], fmt });
      else zeroed.push({ label: d.label, value: v, fmt });
    }
    return { shared, zeroed, kept };
  }

  RPG.arcana = { def, all, effects, summary, assign, isUnlocked, lockReason,
    EMPRESS_SHARE, isEmpress, empressShare, empressSelf, addShare, combineShares, empressPreview };
})(window.RPG);
