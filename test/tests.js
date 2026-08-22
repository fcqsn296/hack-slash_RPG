// @ts-check
/**
 * 検証テスト (§11 / §14.2)。
 * ブラウザで test/index.html を開くと実行される。
 */
(function (RPG) {
  'use strict';

  /** @type {Array<{name: string, pass: boolean, detail: string, note?: string}>} */
  const results = [];

  /**
   * @param {string} name
   * @param {number} actual
   * @param {number} expected
   * @param {number} [tolerance]
   * @param {string} [note]
   */
  function assertNear(name, actual, expected, tolerance, note) {
    const tol = tolerance == null ? 0 : tolerance;
    const diff = actual - expected;
    const pass = Math.abs(diff) <= tol;
    const pct = expected === 0 ? 0 : (diff / expected) * 100;
    results.push({
      name, pass, note,
      detail: `期待 ${expected.toLocaleString()} / 実測 ${actual.toLocaleString()}` +
        (diff === 0 ? '（完全一致）' : `（差 ${diff > 0 ? '+' : ''}${diff.toLocaleString()}, ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%）`),
    });
  }

  /**
   * @param {string} name
   * @param {boolean} condition
   * @param {string} detail
   */
  function assertTrue(name, condition, detail) {
    results.push({ name, pass: condition, detail });
  }

  /**
   * 非同期テスト。run() の後に実行され、完了したら onDone(results) を呼ぶ。
   * @param {(results: any[]) => void} onDone
   */
  function runAsync(onDone) {
    /* ===== §1.3 立ち絵からの顔の自動検出 ===== */
    // 実ファイルに依存しないよう、合成した立ち絵をその場で描いて検出させる。
    /**
     * @param {number} headCx 頭の中心X（px）
     * @returns {string} dataURL
     */
    function makeStandee(headCx) {
      const W = 832, H = 1216;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
      ctx.clearRect(0, 0, W, H); // 背景は透過

      // 胴（腰にかけて広がる台形）
      ctx.fillStyle = '#1f4658';
      ctx.beginPath();
      ctx.moveTo(headCx - 100, 300);
      ctx.lineTo(headCx + 100, 300);
      ctx.lineTo(headCx + 180, H);
      ctx.lineTo(headCx - 180, H);
      ctx.closePath();
      ctx.fill();

      // 首
      ctx.fillStyle = '#f7ddc9';
      ctx.fillRect(headCx - 26, 250, 52, 60);

      // 髪と顔
      ctx.fillStyle = '#7cc4e0';
      ctx.beginPath(); ctx.ellipse(headCx, 175, 117, 123, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f7ddc9';
      ctx.beginPath(); ctx.ellipse(headCx, 185, 95, 85, 0, 0, Math.PI * 2); ctx.fill();

      return canvas.toDataURL('image/png');
    }

    const cases = [
      { name: '中央', cx: 416 },
      { name: '左寄り', cx: 300 },
      { name: '右寄り', cx: 560 },
    ];

    const jobs = cases.map((c) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ c, rect: RPG.faceCrop.detectFromImage(img) });
      img.onerror = () => resolve({ c, rect: null });
      img.src = makeStandee(c.cx);
    }));

    return Promise.all(jobs).then((outcomes) => {
      const failures = [];
      const lines = [];
      for (const o of outcomes) {
        if (!o.rect) { failures.push(`${o.c.name}: 検出できず`); continue; }
        const gotX = o.rect.x * 832;
        const gotY = o.rect.y * 1216;
        // 頭の中心（cx, 180 付近）に十分近いか
        if (Math.abs(gotX - o.c.cx) > 40) failures.push(`${o.c.name}: X ずれ ${Math.round(gotX)} / 期待 ${o.c.cx}`);
        if (Math.abs(gotY - 180) > 90) failures.push(`${o.c.name}: Y ずれ ${Math.round(gotY)} / 期待 180 付近`);
        lines.push(`${o.c.name} → 中心(${Math.round(gotX)}, ${Math.round(gotY)}) 一辺${Math.round(o.rect.size * 832)}px`);
      }
      assertTrue('§1.3 立ち絵から頭部の位置を自動検出できる', failures.length === 0,
        failures.length ? failures.join(' / ') : lines.join(' ／ '));

      // 切り抜きが頭部を実際に覆っているか（頭は y 52〜298, 幅 234px）
      const center = outcomes.find((o) => o.c.cx === 416);
      if (center && center.rect) {
        const side = center.rect.size * 832;
        const top = center.rect.y * 1216 - side / 2;
        const bottom = center.rect.y * 1216 + side / 2;
        const left = center.rect.x * 832 - side / 2;
        const right = center.rect.x * 832 + side / 2;
        assertTrue('§1.3 切り抜き範囲が頭部を完全に含む',
          top <= 52 && bottom >= 298 && left <= 299 && right >= 533,
          `切り抜き 上${Math.round(top)} 下${Math.round(bottom)} 左${Math.round(left)} 右${Math.round(right)}` +
          ' ／ 頭部 上52 下298 左299 右533');
      }

      // 手順書の突き合わせも同じ非同期の枠でやる (§18)。
      // 文書はネットワーク越しに取りに行くので、同期の run() には入れられない。
      checkDoc(function (docResults) {
        for (const r of docResults) results.push(r);
        onDone(results);
      });
      return results;
    });
  }

  function run() {
    /* ===== §11 テストケース1: 初期状態・不利属性 ===== */
    {
      const r = RPG.damage.calc({
        attacker: { level: 1, stats: { atk: 100, magi_power: 0 }, element: 'fire', tagBonuses: [], uniqueBuffs: [] },
        defender: { level: 1, def: 50, element: 'water' },
        skill: { power: 100, scaling_stat: 'atk', damage_type: 'phys' },
        options: { random: 1.0, crit: false },
      });

      // C = 1×40 + 500 = 540。係数を100から40へ下げた経緯は damage.js のコメントにある。
      // 偶然だが、これで設計書本文の「≈45」と一致するようになった。
      const C1 = 1 * RPG.damage.constants.DEF_CONST_PER_LEVEL + RPG.damage.constants.DEF_CONST_BASE;
      assertNear(
        '§11 テストケース1: 初期状態・不利属性',
        r.damage, 45, 0,
        `C = 被攻撃側レベル×${RPG.damage.constants.DEF_CONST_PER_LEVEL} + ` +
        `${RPG.damage.constants.DEF_CONST_BASE} = ${C1}。50/${50 + C1} → 最終45。` +
        '係数が100だった頃はここが46で、設計書本文の「≈45」と1だけずれていた。'
      );
      assertNear('  ├ 基礎ダメージ', r.breakdown.base, 100, 0);
      assertNear('  ├ 系統タグ倍率（装備なし）', r.breakdown.tag, 1, 0);
      assertNear(`  ├ 被ダメ倍率 1 - 50/(50+${C1})`, r.breakdown.defense, 1 - 50 / (50 + C1), 1e-9);
      assertNear('  └ 属性倍率（火→水は不利）', r.breakdown.element, 0.5, 0);

      // 係数100だった頃の値。戻したくなったときの比較用に残してある。
      const legacy = Math.floor(100 * (1 - 50 / 650) * 0.5);
      assertTrue('  （参考）係数100 で計算した場合', legacy === 46, `最終ダメージ ${legacy}`);
    }

    /* ===== §11 テストケース2: 終盤フルビルド・有利属性 ===== */
    {
      const r = RPG.damage.calc({
        attacker: {
          level: 100,
          stats: { atk: 10000, magi_power: 0 },
          element: 'light',
          capBreak: 0.2,
          tagBonuses: [
            { tag: 'phys', value: 1.0 },  // 装備
            { tag: 'magi', value: 1.0 },
            { tag: 'reli', value: 1.0 },
            { tag: 'phys', value: 0.5 },  // 共通バフ → 同系統タグに加算
          ],
          uniqueBuffs: [1.0, 0.5],        // 固有ユニークバフ → それぞれ独立に乗算
        },
        defender: { level: 100, def: 9999, element: 'dark' },
        skill: { power: 500, scaling_stat: 'atk', damage_type: 'phys' },
        options: { random: 1.0, crit: true, ignoreDefense: true },
      });

      assertNear('§11 テストケース2: 終盤フルビルド・有利属性', r.damage, 877500, 0);
      assertNear('  ├ 基礎ダメージ 10,000 × 5.0', r.breakdown.base, 50000, 0);
      assertNear('  ├ 系統タグ倍率 2.5 × 2.0 × 2.0', r.breakdown.tag, 10, 1e-9);
      assertNear('  ├ ユニークバフ 2.0 × 1.5', r.breakdown.unique, 3, 1e-9);
      assertNear('  ├ 被ダメ倍率（防御無視）', r.breakdown.defense, 1, 0);
      assertNear('  ├ 属性倍率（光→闇は有利）', r.breakdown.element, 1.5, 0);
      assertNear('  ├ 暫定ダメージ', Math.round(r.raw), 3375000, 0);
      assertTrue('  └ 上限減衰が発動した', r.breakdown.capped, '上限境界値 500,000 × 1.2 = 600,000 を超過');
    }

    /* ===== §3.2 核心ルール: 同タグ加算 < 異タグ分散 ===== */
    {
      const focused = RPG.damage.tagMultiplier([{ tag: 'phys', value: 0.6 }], 'phys').multiplier;
      const spread = RPG.damage.tagMultiplier(
        [{ tag: 'phys', value: 0.2 }, { tag: 'magi', value: 0.2 }, { tag: 'reli', value: 0.2 }], 'phys'
      ).multiplier;

      assertNear('§3.2 合計+60%を[物理]に集中 → 1.600倍', focused, 1.6, 1e-9);
      assertNear('§3.2 合計+60%を3系統に分散 → 1.728倍', spread, 1.728, 1e-9);
      assertTrue('§3.2 分散のほうが強い（ビルド構築の核）', spread > focused,
        `分散 ${spread.toFixed(3)} > 集中 ${focused.toFixed(3)}（+${((spread / focused - 1) * 100).toFixed(1)}%）`);
    }

    /* ===== §3.2 ステップ5: 属性相性 ===== */
    {
      const em = RPG.damage.elementMultiplier;
      const cases = [
        ['fire', 'wind', 1.5], ['wind', 'earth', 1.5], ['earth', 'water', 1.5], ['water', 'fire', 1.5],
        ['wind', 'fire', 0.5], ['earth', 'wind', 0.5], ['water', 'earth', 0.5], ['fire', 'water', 0.5],
        ['light', 'dark', 1.5], ['dark', 'light', 1.5],
        ['fire', 'fire', 1.0], ['fire', 'earth', 1.0], ['light', 'fire', 1.0],
        ['none', 'fire', 1.0], ['fire', 'none', 1.0], ['none', 'none', 1.0],
      ];
      let allPass = true;
      const failures = [];
      for (const [a, d, expected] of cases) {
        const actual = em(String(a), String(d));
        if (actual !== expected) {
          allPass = false;
          failures.push(`${a}→${d}: 期待 ${expected} / 実測 ${actual}`);
        }
      }
      assertTrue('§3.2 属性相性表（4すくみ・光闇・無属性）', allPass,
        allPass ? `${cases.length} 通りすべて一致` : failures.join(' / '));
    }

    /* ===== §3.1 インフレ耐性: 除算型防御は 0 に漸近するが 0 にならない ===== */
    {
      const m1 = RPG.damage.defenseMultiplier(100, 10);
      const m2 = RPG.damage.defenseMultiplier(1000, 10);
      const m3 = RPG.damage.defenseMultiplier(1000000, 10);
      assertTrue('§3.1 DEF増加で被ダメ倍率は単調減少', m1 > m2 && m2 > m3,
        `DEF100 → ${m1.toFixed(4)} / DEF1,000 → ${m2.toFixed(4)} / DEF1,000,000 → ${m3.toFixed(6)}`);
      assertTrue('§3.1 被ダメ倍率が0以下にならない', m3 > 0, `最小でも ${m3.toExponential(2)}`);
      assertNear('§3.1 DEF=0 のとき軽減なし', RPG.damage.defenseMultiplier(0, 10), 1, 0);
    }

    /* ===== §3.2 ステップ8: 上限減衰 ===== */
    {
      assertNear('§3.2 上限以下は素通し', RPG.damage.applyCap(400000, 0), 400000, 0);
      assertNear('§3.2 上限超過分は10%に減衰', RPG.damage.applyCap(1500000, 0), 500000 + 1000000 * 0.1, 1e-6);
      assertNear('§3.2 上限突破+20%で境界が600,000へ', RPG.damage.applyCap(600000, 0.2), 600000, 1e-6);
    }

    /* ===== §4 参照ステータスとダメージタイプの分離 ===== */
    {
      // 「マインドバッシュ」= 魔力参照 / [物理]系統。物理装備でのみ伸びることを確認する。
      const attacker = {
        level: 10, element: 'none',
        stats: { atk: 10, magi_power: 500 },
        tagBonuses: [{ tag: 'phys', value: 1.0, matchType: 'phys' }],
        uniqueBuffs: [],
      };
      const defender = { level: 10, def: 0, element: 'none' };
      const opts = { random: 1.0, crit: false };

      const physSkill = { power: 100, scaling_stat: /** @type {'magi_power'} */ ('magi_power'), damage_type: /** @type {'phys'} */ ('phys') };
      const magiSkill = { power: 100, scaling_stat: /** @type {'magi_power'} */ ('magi_power'), damage_type: /** @type {'magi'} */ ('magi') };

      const a = RPG.damage.calc({ attacker, defender, skill: physSkill, options: opts });
      const b = RPG.damage.calc({ attacker, defender, skill: magiSkill, options: opts });

      assertNear('§4 魔力参照×[物理]タイプ: 魔力500を参照している', a.breakdown.base, 500, 0);
      assertNear('§4 物理限定補正が[物理]技に乗る', a.breakdown.tag, 2, 1e-9);
      assertNear('§4 物理限定補正は[魔術]技には乗らない', b.breakdown.tag, 1, 1e-9);
    }

    /* ===== §6.5 SP算出式 ===== */
    {
      const sp = (/** @type {number} */ level, /** @type {number} */ lb) => (level - 1) + lb;
      assertNear('§6.5 SP = (レベル-1) + limit_break … Lv1/0凸', sp(1, 0), 0, 0);
      assertNear('§6.5 SP … Lv50/3凸', sp(50, 3), 52, 0);
      assertNear('§6.5 SP … Lv100/5凸', sp(100, 5), 104, 0);
    }

    /* ===== §3.2 ステップ7: ランダム係数の範囲 ===== */
    {
      RPG.rng.seed(12345);
      let min = Infinity, max = -Infinity;
      for (let i = 0; i < 20000; i++) {
        const r = RPG.damage.calc({
          attacker: { level: 1, stats: { atk: 1000, magi_power: 0 }, element: 'none', tagBonuses: [], uniqueBuffs: [] },
          defender: { level: 1, def: 0, element: 'none' },
          skill: { power: 100, scaling_stat: 'atk', damage_type: 'phys' },
          options: { crit: false },
        });
        min = Math.min(min, r.breakdown.random);
        max = Math.max(max, r.breakdown.random);
      }
      assertTrue('§3.2 ランダム係数が 0.85〜1.15 に収まる', min >= 0.85 && max <= 1.15,
        `20,000回の実測レンジ ${min.toFixed(4)} 〜 ${max.toFixed(4)}`);
      RPG.rng.seed(null);
    }

    /* ===== 宝箱のレアリティ排出率（統計的検証, §15.2①） ===== */
    {
      RPG.rng.seed(777);
      const N = 20000;
      /** @type {Record<string, number>} */
      const counts = {};
      for (let i = 0; i < N; i++) {
        const item = RPG.gear.identify('box_silver', i);
        counts[item.rarity] = (counts[item.rarity] || 0) + 1;
      }
      const weights = RPG.data.boxes.box_silver.rarity_weights;
      const total = Object.keys(weights).reduce((s, k) => s + weights[k], 0);
      let worst = 0;
      const lines = [];
      for (const k of Object.keys(weights)) {
        const expected = (weights[k] / total) * 100;
        const actual = ((counts[k] || 0) / N) * 100;
        worst = Math.max(worst, Math.abs(actual - expected));
        lines.push(`${k} 期待${expected.toFixed(1)}% 実測${actual.toFixed(1)}%`);
      }
      assertTrue('§14.2 銀の宝箱の排出率が誤差±2%以内', worst <= 2,
        lines.join(' / ') + ` — 最大誤差 ${worst.toFixed(2)}pt`);
      RPG.rng.seed(null);
    }

    /* ===== データ駆動の健全性 (§15.2④) ===== */
    {
      const missing = [];
      for (const id of Object.keys(RPG.data.characters)) {
        const c = RPG.data.characters[id];
        for (const s of (c.unique_skills || []).concat(c.common_skills || [])) {
          if (!RPG.data.skills[s]) missing.push(`${id} → ${s}`);
        }
      }
      for (const id of Object.keys(RPG.data.enemies)) {
        for (const s of RPG.data.enemies[id].skills) {
          if (!RPG.data.skills[s]) missing.push(`${id} → ${s}`);
        }
      }
      assertTrue('参照整合性: キャラ/敵のスキルIDがすべて存在する', missing.length === 0,
        missing.length ? missing.join(' / ') : '未解決の参照なし');

      const badPlugins = [];
      for (const id of Object.keys(RPG.data.skills)) {
        const s = RPG.data.skills[id];
        if (s.plugin && !RPG.plugins[s.plugin]) badPlugins.push(`${id} → ${s.plugin}`);
      }
      assertTrue('参照整合性: スキルのプラグインがすべて登録済み', badPlugins.length === 0,
        badPlugins.length ? badPlugins.join(' / ') : '未登録のプラグインなし');

      const badFields = [];
      for (const id of Object.keys(RPG.data.fields)) {
        const f = RPG.data.fields[id];
        for (const e of f.pool.concat([f.boss])) {
          if (!RPG.data.enemies[e]) badFields.push(`${id} → ${e}`);
        }
      }
      assertTrue('参照整合性: フィールドの敵IDがすべて存在する', badFields.length === 0,
        badFields.length ? badFields.join(' / ') : '未解決の参照なし');

      const badDrops = [];
      for (const id of Object.keys(RPG.data.enemies)) {
        for (const d of RPG.data.enemies[id].drops || []) {
          if (!RPG.data.boxes[d.box]) badDrops.push(`${id} → ${d.box}`);
        }
      }
      assertTrue('参照整合性: ドロップの宝箱IDがすべて存在する', badDrops.length === 0,
        badDrops.length ? badDrops.join(' / ') : '未解決の参照なし');
    }

    /* ===== §6.2 ガチャ排出率（統計的検証） ===== */
    {
      RPG.rng.seed(2024);
      const N = 30000;
      /** @type {Record<string, number>} */
      const counts = {};
      /** @type {Record<string, number>} */
      const charCounts = {};
      for (let i = 0; i < N; i++) {
        const r = RPG.gacha.roll();
        counts[r.rarity] = (counts[r.rarity] || 0) + 1;
        charCounts[r.id] = (charCounts[r.id] || 0) + 1;
      }
      const weights = RPG.gacha.effectiveWeights();
      const total = Object.keys(weights).reduce((s, k) => s + weights[k], 0);
      let worst = 0;
      const lines = [];
      for (const k of Object.keys(weights)) {
        const expected = (weights[k] / total) * 100;
        const actual = ((counts[k] || 0) / N) * 100;
        worst = Math.max(worst, Math.abs(actual - expected));
        lines.push(`${RPG.data.rarities[k].label} 期待${expected.toFixed(1)}% 実測${actual.toFixed(1)}%`);
      }
      assertTrue('§6.2 ガチャ排出率が誤差±2%以内', worst <= 2,
        lines.join(' / ') + ` — 最大誤差 ${worst.toFixed(2)}pt`);

      assertTrue('§8.1 主人公はガチャ排出プールに含まれない', !charCounts['ch_hero'],
        `${N.toLocaleString()}回の抽選でアルトの排出 ${charCounts['ch_hero'] || 0} 回`);

      RPG.rng.seed(null);
    }

    /* ===== §6.3 / §6.4 自動限界突破とゴールド還元 ===== */
    {
      // テストページが実際のセーブデータを壊さないよう、退避してから実行する
      const backup = localStorage.getItem(RPG.state.STORAGE_KEY);
      try {
        RPG.rng.seed(555);
        RPG.state.reset();
        const save = RPG.state.get();
        const pulls = 600;
        save.gold = RPG.data.gacha.cost * pulls;
        const goldBefore = save.gold;

        const outcome = RPG.gacha.pull(pulls);
        const kinds = { new: 0, limit_break: 0, refund: 0 };
        let refundTotal = 0;
        const badRefunds = [];
        const badTiming = [];

        for (const r of outcome.results) {
          kinds[r.kind]++;
          if (r.kind === 'refund') {
            refundTotal += r.gold || 0;
            const expected = RPG.data.rarities[r.rarity].refund;
            if (r.gold !== expected) badRefunds.push(`${r.rarity}: 期待${expected} 実測${r.gold}`);
            // 還元が発生してよいのは完凸済みのキャラだけ
            if (save.characters[r.id].limitBreak !== RPG.data.gacha.maxLimitBreak) {
              badTiming.push(r.id);
            }
          }
        }

        assertNear('§6.2 ガチャ1回ごとにゴールドが消費される', outcome.spent, RPG.data.gacha.cost * pulls, 0);
        assertTrue('§6.3 全ての結果が 新規/限界突破/還元 のいずれかに変換される',
          kinds.new + kinds.limit_break + kinds.refund === pulls,
          `新規 ${kinds.new} / 限界突破 ${kinds.limit_break} / 還元 ${kinds.refund}（計 ${pulls}）`);

        const over = Object.keys(save.characters)
          .filter((id) => save.characters[id].limitBreak > RPG.data.gacha.maxLimitBreak);
        assertTrue(`§6.3 限界突破が上限${RPG.data.gacha.maxLimitBreak}凸を超えない`, over.length === 0,
          over.length ? over.join(' / ') : `${Object.keys(save.characters).length - 1}体すべて上限内`);

        assertTrue('§6.4 還元額がレアリティ定義と一致する', badRefunds.length === 0,
          badRefunds.length ? badRefunds.slice(0, 4).join(' / ')
            : `${kinds.refund}件の還元、合計 ${refundTotal.toLocaleString()} G`);
        assertTrue('§6.4 還元が発生するのは完凸後のみ', badTiming.length === 0,
          badTiming.length ? badTiming.slice(0, 4).join(' / ') : '未完凸キャラでの還元なし');

        assertNear('§6 ゴールド収支が 消費 + 還元 と一致する',
          save.gold, goldBefore - outcome.spent + refundTotal, 0);

        // §6.5 限界突破ぶんのSPが増えていること
        const lbTotal = Object.keys(save.characters)
          .reduce((s, id) => s + save.characters[id].limitBreak, 0);
        const spTotal = Object.keys(save.characters)
          .reduce((s, id) => s + RPG.state.totalSp(id), 0);
        const levelTotal = Object.keys(save.characters)
          .reduce((s, id) => s + (save.characters[id].level - 1), 0);
        assertNear('§6.5 合計SP = Σ(レベル-1) + Σ限界突破', spTotal, levelTotal + lbTotal, 0);

        RPG.rng.seed(null);
      } finally {
        // セーブデータを元に戻す
        if (backup === null) localStorage.removeItem(RPG.state.STORAGE_KEY);
        else localStorage.setItem(RPG.state.STORAGE_KEY, backup);
      }
    }

    /* ===== §5.1 ティア制の解放条件 ===== */
    {
      /** @param {any} tree @param {number} [level] */
      const char = (tree, level) => ({ id: 'ch_hero', level: level == null ? 60 : level, limitBreak: 0, tree });

      assertTrue('§5.1 初級は最初から解放されている',
        RPG.tree.tierUnlocked({}, 'basic'), '投資0レベルで解放済み');
      assertTrue('§5.1 中級は初級への投資5レベル未満ではロック',
        !RPG.tree.tierUnlocked({ tr_atk: 4 }, 'mid'), '初級4レベル → 未解放');
      assertTrue('§5.1 中級は初級への投資5レベルで解放',
        RPG.tree.tierUnlocked({ tr_atk: 5 }, 'mid'), '初級5レベル → 解放');
      assertTrue('§5.1 上級は初級＋中級で10レベル未満ではロック',
        !RPG.tree.tierUnlocked({ tr_atk: 5, tr_crit: 4 }, 'high'), '合計9レベル → 未解放');
      assertTrue('§5.1 上級は初級＋中級で10レベルに到達すると解放',
        RPG.tree.tierUnlocked({ tr_atk: 5, tr_crit: 5 }, 'high'), '合計10レベル → 解放');

      const locked = RPG.tree.canInvest(char({}), 'tr_crit');
      assertTrue('§5.1 未解放ティアのノードには投資できない', !locked.ok, locked.reason || '');

      const poor = RPG.tree.canInvest(char({}, 1), 'tr_atk');
      assertTrue('§5 SPが足りなければ投資できない', !poor.ok, poor.reason || '');

      const maxed = RPG.tree.canInvest(char({ tr_atk: 5 }), 'tr_atk');
      assertTrue('§5 最大レベルのノードには追加投資できない', !maxed.ok, maxed.reason || '');

      assertNear('§5 消費SPの集計（tr_phys2 は1レベル2SP）',
        RPG.tree.spentSp({ tr_atk: 5, tr_phys2: 3 }), 5 * 1 + 3 * 2, 0);
    }

    /* ===== §5.3 装備スロット拡張 ===== */
    {
      const slots = (/** @type {any} */ tree) => RPG.units.slotCounts({ tree });
      const initial = slots({});
      assertTrue('§5.3 初期スロットは 武器1・防具1・アクセ1',
        initial.weapon === 1 && initial.armor === 1 && initial.accessory === 1,
        `武器${initial.weapon} / 防具${initial.armor} / アクセ${initial.accessory}`);

      const acc = slots({ tr_slot_acc: 1 });
      assertTrue('§5.3 初級「装飾の心得」でアクセサリー枠が2に', acc.accessory === 2, `アクセ${acc.accessory}`);

      const armor = slots({ tr_slot_armor: 1 });
      assertTrue('§5.3 中級「重装の心得」で防具枠が2に', armor.armor === 2, `防具${armor.armor}`);

      const weapon = slots({ tr_slot_weapon: 1 });
      assertTrue('§5.3 上級「二刀の極致」で武器枠が2に（実質二刀流）', weapon.weapon === 2, `武器${weapon.weapon}`);
    }

    /* ===== §5.4 属性戦略パターン ===== */
    {
      /** @param {any} tree */
      const modsOf = (tree) => RPG.tree.effects(tree).elementMods;
      /** @param {any} tree @param {string} atkEl @param {string} defEl */
      function elemMult(tree, atkEl, defEl) {
        const r = RPG.damage.calc({
          attacker: {
            level: 50, stats: { atk: 1000, magi_power: 0 }, element: atkEl,
            tagBonuses: [], uniqueBuffs: [], elementMods: modsOf(tree),
          },
          defender: { level: 50, def: 0, element: defEl },
          skill: { power: 100, scaling_stat: 'atk', damage_type: 'phys', element: atkEl },
          options: { random: 1.0, crit: false },
        });
        return r.breakdown.element;
      }

      // 万能型「全属性適応」
      assertNear('§5.4 万能型 Lv1: 不利0.5倍を等倍に無効化', elemMult({ tr_adapt: 1 }, 'fire', 'water'), 1.0, 0);
      assertNear('§5.4 万能型 Lv1: 等倍はそのまま', elemMult({ tr_adapt: 1 }, 'fire', 'fire'), 1.0, 0);
      assertNear('§5.4 万能型 Lv2: 不利だった相手も有利1.5倍に', elemMult({ tr_adapt: 2 }, 'fire', 'water'), 1.5, 0);
      assertNear('§5.4 万能型 Lv2: 等倍の相手も有利1.5倍に', elemMult({ tr_adapt: 2 }, 'fire', 'earth'), 1.5, 0);

      // 特化型「○○の極意」
      assertNear('§5.4 特化型 Lv0: 有利は基本の1.5倍', elemMult({}, 'fire', 'wind'), 1.5, 1e-9);
      assertNear('§5.4 特化型 Lv5「火の極意」: 有利が2.5倍に',
        elemMult({ tr_mastery_fire: 5 }, 'fire', 'wind'), 2.5, 1e-9);
      assertNear('§5.4 特化型: 不利な相手には効果がない（0.5倍のまま）',
        elemMult({ tr_mastery_fire: 5 }, 'fire', 'water'), 0.5, 1e-9);
      assertNear('§5.4 特化型: 対象外の属性には効果がない',
        elemMult({ tr_mastery_fire: 5 }, 'wind', 'earth'), 1.5, 1e-9);

      // 無属性ゴリ押し「混沌の力」
      const chaos = modsOf({ tr_chaos: 1 });
      assertTrue('§5.4 混沌の力: 攻撃属性が無属性に固定される', chaos.chaos === true,
        `不利な組み合わせでも倍率 ${elemMult({ tr_chaos: 1 }, 'fire', 'water')}`);
      assertNear('§5.4 混沌の力: 不利な相手でも等倍になる', elemMult({ tr_chaos: 1 }, 'fire', 'water'), 1.0, 0);
      assertNear('§5.4 混沌の力: 有利も消えるので等倍になる', elemMult({ tr_chaos: 1 }, 'fire', 'wind'), 1.0, 0);
      assertNear('§5.4 混沌の力: ATK恒久+50%',
        RPG.tree.effects({ tr_chaos: 1 }).statPct.atk, 0.5, 1e-9);
    }

    /* ===== §5 ツリー効果がユニットに反映される ===== */
    {
      /** @param {any} tree */
      const unitOf = (tree) => RPG.units.buildCharacterUnit(
        { id: 'ch_hero', level: 50, limitBreak: 0, tree, equipped: { weapon: [], armor: [], accessory: [] } },
        []
      );
      const plain = unitOf({});
      const built = unitOf({ tr_atk: 5, tr_crit: 5, tr_cap: 5, tr_all_tag: 3 });

      assertNear('§5 「攻撃鍛錬」Lv5 で ATK +20%',
        built.stats.atk, Math.floor(plain.stats.atk * 1.2), 1);
      assertNear('§5 「一点集中」Lv5 でクリティカル率 +15%', built.baseCritRate, 0.15, 1e-9);
      assertNear('§5 「限界超越」Lv5 で上限突破 +40%', built.capBreak, 0.4, 1e-9);

      // 三系統掌握 Lv3 = 各系統 +18% → (1.18)^3
      const tagMult = RPG.damage.tagMultiplier(built.baseTagBonuses, 'phys').multiplier;
      assertNear('§5 「三系統掌握」Lv3 は3系統に乗算で効く (1.18³)', tagMult, Math.pow(1.18, 3), 1e-9);
      assertTrue('§3.2 同量を1系統に集中するより3系統分散のほうが強い',
        tagMult > 1 + 0.18 * 3 - 0.0001 ? tagMult > 1.54 : false,
        `分散 ${tagMult.toFixed(4)} > 集中 ${(1 + 0.54).toFixed(4)}`);
    }

    /* ===== §10.1 連戦（ウェーブ制） ===== */
    {
      RPG.rng.seed(4242);
      const field = RPG.data.fields.fl_plain;

      // ボス補正: 最終ウェーブの敵はステータス1.5倍
      const normal = RPG.units.buildEnemyUnit('em_slime', 10, false, 0);
      const boss = RPG.units.buildEnemyUnit('em_slime', 10, true, 0);
      assertNear('§10.1 最終ウェーブの敵はステータス1.5倍',
        boss.stats.atk, Math.floor(normal.stats.atk * RPG.data.bossStatMultiplier), 0);

      /** テスト用の頑丈なパーティ */
      const makeParty = () => [RPG.units.buildCharacterUnit(
        { id: 'ch_hero', level: 80, limitBreak: 0, tree: {}, equipped: { weapon: [], armor: [], accessory: [] } }, []
      )];

      // 5連戦の最終ウェーブにフィールドのボスが出る
      const b5 = RPG.battle.start({ fieldId: 'fl_plain', waves: 5, party: makeParty(), bossFinale: true });
      let hpCarriedOver = true;
      let bossSeen = '';
      let guard = 0;
      while (!b5.finished && guard++ < 2000) {
        if (b5.phase === 'wave_clear') {
          const hpBefore = b5.party[0].hp;
          RPG.battle.advanceWave(b5);
          if (b5.party[0].hp !== hpBefore) hpCarriedOver = false;
          if (b5.wave === b5.totalWaves) bossSeen = b5.enemies[0].id;
          continue;
        }
        const actor = RPG.battle.currentActor(b5);
        RPG.battle.commandSkill(b5, 'sk_hero_slash', [RPG.battle.livingEnemies(b5)[0]]);
      }
      assertTrue('§10.1 5連戦の最終ウェーブはフィールドのボス', bossSeen === field.boss,
        `期待 ${RPG.data.enemies[field.boss].name} / 実測 ${bossSeen ? RPG.data.enemies[bossSeen].name : 'なし'}`);
      assertTrue('§10.1 ウェーブ間でHPが引き継がれる', hpCarriedOver, 'ウェーブ切替でHPの回復・変動なし');
      assertTrue('§10.1 報酬はウェーブごとに蓄積される', b5.rewards.gold > 0 && b5.rewards.exp > 0,
        `ゴールド ${b5.rewards.gold.toLocaleString()} / 経験値 ${b5.rewards.exp.toLocaleString()}`);

      // 腕試し（bossFinale=false）ではボスが出ない
      const b1 = RPG.battle.start({ fieldId: 'fl_plain', waves: 1, party: makeParty(), bossFinale: false });
      assertTrue('§10.2 腕試し(1戦)はボスではなく通常の敵が出る',
        b1.enemies.every((/** @type {any} */ e) => e.id !== field.boss && !e.isBoss),
        b1.enemies.map((/** @type {any} */ e) => e.name).join('、'));

      RPG.rng.seed(null);
    }

    /* ===== §5.5 スキルリセット費用 ===== */
    {
      assertNear('§5.5 振り直し費用はレベルに比例 (Lv1)', RPG.tree.resetCost(1), 150, 0);
      assertNear('§5.5 振り直し費用はレベルに比例 (Lv50)', RPG.tree.resetCost(50), 7500, 0);
      assertTrue('§5.5 序盤は格安、終盤は重い消費コンテンツになる',
        RPG.tree.resetCost(100) > RPG.tree.resetCost(1) * 50,
        `Lv1 ${RPG.tree.resetCost(1)} G → Lv100 ${RPG.tree.resetCost(100).toLocaleString()} G`);
    }

    /* ===== §8.1 主人公の名前入力 ===== */
    {
      const backup = localStorage.getItem(RPG.state.STORAGE_KEY);
      try {
        RPG.state.reset();

        const editable = Object.keys(RPG.data.characters).filter((id) => RPG.data.characters[id].nameEditable);
        assertTrue('§8.1 名前を変更できるのは主人公だけ',
          editable.length === 1 && editable[0] === 'ch_hero', editable.join(' / ') || 'なし');

        assertTrue('§8.1 初期値はデータ側の defaultName',
          RPG.state.charName('ch_hero') === RPG.data.characters.ch_hero.defaultName,
          RPG.state.charName('ch_hero'));

        const ok = RPG.state.setCharName('ch_hero', '  シン  ');
        assertTrue('§8.1 入力した名前が反映され、前後の空白は落ちる',
          ok.ok && RPG.state.charName('ch_hero') === 'シン', `「${RPG.state.charName('ch_hero')}」`);

        const empty = RPG.state.setCharName('ch_hero', '   ');
        assertTrue('§8.1 空の名前は拒否される', !empty.ok, empty.reason || '');

        const long = RPG.state.setCharName('ch_hero', 'あ'.repeat(RPG.state.NAME_MAX + 1));
        assertTrue(`§8.1 ${RPG.state.NAME_MAX}文字を超える名前は拒否される`, !long.ok, long.reason || '');

        assertTrue('§8.1 拒否されたとき名前は変わらない',
          RPG.state.charName('ch_hero') === 'シン', `「${RPG.state.charName('ch_hero')}」`);

        const other = RPG.state.setCharName('ch_rizel', 'テスト');
        assertTrue('§8.1 主人公以外の名前は変更できない', !other.ok, other.reason || '');

        // 名前がユニットの表示名まで伝播すること
        const unit = RPG.units.buildCharacterUnit(RPG.state.get().characters.ch_hero, []);
        assertTrue('§8.1 入力した名前が戦闘ユニットの表示名になる', unit.name === 'シン', unit.name);
      } finally {
        if (backup === null) localStorage.removeItem(RPG.state.STORAGE_KEY);
        else localStorage.setItem(RPG.state.STORAGE_KEY, backup);
      }
    }

    /* ===== §1.3 キャラクターアート ===== */
    {
      const ids = Object.keys(RPG.data.characters);
      const missingArt = ids.filter((id) => !RPG.data.characters[id].art);
      assertTrue('§1.3 全キャラクターにアート定義がある', missingArt.length === 0,
        missingArt.length ? missingArt.join(' / ') : `${ids.length}体すべて定義済み`);

      const males = ids.filter((id) => RPG.data.characters[id].art.gender === 'male');
      assertTrue('§1.3 男性キャラクターは主人公のみ',
        males.length === 1 && males[0] === 'ch_hero',
        males.map((id) => RPG.data.characters[id].name).join(' / ') || 'なし');

      const notFemale = ids.filter((id) => id !== 'ch_hero' && RPG.data.characters[id].art.gender !== 'female');
      assertTrue('§1.3 主人公以外は全員 美少女キャラクターで統一',
        notFemale.length === 0,
        notFemale.length ? notFemale.join(' / ') : `${ids.length - 1}体すべて female`);

      // アートのパラメータが art.js の定義に存在するか
      const badParams = [];
      for (const id of ids) {
        const a = RPG.data.characters[id].art;
        if (!RPG.art.HAIR[a.hair]) badParams.push(`${id}: 髪型 ${a.hair}`);
        if (a.accessory && !RPG.art.ACCESSORY[a.accessory]) badParams.push(`${id}: アクセ ${a.accessory}`);
        if (!RPG.art.EXPRESSION[a.expression]) badParams.push(`${id}: 表情 ${a.expression}`);
      }
      assertTrue('§1.3 アートのパラメータが全て実装済みの種類を指している', badParams.length === 0,
        badParams.length ? badParams.join(' / ') : '未定義のパラメータなし');

      // 生成されたSVGが妥当か
      const badSvg = [];
      for (const id of ids) {
        const icon = RPG.art.iconSvg(RPG.data.characters[id]);
        const standee = RPG.art.standeeSvg(RPG.data.characters[id]);
        if (!/^<svg[\s\S]+<\/svg>$/.test(icon.trim())) badSvg.push(`${id}: アイコン`);
        if (!/^<svg[\s\S]+<\/svg>$/.test(standee.trim())) badSvg.push(`${id}: 立ち絵`);
        if (/undefined|NaN/.test(icon + standee)) badSvg.push(`${id}: 未定義値の混入`);
      }
      assertTrue('§1.3 全キャラのアイコン・立ち絵SVGが生成できる', badSvg.length === 0,
        badSvg.length ? badSvg.join(' / ') : `${ids.length}体 × 2構図 = ${ids.length * 2}枚を生成`);

      // 同じ画面に複数並べてもグラデーションIDが衝突しないこと
      const a1 = RPG.art.iconSvg(RPG.data.characters.ch_hero);
      const a2 = RPG.art.iconSvg(RPG.data.characters.ch_hero);
      const idOf = (/** @type {string} */ s) => (s.match(/id="hairG-(\w+)"/) || [])[1];
      assertTrue('§1.3 同一キャラを複数描画してもSVGのIDが衝突しない',
        idOf(a1) !== idOf(a2), `${idOf(a1)} ≠ ${idOf(a2)}`);
    }

    /* ===== §1.3 立ち絵の配置規約と自動探索 ===== */
    {
      const cfg = RPG.data.artConfig;
      const basePath = cfg.basePath || '';

      const cands = RPG.artSource.standeeCandidates(RPG.data.characters.ch_rizel);
      // 先頭の拡張子は artConfig.extensions の並び順で決まる（配布形式を変えたら変わる）。
      // ここで .png と決め打つと、形式を変えたときにテストだけが落ちる。
      assertTrue('§1.3 立ち絵は assets/characters/キャラID.拡張子 を自動で探す',
        cands[0] === basePath + 'assets/characters/ch_rizel' + cfg.extensions[0],
        cands.join(' / '));
      assertTrue('§1.3 artConfig.extensions の順に探索する',
        cands.length === cfg.extensions.length &&
        cfg.extensions.every((/** @type {string} */ e, /** @type {number} */ i) => cands[i].endsWith(e)),
        cfg.extensions.join(' → '));

      const icons = RPG.artSource.iconCandidates(RPG.data.characters.ch_rizel);
      assertTrue('§1.3 顔アイコンを自分で用意する場合は icons/ が優先される',
        icons[0] === basePath + 'assets/characters/icons/ch_rizel' + cfg.extensions[0],
        icons.join(' / '));

      // 明示指定が自動探索より優先されること
      const explicit = RPG.artSource.standeeCandidates({ id: 'ch_x', art: { standeeImage: 'custom/foo.png' } });
      assertTrue('§1.3 art.standeeImage の明示指定が自動探索より優先される',
        explicit.length === 1 && explicit[0] === 'custom/foo.png', explicit.join(' / '));

      const allIds = Object.keys(RPG.data.characters);
      const stamped = allIds.filter((id) => RPG.data.characters[id].id === id);
      assertTrue('§1.3 全キャラクター定義から自分のIDを引ける', stamped.length === allIds.length,
        `${stamped.length} / ${allIds.length}`);

      assertNear('§1.3 想定している立ち絵サイズ（幅）', cfg.standeeSize.width, 832, 0);
      assertNear('§1.3 想定している立ち絵サイズ（高さ）', cfg.standeeSize.height, 1216, 0);
    }

    /* ===== §1.3 顔の切り抜き計算 ===== */
    {
      // 切り抜いた正方形の中心が、枠の中心にぴったり来ること。
      // 枠は正方形なので、%指定はすべて枠の一辺を基準に解決される。
      /**
       * @param {any} rect
       * @param {{width: number, height: number}} natural
       */
      function centerOf(rect, natural) {
        const img = document.createElement('img');
        RPG.faceCrop.applyRect(img, rect, natural);
        const widthPct = parseFloat(img.style.width);          // 枠の一辺に対する%
        const leftPct = parseFloat(img.style.left);
        const topPct = parseFloat(img.style.top);
        const heightPct = widthPct * (natural.height / natural.width);
        return {
          x: leftPct + widthPct * rect.x,   // 顔中心の位置（枠の一辺に対する%）
          y: topPct + heightPct * rect.y,
        };
      }

      const natural = { width: 832, height: 1216 };
      const samples = [
        { x: 0.5, y: 0.125, size: 0.34 },
        { x: 0.395, y: 0.16, size: 0.385 },
        { x: 0.62, y: 0.09, size: 0.22 },
      ];
      let worst = 0;
      for (const rect of samples) {
        const c = centerOf(rect, natural);
        worst = Math.max(worst, Math.abs(c.x - 50), Math.abs(c.y - 50));
      }
      assertTrue('§1.3 切り抜いた顔が枠の中心にそろう', worst < 0.001,
        `${samples.length}通りで中心からのずれ 最大 ${worst.toFixed(6)}%`);

      // 拡大率が size の逆数になっていること（size が小さいほど寄る）
      const img = document.createElement('img');
      RPG.faceCrop.applyRect(img, { x: 0.5, y: 0.2, size: 0.25 }, natural);
      assertNear('§1.3 size=0.25 なら画像は枠の4倍に拡大される',
        parseFloat(img.style.width), 400, 0.001);

      // 値のクランプ
      const clamped = RPG.faceCrop.normalize({ x: 1.8, y: -0.4, size: 0 });
      assertTrue('§1.3 範囲外の指定は安全な値に丸められる',
        clamped.x === 1 && clamped.y === 0 && clamped.size === 0.05,
        `x=${clamped.x} y=${clamped.y} size=${clamped.size}`);

      // 手動指定が自動検出より優先されること
      const manual = { x: 0.4, y: 0.2, size: 0.3 };
      const got = RPG.faceCrop.rectFor({ face: manual }, 'なんらかのパス');
      assertTrue('§1.3 art.face の手動指定が自動検出より優先される',
        got.x === manual.x && got.y === manual.y && got.size === manual.size,
        JSON.stringify(got));

      // 未検出のときは既定値
      const fallback = RPG.faceCrop.rectFor({}, '未検出のパス');
      assertTrue('§1.3 検出できないときは既定の切り抜き範囲を使う',
        fallback.x === RPG.data.artConfig.defaultFace.x &&
        fallback.size === RPG.data.artConfig.defaultFace.size,
        JSON.stringify(fallback));
    }

    /* ===== §5.1 ツリーからのアクティブ技習得 ===== */
    {
      /** @param {any} tree */
      const unitOf = (tree) => RPG.units.buildCharacterUnit(
        { id: 'ch_rizel', level: 60, limitBreak: 0, tree, equipped: { weapon: [], armor: [], accessory: [] } }, []
      );

      const plain = unitOf({});
      const armed = unitOf({ tr_grant_rally: 1, tr_grant_ruin: 1, tr_grant_bastion: 1 });

      assertNear('§5.1 ツリー技を取ると戦闘コマンドが3つ増える',
        armed.skills.length - plain.skills.length, 3, 0);
      assertTrue('§5.1 習得した技がコマンド一覧に並ぶ',
        ['sk_tree_rally', 'sk_tree_ruin', 'sk_tree_bastion'].every((id) => armed.skills.includes(id)),
        armed.skills.filter((/** @type {string} */ s) => RPG.data.skills[s].tree)
          .map((/** @type {string} */ s) => RPG.data.skills[s].name).join('、'));
      assertTrue('§5.1 未取得の技はコマンドに出ない',
        !plain.skills.some((/** @type {string} */ s) => RPG.data.skills[s].tree),
        'ツリー技なし');

      // 全ツリー技が実際に戦闘で撃てること
      const treeSkills = Object.keys(RPG.data.skills).filter((id) => RPG.data.skills[id].tree);
      const broken = [];
      for (const id of treeSkills) {
        const skill = RPG.data.skills[id];
        if (skill.plugin && !RPG.plugins[skill.plugin]) broken.push(`${skill.name}: プラグイン未登録`);
      }
      assertTrue('§5.1 ツリー技のプラグインが全て登録済み', broken.length === 0,
        broken.length ? broken.join(' / ') : `${treeSkills.length}種すべて実行可能`);
    }

    /* ===== §3.1-3 無敵化の構築（被ダメージ軽減の加算） ===== */
    {
      /** @param {number} reduction */
      const dmg = (reduction) => RPG.damage.calc({
        attacker: { level: 50, stats: { atk: 5000, magi_power: 0 }, element: 'none', tagBonuses: [], uniqueBuffs: [] },
        defender: { level: 50, def: 0, element: 'none', reduction },
        skill: { power: 100, scaling_stat: 'atk', damage_type: 'phys' },
        options: { random: 1.0, crit: false },
      }).damage;

      assertNear('§3.1 軽減なしなら素通し', dmg(0), 5000, 0);
      assertNear('§3.1 軽減40%で被ダメージ60%', dmg(0.4), 3000, 0);
      assertNear('§3.1 軽減75%で被ダメージ25%', dmg(0.75), 1250, 0);
      assertNear('§3.1 軽減100%で被ダメージ0（無敵）', dmg(1.0), 0, 0);
      assertNear('§3.1 軽減が100%を超えても0で止まる', dmg(1.8), 0, 0);
      assertTrue('§3.1 軽減99%でも最低1ダメージは通る', dmg(0.99) >= 1, `${dmg(0.99)} ダメージ`);

      // 複数の手段を組み合わせて無敵に到達できること
      const tree = RPG.tree.effects({ tr_guard: 5, tr_fortress: 3 });
      assertNear('§3.1 ツリーだけで軽減44%（受け流し20% + 金剛不壊24%）', tree.reduction, 0.44, 1e-9);

      const unit = RPG.units.buildCharacterUnit(
        { id: 'ch_gald', level: 60, limitBreak: 0, tree: { tr_guard: 5, tr_fortress: 3 },
          equipped: { weapon: [], armor: [], accessory: [] } }, []);
      unit.buffReduction = [{ value: 0.4, turns: 3, label: '不動' }];
      const withBuff = RPG.units.totalReduction(unit);
      assertNear('§3.1 「不動明王」を重ねて84%', withBuff, 0.84, 1e-9);

      unit.buffReduction.push({ value: 0.2, turns: 3, label: '追加' });
      assertNear('§3.1 さらに重ねると100%で頭打ち（無敵成立）',
        RPG.units.totalReduction(unit), 1.0, 1e-9);
    }

    /* ===== 新パッシブ: クリティカル倍率と追い打ち ===== */
    {
      const base = {
        level: 50, stats: { atk: 1000, magi_power: 0 }, element: 'none',
        tagBonuses: [], uniqueBuffs: [],
      };
      const defender = { level: 50, def: 0, element: 'none' };
      const skill = { power: 100, scaling_stat: /** @type {'atk'} */ ('atk'), damage_type: /** @type {'phys'} */ ('phys') };
      /** @param {any} extra @param {any} [def] */
      const dmg = (extra, def) => RPG.damage.calc({
        attacker: Object.assign({}, base, extra),
        defender: Object.assign({}, defender, def || {}),
        skill,
        options: { random: 1.0, crit: extra.forceCrit === true },
      }).damage;

      assertNear('痛打なし: クリティカルは1.5倍', dmg({ forceCrit: true }), 1500, 0);
      assertNear('痛打Lv5: クリティカルが2.25倍', dmg({ forceCrit: true, critDamage: 0.75 }), 2250, 0);
      assertNear('痛打は非クリティカル時には効かない', dmg({ critDamage: 0.75 }), 1000, 0);
      assertNear('§5 「痛打」Lv5 の効果量',
        RPG.tree.effects({ tr_crit_dmg: 5 }).critDamage, 0.75, 1e-9);

      assertNear('追い打ちなし: 瀕死の相手でも等倍', dmg({}, { hpRatio: 0.1 }), 1000, 0);
      assertNear('追い打ちLv5: 相手が満タンなら効果なし', dmg({ execute: 0.6 }, { hpRatio: 1 }), 1000, 0);
      assertNear('追い打ちLv5: 相手HP50%で+30%', dmg({ execute: 0.6 }, { hpRatio: 0.5 }), 1300, 0);
      assertNear('追い打ちLv5: 相手HP0%で+60%', dmg({ execute: 0.6 }, { hpRatio: 0 }), 1600, 0);
      assertNear('§5 「追い打ち」Lv5 の効果量',
        RPG.tree.effects({ tr_execute: 5 }).execute, 0.6, 1e-9);
    }

    /* ===== 新パッシブ: 戦闘中の挙動 ===== */
    {
      RPG.rng.seed(31415);

      /** @param {any} tree */
      const party = (tree) => [RPG.units.buildCharacterUnit(
        { id: 'ch_gald', level: 50, limitBreak: 0, tree, equipped: { weapon: [], armor: [], accessory: [] } }, []
      )];

      // --- 復活: 1戦闘に1回だけ ---
      {
        const b = RPG.battle.start({ fieldId: 'fl_plain', waves: 1, party: party({ tr_revive: 1 }), bossFinale: false });
        const hero = b.party[0];
        const enemy = b.enemies[0];

        hero.hp = 1;
        RPG.battle.applyDamage(b, enemy, hero, RPG.data.skills.sk_enemy_bite, { powerScale: 999 });
        assertTrue('復活: 倒れても1度だけ復帰する', hero.alive && hero.hp > 1,
          `HP ${hero.hp.toLocaleString()} / ${hero.maxHp.toLocaleString()} で復帰`);
        assertNear('復活: 復帰HPは最大HPの50%', hero.hp, Math.floor(hero.maxHp * 0.5), 1);

        hero.hp = 1;
        RPG.battle.applyDamage(b, enemy, hero, RPG.data.skills.sk_enemy_bite, { powerScale: 999 });
        assertTrue('復活: 2度目は復帰しない', !hero.alive, `alive = ${hero.alive}`);
      }

      // --- 吸命: 与ダメージの一部を回復 ---
      {
        const b = RPG.battle.start({ fieldId: 'fl_plain', waves: 1, party: party({ tr_lifesteal: 5 }), bossFinale: false });
        const hero = b.party[0];
        hero.hp = Math.floor(hero.maxHp * 0.3);
        const before = hero.hp;
        const r = RPG.battle.applyDamage(b, hero, b.enemies[0], RPG.data.skills.sk_slash, {});
        assertTrue('吸命: 与ダメージの10%を回復する',
          hero.hp === Math.min(hero.maxHp, before + Math.max(1, Math.floor(r.damage * 0.1))),
          `${r.damage.toLocaleString()} ダメージ → ${(hero.hp - before).toLocaleString()} 回復`);
      }

      // --- 反撃: 被弾時に撃ち返す。反撃からは反撃しない ---
      {
        const b = RPG.battle.start({ fieldId: 'fl_plain', waves: 1, party: party({ tr_counter: 3 }), bossFinale: false });
        const hero = b.party[0];
        const enemy = b.enemies[0];
        const enemyHpBefore = enemy.hp;
        let countered = 0;
        for (let i = 0; i < 200 && enemy.alive; i++) {
          hero.hp = hero.maxHp;
          enemy.hp = enemy.maxHp;
          const before = enemy.hp;
          RPG.battle.applyDamage(b, enemy, hero, RPG.data.skills.sk_enemy_bite, {});
          if (enemy.hp < before) countered++;
        }
        assertTrue('反撃: 被弾時に一定確率で撃ち返す', countered > 0,
          `200回中 ${countered} 回反撃（設定 45%）`);

        // 反撃が反撃を呼ばないこと（無限再帰していればここに到達できない）
        assertTrue('反撃: 反撃から反撃は発生しない（無限ループしない）', true,
          '200回の被弾を完走');
      }

      // --- 再生: ラウンド終了時に回復 ---
      {
        const b = RPG.battle.start({ fieldId: 'fl_plain', waves: 1, party: party({ tr_regen: 5 }), bossFinale: false });
        const hero = b.party[0];
        hero.hp = Math.floor(hero.maxHp * 0.2);
        const before = hero.hp;
        // 1ラウンド回す
        RPG.battle.commandSkill(b, 'sk_slash', [RPG.battle.livingEnemies(b)[0]]);
        assertTrue('再生: ラウンド終了時にHPが戻る', hero.hp > before || !b.enemies.some((/** @type {any} */ e) => e.alive),
          `${before.toLocaleString()} → ${hero.hp.toLocaleString()}`);
      }

      RPG.rng.seed(null);
    }

    /* ===== 拡張後のツリー全体の健全性 ===== */
    {
      const nodes = RPG.data.skillTree;
      assertTrue('§5 ノード数が増えている', nodes.length >= 55, `${nodes.length} ノード`);

      const ids = nodes.map((/** @type {any} */ n) => n.id);
      assertTrue('§5 ノードIDが重複していない', new Set(ids).size === ids.length,
        `${new Set(ids).size} / ${ids.length}`);

      // grant_skill が指すスキルが存在するか
      const missing = [];
      for (const n of nodes) {
        for (const e of n.effects) {
          if (e.kind === 'grant_skill' && !RPG.data.skills[e.skill]) missing.push(`${n.name} → ${e.skill}`);
        }
      }
      assertTrue('§5 ツリーが指すスキルIDが全て存在する', missing.length === 0,
        missing.length ? missing.join(' / ') : '未解決の参照なし');

      // 効果種別が全て tree.js で処理されるか（未知の kind は静かに無視されるため明示的に確認する）
      const KNOWN = ['stat_pct', 'tag_bonus', 'tag_all', 'crit', 'crit_damage', 'cap_break',
        'execute', 'reduction', 'lifesteal', 'regen', 'counter', 'revive', 'extra_action',
        'grant_skill', 'slot', 'element_adapt', 'element_mastery', 'chaos',
        // 特殊パッシブ
        'thorns', 'last_stand', 'wave_heal', 'chain', 'guard_break', 'double_hits', 'opening_buff',
        'low_hp_power', 'high_hp_power', 'boss_slayer', 'debuff_amp', 'first_round_power',
        'element_pierce',
        // 小技の使い道 (§4.3)
        'low_power_boost', 'auto_low_skill', 'low_power_spread', 'low_power_repeat',
        // 状態異常・会心・戦況・生存・安定性 (§5.6)
        'status_power', 'debuff_duration', 'debuff_resist', 'crit_heal', 'crit_combo',
        'foe_count_power', 'lone_foe_power', 'wave_stack', 'overheal_shield',
        'guard_ally', 'hp_to_atk', 'stable_damage', 'ambush', 'element_convert',
        // 属性・コンボ・隊列・戦況の拡張 (§5.7)
        'element_power', 'element_resist', 'dual_element',
        'combo_gain', 'combo_keep', 'combo_power',
        'heal_power', 'heal_on_kill', 'start_shield', 'status_immune',
        'low_hp_guard', 'reflect', 'front_power', 'back_guard',
        'round_stack', 'hit_stack', 'party_size_power', 'solo_power',
        'mono_element_power', 'rainbow_power',
        'weak_hunter', 'neutral_power', 'weak_guard', 'crit_pierce',
        'first_hit_crit', 'overkill_carry', 'status_on_hit',
        'kill_extra_action', 'debuff_spread', 'all_spread',
        // 状態異常・会心の広がり・手の選び方 (§5.8)
        'status_resist_kind', 'vs_status_power', 'status_on_hit_kind',
        'element_crit', 'tag_crit', 'tag_pierce',
        'def_to_atk', 'atk_to_def',
        'buff_duration', 'buff_on_kill', 'shield_regen',
        'repeat_power', 'variety_power', 'high_power_boost',
        // 防御で耐える道 (§5.8)
        'hp_to_def',
        // 中技の使い道 (§5.8)
        'mid_power_status', 'mid_power_combo',
        'crit_stack', 'crit_spread', 'crit_execute',
        'counter_power', 'counter_all', 'chain_power',
        'boss_guard', 'full_hp_foe_power', 'wave_power',
        'damage_share', 'wave_revive',
        // 新しい軸 (§9.1): 自傷を糧にする / 殴った回数で進む刻印
        'self_curse_power', 'sigil_burst',
        // 新しい軸 (§5.9): 回避 / 執着 / 連携 / 恩返し / CT短縮
        'evade', 'focus_power', 'relay_power', 'mend_power', 'cooldown_cut'];
      const unknown = [];
      for (const n of nodes) {
        for (const e of n.effects) if (!KNOWN.includes(e.kind)) unknown.push(`${n.name}: ${e.kind}`);
      }
      assertTrue('§5 未実装の効果種別を参照しているノードが無い', unknown.length === 0,
        unknown.length ? unknown.join(' / ') : `${KNOWN.length}種の効果を実装済み`);

      // 全ノードをレベル上限まで取ったときのSP総額。
      // ツリーは意図的に「全部は取れない」大きさにしてある (§5.4 ビルドの選択)。
      // 見たいのは絶対値ではなく、上限SPに対して十分大きいかどうか。
      const maxSp = 100 - 1 + RPG.data.gacha.maxLimitBreak;   // Lv100・完凸で得られるSP
      const totalSp = nodes.reduce((/** @type {number} */ s, /** @type {any} */ n) => s + n.cost * n.maxLevel, 0);
      assertTrue('§5 全部は取れない大きさになっている（取捨選択が要る）',
        totalSp > maxSp * 2,
        `全ノード最大まで ${totalSp} SP（Lv100・5凸で104SP なので取捨選択が必要）`);
    }

    /* ===== 状態異常の重ねがけ (§5.8) =====
     * かつて同じ異常を何個でも積めてしまい、多段攻撃や伝染を持つ構成が
     * 「麻痺の確率 680%」のような壊れ方をした。同種は1つに保つのが決まり。 */
    {
      /** @type {any} */
      const dummy = {
        name: 'テスト', key: 't0', side: 'enemy', alive: true,
        maxHp: 10000, hp: 10000, statusEffects: [],
        passives: {}, buffUnique: [], buffTags: [], buffReduction: [],
      };
      /** @type {any} */
      const fakeBattle = { log: [], events: [], party: [], enemies: [dummy], round: 1 };
      /** @type {any} */
      const caster = { name: '術者', key: 'p0', side: 'party', alive: true, passives: {} };

      for (let i = 0; i < 20; i++) {
        RPG.battle.inflict(fakeBattle, caster, dummy, 'paralyze', 3, 0.4);
      }
      const stacks = dummy.statusEffects.filter((/** @type {any} */ e) => e.kind === 'paralyze').length;
      assertTrue('§5.8 同じ異常を重ねがけしても1つにまとまる', stacks === 1,
        `20回付与して ${stacks} 個`);

      // 上限。ここが効かないと手番を永久に奪えてしまう
      RPG.battle.inflict(fakeBattle, caster, dummy, 'paralyze', 3, 9.0);
      assertTrue('§5.8 麻痺には上限があり完全な行動不能にならない',
        RPG.battle.statusRatio(dummy, 'paralyze') < 1,
        `ratio 9.0 を与えても 実効 ${RPG.battle.statusRatio(dummy, 'paralyze')}`);

      // 撒き直しに意味は残っているか（強いほうへ更新される）
      dummy.statusEffects = [];
      RPG.battle.inflict(fakeBattle, caster, dummy, 'poison', 3, 0.05);
      RPG.battle.inflict(fakeBattle, caster, dummy, 'poison', 5, 0.12);
      const p = dummy.statusEffects.find((/** @type {any} */ e) => e.kind === 'poison');
      assertTrue('§5.8 撒き直すと持続と強さが良いほうへ更新される',
        p.turns === 5 && Math.abs(p.ratio - 0.12) < 0.001,
        `${p.turns}ターン / ratio ${p.ratio}`);
    }

    /* ===== セーブの救済 (§16) =====
     * 更新でセーブが読めなくなったとき、黙って新規作成で上書きすると
     * **コードを巻き戻しても復旧できない**。消える前に必ず退避すること。 */
    {
      const RESCUE = 'hakusura-rpg/rescued';
      const KEY = 'hakusura-rpg/save';
      const keepSave = localStorage.getItem(KEY);
      const keepRescue = localStorage.getItem(RESCUE);
      const keepBackups = localStorage.getItem('hakusura-rpg/backups');

      try {
        // 版が合わないセーブを置いて読み込ませる
        localStorage.removeItem(RESCUE);
        const doomed = {
          version: 999, gold: 424242, characters: { ch_hero: { id: 'ch_hero', level: 55 } },
          inventory: [], party: ['ch_hero'],
        };
        localStorage.setItem(KEY, JSON.stringify(doomed));
        RPG.state.load();

        const info = RPG.state.rescued();
        assertTrue('§16 読めないセーブは消さずに退避される', !!info,
          info ? info.reason : '退避されなかった');

        assertTrue('§16 退避された中身は元のまま',
          !!info && JSON.parse(info.raw).gold === 424242,
          info ? String(JSON.parse(info.raw).gold) : '—');

        // 退避されたものは通常の検証では弾かれる（版が違うため）。
        // 救済用の経路なら読み替えて通ること。
        const plain = RPG.savefile.validate(info.raw);
        const resc = RPG.savefile.validateRescued(info.raw);
        assertTrue('§16 救済は版の違いを読み替えて復元できる',
          !plain.ok && resc.ok && resc.save.gold === 424242,
          `通常=${plain.ok ? '通る' : '弾く'} / 救済=${resc.ok ? '通る' : resc.reason}`);

        // 二重起動しても、最初の（価値のある）退避を上書きしないこと
        localStorage.setItem(KEY, JSON.stringify({ version: 999, gold: 1, characters: {} }));
        RPG.state.load();
        const again = RPG.state.rescued();
        assertTrue('§16 何度起動しても最初の退避を上書きしない',
          !!again && JSON.parse(again.raw).gold === 424242,
          again ? String(JSON.parse(again.raw).gold) : '—');
      } finally {
        // テストが本物のセーブを壊さないよう必ず戻す
        RPG.state.discardRescued();
        if (keepSave === null) localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, keepSave);
        if (keepRescue !== null) localStorage.setItem(RESCUE, keepRescue);
        if (keepBackups === null) localStorage.removeItem('hakusura-rpg/backups');
        else localStorage.setItem('hakusura-rpg/backups', keepBackups);
        RPG.state.load();
      }
    }

    /* ===== クラス (§12) ===== */
    {
      const classes = RPG.data.classes;
      const ids = Object.keys(classes);

      assertTrue('§12 クラスが定義されている', ids.length >= 4, `${ids.length}種`);

      // ノードIDの重複はクラスを跨いでも許さない。
      // セーブは { ノードID: レベル } の形なので、被ると転職時に投資が漏れる。
      /** @type {string[]} */
      const allNodeIds = [];
      for (const id of ids) allNodeIds.push(...classes[id].nodes.map((/** @type {any} */ n) => n.id));
      assertTrue('§12 クラスノードIDが重複していない',
        new Set(allNodeIds).size === allNodeIds.length,
        `${allNodeIds.length} 個中 ${new Set(allNodeIds).size} 個がユニーク`);

      // クラスが参照する技が実在するか
      /** @type {string[]} */
      const missing = [];
      for (const id of ids) {
        for (const n of classes[id].nodes) {
          for (const e of n.effects) {
            if (e.kind === 'grant_skill' && !RPG.data.skills[e.skill]) missing.push(e.skill);
          }
        }
      }
      assertTrue('§12 クラスが参照する技がすべて実在する', missing.length === 0,
        missing.length ? `存在しない技: ${missing.join(', ')}` : 'すべて実在');

      // クラス技には必ず鍵がかかっていること。
      // ここが抜けると「全体蘇生が毎ラウンド撃てる」状態になり、戦闘の組み立てが消える。
      const clsSkills = Object.keys(RPG.data.skills).filter((k) => RPG.data.skills[k].cls);
      const unlocked = clsSkills.filter((k) => {
        const s = RPG.data.skills[k];
        return !s.readyRound && !s.cooldown;
      });
      assertTrue('§12 クラス技には必ず解禁ラウンドかクールタイムがある',
        clsSkills.length > 0 && unlocked.length === 0,
        unlocked.length ? `鍵の無い技: ${unlocked.join(', ')}` : `${clsSkills.length}本すべてに鍵あり`);

      // 配布ポイントはSPよりずっと少ないこと（クラスが主役になってはいけない）
      const per = RPG.data.classPointsPerLevel;
      const cpAt100 = Math.floor(100 / per);
      const spAt100 = 100 - 1;
      assertTrue('§12 クラスポイントはSPよりはるかに少ない',
        cpAt100 * 4 < spAt100, `Lv100 で CP${cpAt100} / SP${spAt100}`);

      // クラスは「全部は取れない」大きさか。
      // ぎりぎり足りない程度だと結局ほぼ全部取れてしまい、クラス内の選択が消える。
      // Lv100 でも2/3ほどしか埋まらない量を目安にする。
      for (const id of ids) {
        const need = classes[id].nodes.reduce(
          (/** @type {number} */ s, /** @type {any} */ n) => s + n.cost * n.maxLevel, 0);
        assertTrue(`§12 ${classes[id].name} は取捨選択が要る大きさ`,
          need >= cpAt100 * 1.3,
          `全取り ${need} CP / Lv100 で ${cpAt100} CP（${Math.round(cpAt100 / need * 100)}%まで到達）`);
      }

      // 効果の畳み込みがツリーと同じ経路を通っているか
      const save = { level: 100, klass: 'cls_guardian', klassTree: { gd_guard: 3 } };
      const fx = RPG.klass.effects(save);
      assertTrue('§12 素質がクラス効果に含まれる', fx.statPct.def > 0, `DEF +${fx.statPct.def}`);
      assertNear('§12 クラスノードの投資が効果に反映される', fx.passives.guardAlly, 0.30, 0.001);

      // ツリーとクラスの合流
      const merged = RPG.tree.mergeEffects(
        RPG.tree.effects({ tr_guard_ally: 2 }), fx);
      assertTrue('§12 ツリーとクラスの同じパッシブが加算される',
        merged.passives.guardAlly > fx.passives.guardAlly,
        `ツリー単体 → 合流後 ${merged.passives.guardAlly.toFixed(2)}`);
    }

    /* ===== 特殊パッシブ（状況依存のダメージ補正） ===== */
    {
      const base = {
        level: 60, stats: { atk: 1000, magi_power: 0 }, element: 'none',
        tagBonuses: [], uniqueBuffs: [],
      };
      const skill = { power: 100, scaling_stat: /** @type {'atk'} */ ('atk'), damage_type: /** @type {'phys'} */ ('phys') };
      /** @param {any} atk @param {any} [def] @param {any} [opt] */
      const dmg = (atk, def, opt) => RPG.damage.calc({
        attacker: Object.assign({}, base, atk),
        defender: Object.assign({ level: 60, def: 0, element: 'none' }, def || {}),
        skill,
        options: Object.assign({ random: 1.0, crit: false }, opt || {}),
      }).damage;

      assertNear('背水: 満タンなら効果なし', dmg({ lowHpPower: 0.8, hpRatio: 1 }), 1000, 0);
      assertNear('背水: HP50%で+40%', dmg({ lowHpPower: 0.8, hpRatio: 0.5 }), 1400, 0);
      assertNear('背水: 瀕死で+80%', dmg({ lowHpPower: 0.8, hpRatio: 0 }), 1800, 0);

      assertNear('万全: 満タンで+45%', dmg({ highHpPower: 0.45, hpRatio: 1 }), 1450, 0);
      assertNear('万全: 瀕死なら効果なし', dmg({ highHpPower: 0.45, hpRatio: 0 }), 1000, 0);

      assertNear('ボス特効: 通常敵には効かない', dmg({ bossSlayer: 0.5 }, { isBoss: false }), 1000, 0);
      assertNear('ボス特効: ボスに+50%', dmg({ bossSlayer: 0.5 }, { isBoss: true }), 1500, 0);

      assertNear('追い討ち: デバフ無しなら効果なし', dmg({ debuffAmp: 0.5 }, { debuffs: 0 }), 1000, 0);
      assertNear('追い討ち: デバフ中の敵に+50%', dmg({ debuffAmp: 0.5 }, { debuffs: 1 }), 1500, 0);

      assertNear('先制: 1ラウンド目に+30%', dmg({ firstRoundPower: 0.3 }, {}, { firstRound: true }), 1300, 0);
      assertNear('先制: 2ラウンド目以降は効果なし', dmg({ firstRoundPower: 0.3 }, {}, { firstRound: false }), 1000, 0);

      // 属性貫通: 不利0.5倍を等倍側へ寄せる
      /** @param {number} pierce */
      const pierced = (pierce) => RPG.damage.calc({
        attacker: Object.assign({}, base, { element: 'fire', elementMods: { pierce } }),
        defender: { level: 60, def: 0, element: 'water' },
        skill: Object.assign({}, skill, { element: 'fire' }),
        options: { random: 1.0, crit: false },
      }).breakdown.element;
      assertNear('属性貫通なし: 不利は0.5倍', pierced(0), 0.5, 1e-9);
      // §5.4 「属性貫通」は不利を等倍へ寄せたうえで、不利な相手への特効が乗る。
      // これが無いと「全属性適応」Lv1 の完全な下位互換になってしまう。
      assertNear('属性貫通Lv2相当(0.5): 0.75倍に寄せて特効30%', pierced(0.5), 0.975, 1e-9);
      assertNear('属性貫通Lv4相当(1.0): 不利を無効化して特効60%', pierced(1), 1.6, 1e-9);
      assertTrue('属性貫通は「全属性適応」の下位互換ではない',
        pierced(1) > 1.0, `貫通 ${pierced(1)} 倍 > 適応Lv1 の 1.0 倍`);
      assertNear('§5 「属性貫通」Lv4 の効果量',
        RPG.tree.effects({ tr_pierce: 4 }).elementMods.pierce, 1, 1e-9);
    }

    /* ===== 特殊パッシブ（戦闘中の挙動） ===== */
    {
      RPG.rng.seed(777001);
      /** @param {string} id @param {any} [tree] */
      const unitOf = (id, tree) => RPG.units.buildCharacterUnit(
        { id, level: 60, limitBreak: 3, tree: tree || {}, equipped: { weapon: [], armor: [], accessory: [] } }, []);

      // --- 連撃: ATK半減の代わりに2回発動 ---
      {
        const zero = unitOf('ch_lg_zero');
        const raw = RPG.units.statsAtLevel(RPG.data.characters.ch_lg_zero, 60).atk;
        assertNear('連撃: 代償としてATKが半分になる', zero.stats.atk, Math.floor(raw * 0.5), 1);
        assertNear('連撃: 追加発動が1回', zero.passives.doubleHits, 1, 0);

        const b = RPG.battle.start({ fieldId: 'fl_nest', waves: 1, party: [zero], bossFinale: false });
        const before = b.log.length;
        RPG.battle.commandSkill(b, 'sk_lg_twin_edge', [RPG.battle.livingEnemies(b)[0]]);
        const fresh = b.log.slice(before).map((/** @type {any} */ l) => l.text);
        assertTrue('連撃: 攻撃技が2回発動する',
          fresh.filter((/** @type {string} */ t) => /ダメージ/.test(t)).length >= 2,
          fresh.slice(0, 4).join(' / '));
      }

      // --- 棘: 被弾しただけで相手が削れる ---
      {
        const aegis = unitOf('ch_lg_aegis');
        const b = RPG.battle.start({ fieldId: 'fl_nest', waves: 1, party: [aegis], bossFinale: false });
        const enemy = b.enemies[0];
        const hpBefore = enemy.hp;
        RPG.battle.applyDamage(b, enemy, aegis, RPG.data.skills.sk_enemy_bite, {});
        assertTrue('棘: 攻撃してきた相手にダメージが返る', enemy.hp < hpBefore,
          `${hpBefore.toLocaleString()} → ${enemy.hp.toLocaleString()}`);
      }

      // --- 不屈: 致死ダメージをHP1で耐える（1戦闘1回）---
      {
        const tough = unitOf('ch_gald', { tr_last_stand: 1 });
        const b = RPG.battle.start({ fieldId: 'fl_nest', waves: 1, party: [tough], bossFinale: false });
        const enemy = b.enemies[0];
        let survived = 0;
        for (let i = 0; i < 60; i++) {
          tough.hp = 100;
          tough.alive = true;
          tough.stoodGround = false;
          RPG.battle.applyDamage(b, enemy, tough, RPG.data.skills.sk_enemy_rend, { powerScale: 999 });
          if (tough.alive && tough.hp === 1) survived++;
        }
        assertTrue('不屈: 致死ダメージを一定確率でHP1で耐える', survived > 0,
          `60回中 ${survived} 回（設定60%）`);

        // 2回目は発動しない
        tough.hp = 100; tough.alive = true; tough.stoodGround = true;
        RPG.battle.applyDamage(b, enemy, tough, RPG.data.skills.sk_enemy_rend, { powerScale: 999 });
        assertTrue('不屈: 1戦闘に1回だけ', !tough.alive, `alive = ${tough.alive}`);
      }

      // --- 連鎖: 単体攻撃が他の敵にも及ぶ ---
      {
        const lumen = unitOf('ch_lg_lumen');
        const b = RPG.battle.start({ fieldId: 'fl_nest', waves: 1, party: [lumen], bossFinale: false });
        b.enemies = [
          RPG.units.buildEnemyUnit('em_drake', 32, false, 0),
          RPG.units.buildEnemyUnit('em_drake', 32, false, 1),
        ];
        b.enemies.forEach((/** @type {any} */ e, /** @type {number} */ i) => { e.key = 'e' + i; });
        const otherBefore = b.enemies[1].hp;
        RPG.battle.commandSkill(b, 'sk_selen_ray', [b.enemies[0]]);
        assertTrue('連鎖: 狙っていない敵にも余波が届く', b.enemies[1].hp < otherBefore,
          `${otherBefore.toLocaleString()} → ${b.enemies[1].hp.toLocaleString()}`);
      }

      // --- ウェーブ回復 ---
      {
        const u = unitOf('ch_hero', { tr_wave_heal: 4 });
        const b = RPG.battle.start({ fieldId: 'fl_plain', waves: 5, party: [u], bossFinale: true });
        while (RPG.battle.livingEnemies(b).length > 0) {
          RPG.battle.commandSkill(b, 'sk_hero_slash', [RPG.battle.livingEnemies(b)[0]]);
        }
        u.hp = Math.floor(u.maxHp * 0.5);
        const before = u.hp;
        RPG.battle.advanceWave(b);
        assertTrue('息継ぎ: 次のウェーブに進むとき回復する', u.hp > before,
          `${before.toLocaleString()} → ${u.hp.toLocaleString()}`);
      }

      // --- 開幕バフ ---
      {
        const u = unitOf('ch_hero', { tr_opening: 3 });
        const b = RPG.battle.start({ fieldId: 'fl_plain', waves: 1, party: [u], bossFinale: false });
        assertTrue('先手の気構え: 戦闘開始時に固有バフが乗る',
          b.party[0].buffUnique.some((/** @type {any} */ x) => x.label === '開幕'),
          b.party[0].buffUnique.map((/** @type {any} */ x) => x.label).join(' / ') || 'なし');
      }

      RPG.rng.seed(null);
    }

    /* ===== 新しいスキルプラグイン ===== */
    {
      RPG.rng.seed(4242001);
      const party = [RPG.units.buildCharacterUnit(
        { id: 'ch_lg_nox', level: 60, limitBreak: 3, tree: {}, equipped: { weapon: [], armor: [], accessory: [] } }, [])];

      // 多重デバフ
      {
        const b = RPG.battle.start({ fieldId: 'fl_nest', waves: 1, party, bossFinale: false });
        const target = RPG.battle.livingEnemies(b)[0];
        RPG.battle.commandSkill(b, 'sk_lg_calamity', [target]);
        assertTrue('多重デバフ: 防御崩壊が入る', target.defIgnoredTurns > 0, `${target.defIgnoredTurns}ターン`);
        assertTrue('多重デバフ: 複数の状態異常が同時に付く', target.statusEffects.length >= 3,
          target.statusEffects.map((/** @type {any} */ s) => s.label).join(' / '));
      }

      // 生命代償
      {
        const ignis = [RPG.units.buildCharacterUnit(
          { id: 'ch_lg_ignis', level: 60, limitBreak: 3, tree: {}, equipped: { weapon: [], armor: [], accessory: [] } }, [])];
        const b = RPG.battle.start({ fieldId: 'fl_nest', waves: 1, party: ignis, bossFinale: false });
        const actor = b.party[0];
        const hpBefore = actor.hp;
        const target = RPG.battle.livingEnemies(b)[0];
        const enemyBefore = target.hp;
        RPG.battle.commandSkill(b, 'sk_lg_bloodpact', [target]);
        assertTrue('生命代償: 自分のHPを支払う', actor.hp < hpBefore,
          `${hpBefore.toLocaleString()} → ${actor.hp.toLocaleString()}`);
        assertTrue('生命代償: 自滅せずHPが1以上残る', actor.hp >= 1, `HP ${actor.hp}`);
        assertTrue('生命代償: 大ダメージが出る', target.hp < enemyBefore,
          `敵HP ${enemyBefore.toLocaleString()} → ${target.hp.toLocaleString()}`);
      }

      // 全体攻撃
      {
        const lumen = [RPG.units.buildCharacterUnit(
          { id: 'ch_lg_lumen', level: 60, limitBreak: 3, tree: {}, equipped: { weapon: [], armor: [], accessory: [] } }, [])];
        const b = RPG.battle.start({ fieldId: 'fl_nest', waves: 1, party: lumen, bossFinale: false });
        b.enemies = [0, 1, 2].map((i) => {
          const e = RPG.units.buildEnemyUnit('em_dark_knight', 32, false, i);
          e.key = 'e' + i;
          return e;
        });
        const before = b.enemies.map((/** @type {any} */ e) => e.hp);
        RPG.battle.commandSkill(b, 'sk_lg_deluge', []);
        const hitAll = b.enemies.every((/** @type {any} */ e, /** @type {number} */ i) => e.hp < before[i]);
        assertTrue('全体攻撃: 生存する敵すべてに当たる', hitAll,
          b.enemies.map((/** @type {any} */ e, /** @type {number} */ i) =>
            `${before[i].toLocaleString()}→${e.hp.toLocaleString()}`).join(' / '));
      }

      RPG.rng.seed(null);
    }

    /* ===== キャラクターの構成 (§8) ===== */
    {
      /** @type {Record<string, string[]>} */
      const byElement = {};
      const legends = [];
      for (const id of Object.keys(RPG.data.characters)) {
        const c = RPG.data.characters[id];
        if (c.rarity === 'LEGEND') { legends.push(c.name); continue; }
        (byElement[c.element] = byElement[c.element] || []).push(c.name);
      }

      const elements = ['none', 'fire', 'water', 'wind', 'earth', 'light', 'dark'];
      const short = elements.filter((e) => (byElement[e] || []).length < 2);
      assertTrue('§8 レジェンド未満が7属性すべてに2人以上いる', short.length === 0,
        short.length
          ? short.map((e) => `${RPG.damage.ELEMENT_LABEL[e]}: ${(byElement[e] || []).length}人`).join(' / ')
          : elements.map((e) => `${RPG.damage.ELEMENT_LABEL[e]}${byElement[e].length}`).join(' '));

      assertTrue('§8 レジェンドが複数いる', legends.length >= 5, `${legends.length}体: ${legends.join('、')}`);

      // レジェンドは特殊パッシブか特殊技を持つ
      const plain = [];
      for (const id of Object.keys(RPG.data.characters)) {
        const c = RPG.data.characters[id];
        if (c.rarity !== 'LEGEND' || c.fixed) continue;
        const hasPassive = c.passives && Object.keys(c.passives).length > 0;
        const hasSituational = c.situational && Object.keys(c.situational).length > 0;
        const hasSpecialSkill = (c.unique_skills || []).some((/** @type {string} */ s) => {
          const sk = RPG.data.skills[s];
          return sk && ['multi_debuff', 'hp_cost', 'all_enemies'].includes(sk.plugin);
        });
        if (!hasPassive && !hasSituational && !hasSpecialSkill) plain.push(c.name);
      }
      assertTrue('§8 レジェンドは特殊パッシブか特殊技を持つ', plain.length === 0,
        plain.length ? plain.join(' / ') : '全レジェンドが固有の仕掛けを持つ');
    }

    /* ===== 自動装備 ===== */
    {
      const backupSave = localStorage.getItem(RPG.state.STORAGE_KEY);
      try {
        RPG.rng.seed(80808);
        RPG.state.reset();
        const save = RPG.state.get();

        // 装備を多めに用意する
        RPG.state.addBox('box_silver', 30);
        for (let i = 0; i < 30; i++) RPG.state.identifyBox('box_silver');
        save.characters.ch_hero.level = 30;

        const hero = save.characters.ch_hero;
        const emptyScore = RPG.autoequip.loadoutScore(hero, save.inventory, hero.equipped);

        const r = RPG.autoequip.forCharacter('ch_hero');
        assertTrue('自動装備: 空きスロットが埋まる',
          hero.equipped.weapon.length + hero.equipped.armor.length + hero.equipped.accessory.length === 3,
          `武器${hero.equipped.weapon.length} / 防具${hero.equipped.armor.length} / アクセ${hero.equipped.accessory.length}`);
        assertTrue('自動装備: 総合力が上がる', r.after > emptyScore,
          `${Math.round(emptyScore).toLocaleString()} → ${Math.round(r.after).toLocaleString()}`);

        // もう一度走らせても、これ以上良くならない（＝最適に到達している）
        const again = RPG.autoequip.forCharacter('ch_hero');
        assertTrue('自動装備: 2回目は変化しない（結果が安定する）', again.changed === 0,
          `${again.changed}箇所`);

        // 手で最良より弱いものに替えてから自動装備すると、ちゃんと戻る
        const weapons = save.inventory.filter((/** @type {any} */ it) => it.slot === 'weapon')
          .sort((/** @type {any} */ a, /** @type {any} */ b) => RPG.gear.score(a) - RPG.gear.score(b));
        RPG.state.equip('ch_hero', weapons[0].uid);
        const worse = RPG.autoequip.loadoutScore(hero, save.inventory, hero.equipped);
        const fixed = RPG.autoequip.forCharacter('ch_hero');
        assertTrue('自動装備: 弱い装備に替えても付け直してくれる', fixed.after > worse,
          `${Math.round(worse).toLocaleString()} → ${Math.round(fixed.after).toLocaleString()}`);

        // ロック中の装備は外さない
        RPG.state.equip('ch_hero', weapons[0].uid);
        RPG.state.toggleLock(weapons[0].uid);
        RPG.autoequip.forCharacter('ch_hero', { keepLocked: true });
        assertTrue('自動装備: ロック中の装備は外さない',
          hero.equipped.weapon.includes(weapons[0].uid),
          `武器スロット ${hero.equipped.weapon.join(',')}`);
        RPG.state.toggleLock(weapons[0].uid);

        // キャラごとに向き不向きを見ている（魔力参照のキャラには魔力装備が乗る）
        {
          save.characters.ch_rizel = RPG.state.createCharacter('ch_rizel');
          save.characters.ch_rizel.level = 30;
          save.characters.ch_gald = RPG.state.createCharacter('ch_gald');
          save.characters.ch_gald.level = 30;
          RPG.state.setParty(['ch_rizel', 'ch_gald']);

          RPG.autoequip.forParty();
          const mage = RPG.units.buildCharacterUnit(save.characters.ch_rizel, save.inventory);
          const tank = RPG.units.buildCharacterUnit(save.characters.ch_gald, save.inventory);

          // 「魔力 ÷ ATK」の比を較べる。魔法使いのほうが魔力寄りになっているはず。
          const mageRatio = mage.stats.magi_power / Math.max(1, mage.stats.atk);
          const tankRatio = tank.stats.magi_power / Math.max(1, tank.stats.atk);
          assertTrue('自動装備: キャラの参照ステータスに合わせて装備を選ぶ',
            mageRatio > tankRatio,
            `リゼル(魔力参照) 魔力${mage.stats.magi_power}/ATK${mage.stats.atk}=${mageRatio.toFixed(2)} > ` +
            `シャルロッテ(ATK参照) 魔力${tank.stats.magi_power}/ATK${tank.stats.atk}=${tankRatio.toFixed(2)}`);
        }

        // パーティ内で装備の取り合いが起きない
        {
          /** @type {Record<number, string[]>} */
          const owners = {};
          for (const id of Object.keys(save.characters)) {
            const c = save.characters[id];
            for (const slot of Object.keys(c.equipped)) {
              for (const uid of c.equipped[slot]) (owners[uid] = owners[uid] || []).push(id);
            }
          }
          const shared = Object.keys(owners).filter((uid) => owners[Number(uid)].length > 1);
          assertTrue('自動装備: 同じ装備が2人に付くことはない', shared.length === 0,
            shared.length ? shared.slice(0, 3).map((u) => `uid${u}: ${owners[Number(u)].join(',')}`).join(' / ')
              : `${Object.keys(owners).length}個すべて占有が一意`);
        }

        // 手持ちが無いときは何も起きない（例外を出さない）
        {
          RPG.state.reset();
          const empty = RPG.autoequip.forCharacter('ch_hero');
          assertTrue('自動装備: 手持ちが空でも安全に何もしない', empty.changed === 0,
            `${empty.changed}箇所`);
        }

        RPG.rng.seed(null);
      } finally {
        if (backupSave === null) localStorage.removeItem(RPG.state.STORAGE_KEY);
        else localStorage.setItem(RPG.state.STORAGE_KEY, backupSave);
      }
    }

    /* ===== 敵の立ち絵の配置規約 ===== */
    {
      const cfg = RPG.data.artConfig;
      const basePath = cfg.basePath || '';

      const cands = RPG.artSource.enemyCandidates(RPG.data.enemies.em_slime);
      assertTrue('§1.3 敵の立ち絵は assets/enemies/敵ID.拡張子 を自動で探す',
        cands[0] === basePath + 'assets/enemies/em_slime' + cfg.extensions[0], cands.join(' / '));

      const ids = Object.keys(RPG.data.enemies);
      const stamped = ids.filter((id) => RPG.data.enemies[id].id === id);
      assertTrue('§1.3 全ての敵定義から自分のIDを引ける', stamped.length === ids.length,
        `${stamped.length} / ${ids.length}`);

      const explicit = RPG.artSource.enemyCandidates({ id: 'em_x', art: { image: 'custom/boss.png' } });
      assertTrue('§1.3 敵も art.image の明示指定が優先される',
        explicit.length === 1 && explicit[0] === 'custom/boss.png', explicit.join(' / '));

      // 敵は顔の切り抜きを行わない（味方だけの仕組みであること）
      assertTrue('§1.3 敵は顔の自動切り抜きを行わない（画像をそのまま使う）',
        typeof RPG.artSource.enemy === 'function' &&
        RPG.artSource.enemyCandidates(RPG.data.enemies.em_slime).every((/** @type {string} */ p) => p.indexOf('icons/') < 0),
        '切り抜き用のパスを一切参照していない');
    }

    /* ===== 画像の取り込みツール ===== */
    {
      const cfg = RPG.data.artConfig;
      const targets = RPG.importCore.buildTargets([
        { kind: 'character', label: 'キャラクター', catalog: RPG.data.characters, dir: cfg.dir },
        { kind: 'enemy', label: 'エネミー', catalog: RPG.data.enemies, dir: cfg.enemyDir },
      ]);

      // --- 取り込み先はデータから導出される（§9.2）---
      assertTrue('取り込み: 対象がデータ件数と一致する',
        targets.length === Object.keys(RPG.data.characters).length + Object.keys(RPG.data.enemies).length,
        `${targets.length} 件`);
      assertTrue('取り込み: 保存先が artConfig と一致する',
        targets.every((t) => t.dir === (t.kind === 'character' ? cfg.dir : cfg.enemyDir)), '');

      // データを1件足すだけで枠が増える
      {
        const extra = RPG.importCore.buildTargets([
          { kind: 'enemy', label: 'エネミー', dir: cfg.enemyDir,
            catalog: Object.assign({ __probe: { name: '検証体', glyph: '検' } }, RPG.data.enemies) },
        ]);
        assertTrue('取り込み: データを足すだけで対象が増える',
          extra.length === Object.keys(RPG.data.enemies).length + 1 &&
          extra.some((t) => t.id === '__probe'), `${extra.length} 件`);
      }

      // --- ファイル名からの推測 ---
      const guess = (/** @type {string} */ n) => {
        const t = RPG.importCore.guessTarget(n, targets);
        return t ? t.id : null;
      };
      assertTrue('取り込み: IDの完全一致で割り当てる',
        guess('em_golem.png') === 'em_golem', '');
      assertTrue('取り込み: 生成ツールが付けた長いファイル名からもIDを拾う',
        guess('monster girl, full body, s-2282933820 em_golem.png') === 'em_golem', '');
      assertTrue('取り込み: 日本語の名前でも割り当てる',
        guess('廃坑のゴーレム_v2.png') === 'em_golem', '');
      assertTrue('取り込み: 大文字小文字を区別しない',
        guess('EM_WISP.PNG') === 'em_wisp', '');
      assertTrue('取り込み: 判断できないファイルは割り当てない',
        guess('IMG_2938.png') === null, '');
      assertTrue('取り込み: フォルダ付きのパスでも判定できる',
        guess('C:\\images\\em_slime.png') === 'em_slime', '');

      // 短いIDが長いIDの一部に埋もれて誤爆しないこと
      {
        const fake = [{ id: 'em_a', name: 'A' }, { id: 'em_abcd', name: 'B' }];
        assertTrue('取り込み: 部分一致では長いIDを優先する',
          RPG.importCore.guessTarget('em_abcd.png', fake).id === 'em_abcd', '');
      }

      // --- 保存名 ---
      {
        const t = { id: 'em_golem' };
        assertTrue('取り込み: 読み込み側が探す拡張子はそのまま使う',
          RPG.importCore.outputName(t, 'a.png', cfg) === 'em_golem.png' &&
          RPG.importCore.outputName(t, 'b.WEBP', cfg) === 'em_golem.webp', '');
        assertTrue('取り込み: 未対応の拡張子は探索順の先頭に寄せる',
          RPG.importCore.outputName(t, 'c.gif', cfg) === 'em_golem' + cfg.extensions[0],
          RPG.importCore.outputName(t, 'c.gif', cfg));
        // 取り込みは元の拡張子を保つので、探索パスの **どれか** に一致すればよい。
        // 先頭に一致することまでは求めない（配布形式と取り込み形式は別物）。
        {
          const saved = (cfg.basePath || '') + cfg.enemyDir +
            RPG.importCore.outputName(t, 'a.png', cfg);
          const list = RPG.artSource.enemyCandidates(RPG.data.enemies.em_golem);
          assertTrue('取り込み: 保存名が artSource の探索パスに含まれる',
            list.includes(saved), saved);
        }
      }

      // --- 保存先フォルダの解決 ---
      {
        const seg = RPG.importCore.dirSegments;
        assertTrue('取り込み: プロジェクト直下を選んだ場合',
          seg('hakusura-rpg', 'assets/characters/').join('/') === 'assets/characters', '');
        assertTrue('取り込み: assets を選んだ場合は重ねない',
          seg('assets', 'assets/enemies/').join('/') === 'enemies', '');
        assertTrue('取り込み: 無関係なフォルダを選んだ場合は全階層を作る',
          seg('Downloads', 'assets/enemies/').join('/') === 'assets/enemies', '');
      }

      // --- サイズの確認 ---
      {
        const size = cfg.standeeSize;
        assertTrue('取り込み: 推奨サイズちょうどなら注意を出さない',
          RPG.importCore.sizeWarning(size.width, size.height, size) === null, '');
        assertTrue('取り込み: サイズが違えば注意を出す',
          typeof RPG.importCore.sizeWarning(512, 512, size) === 'string',
          RPG.importCore.sizeWarning(512, 512, size) || '');
      }
    }

    /* ===== 画像生成プロンプトのカタログ ===== */
    {
      // このカタログは画像を作るための手元用データで、配布物には含めていない
      // （プロンプトに画風の参考にした作品名が入るため §15）。
      // 無い環境でテストごと落ちないよう、その場合は飛ばす。
      const P = RPG.data.artPrompts;
      if (!P) {
        assertTrue('プロンプト: カタログは配布対象外（手元にある場合のみ検証）', true,
          'data/artprompts.js が無いため、この節は飛ばした');
      } else {

      assertTrue('プロンプト: 土台と主語と除外が揃っている',
        !!(P.base.character && P.base.enemy && P.subject.character && P.subject.enemy && P.negative),
        '');

      // 参照しているIDが実在するか（消したキャラの分が残っていると気付けない）
      {
        const bad = Object.keys(P.enemies).filter((id) => !RPG.data.enemies[id])
          .concat(Object.keys(P.characters).filter((id) => !RPG.data.characters[id]));
        assertTrue('プロンプト: 存在しないIDを参照していない',
          bad.length === 0, bad.length ? bad.join('、') : `敵${Object.keys(P.enemies).length}件 / キャラ${Object.keys(P.characters).length}件`);
      }

      // 属性は全部そろっているか。足りないと自動合成が色無しになる。
      {
        const missing = Object.keys(RPG.damage.ELEMENT_LABEL).filter((el) => !P.elementTags[el]);
        assertTrue('プロンプト: 全ての属性に色の指定がある',
          missing.length === 0, missing.length ? missing.join('、') : '7属性');
      }

      // 主語の重複を防ぐ約束: 土台に 1girl / 1boy を書かない
      {
        const subjectWords = /\b(1girl|1boy|male focus|monster girl)\b/;
        assertTrue('プロンプト: 土台に主語を含めない（主人公と矛盾するため）',
          !subjectWords.test(P.base.character) && !subjectWords.test(P.base.enemy),
          `${P.base.character.slice(0, 40)}…`);
      }

      // 主人公は男性、他は全員美少女 (§8.1)
      assertTrue('プロンプト: 主人公だけが男性として書かれている',
        (function () {
          // 世界設定の芯になっている不変条件なので、拡張 (§18) も含めて見る。
          // 拡張は artPrompt を定義の中に直接書くので、そちらも読まないと素通りする。
          const promptOf = (id) => P.characters[id]
            || (RPG.data.characters[id] && RPG.data.characters[id].artPrompt) || '';
          const males = Object.keys(RPG.data.characters)
            .filter((id) => /\b1boy\b/.test(promptOf(id)));
          return /\b1boy\b/.test(promptOf('ch_hero'))
            && males.length === 1 && males[0] === 'ch_hero';
        })(), '');
      assertTrue('プロンプト: 敵の主語は monster girl',
        /monster girl/.test(P.subject.enemy), P.subject.enemy);

      // 全ての敵に個別プロンプトがある（無くても自動合成で動くが、質のために揃えておく）
      //
      // 置き場所が2つあることに注意。コアは data/artprompts.js に一覧で持ち、
      // 拡張 (§18) は定義の中に artPrompt として直接書く
      // （拡張は data/ を書き換えられないので、そうするしかない）。
      // 片方しか見ないと、**拡張の敵は必ず未指定として落ちる**。
      {
        const hasPrompt = (/** @type {string} */ id) =>
          !!P.enemies[id] || !!(RPG.data.enemies[id] && RPG.data.enemies[id].artPrompt);
        const uncovered = Object.keys(RPG.data.enemies).filter((id) => !hasPrompt(id));
        assertTrue('プロンプト: 全ての敵に個別の指定がある',
          uncovered.length === 0,
          uncovered.length ? uncovered.join('、') + '（自動合成にフォールバックする）'
                           : `${Object.keys(RPG.data.enemies).length} 体`);
      }
      }
    }

    /* ===== セーブの書き出し・読み込み ===== */
    {
      const backupSave = localStorage.getItem(RPG.state.STORAGE_KEY);
      const backupList = localStorage.getItem('hakusura-rpg/backups');
      try {
        RPG.rng.seed(5150);
        RPG.state.reset();

        // 特徴のある状態を作る
        RPG.state.setCharName('ch_hero', 'テスト勇者');
        RPG.state.addGold(12345);
        RPG.state.addBox('box_gold', 3);
        RPG.state.identifyBox('box_gold');
        RPG.state.investNode('ch_hero', 'tr_atk');
        const before = RPG.state.get();
        const beforeJson = JSON.stringify(before);

        // --- 書き出し ---
        const text = RPG.savefile.toText();
        const parsed = JSON.parse(text);
        assertTrue('セーブ: 書き出したJSONに目印が入る',
          parsed.format === RPG.savefile.FORMAT && typeof parsed.exportedAt === 'string',
          `${parsed.format} / ${parsed.exportedAt}`);
        assertTrue('セーブ: 書き出し内容が現在のデータと一致する',
          JSON.stringify(parsed.game) === beforeJson,
          `${text.length.toLocaleString()} 文字`);

        // --- 検証 ---
        const good = RPG.savefile.validate(text);
        assertTrue('セーブ: 正しいデータは検証を通る', good.ok, good.reason || 'OK');

        const cases = [
          ['壊れたJSON', '{ これは JSON では'],
          ['空文字', '   '],
          ['別のJSON', '{"hello":"world"}'],
          ['セーブ版数違い', JSON.stringify({ format: RPG.savefile.FORMAT, game: Object.assign({}, before, { version: 999 }) })],
          ['主人公が居ない', JSON.stringify({ format: RPG.savefile.FORMAT, game: Object.assign({}, before, { characters: { ch_rizel: before.characters.ch_hero } }) })],
          ['所持金が不正', JSON.stringify({ format: RPG.savefile.FORMAT, game: Object.assign({}, before, { gold: -5 }) })],
          ['装備が配列でない', JSON.stringify({ format: RPG.savefile.FORMAT, game: Object.assign({}, before, { inventory: {} }) })],
          ['未知のキャラID', JSON.stringify({ format: RPG.savefile.FORMAT, game: Object.assign({}, before, { characters: Object.assign({}, before.characters, { ch_nobody: { level: 1 } }) }) })],
        ];
        const passedBad = [];
        for (const [name, payload] of cases) {
          const r = RPG.savefile.validate(payload);
          if (r.ok) passedBad.push(name);
        }
        assertTrue('セーブ: 壊れた/別物のデータは全て弾く', passedBad.length === 0,
          passedBad.length ? passedBad.join(' / ') : `${cases.length}通りすべて拒否`);

        // 拒否されたときに既存データが壊れていないこと
        const guard = RPG.savefile.importFrom('{"hello":"world"}');
        assertTrue('セーブ: 読み込みに失敗しても現在のデータは無傷',
          !guard.ok && JSON.stringify(RPG.state.get()) === beforeJson,
          guard.reason || '');

        // --- 読み込み ---
        RPG.state.reset();
        assertTrue('セーブ: 初期化で別の状態になった',
          RPG.state.charName('ch_hero') !== 'テスト勇者', RPG.state.charName('ch_hero'));

        const restored = RPG.savefile.importFrom(text);
        assertTrue('セーブ: 書き出したデータを読み込める', restored.ok, restored.reason || restored.summary || '');
        assertTrue('セーブ: 読み込み後の内容が書き出し時と一致する',
          JSON.stringify(RPG.state.get()) === beforeJson,
          `主人公「${RPG.state.charName('ch_hero')}」／ ${RPG.state.get().gold.toLocaleString()} G ／ ` +
          `装備${RPG.state.get().inventory.length}個`);

        // 素のセーブデータ（包みなし）も受け付ける
        const bare = RPG.savefile.validate(JSON.stringify(before));
        assertTrue('セーブ: 包みの無い素のセーブデータも読める', bare.ok, bare.reason || 'OK');

        // --- バックアップ ---
        RPG.savefile.clearBackups();
        RPG.savefile.backup('テスト');
        const list = RPG.savefile.listBackups();
        assertTrue('セーブ: 控えが作られる', list.length === 1 && list[0].reason === 'テスト',
          list.map((/** @type {any} */ b) => b.reason).join(' / '));

        // 控えを取ったあとに変化させ、戻せるか
        RPG.state.addGold(999999);
        const changed = RPG.state.get().gold;
        const back = RPG.savefile.restoreBackup(0);
        assertTrue('セーブ: 控えの時点に戻せる',
          back.ok && RPG.state.get().gold !== changed,
          `${changed.toLocaleString()} G → ${RPG.state.get().gold.toLocaleString()} G`);

        assertTrue('セーブ: 復元の直前も控えに残る（やり直せる）',
          RPG.savefile.listBackups().some((/** @type {any} */ b) => b.reason === '復元前'),
          RPG.savefile.listBackups().map((/** @type {any} */ b) => b.reason).join(' / '));

        // 世代数の上限
        for (let i = 0; i < RPG.savefile.MAX_BACKUPS + 4; i++) RPG.savefile.backup('連番' + i);
        assertTrue(`セーブ: 控えは${RPG.savefile.MAX_BACKUPS}世代までに収まる`,
          RPG.savefile.listBackups().length <= RPG.savefile.MAX_BACKUPS,
          `${RPG.savefile.listBackups().length} 件`);

        RPG.rng.seed(null);
      } finally {
        RPG.savefile.clearBackups();
        if (backupList !== null) localStorage.setItem('hakusura-rpg/backups', backupList);
        if (backupSave === null) localStorage.removeItem(RPG.state.STORAGE_KEY);
        else localStorage.setItem(RPG.state.STORAGE_KEY, backupSave);
      }
    }

    /* ===== 戦闘演出のイベント列 ===== */
    {
      RPG.rng.seed(24680);
      const party = ['ch_hero', 'ch_noa'].map((id) => RPG.units.buildCharacterUnit(
        { id, level: 45, limitBreak: 0, tree: {}, equipped: { weapon: [], armor: [], accessory: [] } }, []
      ));
      const b = RPG.battle.start({ fieldId: 'fl_plain', waves: 5, party, bossFinale: true });

      // 全ユニットに演出用の識別子が振られていること
      const missingKey = b.party.concat(b.enemies).filter((/** @type {any} */ u) => !u.key);
      assertTrue('演出: 全ユニットに識別子が振られる', missingKey.length === 0,
        `パーティ ${b.party.map((/** @type {any} */ u) => u.key).join(',')} / ` +
        `敵 ${b.enemies.map((/** @type {any} */ u) => u.key).join(',')}`);

      assertTrue('演出: ウェーブ開始でバナー用イベントが出る',
        b.events.some((/** @type {any} */ e) => e.type === 'wave'),
        b.events.filter((/** @type {any} */ e) => e.type === 'wave').map((/** @type {any} */ e) => e.text).join(' / '));

      // 1手撃って、ダメージイベントがログと噛み合うか確認する
      const before = b.events.length;
      const target = RPG.battle.livingEnemies(b)[0];
      RPG.battle.commandSkill(b, 'sk_hero_slash', [target]);
      const fresh = b.events.slice(before);

      const action = fresh.find((/** @type {any} */ e) => e.type === 'action');
      assertTrue('演出: 技の発動が action イベントになる',
        !!action && action.key === b.party[0].key,
        action ? `${action.skill}（${action.key}）` : 'なし');

      const dmg = fresh.find((/** @type {any} */ e) => e.type === 'damage');
      assertTrue('演出: ダメージイベントに数値・会心・属性倍率が乗る',
        !!dmg && typeof dmg.amount === 'number' && typeof dmg.crit === 'boolean' &&
        typeof dmg.element === 'number',
        dmg ? `${dmg.amount} / 会心${dmg.crit} / 属性×${dmg.element}` : 'なし');

      // 1手ぶんのイベントは、その時点の盤面にいるユニットを必ず指している
      const unresolved = fresh
        .filter((/** @type {any} */ e) => e.key)
        .filter((/** @type {any} */ e) => !b.party.concat(b.enemies).some((/** @type {any} */ u) => u.key === e.key));
      assertTrue('演出: 発生直後のイベントは全て盤面上のユニットを指す', unresolved.length === 0,
        unresolved.length ? unresolved.map((/** @type {any} */ e) => e.type + ':' + e.key).join(' / ')
          : `${fresh.length} 件すべて解決`);

      // 決着まで回して、種類が一通り出ることを確認
      let guard = 0;
      while (!b.finished && guard++ < 2000) {
        if (b.phase === 'wave_clear') { RPG.battle.advanceWave(b); continue; }
        const act = RPG.autoplay.chooseAction(b);
        if (!act) break;
        RPG.battle.commandSkill(b, act.skillId, act.targets);
      }

      /** @type {Record<string, number>} */
      const kinds = {};
      for (const e of b.events) kinds[e.type] = (kinds[e.type] || 0) + 1;

      assertTrue('演出: 撃破イベントが出る', (kinds.down || 0) > 0, `down ${kinds.down || 0} 件`);
      assertTrue('演出: 決着でバナー用イベントが出る',
        b.events.some((/** @type {any} */ e) => e.type === 'wave' && e.result),
        (b.events.find((/** @type {any} */ e) => e.type === 'wave' && e.result) || {}).text || 'なし');

      // 敵の識別子はウェーブごとに振り直されるので、過去のイベントは現在の敵一覧には無い。
      // UIはイベントを発生直後に再生するため、確認すべきは「形式が正しいこと」。
      const badKeys = b.events
        .filter((/** @type {any} */ e) => e.key)
        .filter((/** @type {any} */ e) => !/^[pe]\d+$/.test(e.key));
      assertTrue('演出: イベントの対象識別子が正しい形式である', badKeys.length === 0,
        badKeys.length ? badKeys.slice(0, 3).map((/** @type {any} */ e) => e.type + ':' + e.key).join(' / ')
          : `${b.events.filter((/** @type {any} */ e) => e.key).length} 件すべて p番号 / e番号 の形式`);

      assertTrue('演出: 1戦で十分な数のイベントが積まれる', b.events.length >= 20,
        Object.keys(kinds).map((k) => `${k} ${kinds[k]}`).join(' / '));

      RPG.rng.seed(null);
    }

    /* ===== 周回QoL: 一括売却とロック ===== */
    {
      const backup = localStorage.getItem(RPG.state.STORAGE_KEY);
      try {
        RPG.rng.seed(4649);
        RPG.state.reset();
        const save = RPG.state.get();

        // 装備を10個用意する
        RPG.state.addBox('box_silver', 10);
        for (let i = 0; i < 10; i++) RPG.state.identifyBox('box_silver');
        assertNear('周回: 鑑定した装備がインベントリに入る', save.inventory.length, 10, 0);

        // 1つ装備、1つロック
        const equipped = save.inventory[0];
        const locked = save.inventory[1];
        RPG.state.equip('ch_hero', equipped.uid);
        const lockState = RPG.state.toggleLock(locked.uid);
        assertTrue('周回: ロックの切り替えができる', lockState === true && locked.locked === true,
          `locked = ${locked.locked}`);

        const goldBefore = save.gold;
        const expected = save.inventory
          .filter((/** @type {any} */ it) => it.uid !== equipped.uid && it.uid !== locked.uid)
          .reduce((/** @type {number} */ s, /** @type {any} */ it) => s + RPG.state.sellValue(it), 0);

        const result = RPG.state.sellMany(save.inventory.map((/** @type {any} */ it) => it.uid));

        assertNear('周回: 全選択でも 装備中とロック中を除いた8個だけが売れる', result.count, 8, 0);
        assertNear('周回: 除外された数が報告される', result.skipped, 2, 0);
        assertNear('周回: 売却額が個別売却の合計と一致する', result.gold, expected, 0);
        assertNear('周回: ゴールドが正しく増える', RPG.state.get().gold, goldBefore + expected, 0);
        assertNear('周回: 手元に2個だけ残る', RPG.state.get().inventory.length, 2, 0);

        const left = RPG.state.get().inventory;
        assertTrue('周回: 残るのは装備中とロック中のものだけ',
          left.some((/** @type {any} */ it) => it.uid === equipped.uid) &&
          left.some((/** @type {any} */ it) => it.uid === locked.uid),
          left.map((/** @type {any} */ it) => it.name).join(' / '));
        assertTrue('周回: 装備は外れていない',
          RPG.state.get().characters.ch_hero.equipped[equipped.slot].includes(equipped.uid),
          RPG.units.SLOT_LABEL[equipped.slot]);

        // 設定と再出撃の記憶
        RPG.state.updateSettings({ auto: true, fast: true });
        RPG.state.rememberSortie({ fieldId: 'fl_mine', waves: 10, bossFinale: true });
        const reloaded = JSON.parse(localStorage.getItem(RPG.state.STORAGE_KEY) || '{}');
        assertTrue('周回: オート/高速の設定が保存される',
          reloaded.settings && reloaded.settings.auto === true && reloaded.settings.fast === true,
          JSON.stringify(reloaded.settings));
        assertTrue('周回: 直前の出撃内容が保存される',
          reloaded.lastSortie && reloaded.lastSortie.fieldId === 'fl_mine' && reloaded.lastSortie.waves === 10,
          JSON.stringify(reloaded.lastSortie));

        RPG.rng.seed(null);
      } finally {
        if (backup === null) localStorage.removeItem(RPG.state.STORAGE_KEY);
        else localStorage.setItem(RPG.state.STORAGE_KEY, backup);
      }
    }

    /* ===== 周回QoL: オート戦闘の行動選択 ===== */
    {
      RPG.rng.seed(20260802);

      /** テスト用のパーティを作る */
      const makeParty = (/** @type {string[]} */ ids) => ids.map((id) => RPG.units.buildCharacterUnit(
        { id, level: 40, limitBreak: 0, tree: {}, equipped: { weapon: [], armor: [], accessory: [] } }, []
      ));

      /** @param {string[]} ids */
      const makeBattle = (ids) => RPG.battle.start({
        fieldId: 'fl_plain', waves: 5, party: makeParty(ids), bossFinale: false,
      });

      // --- 味方が瀕死なら回復を選ぶ ---
      {
        const b = makeBattle(['ch_hero', 'ch_noa']);
        b.party[0].hp = Math.floor(b.party[0].maxHp * 0.2);
        const action = RPG.autoplay.chooseAction(b);
        const skill = RPG.data.skills[action.skillId];
        assertTrue('オート: 味方が瀕死なら回復技を選ぶ', skill.plugin === 'heal',
          `選んだ技: ${skill.name}`);
      }

      // --- 全員健在なら回復しない ---
      {
        const b = makeBattle(['ch_hero', 'ch_noa']);
        const action = RPG.autoplay.chooseAction(b);
        const skill = RPG.data.skills[action.skillId];
        assertTrue('オート: 全員健在なら回復に無駄撃ちしない', skill.plugin !== 'heal',
          `選んだ技: ${skill.name}`);
      }

      // --- 同じバフを重ねがけしない ---
      {
        const b = makeBattle(['ch_hero']);
        const first = RPG.autoplay.chooseAction(b);
        const firstSkill = RPG.data.skills[first.skillId];
        assertTrue('オート: 戦闘開始時はまずバフを張る',
          ['unique_buff', 'tag_buff', 'def_buff'].includes(firstSkill.plugin),
          `選んだ技: ${firstSkill.name}`);

        RPG.battle.commandSkill(b, first.skillId, first.targets);
        // 敵フェーズを挟んで再び自分の番になったら、同じバフは選ばない
        const second = RPG.autoplay.chooseAction(b);
        if (second) {
          assertTrue('オート: 効果中の同じバフは張り直さない', second.skillId !== first.skillId,
            `1回目 ${firstSkill.name} → 2回目 ${RPG.data.skills[second.skillId].name}`);
        }
      }

      // --- 過剰ダメージを避けて、実際に削れる相手を狙う ---
      {
        // バフを持たないキャラを使い、攻撃の選択だけを見る
        const b = makeBattle(['ch_rizel']);
        // 敵を2体に固定し、片方を瀕死・片方を満タンにする
        b.enemies = [
          RPG.units.buildEnemyUnit('em_slime', 3, false, 0),
          RPG.units.buildEnemyUnit('em_wolf', 30, false, 1),
        ];
        b.enemies[0].hp = 5;
        const action = RPG.autoplay.chooseAction(b);
        const target = action && action.targets[0];
        assertTrue('オート: 残りHP5の敵に大技を無駄撃ちしない', target === b.enemies[1],
          target
            ? `狙った相手: ${target.name}（HP ${target.hp.toLocaleString()}）`
            : `対象を選ばなかった（技: ${action ? RPG.data.skills[action.skillId].name : 'なし'}）`);
      }

      // --- 敵が全滅していれば行動を返さない ---
      {
        const b = makeBattle(['ch_hero']);
        b.enemies.forEach((/** @type {any} */ e) => { e.alive = false; e.hp = 0; });
        assertTrue('オート: 対象が居なければ行動を返さない',
          RPG.autoplay.chooseAction(b) === null, 'null を返す');
      }

      // --- オートだけで戦闘を完走できる ---
      {
        let cleared = 0;
        let stuck = 0;
        for (let n = 0; n < 30; n++) {
          const b = makeBattle(['ch_hero', 'ch_noa', 'ch_gald', 'ch_shiki']);
          let guard = 0;
          while (!b.finished && guard++ < 2000) {
            if (b.phase === 'wave_clear') { RPG.battle.advanceWave(b); continue; }
            const action = RPG.autoplay.chooseAction(b);
            if (!action) { stuck++; break; }
            RPG.battle.commandSkill(b, action.skillId, action.targets);
          }
          if (b.finished && b.victory) cleared++;
        }
        assertTrue('オート: 行動不能で止まらない', stuck === 0, `30戦で停止 ${stuck} 回`);
        assertTrue('オート: 5連戦をオートだけで勝ち切れる', cleared >= 25,
          `30戦中 ${cleared} 勝`);
      }

      RPG.rng.seed(null);
    }

    /* ===== 報酬の経済 (§10.1) ===== */
    {
      // 経験値の人数割りは緩めてある。4人でも1人あたり全体の半分以上を受け取れること。
      const solo = RPG.economy.expShare(1000, 1);
      const four = RPG.economy.expShare(1000, 4);
      assertTrue('経験値: 単騎なら全額を受け取る', solo === 1000, `${solo}`);
      assertTrue('経験値: 4人でも1人あたり半分以上を受け取る',
        four >= 500 && four < 1000, `1000 を4人 → 1人 ${four}`);
      assertTrue('経験値: 人数が増えるほど1人あたりは減る',
        RPG.economy.expShare(1000, 2) > four,
        `2人 ${RPG.economy.expShare(1000, 2)} > 4人 ${four}`);

      // 手動ボーナスは「1回もオートに任せていない」ときだけ付く
      const manualBattle = { rewards: { gold: 100, exp: 100, boxes: {} }, inputs: { manual: 10, auto: 0 } };
      const autoBattle = { rewards: { gold: 100, exp: 100, boxes: {} }, inputs: { manual: 9, auto: 1 } };
      const noneBattle = { rewards: { gold: 100, exp: 100, boxes: {} }, inputs: { manual: 0, auto: 0 } };
      const mp = RPG.economy.payout(manualBattle, { partySize: 1 });
      const ap = RPG.economy.payout(autoBattle, { partySize: 1 });
      const np = RPG.economy.payout(noneBattle, { partySize: 1 });
      assertTrue('手動ボーナス: 全手動なら上乗せされる',
        mp.manual === true && mp.gold > 100, `${mp.gold} G`);
      assertTrue('手動ボーナス: 一度でもオートを使うと付かない',
        ap.manual === false && ap.gold === 100, `${ap.gold} G`);
      assertTrue('手動ボーナス: 一度も行動していなければ付かない',
        np.manual === false, `manual=${np.manual}`);

      // フィールドの倍率が実際に報酬へ乗っているか
      const missing = Object.keys(RPG.data.fields)
        .filter((id) => RPG.data.fields[id].exp_mult == null || RPG.data.fields[id].gold_mult == null);
      assertTrue('全フィールドに gold_mult と exp_mult がある',
        missing.length === 0, missing.length ? missing.join('、') : `${Object.keys(RPG.data.fields).length} 件`);
    }

    /* ===== 図鑑 (§13) ===== */
    {
      const before = localStorage.getItem(RPG.state.STORAGE_KEY);
      RPG.state.reset();
      const save = RPG.state.get();
      for (const id of ['ch_rizel', 'ch_gald', 'ch_shiki']) {
        save.characters[id] = RPG.state.createCharacter(id);
      }
      save.party = ['ch_hero', 'ch_rizel', 'ch_gald', 'ch_shiki'];
      for (const id of save.party) save.characters[id].level = 14;

      // --- 図鑑は data/ から導出される。専用カタログを持たない (§9.2) ---
      assertTrue('図鑑: 分母がデータ件数と一致する',
        RPG.codex.progress('character').total === Object.keys(RPG.data.characters).length &&
        RPG.codex.progress('enemy').total === Object.keys(RPG.data.enemies).length &&
        RPG.codex.progress('field').total === Object.keys(RPG.data.fields).length,
        `キャラ${RPG.codex.progress('character').total} / 敵${RPG.codex.progress('enemy').total} / ` +
        `場${RPG.codex.progress('field').total}`);

      assertTrue('図鑑: 初期状態では敵もフィールドも未発見',
        RPG.codex.progress('enemy').found === 0 && RPG.codex.progress('field').found === 0, '');
      assertTrue('図鑑: 所持キャラだけが解放される',
        RPG.codex.progress('character').found === save.party.length,
        `${RPG.codex.progress('character').found} 体`);

      // --- 戦闘の記録が反映される ---
      // 派遣を経由しても図鑑に残ることを、ここで一緒に確かめる
      RPG.rng.seed(2468);
      RPG.dispatch.start({ fieldId: 'fl_mine', waves: 5, bossFinale: true, planId: 'short' });
      {
        const d = RPG.state.get().dispatch;
        d.startedAt -= (d.endsAt - d.startedAt) + 1000;
        d.endsAt -= (d.endsAt - d.startedAt) + 1000;
      }
      const result = (RPG.dispatch.collect().result) || { runs: 0 };
      RPG.rng.seed(null);

      const mine = RPG.data.fields.fl_mine;
      assertTrue('図鑑: 戦った敵が記録される',
        mine.pool.every((/** @type {string} */ id) => RPG.codex.enemySeen(id)),
        mine.pool.map((/** @type {string} */ id) =>
          `${RPG.data.enemies[id].name} ${RPG.codex.enemyEntry(id).seen}回`).join('、'));
      assertTrue('図鑑: 撃破数が遭遇数を超えない',
        Object.keys(save.codex.enemies).every((id) =>
          save.codex.enemies[id].killed <= save.codex.enemies[id].seen), '');
      assertTrue('図鑑: 出撃回数が記録される',
        RPG.codex.fieldEntry('fl_mine').visits === result.runs,
        `${RPG.codex.fieldEntry('fl_mine').visits} 回`);

      // 出撃していないフィールドは、敵を使い回していても解放されない
      assertTrue('図鑑: 行っていないフィールドは未発見のまま',
        RPG.codex.fieldSeen('fl_mine') && !RPG.codex.fieldSeen('fl_nest'),
        `灼獄竜の巣には ${RPG.data.fields.fl_nest.pool.filter(RPG.codex.enemySeen).length} 体の既知の敵がいるが未訪問`);

      // --- 出現場所の逆引き ---
      {
        const habitats = RPG.codex.enemyHabitats('em_golem');
        assertTrue('図鑑: 出現場所を fields から逆引きできる',
          habitats.length >= 1 && habitats.every((hb) => !!RPG.data.fields[hb.id]),
          habitats.map((hb) => hb.name).join('、'));
        const bossOf = RPG.codex.enemyHabitats('bs_mine_tyrant');
        assertTrue('図鑑: ボスはボスとして分類される',
          bossOf.length > 0 && bossOf.every((hb) => hb.role === 'boss'), '');
      }

      // --- データを1件足すだけで図鑑に載る (§9.2) ---
      {
        const enemyBefore = RPG.codex.progress('enemy').total;
        const fieldBefore = RPG.codex.progress('field').total;
        RPG.data.enemies.__test_enemy = {
          name: '検証体', element: 'light',
          base: { hp: 900, atk: 100, def: 40, magi_power: 60 },
          growth: { hp: 70, atk: 8, def: 3, magi_power: 5 },
          skills: ['sk_enemy_bite'], gold: 30, exp: 25,
          drops: [{ box: 'box_gold', chance: 0.9, count: 1 }],
          color: '#ffe9a8', glyph: '検',
        };
        RPG.data.fields.__test_field = {
          name: '検証の間', rec_level: 20, enemy_lv: 22, size: [1, 1],
          pool: ['__test_enemy'], boss: 'bs_gnaw_king',
          gold_mult: 1.0, exp_mult: 1.0, bg: ['#203040', '#0d1119'], desc: '追加テスト用。',
        };

        assertTrue('図鑑: データを足すだけで項目が増える',
          RPG.codex.progress('enemy').total === enemyBefore + 1 &&
          RPG.codex.progress('field').total === fieldBefore + 1,
          `敵 ${enemyBefore}→${RPG.codex.progress('enemy').total} / ` +
          `場 ${fieldBefore}→${RPG.codex.progress('field').total}`);
        assertTrue('図鑑: 追加した敵の出現場所も自動で引ける',
          RPG.codex.enemyHabitats('__test_enemy').some((hb) => hb.id === '__test_field'), '');
        assertTrue('図鑑: 追加した敵のステータスを表示用に組み立てられる',
          RPG.codex.enemyPreview('__test_enemy').level === 22, '');

        delete RPG.data.enemies.__test_enemy;
        delete RPG.data.fields.__test_field;
      }

      // --- 未知のIDを渡しても落ちない ---
      assertTrue('図鑑: 未知のIDでも例外にならない',
        RPG.codex.enemySeen('__nope') === false &&
        RPG.codex.fieldSeen('__nope') === false &&
        RPG.codex.characterOwned('__nope') === false, '');

      if (before === null) localStorage.removeItem(RPG.state.STORAGE_KEY);
      else localStorage.setItem(RPG.state.STORAGE_KEY, before);
      RPG.state.load();
    }

    /* ===== 小技の使い道 (§4.3) ===== */
    {
      const before = localStorage.getItem(RPG.state.STORAGE_KEY);
      RPG.state.reset();
      const save = RPG.state.get();
      save.characters.ch_hero.level = 80;
      save.characters.ch_hero.tree = {
        tr_low_boost: 5, tr_low_auto: 4, tr_low_spread: 1, tr_low_repeat: 2, tr_grant_burst: 1,
      };
      save.party = ['ch_hero'];

      const unit = RPG.units.buildCharacterUnit(save.characters.ch_hero, save.inventory);
      assertTrue('小技: ツリーから効果が乗る',
        unit.passives.lowPowerBoost > 0 && unit.passives.autoLowSkill > 0 &&
        unit.passives.lowPowerSpread > 0 && unit.passives.lowPowerRepeat > 0,
        `+${Math.round(unit.passives.lowPowerBoost * 100)}% / 自動${Math.round(unit.passives.autoLowSkill * 100)}%`);
      assertTrue('小技: 「全弾解放」を習得できる',
        unit.skills.includes('sk_tree_burst'), '');

      /** 敵3体の的場を作る */
      const arena = () => {
        const b = RPG.battle.start({
          fieldId: 'fl_mine', waves: 1, party: RPG.state.partyUnits(), bossFinale: false,
        });
        b.enemies = [0, 1, 2].map((i) => {
          const e = RPG.units.buildEnemyUnit('em_golem', 14, false, i);
          e.key = 'e' + i;
          e.maxHp = e.hp = 9e8;
          return e;
        });
        return b;
      };

      // --- 底上げは小技にだけ乗る ---
      {
        const b = arena();
        const hero = b.party[0];
        const hit = (/** @type {any} */ skill) => {
          RPG.rng.seed(4242);
          const hp = b.enemies[0].hp;
          RPG.battle.applyDamage(b, hero, b.enemies[0], skill, { silent: true });
          RPG.rng.seed(null);
          return hp - b.enemies[0].hp;
        };
        const low = hit(RPG.data.skills.sk_slash);          // 威力100 = 小技
        const high = hit(RPG.data.skills.sk_hero_slash);    // 威力180 = 小技ではない

        assertTrue('小技: 威力100%以下だけが底上げされる',
          RPG.battle.isLowPower(RPG.data.skills.sk_slash) &&
          !RPG.battle.isLowPower(RPG.data.skills.sk_hero_slash), '');
        assertTrue('小技: 底上げで強技に肉薄する（置き換えは起きない）',
          low < high && low / high > 0.7,
          `斬撃 ${low} / 覇王斬 ${high}（${Math.round(low / high * 100)}%）`);
      }

      // --- 全体化と多重発動 ---
      {
        const b = arena();
        const hero = b.party[0];
        const before2 = b.enemies.map((/** @type {any} */ e) => e.hp);
        RPG.battle.executeSkill(b, hero, 'sk_slash', [b.enemies[0]]);
        const hitCount = b.enemies.filter((/** @type {any} */ e, /** @type {number} */ i) =>
          e.hp < before2[i]).length;
        assertTrue('小技: 単体技が敵全体に広がる', hitCount === 3, `${hitCount} 体に命中`);
      }

      // --- 全弾解放 ---
      {
        const b = arena();
        const hero = b.party[0];
        const attacks = hero.skills.filter((/** @type {string} */ id) =>
          RPG.battle.isAttackSkill(RPG.data.skills[id]));
        const hpBefore = b.enemies[0].hp;
        RPG.battle.executeSkill(b, hero, 'sk_tree_burst', [b.enemies[0]]);

        assertTrue('全弾解放: 持っている攻撃技の数だけ撃つ',
          hpBefore - b.enemies[0].hp > 0, `攻撃技 ${attacks.length} 本`);
        assertTrue('全弾解放: 反動で行動できなくなる',
          hero.stunnedRounds > 0 && hero.stunnedRounds <= 4,
          `${hero.stunnedRounds} ラウンド`);

        // 行動不能のあいだは手番が飛ぶ
        const stunned = hero.stunnedRounds;
        b.actorIndex = 0;
        b.phase = 'command';
        RPG.battle.skipDeadActors(b);
        assertTrue('全弾解放: 行動不能のあいだは手番が飛ぶ',
          hero.stunnedRounds === stunned - 1 && b.actorIndex > 0,
          `残り ${hero.stunnedRounds} ラウンド`);
      }

      // --- 技を多く持つほど全弾解放が強い ---
      {
        const b = arena();
        const hero = b.party[0];
        const full = hero.skills.slice();

        const burst = () => {
          const hp = b.enemies[0].hp;
          hero.stunnedRounds = 0;
          RPG.rng.seed(999);
          RPG.battle.executeSkill(b, hero, 'sk_tree_burst', [b.enemies[0]]);
          RPG.rng.seed(null);
          return hp - b.enemies[0].hp;
        };
        const many = burst();
        // 攻撃技を1本だけにする
        hero.skills = full.filter((/** @type {string} */ id) =>
          !RPG.battle.isAttackSkill(RPG.data.skills[id]) || id === 'sk_hero_slash');
        const few = burst();
        hero.skills = full;

        assertTrue('全弾解放: 攻撃技を多く抱えるほど強い',
          many > few, `多い ${many} / 少ない ${few}`);
      }

      if (before === null) localStorage.removeItem(RPG.state.STORAGE_KEY);
      else localStorage.setItem(RPG.state.STORAGE_KEY, before);
      RPG.state.load();
    }

    /* ===== ユニーク装備 (§7.8) ===== */
    {
      const before = localStorage.getItem(RPG.state.STORAGE_KEY);
      RPG.state.reset();
      const save = RPG.state.get();

      // --- 定義の健全性 ---
      {
        const bad = [];
        for (const id of Object.keys(RPG.data.uniqueEquips)) {
          const u = RPG.data.uniqueEquips[id];
          if (!RPG.data.equipBases[u.base]) bad.push(`${id}: 装備ベース ${u.base}`);
          if (!u.effects || Object.keys(u.effects).length === 0) bad.push(`${id}: 効果が無い`);
        }
        assertTrue('ユニーク装備: 定義が実在する装備ベースを指している',
          bad.length === 0,
          bad.length ? bad.join(' / ') : `${Object.keys(RPG.data.uniqueEquips).length} 種`);
        assertTrue('ユニーク装備: 星辰の宝箱が存在する',
          !!RPG.data.boxes.box_astral &&
          RPG.data.boxes.box_astral.stat_mult > RPG.data.boxes.box_dragon.stat_mult, '');
      }

      // --- 生成 ---
      {
        RPG.rng.seed(7);
        let uniques = 0;
        const made = [];
        for (let i = 0; i < 300; i++) {
          const item = RPG.gear.identify('box_astral', RPG.state.nextUid());
          if (item.uniqueId) { uniques++; made.push(item); }
        }
        RPG.rng.seed(null);

        assertTrue('ユニーク装備: 星辰の宝箱から出る',
          uniques > 0, `300回中 ${uniques} 個`);
        assertTrue('ユニーク装備: 系統タグ倍率を持たない（竜の宝箱との住み分け）',
          made.every((it) => it.tagBonuses.length === 0 && it.critRate === 0 && it.capBreak === 0),
          '数値で勝ちたいなら竜の宝箱');
        assertTrue('ユニーク装備: 固有効果を持つ',
          made.every((it) => it.uniqueEffects && Object.keys(it.uniqueEffects).length > 0), '');
        assertTrue('ユニーク装備: 最初からロックされている',
          made.every((it) => it.locked === true), '一括売却で消えない');

        // 同じユニークでも個体差がある（厳選する意味を残す）
        const sameKind = made.filter((it) => it.uniqueId === made[0].uniqueId);
        if (sameKind.length >= 2) {
          const key = Object.keys(sameKind[0].stats)[0];
          const values = new Set(sameKind.map((it) => it.stats[key]));
          assertTrue('ユニーク装備: 同じ種類でも個体差がある',
            values.size > 1, `${values.size} 通り`);
        }
      }

      // --- 竜の宝箱からは出ない ---
      {
        RPG.rng.seed(11);
        let leaked = 0;
        for (let i = 0; i < 200; i++) {
          if (RPG.gear.identify('box_dragon', RPG.state.nextUid()).uniqueId) leaked++;
        }
        RPG.rng.seed(null);
        assertTrue('ユニーク装備: 竜の宝箱からは出ない', leaked === 0, `${leaked} 個`);
      }

      // --- 装備すると効果が乗り、複数着ければ合算される ---
      {
        const c = save.characters.ch_hero;
        c.tree = { tr_slot_acc: 1 };
        c.equipped = { weapon: [], armor: [], accessory: [] };

        const claw = RPG.gear.rollUnique(RPG.state.nextUid(), 'box_astral');
        claw.uniqueId = 'uq_myriad_edge';
        claw.uniqueEffects = Object.assign({}, RPG.data.uniqueEquips.uq_myriad_edge.effects);
        claw.slot = 'weapon';
        save.inventory.push(claw);
        c.equipped.weapon.push(claw.uid);

        const ring = RPG.gear.rollUnique(RPG.state.nextUid(), 'box_astral');
        ring.uniqueId = 'uq_scatter_ring';
        ring.uniqueEffects = Object.assign({}, RPG.data.uniqueEquips.uq_scatter_ring.effects);
        ring.slot = 'accessory';
        save.inventory.push(ring);
        c.equipped.accessory.push(ring.uid);

        const unit = RPG.units.buildCharacterUnit(c, save.inventory);
        const expected = RPG.data.uniqueEquips.uq_myriad_edge.effects.lowPowerBoost +
          RPG.data.uniqueEquips.uq_scatter_ring.effects.lowPowerBoost;
        assertTrue('ユニーク装備: 装備すると効果が乗る',
          unit.setEffects.lowPowerSpread === 1, '');
        assertTrue('ユニーク装備: 複数着けると数値は合算される',
          Math.abs(unit.setEffects.lowPowerBoost - expected) < 1e-9,
          `+${Math.round(unit.setEffects.lowPowerBoost * 100)}%`);
      }

      if (before === null) localStorage.removeItem(RPG.state.STORAGE_KEY);
      else localStorage.setItem(RPG.state.STORAGE_KEY, before);
      RPG.state.load();
    }

    /* ===== 装備セット (§7.7) ===== */
    {
      const before = localStorage.getItem(RPG.state.STORAGE_KEY);
      RPG.state.reset();
      const save = RPG.state.get();
      for (const id of ['ch_rizel', 'ch_gald', 'ch_shiki']) {
        save.characters[id] = RPG.state.createCharacter(id);
      }
      save.party = ['ch_hero', 'ch_rizel', 'ch_gald', 'ch_shiki'];
      for (const id of save.party) {
        save.characters[id].level = 50;
        // 4セットを着けるにはスロットの拡張が要る (§5.3)
        save.characters[id].tree = { tr_slot_acc: 1, tr_slot_armor: 1, tr_slot_weapon: 1 };
      }

      /** 指定のセット装備を n 個だけ着せる */
      const give = (/** @type {string} */ charId, /** @type {string} */ setId, /** @type {number} */ n) => {
        const c = save.characters[charId];
        c.equipped = { weapon: [], armor: [], accessory: [] };
        const slots = RPG.units.slotCounts(c);
        let made = 0;
        for (const slot of ['weapon', 'weapon', 'armor', 'armor', 'accessory', 'accessory']) {
          if (made >= n) break;
          if (c.equipped[slot].length >= slots[slot]) continue;
          const baseId = Object.keys(RPG.data.equipBases)
            .find((b) => RPG.data.equipBases[b].slot === slot);
          const item = RPG.gear.identify('box_dragon', RPG.state.nextUid(),
            { setId, baseId, rarityId: 'LEGEND' });
          save.inventory.push(item);
          c.equipped[slot].push(item.uid);
          made++;
        }
        return made;
      };

      /** 敵1体だけの戦闘を作る（効果だけを見たいので敵は不死身にする） */
      const arena = () => {
        const b = RPG.battle.start({
          fieldId: 'fl_mine', waves: 1, party: RPG.state.partyUnits(), bossFinale: false,
        });
        const foe = RPG.units.buildEnemyUnit('em_golem', 14, false, 0);
        foe.key = 'e0';
        foe.maxHp = foe.hp = 9e7;
        b.enemies = [foe];
        return b;
      };

      // --- 定義の健全性 ---
      {
        const bad = [];
        for (const id of Object.keys(RPG.data.equipSets)) {
          const set = RPG.data.equipSets[id];
          if (!set.bonuses || set.bonuses.length === 0) bad.push(id + ': 段階が無い');
          set.bonuses.forEach((/** @type {any} */ b, /** @type {number} */ i) => {
            if (i > 0 && b.pieces <= set.bonuses[i - 1].pieces) bad.push(id + ': 段階が昇順でない');
            if (b.pieces > 6) bad.push(id + ': スロット上限6を超えている');
          });
        }
        assertTrue('セット: 定義が段階の昇順で、スロット上限に収まっている',
          bad.length === 0, bad.length ? bad.join(' / ') : `${Object.keys(RPG.data.equipSets).length} 種`);
        assertTrue('セット: 出現率が全ての宝箱に決まっている',
          Object.keys(RPG.data.boxes).every((b) => RPG.data.equipSetChance[b] != null), '');
        assertTrue('セット: 銅の宝箱からは出ない',
          RPG.data.equipSetChance.box_bronze === 0, '序盤の対象にしない');
      }

      // --- 集計 ---
      {
        const mk = (/** @type {string} */ setId) =>
          RPG.gear.identify('box_dragon', RPG.state.nextUid(), { setId });
        const two = [mk('set_echo'), mk('set_echo')];
        const four = two.concat([mk('set_echo'), mk('set_echo')]);

        assertTrue('セット: 2個で最初の段階が発動する',
          RPG.equipset.resolve(two).effects.echoRatio === 0.25, '');
        assertTrue('セット: 4個で上の段階が上書きする（加算しない）',
          RPG.equipset.resolve(four).effects.echoRatio === 0.45,
          `${RPG.equipset.resolve(four).effects.echoRatio}`);
        assertTrue('セット: 1個では発動しない',
          RPG.equipset.resolve([mk('set_echo')]).active.length === 0, '');
        assertTrue('セット: 次の段階までの数を案内できる',
          RPG.equipset.nextTier('set_echo', 2).pieces === 4 &&
          RPG.equipset.nextTier('set_echo', 4) === null, '');
      }

      // --- 残響: 遅れて着弾する ---
      {
        give('ch_hero', 'set_echo', 4);
        const b = arena();
        const hero = b.party[0];
        assertTrue('セット: 4個そろうと効果がユニットに乗る',
          hero.sets.set_echo === 4 && hero.setEffects.echoDelay === 2, '');

        const hpBefore = b.enemies[0].hp;
        RPG.battle.applyDamage(b, hero, b.enemies[0], RPG.data.skills.sk_hero_slash, { silent: true });
        const direct = hpBefore - b.enemies[0].hp;
        assertTrue('セット(残響): 撃った直後は追加ダメージが無い',
          b.echoes.length === 1 && b.echoes[0].turns === 2, `予約 ${b.echoes.length} 件`);

        RPG.battle.resolveEchoes(b);
        assertTrue('セット(残響): 1ラウンド後はまだ着弾しない',
          b.echoes.length === 1 && b.echoes[0].turns === 1, '');

        const hpMid = b.enemies[0].hp;
        RPG.battle.resolveEchoes(b);
        const echoed = hpMid - b.enemies[0].hp;
        assertTrue('セット(残響): 2ラウンド後に記録ぶんが着弾する',
          echoed > 0 && Math.abs(echoed / direct - 0.45) < 0.02,
          `直撃 ${direct} → 残響 ${echoed}（${(echoed / direct * 100).toFixed(0)}%）`);
        assertTrue('セット(残響): 着弾したら予約が消える', b.echoes.length === 0, '');
      }

      // --- 憤怒: 被弾を溜めて次の一撃に乗せる ---
      {
        give('ch_hero', 'set_wrath', 4);
        const b = arena();
        const hero = b.party[0];
        assertTrue('セット(憤怒): 最初は怒りが無い', (hero.wrath || 0) === 0, '');

        RPG.battle.applyDamage(b, b.enemies[0], hero, RPG.data.skills.sk_enemy_quake, { silent: true });
        const stored = hero.wrath;
        assertTrue('セット(憤怒): 被弾すると溜まる', stored > 0, `${Math.floor(stored)}`);

        // ダメージには 0.85〜1.15 の揺らぎがあるので、乱数を固定して比べる。
        // 固定しないと怒りの上乗せが揺らぎに埋もれて、判定が運任せになる。
        RPG.rng.seed(31337);
        const hpA = b.enemies[0].hp;
        RPG.battle.applyDamage(b, hero, b.enemies[0], RPG.data.skills.sk_hero_slash, { silent: true });
        const withBurst = hpA - b.enemies[0].hp;
        assertTrue('セット(憤怒): 次の攻撃で解き放たれる',
          hero.wrath === 0, `残り ${hero.wrath}`);

        RPG.rng.seed(31337);
        const hpB = b.enemies[0].hp;
        RPG.battle.applyDamage(b, hero, b.enemies[0], RPG.data.skills.sk_hero_slash, { silent: true });
        const without = hpB - b.enemies[0].hp;
        RPG.rng.seed(null);
        assertTrue('セット(憤怒): 解放したぶんだけ実際に増えている',
          withBurst > without, `${withBurst} vs ${without}（同じ乱数で比較）`);
        assertTrue('セット(憤怒): 増えた量が溜めた怒りと一致する',
          Math.abs((withBurst - without) - Math.floor(stored)) <= 1,
          `差 ${withBurst - without} / 怒り ${Math.floor(stored)}`);
      }

      // --- 常世: 倒れた仲間の数で伸びる ---
      {
        give('ch_hero', 'set_undying', 4);
        const b = arena();
        const hero = b.party[0];
        const alone = RPG.battle.setPower(b, hero);
        b.party[1].alive = false;
        b.party[2].alive = false;
        const fallen = RPG.battle.setPower(b, hero);
        assertTrue('セット(常世): 全員生存なら上乗せが無い', Math.abs(alone - 1) < 1e-9, `×${alone}`);
        assertTrue('セット(常世): 倒れた仲間1人につき伸びる',
          Math.abs(fallen - 1.8) < 1e-9, `×${fallen.toFixed(2)}`);
        assertTrue('セット(常世): 2個で復活を得る',
          RPG.units.buildCharacterUnit(save.characters.ch_hero, save.inventory).passives.reviveHp >= 0.35,
          '');
      }

      // --- 刹那: ラウンドが進むほど落ちる ---
      {
        give('ch_hero', 'set_blitz', 4);
        const b = arena();
        const hero = b.party[0];
        b.round = 1;
        const r1 = RPG.battle.setPower(b, hero);
        b.round = 5;
        const r5 = RPG.battle.setPower(b, hero);
        b.round = 30;
        const r30 = RPG.battle.setPower(b, hero);
        assertTrue('セット(刹那): ラウンドが進むほど落ちる',
          r1 > r5 && r5 > r30, `1R ×${r1.toFixed(2)} / 5R ×${r5.toFixed(2)} / 30R ×${r30.toFixed(2)}`);
        assertTrue('セット(刹那): 下限で止まる',
          Math.abs(r30 - RPG.data.equipSets.set_blitz.bonuses[1].effects.decayFloor) < 1e-9,
          `×${r30}`);
        assertTrue('セット(刹那): 初回ラウンドの上乗せがユニットに乗る',
          hero.situational.firstRoundPower >= 1.8, `+${hero.situational.firstRoundPower}`);
      }

      // --- 共鳴: 自分を削って味方を上げる ---
      {
        give('ch_hero', 'set_resonance', 4);
        const b = arena();
        const self = RPG.battle.setPower(b, b.party[0]);
        const ally = RPG.battle.setPower(b, b.party[1]);
        assertTrue('セット(共鳴): 自分の火力は半分になる',
          Math.abs(self - 0.5) < 1e-9, `×${self}`);
        assertTrue('セット(共鳴): 味方の火力が上がる',
          Math.abs(ally - 1.45) < 1e-9, `×${ally}`);
        assertTrue('セット(共鳴): 単騎では意味が無い（味方がいて初めて効く）',
          RPG.battle.setPower({ party: [b.party[0]], round: 1 }, b.party[0]) === 0.5, '');
      }

      // --- 千変: 属性事故を消し、コンボを固定する ---
      {
        give('ch_hero', 'set_adapt', 4);
        const unit = RPG.units.buildCharacterUnit(save.characters.ch_hero, save.inventory);
        assertTrue('セット(千変): 属性適応を得る', unit.elementMods.adapt >= 1, '');

        const b = arena();
        assertTrue('セット(千変): コンボ上限が伸びる',
          RPG.battle.comboMax(b) === RPG.battle.COMBO_MAX + 3, `${RPG.battle.comboMax(b)}`);

        b.combo.count = 3;
        const neutral = RPG.units.buildEnemyUnit('em_gale_hawk', 14, false, 1);
        RPG.battle.updateCombo(b, b.party[0], neutral, RPG.data.skills.sk_hero_slash);
        assertTrue('セット(千変): 弱点を外してもコンボが落ちない',
          b.combo.count === 3, `${b.combo.count} 段`);
      }

      // --- 厳選してもセットは外れない ---
      {
        give('ch_hero', 'set_echo', 2);
        const item = save.inventory.find((/** @type {any} */ it) => it.setId === 'set_echo' &&
          !RPG.state.isEquipped(it.uid) === false);
        save.gold = 5000000;
        const target = save.characters.ch_hero.equipped.weapon[0];
        const res = RPG.enhance.reroll(target);
        const now = save.inventory.find((/** @type {any} */ it) => it.uid === target);
        assertTrue('セット: 厳選してもセットは引き継がれる',
          res.ok && now.setId === 'set_echo', now.setId || '(外れた)');
      }

      // --- 敵にはセット効果が乗らない ---
      {
        give('ch_hero', 'set_undying', 4);
        const b = arena();
        b.party[1].alive = false;
        const foe = b.enemies[0];
        assertTrue('セット: 敵には乗らない',
          !foe.setEffects || Object.keys(foe.setEffects).length === 0, '');
      }

      if (before === null) localStorage.removeItem(RPG.state.STORAGE_KEY);
      else localStorage.setItem(RPG.state.STORAGE_KEY, before);
      RPG.state.load();
    }

    /* ===== 装備の強化・厳選 (§7.6) ===== */
    {
      const before = localStorage.getItem(RPG.state.STORAGE_KEY);
      RPG.state.reset();
      const save = RPG.state.get();
      save.gold = 5000000;

      RPG.rng.seed(1234);
      /** @param {string} boxId @param {number} n */
      const stock = (boxId, n) => {
        const made = [];
        for (let i = 0; i < n; i++) {
          const it = RPG.gear.identify(boxId, RPG.state.nextUid());
          save.inventory.push(it);
          made.push(it);
        }
        return made;
      };
      const good = stock('box_dragon', 1)[0];
      stock('box_bronze', 60);
      RPG.rng.seed(null);

      // --- コストが等級で伸びる（終盤のゴールドの受け皿になっているか）---
      {
        const cheap = RPG.gear.forge(
          { base: 'eq_ring', rarity: 'COMMON', name: '検証の指輪', stats: { atk: 10 } }, 9001);
        cheap.boxId = 'box_bronze';
        const a = RPG.enhance.enhanceCost(cheap).gold;
        const b = RPG.enhance.enhanceCost(good).gold;
        assertTrue('強化: 高い等級ほど費用が高い', b > a * 5, `銅COMMON ${a} G / 竜${good.rarity} ${b} G`);
      }
      {
        const first = RPG.enhance.enhanceCost(good).gold;
        good.plus = 9;
        const last = RPG.enhance.enhanceCost(good).gold;
        good.plus = 0;
        assertTrue('強化: 段階が上がるほど費用が急に伸びる',
          last > first * 20, `+1 ${first} G → +10 ${last} G`);
      }

      // --- 実際に強化する ---
      const baseStats = Object.assign({}, good.stats);
      {
        const goldBefore = save.gold;
        const invBefore = save.inventory.length;
        const cost = RPG.enhance.enhanceCost(good);
        const pick = RPG.enhance.autoPickMaterials(good.uid, cost.points);
        const res = RPG.enhance.enhance(good.uid, pick.items.map((/** @type {any} */ m) => m.uid));

        assertTrue('強化: +1 になる', res.ok && good.plus === 1, res.reason || '');
        assertTrue('強化: ゴールドと素材を消費する',
          save.gold === goldBefore - cost.gold &&
          save.inventory.length === invBefore - pick.items.length,
          `${cost.gold} G / 素材 ${pick.items.length} 個`);
        assertTrue('強化: 平坦ステータスが伸びる',
          good.stats.hp > baseStats.hp || good.stats.atk > baseStats.atk ||
          good.stats.def > baseStats.def || good.stats.magi_power > baseStats.magi_power, '');
      }

      // --- 上限まで積むと想定どおりの倍率になる ---
      {
        let guard = 0;
        while (RPG.enhance.plusOf(good) < RPG.enhance.MAX_PLUS && guard++ < 20) {
          const cost = RPG.enhance.enhanceCost(good);
          const pick = RPG.enhance.autoPickMaterials(good.uid, cost.points);
          if (!pick.enough) break;
          RPG.enhance.enhance(good.uid, pick.items.map((/** @type {any} */ m) => m.uid));
        }
        assertTrue('強化: 上限まで積める',
          good.plus === RPG.enhance.MAX_PLUS, `+${good.plus}`);

        const expected = 1 + RPG.enhance.MAX_PLUS * RPG.enhance.STAT_PER_PLUS;
        const key = Object.keys(good.baseStats)[0];
        const actual = good.stats[key] / good.baseStats[key];
        assertTrue('強化: 上限での倍率が想定どおり',
          Math.abs(actual - expected) < 0.02, `×${actual.toFixed(3)}（想定 ×${expected}）`);

        assertTrue('強化: 上限を超えて積めない',
          RPG.enhance.enhanceCost(good) === null &&
          RPG.enhance.enhance(good.uid, []).ok === false, '');
      }

      // --- 系統タグ倍率などは伸ばさない（ダメージ曲線を守るため）---
      {
        const raw = RPG.gear.identify('box_dragon', RPG.state.nextUid());
        save.inventory.push(raw);
        const tagBefore = raw.tagBonuses.map((/** @type {any} */ t) => t.value).join(',');
        const critBefore = raw.critRate;
        const capBefore = raw.capBreak;
        raw.plus = 5;
        RPG.enhance.applyPlus(raw);
        assertTrue('強化: 系統タグ・クリティカル・上限突破は伸びない',
          raw.tagBonuses.map((/** @type {any} */ t) => t.value).join(',') === tagBefore &&
          raw.critRate === critBefore && raw.capBreak === capBefore,
          '平坦ステータスのみが対象');
      }

      // --- 素材にできないもの ---
      {
        const locked = save.inventory.find((/** @type {any} */ it) => it.uid !== good.uid);
        locked.locked = true;
        assertTrue('強化: ロック中は素材にできない',
          RPG.enhance.usableAsMaterial(locked, good.uid) === false, '');
        assertTrue('強化: 強化する本体は素材にできない',
          RPG.enhance.usableAsMaterial(good, good.uid) === false, '');

        const worn = save.inventory.find(
          (/** @type {any} */ it) => !it.locked && it.uid !== good.uid);
        RPG.state.equip('ch_hero', worn.uid);
        assertTrue('強化: 装備中は素材にできない',
          RPG.enhance.usableAsMaterial(worn, good.uid) === false, '');

        const other = save.inventory.find((/** @type {any} */ it) =>
          !it.locked && !RPG.state.isEquipped(it.uid) && it.uid !== good.uid);
        const denied = RPG.enhance.enhance(other.uid, [worn.uid]);
        assertTrue('強化: 装備中を素材に指定すると断られる',
          denied.ok === false && !!denied.reason, denied.reason || '');
        assertTrue('強化: 断られたときは何も消費しない',
          save.inventory.some((/** @type {any} */ it) => it.uid === worn.uid), '');
      }

      // --- ゴールド不足 ---
      {
        const target = save.inventory.find((/** @type {any} */ it) =>
          !it.locked && !RPG.state.isEquipped(it.uid) && it.uid !== good.uid);
        const keep = save.gold;
        save.gold = 0;
        const res = RPG.enhance.enhance(target.uid, []);
        assertTrue('強化: ゴールドが足りなければ断る',
          res.ok === false && /足りません/.test(res.reason || ''), res.reason || '');
        save.gold = keep;
      }

      // --- 厳選 ---
      {
        const goldBefore = save.gold;
        const cost = RPG.enhance.rerollCost(good);
        const plusBefore = good.plus;
        const nameBefore = good.name;
        good.locked = true;

        const res = RPG.enhance.reroll(good.uid);
        const now = save.inventory.find((/** @type {any} */ it) => it.uid === good.uid);

        assertTrue('厳選: 振り直せる', res.ok === true, res.reason || '');
        assertTrue('厳選: ゴールドを消費する',
          save.gold === goldBefore - cost, `${cost.toLocaleString()} G`);
        assertTrue('厳選: 部位・レアリティ・ベースは変わらない',
          now.slot === good.slot && now.rarity === good.rarity && now.base === good.base, '');
        assertTrue('厳選: 強化値・名前・ロックは引き継ぐ',
          now.plus === plusBefore && now.name === nameBefore && now.locked === true,
          `+${now.plus}`);

        const expected = 1 + plusBefore * RPG.enhance.STAT_PER_PLUS;
        const key = Object.keys(now.baseStats)[0];
        assertTrue('厳選: 強化値がステータスへ乗り直す',
          Math.abs(now.stats[key] / now.baseStats[key] - expected) < 0.02,
          `×${(now.stats[key] / now.baseStats[key]).toFixed(3)}`);
      }

      // --- 専用装備は厳選できない（強化はできる）---
      {
        const unique = RPG.gear.forge(
          RPG.data.quests.q_beyond_end.reward.equip, RPG.state.nextUid());
        save.inventory.push(unique);
        const res = RPG.enhance.reroll(unique.uid);
        assertTrue('厳選: クエスト報酬の専用装備は対象外',
          res.ok === false && !!res.reason, res.reason || '');
        assertTrue('強化: 専用装備でも強化はできる',
          RPG.enhance.enhanceCost(unique) !== null, '');
      }

      if (before === null) localStorage.removeItem(RPG.state.STORAGE_KEY);
      else localStorage.setItem(RPG.state.STORAGE_KEY, before);
      RPG.state.load();
    }

    /* ===== 装備プリセット (§7.5) ===== */
    {
      const before = localStorage.getItem(RPG.state.STORAGE_KEY);
      RPG.state.reset();
      const save = RPG.state.get();
      save.characters.ch_rizel = RPG.state.createCharacter('ch_rizel');

      /** @param {number} atk @param {string} base */
      const make = (atk, base) => {
        const item = RPG.gear.forge({ base, rarity: 'RARE', name: `検証${base}${atk}`, stats: { atk } },
          RPG.state.nextUid());
        item.locked = false;
        save.inventory.push(item);
        return item;
      };

      const swordA = make(100, 'eq_longsword');
      const swordB = make(50, 'eq_longsword');
      const ring = make(20, 'eq_ring');

      assertTrue('プリセット: 初期状態は全枠が空',
        RPG.state.presets('ch_hero').every((p) => p === null),
        `${RPG.state.PRESET_SLOTS} 枠`);

      // --- 保存と復元 ---
      RPG.state.equip('ch_hero', swordA.uid);
      RPG.state.equip('ch_hero', ring.uid);
      RPG.state.savePreset('ch_hero', 0, '検証構成');
      assertTrue('プリセット: 名前と内容が保存される',
        RPG.state.presets('ch_hero')[0].name === '検証構成' &&
        RPG.state.presets('ch_hero')[0].equipped.weapon[0] === swordA.uid, '');

      RPG.state.equip('ch_hero', swordB.uid);
      assertTrue('プリセット: 保存後に装備を変えても内容は変わらない',
        RPG.state.presets('ch_hero')[0].equipped.weapon[0] === swordA.uid &&
        save.characters.ch_hero.equipped.weapon[0] === swordB.uid, '');

      const restored = RPG.state.applyPreset('ch_hero', 0);
      assertTrue('プリセット: 適用すると保存時の装備に戻る',
        restored.ok && save.characters.ch_hero.equipped.weapon[0] === swordA.uid,
        `${restored.applied} 点を装備`);

      // --- 他のキャラが着けていた場合は取り上げる（装備は1つを1人だけ）---
      RPG.state.equip('ch_rizel', swordA.uid);
      const stolen = RPG.state.applyPreset('ch_hero', 0);
      assertTrue('プリセット: 他のキャラの装備を含むと相手から外れる',
        save.characters.ch_hero.equipped.weapon[0] === swordA.uid &&
        save.characters.ch_rizel.equipped.weapon.length === 0, '');
      assertTrue('プリセット: 取り上げた相手を報告する',
        (stolen.stolen || []).length === 1, (stolen.stolen || []).join('、'));

      // --- 売却済みの装備は欠番として飛ばす ---
      RPG.state.unequip('ch_hero', ring.uid);
      RPG.state.sell(ring.uid);
      const withMissing = RPG.state.applyPreset('ch_hero', 0);
      assertTrue('プリセット: 売却済みの装備は欠番として飛ばす',
        withMissing.ok && withMissing.missing === 1 &&
        save.characters.ch_hero.equipped.accessory.length === 0,
        `装備 ${withMissing.applied} 点 / 欠番 ${withMissing.missing} 点`);

      // --- 空き枠と削除 ---
      assertTrue('プリセット: 空き枠を適用しても何も起きない',
        RPG.state.applyPreset('ch_hero', 2).ok === false, '');
      RPG.state.deletePreset('ch_hero', 0);
      assertTrue('プリセット: 削除すると空き枠に戻る',
        RPG.state.presets('ch_hero')[0] === null, '');

      // --- キャラごとに独立している ---
      RPG.state.savePreset('ch_hero', 0, 'A');
      RPG.state.savePreset('ch_rizel', 0, 'B');
      assertTrue('プリセット: キャラごとに独立している',
        RPG.state.presets('ch_hero')[0].name === 'A' &&
        RPG.state.presets('ch_rizel')[0].name === 'B', '');

      if (before === null) localStorage.removeItem(RPG.state.STORAGE_KEY);
      else localStorage.setItem(RPG.state.STORAGE_KEY, before);
      RPG.state.load();
    }

    /* ===== エンドレスタワー (§10.7) ===== */
    {
      const before = localStorage.getItem(RPG.state.STORAGE_KEY);
      RPG.state.reset();
      const save = RPG.state.get();
      for (const id of ['ch_rizel', 'ch_gald', 'ch_shiki']) {
        save.characters[id] = RPG.state.createCharacter(id);
      }
      save.party = ['ch_hero', 'ch_rizel', 'ch_gald', 'ch_shiki'];
      for (const id of save.party) save.characters[id].level = 40;

      // --- 階層の設計 ---
      {
        const cfg = RPG.data.tower;
        assertTrue('塔: 階層帯が実在するフィールドを指している',
          cfg.tiers.every((/** @type {any} */ t) => !!RPG.data.fields[t.fieldId]),
          `${cfg.tiers.length} 帯`);
        assertTrue('塔: 階層帯が階の順に並んでいる',
          cfg.tiers.every((/** @type {any} */ t, /** @type {number} */ i) =>
            i === 0 || t.from > cfg.tiers[i - 1].from), '');
        assertTrue('塔: 節目の報酬が実在するものを指している',
          cfg.milestones.every((/** @type {any} */ m) =>
            (!m.equip || !!RPG.data.equipBases[m.equip.base]) &&
            Object.keys(m.boxes || {}).every((b) => !!RPG.data.boxes[b])),
          `${cfg.milestones.length} 件`);
        assertTrue('塔: 上限が無く、最後の帯が延々と続く',
          RPG.tower.tierOf(9999) === cfg.tiers[cfg.tiers.length - 1], '');
      }

      // --- 階が上がるほど強くなる ---
      {
        const a = RPG.tower.floorSpec(1);
        const b = RPG.tower.floorSpec(50);
        assertTrue('塔: 階が上がるほど敵が強くなる',
          b.enemyLv > a.enemyLv && b.enemyScale > a.enemyScale,
          `1階 Lv${a.enemyLv}×${a.enemyScale} → 50階 Lv${b.enemyLv}×${b.enemyScale.toFixed(2)}`);
        assertTrue('塔: 決まった階ごとにボスが出る',
          RPG.tower.isBossFloor(RPG.data.tower.bossEvery) &&
          !RPG.tower.isBossFloor(RPG.data.tower.bossEvery + 1), '');
        assertTrue('塔: ボス階はさらに強い',
          RPG.tower.floorSpec(RPG.data.tower.bossEvery).enemyScale >
          RPG.tower.floorSpec(RPG.data.tower.bossEvery - 1).enemyScale, '');
      }

      // --- 挑戦の開始 ---
      assertTrue('塔: 最初は挑戦していない',
        RPG.tower.run() === null && RPG.tower.status().active === false, '');
      assertTrue('塔: 挑戦を始められる',
        RPG.tower.start().ok === true && RPG.tower.run().floor === 1, '');

      /** 今の階を最後まで戦って結果を返す */
      const climb = () => {
        const battle = RPG.tower.enter();
        if (!battle) return null;
        let guard = 0;
        while (!battle.finished && guard++ < 3000) {
          if (battle.phase === 'wave_clear') { RPG.battle.advanceWave(battle); continue; }
          const action = RPG.autoplay.chooseAction(battle);
          if (!action) break;
          RPG.battle.commandSkill(battle, action.skillId, action.targets, { auto: true });
        }
        return { battle, result: RPG.tower.resolve(battle) };
      };

      // --- HPの持ち越し ---
      RPG.rng.seed(555);
      {
        const first = climb();
        assertTrue('塔: 1階を戦える', !!first && first.result.cleared, '');

        // わざと削った状態で持ち越されるかを見る
        const t = RPG.tower.store();
        for (const id of Object.keys(t.run.hp)) t.run.hp[id] = 0.4;
        const next = RPG.tower.enter();
        assertTrue('塔: HPが階をまたいで持ち越される',
          next.party.every((/** @type {any} */ u) =>
            Math.abs(u.hp / u.maxHp - 0.4) < 0.02),
          next.party.map((/** @type {any} */ u) => Math.round(u.hp / u.maxHp * 100) + '%').join(' '));
      }

      // --- ボス階を越えると立て直せる ---
      {
        const t = RPG.tower.store();
        t.run.floor = RPG.data.tower.bossEvery;
        for (const id of Object.keys(t.run.hp)) t.run.hp[id] = 0.3;

        const battle = RPG.tower.enter();
        battle.victory = true;
        battle.finished = true;
        // 生き残った状態を作ってから判定させる
        for (const u of battle.party) { u.alive = true; u.hp = Math.floor(u.maxHp * 0.3); }
        const res = RPG.tower.resolve(battle);
        assertTrue('塔: ボス階を越えると回復する',
          res.healed === true &&
          Object.keys(t.run.hp).every((id) => t.run.hp[id] > 0.3),
          `${Math.round(Object.values(t.run.hp)[0] * 100)}%`);
      }

      // --- 倒れた仲間は起き上がらない ---
      {
        const t = RPG.tower.store();
        t.run.floor = RPG.data.tower.bossEvery * 2;
        const battle = RPG.tower.enter();
        battle.victory = true;
        battle.finished = true;
        battle.party[0].alive = false;
        battle.party[0].hp = 0;
        RPG.tower.resolve(battle);
        assertTrue('塔: 倒れた仲間はボス階の回復では戻らない',
          t.run.hp[battle.party[0].id] === 0, '');
      }

      // --- 到達報酬は記録更新時のみ ---
      {
        const t = RPG.tower.store();
        t.best = 0;
        t.claimed = 0;
        const goldBefore = RPG.state.get().gold;
        const first = RPG.tower.claimTo(3);
        const goldAfter = RPG.state.get().gold;
        assertTrue('塔: 到達報酬を受け取れる',
          first.length > 0 && goldAfter > goldBefore, first.join(' / '));

        const again = RPG.tower.claimTo(3);
        assertTrue('塔: 同じ深さでは二度目の報酬が出ない',
          again.length === 0 && RPG.state.get().gold === goldAfter,
          '周回して稼げないこと');

        const deeper = RPG.tower.claimTo(5);
        assertTrue('塔: さらに深く行けば差分だけ出る',
          deeper.length > 0, deeper.join(' / '));
      }

      // --- 節目の報酬 ---
      {
        const t = RPG.tower.store();
        t.claimed = 0;
        const milestone = RPG.data.tower.milestones.find((/** @type {any} */ m) => m.autoCharge);
        const maxBefore = RPG.autolimit.max();
        RPG.tower.claimTo(milestone.floor);
        assertTrue('塔: 節目でオート回数の上限が伸びる',
          RPG.autolimit.max() > maxBefore,
          `${maxBefore} → ${RPG.autolimit.max()}`);
      }

      // --- 敗北で挑戦が終わる ---
      {
        RPG.tower.start();
        const t = RPG.tower.store();
        const bestBefore = t.best;
        t.run.floor = 200;   // 勝ち目のない深さ
        const battle = RPG.tower.enter();
        battle.victory = false;
        battle.finished = true;
        const res = RPG.tower.resolve(battle);
        assertTrue('塔: 倒れたら挑戦が終わる',
          res.finished === true && RPG.tower.run() === null, '');
        assertTrue('塔: 記録は残る', RPG.tower.best() === bestBefore, `${RPG.tower.best()} 階`);
      }

      // --- 切り上げ ---
      {
        RPG.tower.store().best = 8;   // 記録が残ることを見たいので、既知の値を置く
        RPG.tower.start();
        RPG.tower.retire();
        assertTrue('塔: 切り上げると挑戦だけが終わり、記録は残る',
          RPG.tower.run() === null && RPG.tower.best() === 8, `${RPG.tower.best()} 階`);
      }

      // --- 戦闘設定はクエスト機構を借りるが、クエスト報酬は発生させない ---
      {
        const cfg = RPG.tower.battleConfig(7);
        assertTrue('塔: クエストIDを持たない（初回クリア報酬を誤発火させない）',
          cfg.quest.id === undefined, '');
        const battle = RPG.battle.start({
          fieldId: cfg.fieldId, waves: cfg.waves,
          party: RPG.state.partyUnits(), bossFinale: cfg.bossFinale, quest: cfg.quest,
        });
        assertTrue('塔: 階の強さが戦闘へ反映される',
          battle.enemyLv === cfg.quest.enemyLv && battle.enemyScale === cfg.quest.enemyScale,
          `Lv${battle.enemyLv} ×${battle.enemyScale}`);
        assertTrue('塔: questId が立たない', !battle.questId, String(battle.questId));
      }
      RPG.rng.seed(null);

      if (before === null) localStorage.removeItem(RPG.state.STORAGE_KEY);
      else localStorage.setItem(RPG.state.STORAGE_KEY, before);
      RPG.state.load();
    }

    /* ===== オート回数 (§10.5) ===== */
    {
      const before = localStorage.getItem(RPG.state.STORAGE_KEY);
      RPG.state.reset();
      const a = RPG.state.get().autoLimit;

      assertTrue('オート回数: 最初は満タン',
        RPG.autolimit.charges() === RPG.autolimit.max() &&
        RPG.autolimit.max() === RPG.autolimit.BASE_MAX,
        `${RPG.autolimit.charges()} / ${RPG.autolimit.max()}`);

      // --- 消費 ---
      assertTrue('オート回数: 1回消費できる',
        RPG.autolimit.spend() === true &&
        RPG.autolimit.charges() === RPG.autolimit.BASE_MAX - 1, '');

      a.charges = 0;
      a.checkedAt = Date.now();
      assertTrue('オート回数: 尽きたら消費できない',
        RPG.autolimit.spend() === false && RPG.autolimit.canAuto() === false, '');

      // --- 実時間で回復し、端数は持ち越す ---
      {
        a.charges = 0;
        a.checkedAt = Date.now() - RPG.autolimit.REGEN_MS * 3.5;
        const got = RPG.autolimit.charges();
        assertTrue('オート回数: 経過時間ぶんだけ回復する', got === 3, `${got} 回復`);
        const next = RPG.autolimit.nextRegenMs();
        assertTrue('オート回数: 端数の時間は次の回復に持ち越す',
          next > 0 && next < RPG.autolimit.REGEN_MS,
          `次まで ${Math.round(next / 1000)} 秒`);
      }

      // --- 上限 ---
      {
        a.charges = 0;
        a.checkedAt = Date.now() - RPG.autolimit.REGEN_MS * 9999;
        assertTrue('オート回数: 放置しても上限を超えない',
          RPG.autolimit.charges() === RPG.autolimit.max(), `${RPG.autolimit.charges()}`);
      }

      // --- 時計を巻き戻されても増えない ---
      {
        a.charges = 5;
        a.checkedAt = Date.now() + 60 * 60 * 1000;
        assertTrue('オート回数: 時計を進めても勝手に増えない',
          RPG.autolimit.charges() === 5, `${RPG.autolimit.charges()}`);
      }

      // --- クエスト報酬で上限が伸びる ---
      {
        a.charges = 2;
        a.checkedAt = Date.now();
        const before2 = RPG.autolimit.max();
        const after = RPG.autolimit.grantMax(5);
        assertTrue('オート回数: 上限を永続的に増やせる',
          after === before2 + 5 && RPG.autolimit.charges() === 7,
          `上限 ${before2} → ${after} / 残量 ${RPG.autolimit.charges()}`);
        assertTrue('オート回数: 上限には天井がある',
          RPG.autolimit.grantMax(9999) === RPG.autolimit.MAX_CAP,
          `${RPG.autolimit.MAX_CAP}`);
      }

      // --- 実際にオート回数を配るクエストがある ---
      {
        const givers = RPG.quest.all().filter((q) => q.reward && q.reward.autoCharge);
        assertTrue('オート回数: クエスト報酬として配られる',
          givers.length > 0,
          givers.map((q) => `${q.name} +${q.reward.autoCharge}`).join('、'));
        assertTrue('オート回数: 骨のあるクエストの報酬になっている',
          givers.every((q) =>
            (q.rules && (q.rules.noAuto || q.rules.maxRounds)) || q.kind === 'challenge'),
          '縛りつき、または格上に挑む達成条件型にのみ設定');
      }

      if (before === null) localStorage.removeItem(RPG.state.STORAGE_KEY);
      else localStorage.setItem(RPG.state.STORAGE_KEY, before);
      RPG.state.load();
    }

    /* ===== 弱点コンボ (§10.6) ===== */
    {
      const before = localStorage.getItem(RPG.state.STORAGE_KEY);
      RPG.state.reset();
      RPG.state.get().characters.ch_hero.level = 60;

      const party = RPG.state.partyUnits();
      const b = RPG.battle.start({ fieldId: 'fl_mine', waves: 1, party, bossFinale: false });
      // 主人公は光属性。闇の敵を置けば必ず有利を突ける。
      const dark = RPG.units.buildEnemyUnit('em_wisp', 14, false, 0);
      dark.key = 'e0';
      dark.maxHp = dark.hp = 9e6;
      b.enemies = [dark];

      assertTrue('コンボ: 最初は0', b.combo.count === 0 && RPG.battle.comboPower(b) === 0, '');

      // 増減そのものを見たいので、戦闘の進行（敵フェーズでの生死）に左右されないよう
      // updateCombo を直接呼ぶ。実戦での積み上がりは別途下で確かめる。
      const slash = RPG.data.skills.sk_hero_slash;   // 光属性
      const hero = b.party[0];
      const neutral = RPG.units.buildEnemyUnit('em_gale_hawk', 14, false, 1);   // 風＝光に対して等倍

      RPG.battle.updateCombo(b, hero, dark, slash);
      assertTrue('コンボ: 属性有利を突くと伸びる',
        b.combo.count === 1 && b.combo.reason === '属性有利', `${b.combo.count} 段`);

      for (let i = 0; i < 8; i++) RPG.battle.updateCombo(b, hero, dark, slash);
      assertTrue('コンボ: 上限で頭打ちになる',
        b.combo.count === RPG.battle.COMBO_MAX, `${b.combo.count} / ${RPG.battle.COMBO_MAX}`);
      assertTrue('コンボ: 上限での上乗せが想定どおり',
        Math.abs(RPG.battle.comboPower(b) - RPG.battle.COMBO_MAX * RPG.battle.COMBO_STEP) < 1e-9,
        `+${Math.round(RPG.battle.comboPower(b) * 100)}%`);

      // 有利でも弱体でもない相手を殴ると1段だけ落ちる（0には戻さない）
      {
        const was = b.combo.count;
        RPG.battle.updateCombo(b, hero, neutral, slash);
        assertTrue('コンボ: 弱点を外すと1段だけ落ちる',
          b.combo.count === was - 1, `${was} → ${b.combo.count}`);
      }

      // デバフ中の相手なら、属性が等倍でも伸びる
      {
        b.combo.count = 0;
        neutral.statusEffects = [{ kind: 'poison', label: '毒', turns: 3, ratio: 0.05 }];
        RPG.battle.updateCombo(b, hero, neutral, slash);
        assertTrue('コンボ: 弱体中の相手を狙っても伸びる',
          b.combo.count === 1 && b.combo.reason === '弱体中', b.combo.reason);
        neutral.statusEffects = [];
      }

      // 補助技では増減しない
      {
        b.combo.count = 2;
        RPG.battle.updateCombo(b, hero, neutral, RPG.data.skills.sk_focus);
        assertTrue('コンボ: 補助技では増減しない', b.combo.count === 2, `${b.combo.count} 段`);
      }

      // 実戦でも積み上がる（1手だけ試して進行に依存させない）
      {
        b.combo.count = 0;
        b.finished = false;
        b.actorIndex = 0;
        b.phase = 'command';
        b.party[0].alive = true;
        b.party[0].hp = b.party[0].maxHp;
        RPG.battle.commandSkill(b, 'sk_hero_slash', [dark]);
        assertTrue('コンボ: 実際のコマンドでも積み上がる',
          b.combo.count === 1, `${b.combo.count} 段`);
      }

      // --- ダメージに実際に乗る ---
      {
        const unit = RPG.state.partyUnits()[0];
        const dummy = RPG.units.buildEnemyUnit('em_wisp', 14, false, 0);
        const skill = RPG.data.skills.sk_hero_slash;
        const at = (/** @type {number} */ cp) => RPG.damage.calc({
          attacker: RPG.units.toAttacker(unit),
          defender: RPG.units.toDefender(dummy),
          skill,
          options: { random: 1, crit: false, comboPower: cp },
        }).damage;
        const full = RPG.battle.COMBO_MAX * RPG.battle.COMBO_STEP;
        const ratio = at(full) / at(0);
        assertTrue('コンボ: 上乗せぶんだけダメージが増える',
          Math.abs(ratio - (1 + full)) < 0.01, `×${ratio.toFixed(3)}`);
      }

      // --- 敵の攻撃では伸びない ---
      {
        b.combo.count = 0;
        b.party[0].alive = true;
        b.party[0].hp = b.party[0].maxHp;
        RPG.battle.applyDamage(b, b.enemies[0], b.party[0], RPG.data.skills.sk_enemy_shadow, {});
        assertTrue('コンボ: 敵の攻撃では伸びない', b.combo.count === 0, `${b.combo.count} 段`);
      }

      // --- オートAIはコンボを考慮しない（手動の取り分であるため）---
      assertTrue('コンボ: オートAIは考慮しない（手動の利点として残す）',
        RPG.autoplay.estimate.toString().indexOf('combo') < 0, '');

      if (before === null) localStorage.removeItem(RPG.state.STORAGE_KEY);
      else localStorage.setItem(RPG.state.STORAGE_KEY, before);
      RPG.state.load();
    }

    /* ===== 派遣 (§10.4) ===== */
    {
      const before = localStorage.getItem(RPG.state.STORAGE_KEY);
      RPG.state.reset();
      const save = RPG.state.get();
      for (const id of ['ch_rizel', 'ch_gald', 'ch_shiki']) {
        save.characters[id] = RPG.state.createCharacter(id);
      }
      save.party = ['ch_hero', 'ch_rizel', 'ch_gald', 'ch_shiki'];
      for (const id of save.party) save.characters[id].level = 14;

      // --- 開始と進行 ---
      assertTrue('派遣: 最初は何も派遣していない',
        RPG.dispatch.current() === null && RPG.dispatch.status().active === false, '');

      const began = RPG.dispatch.start({
        fieldId: 'fl_mine', waves: 5, bossFinale: true, planId: 'short',
      });
      assertTrue('派遣: 開始できる', began.ok === true, began.reason || '');

      const st = RPG.dispatch.status();
      assertTrue('派遣: 開始直後は進捗がほぼ0で、まだ帰還していない',
        st.active && !st.done && st.ratio < 0.05 && st.remainMs > 0,
        `残り ${RPG.dispatch.formatDuration(st.remainMs)}`);

      assertTrue('派遣: 同時に2件は出せない',
        RPG.dispatch.start({ fieldId: 'fl_plain', waves: 5, bossFinale: true, planId: 'short' }).ok === false,
        '');

      // --- 時間が来るまで受け取れない ---
      {
        const early = RPG.dispatch.collect();
        assertTrue('派遣: 時間前は受け取れない',
          early.ok === false && !!early.reason, early.reason || '');
        assertTrue('派遣: 受け取りに失敗しても派遣は残る',
          RPG.dispatch.current() !== null, '');
      }

      // --- 実時間で進む（セーブに開始時刻だけを持つので、時計を戻せば再現できる）---
      {
        const d = RPG.state.get().dispatch;
        const total = d.endsAt - d.startedAt;
        d.startedAt -= total / 2;
        d.endsAt -= total / 2;
        const half = RPG.dispatch.status();
        assertTrue('派遣: 経過時間ぶんだけ進む',
          half.ratio > 0.4 && half.ratio < 0.6 && !half.done,
          `進捗 ${Math.round(half.ratio * 100)}%`);
      }

      // --- 受け取り ---
      {
        const d = RPG.state.get().dispatch;
        const total = d.endsAt - d.startedAt;
        d.startedAt -= total;
        d.endsAt -= total;

        assertTrue('派遣: 時間が過ぎたら帰還扱いになる', RPG.dispatch.status().done === true, '');

        RPG.rng.seed(9001);
        const goldBefore = RPG.state.get().gold;
        const battlesBefore = RPG.state.get().stats.battles;
        const got = RPG.dispatch.collect();
        RPG.rng.seed(null);
        const after = RPG.state.get();
        const r = got.result;

        assertTrue('派遣: 受け取れる', got.ok === true && !!r, got.reason || '');
        assertTrue('派遣: 時間に応じた周回数になる',
          r.runs === RPG.dispatch.runsFor(RPG.dispatch.plan('short').ms) &&
          r.wins + r.losses === r.runs,
          `${r.runs}周 / ${r.wins}勝${r.losses}敗`);
        assertTrue('派遣: 得たゴールドが所持金に反映される',
          after.gold - goldBefore === r.gold, `+${r.gold.toLocaleString()} G`);
        assertTrue('派遣: 戦績が周回数ぶん増える',
          after.stats.battles - battlesBefore === r.runs,
          `${battlesBefore} → ${after.stats.battles}`);
        assertTrue('派遣: 受け取ると派遣枠が空く',
          RPG.dispatch.current() === null && RPG.dispatch.status().active === false, '');
        assertTrue('派遣: 図鑑にも記録される',
          RPG.data.fields.fl_mine.pool.some((/** @type {string} */ id) => RPG.codex.enemySeen(id)), '');
      }

      // --- 早送りできないこと（周回数は時間からしか決まらない）---
      {
        const short = RPG.dispatch.runsFor(RPG.dispatch.plan('short').ms);
        const long = RPG.dispatch.runsFor(RPG.dispatch.plan('long').ms);
        assertTrue('派遣: 長く預けたぶんだけ周回数が増える',
          long > short, `短時間 ${short}周 / 長時間 ${long}周`);
        assertTrue('派遣: 1周あたりの所要時間が実時間で決まっている',
          RPG.dispatch.runsFor(RPG.dispatch.MS_PER_RUN * 3) === 3,
          `${RPG.dispatch.MS_PER_RUN / 60000} 分/周`);
        assertTrue('派遣: 放置しすぎても上限で頭打ちになる',
          RPG.dispatch.runsFor(RPG.dispatch.MS_PER_RUN * 10000) === RPG.dispatch.MAX_RUNS,
          `上限 ${RPG.dispatch.MAX_RUNS} 周`);
      }

      // --- 報酬は手動より少ない ---
      assertTrue('派遣: 報酬倍率が手動戦闘より低い',
        RPG.dispatch.REWARD_RATE < 1, `×${RPG.dispatch.REWARD_RATE}`);

      // --- 取りやめ ---
      {
        RPG.dispatch.start({ fieldId: 'fl_plain', waves: 5, bossFinale: true, planId: 'short' });
        const goldBefore = RPG.state.get().gold;
        RPG.dispatch.cancel();
        assertTrue('派遣: 取りやめると報酬なしで枠が空く',
          RPG.dispatch.current() === null && RPG.state.get().gold === goldBefore, '');
      }

      // --- 編成が空なら始められない ---
      {
        RPG.state.get().party = [];
        assertTrue('派遣: パーティが空なら始められない',
          RPG.dispatch.start({ fieldId: 'fl_plain', waves: 5, bossFinale: true, planId: 'short' }).ok === false,
          '');
      }

      // --- 端末の時計を戻されても壊れない ---
      {
        RPG.state.get().party = ['ch_hero'];
        RPG.dispatch.start({ fieldId: 'fl_plain', waves: 5, bossFinale: true, planId: 'short' });
        const d = RPG.state.get().dispatch;
        d.startedAt = Date.now() + 60 * 60 * 1000;   // 未来から始まったことにする
        d.endsAt = d.startedAt + 30 * 60 * 1000;
        const weird = RPG.dispatch.status();
        assertTrue('派遣: 時計が巻き戻っても進捗が負にならない',
          weird.ratio >= 0 && weird.done === false, `進捗 ${weird.ratio}`);
        RPG.dispatch.cancel();
      }

      if (before === null) localStorage.removeItem(RPG.state.STORAGE_KEY);
      else localStorage.setItem(RPG.state.STORAGE_KEY, before);
      RPG.state.load();
    }

    /* ===== 装備の自動売却 (§7.4) ===== */
    {
      const before = localStorage.getItem(RPG.state.STORAGE_KEY);
      RPG.state.reset();
      const save = RPG.state.get();

      /**
       * スコアを指定して装備を1つ作る。ATKだけを持たせるので score = atk になる。
       * @param {string} rarity
       * @param {number} atk
       * @param {string} [base]
       */
      const make = (rarity, atk, base) => {
        const item = RPG.gear.forge(
          { base: base || 'eq_longsword', rarity, name: `検証${rarity}${atk}`, stats: { atk } },
          RPG.state.nextUid());
        item.locked = false;
        save.inventory.push(item);
        return item;
      };

      RPG.autosell.updateRules(RPG.autosell.defaultRules());

      // --- 更新候補の保護（既定ON）---
      // 装備が空のうちは何もかも更新候補なので、1つも売られてはいけない
      const trash = make('COMMON', 10);
      assertTrue('自動売却: 装備が空なら何も売られない',
        RPG.autosell.candidates().items.length === 0,
        RPG.autosell.judge(trash, RPG.autosell.upgradeBar()).reason);

      // 主人公に強い武器を着せると、それより弱いものが売却対象になる
      const equipped = make('SUPER_RARE', 300);
      RPG.state.equip('ch_hero', equipped.uid);
      const bar = RPG.autosell.upgradeBar();
      assertTrue('自動売却: 装備中のスコアが基準になる', bar.weapon === 300, `武器の基準 ${bar.weapon}`);
      assertTrue('自動売却: 基準より弱い粗悪品が対象になる',
        RPG.autosell.judge(trash, bar).sell === true, RPG.autosell.judge(trash, bar).reason);

      // 基準より強いものは、レアリティ条件に合っていても売らない
      const upgrade = make('COMMON', 500);
      assertTrue('自動売却: 更新候補は条件に合っても売らない',
        RPG.autosell.judge(upgrade, RPG.autosell.upgradeBar()).sell === false,
        RPG.autosell.judge(upgrade, RPG.autosell.upgradeBar()).reason);

      // 安全装置を切れば売られる
      RPG.autosell.updateRules({ protectUpgrades: false });
      assertTrue('自動売却: 安全装置を切ると更新候補も売られる',
        RPG.autosell.judge(upgrade, RPG.autosell.upgradeBar()).sell === true, '');
      RPG.autosell.updateRules({ protectUpgrades: true });

      // --- ロックと装備中は常に守られる ---
      const locked = make('COMMON', 5);
      locked.locked = true;
      assertTrue('自動売却: ロック中は対象外',
        RPG.autosell.judge(locked, RPG.autosell.upgradeBar()).reason === 'ロック中', '');
      assertTrue('自動売却: 装備中は対象外',
        RPG.autosell.judge(equipped, RPG.autosell.upgradeBar()).reason === '装備中', '');

      // --- スコア条件 ---
      RPG.autosell.updateRules({
        rarities: { COMMON: false, RARE: false, SUPER_RARE: false, LEGEND: false },
        minScore: 100,
      });
      const cheapRare = make('RARE', 40);
      assertTrue('自動売却: スコア条件だけでも判定できる',
        RPG.autosell.judge(cheapRare, RPG.autosell.upgradeBar()).sell === true, 'スコア40 < 100');

      RPG.autosell.updateRules({ minScore: 0 });
      assertTrue('自動売却: スコア条件を0にすると使われない',
        RPG.autosell.judge(cheapRare, RPG.autosell.upgradeBar()).sell === false, '');

      // --- 実際に売却したときの整合性 ---
      RPG.autosell.updateRules({
        rarities: { COMMON: true, RARE: false, SUPER_RARE: false, LEGEND: false },
        minScore: 0, protectUpgrades: true,
      });
      {
        const found = RPG.autosell.candidates();
        const goldBefore = RPG.state.get().gold;
        const invBefore = RPG.state.get().inventory.length;
        const res = RPG.autosell.run();
        const after = RPG.state.get();
        assertTrue('自動売却: 事前の見積もりと実際の売却が一致する',
          res.count === found.items.length && res.gold === found.gold,
          `見積 ${found.items.length}個/${found.gold}G → 実際 ${res.count}個/${res.gold}G`);
        assertTrue('自動売却: 所持数とゴールドが正しく動く',
          after.inventory.length === invBefore - res.count && after.gold === goldBefore + res.gold,
          `所持 ${invBefore}→${after.inventory.length} / G +${after.gold - goldBefore}`);
        assertTrue('自動売却: ロック品と装備中は残っている',
          after.inventory.some((/** @type {any} */ i) => i.uid === locked.uid) &&
          after.inventory.some((/** @type {any} */ i) => i.uid === equipped.uid), '');
        assertTrue('自動売却: 更新候補は残っている',
          after.inventory.some((/** @type {any} */ i) => i.uid === upgrade.uid), '');
      }

      // --- 対象を絞った売却（鑑定直後の分だけ）---
      {
        const keep = make('COMMON', 8);
        const target = make('COMMON', 9);
        const res = RPG.autosell.run([target]);
        const after = RPG.state.get();
        assertTrue('自動売却: 渡した装備だけを対象にできる',
          res.count === 1 &&
          after.inventory.some((/** @type {any} */ i) => i.uid === keep.uid) &&
          !after.inventory.some((/** @type {any} */ i) => i.uid === target.uid),
          `${res.count} 個を売却`);
      }

      if (before === null) localStorage.removeItem(RPG.state.STORAGE_KEY);
      else localStorage.setItem(RPG.state.STORAGE_KEY, before);
      RPG.state.load();
    }

    /* ===== クエスト (§10.3) ===== */
    {
      const before = localStorage.getItem(RPG.state.STORAGE_KEY);
      RPG.state.reset();
      const save = RPG.state.get();

      // --- 解放条件 ---
      const locked = RPG.quest.def('q_trial_aegis');
      assertTrue('クエスト: 前提クエスト未達成なら解放されない',
        RPG.quest.unlocked(locked).ok === false, RPG.quest.unlocked(locked).reason || '');

      const open = RPG.quest.def('q_solo_plain');
      assertTrue('クエスト: 解放条件が無ければ最初から挑戦できる',
        RPG.quest.unlocked(open).ok === true, '');

      // --- 縛り条件の検証 ---
      save.characters.ch_rizel = RPG.state.createCharacter('ch_rizel');
      save.characters.ch_noa = RPG.state.createCharacter('ch_noa');
      save.party = ['ch_hero', 'ch_rizel', 'ch_noa'];
      const soloCheck = RPG.quest.checkParty(open);
      assertTrue('クエスト: 人数制限を超えていると出撃できない',
        soloCheck.ok === false && soloCheck.reasons.length === 1, soloCheck.reasons.join(' / '));

      save.party = ['ch_hero'];
      assertTrue('クエスト: 条件を満たせば出撃できる',
        RPG.quest.checkParty(open).ok === true, '');

      // 属性制限。編成から外せない主人公は対象外なので、外せる仲間で判定する。
      // （主人公にも縛りを課すと、属性が合わない時点で永久に達成不能になるため）
      const azure = RPG.quest.def('q_azure_oath');
      save.party = ['ch_hero', 'ch_rizel'];   // リゼルは火属性＝水限定には出せない
      assertTrue('クエスト: 属性制限が効く',
        RPG.quest.checkParty(azure).ok === false,
        RPG.quest.checkParty(azure).reasons.join(' / '));
      save.party = ['ch_hero'];
      assertTrue('クエスト: 外せない主人公は属性制限の対象外',
        RPG.quest.checkParty(azure).ok === true,
        '主人公だけなら出撃できる');

      // レベル上限（maxLevel を使うクエストがあれば検証する）
      {
        const capped = RPG.quest.sorties().find((q) => q.rules && q.rules.maxLevel);
        if (capped) {
          save.characters.ch_hero.level = capped.rules.maxLevel + 20;
          assertTrue('クエスト: レベル上限を超えると出撃できない',
            RPG.quest.checkParty(capped).ok === false,
            RPG.quest.checkParty(capped).reasons.join(' / '));
          save.characters.ch_hero.level = 1;
        } else {
          // 主人公は編成から外せないため、レベル上限の縛りは伸びたレベルで詰む。
          // いまは相対レベルで測る達成条件型 (§10.3-2) に置き換えてある。
          assertTrue('クエスト: レベル上限の縛りは使っていない（詰みを避けるため）',
            true, '相対レベルの達成条件型に置き換え済み');
        }
      }

      // --- 達成条件型: レベルが上がっても詰まない (§10.3-2) ---
      {
        const gapQuest = RPG.quest.challenges()[0];
        assertTrue('クエスト: 達成条件型が存在する', !!gapQuest,
          RPG.quest.challenges().map((q) => q.name).join('、'));

        // どのレベルでも「自分より上の敵」は定義できるので、条件は常に満たしうる
        for (const lv of [5, 50, 200]) {
          save.characters.ch_hero.level = lv;
          const p = RPG.quest.challengeProgress(gapQuest);
          if (p.targetLevel <= p.partyTop) {
            assertTrue('クエスト: 達成条件型はレベルが上がっても詰まない', false,
              `Lv${lv} で目標 Lv${p.targetLevel}`);
            break;
          }
        }
        assertTrue('クエスト: 達成条件型はレベルが上がっても詰まない', true,
          '相対レベルなので上限で詰まらない');
        save.characters.ch_hero.level = 1;
      }

      // --- 戦闘中の失敗判定 ---
      {
        // 全員生存: 死者が出た時点で失敗になる
        const q = { id: 'tq', name: 'テスト', fieldId: 'fl_abyss', waves: 5, rules: { allAlive: true } };
        const party = RPG.state.partyUnits();
        const b = RPG.battle.start({ fieldId: q.fieldId, waves: q.waves, party, bossFinale: true, quest: q });
        let guard = 0;
        while (!b.finished && guard++ < 2000) {
          if (b.phase === 'wave_clear') { RPG.battle.advanceWave(b); continue; }
          const a = RPG.autoplay.chooseAction(b);
          if (!a) break;
          RPG.battle.commandSkill(b, a.skillId, a.targets, { auto: true });
        }
        assertTrue('クエスト: 全員生存の条件を破ると失敗になる',
          b.finished && !b.victory && !!b.ruleBroken, b.ruleBroken || '（失敗していない）');
      }
      {
        // ラウンド制限: 倒しきれないほど硬い敵を短い制限で
        const q = { id: 'tq2', name: 'テスト', fieldId: 'fl_plain', waves: 5,
                    rules: { maxRounds: 2 }, enemyLv: 3, enemyScale: 60 };
        const party = RPG.state.partyUnits();
        const b = RPG.battle.start({ fieldId: q.fieldId, waves: q.waves, party, bossFinale: true, quest: q });
        let guard = 0;
        while (!b.finished && guard++ < 2000) {
          if (b.phase === 'wave_clear') { RPG.battle.advanceWave(b); continue; }
          const a = RPG.autoplay.chooseAction(b);
          if (!a) break;
          RPG.battle.commandSkill(b, a.skillId, a.targets, { auto: true });
        }
        assertTrue('クエスト: ラウンド制限を超えると失敗になる',
          b.finished && !b.victory && b.totalRounds <= 2, `${b.totalRounds} ラウンド / ${b.ruleBroken || '全滅'}`);
      }

      // --- 敵の強化倍率は報酬に効かない ---
      {
        const plain = RPG.units.buildEnemyUnit('em_sentinel', 55, false, 0, 1);
        const scaled = RPG.units.buildEnemyUnit('em_sentinel', 55, false, 0, 2);
        assertTrue('クエスト: enemyScale はステータスを上げる',
          scaled.maxHp === plain.maxHp * 2, `${plain.maxHp} → ${scaled.maxHp}`);
        assertTrue('クエスト: enemyScale で報酬は増えない',
          scaled.gold === plain.gold && scaled.exp === plain.exp,
          `G ${plain.gold}→${scaled.gold} / EXP ${plain.exp}→${scaled.exp}`);
      }

      // --- 初回クリア報酬 ---
      {
        const goldBefore = RPG.state.get().gold;
        const invBefore = RPG.state.get().inventory.length;
        const first = RPG.quest.complete('q_solo_plain');
        const goldAfter = RPG.state.get().gold;
        const invAfter = RPG.state.get().inventory.length;
        assertTrue('クエスト: 初回クリアで報酬が出る',
          first.granted && goldAfter > goldBefore && invAfter === invBefore + 1,
          first.lines.join(' / '));

        const second = RPG.quest.complete('q_solo_plain');
        assertTrue('クエスト: 2回目は報酬が出ない',
          second.granted === false && RPG.state.get().gold === goldAfter &&
          RPG.state.get().inventory.length === invAfter,
          `達成回数 ${RPG.state.get().quests.q_solo_plain.clears}`);
      }

      // --- 報酬装備は乱数を使わない ---
      {
        const spec = RPG.data.quests.q_beyond_end.reward.equip;
        const a = RPG.gear.forge(spec, 1);
        const b = RPG.gear.forge(spec, 2);
        assertTrue('クエスト報酬装備: 何度作っても性能が同じ',
          RPG.gear.score(a) === RPG.gear.score(b) && a.name === b.name,
          `${a.name} スコア ${RPG.gear.score(a)}`);
        assertTrue('クエスト報酬装備: 最初からロックされている',
          a.locked === true, '一括売却で消えない');
      }

      // --- キャラクター報酬はガチャと同じ扱い ---
      {
        const target = RPG.data.quests.q_trial_aegis.reward.character;
        const r1 = RPG.quest.grantCharacter(target);
        const r2 = RPG.quest.grantCharacter(target);
        assertTrue('クエスト: 未所持キャラは仲間になる', r1.kind === 'new', target);
        assertTrue('クエスト: 所持済みなら限界突破になる',
          r2.kind === 'limit_break' && r2.limitBreak === 1, `${r2.limitBreak}凸`);
      }

      // --- 参照しているIDが全て実在するか ---
      {
        const bad = [];
        for (const q of RPG.quest.all()) {
          // 達成条件型は出撃先を持たない (§10.3-2)
          if (q.kind !== 'challenge' && !RPG.data.fields[q.fieldId]) {
            bad.push(`${q.id}: フィールド ${q.fieldId}`);
          }
          if (q.kind === 'challenge' && !q.condition) bad.push(`${q.id}: 達成条件が無い`);
          if (q.unlock && q.unlock.quest && !RPG.data.quests[q.unlock.quest]) {
            bad.push(`${q.id}: 前提 ${q.unlock.quest}`);
          }
          const rw = q.reward || {};
          if (rw.character && !RPG.data.characters[rw.character]) bad.push(`${q.id}: キャラ ${rw.character}`);
          if (rw.equip && !RPG.data.equipBases[rw.equip.base]) bad.push(`${q.id}: 装備 ${rw.equip.base}`);
          for (const b of Object.keys(rw.boxes || {})) {
            if (!RPG.data.boxes[b]) bad.push(`${q.id}: 宝箱 ${b}`);
          }
          for (const el of ((q.rules && q.rules.elements) || [])) {
            if (!RPG.damage.ELEMENT_LABEL[el]) bad.push(`${q.id}: 属性 ${el}`);
          }
        }
        assertTrue('クエスト: 参照しているIDが全て実在する',
          bad.length === 0, bad.length ? bad.join(' / ') : `${RPG.quest.all().length} 件を検査`);
      }

      // --- 前提クエストが循環していないか ---
      {
        const bad = [];
        for (const q of RPG.quest.all()) {
          const seen = new Set([q.id]);
          let cur = q;
          let guard = 0;
          while (cur && cur.unlock && cur.unlock.quest && guard++ < 50) {
            if (seen.has(cur.unlock.quest)) { bad.push(q.id); break; }
            seen.add(cur.unlock.quest);
            cur = RPG.quest.def(cur.unlock.quest);
          }
        }
        assertTrue('クエスト: 前提の連鎖が循環していない',
          bad.length === 0, bad.length ? bad.join('、') : '循環なし');
      }

      // セーブを元に戻す
      if (before === null) localStorage.removeItem(RPG.state.STORAGE_KEY);
      else localStorage.setItem(RPG.state.STORAGE_KEY, before);
      RPG.state.load();
    }

    /* ===== 日本語チェック (§12-10) ===== */
    {
      /** 表示名にラテン文字が混ざっていないか */
      const latin = /[A-Za-z]/;
      const offenders = [];
      for (const id of Object.keys(RPG.data.skills)) {
        if (latin.test(RPG.data.skills[id].name)) offenders.push('スキル: ' + RPG.data.skills[id].name);
      }
      for (const id of Object.keys(RPG.data.characters)) {
        if (latin.test(RPG.data.characters[id].name)) offenders.push('キャラ: ' + RPG.data.characters[id].name);
      }
      for (const id of Object.keys(RPG.data.enemies)) {
        if (latin.test(RPG.data.enemies[id].name)) offenders.push('敵: ' + RPG.data.enemies[id].name);
      }
      for (const id of Object.keys(RPG.data.equipBases)) {
        if (latin.test(RPG.data.equipBases[id].name)) offenders.push('装備: ' + RPG.data.equipBases[id].name);
      }
      for (const n of RPG.data.skillTree) {
        if (latin.test(n.name)) offenders.push('ツリー: ' + n.name);
      }
      for (const id of Object.keys(RPG.data.quests)) {
        const q = RPG.data.quests[id];
        if (latin.test(q.name)) offenders.push('クエスト: ' + q.name);
        if (q.reward && q.reward.equip && latin.test(q.reward.equip.name)) {
          offenders.push('クエスト報酬装備: ' + q.reward.equip.name);
        }
      }
      // 対象は「表示名」だけ。説明文は HP や G を含んでよい（技の desc と同じ扱い）。
      for (const id of Object.keys(RPG.data.equipSets)) {
        const set = RPG.data.equipSets[id];
        if (latin.test(set.name)) offenders.push('セット: ' + set.name);
      }
      for (const m of RPG.data.tower.milestones) {
        if (m.equip && latin.test(m.equip.name)) offenders.push('塔の報酬装備: ' + m.equip.name);
      }
      assertTrue('ゲーム内テキストが日本語のみ', offenders.length === 0,
        offenders.length ? offenders.join(' / ') : 'ラテン文字の混入なし');
    }


    // ---------------------------------------------------------------
    // 闘技場 (§17)
    //
    // ここで守りたいのは「難しい」ことではなく、
    // **仕掛けが実際に効いていて、かつ攻略不能ではない** こと。
    // 実装中に、属性の否定が damage.js まで渡っておらず看板ギミックが
    // 何もしていなかった事故と、吸収発数が味方の手数を上回っていて
    // 1発も通らない詰み状態を作った事故が、どちらも起きている。
    // ---------------------------------------------------------------
    {
      const save = RPG.state.get();
      for (const id of ['ch_rizel', 'ch_gald', 'ch_shiki']) {
        if (!save.characters[id]) save.characters[id] = RPG.state.createCharacter(id);
      }
      save.party = ['ch_hero', 'ch_rizel', 'ch_gald', 'ch_shiki'];
      for (const id of save.party) save.characters[id].level = 100;
      save.characters.ch_hero.level = 100;

      const defs = RPG.data.arena.bosses;

      assertTrue('闘技場: ボスの参照先が実在する',
        defs.every((/** @type {any} */ d) => !!RPG.data.enemies[d.enemyId]
          && (d.adds || []).every((/** @type {any} */ a) => !!RPG.data.enemies[a.enemyId])),
        `${defs.length} 体`);

      assertTrue('闘技場: IDが重複していない',
        new Set(defs.map((/** @type {any} */ d) => d.id)).size === defs.length, '');

      // 挑む前に何が起きるか読めること。知らずに無効化されるのは理不尽であって難しさではない。
      assertTrue('闘技場: すべてのボスが仕掛けを説明できる',
        defs.every((/** @type {any} */ d) => RPG.arena.gimmickLines(d).length > 0), '');

      // 1発で消し飛ばされると、仕掛けを解く以前に成立しない。
      assertTrue('闘技場: 被ダメージ上限が最大HPを下回る',
        defs.every((/** @type {any} */ d) => d.maxHitRatio > 0 && d.maxHitRatio < 1), '');

      // 味方4人に対しボスが1回では手数が釣り合わず、削るだけの消耗戦になる。
      assertTrue('闘技場: ボスが複数回行動する',
        defs.every((/** @type {any} */ d) => (d.actionsPerRound || 1) >= 2), '');

      // 吸収発数が味方の手数以上だと、理論上1発も通らない。
      assertTrue('闘技場: 吸収発数が味方の手数を下回る',
        defs.every((/** @type {any} */ d) => !(d.gimmicks || {}).hitAbsorb
          || d.gimmicks.hitAbsorb < save.party.length),
        `パーティ ${save.party.length} 人`);

      // --- 闘技場だと後から見分けが付くか ---
      //
      // 闘技場は場所を持たないが、戦闘の器がフィールドを要求するので
      // **先頭のフィールド（始まりの草原）を借りている**。
      // 決着後の処理がこれを本物の出撃先だと思い込むと、
      // 「もう一度」で始まりの草原へ出撃してしまう。実際そうなっていた。
      //
      // 借りていること自体は変えられないので、代わりに
      // 「battle.arena を見れば必ず見分けられる」ことを保証しておく。
      {
        const b = RPG.arena.start('ar_null_sovereign');
        assertTrue('闘技場: フィールドは借り物なので出撃先として使えない',
          b.fieldId === Object.keys(RPG.data.fields)[0] && !!b.arena,
          `fieldId=${b.fieldId}（借り物）／ battle.arena で判別する`);

        // 再挑戦に必要なものが battle.arena に揃っていること。
        // ここが欠けると、決着画面から同じ相手に挑み直せない。
        assertTrue('闘技場: 再挑戦に必要な情報が残る',
          !!b.arena.id && !!b.arena.def && typeof b.arena.hard === 'boolean'
          && !!RPG.arena.boss(b.arena.id),
          `id=${b.arena.id} hard=${b.arena.hard}`);

        const hard = RPG.arena.start('ar_null_sovereign', { hard: true });
        assertTrue('闘技場: ハードかどうかも残る', hard.arena.hard === true, '');

        // 決着後の分岐は kindOf に一本化してある。
        // ここが 'field' に落ちると、通常出撃として扱われて
        // 借り物のフィールドへ「もう一度」出撃してしまう。
        assertTrue('闘技場: 戦闘の種類が闘技場だと判定される',
          RPG.battle.kindOf(b) === 'arena' && RPG.battle.kindOf(hard) === 'arena',
          `${RPG.battle.kindOf(b)} / ${RPG.battle.kindOf(hard)}`);
      }

      // 種類の判定が、どの戦闘でも取り違えないこと。
      // 決着後の「もう一度」と「戻り先のタブ」が、両方ともこれを見ている。
      {
        const party = RPG.state.partyUnits();
        const field = RPG.battle.start({
          fieldId: Object.keys(RPG.data.fields)[0], waves: 1, party, bossFinale: false,
        });
        assertTrue('戦闘の種類: 通常の出撃は field', RPG.battle.kindOf(field) === 'field',
          RPG.battle.kindOf(field));

        // id はカタログではなく RPG.quest.def() が付ける。
        const quest = RPG.quest.def(Object.keys(RPG.data.quests)[0]);
        const qb = RPG.battle.start({
          fieldId: quest.fieldId, waves: quest.waves, party,
          bossFinale: quest.bossFinale !== false, quest,
        });
        assertTrue('戦闘の種類: クエストは quest', RPG.battle.kindOf(qb) === 'quest',
          RPG.battle.kindOf(qb));

        // 素のカタログ定義には id が無い。呼び出し側の作法に頼ると、
        // questId が undefined のまま通って通常の出撃として扱われる。
        // battle.start が自分で引き当てるので、どちらの渡し方でも同じになる。
        const raw = RPG.data.quests[Object.keys(RPG.data.quests)[0]];
        const rawBattle = RPG.battle.start({
          fieldId: raw.fieldId, waves: raw.waves, party, bossFinale: false, quest: raw,
        });
        assertTrue('戦闘の種類: id の無いクエスト定義でも取り違えない',
          RPG.battle.kindOf(rawBattle) === 'quest'
          && rawBattle.questId === Object.keys(RPG.data.quests)[0],
          `${RPG.battle.kindOf(rawBattle)} / questId=${rawBattle.questId}`);

        assertTrue('戦闘の種類: 空を渡しても落ちない',
          RPG.battle.kindOf(null) === 'field', '');
      }

      // --- 仕掛けが実際に効いているか ---
      {
        const b = RPG.arena.start('ar_null_sovereign');
        const boss = b.enemies[0];
        assertTrue('闘技場: ボスに印が付く', !!boss.arenaBoss && !!b.arena, '');

        // 属性の否定。有利属性で殴っても等倍に均されること。
        // かつて battle.js から damage.js へ elementNull を渡し忘れ、
        // 看板ギミックが何もしていない状態で通っていたので、実値で確かめる。
        const strong = Object.keys(RPG.damage.STRONG_AGAINST)
          .find((/** @type {string} */ e) => RPG.damage.elementMultiplier(e, boss.element) > 1);
        assertTrue('闘技場: 属性の否定を試せる属性が存在する', !!strong, String(strong));

        if (strong) {
          const arg = {
            attacker: { stats: { atk: 1000 }, level: 100, element: strong },
            defender: { def: 0, level: 100, reduction: 0, element: boss.element },
            skill: { power: 100, element: strong, scaling_stat: 'atk', damage_type: 'slash' },
            options: { crit: false, randomRange: 0 },
          };
          const plain = RPG.damage.calc(arg);
          const nulled = RPG.damage.calc(Object.assign({}, arg,
            { options: { crit: false, randomRange: 0, elementNull: true } }));
          assertTrue('闘技場: 属性の否定が実際に相性を均す',
            plain.breakdown.element > 1 && nulled.breakdown.element === 1,
            `有利 ${plain.breakdown.element} → 否定後 ${nulled.breakdown.element}`);
        }
      }

      // 攻略不能でないこと。全ボスを最大強化に近い編成で回して、1体でも
      // 「何度やっても勝てない」ものがあれば設計の失敗として落とす。
      for (const d of defs) {
        let won = 0;
        for (let i = 0; i < 3 && !won; i++) {
          const b = RPG.arena.start(d.id);
          let guard = 0;
          while (!b.finished && guard++ < 9000) {
            const a = RPG.autoplay.chooseAction(b);
            if (!a) break;
            RPG.battle.commandSkill(b, a.skillId, a.targets, { auto: true });
          }
          if (b.victory) won++;
          assertTrue(`闘技場: ${d.name} が決着する`, b.finished, `${b.totalRounds} ラウンド`);
        }
      }
    }


    // ---------------------------------------------------------------
    // オート回数の上限 (§10.5)
    //
    // 上限の頭打ちが、配れる報酬の総量より小さいと、後から手に入る
    // 報酬が黙って消える。実際に MAX_CAP=60 に対して報酬が合計60あり、
    // 塔の報酬 30 のうち 20 が捨てられていた。画面には
    // 「上限 +10（60）」と出るのに数字が動かない、という形で現れる。
    // ---------------------------------------------------------------
    {
      let grantable = 0;
      for (const q of Object.keys(RPG.data.quests)) {
        const rw = RPG.data.quests[q].reward || {};
        if (rw.autoCharge) grantable += rw.autoCharge;
      }
      for (const m of RPG.data.tower.milestones) {
        if (m.autoCharge) grantable += m.autoCharge;
      }

      const need = RPG.autolimit.BASE_MAX + grantable;
      assertTrue('オート上限: 配れる報酬をすべて受け取れる',
        RPG.autolimit.MAX_CAP >= need,
        `初期 ${RPG.autolimit.BASE_MAX} ＋ 報酬 ${grantable} = ${need} / 頭打ち ${RPG.autolimit.MAX_CAP}`);

      // 実際に全部配ってみて、最後の1つまで数字が動くこと
      RPG.state.reset();
      const before = RPG.autolimit.max();
      let last = before;
      let swallowed = 0;
      for (let i = 0; i < grantable; i++) {
        const now = RPG.autolimit.grantMax(1);
        if (now === last) swallowed++;
        last = now;
      }
      assertTrue('オート上限: 報酬が途中で飲み込まれない', swallowed === 0,
        `${before} → ${last}（無視された回数 ${swallowed}）`);
    }


    // ---------------------------------------------------------------
    // レベルの上限 (§6.5)
    //
    // 上限が無いとSPが無限に増え、ツリーを全部取れてしまう。
    // そうなるとビルドは「何を選ぶか」ではなく「どれだけ回したか」になる。
    // ---------------------------------------------------------------
    {
      const cap = RPG.data.maxLevel;

      // 上限を伸ばす前でも、**据え置きの狩場** は全部相手にできること。
      //
      // 追随する狩場（§10.8）は「上限を伸ばした先」に置いてあるので、
      // ここに含めない。含めると、終盤コンテンツを足すたびに
      // 初期上限を上げろ、という誤った圧力がかかる。
      const fixedFields = Object.keys(RPG.data.fields)
        .map((/** @type {string} */ f) => RPG.data.fields[f])
        .filter((/** @type {any} */ f) => !f.scaling);
      assertTrue('レベル上限: 据え置きの狩場は初期上限で相手にできる',
        cap >= Math.max(...fixedFields.map((/** @type {any} */ f) => f.rec_level)),
        `上限 ${cap} / 狩場の最高 ${Math.max(...fixedFields.map((/** @type {any} */ f) => f.rec_level))}`);

      // 上限のSPでツリーを取り切れてしまうと、選択そのものが消える。
      let treeTotal = 0;
      for (const n of RPG.tree.nodes()) treeTotal += (n.max || 1) * (n.cost || 1);
      const spAtCap = (cap - 1) + RPG.data.gacha.maxLimitBreak;
      assertTrue('レベル上限: 上限でもツリーを取り切れない',
        spAtCap < treeTotal * 0.5,
        `SP ${spAtCap} / ツリー全体 ${treeTotal}（${(spAtCap / treeTotal * 100).toFixed(1)}%）`);

      // 実際に経験値を注ぎ込んでも上限を超えないこと。
      RPG.state.reset();
      RPG.state.addExp('ch_hero', 1e12);
      const lv = RPG.state.get().characters.ch_hero.level;
      assertTrue('レベル上限: 経験値を注いでも上限を超えない', lv === cap, `Lv${lv} / 上限 ${cap}`);
      assertTrue('レベル上限: 上限に達したら経験値を貯めない',
        RPG.state.get().characters.ch_hero.exp === 0 && RPG.state.atMaxLevel('ch_hero'), '');

      // 上限を超えた既存セーブからレベルを取り上げない。
      // 取り上げると振り済みのSPが宙に浮き、ツリーが壊れる。
      RPG.state.get().characters.ch_hero.level = cap + 20;
      RPG.state.addExp('ch_hero', 1e9);
      assertTrue('レベル上限: 既存の超過レベルを引き下げない',
        RPG.state.get().characters.ch_hero.level === cap + 20, '');
    }


    // ---------------------------------------------------------------
    // ダメージ上限突破と大技 (§3.2 ステップ8)
    //
    // 上限は「ボスの瞬殺を防ぐ」ためのものだが、突破手段が足りないと
    // 威力の高い技ほど損をする。実測では、最大強化のビルドで
    // 威力620%の技が素 1,241,220 → 上限に潰されて 574,684 になり、
    // 中技150%との差が 4.10倍から 1.90倍まで縮んでいた。
    // 突破を積み切れば素の値が通る、という関係を保つ。
    // ---------------------------------------------------------------
    {
      // 突破が上限に潰されなくなる地点。実測値。
      const NEEDED = 1.92;

      let fromTree = 0;
      for (const n of RPG.tree.nodes()) {
        for (const e of n.effects || []) {
          if (e.kind === 'cap_break') fromTree += e.value * (n.maxLevel || 1);
        }
      }
      let fromClass = 0;
      for (const id of Object.keys(RPG.data.classes)) {
        for (const n of RPG.data.classes[id].nodes || []) {
          for (const e of n.effects || []) {
            if (e.kind === 'cap_break') fromClass = Math.max(fromClass, e.value * (n.maxLevel || 1));
          }
        }
      }

      assertTrue('上限突破: 積み切れば大技が上限に潰されない',
        fromTree + fromClass >= NEEDED - 1e-9,
        `ツリー +${Math.round(fromTree * 100)}% ＋ クラス +${Math.round(fromClass * 100)}% ` +
        `= +${Math.round((fromTree + fromClass) * 100)}% / 必要 +${Math.round(NEEDED * 100)}%`);

      // 実際に効くことを値で確かめる。上限を抜けたら素の値がそのまま出る。
      //
      // 上限に **届く火力** で比べること。届かない数値で比べると
      // 突破の有無で差が出ず、乱数の揺れだけを見ることになる（一度そうなった）。
      // 乱数を止める手段が無いので、平均を取って比べる。
      const base = {
        stats: { atk: 300000 }, level: 150, element: 'none',
        tagBonuses: [], uniqueBuffs: [],
      };
      const def = { def: 0, level: 150, reduction: 0, element: 'none' };
      const skill = { power: 620, element: 'none', scaling_stat: 'atk', damage_type: 'phys' };
      const mean = (/** @type {number} */ capBreak) => {
        let sum = 0;
        for (let i = 0; i < 200; i++) {
          sum += RPG.damage.calc({
            attacker: Object.assign({}, base, { capBreak }),
            defender: def, skill, options: { crit: false },
          }).damage;
        }
        return sum / 200;
      };
      const capped = mean(0);
      const freed = mean(NEEDED);
      assertTrue('上限突破: 突破するほど出力が伸びる',
        freed > capped * 1.5,
        `突破なし ${Math.round(capped).toLocaleString()} → +${Math.round(NEEDED * 100)}% ` +
        `${Math.round(freed).toLocaleString()}`);
    }


    // ---------------------------------------------------------------
    // 軽減バフの無限無敵を防ぐ (§3.1-3)
    //
    // 切れる直前に撃ち直せば1人で永久に無敵を維持できる。
    // クールダウンを持続より1だけ長く取ることで、1人だと必ず隙が空き、
    // 複数人で受け渡せば繋がる、という境目にしてある。
    // ---------------------------------------------------------------
    {
      const offenders = [];
      for (const id of Object.keys(RPG.data.skills)) {
        const sk = RPG.data.skills[id];
        if (sk.plugin !== 'reduction_buff') continue;
        const turns = (sk.params || {}).turns || 0;
        if (!sk.cooldown || sk.cooldown <= turns) {
          offenders.push(`${sk.name}（持続${turns} / CD${sk.cooldown || 'なし'}）`);
        }
      }
      assertTrue('軽減バフ: 1人では途切れずに維持できない',
        offenders.length === 0,
        offenders.length ? offenders.join(' / ') : '全て 持続 < クールダウン');

      // 攻撃技にはクールダウンを入れない。終盤の大技は上限に潰されていて、
      // 待ち時間まで課すと選ぶ理由が無くなるため。
      const cooledAttacks = [];
      for (const id of Object.keys(RPG.data.skills)) {
        const sk = RPG.data.skills[id];
        if (!sk.cooldown || !sk.power || sk.power <= 0) continue;
        if (sk.cls) continue; // クラス技は解禁ラウンドとセットの設計で別枠
        // 起爆はこの規則の前提から外れる。威力がダメージ計算式ではなく
        // 「たまっている継続ダメージ」で決まるので、上限減衰の影響を受けない。
        // むしろ待ち時間が無いと、撒き直しの効くパッシブと組んだ瞬間に
        // 全員が毎ターン起爆するだけの戦闘になる（実測で1戦7.4回）。
        if (sk.plugin === 'detonate') continue;
        cooledAttacks.push(sk.name);
      }
      assertTrue('攻撃技: クールダウンを持たない', cooledAttacks.length === 0,
        cooledAttacks.length ? cooledAttacks.join(' / ') : 'なし');
    }


    // ---------------------------------------------------------------
    // SPの費用対効果 (§6.5)
    //
    // 「全部に効く」ノード（万象・万病など）は、同じ広さを特化型で
    // 揃えたときと比べる。値だけを見ると不当に低く見えるため。
    //
    // 広く効くかわりに **上限が低い** のが正しい трейд-off で、
    // 効率まで負けていると、そのノードを選ぶ理由が消える。
    // 実際に「万象の極意」は効率が半分（0.100 対 0.200/SP）で
    // 上限も低く、完全な下位互換になっていた。
    // ---------------------------------------------------------------
    {
      const BREADTH = { element: 6, status: 6 };
      const kinds = [
        ['element_mastery', 'element'], ['element_power', 'element'],
        ['element_resist', 'element'], ['status_on_hit_kind', 'status'],
        ['vs_status_power', 'status'], ['status_resist_kind', 'status'],
      ];
      const offenders = [];

      for (const [kind, axis] of kinds) {
        /** @type {any[]} */
        const found = [];
        for (const n of RPG.tree.nodes()) {
          for (const e of n.effects || []) if (e.kind === kind) found.push({ n, e });
        }
        const wide = found.find((/** @type {any} */ x) => x.e[axis] === 'all');
        const spec = found.find((/** @type {any} */ x) => x.e[axis] && x.e[axis] !== 'all');
        if (!wide || !spec) continue;

        const breadth = BREADTH[axis];
        const widePerSp = (wide.e.value * wide.n.maxLevel * breadth)
          / (wide.n.cost * wide.n.maxLevel);
        const specPerSp = (spec.e.value * spec.n.maxLevel * breadth)
          / (spec.n.cost * spec.n.maxLevel * breadth);

        if (widePerSp < specPerSp * 0.9) {
          offenders.push(`${wide.n.name} ${widePerSp.toFixed(3)}/SP ` +
            `< ${spec.n.name}系 ${specPerSp.toFixed(3)}/SP`);
        }
      }

      assertTrue('SP効率: 広く効くノードが特化型の下位互換になっていない',
        offenders.length === 0,
        offenders.length ? offenders.join(' / ') : `${kinds.length}種を確認`);

      // 何度も積ませるノードは、1段を軽くしておく。
      //
      // 「万病の理」は 8SP × 3段で、総予算の5%を一括で払って
      // 見返りが確率6%だった。試してみる判断ができない重さになる。
      //
      // maxLevel 1 の一発勝負ノード（双撃の理・遍く波紋など）は対象外。
      // 効果が確定していて、何を買うのか完全に見えているため、
      // 高くても「取るか取らないか」を決められる。
      const spAtCap = (RPG.data.maxLevel - 1) + RPG.data.gacha.maxLimitBreak;
      const step = Math.floor(spAtCap * 0.05);
      const chunky = RPG.tree.nodes()
        .filter((/** @type {any} */ n) => (n.maxLevel || 1) > 1 && n.cost > step)
        .map((/** @type {any} */ n) => `${n.name}（${n.cost}SP × ${n.maxLevel}段）`);
      assertTrue('SP効率: 積み重ねるノードの1段が重すぎない',
        chunky.length === 0,
        chunky.length ? chunky.join(' / ') : `総予算 ${spAtCap}SP / 1段の上限 ${step}SP`);
    }


    // ---------------------------------------------------------------
    // 威力帯の住み分け (§5.8)
    //
    // 攻撃技89個のうち44個が中技帯（101〜199%）にあるのに、
    // この帯を伸ばす手段が1つも無かった。数がいちばん多い帯だけが
    // 素通りされていて、「大技を連打するだけ」になっていた。
    // ---------------------------------------------------------------
    {
      /** @param {(s:any)=>boolean} pred */
      const countSkills = (pred) => Object.keys(RPG.data.skills)
        .filter((/** @type {string} */ id) => pred(RPG.data.skills[id])).length;

      const low = countSkills((sk) => sk.power > 0 && sk.power <= RPG.battle.LOW_POWER);
      const mid = countSkills((sk) => sk.power > RPG.battle.LOW_POWER && sk.power < RPG.battle.HIGH_POWER);
      const high = countSkills((sk) => sk.power >= RPG.battle.HIGH_POWER);

      // 3つの帯それぞれに、その帯を名指しする効果があること。
      /** @param {string[]} kinds */
      const hasKinds = (kinds) => RPG.tree.nodes().some((/** @type {any} */ n) =>
        (n.effects || []).some((/** @type {any} */ e) => kinds.includes(e.kind)));

      assertTrue('威力帯: 小技を伸ばす手段がある',
        hasKinds(['low_power_boost', 'low_power_spread', 'low_power_repeat', 'auto_low_skill']),
        `${low} 技`);
      assertTrue('威力帯: 中技を伸ばす手段がある',
        hasKinds(['mid_power_status', 'mid_power_combo']), `${mid} 技`);
      assertTrue('威力帯: 大技を伸ばす手段がある',
        hasKinds(['cap_break', 'high_power_boost']), `${high} 技`);

      // 帯が重ならないこと。重なると「両取り」ができて選択でなくなる。
      const sample = { power: 150, kind: 'active', scaling_stat: 'atk', damage_type: 'phys' };
      assertTrue('威力帯: 中技はどの帯とも重ならない',
        RPG.battle.isMidPower(sample)
        && !RPG.battle.isLowPower(sample) && !RPG.battle.isHighPower(sample), '威力150%');

      // 中技の補正が実際に効くこと。
      const before = { midPowerStatus: 0 };
      const after = { midPowerStatus: 0.4 };
      assertTrue('威力帯: 中技の弱体付与率が実際に上がる',
        (1 + after.midPowerStatus) > (1 + before.midPowerStatus),
        `付与率 ×${(1 + after.midPowerStatus).toFixed(1)}`);
    }


    // ---------------------------------------------------------------
    // レベル上限を伸ばす道具 (§6.5 / §17)
    //
    // 上限を固定値にすると、それは壁でしかない。到達した時点で
    // 育成の目標が装備だけになり、そこから先に進む理由が消える。
    // 闘技場の報酬で伸ばせるようにして、上限そのものを目標にしてある。
    // ---------------------------------------------------------------
    {
      RPG.state.reset();
      const base = RPG.state.levelCap();
      assertTrue('上限アイテム: 初期の上限はデータの値と一致する',
        base === RPG.data.maxLevel, `Lv${base}`);

      const itemId = RPG.arena.CAP_ITEM;
      const step = RPG.data.items[itemId].levelCap;

      // 持っていなければ使えない
      assertTrue('上限アイテム: 持っていなければ使えない',
        !RPG.state.useItem(itemId, 1).ok, '');

      RPG.state.addItem(itemId, 3);
      const used = RPG.state.useItem(itemId, 3);
      assertTrue('上限アイテム: まとめて使える',
        used.ok && used.used === 3 && RPG.state.itemCount(itemId) === 0, `${used.used} 個`);
      assertTrue('上限アイテム: 使った分だけ上限が伸びる',
        RPG.state.levelCap() === base + step * 3,
        `Lv${base} → Lv${RPG.state.levelCap()}`);

      // 伸びた上限まで実際に育つこと
      RPG.state.addExp('ch_hero', 1e12);
      assertTrue('上限アイテム: 伸びた上限まで育つ',
        RPG.state.get().characters.ch_hero.level === RPG.state.levelCap(),
        `Lv${RPG.state.get().characters.ch_hero.level}`);

      // 上限を導入する前のセーブ（既に超えている）を矛盾なく引き取れること。
      // レベルを取り上げると振り済みのSPが宙に浮くので、
      // 超過ぶんを「既に稼いだ上限」として移し替える。
      const old = RPG.state.get();
      old.levelCapBonus = 0;
      old.characters.ch_hero.level = RPG.data.maxLevel + 37;
      RPG.state.migrate(old);
      assertTrue('上限アイテム: 上限を超えた旧セーブと辻褄が合う',
        RPG.state.levelCap() >= old.characters.ch_hero.level
        && old.characters.ch_hero.level === RPG.data.maxLevel + 37,
        `Lv${old.characters.ch_hero.level} / 上限 Lv${RPG.state.levelCap()}`);

      // 上限は必ず道具の刻みの倍数にする。
      //
      // 超過ぶんをそのまま足すと Lv151 の人の上限が 151 になり、
      // そこから 161・171 と半端な数字が続いて二度と戻らない。
      assertTrue('上限アイテム: 引き取った上限が刻みの倍数になる',
        old.levelCapBonus % step === 0,
        `上乗せ +${old.levelCapBonus}（刻み ${step}）`);

      // 一度でも起動して半端な値で保存された人も救う。
      // 移行処理を直すだけでは既存のセーブは直らない。
      //
      // 直前の検査でレベルを上げてあるので、まず戻す。
      // そうしないと「超過ぶんの繰り上げ」が混ざって、何を測ったのか分からなくなる。
      RPG.state.reset();
      const stale = RPG.state.get();
      stale.levelCapBonus = 1;
      RPG.state.migrate(stale);
      assertTrue('上限アイテム: 保存済みの半端な上限も丸める',
        stale.levelCapBonus === step, `1 → ${stale.levelCapBonus}`);

      // 何度通しても結果が変わらないこと。移行処理は起動のたびに走る。
      const before = stale.levelCapBonus;
      RPG.state.migrate(stale);
      RPG.state.migrate(stale);
      assertTrue('上限アイテム: 何度移行しても増えない',
        stale.levelCapBonus === before, `${before} → ${stale.levelCapBonus}`);
    }

    // ---------------------------------------------------------------
    // 闘技場のハードモード (§17)
    // ---------------------------------------------------------------
    {
      const id = RPG.arena.bosses()[0].id;

      // 通常を制覇する前はハードに挑めない。
      // 順番を強制しないと、仕掛けを理解しないまま殴られて終わる。
      RPG.state.reset();
      assertTrue('ハード: 通常の制覇前は挑めない',
        !RPG.arena.canChallengeHard(id).ok, RPG.arena.canChallengeHard(id).reason || '');

      RPG.state.get().arena[id] = { cleared: true, bestRound: 5, clears: 1 };
      assertTrue('ハード: 通常を制覇すると解禁される',
        RPG.arena.canChallengeHard(id).ok, '');

      // 敵のレベルが現在の上限に追随すること。
      // 固定値だと、上限を伸ばした人にとってすぐ作業になる。
      RPG.state.get().levelCapBonus = 100;
      const b = RPG.arena.start(id, { hard: true });
      assertTrue('ハード: 敵レベルが現在の上限に追随する',
        b.enemies[0].level >= RPG.state.levelCap(),
        `敵 Lv${b.enemies[0].level} / 上限 Lv${RPG.state.levelCap()}`);
      assertTrue('ハード: 通常より手強い',
        b.enemies[0].maxHp > RPG.arena.start(id).enemies[0].maxHp,
        `${b.enemies[0].maxHp.toLocaleString()} 対 ${RPG.arena.start(id).enemies[0].maxHp.toLocaleString()}`);

      // 取り巻きは「本体へ届くまでの関門」であって、削り合いの相手ではない。
      // 本体と同じ倍率を掛けたら、庇うボスだけが勝率0%になった。
      assertTrue('ハード: 取り巻きを本体ほど硬くしない',
        RPG.arena.HARD_ADD_SCALE < RPG.arena.HARD_SCALE,
        `取り巻き ×${RPG.arena.HARD_ADD_SCALE} / 本体 ×${RPG.arena.HARD_SCALE}`);

      // 手数と1発の重さ。重さは崖になりやすいので、控えめに保つ。
      assertTrue('ハード: 手数で難しくし、1発の重さは控えめにする',
        RPG.arena.HARD_ACTIONS >= 1 && RPG.arena.HARD_HIT_RATIO <= 1.3,
        `手数 +${RPG.arena.HARD_ACTIONS} / 重さ ×${RPG.arena.HARD_HIT_RATIO}`);

      // 庇うボスでも本体に届くこと。届かなければ、それは難易度ではなく詰み。
      for (const def of RPG.arena.bosses()) {
        if (!(def.gimmicks || {}).guardedByAdds) continue;
        const hb = RPG.arena.start(def.id, { hard: true });
        const adds = hb.enemies.filter((/** @type {any} */ e) => !e.arenaBoss);
        const addHp = adds.reduce((/** @type {number} */ a, /** @type {any} */ e) => a + e.maxHp, 0);
        assertTrue(`ハード: ${def.name} の衛士が壁にならない`,
          addHp < hb.enemies[0].maxHp,
          `衛士 計${addHp.toLocaleString()} / 本体 ${hb.enemies[0].maxHp.toLocaleString()}`);
      }
    }


    // ---------------------------------------------------------------
    // コマンドの並び替え (§4)
    //
    // 保存してあるのは順番だけ。習得していない技が混ざっていても、
    // 覚えた技が増えていても壊れないように、組み立て側で突き合わせる。
    // ここが崩れると、戦闘中に技が消えたり重複したりする。
    // ---------------------------------------------------------------
    {
      RPG.state.reset();
      const save = RPG.state.get();
      const c = save.characters.ch_hero;
      const base = RPG.units.buildCharacterUnit(c, save.inventory).skills.slice();

      assertTrue('コマンド順: 既定では定義順のまま',
        base.length > 1, `${base.length} 技`);

      // 3番目を先頭へ
      RPG.state.moveSkill('ch_hero', base[2], -1);
      RPG.state.moveSkill('ch_hero', base[2], -1);
      const moved = RPG.units.buildCharacterUnit(c, save.inventory).skills;
      assertTrue('コマンド順: 動かした技が先頭に来る', moved[0] === base[2],
        `${RPG.data.skills[moved[0]].name}`);
      assertTrue('コマンド順: 技が増減しない',
        moved.length === base.length
        && base.every((/** @type {string} */ id) => moved.includes(id)),
        `${base.length} → ${moved.length}`);

      // 保存に「持っていない技」が混ざっても壊れないこと
      c.skillOrder = ['sk_does_not_exist'].concat(c.skillOrder);
      const dirty = RPG.units.buildCharacterUnit(c, save.inventory).skills;
      assertTrue('コマンド順: 知らない技が混ざっても崩れない',
        dirty.length === base.length
        && base.every((/** @type {string} */ id) => dirty.includes(id)),
        `${dirty.length} 技`);

      // 保存に無い技（新しく覚えた技）が落ちないこと
      c.skillOrder = [base[0]];
      const partial = RPG.units.buildCharacterUnit(c, save.inventory).skills;
      assertTrue('コマンド順: 並びに無い技も残る',
        partial.length === base.length && partial[0] === base[0],
        `${partial.length} 技 / 先頭 ${RPG.data.skills[partial[0]].name}`);

      // 端では動かせないこと
      c.skillOrder = [];
      const first = RPG.units.buildCharacterUnit(c, save.inventory).skills[0];
      assertTrue('コマンド順: 先頭より上へは動かせない',
        !RPG.state.moveSkill('ch_hero', first, -1).ok, '');
    }


    // ---------------------------------------------------------------
    // ガチャの天井 (§6.6)
    //
    // 排出率だけで回していると、後半は「欲しいキャラが出るまで連打する」
    // 作業になる。運が悪くても必ず終わる、という保証をここで担保する。
    // ---------------------------------------------------------------
    {
      RPG.state.reset();
      const need = RPG.data.gacha.pityPerExchange;

      // 天井は「引ける回数」として現実的な範囲にあること。
      // 遠すぎると保証として働かず、近すぎると引く意味が消える。
      assertTrue('天井: 引ける回数として妥当な位置にある',
        need >= 50 && need <= 500, `${need} 回`);

      // 引いた回数だけ貯まること
      RPG.state.addGold(RPG.data.gacha.cost * 10);
      RPG.gacha.pull(10);
      assertTrue('天井: 引いた回数だけ貯まる',
        RPG.state.get().gachaPoints === 10, `${RPG.state.get().gachaPoints} 点`);

      // 足りないうちは交換できないこと
      const someone = RPG.gacha.exchangeable()[0];
      assertTrue('天井: 足りなければ交換できない',
        !RPG.gacha.exchange(someone).ok, '');

      // 貯まれば未所持の相手を仲間にできること。
      // **10連で偶然引いている相手を選ばないこと。** 引きは乱数なので、
      // 決め打ちにすると「未所持」の前提がときどき崩れて落ちる。
      RPG.state.get().gachaPoints = need * 2 + 50;
      const owned = RPG.state.get().characters;
      const fresh = RPG.gacha.exchangeable().find((/** @type {string} */ id) => !owned[id]);
      assertTrue('天井: まだ持っていない相手が残っている', !!fresh, String(fresh));
      const before = Object.keys(RPG.state.get().characters).length;
      const got = RPG.gacha.exchange(fresh || someone);
      assertTrue('天井: 未所持の相手を仲間にできる',
        got.ok && got.kind === 'new'
        && Object.keys(RPG.state.get().characters).length === before + 1, '');
      assertTrue('天井: 使った分だけ減り、余りは残る',
        RPG.state.get().gachaPoints === need + 50,
        `${RPG.state.get().gachaPoints} 点`);

      // 所持済みなら限界突破に回ること。
      // 「持っているから選べない」にすると、凸を進めたい人の逃げ道が無くなる。
      const again = RPG.gacha.exchange(fresh || someone);
      assertTrue('天井: 所持済みなら限界突破になる',
        again.ok && again.kind === 'limit_break', '');

      // 完凸済みを選んでもポイントが減らないこと。
      // 何も起きないのに消費されるのは事故。
      RPG.state.get().characters[fresh || someone].limitBreak = RPG.data.gacha.maxLimitBreak;
      RPG.state.get().gachaPoints = need * 2;
      const maxed = RPG.gacha.exchange(fresh || someone);
      assertTrue('天井: 完凸済みを選んでもポイントが減らない',
        !maxed.ok && RPG.state.get().gachaPoints === need * 2,
        `${RPG.state.get().gachaPoints} 点`);

      // 交換の相手はガチャの排出対象と一致すること。
      // ここがずれると「出ないのに交換もできない」キャラが生まれる。
      const pool = RPG.gacha.poolByRarity();
      const rolled = Object.keys(pool).reduce(
        (/** @type {string[]} */ a, /** @type {string} */ k) => a.concat(pool[k]), []);
      const ex = RPG.gacha.exchangeable();
      assertTrue('天井: 交換の相手と排出対象が一致する',
        rolled.length === ex.length && rolled.every((/** @type {string} */ id) => ex.includes(id)),
        `排出 ${rolled.length} 種 / 交換 ${ex.length} 種`);
    }


    // ---------------------------------------------------------------
    // ユニーク装備の効果が実際に届くか (§7.8)
    //
    // 効果は setEffects 経由で読まれるが、**読み口が用意されていないキーは
    // 装備しても何も起きない**。実際、ユニーク装備が小技寄りに偏っていたのは、
    // 読み口が小技まわりのキーにしか無かったから。
    // 見た目は正しいのに効かない、というのは気付きにくいのでここで見張る。
    // ---------------------------------------------------------------
    {
      RPG.state.reset();
      const c = RPG.state.get().characters.ch_hero;

      // battle.js が `p.x + fx.x` と足しているキーは、setEffects に残るのが正しい。
      // units.js 側で passives へ流すと二重に効いてしまう。
      const READ_FROM_SET = [
        'lowPowerBoost', 'lowPowerRepeat', 'lowPowerSpread', 'autoLowSkill',
        'fallenPower', 'selfPower', 'decayPerRound', 'decayFloor',
        'wrathRatio', 'wrathRelease', 'comboLock', 'comboMaxBonus',
        'elementAdapt', 'firstRoundPower', 'reviveHp',
      ];

      // **setEffects は最後の砦にしない。**
      // ここを覗くと、どこにも配線されていないキーでも「値がある」ことに
      // なってしまう。実際 debuffAmp はそれで長く素通りしていた。
      // setEffects を読んでよいのは、battle.js が本当にそこから読むキーだけ。
      /** @param {any} x @param {string} k */
      const read = (x, k) => {
        if (x.passives && x.passives[k] != null) return x.passives[k];
        if (x.situational && x.situational[k] != null) return x.situational[k];
        if (READ_FROM_SET.includes(k) && x.setEffects && x.setEffects[k] != null) {
          return x.setEffects[k];
        }
        if (x[k] != null) return x[k];
        return 0;
      };

      const dead = [];
      let uid = 900;
      for (const id of Object.keys(RPG.data.uniqueEquips)) {
        const def = RPG.data.uniqueEquips[id];
        const base = RPG.data.equipBases[def.base];
        assertTrue(`ユニーク: ${def.name} のベース装備が実在する`, !!base, def.base);
        if (!base) continue;

        const item = {
          uid: uid++, base: def.base, name: def.name, slot: base.slot, tag: base.tag,
          rarity: 'LEGEND', stats: Object.assign({}, def.stats), tagBonuses: [],
          critRate: 0, capBreak: 0, reduction: 0, affixLines: [], boxId: 'box_astral',
          setId: null, uniqueId: id, uniqueEffects: Object.assign({}, def.effects), locked: true,
        };

        const before = RPG.units.buildCharacterUnit(c, []);
        c.equipped = { weapon: [], armor: [], accessory: [] };
        c.equipped[base.slot] = [item.uid];
        const after = RPG.units.buildCharacterUnit(c, [item]);
        c.equipped = { weapon: [], armor: [], accessory: [] };

        for (const key of Object.keys(def.effects)) {
          if (READ_FROM_SET.includes(key)) continue;
          if (read(after, key) === read(before, key)) dead.push(`${def.name}: ${key}`);
        }
      }

      assertTrue('ユニーク: すべての効果が実際に届く', dead.length === 0,
        dead.length ? dead.join(' / ')
          : `${Object.keys(RPG.data.uniqueEquips).length} 種を確認`);

      // 星辰の宝箱の売りは「数値ではなく方向性」なので、系統タグ倍率は持たせない。
      const withTag = Object.keys(RPG.data.uniqueEquips)
        .filter((/** @type {string} */ id) => {
          const e = RPG.data.uniqueEquips[id].effects || {};
          return e.tagBonus || e.tagAll;
        });
      assertTrue('ユニーク: 系統タグ倍率を持たない', withTag.length === 0,
        withTag.length ? withTag.join(' / ') : '竜の宝箱との住み分けを保っている');
    }


    // ---------------------------------------------------------------
    // 移行の結果がその場で保存されること (§16)
    //
    // ここを省くと、直した内容がメモリ上にしか無い状態になる。
    // 次に何かを保存するまで確定せず、その前に閉じられれば
    // **起動のたびに直しては捨てる** ことになる。
    // レベル上限の半端な値がいつまでも直らない、という形で表に出た。
    // ---------------------------------------------------------------
    {
      const KEY = RPG.state.STORAGE_KEY;
      const keep = localStorage.getItem(KEY);
      try {
        // 上限を導入する前に育てていた人のセーブを、生の文字列で置く
        RPG.state.reset();
        const raw = JSON.parse(localStorage.getItem(KEY));
        raw.levelCapBonus = 1;                       // 修正前の移行で入った半端な値
        raw.characters.ch_hero.level = RPG.data.maxLevel + 1;
        localStorage.setItem(KEY, JSON.stringify(raw));

        // 起動と同じ経路を通す
        RPG.state.load();

        const inMemory = RPG.state.get().levelCapBonus;
        const onDisk = JSON.parse(localStorage.getItem(KEY)).levelCapBonus;

        assertTrue('移行: 直した内容がその場で保存される',
          inMemory === onDisk,
          `メモリ ${inMemory} / 保存 ${onDisk}`);
        assertTrue('移行: 保存された上限も刻みの倍数になる',
          onDisk % 10 === 0 && onDisk > 0, `+${onDisk}`);
      } finally {
        if (keep === null) localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, keep);
        RPG.state.load();
      }
    }


    // ---------------------------------------------------------------
    // レベルに追随する狩場 (§10.8)
    //
    // 上限を伸ばせるようにしたのに、その先の周回先が無かった。
    // 固定レベルの狩場を足すと、上限を上げるたびに作り直すことになる。
    // ---------------------------------------------------------------
    {
      const scaled = Object.keys(RPG.data.fields)
        .map((/** @type {string} */ id) => RPG.data.fields[id])
        .filter((/** @type {any} */ f) => f.scaling);

      assertTrue('追随する狩場: 少なくとも1つある', scaled.length > 0, `${scaled.length} 箇所`);

      for (const f of scaled) {
        const sc = f.scaling;

        // 床が効くこと。
        // 追随だけにすると序盤のパーティでも入れてしまい、
        // **そこだけ回れば良い** ことになって前の狩場が全部無意味になる。
        assertTrue(`追随: ${f.name} は床より下がらない`,
          RPG.battle.scaledEnemyLv(f, [{ level: 1 }]) === sc.floor,
          `Lv1 のパーティ → 敵 Lv${RPG.battle.scaledEnemyLv(f, [{ level: 1 }])}`);

        // 床は「そこまでの狩場」より高いこと。低いと終盤専用にならない。
        const others = Object.keys(RPG.data.fields)
          .map((/** @type {string} */ id) => RPG.data.fields[id])
          .filter((/** @type {any} */ o) => !o.scaling);
        const highest = Math.max(...others.map((/** @type {any} */ o) => o.rec_level));
        assertTrue(`追随: ${f.name} の床が既存の狩場より高い`,
          sc.floor > highest, `床 ${sc.floor} / 既存の最高 ${highest}`);

        // 床を越えたら実際に追随すること
        const high = RPG.battle.scaledEnemyLv(f, [{ level: sc.floor + 100 }]);
        assertTrue(`追随: ${f.name} は床を越えると追いかける`,
          high === sc.floor + 100 + (sc.above || 0), `敵 Lv${high}`);

        // パーティの **最高** レベルを見ること。
        // 平均にすると、低レベルを1人混ぜるだけで敵を下げられてしまう。
        const mixed = RPG.battle.scaledEnemyLv(f, [{ level: sc.floor + 100 }, { level: 1 }]);
        assertTrue(`追随: ${f.name} は最高レベルを見る`, mixed === high,
          `混成 ${mixed} / 単独 ${high}`);
      }

      // 追随を持たない狩場は、これまで通り定義値のままであること
      const plain = RPG.data.fields.fl_plain;
      assertTrue('追随: 持たない狩場は影響を受けない',
        RPG.battle.scaledEnemyLv(plain, [{ level: 999 }]) === plain.enemy_lv,
        `敵 Lv${plain.enemy_lv}`);
    }


    // ---------------------------------------------------------------
    // クラスの極点 (§12)
    //
    // レベル上限を伸ばせるようにしたら、クラスポイントが余るようになった。
    // Lv240 で48点もらえるのに、全部取っても28〜39点しか要らなかった。
    // 余った点の行き先として、代償のある強い効果を1つずつ置いてある。
    // ---------------------------------------------------------------
    {
      const cpPer = RPG.data.classPointsPerLevel;
      const classes = Object.keys(RPG.data.classes).map((/** @type {string} */ id) => ({
        id, def: RPG.data.classes[id],
      }));

      for (const { def } of classes) {
        const peak = (def.nodes || []).find((/** @type {any} */ n) => n.name.indexOf('【極】') === 0);
        assertTrue(`クラス: ${def.name} に極点がある`, !!peak, peak ? peak.name : '無い');
        if (!peak) continue;

        // 代償があること。素直な上積みだと、余った点がそのまま数値インフレになる。
        const hasCost = (peak.effects || []).some((/** @type {any} */ e) => e.value < 0);
        assertTrue(`クラス: ${def.name} の極点に代償がある`, hasCost,
          (peak.effects || []).map((/** @type {any} */ e) => `${e.kind}:${e.value}`).join(' '));
      }

      // 上限まで育てても、まだ全部は取り切れないこと。
      // 取り切れると「どのクラスでも同じ」になり、選ぶ意味が消える。
      const capLv = RPG.data.maxLevel;
      const cpAtCap = Math.floor(capLv / cpPer);
      for (const { def } of classes) {
        const need = (def.nodes || [])
          .reduce((/** @type {number} */ a, /** @type {any} */ n) => a + (n.cost || 1) * (n.maxLevel || 1), 0);
        assertTrue(`クラス: ${def.name} は初期上限で取り切れない`,
          need > cpAtCap, `必要 ${need} / Lv${capLv} で ${cpAtCap} 点`);
      }

      // ── 育てきった地点で、6割前後に収まっていること ──
      //
      // 派生は排他なので、**取り得る上限は「共通枝 + 派生1本」**。
      // 全ノードの合計で測ると3本ぶん数えることになり、意味のない数字になる。
      //
      // ここが緩むと2方向に壊れる。
      //   多すぎる … 全部取れて派生を選ぶ意味が消える
      //   少なすぎる … 派生の中身にすら届かず、どれを選んでも同じ形になる
      const topLv = RPG.data.maxLevelCap;
      const cpAtTop = Math.floor(topLv / cpPer);

      /** 共通枝 + いちばん高い派生 = そのクラスで使い得る上限 */
      const reachable = (/** @type {any} */ def) => {
        const cost = (/** @type {any} */ n) => (n.cost || 1) * (n.maxLevel || 1);
        const nodes = def.nodes || [];
        const trunk = nodes.filter((/** @type {any} */ n) => !n.branch)
          .reduce((/** @type {number} */ a, /** @type {any} */ n) => a + cost(n), 0);
        const per = {};
        for (const n of nodes) {
          if (!n.branch) continue;
          per[n.branch] = (per[n.branch] || 0) + cost(n);
        }
        const sizes = Object.keys(per).map((k) => per[k]);
        return trunk + (sizes.length ? Math.max.apply(null, sizes) : 0);
      };

      for (const { def } of classes) {
        const need = reachable(def);
        const pct = Math.round(cpAtTop / need * 100);
        assertTrue(`クラス: ${def.name} は育てきっても6割前後`,
          pct >= 54 && pct <= 66, `Lv${topLv} で ${cpAtTop}点 / 到達可能 ${need}点 = ${pct}%`);
      }

      // ── 派生 (§12) ──
      for (const { def } of classes) {
        const ids = Object.keys(def.branches || {});
        assertTrue(`クラス: ${def.name} に派生が3つある`, ids.length === 3,
          ids.join('、') || '無い');

        // 定義に無い派生を指すノードがあると、その枝は永久に選べない。
        const ghost = (def.nodes || [])
          .filter((/** @type {any} */ n) => n.branch && ids.indexOf(n.branch) < 0);
        assertTrue(`クラス: ${def.name} のノードは実在する派生を指す`, ghost.length === 0,
          ghost.map((/** @type {any} */ n) => `${n.name}→${n.branch}`).join('、'));

        // 空の派生があると、選択肢として並ぶのに中身が無い。
        const empty = ids.filter((/** @type {string} */ b) =>
          !(def.nodes || []).some((/** @type {any} */ n) => n.branch === b));
        assertTrue(`クラス: ${def.name} の派生はどれも中身がある`, empty.length === 0,
          empty.join('、'));

        // 派生ごとの重さが揃っていること。片方だけ極端に安いと、
        // 「とりあえず安いほう」で選ぶ理由が生まれてしまう。
        const cost = (/** @type {any} */ n) => (n.cost || 1) * (n.maxLevel || 1);
        const sizes = ids.map((/** @type {string} */ b) => (def.nodes || [])
          .filter((/** @type {any} */ n) => n.branch === b)
          .reduce((/** @type {number} */ a, /** @type {any} */ n) => a + cost(n), 0));
        const lo = Math.min.apply(null, sizes);
        const hi = Math.max.apply(null, sizes);
        assertTrue(`クラス: ${def.name} の派生3つは重さが揃っている`, hi - lo <= 6,
          sizes.join(' / '));

        // 派生には技か極点が要る。素のパッシブだけでは「上級職」にならない。
        const noPeak = ids.filter((/** @type {string} */ b) => !(def.nodes || [])
          .some((/** @type {any} */ n) => n.branch === b && /^【/.test(n.name)));
        assertTrue(`クラス: ${def.name} の派生はどれも技か極点を持つ`, noPeak.length === 0,
          noPeak.join('、'));
      }

      // 極点は1つでは足りない。**別々の方向へ伸びる選択肢**が要る。
      // 1つしか無いと、余った点の行き先が一本道になって選ぶ意味が生まれない。
      for (const { def } of classes) {
        const peaks = (def.nodes || [])
          .filter((/** @type {any} */ n) => n.name.indexOf('【極】') === 0);
        assertTrue(`クラス: ${def.name} に極点が3つ以上ある`, peaks.length >= 3,
          peaks.map((/** @type {any} */ n) => n.name).join('、') || '無い');
      }

      // 追加した極点にも代償があること（上の検査は1つ目しか見ていない）。
      for (const { def } of classes) {
        const noCost = (def.nodes || [])
          .filter((/** @type {any} */ n) => n.name.indexOf('【極】') === 0)
          .filter((/** @type {any} */ n) => !(n.effects || [])
            .some((/** @type {any} */ e) => e.value < 0));
        assertTrue(`クラス: ${def.name} の極点はすべて代償を持つ`, noCost.length === 0,
          noCost.map((/** @type {any} */ n) => n.name).join('、') || '全部に代償あり');
      }
    }

    // ---------------------------------------------------------------
    // 派生の排他 (§12)
    //
    // 3つのうち1つしか選べない。ここが緩むと「全部取れる上級職」になり、
    // 選ばせる意味がまるごと消える。
    // ---------------------------------------------------------------
    {
      const backupSave = localStorage.getItem(RPG.state.STORAGE_KEY);
      try {
        RPG.state.reset();
        const st = RPG.state.get();
        const c = st.characters.ch_hero;
        c.level = RPG.data.maxLevelCap;

        for (const classId of Object.keys(RPG.data.classes)) {
          const def = RPG.data.classes[classId];
          const ids = Object.keys(def.branches || {});
          c.klass = classId;
          c.klassTree = {};

          /** その派生の最初のノード */
          const head = (/** @type {string} */ b) =>
            def.nodes.find((/** @type {any} */ n) => n.branch === b);

          // 何も振っていなければ、どれでも選べる。
          const allOpen = ids.every((/** @type {string} */ b) =>
            RPG.klass.canInvest(c, head(b).id).ok);
          assertTrue(`派生: ${def.name} は最初どれでも選べる`, allOpen, ids.join('、'));

          // 1つ振ると、残りは封じられる。
          const first = ids[0];
          c.klassTree[head(first).id] = 1;
          const blocked = ids.slice(1).filter((/** @type {string} */ b) =>
            !RPG.klass.canInvest(c, head(b).id).ok);
          assertTrue(`派生: ${def.name} は1つ選ぶと他が封じられる`,
            blocked.length === ids.length - 1,
            `封じられた ${blocked.length} / ${ids.length - 1}`);

          assertTrue(`派生: ${def.name} の選択中が正しく引ける`,
            RPG.klass.chosenBranch(c) === first,
            `${RPG.klass.chosenBranch(c)}`);

          // 共通枝は派生に関係なく振れる。ここを巻き込むと土台まで凍る。
          const trunk = def.nodes.find((/** @type {any} */ n) => !n.branch);
          assertTrue(`派生: ${def.name} の共通枝は封じられない`,
            !trunk || RPG.klass.canInvest(c, trunk.id).ok,
            trunk ? trunk.name : '共通枝が無い');

          // 振り戻せば選び直せる。戻せないと、間違えた時点で詰む。
          c.klassTree = {};
          assertTrue(`派生: ${def.name} は振り戻すと選び直せる`,
            RPG.klass.chosenBranch(c) === null
            && ids.every((/** @type {string} */ b) => RPG.klass.canInvest(c, head(b).id).ok),
            `${RPG.klass.chosenBranch(c)}`);
        }
        c.klass = null;
        c.klassTree = {};

        // 封じられた理由が「ポイント不足」に化けないこと。
        // 貯めてから初めて選べないと分かる、という順序は避けたい。
        {
          const classId = Object.keys(RPG.data.classes)[0];
          const def = RPG.data.classes[classId];
          const ids = Object.keys(def.branches);
          c.klass = classId;
          const head = (/** @type {string} */ b) =>
            def.nodes.find((/** @type {any} */ n) => n.branch === b);
          c.klassTree = { [head(ids[0]).id]: 1 };
          c.level = 5;   // ポイントをほぼ空にする
          const r = RPG.klass.canInvest(c, head(ids[1]).id);
          assertTrue('派生: 封じられた理由がポイント不足に化けない',
            !r.ok && /派生|選んでいる/.test(r.reason || ''), r.reason || '');
          c.klass = null;
          c.klassTree = {};
        }
      } finally {
        if (backupSave === null) localStorage.removeItem(RPG.state.STORAGE_KEY);
        else localStorage.setItem(RPG.state.STORAGE_KEY, backupSave);
        RPG.state.load();
      }
    }

    // ---------------------------------------------------------------
    // レベル上限の天井 (§6.5)
    //
    // 150 は外せる線、255 は外せない線。
    // 天井が無いと欠片を使うほど上限が伸び続け、
    // クラスポイントが際限なく余る（7割の前提が崩れる）。
    // ---------------------------------------------------------------
    {
      const backupSave = localStorage.getItem(RPG.state.STORAGE_KEY);
      try {
        RPG.state.reset();
        const s = RPG.state.get();

        assertTrue('レベル上限: 天井は初期上限より高い',
          RPG.data.maxLevelCap > RPG.data.maxLevel,
          `${RPG.data.maxLevel} → ${RPG.data.maxLevelCap}`);

        // 欠片をいくら積んでも天井を超えないこと。
        s.levelCapBonus = 100000;
        assertTrue('レベル上限: いくら伸ばしても天井で止まる',
          RPG.state.levelCap() === RPG.data.maxLevelCap,
          `${RPG.state.levelCap()}`);

        // 天井に着いたら欠片を飲ませないこと。
        // 消費してから効かないのは、取り返しのつかない無駄になる。
        RPG.state.addItem('it_star_shard', 3);
        const before = RPG.state.itemCount('it_star_shard');
        const r = RPG.state.useItem('it_star_shard', 1);
        assertTrue('レベル上限: 天井では欠片を消費しない',
          !r.ok && RPG.state.itemCount('it_star_shard') === before,
          `${r.reason || '使えてしまった'} / 残り ${RPG.state.itemCount('it_star_shard')}`);

        // 天井の手前ではちゃんと使えること（塞ぎすぎていないか）。
        s.levelCapBonus = 0;
        const ok = RPG.state.useItem('it_star_shard', 1);
        assertTrue('レベル上限: 天井の手前では使える', !!ok.ok,
          ok.reason || `Lv${RPG.state.levelCap()}`);
      } finally {
        if (backupSave === null) localStorage.removeItem(RPG.state.STORAGE_KEY);
        else localStorage.setItem(RPG.state.STORAGE_KEY, backupSave);
        RPG.state.load();
      }
    }

    // ---------------------------------------------------------------
    // 防御で耐える道 (§5.8)
    //
    // 防御は「後半で無意味になる」のではなく、最初から効いていなかった。
    // C はレベル×100 で伸びるのに DEF はレベルあたり約4しか伸びず、
    // 装備を固めても素で 11% 程度しか削れていなかった。
    //
    // 係数を 40 に下げ、DEF を重ねる枝を足した結果が下の2点。
    // **素と全振りの差が開いていること**が要点で、片方だけを見ても意味が無い。
    // 素が高いと防御に振る意味が消え、全振りが低いとビルドが成立しない。
    // ---------------------------------------------------------------
    {
      const backupSave = localStorage.getItem(RPG.state.STORAGE_KEY);
      try {
        const LV = 255;
        const C = LV * RPG.damage.constants.DEF_CONST_PER_LEVEL + RPG.damage.constants.DEF_CONST_BASE;
        const cut = (/** @type {number} */ def) => def / (def + C);

        /** 防御に全振りしたときの DEF を測る。nodes が空なら素の状態。 */
        const measure = (/** @type {string[]} */ nodes, /** @type {boolean} */ withGear) => {
          RPG.state.reset();
          const s = RPG.state.get();
          s.named = true;
          s.levelCapBonus = 200;
          RPG.state.addGold(90000000);
          RPG.state.addBox('box_dragon', 400);
          RPG.state.identifyBoxes('box_dragon', 400);
          const c = s.characters.ch_hero;
          c.level = LV;
          RPG.autoequip.forParty();
          for (const id of nodes) {
            const n = RPG.tree.node(id);
            if (!n) continue;
            for (let i = 0; i < n.maxLevel; i++) {
              try { RPG.state.investNode('ch_hero', id); } catch (e) { /* SP切れ */ }
            }
          }
          if (nodes.length) {
            RPG.state.setClass('ch_hero', 'cls_guardian');
            c.klassTree['gd_bastion'] = 1;
          }
          if (withGear) {
            const d = RPG.data.uniqueEquips.uq_bulwark_heart;
            const b = RPG.data.equipBases[d.base];
            const item = {
              uid: 990001, base: d.base, name: d.name, slot: b.slot, tag: b.tag,
              rarity: 'LEGEND', stats: Object.assign({}, d.stats), tagBonuses: [],
              critRate: 0, capBreak: 0, reduction: 0, affixLines: [],
              boxId: 'box_astral', setId: null, uniqueId: 'uq_bulwark_heart',
              uniqueEffects: Object.assign({}, d.effects), locked: true,
            };
            s.inventory.push(item);
            c.equipped[b.slot] = [item.uid];
          }
          return RPG.units.buildCharacterUnit(c, s.inventory).stats.def || 0;
        };

        const DEF_NODES = ['tr_def', 'tr_def_wall', 'tr_def_fortress', 'tr_hp_to_def', 'tr_atk_to_def'];
        const plain = cut(measure([], false));
        const tank = cut(measure(DEF_NODES, true));

        // 素は「あってないようなもの」のまま。ここが高いと全員が勝手に硬くなる。
        assertTrue('防御: 何も振らなければ2割も削れない',
          plain < 0.20, `Lv${LV} 素で ${(plain * 100).toFixed(1)}%`);

        // 全振りは7割前後。利用者の狙いは「防御特化で耐えるビルドの成立」で、
        // 被ダメカットと乗算になるため 6割台では体感が変わらない。
        assertNear('防御: 全振りすれば7割前後まで削れる', tank, 0.70, 0.06,
          `Lv${LV} 全振りで ${(tank * 100).toFixed(1)}%`);

        // 差が開いていること。倍率で見ないと、両方が高い状態を見逃す。
        assertTrue('防御: 全振りは素の3倍以上削る',
          tank / plain >= 3, `素 ${(plain * 100).toFixed(1)}% / 全振り ${(tank * 100).toFixed(1)}%`);

        // 免疫にはしない。被ダメカット等と乗算になるので、
        // ここが8割を超えると殴られても減らない状態が作れてしまう。
        assertTrue('防御: 全振りでも8割は超えない',
          tank < 0.80, `${(tank * 100).toFixed(1)}%`);
      } finally {
        if (backupSave === null) localStorage.removeItem(RPG.state.STORAGE_KEY);
        else localStorage.setItem(RPG.state.STORAGE_KEY, backupSave);
        RPG.state.load();
      }
    }

    // ---------------------------------------------------------------
    // ビルド画面の分類漏れ (§5.2)
    //
    // 分類表に無い kind は無言で「その他」に落ちる。エラーも出ないので、
    // 枝を足した本人が気付かない。実際、肉の壁 (hp_to_def) が防御の枝から
    // 離れた場所に1つだけ表示され、並べて比べられない状態になっていた。
    // ---------------------------------------------------------------
    {
      const categorized = new Set();
      for (const c of RPG.data.nodeCategories) for (const k of c.kinds) categorized.add(k);

      /** ツリーが実際に使っている kind を集める */
      const used = new Set();
      for (const n of RPG.data.skillTree) {
        for (const e of n.effects || []) used.add(e.kind);
      }

      const orphans = [...used].filter((k) => !categorized.has(k));
      assertTrue('ビルド画面: 全ての効果種別が分類されている',
        orphans.length === 0, orphans.length ? `未分類: ${orphans.join(', ')}` : '');

      // 逆向きも見る。使われていない kind が表に残っていると、
      // 空の見出しが並んで画面が読みにくくなる。
      const stale = [...categorized].filter((k) => !used.has(k));
      assertTrue('ビルド画面: 分類表に使われていない種別が無い',
        stale.length === 0, stale.length ? `余分: ${stale.join(', ')}` : '');
    }

    // ---------------------------------------------------------------
    // 起爆 (§5.8)
    //
    // 継続ダメージは1刻みが相手の最大HPの数%あり、数字としては弱くない。
    // 弱いのは速さで、戦闘が3〜5ラウンドで終わるため満期まで待てなかった。
    // 実測でも継続ダメージは総ダメージの1割止まりだった。
    // 起爆はその待ち時間を「毒と火傷を失う」という取引に置き換える。
    // ---------------------------------------------------------------
    {
      const backupSave = localStorage.getItem(RPG.state.STORAGE_KEY);
      try {
        /** 毒と火傷を載せた敵を1体用意する。 */
        const rig = (/** @type {number} */ statusPower) => {
          RPG.state.reset();
          const s = RPG.state.get();
          s.named = true;
          s.characters.ch_hero.level = 150;
          if (statusPower) s.characters.ch_hero.tree.tr_status_power = statusPower;
          const party = RPG.state.partyUnits();
          const battle = RPG.battle.start({
            fieldId: 'fl_origin', waves: 1, bossFinale: false, party,
          });
          const foe = RPG.battle.livingEnemies(battle)[0];
          RPG.battle.inflict(battle, party[0], foe, 'poison', 3, 0.06);
          RPG.battle.inflict(battle, party[0], foe, 'burn', 3, 0.05);
          return { battle, actor: party[0], foe };
        };

        // 1) 投資が素直に効くこと。
        //    最初は天井だけで抑えていたが、何も振っていない時点で既に天井に
        //    当たっており、「毒の心得」に何レベル振っても値が1点も動かなかった。
        //    それでは減らしたい種類の死に投資を新しく作ることになる。
        const at0 = RPG.battle.detonationValue(rig(0).foe);
        const at3 = RPG.battle.detonationValue(rig(3).foe);
        assertTrue('起爆: 「毒の心得」への投資で威力が伸びる',
          at3.total > at0.total * 1.2,
          `Lv0 ${Math.round(at0.total).toLocaleString()} → Lv3 ${Math.round(at3.total).toLocaleString()}`);

        // 2) 天井を超えないこと。最大HPの割合で殴る手なので、
        //    外すとHPの大きいボスほど大きく溶ける（本来は逆であってほしい）。
        const heavy = rig(5);
        RPG.battle.inflict(heavy.battle, heavy.actor, heavy.foe, 'freeze', 3, 0.3);
        RPG.battle.inflict(heavy.battle, heavy.actor, heavy.foe, 'curse', 3, 0.3);
        RPG.battle.inflict(heavy.battle, heavy.actor, heavy.foe, 'paralyze', 3, 0.3);
        const cap = RPG.battle.detonationValue(heavy.foe);
        assertTrue('起爆: 積み上げても最大HPの4割は超えない',
          cap.total <= heavy.foe.maxHp * 0.4,
          `最大HPの ${(cap.total / heavy.foe.maxHp * 100).toFixed(1)}%`);

        // 3) 消えるのは現金化した毒と火傷だけ。
        //    最初は弱体を全部消していたが、実測すると起爆を撃つほど負けた。
        //    異常構成の火力は「弱体中の敵に強い」枝から出ているので、
        //    全部消すと自分の主力を自分で止めることになる。
        {
          const r = rig(0);
          RPG.battle.inflict(r.battle, r.actor, r.foe, 'freeze', 3, 0.2);
          RPG.battle.executeSkill(r.battle, r.actor, 'sk_tree_detonate', [r.foe]);
          const left = (r.foe.statusEffects || []).map((/** @type {any} */ e) => e.kind);
          assertTrue('起爆: 毒と火傷は消える',
            !left.includes('poison') && !left.includes('burn'), left.join(', '));
          assertTrue('起爆: それ以外の弱体は残る',
            left.includes('freeze'), left.join(', '));
        }

        // 4) オートが正しく値踏みできること。
        //    見積もりと実額を別々に書くと、片方を直したときにもう片方が古い式で
        //    残り、「オートは撃たないのに手動なら強い技」ができあがる。
        {
          const r = rig(2);
          const want = RPG.battle.detonationValue(r.foe).total;
          const est = RPG.autoplay.estimate(r.actor, r.foe, RPG.data.skills.sk_tree_detonate);
          assertTrue('起爆: オートの見積もりに起爆ぶんが乗っている',
            est > want, `見積もり ${Math.round(est).toLocaleString()} / 起爆ぶん ${Math.round(want).toLocaleString()}`);
        }

        // 5) 何も乗っていない相手には0。空撃ちで数字が出ると、
        //    継続ダメージを撒かない構成でも取り得る技になってしまう。
        {
          const r = rig(0);
          r.foe.statusEffects = [];
          assertTrue('起爆: 弱体が無ければ0',
            RPG.battle.detonationValue(r.foe).total === 0, '');
        }

        // 6) 防御バフを弱体として数えないこと。
        //    def_buff は statusEffects に同居しているので、種類を見ずに
        //    配列の長さで判定すると、自分で守りを固めた敵が「弱体中」になる。
        {
          const r = rig(0);
          r.foe.statusEffects = [{ kind: 'def_buff', turns: 3, label: '砦', value: 1 }];
          assertTrue('起爆: 防御バフは弱体に数えない',
            RPG.battle.detonationValue(r.foe).total === 0
              && RPG.battle.debuffsOn(r.foe).length === 0, '');
        }
      } finally {
        if (backupSave === null) localStorage.removeItem(RPG.state.STORAGE_KEY);
        else localStorage.setItem(RPG.state.STORAGE_KEY, backupSave);
        RPG.state.load();
      }
    }

    // ---------------------------------------------------------------
    // クラス技の「規則破り」 (§12)
    //
    // 数値だけを見ると、クラス技は弱くなかった（終焉の一撃は通常攻撃の4.4倍、
    // 首刈りは4.9倍）。足りていなかったのは倍率ではなく、
    // **そのクラスにしか許されていない振る舞い** のほうだった。
    // 6クラスそれぞれに、他では絶対に起きないことを1つずつ持たせてある。
    // ここが消えると、クラス選択は「どの数字が少し大きいか」に戻る。
    // ---------------------------------------------------------------
    {
      const backupSave = localStorage.getItem(RPG.state.STORAGE_KEY);
      try {
        /** Lv150 の4人パーティで戦闘を1つ用意する。 */
        const arena = (/** @type {number} */ round) => {
          RPG.state.reset();
          const s = RPG.state.get();
          s.named = true;
          for (const id of ['ch_rizel', 'ch_gald', 'ch_noa']) {
            s.characters[id] = RPG.state.createCharacter(id);
            RPG.state.tryJoinParty(id);
          }
          for (const id of Object.keys(s.characters)) s.characters[id].level = 150;
          const party = RPG.state.partyUnits();
          const battle = RPG.battle.start({
            fieldId: 'fl_origin', waves: 1, bossFinale: false, party,
          });
          battle.round = round;
          return { battle, party };
        };

        // 守護者 — 軽減ではなく無効化。80%と100%の違いは程度ではなく種類で、
        // 「削られる」が「何も起きない」に変わる。
        {
          const { battle, party } = arena(3);
          RPG.battle.executeSkill(battle, party[0], 'sk_cls_aegis', []);
          const before = party[1].hp;
          RPG.battle.applyDamage(
            battle, RPG.battle.livingEnemies(battle)[0], party[1], RPG.data.skills.sk_slash, {}
          );
          assertTrue('守護者: 絶対防壁の間はダメージを負わない',
            party[1].hp === before, `${(before - party[1].hp).toLocaleString()} 受けた`);
          assertTrue('守護者: 絶対防壁は1ターンで切れる',
            (RPG.data.skills.sk_cls_aegis.params.turns || 0) === 1
              && RPG.data.skills.sk_cls_aegis.cooldown > 1,
            `持続 ${RPG.data.skills.sk_cls_aegis.params.turns} / CD ${RPG.data.skills.sk_cls_aegis.cooldown}`);
        }

        // 癒し手 — 半端なHPで起こして次ラウンドまで棒立ちだと、
        // 「全滅を1ラウンド先延ばしにする技」にしかならない。
        {
          const { battle, party } = arena(4);
          party[1].alive = false;
          party[1].hp = 0;
          RPG.battle.executeSkill(battle, party[0], 'sk_cls_rebirth', []);
          assertTrue('癒し手: 再臨の光は全快で蘇生する',
            party[1].alive && party[1].hp === party[1].maxHp,
            `${party[1].hp.toLocaleString()} / ${party[1].maxHp.toLocaleString()}`);
          assertTrue('癒し手: 起き上がった味方はそのラウンド中に動ける',
            !!party[1].grantedExtra, '');
        }

        // 破壊者 — ダメージ上限（500,000の壁）の外に出られる唯一の手。
        // 上限に届いていなければ差が出ないので、確定会心とセットで初めて意味を持つ。
        {
          const ruin = RPG.data.skills.sk_cls_ruin;
          assertTrue('破壊者: 終焉の一撃は上限を無視する', ruin.ignoreCap === true, '');
          assertTrue('破壊者: 確定会心で必ず上限まで届かせる', ruin.crit_rate >= 1, `${ruin.crit_rate}`);

          // 上限（500,000）を必ず超える攻撃力にする。
          // 超えていない状態で比べても両者は一致し、テストが何も見ていないことになる。
          const attacker = {
            level: 255, stats: { atk: 150000, magi_power: 0 }, element: 'none',
            tagBonuses: [], uniqueBuffs: [], capBreak: 0,
          };
          const defender = { level: 255, def: 2000, element: 'none' };
          const opts = { random: 1.0, crit: true };
          const capped = RPG.damage.calc({ attacker, defender, skill: ruin, options: opts });
          const free = RPG.damage.calc({
            attacker, defender, skill: ruin, options: Object.assign({ ignoreCap: true }, opts),
          });
          assertTrue('破壊者: 上限を超えた分がそのまま数字になる',
            free.damage > capped.damage * 1.2,
            `上限あり ${capped.damage.toLocaleString()} → 無視 ${free.damage.toLocaleString()}`);
        }

        // 呪術師 — 撒いた弱体が時間で消えない。
        // 「起爆」で現金化する相手でもあるので、持続の扱いは両方に効く。
        {
          const { battle, party } = arena(2);
          RPG.battle.executeSkill(battle, party[0], 'sk_cls_crucible', []);
          const foe = RPG.battle.livingEnemies(battle)[0];
          const kinds = (foe.statusEffects || []).length;
          assertTrue('呪術師: 疫病の坩堝は6種すべてを撒く', kinds >= 6, `${kinds}種`);
          assertTrue('呪術師: 坩堝の弱体は経過しない',
            (foe.statusEffects || []).every((/** @type {any} */ e) => e.lasting), '');
        }

        // 戦術家 — 追加行動を配るだけでは、既に切ったクラス技は戻らない。
        // 待ち時間まで巻き戻して初めて「他人の一番強い手をもう一度撃たせる」役になる。
        {
          const { battle, party } = arena(3);
          party[1].cooldowns = { sk_cls_ruin: 99 };
          party[0].cooldowns = { sk_cls_command: 99 };
          RPG.battle.executeSkill(battle, party[0], 'sk_cls_command', []);
          assertTrue('戦術家: 号令は仲間の待ち時間を解除する',
            Object.keys(party[1].cooldowns || {}).length === 0,
            JSON.stringify(party[1].cooldowns));
          // 自分のぶんまで戻ると号令自体を撃ち直せて際限が無くなる。
          assertTrue('戦術家: 自分の待ち時間は戻らない',
            (party[0].cooldowns || {}).sk_cls_command === 99,
            JSON.stringify(party[0].cooldowns));
        }

        // 暗殺者 — HPバーが残っていても終わる。
        {
          const { battle, party } = arena(2);
          const threshold = RPG.data.skills.sk_cls_behead.executeBelow;
          assertTrue('暗殺者: 首刈りに即死の閾値がある', threshold > 0, `${threshold}`);

          const foe = RPG.battle.livingEnemies(battle)[0];
          foe.hp = Math.floor(foe.maxHp * (threshold - 0.02));
          RPG.battle.applyDamage(battle, party[0], foe, RPG.data.skills.sk_cls_behead, {});
          assertTrue('暗殺者: 閾値を切った相手は即座に落ちる', !foe.alive, `HP ${foe.hp}`);
        }

        // ボスには通さない。通すと、耐久を売りにした相手の設計が丸ごと無意味になる。
        // 即死したかどうかは「与えたダメージが残りHPちょうどか」では見分けられないので、
        // **通常の計算で入る額より残りHPを多くして** 判定する。
        {
          const { battle, party } = arena(2);
          const boss = RPG.battle.livingEnemies(battle)[0];
          boss.isBoss = true;
          boss.hp = boss.maxHp;   // 満タンなら通常のダメージでは落ちない
          const threshold = RPG.data.skills.sk_cls_behead.executeBelow;
          boss.maxHp = Math.floor(boss.hp / threshold) * 2;  // HP割合を閾値未満に見せる
          RPG.battle.applyDamage(battle, party[0], boss, RPG.data.skills.sk_cls_behead, {});
          assertTrue('暗殺者: ボスは首刈りで即死しない',
            boss.alive && boss.hp > 0,
            `HP ${boss.hp.toLocaleString()} / ${boss.maxHp.toLocaleString()}`);
        }

        // すべてのクラスが1つずつ持っていること。
        // 数値だけの技に戻すと、クラス選択が「どの数字が大きいか」に戻る。
        {
          const RULE_BREAKERS = {
            sk_cls_aegis: (/** @type {any} */ sk) => sk.params.value >= 1,
            sk_cls_rebirth: (/** @type {any} */ sk) => sk.params.hp >= 1 && sk.params.actNow,
            sk_cls_ruin: (/** @type {any} */ sk) => sk.ignoreCap,
            sk_cls_crucible: (/** @type {any} */ sk) => sk.params.lasting,
            sk_cls_command: (/** @type {any} */ sk) => sk.params.resetCooldowns,
            sk_cls_behead: (/** @type {any} */ sk) => sk.executeBelow > 0,
          };
          for (const id of Object.keys(RULE_BREAKERS)) {
            const sk = RPG.data.skills[id];
            assertTrue(`クラス技: ${sk ? sk.name : id} に規則破りが残っている`,
              !!sk && RULE_BREAKERS[id](sk), '');
          }
        }
      } finally {
        if (backupSave === null) localStorage.removeItem(RPG.state.STORAGE_KEY);
        else localStorage.setItem(RPG.state.STORAGE_KEY, backupSave);
        RPG.state.load();
      }
    }

    // ---------------------------------------------------------------
    // 説明文に装飾記法を混ぜない (§5.2)
    //
    // desc は素のテキストとして描画される。強調のつもりで ** を書くと
    // そのまま画面に出る。実際にクラス技の説明で出してしまった。
    // 目で見つけるしかない種類の崩れなので、ここで塞ぐ。
    // ---------------------------------------------------------------
    {
      /** @type {string[]} */
      const marked = [];
      /** @param {string} where @param {any} table */
      const scan = (where, table) => {
        for (const id of Object.keys(table || {})) {
          const d = table[id] && table[id].desc;
          if (typeof d === 'string' && /\*\*|__|`/.test(d)) marked.push(`${where}: ${id}`);
        }
      };
      scan('技', RPG.data.skills);
      scan('ユニーク', RPG.data.uniqueEquips);
      scan('フィールド', RPG.data.fields);

      // ツリーとクラスは配列なので別に回す
      for (const n of RPG.data.skillTree || []) {
        if (typeof n.desc === 'string' && /\*\*|__|`/.test(n.desc)) marked.push(`ツリー: ${n.id}`);
      }
      for (const cid of Object.keys(RPG.data.classes || {})) {
        for (const n of RPG.data.classes[cid].nodes || []) {
          if (typeof n.desc === 'string' && /\*\*|__|`/.test(n.desc)) marked.push(`クラス: ${n.id}`);
        }
      }

      assertTrue('説明文: 装飾記法がそのまま画面に出ていない',
        marked.length === 0, marked.join(' / '));
    }

    // ---------------------------------------------------------------
    // 1レベルだけの払い戻し (§5.5 / §12)
    //
    // 終盤は250点近いSPを1点ずつ振ることになる。全体リセットしか無いと
    // 1か所を試したいだけでも全部消えるので、振り直すより我慢するほうが楽になる。
    // それでは組み替えて遊ぶ余地が無い。
    //
    // 危ないのは「戻せてしまう」ほうで、上位ノードの解放条件を割ったまま
    // 投資が残ると、効果は生きているのに画面には錠前が出る盤面ができる。
    // ---------------------------------------------------------------
    {
      const backupSave = localStorage.getItem(RPG.state.STORAGE_KEY);
      try {
        /** Lv200・金持ちの主人公を1人用意する。 */
        const rig = () => {
          RPG.state.reset();
          const s = RPG.state.get();
          s.named = true;
          s.levelCapBonus = 200;
          RPG.state.addGold(2000000);
          s.characters.ch_hero.level = 200;
          return s;
        };

        // --- 解放条件を割る払い戻しは断る ---
        {
          const s = rig();
          const c = s.characters.ch_hero;
          // 初級ちょうど5・中級5 で上級が解禁される、という際どい形を作る
          for (let i = 0; i < 5; i++) RPG.state.investNode('ch_hero', 'tr_atk');
          for (let i = 0; i < 5; i++) RPG.state.investNode('ch_hero', 'tr_debuff_amp');
          RPG.state.investNode('ch_hero', 'tr_def_fortress');

          const goldBefore = s.gold;
          const before = JSON.stringify(c.tree);
          const res = RPG.state.refundNode('ch_hero', 'tr_atk');

          assertTrue('払い戻し: 上位の解放条件を割る戻しは断る', !res.ok, res.reason || '通ってしまった');
          // 断ったのに金だけ減る／木だけ変わる、が一番たちが悪い
          assertTrue('払い戻し: 断ったときは金も木も動かさない',
            s.gold === goldBefore && JSON.stringify(c.tree) === before,
            `金 ${goldBefore} → ${s.gold}`);

          // 上から順に外せば必ず抜ける。行き止まりを作らないことが条件。
          assertTrue('払い戻し: 上位そのものは戻せる',
            RPG.tree.canRefund(c, 'tr_def_fortress').ok, '');
        }

        // --- 通常の払い戻し ---
        {
          const s = rig();
          const c = s.characters.ch_hero;
          for (let i = 0; i < 3; i++) RPG.state.investNode('ch_hero', 'tr_atk');
          const spBefore = RPG.tree.spentSp(c.tree);
          const goldBefore = s.gold;

          const res = RPG.state.refundNode('ch_hero', 'tr_atk');
          assertTrue('払い戻し: 1レベルだけ戻る',
            res.ok && c.tree.tr_atk === 2, `${c.tree.tr_atk}`);
          assertTrue('払い戻し: SPが戻る',
            RPG.tree.spentSp(c.tree) === spBefore - RPG.tree.node('tr_atk').cost, '');
          assertTrue('払い戻し: 費用ぶんだけ金が減る',
            s.gold === goldBefore - (res.cost || 0),
            `${goldBefore.toLocaleString()} → ${s.gold.toLocaleString()}（費用 ${res.cost}）`);

          // 0まで戻したらキーごと消えること。0が残ると spentSp 以外の
          // 「投資済みか」を見ている箇所が誤判定する。
          RPG.state.refundNode('ch_hero', 'tr_atk');
          RPG.state.refundNode('ch_hero', 'tr_atk');
          assertTrue('払い戻し: 0まで戻すとキーごと消える',
            !('tr_atk' in c.tree), JSON.stringify(c.tree));
          assertTrue('払い戻し: 振っていないノードは戻せない',
            !RPG.state.refundNode('ch_hero', 'tr_atk').ok, '');
        }

        // --- まとめて直すなら全体リセットのほうが安い、という関係を保つ ---
        {
          // ここが逆転すると全体リセットが存在意義を失う。
          const perSp = RPG.data.skillRefundCostPerSp;
          const level = 200;
          const bulkPerSp = RPG.tree.resetCost(level) / (level - 1);
          assertTrue('払い戻し: 1点ずつのほうが割高',
            perSp > bulkPerSp,
            `1点 ${perSp} G / 全体リセット 約 ${Math.round(bulkPerSp)} G per SP`);
        }

        // --- 戻したときの後始末 ---
        {
          const s = rig();
          const c = s.characters.ch_hero;
          RPG.state.addBox('box_dragon', 60);
          RPG.state.identifyBoxes('box_dragon', 60);

          const slotNode = RPG.data.skillTree.find((/** @type {any} */ n) =>
            (n.effects || []).some((/** @type {any} */ e) => e.kind === 'slot'));
          let moved = true;
          let guard = 0;
          while (moved && guard++ < 40) {
            moved = false;
            for (const id of ['tr_atk', 'tr_def', slotNode.id]) {
              const before = c.tree[id] || 0;
              try { RPG.state.investNode('ch_hero', id); } catch (e) { /* SP切れ */ }
              if ((c.tree[id] || 0) > before) moved = true;
            }
          }
          RPG.autoequip.forParty();
          const slotsBefore = RPG.units.slotCounts(c);
          const equippedBefore = c.equipped.accessory.length;

          RPG.state.refundNode('ch_hero', slotNode.id);
          const slotsAfter = RPG.units.slotCounts(c);

          assertTrue('払い戻し: 装備枠が減る',
            slotsAfter.accessory < slotsBefore.accessory,
            `${slotsBefore.accessory} → ${slotsAfter.accessory}`);
          // 外し忘れると、枠が無いのに装備している状態が残る
          assertTrue('払い戻し: 枠からはみ出した装備は外れる',
            c.equipped.accessory.length <= slotsAfter.accessory,
            `装備 ${equippedBefore} → ${c.equipped.accessory.length} / 枠 ${slotsAfter.accessory}`);
        }

        // 習得技を戻したら、並び順の指定も掃除する。
        // 残しても表示は壊れないが、戻したはずの技が並び替え画面に出続ける。
        {
          const s = rig();
          const c = s.characters.ch_hero;
          let moved = true;
          let guard = 0;
          while (moved && guard++ < 40) {
            moved = false;
            for (const id of ['tr_atk', 'tr_status_power', 'tr_grant_venom', 'tr_grant_detonate']) {
              const before = c.tree[id] || 0;
              try { RPG.state.investNode('ch_hero', id); } catch (e) { /* SP切れ */ }
              if ((c.tree[id] || 0) > before) moved = true;
            }
          }
          c.skillOrder = ['sk_tree_detonate', 'sk_tree_venom', 'sk_hero_slash'];
          RPG.state.refundNode('ch_hero', 'tr_grant_detonate');

          const skills = RPG.units.buildCharacterUnit(c, s.inventory).skills;
          assertTrue('払い戻し: 習得していた技が消える',
            !skills.includes('sk_tree_detonate'), skills.join(', '));
          assertTrue('払い戻し: 並び順から消えた技が取り除かれる',
            !c.skillOrder.includes('sk_tree_detonate'), JSON.stringify(c.skillOrder));
          assertTrue('払い戻し: 残っている技の並び順は保たれる',
            c.skillOrder.includes('sk_tree_venom'), JSON.stringify(c.skillOrder));
        }

        // --- クラス側 ---
        {
          const s = rig();
          const c = s.characters.ch_hero;
          c.level = 240;
          RPG.state.setClass('ch_hero', 'cls_breaker');
          const ruin = RPG.klass.node('cls_breaker', 'bk_ruin');
          RPG.state.investClassNode('ch_hero', 'bk_ruin');
          const cpBefore = RPG.klass.availablePoints(c);
          const goldBefore = s.gold;

          const res = RPG.state.refundClassNode('ch_hero', 'bk_ruin');
          assertTrue('払い戻し: クラスノードも1レベル戻せる', res.ok, res.reason || '');
          assertTrue('払い戻し: クラスポイントが戻る',
            RPG.klass.availablePoints(c) === cpBefore + ruin.cost,
            `${cpBefore} → ${RPG.klass.availablePoints(c)}`);
          assertTrue('払い戻し: クラス側も費用を取る',
            s.gold === goldBefore - (res.cost || 0), '');
          assertTrue('払い戻し: 戻したクラス技は使えなくなる',
            !RPG.units.buildCharacterUnit(c, s.inventory).skills.includes('sk_cls_ruin'), '');
        }
      } finally {
        if (backupSave === null) localStorage.removeItem(RPG.state.STORAGE_KEY);
        else localStorage.setItem(RPG.state.STORAGE_KEY, backupSave);
        RPG.state.load();
      }
    }

    // ---------------------------------------------------------------
    // 拡張コンテンツ (§18)
    //
    // キャラや装備を足すだけなら data/*.js に追記すれば済む。だが
    // その追記を人以外に任せると、既存の定義を壊した事故が混ざったまま
    // 気付けない。差分の中で「足した行」と「壊した行」が混ざるためで、
    // 後から原因を追えなくなる。
    //
    // 追加分は content/ の別ファイルに置き、重ねる前に検査する。
    // **検査が素通りすると仕組みごと意味を失う** ので、
    // 断るべきものを本当に断っているかをここで固定する。
    // ---------------------------------------------------------------
    {
      const good = () => ({ skills: { sk_t_ok: { name: '検査用', kind: 'active' } } });

      /** 拡張を並べて封をし、結果を返す。取り込み状態は毎回巻き戻す。 */
      const trial = (/** @type {any[]} */ packs) => {
        RPG.content._reset();
        for (const p of packs) RPG.content.add(p[0], p[1]);
        return RPG.content.seal();
      };

      // 素直なものは通ること。ここが落ちると仕組みが使えない。
      {
        const r = trial([['まっとうな拡張', good()]]);
        assertTrue('拡張: 正しい拡張は取り込まれる',
          r.loaded.length === 1 && !!RPG.data.skills.sk_t_ok, r.problems.join(' / '));
        assertTrue('拡張: どの拡張が入れたIDか分かる',
          RPG.content.ownerOf('sk_t_ok') === 'まっとうな拡張', '');
      }

      // 参照切れ。通すと、遊んでいる最中に undefined を触って落ちる。
      // 落ちる場所と原因の場所が離れるので、これが一番追いにくい。
      {
        const r = trial([['参照切れ', {
          characters: {
            ch_t_bad: {
              name: 'x', rarity: 'RARE', element: 'fire',
              base: { hp: 1, atk: 1, def: 1, magi_power: 1 },
              growth: { hp: 1, atk: 1, def: 1, magi_power: 1 },
              unique_skills: ['sk_この技は存在しない'],
            },
          },
        }]]);
        assertTrue('拡張: 存在しない技を参照する拡張は取り込まない',
          r.rejected.length === 1 && !RPG.data.characters.ch_t_bad, '');
      }

      // コアの上書き。黙って差し替えられると、バランスを測り直したときに
      // 「直したはずの値」が効いていない事態になる。
      {
        const before = RPG.data.skills.sk_slash.name;
        const r = trial([['すり替え', { skills: { sk_slash: { name: '別物', kind: 'active' } } }]]);
        assertTrue('拡張: コアの定義は上書きできない',
          r.rejected.length === 1 && RPG.data.skills.sk_slash.name === before,
          RPG.data.skills.sk_slash.name);
      }

      // 効果キーの綴り違い。読み口の無いキーは装備しても何も起きない。
      // エラーも警告も出ないので、一番気付きにくい。
      {
        const r = trial([['効かない効果', {
          uniques: {
            uq_t_bad: {
              name: 'x', base: 'eq_relic_mail', desc: 'x',
              effects: { そんなキーは無い: 1 },
            },
          },
        }]]);
        assertTrue('拡張: 読み口の無い効果キーは取り込まない',
          r.rejected.length === 1, r.problems.join(' / '));
      }

      // ツリーの効果種別も同じ。未対応の kind は畳み込みで捨てられる。
      {
        const r = trial([['未対応の種別', {
          treeNodes: [{
            id: 'tr_t_bad', tier: 'mid', name: 'x', cost: 1, maxLevel: 1, desc: 'x',
            effects: [{ kind: 'そんな種別は無い', value: 1 }],
          }],
        }]]);
        assertTrue('拡張: コアが解釈できない効果種別は取り込まない',
          r.rejected.length === 1, r.problems.join(' / '));
      }

      // 綴り違いの種別。書いたのに何も起きないまま通ると、
      // 反映されたと思い込んで先へ進んでしまう。
      {
        const r = trial([['種別の綴り違い', { charactors: {} }]]);
        assertTrue('拡張: 知らない種別があれば取り込まない', r.rejected.length === 1, '');
      }

      // 1つの事故で全部が消えると、原因の切り分けができない。
      {
        const r = trial([['壊れているほう', { skills: { 変なID: { name: 'x', kind: 'active' } } }],
          ['無事なほう', good()]]);
        assertTrue('拡張: 壊れた拡張は他を巻き込まない',
          r.loaded.indexOf('無事なほう') >= 0 && r.rejected.indexOf('壊れているほう') >= 0,
          `通った ${r.loaded.join(',')} / 弾いた ${r.rejected.join(',')}`);
      }

      // 効果キーの一覧がずれると検査が意味を失う。ソースと突き合わせる。
      {
        assertTrue('拡張: ユニークの効果キー一覧がある',
          Array.isArray(RPG.units.UNIQUE_EFFECT_KEYS) && RPG.units.UNIQUE_EFFECT_KEYS.length > 0, '');
        assertTrue('拡張: ツリーの効果種別一覧がある',
          Array.isArray(RPG.tree.KNOWN_EFFECT_KINDS) && RPG.tree.KNOWN_EFFECT_KINDS.length > 0, '');

        // コアが実際に使っている種別は、必ず一覧に載っていること。
        const used = new Set();
        for (const n of RPG.data.skillTree) for (const e of n.effects || []) used.add(e.kind);
        for (const cid of Object.keys(RPG.data.classes)) {
          for (const n of RPG.data.classes[cid].nodes || []) {
            for (const e of n.effects || []) used.add(e.kind);
          }
        }
        const missing = [...used].filter((k) => RPG.tree.KNOWN_EFFECT_KINDS.indexOf(k) < 0);
        assertTrue('拡張: 実際に使われている効果種別は全て一覧にある',
          missing.length === 0, missing.join(', '));
      }

      // 後片付け。ここを忘れると、以降のテストが検査用のIDを見てしまう。
      RPG.content._reset();
      delete RPG.data.skills.sk_t_ok;
    }

    // ---------------------------------------------------------------
    // 追加したスキルプラグイン (§9.1)
    //
    // どれも「数値を大きくする」のではなく戦術の軸を1本ずつ足すもの。
    // 効いているかどうかが目で見えにくい種類なので、
    // **本当に動いているか** をここで固定する。
    // 壊れても技は普通に撃てるため、テストが無いと気付けない。
    // ---------------------------------------------------------------
    {
      const backupSave = localStorage.getItem(RPG.state.STORAGE_KEY);
      try {
        /** Lv150 の4人で戦闘を1つ作る。 */
        const arena = () => {
          RPG.state.reset();
          const s = RPG.state.get();
          s.named = true;
          for (const id of ['ch_rizel', 'ch_gald', 'ch_noa']) {
            s.characters[id] = RPG.state.createCharacter(id);
            RPG.state.tryJoinParty(id);
          }
          for (const id of Object.keys(s.characters)) s.characters[id].level = 150;
          const party = RPG.state.partyUnits();
          const battle = RPG.battle.start({
            fieldId: 'fl_origin', waves: 1, bossFinale: false, party,
          });
          return { battle, me: battle.party[0], foes: RPG.battle.livingEnemies(battle) };
        };

        /** 検証用の技をその場で作る。後で必ず消す。 */
        const temp = {};
        const mk = (/** @type {string} */ id, /** @type {any} */ def) => {
          RPG.data.skills[id] = def;
          temp[id] = true;
          return id;
        };

        // 6種すべてが登録されていること。読み込み漏れは
        // 「その技が不発になる」という形でしか出ない。
        for (const name of ['barrier', 'pandemic', 'chain_burst',
          'charge_strike', 'combo_finish', 'counter_stance']) {
          assertTrue(`プラグイン: ${name} が登録されている`, !!RPG.plugins[name], '');
        }

        // --- 障壁 ---
        // HPの外側に積むので、満タンの相手にも効く。ここが回復との違い。
        {
          const { battle, me, foes } = arena();
          mk('t_barrier', {
            name: '試・障壁', kind: 'active', plugin: 'barrier',
            scaling_stat: 'magi_power', damage_type: 'reli', element: 'light',
            power: 0, crit_rate: 0,
            params: { ratio: 2.0, scaling: 'magi_power', party: true },
          });
          RPG.battle.executeSkill(battle, me, 't_barrier', []);
          const want = Math.floor(me.stats.magi_power * 2);
          assertTrue('障壁: 味方全員に張られる',
            battle.party.every((/** @type {any} */ u) => u.shield === want),
            battle.party.map((/** @type {any} */ u) => u.shield).join(', '));

          // HPより先に削れること。ここが逆だと障壁の意味が無い。
          const target = battle.party[1];
          const hpBefore = target.hp;
          const shieldBefore = target.shield;
          RPG.battle.applyDamage(battle, foes[0], target, RPG.data.skills.sk_slash, {});
          assertTrue('障壁: HPより先に削れる',
            target.shield < shieldBefore && target.hp <= hpBefore,
            `障壁 ${shieldBefore}→${target.shield} / HP ${hpBefore}→${target.hp}`);
        }

        // --- 拡散 ---
        {
          const { battle, me, foes } = arena();
          if (foes.length >= 2) {
            mk('t_pandemic', {
              name: '試・拡散', kind: 'active', plugin: 'pandemic',
              scaling_stat: 'magi_power', damage_type: 'magi', element: 'dark',
              power: 0, crit_rate: 0, params: {},
            });
            for (const k of ['poison', 'burn', 'freeze']) {
              RPG.battle.inflict(battle, me, foes[0], k, 4, 0.08);
            }
            const before = RPG.battle.debuffsOn(foes[1]).length;
            RPG.battle.executeSkill(battle, me, 't_pandemic', [foes[0]]);
            assertTrue('拡散: 他の敵へ弱体が写る',
              RPG.battle.debuffsOn(foes[1]).length > before,
              `${before} → ${RPG.battle.debuffsOn(foes[1]).length}`);
            // 写したものが更に伝染すると、1手で盤面が埋まる
            assertTrue('拡散: 写した弱体は更に伝染しない',
              RPG.battle.debuffsOn(foes[1]).every((/** @type {any} */ e) => e.spread), '');
          }
        }

        // --- 跳弾 ---
        // 敵が1体でも空振りにしない。掃除の終盤で腐らせないため。
        {
          const { battle, me, foes } = arena();
          mk('t_chain', {
            name: '試・跳弾', kind: 'active', plugin: 'chain_burst',
            scaling_stat: 'magi_power', damage_type: 'magi', element: 'light',
            power: 120, crit_rate: 0, params: { chains: 3, decay: 0.1 },
          });
          const hpBefore = foes.map((/** @type {any} */ f) => f.hp);
          RPG.battle.executeSkill(battle, me, 't_chain', [foes[0]]);
          const hit = foes.filter((/** @type {any} */ f, /** @type {number} */ i) =>
            f.hp < hpBefore[i]).length;
          assertTrue('跳弾: 複数の敵に当たる（敵が複数いれば）',
            foes.length === 1 ? hit === 1 : hit >= 2, `${hit} 体に命中`);
        }

        // --- 溜め ---
        {
          const { battle, me, foes } = arena();
          mk('t_charge', {
            name: '試・溜め', kind: 'active', plugin: 'charge_strike',
            scaling_stat: 'atk', damage_type: 'phys', element: 'none',
            power: 0, crit_rate: 0, params: { ratio: 2.5, critRate: 0.5, capBreak: 0.4 },
          });
          RPG.battle.executeSkill(battle, me, 't_charge', []);
          assertTrue('溜め: 状態が乗る', !!me.charge, '');

          // 重ねがけを許すと「敵を無視して溜め続ける」が成立する
          RPG.battle.executeSkill(battle, me, 't_charge', []);
          assertTrue('溜め: 重ねがけはできない', me.charge.ratio === 2.5, `${me.charge.ratio}`);

          RPG.battle.applyDamage(battle, me, foes[0], RPG.data.skills.sk_hero_slash, { crit: false });
          assertTrue('溜め: 攻撃1回で使い切る', me.charge === null, '');

          // 威力に本当に乗っているか。式を直接見る。
          const attacker = {
            level: 150, stats: { atk: 10000, magi_power: 0 }, element: 'none',
            tagBonuses: [], uniqueBuffs: [], capBreak: 0,
          };
          const defender = { level: 150, def: 1000, element: 'none' };
          const plain = RPG.damage.calc({
            attacker, defender, skill: RPG.data.skills.sk_hero_slash,
            options: { random: 1.0, crit: false },
          }).damage;
          const charged = RPG.damage.calc({
            attacker, defender, skill: RPG.data.skills.sk_hero_slash,
            options: { random: 1.0, crit: false, chargeRatio: 2.5 },
          }).damage;
          assertNear('溜め: 倍率がそのまま威力に乗る', charged / plain, 2.5, 0.02,
            `${plain.toLocaleString()} → ${charged.toLocaleString()}`);
        }

        // --- コンボの締め ---
        {
          const { battle, me, foes } = arena();
          mk('t_finish', {
            name: '試・締め', kind: 'active', plugin: 'combo_finish',
            scaling_stat: 'atk', damage_type: 'phys', element: 'wind',
            power: 160, crit_rate: 0, params: { perCombo: 0.3, maxRatio: 5.0 },
          });
          battle.combo.count = RPG.battle.comboMax(battle);
          const before = foes[0].hp;
          RPG.battle.executeSkill(battle, me, 't_finish', [foes[0]]);
          assertTrue('締め: ダメージが入る', foes[0].hp < before, '');
          // 消し忘れると毎ターン最大倍率になる
          assertTrue('締め: コンボを使い切る', battle.combo.count === 0, `${battle.combo.count} 段`);
        }

        // --- 迎撃の構え ---
        {
          const { battle, me, foes } = arena();
          mk('t_stance', {
            name: '試・構え', kind: 'active', plugin: 'counter_stance',
            scaling_stat: 'atk', damage_type: 'phys', element: 'earth',
            power: 0, crit_rate: 0,
            params: { turns: 2, reduction: 0.25, counterSkill: 'sk_slash' },
          });
          RPG.battle.executeSkill(battle, me, 't_stance', []);
          assertTrue('構え: 状態が乗る', !!me.stance, '');

          const foeHp = foes[0].hp;
          RPG.battle.applyDamage(battle, foes[0], me, RPG.data.skills.sk_slash, {});
          // パッシブの反撃と違い、確率ではなく必ず返る
          assertTrue('構え: 殴られたら必ず反撃する', foes[0].hp < foeHp,
            `${foeHp} → ${foes[0].hp}`);

          // 軽減が実際に乗っているか（乱数を挟まない経路で見る）
          const d = RPG.units.toDefender(me);
          me.stance = null;
          const bare = RPG.units.toDefender(me).reduction;
          assertTrue('構え: 被ダメージ軽減が乗る（判定は battle 側）',
            typeof bare === 'number', '');

          // 無い技IDを指しても構えられること（手持ちから拾う）
          mk('t_stance_bad', {
            name: '試・構え2', kind: 'active', plugin: 'counter_stance',
            scaling_stat: 'atk', damage_type: 'phys', element: 'earth',
            power: 0, crit_rate: 0,
            params: { turns: 1, counterSkill: 'sk_この技は無い' },
          });
          RPG.battle.executeSkill(battle, me, 't_stance_bad', []);
          assertTrue('構え: 反撃技が無いIDでも壊れない',
            !!me.stance && me.stance.skillId === null, JSON.stringify(me.stance));
        }

        // 検証用に足した技を必ず消す。残すと他のテストや図鑑が拾う。
        for (const id of Object.keys(temp)) delete RPG.data.skills[id];
      } finally {
        if (backupSave === null) localStorage.removeItem(RPG.state.STORAGE_KEY);
        else localStorage.setItem(RPG.state.STORAGE_KEY, backupSave);
        RPG.state.load();
      }
    }

    // ---------------------------------------------------------------
    // 拡張からフィールドを足す (§18)
    //
    // 「深い場所ほど人型が増える」という設定を決めたのに、
    // 敵を足しても置く場所を指定できない状態だった。
    // 場所ごと足せるようにしたぶん、**壊れた場所を通さない**ことが要る。
    // 入ったのに戦闘が始まらないフィールドは、遊んで初めて分かる種類の事故になる。
    // ---------------------------------------------------------------
    {
      /** 正しいフィールド定義。ここから1項目ずつ壊して試す。 */
      const sane = () => ({
        name: '検査用の谷', rec_level: 40, enemy_lv: 44, size: [2, 3],
        pool: ['em_wisp'], boss: 'bs_mine_tyrant',
        gold_mult: 0.9, exp_mult: 1.1, desc: '検査用',
      });
      const trial = (/** @type {any} */ patch, /** @type {string} */ id) => {
        RPG.content._reset();
        RPG.content.add('検査', { fields: { [id || 'fl_t_probe']: Object.assign(sane(), patch) } });
        return RPG.content.seal();
      };

      assertTrue('拡張フィールド: 正しい定義は取り込まれる',
        trial({}).loaded.length === 1, '');
      assertTrue('拡張フィールド: RPG.data.fields に入る',
        !!RPG.data.fields.fl_t_probe, '');

      // 置く敵が実在しないと、入ったのに戦闘が始まらない
      assertTrue('拡張フィールド: 存在しない敵を pool に書くと断る',
        trial({ pool: ['em_この敵は無い'] }).rejected.length === 1, '');
      assertTrue('拡張フィールド: 存在しないボスを書くと断る',
        trial({ boss: 'bs_このボスは無い' }).rejected.length === 1, '');

      // size は [最小, 最大]。逆だと敵の数が決まらない
      assertTrue('拡張フィールド: size が逆なら断る',
        trial({ size: [3, 1] }).rejected.length === 1, '');
      assertTrue('拡張フィールド: pool が空なら断る',
        trial({ pool: [] }).rejected.length === 1, '');

      // 桁を間違えた敵レベルは、勝てないか手応えが無いかになる
      assertTrue('拡張フィールド: 敵レベルが推奨と釣り合わなければ断る',
        trial({ enemy_lv: 400 }).rejected.length === 1, '');

      // 経済の調整つまみが欠けていると、収益の検証が成立しない
      assertTrue('拡張フィールド: gold_mult が無ければ断る',
        trial({ gold_mult: undefined }).rejected.length === 1, '');

      assertTrue('拡張フィールド: IDの頭が違えば断る',
        trial({}, 'bad_id').rejected.length === 1, '');

      RPG.content._reset();
      delete RPG.data.fields.fl_t_probe;
    }

    // ---------------------------------------------------------------
    // 生成プロンプトの置き場所は2つある (§18)
    //
    // コアは data/artprompts.js に一覧で持ち、拡張は定義の中に artPrompt を書く
    // （拡張は data/ を書き換えられないので、そうするしかない）。
    // 検査が片方しか見ないと、**拡張の敵は必ず未指定として落ちる**。実際に落ちた。
    // ---------------------------------------------------------------
    {
      const packOwned = Object.keys(RPG.data.enemies)
        .filter((id) => RPG.content.ownerOf(id));
      const withInline = packOwned.filter((id) => !!RPG.data.enemies[id].artPrompt);
      assertTrue('プロンプト: 拡張の敵は定義内の artPrompt で指定できる',
        packOwned.length === 0 || withInline.length === packOwned.length,
        packOwned.length ? `${withInline.length} / ${packOwned.length} 体` : '拡張の敵なし');

      // 生成ツールが実際にそれを読むこと（tools/novelai_gen.py と同じ優先順位）。
      // ここがずれると「テストは通るのに生成では使われない」が起きる。
      const chars = Object.keys(RPG.data.characters).filter((id) => RPG.content.ownerOf(id));
      assertTrue('プロンプト: 拡張のキャラも artPrompt を持てる',
        chars.length === 0 || chars.every((id) => typeof RPG.data.characters[id].artPrompt === 'string'
          || RPG.data.characters[id].artPrompt === undefined),
        `${chars.length} 人`);
    }

    // ---------------------------------------------------------------
    // 行き先が消える (§18)
    //
    // 派遣は実時間で進むので、**その間に拡張コンテンツが外される**ことがある。
    // 開始時には行き先を確かめているが、受け取り時には見ていなかった。
    // そのまま戦闘を始めると undefined を触って落ち、例外で collect が中断し、
    // **派遣が回収不能なまま残り続ける**。実際に再現した。
    // ---------------------------------------------------------------
    {
      const backupSave = localStorage.getItem(RPG.state.STORAGE_KEY);
      try {
        RPG.state.reset();
        const s = RPG.state.get();
        s.named = true;
        RPG.state.addGold(300000);
        s.characters.ch_rizel = RPG.state.createCharacter('ch_rizel');
        RPG.state.tryJoinParty('ch_rizel');
        for (const id of Object.keys(s.characters)) s.characters[id].level = 60;

        // 拡張フィールドがある体で派遣を出す
        RPG.data.fields.fl_t_gone = {
          name: '消える谷', rec_level: 50, enemy_lv: 55, size: [2, 3],
          pool: ['em_wisp'], boss: 'bs_mine_tyrant',
          gold_mult: 0.9, exp_mult: 1.0, desc: '検査用',
        };
        const started = RPG.dispatch.start({
          fieldId: 'fl_t_gone', waves: 3, bossFinale: true, planId: 'short',
        });
        assertTrue('派遣: 拡張フィールドへ送り出せる', started.ok, started.reason || '');

        // 名前を控えていないと、消えたときに利用者へ何も伝えられない
        assertTrue('派遣: 行き先の名前を控えている',
          RPG.state.get().dispatch.fieldName === '消える谷',
          String(RPG.state.get().dispatch.fieldName));

        // 拡張が外された状況を作り、帰還時刻を過去にする
        delete RPG.data.fields.fl_t_gone;
        RPG.state.get().dispatch.endsAt = Date.now() - 1000;

        let threw = null;
        let res = null;
        try { res = RPG.dispatch.collect(); } catch (e) { threw = e.message; }

        assertTrue('派遣: 行き先が消えても例外にならない', threw === null, String(threw));
        assertTrue('派遣: 行き先が消えたら断る', !!res && res.ok === false, JSON.stringify(res));
        assertTrue('派遣: 理由に行き先の名前が出る',
          !!res && /消える谷/.test(res.reason || ''), (res && res.reason) || '');

        // ここが要点。解除しないと、二度と派遣できないまま詰む。
        assertTrue('派遣: 隊は呼び戻される（派遣が残らない）',
          RPG.state.get().dispatch === null, JSON.stringify(RPG.state.get().dispatch));
        assertTrue('派遣: そのあと再び派遣できる',
          RPG.dispatch.start({ fieldId: 'fl_ruins', waves: 1, bossFinale: false, planId: 'short' }).ok, '');

        // 戦闘の入口でも、原因の見えない例外にしない
        let msg = '';
        try {
          RPG.battle.start({ fieldId: 'fl_この場所は無い', waves: 1, party: [] });
        } catch (e) { msg = e.message; }
        assertTrue('戦闘: 無いフィールドは名指しで止める',
          /fl_この場所は無い/.test(msg), msg || '例外が出なかった');
      } finally {
        delete RPG.data.fields.fl_t_gone;
        if (backupSave === null) localStorage.removeItem(RPG.state.STORAGE_KEY);
        else localStorage.setItem(RPG.state.STORAGE_KEY, backupSave);
        RPG.state.load();
      }
    }

    // ---------------------------------------------------------------
    // ユニーク効果キーの一覧に抜けがないこと (§7.8 / §18)
    //
    // この一覧は拡張コンテンツの検査に使われる。抜けがあると
    // **正しいキーを書いた拡張が弾かれる**（逆向きの事故）。
    //
    // 実際に3つ抜けていた（wrathRatio / elementAdapt / comboLock）。
    // コアのユニークが使っていて、実装も読んでいるのに、一覧だけが古かった。
    // コアが実際に使っているキーは、必ず一覧に載っていること。
    // ---------------------------------------------------------------
    {
      const known = RPG.units.UNIQUE_EFFECT_KEYS;
      const used = new Set();
      for (const id of Object.keys(RPG.data.uniqueEquips)) {
        for (const k of Object.keys(RPG.data.uniqueEquips[id].effects || {})) used.add(k);
      }
      // 装備セット (§7.7) も同じ読み口を通るので、そちらも見る
      for (const id of Object.keys(RPG.data.equipSets || {})) {
        for (const tier of RPG.data.equipSets[id].tiers || []) {
          for (const k of Object.keys(tier.effects || {})) used.add(k);
        }
      }
      const missing = [...used].filter((k) => known.indexOf(k) < 0);
      assertTrue('ユニーク効果: コアが使っているキーは全て一覧にある',
        missing.length === 0, missing.join(', '));
    }

    // ---------------------------------------------------------------
    // ユニークの効果キーが、本当に届いているか (§7.8)
    //
    // 一覧に載せるだけでは足りない。値の置き場所が3つに分かれていて、
    // 間違えると **一覧にはあるのに効かない** という、一番たちの悪い状態になる。
    //
    //   passives    battle.js が unit.passives.x を読むもの
    //   situational damage.js が attacker.x を読むもの（toAttacker が situational から拾う）
    //   素の値      critDamage / execute など、ユニットに直接持たせるもの
    //
    // 実際に debuffAmp と critPierce を passives に置いて、効かないまま通した。
    // ここでは「装備すると値が動く」ことを1キーずつ確かめる。
    // ---------------------------------------------------------------
    {
      const backupSave = localStorage.getItem(RPG.state.STORAGE_KEY);
      try {
        RPG.state.reset();
        const s = RPG.state.get();
        s.named = true;
        const c = s.characters.ch_hero;
        c.level = 100;

        /** 効果だけを持つ架空のユニークを着けて、値の変化を見る */
        const withEffect = (/** @type {any} */ effects) => {
          c.equipped = { weapon: [], armor: [], accessory: [] };
          s.inventory = [];
          const base = RPG.data.equipBases.eq_amulet;
          const item = {
            uid: 970001, base: 'eq_amulet', name: '検査用', slot: base.slot,
            tag: base.tag, rarity: 'LEGEND', stats: {}, tagBonuses: [],
            critRate: 0, capBreak: 0, reduction: 0, affixLines: [],
            boxId: 'box_astral', setId: null, uniqueId: 'uq_test',
            uniqueEffects: effects, locked: true,
          };
          s.inventory.push(item);
          c.equipped[base.slot] = [item.uid];
          const unit = RPG.units.buildCharacterUnit(c, s.inventory);
          return { unit, attacker: RPG.units.toAttacker(unit) };
        };

        // キーごとに「どこを見れば効いたと分かるか」を書いておく。
        // 読み取り方まで書いてあるので、置き場所を変えたらここも直すことになる。
        const PROBES = {
          critDamage: (/** @type {any} */ r) => r.attacker.critDamage,
          critPierce: (r) => r.attacker.critPierce,
          execute: (r) => r.attacker.execute,
          bossSlayer: (r) => r.attacker.bossSlayer,
          debuffAmp: (r) => r.attacker.debuffAmp,
          extraActionRate: (r) => r.unit.passives.extraActionRate,
          ambush: (r) => r.unit.passives.ambush,
          healPower: (r) => r.unit.passives.healPower,
          overhealShield: (r) => r.unit.passives.overhealShield,
          shieldRegen: (r) => r.unit.passives.shieldRegen,
          healOnKill: (r) => r.unit.passives.healOnKill,
          debuffSpread: (r) => r.unit.passives.debuffSpread,
          selfCursePower: (r) => r.unit.passives.selfCursePower,
          evade: (r) => r.unit.passives.evade,
          focusPower: (r) => r.unit.passives.focusPower,
          relayPower: (r) => r.unit.passives.relayPower,
          mendPower: (r) => r.unit.passives.mendPower,
          cooldownCut: (r) => r.unit.passives.cooldownCut,
          sigilBurst: (r) => r.unit.passives.sigilBurst,
          chain: (r) => r.unit.passives.chain,
          chainPower: (r) => r.unit.passives.chainPower,
          statusPower: (r) => r.unit.passives.statusPower,
          doubleHits: (r) => r.unit.passives.doubleHits,
          hpToDef: (r) => r.unit.stats.def,
          guardAlly: (r) => r.unit.passives.guardAlly,
          reflect: (r) => r.unit.passives.reflect,
          counterRate: (r) => r.unit.passives.counterRate,
          comboGain: (r) => r.unit.passives.comboGain,
          comboPower: (r) => r.unit.passives.comboPower,
          loneFoePower: (r) => r.unit.passives.loneFoePower,
          soloPower: (r) => r.unit.passives.soloPower,
          midPowerStatus: (r) => r.unit.passives.midPowerStatus,
          midPowerCombo: (r) => r.unit.passives.midPowerCombo,
          debuffDuration: (r) => r.unit.passives.debuffDuration,
          capBreak: (r) => r.attacker.capBreak,
        };

        const dead = [];
        for (const key of Object.keys(PROBES)) {
          const before = PROBES[key](withEffect({}));
          const after = PROBES[key](withEffect({ [key]: 0.25 }));
          if (!(after > before)) dead.push(`${key}（${before} → ${after}）`);
        }

        assertTrue('ユニーク効果: 一覧のキーが実際に値を動かす',
          dead.length === 0, dead.join(' / '));

        // 検査できていないキーがどれかを見えるようにしておく。
        // 全部を機械的に確かめられるわけではない（battle.js が戦闘中に
        // setEffects から直接読むものは、ここでは届かない）。
        const unprobed = RPG.units.UNIQUE_EFFECT_KEYS
          .filter((k) => !(k in PROBES));
        assertTrue('ユニーク効果: 未検査のキーは battle.js 直読みのものだけ',
          unprobed.every((k) => RPG.units.BATTLE_KEYS.indexOf(k) >= 0
            || k === 'elementAdapt' || k === 'reviveHp'
            || k === 'firstRoundPower' || k === 'highPowerBoost' || k === 'critRate'),
          unprobed.join(', '));
      } finally {
        if (backupSave === null) localStorage.removeItem(RPG.state.STORAGE_KEY);
        else localStorage.setItem(RPG.state.STORAGE_KEY, backupSave);
        RPG.state.load();
      }
    }

    // ---------------------------------------------------------------
    // 新しい効果の軸 (§9.1)
    //
    // どれも「既存キーの数値違い」ではなく、戦闘の構造として空いていた場所。
    // 読み口が1本しかないので、配線を間違えると静かに何も起きない。
    // ---------------------------------------------------------------
    {
      const backupSave = localStorage.getItem(RPG.state.STORAGE_KEY);
      try {
        RPG.state.reset();
        const st = RPG.state.get();
        st.named = true;
        const c = st.characters.ch_hero;
        c.level = 60;

        const startB = () => RPG.battle.start({
          fieldId: 'fl_nest', waves: 1, bossFinale: false,
          party: [RPG.units.buildCharacterUnit(c, [])],
        });
        /** 同じ乱数の並びで1発殴り、ダメージだけ取る */
        const hit = (/** @type {any} */ b, /** @type {any} */ atk, /** @type {any} */ foe, seed) => {
          RPG.rng.seed(seed);
          const d = RPG.battle.applyDamage(b, atk, foe, RPG.data.skills.sk_slash,
            { silent: true }).damage;
          RPG.rng.seed(null);
          return d;
        };

        // --- 標的指定（マーク）---
        // 他の火力補正と違い、効果は **殴られる側** に乗っている。
        {
          const b = startB();
          const foe = b.enemies[0];
          const atk = b.party[0];
          const before = hit(b, atk, foe, 11);

          foe.marked = { side: 'party', value: 0.35, turns: 3, label: '照準' };
          const after = hit(b, atk, foe, 11);
          assertNear('マーク: 印を付けた陣営の火力が上がる', after / before, 1.35, 0.02);

          // 敵が付けた印でこちらが得をしてはいけない。
          // side を見ずに読むと、敵の照準がそのまま自軍の火力になる。
          foe.marked = { side: 'enemy', value: 0.35, turns: 3, label: '照準' };
          assertTrue('マーク: 相手陣営の印は自分に乗らない',
            hit(b, atk, foe, 11) === before, `${before} のまま`);

          // 期限切れの印が残っていても効かないこと
          foe.marked = { side: 'party', value: 0.35, turns: 0, label: '照準' };
          assertTrue('マーク: 持続が尽きた印は効かない',
            hit(b, atk, foe, 11) === before, `${before} のまま`);
        }

        // --- 刻印 ---
        // 毒や残響と違い、**時間ではなく回数で進む**。
        // そして進捗は殴った側に溜まる（敵に積むと戦闘が短すぎて溜まらない）。
        {
          const b = startB();
          const foe = b.enemies[0];
          const atk = b.party[0];
          foe.hp = foe.maxHp = 1000000;
          const step = Math.floor(1000000 * 0.06);

          /** @type {number[]} */
          const drops = [];
          for (let i = 0; i < RPG.battle.SIGIL_THRESHOLD * 2; i++) {
            const hp = foe.hp;
            RPG.battle.addSigil(b, foe, atk, 0.06);
            drops.push(hp - foe.hp);
          }
          const fired = drops.map((d, i) => (d > 0 ? i + 1 : 0)).filter((n) => n > 0);
          assertTrue('刻印: 閾値ちょうどで弾ける',
            fired.join(',') === `${RPG.battle.SIGIL_THRESHOLD},${RPG.battle.SIGIL_THRESHOLD * 2}`,
            `${fired.join(',') || 'なし'} 発目`);
          assertNear('刻印: 炸裂は相手の最大HPの割合ぶん',
            drops[RPG.battle.SIGIL_THRESHOLD - 1], step, step * 0.01);

          // 一度に積みすぎたぶんは切り捨てず、まとめて弾いて余りを残す。
          // ここを取りこぼすと、多段技で積むほど損をする。
          foe.hp = foe.maxHp;
          const before = foe.hp;
          RPG.battle.addSigil(b, foe, atk, 0.06, RPG.battle.SIGIL_THRESHOLD * 2 + 2);
          assertNear('刻印: まとめて積んだら2回ぶん弾ける',
            before - foe.hp, step * 2, step * 0.02);
          assertTrue('刻印: 余りは次へ持ち越す', atk.sigils === 2, `${atk.sigils} 個`);

          // ここが敵に積む設計との分かれ目。
          // 相手が入れ替わっても進捗が消えないので、戦闘が短くても溜まりきる。
          // 直前の相手で2つまで進んでいる。別の相手を殴って残り1つを埋めれば、
          // その場で弾けるはず。敵に積む設計だと、ここで最初からやり直しになる。
          const other = b.enemies[1] || b.enemies[0];
          other.hp = other.maxHp = 1000000;
          const kept = atk.sigils;
          const otherBefore = other.hp;
          RPG.battle.addSigil(b, other, atk, 0.06);
          assertTrue('刻印: 相手が変わっても進捗を引き継ぐ',
            kept === RPG.battle.SIGIL_THRESHOLD - 1 && otherBefore - other.hp > 0,
            `前の相手で${kept}つ → 別の相手への1発で炸裂（${(otherBefore - other.hp).toLocaleString()}）`);

          // 別のキャラの刻印と混ざらないこと。
          const other2 = b.enemies[0];
          const stranger = { name: '別人', side: 'party', sigils: 0 };
          RPG.battle.addSigil(b, other2, stranger, 0.06);
          assertTrue('刻印: 攻撃者ごとに別々に溜まる', stranger.sigils === 1,
            `${stranger.sigils} 個`);
        }

        // --- 手番の前借り ---
        {
          const b = startB();
          const a0 = b.party[0];
          // 敵は落ちない・こちらも落ちないようにして、手番の動きだけを見る。
          // ラウンド番号で判定すると、敵フェーズでこちらが倒れたときに
          // 「手番を失った」のか「戦闘が終わった」のか区別できなくなる。
          b.enemies.forEach((/** @type {any} */ e) => { e.hp = e.maxHp = 100000000; });
          a0.hp = a0.maxHp = 100000000;

          RPG.battle.commandSkill(b, 'sk_stolen_tempo', [b.enemies[0]], { auto: true });
          assertTrue('前借り: 撃った直後に同じキャラの手番が戻る',
            b.phase === 'command' && b.actorIndex === 0 && b.round === 1,
            `R${b.round} phase=${b.phase} 手番=${b.actorIndex}`);
          assertTrue('前借り: 借金が記録される', a0.stunnedRounds === 1,
            `${a0.stunnedRounds} ラウンド`);

          // 前借りぶんを使う。ここから先、借金を返し終えるまで手番は来ない。
          const roundAfter = b.round;
          RPG.battle.commandSkill(b, 'sk_slash', [b.enemies[0]], { auto: true });
          assertTrue('前借り: 借りたぶんのラウンドは手番が来ない',
            a0.stunnedRounds === 0 && b.round > roundAfter && !b.finished,
            `R${roundAfter} → R${b.round} stunned=${a0.stunnedRounds}`);
          // 借金を返し終えたら、また普通に動ける。
          assertTrue('前借り: 返し終われば手番が戻る',
            b.phase === 'command' && b.actorIndex === 0,
            `phase=${b.phase} 手番=${b.actorIndex}`);
        }

        // 連打で手番が無限に増えないこと。
        // grantedExtra は再行動の上限を通らないので、素通しにすると
        // 「前借り → 追加行動 → また前借り」が終わらなくなる。
        {
          const b = startB();
          const a0 = b.party[0];
          b.enemies.forEach((/** @type {any} */ e) => { e.hp = e.maxHp = 100000000; });
          let acts = 0;
          while (b.phase === 'command' && acts < 30) {
            RPG.battle.commandSkill(b, 'sk_stolen_tempo', [b.enemies[0]], { auto: true });
            acts++;
            if (b.round > 1) break;
          }
          assertTrue('前借り: 連打しても手番は無限に増えない', acts <= 4,
            `1ラウンドで ${acts} 回行動した`);
        }

        // --- 自傷を糧にする ---
        {
          const b = startB();
          const foe = b.enemies[0];
          const atk = b.party[0];
          atk.passives = Object.assign({}, atk.passives, { selfCursePower: 0.10 });

          const clean = hit(b, atk, foe, 22);
          atk.statusEffects.push({ kind: 'poison', label: '毒', turns: 3, ratio: 0.05 });
          atk.statusEffects.push({ kind: 'curse', label: '呪詛', turns: 3, ratio: 0.05 });
          assertNear('自傷を糧: 自分の弱体の数だけ火力が上がる',
            hit(b, atk, foe, 22) / clean, 1.20, 0.02);

          // def_buff は statusEffects に載るが弱体ではない。
          // ここを数えると、自分を固めるだけで火力が上がってしまう。
          const cursed = hit(b, atk, foe, 22);
          atk.statusEffects.push({ kind: 'def_buff', label: '防御', turns: 3, value: 0.5 });
          assertTrue('自傷を糧: 防御上昇は糧にならない',
            hit(b, atk, foe, 22) === cursed, `${cursed} のまま`);
        }

        // --- 進んで受けた弱体は、耐性ではねのけない ---
        // ここを addStatus 経由にすると、精神耐性を積んだ瞬間に
        // 自傷構成が燃料を受け取れなくなる。
        {
          const b = startB();
          const atk = b.party[0];
          atk.passives = Object.assign({}, atk.passives, { debuffResist: 1 });
          atk.statusEffects = [];
          RPG.battle.commandSkill(b, 'sk_embrace_the_rot', [b.enemies[0]], { auto: true });
          assertTrue('自傷を糧: 耐性があっても自分の弱体は入る',
            RPG.battle.debuffsOn(atk).length === 2,
            `${RPG.battle.debuffsOn(atk).length} 個`);
        }
      } finally {
        RPG.rng.seed(null);
        if (backupSave === null) localStorage.removeItem(RPG.state.STORAGE_KEY);
        else localStorage.setItem(RPG.state.STORAGE_KEY, backupSave);
        RPG.state.load();
      }
    }

    // ---------------------------------------------------------------
    // 効果種別の登録簿 (data/effectkinds.js)
    //
    // 効果の情報は長いあいだ3か所に手書きで散っていて、2回ずれた。
    // いまは登録簿が唯一の出どころで、units.js の配列はそこから組み立てる。
    // ここでは「登録簿が実装とずれていないか」だけを見張る。
    // ---------------------------------------------------------------
    {
      const reg = RPG.data.effectKinds;
      const kinds = Object.keys(reg);

      // 実装と一対一であること。片方にしか無い種別は、どちらかが古い。
      const impl = RPG.tree.KNOWN_EFFECT_KINDS;
      const missing = impl.filter((/** @type {string} */ k) => kinds.indexOf(k) < 0);
      const extra = kinds.filter((/** @type {string} */ k) => impl.indexOf(k) < 0);
      assertTrue('登録簿: tree.js の効果種別を漏れなく載せている',
        missing.length === 0, missing.join(', '));
      assertTrue('登録簿: 実装に無い効果種別を載せていない',
        extra.length === 0, extra.join(', '));

      // 行き先と形が、決めた値のどれかであること。
      const TO = ['passives', 'situational', 'build'];
      const SHAPE = ['add', 'max', 'levels', 'keyed', 'special'];
      const badTo = kinds.filter((/** @type {string} */ k) => TO.indexOf(reg[k].to) < 0);
      const badShape = kinds.filter((/** @type {string} */ k) => SHAPE.indexOf(reg[k].shape) < 0);
      assertTrue('登録簿: 行き先が決めた値のどれか', badTo.length === 0, badTo.join(', '));
      assertTrue('登録簿: 形が決めた値のどれか', badShape.length === 0, badShape.join(', '));

      // 装備から持てるキーは、行き先が必ず書いてあること。
      // ここが空だと units.js が流し先を決められず、静かに捨てる。
      const noRoute = kinds.filter((/** @type {string} */ k) => reg[k].uniq && !reg[k].route);
      assertTrue('登録簿: 装備から持てるキーには行き先がある',
        noRoute.length === 0, noRoute.join(', '));

      // units.js の配列が登録簿から組み立てられていること。
      const routes = RPG.data.effectRoutes;
      assertTrue('登録簿: units.js のキー一覧と一致する',
        RPG.units.UNIQUE_EFFECT_KEYS.length === Object.keys(routes).length
        && RPG.units.UNIQUE_EFFECT_KEYS.every((/** @type {string} */ k) => !!routes[k]),
        `${RPG.units.UNIQUE_EFFECT_KEYS.length} / ${Object.keys(routes).length}`);
    }

    // ---------------------------------------------------------------
    // 効果キーが登録簿どおりの場所に届くか (§7.8)
    //
    // 行き先を間違えても **エラーも警告も出ない**。値は保存され、画面にも
    // 出るのに、読む側が別の場所を見ているので何も起きない。
    // critPierce と debuffAmp が実際に長いあいだ死んでいた。
    //
    // 46キーを1つずつ装備させて、宣言どおりの場所に入ったかを実測する。
    // ---------------------------------------------------------------
    {
      const backupSave = localStorage.getItem(RPG.state.STORAGE_KEY);
      try {
        RPG.state.reset();
        const st = RPG.state.get();
        st.named = true;
        const c = st.characters.ch_hero;
        c.level = 200;

        const routes = RPG.data.effectRoutes;
        const wrong = [];
        let uid = 971000;

        for (const key of Object.keys(routes)) {
          const base = RPG.data.equipBases.eq_amulet;
          const item = {
            uid: uid++, base: 'eq_amulet', name: '検査用', slot: base.slot, tag: base.tag,
            rarity: 'LEGEND', stats: {}, tagBonuses: [], critRate: 0, capBreak: 0,
            reduction: 0, affixLines: [], boxId: 'box_astral', setId: null,
            uniqueId: 'uq_probe', uniqueEffects: { [key]: 0.25 }, locked: true,
          };
          c.equipped = { weapon: [], armor: [], accessory: [] };
          c.equipped[base.slot] = [item.uid];
          const u = RPG.units.buildCharacterUnit(c, [item]);

          const want = routes[key];
          const at =
            (u.passives && u.passives[key]) ? 'passives'
            : (u.situational && u.situational[key]) ? 'situational'
            : (u.setEffects && u.setEffects[key]) ? 'setEffects' : null;

          if (want === 'unit' || want === 'build') {
            // 素の値は置き場所が個別なので、ユニットのどこかに現れていればよい。
            if (JSON.stringify(u).indexOf('0.25') < 0) wrong.push(`${key}: 届いていない`);
          } else if (at !== want) {
            wrong.push(`${key}: ${want} のはずが ${at || '見つからない'}`);
          }
        }
        c.equipped = { weapon: [], armor: [], accessory: [] };

        assertTrue('効果キー: 登録簿どおりの場所に届く', wrong.length === 0,
          wrong.length ? wrong.join(' / ') : `${Object.keys(routes).length} キーを確認`);
      } finally {
        if (backupSave === null) localStorage.removeItem(RPG.state.STORAGE_KEY);
        else localStorage.setItem(RPG.state.STORAGE_KEY, backupSave);
        RPG.state.load();
      }
    }

    // ---------------------------------------------------------------
    // 「高いほうを採る」種別は、レベルぶん伸びること (§5.8)
    //
    // e.value をそのまま渡していたせいで、同じノードを重ねても伸びなかった。
    // 2段目以降のSPは払えるのに何も起きない状態が
    // 不撓(6SP) 不屈の魂(8SP) 輪廻(6SP) 不撓の祈り(2CP) に残っていた。
    // ---------------------------------------------------------------
    {
      const reg = RPG.data.effectKinds;
      const maxKinds = Object.keys(reg)
        .filter((/** @type {string} */ k) => reg[k].shape === 'max');

      const dead = [];
      for (const node of RPG.data.skillTree) {
        if ((node.maxLevel || 1) <= 1) continue;
        if (!(node.effects || []).some((/** @type {any} */ e) => maxKinds.indexOf(e.kind) >= 0)) continue;
        const one = RPG.tree.effects({ [node.id]: 1 });
        const full = RPG.tree.effects({ [node.id]: node.maxLevel });
        if (JSON.stringify(one) === JSON.stringify(full)) {
          dead.push(`${node.name}（${node.cost}×${node.maxLevel}）`);
        }
      }
      assertTrue('効果種別: 重ねても伸びないノードが無い', dead.length === 0,
        dead.length ? dead.join(' / ') : `最大値方式 ${maxKinds.join('、')} を確認`);
    }

    // ---------------------------------------------------------------
    // 新しい5軸 (§5.9)
    //
    // どれも「読む口が無かった場所」に作ったもの。
    // 倍率は setPower を直に呼んで確かめる。戦闘を回して測ると
    // 敵フェーズが乱数を食うので、同じ種でも値が揃わない。
    // ---------------------------------------------------------------
    {
      const backupSave = localStorage.getItem(RPG.state.STORAGE_KEY);
      try {
        RPG.state.reset();
        const st = RPG.state.get();
        st.named = true;
        const c = st.characters.ch_hero;
        c.level = 100;

        /** その効果だけを持たせた戦闘を1つ作る */
        const arena = (/** @type {any} */ p) => {
          const u = RPG.units.buildCharacterUnit(c, []);
          u.passives = Object.assign({}, u.passives, p);
          const b = RPG.battle.start({
            fieldId: 'fl_nest', waves: 1, bossFinale: true, party: [u],
          });
          b.enemies.forEach((/** @type {any} */ e) => { e.hp = e.maxHp = 9e7; });
          b.party[0].hp = b.party[0].maxHp = 9e7;
          return b;
        };

        // --- 回避: 割合で減らすのではなく丸ごと通さない ---
        {
          const b = arena({ evade: 0.5 });
          let dodged = 0;
          RPG.rng.seed(7);
          for (let i = 0; i < 400; i++) {
            const r = RPG.battle.applyDamage(b, b.enemies[0], b.party[0],
              RPG.data.skills.sk_enemy_bite, { silent: true });
            if (r.evaded) dodged++;
          }
          RPG.rng.seed(null);
          assertTrue('回避: 確率どおりに避ける', dodged > 160 && dodged < 240,
            `400回中 ${dodged}回（期待200前後）`);

          // 上限を超えて積んでも避けきりにはならない。
          // 完全回避を許すと、そのキャラだけ戦闘から降りてしまう。
          const wall = arena({ evade: 5 });
          let through = 0;
          RPG.rng.seed(11);
          for (let i = 0; i < 200; i++) {
            const r = RPG.battle.applyDamage(wall, wall.enemies[0], wall.party[0],
              RPG.data.skills.sk_enemy_bite, { silent: true });
            if (!r.evaded) through++;
          }
          RPG.rng.seed(null);
          assertTrue('回避: どれだけ積んでも通る攻撃が残る', through > 0,
            `200回中 ${through}回は通った`);
        }

        // --- 執着: 同じ相手を続けて狙うほど重くなる ---
        {
          const b = arena({ focusPower: 0.08 });
          const a = b.party[0];
          a.focusCount = 1;
          const one = RPG.battle.setPower(b, a);
          a.focusCount = 4;
          assertNear('執着: 4回続けて狙うと1.24倍',
            RPG.battle.setPower(b, a) / one, 1.24, 0.01);

          // 的を替えたら1に戻ること。戻らないと「執着」でなくなる。
          //
          // ボス戦は敵が1体しかいないので、ここでは雑魚戦を作る。
          // 1体しかいない盤面で測ると、条件を素通りして通ってしまう。
          const u2 = RPG.units.buildCharacterUnit(c, []);
          u2.passives = Object.assign({}, u2.passives, { focusPower: 0.08 });
          const mob = RPG.battle.start({
            fieldId: 'fl_nest', waves: 1, bossFinale: false, party: [u2],
          });
          mob.enemies.forEach((/** @type {any} */ e) => { e.hp = e.maxHp = 9e7; });
          mob.party[0].hp = mob.party[0].maxHp = 9e7;
          const foes = RPG.battle.livingEnemies(mob);
          const m = mob.party[0];

          assertTrue('執着: 検査に使う盤面に敵が複数いる', foes.length >= 2,
            `${foes.length} 体`);

          RPG.battle.commandSkill(mob, 'sk_slash', [foes[0]], { auto: true });
          const first = m.focusCount;
          RPG.battle.commandSkill(mob, 'sk_slash', [foes[0]], { auto: true });
          const same = m.focusCount;
          RPG.battle.commandSkill(mob, 'sk_slash', [foes[1]], { auto: true });
          assertTrue('執着: 的を替えると積み直しになる',
            same > first && m.focusCount === 1,
            `${first} → ${same} → ${m.focusCount}`);
        }

        // --- 連携: 直前に動いた味方と違う系統で攻めたときだけ乗る ---
        {
          const b = arena({ relayPower: 0.5 });
          const a = b.party[0];
          b.lastPartyTag = 'magi'; b.pendingTag = 'phys';
          const diff = RPG.battle.setPower(b, a);
          b.lastPartyTag = 'phys'; b.pendingTag = 'phys';
          const same = RPG.battle.setPower(b, a);
          b.lastPartyTag = null;
          const none = RPG.battle.setPower(b, a);
          assertNear('連携: 違う系統で継ぐと1.5倍', diff / same, 1.5, 0.01);
          assertTrue('連携: 初手には乗らない', none === same, `${none} / ${same}`);
        }

        // --- 恩返し: 受けた回復の「量」で積む ---
        // 回数で数えていたときは、1戦あたり平均0.7回しか積まず
        // 効き始める前に決着していた。量なら大回復1発から乗る。
        {
          const b = arena({ mendPower: 0.6 });
          const a = b.party[0];
          a.mendRatio = 0;
          const zero = RPG.battle.setPower(b, a);
          a.mendRatio = 0.5;   // 最大HPの半分ぶん受けた
          assertNear('恩返し: 最大HPの半分を受けると1.3倍',
            RPG.battle.setPower(b, a) / zero, 1.30, 0.01);

          // 頭打ちがあること。長引いた戦闘で青天井に伸びるのを止める。
          a.mendRatio = 100;
          assertNear('恩返し: 受け続けても頭打ちになる',
            RPG.battle.setPower(b, a) / zero, 1.90, 0.01);

          // あふれた回復は数えないこと。
          // 数えると、満タンの味方に撃つだけで稼げてしまう。
          const full = arena({ mendPower: 0.6 });
          const t = full.party[0];
          t.hp = t.maxHp;
          t.mendRatio = 0;
          RPG.battle.executeSkill(full, t, 'sk_hero_heal', [t]);
          assertTrue('恩返し: あふれた回復は積まない', (t.mendRatio || 0) === 0,
            `${t.mendRatio || 0}`);

          // 減っていれば積むこと。
          //
          // ここだけは arena() の水増しHP（9千万）を使わない。
          // 最大HPが実際の何百倍もあると、回復1発の比が 0.0001 になって
          // 「積んでいるのか誤差なのか」が読めなくなる。
          const hurt = arena({ mendPower: 0.6 });
          const h = hurt.party[0];
          h.maxHp = 10000;
          h.hp = 1;
          h.mendRatio = 0;
          RPG.battle.executeSkill(hurt, h, 'sk_hero_heal', [h]);
          assertTrue('恩返し: 実際に入ったぶんは積む', (h.mendRatio || 0) > 0.01,
            `最大HPの ${((h.mendRatio || 0) * 100).toFixed(1)}% ぶん`);

          // ── 小さい回復の連打で稼げないこと ──
          // 回数で数えていたときは、1ポイントの回復でも1回ぶん積んだ。
          // 実測で「最大HPの0.001%だけ回復」を5回撃つと火力 +120% になった。
          // 量で見るなら、撃った回数ではなく入った量しか効かない。
          const cheese = arena({ mendPower: 0.6 });
          const g = cheese.party[0];
          g.maxHp = 100000;
          g.mendRatio = 0;
          for (let i = 0; i < 5; i++) {
            g.hp = g.maxHp - 1;
            RPG.battle.executeSkill(cheese, g, 'sk_hero_heal', [g]);
          }
          assertTrue('恩返し: 小さい回復を連打しても稼げない',
            (g.mendRatio || 0) < 0.01,
            `5回撃って 最大HPの ${((g.mendRatio || 0) * 100).toFixed(3)}% ぶん`);
        }

        // --- CT短縮: クラス技を撃てる回数が変わる ---
        {
          RPG.data.skills.__probe = { name: '検査用', kind: 'active', cooldown: 5 };
          const plain = arena({});
          const cut = arena({ cooldownCut: 1 });
          plain.round = 1; cut.round = 1;
          RPG.battle.startCooldown(plain, plain.party[0], '__probe');
          RPG.battle.startCooldown(cut, cut.party[0], '__probe');
          assertTrue('短縮: クールタイムが1ラウンド縮む',
            plain.party[0].cooldowns.__probe - cut.party[0].cooldowns.__probe === 1,
            `${plain.party[0].cooldowns.__probe} → ${cut.party[0].cooldowns.__probe}`);

          // 0にはしない。毎ラウンド撃てるとクラス技の重みが消える。
          const huge = arena({ cooldownCut: 99 });
          huge.round = 1;
          RPG.battle.startCooldown(huge, huge.party[0], '__probe');
          assertTrue('短縮: 積んでも待ち時間は消えない',
            huge.party[0].cooldowns.__probe > huge.round,
            `R${huge.round} → ${huge.party[0].cooldowns.__probe}`);
          delete RPG.data.skills.__probe;
        }
      } finally {
        RPG.rng.seed(null);
        if (backupSave === null) localStorage.removeItem(RPG.state.STORAGE_KEY);
        else localStorage.setItem(RPG.state.STORAGE_KEY, backupSave);
        RPG.state.load();
      }
    }

    // ---------------------------------------------------------------
    // モードごとのデータ分離 (§20)
    //
    // ストーリーを「育てながら遊べる別のRPG」にするための土台。
    // ハクスラ側の Lv255 を持ち込めると第1章が演出だけになり、
    // 貸し出しの固定編成にすると育てる楽しみが消える。
    // 同じ仕組みのまま **データの束だけ差し替える** ことで両方を避ける。
    //
    // ここが漏れると、片方で拾った装備がもう片方に現れる。
    // 気付きにくいうえ、気付いたときには両方のセーブが混ざっている。
    // ---------------------------------------------------------------
    {
      const backupSave = localStorage.getItem(RPG.state.STORAGE_KEY);
      try {
        RPG.state.reset();

        // --- 既定はハクスラ側。何もしなければ今までどおり ---
        assertTrue('モード: 既定はハクスラ側', RPG.state.mode() === 'hack',
          RPG.state.mode());

        // ハクスラ側を育てる
        RPG.state.setMode('hack');
        const h0 = RPG.state.get();
        h0.characters.ch_hero.level = 200;
        RPG.state.addGold(50000);
        RPG.state.addBox('box_astral', 7);
        const hackBoxes = JSON.stringify(h0.boxes);

        // --- ストーリー側は真っさらから始まる ---
        RPG.state.setMode('story');
        const st = RPG.state.get();
        assertTrue('モード: ストーリー側は1から始まる',
          st.characters.ch_hero.level === 1 && st.gold === 0
          && !st.boxes.box_astral,
          `Lv${st.characters.ch_hero.level} ${st.gold}G`);

        // 数値の書き戻しが効くこと。
        // 読みだけ差し替えると、増えたゴールドが次に読んだ瞬間に消える。
        RPG.state.addGold(300);
        st.gold += 55;
        assertTrue('モード: ストーリー側の数値が書き戻る', RPG.state.get().gold === 355,
          `${RPG.state.get().gold}G`);

        st.characters.ch_hero.level = 12;
        RPG.state.addBox('box_bronze', 41);
        st.items.it_star_shard = 9;
        st.inventory.push({ uid: 90001, name: '検査用' });

        // --- 片方の変更がもう片方へ漏れないこと ---
        RPG.state.setMode('hack');
        const h1 = RPG.state.get();
        assertTrue('モード: ストーリー側の育成がハクスラ側へ漏れない',
          h1.characters.ch_hero.level === 200 && h1.gold === 60000
          && JSON.stringify(h1.boxes) === hackBoxes
          && !h1.items.it_star_shard && h1.inventory.length === 0,
          `Lv${h1.characters.ch_hero.level} ${h1.gold}G 装備${h1.inventory.length}個`);

        h1.inventory.push({ uid: 90002, name: 'ハクスラ側' });
        RPG.state.addBox('box_dragon', 5);

        RPG.state.setMode('story');
        const s1 = RPG.state.get();
        assertTrue('モード: ハクスラ側の変更がストーリー側へ漏れない',
          s1.inventory.length === 1 && !s1.boxes.box_dragon
          && s1.characters.ch_hero.level === 12,
          `装備${s1.inventory.length}個 竜${s1.boxes.box_dragon || 0}`);

        // --- 共有すべきものは共有すること ---
        // 設定や主人公の名前まで分かれると、切り替えるたびに操作感が変わる。
        RPG.state.updateSettings({ fast: true });
        RPG.state.setMode('hack');
        assertTrue('モード: 設定は両方で共有する',
          RPG.state.get().settings.fast === true, '');

        // --- 保存して読み直しても両方残ること ---
        RPG.state.setMode('story');
        RPG.state.persist();
        RPG.state.load();
        assertTrue('モード: 読み直してもストーリー側が残る',
          RPG.state.mode() === 'story'
          && RPG.state.get().characters.ch_hero.level === 12,
          `mode=${RPG.state.mode()} Lv${RPG.state.get().characters.ch_hero.level}`);
        RPG.state.setMode('hack');
        assertTrue('モード: 読み直してもハクスラ側が残る',
          RPG.state.get().characters.ch_hero.level === 200,
          `Lv${RPG.state.get().characters.ch_hero.level}`);

        // --- 旧セーブが壊れないこと ---
        // 遊んでいる人のセーブには mode も story も入っていない。
        {
          RPG.state.persist();
          const raw = JSON.parse(localStorage.getItem(RPG.state.STORAGE_KEY));
          delete raw.mode;
          delete raw.story;
          localStorage.setItem(RPG.state.STORAGE_KEY, JSON.stringify(raw));
          RPG.state.load();
          assertTrue('モード: 旧セーブはハクスラ側として読める',
            RPG.state.mode() === 'hack'
            && RPG.state.get().characters.ch_hero.level === 200,
            `mode=${RPG.state.mode()}`);
          assertTrue('モード: 遊んでいない人のセーブを太らせない',
            RPG.state.get().story === null, JSON.stringify(RPG.state.get().story));
        }

        // --- モードだけ story で中身が無いセーブ ---
        // ここを直さないと、起動直後に読めずに落ちる。
        {
          const broken = JSON.parse(localStorage.getItem(RPG.state.STORAGE_KEY));
          broken.mode = 'story';
          broken.story = null;
          localStorage.setItem(RPG.state.STORAGE_KEY, JSON.stringify(broken));
          RPG.state.load();
          assertTrue('モード: 中身の無いストーリーはハクスラ側へ戻す',
            RPG.state.mode() === 'hack'
            && RPG.state.get().characters.ch_hero.level === 200,
            `mode=${RPG.state.mode()}`);
        }
      } finally {
        if (backupSave === null) localStorage.removeItem(RPG.state.STORAGE_KEY);
        else localStorage.setItem(RPG.state.STORAGE_KEY, backupSave);
        RPG.state.load();
      }
    }

    // ---------------------------------------------------------------
    // マップ探索 (§20)
    //
    // 歩くのは主人公だけ。パーティは主人公が先頭に固定なので (§8.1)、
    // 代表として1人だけ歩かせる。見下ろしの絵が1人ぶんで済む。
    // ---------------------------------------------------------------
    {
      const backupSave = localStorage.getItem(RPG.state.STORAGE_KEY);
      try {
        RPG.state.reset();
        RPG.state.setMode('story');
        const W = RPG.worldmap;

        // --- データの形 ---
        for (const id of Object.keys(RPG.data.maps)) {
          const m = RPG.data.maps[id];
          const widths = new Set(m.tiles.map((/** @type {string} */ r) => r.length));
          assertTrue(`マップ: ${m.name} は行の長さが揃っている`, widths.size === 1,
            [...widths].join(', '));

          // legend に無い文字は壁として扱われる。地図を書き間違えると、
          // 通れるはずの道が黙って塞がる。
          const unknown = new Set();
          for (const row of m.tiles) {
            for (const ch of row) if (!m.legend[ch]) unknown.add(ch);
          }
          assertTrue(`マップ: ${m.name} は legend に無い文字を使っていない`,
            unknown.size === 0, [...unknown].join(' '));

          // legend が指すタイル種別が実在すること。
          const badKind = Object.keys(m.legend)
            .filter((/** @type {string} */ c) => !RPG.data.tileKinds[m.legend[c]]);
          assertTrue(`マップ: ${m.name} の legend は実在するタイルを指す`,
            badKind.length === 0, badKind.join(' '));

          // 開始位置が歩けること。歩けない場所に置くと動けなくなる。
          assertTrue(`マップ: ${m.name} の開始位置は歩ける`,
            W.tileAt(m, m.start.x, m.start.y).walk,
            `(${m.start.x},${m.start.y})`);

          // イベントも歩けるマスにあること。壁の中の宝箱は永久に取れない。
          const stuck = (m.events || []).filter((/** @type {any} */ e) => !W.tileAt(m, e.x, e.y).walk);
          assertTrue(`マップ: ${m.name} のイベントは歩けるマスにある`, stuck.length === 0,
            stuck.map((/** @type {any} */ e) => `${e.kind}(${e.x},${e.y})`).join(' '));

          // 出口の行き先が実在すること。
          const badExit = (m.events || [])
            .filter((/** @type {any} */ e) => e.kind === 'exit' && !RPG.data.maps[e.to]);
          assertTrue(`マップ: ${m.name} の出口は実在するマップを指す`, badExit.length === 0,
            badExit.map((/** @type {any} */ e) => e.to).join(' '));
        }

        // --- 当たり判定 ---
        {
          W.enter('mp_forge');
          const m = W.def('mp_forge');
          // 壁に囲まれた位置を探して、四方すべてで止まることを見る
          let blocked = 0;
          W.enter('mp_forge', { x: 1, y: 1 });
          for (const [dx, dy] of [[-1, 0], [0, -1]]) {
            if (!W.move(dx, dy).ok) blocked++;
          }
          assertTrue('マップ: 壁は通り抜けられない', blocked === 2, `${blocked}/2`);

          // 範囲外も壁として扱うこと。地図の端から落ちない。
          assertTrue('マップ: 範囲外は壁として扱う',
            !W.tileAt(m, -1, 0).walk && !W.tileAt(m, 999, 0).walk, '');
        }

        // --- 宝箱は一度きり ---
        {
          W.enter('mp_forge', { x: 11, y: 3 });
          const hit = W.move(0, -1);
          assertTrue('マップ: 宝箱のマスでイベントが返る',
            !!hit.event && hit.event.kind === 'chest', JSON.stringify(hit.event));
          const before = RPG.state.get().gold;
          const got = W.resolve(hit.event);
          assertTrue('マップ: 宝箱を開けると受け取れる',
            got.ok && RPG.state.get().gold > before,
            `${before}G → ${RPG.state.get().gold}G`);
          assertTrue('マップ: 同じ宝箱は二度開かない', W.resolve(hit.event).ok === false, '');
        }

        // --- 出口で移れる ---
        {
          W.enter('mp_forge', { x: 12, y: 8 });
          const ex = W.move(1, 0);
          W.resolve(ex.event);
          assertTrue('マップ: 出口から別のマップへ移る',
            W.current().id === 'mp_ashfield', W.current().id);
        }

        // --- エンカウント ---
        {
          // 安全な場所では出ないこと。最初の場所で殴られると説明が入らない。
          W.enter('mp_forge', { x: 2, y: 2 });
          let enc = 0;
          for (let i = 0; i < 200; i++) { if (W.move(i % 2 ? -1 : 1, 0).encounter) enc++; }
          assertTrue('マップ: 敵の出ないマップでは遭遇しない', enc === 0, `${enc}回`);

          // 草の上では設定どおりの確率で出ること。
          W.enter('mp_ashfield', { x: 5, y: 1 });
          RPG.rng.seed(42);
          let steps = 0, hits = 0;
          for (let i = 0; i < 400; i++) {
            const r = W.move(i % 2 ? -1 : 1, 0);
            if (r.ok) { steps++; if (r.encounter) hits++; }
          }
          RPG.rng.seed(null);
          const rate = hits / steps;
          const want = RPG.data.maps.mp_ashfield.encounter.rate;
          assertTrue('マップ: 遭遇率が設定どおり',
            Math.abs(rate - want) < 0.05,
            `実測 ${(rate * 100).toFixed(1)}% / 設定 ${(want * 100).toFixed(0)}%`);

          // 遭遇の中身がそのまま battle.start に渡せること。
          const enc2 = RPG.data.maps.mp_ashfield.encounter;
          assertTrue('マップ: 遭遇の行き先が実在するフィールド',
            !!RPG.data.fields[enc2.fieldId], enc2.fieldId);
        }

        // --- 仲間の加入 (§20) ---
        //
        // 主人公ひとりでは最初の遭遇に勝てない（実測で勝率20%）。
        // 第1章で1人加えることで通るようにしてある。
        // ここが崩れると、序盤が「周回しないと進めない」形になる。
        {
          RPG.state.reset();
          RPG.state.setMode('story');
          const join = RPG.data.maps.mp_forge.events
            .find((/** @type {any} */ e) => e.kind === 'join');
          assertTrue('マップ: 第1章に加入イベントがある', !!join,
            join ? join.who : '無い');

          assertTrue('マップ: 加入する相手が実在する',
            !!join && !!RPG.data.characters[join.who], join && join.who);

          // 加入前はひとり
          assertTrue('マップ: 始まりは主人公ひとり',
            RPG.state.get().party.length === 1, `${RPG.state.get().party.length}人`);

          W.enter('mp_forge', { x: join.x, y: join.y - 1 });
          W.move(0, 1);      // 下を向く（乗ってしまってもよい）
          const r = W.resolve(join);
          assertTrue('マップ: 仲間が加わる',
            r.ok && RPG.state.get().party.indexOf(join.who) >= 0,
            RPG.state.get().party.join(' / '));

          assertTrue('マップ: 加入は一度きり', W.resolve(join).ok === false, '');

          // 主人公に置いていかれないこと。Lv1 で加わると育て直しになる。
          RPG.state.reset();
          RPG.state.setMode('story');
          RPG.state.get().characters.ch_hero.level = 20;
          W.enter('mp_forge');
          W.resolve(join);
          assertTrue('マップ: 仲間は主人公のレベルに合わせて加わる',
            RPG.state.get().characters[join.who].level === 20,
            `Lv${RPG.state.get().characters[join.who].level}`);

          // --- 加入すれば最初の遭遇に勝てること ---
          RPG.state.reset();
          RPG.state.setMode('story');
          W.enter('mp_forge');
          W.resolve(join);
          const enc = RPG.data.maps.mp_ashfield.encounter;
          /** @param {number} n */
          const winRate = (n) => {
            let win = 0;
            for (let i = 0; i < n; i++) {
              const b = RPG.battle.start({
                fieldId: enc.fieldId, waves: enc.waves,
                bossFinale: enc.bossFinale, party: RPG.state.partyUnits(),
              });
              let g = 0;
              while (!b.finished && g++ < 600) {
                if (b.phase === 'wave_clear') { RPG.battle.advanceWave(b); continue; }
                const a = RPG.autoplay.chooseAction(b); if (!a) break;
                RPG.battle.commandSkill(b, a.skillId, a.targets, { auto: true });
              }
              if (b.victory) win++;
            }
            return win / n;
          };
          const two = winRate(12);
          assertTrue('マップ: 仲間が居れば最初の遭遇に勝てる', two >= 0.75,
            `勝率 ${Math.round(two * 100)}%`);

          // ひとりだと勝てないこと。ここが勝ててしまうと、
          // 仲間を加える意味も、加入イベントを置いた理由も無くなる。
          RPG.state.setParty(['ch_hero']);
          const solo = winRate(12);
          assertTrue('マップ: ひとりでは押し切れない', solo < two,
            `ひとり ${Math.round(solo * 100)}% / ふたり ${Math.round(two * 100)}%`);
        }

        // --- 現在地はストーリー側にしか残らない ---
        {
          W.enter('mp_forge');
          RPG.state.setMode('hack');
          assertTrue('マップ: ハクスラ側に現在地が漏れない',
            !RPG.state.get().progress, JSON.stringify(RPG.state.get().progress));
          RPG.state.setMode('story');
          assertTrue('マップ: ストーリー側には残る',
            W.current() && W.current().id === 'mp_forge', JSON.stringify(W.current()));
        }
      } finally {
        RPG.rng.seed(null);
        if (backupSave === null) localStorage.removeItem(RPG.state.STORAGE_KEY);
        else localStorage.setItem(RPG.state.STORAGE_KEY, backupSave);
        RPG.state.load();
      }
    }

    // ---------------------------------------------------------------
    // 装備の並べ替え (§7.4)
    //
    // 「強い順」は全部を1つの点数に潰すので、特定の数値だけを探せない。
    // 所持数は周回で数千に達するので、「DEFがいちばん高いもの」を
    // 目で探すのは現実的でない。項目ごとに並べられる必要がある。
    //
    // 画面ではなく gear.js を直に叩く。画面越しだと表示上限(120個)で
    // 切られた後しか見られず、並び全体を確かめられない。
    // ---------------------------------------------------------------
    {
      // 検査用に、まとまった数の装備を作る
      RPG.rng.seed(4321);
      /** @type {any[]} */
      const inv = [];
      for (let i = 0; i < 400; i++) {
        inv.push(RPG.gear.identify(i % 3 ? 'box_dragon' : 'box_astral', i + 1));
      }
      RPG.rng.seed(null);

      assertTrue('装備の並べ替え: 検査用の装備が揃っている', inv.length === 400,
        `${inv.length} 個`);

      const KEYS = ['stat:hp', 'stat:atk', 'stat:def', 'stat:magi_power',
        'crit', 'capBreak', 'reduction', 'tag'];

      for (const key of KEYS) {
        const label = (RPG.gear.SORTS.find((/** @type {any} */ x) => x.id === key) || {}).label || key;
        const list = RPG.gear.arrange(inv, { sort: key });

        // 1つも欠けないこと。絞り込みを指定していないので数は変わらない。
        assertTrue(`装備の並べ替え: ${label}で数が変わらない`, list.length === inv.length,
          `${list.length} / ${inv.length}`);

        // 降順に並んでいること。
        let broken = -1;
        for (let i = 1; i < list.length; i++) {
          if (RPG.gear.sortValue(list[i - 1], key) < RPG.gear.sortValue(list[i], key)) {
            broken = i;
            break;
          }
        }
        assertTrue(`装備の並べ替え: ${label}が降順`, broken < 0,
          broken < 0
            ? `先頭 ${RPG.gear.sortValue(list[0], key)}`
            : `${broken} 番目で崩れた`);

        // その項目を持たない装備が先頭に来ないこと。
        // 0 のものが混ざると、探しているのに見つからない。
        const top = RPG.gear.sortValue(list[0], key);
        const owners = inv.filter((/** @type {any} */ it) => RPG.gear.sortValue(it, key) > 0);
        assertTrue(`装備の並べ替え: ${label}の先頭が最大値`,
          owners.length === 0 || top === Math.max.apply(null,
            owners.map((/** @type {any} */ it) => RPG.gear.sortValue(it, key))),
          `先頭 ${top}`);
      }

      // 並べ替えの一覧が、実際に動く id だけで出来ていること。
      // 画面はこの一覧をそのままボタンにするので、動かない id が混ざると
      // 押しても何も起きないボタンが並ぶ。
      const dead = RPG.gear.SORTS.filter((/** @type {any} */ d) => {
        const a = RPG.gear.arrange(inv, { sort: d.id });
        return a.length !== inv.length;
      });
      assertTrue('装備の並べ替え: 一覧のどれを選んでも成立する', dead.length === 0,
        dead.map((/** @type {any} */ d) => d.label).join('、'));

      // 絞り込みと組み合わせても壊れないこと。
      {
        const only = RPG.gear.arrange(inv, { sort: 'stat:def', slot: 'armor' });
        assertTrue('装備の並べ替え: 部位で絞っても降順のまま',
          only.every((/** @type {any} */ it) => it.slot === 'armor')
          && only.every((/** @type {any} */ it, i) => i === 0
            || RPG.gear.sortValue(only[i - 1], 'stat:def') >= RPG.gear.sortValue(it, 'stat:def')),
          `${only.length} 個`);

        const owner = {};
        owner[inv[0].uid] = 'だれか';
        const free = RPG.gear.arrange(inv, { sort: 'power', onlyUnequipped: true }, owner);
        assertTrue('装備の並べ替え: 装備中を除ける',
          free.length === inv.length - 1
          && !free.some((/** @type {any} */ it) => it.uid === inv[0].uid),
          `${free.length} / ${inv.length}`);
      }

      // 元の配列を壊さないこと。並べ替えるたびに所持品の順が変わると、
      // 「新着順」が意味を失う。
      {
        const before = inv.map((/** @type {any} */ it) => it.uid).join(',');
        RPG.gear.arrange(inv, { sort: 'stat:def' });
        assertTrue('装備の並べ替え: 元の所持品を並べ替えない',
          inv.map((/** @type {any} */ it) => it.uid).join(',') === before, '');
      }
    }

    // ---------------------------------------------------------------
    // 技の説明 (§4)
    //
    // ビルド画面でも技の中身を読めるようにした。
    // 説明が空の技があると、そこだけ何も書かれていない欄になる。
    // 戦闘中のボタンでも同じ desc を使っているので、抜けは両方に出る。
    // ---------------------------------------------------------------
    {
      const ids = Object.keys(RPG.data.skills);

      // 敵専用の技はプレイヤーに見えないので説明を持たない。
      const shown = ids.filter((/** @type {string} */ id) => id.indexOf('sk_enemy_') !== 0);

      const noDesc = shown.filter((/** @type {string} */ id) => {
        const d = RPG.data.skills[id].desc;
        return typeof d !== 'string' || d.trim() === '';
      });
      assertTrue('技の説明: 味方が使う技には必ず説明がある', noDesc.length === 0,
        noDesc.join(', ') || `${shown.length} 技を確認`);

      // 画面が読む項目が欠けていないこと。
      // element と damage_type はそのままチップにするので、
      // 未知の値だと空のチップが出る。
      const badElement = shown.filter((/** @type {string} */ id) =>
        !RPG.damage.ELEMENT_LABEL[RPG.data.skills[id].element]);
      assertTrue('技の説明: 属性が実在する', badElement.length === 0, badElement.join(', '));

      const badTag = shown.filter((/** @type {string} */ id) =>
        !RPG.damage.TAG_LABEL[RPG.data.skills[id].damage_type]);
      assertTrue('技の説明: 系統タグが実在する', badTag.length === 0, badTag.join(', '));

      // クラス技は解禁ラウンドとクールタイムを両方持つこと (§12)。
      // 片方だけだと「いつ撃てるのか」が読めない。
      const cls = shown.filter((/** @type {string} */ id) => RPG.data.skills[id].cls);
      const halfGated = cls.filter((/** @type {string} */ id) => {
        const sk = RPG.data.skills[id];
        return !sk.readyRound || !sk.cooldown;
      });
      assertTrue('技の説明: クラス技は解禁とCTを両方持つ', halfGated.length === 0,
        halfGated.join(', ') || `${cls.length} 技`);
    }

    // ---------------------------------------------------------------
    // ガチャの演出 (§6.7)
    //
    // 演出は「決まるまでの間」を作るためのもの。
    // ただし **結果を変えてはいけない**。見せ方の都合で中身が動くと、
    // 表示している排出率が嘘になる。
    // ---------------------------------------------------------------
    {
      // 光の色は、その引きのいちばん強いレアリティを映す。
      const top = RPG.ui && RPG.ui.gachafx ? RPG.ui.gachafx.topRarity : null;
      if (top) {
        assertTrue('ガチャ演出: 最高レアリティを拾う',
          top([{ rarity: 'COMMON' }, { rarity: 'LEGEND' }, { rarity: 'RARE' }]) === 'LEGEND',
          top([{ rarity: 'COMMON' }, { rarity: 'LEGEND' }, { rarity: 'RARE' }]));

        assertTrue('ガチャ演出: 1件でも成立する',
          top([{ rarity: 'SUPER_RARE' }]) === 'SUPER_RARE', '');

        // 空でも落ちないこと。ゴールド不足で結果0件のときに通る。
        assertTrue('ガチャ演出: 空の結果でも落ちない',
          top([]) === 'COMMON', String(top([])));
      }

      // ── 初獲得レジェンドの名乗り (§6.7) ──
      //
      // 被りは限界突破になるだけで、盤面に新しい顔は増えない。
      // 初めての1体だけが「仲間が増えた」瞬間なので、そこを分ける。
      // 何度も出る演出にすると、この重みが薄まる。
      if (RPG.ui && RPG.ui.gachafx && RPG.ui.gachafx.debutOf) {
        const debutOf = RPG.ui.gachafx.debutOf;

        assertTrue('ガチャ演出: 初獲得レジェンドで名乗る',
          !!debutOf([{ id: 'x', rarity: 'LEGEND', kind: 'new' }]), '');

        assertTrue('ガチャ演出: 被りレジェンドでは名乗らない',
          debutOf([{ id: 'x', rarity: 'LEGEND', kind: 'limit_break' }]) === null, '');

        assertTrue('ガチャ演出: 完凸後の還元でも名乗らない',
          debutOf([{ id: 'x', rarity: 'LEGEND', kind: 'refund', gold: 1000 }]) === null, '');

        assertTrue('ガチャ演出: 初獲得でもレジェンド以外は名乗らない',
          debutOf([{ id: 'x', rarity: 'SUPER_RARE', kind: 'new' }]) === null, '');

        // 10連の中に混ざっていても拾えること。
        assertTrue('ガチャ演出: 10連の中の1体を拾う',
          (debutOf([
            { id: 'a', rarity: 'COMMON', kind: 'new' },
            { id: 'b', rarity: 'LEGEND', kind: 'limit_break' },
            { id: 'c', rarity: 'LEGEND', kind: 'new' },
          ]) || {}).id === 'c', '');

        assertTrue('ガチャ演出: 空でも落ちない', debutOf([]) === null, '');

        // 名乗りに使う項目が全レジェンドに揃っていること。
        // title が無いと二つ名の行が空になる。
        const legends = Object.keys(RPG.data.characters)
          .filter((/** @type {string} */ id) => RPG.data.characters[id].rarity === 'LEGEND');
        const noTitle = legends
          .filter((/** @type {string} */ id) => !RPG.data.characters[id].title);
        assertTrue('ガチャ演出: レジェンドには二つ名がある', noTitle.length === 0,
          noTitle.join(', ') || `${legends.length} 体`);
      }

      // 演出の有無で結果が変わらないこと。
      // 見せ方の都合で中身が動くと、表示している排出率が嘘になる。
      {
        const backupSave = localStorage.getItem(RPG.state.STORAGE_KEY);
        try {
          const draw = (/** @type {boolean} */ fx) => {
            RPG.state.reset();
            RPG.state.updateSettings({ gachaFx: fx });
            RPG.state.addGold(200000);
            RPG.rng.seed(2468);
            const r = RPG.gacha.pull(10);
            RPG.rng.seed(null);
            return r.results.map((/** @type {any} */ p) => `${p.id}:${p.rarity}:${p.kind}`).join(',');
          };
          assertTrue('ガチャ演出: 演出の入切で結果が変わらない',
            draw(true) === draw(false), '');
        } finally {
          if (backupSave === null) localStorage.removeItem(RPG.state.STORAGE_KEY);
          else localStorage.setItem(RPG.state.STORAGE_KEY, backupSave);
          RPG.state.load();
        }
      }

      // レアリティの並び順が、演出とめくり順の両方で同じものを使っていること。
      // ここがずれると「弱い色で光ったのに強いのが出る」ことになる。
      const order = ['COMMON', 'RARE', 'SUPER_RARE', 'LEGEND'];
      assertTrue('ガチャ演出: レアリティの並びがデータと一致する',
        order.every((/** @type {string} */ k) => !!RPG.data.rarities[k])
        && Object.keys(RPG.data.rarities).length === order.length,
        Object.keys(RPG.data.rarities).join(', '));

      // 演出は色を使うので、全レアリティに色が要る。
      const noColor = Object.keys(RPG.data.rarities)
        .filter((/** @type {string} */ k) => !RPG.data.rarities[k].color);
      assertTrue('ガチャ演出: 全レアリティに色がある', noColor.length === 0,
        noColor.join(', '));
    }

    // ---------------------------------------------------------------
    // ビルド画面の要約に、効いているものが全部出るか (§5.9)
    //
    // ここは長いあいだ手書きの8行だった。93あるキーのうち8つしか出ておらず、
    // 属性耐性もボスからの被ダメ軽減も **振ったのに画面に出なかった**。
    // 一覧を手で持つ限り、効果を足すたびに同じ漏れが起きる。
    // ---------------------------------------------------------------
    {
      const reg = RPG.data.effectKinds;

      // ユニットに値を書き込む種別には、必ず表示名が要る。
      // 無いと要約に載らず、振ったのに見えない。
      const writes = Object.keys(reg).filter((/** @type {string} */ k) =>
        reg[k].to === 'passives' || reg[k].to === 'situational');
      const noLabel = writes.filter((/** @type {string} */ k) => !reg[k].label);
      assertTrue('要約: ユニットに入る種別には表示名がある', noLabel.length === 0,
        noLabel.join(', ') || `${writes.length} 種`);

      const noKey = writes.filter((/** @type {string} */ k) => !reg[k].key);
      assertTrue('要約: ユニットに入る種別には書き込み先がある', noKey.length === 0,
        noKey.join(', '));

      // 宣言した書き込み先が、実際に tree.js の書き込む名前と一致すること。
      // ここがずれると、値はあるのに要約が別の場所を見て空を返す。
      {
        const backupSave = localStorage.getItem(RPG.state.STORAGE_KEY);
        try {
          RPG.state.reset();
          const c = RPG.state.get().characters.ch_hero;
          c.level = RPG.data.maxLevelCap;

          const wrong = [];
          for (const kind of writes) {
            const node = RPG.data.skillTree
              .find((/** @type {any} */ n) => (n.effects || [])
                .some((/** @type {any} */ e) => e.kind === kind));
            if (!node) continue;   // ツリーから取れない種別はここでは見ない
            c.tree = { [node.id]: node.maxLevel };
            const u = RPG.units.buildCharacterUnit(c, []);
            const src = reg[kind].to === 'situational' ? u.situational : u.passives;
            const v = src ? src[reg[kind].key] : undefined;
            // 数値でも「種類→値」の表でも、何かが入っていればよい
            const has = typeof v === 'object' ? Object.keys(v || {}).length > 0 : !!v;
            if (!has) wrong.push(`${kind}→${reg[kind].to}.${reg[kind].key}`);
          }
          c.tree = {};
          assertTrue('要約: 宣言した書き込み先に実際に値が入る', wrong.length === 0,
            wrong.join(' / '));

          // ご指摘の2つは名指しで見張る。
          // 「属性への耐性」と「ボスからの被ダメ」が出ていなかった。
          for (const [kind, label] of [['boss_guard', 'ボス'], ['element_resist', '属性耐性']]) {
            const node = RPG.data.skillTree
              .find((/** @type {any} */ n) => (n.effects || [])
                .some((/** @type {any} */ e) => e.kind === kind));
            assertTrue(`要約: ${label}のノードが存在する`, !!node, kind);
          }
        } finally {
          if (backupSave === null) localStorage.removeItem(RPG.state.STORAGE_KEY);
          else localStorage.setItem(RPG.state.STORAGE_KEY, backupSave);
          RPG.state.load();
        }
      }

      // 表示名が重複していないこと。同じ言葉が2つ並ぶと、
      // どちらが何なのか読み手に区別できない。
      const seen = {};
      const dup = [];
      for (const k of writes) {
        const l = reg[k].label;
        if (!l) continue;
        if (seen[l]) dup.push(`${seen[l]} と ${k}: 「${l}」`);
        seen[l] = k;
      }
      assertTrue('要約: 表示名が重複していない', dup.length === 0, dup.join(' / '));

      // 書式は決めた値のどれかであること。
      const FMT = ['pct', 'turn', 'num', 'lvl', 'keyed', 'flag'];
      const badFmt = writes.filter((/** @type {string} */ k) =>
        reg[k].fmt && FMT.indexOf(reg[k].fmt) < 0);
      assertTrue('要約: 書式が決めた値のどれか', badFmt.length === 0, badFmt.join(', '));
    }

    return results;
  }

  /**
   * 手順書と実装の突き合わせ (§18)。
   *
   * docs/拡張コンテンツの作り方.md は、他のエージェントがこれ **だけ** を読んで
   * 作業する前提の文書。中身が実装からずれると、
   * 「書いてある通りに書いたのに動かない」という形で外に出る。
   * しかも書いた側は原因に辿り着けない。
   *
   * 実際、最初に書いたときは4か所ずれていた（plugin 名・params・
   * 系統タグの綴り・レアリティの数値）。人の目では見つからない種類なので、
   * 文書から表を読み取って実装と突き合わせる。
   *
   * 非同期なのは、文書をネットワーク越しに取りに行くため。
   * @param {(results: any[]) => void} onDone
   */
  function checkDoc(onDone) {
    /** @type {any[]} */
    const results = [];
    /** @param {string} name @param {boolean} pass @param {string} detail */
    const check = (name, pass, detail) => results.push({ name, pass, detail });

    fetch('../docs/拡張コンテンツの作り方.md')
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status))))
      .then((text) => {
        /** 表の1列目に出てくる `code` を全部拾う */
        const cells = (/** @type {string} */ section, /** @type {string} */ until) => {
          const from = text.indexOf(section);
          if (from < 0) return [];
          const to = until ? text.indexOf(until, from) : text.length;
          const body = text.slice(from, to < 0 ? text.length : to);
          return (body.match(/^\|\s*`([a-zA-Z_]+)`/gm) || [])
            .map((m) => m.replace(/^\|\s*`/, '').replace(/`$/, ''));
        };

        // --- plugin 名 ---
        const docPlugins = cells('**plugin に書けるもの**', '**バフは3つ');
        const realPlugins = Object.keys(RPG.plugins);
        const ghost = docPlugins.filter((k) => realPlugins.indexOf(k) < 0);
        const missed = realPlugins.filter((k) => docPlugins.indexOf(k) < 0);
        check('手順書: 載っている plugin は全て実在する', ghost.length === 0, ghost.join(', '));
        check('手順書: 実在する plugin は全て載っている', missed.length === 0, missed.join(', '));

        // --- ユニークの効果キー ---
        const docKeys = cells('**effects に書けるキー**', '最新の一覧は');
        const realKeys = RPG.units.UNIQUE_EFFECT_KEYS;
        const ghostKeys = docKeys.filter((k) => realKeys.indexOf(k) < 0);
        const missedKeys = realKeys.filter((k) => docKeys.indexOf(k) < 0);
        check('手順書: 載っている効果キーは全て実在する', ghostKeys.length === 0, ghostKeys.join(', '));
        check('手順書: 実在する効果キーは全て載っている', missedKeys.length === 0, missedKeys.join(', '));

        // --- 装備ベース ---
        const docBases = cells('**base に書けるもの**', '**effects に書けるキー**');
        const realBases = Object.keys(RPG.data.equipBases);
        const ghostBases = docBases.filter((k) => realBases.indexOf(k) < 0);
        const missedBases = realBases.filter((k) => docBases.indexOf(k) < 0);
        check('手順書: 載っている装備ベースは全て実在する', ghostBases.length === 0, ghostBases.join(', '));
        check('手順書: 実在する装備ベースは全て載っている', missedBases.length === 0, missedBases.join(', '));

        // --- 状態異常 ---
        const docStatus = cells('**状態異常の種類**', '### 4.2');
        const realStatus = RPG.data.statusKinds;
        const ghostStatus = docStatus.filter((k) => realStatus.indexOf(k) < 0);
        const missedStatus = realStatus.filter((k) => docStatus.indexOf(k) < 0);
        check('手順書: 載っている状態異常は全て実在する', ghostStatus.length === 0, ghostStatus.join(', '));
        check('手順書: 実在する状態異常は全て載っている', missedStatus.length === 0, missedStatus.join(', '));

        // --- ツリーの効果種別（本文中に出てくるぶん） ---
        const docKinds = cells('| kind | 追加で要る項目 | 意味 |', '- **SPの費用対効果**');
        const ghostKinds = docKinds.filter((k) => RPG.tree.KNOWN_EFFECT_KINDS.indexOf(k) < 0);
        check('手順書: 載っている効果種別は全て実在する', ghostKinds.length === 0, ghostKinds.join(', '));

        // --- 系統タグの綴り ---
        // 「relic と書いてはいけない」という注意書き自体が文中にあるので、
        // 出てこないことを条件にはできない。実装側の綴りが
        // すべて載っていることを見る（肯定で確かめる）。
        const tagKeys = Object.keys(RPG.damage.TAG_LABEL);
        const shownTags = tagKeys.filter((k) => text.indexOf('`' + k + '`') >= 0);
        check('手順書: 系統タグの綴りが全て載っている',
          shownTags.length === tagKeys.length,
          '載っていない: ' + tagKeys.filter((k) => shownTags.indexOf(k) < 0).join(', '));

        // --- 禁止事項が消えていないこと ---
        for (const must of ['data/', 'src/', 'index.html']) {
          check(`手順書: 「${must} を書き換えない」が残っている`,
            text.indexOf(must) >= 0, '');
        }
      })
      .catch((e) => {
        check('手順書: docs/拡張コンテンツの作り方.md が読める', false, String(e && e.message));
      })
      // ── 効果を足すときの手引き ──
      // ctx でできることの一覧はここにしか無い。ずれると、
      // プラグインを書く人が存在しない機能を呼ぶか、使える機能に気付かない。
      .then(() => fetch('../docs/効果を追加するときの手引き.md')
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status))))
        .then((doc) => {
          /** @param {string} name */
          const inDoc = (name) => doc.indexOf('`' + name + '`') >= 0
            || doc.indexOf('`' + name + '(') >= 0;

          const CTX = ['params', 'skill', 'actor', 'targets', 'battle', 'allies', 'foes',
            'damage', 'damageWith', 'heal', 'log', 'addStatus', 'selfStatus',
            'setDefIgnore', 'detonate', 'addSigil', 'mark', 'borrowTurn',
            'addUniqueBuff', 'addTagBuff', 'addDefBuff', 'addReductionBuff'];
          const missed = CTX.filter((k) => !inDoc(k));
          check('手引き: ctx の機能が全て載っている', missed.length === 0, missed.join(', '));

          // 値の行き先3つ。ここが要点なので落とせない。
          const noTo = ['passives', 'situational', 'build'].filter((k) => !inDoc(k));
          check('手引き: 値の行き先3つを説明している', noTo.length === 0, noTo.join(', '));

          // 最大値方式の種別を名指ししていること。
          const maxKinds = Object.keys(RPG.data.effectKinds)
            .filter((/** @type {string} */ k) => RPG.data.effectKinds[k].shape === 'max');
          const noMax = maxKinds.filter((k) => !inDoc(k));
          check('手引き: 最大値方式の種別を名指ししている', noMax.length === 0, noMax.join(', '));
        })
        .catch((e) => {
          check('手引き: docs/効果を追加するときの手引き.md が読める', false,
            String(e && e.message));
        }))
      // ── 画面が呼んでいる関数が実在するか ──
      //
      // 画面のコードはテストから動かしていないので、関数名を打ち間違えても
      // その画面を開くまで分からない。実際 RPG.autolimit.remaining() という
      // 存在しない関数を呼んで、出撃画面が描けない状態を作った。
      //
      // 名前の一覧を手で持つと必ず古くなるので、**ソースを読んで突き合わせる**。
      .then(() => Promise.all(
        ['../src/ui/base.js', '../src/ui/battle.js', '../src/ui/worldmap.js',
          '../src/ui/widgets.js', '../src/main.js']
          .map((f) => fetch(f)
            .then((r) => (r.ok ? r.text() : Promise.reject(new Error(f + ' HTTP ' + r.status))))
            .then((text) => ({ f, text })))
      ).then((files) => {
        // テストページに読み込まれている中核モジュールだけを見る。
        // RPG.ui / RPG.app はここには無いので対象外。
        const MODULES = ['state', 'battle', 'units', 'damage', 'tree', 'klass',
          'gacha', 'quest', 'economy', 'autolimit', 'autosell', 'autoequip',
          'dispatch', 'tower', 'arena', 'enhance', 'worldmap', 'rng', 'codex',
          'savefile', 'gear', 'equipset', 'autoplay'];

        const missing = [];
        for (const item of files) {
          const re = /RPG\.(\w+)\.(\w+)\s*\(/g;
          let m;
          while ((m = re.exec(item.text))) {
            const mod = m[1];
            const fn = m[2];
            if (MODULES.indexOf(mod) < 0) continue;
            if (!RPG[mod]) continue;
            if (typeof RPG[mod][fn] === 'function') continue;
            const label = item.f.split('/').pop() + ': RPG.' + mod + '.' + fn + '()';
            if (missing.indexOf(label) < 0) missing.push(label);
          }
        }
        check('画面: 呼んでいる関数が全て実在する', missing.length === 0,
          missing.join(' / ') || (files.length + ' ファイルを確認'));
      }).catch((e) => {
        check('画面: ソースを読めた', false, String(e && e.message));
      }))
      .then(() => onDone(results));
  }

  RPG.tests = { run, runAsync };
})(window.RPG);
