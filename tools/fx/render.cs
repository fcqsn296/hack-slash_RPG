// 被弾エフェクト（斬撃の弧）を12コマ描き出す。Unity 6000.6 / URP で確認。
//
// 使い方: Unity の MCP（Unity_RunCommand）へこの中身をそのまま渡すか、
// エディタ拡張として実行する。出力は _scratch/fx/cut_00..11.png。
// そのあと `python tools/fx/pack.py` でシートにまとめる。
//
// 注意は tools/fx/README.md にまとめてある。要点だけ再掲:
//   - URP では Legacy シェーダが描画されない。Sprites/Default を使う
//   - URP/Unlit 系はテクスチャのアルファを無視してクアッド全面を塗る
//   - Unity のクアッドは1辺1。UV半径 r はローカルでは r*0.5
//   - RenderTexture を Release する前に cam.targetTexture = null
using UnityEngine;
using UnityEditor;
using System.IO;

internal class CommandScript : IRunCommand
{
    const int SIZE = 128;
    const int FRAMES = 12;
    const float R = 0.70f;                 // 弧の半径（テクスチャUV基準）
    const string OUT = @"C:\Users\fcqsn\claude_build\hakusura-rpg\_scratch\fx";

    /// 三日月の弧。r の円弧を spanDeg の範囲だけ残し、head で切っ先へ細らせる
    static Texture2D Arc(int n, float r, float w, float spanDeg, float head)
    {
        var t = new Texture2D(n, n, TextureFormat.RGBA32, false) { hideFlags = HideFlags.HideAndDontSave };
        var px = new Color[n * n];
        float span = spanDeg * Mathf.Deg2Rad;
        for (int y = 0; y < n; y++)
            for (int x = 0; x < n; x++)
            {
                float dx = (x + 0.5f) / n * 2f - 1f, dy = (y + 0.5f) / n * 2f - 1f;
                float d = Mathf.Sqrt(dx * dx + dy * dy);
                float ang = Mathf.Atan2(dy, dx);
                float band = Mathf.Exp(-((d - r) * (d - r)) / w);
                float k = Mathf.Clamp01(1f - Mathf.Abs(ang) / (span * 0.5f));
                float bias = Mathf.Lerp(1f, Mathf.Clamp01(0.35f + ang / span), head);
                px[y * n + x] = new Color(1, 1, 1, Mathf.Clamp01(band * Mathf.Pow(k, 0.5f) * bias));
            }
        t.SetPixels(px); t.Apply();
        return t;
    }

    static Texture2D Radial(int n, float power)
    {
        var t = new Texture2D(n, n, TextureFormat.RGBA32, false) { hideFlags = HideFlags.HideAndDontSave };
        var px = new Color[n * n];
        for (int y = 0; y < n; y++)
            for (int x = 0; x < n; x++)
            {
                float dx = (x + 0.5f) / n * 2f - 1f, dy = (y + 0.5f) / n * 2f - 1f;
                px[y * n + x] = new Color(1, 1, 1,
                    Mathf.Pow(Mathf.Clamp01(1f - Mathf.Sqrt(dx * dx + dy * dy)), power));
            }
        t.SetPixels(px); t.Apply();
        return t;
    }

    static Material Sprite(Texture2D tex)
    {
        // URP で通るのはこれ。Legacy の加算シェーダは無視される
        var m = new Material(Shader.Find("Sprites/Default")) { hideFlags = HideFlags.HideAndDontSave };
        m.mainTexture = tex; m.SetColor("_Color", Color.white);
        return m;
    }

    static GameObject Quad(Transform parent, Material mat)
    {
        var q = GameObject.CreatePrimitive(PrimitiveType.Quad);
        q.hideFlags = HideFlags.HideAndDontSave;
        Object.DestroyImmediate(q.GetComponent<MeshCollider>());
        q.transform.SetParent(parent, false);
        q.GetComponent<MeshRenderer>().sharedMaterial = mat;
        return q;
    }

    static void A(GameObject g, float a)
    {
        g.GetComponent<MeshRenderer>().sharedMaterial.SetColor("_Color", new Color(1, 1, 1, Mathf.Clamp01(a)));
    }

