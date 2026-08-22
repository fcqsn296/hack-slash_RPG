// @ts-check
/**
 * ゲーム状態とセーブ/ロード。
 *
 * セーブデータには「復元できないもの」だけを保存する。
 * 例えばSPは §6.5 の式 (レベル-1) + limit_break でいつでも再計算できるため保存しない。
 */
(function (RPG) {
  'use strict';

  const STORAGE_KEY = 'hakusura-rpg/save';
  // 読めなかったセーブの退避先 (§16)。ゲーム側からは絶対に上書きしない。
  const RESCUE_KEY = 'hakusura-rpg/rescued';
  const SAVE_VERSION = 1;

  /** @type {any} */
  let save = null;

  /**
   * キャラクターリストの表示設定の初期値。
   * 既定で編成中を先頭に固める（一番よく探すのが「今使っている4人」のため）。
   */
  function defaultCharView() {
    return {
      pinParty: true,
      sort: 'level',
      element: /** @type {string|null} */ (null),
      query: '',
    };
  }

  /** 初期セーブデータを作る。 */
  function createNewSave() {
    /** @type {any} */
    const s = {
      version: SAVE_VERSION,
      gold: 10000,
      boxes: { box_bronze: 3 },
      characters: {},
      inventory: [],
      party: [],
      uidCounter: 1,
      stats: { battles: 0, wins: 0, identified: 0, pulls: 0 },
      // プレイヤーが入力した名前の上書き { キャラID: 名前 }。主人公のみ編集できる (§8.1)
      customNames: {},
      // 初回起動時の名前入力をまだ行っていない
      named: false,
      // 周回まわりの設定
      settings: { auto: false, fast: false },
      // キャラクターリストの並べ替え。キャラが増えると探すのが大変なので保存する。
      charView: defaultCharView(),
      // クエストの達成記録 { クエストID: { cleared: true, clears: 回数 } } (§10.3)
      quests: {},
      // 装備の自動売却ルール (§7.4)。既定値は RPG.autosell 側が持つ。
      // migrate() と同じ形にしておくこと（新規と復元で中身が食い違うと差分比較が壊れる）。
      autoSell: RPG.autosell ? RPG.autosell.defaultRules() : null,
      // 図鑑の記録 (§13)。「どこまで見たか」だけを持ち、項目そのものは data/ から導出する。
      codex: { enemies: {}, fields: {} },
      // 派遣中の内容 (§10.4)。開始時刻だけを持ち、進捗は実時間から求める。
      dispatch: null,
      // オート戦闘の残量 (§10.5)。手動は消費しない。
      autoLimit: RPG.autolimit ? RPG.autolimit.defaults() : null,
      // エンドレスタワー (§10.7)。best は永続、run は挑戦中だけ入る。
      tower: { best: 0, claimed: 0, run: null },
      // 闘技場の記録 (§17)。migrate 側でも補うが、新規セーブにも最初から置く。
      // 置かないと「新規作成した形」と「読み込んだ形」がずれ、往復が一致しなくなる。
      arena: {},
      // レベル上限の上乗せぶん (§6.5)。闘技場の報酬で伸びる。
      levelCapBonus: 0,
      // 所持している道具 { 道具ID: 個数 }。装備とは別枠で数えるだけのもの。
      items: {},
      // ガチャの天井 (§6.6)。引くたびに貯まり、好きなキャラとの交換に使う。
      gachaPoints: 0,
      // 直前の出撃内容。ワンクリックで同じ場所へ再出撃するために覚えておく
      lastSortie: null,
    };
    // §8.1 主人公のみ最初から所持し、パーティ先頭に固定される。
    // 仲間はガチャで獲得する。初期ゴールドは10連ぶん。
    s.characters.ch_hero = createCharacter('ch_hero');
    s.party = ['ch_hero'];
    return s;
  }

  /**
   * @param {string} id
   */
  function createCharacter(id) {
    return {
      id,
      level: 1,
      exp: 0,
      limitBreak: 0,
      // スキルツリーの投資内容 { ノードID: レベル } (§5)
      tree: {},
      // 戦闘コマンドの並び順 (§4)。空なら定義順。
      skillOrder: [],
      // クラス (§12)。就いていなければ null。klassTree はクラスノードへの投資内容。
      klass: null,
      klassTree: {},
      equipped: { weapon: [], armor: [], accessory: [] },
      // 装備プリセット (§7.5)。空きは null。
      presets: new Array(PRESET_SLOTS).fill(null),
    };
  }

  /**
   * 読めなかったセーブを、消さずに別の場所へ退避する (§16)。
   *
   * ここが無いと、更新でセーブが読めなくなったとき
   * 「新規作成して上書き」で **元のデータが消えてなくなる**。
   * コードを前の版に戻しても、消えた localStorage は戻らない。
   * 巻き戻しでは救えない唯一の壊れ方なので、生の文字列のまま必ず残す。
   *
   * @param {string} raw 読めなかった中身そのまま
   * @param {string} reason
   */
  function rescue(raw, reason) {
    try {
      // 既に退避済みなら上書きしない。
      // 壊れた状態で何度か起動されても、最初の（＝いちばん価値のある）中身を守る。
      if (localStorage.getItem(RESCUE_KEY)) return;
      localStorage.setItem(RESCUE_KEY, JSON.stringify({
        at: new Date().toISOString(), reason, raw,
      }));
    } catch (e) {
      // 容量不足などで退避できないことはある。その場合も進行は止めない。
    }
  }

  /** 退避されたセーブがあるか (§16)。UI が警告を出すのに使う。 */
  function rescued() {
    try {
      const raw = localStorage.getItem(RESCUE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  /** 退避を破棄する。プレイヤーが「もう要らない」と判断したときだけ呼ぶ。 */
  function discardRescued() {
    try {
      localStorage.removeItem(RESCUE_KEY);
    } catch (e) { /* 消せなくても支障はない */ }
  }

  /** localStorage から読み込む。無ければ新規作成。 */
  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    try {
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === SAVE_VERSION) {
          save = migrate(parsed);
          // 移行の結果をその場で書き戻す。
          //
          // ここを省くと、直した内容がメモリ上にしか無い状態になる。
          // 次に何かを保存するまで確定せず、その前に閉じられれば
          // **起動のたびに直しては捨てる** ことになる。
          // 実際、レベル上限の半端な値がいつまでも直らない形で表に出た。
          persist();
          return save;
        }
        // 形は読めたが使えない（版が違うなど）。
        // 上書きする前に必ず退避する。
        rescue(raw, `セーブの版が違う（保存 ${parsed && parsed.version} / 想定 ${SAVE_VERSION}）`);
      }
    } catch (e) {
      console.warn('セーブデータの読み込みに失敗しました。退避して新規作成します。', e);
      if (raw) rescue(raw, '読み込みに失敗: ' + (e && e.message ? e.message : String(e)));
    }
    save = createNewSave();
    persist();
    return save;
  }

  /**
   * 将来バージョンが上がったときの補完場所。
   * 現状は欠けているフィールドを埋めるだけ。
   * @param {any} s
   */
  function migrate(s) {
    if (!s.stats) s.stats = { battles: 0, wins: 0, identified: 0, pulls: 0 };
    if (s.stats.pulls == null) s.stats.pulls = 0;
    if (!s.customNames) s.customNames = {};
    if (s.named == null) s.named = true; // 旧セーブは名前入力済みとして扱う
    if (!s.settings) s.settings = { auto: false, fast: false };
    if (s.lastSortie === undefined) s.lastSortie = null;
    // 旧セーブには charView が無い。欠けているキーだけ既定値で補う。
    s.charView = Object.assign(defaultCharView(), s.charView || {});
    if (!s.quests) s.quests = {};
    if (!s.codex) s.codex = { enemies: {}, fields: {} };
    if (!s.codex.enemies) s.codex.enemies = {};
    if (!s.codex.fields) s.codex.fields = {};
    if (s.dispatch === undefined) s.dispatch = null;
    if (RPG.autolimit) s.autoLimit = Object.assign(RPG.autolimit.defaults(), s.autoLimit || {});
    if (!s.tower) s.tower = { best: 0, claimed: 0, run: null };
    // 闘技場の記録 (§17)。旧セーブには無い。
    if (!s.arena) s.arena = {};
    if (!s.items) s.items = {};
    if (s.gachaPoints == null) s.gachaPoints = 0;

    // レベル上限 (§6.5)。
    //
    // 上限を導入する前のセーブは、上限を超えたレベルのままになっている。
    // レベルを取り上げると、振り済みのSPが宙に浮いてツリーが壊れる。
    // かといって超えたままにすると「自分の上限より上にいる」矛盾が残り、
    // 上限を伸ばしても何も起きない（既に超えているので）。
    //
    // そこで **超過ぶんを、既に稼いだ上限として移し替える**。
    // これで状態の辻褄が合い、そこから先は他の人と同じように
    // 闘技場の報酬で伸ばしていくことになる。
    if (s.levelCapBonus == null) s.levelCapBonus = 0;
    {
      // 伸ばす道具の刻み。上限は必ずこの倍数にする。
      //
      // 超過ぶんをそのまま足すと、Lv151 の人は上限が 151 になり、
      // そこから道具を使うたびに 161・171 と半端な数字が続く。
      // 一度そうなると二度と切りの良い数字へ戻らない。
      const step = (RPG.data.items && RPG.data.items.it_star_shard
        && RPG.data.items.it_star_shard.levelCap) || 10;
      const roundUp = (/** @type {number} */ v) => Math.ceil(v / step) * step;

      let highest = 0;
      for (const id of Object.keys(s.characters || {})) {
        highest = Math.max(highest, s.characters[id].level || 1);
      }
      const over = highest - (RPG.data.maxLevel + s.levelCapBonus);
      if (over > 0) s.levelCapBonus += roundUp(over);

      // 既に半端な値で保存されているセーブも直す。
      // 移行処理を直すだけでは、一度でも起動した人を救えない。
      // 倍数を丸め直すだけなので、何度通しても結果は変わらない。
      if (s.levelCapBonus % step !== 0) s.levelCapBonus = roundUp(s.levelCapBonus);
    }
    if (s.tower.claimed == null) s.tower.claimed = 0;
    if (s.tower.run === undefined) s.tower.run = null;
    // 自動売却ルールは RPG.autosell が既定値を持つ。欠けているキーだけ補う。
    if (RPG.autosell) s.autoSell = Object.assign(RPG.autosell.defaultRules(), s.autoSell || {});
    for (const id of Object.keys(s.characters)) {
      const c = s.characters[id];
      if (!c.tree) c.tree = {};
      if (!Array.isArray(c.skillOrder)) c.skillOrder = [];
      // クラス (§12)。旧セーブは未就任として扱う。
      if (c.klass === undefined) c.klass = null;
      if (!c.klassTree) c.klassTree = {};
      if (!c.equipped) c.equipped = { weapon: [], armor: [], accessory: [] };
      if (!Array.isArray(c.presets)) c.presets = [];
      while (c.presets.length < PRESET_SLOTS) c.presets.push(null);
      delete c.slotBonus; // 旧形式。スロットはスキルツリーから導出するようになった
    }
    return s;
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
    } catch (e) {
      console.warn('セーブに失敗しました', e);
    }
  }

  function reset() {
    save = createNewSave();
    persist();
    return save;
  }

  /** @returns {any} */
  function get() {
    if (!save) load();
    return save;
  }

  /** 名前の最大文字数 */
  const NAME_MAX = 12;

  /**
   * 表示名を返す。主人公はプレイヤーが入力した名前を優先する (§8.1)。
   * データ側の name を直接読まず、必ずこの関数を経由すること。
   * @param {string} charId
   * @returns {string}
   */
  function charName(charId) {
    const def = RPG.data.characters[charId];
    if (!def) return charId;
    // ここでセーブを読み込ませない。未ロード時はデータ側の名前をそのまま返す。
    // （テストやツールから呼ばれたときに、勝手に新規セーブを作って上書きしないため）
    const custom = save && save.customNames ? save.customNames[charId] : null;
    return (custom && custom.trim()) || def.defaultName || def.name;
  }

  /**
   * 主人公の名前を設定する。編集不可のキャラは拒否する。
   * @param {string} charId
   * @param {string} name
   * @returns {{ ok: boolean, name?: string, reason?: string }}
   */
  function setCharName(charId, name) {
    const def = RPG.data.characters[charId];
    if (!def || !def.nameEditable) return { ok: false, reason: 'このキャラクターの名前は変更できません' };

    const trimmed = String(name == null ? '' : name).trim().replace(/\s+/g, ' ');
    if (trimmed.length === 0) return { ok: false, reason: '名前を入力してください' };
    if (trimmed.length > NAME_MAX) return { ok: false, reason: `名前は${NAME_MAX}文字までです` };

    const s = get();
    s.customNames[charId] = trimmed;
    s.named = true;
    persist();
    return { ok: true, name: trimmed };
  }

  /** 次に払い出す一意ID */
  function nextUid() {
    return get().uidCounter++;
  }

  /**
   * @param {number} amount
   */
  function addGold(amount) {
    get().gold = Math.max(0, get().gold + amount);
  }

  /**
   * 宝箱を加算する (§2.2 — 戦闘終了時はこれしかしない)。
   * @param {string} boxId
   * @param {number} count
   */
  function addBox(boxId, count) {
    const boxes = get().boxes;
    boxes[boxId] = (boxes[boxId] || 0) + count;
  }

  /**
   * 宝箱を1つ開封して装備を生成し、インベントリへ入れる (§7.2)。
   * @param {string} boxId
   * @returns {any|null} 生成された装備。宝箱が無ければ null
   */
  function identifyBox(boxId) {
    const s = get();
    if (!s.boxes[boxId] || s.boxes[boxId] <= 0) return null;
    s.boxes[boxId] -= 1;
    if (s.boxes[boxId] === 0) delete s.boxes[boxId];
    const item = RPG.gear.identify(boxId, nextUid());
    s.inventory.push(item);
    s.stats.identified++;
    persist();
    return item;
  }

  /**
   * 宝箱をまとめて鑑定する (§7.9)。
   *
   * 1個ずつ identifyBox() を呼ぶと、**そのたびにセーブ全体をJSON化して**
   * localStorage へ書き込む。所持装備が増えるほど1回が重くなるので、
   * 個数の2乗で効いてくる（実測: 2000個で4.7秒、スマホなら数十秒の停止）。
   *
   * 書き込みは最後の1回だけにする。途中で失敗しても、
   * 書き込んでいない＝箱も装備も減っていない状態に戻るだけなので、
   * 中途半端に消えることはない。
   *
   * @param {string} boxId
   * @param {number} count
   * @returns {any[]} 鑑定した装備
   */
  function identifyBoxes(boxId, count) {
    const s = get();
    /** @type {any[]} */
    const out = [];
    for (let i = 0; i < count; i++) {
      if (!s.boxes[boxId] || s.boxes[boxId] <= 0) break;
      s.boxes[boxId] -= 1;
      if (s.boxes[boxId] === 0) delete s.boxes[boxId];
      const item = RPG.gear.identify(boxId, nextUid());
      s.inventory.push(item);
      s.stats.identified++;
      out.push(item);
    }
    persist();
    return out;
  }

  /**
   * 装備を付け替える。スロットが埋まっている場合は先頭を外す。
   * @param {string} charId
   * @param {number} uid
   */
  function equip(charId, uid) {
    const s = get();
    const item = s.inventory.find((/** @type {any} */ it) => it.uid === uid);
    if (!item) return;

    // 他のキャラが装備していたら剥がす（装備は1つを1人だけ）
    for (const id of Object.keys(s.characters)) {
      const c = s.characters[id];
      for (const slot of Object.keys(c.equipped)) {
        c.equipped[slot] = c.equipped[slot].filter((/** @type {number} */ u) => u !== uid);
      }
    }

    const target = s.characters[charId];
    const max = RPG.units.slotCounts(target)[item.slot];
    const list = target.equipped[item.slot];
    list.push(uid);
    while (list.length > max) list.shift();
    persist();
  }

  /**
   * 装備構成を丸ごと差し替える（自動装備用）。
   * 割り当てた装備が他のキャラに着いていたら、そちらからは外す。
   * @param {string} charId
   * @param {Record<string, number[]>} equipped
   */
  function setLoadout(charId, equipped) {
    const s = get();
    const target = s.characters[charId];
    if (!target) return;

    /** @type {Set<number>} */
    const claimed = new Set();
    for (const slot of Object.keys(equipped)) for (const uid of equipped[slot]) claimed.add(uid);

    for (const id of Object.keys(s.characters)) {
      if (id === charId) continue;
      const c = s.characters[id];
      for (const slot of Object.keys(c.equipped)) {
        c.equipped[slot] = c.equipped[slot].filter((/** @type {number} */ u) => !claimed.has(u));
      }
    }

    const slots = RPG.units.slotCounts(target);
    for (const slot of Object.keys(target.equipped)) {
      target.equipped[slot] = (equipped[slot] || []).slice(0, slots[slot]);
    }
    persist();
  }

  /* ---------------- 装備プリセット (§7.5) ---------------- */

  /** キャラ1人あたりのプリセット枠 */
  const PRESET_SLOTS = 3;

  /**
   * そのキャラのプリセット一覧。常に PRESET_SLOTS 個の配列を返す（空きは null）。
   * @param {string} charId
   * @returns {Array<{name: string, equipped: Record<string, number[]>}|null>}
   */
  function presets(charId) {
    const c = get().characters[charId];
    if (!c) return new Array(PRESET_SLOTS).fill(null);
    if (!Array.isArray(c.presets)) c.presets = [];
    while (c.presets.length < PRESET_SLOTS) c.presets.push(null);
    return c.presets;
  }

  /**
   * 今の装備をプリセットに保存する。
   * @param {string} charId
   * @param {number} index
   * @param {string} [name]
   */
  function savePreset(charId, index, name) {
    const c = get().characters[charId];
    if (!c || index < 0 || index >= PRESET_SLOTS) return null;
    const list = presets(charId);
    /** @type {Record<string, number[]>} */
    const equipped = {};
    for (const slot of Object.keys(c.equipped)) equipped[slot] = c.equipped[slot].slice();
    list[index] = { name: (name || `構成${index + 1}`).slice(0, NAME_MAX), equipped };
    persist();
    return list[index];
  }

  /**
   * プリセットを適用する。
   *
   * 売却済みの装備は自動的に外して数を報告する。他のキャラが着けている装備は
   * setLoadout がそちらから剥がす（装備は1つを1人だけ、という原則は崩さない）。
   *
   * @param {string} charId
   * @param {number} index
   * @returns {{ok: boolean, applied?: number, missing?: number, stolen?: string[], reason?: string}}
   */
  function applyPreset(charId, index) {
    const s = get();
    const preset = presets(charId)[index];
    if (!preset) return { ok: false, reason: 'このプリセットは空です' };

    const owned = new Set(s.inventory.map((/** @type {any} */ it) => it.uid));

    /** @type {Record<string, number[]>} */
    const equipped = {};
    let applied = 0;
    let missing = 0;
    for (const slot of Object.keys(preset.equipped)) {
      equipped[slot] = preset.equipped[slot].filter((/** @type {number} */ uid) => {
        if (owned.has(uid)) { applied++; return true; }
        missing++;
        return false;
      });
    }

    // 他のキャラから取り上げることになる相手を先に控えておく（結果表示に使う）
    /** @type {string[]} */
    const stolen = [];
    const claimed = new Set();
    for (const slot of Object.keys(equipped)) for (const uid of equipped[slot]) claimed.add(uid);
    for (const id of Object.keys(s.characters)) {
      if (id === charId) continue;
      const c = s.characters[id];
      const taken = Object.keys(c.equipped)
        .some((slot) => c.equipped[slot].some((/** @type {number} */ u) => claimed.has(u)));
      if (taken) stolen.push(charName(id));
    }

    setLoadout(charId, equipped);
    return { ok: true, applied, missing, stolen };
  }

  /**
   * @param {string} charId
   * @param {number} index
   */
  function deletePreset(charId, index) {
    const list = presets(charId);
    if (index < 0 || index >= list.length) return;
    list[index] = null;
    persist();
  }

  /**
   * @param {string} charId
   * @param {number} uid
   */
  function unequip(charId, uid) {
    const c = get().characters[charId];
    for (const slot of Object.keys(c.equipped)) {
      c.equipped[slot] = c.equipped[slot].filter((/** @type {number} */ u) => u !== uid);
    }
    persist();
  }

  /**
   * 装備を売却してゴールドに換える。
   * @param {number} uid
   * @returns {number} 得たゴールド
   */
  function sell(uid) {
    const s = get();
    const idx = s.inventory.findIndex((/** @type {any} */ it) => it.uid === uid);
    if (idx < 0) return 0;
    const item = s.inventory[idx];
    for (const id of Object.keys(s.characters)) unequip(id, uid);
    s.inventory.splice(idx, 1);
    const gold = sellValue(item);
    addGold(gold);
    persist();
    return gold;
  }

  /**
   * その装備が誰かに装備されているか。
   * @param {number} uid
   */
  function isEquipped(uid) {
    const s = get();
    for (const id of Object.keys(s.characters)) {
      const c = s.characters[id];
      for (const slot of Object.keys(c.equipped)) {
        if (c.equipped[slot].includes(uid)) return true;
      }
    }
    return false;
  }

  /**
   * 装備のロックを切り替える。ロック中は一括売却の対象から外れる。
   * @param {number} uid
   * @returns {boolean} 切り替え後の状態
   */
  function toggleLock(uid) {
    const item = get().inventory.find((/** @type {any} */ it) => it.uid === uid);
    if (!item) return false;
    item.locked = !item.locked;
    persist();
    return !!item.locked;
  }

  /**
   * 売却したときに得られるゴールド。
   * @param {any} item
   */
  function sellValue(item) {
    return Math.max(10, Math.floor(RPG.gear.score(item) * 1.2));
  }

  /**
   * まとめて売却する。装備中・ロック中のものは自動的に除外される。
   * @param {number[]} uids
   * @returns {{ count: number, gold: number, skipped: number }}
   */
  function sellMany(uids) {
    const s = get();
    let gold = 0;
    let count = 0;
    let skipped = 0;

    const target = new Set(uids);
    const keep = [];
    for (const item of s.inventory) {
      if (!target.has(item.uid)) { keep.push(item); continue; }
      if (item.locked || isEquipped(item.uid)) { keep.push(item); skipped++; continue; }
      gold += sellValue(item);
      count++;
    }

    s.inventory = keep;
    if (count > 0) {
      addGold(gold);
      persist();
    }
    return { count, gold, skipped };
  }

  /**
   * 直前の出撃内容を覚える。
   * @param {{fieldId: string, waves: number, bossFinale: boolean}} sortie
   */
  function rememberSortie(sortie) {
    get().lastSortie = sortie;
    persist();
  }

  /**
   * 周回設定を更新する。
   * @param {Partial<{auto: boolean, fast: boolean}>} patch
   */
  function updateSettings(patch) {
    Object.assign(get().settings, patch);
    persist();
    return get().settings;
  }

  /** キャラクターリストの表示設定。 */
  function charView() {
    const s = get();
    if (!s.charView) s.charView = defaultCharView();
    return s.charView;
  }

  /**
   * キャラクターリストの表示設定を更新する。
   * @param {Partial<{pinParty: boolean, sort: string, element: string|null, query: string}>} patch
   */
  function updateCharView(patch) {
    Object.assign(charView(), patch);
    persist();
    return charView();
  }

  /**
   * 経験値を与え、必要ならレベルアップさせる。
   * @param {string} charId
   * @param {number} amount
   * @returns {number} 上がったレベル数
   */
  function addExp(charId, amount) {
    const c = get().characters[charId];
    const cap = levelCap();

    // 上限に達したら経験値そのものを受け取らない。
    // 貯めさせても使い道が無く、増え続ける数字は「まだ伸びる」と誤解させる。
    if (c.level >= cap) { c.exp = 0; return 0; }

    c.exp += amount;
    let gained = 0;
    while (c.level < cap && c.exp >= RPG.units.expToNext(c.level)) {
      c.exp -= RPG.units.expToNext(c.level);
      c.level++;
      gained++;
    }
    if (c.level >= cap) c.exp = 0;
    return gained;
  }

  /**
   * 現在のレベル上限 (§6.5)。
   *
   * ── なぜセーブ側に持たせるのか ──
   * 上限を固定値にすると、**それは壁でしかない**。到達した時点で
   * 育成の目標が装備だけになり、そこから先に進む理由が消える。
   *
   * 闘技場の報酬で伸ばせるようにしたことで、上限そのものが到達目標になる。
   * 「上限に達した → 闘技場へ挑む → また伸びる」という往復が生まれる。
   *
   * 併せて、上限を導入する前のセーブ（既に上限を超えているもの）も
   * 矛盾なく扱えるようになった。migrate 側で、超過ぶんを
   * 「既に稼いだ上限」として levelCapBonus に移し替えている。
   */
  function levelCap() {
    const raw = RPG.data.maxLevel + (get().levelCapBonus || 0);
    // 255 で必ず止まる。外せない線なので、貯めた欠片の数に関わらず超えない。
    return Math.min(RPG.data.maxLevelCap || Infinity, raw);
  }

  /**
   * 戦闘コマンドの並び順を1つ動かす (§4)。
   *
   * 保存するのは順番だけ。習得していない技が混ざっても、覚えた技が
   * 増えても壊れないよう、組み立て側（units.js）で突き合わせている。
   *
   * @param {string} charId @param {string} skillId @param {number} dir -1 で上、+1 で下
   */
  function moveSkill(charId, skillId, dir) {
    const c = get().characters[charId];
    if (!c) return { ok: false, reason: '不明なキャラクター' };

    // いま画面に出ている並びを起点にする。保存が空でも動かせるように。
    const unit = RPG.units.buildCharacterUnit(c, get().inventory);
    const list = unit.skills.slice();
    const i = list.indexOf(skillId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return { ok: false, reason: 'これ以上動かせない' };

    list[i] = list[j];
    list[j] = skillId;
    c.skillOrder = list;
    persist();
    return { ok: true, order: list };
  }

  /**
   * 道具の所持数。
   * @param {string} itemId
   */
  function itemCount(itemId) {
    return (get().items || {})[itemId] || 0;
  }

  /**
   * 道具を増やす。
   * @param {string} itemId @param {number} count
   */
  function addItem(itemId, count) {
    const s = get();
    if (!s.items) s.items = {};
    s.items[itemId] = (s.items[itemId] || 0) + count;
    persist();
    return s.items[itemId];
  }

  /**
   * 道具を使う。効果は data/items 側の定義から引く。
   *
   * まとめて使えるようにしてあるのは、闘技場を周回すると
   * 一度に何個も溜まるため。1個ずつ押させる意味がない。
   *
   * @param {string} itemId @param {number} [count]
   * @returns {{ok: boolean, reason?: string, used?: number, levelCap?: number}}
   */
  function useItem(itemId, count) {
    const def = RPG.data.items[itemId];
    if (!def) return { ok: false, reason: '不明な道具' };
    const have = itemCount(itemId);
    const n = Math.max(1, Math.min(count == null ? 1 : count, have));
    if (have < n) return { ok: false, reason: '足りない' };

    const s = get();
    // 天井に着いていたら、飲ませずに断る。
    // 消費してから効かないと、取り返しのつかない無駄になる。
    if (def.levelCap && levelCap() >= (RPG.data.maxLevelCap || Infinity)) {
      return { ok: false, reason: `レベル上限は Lv${RPG.data.maxLevelCap} が限界`, levelCap: levelCap() };
    }
    if (def.levelCap) s.levelCapBonus = (s.levelCapBonus || 0) + def.levelCap * n;
    s.items[itemId] = have - n;
    persist();
    return { ok: true, used: n, levelCap: levelCap() };
  }

  /**
   * 上限に達しているか。表示側が「MAX」を出すのに使う。
   * @param {string} charId
   */
  function atMaxLevel(charId) {
    const c = get().characters[charId];
    return !!c && c.level >= levelCap();
  }

  /**
   * 合計SP (§6.5)。セーブに残さず常にこの式で復元する。
   * @param {string} charId
   */
  function totalSp(charId) {
    const c = get().characters[charId];
    return (c.level - 1) + c.limitBreak;
  }

  /**
   * 未使用のSP。合計SPからスキルツリーの消費分を引く。
   * @param {string} charId
   */
  function availableSp(charId) {
    const c = get().characters[charId];
    return totalSp(charId) - RPG.tree.spentSp(c.tree || {});
  }

  /**
   * スキルツリーのノードに1レベル投資する (§5)。
   * @param {string} charId
   * @param {string} nodeId
   * @returns {{ ok: boolean, reason?: string }}
   */
  function investNode(charId, nodeId) {
    const c = get().characters[charId];
    const check = RPG.tree.canInvest(c, nodeId);
    if (!check.ok) return check;
    c.tree[nodeId] = (c.tree[nodeId] || 0) + 1;
    persist();
    return { ok: true };
  }

  /**
   * ノードから1レベルだけ戻す (§5.5)。
   *
   * ── なぜ全体リセットだけでは足りないか ──
   * 終盤は250点近いSPを1点ずつ振ることになる。1か所を試したいだけでも
   * 全部が消えるので、**振り直すより我慢するほうが楽**という状態になっていた。
   * それでは組み替えて遊ぶ余地が無い。
   *
   * 全体リセットは残してある。まとめてやり直すならそちらが安く、
   * ここは「1か所だけ差し替える」ための割高な手段という関係になる。
   *
   * @param {string} charId
   * @param {string} nodeId
   * @returns {{ ok: boolean, cost?: number, reason?: string }}
   */
  function refundNode(charId, nodeId) {
    const s = get();
    const c = s.characters[charId];
    if (!c) return { ok: false, reason: '不明なキャラクター' };

    const check = RPG.tree.canRefund(c, nodeId);
    if (!check.ok) return check;

    const cost = check.cost || 0;
    if (s.gold < cost) {
      return { ok: false, reason: `ゴールドが${(cost - s.gold).toLocaleString()}足りない` };
    }

    s.gold -= cost;
    const left = (c.tree[nodeId] || 0) - 1;
    if (left <= 0) delete c.tree[nodeId];
    else c.tree[nodeId] = left;

    afterTreeShrink(c);
    persist();
    return { ok: true, cost };
  }

  /**
   * ツリーが縮んだ後の後始末 (§5.5)。
   *
   * 投資を戻すと、それに紐づいていたものが宙に浮く。
   *   ・装備スロットが減る  → はみ出した装備が装備欄に残ったままになる
   *   ・習得技が消える      → 並び順の指定だけが残る
   * 全体リセットは前者しか見ていなかったが、1レベルずつ戻せるようになると
   * 後者も日常的に起きるので、まとめてここで処理する。
   *
   * @param {any} c キャラクターのセーブ
   */
  function afterTreeShrink(c) {
    // スロットが減ったぶん、はみ出した装備を外す
    const slots = RPG.units.slotCounts(c);
    for (const slot of Object.keys(c.equipped)) {
      c.equipped[slot] = c.equipped[slot].slice(0, slots[slot]);
    }

    // 覚えていない技が並び順に残っていても表示は壊れないが、
    // 溜まり続けると「戻したはずの技」が並び替え画面に出てくる。
    if (c.skillOrder && c.skillOrder.length) {
      const owned = new Set(RPG.tree.effects(c.tree).skills || []);
      const def = RPG.data.characters[c.id] || {};
      for (const id of (def.unique_skills || []).concat(def.common_skills || [])) owned.add(id);
      for (const id of (RPG.klass.effects(c) || { skills: [] }).skills || []) owned.add(id);
      c.skillOrder = c.skillOrder.filter((/** @type {string} */ id) => owned.has(id));
    }
  }

  /**
   * スキルの振り直し (§5.5)。レベルに比例したゴールドを消費する。
   * スロット拡張が失われる場合は、はみ出した装備を自動的に外す。
   * @param {string} charId
   * @returns {{ ok: boolean, cost?: number, reason?: string }}
   */
  function resetTree(charId) {
    const s = get();
    const c = s.characters[charId];
    const cost = RPG.tree.resetCost(c.level);
    if (s.gold < cost) return { ok: false, reason: `ゴールドが${(cost - s.gold).toLocaleString()}足りない` };

    s.gold -= cost;
    c.tree = {};

    // スロットの調整と、消えた技の並び順の掃除は1レベル戻しと共通
    afterTreeShrink(c);

    persist();
    return { ok: true, cost };
  }

  /* ---------------- クラス (§12) ---------------- */

  /**
   * クラスに就く。
   *
   * 初回は無料。既に別のクラスに就いている場合は転職費用がかかり、
   * それまで振ったクラスポイントは全て戻る（＝振り直しも兼ねる）。
   *
   * @param {string} charId
   * @param {string} classId
   * @returns {{ ok: boolean, cost?: number, reason?: string }}
   */
  function setClass(charId, classId) {
    const s = get();
    const c = s.characters[charId];
    if (!RPG.data.classes[classId]) return { ok: false, reason: '不明なクラス' };
    if (c.klass === classId) return { ok: false, reason: '既にそのクラスに就いている' };

    // 未就任からの就任は無料。ここで金を取ると、そもそも触ってもらえない。
    const cost = c.klass ? (RPG.data.classChangeCost || 0) : 0;
    if (s.gold < cost) {
      return { ok: false, reason: `ゴールドが${(cost - s.gold).toLocaleString()}足りない` };
    }

    s.gold -= cost;
    c.klass = classId;
    c.klassTree = {};
    persist();
    return { ok: true, cost };
  }

  /**
   * クラスノードに1ポイント投資する。
   * @param {string} charId
   * @param {string} nodeId
   */
  function investClassNode(charId, nodeId) {
    const c = get().characters[charId];
    const check = RPG.klass.canInvest(c, nodeId);
    if (!check.ok) return check;
    c.klassTree[nodeId] = (c.klassTree[nodeId] || 0) + 1;
    persist();
    return { ok: true };
  }

  /**
   * クラスノードから1レベルだけ戻す (§12)。
   * ツリー側 (refundNode) と対になっている。
   *
   * @param {string} charId
   * @param {string} nodeId
   * @returns {{ ok: boolean, cost?: number, reason?: string }}
   */
  function refundClassNode(charId, nodeId) {
    const s = get();
    const c = s.characters[charId];
    if (!c) return { ok: false, reason: '不明なキャラクター' };

    const check = RPG.klass.canRefund(c, nodeId);
    if (!check.ok) return check;

    const cost = check.cost || 0;
    if (s.gold < cost) {
      return { ok: false, reason: `ゴールドが${(cost - s.gold).toLocaleString()}足りない` };
    }

    s.gold -= cost;
    const left = (c.klassTree[nodeId] || 0) - 1;
    if (left <= 0) delete c.klassTree[nodeId];
    else c.klassTree[nodeId] = left;

    // クラス技を戻したときも並び順を掃除する
    afterTreeShrink(c);
    persist();
    return { ok: true, cost };
  }

  /**
   * クラスポイントだけを振り直す（クラスは変えない）。
   * 転職と同じ費用にすると「別クラスに移るほうが得」になってしまうので、半額にしてある。
   * @param {string} charId
   */
  function resetClassTree(charId) {
    const s = get();
    const c = s.characters[charId];
    if (!c.klass) return { ok: false, reason: 'クラスに就いていない' };

    const cost = Math.floor((RPG.data.classChangeCost || 0) / 2);
    if (s.gold < cost) {
      return { ok: false, reason: `ゴールドが${(cost - s.gold).toLocaleString()}足りない` };
    }
    s.gold -= cost;
    c.klassTree = {};
    afterTreeShrink(c);
    persist();
    return { ok: true, cost };
  }

  /**
   * 空きがあればパーティに加える。ガチャの新規獲得時に呼ぶ。
   * @param {string} charId
   * @returns {boolean} 加わったか
   */
  function tryJoinParty(charId) {
    const s = get();
    if (s.party.length >= 4 || s.party.includes(charId)) return false;
    s.party.push(charId);
    persist();
    return true;
  }

  /** 現在のパーティを戦闘用ユニット配列に変換する。 */
  function partyUnits() {
    const s = get();
    return s.party
      .filter((/** @type {string} */ id) => !!s.characters[id])
      .map((/** @type {string} */ id) => RPG.units.buildCharacterUnit(s.characters[id], s.inventory));
  }

  /**
   * パーティの編成を差し替える。
   *
   * 主人公は「外せない」が「先頭固定ではない」。
   * 行動順はそのまま戦術（バフを先に置く、範囲攻撃を先に撃つ）になるので、
   * 並び順はプレイヤーが決められるべきという判断で §8.1 から緩めている。
   * 主人公が指定に含まれていなければ先頭に補う。
   *
   * @param {string[]} ids
   */
  function setParty(ids) {
    const s = get();
    /** @type {string[]} */
    const next = [];
    for (const id of ids) {
      if (next.includes(id)) continue;
      if (!s.characters[id]) continue;
      next.push(id);
    }
    if (!next.includes('ch_hero')) next.unshift('ch_hero');
    s.party = next.slice(0, 4);
    persist();
  }

  /**
   * 行動順を1つ入れ替える。
   * @param {number} index
   * @param {number} delta -1 で前へ、+1 で後ろへ
   * @returns {boolean} 動いたか
   */
  function moveParty(index, delta) {
    const s = get();
    const to = index + delta;
    if (index < 0 || index >= s.party.length) return false;
    if (to < 0 || to >= s.party.length) return false;
    const next = s.party.slice();
    const tmp = next[index];
    next[index] = next[to];
    next[to] = tmp;
    s.party = next;
    persist();
    return true;
  }

  /**
   * 外部から読み込んだセーブデータで丸ごと差し替える。
   * 検証は呼び出し側（RPG.savefile）の責任。ここは受け取った内容を整えて保存するだけ。
   * @param {any} next
   */
  function replaceSave(next) {
    save = migrate(next);
    persist();
    return save;
  }

  RPG.state = {
    load, persist, reset, get, nextUid, replaceSave, migrate,
    rescued, discardRescued, RESCUE_KEY,
    SAVE_VERSION,
    addGold, addBox, identifyBox, identifyBoxes, equip, unequip, setLoadout, sell,
    sellMany, sellValue, toggleLock, isEquipped, rememberSortie, updateSettings,
    charView, updateCharView, defaultCharView,
    presets, savePreset, applyPreset, deletePreset, PRESET_SLOTS,
    addExp, levelCap, moveSkill, itemCount, addItem, useItem, atMaxLevel, totalSp, availableSp, partyUnits, setParty, moveParty, createCharacter,
    investNode, refundNode, resetTree, tryJoinParty,
    setClass, investClassNode, refundClassNode, resetClassTree,
    charName, setCharName, NAME_MAX,
    STORAGE_KEY,
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
