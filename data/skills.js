// スキルカタログ (§9.2)
// ここに追記するだけでスキルが増える。特殊ロジックは plugin フィールドで
// src/plugins/*.js のプラグインIDを指すこと (§9.1)。
//
// scaling_stat : 基礎ダメージ計算に使うステータス ('atk' | 'magi_power')
// damage_type  : 系統タグの一致判定に使う種別 ('phys' | 'magi' | 'reli')
// element      : 'none' | 'fire' | 'water' | 'wind' | 'earth' | 'light' | 'dark'
// power        : スキル威力倍率 (100 = 等倍)
RPG.data.skills = {
  /* ---------------- 汎用アクティブ ---------------- */
  sk_slash: {
    name: '斬撃', kind: 'active', plugin: null,
    scaling_stat: 'atk', damage_type: 'phys', element: 'none',
    power: 100, crit_rate: 0.05,
    desc: '基本の一撃。無属性なので相性事故がない。',
  },
  sk_heavy_slash: {
    name: '重斬', kind: 'active', plugin: null,
    scaling_stat: 'atk', damage_type: 'phys', element: 'none',
    power: 160, crit_rate: 0.05,
    desc: '大振りな一撃。威力160%。',
  },
  sk_fire_bolt: {
    name: '火炎弾', kind: 'active', plugin: null,
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'fire',
    power: 130, crit_rate: 0.05,
    desc: '火属性の魔弾。魔力参照・[魔術]系統。',
  },
  sk_aqua_lance: {
    name: '水牙槍', kind: 'active', plugin: null,
    scaling_stat: 'atk', damage_type: 'phys', element: 'water',
    power: 130, crit_rate: 0.08,
    desc: '水属性の刺突。火属性の敵に有利。',
  },
  sk_gale_edge: {
    name: '疾風刃', kind: 'active', plugin: null,
    scaling_stat: 'atk', damage_type: 'phys', element: 'wind',
    power: 120, crit_rate: 0.15,
    desc: '風属性の斬撃。クリティカル率が高い。',
  },
  sk_stone_press: {
    name: '岩塊圧', kind: 'active', plugin: null,
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'earth',
    power: 140, crit_rate: 0.05,
    desc: '土属性の圧殺。水属性の敵に有利。',
  },

  /* ------- §4 あべこべビルドの実演 (データ定義のみで成立) ------- */
  sk_magic_blade: {
    name: '魔力斬', kind: 'active', plugin: null,
    scaling_stat: 'atk', damage_type: 'magi', element: 'none',
    power: 120, crit_rate: 0.05,
    desc: 'ATK参照でありながら[魔術]系統。魔術装備で威力が伸びる。',
  },
  sk_mind_bash: {
    name: 'マインドバッシュ', kind: 'active', plugin: null,
    scaling_stat: 'magi_power', damage_type: 'phys', element: 'none',
    power: 120, crit_rate: 0.05,
    desc: '魔力参照でありながら[物理]系統。物理装備で威力が伸びる。',
  },

  /* ---------------- プラグイン付きアクティブ (§9.1) ---------------- */
  sk_double_strike: {
    name: '双連撃', kind: 'active', plugin: 'multi_hit',
    scaling_stat: 'atk', damage_type: 'phys', element: 'wind',
    power: 70, crit_rate: 0.10,
    params: { hits: 2 },
    desc: '威力70%の攻撃を2回。手数がクリティカル機会を増やす。',
  },
  sk_armor_break: {
    name: '破鎧撃', kind: 'active', plugin: 'def_ignore',
    scaling_stat: 'atk', damage_type: 'phys', element: 'earth',
    power: 110, crit_rate: 0.05,
    params: { turns: 2 },
    desc: '防御を無視して攻撃し、2ターンの間その敵の防御を0にする。',
  },
  sk_poison_fang: {
    name: '毒牙', kind: 'active', plugin: 'poison',
    scaling_stat: 'atk', damage_type: 'phys', element: 'dark',
    power: 80, crit_rate: 0.05,
    params: { turns: 3, ratio: 0.06 },
    desc: '攻撃後、3ターンにわたり最大HPの6%の毒ダメージを与える。',
  },
  sk_focus: {
    name: '闘気集中', kind: 'active', plugin: 'unique_buff',
    scaling_stat: 'atk', damage_type: 'phys', element: 'none',
    power: 0, crit_rate: 0,
    params: { value: 0.5, turns: 3, label: '闘気' },
    desc: '3ターンの間、固有ユニークバフ+50%（別枠乗算）を得る。',
  },
  sk_phys_roar: {
    name: '鬨の声', kind: 'active', plugin: 'tag_buff',
    scaling_stat: 'atk', damage_type: 'phys', element: 'none',
    power: 0, crit_rate: 0,
    params: { tag: 'phys', value: 0.5, turns: 3, label: '鬨の声', party: true },
    desc: 'パーティ全体の[物理]系統補正を3ターン+50%（同タグ加算）。',
  },
  sk_heal_light: {
    name: '癒しの灯', kind: 'active', plugin: 'heal',
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'light',
    power: 150, crit_rate: 0,
    params: { party: false },
    desc: '味方1人のHPを魔力の150%分回復する。',
  },

  /* ---------------- 固有技 ---------------- */
  sk_hero_slash: {
    name: '覇王斬', kind: 'active', plugin: null, unique: true,
    scaling_stat: 'atk', damage_type: 'phys', element: 'light',
    power: 180, crit_rate: 0.15,
    desc: '【固有】光属性の王道物理技。威力180%、クリティカル率15%。',
  },
  sk_hero_heal: {
    name: '聖癒の光', kind: 'active', plugin: 'heal', unique: true,
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'light',
    power: 120, crit_rate: 0,
    params: { party: true },
    desc: '【固有】パーティ全員のHPを魔力の120%分回復する。',
  },
  sk_rizel_surge: {
    name: '灼熱奔流', kind: 'active', plugin: null, unique: true,
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'fire',
    power: 210, crit_rate: 0.05,
    desc: '【固有】火属性の大魔法。威力210%。',
  },
  sk_gald_bulwark: {
    name: '不動の砦', kind: 'active', plugin: 'def_buff', unique: true,
    scaling_stat: 'atk', damage_type: 'phys', element: 'earth',
    power: 0, crit_rate: 0,
    params: { value: 1.0, turns: 3, party: true, label: '砦' },
    desc: '【固有】3ターンの間、パーティ全員のDEFを2倍にする。',
  },
  sk_shiki_flurry: {
    name: '朧四連', kind: 'active', plugin: 'multi_hit', unique: true,
    scaling_stat: 'atk', damage_type: 'phys', element: 'wind',
    power: 55, crit_rate: 0.20,
    params: { hits: 4 },
    desc: '【固有】威力55%の攻撃を4回。クリティカル率20%。',
  },
  sk_noa_tide: {
    name: '清流の抱擁', kind: 'active', plugin: 'heal', unique: true,
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'water',
    power: 200, crit_rate: 0,
    params: { party: false },
    desc: '【固有】味方1人を魔力の200%分回復する。',
  },

  sk_bran_smash: {
    name: '渾身打ち', kind: 'active', plugin: null, unique: true,
    scaling_stat: 'atk', damage_type: 'phys', element: 'earth',
    power: 155, crit_rate: 0.05,
    desc: '【固有】土属性の力任せな一撃。',
  },
  sk_mia_splash: {
    name: '潮騒', kind: 'active', plugin: null, unique: true,
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'water',
    power: 145, crit_rate: 0.05,
    desc: '【固有】水属性の魔法。火属性の敵に有利。',
  },
  sk_tor_flame: {
    name: '火だすき', kind: 'active', plugin: null, unique: true,
    scaling_stat: 'atk', damage_type: 'phys', element: 'fire',
    power: 150, crit_rate: 0.08,
    desc: '【固有】火を纏った斬撃。風属性の敵に有利。',
  },
  sk_selen_ray: {
    name: '聖光条', kind: 'active', plugin: null, unique: true,
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'light',
    power: 175, crit_rate: 0.05,
    desc: '【固有】光属性の貫通魔法。闇属性の敵に有利。',
  },
  sk_gow_roar: {
    name: '金剛の咆哮', kind: 'active', plugin: 'tag_buff', unique: true,
    scaling_stat: 'atk', damage_type: 'reli', element: 'none',
    power: 0, crit_rate: 0,
    params: { tag: 'reli', value: 0.6, turns: 3, label: '咆哮', party: true },
    desc: '【固有】パーティ全体の[遺物]系統補正を3ターン+60%。',
  },
  sk_ryn_veil: {
    name: '宵闇の帳', kind: 'active', plugin: 'def_ignore', unique: true,
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'dark',
    power: 150, crit_rate: 0.10,
    params: { turns: 2 },
    desc: '【固有】防御を無視する闇魔法。2ターン防御を崩す。',
  },
  sk_astra_zero: {
    name: '零式・天穿', kind: 'active', plugin: null, unique: true,
    scaling_stat: 'atk', damage_type: 'reli', element: 'none',
    power: 235, crit_rate: 0.20,
    desc: '【固有】[遺物]系統の無属性最大威力技。属性事故が起きない。',
  },

  /* ------- 追加キャラの固有技 ------- */
  sk_kaze_dance: {
    name: '風舞の連刃', kind: 'active', plugin: 'multi_hit', unique: true,
    scaling_stat: 'atk', damage_type: 'phys', element: 'wind',
    power: 60, crit_rate: 0.18, params: { hits: 3 },
    desc: '【固有】風属性の三連撃。クリティカル率18%。',
  },
  sk_hikari_veil: {
    name: '光帷の加護', kind: 'active', plugin: 'reduction_buff', unique: true,
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'light',
    power: 0, crit_rate: 0,
    params: { value: 0.28, turns: 3, party: true, label: '光帷' },
    cooldown: 4,
    desc: '【固有】3ターンの間、パーティ全員の被ダメージを28%軽減する。',
  },
  sk_mu_impact: {
    name: '無相衝', kind: 'active', plugin: null, unique: true,
    scaling_stat: 'atk', damage_type: 'reli', element: 'none',
    power: 175, crit_rate: 0.10,
    desc: '【固有】[遺物]系統の無属性打撃。属性相性に左右されない。',
  },

  /* ------- レジェンドの特殊技 ------- */
  sk_lg_twin_edge: {
    name: '双牙・零', kind: 'active', plugin: null, unique: true,
    scaling_stat: 'atk', damage_type: 'phys', element: 'none',
    power: 140, crit_rate: 0.15,
    desc: '【固有】素直な一撃。ただし持ち主は常に2回攻撃する。',
  },
  sk_lg_retribution: {
    name: '報復の誓い', kind: 'active', plugin: 'unique_buff', unique: true,
    scaling_stat: 'atk', damage_type: 'phys', element: 'none',
    power: 0, crit_rate: 0,
    params: { value: 0.8, turns: 3, label: '報復' },
    desc: '【固有】3ターンの間、固有ユニークバフ+80%。反撃と噛み合う。',
  },
  sk_lg_calamity: {
    name: '厄災の宣告', kind: 'active', plugin: 'multi_debuff', unique: true,
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'dark',
    power: 95, crit_rate: 0.08,
    params: { turns: 4, defIgnore: true, poison: 0.07, statuses: ['厄災', '衰弱'] },
    desc: '【固有】防御崩壊・毒・厄災・衰弱を一度に叩き込む。',
  },
  sk_lg_bloodpact: {
    name: '血盟の刃', kind: 'active', plugin: 'hp_cost', unique: true,
    scaling_stat: 'atk', damage_type: 'reli', element: 'fire',
    power: 170, crit_rate: 0.20,
    params: { costRatio: 0.45, perHp: 0.0018, maxBonus: 5 },
    desc: '【固有】現在HPの45%を代償に、支払った量に応じて威力が最大6倍まで跳ね上がる。',
  },
  sk_lg_deluge: {
    name: '天雷の裁き', kind: 'active', plugin: 'all_enemies', unique: true,
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'light',
    power: 130, crit_rate: 0.12,
    desc: '【固有】光属性の全体攻撃。威力130%で敵すべてを撃つ。',
  },

  /* ------- スキルツリーで習得するアクティブ技 (§5.1) ------- */
  // ツリーは全キャラ共通なので、これらは誰でも取得できる。
  sk_tree_rally: {
    name: '鼓舞の号令', kind: 'active', plugin: 'unique_buff', tree: true,
    scaling_stat: 'atk', damage_type: 'phys', element: 'none',
    power: 0, crit_rate: 0,
    params: { value: 0.4, turns: 3, label: '鼓舞', party: true },
    desc: '【ツリー】3ターンの間、パーティ全員に固有ユニークバフ+40%（別枠乗算）。',
  },
  sk_tree_triple: {
    name: '三連の型', kind: 'active', plugin: 'multi_hit', tree: true,
    scaling_stat: 'atk', damage_type: 'phys', element: 'none',
    power: 65, crit_rate: 0.12,
    params: { hits: 3 },
    desc: '【ツリー】威力65%の攻撃を3回。クリティカルと相性が良い。',
  },
  sk_tree_drain: {
    name: '生命奪取', kind: 'active', plugin: 'lifesteal_hit', tree: true,
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'dark',
    power: 130, crit_rate: 0.05,
    params: { ratio: 0.4 },
    desc: '【ツリー】闇属性の吸収攻撃。与えたダメージの40%を自分のHPへ還元する。',
  },
  sk_tree_ruin: {
    name: '渾天撃', kind: 'active', plugin: null, tree: true,
    scaling_stat: 'atk', damage_type: 'reli', element: 'none',
    power: 320, crit_rate: 0.10,
    desc: '【ツリー】[遺物]系統の無属性大技。威力320%で属性事故が起きない。',
  },
  sk_tree_bastion: {
    name: '不動明王', kind: 'active', plugin: 'reduction_buff', tree: true,
    scaling_stat: 'atk', damage_type: 'phys', element: 'none',
    power: 0, crit_rate: 0,
    params: { value: 0.4, turns: 3, party: true, label: '不動' },
    cooldown: 4,
    desc: '【ツリー】3ターンの間、パーティ全員の被ダメージを40%軽減する。',
  },

  sk_tree_storm: {
    name: '乱れ撃ち', kind: 'active', plugin: 'all_enemies', tree: true,
    scaling_stat: 'atk', damage_type: 'phys', element: 'wind',
    power: 90, crit_rate: 0.08,
    desc: '【ツリー】風属性の全体攻撃。威力90%で敵すべてを巻き込む。',
  },
  sk_tree_pierce_shot: {
    name: '穿孔弾', kind: 'active', plugin: 'def_ignore', tree: true,
    scaling_stat: 'atk', damage_type: 'phys', element: 'none',
    power: 80, crit_rate: 0.10,
    params: { turns: 2 },
    desc: '【ツリー】威力80%の防御無視。小技なので「手数の心得」などの恩恵を受ける。',
  },
  sk_tree_bastion_cry: {
    name: '守りの号令', kind: 'active', plugin: 'reduction_buff', tree: true,
    scaling_stat: 'atk', damage_type: 'phys', element: 'none',
    power: 0, crit_rate: 0,
    params: { value: 0.25, turns: 3, party: true, label: '守りの号令' },
    cooldown: 4,
    desc: '【ツリー】味方全体の被ダメージを3ターン 25% 軽減する。',
  },
  sk_tree_venom: {
    name: '腐蝕の霧', kind: 'active', plugin: 'poison', tree: true,
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'dark',
    power: 60, crit_rate: 0.03,
    params: { turns: 4, ratio: 0.06 },
    desc: '【ツリー】威力60%と強い毒。「毒の心得」「呪詛の心得」と噛み合う小技。',
  },
  sk_tree_bulwark: {
    name: '城塞', kind: 'active', plugin: 'def_buff', tree: true,
    scaling_stat: 'atk', damage_type: 'phys', element: 'none',
    power: 0, crit_rate: 0,
    params: { value: 2.2, turns: 3, label: '城塞' },
    desc: '【ツリー】自分の防御力を3ターン 2.2倍にする。庇う役の土台になる。',
  },
  sk_tree_snipe: {
    name: '狙撃', kind: 'active', plugin: null, tree: true,
    scaling_stat: 'atk', damage_type: 'phys', element: 'wind',
    power: 150, crit_rate: 0.55,
    desc: '【ツリー】威力150%・会心率55%の単体攻撃。会心まわりのパッシブと噛み合う。',
  },
  sk_tree_judgment: {
    name: '断罪', kind: 'active', plugin: null, tree: true,
    scaling_stat: 'magi_power', damage_type: 'reli', element: 'light',
    power: 190, crit_rate: 0.12,
    desc: '【ツリー】威力190%の遺物系。追い打ちを積むほど、弱った敵に刺さる。',
  },
  sk_tree_sanctuary: {
    name: '聖域', kind: 'active', plugin: 'heal', tree: true,
    scaling_stat: 'magi_power', damage_type: 'reli', element: 'light',
    power: 0, crit_rate: 0,
    params: { ratio: 1.6, party: true },
    desc: '【ツリー】味方全体を大きく回復する。「癒しの余剰」があれば余剰が障壁になる。',
  },
  sk_tree_burst: {
    name: '全弾解放', kind: 'active', plugin: 'full_burst', tree: true,
    scaling_stat: 'atk', damage_type: 'phys', element: 'none',
    power: 0, crit_rate: 0.05,
    params: { ratio: 0.6, maxStun: 4 },
    desc: '【ツリー】持っている攻撃技をすべて威力60%で同時に叩き込み、' +
      '撃った本数ぶん（最大4）ラウンド行動できなくなる。技を多く抱えるほど強い。',
  },
  sk_tree_hex: {
    name: '万呪', kind: 'active', plugin: 'multi_debuff', tree: true,
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'dark',
    power: 70, crit_rate: 0.05,
    params: { turns: 3, defIgnore: true, poison: 0.05, statuses: ['呪詛'] },
    desc: '【ツリー】防御崩壊・毒・呪詛をまとめて付与する。「追い討ち」と噛み合う。',
  },
  sk_tree_sacrifice: {
    name: '命賭けの一撃', kind: 'active', plugin: 'hp_cost', tree: true,
    scaling_stat: 'atk', damage_type: 'reli', element: 'none',
    power: 150, crit_rate: 0.15,
    params: { costRatio: 0.35, perHp: 0.0016, maxBonus: 4 },
    desc: '【ツリー】現在HPの35%を代償に、支払った量に応じて威力が最大5倍まで跳ね上がる。',
  },

  /* --- §5.7 で足したツリー技 --- */
  // 初級の2本は、あえて威力100%以下にしてある。
  // 「小技の使い道」(§4.3) の受け皿を、序盤から誰でも1本は持てるようにするため。
  sk_tree_needle: {
    name: '刺突', kind: 'active', plugin: null, tree: true,
    scaling_stat: 'atk', damage_type: 'phys', element: 'none',
    power: 70, crit_rate: 0.10,
    desc: '【ツリー】威力70%の単体攻撃。小技なので拡散・連射・追撃のパッシブが全部乗る。',
  },
  sk_tree_spark: {
    name: '火花', kind: 'active', plugin: null, tree: true,
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'fire',
    power: 60, crit_rate: 0.08,
    desc: '【ツリー】威力60%の火属性。小技のうえに属性が付くので、拡散させると弱点を拾いやすい。',
  },
  sk_tree_lance: {
    name: '烈槍', kind: 'active', plugin: 'def_ignore', tree: true,
    scaling_stat: 'atk', damage_type: 'phys', element: 'earth',
    power: 220, crit_rate: 0.10,
    params: { turns: 2 },
    desc: '【ツリー】威力220%。当てた相手の防御を2ターン崩す。',
  },
  sk_tree_frost: {
    name: '氷結の枷', kind: 'active', plugin: 'multi_debuff', tree: true,
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'water',
    power: 120, crit_rate: 0.05,
    params: { turns: 3, defIgnore: true, poison: 0.03, statuses: ['凍結'] },
    desc: '【ツリー】威力120%。防御崩壊と凍結を同時に付ける。「疫病の広がり」で全体へ撒ける。',
  },
  sk_tree_chain_bolt: {
    name: '連雷', kind: 'active', plugin: 'all_enemies', tree: true,
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'wind',
    power: 90, crit_rate: 0.08,
    desc: '【ツリー】威力90%の全体攻撃。全体でありながら小技なので、連射系のパッシブが乗る。',
  },
  sk_tree_mend: {
    name: '再生の陣', kind: 'active', plugin: 'heal', tree: true,
    scaling_stat: 'magi_power', damage_type: 'reli', element: 'light',
    power: 0, crit_rate: 0,
    params: { ratio: 1.1, party: true },
    desc: '【ツリー】味方全体を回復する。「癒しの手」で伸び、あふれたぶんは障壁になる。',
  },
  sk_tree_eclipse: {
    name: '日蝕', kind: 'active', plugin: 'all_enemies', tree: true,
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'dark',
    power: 380, crit_rate: 0.10,
    desc: '【ツリー】威力380%の全体攻撃。掃除しながら「溢れる災禍」を溜められる。',
  },
  sk_tree_gaia: {
    name: '地衝', kind: 'active', plugin: null, tree: true,
    scaling_stat: 'atk', damage_type: 'phys', element: 'earth',
    power: 420, crit_rate: 0.18,
    desc: '【ツリー】威力420%の単体攻撃。会心率が高く、「会心貫通」と組ませると硬い相手を抜ける。',
  },
  sk_tree_aegis: {
    name: '不落の誓い', kind: 'active', plugin: 'reduction_buff', tree: true,
    scaling_stat: 'magi_power', damage_type: 'reli', element: 'light',
    power: 0, crit_rate: 0,
    params: { value: 0.35, turns: 3, party: true, label: '不落' },
    cooldown: 4,
    desc: '【ツリー】味方全体の被ダメージを3ターン 35%軽減する。他の軽減と足し合わせて無敵を狙える。',
  },

  /* --- §5.8 状態異常まわりのツリー技 --- */
  // 異常を撒く小技は、あえて威力を抑えてある。
  // 「削るための技」ではなく「相手を組み替えるための技」なので、
  // 火力は特効パッシブ側で回収する設計。
  sk_tree_ember: {
    name: '燻り', kind: 'active', plugin: 'status', tree: true,
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'fire',
    power: 80, crit_rate: 0.05,
    params: { status: 'burn', turns: 4, ratio: 0.05 },
    desc: '【ツリー】威力80%。火傷を付与し、相手が攻撃するたびに焼ける。',
  },
  sk_tree_gash: {
    name: '抉り', kind: 'active', plugin: 'status', tree: true,
    scaling_stat: 'atk', damage_type: 'phys', element: 'none',
    power: 85, crit_rate: 0.12,
    params: { status: 'bleed', turns: 4, ratio: 0.18 },
    desc: '【ツリー】威力85%。出血を付与し、相手が被弾するたびに傷が開く。多段技と噛み合う。',
  },
  sk_tree_curse: {
    name: '呪縛', kind: 'active', plugin: 'status', tree: true,
    scaling_stat: 'magi_power', damage_type: 'reli', element: 'dark',
    power: 70, crit_rate: 0.05,
    params: { status: 'curse', turns: 4, ratio: 0.5 },
    desc: '【ツリー】威力70%。呪詛を付与し、相手の回復とHP吸収を半減させる。',
  },
  sk_tree_shatter: {
    name: '氷砕', kind: 'active', plugin: 'status', tree: true,
    scaling_stat: 'atk', damage_type: 'phys', element: 'water',
    power: 240, crit_rate: 0.12,
    params: { status: 'freeze', turns: 3, ratio: 0.2 },
    desc: '【ツリー】威力240%。凍結を付与して以降の被ダメージを20%増やす。大技の底上げが乗る。',
  },
  sk_tree_numb: {
    name: '雷縛', kind: 'active', plugin: 'status', tree: true,
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'wind',
    power: 110, crit_rate: 0.05,
    params: { status: 'paralyze', turns: 3, ratio: 0.25, all: true },
    desc: '【ツリー】威力110%の全体攻撃。麻痺を付与して敵の手番を25%の確率で奪う。',
  },
  sk_tree_plague: {
    name: '万病', kind: 'active', plugin: 'status', tree: true,
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'dark',
    power: 90, crit_rate: 0.05,
    params: { statuses: ['poison', 'burn', 'bleed'], turns: 4, ratio: 0.05, all: true },
    desc: '【ツリー】威力90%の全体攻撃。毒・火傷・出血をまとめて撒く。特効パッシブの土台。',
  },
  sk_tree_smash: {
    name: '渾身撃', kind: 'active', plugin: null, tree: true,
    scaling_stat: 'atk', damage_type: 'phys', element: 'none',
    power: 280, crit_rate: 0.12,
    desc: '【ツリー】威力280%の単体攻撃。素直に重い一撃で、大技の底上げが乗る。',
  },
  sk_tree_ragnarok: {
    name: '終焉', kind: 'active', plugin: null, tree: true,
    scaling_stat: 'atk', damage_type: 'reli', element: 'dark',
    power: 520, crit_rate: 0.15,
    desc: '【ツリー】威力520%の単体攻撃。大技ビルドの到達点。',
  },
  sk_tree_glacier: {
    name: '氷河期', kind: 'active', plugin: 'status', tree: true,
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'water',
    power: 200, crit_rate: 0.08,
    params: { status: 'freeze', turns: 4, ratio: 0.3, all: true },
    desc: '【ツリー】威力200%の全体攻撃。全員を凍結させ、味方全員の火力を底上げする。',
  },
  sk_tree_purge: {
    name: '浄化', kind: 'active', plugin: 'heal', tree: true,
    scaling_stat: 'magi_power', damage_type: 'reli', element: 'light',
    power: 0, crit_rate: 0,
    params: { ratio: 2.2, party: true },
    desc: '【ツリー】味方全体を大きく回復する。「癒しの余剰」があれば、あふれたぶんが障壁になる。',
  },
  sk_tree_vengeance: {
    name: '報復', kind: 'active', plugin: 'vengeance', tree: true,
    scaling_stat: 'atk', damage_type: 'phys', element: 'none',
    power: 120, crit_rate: 0.1,
    params: { perHit: 0.35, maxBonus: 5 },
    desc: '【ツリー】被弾した回数1つにつき威力+35%（最大6倍）。殴られ役の切り札。',
  },

  /* --- §12 クラス技 ---
   *
   * どれも「戦闘の形を変える」強さがあるので、必ず2つの鍵をかけてある。
   *   readyRound … このラウンドに入るまで撃てない
   *   cooldown   … 撃つと このラウンド数だけ使えない
   * 鍵は battle.js が見る。data 側に書いておけば、新しいクラス技にも自動で効く。
   */
  sk_cls_aegis: {
    name: '絶対防壁', kind: 'active', plugin: 'reduction_buff', cls: true,
    scaling_stat: 'magi_power', damage_type: 'reli', element: 'light',
    power: 0, crit_rate: 0,
    readyRound: 3, cooldown: 5,
    params: { value: 0.8, turns: 1, party: true, label: '絶対防壁' },
    desc: '【クラス】味方全体の被ダメージを1ターン 80%軽減する。' +
      '3ラウンド目以降・使用後5ラウンド使えない。',
  },
  sk_cls_rebirth: {
    name: '再臨の光', kind: 'active', plugin: 'mass_revive', cls: true,
    scaling_stat: 'magi_power', damage_type: 'reli', element: 'light',
    power: 0, crit_rate: 0,
    readyRound: 4, cooldown: 6,
    params: { hp: 0.5, healRatio: 0.8 },
    desc: '【クラス】倒れた味方を全員HP50%で蘇生し、生存者も回復する。' +
      '4ラウンド目以降・使用後6ラウンド使えない。',
  },
  sk_cls_ruin: {
    name: '終焉の一撃', kind: 'active', plugin: null, cls: true,
    scaling_stat: 'atk', damage_type: 'phys', element: 'none',
    power: 800, crit_rate: 0.2,
    readyRound: 3, cooldown: 4,
    desc: '【クラス】威力800%の単体攻撃。' +
      '3ラウンド目以降・使用後4ラウンド使えない。',
  },
  sk_cls_crucible: {
    name: '疫病の坩堝', kind: 'active', plugin: 'status', cls: true,
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'dark',
    power: 140, crit_rate: 0.05,
    readyRound: 2, cooldown: 4,
    params: {
      statuses: ['poison', 'burn', 'bleed', 'paralyze', 'freeze', 'curse'],
      turns: 4, ratio: 0.08, all: true,
    },
    desc: '【クラス】敵全体に6種類すべての弱体を撒く。' +
      '2ラウンド目以降・使用後4ラウンド使えない。',
  },
  sk_cls_command: {
    name: '刻の号令', kind: 'active', plugin: 'mass_extra', cls: true,
    scaling_stat: 'magi_power', damage_type: 'reli', element: 'light',
    power: 0, crit_rate: 0,
    readyRound: 3, cooldown: 6,
    params: { buff: 0.3, turns: 2 },
    desc: '【クラス】味方全員がこのラウンド中にもう一度行動できるようになり、火力+30%。' +
      '3ラウンド目以降・使用後6ラウンド使えない。',
  },
  sk_cls_behead: {
    name: '首刈り', kind: 'active', plugin: null, cls: true,
    scaling_stat: 'atk', damage_type: 'phys', element: 'dark',
    power: 320, crit_rate: 1,
    readyRound: 2, cooldown: 3,
    forceIgnoreDefense: true,
    desc: '【クラス】威力320%・確定会心・防御無視の単体攻撃。' +
      '2ラウンド目以降・使用後3ラウンド使えない。',
  },

  /* --- §8.2 レジェンドの固有技（第2陣）---
   *
   * どれも §5.6〜§5.8 / §12 で足した仕組みのどれか1つを軸にしてある。
   * 「強い技」を並べるのではなく、**そのキャラを使う理由**が技に出るようにした。
   */
  sk_lg_absolute_zero: {
    name: '絶対零度', kind: 'active', plugin: 'status', unique: true,
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'water',
    power: 260, crit_rate: 0.08,
    params: { status: 'freeze', turns: 5, ratio: 0.35, all: true },
    desc: '敵全体に威力260%。凍結を5ターン付与し、以降パーティ全員の与ダメージが35%増える。',
  },
  sk_lg_pyre: {
    name: '焔の連舞', kind: 'active', plugin: 'multi_hit', unique: true,
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'fire',
    power: 85, crit_rate: 0.12, params: { hits: 4 },
    desc: '威力85%を4連撃。1発が小技の帯なので、拡散・連射・追撃のパッシブが全段に乗る。',
  },
  sk_lg_exsanguinate: {
    name: '紅涙', kind: 'active', plugin: 'status', unique: true,
    scaling_stat: 'atk', damage_type: 'phys', element: 'dark',
    power: 150, crit_rate: 0.18,
    params: { status: 'bleed', turns: 5, ratio: 0.30 },
    desc: '威力150%。出血を付与し、以降その敵が受ける全ての攻撃に30%が上乗せされる。',
  },
  sk_lg_silence: {
    name: '静寂の縛鎖', kind: 'active', plugin: 'status', unique: true,
    scaling_stat: 'magi_power', damage_type: 'reli', element: 'wind',
    power: 120, crit_rate: 0.05,
    params: { status: 'paralyze', turns: 4, ratio: 0.40, all: true },
    desc: '敵全体に威力120%。麻痺を付与し、40%の確率で手番そのものを奪う。',
  },
  sk_lg_anathema: {
    name: '呪縛の福音', kind: 'active', plugin: 'status', unique: true,
    scaling_stat: 'magi_power', damage_type: 'reli', element: 'light',
    power: 140, crit_rate: 0.05,
    params: { statuses: ['curse', 'poison'], turns: 5, ratio: 0.60, all: true },
    desc: '敵全体に威力140%。呪詛と毒を撒き、回復とHP吸収を60%封じる。',
  },
  sk_lg_crescendo: {
    name: '終奏', kind: 'active', plugin: null, unique: true,
    scaling_stat: 'atk', damage_type: 'phys', element: 'wind',
    power: 210, crit_rate: 0.15,
    desc: '威力210%。弱点コンボが乗るほど伸びる、コンボ役の締めの一撃。',
  },
  sk_lg_vanguard: {
    name: '先陣の白槍', kind: 'active', plugin: 'def_ignore', unique: true,
    scaling_stat: 'atk', damage_type: 'phys', element: 'earth',
    power: 280, crit_rate: 0.14, params: { turns: 3 },
    desc: '威力280%。防御を3ターン崩す。先頭に置いて1ラウンド目に撃つのが最も強い。',
  },
  sk_lg_bastion: {
    name: '万人の盾', kind: 'active', plugin: 'reduction_buff', unique: true,
    scaling_stat: 'magi_power', damage_type: 'reli', element: 'earth',
    power: 0, crit_rate: 0,
    params: { value: 0.45, turns: 3, party: true, label: '万人の盾' },
    cooldown: 4,
    desc: '味方全体の被ダメージを3ターン45%軽減する。他の軽減と足し合わせて無敵を狙える。',
  },
  sk_lg_thousand_needles: {
    name: '千の針', kind: 'active', plugin: 'all_enemies', unique: true,
    scaling_stat: 'atk', damage_type: 'phys', element: 'none',
    power: 65, crit_rate: 0.10,
    desc: '敵全体に威力65%。小技の帯なので、連射・底上げのパッシブが全部乗る。',
  },
  sk_lg_worldbreaker: {
    name: '世界断ち', kind: 'active', plugin: null, unique: true,
    scaling_stat: 'atk', damage_type: 'phys', element: 'fire',
    power: 620, crit_rate: 0.16,
    desc: '威力620%の単体攻撃。大技の底上げと上限突破を積んだときに真価が出る。',
  },
  sk_lg_bloodmoon: {
    name: '紅月', kind: 'active', plugin: null, unique: true,
    scaling_stat: 'atk', damage_type: 'phys', element: 'dark',
    power: 240, crit_rate: 0.60,
    desc: '威力240%・会心率60%。会心の余波で他の敵にもこぼれる。',
  },
  sk_lg_eclipse_prayer: {
    name: '双極の祈り', kind: 'active', plugin: null, unique: true,
    scaling_stat: 'magi_power', damage_type: 'reli', element: 'light',
    power: 300, crit_rate: 0.10,
    desc: '威力300%。光と闇の両方で相性を判定し、良かったほうが採用される。',
  },
  sk_lg_singular: {
    name: '一の太刀', kind: 'active', plugin: null, unique: true,
    scaling_stat: 'atk', damage_type: 'phys', element: 'none',
    power: 230, crit_rate: 0.12,
    desc: '威力230%。同じ技を続けるほど重くなるので、これだけを振り続けるのが正解になる。',
  },
  sk_lg_kaleidoscope: {
    name: '万華鏡', kind: 'active', plugin: 'all_enemies', unique: true,
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'water',
    power: 180, crit_rate: 0.10,
    desc: '敵全体に威力180%。技を撃ち分けるほど伸びるので、他の技と交互に使う。',
  },

  /* ---------------- 敵専用 ---------------- */
  sk_enemy_bite: {
    name: '噛みつき', kind: 'active', plugin: null,
    scaling_stat: 'atk', damage_type: 'phys', element: 'none',
    power: 100, crit_rate: 0.05, desc: '',
  },
  sk_enemy_claw: {
    name: '裂爪', kind: 'active', plugin: 'multi_hit',
    scaling_stat: 'atk', damage_type: 'phys', element: 'none',
    power: 60, crit_rate: 0.05, params: { hits: 2 }, desc: '',
  },
  sk_enemy_ember: {
    name: '火の粉', kind: 'active', plugin: null,
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'fire',
    power: 110, crit_rate: 0.05, desc: '',
  },
  sk_enemy_splash: {
    name: '水鉄砲', kind: 'active', plugin: null,
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'water',
    power: 110, crit_rate: 0.05, desc: '',
  },
  sk_enemy_gust: {
    name: '烈風', kind: 'active', plugin: null,
    scaling_stat: 'atk', damage_type: 'phys', element: 'wind',
    power: 115, crit_rate: 0.05, desc: '',
  },
  sk_enemy_quake: {
    name: '地響き', kind: 'active', plugin: null,
    scaling_stat: 'atk', damage_type: 'phys', element: 'earth',
    power: 120, crit_rate: 0.05, desc: '',
  },
  sk_enemy_shadow: {
    name: '影喰い', kind: 'active', plugin: 'poison',
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'dark',
    power: 90, crit_rate: 0.05, params: { turns: 3, ratio: 0.04 }, desc: '',
  },
  sk_enemy_dragon_breath: {
    name: '竜炎吐息', kind: 'active', plugin: null,
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'fire',
    power: 190, crit_rate: 0.10, desc: '',
  },
  sk_enemy_rend: {
    name: '竜爪断', kind: 'active', plugin: 'def_ignore',
    scaling_stat: 'atk', damage_type: 'phys', element: 'none',
    power: 150, crit_rate: 0.10, params: { turns: 1 }, desc: '',
  },

  /* ------- 高レベル帯の敵専用 ------- */
  sk_enemy_pulse: {
    name: '制御波', kind: 'active', plugin: null,
    scaling_stat: 'magi_power', damage_type: 'reli', element: 'none',
    power: 130, crit_rate: 0.05, desc: '',
  },
  sk_enemy_crush: {
    name: '圧壊', kind: 'active', plugin: null,
    scaling_stat: 'atk', damage_type: 'phys', element: 'none',
    power: 165, crit_rate: 0.08, desc: '',
  },
  sk_enemy_frost: {
    name: '氷結波', kind: 'active', plugin: null,
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'water',
    power: 145, crit_rate: 0.05, desc: '',
  },
  sk_enemy_thunder: {
    name: '雷撃', kind: 'active', plugin: 'multi_hit',
    scaling_stat: 'atk', damage_type: 'phys', element: 'wind',
    power: 85, crit_rate: 0.12, params: { hits: 2 }, desc: '',
  },
  sk_enemy_wither: {
    name: '枯死の呪', kind: 'active', plugin: 'poison',
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'dark',
    power: 120, crit_rate: 0.05, params: { turns: 3, ratio: 0.05 }, desc: '',
  },
  sk_enemy_judgment: {
    name: '裁きの光', kind: 'active', plugin: null,
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'light',
    power: 185, crit_rate: 0.10, desc: '',
  },
  sk_enemy_devour: {
    name: '呑噬', kind: 'active', plugin: 'def_ignore',
    scaling_stat: 'atk', damage_type: 'phys', element: 'dark',
    power: 175, crit_rate: 0.10, params: { turns: 2 }, desc: '',
  },
  sk_enemy_apocalypse: {
    name: '終焉の吐息', kind: 'active', plugin: null,
    scaling_stat: 'magi_power', damage_type: 'magi', element: 'dark',
    power: 240, crit_rate: 0.12, desc: '',
  },
};
