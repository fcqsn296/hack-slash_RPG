// イベントのマスに置く印6種を描き出す。Unity 6000.6 / URP で確認。
//
// 使い方: Unity の MCP（Unity_RunCommand）へこの中身をそのまま渡す。
// 出力は _scratch/tiles/ev_<種類>.png。そのあと
// `python tools/fx/pack_events.py` で assets/map/events.webp へまとめる。
//
// ── 22px で読めることが条件 ──
// いちばん狭い画面では1マス22px。**細い線は消え、交差は潰れる。**
// 戦闘の印は「交差する刃」を2回試して2回失敗した（✕ と Y に見えた）。
// 刀1本に変えて初めて読めた。詳細は tools/fx/README.md。
//
// ── 白のまま出す ──
// 色は CSS の --ev が塗る。絵を描き直さずに色を変えられるようにするため。
//
// helper は Execute の中のローカルなラムダで書く。
// クラス直下に static を並べるとコンパイルが通らない（ログも出ない）。
using UnityEngine;
using UnityEditor;
using System.IO;
using System.Collections.Generic;

internal class CommandScript : IRunCommand
{
    public void Execute(ExecutionResult result)
    {
        const int SIZE = 64;
        string outDir = @"C:\Users\fcqsn\claude_build\hakusura-rpg\_scratch\tiles";

        var rootGo = new GameObject("__ev") { hideFlags = HideFlags.HideAndDontSave };
        Transform root = rootGo.transform;
        RenderTexture rt = null;
        Camera cam = null;
        try
        {
            var camGo = new GameObject("__cam") { hideFlags = HideFlags.HideAndDontSave };
            camGo.transform.SetParent(root, false);
            cam = camGo.AddComponent<Camera>();
            cam.orthographic = true;
            cam.orthographicSize = 0.5f;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0, 0, 0, 0);
            cam.transform.position = new Vector3(0, 0, -10);

            // 角丸の板。rr を 1 に寄せると丸になる
            System.Func<int, float, Texture2D> mkRound = (n, rr) =>
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
                        float a = (u < 1f - rr && v < 1f - rr) ? 1f : Mathf.Clamp01((1f - d) / 0.10f);
                        px[y * n + x] = new Color(1, 1, 1, Mathf.Clamp01(a));
                    }
                t.SetPixels(px); t.Apply(); return t;
            };
            // 先の尖った形。tipHalf を小さくするほど鋭い。上が先
            System.Func<int, float, float, Texture2D> mkTaper = (n, baseHalf, tipHalf) =>
            {
                var t = new Texture2D(n, n, TextureFormat.RGBA32, false) { hideFlags = HideFlags.HideAndDontSave };
                var px = new Color[n * n];
                for (int y = 0; y < n; y++)
                    for (int x = 0; x < n; x++)
                    {
                        float u = (x + 0.5f) / n * 2f - 1f;
                        float v = (y + 0.5f) / n;
                        float half = Mathf.Lerp(baseHalf, tipHalf, v);
                        px[y * n + x] = new Color(1, 1, 1, Mathf.Clamp01((half - Mathf.Abs(u)) / 0.10f));
                    }
                t.SetPixels(px); t.Apply(); return t;
            };

            Texture2D box = mkRound(64, 0.18f);
            Texture2D dot = mkRound(64, 1.0f);
            Texture2D blade = mkTaper(64, 0.8f, 0.05f);
            Texture2D spike = mkTaper(64, 0.55f, 0.02f);
            Shader sh = Shader.Find("Sprites/Default");

            var made = new List<GameObject>();
            System.Action<Texture2D, float, float, float, float, float> Q =
                (tex, x, y, w, hh, rot) =>
            {
                var q = GameObject.CreatePrimitive(PrimitiveType.Quad);
                q.hideFlags = HideFlags.HideAndDontSave;
                Object.DestroyImmediate(q.GetComponent<MeshCollider>());
                q.transform.SetParent(root, false);
                q.transform.localPosition = new Vector3(x, y, 0.5f);
                q.transform.localScale = new Vector3(w, hh, 1f);
                q.transform.localRotation = Quaternion.Euler(0, 0, rot);
                var m = new Material(sh) { hideFlags = HideFlags.HideAndDontSave };
                m.mainTexture = tex; m.SetColor("_Color", Color.white);
                q.GetComponent<MeshRenderer>().sharedMaterial = m;
                made.Add(q);
            };
            System.Action Clear = () =>
            {
                foreach (var g in made) if (g) Object.DestroyImmediate(g);
                made.Clear();
            };

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
                File.WriteAllBytes(Path.Combine(outDir, "ev_" + name + ".png"), tex.EncodeToPNG());
                Object.DestroyImmediate(tex);
            };

            // 宝箱: 胴 + 蓋の帯 + 留め具
            Clear();
            Q(box, 0, -0.06f, 0.62f, 0.40f, 0);
            Q(box, 0, 0.15f, 0.68f, 0.22f, 0);
            Q(box, 0, 0.02f, 0.16f, 0.22f, 0);
            Shot("chest");

            // 出口: 上向きの矢。**柄は穂の下**。逆に置くと木に見える
            Clear();
            Q(blade, 0, 0.20f, 0.62f, 0.40f, 0);
            Q(box, 0, -0.18f, 0.20f, 0.44f, 0);
            Shot("exit");

            // 会話: 吹き出し。尾を左下へ
            Clear();
            Q(box, 0, 0.08f, 0.70f, 0.48f, 0);
            Q(blade, -0.18f, -0.26f, 0.26f, 0.26f, 200);
            Shot("talk");

            // 加入: 人の形。頭 + 肩
            Clear();
            Q(dot, 0, 0.20f, 0.30f, 0.30f, 0);
            Q(box, 0, -0.16f, 0.52f, 0.36f, 0);
            Shot("join");

            // 戦闘: 刀1本。鍔を横に広く張らせて刀と分かる形にする。
            // 交差は 22px で潰れる（✕ と Y に見えた）ので使わない
            Clear();
            Q(blade, 0, 0.26f, 0.26f, 0.52f, 0);
            Q(box, 0, -0.06f, 0.66f, 0.12f, 0);
            Q(box, 0, -0.28f, 0.16f, 0.34f, 0);
            Q(box, 0, -0.44f, 0.26f, 0.10f, 0);
            Shot("battle");

            // 場面: 光の四芒。腕を細く長くして十字に潰れないようにする
            Clear();
            Q(spike, 0, 0.24f, 0.20f, 0.48f, 0);
            Q(spike, 0, -0.24f, 0.20f, 0.48f, 180);
            Q(spike, 0.24f, 0, 0.20f, 0.48f, -90);
            Q(spike, -0.24f, 0, 0.20f, 0.48f, 90);
            Q(dot, 0, 0, 0.26f, 0.26f, 0);
            Shot("scene");

            result.Log("{0} へ 6種", outDir);
        }
        finally
        {
            if (cam != null) cam.targetTexture = null;
            if (rt != null) { rt.Release(); Object.DestroyImmediate(rt); }
            Object.DestroyImmediate(rootGo);
        }
    }
}
