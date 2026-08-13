// @ts-check
/**
 * アプリ本体 — 画面遷移と報酬の受け渡し。
 * ゲームループは「拠点 ⇄ 戦闘」の往復のみ (§2)。
 */
(function (RPG) {
  'use strict';
  const { h, $, replace } = RPG.dom;
  const W = RPG.widgets;

  /** @type {any} */
  let currentBattle = null;

  function boot() {
    const save = RPG.state.load();
    // 起動時の控えを残す（前回から時間が経っているときだけ）
    RPG.savefile.backupOnBoot();

    // アップデートで報酬が増えたクエストの取りこぼしをここで配る (§10.3)。
    // 既にクリア済みの人が、後から足した報酬を永久に受け取れないのを防ぐ。
    const pending = RPG.quest.claimPending();

    refreshTopbar();
    showBase();
    // 初回起動時は主人公の名前を尋ねる (§8.1)
    if (!save.named) showNameDialog('ch_hero', { firstTime: true });

    for (const p of pending) {
      toast(`${p.name}: 追加報酬を受け取りました — ${p.lines.join(' ／ ')}`);
    }
  }

  /**
   * 主人公の名前入力ダイアログ。
   * @param {string} charId
   * @param {{firstTime?: boolean, onDone?: () => void}} [opts]
   */
  function showNameDialog(charId, opts) {
    opts = opts || {};
    const def = RPG.data.characters[charId];
    const current = RPG.state.charName(charId);

    const input = /** @type {HTMLInputElement} */ (h('input.name-input', {
      type: 'text',
      value: opts.firstTime ? '' : current,
      placeholder: def.defaultName,
      maxlength: String(RPG.state.NAME_MAX),
      autocomplete: 'off',
      spellcheck: 'false',
    }));

    const error = h('p.name-error');
    const overlay = h('div.modal-overlay');

    function close() {
      overlay.classList.add('is-out');
      setTimeout(() => overlay.remove(), 180);
    }

    function commit() {
      const res = RPG.state.setCharName(charId, input.value);
      if (!res.ok) {
        error.textContent = res.reason || '入力が正しくありません';
        input.focus();
        return;
      }
      close();
      toast(`主人公の名前を「${res.name}」に決めました`);
      showBase();
      if (opts.onDone) opts.onDone();
    }

    function useDefault() {
      RPG.state.setCharName(charId, def.defaultName);
      close();
      showBase();
      if (opts.onDone) opts.onDone();
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape' && !opts.firstTime) { e.preventDefault(); close(); }
    });

    overlay.appendChild(
      h('div.modal',
        h('div.modal-art', W.portrait(def, 'lg')),
        h('h2', { text: opts.firstTime ? '主人公の名前を決めてください' : '名前を変更' }),
        h('p.modal-sub', { text: `${def.title}。${RPG.state.NAME_MAX}文字まで。` }),
        input,
        error,
        h('div.modal-actions',
          W.button(opts.firstTime ? 'この名前で始める' : '決定', commit, { variant: 'primary' }),
          W.button(opts.firstTime ? `「${def.defaultName}」でいい` : 'キャンセル',
            opts.firstTime ? useDefault : close, { variant: 'ghost' })
        )
      )
    );

    document.body.appendChild(overlay);
    setTimeout(() => input.focus(), 30);
  }

  function refreshTopbar() {
    const save = RPG.state.get();
    const boxTotal = Object.keys(save.boxes).reduce((s, k) => s + save.boxes[k], 0);
    replace($('#topbar-right'),
      h('div.currency',
        W.icon('coin', { size: '15px', color: 'var(--currency)' }),
        h('b', { text: save.gold.toLocaleString() }),
        h('span', { text: 'G' })
      ),
      h('div.currency',
        W.icon('tab-identify', { size: '15px', color: '#f0a35a' }),
        h('b', { text: String(boxTotal) })
      ),
      // オート回数 (§10.5)。手動は消費しないので、ここが減るのはオートを使ったときだけ。
      (function () {
        const st = RPG.autolimit.status();
        return h('div.currency' + (st.charges === 0 ? '.is-empty' : ''), {
          title: st.full
            ? `オート回数 ${st.charges} / ${st.max}（満タン）`
            : `オート回数 ${st.charges} / ${st.max}　次の回復まで ` +
              RPG.dispatch.formatDuration(st.nextMs) + '\n手動で戦うぶんには消費しません。',
        },
          W.icon('tab-sortie', { size: '15px', color: st.charges === 0 ? 'var(--danger)' : 'var(--accent)' }),
          h('b', { text: String(st.charges) }),
          h('span', { text: '/ ' + st.max })
        );
      })(),
      W.button('データ', () => showDataDialog(), { variant: 'ghost', title: 'セーブの書き出し・読み込み・初期化' })
    );
  }

  function showBase() {
    $('#screen-battle').classList.add('hidden');
    $('#screen-base').classList.remove('hidden');
    RPG.ui.base.render($('#screen-base'));
    refreshTopbar();
  }

  /**
   * セーブデータの管理ダイアログ。
   * 書き出し／読み込み／自動バックアップからの復元／初期化をここにまとめる。
   */
  /**
   * 読めなかったセーブの救済 (§16)。
   *
   * 更新でセーブが読めなくなった場合、ゲームは新規データで始まる。
   * このとき元の中身は捨てずに退避してあるので、ここから戻せるようにする。
   * コードを前の版に巻き戻しても消えた localStorage は復活しないため、
   * 「巻き戻しでは救えない壊れ方」に対する唯一の受け皿になる。
   *
   * @param {(msg: string) => void} say
   * @param {HTMLTextAreaElement} textarea 取り出した中身を表示する欄
   */
  function rescuedSection(say, textarea) {
    const info = RPG.state.rescued();
    if (!info) return null;

    return h('div.data-section.data-rescue',
      h('h3', { text: '⚠ 読み込めなかったデータがあります' }),
      h('p.hint.hint-sm', {
        text: `${new Date(info.at).toLocaleString('ja-JP')} — ${info.reason}\n` +
          '中身は消さずに取ってあります。下から復元を試せます。',
      }),
      h('div.data-actions',
        W.button('復元を試す', () => {
          // 退避されたのは「版が合わずに読めなかった」中身。
          // 通常の validate() を使うと、退避した原因と同じ理由でここでも弾かれる。
          const check = RPG.savefile.validateRescued(info.raw);
          if (!check.ok) {
            say('この内容は復元できません: ' + check.reason);
            return;
          }
          const note = check.coerced
            ? '\n\n※ 形式が古いため、現在の形式へ読み替えて復元します。'
            : '';
          if (!confirm(`次の内容に置き換えます。\n\n${RPG.savefile.summarize(check.save)}${note}\n\n` +
            '今のデータは控えに残ります。よろしいですか？')) return;
          RPG.savefile.backup('救済の直前');
          RPG.state.replaceSave(check.save);
          RPG.state.discardRescued();
          say('復元しました');
          location.reload();
        }, { variant: 'primary' }),
        W.button('テキストとして取り出す', () => {
          textarea.value = info.raw;
          textarea.focus();
          textarea.select();
          say('選択しました。Ctrl+C でコピーできます');
        }, { variant: 'ghost' }),
        W.button('破棄する', () => {
          if (!confirm('退避してあるデータを完全に削除します。元に戻せません。よろしいですか？')) return;
          RPG.state.discardRescued();
          say('破棄しました');
        }, { variant: 'ghost' })
      )
    );
  }

  function showDataDialog() {
    const overlay = h('div.modal-overlay');
    const status = h('p.data-status');

    function close() {
      overlay.classList.add('is-out');
      setTimeout(() => overlay.remove(), 180);
    }

    /**
     * @param {string} text
     * @param {boolean} [bad]
     */
    function say(text, bad) {
      status.textContent = text;
      status.classList.toggle('is-bad', !!bad);
    }

    const textarea = /** @type {HTMLTextAreaElement} */ (h('textarea.data-text', {
      spellcheck: 'false',
      placeholder: 'ここにセーブデータのテキストを貼り付けて「テキストから読み込む」',
    }));

    const fileInput = /** @type {HTMLInputElement} */ (h('input', {
      type: 'file', accept: 'application/json,.json', style: { display: 'none' },
    }));
    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      RPG.savefile.readFile(file)
        .then((text) => applyImport(text, file.name))
        .catch((e) => say(e.message, true));
    });

    /**
     * @param {string} text
     * @param {string} from
     */
    function applyImport(text, from) {
      const check = RPG.savefile.validate(text);
      if (!check.ok) { say(check.reason || '読み込めませんでした', true); return; }

      const ok = confirm(
        `次の内容で現在のデータを置き換えます。\n\n${RPG.savefile.summarize(check.save)}\n\n` +
        '今のデータは自動的に控えへ残ります。よろしいですか？'
      );
      if (!ok) return;

      const result = RPG.savefile.importFrom(text);
      if (!result.ok) { say(result.reason || '読み込めませんでした', true); return; }
      close();
      refreshTopbar();
      showBase();
      toast(`${from} から読み込みました`);
    }

    const backups = RPG.savefile.listBackups();
    const save = RPG.state.get();

    overlay.appendChild(
      h('div.modal.modal-wide',
        h('h2', { text: 'データ管理' }),
        h('p.modal-sub', { text: RPG.savefile.summarize(save) }),

        // 読めなかったセーブが退避されているときだけ出す (§16)。
        // 黙って新規データで始まると、プレイヤーは「消えた」としか分からない。
        rescuedSection(say, textarea),

        h('div.data-section',
          h('h3', { text: '書き出す' }),
          h('p.hint.hint-sm', { text: 'ブラウザのデータが消えても復元できるよう、控えを手元に保存しておけます。' }),
          h('div.data-actions',
            W.button('ファイルに保存', () => {
              const name = RPG.savefile.download();
              say(`${name} を書き出しました`);
            }, { variant: 'primary' }),
            W.button('テキストを表示', () => {
              textarea.value = RPG.savefile.toText();
              textarea.focus();
              textarea.select();
              say('テキストを選択しました。Ctrl+C でコピーできます');
            }, { variant: 'ghost' })
          )
        ),

        h('div.data-section',
          h('h3', { text: '読み込む' }),
          h('p.hint.hint-sm', { text: '読み込む前に、今のデータは自動で控えに残ります。' }),
          h('div.data-actions',
            W.button('ファイルから読み込む', () => fileInput.click(), { variant: 'primary' }),
            W.button('テキストから読み込む', () => applyImport(textarea.value, '貼り付けたテキスト'), { variant: 'ghost' })
          ),
          textarea,
          fileInput
        ),

        h('div.data-section',
          h('h3', { text: `自動バックアップ（最大${RPG.savefile.MAX_BACKUPS}件）` }),
          backups.length === 0
            ? h('p.hint.hint-sm', { text: 'まだ控えがありません。起動時と、読み込み・初期化の直前に自動で作られます。' })
            : h('div.backup-list', backups.map((/** @type {any} */ b, /** @type {number} */ i) =>
                h('div.backup-row',
                  h('div.backup-info',
                    h('span.backup-when', { text: new Date(b.at).toLocaleString('ja-JP') + '（' + b.reason + '）' }),
                    h('span.backup-sum', { text: b.summary })
                  ),
                  W.button('この時点に戻す', () => {
                    if (!confirm(`この時点に戻します。\n\n${b.summary}\n\n今のデータも控えに残ります。よろしいですか？`)) return;
                    const result = RPG.savefile.restoreBackup(i);
                    if (!result.ok) { say(result.reason || '戻せませんでした', true); return; }
                    close();
                    refreshTopbar();
                    showBase();
                    toast('バックアップから復元しました');
                  }, { variant: 'ghost' })
                )
              ))
        ),

        h('div.data-section.is-danger',
          h('h3', { text: '初期化' }),
          h('p.hint.hint-sm', { text: '最初からやり直します。直前の状態は控えに残るので、間違えても戻せます。' }),
          W.button('データを初期化', () => {
            if (!confirm('セーブデータを消して最初からやり直しますか？\n直前の状態は控えに残ります。')) return;
            RPG.savefile.backup('初期化前');
            RPG.state.reset();
            close();
            refreshTopbar();
            showBase();
            toast('データを初期化しました');
          }, { variant: 'ghost' })
        ),

        status,
        h('div.modal-actions', W.button('閉じる', close, { variant: 'ghost' }))
      )
    );

    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
    document.body.appendChild(overlay);
  }

  /**
   * @param {string} fieldId
   * @param {number} waves
   * @param {boolean} [bossFinale] 最終ウェーブをボスにするか (§10.1)
   */
  function startBattle(fieldId, waves, bossFinale) {
    const party = RPG.state.partyUnits();
    currentBattle = RPG.battle.start({ fieldId, waves, party, bossFinale });
    RPG.state.get().stats.battles++;
    RPG.state.rememberSortie({ fieldId, waves, bossFinale: bossFinale !== false });
    RPG.state.persist();

    $('#screen-base').classList.add('hidden');
    $('#screen-battle').classList.remove('hidden');
    RPG.ui.battle.mount($('#screen-battle'), currentBattle);
  }

  /**
   * クエストへ出撃する (§10.3)。
   * 縛り条件を満たしていなければ理由を出して何もしない。
   * @param {string} questId
   */
  function startQuest(questId) {
    const quest = RPG.quest.def(questId);
    if (!quest) return;

    const gate = RPG.quest.unlocked(quest);
    if (!gate.ok) { toast(gate.reason || '未解放'); return; }

    const check = RPG.quest.checkParty(quest);
    if (!check.ok) { toast(check.reasons[0]); return; }

    // オート禁止のクエストは、設定が残っていても強制的に手動へ戻す
    if (quest.rules && quest.rules.noAuto) RPG.state.updateSettings({ auto: false });

    const party = RPG.state.partyUnits();
    currentBattle = RPG.battle.start({
      fieldId: quest.fieldId, waves: quest.waves, party,
      bossFinale: quest.bossFinale !== false, quest,
    });
    RPG.state.get().stats.battles++;
    RPG.state.persist();

    $('#screen-base').classList.add('hidden');
    $('#screen-battle').classList.remove('hidden');
    RPG.ui.battle.mount($('#screen-battle'), currentBattle);
  }

  /**
   * エンドレスタワーの今の階へ挑む (§10.7)。
   * HPは前の階から持ち越されるので、パーティの組み立ては RPG.tower に任せる。
   */
  function startTowerFloor() {
    const battle = RPG.tower.enter();
    if (!battle) { toast('挑戦を開始できません'); return; }
    currentBattle = battle;
    RPG.state.get().stats.battles++;
    RPG.state.persist();

    $('#screen-base').classList.add('hidden');
    $('#screen-battle').classList.remove('hidden');
    RPG.ui.battle.mount($('#screen-battle'), currentBattle);
  }

  /**
   * 闘技場の挑戦を始める (§17)。
   * 1戦で完結する。報酬はレベル上限を伸ばす道具だけ。
   * @param {string} bossId
   * @param {{hard?: boolean}} [opts]
   */
  function startArena(bossId, opts) {
    const check = RPG.arena.canChallenge();
    if (!check.ok) { toast(check.reason || '挑戦できません'); return; }
    if (opts && opts.hard) {
      const gate = RPG.arena.canChallengeHard(bossId);
      if (!gate.ok) { toast(gate.reason || 'ハードはまだ挑戦できません'); return; }
    }

    const battle = RPG.arena.start(bossId, opts);
    currentBattle = battle;
    RPG.state.get().stats.battles++;
    RPG.state.persist();

    $('#screen-base').classList.add('hidden');
    $('#screen-battle').classList.remove('hidden');
    RPG.ui.battle.mount($('#screen-battle'), currentBattle);
  }

  /**
   * 戦闘終了。蓄積された報酬をここでまとめて付与する (§10.1)。
   * 装備の生成は行わず、宝箱の個数だけを加算する (§2.2)。
   * @param {any} battle
   * @param {{silent?: boolean}} [opts] silent なら拠点へ戻らず報酬付与だけ行う（連続周回用）
   */
  function finishBattle(battle, opts) {
    opts = opts || {};
    const save = RPG.state.get();
    // 手動ボーナスと経験値の分配はここで一括して決める (§10.1)
    const pay = RPG.economy.payout(battle, { partySize: Math.max(1, save.party.length) });

    RPG.state.addGold(pay.gold);
    for (const boxId of Object.keys(pay.boxes)) {
      RPG.state.addBox(boxId, pay.boxes[boxId]);
    }

    /** @type {string[]} */
    const levelUps = [];
    for (const id of save.party) {
      const gained = RPG.state.addExp(id, pay.expEach);
      if (gained > 0) levelUps.push(`${RPG.state.charName(id)} Lv${save.characters[id].level}`);
    }

    if (battle.victory) save.stats.wins++;
    RPG.codex.record(battle);   // 出会った敵を図鑑へ (§13)

    // タワーの階の判定。HPの持ち越しと到達報酬はここで確定する (§10.7)
    let tower = null;
    if (battle.tower) tower = RPG.tower.resolve(battle);

    // 闘技場の記録と報酬 (§17)。
    if (battle.arena) {
      const res = RPG.arena.finish(battle);
      if (res) {
        if (res.first) {
          toast(`${battle.arena.def.name} を${res.hard ? 'ハードで' : ''}初めて打ち倒した`);
        }
        if (res.best) toast(`最短記録を更新 — ${battle.totalRounds}ラウンド`);
        if (res.shards) {
          const item = RPG.data.items[RPG.arena.CAP_ITEM];
          toast(`${item.name} を手に入れた（所持 ${RPG.state.itemCount(RPG.arena.CAP_ITEM)} 個）`);
        }
      }
    }

    // クエストの初回クリア報酬。2回目以降は何も出ない (§10.3)
    let questLines = /** @type {string[]} */ ([]);
    if (battle.questId && battle.victory && !battle.ruleBroken) {
      const res = RPG.quest.complete(battle.questId);
      if (res.granted) questLines = res.lines;
    }
    // 出撃先を問わない達成条件型は、どの戦闘の勝利でも判定する (§10.3-2)
    const challenges = RPG.quest.evaluateChallenges(battle);
    RPG.state.persist();

    const messages = [`${pay.gold.toLocaleString()} G を獲得`];
    if (pay.manual) messages.push(`手動ボーナス +${Math.round(pay.bonus * 100)}%`);
    const boxCount = Object.keys(pay.boxes).reduce((s, k) => s + pay.boxes[k], 0);
    if (boxCount > 0) messages.push(`宝箱 ${boxCount} 個`);
    if (levelUps.length) messages.push('レベルアップ: ' + levelUps.join('、'));
    toast(messages.join(' ／ '));
    // 初回クリア報酬は埋もれさせたくないので別のトーストで出す
    if (questLines.length) toast('初回クリア報酬: ' + questLines.join(' ／ '));
    for (const c of challenges) {
      toast(`${c.name} 達成 — ` + c.lines.join(' ／ '));
    }
    if (tower && tower.record && tower.rewards.length) {
      toast(`${tower.floor}階 到達報酬: ` + tower.rewards.join(' ／ '));
    }

    currentBattle = null;
    refreshTopbar();
    if (opts.silent) return;   // 「もう一度」からは呼び出し側が次の戦闘を始める

    // タワーはタワータブへ、クエストはクエスト一覧へ、宝箱があれば鑑定タブへ誘導する
    if (battle.tower) RPG.ui.base.activeTab = 'tower';
    else if (battle.questId) RPG.ui.base.activeTab = 'quest';
    else if (boxCount > 0) RPG.ui.base.activeTab = 'identify';
    showBase();
  }

  /**
   * @param {string} message
   */
  function toast(message) {
    const el = h('div.toast', { text: message });
    $('#toast-root').appendChild(el);
    setTimeout(() => el.classList.add('is-out'), 3200);
    setTimeout(() => el.remove(), 3800);
  }

  RPG.app = {
    boot, showBase, startBattle, startQuest, startTowerFloor, startArena, finishBattle,
    toast, refreshTopbar, showNameDialog, showDataDialog,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
