# 被弾エフェクトの素材

`assets/ui/fx-cut.webp` — 斬撃の弧。128px × 12コマ（1536×128）。**白で描いてある。**

## なぜ白なのか

属性色は JS が `--fx` に差し込む（`src/ui/battle.js` の `burst()`）。
7属性ぶんの絵を持つのは無理なので、**白い1枚をCSSのマスクにして、地を `var(--fx)` で塗る**。
`styles.css` の `.fx-burst.is-phys` がそれ。**JS側は1行も変えていない。**

## 作り方

Unity（6000.6.0f1 / URP）で描き出している。`render.cs` の中身を Unity の
MCP 経由か、エディタ拡張として実行すると `_scratch/fx/cut_00..11.png` が出る。

```bash
python tools/fx/pack.py        # 連番 → assets/ui/fx-cut.webp
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
