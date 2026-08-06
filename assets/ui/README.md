# UIアイコンの置き場所

[Free Game UI Assets](https://freegameui.net/) の素材です。

## ライセンス

**CC0 1.0** — 商用利用可、帰属表示不要、改変自由。
そのためこのゲーム側にライセンス表記の義務はありませんが、
差し替えや追加のときに出所を辿れるよう対応表を残しています。

## 使い方

**元のSVGは一切改変していません。** 素材はすべて単色（`fill="white"`）の 128x128 SVG で、
CSSの `mask-image` で切り抜いて `currentColor` で塗っています（`styles.css` の `.icn`）。

```js
W.icon('elem-fire')                       // 現在の文字色で塗られる
W.icon('coin', { size: '15px', color: 'var(--gold)' })
```

この方式にしているので、属性ごとの色分けやレアリティ別の着色が既存の配色変数だけで完結し、
素材ファイルには手を触れずに済みます。

## 差し替え

同じファイル名で置き換えるだけです。単色SVGであれば出所は問いません。
新しく足す場合は `assets/ui/` に置き、`W.icon('ファイル名')` で呼びます。

## 対応表

| ファイル | 用途 | 元アセットID |
|---|---|---|
| `tab-sortie.svg` | 出撃タブ | `ic_item_sword-iron_01` |
| `tab-gacha.svg` | ガチャタブ | `ic_shop_gacha_01` |
| `tab-identify.svg` | 鑑定タブ・宝箱 | `ic_item_treasure-chest_02` |
| `tab-gear.svg` | 装備タブ・防具スロット | `ic_item_armor_01` |
| `tab-build.svg` | ビルドタブ | `ic_system_skill-slot_01` |
| `tab-party.svg` | 編成タブ | `ic_social_users_01` |
| `coin.svg` | 所持ゴールド | `ic_shop_coin_01` |
| `lock.svg` | 装備のロック | `ic_item_key_01` |
| `levelup.svg` | レベルアップ | `ic_status_level-up_01` |
| `elem-fire.svg` | 火属性 | `ic_status_flame_01` |
| `elem-water.svg` | 水属性 | `ic_status_wet_01` |
| `elem-wind.svg` | 風属性 | `ic_field_weather-wind_01` |
| `elem-earth.svg` | 土属性 | `ic_field_biome-mountain_01` |
| `elem-light.svg` | 光属性 | `ic_field_weather-sun_01` |
| `elem-dark.svg` | 闇属性 | `ic_status_curse_01` |
| `elem-none.svg` | 無属性 | `ic_shop_diamond_01` |
| `stat-hp.svg` | HP | `ic_status_heart-half_01` |
| `stat-atk.svg` | ATK | `ic_system_power_01` |
| `stat-def.svg` | DEF | `ic_item_shield_01` |
| `stat-magi.svg` | 魔力 | `ic_item_wand_01` |
| `slot-weapon.svg` | 武器スロット | `ic_item_sword-iron_01` |
| `slot-accessory.svg` | アクセサリースロット | `ic_item_amulet_01` |
| `tag-phys.svg` | [物理]系統 | `ic_item_defend_01` |
| `tag-magi.svg` | [魔術]系統 | `ic_item_magic-circle_01` |
| `tag-reli.svg` | [遺物]系統 | `ic_shop_diamond_01` |
| `st-poison.svg` | 毒 | `ic_status_poison_01` |
| `st-regen.svg` | 再生 | `ic_status_regen_01` |
| `st-invincible.svg` | 無敵（軽減100%） | `ic_status_invincible_01` |
| `st-barrier.svg` | 被ダメージ軽減 | `ic_status_barrier_01` |
| `st-buff.svg` | バフ | `ic_status_buff-up_01` |
| `st-debuff.svg` | デバフ | `ic_status_debuff-down_01` |
| `st-counter.svg` | 反撃 | `ic_status_reflect_01` |
| `st-extra.svg` | 再行動 | `ic_status_haste_01` |
| `st-defbuff.svg` | 防御強化 | `ic_status_magic-shield_01` |

全 34 ファイル / 合計 16,382 バイト。

取得元URLの形式: `https://cdn.freegameui.net/svg/icons/<カテゴリ>/<アセットID>.svg`
