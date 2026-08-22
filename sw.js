/* eslint-env serviceworker */
/**
 * Service Worker — オフライン対応 (§15)
 *
 * ── なぜ必要か ──
 * 外出先の電波は途切れる。このゲームはサーバーと通信しないので、
 * ファイルさえ手元にあれば圏外でも完全に動く。
 * それを実現するのがこのファイル。
 *
 * ── 方針 ──
 * ビルド工程が無い（＝ファイル名にハッシュが付かない）ので、
 * ファイルごとの新旧判定はできない。代わりに **CACHE_VERSION を1つ持ち、
 * 上げたら全部まとめて捨てて取り直す**。
 * JSファイルが新旧入り混じって読み込まれる事故を、これで根本から防ぐ。
 *
 *   ★ ファイルを変更したら CACHE_VERSION を必ず上げること。
 *     上げ忘れると、端末に古い版が残り続ける。
 *
 * skipWaiting は **あえて呼ばない**。
 * 開いているページの途中で差し替わると、読み込み済みの古いJSと
 * 新しいJSが混ざる。閉じて開き直したときに切り替わるほうが安全。
 */

const CACHE_VERSION = 'v61';
const CACHE_NAME = `haigin-${CACHE_VERSION}`;

/**
 * 初回訪問の時点で貯めておくファイル。
 *
 * Service Worker がページを支配するのは2回目の読み込みからなので、
 * ここに書いておかないと「ホーム画面に追加してすぐ圏外」で何も起動しない。
 *
 *   ★ この配列は手で編集しない。
 *     ファイルを足したら `python tools/build_precache.py` で作り直す。
 */
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/pwa/icon-192.png',
  './assets/pwa/icon-512.png',
  './assets/pwa/icon-maskable-192.png',
  './assets/pwa/icon-maskable-512.png',
  './assets/pwa/apple-touch-icon.png',
  './src/namespace.js',
  './src/core/rng.js',
  './src/core/damage.js',
  './src/core/economy.js',
  './data/skills.js',
  './data/characters.js',
  './data/enemies.js',
  './data/equipment.js',
  './data/equipsets.js',
  './data/uniques.js',
  './data/fields.js',
  './data/gacha.js',
  './data/effectkinds.js',
  './data/maps.js',
  './data/skilltree.js',
  './data/statuses.js',
  './data/nodecategories.js',
  './data/classes.js',
  './data/quests.js',
  './data/tower.js',
  './data/arena.js',
  './data/art.js',
  './src/core/content.js',
  './content/heroines_pack.js',
  './src/core/tree.js',
  './src/core/klass.js',
  './src/core/units.js',
  './src/core/equipset.js',
  './src/core/gear.js',
  './src/core/enhance.js',
  './src/core/autosell.js',
  './src/core/state.js',
  './src/core/savefile.js',
  './src/core/gacha.js',
  './src/core/quest.js',
  './src/core/codex.js',
  './src/plugins/all_enemies.js',
  './src/plugins/barrier.js',
  './src/plugins/borrow_turn.js',
  './src/plugins/buffs.js',
  './src/plugins/chain_burst.js',
  './src/plugins/charge_strike.js',
  './src/plugins/combo_finish.js',
  './src/plugins/counter_stance.js',
  './src/plugins/def_ignore.js',
  './src/plugins/detonate.js',
  './src/plugins/full_burst.js',
  './src/plugins/heal.js',
  './src/plugins/hp_cost.js',
  './src/plugins/lifesteal_hit.js',
  './src/plugins/mark.js',
  './src/plugins/mass_extra.js',
  './src/plugins/mass_revive.js',
  './src/plugins/multi_debuff.js',
  './src/plugins/multi_hit.js',
  './src/plugins/pandemic.js',
  './src/plugins/poison.js',
  './src/plugins/reduction_buff.js',
  './src/plugins/self_curse.js',
  './src/plugins/sigil_strike.js',
  './src/plugins/status.js',
  './src/plugins/vengeance.js',
  './src/core/battle.js',
  './src/core/worldmap.js',
  './src/core/autoplay.js',
  './src/core/autoequip.js',
  './src/core/dispatch.js',
  './src/core/autolimit.js',
  './src/core/tower.js',
  './src/core/arena.js',
  './src/core/content-seal.js',
  './src/ui/dom.js',
  './src/ui/art.js',
  './src/ui/facecrop.js',
  './src/ui/artsource.js',
  './src/ui/widgets.js',
  './src/ui/base.js',
  './src/ui/battle.js',
  './src/ui/worldmap.js',
  './src/main.js',
  './styles.css',
  './assets/ui/coin.svg',
  './assets/ui/elem-dark.svg',
  './assets/ui/elem-earth.svg',
  './assets/ui/elem-fire.svg',
  './assets/ui/elem-light.svg',
  './assets/ui/elem-none.svg',
  './assets/ui/elem-water.svg',
  './assets/ui/elem-wind.svg',
  './assets/ui/levelup.svg',
  './assets/ui/lock.svg',
  './assets/ui/slot-accessory.svg',
  './assets/ui/slot-weapon.svg',
  './assets/ui/st-barrier.svg',
  './assets/ui/st-buff.svg',
  './assets/ui/st-counter.svg',
  './assets/ui/st-debuff.svg',
  './assets/ui/st-defbuff.svg',
  './assets/ui/st-extra.svg',
  './assets/ui/st-invincible.svg',
  './assets/ui/st-poison.svg',
  './assets/ui/st-regen.svg',
  './assets/ui/stat-atk.svg',
  './assets/ui/stat-def.svg',
  './assets/ui/stat-hp.svg',
  './assets/ui/stat-magi.svg',
  './assets/ui/tab-build.svg',
  './assets/ui/tab-gacha.svg',
  './assets/ui/tab-gear.svg',
  './assets/ui/tab-identify.svg',
  './assets/ui/tab-party.svg',
  './assets/ui/tab-sortie.svg',
  './assets/ui/tag-magi.svg',
  './assets/ui/tag-phys.svg',
  './assets/ui/tag-reli.svg',
  './assets/characters/ch_astra.webp',
  './assets/characters/ch_bran.webp',
  './assets/characters/ch_gald.webp',
  './assets/characters/ch_gow.webp',
  './assets/characters/ch_hero.webp',
  './assets/characters/ch_hikari.webp',
  './assets/characters/ch_hr_elena.webp',
  './assets/characters/ch_hr_kagura.webp',
  './assets/characters/ch_hr_luna.webp',
  './assets/characters/ch_hr_mylene.webp',
  './assets/characters/ch_hr_philia.webp',
  './assets/characters/ch_hr_serena.webp',
  './assets/characters/ch_kaze.webp',
  './assets/characters/ch_lg_aegis.webp',
  './assets/characters/ch_lg_alvina.webp',
  './assets/characters/ch_lg_aurora.webp',
  './assets/characters/ch_lg_carmina.webp',
  './assets/characters/ch_lg_chantal.webp',
  './assets/characters/ch_lg_ember.webp',
  './assets/characters/ch_lg_frisia.webp',
  './assets/characters/ch_lg_ignis.webp',
  './assets/characters/ch_lg_iris.webp',
  './assets/characters/ch_lg_licorice.webp',
  './assets/characters/ch_lg_lumen.webp',
  './assets/characters/ch_lg_mireille.webp',
  './assets/characters/ch_lg_nefeli.webp',
  './assets/characters/ch_lg_nox.webp',
  './assets/characters/ch_lg_serafina.webp',
  './assets/characters/ch_lg_theodora.webp',
  './assets/characters/ch_lg_valkyria.webp',
  './assets/characters/ch_lg_viola.webp',
  './assets/characters/ch_lg_zero.webp',
  './assets/characters/ch_mia.webp',
  './assets/characters/ch_mu.webp',
  './assets/characters/ch_noa.webp',
  './assets/characters/ch_rizel.webp',
  './assets/characters/ch_ryn.webp',
  './assets/characters/ch_selen.webp',
  './assets/characters/ch_shiki.webp',
  './assets/characters/ch_tor.webp',
  './assets/characters/ch_vell.webp',
  './assets/enemies/bs_ashen_monarch.webp',
  './assets/enemies/bs_end_dragon.webp',
  './assets/enemies/bs_flame_wyrm.webp',
  './assets/enemies/bs_genesis_echo.webp',
  './assets/enemies/bs_gnaw_king.webp',
  './assets/enemies/bs_mine_tyrant.webp',
  './assets/enemies/bs_ruin_keeper.webp',
  './assets/enemies/em_abyss_serpent.webp',
  './assets/enemies/em_ash_revenant.webp',
  './assets/enemies/em_cinder_queen.webp',
  './assets/enemies/em_dark_knight.webp',
  './assets/enemies/em_drake.webp',
  './assets/enemies/em_ember_bat.webp',
  './assets/enemies/em_first_flame.webp',
  './assets/enemies/em_frost_maiden.webp',
  './assets/enemies/em_gale_hawk.webp',
  './assets/enemies/em_glass_sentinel.webp',
  './assets/enemies/em_golem.webp',
  './assets/enemies/em_hollow_choir.webp',
  './assets/enemies/em_null_weaver.webp',
  './assets/enemies/em_sentinel.webp',
  './assets/enemies/em_slime.webp',
  './assets/enemies/em_solar_seraph.webp',
  './assets/enemies/em_thunder_beast.webp',
  './assets/enemies/em_void_titan.webp',
  './assets/enemies/em_wisp.webp',
  './assets/enemies/em_wolf.webp',
  './assets/enemies/em_world_root.webp',
  './assets/bg/fl_abyss.webp',
  './assets/bg/fl_ashfall.webp',
  './assets/bg/fl_endless.webp',
  './assets/bg/fl_mine.webp',
  './assets/bg/fl_nest.webp',
  './assets/bg/fl_origin.webp',
  './assets/bg/fl_plain.webp',
  './assets/bg/fl_ruins.webp',
  './assets/bg/screen-arena.webp',
  './assets/bg/screen-build.webp',
  './assets/bg/screen-codex.webp',
  './assets/bg/screen-forge.webp',
  './assets/bg/screen-gacha.webp',
  './assets/bg/screen-gear.webp',
  './assets/bg/screen-identify.webp',
  './assets/bg/screen-party.webp',
  './assets/bg/screen-quest.webp',
  './assets/bg/screen-tower.webp',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // 1つでも失敗すると install ごと落ちるので、個別に握りつぶす。
      // 取り逃したものは fetch 側で後から拾える。
      Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => null)))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('haigin-') && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // GET 以外と外部ドメインには触らない
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 検証ページと制作ツールは遊ぶのに要らない。
  // ここまでキャッシュすると、テストを直したのに古い結果が出続けて
  // 「直したはずなのに落ちる」という無駄な調査を生む。
  if (url.pathname.includes('/test/') || url.pathname.includes('/tools/')) return;

  // ページ本体はネットワーク優先。
  // 圏内なら更新が届き、圏外ならキャッシュから開く。
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  // それ以外（JS・データ・画像）はキャッシュ優先。
  // 起動が速く、圏外でもそのまま動く。新版は CACHE_VERSION の更新で入れ替わる。
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        // 不透明レスポンスや失敗は貯めない
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