    /// 弧の腹を画面中央へ置く。クアッドは1辺1なので UV半径 R はローカルで R*0.5
    static void PlaceArc(GameObject g, float scale, float deg, float z)
    {
        float rad = deg * Mathf.Deg2Rad;
        float off = R * scale * 0.5f;
        g.transform.localRotation = Quaternion.Euler(0, 0, deg);
        g.transform.localScale = new Vector3(scale, scale, 1f);
        g.transform.localPosition = new Vector3(-Mathf.Cos(rad) * off, -Mathf.Sin(rad) * off, z);
    }

    public void Execute(ExecutionResult result)
    {
        var root = new GameObject("__fx") { hideFlags = HideFlags.HideAndDontSave };
        RenderTexture rt = null; Camera cam = null;
        try
        {
            var camGo = new GameObject("__fxcam") { hideFlags = HideFlags.HideAndDontSave };
            camGo.transform.SetParent(root.transform, false);
            cam = camGo.AddComponent<Camera>();
            cam.orthographic = true; cam.orthographicSize = 1f;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0, 0, 0, 0);
            cam.transform.position = new Vector3(0, 0, -10);

            var arc = Quad(root.transform, Sprite(Arc(192, R, 0.0045f, 170f, 0.6f)));   // 刃の本体
            var edge = Quad(root.transform, Sprite(Arc(192, R, 0.0010f, 140f, 0.85f))); // 切っ先の芯
            var back = Quad(root.transform, Sprite(Arc(192, R, 0.0018f, 100f, 0.9f)));  // 返しの一閃
            var glow = Quad(root.transform, Sprite(Radial(128, 3.4f)));                 // 当たった瞬間の芯

            rt = new RenderTexture(SIZE, SIZE, 24, RenderTextureFormat.ARGB32) { antiAliasing = 8 };
            rt.Create(); cam.targetTexture = rt;
            Directory.CreateDirectory(OUT);

            for (int f = 0; f < FRAMES; f++)
            {
                float t = f / (float)(FRAMES - 1);
                float env = Mathf.Sin(Mathf.Pow(t, 0.72f) * Mathf.PI);   // 最後のコマで消える山
                float deg = -36f + t * 14f;
                float s = Mathf.Lerp(0.55f, 2.0f, Mathf.Pow(t, 0.42f));

                PlaceArc(arc, s, deg, 0.2f); A(arc, env);
                PlaceArc(edge, s * 1.01f, deg + 2f, 0.25f);
                A(edge, Mathf.Clamp01(Mathf.Sin(Mathf.Pow(Mathf.Clamp01(t / 0.72f), 0.8f) * Mathf.PI)));

                float tb = Mathf.Clamp01((t - 0.18f) / 0.82f);
                PlaceArc(back, Mathf.Lerp(0.5f, 1.55f, Mathf.Pow(tb, 0.45f)), 138f - t * 10f, 0.15f);
                A(back, Mathf.Sin(Mathf.Pow(tb, 0.8f) * Mathf.PI) * 0.5f);

                glow.transform.localScale = Vector3.one * Mathf.Lerp(0.28f, 0.66f, t);
                glow.transform.localPosition = new Vector3(0, 0, 0.3f);
                A(glow, Mathf.Clamp01(1f - t / 0.28f) * 0.8f);

                cam.Render();

                var prev = RenderTexture.active;
                RenderTexture.active = rt;
                var tex = new Texture2D(SIZE, SIZE, TextureFormat.RGBA32, false);
                tex.ReadPixels(new Rect(0, 0, SIZE, SIZE), 0, 0); tex.Apply();
                RenderTexture.active = prev;

                File.WriteAllBytes(Path.Combine(OUT, string.Format("cut_{0:00}.png", f)), tex.EncodeToPNG());
                Object.DestroyImmediate(tex);
            }
            result.Log("{0} へ {1} コマ", OUT, FRAMES);
        }
        finally
        {
            // Release より先に外す。順番を逆にするとエラーになる
            if (cam != null) cam.targetTexture = null;
            if (rt != null) { rt.Release(); Object.DestroyImmediate(rt); }
            Object.DestroyImmediate(root);
        }
    }
}
