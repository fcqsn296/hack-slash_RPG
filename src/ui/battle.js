// @ts-check
/**
 * 戦闘画面 (§2.2)。
 * 「背景 + テキストログ + コマンドボタン」というシンプルな構成。
 */
(function (RPG) {
  'use strict';
  const { h, replace } = RPG.dom;
  const W = RPG.widgets;

  /** @type {any} */
  let battle = null;
  /** @type {HTMLElement|null} */
  let root = null;
  /** @type {string|null} 対象選択待ちのスキルID */
  let pendingSkill = null;
  /** ログを何行までDOMに描いたか */
  let renderedLogs = 0;
  /**
   * ログの箱そのもの (§4)。
   *
   * ── なぜ使い回すのか ──
   * 画面は行動のたびに丸ごと描き直される。ログも作り直していたので、
   * **上へ遡って読んでいる最中に毎回いちばん下へ飛ばされていた**。
   *
   * scroll の通知から「利用者が動かしたのか、こちらが動かしたのか」を
   * 見分けようとしたが、旗でも値でも操作の種類でも当たらなかった。
   * 通知は遅れて届き、そのあいだに行が増えて位置の意味が変わる。
   *
   * 見分けるのをやめて、**箱を作り直さない**ことにした。
   * 同じ要素を挿し直すだけなら、何行目まで描いたかも位置も自分で分かる。
   * ついでに、毎回すべての行を作り直す無駄も無くなった。
   */
  /** @type {HTMLElement|null} */
  let logEl = null;
  /**
   * 描き直しの前に、ログが最新を追いかけていたか。
   *
   * 箱は使い回すが、いったん親から外れるので **scrollTop は 0 に戻る**。
   * 外れたあとに聞いても「いちばん上に居た」としか答えない。
   * 外れる前に控えておくしかない。
   */
  let logWasFollowing = true;
  /** 同じく、外れる前に見ていた位置 */
  let logKeepTop = 0;
  /** 演出を何件まで再生したか */
  let playedEvents = 0;
  /** 直前のHP。ゴーストバーの起点に使う @type {Record<string, number>} */
  let prevHp = {};
  /** 再生中のタイマー */
  /** @type {number[]} */
  let effectTimers = [];
  /** オート戦闘のタイマー */
  let autoTimer = 0;

  /** 1行動あたりの待ち時間（ミリ秒） */
  const DELAY_NORMAL = 260;
  const DELAY_FAST = 60;

  /**
   * @param {HTMLElement} container
   * @param {any} b
   */
  function mount(container, b) {
    stopAuto();
    clearEffects();
    root = container;
    battle = b;
    pendingSkill = null;
    // 新しい戦闘では作り直す。前の戦闘のログを引き継がない。
    logEl = null;
    logWasFollowing = true;
    logKeepTop = 0;
    renderedLogs = 0;
    playedEvents = 0;
    prevHp = {};
    snapshotHp();
    render();
    playEffects();
    scheduleAuto();
  }

  /**
   * 「行動 → 再描画 → 演出再生」をひとまとめにする。
   * 行動前のHPを覚えてから動かすので、ゴーストバーが正しい位置から縮む。
   * @param {() => void} fn
   */
  function act(fn) {
    snapshotHp();
    fn();
    render();
    playEffects();
  }

  /** 現在のHPを覚えておく。次の描画でゴーストバーの起点になる。 */
  function snapshotHp() {
    if (!battle) return;
    for (const u of battle.party.concat(battle.enemies)) prevHp[u.key] = u.hp;
  }

  function clearEffects() {
    effectTimers.forEach((t) => clearTimeout(t));
    effectTimers = [];
  }

  /** 周回設定 */
  function settings() {
    return RPG.state.get().settings;
  }

  function stopAuto() {
    clearTimeout(autoTimer);
    autoTimer = 0;
  }

  /**
   * この戦闘でオートを使う権利を確保する (§10.5)。
   * 消費は1戦闘につき1回だけ。途中で手動に戻して再開しても二重には取らない。
   * @returns {boolean} 使えるなら true
   */
  function claimAuto() {
    if (!battle) return false;
    if (battle.autoClaimed) return true;
    if (!RPG.autolimit.spend()) return false;
    battle.autoClaimed = true;
    RPG.app.refreshTopbar();
    return true;
  }

  /** オートが使えない理由。使えるなら null。 */
  function autoBlockReason() {
    if (battle && battle.rules && battle.rules.noAuto) return 'このクエストではオートを使えません';
    if (battle && battle.autoClaimed) return null;
    if (!RPG.autolimit.canAuto()) {
      const ms = RPG.autolimit.nextRegenMs();
      return 'オート回数がありません（次の回復まで ' + RPG.dispatch.formatDuration(ms) + '）';
    }
    return null;
  }

  /** オートが有効なら次の行動を予約する */
  function scheduleAuto() {
    stopAuto();
    // オート禁止のクエストでは、設定が残っていても動かさない
    if (battle && battle.rules && battle.rules.noAuto) return;
    if (!settings().auto || !battle || battle.finished) return;
    // 回数が尽きていたら勝手に手動へ戻す
    if (!claimAuto()) {
      RPG.state.updateSettings({ auto: false });
      RPG.app.toast(autoBlockReason() || 'オートを使えません');
      render();
      return;
    }
    autoTimer = setTimeout(autoStep, settings().fast ? DELAY_FAST : DELAY_NORMAL);
  }

  /** オート戦闘の1ステップ */
  function autoStep() {
    if (!settings().auto || !battle || battle.finished) return;

    if (battle.phase === 'wave_clear') {
      act(() => RPG.battle.advanceWave(battle));
      scheduleAuto();
      return;
    }

    const action = RPG.autoplay.chooseAction(battle);
    if (!action) return;
    pendingSkill = null;
    act(() => RPG.battle.commandSkill(battle, action.skillId, action.targets, { auto: true }));
    scheduleAuto();
  }

  /**
   * 弱点コンボの表示 (§10.6)。
   * 「次に何を狙えば伸びるか」が分かるように、伸ばし方も一緒に出す。
   */
  function comboMeter() {
    const max = RPG.battle.COMBO_MAX;
    const count = battle.combo.count;
    const power = RPG.battle.comboPower(battle);

    return h('div.combo-meter' + (count > 0 ? '.is-on' : ''),
      h('span.combo-label', { text: '弱点コンボ' }),
      h('div.combo-pips', Array.from({ length: max }, (_, i) =>
        h('span.combo-pip' + (i < count ? '.is-lit' : '')))),
      h('span.combo-power', { text: count > 0 ? `火力 +${Math.round(power * 100)}%` : '—' }),
      h('span.combo-hint', {
        text: count > 0
          ? `${battle.combo.reason}を突いて継続中`
          : '属性有利か、弱体中の敵を狙うと伸びる',
      })
    );
  }

  /** オートのトグルに残量を出す。使えば減ることが見えるようにする。 */
  function autoToggleLabel() {
    if (battle && battle.autoClaimed) return 'オート';
    const st = RPG.autolimit.status();
    return `オート (${st.charges})`;
  }

  /**
   * フィールドの色を、背景の絵が透ける濃さで返す (§14)。
   *
   * 戦闘の器は画面いっぱいに広がるので、不透明のままだと
   * せっかく敷いた絵が1ミリも見えない。実機で確かめた。
   * 場所ごとの色は残したいので、色は変えず透明度だけを与える。
   *
   * @param {any} f @param {number} a
   */
  function fieldWash(f, a) {
    const rgba = (/** @type {string} */ hex) => {
      const v = hex.replace('#', '');
      const n = parseInt(v.length === 3 ? v.split('').map((c) => c + c).join('') : v, 16);
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    };
    return `linear-gradient(160deg, ${rgba(f.bg[0])}, ${rgba(f.bg[1])})`;
  }

  /**
   * 戦っている場所の絵を敷く (§1.3)。
   * 基本画面と同じ器を使い回すので、戦闘に入るときだけ差し替える。
   */
  function applyBattleBackdrop() {
    const layer = document.getElementById('backdrop');
    if (!layer || !battle || !battle.fieldId) return;
    RPG.artSource.backdrop(battle.fieldId).then((src) => {
      if (!src) return;
      layer.style.setProperty('--backdrop', `url('${src}')`);
      layer.style.display = 'block';
      document.body.classList.add('has-backdrop');
    });
  }

  function render() {
    if (!root || !battle) return;
    const f = battle.field;
    const rules = battle.rules || {};
    applyBattleBackdrop();

    // 描き直すと箱が親から外れて位置が失われる。先に控えておく (§4)。
    if (logEl && logEl.isConnected) {
      const max = Math.max(0, logEl.scrollHeight - logEl.clientHeight);
      logWasFollowing = logEl.scrollTop >= max - 12;
      logKeepTop = logEl.scrollTop;
    }


    replace(root,
      h('div.battle', { style: { background: fieldWash(f, 0.34) } },
        h('div.battle-top',
          // 闘技場は戦闘の器としてフィールドを1つ借りているだけなので、
          // そのまま出すと関係のない地名が並ぶ (§17)。
          h('span.battle-field', {
            text: battle.arena ? battle.arena.def.name
              : (battle.quest ? battle.quest.name : f.name),
          }),
          battle.arena
            ? h('span.battle-wave', { text: battle.arena.def.title })
            : h('span.battle-wave', { text: `ウェーブ ${battle.wave} / ${battle.totalWaves}` }),
          h('span.battle-round', {
            text: rules.maxRounds
              ? `ラウンド ${battle.totalRounds} / ${rules.maxRounds}`
              : `ラウンド ${battle.round}`,
          }),
          h('div.battle-toggles',
            // オート禁止クエストではトグル自体を出さない
            rules.noAuto ? null : toggle(autoToggleLabel(), settings().auto, () => {
              const on = !settings().auto;
              if (on && !claimAuto()) {
                RPG.app.toast(autoBlockReason() || 'オートを使えません');
                return;
              }
              RPG.state.updateSettings({ auto: on });
              if (on) pendingSkill = null;
              render();
              scheduleAuto();
            }),
            toggle('高速', settings().fast, () => {
              RPG.state.updateSettings({ fast: !settings().fast });
              render();
              scheduleAuto();
            })
          ),
          W.button('撤退', () => {
            if (!confirm('撤退しますか？ ここまでの報酬は保持されます。')) return;
            stopAuto();
            RPG.battle.retreat(battle);
            render();
          }, { variant: 'ghost' })
        ),
        battle.quest
          ? h('div.battle-rules', RPG.quest.ruleLabels(battle.quest)
              .map((/** @type {string} */ t) => h('span.chip.chip-rule', { text: t })))
          : null,
        comboMeter(),
        h('div.enemy-row', battle.enemies.map((/** @type {any} */ e) => enemyCard(e))),
        // 作り直さず、同じ要素を挿し直す。中身も位置もそのまま残る。
        (logEl = logEl || h('div.battle-log', { id: 'battle-log' })),
        h('div.party-row.battle-party', battle.party.map((/** @type {any} */ u) => partyCard(u))),
        h('div.command-panel', renderCommands())
      )
    );

    flushLog();
  }

  /**
   * ログの未描画分だけを追記する。
   *
   * 箱を使い回しているので、描いた行数も見ている位置もそのまま残る。
   * 追いかけるのは **もともと下に張り付いていたとき** だけにして、
   * 遡って読んでいる人の邪魔をしない。
   */
  function flushLog() {
    if (!logEl || !battle) return;

    for (let i = renderedLogs; i < battle.log.length; i++) {
      const entry = battle.log[i];
      logEl.appendChild(h('div.log-line.log-' + entry.kind, { text: entry.text }));
    }
    renderedLogs = battle.log.length;

    // 挿し直しで位置が落ちることがあるので、毎回入れ直す。
    const apply = () => {
      if (!logEl) return;
      const m = Math.max(0, logEl.scrollHeight - logEl.clientHeight);
      logEl.scrollTop = logWasFollowing ? m : Math.min(logKeepTop, m);
    };
    apply();
    // 行が増えて高さが確定するのは次のフレームなので、そこでも入れ直す。
    requestAnimationFrame(apply);
  }

  /**
   * まだ再生していないイベントを、少しずつずらしながら見せる。
   * 高速モードでは間隔を詰め、演出が周回の邪魔にならないようにする。
   */
  function playEffects() {
    if (!battle) return;
    const pending = battle.events.slice(playedEvents);
    playedEvents = battle.events.length;
    if (!pending.length) return;

    const fast = settings().fast;
    // 多段ヒットなどで一度に大量に出るときは間隔を詰める
    const base = fast ? 22 : 105;
    const step = pending.length > 8 ? Math.max(fast ? 12 : 45, base * 8 / pending.length) : base;

    pending.forEach((ev, i) => {
      effectTimers.push(setTimeout(() => applyEffect(ev, fast), Math.round(i * step)));
    });
  }

  /**
   * @param {string} key
   * @returns {HTMLElement|null}
   */
  function cardOf(key) {
    return root ? root.querySelector('[data-key="' + key + '"]') : null;
  }

  /**
   * @param {HTMLElement} el
   * @param {string} cls
   * @param {number} ms
   */
  function pulse(el, cls, ms) {
    el.classList.remove(cls);
    // クラスを付け直して再生させる
    void el.offsetWidth;
    el.classList.add(cls);
    effectTimers.push(setTimeout(() => el.classList.remove(cls), ms));
  }

  /**
   * 濃い演出を出してよい場面か (§14.3)。
   *
   * ── なぜオートと高速を外すのか ──
   * 演出は「1回の戦闘を見せる」ためのもので、周回では邪魔にしかならない。
   * オート周回は1戦が数秒で終わるので、そこに属性の爆ぜや画面の揺れを足すと
   * 目が疲れるだけになる。**ストーリーと闘技場は手動で1戦ずつ戦う場所**なので、
   * そこだけ濃くする。判定を新しい設定で増やさず、既にある2つに相乗りさせている。
   */
  function rich() {
    const st = settings();
    return !st.auto && !st.fast;
  }

  /**
   * 対象カードの上で属性色に爆ぜる (§14.3)。
   *
   * 浮かぶ数字が「いくら入ったか」を伝えるのに対し、こちらは
   * **「何で殴ったか」**を伝える。属性は相性の倍率としては既に効いているのに、
   * 画面では弱点のときしか色が変わらず、炎で殴っても闇で殴っても同じに見えていた。
   *
   * @param {HTMLElement} card
   * @param {string} elem
   * @param {string} kind phys / magi / reli
   * @param {boolean} heavy 会心や重い一撃か
   */
  function burst(card, elem, kind, heavy) {
    const color = (RPG.widgets.ELEMENT_COLOR || {})[elem] || '#9aa3ad';
    const el = h('span.fx-burst.is-' + (kind || 'phys') + (heavy ? '.is-heavy' : ''));
    el.style.setProperty('--fx', color);
    card.appendChild(el);
    effectTimers.push(setTimeout(() => el.remove(), heavy ? 620 : 460));
  }

  /**
   * 技名を短く提示する (§14.3)。
   * ログにも出ているが、目はカードのほうを見ているので届いていない。
   * @param {string} name
   * @param {string} elem
   */
  function skillCall(name, elem) {
    if (!root || !name) return;
    const el = h('div.skill-call', h('span', { text: name }));
    el.style.setProperty('--fx', (RPG.widgets.ELEMENT_COLOR || {})[elem] || '#9aa3ad');
    root.appendChild(el);
    effectTimers.push(setTimeout(() => el.remove(), 900));
  }

  /**
   * 画面全体を揺らす (§14.3)。重さは「相手の最大HPに対する割合」で決める。
   * 生の数値で決めると、桁が変わる終盤だけ揺れることになる。
   * @param {number} weight 0〜1
   */
  function shake(weight) {
    if (!root) return;
    const cls = weight >= 0.25 ? 'is-shake-hard' : 'is-shake';
    pulse(root, cls, weight >= 0.25 ? 460 : 300);
  }

  /**
   * 数字や短い文字を対象カードの上に浮かせる。
   * @param {HTMLElement} card
   * @param {string} text
   * @param {string} cls
   * @param {boolean} fast
   */
  function floatText(card, text, cls, fast) {
    const el = h('span.pop.' + cls, { text });
    // 同じ位置に重ならないよう少しばらけさせる
    el.style.left = (38 + Math.random() * 24) + '%';
    card.appendChild(el);
    effectTimers.push(setTimeout(() => el.remove(), fast ? 520 : 900));
  }

  /**
   * 画面中央に短いバナーを出す（ウェーブ切替・勝敗）。
   * @param {string} text
   * @param {string} cls
   * @param {boolean} fast
   */
  function banner(text, cls, fast) {
    if (!root) return;
    const el = h('div.battle-banner.' + cls, h('span', { text }));
    root.appendChild(el);
    effectTimers.push(setTimeout(() => el.remove(), fast ? 700 : 1400));
  }

  /**
   * イベント1件を画面上の動きに変換する。
   * @param {any} ev
   * @param {boolean} fast
   */
  function applyEffect(ev, fast) {
    // 拠点へ戻ったあとに残ったタイマーが動かないようにする
    if (!root || root.classList.contains('hidden')) return;

    if (ev.type === 'wave') {
      banner(ev.text, ev.result ? (ev.lost ? 'is-lost' : 'is-victory') : (ev.boss ? 'is-boss' : 'is-wave'), fast);
      return;
    }

    const card = cardOf(ev.key);
    if (!card) return;

    switch (ev.type) {
      case 'action':
        pulse(card, 'is-acting', fast ? 180 : 420);
        // 手動のときだけ技名を出す。威力0（構えや自己バフ）にも出す——
        // 「何もしていないように見える」手番がいちばん分かりにくいため。
        if (rich()) skillCall(ev.skill, ev.elem);
        break;

      case 'damage': {
        const tags = [];
        let cls = 'is-damage';
        if (ev.crit) { cls = 'is-crit'; tags.push('会心'); }
        if (ev.element > 1) { cls = 'is-super'; tags.push('弱点'); }
        if (ev.amount === 0) cls = 'is-nulled';
        else if (ev.element < 1) cls = 'is-weak';

        floatText(card, ev.amount === 0 ? '無効' : ev.amount.toLocaleString(), cls, fast);
        if (tags.length && ev.amount > 0) {
          effectTimers.push(setTimeout(
            () => floatText(card, tags.join(' '), 'is-tag', fast), fast ? 60 : 150));
        }
        pulse(card, ev.amount === 0 ? 'is-blocked' : (ev.crit ? 'is-hit-hard' : 'is-hit'), fast ? 200 : 420);
        if (rich() && ev.amount > 0) {
          const heavy = !!ev.crit || (ev.weight || 0) >= 0.12;
          burst(card, ev.elem || 'none', ev.kind, heavy);
          // 揺らすのは重い一撃だけ。毎回揺らすと、重さの差が伝わらなくなる。
          if (heavy) shake(ev.weight || 0);
        }
        break;
      }

      case 'heal':
        floatText(card, '+' + ev.amount.toLocaleString(), 'is-heal', fast);
        pulse(card, 'is-healed', fast ? 200 : 460);
        break;

      case 'buff':
        floatText(card, ev.shield ? '無敵' : ev.label, 'is-buff', fast);
        pulse(card, 'is-buffed', fast ? 200 : 460);
        break;

      case 'debuff':
        floatText(card, ev.label, 'is-debuff', fast);
        break;

      case 'revive':
        floatText(card, '復活', 'is-revive', fast);
        pulse(card, 'is-healed', fast ? 240 : 600);
        break;

      case 'extra':
        floatText(card, '再行動', 'is-extra', fast);
        break;

      case 'down':
        pulse(card, 'is-down', fast ? 240 : 620);
        break;

      default:
        break;
    }
  }

  /**
   * オン/オフを切り替える小さなボタン
   * @param {string} label
   * @param {boolean} on
   * @param {() => void} onClick
   */
  function toggle(label, on, onClick) {
    return h('button.toggle' + (on ? '.is-on' : ''), { onClick, 'aria-pressed': on ? 'true' : 'false' },
      h('span.toggle-dot'),
      h('span', { text: label })
    );
  }

  /** @param {any} e */
  function enemyCard(e) {
    const targeting = pendingSkill && RPG.battle.targetKind(RPG.data.skills[pendingSkill]) === 'enemy';
    const clickable = targeting && e.alive;
    return h('div.enemy-card' + (e.alive ? '' : '.is-dead') + (clickable ? '.is-targetable' : ''), {
      'data-key': e.key,
      onClick: clickable ? () => confirmTarget(e) : null,
      role: clickable ? 'button' : null,
      tabindex: clickable ? '0' : null,
    },
      W.enemyArt(e, { boss: e.isBoss }),
      h('div.enemy-info',
        h('span.name', { text: e.name + (e.isBoss ? ' 👑' : '') }),
        h('span.lv', { text: 'Lv' + e.level }),
        W.hpBar(e.hp, e.maxHp, null, prevHp[e.key]),
        h('div.chips',
          W.elementChip(e.element),
          e.defIgnoredTurns > 0 ? h('span.chip.chip-debuff', { text: '防御崩壊' }) : null,
          ...e.statusEffects.filter((/** @type {any} */ s) => s.kind === 'poison')
            .map(() => h('span.chip.chip-debuff', { text: '毒' }))
        )
      )
    );
  }

  /** @param {any} u */
  function partyCard(u) {
    const actor = RPG.battle.currentActor(battle);
    const isActive = actor === u;
    const targeting = pendingSkill && RPG.battle.targetKind(RPG.data.skills[pendingSkill]) === 'ally';
    const clickable = targeting && u.alive;

    return h('div.party-card' + (isActive ? '.is-active' : '') + (u.alive ? '' : '.is-dead') + (clickable ? '.is-targetable' : ''), {
      'data-key': u.key,
      onClick: clickable ? () => confirmTarget(u) : null,
      role: clickable ? 'button' : null,
      tabindex: clickable ? '0' : null,
    },
      W.portrait(u, 'md'),
      h('div.party-card-info',
        h('span.name', { text: u.name }),
        W.hpBar(u.hp, u.maxHp, null, prevHp[u.key]),
        h('div.chips',
          ...u.buffUnique.map((/** @type {any} */ b) => h('span.chip.chip-buff', { text: b.label })),
          ...u.buffTags.map((/** @type {any} */ b) => h('span.chip.chip-buff', { text: b.label })),
          ...u.statusEffects.map((/** @type {any} */ s) => h('span.chip.chip-buff', { text: s.label }))
        )
      )
    );
  }

  /**
   * タワーの結果画面の選択肢 (§10.7)。
   * HPを持ち越したまま次の階へ進むか、ここで切り上げるかを選ぶ。
   */
  function towerActions() {
    if (!battle.victory) {
      return W.button('拠点へ戻る', () => RPG.app.finishBattle(battle), {
        variant: 'primary', sub: `${battle.tower.floor}階で力尽きた`,
      });
    }
    const next = battle.tower.floor + 1;
    return h('div.result-actions',
      W.button('次の階へ', () => {
        RPG.app.finishBattle(battle, { silent: true });
        RPG.app.startTowerFloor();
      }, {
        variant: 'primary',
        sub: `${next}階へ（HPは持ち越し）`,
      }),
      W.button('ここで切り上げる', () => {
        RPG.app.finishBattle(battle, { silent: true });
        RPG.tower.retire();
        RPG.ui.base.activeTab = 'tower';
        RPG.app.showBase();
      }, { variant: 'ghost' })
    );
  }

  /**
   * 闘技場の決着画面 (§17)。
   *
   * ── なぜ専用の分岐が要るか ──
   * 闘技場は場所を持たないが、戦闘の器がフィールドを要求するので
   * 先頭のフィールド（始まりの草原）を借りている。
   * そのため通常出撃の枝に落とすと、「もう一度」が
   * **借り物のフィールドへ出撃してしまう**。実際そうなっていた。
   */
  function arenaActions() {
    const def = battle.arena.def;
    const hard = battle.arena.hard;
    const label = def.name + (hard ? '（ハード）' : '');

    // 挑めるかどうかを **報酬を受け取る前に** 確かめる。
    // 先に finishBattle を呼んでから弾かれると、報酬だけ入って
    // 決着画面に留まり、もう一度押せば二重に受け取れてしまう。
    const gate = RPG.arena.canChallenge();
    const hardGate = hard ? RPG.arena.canChallengeHard(def.id) : { ok: true };
    if (!gate.ok || !hardGate.ok) return null;

    // 「拠点へ戻る」は呼び出し側が必ず1つ置く。ここでも足すと2つ並ぶ。
    return W.button('もう一度挑む', () => {
      RPG.app.finishBattle(battle, { silent: true });
      RPG.app.startArena(def.id, { hard });
    }, { variant: 'primary', sub: label });
  }

  function renderCommands() {
    if (battle.finished) {
      stopAuto();
      const sortie = { fieldId: battle.fieldId, waves: battle.totalWaves, bossFinale: battle.bossFinale };
      // 拠点で実際に入る額と同じものをここで見せる（手動ボーナス込み）
      const pay = RPG.economy.payout(battle, { partySize: battle.party.length });
      const questDone = battle.questId && battle.victory && !battle.ruleBroken;
      const firstClear = questDone && !RPG.quest.isCleared(battle.questId);
      return h('div.result-panel',
        h('h2', {
          text: battle.ruleBroken ? '条件失敗' : (battle.victory ? '勝利' : '敗北'),
        }),
        battle.ruleBroken ? h('p.quest-block', { text: battle.ruleBroken }) : null,
        firstClear
          ? h('div.manual-bonus', { text: `${battle.quest.name} 初回クリア — 専用報酬を獲得` })
          : null,
        questDone && !firstClear
          ? h('p.hint.hint-sm', { text: '達成済みのクエストなので、専用報酬は出ない。' })
          : null,
        pay.manual
          ? h('div.manual-bonus', { text: `手動戦闘ボーナス +${Math.round(pay.bonus * 100)}%` })
          : h('p.hint.hint-sm', { text: 'すべての行動を自分で選ぶと、報酬に手動ボーナスが付く。' }),
        h('div.reward-lines',
          h('div', { text: `ゴールド +${pay.gold.toLocaleString()} G` }),
          h('div', { text: `経験値 +${pay.exp.toLocaleString()}（1人あたり ${pay.expEach.toLocaleString()}）` }),
          h('div', {
            text: '宝箱: ' + (Object.keys(pay.boxes).length
              ? Object.keys(pay.boxes).map((b) => `${RPG.data.boxes[b].name}×${pay.boxes[b]}`).join('、')
              : 'なし'),
          })
        ),
        h('div.result-actions',
          RPG.battle.kindOf(battle) === 'tower'
            ? towerActions()
            : RPG.battle.kindOf(battle) === 'arena'
            ? arenaActions()
            : RPG.battle.kindOf(battle) === 'quest'
            ? W.button('もう一度挑む', () => {
                const questId = battle.questId;
                RPG.app.finishBattle(battle, { silent: true });
                RPG.app.startQuest(questId);
              }, { variant: 'primary', sub: battle.quest.name })
            : RPG.battle.kindOf(battle) === 'map'
            // マップの遭遇は同じ遭遇をやり直す (§20)。
            // 通常の出撃に落とすと、終わったあとマップではなく拠点へ戻ってしまう。
            ? W.button('もう一度', () => {
                const enc = battle.mapEncounter;
                RPG.app.finishBattle(battle, { silent: true });
                RPG.app.startStoryBattle(enc);
              }, { variant: 'primary', sub: 'この場でもう一戦' })
            : W.button('もう一度', () => {
                // 報酬を受け取ってから、同じ場所へそのまま出撃し直す
                RPG.app.finishBattle(battle, { silent: true });
                RPG.app.startBattle(sortie.fieldId, sortie.waves, sortie.bossFinale);
              }, { variant: 'primary', sub: `${battle.field.name} ${sortie.waves}戦` }),
          // 名前は実際の行き先に合わせる。
          // マップから来た戦闘なのに「拠点へ戻る」と書いてあり、
          // 押すとマップへ戻るので、どちらが正しいのか読めなかった。
          W.button(
            RPG.battle.kindOf(battle) === 'map' ? 'マップへ戻る' : '拠点へ戻る',
            () => RPG.app.finishBattle(battle),
            { variant: 'ghost' }
          )
        )
      );
    }

    if (battle.phase === 'wave_clear') {
      return h('div.command-center',
        h('p', { text: `ウェーブ ${battle.wave} 制圧。HPは引き継がれる。` }),
        W.button('次のウェーブへ', () => act(() => RPG.battle.advanceWave(battle)), { variant: 'primary' })
      );
    }

    const actor = RPG.battle.currentActor(battle);
    if (!actor) return h('div.command-center', h('p', { text: '…' }));

    if (settings().auto && !(battle.rules && battle.rules.noAuto)) {
      return h('div.command-center.is-auto',
        W.portrait(actor, 'sm'),
        h('p', { text: `${actor.name} が自動で行動中…` }),
        W.button('手動に戻す', () => {
          RPG.state.updateSettings({ auto: false });
          stopAuto();
          render();
        }, { variant: 'ghost' })
      );
    }

    if (pendingSkill) {
      const skill = RPG.data.skills[pendingSkill];
      const kind = RPG.battle.targetKind(skill);
      const candidates = kind === 'ally'
        ? RPG.battle.livingParty(battle) : RPG.battle.livingEnemies(battle);

      // ── 対象をここに出す理由 ──
      // 以前は「上に並んだ敵か味方のカードを押す」形だった。
      // 技が増えると一覧が伸びるので、**下へスクロールして技を探し、
      // 上へ戻って対象を押す** という往復が毎ターン発生していた。
      // 対象は数が知れているので、コマンド欄にそのまま並べたほうが速い。
      // 上のカードを押す道も残してあるので、慣れた人はそちらでも選べる。
      return h('div.command-target',
        h('p.targeting', { text: `${skill.name} — ${kind === 'ally' ? '味方' : '敵'}を選ぶ` }),
        h('div.target-buttons', candidates.map((/** @type {any} */ t) =>
          h('button.target-btn' + (t.side === 'enemy' ? '.is-foe' : ''), {
            onClick: () => confirmTarget(t),
          },
            h('span.target-name', { text: t.name }),
            h('span.target-hp',
              h('span.target-hp-bar', {
                style: `--w: ${Math.max(0, Math.round(t.hp / t.maxHp * 100))}%`,
              }),
              h('span.target-hp-text', {
                text: `${t.hp.toLocaleString()} / ${t.maxHp.toLocaleString()}`,
              })
            )
          )
        )),
        W.button('やめる', () => { pendingSkill = null; render(); }, { variant: 'ghost' })
      );
    }

    return h('div.command-list',
      h('div.command-actor',
        W.portrait(actor, 'sm'),
        h('span', { text: actor.name + ' のコマンド' })
      ),
      h('div.command-buttons', actor.skills.map((/** @type {string} */ id) => {
        const skill = RPG.data.skills[id];
        // クラス技には解禁ラウンドとクールタイムがある (§12)。
        // 押せない理由をボタン上に出しておかないと、なぜ選べないのか分からない。
        const ready = RPG.battle.skillReady(battle, actor, id);

        return h('button.skill-btn' + (skill.cls ? '.is-class' : '') + (ready.ok ? '' : '.is-cooling'), {
          onClick: () => { if (ready.ok) selectSkill(id); },
          disabled: !ready.ok,
          title: ready.ok ? skill.desc : `${skill.desc}\n\n使用不可: ${ready.reason}`,
        },
          h('span.skill-name',
            h('span', { text: skill.name }),
            skill.cls ? h('span.chip.chip-class', { text: 'クラス' }) : null,
            ready.ok ? null : h('span.chip.chip-cool', { text: ready.reason })
          ),
          h('span.skill-meta',
            W.elementChip(skill.element),
            W.tagChip(skill.damage_type),
            skill.power > 0 ? h('span.chip', { text: '威力' + skill.power + '%' }) : h('span.chip', { text: '補助' }),
            skill.cooldown ? h('span.chip', { text: `CT${skill.cooldown}` }) : null
          ),
          h('span.skill-desc', { text: skill.desc })
        );
      }))
    );
  }

  /** @param {string} skillId */
  function selectSkill(skillId) {
    const skill = RPG.data.skills[skillId];
    const kind = RPG.battle.targetKind(skill);

    if (kind === 'none') {
      act(() => RPG.battle.commandSkill(battle, skillId, []));
      return;
    }
    // 対象が1体しかいないなら選択を省略する
    const candidates = kind === 'ally' ? RPG.battle.livingParty(battle) : RPG.battle.livingEnemies(battle);
    if (candidates.length === 1) {
      act(() => RPG.battle.commandSkill(battle, skillId, [candidates[0]]));
      return;
    }
    // 一覧が対象欄に置き換わると、その分ページが縮んで
    // スクロール位置が勝手に上へ動く。指を置いた場所と押す場所が
    // ずれるので、描き替えの前後で見た目の位置を保つ。
    const keep = window.scrollY;
    pendingSkill = skillId;
    render();
    requestAnimationFrame(() => {
      const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      window.scrollTo(0, Math.min(keep, max));
    });
  }

  /** @param {any} target */
  function confirmTarget(target) {
    if (!pendingSkill) return;
    const skillId = pendingSkill;
    pendingSkill = null;
    act(() => RPG.battle.commandSkill(battle, skillId, [target]));
  }

  RPG.ui = RPG.ui || {};
  RPG.ui.battle = { mount };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
