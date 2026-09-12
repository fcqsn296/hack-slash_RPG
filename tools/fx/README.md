# 被弾エフェクトの素材

系統ごとに1枚ずつ。どれも 128px × 12コマ（1536×128）で、**白で描いてある。**

| 系統 | 素材 | 形 | 大きさ |
|---|---|---|---|
| 物理 `phys` | `assets/ui/fx-phys.webp` | 斬撃の弧 | 12.4KB |
| 魔術 `magi` | `assets/ui/fx-magi.webp` | 広がる波紋（3枚をずらす） | 22.0KB |
| 理 `reli` | `assets/ui/fx-reli.webp` | 締まる輪と6つの刻み | 24.1KB |

どの系統が来るかは技の `damage_type` で決まる（`src/core/battle.js` が
`kind: skill.damage_type || 'phys'` で載せる）。実データの内訳は phys 65 / magi 47 / reli 22 で、
**3枚とも実際に表示される**。

## なぜ白なのか

属性色は JS が `--fx` に差し込む（`src/ui/battle.js` の `burst()`）。
7属性ぶんの絵を持つのは無理なので、**白い1枚をCSSのマスクにして、地を `var(--fx)` で塗る**。
`styles.css` の `.fx-burst.is-phys / .is-magi / .is-reli` がそれ。**JS側は1行も変えていない。**

## 作り方

Unity（6000.6.0f1 / URP）で描き出している。`render.cs` の中身を Unity の
MCP 経由か、エディタ拡張として実行すると `_scratch/fx/<系統>_00..11.png` が出る。

```bash
python tools/fx/pack.py          # 3系統ぶんまとめて
python tools/fx/pack.py phys     # 1系統だけ
```

## Unity で踏んだ罠

- **レガシーシェーダは URP では描画されない。** `Legacy Shaders/Particles/Additive` を
  使ったら全コマ真っ白（＝不透明画素0）になった。**`Sprites/Default` を使うこと**
- `URP/Unlit` 系はテクスチャのアルファを無視して**クアッド全面が塗り潰される**。
  1コマだけ描いて不透明画素を数えれば、すぐ分かる（正: 3,804 / 誤: 8,100＝90×90）
- **Unity のクアッドは1辺1。** テクスチャUVの半径 0.70 はローカル座標では 0.35。
  ここを倍で計算して、弧が画面の外へ飛んでいた
- `cam.targetTexture` を張ったまま RenderTexture を Release するとエラーになる。
  **先に `cam.targetTexture = null`**
- シーンを汚さないため、生成物は全部 `HideFlags.HideAndDontSave` で作って
  `finally` で破棄する。Undo にも積まない

## 形を決めるときに分かったこと

最初は「放射状の閃光＋交差する2本の筋」で作ったが、**星に見えて斬撃に読めなかった**。
中心で対称に交差させると、どうしても星型になる。

三日月の弧（`Arc()`）に変え、腹を画面中央へ寄せ、破片を落としたら斬撃になった。
**破片は円状に撒くと中心でまた星になる**ので、入れるなら弧の上に沿わせること。

---

# マップのタイル

`assets/map/tile-<種類>.webp` — 床・草・道・壁・水・階段の6種。**合計16KB。**

どれも 256×256 で、128px の絵を **2×2 で4通り**詰めてある。
同じ種類のマスが並ぶと機械的に見えるので、`src/ui/worldmap.js` が
マスの位置から `v0`〜`v3` のどれかを付け、CSS が `background-position` で選ぶ。

```bash
python tools/fx/pack_tiles.py          # 連番 → assets/map/tile-*.webp
python tools/fx/pack_tiles.py floor    # 1種だけ
```

## 隙間と角丸を外したことが効いた

元は `background: var(--tile)` のべた塗りに `gap: 1px` と `border-radius: 2px`。
**絵を貼るだけでは足りない**——隙間と角丸が残っていると「マスの集まり」に見えて
地面にならない。両方外して初めて地続きになった。

駒の位置計算が `var(--cell) + 1px` と隙間を前提にしていたので、そこも直した
（外し忘れると駒が右下へずれていく）。

色（`--tile`）は下敷きとして残してある。絵が来なくても地図は読める。

## 4通りの選び方

`(x * 7 + y * 13 + 行数 * 3) % 4`。乱数にすると**描き直すたびに地面が変わる**ので、
位置から決める。素数を掛けて混ぜるだけでも規則性は目に見えなくなる。

CSS の `round()` で `--v` から位置を計算する書き方は捨てた。対応が新しく、
古い携帯だと1枚目に寄る。`.v0`〜`.v3` のクラスで選ぶ。

## 事前キャッシュに入れること

タイルは `styles.css` から参照するので、`index.html` を辿るだけでは拾えない。
`build_precache.py` の走査先に `assets/map` を足してある（`assets/bg` と同じ理由）。

## イベントの印

`assets/map/events.webp` — 宝箱・出口・会話・加入・戦闘・場面の6種。
192×128 に 64px の絵を **3×2** で詰め、**白のまま**（マスク用）。色は CSS の `--ev` が塗る。

```bash
python tools/fx/pack_events.py     # 連番 → assets/map/events.webp
```

並びは chest / exit / talk ／ join / battle / scene。
**`styles.css` の `mask-position` と揃えること**（ずれると別の印が出る）。
`pack_events.py` は白以外の色が混ざっていたら知らせる（混ざるとCSSで塗れない）。

### 22px で読めることが条件

いちばん狭い画面では1マス22px。ここで読めない形は使えない。

- **細い線は消える。** 太い塊で作る
- **交差は潰れる。** 戦闘の印は「交差する刃」を2回試して2回失敗した——
  1回目は ✕（「閉じる」に見える）、2回目は Y（音叉に見える）。
  刀1本（刃・鍔・柄・柄頭）に変えて初めて読めた
- **向きを間違えると別物になる。** 出口の矢は最初 柄を穂の上に置いてしまい、
  木のように見えた。矢は穂が上、柄が下

### 枠は残した

絵だけにすると、地面の明暗によって浮かないマスが出る（道と階段は明るい）。
薄い枠（`inset 0 0 0 2px`、不透明度0.6）と、印への影（`drop-shadow`）を併用する。

## Unity で踏んだ罠（被弾エフェクトの分に追加）

- **クラス直下に static のヘルパーを並べるとコンパイルが通らない。**
  ログも出ない（`COMPILATION_FAILED` だけ）。
  `Execute` の中のローカルなラムダ（`System.Func` / `System.Action`）に
  書き直したら通った。**helper は Execute の中に置くこと。**
- 1マス = 1ユニットにして `orthographicSize = 0.5f`。地は 1.02 倍で敷いて、
  縁に背景が覗かないようにする
