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
