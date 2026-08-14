// @ts-check
/**
 * ユニット構築 — セーブデータ上のキャラクターや敵定義から、
 * 戦闘・ダメージ計算がそのまま使える形のオブジェクトを組み立てる。
 */
(function (RPG) {
  'use strict';

  /** ステータスの表示名。ゲーム内テキストは全て日本語 (§12-10)。 */
  const STAT_LABEL = { hp: 'HP', atk: 'ATK', def: 'DEF', magi_power: '魔力' };

  /**
   * 装備スロットの初期数 (§5.3)。
   * スキルツリーで拡張されたぶんは charSave.slotBonus に積まれる想定。
   */
  const DEFAULT_SLOTS = { weapon: 1, armor: 1, accessory: 1 };

  /** スロットの表示名 */
  const SLOT_LABEL = { weapon: '武器', armor: '防具', accessory: 'アクセサリー' };

  /**
   * レベルアップに必要な経験値。
   * @param {number} level
   */
  function expToNext(level) {
    return Math.floor(60 * Math.pow(level, 1.45));
  }

  /**
   * base + growth × (レベル - 1) でステータスを求める。
   * @param {{base: Record<string, number>, growth: Record<string, number>}} def
   * @param {number} level
   * @returns {Record<string, number>}
   */
  function statsAtLevel(def, level) {
    /** @type {Record<string, number>} */
    const out = {};
    for (const key of Object.keys(def.base)) {
      out[key] = Math.floor(def.base[key] + (def.growth[key] || 0) * (level - 1));
    }
    return out;
  }

  /**
   * キャラクターが持つ装備スロット数を返す。
   * @param {any} charSave
   */
  function slotCounts(charSave) {
    // 拡張はスキルツリー経由でのみ得られる (§5.3)
    const slots = RPG.tree.effects(charSave.tree || {}).slots;
    return {
      weapon: DEFAULT_SLOTS.weapon + slots.weapon,
      armor: DEFAULT_SLOTS.armor + slots.armor,
      accessory: DEFAULT_SLOTS.accessory + slots.accessory,
    };
  }

  /**
   * キャラクターの装備品インスタンスを配列で返す。
   * @param {any} charSave
   * @param {any[]} inventory
   */
  function equippedItems(charSave, inventory) {
    /** @type {any[]} */
    const items = [];
    for (const slot of Object.keys(DEFAULT_SLOTS)) {
      for (const uid of (charSave.equipped && charSave.equipped[slot]) || []) {
        const item = inventory.find((it) => it.uid === uid);
        if (item) items.push(item);
      }
    }
    return items;
  }

  /**
   * セーブデータのキャラクターから、装備込みの完全なユニットを組み立てる。
   * @param {any} charSave  { id, level, exp, limitBreak, equipped }
   * @param {any[]} inventory
   * @returns {any}
   */
  function buildCharacterUnit(charSave, inventory) {
    const def = RPG.data.characters[charSave.id];
    const stats = statsAtLevel(def, charSave.level);
    const items = equippedItems(charSave, inventory);
    // スキルツリー (§5) とクラス (§12) は同じ効果種別を使うので、
    // ここで1つに合流させてしまえば、以降の組み立ては両者を区別しなくてよい。
    const tree = RPG.tree.mergeEffects(
      RPG.tree.effects(charSave.tree || {}),
      RPG.klass ? RPG.klass.effects(charSave) : null
    );

    // キャラクター固有のパッシブ (§8)。レジェンドの特殊能力はここで表現する。
    // ツリーで得たものと合流させ、同じ仕組みで戦闘エンジンに渡す。
    const innate = def.passives || {};
    const passives = Object.assign({}, tree.passives);
    for (const key of Object.keys(innate)) {
      if (key === 'atkScale') continue;             // 倍率なので合算しない
      if (key === 'lastStand' || key === 'reviveHp' || key === 'waveRevive') {
        // 「1回だけ」系は足さずに強いほうを採る
        passives[key] = Math.max(passives[key] || 0, innate[key]);
      } else if (innate[key] && typeof innate[key] === 'object') {
        // statusOnHitKind のような「種類 → 値」の表は、キーごとに足す (§5.8)。
        // ここを素で + すると数値と文字列が混ざって壊れる。
        const merged = Object.assign({}, passives[key]);
        for (const kk of Object.keys(innate[key])) {
          merged[kk] = (merged[kk] || 0) + innate[key][kk];
        }
        passives[key] = merged;
      } else {
        passives[key] = (passives[key] || 0) + innate[key];
      }
    }
    passives.atkScale = (tree.passives.atkScale || 1) * (innate.atkScale == null ? 1 : innate.atkScale);

    // 固有の状況補正（背水・ボス特効など）もツリーぶんと足す
    const situational = Object.assign({}, tree.situational);
    for (const key of Object.keys(def.situational || {})) {
      situational[key] = (situational[key] || 0) + def.situational[key];
    }

    // スキルツリーの割合上昇は、装備の平坦加算より先に基礎ステータスへ適用する。
    // （装備値まで%で膨らませると二重取りになるため）
    for (const key of Object.keys(stats)) {
      stats[key] = Math.floor(stats[key] * (1 + (tree.statPct[key] || 0)));
    }

    /** @type {any[]} */
    const tagBonuses = tree.tagBonuses.slice();
    let critRate = tree.crit;
    let capBreak = tree.capBreak;
    let reduction = tree.reduction;

    for (const item of items) {
      for (const key of Object.keys(item.stats)) {
        stats[key] = (stats[key] || 0) + item.stats[key];
      }
      for (const b of item.tagBonuses) tagBonuses.push(b);
      critRate += item.critRate || 0;
      capBreak += item.capBreak || 0;
      reduction += item.reduction || 0;
    }

    // --- 装備セット (§7.7) ---
    // 組み立て時に効くものだけをここで反映する。戦況を見るものは battle.js が扱う。
    const sets = RPG.equipset.resolve(items);
    const setFx = sets.effects;
    if (setFx.reviveHp) passives.reviveHp = Math.max(passives.reviveHp || 0, setFx.reviveHp);

    // ユニーク装備・セット効果から passives へ流すもの (§7.8)。
    //
    // ── なぜ一覧で持つのか ──
    // ここに載せていないキーは、装備しても **何も起きない**。
    // 実際、ユニーク装備が小技寄りに偏っていたのは、読み口が
    // 小技まわりのキーにしか無かったからだった。
    // 効果を持つ装備を足すときは、まずここを見て、載っていなければ足す。
    //
    // battle.js 側で `p.x + fx.x` と足している キー（lowPowerBoost など）は
    // ここに載せてはいけない。二重に効いてしまう。
    for (const key of [
      'midPowerStatus', 'midPowerCombo',   // 中技の役割 (§5.8)
      'hpToDef', 'guardAlly',              // 防御で耐える道 (§5.8)
      'statusPower', 'debuffDuration',     // 状態異常で押す構成 (§5.6)
      'doubleHits',                        // 手数で押す構成
      'comboGain', 'comboPower',           // 弱点コンボを繋ぐ構成 (§10.6)
      'loneFoePower', 'soloPower',         // 単騎・1体相手に寄せる構成
      'reflect', 'counterRate',            // 殴られる前提の構成
    ]) {
      if (setFx[key]) passives[key] = (passives[key] || 0) + setFx[key];
    }
    // 上限突破は passives ではなく素の値として持っている (§3.2 ステップ8)
    if (setFx.capBreak) capBreak += setFx.capBreak;
    if (setFx.highPowerBoost) {
      situational.highPowerBoost = (situational.highPowerBoost || 0) + setFx.highPowerBoost;
    }
    if (setFx.firstRoundPower) {
      situational.firstRoundPower = (situational.firstRoundPower || 0) + setFx.firstRoundPower;
    }

    // 「攻撃力が半分になる代わりに常に二回攻撃」のような代償はここで効かせる
    if (passives.atkScale !== 1) stats.atk = Math.max(1, Math.floor(stats.atk * passives.atkScale));

    // 「命を刃に」— 最大HPの一部を攻撃力と魔力に上乗せする (§5.6)。
    // HPを伸ばす装備が火力にも化けるので、耐久型に別の道が生まれる。
    if (passives.hpToAtk) {
      const bonus = Math.floor((stats.hp || 0) * passives.hpToAtk);
      stats.atk = (stats.atk || 0) + bonus;
      stats.magi_power = (stats.magi_power || 0) + bonus;
    }

    // 「肉の壁」— 最大HPの一部をDEFへ回す (§5.8)。
    // HPは母数が大きいので、変換率が低くても効く。
    // 防御で耐えるビルドは、DEFの割合増しだけでは必要な桁に届かない。
    if (passives.hpToDef) {
      stats.def = (stats.def || 0) + Math.floor((stats.hp || 0) * passives.hpToDef);
    }

    // 「守りを刃に」「攻めを盾に」— ステータスを別の役へ回す (§5.8)。
    // hpToAtk と同じく装備を全部乗せた後に効かせる。
    // 元の値を先に控えるのは、双方向に振ったときに増えたぶんが二重に化けないようにするため。
    if (passives.defToAtk || passives.atkToDef) {
      const srcDef = stats.def || 0;
      const srcAtk = stats.atk || 0;
      if (passives.defToAtk) {
        const bonus = Math.floor(srcDef * passives.defToAtk);
        stats.atk = (stats.atk || 0) + bonus;
        stats.magi_power = (stats.magi_power || 0) + bonus;
      }
      if (passives.atkToDef) {
        stats.def = (stats.def || 0) + Math.floor(srcAtk * passives.atkToDef);
      }
    }

    // 【主人公専用】攻撃力と魔力を高い方に揃える (§8.1)。
    // 装備を全部乗せた後に効かせるので、物理装備でも魔術装備でも同じだけ伸びる。
    // 限界突破できないぶんを、両刀という強みで埋めるための仕掛け。
    if (passives.mirrorStat) {
      const top = Math.max(stats.atk || 0, stats.magi_power || 0);
      stats.atk = top;
      stats.magi_power = top;
    }

    // 固有技・共通技に、スキルツリーで習得した技を足す (§5.1)
    const skills = (def.unique_skills || []).concat(def.common_skills || []);
    for (const id of tree.skills) {
      if (!skills.includes(id)) skills.push(id);
    }

    // プレイヤーが決めた並び順を反映する (§4)。
    //
    // 技が増えると、よく使うものが一覧の後ろに埋もれる。毎ターン
    // 下までスクロールして探すことになるので、自分で前へ出せるようにした。
    //
    // 保存してあるのは順番だけ。習得していない技が混ざっていても、
    // 覚えた技が消えていても壊れないよう、突き合わせて組み直す。
    const order = charSave.skillOrder || [];
    if (order.length) {
      const rank = new Map(order.map((/** @type {string} */ id, /** @type {number} */ i) => [id, i]));
      skills.sort((a, b) => {
        const ra = rank.has(a) ? rank.get(a) : Infinity;
        const rb = rank.has(b) ? rank.get(b) : Infinity;
        return ra === rb ? 0 : ra - rb;
      });
    }

    return {
      side: 'party',
      id: charSave.id,
      // 表示名は必ず state 経由。主人公はプレイヤーが付けた名前になる (§8.1)
      name: RPG.state.charName(charSave.id),
      title: def.title,
      art: def.art,
      rarity: def.rarity,
      level: charSave.level,
      element: def.element,
      color: def.color,
      accent: def.accent,
      glyph: def.glyph,
      stats,
      maxHp: stats.hp,
      hp: stats.hp,
      baseTagBonuses: tagBonuses,
      baseCritRate: critRate,
      critDamage: tree.critDamage,
      capBreak,
      execute: tree.execute,
      baseReduction: Math.min(1, reduction),
      passives,
      situational,
      // 千変セットの「属性不利を受けない」は、ツリーの適応と同じ枠で表現する
      elementMods: Object.assign({}, tree.elementMods, def.elementMods || {},
        setFx.elementAdapt
          ? { adapt: Math.max((tree.elementMods || {}).adapt || 0, setFx.elementAdapt) }
          : {}),
      skills,
      equippedItems: items,
      // 装備セット (§7.7)。戦闘中に参照するのでユニットに持たせる。
      sets: sets.counts,
      setEffects: setFx,
      setLabels: sets.active.map((/** @type {any} */ e) =>
        `${e.set.name}(${e.tier.pieces}) ${e.tier.label}`),
      // 憤怒セットが溜めている怒り
      wrath: 0,
      // 癒しの余剰で張る障壁 / 奇襲を使ったか (§5.6)
      shield: 0,
      ambushed: false,
      // 被弾数（積み上がる火力の材料）と、持ち越し中の超過ダメージ (§5.7)
      hitsTaken: 0,
      carryDamage: 0,
      // 戦闘中に積む会心率 / 直前に使った技 / 同じ技を続けた回数 (§5.8)
      critBonus: 0,
      lastSkillId: null,
      repeatCount: 0,
      // クラス技のクールタイム {技ID: 次に使えるラウンド} と、配られた追加行動 (§12)
      cooldowns: {},
      grantedExtra: false,
      // 戦闘中に積まれる一時効果
      buffTags: [],
      buffUnique: [],
      buffReduction: [],
      statusEffects: [],
      extraActions: 0,
      revived: false,
      defMultiplier: 1,
      defIgnoredTurns: 0,
      alive: true,
    };
  }

  /**
   * 敵定義から戦闘用ユニットを組み立てる。
   * @param {string} enemyId
   * @param {number} level
   * @param {boolean} isBoss 最終ウェーブのボス補正 (§10.1) を掛けるか
   * @param {number} index 同名の敵を区別するための連番
   */
  function buildEnemyUnit(enemyId, level, isBoss, index, scale) {
    const def = RPG.data.enemies[enemyId];
    const stats = statsAtLevel(def, level);
    // クエストの高難度指定はここで乗せる。報酬は倍率で膨らませない（周回の抜け道になるため）。
    const mult = (isBoss ? RPG.data.bossStatMultiplier : 1) * (scale == null ? 1 : scale);
    for (const key of Object.keys(stats)) stats[key] = Math.floor(stats[key] * mult);

    return {
      side: 'enemy',
      id: enemyId,
      uid: enemyId + '#' + index,
      name: def.name + (isBoss && !def.boss ? '（強化）' : ''),
      level,
      element: def.element,
      color: def.color,
      glyph: def.glyph,
      isBoss: !!(isBoss || def.boss),
      stats,
      maxHp: stats.hp,
      hp: stats.hp,
      baseTagBonuses: [],
      baseCritRate: 0,
      critDamage: 0,
      capBreak: 0,
      execute: 0,
      baseReduction: 0,
      passives: {},
      skills: def.skills,
      // ボス補正ぶんだけ報酬も増やす。クエストの難度倍率(scale)は報酬に効かせない。
      gold: Math.floor(def.gold * (isBoss ? RPG.data.bossStatMultiplier : 1)),
      exp: Math.floor(def.exp * (isBoss ? RPG.data.bossStatMultiplier : 1)),
      drops: def.drops || [],
      buffTags: [],
      buffUnique: [],
      buffReduction: [],
      statusEffects: [],
      defMultiplier: 1,
      defIgnoredTurns: 0,
      extraActions: 0,
      revived: false,
      shield: 0,
      hitsTaken: 0,
      carryDamage: 0,
      critBonus: 0,
      lastSkillId: null,
      repeatCount: 0,
      cooldowns: {},
      grantedExtra: false,
      alive: true,
    };
  }

  /**
   * 被ダメージ軽減の合計。装備・ツリーの恒常分と戦闘中バフを足す (§3.1-3)。
   * @param {any} unit
   */
  function totalReduction(unit) {
    const buffs = (unit.buffReduction || []).reduce((s, /** @type {any} */ b) => s + b.value, 0);
    return Math.min(1, (unit.baseReduction || 0) + buffs);
  }

  /**
   * ダメージ計算 (§3) にそのまま渡せる attacker 形式へ変換する。
   * 装備由来の恒久補正と、戦闘中バフを合流させるのがここの役目。
   * @param {any} unit
   */
  function toAttacker(unit) {
    const s = unit.situational || {};
    return {
      level: unit.level,
      stats: unit.stats,
      element: unit.element,
      // 共通バフは同系統タグの装備補正に加算される (§3.2 ステップ3)
      tagBonuses: unit.baseTagBonuses.concat(unit.buffTags),
      // 固有ユニークバフはすべて独立して乗算される
      uniqueBuffs: unit.buffUnique.map((/** @type {any} */ b) => b.value),
      capBreak: unit.capBreak,
      // 「熱狂」で戦闘中に積んだぶんを足す (§5.8)
      critRate: unit.baseCritRate + (unit.critBonus || 0),
      critDamage: unit.critDamage || 0,
      execute: unit.execute || 0,
      // 状況依存の特殊パッシブ
      hpRatio: unit.maxHp > 0 ? unit.hp / unit.maxHp : 1,
      lowHpPower: s.lowHpPower || 0,
      highHpPower: s.highHpPower || 0,
      bossSlayer: s.bossSlayer || 0,
      debuffAmp: s.debuffAmp || 0,
      firstRoundPower: s.firstRoundPower || 0,
      // 【主人公専用】レベルで伸びる火力 (§8.1)
      levelPower: (unit.passives && unit.passives.levelPower) || 0,
      // 安定 (§5.6)。ランダム揺らぎの幅を狭める
      stableDamage: (unit.passives && unit.passives.stableDamage) || 0,
      // 属性の噛み合いで決まるもの (§5.7)
      weakHunter: s.weakHunter || 0,
      neutralPower: s.neutralPower || 0,
      critPierce: s.critPierce || 0,
      // §5.8
      critExecute: s.critExecute || 0,
      fullHpFoePower: s.fullHpFoePower || 0,
      // 相手の「巨獣への備え」判定に使う。敵ユニットだけが true になる。
      isBoss: !!unit.isBoss,
      elementMods: unit.elementMods || {},
    };
  }

  /**
   * ダメージ計算 (§3) に渡せる defender 形式へ変換する。
   * @param {any} unit
   */
  function toDefender(unit) {
    return {
      level: unit.level,
      def: Math.floor(unit.stats.def * unit.defMultiplier),
      element: unit.element,
      reduction: totalReduction(unit),
      hpRatio: unit.maxHp > 0 ? unit.hp / unit.maxHp : 1,
      isBoss: !!unit.isBoss,
      // def_buff（防御上昇）も statusEffects に入るので、数えるときは除く。
      // 数に入れると、自分で守りを固めた敵が「弱体まみれ」として殴られる。
      debuffs: (unit.statusEffects || []).filter((/** @type {any} */ e) => e.kind !== 'def_buff').length
        + (unit.defIgnoredTurns > 0 ? 1 : 0),
      // 弱点耐性と属性耐性 (§5.7)。攻撃側の elementMods とは別に、受ける側の分を渡す。
      weakGuard: (unit.situational && unit.situational.weakGuard) || 0,
      bossGuard: (unit.situational && unit.situational.bossGuard) || 0,
      elementMods: unit.elementMods || {},
    };
  }

  RPG.units = {
    STAT_LABEL, SLOT_LABEL, DEFAULT_SLOTS,
    expToNext, statsAtLevel, slotCounts, equippedItems, totalReduction,
    buildCharacterUnit, buildEnemyUnit, toAttacker, toDefender,
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
