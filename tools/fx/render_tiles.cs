// マップのタイル6種を4通りずつ描き出す。Unity 6000.6 / URP で確認。
//
// 使い方: Unity の MCP（Unity_RunCommand）へこの中身をそのまま渡す。
// 出力は _scratch/tiles/<種類>_0..3.png。そのあと
// `python tools/fx/pack_tiles.py` で assets/map/tile-*.webp へまとめる。
//
// ── 書き方の制約（実際に踏んだ） ──
// **クラス直下に static のヘルパーを並べるとコンパイルが通らない。**
// ログも出ない（COMPILATION_FAILED だけ）。helper は Execute の中の
// ローカルなラムダ（System.Func / System.Action）として書くこと。
//
// URP では Sprites/Default を使う。Legacy の加算シェーダは描画されず、
// URP/Unlit 系はテクスチャのアルファを無視してクアッド全面を塗る。
using UnityEngine;
using UnityEditor;
using System.IO;
using System.Collections.Generic;

internal class CommandScript : IRunCommand
{
    public void Execute(ExecutionResult result)
    {
        const int SIZE = 128;
        string outDir = @"C:\Users\fcqsn\claude_build\hakusura-rpg\_scratch\tiles";

        var rootGo = new GameObject("__tile") { hideFlags = HideFlags.HideAndDontSave };
        Transform root = rootGo.transform;
        RenderTexture rt = null;
        Camera cam = null;
        try
        {
            var camGo = new GameObject("__cam") { hideFlags = HideFlags.HideAndDontSave };
            camGo.transform.SetParent(root, false);
            cam = camGo.AddComponent<Camera>();
            cam.orthographic = true;
            cam.orthographicSize = 0.5f;        // 1マス = 1ユニット
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0, 0, 0, 0);
            cam.transform.position = new Vector3(0, 0, -10);

            // ---- 形のテクスチャ ----
            System.Func<int, float, float, Texture2D> mkSlab = (n, rr, soft) =>
            {
                var t = new Texture2D(n, n, TextureFormat.RGBA32, false) { hideFlags = HideFlags.HideAndDontSave };
                var px = new Color[n * n];
                for (int y = 0; y < n; y++)
                    for (int x = 0; x < n; x++)
                    {
                        float u = Mathf.Abs((x + 0.5f) / n * 2f - 1f);
                        float v = Mathf.Abs((y + 0.5f) / n * 2f - 1f);
                        float dx = Mathf.Max(u - (1f - rr), 0f);
                        float dy = Mathf.Max(v - (1f - rr), 0f);
                        float d = Mathf.Sqrt(dx * dx + dy * dy) / Mathf.Max(0.0001f, rr);
                        float a = (u < 1f - rr && v < 1f - rr) ? 1f : Mathf.Clamp01(1f - (d - (1f - soft)) / soft);
                        px[y * n + x] = new Color(1, 1, 1, Mathf.Clamp01(a));
                    }
                t.SetPixels(px); t.Apply(); return t;
            };
            System.Func<int, float, Texture2D> mkBlob = (n, p) =>
            {
                var t = new Texture2D(n, n, TextureFormat.RGBA32, false) { hideFlags = HideFlags.HideAndDontSave };
                var px = new Color[n * n];
                for (int y = 0; y < n; y++)
                    for (int x = 0; x < n; x++)
                    {
                        float dx = (x + 0.5f) / n * 2f - 1f, dy = (y + 0.5f) / n * 2f - 1f;
                        px[y * n + x] = new Color(1, 1, 1,
                            Mathf.Pow(Mathf.Clamp01(1f - Mathf.Sqrt(dx * dx + dy * dy)), p));
                    }
                t.SetPixels(px); t.Apply(); return t;
            };
            System.Func<int, float, Texture2D> mkStreak = (n, thick) =>
            {
                var t = new Texture2D(n, n, TextureFormat.RGBA32, false) { hideFlags = HideFlags.HideAndDontSave };
                var px = new Color[n * n];
                for (int y = 0; y < n; y++)
                    for (int x = 0; x < n; x++)
                    {
                        float u = (x + 0.5f) / n * 2f - 1f, v = (y + 0.5f) / n * 2f - 1f;
                        float along = Mathf.Pow(Mathf.Clamp01(1f - Mathf.Abs(u)), 0.8f);
                        px[y * n + x] = new Color(1, 1, 1, Mathf.Clamp01(along * Mathf.Exp(-(v * v) / thick)));
                    }
                t.SetPixels(px); t.Apply(); return t;
            };
            // 継ぎ目の出ない値ノイズ（トーラス上で補間する）
            System.Func<int, int, int, Texture2D> mkNoise = (n, cells, seed) =>
            {
                var rnd = new System.Random(seed);
                var g = new float[cells, cells];
                for (int j = 0; j < cells; j++) for (int i = 0; i < cells; i++) g[i, j] = (float)rnd.NextDouble();
                var t = new Texture2D(n, n, TextureFormat.RGBA32, false) { hideFlags = HideFlags.HideAndDontSave };
                var px = new Color[n * n];
                for (int y = 0; y < n; y++)
                    for (int x = 0; x < n; x++)
                    {
                        float fx = (float)x / n * cells, fy = (float)y / n * cells;
                        int x0 = (int)fx % cells, y0 = (int)fy % cells;
                        int x1 = (x0 + 1) % cells, y1 = (y0 + 1) % cells;
                        float tx = fx - Mathf.Floor(fx), ty = fy - Mathf.Floor(fy);
                        tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
                        float a = Mathf.Lerp(g[x0, y0], g[x1, y0], tx);
                        float b = Mathf.Lerp(g[x0, y1], g[x1, y1], tx);
                        px[y * n + x] = new Color(1, 1, 1, Mathf.Lerp(a, b, ty));
                    }
                t.SetPixels(px); t.Apply(); return t;
            };

            Texture2D slab = mkSlab(96, 0.16f, 0.28f);
            Texture2D blob = mkBlob(64, 1.6f);
            Texture2D streak = mkStreak(64, 0.05f);
            Texture2D noise = mkNoise(128, 7, 4242);
            Shader sh = Shader.Find("Sprites/Default");

            var made = new List<GameObject>();
            System.Action<Texture2D, Color, float, float, float, float, float, float> Q =
                (tex, col, x, y, w, hh, rot, z) =>
            {
                var q = GameObject.CreatePrimitive(PrimitiveType.Quad);
                q.hideFlags = HideFlags.HideAndDontSave;
                Object.DestroyImmediate(q.GetComponent<MeshCollider>());
                q.transform.SetParent(root, false);
                q.transform.localPosition = new Vector3(x, y, z);
                q.transform.localScale = new Vector3(w, hh, 1f);
                q.transform.localRotation = Quaternion.Euler(0, 0, rot);
                var m = new Material(sh) { hideFlags = HideFlags.HideAndDontSave };
                m.mainTexture = tex; m.SetColor("_Color", col);
                q.GetComponent<MeshRenderer>().sharedMaterial = m;
                made.Add(q);
            };
            System.Action Clear = () =>
            {
                foreach (var g in made) if (g) Object.DestroyImmediate(g);
                made.Clear();
            };
            System.Func<int, Color> C = (hex) =>
                new Color(((hex >> 16) & 255) / 255f, ((hex >> 8) & 255) / 255f, (hex & 255) / 255f, 1f);

            rt = new RenderTexture(SIZE, SIZE, 24, RenderTextureFormat.ARGB32) { antiAliasing = 8 };
            rt.Create(); cam.targetTexture = rt;
            Directory.CreateDirectory(outDir);

            System.Action<string> Shot = (name) =>
            {
                cam.Render();
                var prev = RenderTexture.active;
                RenderTexture.active = rt;
                var tex = new Texture2D(SIZE, SIZE, TextureFormat.RGBA32, false);
                tex.ReadPixels(new Rect(0, 0, SIZE, SIZE), 0, 0); tex.Apply();
                RenderTexture.active = prev;
                File.WriteAllBytes(Path.Combine(outDir, name + ".png"), tex.EncodeToPNG());
                Object.DestroyImmediate(tex);
            };

            for (int v = 0; v < 4; v++)
            {
                var r = new System.Random(9100 + v * 17);
                System.Func<float> R = () => (float)r.NextDouble();
                System.Func<float> S = () => (float)r.NextDouble() * 2f - 1f;
                System.Func<Color, float, Color> J = (c, amt) =>
                {
                    float k = 1f + S() * amt;
                    return new Color(Mathf.Clamp01(c.r * k), Mathf.Clamp01(c.g * k), Mathf.Clamp01(c.b * k), 1f);
                };
                // 地。1.02倍で敷いて、縁に背景が覗かないようにする
                System.Action<Color, float> Ground = (c, amt) =>
                {
                    Q(null, c, 0, 0, 1.02f, 1.02f, 0, 1.0f);
                    Q(noise, new Color(1, 1, 1, amt), 0, 0, 1.02f, 1.02f, 0, 0.95f);
                    Q(noise, new Color(0, 0, 0, amt * 0.8f), 0.13f, -0.09f, 1.02f, 1.02f, 90, 0.94f);
                };
                // 1マス＝石1枚。影を右下へ落とし、上端を明るくして起伏を作る
                System.Action<Color, float, float> Flag = (c, inset, bevel) =>
                {
                    float w = 1f - inset;
                    Q(slab, new Color(0, 0, 0, 0.5f), 0.018f, -0.018f, w, w, S() * 1.6f, 0.7f);
                    Q(slab, J(c, 0.10f), 0, 0, w, w, S() * 1.6f, 0.6f);
                    Q(slab, new Color(1, 1, 1, bevel), -0.012f, 0.014f, w * 0.93f, w * 0.93f, 0, 0.5f);
                    Q(noise, new Color(0, 0, 0, 0.10f), 0, 0, w, w, 0, 0.45f);
                };

                // 床: 継承の座の石畳。暗く、青を抜いた灰
                Clear(); Ground(C(0x2c2f36), 0.07f); Flag(C(0x4a4e58), 0.10f, 0.09f);
                for (int i = 0; i < 3; i++)
                    Q(streak, new Color(0, 0, 0, 0.22f), S() * 0.3f, S() * 0.3f,
                        0.3f + R() * 0.3f, 0.03f, S() * 180f, 0.4f);
                Shot("floor_" + v);

                // 壁: 踏み込めない。ほぼ黒。縁を強く出す
                Clear(); Ground(C(0x0c0e12), 0.06f); Flag(C(0x1b1e25), 0.04f, 0.06f);
                Q(noise, new Color(0, 0, 0, 0.22f), 0, 0, 1.02f, 1.02f, 45, 0.35f);
                Shot("wall_" + v);

                // 道: 踏み固めた土。石は置かず小石を散らす
                Clear(); Ground(C(0x554a35), 0.10f);
                Q(noise, new Color(0.75f, 0.66f, 0.47f, 0.16f), 0, 0, 1.02f, 1.02f, 0, 0.6f);
                for (int i = 0; i < 7; i++)
                    Q(blob, J(C(0x8a7a58), 0.2f), S() * 0.42f, S() * 0.42f,
                        0.07f + R() * 0.07f, 0.06f + R() * 0.06f, 0, 0.5f);
                Shot("road_" + v);

                // 草: 灰をかぶった草地。房を立てる
                Clear(); Ground(C(0x2b3a2c), 0.10f);
                for (int i = 0; i < 16; i++)
                {
                    float gx = S() * 0.45f, gy = S() * 0.45f;
                    var gc = J(C(0x4c7a55), 0.22f);
                    Q(streak, new Color(0, 0, 0, 0.3f), gx + 0.012f, gy - 0.014f, 0.10f, 0.035f, 78f + S() * 22f, 0.55f);
                    Q(streak, gc, gx, gy, 0.10f + R() * 0.05f, 0.035f, 80f + S() * 26f, 0.5f);
                }
                Shot("grass_" + v);

                // 水: 踏み込めない。深い藍に波の筋
                Clear(); Ground(C(0x12283a), 0.08f);
                Q(noise, new Color(0.35f, 0.61f, 0.78f, 0.12f), 0, 0, 1.02f, 1.02f, 0, 0.7f);
                for (int i = 0; i < 3; i++)
                    Q(streak, new Color(0.72f, 0.86f, 0.95f, 0.16f + R() * 0.10f),
                        S() * 0.3f, -0.3f + i * 0.3f + S() * 0.06f, 0.55f + R() * 0.3f, 0.035f, S() * 6f, 0.5f);
                Shot("water_" + v);

                // 階段: 目印。段を横に刻み、金を差す
                Clear(); Ground(C(0x2f2a1c), 0.06f);
                for (int i = 0; i < 4; i++)
                {
                    float sy = -0.33f + i * 0.22f;
                    Q(slab, new Color(0, 0, 0, 0.45f), 0.01f, sy - 0.016f, 0.86f, 0.15f, 0, 0.7f);
                    Q(slab, J(C(0x8a7038), 0.10f), 0, sy, 0.86f, 0.15f, 0, 0.6f);
                    Q(slab, new Color(1, 0.92f, 0.7f, 0.16f), 0, sy + 0.05f, 0.82f, 0.05f, 0, 0.5f);
                }
                Shot("stair_" + v);
            }
            result.Log("{0} へ 6種×4通り", outDir);
        }
        finally
        {
            // Release より先に外す。順番を逆にするとエラーになる
            if (cam != null) cam.targetTexture = null;
            if (rt != null) { rt.Release(); Object.DestroyImmediate(rt); }
            Object.DestroyImmediate(rootGo);
        }
    }
}
