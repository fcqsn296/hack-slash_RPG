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

const CACHE_VERSION = 'v7';
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
  './data/skilltree.js',
  './data/statuses.js',
  './data/nodecategories.js',
  './data/classes.js',
  './data/quests.js',
  './data/tower.js',
  './data/art.js',
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
  './src/plugins/multi_hit.js',
  './src/plugins/def_ignore.js',
  './src/plugins/poison.js',
  './src/plugins/status.js',
  './src/plugins/vengeance.js',
  './src/plugins/mass_revive.js',
  './src/plugins/mass_extra.js',
  './src/plugins/buffs.js',
  './src/plugins/heal.js',
  './src/plugins/lifesteal_hit.js',
  './src/plugins/reduction_buff.js',
  './src/plugins/multi_debuff.js',
  './src/plugins/hp_cost.js',
  './src/plugins/all_enemies.js',
  './src/plugins/full_burst.js',
  './src/core/battle.js',
  './src/core/autoplay.js',
  './src/core/autoequip.js',
  './src/core/dispatch.js',
  './src/core/autolimit.js',
  './src/core/tower.js',
  './src/ui/dom.js',
  './src/ui/art.js',
  './src/ui/facecrop.js',
  './src/ui/artsource.js',
  './src/ui/widgets.js',
  './src/ui/base.js',
  './src/ui/battle.js',
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
  './assets/characters/ch_astra.png',
  './assets/characters/ch_bran.png',
  './assets/characters/ch_gald.png',
  './assets/characters/ch_gow.png',
  './assets/characters/ch_hero.png',
  './assets/characters/ch_hikari.png',
  './assets/characters/ch_kaze.png',
  './assets/characters/ch_lg_aegis.png',
  './assets/characters/ch_lg_alvina.png',
  './assets/characters/ch_lg_aurora.png',
  './assets/characters/ch_lg_carmina.png',
  './assets/characters/ch_lg_chantal.png',
  './assets/characters/ch_lg_ember.png',
  './assets/characters/ch_lg_frisia.png',
  './assets/characters/ch_lg_ignis.png',
  './assets/characters/ch_lg_iris.png',
  './assets/characters/ch_lg_licorice.png',
  './assets/characters/ch_lg_lumen.png',
  './assets/characters/ch_lg_mireille.png',
  './assets/characters/ch_lg_nefeli.png',
  './assets/characters/ch_lg_nox.png',
  './assets/characters/ch_lg_serafina.png',
  './assets/characters/ch_lg_theodora.png',
  './assets/characters/ch_lg_valkyria.png',
  './assets/characters/ch_lg_viola.png',
  './assets/characters/ch_lg_zero.png',
  './assets/characters/ch_mia.png',
  './assets/characters/ch_mu.png',
  './assets/characters/ch_noa.png',
  './assets/characters/ch_rizel.png',
  './assets/characters/ch_ryn.png',
  './assets/characters/ch_selen.png',
  './assets/characters/ch_shiki.png',
  './assets/characters/ch_tor.png',
  './assets/characters/ch_vell.png',
  './assets/enemies/bs_ashen_monarch.png',
  './assets/enemies/bs_end_dragon.png',
  './assets/enemies/bs_flame_wyrm.png',
  './assets/enemies/bs_genesis_echo.png',
  './assets/enemies/bs_gnaw_king.png',
  './assets/enemies/bs_mine_tyrant.png',
  './assets/enemies/bs_ruin_keeper.png',
  './assets/enemies/em_abyss_serpent.png',
  './assets/enemies/em_ash_revenant.png',
  './assets/enemies/em_cinder_queen.png',
  './assets/enemies/em_dark_knight.png',
  './assets/enemies/em_drake.png',
  './assets/enemies/em_ember_bat.png',
  './assets/enemies/em_first_flame.png',
  './assets/enemies/em_frost_maiden.png',
  './assets/enemies/em_gale_hawk.png',
  './assets/enemies/em_glass_sentinel.png',
  './assets/enemies/em_golem.png',
  './assets/enemies/em_hollow_choir.png',
  './assets/enemies/em_null_weaver.png',
  './assets/enemies/em_sentinel.png',
  './assets/enemies/em_slime.png',
  './assets/enemies/em_solar_seraph.png',
  './assets/enemies/em_thunder_beast.png',
  './assets/enemies/em_void_titan.png',
  './assets/enemies/em_wisp.png',
  './assets/enemies/em_wolf.png',
  './assets/enemies/em_world_root.png',
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
  if (new URL(req.url).origin !== self.location.origin) return;

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
