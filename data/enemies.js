// 敵カタログ (§9.2)
// level はフィールド側で上書きされる。base/growth はキャラと同じ計算式。
// drops: 勝利時に加算される宝箱。§2.2 のとおり「宝箱ID + 個数」のフラグ加算のみを行い、
//        装備の具体的な性能生成は拠点の鑑定で行う。
//
// ── 数値の決め方（test/balance.html の実測に基づく）──
// 各フィールドの推奨レベルで「パーティが1ラウンドに出せる総ダメージ」を測り、そこから逆算している。
//   通常敵HP … パーティ火力の約0.6ラウンド分（2〜3体のウェーブを1.2〜1.8ラウンドで処理）
//   ボスHP   … パーティ火力の約4ラウンド分（ボス補正1.5倍を含めた値）
// これで5連戦がだいたい9〜12ラウンドに収まる。
RPG.data.enemies = {
  /* ======================= 始まりの草原（敵Lv3 / パーティ火力 約1,065） ======================= */
  em_slime: {
    name: 'スライム', element: 'water',
    base: { hp: 500, atk: 80, def: 24, magi_power: 53 },
    growth: { hp: 65, atk: 7.1, def: 2.4, magi_power: 4.4 },
    skills: ['sk_enemy_bite', 'sk_enemy_splash'],
    gold: 14, exp: 12,
    drops: [{ box: 'box_bronze', chance: 0.5, count: 1 }],
    color: '#6fb7ff', glyph: '粘',
  },
  em_wolf: {
    name: '荒野の狼', element: 'wind',
    base: { hp: 570, atk: 110, def: 29, magi_power: 36 },
    growth: { hp: 73, atk: 9.8, def: 2.6, magi_power: 2.7 },
    skills: ['sk_enemy_bite', 'sk_enemy_claw'],
    gold: 18, exp: 16,
    drops: [{ box: 'box_bronze', chance: 0.6, count: 1 }],
    color: '#9be0b0', glyph: '狼',
  },
  em_ember_bat: {
    name: '燼のコウモリ', element: 'fire',
    base: { hp: 460, atk: 88, def: 22, magi_power: 98 },
    growth: { hp: 59, atk: 7.1, def: 2.2, magi_power: 8.0 },
    skills: ['sk_enemy_ember', 'sk_enemy_bite'],
    gold: 20, exp: 18,
    drops: [{ box: 'box_bronze', chance: 0.7, count: 1 }],
    color: '#ff8e6b', glyph: '燼',
  },

  /* ======================= 崩れた廃坑（敵Lv14 / パーティ火力 約2,593） ======================= */
  em_golem: {
    name: '廃坑のゴーレム', element: 'earth',
    base: { hp: 1100, atk: 119, def: 108, magi_power: 35 },
    growth: { hp: 90, atk: 9.1, def: 7.2, magi_power: 2.8 },
    skills: ['sk_enemy_quake', 'sk_enemy_claw'],
    gold: 46, exp: 45,
    drops: [{ box: 'box_silver', chance: 0.5, count: 1 }],
    color: '#b59a72', glyph: '岩',
  },
  em_wisp: {
    name: '坑道の鬼火', element: 'dark',
    base: { hp: 560, atk: 77, def: 36, magi_power: 147 },
    growth: { hp: 45, atk: 5.6, def: 3.0, magi_power: 11.2 },
    skills: ['sk_enemy_shadow', 'sk_enemy_ember'],
    gold: 43, exp: 42,
    drops: [{ box: 'box_silver', chance: 0.45, count: 1 }],
    color: '#a97bff', glyph: '火',
  },
  em_gale_hawk: {
    name: '烈風の鷹', element: 'wind',
    base: { hp: 620, atk: 168, def: 41, magi_power: 56 },
    growth: { hp: 48, atk: 12.6, def: 3.1, magi_power: 4.2 },
    skills: ['sk_enemy_gust', 'sk_enemy_claw'],
    gold: 50, exp: 48,
    drops: [{ box: 'box_silver', chance: 0.5, count: 1 }],
    color: '#8fe8d8', glyph: '鷹',
  },

  /* ======================= 灼獄竜の巣（敵Lv32 / パーティ火力 約6,650） ======================= */
  em_drake: {
    name: '幼竜ドレイク', element: 'fire',
    base: { hp: 1300, atk: 160, def: 126, magi_power: 145 },
    growth: { hp: 101, atk: 11.6, def: 9.6, magi_power: 10.6 },
    skills: ['sk_enemy_dragon_breath', 'sk_enemy_rend'],
    gold: 105, exp: 120,
    drops: [{ box: 'box_gold', chance: 0.5, count: 1 }],
    color: '#ff7a4d', glyph: '竜',
  },
  em_dark_knight: {
    name: '朽ちた黒騎士', element: 'dark',
    base: { hp: 1400, atk: 175, def: 156, magi_power: 88 },
    growth: { hp: 112, atk: 12.6, def: 11.4, magi_power: 5.8 },
    skills: ['sk_enemy_rend', 'sk_enemy_shadow'],
    gold: 112, exp: 130,
    drops: [{ box: 'box_gold', chance: 0.5, count: 1 }],
    color: '#8a7bd8', glyph: '朽',
  },

  /* ======================= 忘却の遺構（敵Lv55 / パーティ火力 約20,457） ======================= */
  em_sentinel: {
    name: '遺構の番人', element: 'none',
    base: { hp: 4200, atk: 180, def: 340, magi_power: 84 },
    growth: { hp: 174, atk: 12.4, def: 24, magi_power: 5.5 },
    skills: ['sk_enemy_pulse', 'sk_enemy_crush'],
    gold: 120, exp: 320,
    drops: [{ box: 'box_gold', chance: 0.8, count: 1 }],
    color: '#9fb4c8', glyph: '番',
  },
  em_frost_maiden: {
    name: '氷結の乙女', element: 'water',
    base: { hp: 3500, atk: 105, def: 190, magi_power: 255 },
    growth: { hp: 144, atk: 6.9, def: 13, magi_power: 18 },
    skills: ['sk_enemy_frost', 'sk_enemy_pulse'],
    gold: 118, exp: 310,
    drops: [{ box: 'box_gold', chance: 0.75, count: 1 }],
    color: '#a8e0ff', glyph: '氷',
  },
  em_thunder_beast: {
    name: '雷霆の獣', element: 'wind',
    base: { hp: 3700, atk: 240, def: 170, magi_power: 105 },
    growth: { hp: 156, atk: 17.2, def: 12, magi_power: 6.9 },
    skills: ['sk_enemy_thunder', 'sk_enemy_gust'],
    gold: 125, exp: 330,
    drops: [{ box: 'box_gold', chance: 0.8, count: 1 }],
    color: '#ffe066', glyph: '雷',
  },
  em_ash_revenant: {
    name: '灰の亡霊', element: 'dark',
    base: { hp: 3600, atk: 155, def: 180, magi_power: 200 },
    growth: { hp: 149, atk: 10.3, def: 12, magi_power: 13.8 },
    skills: ['sk_enemy_wither', 'sk_enemy_shadow'],
    gold: 120, exp: 320,
    drops: [{ box: 'box_gold', chance: 0.75, count: 1 },
            { box: 'box_dragon', chance: 0.08, count: 1 }],
    color: '#b0a0c0', glyph: '灰',
  },

  /* ======================= 終焉の深淵（敵Lv90 / パーティ火力 約66,435） ======================= */
  em_void_titan: {
    name: '虚無の巨兵', element: 'none',
    base: { hp: 8800, atk: 330, def: 560, magi_power: 158 },
    growth: { hp: 400, atk: 23, def: 38, magi_power: 10.9 },
    skills: ['sk_enemy_crush', 'sk_enemy_pulse'],
    gold: 320, exp: 900,
    drops: [{ box: 'box_dragon', chance: 0.5, count: 1 }],
    color: '#7d8698', glyph: '虚',
  },
  em_solar_seraph: {
    name: '灼陽の熾天使', element: 'light',
    base: { hp: 7100, atk: 220, def: 400, magi_power: 415 },
    growth: { hp: 324, atk: 15.1, def: 27, magi_power: 29 },
    skills: ['sk_enemy_judgment', 'sk_enemy_dragon_breath'],
    gold: 315, exp: 880,
    drops: [{ box: 'box_dragon', chance: 0.5, count: 1 }],
    color: '#ffe9a8', glyph: '熾',
  },
  em_abyss_serpent: {
    name: '深淵の大蛇', element: 'dark',
    base: { hp: 7900, atk: 370, def: 360, magi_power: 264 },
    growth: { hp: 361, atk: 25.5, def: 24, magi_power: 18.2 },
    skills: ['sk_enemy_devour', 'sk_enemy_wither'],
    gold: 325, exp: 890,
    drops: [{ box: 'box_dragon', chance: 0.55, count: 1 }],
    color: '#8a6bd8', glyph: '蛇',
  },

  /* ======================= ボス ======================= */
  bs_gnaw_king: {
    name: '喰王ガルグ', element: 'earth', boss: true,
    base: { hp: 2500, atk: 133, def: 72, magi_power: 77 },
    growth: { hp: 160, atk: 10.5, def: 5.4, magi_power: 5.6 },
    skills: ['sk_enemy_quake', 'sk_enemy_claw', 'sk_enemy_bite'],
    gold: 130, exp: 150,
    drops: [{ box: 'box_silver', chance: 1.0, count: 1 }, { box: 'box_gold', chance: 0.3, count: 1 }],
    color: '#d8a24d', glyph: '喰',
  },
  bs_mine_tyrant: {
    name: '坑底の暴君', element: 'dark', boss: true,
    base: { hp: 3400, atk: 210, def: 168, magi_power: 182 },
    growth: { hp: 271, atk: 15.4, def: 12, magi_power: 13.3 },
    skills: ['sk_enemy_shadow', 'sk_enemy_rend', 'sk_enemy_quake'],
    gold: 300, exp: 380,
    drops: [{ box: 'box_gold', chance: 1.0, count: 1 }, { box: 'box_dragon', chance: 0.25, count: 1 }],
    color: '#7d5fd8', glyph: '暴',
  },
  bs_flame_wyrm: {
    name: '灼獄竜ヴァルガ', element: 'fire', boss: true,
    base: { hp: 5000, atk: 250, def: 240, magi_power: 240 },
    growth: { hp: 405, atk: 19.3, def: 16.8, magi_power: 18.3 },
    skills: ['sk_enemy_dragon_breath', 'sk_enemy_rend', 'sk_enemy_ember'],
    gold: 720, exp: 900,
    drops: [{ box: 'box_gold', chance: 1.0, count: 2 }, { box: 'box_dragon', chance: 1.0, count: 1 }],
    color: '#ff5a2d', glyph: '灼',
  },
  bs_ruin_keeper: {
    name: '遺構統制機関ゼロス', element: 'none', boss: true,
    base: { hp: 16000, atk: 275, def: 430, magi_power: 235 },
    growth: { hp: 713, atk: 19.3, def: 30, magi_power: 16.5 },
    skills: ['sk_enemy_pulse', 'sk_enemy_crush', 'sk_enemy_devour'],
    gold: 900, exp: 2200,
    drops: [{ box: 'box_gold', chance: 1.0, count: 2 }, { box: 'box_dragon', chance: 0.7, count: 1 }],
    color: '#c8d4e0', glyph: '零',
  },
  bs_end_dragon: {
    name: '終焉竜アポカリュプス', element: 'dark', boss: true,
    base: { hp: 42000, atk: 520, def: 720, magi_power: 530 },
    growth: { hp: 1130, atk: 35, def: 48, magi_power: 36.5 },
    skills: ['sk_enemy_apocalypse', 'sk_enemy_devour', 'sk_enemy_judgment'],
    gold: 2400, exp: 7000,
    drops: [{ box: 'box_dragon', chance: 1.0, count: 3 }],
    color: '#6b4a9e', glyph: '終',
  },
  /* ======================= 灰燼の果て（敵Lv125 / パーティ火力 約190,000） ======================= */
  em_cinder_queen: {
    name: '燼獄の女王', element: 'fire',
    base: { hp: 11000, atk: 430, def: 620, magi_power: 560 },
    growth: { hp: 430, atk: 20, def: 26, magi_power: 24 },
    skills: ['sk_enemy_dragon_breath', 'sk_enemy_judgment'],
    gold: 520, exp: 2100,
    drops: [{ box: 'box_dragon', chance: 0.72, count: 1 }],
    color: '#ff6a3d', glyph: '燼',
  },
  em_glass_sentinel: {
    name: '硝子の看守', element: 'none',
    base: { hp: 13000, atk: 400, def: 820, magi_power: 340 },
    growth: { hp: 510, atk: 18, def: 34, magi_power: 15 },
    skills: ['sk_enemy_crush', 'sk_enemy_pulse'],
    gold: 510, exp: 2050,
    drops: [{ box: 'box_dragon', chance: 0.72, count: 1 }],
    color: '#cfe3f0', glyph: '硝',
  },
  em_hollow_choir: {
    name: '虚ろの聖歌隊', element: 'light',
    base: { hp: 10500, atk: 380, def: 560, magi_power: 700 },
    growth: { hp: 405, atk: 17, def: 23, magi_power: 30 },
    skills: ['sk_enemy_judgment', 'sk_enemy_wither'],
    gold: 530, exp: 2150,
    drops: [{ box: 'box_dragon', chance: 0.75, count: 1 }],
    color: '#fff0c0', glyph: '聖',
  },

  /* ======================= 創世の残響（敵Lv170 / パーティ火力 約250,000） ======================= */
  em_first_flame: {
    name: '原初の焔', element: 'fire',
    base: { hp: 17000, atk: 620, def: 880, magi_power: 800 },
    growth: { hp: 620, atk: 26, def: 34, magi_power: 31 },
    skills: ['sk_enemy_dragon_breath', 'sk_enemy_apocalypse'],
    gold: 900, exp: 5200,
    drops: [{ box: 'box_dragon', chance: 0.90, count: 1 },
            { box: 'box_astral', chance: 0.10, count: 1 }],
    color: '#ffb060', glyph: '焔',
  },
  em_null_weaver: {
    name: '無を織る者', element: 'dark',
    base: { hp: 18000, atk: 670, def: 830, magi_power: 750 },
    growth: { hp: 650, atk: 28, def: 32, magi_power: 29 },
    skills: ['sk_enemy_devour', 'sk_enemy_wither'],
    gold: 920, exp: 5300,
    drops: [{ box: 'box_dragon', chance: 0.90, count: 1 },
            { box: 'box_astral', chance: 0.10, count: 1 }],
    color: '#9a7bd8', glyph: '織',
  },
  em_world_root: {
    name: '世界樹の残骸', element: 'earth',
    base: { hp: 22000, atk: 560, def: 1000, magi_power: 660 },
    growth: { hp: 780, atk: 24, def: 39, magi_power: 26 },
    skills: ['sk_enemy_quake', 'sk_enemy_crush'],
    gold: 940, exp: 5400,
    drops: [{ box: 'box_dragon', chance: 0.95, count: 1 },
            { box: 'box_astral', chance: 0.12, count: 1 }],
    color: '#a8c88a', glyph: '樹',
  },

  /* ======================= 追加フィールドのボス ======================= */
  bs_ashen_monarch: {
    name: '灰燼帝ネロ', element: 'fire', boss: true,
    base: { hp: 40000, atk: 600, def: 800, magi_power: 760 },
    growth: { hp: 1300, atk: 27, def: 33, magi_power: 31 },
    skills: ['sk_enemy_apocalypse', 'sk_enemy_dragon_breath', 'sk_enemy_judgment'],
    gold: 4200, exp: 15000,
    drops: [{ box: 'box_dragon', chance: 1.0, count: 3 }],
    color: '#ff7a2d', glyph: '帝',
  },
  /* ── 封絶区画 (§10.9) ──
   *
   * 第一章でリゼルに「旧いのは炉の中で止まってる」と言わせている。
   * 外は変異した生態系、機械は遮蔽された施設の内側、という切り分けを
   * 敵の側でも守るため、機械はここにしか出さない。
   *
   * 数値は 創世の残響(敵170) と 終わりなき回廊(敵200) のあいだに置いてある。
   */
  em_warden_unit: {
    name: '巡回機ヴァルグ', element: 'none',
    base: { hp: 12500, atk: 500, def: 730, magi_power: 400 },
    growth: { hp: 470, atk: 21, def: 29, magi_power: 17 },
    skills: ['sk_enemy_crush', 'sk_enemy_pulse'],
    gold: 620, exp: 3200,
    drops: [{ box: 'box_dragon', chance: 0.5, count: 1 }],
    color: '#9aa6b8', glyph: '巡',
    desc: '止まる命令を受け取れないまま、同じ順路を歩き続けている警備機。',
  },

  em_ash_sifter: {
    name: '灰漉しの腕', element: 'earth',
    base: { hp: 15500, atk: 460, def: 640, magi_power: 510 },
    growth: { hp: 580, atk: 20, def: 25, magi_power: 22 },
    skills: ['sk_enemy_quake', 'sk_enemy_wither'],
    gold: 660, exp: 3400,
    drops: [{ box: 'box_dragon', chance: 0.55, count: 1 }],
    color: '#b08a5c', glyph: '漉',
    desc: '灰を選り分けるための腕。選り分ける対象を、もう区別していない。',
  },

  em_index_wraith: {
    name: '索引の亡霊', element: 'dark',
    base: { hp: 10500, atk: 570, def: 520, magi_power: 720 },
    growth: { hp: 410, atk: 25, def: 21, magi_power: 30 },
    skills: ['sk_enemy_wither', 'sk_enemy_judgment'],
    gold: 700, exp: 3600,
    drops: [{ box: 'box_dragon', chance: 0.5, count: 1 },
            { box: 'box_astral', chance: 0.06, count: 1 }],
    color: '#a06fd0', glyph: '索',
    desc: '焼けた索引の読み残し。誰を納めたかを、途切れ途切れに唱え続けている。',
  },

  bs_first_warden: {
    name: '初代管理機ウーヌス', element: 'light', boss: true,
    base: { hp: 44000, atk: 640, def: 820, magi_power: 740 },
    growth: { hp: 1400, atk: 28, def: 33, magi_power: 31 },
    skills: ['sk_enemy_judgment', 'sk_enemy_apocalypse', 'sk_enemy_pulse'],
    gold: 5000, exp: 18000,
    drops: [{ box: 'box_astral', chance: 1, count: 1 },
            { box: 'box_dragon', chance: 1, count: 2 }],
    color: '#ffe9a8', glyph: '壹',
    desc: '最初の管理者に付けられた機体。渡す相手を待ち続け、'
      + '待ちきれずに「渡す」の意味を書き換えた。',
  },

  /* ── 封絶の浅層 (§20.6 / 第三章) ──
   *
   * 既存の機械（em_warden_unit ほか）は base hp 15500 などで、
   * 敵レベルを下げても **base がそのまま床になる**ので序盤には置けない。
   * ストーリーは Lv1 から始まる別プロファイルなので、この帯用に作り直す。
   *
   * 目盛りは em_golem(hp1100 atk119 def108) と
   * bs_gnaw_king(hp2500 atk133 def72) のあいだ。
   *
   * 第一章で「旧いのは炉の中で止まってる。外にいるのは、ぜんぶ生き物」と
   * 言わせているので、機械は炉の内側にしか出さない。ここはその内側にあたる。
   */
  em_hall_lamp: {
    name: '灯し番', element: 'light',
    base: { hp: 760, atk: 96, def: 58, magi_power: 120 },
    growth: { hp: 62, atk: 7.4, def: 4.0, magi_power: 8.2 },
    skills: ['sk_enemy_pulse', 'sk_enemy_claw'],
    gold: 34, exp: 30,
    drops: [{ box: 'box_silver', chance: 0.35, count: 1 }],
    color: '#ffe9b0', glyph: '灯',
    desc: '通路を照らすためだけの機械。照らす相手がいなくなっても、まだ照らしている。',
  },

  em_scribe_unit: {
    name: '記録機', element: 'dark',
    base: { hp: 640, atk: 88, def: 44, magi_power: 148 },
    growth: { hp: 54, atk: 6.6, def: 3.2, magi_power: 10.4 },
    skills: ['sk_enemy_shadow', 'sk_enemy_wither'],
    gold: 40, exp: 36,
    drops: [{ box: 'box_silver', chance: 0.4, count: 1 }],
    color: '#a98fd0', glyph: '記',
    desc: '書き取るための機械。書く先が尽きたので、同じ行を上から何度も重ねている。',
  },

  em_gate_frame: {
    name: '門枠', element: 'earth',
    base: { hp: 1450, atk: 104, def: 142, magi_power: 40 },
    growth: { hp: 108, atk: 8.0, def: 8.8, magi_power: 3.0 },
    skills: ['sk_enemy_crush', 'sk_enemy_quake'],
    gold: 48, exp: 44,
    drops: [{ box: 'box_silver', chance: 0.45, count: 1 },
            { box: 'box_gold', chance: 0.05, count: 1 }],
    color: '#8d9aa8', glyph: '門',
    desc: '扉ではなく、扉の枠。閉じるものが失われても、通す相手を選び続けている。',
  },

  bs_second_warden: {
    name: '二番機ドゥオ', element: 'none', boss: true,
    base: { hp: 3000, atk: 176, def: 128, magi_power: 150 },
    growth: { hp: 218, atk: 13.2, def: 9.6, magi_power: 11.0 },
    skills: ['sk_enemy_pulse', 'sk_enemy_crush', 'sk_enemy_rend'],
    gold: 260, exp: 340,
    drops: [{ box: 'box_gold', chance: 1, count: 1 },
            { box: 'box_silver', chance: 1, count: 2 }],
    color: '#c9d4e0', glyph: '弐',
    desc: '一番機の次に作られた機体。命令の写しを預かっていたが、'
      + '写した相手が黙ったので、写しのほうを本物として守っている。',
  },

  bs_genesis_echo: {
    name: '創世の残響', element: 'none', boss: true,
    base: { hp: 68000, atk: 900, def: 1150, magi_power: 1000 },
    growth: { hp: 2000, atk: 40, def: 46, magi_power: 42 },
    skills: ['sk_enemy_apocalypse', 'sk_enemy_devour', 'sk_enemy_judgment'],
    gold: 9000, exp: 34000,
    drops: [{ box: 'box_dragon', chance: 1.0, count: 6 },
            { box: 'box_astral', chance: 1.0, count: 1 }],
    color: '#e8e0ff', glyph: '創',
  },
  /* ── 臨界の際 (§10.9) ──────────────────────────
   *
   * 傾斜を登りきる**寸前**で足踏みしているものたち。
   * まだ形が残っているので、数で来る。
   * 世界設定でいう「甲→丙」の途中、臨界点の手前にいる連中。
   */
  em_half_crossed: {
    name: '渡りかけ', element: 'none',
    base: { hp: 16000, atk: 600, def: 850, magi_power: 780 },
    growth: { hp: 550, atk: 23, def: 30, magi_power: 28 },
    skills: ['sk_enemy_crush', 'sk_enemy_rend'],
    gold: 1000, exp: 5800,
    drops: [{ box: 'box_dragon', chance: 0.92, count: 1 },
            { box: 'box_astral', chance: 0.12, count: 1 }],
    color: '#b9b3c8', glyph: '渡',
    desc: '人の形へ寄りきれなかった何か。輪郭が定まらないまま歩いている。',
  },

  em_husk_choir: {
    name: '名残の合唱', element: 'light',
    base: { hp: 15200, atk: 585, def: 890, magi_power: 830 },
    growth: { hp: 530, atk: 22, def: 32, magi_power: 30 },
    skills: ['sk_enemy_judgment', 'sk_enemy_pulse'],
    gold: 1000, exp: 5800,
    drops: [{ box: 'box_dragon', chance: 0.92, count: 1 },
            { box: 'box_astral', chance: 0.12, count: 1 }],
    color: '#ffeec8', glyph: '唱',
    desc: '幾人ぶんかの声が重なって鳴っている。誰の声かはもう分けられない。',
  },

  em_gradient_hound: {
    name: '傾斜の猟犬', element: 'dark',
    base: { hp: 15600, atk: 640, def: 820, magi_power: 720 },
    growth: { hp: 540, atk: 25, def: 29, magi_power: 26 },
    skills: ['sk_enemy_devour', 'sk_enemy_claw'],
    gold: 1000, exp: 5800,
    drops: [{ box: 'box_dragon', chance: 0.92, count: 1 },
            { box: 'box_astral', chance: 0.12, count: 1 }],
    color: '#7a6a9e', glyph: '猟',
    desc: '獣が人型へ寄る途中で止まっている。四つ足のまま、手だけが人のもの。',
  },

  bs_verge_warden: {
    name: '際の番', element: 'none', boss: true,
    base: { hp: 70000, atk: 920, def: 1150, magi_power: 1020 },
    growth: { hp: 1900, atk: 36, def: 42, magi_power: 39 },
    skills: ['sk_enemy_apocalypse', 'sk_enemy_crush', 'sk_enemy_rend'],
    gold: 11000, exp: 40000,
    drops: [{ box: 'box_dragon', chance: 1.0, count: 7 },
            { box: 'box_astral', chance: 1.0, count: 1 }],
    color: '#d8d0e8', glyph: '際',
    desc: '越えずに立ち続けている者。越えれば誰でもなくなると知っている。',
  },

  /* ── 還らぬ位相 (§10.9) ──────────────────────────
   *
   * 臨界点を**越えてしまった**もの。もう生物ではないので、数で来ない。
   * 1体が桁違いに濃い。
   */
  em_pure_ether: {
    name: '純度', element: 'none',
    base: { hp: 30000, atk: 700, def: 900, magi_power: 850 },
    growth: { hp: 1000, atk: 24, def: 30, magi_power: 28 },
    skills: ['sk_enemy_apocalypse', 'sk_enemy_pulse', 'sk_enemy_devour'],
    gold: 2600, exp: 15000,
    drops: [{ box: 'box_dragon', chance: 1.0, count: 2 },
            { box: 'box_astral', chance: 0.35, count: 1 }],
    color: '#f0ecff', glyph: '純',
    desc: '力と引き換えに、その人であることを手放したもの。もう誰でもない。',
  },

  bs_nameless_sovereign: {
    name: '名を失くした帝', element: 'dark', boss: true,
    base: { hp: 80000, atk: 980, def: 1220, magi_power: 1100 },
    growth: { hp: 2150, atk: 38, def: 45, magi_power: 42 },
    skills: ['sk_enemy_apocalypse', 'sk_enemy_devour', 'sk_enemy_judgment', 'sk_enemy_crush'],
    gold: 16000, exp: 60000,
    drops: [{ box: 'box_dragon', chance: 1.0, count: 8 },
            { box: 'box_astral', chance: 1.0, count: 2 }],
    color: '#9d7aff', glyph: '帝',
    desc: '「帝」の字だけが残っている。人だったことの、それが唯一の証拠。',
  },

};
