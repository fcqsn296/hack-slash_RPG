// @ts-check
/**
 * 派遣 (§10.4)。放置して、実時間の経過ぶんだけ報酬を受け取る仕組み。
 *
 * ── なぜ作り直したか ──
 * 以前は「まとめ周回」として、ボタン1つで10周ぶんの戦闘を即座に計算していた。
 * 数ミリ秒で完了するので、実質「押すと数値が増えるボタン」になっており、
 * 周回というゲーム要素そのものが消えていた。
 *
 * ここでは周回のコストを **実時間** に置き換える。
 *   - 派遣を開始すると終了時刻が決まる。早送りする手段は無い
 *   - 同時に出せるのは1隊だけ。並べて回すことはできない
 *   - 受け取りは本物の戦闘エンジンを回して決めるので、勝てない場所へ送れば損をする
 *
 * 手動戦闘はいつでもできる（編成は縛らない）。派遣は「触らない時間」を報酬に変える
 * 装置であって、手動の上位互換ではない。1周あたりの効率もわざと手動より悪くしてある。
 *
 * セーブに持つのは開始時刻と条件だけなので、リロードしてもタブを閉じても進む。
 */
(function (RPG) {
  'use strict';

  /**
   * 1周ぶんに必要な実時間（ミリ秒）。
   *
   * ── この値の決め方 ──
   * オート回数 (§10.5) は 8分に1回復する。つまり「放置していると8分ごとに1周ぶんの権利が増える」
   * のと同じ速度で、派遣もまた1周を積む。派遣とオートは同時に走らせられるので、
   * 派遣は「触っていない時間ぶんの上乗せ」として、オートと釣り合う速さにしてある。
   *
   * 以前は12分だった。そのころは 8時間放置で実効30周にしかならず、
   * 同じ8時間でオート回数が60回復するのに比べて 1/3 の価値しか無かった。
   */
  const MS_PER_RUN = 8 * 60 * 1000;

  /**
   * 派遣で得られる報酬の倍率。
   * 見ていない時間の報酬なので、同じ周回数でも手動より少なくしてある。
   */
  const REWARD_RATE = 0.85;

  /** 選べる派遣時間 */
  const PLANS = [
    { id: 'short', label: '短時間', ms: 30 * 60 * 1000 },
    { id: 'half', label: '半日', ms: 4 * 60 * 60 * 1000 },
    { id: 'long', label: '長時間', ms: 8 * 60 * 60 * 1000 },
  ];

  /** 1回の受け取りで回す戦闘数の上限。放置しすぎたときの計算時間を抑える。 */
  const MAX_RUNS = 90;

  /** @param {string} planId */
  function plan(planId) {
    return PLANS.find((p) => p.id === planId) || PLANS[0];
  }

  /**
   * その時間で何周ぶんになるか。
   * @param {number} ms
   */
  function runsFor(ms) {
    return Math.max(1, Math.min(MAX_RUNS, Math.floor(ms / MS_PER_RUN)));
  }

  /** 現在の派遣。無ければ null。 */
  function current() {
    return RPG.state.get().dispatch || null;
  }

  /**
   * 派遣を始める。
   * @param {{fieldId: string, waves: number, bossFinale: boolean, planId: string}} cfg
   * @returns {{ok: boolean, reason?: string}}
   */
  function start(cfg) {
    const s = RPG.state.get();
    if (s.dispatch) return { ok: false, reason: 'すでに派遣中です' };
    if (s.party.length === 0) return { ok: false, reason: 'パーティが空です' };
    if (!RPG.data.fields[cfg.fieldId]) return { ok: false, reason: 'フィールドが見つかりません' };

    const p = plan(cfg.planId);
    s.dispatch = {
      fieldId: cfg.fieldId,
      waves: cfg.waves,
      bossFinale: cfg.bossFinale !== false,
      planId: p.id,
      startedAt: Date.now(),
      endsAt: Date.now() + p.ms,
      // 出発時の顔ぶれ。受け取りのときの表示に使う（戦闘は現在の編成で計算する）
      party: s.party.slice(),
    };
    RPG.state.persist();
    return { ok: true };
  }

  /**
   * 進み具合。
   * @returns {{active: boolean, done?: boolean, remainMs?: number, totalMs?: number,
   *            ratio?: number, runs?: number, field?: any, plan?: any}}
   */
  function status() {
    const d = current();
    if (!d) return { active: false };

    const now = Date.now();
    const total = Math.max(1, d.endsAt - d.startedAt);
    // 端末の時計が巻き戻された場合でも、進捗が負にならないようにする
    const elapsed = Math.max(0, Math.min(total, now - d.startedAt));
    return {
      active: true,
      done: now >= d.endsAt,
      remainMs: Math.max(0, d.endsAt - now),
      totalMs: total,
      ratio: elapsed / total,
      runs: runsFor(total),
      field: RPG.data.fields[d.fieldId],
      plan: plan(d.planId),
    };
  }

  /**
   * 残り時間の表示用。
   * @param {number} ms
   */
  function formatDuration(ms) {
    const sec = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}時間${String(m).padStart(2, '0')}分`;
    if (m > 0) return `${m}分${String(s).padStart(2, '0')}秒`;
    return `${s}秒`;
  }

  /**
   * 派遣を取りやめる。報酬は出ない。
   * @returns {{ok: boolean, reason?: string}}
   */
  function cancel() {
    const s = RPG.state.get();
    if (!s.dispatch) return { ok: false, reason: '派遣していません' };
    s.dispatch = null;
    RPG.state.persist();
    return { ok: true };
  }

  /**
   * 受け取り。終わっていなければ何もしない。
   *
   * 報酬は本物の戦闘エンジンを回して決める。勝てない場所へ送っていれば
   * ほとんど持ち帰れない。放置だから安全、ということにはしない。
   *
   * @returns {{ok: boolean, reason?: string, result?: any}}
   */
  function collect() {
    const s = RPG.state.get();
    const d = s.dispatch;
    if (!d) return { ok: false, reason: '派遣していません' };
    if (Date.now() < d.endsAt) {
      return { ok: false, reason: 'まだ帰還していません（残り ' +
        formatDuration(d.endsAt - Date.now()) + '）' };
    }
    if (s.party.length === 0) return { ok: false, reason: 'パーティが空です' };

    const runs = runsFor(d.endsAt - d.startedAt);
    let wins = 0;
    let losses = 0;
    let gold = 0;
    let exp = 0;
    let rounds = 0;
    /** @type {Record<string, number>} */
    const boxes = {};

    for (let i = 0; i < runs; i++) {
      const battle = RPG.battle.start({
        fieldId: d.fieldId, waves: d.waves,
        party: RPG.state.partyUnits(), bossFinale: d.bossFinale,
      });
      let guard = 0;
      while (!battle.finished && guard++ < 4000) {
        if (battle.phase === 'wave_clear') { RPG.battle.advanceWave(battle); continue; }
        const action = RPG.autoplay.chooseAction(battle);
        if (!action) break;
        RPG.battle.commandSkill(battle, action.skillId, action.targets, { auto: true });
      }

      const pay = RPG.economy.payout(battle, { partySize: Math.max(1, s.party.length) });
      gold += Math.floor(pay.gold * REWARD_RATE);
      exp += Math.floor(pay.expEach * REWARD_RATE);
      for (const b of Object.keys(pay.boxes)) {
        boxes[b] = (boxes[b] || 0) + pay.boxes[b];
      }
      rounds += battle.totalRounds;
      if (battle.victory) wins++; else losses++;

      s.stats.battles++;
      if (battle.victory) s.stats.wins++;
      RPG.codex.record(battle);
    }

    // 宝箱も倍率ぶんだけ減らす（端数は切り捨て、最低でも出たぶんの一部は残す）
    for (const b of Object.keys(boxes)) {
      boxes[b] = Math.max(1, Math.floor(boxes[b] * REWARD_RATE));
    }

    RPG.state.addGold(gold);
    for (const b of Object.keys(boxes)) RPG.state.addBox(b, boxes[b]);

    /** @type {string[]} */
    const levelUps = [];
    for (const id of s.party) {
      const gained = RPG.state.addExp(id, exp);
      if (gained > 0) levelUps.push(`${RPG.state.charName(id)} Lv${s.characters[id].level}`);
    }

    s.dispatch = null;
    RPG.state.persist();

    return {
      ok: true,
      result: {
        fieldId: d.fieldId, planId: d.planId,
        runs, wins, losses, gold, exp, boxes, rounds, levelUps,
        winRate: runs ? wins / runs : 0,
      },
    };
  }

  RPG.dispatch = {
    PLANS, MS_PER_RUN, REWARD_RATE, MAX_RUNS,
    plan, runsFor, current, start, status, cancel, collect, formatDuration,
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
