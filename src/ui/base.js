// @ts-check
/**
 * 拠点画面 (§2.1)。
 * 出撃 / 宝箱鑑定 / 装備 / パーティ編成 をタブで切り替える。
 */
(function (RPG) {
  'use strict';
  const { h, replace } = RPG.dom;
  const W = RPG.widgets;

  /** @type {string} */
  let activeTab = 'sortie';
  /** @type {string} */
  let selectedChar = 'ch_hero';
  /** @type {any[]} 直近の鑑定結果 */
  /**
   * 鑑定結果として一度に並べるカードの上限 (§7.9)。
   * 1枚あたり約29個のDOM要素になるので、ここを外すとスマホが落ちる。
   */
  const IDENTIFY_SHOW_MAX = 60;

  /** 所持装備の一覧に一度に並べる上限 (§7.9)。理由は上と同じ。 */
  const INVENTORY_SHOW_MAX = 120;

  let lastIdentified = [];
  /** @type {{count: number, gold: number, protectedCount: number}|null} 直近の自動売却の結果 */
  let lastAutoSold = null;
  /** @type {string|null} */
  let selectedField = null;
  /** 演出が終わって結果をめくってよいか (§6.7) */
  let pullRevealed = true;
  /** @type {any[]} 直近のガチャ結果 */
  let lastPulls = [];
  /** @type {any} 直近の派遣の受け取り結果 */
  let lastDispatch = null;
  /** 派遣の残り時間を書き換えるタイマー */
  let dispatchTimer = 0;
  /** @type {number|null} 鍛冶で選んでいる装備 */
  let forgeTarget = null;

  /** 図鑑の表示状態 */
  const codexView = {
    section: 'enemy',
    selected: /** @type {string|null} */ (null),
    showUnknown: true,
    /** 関連語を押して移動したか。次の描画でその項目まで画面を送る */
    scrollToTerm: false,
  };

  /** インベントリの並べ替えと絞り込み */
  const gearView = {
    sort: 'power',
    slot: /** @type {string|null} */ (null),
    tag: /** @type {string|null} */ (null),
    rarity: /** @type {string|null} */ (null),
    // 装備セット (§7.7)。'none' は「セットに属していないもの」
    set: /** @type {string|null} */ (null),
    onlyUnequipped: false,
  };

  /** 装備の並べ替え。中身は src/core/gear.js が持つ (§7.4) */
  const SORTS = RPG.gear.SORTS;

  /** キャラクターリストの並べ替え。装備タブとビルドタブで共用する。 */
  const CHAR_SORTS = [
    { id: 'level', label: 'レベル順' },
    { id: 'rarity', label: 'レア度順' },
    { id: 'element', label: '属性順' },
    { id: 'name', label: '名前順' },
    { id: 'get', label: '取得順' },
  ];

  const RARITY_ORDER = ['COMMON', 'RARE', 'SUPER_RARE', 'LEGEND'];
  const SLOT_ORDER = ['weapon', 'armor', 'accessory'];
  const ELEMENT_ORDER = ['none', 'fire', 'water', 'wind', 'earth', 'light', 'dark'];

  // アイコンは assets/ui/ のCC0素材。OSごとに絵柄が変わる絵文字を置き換えている。
  /**
   * 画面の一覧。
   *
   * primary を付けた4つだけを下部に常設し、残りは「その他」の引き出しに入れる。
   *
   * ── なぜ絞るのか ──
   * 11個を横に並べると、スマートフォンでは3段に折り返す。
   * 段が増えるぶん本文が押し下げられ、しかも指はいちばん下にあるのに
   * タブはいちばん上にある。周回のたびに画面の端から端へ指を往復させていた。
   *
   * ── 何を常設にするか ──
   * 中核の周回が「出撃 → 鑑定 → 装備」なので、この3つは必ず要る。
   * ビルドはレベルが上がるたびに開くので4つ目に入れた。
   * 残り（クエスト・塔・闘技場・ガチャ・鍛冶・編成・図鑑）は
   * 開く頻度が明らかに低く、1手増えても支障がない。
   */
  const TABS = [
    { id: 'sortie', label: '出撃', icon: 'tab-sortie', primary: true },
    { id: 'identify', label: '鑑定', icon: 'tab-identify', primary: true },
    { id: 'gear', label: '装備', icon: 'tab-gear', primary: true },
    { id: 'build', label: 'ビルド', icon: 'tab-build', primary: true },
    { id: 'quest', label: 'クエスト', icon: 'tab-sortie' },
    { id: 'tower', label: '塔', icon: 'tab-sortie' },
    { id: 'arena', label: '闘技場', icon: 'tab-sortie' },
    { id: 'gacha', label: 'ガチャ', icon: 'tab-gacha' },
    { id: 'forge', label: '鍛冶', icon: 'tab-gear' },
    { id: 'party', label: '編成', icon: 'tab-party' },
    { id: 'codex', label: '図鑑', icon: 'tab-identify' },
  ];

  /** 「その他」の引き出しが開いているか */
  let drawerOpen = false;

  /** @param {HTMLElement} root */
  function render(root) {
    applyBackdrop();

    /** @param {any} t */
    const go = (t) => { activeTab = t.id; drawerOpen = false; render(root); };
    const primary = TABS.filter((t) => t.primary);
    const rest = TABS.filter((t) => !t.primary);
    const inDrawer = rest.some((t) => t.id === activeTab);

    replace(root,
      h('div.base-body', renderTab(root)),

      // 引き出し。開いているときだけ組み立てる
      drawerOpen
        ? h('div.tab-sheet', { onClick: () => { drawerOpen = false; render(root); } },
            h('div.tab-sheet-panel', {
              onClick: (/** @type {Event} */ e) => e.stopPropagation(),
            },
              h('div.tab-sheet-grip'),
              h('div.tab-sheet-grid', rest.map((t) =>
                h('button.tab-sheet-item' + (activeTab === t.id ? '.is-active' : ''), {
                  onClick: () => go(t),
                  'aria-current': activeTab === t.id ? 'page' : null,
                },
                  W.icon(t.icon, { size: '20px' }),
                  h('span', { text: t.label })
                )
              ))
            )
          )
        : null,

      h('nav.tab-rail', { 'aria-label': '画面の切り替え' },
        primary.map((t) =>
          h('button.tab-rail-btn' + (activeTab === t.id ? '.is-active' : ''), {
            onClick: () => go(t),
            'aria-current': activeTab === t.id ? 'page' : null,
          },
            W.icon(t.icon, { size: '19px' }),
            h('span', { text: t.label })
          )
        ).concat([
          h('button.tab-rail-btn' + (inDrawer || drawerOpen ? '.is-active' : ''), {
            onClick: () => { drawerOpen = !drawerOpen; render(root); },
            'aria-expanded': drawerOpen ? 'true' : 'false',
          },
            W.icon('tab-party', { size: '19px' }),
            h('span', { text: inDrawer ? (TABS.find((t) => t.id === activeTab) || {}).label : 'メニュー' })
          ),
        ])
      )
    );
  }

  /**
   * 画面の背景を敷く (§1.3)。
   *
   * 出撃と戦闘は「いま選んでいるフィールド」の絵を映す。
   * それ以外の画面は screen-<タブID>.webp を探す。
   * どちらも無ければ何も敷かない（それでも画面は成立する）。
   *
   * 絵の上には必ず膜をかぶせる。生成した絵は明るさがばらつくので、
   * 膜が無いと画像しだいで文字が読めなくなる。実測で、いちばん明るい絵でも
   * 膜を通せば文字とのコントラストが 6.0:1 まで確保できている。
   */
  function backdropKeys() {
    const save = RPG.state.get();
    /** @type {string[]} */
    const keys = [];
    if (activeTab === 'sortie') {
      // 直前に出撃した場所を映す。まだ出撃していない人には、
      // 到達しているいちばん奥のフィールドを見せる。
      // ここが最初に目にする画面なので、**必ず何かが映る** ようにしておく。
      if (save.lastSortie && save.lastSortie.fieldId) keys.push(save.lastSortie.fieldId);
      const reached = Object.keys(RPG.data.fields);
      for (let i = reached.length - 1; i >= 0; i--) keys.push(reached[i]);
    }
    keys.push('screen-' + activeTab);
    return keys;
  }

  /**
   * 候補を順に試して、最初に見つかった絵を敷く。
   * @param {string[]} keys @returns {Promise<string|null>}
   */
  function firstBackdrop(keys) {
    return keys.reduce(
      (/** @type {Promise<string|null>} */ chain, key) =>
        chain.then((found) => (found ? found : RPG.artSource.backdrop(key))),
      Promise.resolve(/** @type {string|null} */ (null))
    );
  }

  function applyBackdrop() {
    const keys = backdropKeys();
    const stamp = keys.join('|');
    const host = document.getElementById('app') || document.body;

    // 絵を置く器。負の z-index に頼らず、実体のある要素として body の直下に置く。
    // PCでは見えるのに Android Chrome では見えない、という報告があり、
    // 重なり順の解釈に頼った書き方をやめた。
    let layer = document.getElementById('backdrop');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'backdrop';
      layer.setAttribute('aria-hidden', 'true');
      document.body.insertBefore(layer, document.body.firstChild);
    }

    firstBackdrop(keys).then((src) => {
      // 解決を待っている間に画面が変わっていたら、もう反映しない
      if (backdropKeys().join('|') !== stamp) return;
      const on = !!src;
      layer.style.setProperty('--backdrop', on ? `url('${src}')` : 'none');
      // 器・本体・body の3つに同じ印を付ける。
      // body は地色を外すため、#app はパネルを透かすため。
      layer.style.display = on ? 'block' : 'none';
      host.classList.toggle('has-backdrop', on);
      document.body.classList.toggle('has-backdrop', on);
    });
  }

  /** @param {HTMLElement} root */
  function renderTab(root) {
    switch (activeTab) {
      case 'quest': return renderQuest(root);
      case 'tower': return renderTower(root);
      case 'arena': return renderArena(root);
      case 'codex': return renderCodex(root);
      case 'gacha': return renderGacha(root);
      case 'identify': return renderIdentify(root);
      case 'gear': return renderGear(root);
      case 'forge': return renderForge(root);
      case 'build': return renderBuild(root);
      case 'party': return renderParty(root);
      default: return renderSortie(root);
    }
  }

  /**
   * 表示するキャラクターIDを、絞り込みと並べ替えを適用して返す。
   *
   * 編成中を先頭に固めるのが既定。キャラが増えると「今使っている4人」を探すのが
   * 一番多い操作になるため。
   * @returns {string[]}
   */
  function visibleChars() {
    const save = RPG.state.get();
    const view = RPG.state.charView();
    const query = (view.query || '').trim().toLowerCase();

    let ids = Object.keys(save.characters).filter((id) => !!RPG.data.characters[id]);

    if (view.element) ids = ids.filter((id) => RPG.data.characters[id].element === view.element);
    if (query) {
      ids = ids.filter((id) => RPG.state.charName(id).toLowerCase().includes(query));
    }

    const order = Object.keys(save.characters);
    const cmp = {
      /** @param {string} a @param {string} b */
      level: (a, b) => save.characters[b].level - save.characters[a].level,
      /** @param {string} a @param {string} b */
      rarity: (a, b) => RARITY_ORDER.indexOf(RPG.data.characters[b].rarity) -
                        RARITY_ORDER.indexOf(RPG.data.characters[a].rarity),
      /** @param {string} a @param {string} b */
      element: (a, b) => ELEMENT_ORDER.indexOf(RPG.data.characters[a].element) -
                         ELEMENT_ORDER.indexOf(RPG.data.characters[b].element),
      /** @param {string} a @param {string} b */
      name: (a, b) => RPG.state.charName(a).localeCompare(RPG.state.charName(b), 'ja'),
      /** @param {string} a @param {string} b */
      get: (a, b) => order.indexOf(a) - order.indexOf(b),
    }[view.sort] || ((/** @type {string} */ a, /** @type {string} */ b) => order.indexOf(a) - order.indexOf(b));

    ids.sort((a, b) => {
      if (view.pinParty) {
        const pa = save.party.indexOf(a);
        const pb = save.party.indexOf(b);
        // 編成中どうしは編成順、片方だけ編成中ならそちらが上
        if (pa >= 0 && pb >= 0) return pa - pb;
        if (pa >= 0) return -1;
        if (pb >= 0) return 1;
      }
      // 並べ替えが同着なら取得順で安定させる
      return cmp(a, b) || order.indexOf(a) - order.indexOf(b);
    });
    return ids;
  }

  /**
   * キャラクター選択の縦リスト。装備タブとビルドタブで共用する。
   *
   * 検索欄だけは作り直さない。入力のたびに要素を作り直すとフォーカスが飛んで
   * 1文字しか打てなくなるため、外側の枠は使い回して中身だけ差し替える。
   * @param {HTMLElement} root
   */
  function charSelector(root) {
    const view = RPG.state.charView();
    const pillBox = h('div.char-tools');
    const listBox = h('div.char-list');

    const search = h('input.char-search', {
      type: 'search',
      placeholder: '名前で検索',
      value: view.query || '',
      onInput: (/** @type {any} */ e) => {
        RPG.state.updateCharView({ query: e.target.value });
        paintList();
      },
    });

    /** @param {string} label @param {boolean} active @param {() => void} onClick */
    const pill = (label, active, onClick) =>
      h('button.pill' + (active ? '.is-on' : ''), { onClick, text: label });

    function paintPills() {
      const v = RPG.state.charView();
      replace(pillBox,
        h('div.toolbar-row',
          pill('編成を上に', v.pinParty, () => {
            RPG.state.updateCharView({ pinParty: !v.pinParty });
            paintAll();
          }),
          ...CHAR_SORTS.map((s) => pill(s.label, v.sort === s.id, () => {
            RPG.state.updateCharView({ sort: s.id });
            paintAll();
          }))
        ),
        h('div.toolbar-row',
          pill('全属性', !v.element, () => {
            RPG.state.updateCharView({ element: null });
            paintAll();
          }),
          ...ELEMENT_ORDER.map((el) => pill(RPG.damage.ELEMENT_LABEL[el], v.element === el, () => {
            RPG.state.updateCharView({ element: v.element === el ? null : el });
            paintAll();
          }))
        )
      );
    }

    function paintList() {
      const save = RPG.state.get();
      const ids = visibleChars();
      if (ids.length === 0) {
        replace(listBox, h('p.hint.hint-sm', { text: '条件に合うキャラクターがいません。' }));
        return;
      }
      replace(listBox, ...ids.map((id) => {
        const def = RPG.data.characters[id];
        const c = save.characters[id];
        const partyIndex = save.party.indexOf(id);
        return h('button.char-row' + (selectedChar === id ? '.is-active' : '') +
                 (partyIndex >= 0 ? '.is-party' : ''), {
          onClick: () => { selectedChar = id; render(root); },
        },
          W.portrait(def, 'sm'),
          h('div.char-row-info',
            h('span.name', { text: RPG.state.charName(id) + (c.limitBreak > 0 ? ` +${c.limitBreak}` : '') }),
            h('span.sub', { text: `Lv${c.level} / SP ${RPG.state.availableSp(id)}／${RPG.state.totalSp(id)}` })
          ),
          partyIndex >= 0 ? h('span.party-mark', { text: String(partyIndex + 1) }) : null
        );
      }));
    }

    function paintAll() { paintPills(); paintList(); }
    paintAll();

    return h('div.char-selector', h('div.char-search-row', search), pillBox, listBox);
  }

  /* ============================ 出撃 ============================ */

  /**
   * そのフィールドで狙える一番良い宝箱。
   * プレイヤーが知りたいのは「ここで何が拾えるか」なので、通常敵とボスの両方を見る。
   * @param {any} field
   */
  function bestBoxOf(field) {
    const ids = field.pool.concat([field.boss]);
    let best = RPG.data.boxes.box_bronze;
    for (const enemyId of ids) {
      for (const drop of (RPG.data.enemies[enemyId].drops || [])) {
        const box = RPG.data.boxes[drop.box];
        if (box && box.stat_mult > best.stat_mult) best = box;
      }
    }
    return best;
  }

  /**
   * フィールドの色を、背景の絵が透ける濃さで返す (§14)。
   *
   * カードは 2色のグラデーションで塗っている。不透明のままだと、
   * 一覧がそのまま壁になって背景が1ミリも見えない。実機で確かめた。
   * 場所ごとの色は残したいので、色は変えず透明度だけを与える。
   *
   * @param {any} f フィールド定義 @param {number} a 不透明度
   */
  function fieldWash(f, a) {
    const rgba = (/** @type {string} */ hex) => {
      const v = hex.replace('#', '');
      const n = parseInt(v.length === 3 ? v.split('').map((c) => c + c).join('') : v, 16);
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    };
    return `linear-gradient(140deg, ${rgba(f.bg[0])}, ${rgba(f.bg[1])})`;
  }

  /**
   * そのフィールドで実際に出る敵のレベルを、表示用に文字にする (§10.8)。
   *
   * 追随するフィールドで固定値を出すと「Lv200 なら余裕だ」と誤解させる。
   * いま出撃したら何レベルが出るのかを、そのまま見せる。
   *
   * @param {any} f
   */
  function enemyLvLabel(f) {
    if (!f.scaling) return 'Lv' + f.enemy_lv;
    const lv = RPG.battle.scaledEnemyLv(f, RPG.state.partyUnits());
    return 'Lv' + lv + '（追随）';
  }

  /**
   * 格上補正の見え方 (§3.2 ステップ7.5)。
   *
   * 補正そのものは damage.js が持っているが、**戦ってみるまで分からない**のでは
   * 「急に数字が出なくなった」としか映らない。推奨レベルを関門にした以上、
   * 入る前に読めないと理不尽になるので、出撃先の一覧に出す。
   *
   * 基準はパーティで**一番高い**レベル。最初は一番低い子で測っていたが、
   * それだと余裕で抜けられる場所にも「与ダメージ53%」と出て、
   * 警告のほうが実態から外れていた。推奨レベルも追随も
   * パーティの水準＝上の子を見て決まっているので、読み方をそこへ揃える。
   * @param {any} f
   * @returns {{ rate: number, text: string } | null}
   */
  function gapWarn(f) {
    const party = RPG.state.partyUnits();
    if (!party.length) return null;
    const enemyLv = f.scaling ? RPG.battle.scaledEnemyLv(f, party) : f.enemy_lv;
    const top = Math.max.apply(null, party.map((/** @type {any} */ u) => u.level));
    const rate = RPG.damage.levelGapRate(top, enemyLv);
    if (rate >= 1) return null;
    return { rate, text: `格上 与ダメージ ${Math.round(rate * 100)}%` };
  }

  /** @param {HTMLElement} root */
  /**
   * 行き先の一覧 (§1.4)。
   *
   * 下のタブに入りきらない画面への入口。何ができる場所なのかを
   * 一行添える。名前だけでは、初めての人には「鍛冶」が何なのか分からない。
   *
   * @param {any} root
   */
  function destinations(root) {
    const save = RPG.state.get();
    const boxCount = Object.keys(save.boxes || {})
      .reduce((/** @type {number} */ a, /** @type {string} */ k) => a + save.boxes[k], 0);

    /** 目立たせる条件。今やるべきことに印を付ける。 */
    const spot = {
      gacha: save.party.length < 4 && save.gold >= RPG.data.gacha.cost,
      party: Object.keys(save.characters).length > save.party.length,
      identify: boxCount > 0,
    };

    // ストーリー側では周回向けの入口を出さない。
    // ガチャや塔はハクスラ側の仕組みで、別プロファイルの資金と噛み合わない。
    if (RPG.state.mode() === 'story') {
      const st = RPG.story.status();
      return h('div.dest-panel',
        h('div.dest-head',
          h('b', { text: '物語' }),
          h('span.hint.hint-sm', {
            text: st ? `${st.chapter.name}（${st.done} / ${st.total}）` : 'これから始まる',
          })
        ),
        h('div.story-actions',
          W.button('探索へ戻る', () => RPG.app.showMap(), { variant: 'primary' }),
          W.button('ハクスラへ戻る', () => RPG.app.leaveStory(), { variant: 'ghost' })
        ),
        h('p.hint.hint-sm', {
          text: '物語のキャラ・装備・所持金は周回のものとは別です。'
            + 'ここで育てたものは周回側には持ち込めません。',
        })
      );
    }

    const items = [
      { id: 'gacha', label: 'ガチャ', desc: '仲間を増やす' },
      { id: 'party', label: '編成', desc: '連れていく4人を選ぶ' },
      { id: 'quest', label: 'クエスト', desc: '縛りに挑んで専用報酬' },
      { id: 'forge', label: '鍛冶', desc: '装備を強化する' },
      { id: 'tower', label: '塔', desc: 'どこまで登れるか挑む' },
      { id: 'arena', label: '闘技場', desc: 'レベル上限を伸ばす' },
      { id: 'codex', label: '図鑑', desc: '出会った敵と、用語の説明' },
      // 物語はタブではなく別画面なので、押したときの行き先を直接持つ。
      {
        id: 'story', label: '物語', icon: 'tab-party',
        desc: RPG.story.status() ? '続きから' : 'もうひとつの育成で遊ぶ',
        action: () => RPG.app.showStory(),
      },
    ];

    return h('div.dest-panel',
      h('div.dest-head',
        h('b', { text: 'ほかの場所へ' }),
        h('span.hint.hint-sm', { text: '下の「メニュー」からも開けます。' })
      ),
      h('div.dest-grid', items.map((it) => {
        const tab = TABS.find((t) => t.id === it.id);
        return h('button.dest-item' + (spot[it.id] ? '.is-spot' : ''), {
          onClick: () => {
            if (it.action) { it.action(); return; }
            activeTab = it.id;
            render(root);
          },
        },
          W.icon(tab ? tab.icon : (it.icon || 'tab-party'), { size: '18px' }),
          h('span.dest-label', { text: it.label }),
          h('span.dest-desc', { text: it.desc })
        );
      }))
    );
  }

  /**
   * オートの入切 (§10.5)。
   * 出撃前に決められるようにする。残り回数もここで見せる。
   * @param {any} root
   */
  function autoPanel(root) {
    const st = RPG.state.get().settings || {};
    const left = RPG.autolimit ? RPG.autolimit.charges() : null;
    const canAuto = RPG.autolimit ? RPG.autolimit.canAuto() : true;

    return h('div.auto-panel',
      h('div.auto-panel-text',
        h('b', { text: st.auto ? 'オート出撃' : '手動で戦う' }),
        h('span.hint.hint-sm', {
          text: st.auto
            ? '出撃するとそのまま自動で進む。手動ボーナスは付かない。'
            : '自分で技を選ぶ。報酬に手動ボーナスが付く。',
        })
      ),
      h('div.auto-panel-toggles',
        h('button.toggle' + (st.auto ? '.is-on' : ''), {
          'aria-pressed': st.auto ? 'true' : 'false',
          onClick: () => {
            // 回数が尽きているのに入れさせると、出撃した先で
            // 勝手に手動へ戻されて驚くことになる。ここで止める。
            if (!st.auto && !canAuto) {
              RPG.app.toast('オート回数がありません');
              return;
            }
            RPG.state.updateSettings({ auto: !st.auto });
            render(root);
          },
        }, h('span.toggle-dot'), h('span', {
          text: left == null ? 'オート' : `オート（残り ${left}）`,
        })),
        h('button.toggle' + (st.fast ? '.is-on' : ''), {
          'aria-pressed': st.fast ? 'true' : 'false',
          onClick: () => { RPG.state.updateSettings({ fast: !st.fast }); render(root); },
        }, h('span.toggle-dot'), h('span', { text: '高速' }))
      )
    );
  }

  function renderSortie(root) {
    const save = RPG.state.get();
    const party = RPG.state.partyUnits();

    // いま向かう先。ここだけはパネルを置かず、背景の絵をそのまま見せる。
    //
    // ── なぜ空白が要るのか ──
    // 画面が端から端までパネルで埋まっていると、パネルをどれだけ透かしても
    // 絵は「枠の隙間からちらちら見える」だけになる。実機で確かめて分かった。
    // 絵を見せたいなら、絵しか無い帯を作るしかない。
    const here = save.lastSortie && RPG.data.fields[save.lastSortie.fieldId]
      ? RPG.data.fields[save.lastSortie.fieldId]
      : null;

    return h('div.pane',
      h('div.stage',
        h('div.stage-body',
          h('div.stage-rank',
            h('b', { text: here ? '前回の出撃先' : '灰銀の継承者' }),
            h('span.stage-rule')
          ),
          h('h1.stage-title', { text: here ? here.name : '継承の座' }),
          h('div.stage-meta',
            here
              ? [
                  h('span', { text: '推奨 ' }, h('b', { text: 'Lv' + here.rec_level })),
                  h('span', { text: '敵 ' }, h('b', { text: enemyLvLabel(here) })),
                  h('span', { text: save.lastSortie.waves + '戦' }),
                  (() => { const g = gapWarn(here); return g ? h('span.is-gap', { text: g.text }) : null; })(),
                ]
              : [h('span', { text: 'まだ出撃していない。下から場所を選ぶ。' })]
          )
        ),
        here
          ? W.button('同じ場所へ再出撃', () => {
              if (party.length === 0) { RPG.app.toast('パーティが空です'); return; }
              RPG.app.startBattle(save.lastSortie.fieldId, save.lastSortie.waves, save.lastSortie.bossFinale);
            }, { variant: 'primary' })
          : null
      ),
      // ── 行き先の一覧 (§1.4) ──
      //
      // 下のタブは4つに絞ってある（11個並べると狭い画面で3段に折り返す）。
      // そのぶん残りは引き出しの中で、**初めての人にはガチャも編成も見えない**。
      //
      // 出撃画面は最初に開く場所なので、ここに行き先を全部並べておく。
      // 引き出しは「慣れた人の近道」に格下げして、こちらを正面の入口にする。
      destinations(root),

      // ── オートの切替 (§10.5) ──
      //
      // ここに置いてある理由がある。オートの切替は戦闘画面にしか無く、
      // 一度入れると **入り直しても入ったまま** だった。
      // 出撃した瞬間に勝手に進み始め、止めようとしても
      // 「手動に戻す」は自分の手番の一瞬しか出ないので押せない。
      //
      // 出撃する前に決められる場所を作れば、この行き違いは起きない。
      autoPanel(root),

      // 派遣中なら、まずその状況を見せる
      dispatchPanel(root),

      // 仲間が居ないまま連戦に挑むと詰まるので、最初はガチャへ誘導する
      save.party.length < 2 && save.gold >= RPG.data.gacha.cost
        ? h('div.nudge',
            h('span', { text: 'まだ主人公ひとりです。ガチャで仲間を集めてから出撃すると安定します。' }),
            W.button('ガチャへ', () => { activeTab = 'gacha'; render(root); }, { variant: 'primary' })
          )
        : null,
      // 推奨レベル順に並べる (§18)。
      // コアだけなら宣言順＝推奨レベル順なので今まで気付かなかったが、
      // 拡張フィールドは末尾に足されるので、Lv40の狩場が Lv200 の後ろに出る。
      // 一覧は進行の道しるべなので、レベルで並べないと選ぶ順が読めない。
      h('div.field-grid', Object.keys(RPG.data.fields).sort((a, b) =>
        RPG.data.fields[a].rec_level - RPG.data.fields[b].rec_level).map((id) => {
        const f = RPG.data.fields[id];
        const selected = selectedField === id;
        return h('button.field-card' + (selected ? '.is-selected' : ''), {
          style: { background: fieldWash(f, 0.5) },
          onClick: () => { selectedField = selected ? null : id; render(root); },
        },
          h('div.field-head',
            h('span.field-name', { text: f.name }),
            h('span.field-lv', { text: '推奨 Lv' + f.rec_level })
          ),
          (() => { const g = gapWarn(f); return g ? h('div.field-gap', { text: g.text }) : null; })(),
          h('p.field-desc', { text: f.desc }),
          h('div.field-foot',
            h('span', { text: '敵 ' + enemyLvLabel(f) }),
            h('span', { text: 'ボス: ' + RPG.data.enemies[f.boss].name }),
            // gold_mult は内部の調整つまみなので出さない。代わりに狙える宝箱を見せる。
            h('span', { text: '最上位: ' + bestBoxOf(f).name })
          ),
          selected ? h('div.wave-row', RPG.data.waveModes.map((m) =>
            W.button(m.label, (e) => {
              e.stopPropagation();
              if (party.length === 0) { RPG.app.toast('パーティが空です'); return; }
              RPG.app.startBattle(id, m.waves, m.bossFinale);
            }, { variant: 'primary', sub: m.note })
          )) : null,
          selected ? dispatchRow(root, id) : null
        );
      })),
      dispatchResult(),
      h('div.party-preview',
        h('h3', { text: '出撃パーティ' }),
        h('div.party-row', party.map((u) => partyMini(u)))
      ),
      h('p.hint', { text: `所持ゴールド ${save.gold.toLocaleString()} G ／ 戦績 ${save.stats.wins} 勝 / ${save.stats.battles} 戦` })
    );
  }

  /**
   * 派遣の操作列 (§10.4)。
   *
   * 周回のコストを実時間に置き換える仕組み。ボタン1つで即座に報酬が出る
   * 「まとめ周回」は、押すだけで数値が増えるだけになっていたので廃止した。
   * @param {HTMLElement} root
   * @param {string} fieldId
   */
  function dispatchRow(root, fieldId) {
    const busy = RPG.dispatch.current();
    return h('div.farm-row',
      h('span.farm-label', { text: '派遣（放置して時間で受け取る）' }),
      busy
        ? h('p.hint.hint-sm', { text: '別の派遣が進行中です。受け取ってから次を出せます。' })
        : h('div.farm-buttons', RPG.dispatch.PLANS.map((p) =>
            W.button(p.label, (/** @type {any} */ e) => {
              e.stopPropagation();
              startDispatch(root, fieldId, p);
            }, {
              variant: 'ghost',
              sub: `${RPG.dispatch.formatDuration(p.ms)} / ${RPG.dispatch.runsFor(p.ms)}周`,
            })
          )),
      h('p.hint.hint-sm', {
        text: `1周につき ${RPG.dispatch.MS_PER_RUN / 60000} 分かかります。` +
          `早送りはできません。報酬は手動で戦った場合の ${Math.round(RPG.dispatch.REWARD_RATE * 100)}% です。`,
      })
    );
  }

  /**
   * @param {HTMLElement} root
   * @param {string} fieldId
   * @param {any} p
   */
  function startDispatch(root, fieldId, p) {
    const field = RPG.data.fields[fieldId];
    const runs = RPG.dispatch.runsFor(p.ms);
    const ok = confirm(
      `${field.name} へ ${RPG.dispatch.formatDuration(p.ms)} 派遣します（5連戦 × ${runs}周ぶん）。\n\n` +
      '・時間が過ぎるまで受け取れません（早送りはできません）\n' +
      '・同時に出せるのは1隊だけです\n' +
      '・受け取り時に実際に戦うので、勝てない場所へ送ると持ち帰れません\n\n' +
      'よろしいですか？'
    );
    if (!ok) return;

    const res = RPG.dispatch.start({ fieldId, waves: 5, bossFinale: true, planId: p.id });
    if (!res.ok) { RPG.app.toast(res.reason || '失敗'); return; }
    RPG.app.toast(`${field.name} へ派遣しました（${RPG.dispatch.formatDuration(p.ms)}）`);
    render(root);
  }

  /**
   * 派遣中の状態表示。1秒ごとに残り時間だけを書き換える
   * （画面全体を作り直すと操作中に手元が飛ぶため）。
   * @param {HTMLElement} root
   */
  function dispatchPanel(root) {
    const st = RPG.dispatch.status();
    if (!st.active) return null;

    const d = RPG.dispatch.current();
    const remain = h('b.dispatch-remain');
    const fill = h('div.dispatch-fill');
    const members = d.party
      .filter((/** @type {string} */ id) => RPG.data.characters[id])
      .map((/** @type {string} */ id) => RPG.state.charName(id)).join('、');

    function paint() {
      const now = RPG.dispatch.status();
      if (!now.active) return;
      fill.style.width = (now.ratio * 100).toFixed(1) + '%';
      remain.textContent = now.done ? '帰還しました' : RPG.dispatch.formatDuration(now.remainMs);
      collectBtn.disabled = !now.done;
      collectBtn.classList.toggle('btn-primary', !!now.done);
      collectBtn.classList.toggle('btn-ghost', !now.done);
    }

    const collectBtn = W.button('受け取る', () => {
      const res = RPG.dispatch.collect();
      if (!res.ok) { RPG.app.toast(res.reason || '失敗'); return; }
      lastDispatch = res.result;
      RPG.app.refreshTopbar();
      render(root);
      RPG.app.toast(
        `${res.result.runs}周 帰還 — ${res.result.wins}勝${res.result.losses}敗 ／ ` +
        `${res.result.gold.toLocaleString()} G`
      );
    }, { variant: 'ghost' });

    const panel = h('div.dispatch-panel',
      h('div.dispatch-head',
        h('h3', { text: `派遣中 — ${st.field.name}` }),
        h('span.hint.hint-sm', { text: `${st.plan.label} / ${st.runs}周ぶん` })
      ),
      h('div.dispatch-bar', fill),
      h('div.dispatch-foot',
        h('span', h('em', { text: '残り ' }), remain),
        h('span.hint.hint-sm', { text: members }),
        collectBtn,
        W.button('取りやめ', () => {
          if (!confirm('派遣を取りやめますか？ 報酬は受け取れません。')) return;
          RPG.dispatch.cancel();
          render(root);
        }, { variant: 'ghost' })
      )
    );

    // 表示中だけ動かす。画面を離れたら止める。
    clearInterval(dispatchTimer);
    dispatchTimer = setInterval(() => {
      if (!panel.isConnected) { clearInterval(dispatchTimer); return; }
      paint();
    }, 1000);
    paint();

    return panel;
  }

  /** 派遣の受け取り結果 */
  function dispatchResult() {
    if (!lastDispatch) return null;
    const f = lastDispatch;
    const field = RPG.data.fields[f.fieldId];
    const boxNames = Object.keys(f.boxes)
      .map((b) => `${RPG.data.boxes[b].name}×${f.boxes[b]}`).join('、');

    // レベルアップは同じキャラが何度も出るので、最後の到達レベルだけを見せる
    /** @type {Record<string, string>} */
    const finalLevels = {};
    for (const line of f.levelUps) {
      const at = line.lastIndexOf(' Lv');
      if (at > 0) finalLevels[line.slice(0, at)] = line.slice(at + 1);
    }
    const levelText = Object.keys(finalLevels)
      .map((name) => `${name} ${finalLevels[name]}`).join('、');

    return h('div.farm-result',
      h('div.section-head',
        h('h3', { text: `派遣の成果 — ${field.name}` }),
        W.button('閉じる', () => { lastDispatch = null; RPG.app.showBase(); }, { variant: 'ghost' })
      ),
      f.winRate < 0.6
        ? h('p.quest-block', {
            text: `勝率 ${Math.round(f.winRate * 100)}%。` +
              'この編成には荷が重い場所です。装備やレベルを整えるか、下の狩場へ変えてください。',
          })
        : null,
      h('div.farm-stats',
        h('div.farm-stat', h('em', { text: '周回' }), h('b', { text: `${f.runs}周` })),
        h('div.farm-stat', h('em', { text: '戦績' }), h('b', { text: `${f.wins}勝 ${f.losses}敗` })),
        h('div.farm-stat', h('em', { text: 'ゴールド' }), h('b', { text: `+${f.gold.toLocaleString()} G` })),
        h('div.farm-stat', h('em', { text: '経験値（1人）' }), h('b', { text: `+${f.exp.toLocaleString()}` })),
        h('div.farm-stat', h('em', { text: '総ラウンド' }), h('b', { text: String(f.rounds) }))
      ),
      h('p.hint.hint-sm', { text: '宝箱: ' + (boxNames || 'なし') }),
      levelText ? h('p.hint.hint-sm', { text: 'レベルアップ: ' + levelText }) : null
    );
  }

  /* ============================ 図鑑 ============================ */

  /**
   * 図鑑 (§13)。
   *
   * 並べる項目は必ず `RPG.data.*` から導出する。図鑑専用のカタログは作らない。
   * `data/characters.js` や `data/enemies.js` に1体足せば、ここにも自動で並ぶ。
   * @param {HTMLElement} root
   */
  function renderCodex(root) {
    const total = RPG.codex.totalProgress();

    return h('div.pane',
      W.heading('図鑑', '出会ったキャラクター・敵・フィールドの記録と、システム用語の説明。'),
      h('div.codex-progress',
        h('div.codex-bar', h('div.codex-bar-fill', { style: { width: (total.rate * 100).toFixed(1) + '%' } })),
        h('span', { text: `収集率 ${total.found} / ${total.total}（${Math.round(total.rate * 100)}%）` })
      ),
      h('div.toolbar-row.codex-tabs', RPG.codex.SECTIONS.map((s) => {
        const p = RPG.codex.progress(s.id);
        return h('button.pill' + (codexView.section === s.id ? '.is-on' : ''), {
          onClick: () => { codexView.section = s.id; codexView.selected = null; render(root); },
          // 用語は集めるものではないので「0/0」を出さない
          text: s.collect ? `${s.label} ${p.found}/${p.total}` : s.label,
        });
      })),
      // 用語には「未発見」が無いので、切り替えごと出さない
      codexView.section === 'system' ? null : h('div.toolbar-row',
        h('button.pill' + (codexView.showUnknown ? '.is-on' : ''), {
          onClick: () => { codexView.showUnknown = !codexView.showUnknown; render(root); },
          text: '未発見も表示',
        })
      ),
      codexView.section === 'system' ? codexGlossary(root) : [
        codexView.selected ? codexDetail(root) : null,
        codexGrid(root),
      ]
    );
  }

  /**
   * 本文の `**ここ**` を強調にする。
   *
   * innerHTML を通さないのは、用語の本文が将来キャラ名などを差し込む形に
   * なったときに、文章がそのままHTMLとして解釈されるのを防ぐため。
   * 記法を1つしか持たないので、分割して組み直すだけで足りる。
   * @param {string} text
   * @returns {Array<Node|string>}
   */
  function emphasize(text) {
    return String(text).split(/\*\*/).map((part, i) =>
      (i % 2 === 1 ? h('strong', { text: part }) : part));
  }

  /**
   * 用語集 (§13.2)。
   *
   * ── なぜ一覧＋詳細ではなく、開閉する一覧なのか ──
   * キャラや敵と違って、用語は「どれを見たいか」が最初から分かっていない。
   * 名前だけ並べても、どれが自分の知りたいものなのか判断できない。
   * そこで見出しの下に一行だけ要約を常に出し、押すと本文が開く形にした。
   * 一覧をなぞるだけで、読むべき項目が自分で見つかる。
   * @param {HTMLElement} root
   */
  function codexGlossary(root) {
    const all = RPG.data.glossary || {};
    if (codexView.scrollToTerm) {
      codexView.scrollToTerm = false;
      // 描画が終わってからでないと、まだ画面に無いものを探すことになる
      requestAnimationFrame(() => {
        const open = document.querySelector('.glossary-item.is-open');
        if (open) open.scrollIntoView({ block: 'center' });
      });
    }
    return h('div.glossary', RPG.codex.glossaryByGroup().map((g) => h('section.glossary-group',
      h('h3.glossary-group-name', { text: g.group.label }),
      h('p.glossary-group-desc', { text: g.group.desc }),
      h('div.glossary-list', g.entries.map(({ id, def }) => {
        const open = codexView.selected === id;
        return h('div.glossary-item' + (open ? '.is-open' : ''),
          h('button.glossary-head', {
            onClick: () => { codexView.selected = open ? null : id; render(root); },
          },
            h('span.glossary-term', { text: def.term }),
            h('span.glossary-short', { text: def.short }),
            h('span.glossary-mark', { text: open ? '−' : '＋' })
          ),
          open ? h('div.glossary-body',
            def.body.map((/** @type {string} */ para) => h('p', emphasize(para))),
            // 関連語は、読んだ流れのまま隣へ飛べるようにする。
            // 用語は単独では分からず、対になっている相手と並べて初めて意味が立つものが多い。
            (def.see || []).length ? h('div.glossary-see',
              h('span.glossary-see-label', { text: '関連' }),
              (def.see || []).filter((/** @type {string} */ sid) => all[sid])
                .map((/** @type {string} */ sid) => h('button.glossary-link', {
                  text: all[sid].term,
                  onClick: () => {
                    // 飛び先が別の区分にあると、開いても画面の外で何も起きないように見える。
                    // 押して移動したときだけ送る（自分で開いたときは既に見えている）。
                    codexView.selected = sid;
                    codexView.scrollToTerm = true;
                    render(root);
                  },
                }))
            ) : null
          ) : null
        );
      }))
    )));
  }

  /** 図鑑の一覧。区分ごとに項目の作り方だけを差し替える。 */
  function codexGrid(root) {
    const section = codexView.section;
    /** @type {Array<{id: string, known: boolean, node: () => HTMLElement}>} */
    let entries = [];

    if (section === 'character') {
      entries = Object.keys(RPG.data.characters).map((id) => ({
        id, known: RPG.codex.characterOwned(id),
        node: () => codexCharCard(root, id),
      }));
    } else if (section === 'enemy') {
      entries = Object.keys(RPG.data.enemies).map((id) => ({
        id, known: RPG.codex.enemySeen(id),
        node: () => codexEnemyCard(root, id),
      }));
    } else {
      entries = Object.keys(RPG.data.fields).map((id) => ({
        id, known: RPG.codex.fieldSeen(id),
        node: () => codexFieldCard(root, id),
      }));
    }

    const shown = codexView.showUnknown ? entries : entries.filter((e) => e.known);
    if (shown.length === 0) {
      return h('p.empty', {
        text: codexView.showUnknown
          ? 'この区分にはまだ項目がありません。'
          : 'まだ何も見つけていません。「未発見も表示」で全体を確認できます。',
      });
    }
    return h('div.codex-grid', shown.map((e) => e.node()));
  }

  /**
   * 未発見の項目。名前は伏せるが、区分と件数が分かるようにしておく。
   * @param {string} label
   */
  function codexUnknownCard(label) {
    return h('div.codex-card.is-unknown',
      h('div.codex-thumb', h('span.codex-qmark', { text: '？' })),
      h('div.codex-card-body',
        h('span.codex-name', { text: '？？？' }),
        h('span.codex-sub', { text: label })
      )
    );
  }

  /**
   * @param {HTMLElement} root
   * @param {string} id
   */
  function codexCharCard(root, id) {
    const def = RPG.data.characters[id];
    if (!RPG.codex.characterOwned(id)) return codexUnknownCard(RPG.data.rarities[def.rarity].label);

    const c = RPG.state.get().characters[id];
    return h('div.codex-card' + (codexView.selected === id ? '.is-active' : ''), {
      onClick: () => { codexView.selected = codexView.selected === id ? null : id; render(root); },
    },
      W.portrait(def, 'md'),
      h('div.codex-card-body',
        h('span.codex-name', { text: RPG.state.charName(id) }),
        h('span.codex-sub', { text: `${def.title} / Lv${c.level}${RPG.state.atMaxLevel(c.id) ? '(MAX)' : ''}${c.limitBreak ? ` +${c.limitBreak}` : ''}` }),
        h('div.chips', W.rarityChip(def.rarity), W.elementChip(def.element))
      )
    );
  }

  /**
   * @param {HTMLElement} root
   * @param {string} id
   */
  function codexEnemyCard(root, id) {
    const def = RPG.data.enemies[id];
    if (!RPG.codex.enemySeen(id)) return codexUnknownCard(def.boss ? 'ボス' : '敵');

    const entry = RPG.codex.enemyEntry(id);
    return h('div.codex-card' + (codexView.selected === id ? '.is-active' : '') + (def.boss ? '.is-boss' : ''), {
      onClick: () => { codexView.selected = codexView.selected === id ? null : id; render(root); },
    },
      W.enemyArt(Object.assign({ id }, def), { boss: !!def.boss }),
      h('div.codex-card-body',
        h('span.codex-name', { text: def.name }),
        h('span.codex-sub', { text: `遭遇 ${entry.seen} / 撃破 ${entry.killed}` }),
        h('div.chips', W.elementChip(def.element), def.boss ? h('span.chip.chip-rule', { text: 'ボス' }) : null)
      )
    );
  }

  /**
   * @param {HTMLElement} root
   * @param {string} id
   */
  function codexFieldCard(root, id) {
    const f = RPG.data.fields[id];
    if (!RPG.codex.fieldSeen(id)) return codexUnknownCard('フィールド');

    const members = f.pool.concat([f.boss]);
    const found = members.filter(RPG.codex.enemySeen).length;
    return h('div.codex-card.is-field' + (codexView.selected === id ? '.is-active' : ''), {
      style: { background: fieldWash(f, 0.5) },
      onClick: () => { codexView.selected = codexView.selected === id ? null : id; render(root); },
    },
      h('div.codex-card-body',
        h('span.codex-name', { text: f.name }),
        h('span.codex-sub', { text: `推奨 Lv${f.rec_level} / 敵 ${enemyLvLabel(f)}` }),
        h('span.codex-sub', { text: `出現する敵 ${found} / ${members.length}` }),
        h('span.codex-sub', { text: `出撃 ${RPG.codex.fieldEntry(id).visits} 回` })
      )
    );
  }

  /**
   * 絵をクリックすると原寸で開けるようにする。
   * 一覧や詳細では枠に合わせて切り抜いているので、全体を見る手段を残しておく。
   * @param {HTMLElement} node 立ち絵の要素
   * @param {any} src 定義
   * @param {'character'|'enemy'} kind
   * @param {string} caption
   */
  function zoomable(node, src, kind, caption) {
    node.setAttribute('title', 'クリックで原寸表示');
    node.addEventListener('click', () => W.artLightbox(src, { kind, caption }));
    return node;
  }

  /** 選択中の項目の詳細。 */
  function codexDetail(root) {
    const id = codexView.selected;
    const section = codexView.section;
    const close = () => { codexView.selected = null; render(root); };

    if (section === 'character' && RPG.data.characters[id]) return codexCharDetail(id, close);
    if (section === 'enemy' && RPG.data.enemies[id]) return codexEnemyDetail(id, close);
    if (section === 'field' && RPG.data.fields[id]) return codexFieldDetail(root, id, close);
    return null;
  }

  /**
   * @param {string} id
   * @param {() => void} close
   */
  function codexCharDetail(id, close) {
    const save = RPG.state.get();
    const def = RPG.data.characters[id];
    const unit = RPG.units.buildCharacterUnit(save.characters[id], save.inventory);

    return h('div.codex-detail',
      h('div.section-head',
        h('h3', { text: `${RPG.state.charName(id)} — ${def.title}` }),
        W.button('閉じる', close, { variant: 'ghost' })
      ),
      h('div.codex-detail-body',
        zoomable(W.standee(unit), def, 'character', RPG.state.charName(id)),
        h('div.codex-detail-info',
          h('div.chips', W.rarityChip(def.rarity), W.elementChip(def.element)),
          h('p.codex-art-hint', { text: '立ち絵をクリックすると原寸で表示します。' }),
          h('p.char-desc', { text: def.desc }),
          statBlock(unit.stats),
          // 定義側は unique_skills / common_skills に分かれている上、ツリーで覚える技もある。
          // 組み立て済みの unit.skills を使えば、技の増やし方が変わっても追従できる。
          skillList(unit.skills),
          passiveNotes(def)
        )
      )
    );
  }

  /**
   * @param {string} id
   * @param {() => void} close
   */
  function codexEnemyDetail(id, close) {
    const { def, level, unit, habitats } = RPG.codex.enemyPreview(id);
    const entry = RPG.codex.enemyEntry(id);

    return h('div.codex-detail',
      h('div.section-head',
        h('h3', { text: def.name }),
        W.button('閉じる', close, { variant: 'ghost' })
      ),
      h('div.codex-detail-body',
        zoomable(W.enemyArt(Object.assign({ id }, def), { boss: !!def.boss }),
          Object.assign({ id }, def), 'enemy', def.name),
        h('div.codex-detail-info',
          h('div.chips',
            W.elementChip(def.element),
            def.boss ? h('span.chip.chip-rule', { text: 'ボス' }) : null,
            h('span.chip', { text: `Lv${level} 時点` })
          ),
          h('p.hint.hint-sm', { text: `遭遇 ${entry.seen} 回 / 撃破 ${entry.killed} 体` }),
          h('p.codex-art-hint', { text: '立ち絵をクリックすると原寸で表示します。' }),
          statBlock(unit.stats),
          skillList(def.skills),
          h('div.codex-line',
            h('em', { text: '出現場所' }),
            h('span', {
              text: habitats.length
                ? habitats.map((hb) => hb.name + (hb.role === 'boss' ? '（ボス）' : '')).join('、')
                : 'なし',
            })
          ),
          h('div.codex-line',
            h('em', { text: '落とす宝箱' }),
            h('span', {
              text: (def.drops || []).length
                ? def.drops.map((/** @type {any} */ d) =>
                    `${RPG.data.boxes[d.box].name} ${Math.round(d.chance * 100)}%`).join('、')
                : 'なし',
            })
          ),
          h('div.codex-line',
            h('em', { text: '報酬' }),
            h('span', { text: `${unit.gold.toLocaleString()} G / ${unit.exp.toLocaleString()} EXP` })
          )
        )
      )
    );
  }

  /**
   * @param {HTMLElement} root
   * @param {string} id
   * @param {() => void} close
   */
  function codexFieldDetail(root, id, close) {
    const f = RPG.data.fields[id];
    const members = f.pool.map((/** @type {string} */ e) => ({ id: e, boss: false }))
      .concat([{ id: f.boss, boss: true }]);

    return h('div.codex-detail',
      h('div.section-head',
        h('h3', { text: f.name }),
        W.button('閉じる', close, { variant: 'ghost' })
      ),
      h('p.char-desc', { text: f.desc }),
      h('div.codex-line', h('em', { text: '推奨レベル' }), h('span', { text: `Lv${f.rec_level}（敵 ${enemyLvLabel(f)}）` })),
      h('div.codex-line', h('em', { text: '1ウェーブの敵数' }), h('span', { text: `${f.size[0]}〜${f.size[1]} 体` })),
      h('div.codex-line', h('em', { text: '狙える最上位' }), h('span', { text: bestBoxOf(f).name })),
      h('h4.codex-sub-head', { text: '出現する敵' }),
      h('div.codex-grid', members.map((m) =>
        RPG.codex.enemySeen(m.id)
          ? h('div.codex-card', {
              onClick: () => {
                codexView.section = 'enemy';
                codexView.selected = m.id;
                render(root);
              },
            },
              W.enemyArt(Object.assign({ id: m.id }, RPG.data.enemies[m.id]), { boss: m.boss }),
              h('div.codex-card-body',
                h('span.codex-name', { text: RPG.data.enemies[m.id].name }),
                h('span.codex-sub', { text: m.boss ? 'ボス' : '通常' })
              )
            )
          : codexUnknownCard(m.boss ? 'ボス' : '敵')
      ))
    );
  }

  /**
   * ステータスの一覧。キーは RPG.units.STAT_LABEL から引くので、
   * ステータスを増やしても表示側は変えなくてよい。
   * @param {Record<string, number>} stats
   */
  function statBlock(stats) {
    return h('div.stat-grid', Object.keys(stats)
      .filter((k) => RPG.units.STAT_LABEL[k])
      .map((k) => h('div.stat',
        h('span', W.icon(W.STAT_ICON[k]), h('em', { text: RPG.units.STAT_LABEL[k] })),
        h('b', { text: stats[k].toLocaleString() })
      )));
  }

  /**
   * 技の一覧。
   * @param {string[]} skillIds
   */
  function skillList(skillIds) {
    return h('div.codex-skills', (skillIds || []).map((sid) => {
      const skill = RPG.data.skills[sid];
      if (!skill) return null;
      return h('div.codex-skill',
        h('div.codex-skill-head',
          h('span.codex-skill-name', { text: skill.name }),
          W.elementChip(skill.element),
          W.tagChip(skill.damage_type),
          h('span.chip', { text: skill.power > 0 ? `威力${skill.power}%` : '補助' })
        ),
        h('span.codex-skill-desc', { text: skill.desc })
      );
    }));
  }

  /** 固有効果の表示名。ここに無いキーはキー名のまま出すので、data側の追加で落ちない。 */
  const PASSIVE_LABEL = {
    atkScale: '攻撃力', doubleHits: '連撃', counterRate: '反撃率', counterPower: '反撃倍率',
    thorns: '棘', lastStand: '致命回避', reviveHp: '復活HP', guardBreak: '防御崩し',
    lifesteal: '吸命', chain: '波及', regen: '再生', openingBuff: '開幕バフ',
    waveHeal: 'ウェーブ間回復', extraActionRate: '再行動率',
    lowHpPower: '低HP時の上乗せ', highHpPower: '高HP時の上乗せ', bossSlayer: '対ボスの上乗せ',
    debuffAmp: 'デバフ中の相手への上乗せ', firstRoundPower: '初回ラウンドの上乗せ',
  };

  /** 「1.0を基準とする倍率」として書かれている値。%表記だと意味が逆に読めるため分ける。 */
  const MULTIPLIER_KEYS = ['atkScale', 'counterPower'];

  /**
   * 固有パッシブと状況補正を言葉にする。
   * data 側にキーを足しても落ちないよう、知らないキーはそのまま出す。
   * @param {any} def
   */
  function passiveNotes(def) {
    const lines = [];
    for (const src of [def.passives, def.situational]) {
      for (const key of Object.keys(src || {})) {
        const v = src[key];
        const label = PASSIVE_LABEL[key] || key;
        if (typeof v !== 'number') { lines.push(`${label} ${v}`); continue; }
        // ×0.5 を「50%」と書くと増加に読めてしまうので、倍率は倍率として出す
        lines.push(MULTIPLIER_KEYS.includes(key)
          ? `${label} ×${v}`
          : `${label} +${Math.round(v * 100)}%`);
      }
    }
    if (lines.length === 0) return null;
    return h('div.codex-line', h('em', { text: '固有効果' }), h('span', { text: lines.join(' / ') }));
  }

  /* ============================ クエスト ============================ */

  /**
   * クエスト一覧 (§10.3)。
   * 出撃できない理由はボタンを押す前に全部見えるようにする。
   * @param {HTMLElement} root
   */
  function renderQuest(root) {
    const quests = RPG.quest.all();
    const cleared = quests.filter((q) => RPG.quest.isCleared(q.id)).length;

    return h('div.pane',
      W.heading('クエスト',
        '縛りのある戦いと、推奨レベルでは届かない強敵。初回クリアにだけ専用報酬が出る。'),
      h('p.hint.hint-sm', { text: `達成 ${cleared} / ${quests.length}` }),
      h('div.quest-list', quests.map((q) => questCard(root, q)))
    );
  }

  /**
   * @param {HTMLElement} root
   * @param {any} quest
   */
  function questCard(root, quest) {
    const done = RPG.quest.isCleared(quest.id);
    const gate = RPG.quest.unlocked(quest);

    // 出撃先を持たない達成条件型は、挑戦ボタンではなく条件を見せる (§10.3-2)
    if (quest.kind === 'challenge') {
      const progress = RPG.quest.challengeProgress(quest);
      return h('div.quest-card.is-challenge' + (done ? '.is-done' : '') + (gate.ok ? '' : '.is-locked'),
        h('div.quest-head',
          h('div.quest-title',
            h('h3', { text: quest.name }),
            h('span.chip.chip-rule', { text: '達成条件' }),
            done ? h('span.chip.chip-done', { text: '達成済み' }) : null
          ),
          h('span.quest-field', { text: '場所を問わない' })
        ),
        h('p.quest-desc', { text: quest.desc }),
        progress && !done
          ? h('div.quest-progress', h('em', { text: '現在の条件' }), h('span', { text: progress.text }))
          : null,
        h('div.quest-reward',
          h('span.quest-reward-label', { text: done ? '報酬（受取済み）' : '達成報酬' }),
          h('span.quest-reward-body', { text: RPG.quest.rewardLabels(quest).join('／') || 'なし' })
        ),
        !gate.ok ? h('p.quest-block', { text: gate.reason || '未解放' }) : null
      );
    }

    const field = RPG.data.fields[quest.fieldId];
    const check = RPG.quest.checkParty(quest);
    const canGo = gate.ok && check.ok;

    return h('div.quest-card' + (done ? '.is-done' : '') + (gate.ok ? '' : '.is-locked'),
      h('div.quest-head',
        h('div.quest-title',
          h('h3', { text: quest.name }),
          done ? h('span.chip.chip-done', { text: '達成済み' }) : null
        ),
        h('span.quest-field', { text: `${field.name} / ${quest.waves}戦` })
      ),
      h('p.quest-desc', { text: quest.desc }),
      h('div.quest-rules', RPG.quest.ruleLabels(quest).map((t) => h('span.chip.chip-rule', { text: t }))),
      h('div.quest-reward',
        h('span.quest-reward-label', { text: done ? '初回報酬（受取済み）' : '初回クリア報酬' }),
        h('span.quest-reward-body', { text: RPG.quest.rewardLabels(quest).join('／') || 'なし' })
      ),
      // 解放条件と編成の不備は、押せないボタンの理由として必ず出す
      !gate.ok
        ? h('p.quest-block', { text: gate.reason || '未解放' })
        : (!check.ok ? h('div.quest-block', check.reasons.map((r) => h('div', { text: r }))) : null),
      W.button(done ? 'もう一度挑む' : '挑戦する', () => RPG.app.startQuest(quest.id), {
        variant: canGo ? 'primary' : 'ghost',
        disabled: !canGo,
        sub: done ? '報酬は初回のみ' : null,
      })
    );
  }

  /** @param {any} u */
  function partyMini(u) {
    return h('div.party-mini',
      W.portrait(u, 'sm'),
      h('div.party-mini-info',
        h('span.name', { text: u.name }),
        h('span.lv', { text: 'Lv' + u.level }),
        W.hpBar(u.hp, u.maxHp)
      )
    );
  }

  /* ============================ 塔 ============================ */

  /**
   * エンドレスタワー (§10.7)。
   * 上限は無く、HPが階をまたいで持ち越される。倒れたらそこで終了。
   * @param {HTMLElement} root
   */
  /* ============================ 闘技場 (§17) ============================ */

  /** @param {HTMLElement} root */
  function renderArena(root) {
    const check = RPG.arena.canChallenge();
    const total = RPG.arena.bosses().length;

    return h('div.pane',
      W.heading('闘技場',
        '1体と1戦だけ戦う。連戦ではないぶん、通常の狩場には置けない悪辣な仕掛けを備えている。'),
      h('p.hint.hint-sm', {
        text: 'ここの相手は、特定の組み立てを名指しで否定してくる。' +
          `初回制覇で「${RPG.data.items.it_star_shard.name}」がひとつ手に入る。`,
      }),
      h('p.hint.hint-sm', {
        text: `ハードは敵のレベルが現在の上限（Lv${RPG.state.levelCap()}）に合わせられ、` +
          `倒すたびに ${Math.round(RPG.arena.HARD_DROP_RATE * 100)}% で ` +
          `${RPG.data.items.it_star_shard.name} が出る。`,
      }),
      h('p.hint.hint-sm', { text: `攻略済み ${RPG.arena.clearedCount()} / ${total}` }),

      // 手に入れた場所で使えるようにしておく。
      // 上限を伸ばす → もっと強い相手に挑める、が一画面で完結する。
      (() => {
        const itemId = RPG.arena.CAP_ITEM;
        const def = RPG.data.items[itemId];
        const have = RPG.state.itemCount(itemId);
        return h('div.arena-item',
          h('div.arena-item-body',
            h('b', { text: `${def.name} ×${have}` }),
            h('span.hint.hint-sm', { text: def.desc }),
            h('span.hint.hint-sm', { text: `現在のレベル上限 Lv${RPG.state.levelCap()}` })
          ),
          W.button(have > 1 ? `まとめて使う（${have}個）` : '使う', () => {
            const r = RPG.state.useItem(itemId, have);
            if (!r.ok) { RPG.app.toast(r.reason || '使えません'); return; }
            RPG.app.toast(`レベル上限が Lv${r.levelCap} になった`);
            render(root);
          }, { variant: have > 0 ? 'primary' : 'ghost', disabled: have === 0 })
        );
      })(),
      check.ok ? null : h('p.tier-locked-note', W.icon('lock'), h('span', { text: check.reason })),

      h('div.arena-list', RPG.arena.bosses().map((/** @type {any} */ def) => {
        const rec = RPG.arena.record(def.id);
        return h('div.arena-card' + (rec && rec.cleared ? '.is-cleared' : ''),
          { style: `--cls: ${def.color}` },
          h('div.arena-head',
            h('div.arena-title',
              h('h3', { text: def.name }),
              h('span.arena-sub', { text: def.title })
            ),
            rec && rec.cleared
              ? h('span.chip.chip-done', {
                  text: `最短 ${rec.bestRound}R` + (rec.hardCleared ? ' ／ ハード制覇' : ''),
                })
              : h('span.chip', { text: '未攻略' })
          ),
          h('p.arena-desc', { text: def.desc }),
          h('div.arena-gimmicks',
            h('span.arena-label', { text: '特殊' }),
            h('ul', RPG.arena.gimmickLines(def).map((/** @type {string} */ t) =>
              h('li', { text: t })))
          ),
          h('p.arena-hint', { text: def.hint }),
          h('div.arena-foot',
            h('span.hint.hint-sm', {
              text: `敵 Lv${def.lv}` + (def.adds ? ` ／ 取り巻きあり` : ''),
            }),
            W.button('挑む', () => RPG.app.startArena(def.id), {
              variant: 'primary', disabled: !check.ok,
              sub: rec && rec.cleared ? '報酬は初回のみ' : null,
            }),
            (() => {
              const hardGate = RPG.arena.canChallengeHard(def.id);
              return W.button('ハード', () => RPG.app.startArena(def.id, { hard: true }), {
                variant: 'ghost',
                disabled: !check.ok || !hardGate.ok,
                sub: hardGate.ok
                  ? `Lv${RPG.state.levelCap()} ／ ${Math.round(RPG.arena.HARD_DROP_RATE * 100)}%で戦利品`
                  : hardGate.reason,
              });
            })()
          )
        );
      }))
    );
  }

  function renderTower(root) {
    const st = RPG.tower.status();
    const cfg = RPG.data.tower;

    return h('div.pane',
      W.heading('エンドレスタワー',
        'HPは階をまたいで持ち越される。倒れたらそこで終了。到達した深さがそのまま記録になる。'),

      h('div.tower-record',
        h('div.tower-best',
          h('em', { text: '最高到達' }),
          h('b', { text: st.best > 0 ? `${st.best} 階` : '未挑戦' })
        ),
        h('p.hint.hint-sm', {
          text: `${cfg.bossEvery}階ごとにボスが出て、越えると最大HPの` +
            `${Math.round(cfg.restHeal * 100)}%だけ立て直せます。回復はそれだけです。`,
        })
      ),

      st.active ? towerRunPanel(root, st) : towerStartPanel(root, st),
      towerTierTable(st)
    );
  }

  /**
   * @param {HTMLElement} root
   * @param {any} st
   */
  function towerStartPanel(root, st) {
    const save = RPG.state.get();
    const next = RPG.tower.nextMilestone(st.best || 0);
    const points = RPG.tower.startPoints();

    return h('div.tower-panel',
      h('p.hint.hint-sm', {
        text: '到達済みの深さまでは途中から始められます。到達報酬は最高到達階を更新したときに' +
          'だけ出るので、飛ばした階の報酬は出ませんし、同じ深さの周回でも稼げません。',
      }),
      next
        ? h('div.tower-next',
            h('em', { text: `次の節目: ${next.floor}階` }),
            h('span', { text: towerMilestoneText(next) })
          )
        : null,
      h('h4.tower-sub-head', { text: '開始する階' }),
      h('div.tower-starts', points.map((p) =>
        W.button(`${p.floor}階`, () => {
          const res = RPG.tower.start(p.floor);
          if (!res.ok) { RPG.app.toast(res.reason || '失敗'); return; }
          RPG.app.startTowerFloor();
        }, {
          variant: p.floor === 1 ? 'primary' : 'ghost',
          disabled: save.party.length === 0 || !p.reached,
          sub: p.reached ? p.label : '未到達',
        })
      ))
    );
  }

  /**
   * @param {HTMLElement} root
   * @param {any} st
   */
  function towerRunPanel(root, st) {
    return h('div.tower-panel.is-active',
      h('div.tower-head',
        h('h3', { text: `${st.floor} 階 — ${st.spec.label}` }),
        st.spec.boss ? h('span.chip.chip-rule', { text: 'ボス階' }) : null,
        h('span.hint.hint-sm', { text: `クリア済み ${st.cleared} 階` })
      ),
      h('div.tower-stats',
        h('div.farm-stat', h('em', { text: '敵レベル' }), h('b', { text: 'Lv' + st.spec.enemyLv })),
        h('div.farm-stat', h('em', { text: '敵の能力' }), h('b', { text: '×' + st.spec.enemyScale.toFixed(2) }))
      ),
      h('h4.tower-sub-head', { text: '持ち越しているHP' }),
      h('div.tower-party', st.party.map((/** @type {any} */ p) =>
        h('div.tower-member' + (p.ratio <= 0 ? '.is-down' : ''),
          h('span.name', { text: p.name }),
          h('div.tower-hp', h('div.tower-hp-fill', {
            style: {
              width: Math.max(0, Math.min(100, p.ratio * 100)) + '%',
              background: p.ratio > 0.5 ? 'var(--ok)' : p.ratio > 0.25 ? 'var(--gold)' : 'var(--danger)',
            },
          })),
          h('span.pct', { text: p.ratio <= 0 ? '戦闘不能' : Math.round(p.ratio * 100) + '%' })
        )
      )),
      st.nextMilestone
        ? h('div.tower-next',
            h('em', { text: `次の節目: ${st.nextMilestone.floor}階` }),
            h('span', { text: towerMilestoneText(st.nextMilestone) })
          )
        : null,
      h('div.tower-actions',
        W.button('この階に挑む', () => RPG.app.startTowerFloor(), {
          variant: 'primary', disabled: st.wiped, sub: `${st.floor}階`,
        }),
        W.button('切り上げる', () => {
          if (!confirm('挑戦を終えますか？ 到達階の記録は残ります。')) return;
          RPG.tower.retire();
          render(root);
        }, { variant: 'ghost' })
      )
    );
  }

  /** 節目の報酬を一行にする。 */
  function towerMilestoneText(m) {
    const parts = [];
    if (m.gold) parts.push(`${m.gold.toLocaleString()} G`);
    for (const b of Object.keys(m.boxes || {})) parts.push(`${RPG.data.boxes[b].name}×${m.boxes[b]}`);
    if (m.autoCharge) parts.push(`オート回数の上限 +${m.autoCharge}`);
    if (m.equip) parts.push(m.equip.name);
    return parts.join('／') || '—';
  }

  /** 階層帯の一覧。どこまで行けばどんな敵が出るかの目安。 */
  function towerTierTable(st) {
    const cfg = RPG.data.tower;
    return h('div.tower-tiers',
      h('h4.tower-sub-head', { text: '階層帯' }),
      h('div.tower-tier-rows', cfg.tiers.map((t, i) => {
        const until = cfg.tiers[i + 1] ? cfg.tiers[i + 1].from - 1 : null;
        const reached = (st.best || 0) >= t.from;
        return h('div.tower-tier' + (reached ? '.is-reached' : ''),
          h('span.tower-tier-range', { text: until ? `${t.from}〜${until}階` : `${t.from}階〜` }),
          h('span.tower-tier-name', { text: t.label }),
          h('span.tower-tier-field', { text: RPG.data.fields[t.fieldId].name })
        );
      }))
    );
  }

  /* ============================ 鍛冶 ============================ */

  /**
   * 装備の強化と厳選 (§7.6)。
   * 左で装備を選び、右で強化・厳選する。素材は自動で弱いものから選ばれる。
   * @param {HTMLElement} root
   */
  function renderForge(root) {
    const save = RPG.state.get();
    const owner = /** @type {Record<number, string>} */ ({});
    for (const id of Object.keys(save.characters)) {
      const c = save.characters[id];
      for (const slot of Object.keys(c.equipped)) {
        for (const uid of c.equipped[slot]) owner[uid] = RPG.state.charName(id);
      }
    }

    // 前に選んでいたものが売られたり素材にされたりしていたら選択を外す
    if (forgeTarget != null && !save.inventory.some((/** @type {any} */ it) => it.uid === forgeTarget)) {
      forgeTarget = null;
    }
    const target = save.inventory.find((/** @type {any} */ it) => it.uid === forgeTarget) || null;

    const list = applyGearView(save.inventory, owner);

    return h('div.pane.pane-split',
      h('div.col-left',
        h('h3', { text: '強化する装備' }),
        gearToolbar(root, save.inventory),
        list.length === 0
          ? h('p.empty', { text: '装備がありません。' })
          : h('div.forge-list', list.map((/** @type {any} */ item) =>
              h('button.forge-row' + (forgeTarget === item.uid ? '.is-active' : ''), {
                onClick: () => { forgeTarget = item.uid; render(root); },
              },
                h('span.forge-row-name', {
                  style: { color: RPG.data.rarities[item.rarity].color },
                  text: item.name + (item.plus ? ` +${item.plus}` : ''),
                }),
                h('span.forge-row-sub', {
                  text: `${RPG.units.SLOT_LABEL[item.slot]} / スコア ${RPG.gear.score(item)}` +
                    (owner[item.uid] ? ` / ${owner[item.uid]}` : ''),
                })
              )
            ))
      ),
      h('div.col-right',
        W.heading('鍛冶', '装備を強化して伸ばし、副オプションを振り直す。素材には不要な装備を使う。'),
        target ? forgePanel(root, target, owner) : h('p.empty', { text: '左から装備を選んでください。' })
      )
    );
  }

  /**
   * @param {HTMLElement} root
   * @param {any} item
   * @param {Record<number, string>} owner
   */
  function forgePanel(root, item, owner) {
    const save = RPG.state.get();
    const info = RPG.enhance.info(item);
    const pick = info.cost ? RPG.enhance.autoPickMaterials(item.uid, info.cost.points) : null;
    const canPayGold = info.cost ? save.gold >= info.cost.gold : false;

    return h('div.forge-panel',
      W.itemCard(item, { equippedBy: owner[item.uid], locked: item.locked }),

      // --- 強化 ---
      h('div.forge-block',
        h('div.forge-block-head',
          h('h4', { text: `強化  +${info.plus} / +${info.max}` }),
          h('span.hint.hint-sm', { text: `平坦ステータス ×${info.rate.toFixed(2)}` })
        ),
        h('div.forge-pips', Array.from({ length: info.max }, (_, i) =>
          h('span.forge-pip' + (i < info.plus ? '.is-lit' : '')))),
        info.atMax
          ? h('p.hint.hint-sm', { text: 'これ以上は強化できません。' })
          : h('div.forge-cost',
              h('div.forge-cost-row',
                h('em', { text: 'ゴールド' }),
                h('b' + (canPayGold ? '' : '.is-short'), { text: info.cost.gold.toLocaleString() + ' G' })
              ),
              h('div.forge-cost-row',
                h('em', { text: '素材' }),
                h('b' + (pick.enough ? '' : '.is-short'), {
                  text: `${pick.total} / ${info.cost.points} ポイント`,
                })
              ),
              h('p.hint.hint-sm', {
                text: pick.enough
                  ? '素材: ' + pick.items.map((/** @type {any} */ m) =>
                      m.name + (m.plus ? `+${m.plus}` : '')).join('、')
                  : '素材が足りません。装備中とロック中のものは素材にできません。',
              }),
              W.button('強化する', () => {
                const res = RPG.enhance.enhance(item.uid, pick.items.map((/** @type {any} */ m) => m.uid));
                if (!res.ok) { RPG.app.toast(res.reason || '失敗'); return; }
                RPG.app.toast(`+${res.plus} に強化しました（${res.spent.gold.toLocaleString()} G / 素材${pick.items.length}個）`);
                RPG.app.refreshTopbar();
                render(root);
              }, {
                variant: canPayGold && pick.enough ? 'primary' : 'ghost',
                disabled: !canPayGold || !pick.enough,
              })
            )
      ),

      // --- 厳選 ---
      h('div.forge-block',
        h('div.forge-block-head',
          h('h4', { text: '厳選' }),
          h('span.hint.hint-sm', { text: '部位とレアリティは変わりません' })
        ),
        item.unique
          ? h('p.hint.hint-sm', { text: 'クエスト報酬の専用装備は厳選できません。' })
          : h('div.forge-cost',
              h('div.forge-cost-row',
                h('em', { text: 'ゴールド' }),
                h('b' + (save.gold >= info.rerollGold ? '' : '.is-short'),
                  { text: info.rerollGold.toLocaleString() + ' G' })
              ),
              h('p.hint.hint-sm', {
                text: '主ステータスと副オプションを振り直します。強化値はそのまま残ります。',
              }),
              W.button('厳選する', () => {
                const before = RPG.gear.score(item);
                if (!confirm(
                  `${info.rerollGold.toLocaleString()} G を払って振り直します。\n` +
                  `現在のスコア ${before} より下がることもあります。よろしいですか？`
                )) return;
                const res = RPG.enhance.reroll(item.uid);
                if (!res.ok) { RPG.app.toast(res.reason || '失敗'); return; }
                const diff = res.after - res.before;
                RPG.app.toast(
                  `スコア ${res.before} → ${res.after}（${diff >= 0 ? '+' : ''}${diff}）`);
                RPG.app.refreshTopbar();
                render(root);
              }, { variant: save.gold >= info.rerollGold ? 'primary' : 'ghost',
                   disabled: save.gold < info.rerollGold })
            )
      ),

      h('p.hint.hint-sm', {
        text: `強化で伸びるのは平坦ステータスだけです。系統タグ倍率・クリティカル率・` +
          `上限突破・軽減は伸びません（ダメージ曲線を宝箱のグレードで決めてしまわないため）。`,
      })
    );
  }

  /* ============================ ガチャ ============================ */

  /** 交換相手を選ぶ画面を開いているか */
  let pityPickOpen = false;

  /**
   * 天井 (§6.6)。
   *
   * 排出率だけで回していると、後半は「欲しいキャラが出るまで連打する」作業になる。
   * 引くたびに貯まる点で好きな相手と交換できるようにして、
   * **運が悪くても必ず終わる** という保証をつける。
   *
   * @param {HTMLElement} root
   */
  function pityPanel(root) {
    const p = RPG.gacha.pity();
    const pct = Math.min(100, (p.points % p.need) / p.need * 100);

    return h('div.pity',
      h('div.pity-head',
        h('span.pity-label', { text: '交換ポイント' }),
        h('b.pity-value', { text: p.points.toLocaleString() }),
        p.ready > 0
          ? h('span.chip.chip-done', { text: `${p.ready}体ぶん交換できる` })
          : h('span.pity-next', { text: `次の1体まで あと${p.toNext}回` })
      ),
      h('div.pity-track', h('div.pity-fill', { style: { width: pct + '%' } })),
      h('p.hint.hint-sm', {
        text: `${p.need}回引くごとに、好きな仲間を1人選べる。` +
          '持っている相手を選ぶと限界突破になる。余ったポイントは残る。',
      }),

      p.ready > 0
        ? W.button(pityPickOpen ? '選ぶのをやめる' : '交換する相手を選ぶ', () => {
            pityPickOpen = !pityPickOpen;
            render(root);
          }, { variant: pityPickOpen ? 'ghost' : 'primary' })
        : null,

      pityPickOpen && p.ready > 0
        ? h('div.pity-picks', RPG.gacha.exchangeable().map((/** @type {string} */ id) => {
            const def = RPG.data.characters[id];
            const owned = RPG.state.get().characters[id];
            const maxed = owned && owned.limitBreak >= RPG.data.gacha.maxLimitBreak;
            const r = RPG.data.rarities[def.rarity];
            return h('button.pity-pick' + (maxed ? '.is-maxed' : ''), {
              disabled: !!maxed,
              onclick: () => {
                const label = owned ? `${def.name} を限界突破` : `${def.name} を仲間にする`;
                if (!confirm(`${p.need} ポイントを使って ${label} しますか？`)) return;
                const res = RPG.gacha.exchange(id);
                if (!res.ok) { RPG.app.toast(res.reason || '交換できません'); return; }
                RPG.app.toast(res.kind === 'new'
                  ? `${def.name} が仲間になった`
                  : `${def.name} が ${res.limitBreak}凸 になった`);
                if (RPG.gacha.pity().ready === 0) pityPickOpen = false;
                RPG.app.refreshTopbar();
                render(root);
              },
            },
              h('span.pity-pick-name', { style: { color: r.color }, text: def.name }),
              h('span.pity-pick-sub', {
                text: maxed ? '完凸済み'
                  : (owned ? `${owned.limitBreak}凸 → ${owned.limitBreak + 1}凸` : '未所持'),
              })
            );
          }))
        : null
    );
  }

  /** @param {HTMLElement} root */
  function renderGacha(root) {
    const save = RPG.state.get();
    const cfg = RPG.data.gacha;
    const weights = RPG.gacha.effectiveWeights();
    const total = Object.keys(weights).reduce((s, k) => s + weights[k], 0);
    const pool = RPG.gacha.poolByRarity();

    return h('div.pane',
      W.heading('ガチャ', '通貨はゴールドのみ。被りは自動で限界突破に変わり、完凸後はゴールドに還元される。'),
      h('div.gacha-panel',
        h('div.gacha-actions',
          W.button(`1回引く`, () => doPull(root, 1), {
            variant: 'primary', sub: `${cfg.cost.toLocaleString()} G`, disabled: save.gold < cfg.cost,
          }),
          W.button(`${cfg.multiCount}連引く`, () => doPull(root, cfg.multiCount), {
            variant: 'primary', sub: `${(cfg.cost * cfg.multiCount).toLocaleString()} G`,
            disabled: save.gold < cfg.cost * cfg.multiCount,
          }),
          // 演出の入切 (§6.7)。何十回も回す人のための逃げ道。
          // 演出そのものは触れば飛ばせるが、毎回触るのも手間なので
          // 丸ごと切れる場所を作る。
          h('button.toggle' + ((save.settings || {}).gachaFx === false ? '' : '.is-on'), {
            'aria-pressed': (save.settings || {}).gachaFx === false ? 'false' : 'true',
            onClick: () => {
              RPG.state.updateSettings({ gachaFx: (save.settings || {}).gachaFx === false });
              render(root);
            },
          }, h('span.toggle-dot'), h('span', { text: '演出' }))
        ),
        pityPanel(root),
        h('div.gacha-odds',
          h('h4', { text: '排出率' }),
          h('div.odds-rows', Object.keys(weights).map((rarity) => {
            const r = RPG.data.rarities[rarity];
            const pct = (weights[rarity] / total) * 100;
            return h('div.odds-row',
              h('span.odds-label', { style: { color: r.color }, text: r.label }),
              h('div.odds-track', h('div.odds-fill', { style: { width: pct + '%', background: r.color } })),
              h('span.odds-value', { text: pct.toFixed(1) + '%' }),
              h('span.odds-pool', { text: `${pool[rarity].length}種` })
            );
          })),
          h('p.hint.hint-sm', {
            text: `完凸(${cfg.maxLimitBreak}凸)後の被りは ` +
              Object.keys(RPG.data.rarities)
                .map((k) => `${RPG.data.rarities[k].label} ${RPG.data.rarities[k].refund}G`).join(' / ') +
              ' に還元されます。',
          })
        )
      ),
      lastPulls.length && pullRevealed
        ? h('div.pull-result',
            h('h3', { text: `結果（${lastPulls.length}回）` }),
            // 1枚ずつ順にめくる。同時に全部出すと、どれが当たりか探すことになる。
            // 強いものを後ろに回して、最後まで見る理由を残す。
            h('div.pull-grid', orderForReveal(lastPulls).map((p, i) => pullCard(p, i)))
          )
        : null,
      h('p.hint', { text: `所持ゴールド ${save.gold.toLocaleString()} G ／ 累計 ${save.stats.pulls} 回` })
    );
  }

  /**
   * めくる順に並べ替える (§6.7)。
   * 強いものほど後ろへ回す。先頭でレジェンドが出ると、
   * 残り9枚をめくる理由が無くなる。
   * @param {any[]} list
   */
  function orderForReveal(list) {
    const rank = (/** @type {string} */ r) => RARITY_ORDER.indexOf(r);
    return list.slice().sort((a, b) => rank(a.rarity) - rank(b.rarity));
  }

  /** @param {any} p @param {number} [index] めくる順 */
  function pullCard(p, index) {
    const def = RPG.data.characters[p.id];
    const r = RPG.data.rarities[p.rarity];
    const badge =
      p.kind === 'new' ? { text: 'NEW', cls: 'is-new' }
      : p.kind === 'limit_break' ? { text: `+${p.limitBreak} 凸`, cls: 'is-lb' }
      : { text: `+${p.gold} G`, cls: 'is-refund' };

    return h('div.pull-card.' + badge.cls
      + (p.rarity === 'LEGEND' ? '.is-legend' : '')
      + (p.rarity === 'SUPER_RARE' ? '.is-sr' : ''), {
      style: `border-color: ${r.color}66; --rare: ${r.color};`
        + ` --flip-delay: ${(index || 0) * 0.09}s`,
    },
      W.portrait(def, 'md'),
      h('div.pull-info',
        h('span.name', { style: { color: r.color }, text: RPG.state.charName(p.id) }),
        h('span.sub', { text: r.label }),
        h('span.pull-badge', { text: badge.text }),
        p.kind === 'limit_break' ? h('span.pull-note', { text: 'ボーナスSP +1' }) : null,
        p.kind === 'new' ? h('span.pull-note', { text: def.title }) : null
      )
    );
  }

  /**
   * @param {HTMLElement} root
   * @param {number} count
   */
  function doPull(root, count) {
    const outcome = RPG.gacha.pull(count);
    if (outcome.results.length === 0) {
      RPG.app.toast('ゴールドが足りません');
      return;
    }
    lastPulls = outcome.results;
    // 結果はもう確定しているが、演出が終わるまで画面には出さない (§6.7)。
    // 先に出すと、演出の後ろに答えが見えている状態になる。
    pullRevealed = false;

    const save = RPG.state.get();
    save.stats.pulls += outcome.results.length;

    // 新規獲得したキャラは空きがあれば自動でパーティへ入れる
    const joined = [];
    for (const p of outcome.results) {
      if (p.kind === 'new' && RPG.state.tryJoinParty(p.id)) joined.push(RPG.state.charName(p.id));
    }
    RPG.state.persist();

    const news = outcome.results.filter((/** @type {any} */ p) => p.kind === 'new').length;
    const lbs = outcome.results.filter((/** @type {any} */ p) => p.kind === 'limit_break').length;
    const refund = outcome.results.reduce((/** @type {number} */ s, /** @type {any} */ p) => s + (p.gold || 0), 0);
    const parts = [];
    if (news) parts.push(`新規 ${news}体`);
    if (lbs) parts.push(`限界突破 ${lbs}回`);
    if (refund) parts.push(`還元 ${refund.toLocaleString()} G`);
    if (joined.length) parts.push(`${joined.join('、')} が加入`);

    RPG.app.refreshTopbar();
    render(root);

    // 光が育ち、色が決まり、弾けてから結果をめくる (§6.7)。
    // トーストは演出の邪魔になるので、終わってから出す。
    RPG.ui.gachafx.play(outcome.results, () => {
      pullRevealed = true;
      RPG.app.toast(parts.join(' ／ ') || '結果なし');
      render(root);
    });
  }

  /* ============================ 鑑定 ============================ */

  /** @param {HTMLElement} root */
  function renderIdentify(root) {
    const save = RPG.state.get();
    const boxIds = Object.keys(save.boxes).filter((id) => save.boxes[id] > 0);

    const totalBoxes = boxIds.reduce((s, id) => s + save.boxes[id], 0);

    return h('div.pane',
      W.heading('宝箱の鑑定', '戦闘で手に入れた宝箱を開封し、ランダムな能力値を持つ装備を生成する。'),
      totalBoxes > 1
        ? h('div.identify-all',
            h('span', { text: `未開封の宝箱が ${totalBoxes} 個あります` }),
            W.button('すべて開封', () => {
              lastIdentified = [];
              lastAutoSold = null;
              for (const id of boxIds) openBoxes(id, save.boxes[id], true);
              summariseIdentify();
              render(root);
            }, { variant: 'primary' })
          )
        : null,
      boxIds.length === 0
        ? h('p.empty', { text: '宝箱がありません。出撃して手に入れましょう。' })
        : h('div.box-grid', boxIds.map((id) => {
            const box = RPG.data.boxes[id];
            return h('div.box-card', { style: { borderColor: box.color + '66' } },
              h('div.box-icon', { style: { background: `radial-gradient(circle at 35% 30%, ${box.color}, #14171d 75%)` } },
                W.icon('tab-identify', { size: '30px', color: '#fff' })
              ),
              h('div.box-name', { style: { color: box.color }, text: box.name }),
              h('div.box-count', { text: '×' + save.boxes[id] }),
              h('div.box-actions',
                W.button('1つ開封', () => { openBoxes(id, 1); render(root); }),
                W.button('全部開封', () => { openBoxes(id, save.boxes[id]); render(root); }, { variant: 'ghost' })
              )
            );
          })),
      lastIdentified.length
        ? h('div.identify-result',
            h('div.section-head',
              h('h3', { text: `鑑定結果（${lastIdentified.length} 個）` }),
              identifyBreakdown(lastIdentified)
            ),
            lastAutoSold
              ? h('p.hint.hint-sm', {
                  text: `自動売却: ${lastAutoSold.count} 個を売って ` +
                    `${lastAutoSold.gold.toLocaleString()} G を得ました` +
                    (lastAutoSold.protectedCount
                      ? `（更新候補 ${lastAutoSold.protectedCount} 個は残しています）` : ''),
                })
              : null,
            // 表示する枚数に上限を設ける (§7.9)。
            // 上限が無いと、500個まとめて開いたときにカードを500枚組み立てることになり、
            // DOMが1万5千要素を超える。スマホではここで固まって落ちる（実測: 2000個で5万7千要素）。
            // そもそも500枚を目で追う人はいないので、良い順に上位だけ見せて残りは件数で示す。
            (function () {
              const sorted = lastIdentified.slice()
                .sort((a, b) => RPG.gear.score(b) - RPG.gear.score(a));
              const shown = sorted.slice(0, IDENTIFY_SHOW_MAX);
              const rest = sorted.length - shown.length;
              return h('div',
                h('div.item-grid', shown.map((item) => W.itemCard(item))),
                rest > 0
                  ? h('p.hint.hint-sm', {
                      text: `評価の高い ${shown.length} 個を表示しています。` +
                        `残り ${rest} 個は「装備」タブで確認できます。`,
                    })
                  : null
              );
            })()
          )
        : null,
      autoSellPanel(root)
    );
  }

  /**
   * 自動売却ルールの設定と手動実行 (§7.4)。
   * 実行前に必ず件数と金額を見せる。
   * @param {HTMLElement} root
   */
  function autoSellPanel(root) {
    const r = RPG.autosell.rules();
    const found = RPG.autosell.candidates();
    const rerender = () => render(root);

    /** @param {string} label @param {boolean} active @param {() => void} onClick */
    const pill = (label, active, onClick) =>
      h('button.pill' + (active ? '.is-on' : ''), { onClick, text: label });

    return h('div.autosell',
      h('div.section-head',
        h('h3', { text: '自動売却ルール' }),
        h('span.hint.hint-sm', { text: 'ロック中・装備中は常に対象外' })
      ),
      h('div.toolbar-row',
        h('span.toolbar-label', { text: '売却対象' }),
        ...RARITY_ORDER.map((rarity) => pill(RPG.data.rarities[rarity].label, !!r.rarities[rarity], () => {
          const next = Object.assign({}, r.rarities);
          next[rarity] = !next[rarity];
          RPG.autosell.updateRules({ rarities: next });
          rerender();
        }))
      ),
      h('div.toolbar-row',
        h('span.toolbar-label', { text: 'スコア' }),
        ...[0, 100, 250, 500, 1000].map((v) => pill(v === 0 ? '使わない' : `${v} 未満`, r.minScore === v, () => {
          RPG.autosell.updateRules({ minScore: v });
          rerender();
        }))
      ),
      h('div.toolbar-row',
        h('span.toolbar-label', { text: '安全装置' }),
        pill('更新候補は残す', r.protectUpgrades, () => {
          RPG.autosell.updateRules({ protectUpgrades: !r.protectUpgrades });
          rerender();
        }),
        pill('鑑定時に自動で売る', r.auto, () => {
          RPG.autosell.updateRules({ auto: !r.auto });
          rerender();
        })
      ),
      h('p.hint.hint-sm', {
        text: r.protectUpgrades
          ? 'パーティの誰かの装備より強いものは、条件に合っても売りません。'
          : '安全装置が切れています。条件に合えば更新候補でも売られます。',
      }),
      h('div.autosell-run',
        h('span', {
          text: found.items.length
            ? `いま売却できるのは ${found.items.length} 個 / ${found.gold.toLocaleString()} G` +
              (found.protectedCount ? `（更新候補 ${found.protectedCount} 個は除外）` : '')
            : '売却対象はありません',
        }),
        W.button('ルールで売却', () => {
          if (found.items.length === 0) { RPG.app.toast('売却対象がありません'); return; }
          const ok = confirm(
            `${found.items.length} 個を売却して ${found.gold.toLocaleString()} G を得ます。\n` +
            'ロック中・装備中のものは残ります。よろしいですか？'
          );
          if (!ok) return;
          const res = RPG.autosell.run();
          RPG.app.toast(`${res.count} 個を売却して ${res.gold.toLocaleString()} G を得た`);
          RPG.app.refreshTopbar();
          rerender();
        }, { variant: found.items.length ? 'primary' : 'ghost', disabled: found.items.length === 0 })
      )
    );
  }

  /**
   * 鑑定結果のレアリティ内訳。まとめて開けたときに一覧で把握できるようにする。
   * @param {any[]} items
   */
  function identifyBreakdown(items) {
    /** @type {Record<string, number>} */
    const counts = {};
    for (const it of items) counts[it.rarity] = (counts[it.rarity] || 0) + 1;
    return h('div.breakdown', RARITY_ORDER.slice().reverse()
      .filter((r) => counts[r])
      .map((r) => h('span.chip', {
        style: { color: RPG.data.rarities[r].color, borderColor: RPG.data.rarities[r].color + '66' },
        text: `${RPG.data.rarities[r].label} ${counts[r]}`,
      })));
  }

  /**
   * @param {string} boxId
   * @param {number} count
   * @param {boolean} [keep] true なら lastIdentified を初期化せず追記する
   */
  function openBoxes(boxId, count, keep) {
    if (!keep) { lastIdentified = []; lastAutoSold = null; }
    // まとめて処理する。1個ずつだとセーブの書き込みが個数の2乗で効いてくる (§7.9)。
    for (const item of RPG.state.identifyBoxes(boxId, count)) {
      lastIdentified.push(item);
    }
    if (!keep) summariseIdentify();
  }

  /**
   * 鑑定結果をトーストで知らせ、設定されていれば自動売却を掛ける。
   * 売却は「今回鑑定した分」だけを対象にする。持っていた装備を巻き込むと事故になるため。
   */
  function summariseIdentify() {
    if (!lastIdentified.length) return;
    const best = lastIdentified.slice().sort((a, b) => RPG.gear.score(b) - RPG.gear.score(a))[0];
    RPG.app.toast(`${lastIdentified.length}個 鑑定 — 最高は「${best.name}」`);

    if (RPG.autosell.rules().auto) {
      const res = RPG.autosell.run(lastIdentified);
      lastAutoSold = res.count > 0 || res.protectedCount > 0 ? res : null;
      if (res.count > 0) {
        // 売れたものは手元に無いので結果一覧からも消す
        const owned = RPG.state.get().inventory;
        lastIdentified = lastIdentified.filter((it) =>
          owned.some((/** @type {any} */ x) => x.uid === it.uid));
        RPG.app.toast(`自動売却 ${res.count} 個 — ${res.gold.toLocaleString()} G`);
      }
    }
    RPG.app.refreshTopbar();
  }

  /* ============================ 装備 ============================ */

  /** @param {HTMLElement} root */
  function renderGear(root) {
    const save = RPG.state.get();
    const charSave = save.characters[selectedChar];
    const unit = RPG.units.buildCharacterUnit(charSave, save.inventory);
    const slots = RPG.units.slotCounts(charSave);

    /** どの装備を誰が着けているか */
    const owner = /** @type {Record<number, string>} */ ({});
    for (const id of Object.keys(save.characters)) {
      const c = save.characters[id];
      for (const slot of Object.keys(c.equipped)) {
        for (const uid of c.equipped[slot]) owner[uid] = RPG.state.charName(id);
      }
    }

    const equippedUids = new Set(unit.equippedItems.map((/** @type {any} */ i) => i.uid));
    const inventory = applyGearView(save.inventory, owner);

    return h('div.pane.pane-split',
      h('div.col-left',
        h('h3', { text: 'キャラクター' }),
        charSelector(root)
      ),
      h('div.col-right',
        h('div.char-detail',
          W.standee(unit),
          h('div.char-detail-info',
            h('div.char-title',
              h('h2', { text: unit.name }),
              W.rarityChip(unit.rarity),
              W.elementChip(unit.element),
              RPG.data.characters[selectedChar].nameEditable
                ? W.button('名前を変更', () => promptRename(root, selectedChar), { variant: 'ghost' })
                : null
            ),
            h('p.char-desc', { text: RPG.data.characters[selectedChar].desc }),
            h('div.stat-grid', ['hp', 'atk', 'def', 'magi_power'].map((k) =>
              h('div.stat', h('span', W.icon(W.STAT_ICON[k]), h('em', { text: RPG.units.STAT_LABEL[k] })), h('b', { text: unit.stats[k].toLocaleString() }))
            )),
            renderTagSummary(unit),
            renderSetSummary(unit)
          )
        ),
        h('div.section-head',
          h('h3', { text: '装備スロット' }),
          h('div.auto-equip',
            W.button('自動装備', () => {
              const r = RPG.autoequip.forCharacter(selectedChar, { keepLocked: true });
              const gain = r.before > 0 ? Math.round((r.after / r.before - 1) * 100) : 0;
              RPG.app.toast(r.changed === 0
                ? 'すでに最適な装備です'
                : `${r.changed}箇所を更新（総合力 ${gain >= 0 ? '+' : ''}${gain}%）`);
              render(root);
            }, { variant: 'primary', sub: 'このキャラ' }),
            W.button('全員まとめて', () => {
              const r = RPG.autoequip.forParty({ keepLocked: true });
              RPG.app.toast(r.changed === 0
                ? 'パーティ全員すでに最適です'
                : `パーティ${r.perCharacter.length}人・計${r.changed}箇所を更新`);
              render(root);
            }, { variant: 'ghost', sub: 'パーティ' })
          )
        ),
        presetBar(root, unit),
        h('div.slot-row', Object.keys(slots).map((slot) => {
          const items = unit.equippedItems.filter((/** @type {any} */ i) => i.slot === slot);
          const cells = [];
          for (let i = 0; i < slots[slot]; i++) {
            const item = items[i];
            cells.push(item
              ? h('div.slot-cell.is-filled',
                  W.itemCard(item),
                  W.button('外す', () => { RPG.state.unequip(selectedChar, item.uid); render(root); }, { variant: 'ghost' })
                )
              : h('div.slot-cell.is-empty', h('span', { text: RPG.units.SLOT_LABEL[slot] + ' 空き' }))
            );
          }
          return h('div.slot-group', h('h4', W.icon(W.SLOT_ICON[slot]), h('em', { text: RPG.units.SLOT_LABEL[slot] })), h('div.slot-cells', cells));
        })),
        h('div.section-head',
          h('h3', { text: `所持装備（${inventory.length} / ${save.inventory.length}）` }),
          bulkSellButton(root, inventory, owner)
        ),
        // 一覧にも上限を設ける (§7.9)。
        // 周回を続けると所持数は数百に達し、全部並べるとスマホが固まる。
        // 絞り込みと並べ替えがあるので、見たいものは上位に持ってこられる。
        // 何順の上位なのかを書く。並べ替えを増やしたので、
        // 「上位120個」だけでは何の上位なのか分からない。
        inventory.length > INVENTORY_SHOW_MAX
          ? h('p.hint.hint-sm', {
              text: `${(SORTS.find((x) => x.id === gearView.sort) || {}).label || ''}`
                + `の上位 ${INVENTORY_SHOW_MAX} 個を表示しています`
                + `（該当 ${inventory.length} 個）。並べ替えと絞り込みで目的の装備を先頭へ持ってこられます。`,
            })
          : null,
        gearToolbar(root, save.inventory),
        inventory.length === 0
          ? h('p.empty', {
              text: save.inventory.length === 0
                ? '装備がありません。宝箱を鑑定しましょう。'
                : '条件に合う装備がありません。絞り込みを外してください。',
            })
          : h('div.item-grid', inventory.slice(0, INVENTORY_SHOW_MAX).map((/** @type {any} */ item) =>
              h('div.inv-entry' + (item.locked ? '.is-locked' : ''),
                W.itemCard(item, {
                  equippedBy: owner[item.uid],
                  selected: equippedUids.has(item.uid),
                  locked: item.locked,
                }),
                h('div.inv-actions',
                  W.button(equippedUids.has(item.uid) ? '装備中' : '装備する', () => {
                    RPG.state.equip(selectedChar, item.uid);
                    render(root);
                  }, { disabled: equippedUids.has(item.uid) }),
                  W.button(item.locked ? 'ロック中' : 'ロック', () => {
                    RPG.state.toggleLock(item.uid);
                    render(root);
                  }, { variant: 'ghost', title: item.locked ? 'ロックを解除' : 'ロックして一括売却から守る' }),
                  W.button('売却', () => {
                    if (item.locked) { RPG.app.toast('ロック中の装備は売却できません'); return; }
                    const gold = RPG.state.sell(item.uid);
                    RPG.app.toast(`売却して ${gold.toLocaleString()} G を得た`);
                    RPG.app.refreshTopbar();
                    render(root);
                  }, { variant: 'ghost', disabled: !!item.locked })
                )
              )
            ))
      )
    );
  }

  /**
   * 並べ替えと絞り込みを適用する。
   * @param {any[]} inventory
   * @param {Record<number, string>} owner
   */
  function applyGearView(inventory, owner) {
    // 絞り込みと並べ替えの中身は gear.js が持つ (§7.4)。
    // 画面に置いておくと、表示上限で切られた後しか検査できない。
    return RPG.gear.arrange(inventory, gearView, owner);
  }

  /**
   * 装備プリセットの保存と切り替え (§7.5)。
   *
   * 装備は「1つを1人だけ」なので、他のキャラから取り上げることになる場合は
   * 適用前に相手の名前を出して確認する。
   * @param {HTMLElement} root
   * @param {any} unit
   */
  function presetBar(root, unit) {
    const list = RPG.state.presets(selectedChar);
    const save = RPG.state.get();

    /** そのプリセットが何を指しているかの1行要約 */
    const describe = (/** @type {any} */ preset) => {
      const uids = Object.keys(preset.equipped)
        .reduce((/** @type {number[]} */ acc, slot) => acc.concat(preset.equipped[slot]), []);
      const alive = uids.filter((uid) => save.inventory.some((/** @type {any} */ it) => it.uid === uid));
      const gear = `装備${alive.length}点` + (alive.length < uids.length ? `（${uids.length - alive.length}点は売却済み）` : '');
      if (preset.scope !== 'full') return gear;
      // ビルド込みの枠は、何が入っているかを数で見せる。
      // 「ビルド込み」とだけ書いても、中身が空なのか詰まっているのか分からない。
      const sp = RPG.tree.spentSp(preset.tree || {});
      const kl = preset.klass && RPG.data.classes[preset.klass]
        ? RPG.data.classes[preset.klass].name : 'クラス無し';
      return `${gear} ／ SP${sp} ／ ${kl}`;
    };

    const slots = RPG.state.presetSlots();
    const nextCost = RPG.state.nextSlotCost();
    const partyNames = RPG.state.partyPresetNames();

    return h('div.presets',
      h('div.presets-head',
        h('span.presets-label', { text: 'プリセット' }),
        h('span.presets-slots', { text: `${slots}枠` })
      ),
      // パーティ一括 (§7.5-2)。
      // 「ボス用」「周回用」を4人ぶん切り替えるのが本来の目的なので、
      // 同じ名前が2人以上に付いているときだけ、その名前で一括適用を出す。
      partyNames.length ? h('div.preset-party',
        h('span.preset-party-label', { text: 'パーティ一括' }),
        h('div.preset-party-btns', partyNames.map((/** @type {string} */ name) =>
          W.button(name, () => {
            if (!confirm(`パーティ全員に「${name}」を適用しますか？`)) return;
            const res = RPG.state.applyPartyPreset(name);
            const parts = [];
            if (res.applied.length) parts.push(`${res.applied.length}人に適用`);
            for (const sk of res.skipped) parts.push(`${sk.name}: ${sk.reason}`);
            RPG.app.toast(parts.join(' ／ ') || '適用できる枠がありません');
            render(root);
          }, { variant: 'ghost' })
        ))
      ) : null,
      h('div.preset-slots', list.map((preset, i) =>
        h('div.preset-slot' + (preset ? '.is-filled' : ''),
          preset
            ? h('div.preset-info',
                h('span.preset-name', { text: preset.name }),
                h('span.preset-sub', { text: describe(preset) })
              )
            : h('div.preset-info', h('span.preset-sub', { text: `空き枠 ${i + 1}` })),
          h('div.preset-actions',
            preset
              ? W.button('適用', () => {
                  // ビルド込みはツリーを丸ごと差し替えるので、必ず確認を挟む。
                  // 装備だけなら着け替えるだけなので、今までどおり即座に適用する。
                  if (preset.scope === 'full') {
                    const cost = RPG.state.presetApplyCost(selectedChar, i);
                    const price = cost > 0 ? `
費用 ${cost.toLocaleString()} G` : '';
                    if (!confirm(`${unit.name} のビルドを「${preset.name}」に入れ替えます。`
                      + `
今のスキルツリーとクラスは失われます。${price}`)) return;
                  }
                  const res = RPG.state.applyPreset(selectedChar, i);
                  if (!res.ok) { RPG.app.toast(res.reason || '失敗'); return; }
                  const parts = [`${res.applied}点を装備`];
                  if (res.missing) parts.push(`${res.missing}点は売却済みで欠番`);
                  if (res.stolen && res.stolen.length) parts.push(`${res.stolen.join('、')}から移動`);
                  if (res.build) {
                    parts.unshift('ビルドを入れ替え');
                    if (res.build.cost) parts.push(`${res.build.cost.toLocaleString()} G`);
                    // 更新で消えたノードは黙って落とすと数が合わなくなるので必ず告げる
                    if (res.build.lostNodes.length) {
                      parts.push(`${res.build.lostNodes.length}個のノードは現在存在しません`);
                    }
                  }
                  RPG.app.toast(parts.join(' ／ '));
                  render(root);
                }, { variant: 'primary' })
              : null,
            // 保存は「装備だけ」と「ビルド込み」の2種類。
            // 常にビルド込みにすると、ツリーに触らず装備だけ替える今の使い方が壊れる。
            W.button(preset ? '上書き' : '装備を保存', () => {
              savePresetAt(root, i, preset, 'gear');
            }, { variant: 'ghost' }),
            W.button(preset && preset.scope === 'full' ? 'ビルドで上書き' : 'ビルド込みで保存', () => {
              savePresetAt(root, i, preset, 'full');
            }, { variant: 'ghost' }),
            preset
              ? W.button('削除', () => {
                  if (!confirm(`「${preset.name}」を削除しますか？`)) return;
                  RPG.state.deletePreset(selectedChar, i);
                  render(root);
                }, { variant: 'ghost' })
              : null
          )
        )
      )),
      // 枠の購入 (§7.5-2)。上限まで買っていれば出さない。
      nextCost != null ? h('div.preset-buy',
        h('span.preset-buy-text', {
          text: `枠を増やす（${slots + 1}枠目）… ${nextCost.toLocaleString()} G`,
        }),
        W.button('購入', () => {
          if (!confirm(`プリセット枠を1つ増やしますか？
${nextCost.toLocaleString()} G

枠は全キャラ共通で増えます。`)) return;
          const res = RPG.state.buyPresetSlot();
          if (!res.ok) { RPG.app.toast(res.reason || '失敗'); return; }
          RPG.app.toast(`${res.slots}枠になりました（-${(res.cost || 0).toLocaleString()} G）`);
          RPG.app.refreshTopbar();
          render(root);
        }, { variant: 'ghost' })
      ) : null,
      h('p.hint.hint-sm', {
        text: '枠は全キャラ共通です。「装備を保存」は装備だけ、「ビルド込み」は'
          + 'スキルツリー・クラス・技の並びも一緒に記録します。'
          + '保存済みビルドへの切り替えは無料ですが、'
          + '新しく組み直すときの振り直し費用はこれまでどおりかかります。',
      }),
      h('p.hint.hint-sm', {
        text: '装備は1つを1人だけなので、他のキャラが着けているものを含むプリセットを'
          + '適用すると、そちらから外れます。',
      })
    );
  }

  /**
   * プリセットの保存。名前を訊いてから書き込む。
   * 「装備だけ」と「ビルド込み」で入口が2つあるので、共通部分をここへ出してある。
   * @param {HTMLElement} root
   * @param {number} i
   * @param {any} preset
   * @param {'gear'|'full'} scope
   */
  function savePresetAt(root, i, preset, scope) {
    const fallback = `構成${i + 1}`;
    const label = prompt(
      scope === 'full' ? 'プリセット名（ビルド込み）' : 'プリセット名（装備のみ）',
      preset ? preset.name : fallback
    );
    if (label === null) return;
    const name = label.trim() || fallback;
    RPG.state.savePreset(selectedChar, i, name, scope);
    RPG.app.toast(`「${name}」に保存しました（${scope === 'full' ? 'ビルド込み' : '装備のみ'}）`);
    render(root);
  }

  /**
   * 並べ替え・絞り込みの操作列。
   * @param {HTMLElement} root
   * @param {any[]} all
   */
  function gearToolbar(root, all) {
    /**
     * @param {string} label
     * @param {boolean} active
     * @param {() => void} onClick
     */
    const pill = (label, active, onClick) =>
      h('button.pill' + (active ? '.is-on' : ''), { onClick, text: label });

    const rerender = () => render(root);

    return h('div.gear-toolbar',
      // 並べ替えは選択式にする (§7.4)。
      //
      // 項目ごとの並べ替えを足したら12個になり、狭い画面で4段に折り返した。
      // ツールバーだけで画面の6割を占めてしまい、肝心の装備が見えない。
      // 押しボタンで並べるのは、数が少ないうちだけ成り立つ形だった。
      h('div.toolbar-row',
        h('span.toolbar-label', { text: '並べ替え' }),
        h('select.gear-sort', {
          'aria-label': '装備の並べ替え',
          onChange: (/** @type {any} */ e) => {
            gearView.sort = e.currentTarget.value;
            rerender();
          },
        }, ...SORTS.map((s) => h('option', {
          value: s.id,
          selected: gearView.sort === s.id ? 'selected' : null,
        }, h('span', { text: s.label }))))
      ),
      h('div.toolbar-row',
        h('span.toolbar-label', { text: '部位' }),
        pill('すべて', !gearView.slot, () => { gearView.slot = null; rerender(); }),
        ...SLOT_ORDER.map((slot) =>
          pill(RPG.units.SLOT_LABEL[slot], gearView.slot === slot,
            () => { gearView.slot = gearView.slot === slot ? null : slot; rerender(); }))
      ),
      h('div.toolbar-row',
        h('span.toolbar-label', { text: '系統' }),
        pill('すべて', !gearView.tag, () => { gearView.tag = null; rerender(); }),
        ...RPG.damage.TAGS.map((tag) =>
          pill('[' + RPG.damage.TAG_LABEL[tag] + ']', gearView.tag === tag,
            () => { gearView.tag = gearView.tag === tag ? null : tag; rerender(); }))
      ),
      // ── セットで絞る (§7.7) ──
      //
      // セットは同じものを2個・4個と揃えて初めて効く。
      // 「あと1個足りない」を探すのが主な用途なので、ここで絞れる必要がある。
      // 逆に売る候補を探すときは、セットに属していないものを見たい。
      // どちらも要るので「セット無し」も選べるようにしてある。
      //
      // 何個持っているかを添える。数が見えないと、揃うのかどうかが
      // 一覧を開くまで分からない。
      // 押しボタンで並べると、セット6種＋「すべて」＋「セット無し」で
      // 8個になり、狭い画面で3段に折り返した（実測でツールバーが475px）。
      // 並べ替えと同じく選択式にする。
      // セットとユニークをひとつの選び口にまとめる (§7.7 / §7.8)。
      //
      // ユニークはセットを持たないので、分けずに置くと「セット無し」に
      // 埋もれて取り出せない。しかも系統タグも会心も持たないぶん素の点数が低く、
      // 強い順では上位120個に1つも入らなかった（実測 0/40）。
      // 持っているのに一生見つけられない状態だった。
      //
      // 種類ごとに名指しでも選べるようにしてある。
      // 「巨躯断ちを探す」が主な用途なので。
      h('div.toolbar-row',
        h('span.toolbar-label', { text: '特殊' }),
        h('select.gear-sort', {
          'aria-label': 'セットとユニークで絞り込む',
          onChange: (/** @type {any} */ e) => {
            const v = e.currentTarget.value;
            gearView.set = v === '' ? null : v;
            rerender();
          },
        },
          h('option', { value: '', selected: !gearView.set ? 'selected' : null },
            h('span', { text: 'すべて' })),
          h('option', { value: 'none', selected: gearView.set === 'none' ? 'selected' : null },
            h('span', { text: 'どちらでもない' })),

          h('optgroup', { label: 'セット' },
            ...Object.keys(RPG.data.equipSets || {}).map((id) => {
              const set = RPG.data.equipSets[id];
              const n = all.filter((/** @type {any} */ it) => it.setId === id).length;
              return h('option', { value: id, selected: gearView.set === id ? 'selected' : null },
                h('span', { text: `${set.name}（${n}個）` }));
            })),

          h('optgroup', { label: 'ユニーク' },
            h('option', {
              value: 'unique',
              selected: gearView.set === 'unique' ? 'selected' : null,
            }, h('span', {
              text: `ユニークすべて（${all.filter((/** @type {any} */ it) => it.uniqueId).length}個）`,
            })),
            // 1つも持っていないものは出さない。選んでも空になるだけ。
            ...Object.keys(RPG.data.uniqueEquips || {})
              .map((id) => ({
                id,
                n: all.filter((/** @type {any} */ it) => it.uniqueId === id).length,
              }))
              .filter((u) => u.n > 0)
              .map((u) => h('option', {
                value: 'uq:' + u.id,
                selected: gearView.set === 'uq:' + u.id ? 'selected' : null,
              }, h('span', {
                text: `${RPG.data.uniqueEquips[u.id].name}（${u.n}個）`,
              })))
          )
        )
      ),
      h('div.toolbar-row',
        h('span.toolbar-label', { text: 'レア度' }),
        pill('すべて', !gearView.rarity, () => { gearView.rarity = null; rerender(); }),
        ...RARITY_ORDER.map((r) =>
          pill(RPG.data.rarities[r].label, gearView.rarity === r,
            () => { gearView.rarity = gearView.rarity === r ? null : r; rerender(); })),
        pill('未装備のみ', gearView.onlyUnequipped,
          () => { gearView.onlyUnequipped = !gearView.onlyUnequipped; rerender(); })
      )
    );
  }

  /**
   * 表示中のものだけをまとめて売却する。装備中・ロック中は自動で除外される。
   * @param {HTMLElement} root
   * @param {any[]} shown
   * @param {Record<number, string>} owner
   */
  function bulkSellButton(root, shown, owner) {
    const sellable = shown.filter((it) => !it.locked && !owner[it.uid]);
    const gold = sellable.reduce((s, it) => s + RPG.state.sellValue(it), 0);

    return W.button('表示中をまとめて売却', () => {
      if (sellable.length === 0) { RPG.app.toast('売却できる装備がありません'); return; }
      const ok = confirm(
        `表示中の ${sellable.length} 個を売却して ${gold.toLocaleString()} G を得ます。\n` +
        '装備中とロック中のものは残ります。よろしいですか？'
      );
      if (!ok) return;
      const result = RPG.state.sellMany(sellable.map((it) => it.uid));
      RPG.app.toast(`${result.count} 個を売却して ${result.gold.toLocaleString()} G を得た`);
      RPG.app.refreshTopbar();
      render(root);
    }, {
      variant: 'ghost',
      disabled: sellable.length === 0,
      sub: sellable.length ? `${sellable.length}個 / ${gold.toLocaleString()} G` : '対象なし',
    });
  }

  /**
   * 装備由来の系統タグ倍率を可視化する。ビルドの効き目が一目で分かるようにする (§3.2)。
   * @param {any} unit
   */
  /**
   * 装備セットの発動状況 (§7.7)。
   * 「あと何個で次の段階か」まで出して、揃える動機を見せる。
   * @param {any} unit
   */
  function renderSetSummary(unit) {
    const counts = unit.sets || {};
    const ids = Object.keys(counts);
    if (ids.length === 0) return null;

    return h('div.set-summary',
      h('h4', { text: '装備セット' }),
      h('div.set-rows', ids.map((setId) => {
        const set = RPG.data.equipSets[setId];
        const pieces = counts[setId];
        const next = RPG.equipset.nextTier(setId, pieces);
        const active = set.bonuses.filter((/** @type {any} */ b) => pieces >= b.pieces);

        return h('div.set-row',
          h('div.set-row-head',
            h('span.set-name', { style: { color: set.color }, text: `${set.name} ${pieces}個` }),
            next
              ? h('span.set-next', { text: `あと ${next.pieces - pieces} 個で ${next.pieces}セット` })
              : h('span.set-next.is-full', { text: '全段階を発動中' })
          ),
          active.length
            ? h('ul.set-effects', active.map((/** @type {any} */ b) =>
                h('li', { text: `${b.pieces}セット: ${b.label}` })))
            : h('p.hint.hint-sm', { text: set.desc })
        );
      }))
    );
  }

  function renderTagSummary(unit) {
    // 表示は「常時適用される補正」のみで計算する
    const always = unit.baseTagBonuses.filter((/** @type {any} */ b) => !b.matchType);
    const info = RPG.damage.tagMultiplier(always, 'phys');
    return h('div.tag-summary',
      h('div.tag-summary-head', h('span', { text: '系統タグ倍率' }), h('b', { text: '×' + info.multiplier.toFixed(3) })),
      h('div.tag-bars', RPG.damage.TAGS.map((tag) =>
        h('div.tag-bar', { 'data-tag': tag },
          h('span.tag-bar-label', { text: '[' + RPG.damage.TAG_LABEL[tag] + ']' }),
          h('div.tag-bar-track', h('div.tag-bar-fill', { style: { width: Math.min(100, info.sums[tag] * 100) + '%' } })),
          h('span.tag-bar-value', { text: '+' + Math.round(info.sums[tag] * 100) + '%' })
        )
      )),
      h('p.hint.hint-sm', { text: '同じタグ内は加算、異なるタグ同士は乗算。3系統に分散させるほど倍率が伸びる。' })
    );
  }

  /**
   * 主人公の名前変更ダイアログを開く。
   * @param {HTMLElement} root
   * @param {string} charId
   */
  function promptRename(root, charId) {
    RPG.app.showNameDialog(charId, { onDone: () => render(root) });
  }

  /* ============================ ビルド（スキルツリー） ============================ */

  /** @param {HTMLElement} root */
  function renderBuild(root) {
    const save = RPG.state.get();
    const charSave = save.characters[selectedChar];
    const def = RPG.data.characters[selectedChar];
    const tree = charSave.tree || {};
    const unit = RPG.units.buildCharacterUnit(charSave, save.inventory);

    const totalSp = RPG.state.totalSp(selectedChar);
    const spent = RPG.tree.spentSp(tree);
    const available = totalSp - spent;
    const resetCost = RPG.tree.resetCost(charSave.level);

    return h('div.pane.pane-split',
      h('div.col-left',
        h('h3', { text: 'キャラクター' }),
        charSelector(root)
      ),
      h('div.col-right',
        h('div.build-head',
          W.portrait(def, 'md'),
          h('div.build-head-info',
            h('div.char-title',
              h('h2', { text: RPG.state.charName(selectedChar) }),
              charSave.limitBreak > 0 ? h('span.chip.chip-lb', { text: `${charSave.limitBreak}凸` }) : null
            ),
            h('p.hint.hint-sm', {
              text: `合計SP = (レベル${charSave.level} - 1) + 限界突破${charSave.limitBreak} = ${totalSp}`,
            })
          )
        ),

        // 固有能力。ここに出さないと、どの方向に振るべきか確かめるために
        // 毎回 図鑑を開いて戻ってくることになる。
        h('div.innate',
          h('div.innate-head',
            h('span.innate-tag', { text: '固有' }),
            h('b', { text: def.title })
          ),
          h('p', { text: def.desc })
        ),

        // 残りSPは常に見える位置に貼り付ける。
        // 下のほうのノードを見ているときに「あと何ポイント残っているか」を
        // 確かめるためだけに、いちいち上まで戻る必要をなくす。
        h('div.sp-bar',
          h('span.sp-bar-value', { text: String(available) }),
          h('span.sp-bar-label', { text: `残りSP` }),
          h('span.sp-bar-sub', { text: `合計 ${totalSp} ／ 消費 ${spent}` }),
          W.button('振り直す', () => {
            if (!confirm(`${resetCost.toLocaleString()} G を消費して全て振り直しますか？`)) return;
            const res = RPG.state.resetTree(selectedChar);
            if (!res.ok) { RPG.app.toast(res.reason || '失敗'); return; }
            RPG.app.toast(`${(res.cost || 0).toLocaleString()} G を消費して振り直しました`);
            RPG.app.refreshTopbar();
            render(root);
          }, { variant: 'ghost', sub: `${resetCost.toLocaleString()} G`, disabled: spent === 0 })
        ),

        buildSummary(unit),
        damageBreakdown(root, unit, charSave),
        skillOrderPanel(root, charSave, unit),
        classPanel(root, charSave),
        treeBrowser(root, charSave)
      )
    );
  }

  /**
   * ダメージの内訳を、実際に計算して見せる (§3.2)。
   *
   * ── なぜ要るのか ──
   * 「火力」「与ダメージ」「ATK」が加算なのか乗算なのか、
   * 説明文からは読み取れない。プレイヤーは自分で検証するしかなく、
   * 検証しても確信が持てない。
   *
   * ここでは **実際に damage.calc を通した結果** を段ごとに出す。
   * 説明ではなく計算そのものなので、式が変わればここも自動で変わる。
   *
   * 相手は「同レベルの基準敵」。絶対値ではなく、
   * どの段が何倍効いているかを見るための物差しにしている。
   *
   * @param {HTMLElement} root @param {any} unit @param {any} charSave
   */
  function damageBreakdown(root, unit, charSave) {
    // いちばん素直な攻撃技を選ぶ。補助や特殊な技だと段の見え方が変わる。
    const skillId = (unit.skills || []).find((/** @type {string} */ id) => {
      const sk = RPG.data.skills[id];
      return sk && sk.power > 0 && !sk.plugin;
    }) || (unit.skills || [])[0];
    const skill = RPG.data.skills[skillId];
    if (!skill || !skill.power) return null;

    const level = charSave.level;
    const defender = RPG.autoequip.referenceDefender(level);
    const attacker = RPG.units.toAttacker(unit);

    // 乱数と会心を止めて、素の倍率だけを見る
    const r = RPG.damage.calc({
      attacker, defender, skill,
      options: { crit: false },
    });
    const b = r.breakdown;

    /** @param {number} v */
    const x = (v) => '×' + (v || 1).toFixed(3);

    const rows = [
      ['基礎', Math.round(b.base).toLocaleString(),
        `${RPG.units.STAT_LABEL[skill.scaling_stat] || skill.scaling_stat} × 威力${skill.power}%`],
      ['系統タグ', x(b.tag), '同じタグは足し算、違うタグは掛け算'],
      ['固有バフ', x(b.unique), 'それぞれ独立して掛かる'],
      ['防御', x(b.defense), `相手 DEF ${defender.def.toLocaleString()}`],
      ['属性', x(b.element), '有利・不利'],
      ['追い打ち', x(b.execute), '相手のHPが減っているほど'],
      ['戦況', x(b.situational), 'ラウンド・人数・残HPなど'],
      ['相手の軽減', x(b.taken), '相手側の減算'],
    ].filter((row) => row[1] !== '×1.000' || row[0] === '基礎' || row[0] === '防御');

    return h('section.dmg-break',
      h('button.dmg-break-head', {
        onclick: () => { dmgBreakOpen = !dmgBreakOpen; render(root); },
        'aria-expanded': dmgBreakOpen ? 'true' : 'false',
      },
        h('span.cat-mark', { text: dmgBreakOpen ? '▼' : '▶' }),
        h('span.cat-label', { text: 'ダメージの内訳' }),
        h('span.cat-count', { text: Math.round(r.damage).toLocaleString() }),
        h('span.cat-desc', { text: `${skill.name} を同レベルの基準敵に当てたとき` })
      ),
      dmgBreakOpen
        ? h('div.dmg-break-body',
            h('table.dmg-table',
              h('tbody', rows.map((row) =>
                h('tr',
                  h('th', { text: row[0] }),
                  h('td.dmg-val', { text: row[1] }),
                  h('td.dmg-note', { text: row[2] })
                )
              ))
            ),
            h('p.hint.hint-sm', {
              text: `会心は ${(1.5 + (unit.critDamage || 0)).toFixed(2)}倍（発生率 `
                + `${Math.round((unit.baseCritRate || 0) * 100)}%）。`
                + `最後に 0.85〜1.15 の乱数が掛かり、上限 `
                + `${(RPG.damage.constants.BASE_DAMAGE_CAP * (1 + (unit.capBreak || 0))).toLocaleString()} `
                + 'を超えたぶんは10%まで減衰する。',
            }),
            h('p.hint.hint-sm', {
              text: '各段は掛け算で繋がる。同じ段の中だけが足し算になる'
                + '（同じ系統タグを複数積んだ場合など）。',
            })
          )
        : null
    );
  }

  /**
   * 戦闘コマンドの並び替え (§4)。
   *
   * 技が増えると、よく使うものが一覧の後ろに埋もれる。戦闘中に毎ターン
   * 下までスクロールして探すことになるので、ここで前へ出せるようにした。
   *
   * 戦闘中ではなくビルド画面に置いてある。戦闘は手を止めたくない場面で、
   * 並べ替えのような落ち着いた操作を混ぜる場所ではない。
   *
   * ── ここで技の中身も読める ──
   * 技の説明は戦闘中のボタンにしか出ていなかった。つまり
   * **編成や振り分けを考えている最中に、手持ちの技を確認できない**。
   * 戦う前に「この技は何をするのか」を読める場所が要る。
   *
   * 出す内容は戦闘画面のボタンと揃えてある。同じ技が場所によって
   * 違う顔で出てくると、照合するのに読み直すことになる。
   *
   * @param {HTMLElement} root @param {any} charSave @param {any} unit
   */
  function skillOrderPanel(root, charSave, unit) {
    const list = unit.skills || [];
    if (list.length < 2) return null;

    return h('section.skill-order',
      h('button.skill-order-head', {
        onclick: () => { skillOrderOpen = !skillOrderOpen; render(root); },
        'aria-expanded': skillOrderOpen ? 'true' : 'false',
      },
        h('span.cat-mark', { text: skillOrderOpen ? '▼' : '▶' }),
        h('span.cat-label', { text: '技と並び順' }),
        h('span.cat-count', { text: `${list.length} 技` }),
        h('span.cat-desc', { text: '覚えている技の効果を読める。戦闘で上から並ぶ順もここで変えられる。' })
      ),
      skillOrderOpen
        ? h('ol.skill-order-list', list.map((/** @type {string} */ id, /** @type {number} */ i) => {
            const sk = RPG.data.skills[id];
            if (!sk) return null;
            const move = (/** @type {number} */ dir) => {
              const res = RPG.state.moveSkill(selectedChar, id, dir);
              if (!res.ok) { RPG.app.toast(res.reason || '動かせません'); return; }
              render(root);
            };
            return h('li.skill-order-item' + (sk.cls ? '.is-class' : ''),
              h('span.skill-order-no', { text: String(i + 1) }),
              h('div.skill-order-body',
                h('div.skill-order-title',
                  h('b.skill-order-name', { text: sk.name }),
                  sk.cls ? h('span.chip.chip-class', { text: 'クラス' }) : null
                ),
                // 戦闘画面のボタンと同じ並び。属性・系統・威力・待ち時間。
                h('div.skill-order-chips',
                  W.elementChip(sk.element),
                  W.tagChip(sk.damage_type),
                  sk.power > 0
                    ? h('span.chip', { text: '威力' + sk.power + '%' })
                    : h('span.chip', { text: '補助' }),
                  sk.crit_rate ? h('span.chip', { text: '会心' + Math.round(sk.crit_rate * 100) + '%' }) : null,
                  sk.readyRound ? h('span.chip', { text: sk.readyRound + 'R目〜' }) : null,
                  sk.cooldown ? h('span.chip', { text: 'CT' + sk.cooldown }) : null
                ),
                h('p.skill-order-desc', { text: sk.desc || '' })
              ),
              h('div.skill-order-moves',
                h('button.skill-order-btn', {
                  text: '↑', title: '前へ', disabled: i === 0,
                  onclick: () => move(-1),
                }),
                h('button.skill-order-btn', {
                  text: '↓', title: '後ろへ', disabled: i === list.length - 1,
                  onclick: () => move(1),
                })
              )
            );
          }))
        : null
    );
  }

  /* ---------------- クラス (§12) ----------------
   *
   * スキルツリーの上に置く。ポイントが少なく1つ1つが重いので、
   * 「まずここで役割を決めてから、ツリーで細部を詰める」という読み順になる。
   */

  /**
   * @param {HTMLElement} root
   * @param {any} charSave
   */
  function classPanel(root, charSave) {
    const cur = charSave.klass ? RPG.klass.def(charSave.klass) : null;
    const save = RPG.state.get();

    // --- まだクラスに就いていない ---
    if (!cur) {
      return h('section.class-panel.is-empty.panel-cut',
        h('div.class-panel-head',
          h('h3', { text: 'クラス' }),
          h('span.hint.hint-sm', { text: `${RPG.data.classPointsPerLevel}レベルごとに1ポイント。就任は無料。` })
        ),
        h('p.hint.hint-sm', {
          text: 'クラスは1人につき1つだけ。ポイントは少ないが、1つ1つがスキルツリーより重い。' +
            'クラス技には「解禁ラウンド」と「クールタイム」があり、手動で戦うほど活きる。',
        }),
        h('div.class-choices', RPG.klass.all().map((c) => classChoice(root, charSave, c, false)))
      );
    }

    // --- 就任済み ---
    const sum = RPG.klass.summary(charSave);
    const changeCost = RPG.data.classChangeCost || 0;
    const respecCost = Math.floor(changeCost / 2);

    return h('section.class-panel.panel-cut',
      h('div.class-panel-head',
        h('h3', { text: 'クラス' }),
        h('span.class-badge', { style: `--cls: ${cur.color}` },
          W.icon(cur.icon), h('b', { text: cur.name })),
        h('span.class-innate', { text: cur.innateDesc }),
        h('div.class-points',
          h('span.cp-value', { text: String(sum.available) }),
          h('span.cp-label', { text: `残りCP（消費 ${sum.spent} / ${sum.total}）` })
        )
      ),
      h('p.class-flavor', { text: cur.flavor }),

      // 共通枝。どの派生を選んでも取れる。
      h('div.class-nodes',
        cur.nodes.filter((/** @type {any} */ n) => !n.branch)
          .map((n) => classNodeCard(root, charSave, n, cur))),

      // 派生 (§12)。3つのうち1つしか選べないので、
      // **選ぶ前に3つとも中身が見える** ようにしてある。
      // 見えないまま1つ振ったら他が消えた、という驚き方をさせないため。
      classBranches(root, charSave, cur),

      h('div.class-actions',
        W.button('クラスポイントを振り直す', () => {
          if (!confirm(`${respecCost.toLocaleString()} G を消費してクラスポイントを振り直しますか？`)) return;
          const res = RPG.state.resetClassTree(selectedChar);
          if (!res.ok) { RPG.app.toast(res.reason || '失敗'); return; }
          RPG.app.toast(`${(res.cost || 0).toLocaleString()} G を消費して振り直しました`);
          RPG.app.refreshTopbar();
          render(root);
        }, { variant: 'ghost', sub: `${respecCost.toLocaleString()} G`, disabled: sum.spent === 0 }),
        W.button(classChangeOpen ? '転職をとじる' : '転職する', () => {
          classChangeOpen = !classChangeOpen;
          render(root);
        }, { variant: 'ghost', sub: `${changeCost.toLocaleString()} G` })
      ),

      classChangeOpen
        ? h('div.class-change',
            h('p.hint.hint-sm', {
              text: `転職すると振ったクラスポイントは全て戻る。所持: ${save.gold.toLocaleString()} G`,
            }),
            h('div.class-choices', RPG.klass.all()
              .filter((c) => c.id !== charSave.klass)
              .map((c) => classChoice(root, charSave, c, true)))
          )
        : null
    );
  }

  /** 転職パネルを開いているか */
  let classChangeOpen = false;

  /** コマンドの並び替えを開いているか */
  let skillOrderOpen = false;

  /** ダメージの内訳を開いているか */
  let dmgBreakOpen = false;

  /** 詳細を開いているクラスのID。1つだけ開く。 */
  /** @type {string|null} */
  let classOpen = null;

  /**
   * クラスを選ぶカード。就任前と転職時で共通。
   * @param {HTMLElement} root
   * @param {any} charSave
   * @param {any} c
   * @param {boolean} paid 費用がかかるか
   */
  function classChoice(root, charSave, c, paid) {
    const cost = paid ? (RPG.data.classChangeCost || 0) : 0;
    const save = RPG.state.get();
    const open = classOpen === c.id;

    // ── 畳んでおく理由 ──
    // 6クラスぶんの「一言・説明・素質・技」を全部並べると、
    // それだけで画面が文章で埋まる。まず何者かだけを6つ見比べて、
    // 気になったものを開く、という読み順にする。
    return h('div.class-choice' + (open ? '.is-open' : ''), { style: `--cls: ${c.color}` },
      h('button.class-choice-head', {
        onclick: () => { classOpen = open ? null : c.id; render(root); },
        'aria-expanded': open ? 'true' : 'false',
      },
        W.icon(c.icon),
        h('b', { text: c.name }),
        h('span.class-choice-innate-brief', { text: c.innateDesc }),
        h('span.class-choice-mark', { text: open ? '－' : '＋' })
      ),
      open ? h('p.class-choice-flavor', { text: c.flavor }) : null,
      open ? h('p.class-choice-desc', { text: c.desc }) : null,
      open
        ? h('div.class-choice-skills',
            c.nodes.filter((/** @type {any} */ n) => n.name.startsWith('【技】'))
              .map((/** @type {any} */ n) =>
                h('span.chip.chip-active', { text: n.name.replace('【技】', ''), title: n.desc }))
          )
        : null,
      open ? W.button(paid ? '転職する' : 'このクラスに就く', () => {
        if (paid && !confirm(`${cost.toLocaleString()} G を消費して ${c.name} に転職しますか？\n振ったクラスポイントは全て戻ります。`)) return;
        const res = RPG.state.setClass(selectedChar, c.id);
        if (!res.ok) { RPG.app.toast(res.reason || '失敗'); return; }
        classChangeOpen = false;
        RPG.app.toast(`${c.name} に就任しました`);
        RPG.app.refreshTopbar();
        render(root);
      }, {
        variant: 'primary',
        sub: cost ? `${cost.toLocaleString()} G` : undefined,
        disabled: paid && save.gold < cost,
      }) : null
    );
  }

  /**
   * クラスノード1枚。
   * @param {HTMLElement} root
   * @param {any} charSave
   * @param {any} n
   * @param {any} cls
   */
  /**
   * クラスの派生を3つ並べる (§12)。
   *
   * 排他なので、1つ選ぶと残りは封じられる。封じられた側も**隠さずに出す**。
   * 何を諦めたのかが見えないと、選び直す判断ができない。
   *
   * @param {any} root @param {any} charSave @param {any} cur クラス定義
   */
  function classBranches(root, charSave, cur) {
    const list = RPG.klass.branches(charSave.klass);
    if (!list.length) return null;
    const chosen = RPG.klass.chosenBranch(charSave);

    return h('div.class-branches',
      h('p.hint.hint-sm', {
        text: chosen
          ? '派生は1つだけ。他へ移るには、振ったぶんを戻すか転職すること。'
          : '派生は3つのうち1つだけ選べる。1点でも振ると、残りは選べなくなる。',
      }),
      ...list.map((/** @type {any} */ b) => {
        const locked = chosen !== null && chosen !== b.id;
        const nodes = cur.nodes.filter((/** @type {any} */ n) => n.branch === b.id);
        const need = nodes.reduce(
          (/** @type {number} */ a, /** @type {any} */ n) => a + n.cost * n.maxLevel, 0);
        return h('div.class-branch' + (locked ? '.is-locked' : '')
          + (chosen === b.id ? '.is-chosen' : ''),
          h('div.class-branch-head',
            h('b', { text: b.name }),
            h('span.hint.hint-sm', {
              text: chosen === b.id ? '選択中'
                : locked ? '選べない' : `全${need}CP`,
            })
          ),
          h('p.hint.hint-sm', { text: b.desc }),
          h('div.class-nodes', nodes.map((n) => classNodeCard(root, charSave, n, cur)))
        );
      })
    );
  }

  function classNodeCard(root, charSave, n, cls) {
    const level = (charSave.klassTree || {})[n.id] || 0;
    const maxed = level >= n.maxLevel;
    const check = RPG.klass.canInvest(charSave, n.id);
    const refund = RPG.klass.canRefund(charSave, n.id);
    const isSkill = n.name.startsWith('【技】');

    return h('div.class-node' + (level > 0 ? '.is-invested' : '') + (maxed ? '.is-maxed' : ''),
      { style: `--cls: ${cls.color}` },
      h('div.node-head',
        h('span.node-name', { text: n.name.replace('【技】', '') }),
        h('span.node-level', { text: `${level} / ${n.maxLevel}` })
      ),
      h('p.node-desc', { text: n.desc }),
      h('div.node-pips', Array.from({ length: n.maxLevel }, (_, i) =>
        h('span.pip' + (i < level ? '.is-on' : ''))
      )),
      h('div.node-foot',
        h('span.node-cost', { text: `${n.cost} CP` }),
        isSkill ? h('span.chip.chip-active', { text: 'クラス技' }) : null,
        // 1レベルだけ戻す (§12)。ツリー側と対になっている。
        level > 0 ? W.button(`戻す ${refund.cost ? refund.cost.toLocaleString() + 'G' : ''}`, () => {
          const res = RPG.state.refundClassNode(selectedChar, n.id);
          if (!res.ok) { RPG.app.toast(res.reason || '戻せません'); return; }
          RPG.app.toast(`${n.name.replace('【技】', '')} を1レベル戻した（${(res.cost || 0).toLocaleString()} G）`);
          render(root);
        }, { disabled: !refund.ok }) : null,
        W.button(maxed ? 'MAX' : '投資', () => {
          const res = RPG.state.investClassNode(selectedChar, n.id);
          if (!res.ok) { RPG.app.toast(res.reason || '投資できません'); return; }
          render(root);
        }, { disabled: !check.ok, variant: check.ok ? 'primary' : undefined })
      ),
      !check.ok && !maxed ? h('p.node-reason', { text: check.reason }) : null
    );
  }

  /* ---------------- ツリーの閲覧 (§5.9) ----------------
   *
   * ノードが252枚あるので、1つのグリッドに並べると目的の枝に辿り着けない。
   * 「ティアを1つだけ見る」→「分類で畳む」→「絞り込む」の3段で狭める。
   * 画面の状態（開いているティア・検索語・絞り込み）はモジュール変数に持たせて、
   * 投資して再描画されても見ていた場所が飛ばないようにしている。
   */

  /** いま開いているティア */
  let treeTier = 'basic';
  /** 検索語（ノード名と説明文にかかる） */
  let treeQuery = '';
  /** 'all' | 'available' | 'invested' */
  let treeFilter = 'all';
  /** 畳んでいる分類のID */
  /**
   * 畳んでいる分類。
   *
   * ── 既定で畳む ──
   * 全部開いた状態だと、ビルド画面だけで5,854文字が縦一列に並ぶ。
   * どこに何があるか分からないまま延々とスクロールすることになる。
   * 分類の見出しと「投資済み / 総数」だけを並べ、開くのは見たい枝だけにする。
   *
   * null のうちは「まだ一度も触っていない」。最初の描画で全部を入れる。
   */
  /** @type {Set<string>|null} */
  let treeCollapsed = null;

  /** 初回だけ、全分類を畳んだ状態にする。 */
  function ensureCollapsed() {
    if (treeCollapsed) return treeCollapsed;
    treeCollapsed = new Set(RPG.data.nodeCategories.map((/** @type {any} */ c) => c.id));
    return treeCollapsed;
  }

  /**
   * @param {HTMLElement} root
   * @param {any} charSave
   */
  function treeBrowser(root, charSave) {
    const tree = charSave.tree || {};

    /** 検索と絞り込みを1つの述語にまとめる */
    const q = treeQuery.trim().toLowerCase();
    const match = (/** @type {any} */ n) => {
      if (q && !(n.name.toLowerCase().includes(q) || (n.desc || '').toLowerCase().includes(q))) {
        return false;
      }
      const level = tree[n.id] || 0;
      if (treeFilter === 'invested') return level > 0;
      if (treeFilter === 'available') return RPG.tree.canInvest(charSave, n.id).ok;
      return true;
    };

    const unlocked = RPG.tree.tierUnlocked(tree, treeTier);
    const remaining = RPG.tree.tierRemaining(tree, treeTier);
    const tierDef = RPG.data.skillTreeTiers[treeTier];
    const from = tierDef.countsFrom
      .map((/** @type {string} */ t) => RPG.data.skillTreeTiers[t].label).join('＋');

    const groups = RPG.tree.byCategory(treeTier, match);
    const shown = groups.reduce((s, g) => s + g.nodes.length, 0);

    return h('div.tree-browser',
      // --- ティアの切り替え ---
      h('div.tier-tabs', RPG.tree.grouped().map((g) => {
        const open = RPG.tree.tierUnlocked(tree, g.tier);
        const invested = RPG.data.skillTree
          .filter((/** @type {any} */ n) => n.tier === g.tier && (tree[n.id] || 0) > 0).length;
        const total = RPG.data.skillTree.filter((/** @type {any} */ n) => n.tier === g.tier).length;
        return h('button.tier-tab' + (g.tier === treeTier ? '.is-on' : '') + (open ? '' : '.is-locked'), {
          onclick: () => { treeTier = g.tier; render(root); },
        },
          h('span.tier-tab-name', { text: g.label }),
          h('span.tier-tab-count', { text: `${invested} / ${total}` }),
          open ? null : W.icon('lock')
        );
      })),

      // --- 絞り込み ---
      h('div.tree-tools',
        h('input.tree-search', {
          type: 'search',
          placeholder: 'ノード名・効果で検索（例: 会心、毒、全体）',
          value: treeQuery,
          oninput: (/** @type {any} */ e) => {
            treeQuery = e.target.value;
            // 入力のたびに再描画するとフォーカスが飛ぶので、この枝だけ差し替える
            const host = root.querySelector('.tree-browser');
            if (host && host.parentNode) {
              const next = treeBrowser(root, charSave);
              host.parentNode.replaceChild(next, host);
              const input = /** @type {any} */ (next.querySelector('.tree-search'));
              if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
            }
          },
        }),
        h('div.tree-filters', [
          { id: 'all', label: 'すべて' },
          { id: 'available', label: '投資できる' },
          { id: 'invested', label: '投資済み' },
        ].map((f) =>
          h('button.filter-chip' + (treeFilter === f.id ? '.is-on' : ''), {
            text: f.label,
            onclick: () => { treeFilter = f.id; render(root); },
          })
        ))
      ),

      // --- ティアの状態 ---
      unlocked
        ? null
        : h('p.tier-locked-note', W.icon('lock'),
            h('span', { text: `${from}に あと${remaining}レベル 投資すると解放される` })),

      // --- 分類ごとの本体 ---
      shown === 0
        ? h('p.empty-note', { text: '条件に合うノードがありません。検索語や絞り込みを変えてみてください。' })
        : h('div.cat-list', groups.map((g) => {
            const collapsed = ensureCollapsed().has(g.cat.id);
            const invested = g.nodes.filter((/** @type {any} */ n) => (tree[n.id] || 0) > 0).length;
            return h('section.cat' + (collapsed ? '.is-collapsed' : ''),
              h('button.cat-head', {
                onclick: () => {
                  if (collapsed) treeCollapsed.delete(g.cat.id); else treeCollapsed.add(g.cat.id);
                  render(root);
                },
              },
                h('span.cat-mark', { text: collapsed ? '▶' : '▼' }),
                h('span.cat-label', { text: g.cat.label }),
                h('span.cat-count', { text: `${invested} / ${g.nodes.length}` }),
                h('span.cat-desc', { text: g.cat.desc })
              ),
              collapsed
                ? null
                : h('div.node-grid', g.nodes.map((n) => nodeCard(root, charSave, n, unlocked)))
            );
          }))
    );
  }

  /**
   * ツリーの投資結果を要約して見せる。ビルドの効き目を数値で確認できるようにする。
   * @param {any} unit
   */
  /**
   * ユニットに効いているパッシブを、言葉の一覧にする (§5.9)。
   *
   * data/effectkinds.js が「どのキーが、どこに、どんな名前で入るか」を
   * 持っているので、それを読んで並べるだけにしてある。
   * 手で並べると、効果を足すたびに書き忘れが出る（実際に出た）。
   *
   * @param {any} unit
   */
  function collectPassiveNotes(unit) {
    const reg = RPG.data.effectKinds || {};
    const notes = [];

    // 素の値として持つもの。passives にも situational にも入らない。
    if (unit.baseReduction > 0) {
      notes.push(`被ダメージ軽減 ${Math.round(unit.baseReduction * 100)}%`
        + (unit.baseReduction >= 1 ? '（無敵）' : ''));
    }
    if (unit.critDamage > 0) notes.push(`クリティカル倍率 ${(1.5 + unit.critDamage).toFixed(2)}倍`);
    if (unit.execute > 0) notes.push(`追い打ち 瀕死時 最大+${Math.round(unit.execute * 100)}%`);

    /** @param {number} v @param {string} fmt */
    const show = (v, fmt) => {
      if (fmt === 'turn') return `+${v}ターン`;
      if (fmt === 'num') return `+${v}`;
      if (fmt === 'lvl') return `${v}回`;
      if (fmt === 'flag') return '';
      return `${Math.round(v * 1000) / 10}%`;
    };

    for (const kind of Object.keys(reg)) {
      const d = reg[kind];
      if (!d.key || !d.label) continue;
      const src = d.to === 'situational' ? unit.situational : unit.passives;
      const v = src ? src[d.key] : 0;
      if (!v) continue;

      // 「種類ごとの表」は中身を開いて出す。まとめると何に効くのか読めない。
      if (d.fmt === 'keyed') {
        if (typeof v !== 'object') continue;
        for (const k of Object.keys(v)) {
          if (!v[k]) continue;
          const name = (RPG.data.statuses && RPG.data.statuses[k])
            ? RPG.data.statuses[k].label : (k === 'all' ? '全種' : k);
          notes.push(`${d.label}（${name}） ${show(v[k], 'pct')}`);
        }
        continue;
      }
      if (typeof v === 'object') continue;
      notes.push(d.fmt === 'flag' ? d.label : `${d.label} ${show(v, d.fmt)}`);
    }
    return notes;
  }

  function buildSummary(unit) {
    const always = unit.baseTagBonuses.filter((/** @type {any} */ b) => !b.matchType);
    const info = RPG.damage.tagMultiplier(always, 'phys');
    const mods = unit.elementMods || {};

    const notes = [];
    if (mods.chaos) notes.push('混沌の力: 全攻撃を無属性に固定');
    if (mods.adapt >= 2) notes.push('全属性適応 Lv2: 全攻撃が有利1.5倍');
    else if (mods.adapt >= 1) notes.push('全属性適応 Lv1: 不利属性を無効化');
    if (mods.mastery) {
      for (const el of Object.keys(mods.mastery)) {
        notes.push(`${RPG.damage.ELEMENT_LABEL[el]}の極意: 有利時 ${mods.mastery[el].toFixed(1)}倍`);
      }
    }
    // 属性の受け側・攻め側 (§5.4)。ここも長らく出ていなかった。
    if (mods.convert) {
      notes.push(`属性変換: 全攻撃が${RPG.damage.ELEMENT_LABEL[mods.convert]}`);
    }
    if (mods.dual) {
      notes.push(`二重属性: ${RPG.damage.ELEMENT_LABEL[mods.dual]}でも判定`);
    }
    if (mods.pierce) notes.push(`属性貫通 ${Math.round(mods.pierce * 100)}%`);
    if (mods.resist) {
      for (const el of Object.keys(mods.resist)) {
        if (!mods.resist[el]) continue;
        notes.push(`${RPG.damage.ELEMENT_LABEL[el]}耐性 ${Math.round(mods.resist[el] * 100)}%`);
      }
    }
    if (mods.power) {
      for (const el of Object.keys(mods.power)) {
        if (!mods.power[el]) continue;
        notes.push(`${RPG.damage.ELEMENT_LABEL[el]}攻撃 +${Math.round(mods.power[el] * 100)}%`);
      }
    }
    if (mods.crit) {
      for (const el of Object.keys(mods.crit)) {
        if (!mods.crit[el]) continue;
        notes.push(`${RPG.damage.ELEMENT_LABEL[el]}の会心 +${Math.round(mods.crit[el] * 100)}%`);
      }
    }

    // ── 効いているパッシブを全部言葉にする (§5.9) ──
    //
    // ここは長いあいだ手書きの8行だった。93あるキーのうち8つしか出ておらず、
    // **属性耐性もボスからの被ダメ軽減も、振ったのに画面に出なかった**。
    // 一覧を手で持つ限り、効果を足すたびに同じ漏れが起きる。
    //
    // いまは data/effectkinds.js が唯一の出どころで、ここは読むだけ。
    const passiveNotes = collectPassiveNotes(unit);

    // ツリーで習得したアクティブ技
    const granted = (unit.skills || []).filter((/** @type {string} */ id) => RPG.data.skills[id].tree);

    return h('div.build-summary.panel-cut',
      h('div.stat-grid', ['hp', 'atk', 'def', 'magi_power'].map((k) =>
        h('div.stat', h('span', W.icon(W.STAT_ICON[k]), h('em', { text: RPG.units.STAT_LABEL[k] })), h('b', { text: unit.stats[k].toLocaleString() }))
      )),
      h('div.summary-row',
        h('div.summary-item', h('span', { text: '系統タグ倍率' }), h('b', { text: '×' + info.multiplier.toFixed(3) })),
        h('div.summary-item', h('span', { text: 'クリティカル率' }), h('b', { text: (unit.baseCritRate * 100).toFixed(1) + '%' })),
        h('div.summary-item', h('span', { text: '上限突破' }), h('b', { text: '+' + (unit.capBreak * 100).toFixed(0) + '%' }))
      ),
      notes.length ? h('div.element-notes', notes.map((t) => h('span.chip.chip-strategy', { text: t }))) : null,
      passiveNotes.length
        ? h('div.element-notes', passiveNotes.map((t) => h('span.chip.chip-passive', { text: t })))
        : null,
      granted.length
        ? h('div.granted-skills',
            h('span.granted-label', { text: '習得した技' }),
            h('div.chips', granted.map((/** @type {string} */ id) =>
              h('span.chip.chip-granted', { text: RPG.data.skills[id].name, title: RPG.data.skills[id].desc })))
          )
        : null
    );
  }

  /**
   * @param {HTMLElement} root
   * @param {any} charSave
   * @param {any} n
   * @param {boolean} tierUnlocked
   */
  function nodeCard(root, charSave, n, tierUnlocked) {
    const level = (charSave.tree || {})[n.id] || 0;
    const maxed = level >= n.maxLevel;
    const check = RPG.tree.canInvest(charSave, n.id);
    const refund = RPG.tree.canRefund(charSave, n.id);
    const isSlot = n.effects.some((/** @type {any} */ e) => e.kind === 'slot');
    const isStrategy = n.effects.some((/** @type {any} */ e) =>
      e.kind === 'element_adapt' || e.kind === 'element_mastery' || e.kind === 'chaos');
    const isActive = n.effects.some((/** @type {any} */ e) => e.kind === 'grant_skill');
    const isDefensive = n.effects.some((/** @type {any} */ e) =>
      e.kind === 'reduction' || e.kind === 'revive' || e.kind === 'regen' || e.kind === 'counter');

    return h('div.node' + (level > 0 ? '.is-invested' : '') + (maxed ? '.is-maxed' : '') + (tierUnlocked ? '' : '.is-locked'),
      h('div.node-head',
        h('span.node-name', { text: n.name }),
        h('span.node-level', { text: `${level} / ${n.maxLevel}` })
      ),
      h('p.node-desc', { text: n.desc }),
      h('div.node-pips', Array.from({ length: n.maxLevel }, (_, i) =>
        h('span.pip' + (i < level ? '.is-on' : ''))
      )),
      h('div.node-foot',
        h('span.node-cost', { text: `${n.cost} SP` }),
        isSlot ? h('span.chip.chip-slot', { text: '装備枠' }) : null,
        isStrategy ? h('span.chip.chip-strategy', { text: '属性戦略' }) : null,
        isActive ? h('span.chip.chip-active', { text: 'アクティブ技' }) : null,
        isDefensive ? h('span.chip.chip-passive', { text: '生存' }) : null,
        // 1レベルだけ戻す (§5.5)。振ってあるときだけ出す。
        // 終盤は250点近いSPを1点ずつ振るので、全体リセットしか無いと
        // 「1か所試したいだけ」でも全部消える。それでは組み替えて遊べない。
        level > 0 ? W.button(`戻す ${refund.cost ? refund.cost.toLocaleString() + 'G' : ''}`, () => {
          const res = RPG.state.refundNode(selectedChar, n.id);
          if (!res.ok) { RPG.app.toast(res.reason || '戻せません'); return; }
          RPG.app.toast(`${n.name} を1レベル戻した（${(res.cost || 0).toLocaleString()} G）`);
          render(root);
        }, { disabled: !refund.ok }) : null,
        W.button(maxed ? 'MAX' : '投資', () => {
          const res = RPG.state.investNode(selectedChar, n.id);
          if (!res.ok) { RPG.app.toast(res.reason || '投資できません'); return; }
          render(root);
        }, { disabled: !check.ok, variant: check.ok ? 'primary' : undefined })
      ),
      // ティアごと未解放のときは見出しに理由が出ているので、ノード側では繰り返さない
      !check.ok && !maxed && tierUnlocked ? h('p.node-reason', { text: check.reason }) : null,
      // 戻せない理由は投資できない理由と別物なので、混ざらないよう分けて出す
      level > 0 && !refund.ok ? h('p.node-reason', { text: refund.reason }) : null
    );
  }

  /* ============================ 編成 ============================ */

  /** @param {HTMLElement} root */
  function renderParty(root) {
    const save = RPG.state.get();

    return h('div.pane',
      W.heading('パーティ編成',
        `最大4人。上にいる者から順に行動する。主人公${RPG.state.charName('ch_hero')}は外せないが、` +
        '並び順は自由に変えられる。'),
      h('p.hint.hint-sm', {
        text: 'バフや弱体を先に置く、範囲攻撃で敵を削ってから単体攻撃を当てる、といった組み立てができる。',
      }),
      h('div.party-slots', save.party.map((/** @type {string} */ id, /** @type {number} */ i) => {
        const def = RPG.data.characters[id];
        const c = save.characters[id];
        const isHero = id === 'ch_hero';
        return h('div.party-slot',
          h('span.slot-index', { text: String(i + 1) }),
          W.portrait(def, 'md'),
          h('div.party-slot-info',
            h('span.name', { text: RPG.state.charName(id) }),
            h('span.sub', {
              text: `Lv${c.level}${RPG.state.atMaxLevel(id) ? '(MAX)' : ''}${c.limitBreak ? ` +${c.limitBreak}凸` : ''} / ${def.title}`,
            }),
            h('div.chips', W.rarityChip(def.rarity), W.elementChip(def.element))
          ),
          // 行動順の入れ替え
          h('div.party-order',
            W.button('▲', () => { RPG.state.moveParty(i, -1); render(root); },
              { variant: 'ghost', disabled: i === 0, title: '先に行動させる' }),
            W.button('▼', () => { RPG.state.moveParty(i, 1); render(root); },
              { variant: 'ghost', disabled: i === save.party.length - 1, title: '後に行動させる' })
          ),
          isHero
            ? W.button('名前を変更', () => promptRename(root, id), { variant: 'ghost' })
            : W.button('外す', () => {
                RPG.state.setParty(save.party.filter((/** @type {string} */ p) => p !== id));
                render(root);
              }, { variant: 'ghost' })
        );
      })),
      h('h3', { text: '控え' }),
      h('div.roster', Object.keys(save.characters)
        .filter((id) => !save.party.includes(id))
        .sort((a, b) => save.characters[b].level - save.characters[a].level)
        .map((id) => {
          const def = RPG.data.characters[id];
          const c = save.characters[id];
          const full = save.party.length >= 4;
          return h('div.roster-card',
            W.portrait(def, 'md'),
            h('div.roster-info',
              h('span.name', {
                text: RPG.state.charName(id) + (c.limitBreak ? ` +${c.limitBreak}` : ''),
              }),
              h('span.sub', { text: `Lv${c.level} / ${def.title}` }),
              h('div.chips', W.rarityChip(def.rarity), W.elementChip(def.element))
            ),
            W.button(full ? '満員' : '編成する', () => {
              RPG.state.setParty(save.party.concat([id]));
              render(root);
            }, { disabled: full })
          );
        })
      )
    );
  }

  RPG.ui = RPG.ui || {};
  RPG.ui.base = {
    render,
    get activeTab() { return activeTab; },
    set activeTab(v) { activeTab = v; },
    // 並べ替えはテストから直接動かせるようにしておく (§7.4)。
    // 画面越しに確かめようとすると、表示上限で切られた後しか見られない。
    SORTS, gearView, applyGearView,
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
