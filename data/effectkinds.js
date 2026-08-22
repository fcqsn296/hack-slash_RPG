// 効果種別の登録簿 (§5.8 / §7.8)
//
// ── なぜこれが要るか ──
// 効果の情報が3か所に散っていて、**過去に2回ずれた**。
//   tree.js の switch        … 実装
//   units.js の3つのKEYS配列  … ユニーク装備からの流し先（手書きだった）
//   docs の効果キー表         … 手順書（手書きだった）
//
// ずれると「一覧にはあるのに効かない」という、一番たちの悪い壊れ方をする。
// 実際 critPierce と debuffAmp を passives に置いて、長いあいだ死んでいた。
//
// ここを唯一の出どころにして、units.js の配列はここから組み立てる。
//
// ── 各項目の意味 ──
//   to     ツリー/クラスから振ったとき、値がユニットのどこへ入るか
//   shape  レベルの重ね方
//            add    … value×レベルで加算（ほとんどがこれ）
//            max    … 高いほうを採る。上位ノードが下位を置き換えるためのもの。
//                     **加算ではないが、レベルぶんは伸びる**（value×レベルで比べる）。
//                     ここを e.value で比べると、同じノードを重ねても伸びなくなる。
//            levels … レベル数そのものを足す
//            keyed  … 属性や種類ごとの表に入れる
//   needs  この種別に必須の追加フィールド。無いと静かに既定値へ落ちる
//   opt    省略できるが、書かないと既定値のままになるフィールド
//   uniq   ユニーク装備の effects で使うキー名（camelCase）。null は装備からは持てない
//   route  そのキーをユニーク装備から流すときの行き先
//            passives    unit.passives へ加算
//            situational unit.situational へ加算（**passives に入れても届かない**）
//            unit        ユニットの素の値（damage.js が直接読む）
//            build       組み立て時に個別処理
//            setEffects  battle.js が p.x + fx.x で読むのでそのまま残す
RPG.data.effectKinds = {
  all_spread: { to: 'passives', shape: 'add', uniq: null },
  ambush: { to: 'passives', shape: 'add', uniq: 'ambush', route: 'passives' },
  atk_to_def: { to: 'passives', shape: 'add', uniq: null },
  auto_low_skill: { to: 'passives', shape: 'add', uniq: 'autoLowSkill', route: 'setEffects' },
  back_guard: { to: 'passives', shape: 'add', uniq: null },
  boss_guard: { to: 'situational', shape: 'add', uniq: null },
  boss_slayer: { to: 'situational', shape: 'add', uniq: 'bossSlayer', route: 'situational' },
  buff_duration: { to: 'passives', shape: 'add', uniq: null },
  buff_on_kill: { to: 'passives', shape: 'add', uniq: null },
  cap_break: { to: 'build', shape: 'add', uniq: 'capBreak', route: 'unit' },
  chain: { to: 'passives', shape: 'add', uniq: 'chain', route: 'passives' },
  chain_power: { to: 'passives', shape: 'add', uniq: 'chainPower', route: 'passives' },
  chaos: { to: 'build', shape: 'special', uniq: null },
  combo_gain: { to: 'passives', shape: 'add', uniq: 'comboGain', route: 'passives' },
  combo_keep: { to: 'passives', shape: 'add', uniq: null },
  combo_power: { to: 'passives', shape: 'add', uniq: 'comboPower', route: 'passives' },
  counter: { to: 'passives', shape: 'add', opt: ["power"], uniq: 'counterRate', route: 'passives' },
  counter_all: { to: 'passives', shape: 'add', uniq: null },
  counter_power: { to: 'passives', shape: 'add', uniq: null },
  crit: { to: 'build', shape: 'add', uniq: 'critRate', route: 'unit' },
  crit_combo: { to: 'passives', shape: 'add', uniq: null },
  crit_damage: { to: 'build', shape: 'add', uniq: 'critDamage', route: 'unit' },
  crit_execute: { to: 'situational', shape: 'add', uniq: null },
  crit_heal: { to: 'passives', shape: 'add', uniq: null },
  crit_pierce: { to: 'situational', shape: 'add', uniq: 'critPierce', route: 'situational' },
  crit_spread: { to: 'passives', shape: 'add', uniq: null },
  crit_stack: { to: 'passives', shape: 'add', uniq: null },
  damage_share: { to: 'passives', shape: 'add', uniq: null },
  debuff_amp: { to: 'situational', shape: 'add', uniq: 'debuffAmp', route: 'situational' },
  debuff_duration: { to: 'passives', shape: 'add', uniq: 'debuffDuration', route: 'passives' },
  debuff_resist: { to: 'passives', shape: 'add', uniq: null },
  debuff_spread: { to: 'passives', shape: 'add', uniq: 'debuffSpread', route: 'passives' },
  def_to_atk: { to: 'passives', shape: 'add', uniq: null },
  double_hits: { to: 'passives', shape: 'add', uniq: 'doubleHits', route: 'passives' },
  dual_element: { to: 'build', shape: 'special', needs: ["element"], uniq: null },
  element_adapt: { to: 'build', shape: 'add', uniq: 'elementAdapt', route: 'build' },
  element_convert: { to: 'build', shape: 'special', needs: ["element"], uniq: null },
  element_crit: { to: 'build', shape: 'keyed', needs: ["element"], uniq: null },
  element_mastery: { to: 'build', shape: 'keyed', needs: ["element"], uniq: null },
  element_pierce: { to: 'build', shape: 'add', uniq: null },
  element_power: { to: 'build', shape: 'keyed', needs: ["element"], uniq: null },
  element_resist: { to: 'build', shape: 'keyed', needs: ["element"], uniq: null },
  // ── 新しい5軸 (§5.9) ──
  // どれも既存キーの数値違いではなく、いま読む口が無い場所。
  evade:          { to: 'passives', shape: 'add', uniq: 'evade', route: 'passives' },
  focus_power:    { to: 'passives', shape: 'add', uniq: 'focusPower', route: 'passives' },
  relay_power:    { to: 'passives', shape: 'add', uniq: 'relayPower', route: 'passives' },
  mend_power:     { to: 'passives', shape: 'add', uniq: 'mendPower', route: 'passives' },
  cooldown_cut:   { to: 'passives', shape: 'add', uniq: 'cooldownCut', route: 'passives' },
  execute: { to: 'build', shape: 'add', uniq: 'execute', route: 'unit' },
  extra_action: { to: 'passives', shape: 'add', uniq: 'extraActionRate', route: 'passives' },
  first_hit_crit: { to: 'passives', shape: 'levels', uniq: null },
  first_round_power: { to: 'situational', shape: 'add', uniq: 'firstRoundPower', route: 'situational' },
  foe_count_power: { to: 'passives', shape: 'add', uniq: null },
  front_power: { to: 'passives', shape: 'add', uniq: null },
  full_hp_foe_power: { to: 'situational', shape: 'add', uniq: null },
  grant_skill: { to: 'build', shape: 'special', needs: ["skill"], uniq: null },
  guard_ally: { to: 'passives', shape: 'add', uniq: 'guardAlly', route: 'passives' },
  guard_break: { to: 'passives', shape: 'add', uniq: null },
  heal_on_kill: { to: 'passives', shape: 'add', uniq: 'healOnKill', route: 'passives' },
  heal_power: { to: 'passives', shape: 'add', uniq: 'healPower', route: 'passives' },
  high_hp_power: { to: 'situational', shape: 'add', uniq: null },
  high_power_boost: { to: 'situational', shape: 'add', uniq: 'highPowerBoost', route: 'situational' },
  hit_stack: { to: 'passives', shape: 'add', uniq: null },
  hp_to_atk: { to: 'passives', shape: 'add', uniq: null },
  hp_to_def: { to: 'passives', shape: 'add', uniq: 'hpToDef', route: 'passives' },
  kill_extra_action: { to: 'passives', shape: 'add', uniq: null },
  last_stand: { to: 'passives', shape: 'max', uniq: null },
  lifesteal: { to: 'passives', shape: 'add', uniq: null },
  lone_foe_power: { to: 'passives', shape: 'add', uniq: 'loneFoePower', route: 'passives' },
  low_hp_guard: { to: 'passives', shape: 'add', uniq: null },
  low_hp_power: { to: 'situational', shape: 'add', uniq: null },
  low_power_boost: { to: 'passives', shape: 'add', uniq: 'lowPowerBoost', route: 'setEffects' },
  low_power_repeat: { to: 'passives', shape: 'add', uniq: 'lowPowerRepeat', route: 'setEffects' },
  low_power_spread: { to: 'passives', shape: 'add', uniq: 'lowPowerSpread', route: 'setEffects' },
  mid_power_combo: { to: 'passives', shape: 'add', uniq: 'midPowerCombo', route: 'passives' },
  mid_power_status: { to: 'passives', shape: 'add', uniq: 'midPowerStatus', route: 'passives' },
  mono_element_power: { to: 'passives', shape: 'add', uniq: null },
  neutral_power: { to: 'situational', shape: 'add', uniq: null },
  opening_buff: { to: 'passives', shape: 'add', uniq: null },
  overheal_shield: { to: 'passives', shape: 'add', uniq: 'overhealShield', route: 'passives' },
  overkill_carry: { to: 'passives', shape: 'add', uniq: null },
  party_size_power: { to: 'passives', shape: 'add', uniq: null },
  rainbow_power: { to: 'passives', shape: 'add', uniq: null },
  reduction: { to: 'build', shape: 'add', uniq: null },
  reflect: { to: 'passives', shape: 'add', uniq: 'reflect', route: 'passives' },
  regen: { to: 'passives', shape: 'add', uniq: null },
  repeat_power: { to: 'passives', shape: 'add', uniq: null },
  revive: { to: 'passives', shape: 'max', uniq: 'reviveHp', route: 'build' },
  round_stack: { to: 'passives', shape: 'add', uniq: null },
  self_curse_power: { to: 'passives', shape: 'add', uniq: 'selfCursePower', route: 'passives' },
  shield_regen: { to: 'passives', shape: 'add', uniq: 'shieldRegen', route: 'passives' },
  sigil_burst: { to: 'passives', shape: 'add', uniq: 'sigilBurst', route: 'passives' },
  slot: { to: 'build', shape: 'keyed', needs: ["slot"], uniq: null },
  solo_power: { to: 'passives', shape: 'add', uniq: 'soloPower', route: 'passives' },
  stable_damage: { to: 'passives', shape: 'add', uniq: null },
  start_shield: { to: 'passives', shape: 'add', uniq: null },
  stat_pct: { to: 'build', shape: 'keyed', needs: ["stat"], uniq: null },
  status_immune: { to: 'passives', shape: 'add', uniq: null },
  status_on_hit: { to: 'passives', shape: 'add', uniq: null },
  status_on_hit_kind: { to: 'passives', shape: 'keyed', needs: ["status"], uniq: null },
  status_power: { to: 'passives', shape: 'add', uniq: 'statusPower', route: 'passives' },
  status_resist_kind: { to: 'passives', shape: 'keyed', needs: ["status"], uniq: null },
  tag_all: { to: 'build', shape: 'add', uniq: null },
  tag_bonus: { to: 'build', shape: 'keyed', needs: ["tag"], uniq: null },
  tag_crit: { to: 'build', shape: 'keyed', needs: ["tag"], uniq: null },
  tag_pierce: { to: 'build', shape: 'keyed', needs: ["tag"], uniq: null },
  thorns: { to: 'passives', shape: 'add', uniq: null },
  variety_power: { to: 'passives', shape: 'add', uniq: null },
  vs_status_power: { to: 'passives', shape: 'keyed', needs: ["status"], uniq: null },
  wave_heal: { to: 'passives', shape: 'add', uniq: null },
  wave_power: { to: 'passives', shape: 'add', uniq: null },
  wave_revive: { to: 'passives', shape: 'max', uniq: null },
  wave_stack: { to: 'passives', shape: 'add', uniq: null },
  weak_guard: { to: 'situational', shape: 'add', uniq: null },
  weak_hunter: { to: 'situational', shape: 'add', uniq: null },
};

/**
 * ツリーに対応する種別を持たない、**装備セット専用**の効果キー (§7.7)。
 *
 * これらは battle.js が `p.x + fx.x` の形で setEffects から直接読む。
 * passives へ流すと二重に効くので、組み立て時は触らない。
 */
RPG.data.effectKeysSetOnly = {
  selfPower:     { route: 'setEffects', desc: '自分の火力（共鳴セットの代償側）' },
  fallenPower:   { route: 'setEffects', desc: '倒れた味方1人につき強くなる' },
  decayPerRound: { route: 'setEffects', desc: 'ラウンドごとに火力が落ちる' },
  decayFloor:    { route: 'setEffects', desc: '落ちきる下限' },
  wrathRatio:    { route: 'setEffects', desc: '受けたダメージを怒りへ変える割合' },
  wrathRelease:  { route: 'setEffects', desc: '溜めた怒りを解き放つ' },
  comboLock:     { route: 'setEffects', desc: '積んだコンボが減らなくなる' },
};

/**
 * ユニーク装備・装備セットの effects に書けるキー → 行き先 の対応表。
 * 上の2つから組み立てる。units.js がこれを見て流し先を決める。
 */
RPG.data.effectRoutes = (function () {
  /** @type {Record<string, string>} */
  const out = {};
  for (const kind of Object.keys(RPG.data.effectKinds)) {
    const d = RPG.data.effectKinds[kind];
    if (d.uniq) out[d.uniq] = d.route;
  }
  for (const key of Object.keys(RPG.data.effectKeysSetOnly)) {
    out[key] = RPG.data.effectKeysSetOnly[key].route;
  }
  return out;
})();
